// pages/api/workouts/index.js
import { withAuth } from '@/lib/apiHandler'
import { Workout } from '@/lib/models'
import { createWorkoutBody } from '@/lib/validation'

export default withAuth({
  GET: async (req, res, { privyUserId }) => {
    const workouts = await Workout.find({ privyUserId }).sort({ savedAt: -1 })
    res.json(workouts)
  },

  // No UI caller at the moment (see RYR-4); kept, but validated.
  POST: async (req, res, { privyUserId }) => {
    const workout = new Workout({ privyUserId, exercises: req.body.exercises })
    await workout.save()
    res.json({ success: true })
  },
}, {
  errors: { GET: 'Failed to fetch workouts', POST: 'Failed to save workout' },
  schemas: { POST: { body: createWorkoutBody } },
})
