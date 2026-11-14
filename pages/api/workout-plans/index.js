// pages/api/workout-plans/index.js
import { withAuth } from '@/lib/apiHandler'
import { WorkoutPlan } from '@/lib/models'
import { normalizeMuscles, safeNumber } from '@/lib/apiHelpers'

export default withAuth({
  GET: async (req, res, { privyUserId }) => {
    const plans = await WorkoutPlan.find({ privyUserId }).sort({ updatedAt: -1 })
    res.json(plans)
  },

  POST: async (req, res, { privyUserId }) => {
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
  },
}, {
  errors: { GET: 'Failed to fetch workout plans', POST: 'Failed to create workout plan' },
})
