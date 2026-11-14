// pages/api/workouts/index.js
import { withAuth } from '@/lib/apiHandler'
import { Workout } from '@/lib/models'

export default withAuth({
  GET: async (req, res, { privyUserId }) => {
    const workouts = await Workout.find({ privyUserId }).sort({ savedAt: -1 })
    res.json(workouts)
  },

  POST: async (req, res, { privyUserId }) => {
    const { exercises } = req.body || {}
    if (!exercises || !exercises.length) return res.status(400).json({ error: 'No exercises provided' })
    const workout = new Workout({ privyUserId, exercises })
    await workout.save()
    res.json({ success: true })
  },
}, {
  errors: { GET: 'Failed to fetch workouts', POST: 'Failed to save workout' },
})
