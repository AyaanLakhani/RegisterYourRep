// pages/api/v1/profile.js (RYR-36, contract #1-2)
//   GET  /api/v1/profile  the newest profile version, or null before onboarding
//   PUT  /api/v1/profile  save the onboarding answers as a new version
import { withAuth, ApiError } from '@/lib/apiHandler'
import { ProfileVersion, User } from '@/lib/models'
import { profileInputBody } from '@/lib/v1/schemas'
import { familiarityOptions, suggestLevel } from '@/lib/v1/vocab'

// A profile document as the contract's Profile.
function toProfile(doc) {
  return {
    id: String(doc._id),
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
    goals: doc.goals,
    trainingDays: doc.trainingDays,
    sessionMinutes: doc.sessionMinutes,
    gymType: doc.gymType,
    equipment: doc.equipment,
    trainingHistory: doc.trainingHistory,
    familiarExerciseIds: doc.familiarExerciseIds,
    limitations: doc.limitations ?? '',
    suggestedLevel: doc.suggestedLevel,
    level: doc.level,
  }
}

const latest = privyUserId =>
  ProfileVersion.findOne({ privyUserId }).sort({ version: -1 }).lean()

export default withAuth({
  GET: async (req, res, { privyUserId }) => {
    const doc = await latest(privyUserId)
    res.json(doc ? toProfile(doc) : null)
  },

  PUT: async (req, res, { privyUserId }) => {
    const input = req.body // validated against profileInputBody

    // The suggestion uses the contract's rule, counting only ticks that are
    // still offered for the confirmed equipment (as the app does).
    const offered = new Set(familiarityOptions(input.equipment).map(ex => ex.id))
    const familiarCount = input.familiarExerciseIds.filter(id => offered.has(id)).length
    const suggestedLevel = suggestLevel(input.trainingHistory, familiarCount)

    // Append a new version. Two saves at once can pick the same number; the
    // unique index rejects one, and it retries with the next number.
    for (let attempt = 0; attempt < 3; attempt++) {
      const previous = await latest(privyUserId)
      try {
        const doc = await ProfileVersion.create({
          privyUserId,
          version: (previous?.version ?? 0) + 1,
          goals: input.goals,
          trainingDays: input.trainingDays,
          sessionMinutes: input.sessionMinutes,
          gymType: input.gymType,
          equipment: input.equipment,
          trainingHistory: input.trainingHistory,
          familiarExerciseIds: input.familiarExerciseIds,
          limitations: input.limitations,
          suggestedLevel,
          level: input.level,
        })
        await User.updateOne({ privyUserId }, { $set: { onboardingComplete: true } })
        return res.json(toProfile(doc.toObject()))
      } catch (err) {
        if (err?.code !== 11000) throw err // not a duplicate version number
      }
    }
    throw new ApiError(409, 'Your profile was being saved twice at once. Please try again.')
  },
}, {
  errors: { GET: 'Failed to load profile', PUT: 'Failed to save profile' },
  schemas: { PUT: { body: profileInputBody } },
})
