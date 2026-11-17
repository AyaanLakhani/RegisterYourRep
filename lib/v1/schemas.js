// lib/v1/schemas.js
// Request schemas for /api/v1, mirroring mobile/src/api/schemas.ts (RYR-36).
import { z } from 'zod'
import mongoose from 'mongoose'
import { EQUIPMENT, GOALS, GYM_TYPES, LEVELS, TRAINING_HISTORY, WEEKDAYS, isCatalogId } from './vocab'

const oneOf = (values, label) =>
  z.enum(values, { errorMap: () => ({ message: `${label} must be one of: ${values.join(', ')}` }) })
const uniqueList = schema => z.array(schema).transform(list => [...new Set(list)])

// PUT /api/v1/profile (ProfileInputSchema). `suggestedLevel` is accepted for
// compatibility but ignored: the server works it out itself.
export const profileInputBody = z.object({
  goals: uniqueList(oneOf(GOALS, 'Goal')).pipe(z.array(z.string()).min(1, 'Pick at least one goal')),
  trainingDays: uniqueList(oneOf(WEEKDAYS, 'Training day')).pipe(
    z.array(z.string()).min(1, 'Pick at least one training day').max(7)
  ),
  sessionMinutes: z.number({ invalid_type_error: 'Session length must be a number' })
    .int('Session length must be a whole number')
    .min(15, 'Session length must be 15-180 minutes')
    .max(180, 'Session length must be 15-180 minutes'),
  gymType: oneOf(GYM_TYPES, 'Gym type'),
  equipment: uniqueList(oneOf(EQUIPMENT, 'Equipment')),
  trainingHistory: oneOf(TRAINING_HISTORY, 'Training history'),
  familiarExerciseIds: uniqueList(z.string().refine(isCatalogId, 'Unknown exercise id')).pipe(z.array(z.string()).max(50)),
  limitations: z.string({ invalid_type_error: 'Limitations must be text' }).trim().max(1000, 'Limitations must be 1000 characters or fewer'),
  suggestedLevel: oneOf(LEVELS, 'Suggested level').optional(),
  level: oneOf(LEVELS, 'Level'),
})

// GET /api/v1/catalog/familiarity?equipment=dumbbell,bench
export const familiarityQuery = z.object({
  equipment: z.string().optional().transform((value, ctx) => {
    if (value === undefined) return undefined
    const list = value.split(',').map(s => s.trim()).filter(Boolean)
    const unknown = list.filter(e => !EQUIPMENT.includes(e))
    if (unknown.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown equipment: ${unknown.join(', ')}` })
      return z.NEVER
    }
    return list
  }),
})

// POST /api/v1/proposals/:id/accept
export const acceptProposalBody = z.object({
  choice: oneOf(['recommended', 'as_asked'], 'Choice'),
})

// POST /api/v1/program/day-moves
export const dayMovesBody = z.object({
  moves: z.array(z.object({ from: oneOf(WEEKDAYS, 'Day'), to: oneOf(WEEKDAYS, 'Day') })).min(1, 'No moves given').max(7),
  note: z.string().trim().max(200).optional(),
})

// ---- Sessions (RYR-38) ----

const dayDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine(v => new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v, 'Date is not valid')

// POST /api/v1/sessions/:id/move
export const moveSessionBody = z.object({ toDate: dayDate })

const SKIP_REASONS = ['no_equipment', 'didnt_know', 'pain', 'time']
const setLog = z.object({
  reps: z.number().int().min(0).max(1000),
  weightKg: z.number().min(0).max(1000).optional(),
})

// POST /api/v1/sessions/:id/logs
export const logExerciseBody = z.discriminatedUnion('action', [
  z.object({ action: z.literal('done'), exerciseId: z.string().min(1), sets: z.array(setLog).max(20).optional() }),
  z.object({ action: z.literal('skip'), exerciseId: z.string().min(1), reason: oneOf(SKIP_REASONS, 'Reason') }),
  z.object({ action: z.literal('swap'), exerciseId: z.string().min(1), replacementId: z.string().min(1) }),
], { errorMap: () => ({ message: 'action must be done, skip or swap' }) })

// POST /api/v1/sessions/:id/finish
// The body is optional; with no body Next.js gives '' or undefined.
const emptyBodyAsObject = schema => z.preprocess(v => (v === '' || v == null ? {} : v), schema)

export const finishSessionBody = emptyBodyAsObject(z.object({
  durationMinutes: z.number().int().min(0).max(600).optional(),
}))

// POST /api/v1/coach/changes/:id/(apply|decline|undo): no fields.
export const emptyBody = emptyBodyAsObject(z.object({}))

// ---- Coach (RYR-40) ----

// POST /api/v1/coach/messages
// proposalId + option: tweak that draft (opened from the plan page's Tweak)
// instead of the active program.
export const coachMessageBody = z.object({
  text: z.string({ invalid_type_error: 'Message must be text' }).trim().min(1, 'Message is empty').max(2000, 'Message is too long'),
  proposalId: z.string().refine(v => mongoose.isValidObjectId(v), 'Invalid proposal id').optional(),
  option: oneOf(['recommended', 'as_asked'], 'Option').optional(),
})
