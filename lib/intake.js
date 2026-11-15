// lib/intake.js
// The structured intake (RYR-12): answer options, and the suggested level.
// The Expo onboarding screen (RYR-20) reads these through GET /api/intake/options,
// so the app and the server share one definition.
import { z } from 'zod'
import { profileBody } from './validation'
import { EXERCISES_BY_ID, FAMILIARITY_EXERCISE_IDS, GYM_TYPES, GYM_PRESETS, EQUIPMENT, equipmentTypeOf } from './catalog'

export const GOALS = {
  build_muscle: 'Build muscle',
  get_stronger: 'Get stronger',
  lose_fat: 'Lose fat',
  general_fitness: 'General fitness',
}

// "How long have you trained consistently?"
export const TRAINING_HISTORY = {
  under_6_months: 'Under 6 months',
  '6_to_24_months': '6 months to 2 years',
  over_2_years: '2+ years',
}

export const INJURY_AREAS = {
  neck: 'Neck',
  shoulder: 'Shoulder',
  elbow: 'Elbow',
  wrist: 'Wrist',
  lower_back: 'Lower back',
  hip: 'Hip',
  knee: 'Knee',
  ankle: 'Ankle',
}

// Everything the intake screen needs to render its quick-tap options.
export function intakeOptions() {
  const pairs = obj => Object.entries(obj).map(([id, label]) => ({ id, label }))
  return {
    gymTypes: Object.entries(GYM_TYPES).map(([id, label]) => ({ id, label, equipment: GYM_PRESETS[id] })),
    equipment: Object.entries(EQUIPMENT).map(([id, label]) => ({ id, label, type: equipmentTypeOf([id]) })),
    goals: pairs(GOALS),
    trainingHistory: pairs(TRAINING_HISTORY),
    injuryAreas: pairs(INJURY_AREAS),
    familiarExercises: FAMILIARITY_EXERCISE_IDS.map(id => {
      const ex = EXERCISES_BY_ID.get(id)
      return { id, name: ex.name, difficulty: ex.difficulty }
    }),
  }
}

/**
 * Suggests a starting level from training history and familiarity ticks
 * (Questions & Decisions, "How the level is decided"). The user confirms or
 * changes it; both are saved.
 *
 * Only ticks above beginner difficulty count: knowing the leg press doesn't
 * say much, knowing the barbell squat and deadlift does.
 */
export function suggestLevel({ trainingHistory, familiarExercises = [] }) {
  const advancedTicks = familiarExercises.filter(id => {
    const difficulty = EXERCISES_BY_ID.get(id)?.difficulty
    return difficulty === 'intermediate' || difficulty === 'professional'
  }).length

  let level
  if (trainingHistory === 'over_2_years') {
    level = advancedTicks >= 7 ? 'professional' : 'intermediate'
  } else if (trainingHistory === '6_to_24_months') {
    level = advancedTicks >= 3 ? 'intermediate' : 'beginner'
  } else {
    // Under 6 months, or not answered.
    level = advancedTicks >= 5 ? 'intermediate' : 'beginner'
  }
  return { level, advancedTicks }
}

// ---- Request schemas ----
// They live here, not in lib/validation.js, because the catalog imports
// lib/validation.js (a schema there importing the catalog would be circular).

const CONFIRMABLE_LEVELS = ['beginner', 'intermediate', 'professional']
const oneOf = (values, label) =>
  z.enum(values, { errorMap: () => ({ message: `${label} must be one of: ${values.join(', ')}` }) })
const uniqueList = (values, label, max = values.length) =>
  z.array(oneOf(values, label)).max(max, `Too many ${label.toLowerCase()} values`).transform(list => [...new Set(list)])

const familiarExercises = uniqueList(FAMILIARITY_EXERCISE_IDS, 'Familiar exercise')
const trainingHistory = oneOf(Object.keys(TRAINING_HISTORY), 'Training history')

export const INJURY_NOTES_MAX = 200

// The intake answers, as sent by the onboarding screen.
export const intakeBody = z.object({
  gymType: oneOf(Object.keys(GYM_TYPES), 'Gym type'),
  // The preset after the user unticked what their gym lacks.
  equipment: uniqueList(Object.keys(EQUIPMENT), 'Equipment'),
  goal: oneOf(Object.keys(GOALS), 'Goal'),
  injuries: uniqueList(Object.keys(INJURY_AREAS), 'Injury area').default([]),
  injuryNotes: z.string({ invalid_type_error: 'Injury notes must be text' })
    .trim()
    .max(INJURY_NOTES_MAX, `Injury notes must be ${INJURY_NOTES_MAX} characters or fewer`)
    .default(''),
  trainingHistory,
  familiarExercises: familiarExercises.default([]),
  // The level the user accepted (the suggestion, or their own pick).
  confirmedLevel: oneOf(CONFIRMABLE_LEVELS, 'Level'),
})

// POST /api/intake/level-suggestion
export const levelSuggestionBody = z.object({
  trainingHistory,
  familiarExercises: familiarExercises.default([]),
})

// POST /api/user/profile: the existing profile fields plus the intake.
export const profileUpdateBody = profileBody.extend({ intake: intakeBody.optional() })
