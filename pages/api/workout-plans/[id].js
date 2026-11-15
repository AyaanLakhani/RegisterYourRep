// pages/api/workout-plans/[id].js
import { withAuth } from '@/lib/apiHandler'
import { WorkoutPlan, Workcard, Workout } from '@/lib/models'

export default withAuth({
  GET: async (req, res, { privyUserId }) => {
    const plan = await WorkoutPlan.findOne({ _id: req.query.id, privyUserId })
    if (!plan) return res.status(404).json({ error: 'Workout plan not found' })
    res.json(plan)
  },

  DELETE: async (req, res, { privyUserId }) => {
    const plan = await WorkoutPlan.findOne({ _id: req.query.id, privyUserId })
    if (!plan) return res.status(404).json({ error: 'Workout plan not found' })

    const relatedWorkcards = await Workcard.find({ privyUserId, planId: plan._id }).select({ _id: 1 })
    const relatedWorkcardIds = relatedWorkcards.map(wc => String(wc._id))

    await Workcard.deleteMany({ privyUserId, planId: plan._id })

    const workoutFilter = { privyUserId, $or: [{ planId: String(plan._id) }] }
    if (relatedWorkcardIds.length) workoutFilter.$or.push({ workcardId: { $in: relatedWorkcardIds } })
    await Workout.deleteMany(workoutFilter)

    await plan.deleteOne()
    res.json({ success: true })
  },
}, {
  idParams: ['id'],
  errors: { GET: 'Failed to fetch workout plan', DELETE: 'Failed to delete workout plan' },
})
