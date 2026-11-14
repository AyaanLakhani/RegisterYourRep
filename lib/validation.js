// lib/validation.js
// Request schemas for the API routes (RYR-4). Routes pass these to withAuth
// via the `schemas` option; invalid input gets a 400 before any DB work.
import { z } from 'zod'
import mongoose from 'mongoose'

// ---- Limits (shared with the UI where it has matching inputs) ----
export const LIMITS = {
  planName: 80,
  preferences: 500,
  email: 254,
  minFrequency: 1,
  maxFrequency: 7,
  minSessionDuration: 10,
  maxSessionDuration: 180,
  maxExercises: 50,
  exerciseName: 100,
  maxChecked: 100,
}

// 'unsure' is the UI's "Not Sure Yet" option and its fallback value.
export const FITNESS_LEVELS = ['beginner', 'intermediate', 'professional', 'unsure']
export const MUSCLES = [
  'chest', 'back', 'biceps', 'triceps', 'shoulders', 'core',
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'full_body',
]
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// ---- Field helpers ----
const trimmed = (max, label) =>
  z.string({ invalid_type_error: `${label} must be text` })
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)

const fitnessLevel = z.enum(FITNESS_LEVELS, {
  errorMap: () => ({ message: `Fitness level must be one of: ${FITNESS_LEVELS.join(', ')}` }),
})

const targetMuscles = z
  .array(z.enum(MUSCLES, { errorMap: () => ({ message: 'Unknown target muscle' }) }))
  .max(MUSCLES.length, 'Too many target muscles')
  .transform(list => [...new Set(list)])

const boundedInt = (min, max, label) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be between ${min} and ${max}`)
    .max(max, `${label} must be between ${min} and ${max}`)

const frequency = boundedInt(LIMITS.minFrequency, LIMITS.maxFrequency, 'Frequency')
const sessionDuration = boundedInt(LIMITS.minSessionDuration, LIMITS.maxSessionDuration, 'Session duration')

// A real calendar date in YYYY-MM-DD form (rejects e.g. 2026-02-30).
const isoDate = z.string().trim().refine(value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}, 'Date must be a valid date in YYYY-MM-DD format')

const objectId = z.string().refine(v => mongoose.isValidObjectId(v), 'Invalid id')

// ---- Route schemas ----

// POST /api/user/profile
export const profileBody = z.object({
  email: z.union([z.literal(''), trimmed(LIMITS.email, 'Email').pipe(z.string().email('Email is not valid'))]).optional(),
  fitnessLevel: z.union([z.literal(''), fitnessLevel]).optional(),
  targetMuscles: targetMuscles.optional(),
  frequency: frequency.nullable().optional(),
  sessionDuration: sessionDuration.nullable().optional(),
  preferences: trimmed(LIMITS.preferences, 'Preferences').optional(),
})

// POST /api/workout-plans
export const createPlanBody = z.object({
  // The UI auto-names plans from the selected muscles, which can run past the
  // limit, so the name is shortened instead of rejected.
  name: z.string({ invalid_type_error: 'Plan name must be text' })
    .trim()
    .transform(s => s.slice(0, LIMITS.planName).replace(/[\s,;-]+$/, ''))
    .optional(),
  source: z.enum(['onboarding', 'custom']).optional(),
  fitnessLevel: fitnessLevel.optional(),
  targetMuscles: targetMuscles.pipe(z.array(z.string()).min(1, 'Pick at least one target muscle')),
  frequency: frequency.optional(),
  sessionDuration: sessionDuration.optional(),
  preferences: trimmed(LIMITS.preferences, 'Preferences').optional(),
})

// POST /api/workouts
export const createWorkoutBody = z.object({
  exercises: z
    .array(trimmed(LIMITS.exerciseName, 'Exercise name').pipe(z.string().min(1, 'Exercise name is required')))
    .min(1, 'No exercises provided')
    .max(LIMITS.maxExercises, `At most ${LIMITS.maxExercises} exercises`),
})

// PATCH /api/workcards/:id
export const updateWorkcardBody = z.object({
  date: z.union([z.literal(''), isoDate]).optional(),
  weekday: z.union([z.literal(''), z.enum(WEEKDAYS, { errorMap: () => ({ message: 'Weekday is not valid' }) })]).optional(),
  checked: z
    .array(z.boolean({ invalid_type_error: 'Checked items must be true or false' }))
    .max(LIMITS.maxChecked, 'Too many checked items')
    .optional(),
})

// GET /api/workcards
export const listWorkcardsQuery = z.object({
  status: z.enum(['pending', 'submitted']).optional().catch(undefined), // unknown status = no filter, as before
  planId: objectId.optional(),
})
