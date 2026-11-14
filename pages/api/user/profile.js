// pages/api/user/profile.js
import { withAuth } from '@/lib/apiHandler'
import { User } from '@/lib/models'

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
    const { email, fitnessLevel, targetMuscles, frequency, sessionDuration, preferences } = req.body || {}
    await User.findOneAndUpdate(
      { privyUserId },
      { privyUserId, email, fitnessLevel, targetMuscles, frequency, sessionDuration, preferences, onboardingComplete: true },
      { upsert: true, new: true }
    )
    res.json({ success: true })
  },
}, {
  errors: { GET: 'Failed to fetch profile', POST: 'Failed to save profile' },
})
