// pages/api/user/profile.js
import { withAuth } from '@/lib/apiHandler'
import { User } from '@/lib/models'
import { profileUpdateBody, suggestLevel } from '@/lib/intake'

export default withAuth({
  GET: async (req, res, { privyUserId }) => {
    const user = await User.findOne({ privyUserId })
    if (!user) {
      return res.json({
        privyUserId, email: '', fitnessLevel: '', targetMuscles: [],
        frequency: null, sessionDuration: null, preferences: '', onboardingComplete: true,
      })
    }
    res.json(user)
  },

  POST: async (req, res, { privyUserId }) => {
    // req.body has been validated against profileUpdateBody (unknown fields stripped).
    // Fields left out are not changed (Mongoose drops undefined keys).
    const { email, fitnessLevel, targetMuscles, frequency, sessionDuration, preferences, intake } = req.body
    const update = { privyUserId, email, fitnessLevel, targetMuscles, frequency, sessionDuration, preferences, onboardingComplete: true }

    // RYR-12: the intake. The suggested level is worked out here, not taken
    // from the client, and saved next to the level the user confirmed.
    if (intake) {
      const { level: suggestedLevel } = suggestLevel(intake)
      update.intake = { ...intake, suggestedLevel, completedAt: new Date() }
      update.fitnessLevel = intake.confirmedLevel
    }

    const user = await User.findOneAndUpdate({ privyUserId }, update, { upsert: true, new: true })
    res.json({ success: true, user })
  },
}, {
  errors: { GET: 'Failed to fetch profile', POST: 'Failed to save profile' },
  schemas: { POST: { body: profileUpdateBody } },
})
