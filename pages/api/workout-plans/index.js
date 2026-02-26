// pages/api/workout-plans/index.js  ←  was: app.get/post('/api/workout-plans', ...)
import { getSession } from '@/lib/session'
import { connectDB } from '@/lib/mongoose'
import { WorkoutPlan } from '@/lib/models'
import { normalizeMuscles, safeNumber } from '@/lib/apiHelpers'

export default async function handler(req, res) {
  const session = await getSession(req, res)
  if (!session.privyUserId) return res.status(401).json({ error: 'Not authenticated' })
  const privyUserId = session.privyUserId

  await connectDB()

  if (req.method === 'GET') {
    try {
      const plans = await WorkoutPlan.find({ privyUserId }).sort({ updatedAt: -1 })
      res.json(plans)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to fetch workout plans' })
    }

  } else if (req.method === 'POST') {
    try {
      const body = req.body || {}
      const plan = await WorkoutPlan.create({
        privyUserId,
        name: body.name?.trim() || 'Workout Plan',
        source: body.source === 'onboarding' ? 'onboarding' : 'custom',
        fitnessLevel: body.fitnessLevel ? String(body.fitnessLevel).trim() : '',
        targetMuscles: normalizeMuscles(body.targetMuscles),
        frequency: safeNumber(body.frequency),
        sessionDuration: safeNumber(body.sessionDuration),
        preferences: body.preferences ? String(body.preferences).trim() : '',
        status: 'draft',
      })
      res.json({ success: true, plan })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to create workout plan' })
    }

  } else {
    res.status(405).end()
  }
}
