// lib/v1/vocab.js
// The /api/v1 vocabulary (the mobile app's contract, mobile/src/api/schemas.ts)
// and how the server's exercise catalog (lib/catalog, RYR-13) maps onto it.
//
// The contract is the API shape, so every /api/v1 response uses these values.
// The catalog keeps its finer-grained ids internally; this file is the one
// place that translates (RYR-36).
import { EXERCISES, EXERCISES_BY_ID, FAMILIARITY_EXERCISE_IDS } from '../catalog'

// ---- Contract enums (keep in step with mobile/src/api/schemas.ts) ----
export const LEVELS = ['beginner', 'intermediate', 'pro']
export const GOALS = ['build_muscle', 'get_stronger', 'lose_fat', 'general_fitness', 'endurance']
export const GYM_TYPES = ['home', 'apartment_gym', 'community_center', 'commercial_gym']
export const TRAINING_HISTORY = ['under_6_months', 'six_months_to_2_years', 'over_2_years']
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export const EQUIPMENT = [
  'barbell', 'dumbbell', 'cable', 'machine', 'smith_machine',
  'bodyweight', 'kettlebell', 'band', 'bench', 'pullup_bar',
]

// ---- Catalog -> contract ----

// Catalog equipment -> contract equipment. Small, cheap kit (box, ball,
// ab wheel) counts as bodyweight, i.e. always possible.
const EQUIPMENT_MAP = {
  dumbbells: 'dumbbell',
  adjustable_bench: 'bench',
  barbell: 'barbell',
  squat_rack: 'barbell',
  ez_bar: 'barbell',
  trap_bar: 'barbell',
  kettlebell: 'kettlebell',
  resistance_bands: 'band',
  pullup_bar: 'pullup_bar',
  dip_station: 'pullup_bar',
  plyo_box: 'bodyweight',
  medicine_ball: 'bodyweight',
  ab_wheel: 'bodyweight',
  cable_machine: 'cable',
  smith_machine: 'smith_machine',
}
const toAppEquipment = id => EQUIPMENT_MAP[id] || 'machine' // every other id is a machine

/** Catalog equipment ids -> the app's equipment list (bodyweight always included). */
export function toAppEquipmentList(catalogIds) {
  return unique(['bodyweight', ...catalogIds.map(toAppEquipment)])
}

const MUSCLE_MAP = {
  chest: ['chest'],
  back: ['back'],
  shoulders: ['shoulders'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  quadriceps: ['quads'],
  hamstrings: ['hamstrings'],
  glutes: ['glutes'],
  calves: ['calves'],
  core: ['abs'],
  full_body: ['quads', 'glutes', 'back', 'shoulders'],
}
const LOWER = new Set(['quadriceps', 'hamstrings', 'glutes', 'calves', 'full_body'])

const PATTERN_MAP = {
  horizontal_push: 'push_horizontal',
  vertical_push: 'push_vertical',
  dip: 'push_vertical',
  horizontal_pull: 'pull_horizontal',
  vertical_pull: 'pull_vertical',
  squat: 'squat',
  plyometric: 'squat',
  hinge: 'hinge',
  olympic: 'hinge',
  lunge: 'lunge',
  carry: 'carry',
  anti_extension: 'core',
  anti_rotation: 'core',
  core_flexion: 'core',
  rotation: 'core',
  conditioning: 'core',
}

const unique = list => [...new Set(list)]

/** A catalog exercise as a contract ExerciseCatalogEntry. */
export function toAppExercise(ex) {
  const muscles = unique([...ex.primaryMuscles, ...ex.secondaryMuscles].flatMap(m => MUSCLE_MAP[m] || []))
  const equipment = unique(ex.equipment.map(toAppEquipment))
  return {
    id: ex.id,
    name: ex.name,
    muscles: muscles.length ? muscles : ['abs'],
    muscleGroup: ex.primaryMuscles.includes('core') ? 'core'
      : ex.primaryMuscles.some(m => LOWER.has(m)) ? 'lower'
      : 'upper',
    equipment: equipment.length ? equipment : ['bodyweight'],
    difficulty: ex.difficulty === 'professional' ? 'pro' : ex.difficulty,
    movementPattern: PATTERN_MAP[ex.movementPattern] || 'isolation',
    alternatives: unique([...ex.easier, ...ex.harder]),
  }
}

/** The contract's rule: possible when every piece of kit is on the list; bodyweight always is. */
export function canDoWith(appExercise, equipment) {
  return appExercise.equipment.every(e => e === 'bodyweight' || equipment.includes(e))
}

/** The onboarding "which of these do you know?" list, limited to what `equipment` allows (all when omitted). */
export function familiarityOptions(equipment) {
  return FAMILIARITY_EXERCISE_IDS
    .map(id => toAppExercise(EXERCISES_BY_ID.get(id)))
    .filter(ex => !equipment || canDoWith(ex, equipment))
}

export const isCatalogId = id => EXERCISES_BY_ID.has(id)
export const CATALOG_SIZE = EXERCISES.length

/**
 * Suggested starting level: the contract's rule (mobile/src/api/level.ts),
 * so the app's "we'll start you as …" and the saved value always agree.
 * `familiarCount` counts ticks still offered for the user's equipment.
 */
export function suggestLevel(history, familiarCount) {
  switch (history) {
    case 'under_6_months':
      return familiarCount >= 6 ? 'intermediate' : 'beginner'
    case 'six_months_to_2_years':
      return familiarCount < 2 ? 'beginner' : 'intermediate'
    case 'over_2_years':
      return familiarCount >= 6 ? 'pro' : 'intermediate'
    default:
      return 'beginner'
  }
}

/** Contract muscles an exercise mainly trains (its primary muscles only). */
export function primaryMusclesOf(exerciseId) {
  const ex = EXERCISES_BY_ID.get(exerciseId)
  if (!ex) return []
  return unique(ex.primaryMuscles.flatMap(m => MUSCLE_MAP[m] || []))
}

/** upper / lower / core for a contract muscle. */
export function groupOfMuscle(muscle) {
  if (['abs', 'obliques', 'lower_back'].includes(muscle)) return 'core'
  if (['quads', 'hamstrings', 'glutes', 'calves'].includes(muscle)) return 'lower'
  return 'upper'
}
