// pages/api/user/profile.js  ←  was: app.get/post('/api/user/profile', ...)
import { getSession } from '@/lib/session'
import { connectDB } from '@/lib/mongoose'
import { User } from '@/lib/models'

export default async function handler(req, res) {
  const session = await getSession(req, res)
  if (!session.privyUserId) return res.status(401).json({ error: 'Not authenticated' })
  const privyUserId = session.privyUserId

  await connectDB()

  if (req.method === 'GET') {
    try {
      const user = await User.findOne({ privyUserId })
      if (!user) {
        return res.json({
          privyUserId, email: '', fitnessLevel: '', targetMuscles: [],
          frequency: null, sessionDuration: null, preferences: '', onboardingComplete: true,
        })
      }
      res.json(user)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to fetch profile' })
    }

  } else if (req.method === 'POST') {
    try {
      const { email, fitnessLevel, targetMuscles, frequency, sessionDuration, preferences } = req.body
      await User.findOneAndUpdate(
        { privyUserId },
        { privyUserId, email, fitnessLevel, targetMuscles, frequency, sessionDuration, preferences, onboardingComplete: true },
        { upsert: true, new: true }
      )
      res.json({ success: true })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to save profile' })
    }

  } else {
    res.status(405).end()
  }
}
