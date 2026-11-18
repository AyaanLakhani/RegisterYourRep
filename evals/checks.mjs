// evals/checks.mjs
// Automatic checks for one generated plan against its persona (RYR-11).
// Each check returns { pass, detail } or null when it doesn't apply.
//
// Exercises carry a catalog id (the app's generator) or only a name (the
// website's generator); names are matched to the catalog (lib/catalog). Names
// that don't match are checked for equipment with a keyword list, and
// otherwise reported as unmatched: catalog coverage is itself a reported number.
//
// Equipment: with persona.appEquipment (app generator) it's judged the way the
// app does (its 10 coarse equipment types, lib/v1/vocab canDoWith); otherwise
// against the catalog's own equipment ids.
import { generatedPlanSchema, describePlanIssues } from '@/lib/planSchema'
import { matchExercise, difficultyRank, EXERCISES, EXERCISES_BY_ID } from '@/lib/catalog'
import { canDoWith, toAppExercise } from '@/lib/v1/vocab'

// Volume per session, from the level guidelines in lib/workoutPrompt.js.
// RYR-14 will move these into code as level templates.
export const VOLUME = {
  beginner: { exercises: [5, 6], sets: [2, 3] },
  intermediate: { exercises: [6, 8], sets: [3, 4] },
  professional: { exercises: [8, 12], sets: [4, 5] },
}
const EXERCISE_TOLERANCE = 1 // one exercise either side is still in range

// Weekly hard sets per target muscle for pros. A placeholder range until the
// level templates (RYR-14) define it.
export const PRO_WEEKLY_SETS = [10, 22]

// Session length estimate: each set takes ~45s of work plus its rest, plus
// 5 minutes of warm-up. Must land within this share of sessionDuration.
const SET_WORK_SECONDS = 45
const WARMUP_MINUTES = 5
const SESSION_TOLERANCE = 0.3

// Names that give away equipment when the exercise isn't in the catalog.
const EQUIPMENT_KEYWORDS = [
  [/\bsmith\b/, 'smith_machine'],
  [/\bcable|\brope\b|pulldown|pull-down|pushdown/, 'cable_machine'],
  [/\bbarbell\b|\bbench press\b(?!.*dumbbell)/, 'barbell'],
  [/\bez[- ]?bar\b/, 'ez_bar'],
  [/\btrap bar\b|\bhex bar\b/, 'trap_bar'],
  [/\bkettlebell\b|\bkb\b/, 'kettlebell'],
  [/\bband(ed|s)?\b/, 'resistance_bands'],
  [/\bpull[- ]?ups?\b|\bchin[- ]?ups?\b|\bhanging\b/, 'pullup_bar'],
  [/\bleg press\b/, 'leg_press'],
  [/\bhack squat\b/, 'hack_squat'],
  [/\bleg extension\b/, 'leg_extension'],
  [/\bleg curl\b|\bhamstring curl\b/, 'leg_curl'],
  [/\bpec deck\b|\bmachine fly\b/, 'pec_deck'],
  [/\bmedicine ball\b|\bmed ball\b/, 'medicine_ball'],
  [/\bbox jump\b/, 'plyo_box'],
  [/\b(dumbbells?|db)\b/, 'dumbbells'],
  [/\bmachine\b/, '__machine'], // some machine: only fine if they have any machine
]
// Machine-only keywords that don't apply when the name says it's done with
// free weights or bands ("Dumbbell Hamstring Curl" needs no leg-curl machine).
const MACHINE_KEYWORD_IDS = new Set(['leg_curl', 'leg_extension', 'pec_deck', 'hack_squat', 'leg_press', 'cable_machine', '__machine'])
const FREE_WEIGHT_WORDS = /\b(dumbbells?|db|bands?|banded|kettlebells?|bodyweight)\b/
const MACHINE_IDS = new Set(EXERCISES.filter(e => e.equipmentType === 'machine_cable').flatMap(e => e.equipment))

// Exercises to avoid per injury area.
const INJURY_AVOID = {
  knee: { patterns: ['plyometric'], ids: ['pistol-squat', 'jump-squat', 'box-jump', 'burpee', 'walking-lunge', 'sissy-squat'] },
  lower_back: { patterns: [], ids: ['conventional-deadlift', 'deficit-deadlift', 'good-morning', 'barbell-row', 'pendlay-row', 'power-clean', 'sumo-deadlift', 'barbell-back-squat'] },
  shoulder: { patterns: [], ids: ['handstand-push-up', 'barbell-ohp', 'push-press', 'chest-dip', 'weighted-dip', 'triceps-dip'] },
}

const COMPOUND_PATTERNS = new Set(['squat', 'hinge', 'lunge', 'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull'])

function keywordEquipment(name) {
  const n = name.toLowerCase()
  let ids = EQUIPMENT_KEYWORDS.filter(([re]) => re.test(n)).map(([, id]) => id)
  if (FREE_WEIGHT_WORDS.test(n)) ids = ids.filter(id => !MACHINE_KEYWORD_IDS.has(id))
  // "machine" only matters when no specific machine was recognised.
  return ids.length > 1 ? ids.filter(id => id !== '__machine') : ids
}

// Each plan exercise with its catalog match (or null).
export function annotatePlan(plan) {
  return (plan?.days || []).map(day => ({
    ...day,
    exercises: (day.exercises || []).map(ex => ({
      ...ex,
      match: ex.exerciseId ? EXERCISES_BY_ID.get(ex.exerciseId) || null : matchExercise(ex.name),
    })),
  }))
}

function weeklySetsByMuscle(days) {
  const sets = {}
  for (const day of days) {
    for (const ex of day.exercises) {
      for (const m of ex.match?.primaryMuscles || []) sets[m] = (sets[m] || 0) + (ex.sets || 0)
    }
  }
  return sets
}

const inRange = (value, [min, max]) => value >= min && value <= max
const list = items => items.slice(0, 4).join('; ') + (items.length > 4 ? ` (+${items.length - 4} more)` : '')

/**
 * Runs every check for one persona's plan. `persona.equipment` must already be
 * resolved (preset or override).
 */
export function runChecks(persona, plan) {
  const level = persona.fitnessLevel
  const have = new Set(persona.equipment)
  const familiar = new Set(persona.familiarExercises || [])
  const days = annotatePlan(plan)
  const all = days.flatMap(d => d.exercises)
  const matched = all.filter(ex => ex.match)
  const results = {}

  // 1. Plan schema. The website's plans use the RYR-6 schema. The app's plans
  //    are checked by its own plan builder (lib/v1/generation checkProposal)
  //    before they exist, against the app contract (which, e.g., doesn't cap
  //    the focus list at 6 muscles), so a generated app plan has passed it.
  if (persona.appEquipment) {
    results.schema = { pass: true, detail: 'validated by the app plan builder' }
  } else {
    const schema = generatedPlanSchema({ frequency: persona.frequency }).safeParse(plan)
    results.schema = { pass: schema.success, detail: schema.success ? '' : describePlanIssues(schema.error) }
  }

  // 2. Day count
  results.dayCount = { pass: days.length === persona.frequency, detail: `${days.length} days for frequency ${persona.frequency}` }

  // 3. Session length (estimated from sets and rest, not the model's own number)
  const offDays = days.map((day, i) => {
    const seconds = day.exercises.reduce((sum, ex) => sum + (ex.sets || 0) * (SET_WORK_SECONDS + (ex.restSeconds || 0)), 0)
    const minutes = Math.round(seconds / 60) + WARMUP_MINUTES
    return { i, minutes }
  }).filter(({ minutes }) => Math.abs(minutes - persona.sessionDuration) > persona.sessionDuration * SESSION_TOLERANCE)
  results.sessionLength = {
    pass: offDays.length === 0,
    detail: offDays.length ? `asked ${persona.sessionDuration} min; ${list(offDays.map(d => `day ${d.i + 1} ~${d.minutes} min`))}` : '',
  }

  // 4. Volume for the level
  const range = VOLUME[level] || VOLUME.beginner
  const exRange = [range.exercises[0] - EXERCISE_TOLERANCE, range.exercises[1] + EXERCISE_TOLERANCE]
  const volumeIssues = []
  days.forEach((day, i) => {
    if (!inRange(day.exercises.length, exRange)) volumeIssues.push(`day ${i + 1}: ${day.exercises.length} exercises`)
    for (const ex of day.exercises) {
      if (!inRange(ex.sets, range.sets)) volumeIssues.push(`${ex.name}: ${ex.sets} sets`)
    }
  })
  results.volume = { pass: volumeIssues.length === 0, detail: list(volumeIssues) }

  // 5. Catalog coverage
  const unmatched = all.filter(ex => !ex.match).map(ex => ex.name)
  const coverage = all.length ? matched.length / all.length : 0
  results.catalogCoverage = { pass: coverage >= 0.8, detail: `${Math.round(coverage * 100)}% matched${unmatched.length ? `; unmatched: ${list(unmatched)}` : ''}`, value: coverage }

  // 6. Equipment: nothing the persona's gym doesn't have
  const hasMachine = [...have].some(e => MACHINE_IDS.has(e))
  const equipmentIssues = []
  for (const ex of all) {
    if (persona.appEquipment) {
      // The app's rule: every piece of kit is on the user's list (bodyweight always is).
      if (!ex.match) equipmentIssues.push(`${ex.name} is not in the catalog`)
      else if (!canDoWith(toAppExercise(ex.match), persona.appEquipment)) {
        equipmentIssues.push(`${ex.name} needs ${toAppExercise(ex.match).equipment.filter(e => e !== 'bodyweight' && !persona.appEquipment.includes(e)).join(', ')}`)
      }
      continue
    }
    const needed = ex.match ? ex.match.equipment : keywordEquipment(ex.name)
    const missing = needed.filter(e => (e === '__machine' ? !hasMachine : !have.has(e)))
    if (missing.length) equipmentIssues.push(`${ex.name} needs ${missing.join(', ').replace('__machine', 'a machine')}`)
  }
  results.equipment = { pass: equipmentIssues.length === 0, detail: list(equipmentIssues) }

  // 7-8. Beginners: common exercises only, nothing advanced they didn't tick
  if (level === 'beginner') {
    const uncommon = matched.filter(ex => !ex.match.common && !familiar.has(ex.match.id)).map(ex => ex.name)
    results.beginnerCommon = { pass: uncommon.length === 0, detail: uncommon.length ? `not common: ${list(uncommon)}` : '' }
    const advanced = matched.filter(ex => difficultyRank(ex.match.difficulty) > 0 && !familiar.has(ex.match.id)).map(ex => `${ex.name} (${ex.match.difficulty})`)
    results.noAdvancedForBeginner = { pass: advanced.length === 0, detail: list(advanced) }
  }

  // 9-10. Intermediates: a free-weight compound when possible, more sets for focus muscles
  if (level === 'intermediate') {
    const possible = EXERCISES.some(e => (e.equipmentType === 'dumbbell' || e.equipmentType === 'barbell') &&
      COMPOUND_PATTERNS.has(e.movementPattern) && e.equipment.every(x => have.has(x)))
    if (possible) {
      const found = matched.filter(ex => (ex.match.equipmentType === 'dumbbell' || ex.match.equipmentType === 'barbell') && COMPOUND_PATTERNS.has(ex.match.movementPattern))
      results.freeWeightCompound = { pass: found.length > 0, detail: found.length ? '' : 'no dumbbell or barbell compound lift' }
    }
    const targets = persona.targetMuscles.filter(m => m !== 'full_body')
    if (targets.length) {
      const sets = weeklySetsByMuscle(days)
      const others = Object.entries(sets).filter(([m]) => !targets.includes(m) && m !== 'full_body').map(([, n]) => n)
      const othersAvg = others.length ? others.reduce((a, b) => a + b, 0) / others.length : 0
      const low = targets.filter(m => (sets[m] || 0) < othersAvg)
      results.focusVolume = {
        pass: low.length === 0,
        detail: `target sets ${targets.map(m => `${m} ${sets[m] || 0}`).join(', ')}; other muscles avg ${othersAvg.toFixed(1)}`,
      }
    }
  }

  // 11. Pros: weekly sets per target muscle inside the template range
  if (level === 'professional') {
    const targets = persona.targetMuscles.filter(m => m !== 'full_body')
    if (targets.length) {
      const sets = weeklySetsByMuscle(days)
      const out = targets.filter(m => !inRange(sets[m] || 0, PRO_WEEKLY_SETS))
      results.proWeeklySets = {
        pass: out.length === 0,
        detail: `${targets.map(m => `${m} ${sets[m] || 0}`).join(', ')} (range ${PRO_WEEKLY_SETS.join('-')})`,
      }
    }
  }

  // 12. Injuries: nothing on the avoid list for the persona's injury areas
  const injuryRules = (persona.injuries || []).map(a => INJURY_AVOID[a]).filter(Boolean)
  if (injuryRules.length) {
    const risky = matched.filter(ex => injuryRules.some(r => r.ids.includes(ex.match.id) || r.patterns.includes(ex.match.movementPattern))).map(ex => ex.name)
    results.injurySafe = { pass: risky.length === 0, detail: list(risky) }
  }

  return results
}
