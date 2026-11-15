// lib/planSchema.js
// The shape of a generated workout plan (RYR-6), in two forms kept side by side:
//   - GEMINI_PLAN_SCHEMA: sent to Gemini as responseSchema, so the model has to
//     return this shape.
//   - generatedPlanSchema(): zod check of what comes back, before it's saved.
// When you change one, change the other.
import { z } from 'zod'

export const PLAN_LIMITS = {
  title: 120,
  summary: 1000,
  maxNotes: 10,
  note: 300,
  dayLabel: 40,
  maxFocus: 6,
  focus: 40,
  minExercises: 1,
  maxExercises: 15,
  exerciseName: 100,
  reps: 40,
  exerciseNotes: 300,
  minSets: 1,
  maxSets: 10,
  maxRestSeconds: 600,
  minDuration: 5,
  maxDuration: 240,
}

const L = PLAN_LIMITS

// ---- Gemini responseSchema (OpenAPI subset) ----
const GEMINI_EXERCISE = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING', description: 'Exercise name, e.g. "Seated Cable Row"' },
    sets: { type: 'INTEGER', description: `Number of sets, ${L.minSets}-${L.maxSets}` },
    reps: { type: 'STRING', description: 'Reps per set, e.g. "8-10" or "AMRAP in 60s"' },
    restSeconds: { type: 'INTEGER', description: `Rest between sets in seconds, 0-${L.maxRestSeconds}` },
    notes: { type: 'STRING', description: 'Form or tempo cue in 1-2 sentences' },
  },
  required: ['name', 'sets', 'reps', 'restSeconds', 'notes'],
  propertyOrdering: ['name', 'sets', 'reps', 'restSeconds', 'notes'],
}

const GEMINI_DAY = {
  type: 'OBJECT',
  properties: {
    day: { type: 'STRING', description: 'Day label, e.g. "Day 1"' },
    focus: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Muscle groups trained this day' },
    durationMinutes: { type: 'INTEGER', description: 'Estimated session length in minutes' },
    exercises: { type: 'ARRAY', items: GEMINI_EXERCISE },
  },
  required: ['day', 'focus', 'durationMinutes', 'exercises'],
  propertyOrdering: ['day', 'focus', 'durationMinutes', 'exercises'],
}

export const GEMINI_PLAN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    summary: { type: 'STRING' },
    days: { type: 'ARRAY', items: GEMINI_DAY },
    notes: { type: 'ARRAY', items: { type: 'STRING' }, description: 'General tips for the whole plan' },
  },
  required: ['title', 'summary', 'days', 'notes'],
  propertyOrdering: ['title', 'summary', 'days', 'notes'],
}

// ---- zod check of the parsed response ----
const text = max => z.string().trim().max(max)

const exerciseSchema = z.object({
  name: text(L.exerciseName).min(1),
  sets: z.number().int().min(L.minSets).max(L.maxSets),
  reps: text(L.reps).min(1),
  restSeconds: z.number().int().min(0).max(L.maxRestSeconds),
  notes: text(L.exerciseNotes),
})

const daySchema = z.object({
  day: text(L.dayLabel).min(1),
  focus: z.array(text(L.focus).min(1)).max(L.maxFocus),
  durationMinutes: z.number().int().min(L.minDuration).max(L.maxDuration),
  exercises: z.array(exerciseSchema).min(L.minExercises).max(L.maxExercises),
})

// Unknown fields are dropped (zod's default), so only this shape is saved.
// `frequency` is the number of days asked for; when it's set, the plan must
// have exactly that many days.
export function generatedPlanSchema({ frequency } = {}) {
  return z.object({
    title: text(L.title).min(1),
    summary: text(L.summary),
    days: z.array(daySchema).min(1),
    notes: z.array(text(L.note)).max(L.maxNotes),
  }).superRefine((plan, ctx) => {
    if (Number.isInteger(frequency) && frequency > 0 && plan.days.length !== frequency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['days'],
        message: `Expected ${frequency} days, got ${plan.days.length}`,
      })
    }
  })
}

// Short summary of a failed check, safe for server logs (no user content).
export function describePlanIssues(error) {
  return error.issues
    .slice(0, 5)
    .map(i => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ')
}
