// lib/catalog/index.js
// The exercise catalog (RYR-13): data, checks, filtering and name matching.
import { MUSCLES, FITNESS_LEVELS } from '../validation'
import { Exercise } from '../models'
import { EQUIPMENT_IDS, GYM_PRESETS, equipmentTypeOf } from './equipment'
import { EXERCISES as RAW_EXERCISES, FAMILIARITY_EXERCISE_IDS } from './exercises'

export * from './equipment'
export { FAMILIARITY_EXERCISE_IDS }

// Levels in order, easiest first ('unsure' is treated as beginner).
export const DIFFICULTIES = FITNESS_LEVELS.filter(l => l !== 'unsure')
export const difficultyRank = level => Math.max(0, DIFFICULTIES.indexOf(level === 'unsure' ? 'beginner' : level))

// Every exercise with its derived equipment type.
export const EXERCISES = RAW_EXERCISES.map(ex => ({ ...ex, equipmentType: equipmentTypeOf(ex.equipment) }))
export const EXERCISES_BY_ID = new Map(EXERCISES.map(ex => [ex.id, ex]))

/**
 * Checks the catalog against the acceptance rules. Returns a list of problems
 * (empty when it's valid). Run by the seed script and the eval set.
 */
export function validateCatalog(exercises = EXERCISES) {
  const problems = []
  const ids = new Set()
  const names = new Map()

  for (const ex of exercises) {
    if (ids.has(ex.id)) problems.push(`Duplicate id: ${ex.id}`)
    ids.add(ex.id)
    if (!ex.primaryMuscles.length) problems.push(`${ex.id}: no primary muscle`)
    for (const m of [...ex.primaryMuscles, ...ex.secondaryMuscles]) {
      if (!MUSCLES.includes(m)) problems.push(`${ex.id}: unknown muscle "${m}"`)
    }
    for (const e of ex.equipment) {
      if (!EQUIPMENT_IDS.includes(e)) problems.push(`${ex.id}: unknown equipment "${e}"`)
    }
    if (!DIFFICULTIES.includes(ex.difficulty)) problems.push(`${ex.id}: bad difficulty "${ex.difficulty}"`)
    for (const name of [ex.name, ...ex.aliases].map(normalizeName)) {
      const owner = names.get(name)
      if (owner && owner !== ex.id) problems.push(`Name "${name}" is used by both ${owner} and ${ex.id}`)
      names.set(name, ex.id)
    }
  }
  for (const ex of exercises) {
    for (const ref of [...ex.easier, ...ex.harder]) {
      if (!ids.has(ref)) problems.push(`${ex.id}: alternative "${ref}" doesn't exist`)
    }
  }
  // Every muscle at every difficulty.
  for (const muscle of MUSCLES) {
    for (const level of DIFFICULTIES) {
      if (!exercises.some(ex => ex.primaryMuscles.includes(muscle) && ex.difficulty === level)) {
        problems.push(`No ${level} exercise for ${muscle}`)
      }
    }
  }
  for (const [gym, equipment] of Object.entries(GYM_PRESETS)) {
    for (const e of equipment) {
      if (!EQUIPMENT_IDS.includes(e)) problems.push(`Preset ${gym}: unknown equipment "${e}"`)
    }
  }
  for (const id of FAMILIARITY_EXERCISE_IDS) {
    if (!ids.has(id)) problems.push(`Familiarity list: "${id}" doesn't exist`)
  }
  return problems
}

/**
 * Exercises a user can do, in memory:
 * - only equipment they have
 * - at or below their level, unless they ticked it as familiar
 * - optionally only "common" ones (beginners pick from these first)
 * - optionally only those whose primary muscles include one of `muscles`
 */
export function filterExercises({ equipment = [], level = 'beginner', familiar = [], muscles, commonOnly = false } = {}, exercises = EXERCISES) {
  const have = new Set(equipment)
  const known = new Set(familiar)
  const maxRank = difficultyRank(level)
  return exercises.filter(ex =>
    ex.equipment.every(e => have.has(e)) &&
    (difficultyRank(ex.difficulty) <= maxRank || known.has(ex.id)) &&
    (!commonOnly || ex.common || known.has(ex.id)) &&
    (!muscles?.length || ex.primaryMuscles.some(m => muscles.includes(m)))
  )
}

/**
 * The same filter as a MongoDB query on the Exercise collection. Uses the
 * primaryMuscles / difficulty / equipment indexes.
 */
export async function findExercises({ equipment = [], level = 'beginner', familiar = [], muscles, commonOnly = false } = {}) {
  const allowed = DIFFICULTIES.slice(0, difficultyRank(level) + 1)
  const query = {
    // No required equipment outside what the user has.
    equipment: { $not: { $elemMatch: { $nin: equipment } } },
    $or: [{ difficulty: { $in: allowed } }, { slug: { $in: familiar } }],
  }
  if (commonOnly) query.$and = [{ $or: [{ common: true }, { slug: { $in: familiar } }] }]
  if (muscles?.length) query.primaryMuscles = { $in: muscles }
  return Exercise.find(query).lean()
}

// ---- Matching free-text exercise names to the catalog ----
// Used by the eval checks (RYR-11) to judge plans that still use names made
// up by the model.

const WORD_SWAPS = { db: 'dumbbell', dbs: 'dumbbell', bb: 'barbell', kb: 'kettlebell', pullup: 'pull up', pushup: 'push up', chinup: 'chin up' }

export function normalizeName(name) {
  return String(name)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')      // drop notes in brackets: "Squat (light)"
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map(w => WORD_SWAPS[w] || w)
    .join(' ')
    .split(' ')
    .map(w => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ')
}

// Words that don't change which exercise it is.
const FILLER = new Set(['seated', 'standing', 'flat', 'alternating', 'alternate', 'the', 'with', 'and', 'a', 'light', 'weighted'])
const stripFiller = s => s.split(' ').filter(w => !FILLER.has(w)).join(' ')

const NAME_INDEX = new Map()
const LOOSE_INDEX = new Map()
for (const ex of EXERCISES) {
  for (const name of [ex.name, ...ex.aliases]) {
    const n = normalizeName(name)
    if (!NAME_INDEX.has(n)) NAME_INDEX.set(n, ex)
    const loose = stripFiller(n)
    if (!LOOSE_INDEX.has(loose)) LOOSE_INDEX.set(loose, ex)
  }
}

/** The catalog exercise a free-text name refers to, or null. */
export function matchExercise(name) {
  const n = normalizeName(name)
  return NAME_INDEX.get(n) || LOOSE_INDEX.get(stripFiller(n)) || null
}
