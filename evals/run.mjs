// evals/run.mjs
// Plan evaluation set (RYR-11): generates a plan for every persona in
// evals/personas.json, runs the automatic checks, and prints pass rates plus
// tokens, latency and an approximate cost.
//
//   npm run eval                        all personas, current prompt and model
//   npm run eval -- --save-baseline     ...and save the result as evals/baseline.json
//   npm run eval -- --model gemini-2.5-flash
//   npm run eval -- --only home-beginner,commercial-pro
//   npm run eval -- --mock              no Gemini calls: plans built from the catalog
//                                       (tests the harness and checks, costs nothing)
//   npm run eval -- --generator website the website's older free-text generator
//                                       (default: the app's catalog-based plan builder)
//   npm run eval -- --rescore evals/baseline.json [--save-baseline]
//                                       re-run the checks on a saved run's plans
//                                       (after changing the checks; no Gemini calls)
//
// Real runs make one Gemini call per persona and cost real money (see the cost
// line in the summary). Run locally, not in CI. Reads GEMINI_API_KEY from
// .env.local the same way Next.js does.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'

const EVAL_DIR = path.dirname(fileURLToPath(import.meta.url))
const BASELINE_FILE = path.join(EVAL_DIR, 'baseline.json')
const RESULTS_DIR = path.join(EVAL_DIR, 'results')

// ---- Arguments ----
const argv = process.argv.slice(2)
const flag = name => argv.includes(`--${name}`)
const option = name => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const rescoreFile = option('rescore')
const rescored = rescoreFile ? JSON.parse(readFileSync(path.resolve(rescoreFile), 'utf8')) : null
const mock = flag('mock')
// app: the phone app's plan builder (lib/v1/generation, RYR-37), what users get.
// website: the older website generator (lib/apiHelpers), kept for comparison.
const generator = rescored ? (rescored.generator || 'website') : option('generator') === 'website' ? 'website' : 'app'
const saveBaseline = flag('save-baseline')
const only = option('only')?.split(',').map(s => s.trim()).filter(Boolean)
const concurrency = Math.max(1, Number(option('concurrency')) || 3)
if (option('model')) process.env.GEMINI_MODEL = option('model')

nextEnv.loadEnvConfig(path.resolve(EVAL_DIR, '..'))
if (!mock && !rescored && !process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is not set (expected in .env.local). Use --mock to test without Gemini.')
  process.exit(1)
}

// Imported after the environment is set, since the Gemini config reads it.
const { GYM_PRESETS, filterExercises, validateCatalog } = await import('@/lib/catalog')
const { generatePlanWithGemini } = await import('@/lib/apiHelpers')
const { getModelName } = await import('@/lib/geminiClient')
const { PROMPT_VERSION: WEBSITE_PROMPT_VERSION } = await import('@/lib/workoutPrompt')
const { generateProposal, PROPOSAL_PROMPT_VERSION } = await import('@/lib/v1/generation')
const { toAppEquipmentList } = await import('@/lib/v1/vocab')
const PROMPT_VERSION = generator === 'app' ? PROPOSAL_PROMPT_VERSION : WEBSITE_PROMPT_VERSION
const { runChecks, VOLUME } = await import('./checks.mjs')

// Approximate USD per 1M tokens (thinking tokens bill as output). Check
// https://ai.google.dev/pricing when comparing models; prompts here are
// well under the 200k-token tier.
const PRICES = {
  'gemini-2.5-pro': { input: 1.25, output: 10 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
}

const catalogProblems = validateCatalog()
if (catalogProblems.length) {
  console.error('The exercise catalog has problems; fix them first:', catalogProblems)
  process.exit(1)
}

// ---- Personas ----
const { personas: allPersonas } = JSON.parse(readFileSync(path.join(EVAL_DIR, 'personas.json'), 'utf8'))
const personas = allPersonas
  .filter(p => !only || only.includes(p.id))
  .map(p => ({ ...p, equipment: p.equipment || GYM_PRESETS[p.gymType] }))
  .map(p => (generator === 'app' ? { ...p, appEquipment: toAppEquipmentList(p.equipment) } : p))
if (!personas.length) {
  console.error('No personas match --only.')
  process.exit(1)
}

// ---- Plan for one persona ----
function mockPlan(persona) {
  // A plan built from the catalog, so the checks have something realistic to
  // judge. Not a quality bar: it ignores focus volume and session length.
  const level = persona.fitnessLevel
  const pool = filterExercises({ equipment: persona.equipment, level, familiar: persona.familiarExercises, commonOnly: level === 'beginner' })
  const [minEx] = VOLUME[level].exercises
  const [minSets] = VOLUME[level].sets
  const days = Array.from({ length: persona.frequency }, (_, d) => ({
    day: `Day ${d + 1}`,
    focus: persona.targetMuscles,
    durationMinutes: persona.sessionDuration,
    exercises: Array.from({ length: Math.min(minEx, pool.length) }, (_, i) => {
      const ex = pool[(d * minEx + i) % pool.length]
      return { name: ex.name, sets: minSets, reps: '8-12', restSeconds: 90, notes: '' }
    }),
  }))
  return { plan: { title: 'Mock plan', summary: '', days, notes: [] }, meta: { model: 'mock', promptVersion: PROMPT_VERSION, attempts: 0, latencyMs: 0, usage: null } }
}

// ---- App generator: personas as the app's profile ----
const TRAINING_DAYS = {
  1: ['wed'], 2: ['mon', 'thu'], 3: ['mon', 'wed', 'fri'], 4: ['mon', 'tue', 'thu', 'fri'],
  5: ['mon', 'tue', 'wed', 'fri', 'sat'], 6: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], 7: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
}
const APP_LEVEL = { beginner: 'beginner', intermediate: 'intermediate', professional: 'pro' }
const APP_HISTORY = { under_6_months: 'under_6_months', '6_to_24_months': 'six_months_to_2_years', over_2_years: 'over_2_years' }
const APP_GYM = { home: 'home', apartment: 'apartment_gym', community: 'community_center', commercial: 'commercial_gym' }

function toAppProfile(persona) {
  const limitations = [(persona.injuries || []).join(', '), persona.injuryNotes, persona.preferences].filter(Boolean).join('. ')
  return {
    version: 1,
    level: APP_LEVEL[persona.fitnessLevel] || 'beginner',
    goals: [persona.goal],
    trainingDays: TRAINING_DAYS[persona.frequency] || TRAINING_DAYS[3],
    sessionMinutes: persona.sessionDuration,
    gymType: APP_GYM[persona.gymType],
    equipment: persona.appEquipment,
    trainingHistory: APP_HISTORY[persona.trainingHistory],
    familiarExerciseIds: persona.familiarExercises || [],
    limitations,
  }
}

// A proposal option in the plan shape the checks read (ids kept for matching).
function optionToPlan(option) {
  return {
    title: option.name,
    summary: option.summary,
    notes: [],
    days: option.days.map(d => ({
      day: d.name,
      focus: d.focus,
      durationMinutes: d.estimatedMinutes,
      exercises: d.exercises.map(e => ({
        exerciseId: e.exerciseId, name: e.name, sets: e.sets, reps: e.reps, restSeconds: e.restSeconds, notes: e.formCue || '',
      })),
    })),
  }
}

async function evaluate(persona) {
  const input = {
    fitnessLevel: persona.fitnessLevel,
    targetMuscles: persona.targetMuscles,
    frequency: persona.frequency,
    sessionDuration: persona.sessionDuration,
    preferences: persona.preferences,
    gymType: persona.gymType,
    equipment: persona.equipment,
    goal: persona.goal,
    injuries: persona.injuries,
    injuryNotes: persona.injuryNotes,
    trainingHistory: persona.trainingHistory,
    familiarExercises: persona.familiarExercises,
  }
  try {
    let plan, meta
    if (mock) ({ plan, meta } = mockPlan(persona))
    else if (generator === 'app') {
      // The app's builder returns two options; the coach's recommendation is checked.
      const proposal = await generateProposal(toAppProfile(persona), { deadline: Date.now() + 180_000 })
      plan = optionToPlan(proposal.recommended)
      meta = proposal.meta
    } else ({ plan, meta } = await generatePlanWithGemini(input, { deadline: Date.now() + 120_000 }))
    return { id: persona.id, ok: true, meta, checks: runChecks(persona, plan), plan }
  } catch (err) {
    return { id: persona.id, ok: false, error: err.message, meta: err.meta || null, checks: {} }
  }
}

async function runAll(items, worker) {
  const results = new Array(items.length)
  let next = 0
  async function lane() {
    while (next < items.length) {
      const i = next++
      results[i] = await worker(items[i])
      const r = results[i]
      const failed = Object.entries(r.checks).filter(([, c]) => c && !c.pass).map(([k]) => k)
      process.stdout.write(`  ${r.ok ? '✓' : '✗'} ${r.id}${r.ok ? (failed.length ? `  (failed: ${failed.join(', ')})` : '') : `  generation failed: ${r.error}`}\n`)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane))
  return results
}

// ---- Summary ----
function summarize(results) {
  const checkNames = [...new Set(results.flatMap(r => Object.keys(r.checks)))]
  const checks = {}
  for (const name of checkNames) {
    const applicable = results.filter(r => r.checks[name])
    // A failed generation counts as failing every check that applies to all personas.
    const failedGen = results.filter(r => !r.ok).length
    const universal = applicable.length + failedGen === results.length
    const total = applicable.length + (universal ? failedGen : 0)
    const passed = applicable.filter(r => r.checks[name].pass).length
    checks[name] = { passed, total, rate: total ? passed / total : null }
  }
  const metas = results.map(r => r.meta).filter(m => m?.usage)
  const sum = key => metas.reduce((a, m) => a + (m.usage[key] || 0), 0)
  const price = PRICES[getModelName()]
  const cost = price && metas.length
    ? (sum('inputTokens') * price.input + (sum('outputTokens') + sum('thinkingTokens')) * price.output) / 1e6
    : null
  const latencies = results.map(r => r.meta?.latencyMs).filter(n => n > 0)
  return {
    generation: { succeeded: results.filter(r => r.ok).length, total: results.length },
    checks,
    tokens: metas.length ? {
      avgInput: Math.round(sum('inputTokens') / metas.length),
      avgOutput: Math.round(sum('outputTokens') / metas.length),
      avgThinking: Math.round(sum('thinkingTokens') / metas.length),
    } : null,
    avgLatencyMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
    approxCostUsd: cost === null ? null : Number(cost.toFixed(4)),
    retries: results.reduce((a, r) => a + Math.max(0, (r.meta?.attempts || 1) - 1), 0),
  }
}

const pct = rate => (rate === null ? '  n/a' : `${Math.round(rate * 100)}%`.padStart(5))
function delta(now, before) {
  if (now === null || before === null || before === undefined) return ''
  const d = Math.round((now - before) * 100)
  return d === 0 ? '   =' : `${d > 0 ? '+' : ''}${d}`.padStart(4)
}

function printSummary(summary, baseline) {
  const b = baseline?.summary
  console.log(`\nGeneration: ${summary.generation.succeeded}/${summary.generation.total} succeeded`)
  console.log(`\n  ${'check'.padEnd(24)} pass  rate${b ? '  vs baseline' : ''}`)
  for (const [name, c] of Object.entries(summary.checks)) {
    const was = b?.checks?.[name]?.rate
    console.log(`  ${name.padEnd(24)} ${`${c.passed}/${c.total}`.padStart(5)} ${pct(c.rate)}${b ? `  ${delta(c.rate, was)}` : ''}`)
  }
  if (summary.tokens) {
    const t = summary.tokens
    console.log(`\nTokens per plan (avg): input ${t.avgInput}, output ${t.avgOutput}, thinking ${t.avgThinking}`)
  }
  if (summary.avgLatencyMs !== null) console.log(`Latency per plan (avg): ${(summary.avgLatencyMs / 1000).toFixed(1)}s, retries: ${summary.retries}`)
  if (summary.approxCostUsd !== null) console.log(`Approx. cost of this run: $${summary.approxCostUsd}`)
  if (b) {
    console.log(`\nBaseline: ${baseline.generator || 'website'} generator / ${baseline.model} / prompt ${baseline.promptVersion} / ${baseline.ranAt}`)
    if ((baseline.generator || 'website') !== generator) {
      console.log('Note: the baseline used a different generator, so this compares generators.')
    }
  }
}

// ---- Main ----
const model = rescored ? rescored.model : mock ? 'mock' : getModelName()
const promptVersion = rescored ? rescored.promptVersion : PROMPT_VERSION
console.log(rescored
  ? `Rescoring ${rescoreFile} (${generator} generator, ${model}, prompt ${promptVersion}, run ${rescored.ranAt}): no Gemini calls...`
  : `Evaluating ${personas.length} persona(s): ${generator} generator, ${model}, prompt ${promptVersion}${mock ? ' (mock: no Gemini calls)' : ''}...`)
const started = Date.now()
// --rescore: same plans, same generation stats, checks run again.
const results = rescored
  ? rescored.results.map(r => {
      const persona = personas.find(p => p.id === r.id)
      return r.ok && persona && r.plan ? { ...r, checks: runChecks(persona, r.plan) } : r
    })
  : await runAll(personas, evaluate)
const summary = summarize(results)
const baseline = existsSync(BASELINE_FILE) ? JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) : null
printSummary(summary, baseline)

// A rescore keeps the original run's identity and adds when it was rescored.
const record = {
  ranAt: rescored ? rescored.ranAt : new Date().toISOString(),
  ...(rescored ? { rescoredAt: new Date().toISOString() } : {}),
  generator,
  model,
  promptVersion,
  personas: rescored ? rescored.personas : personas.map(p => p.id),
  durationMs: rescored ? rescored.durationMs : Date.now() - started,
  summary,
  results,
}
mkdirSync(RESULTS_DIR, { recursive: true })
const stamp = (record.rescoredAt || record.ranAt).replace(/[:.]/g, '-')
const file = path.join(RESULTS_DIR, `${stamp}_${rescored ? 'rescore_' : ''}${generator}_${model}_${promptVersion}.json`)
writeFileSync(file, JSON.stringify(record, null, 2))
console.log(`\nFull results: ${path.relative(process.cwd(), file)}`)

if (saveBaseline) {
  if (mock || only) {
    console.log('Not saving a baseline from a --mock or --only run.')
  } else {
    writeFileSync(BASELINE_FILE, JSON.stringify(record, null, 2))
    console.log(`Saved as the baseline: ${path.relative(process.cwd(), BASELINE_FILE)}`)
  }
}
