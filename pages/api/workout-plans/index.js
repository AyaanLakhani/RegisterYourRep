// pages/api/workout-plans/index.js
import { withAuth } from '@/lib/apiHandler'
import { WorkoutPlan } from '@/lib/models'
import { createPlanBody } from '@/lib/validation'
import { failStaleGenerations } from '@/lib/planGeneration'

export default withAuth({
  GET: async (req, res, { privyUserId }) => {
    await failStaleGenerations(privyUserId) // RYR-8: free up plans stuck in 'generating'
    const plans = await WorkoutPlan.find({ privyUserId }).sort({ updatedAt: -1 })
    res.json(plans)
  },

  POST: async (req, res, { privyUserId }) => {
    // req.body has been validated and trimmed against createPlanBody.
    const body = req.body
    const plan = await WorkoutPlan.create({
      privyUserId,
      name: body.name || 'Workout Plan',
      source: body.source === 'onboarding' ? 'onboarding' : 'custom',
      fitnessLevel: body.fitnessLevel || '',
      targetMuscles: body.targetMuscles,
      frequency: body.frequency,
      sessionDuration: body.sessionDuration,
      preferences: body.preferences || '',
      status: 'draft',
    })
    res.json({ success: true, plan })
  },
}, {
  errors: { GET: 'Failed to fetch workout plans', POST: 'Failed to create workout plan' },
  schemas: { POST: { body: createPlanBody } },
})
