// lib/v1/schemas.js
// Request schemas for /api/v1, mirroring mobile/src/api/schemas.ts (RYR-36).
import { z } from 'zod'
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
