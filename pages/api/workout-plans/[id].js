// pages/api/workout-plans/[id].js  ←  was: app.get/delete('/api/workout-plans/:id', ...)
import { getSession } from '@/lib/session'
import { connectDB } from '@/lib/mongoose'
import { WorkoutPlan, Workcard, Workout } from '@/lib/models'

export default async function handler(req, res) {
  const session = await getSession(req, res)
  if (!session.privyUserId) return res.status(401).json({ error: 'Not authenticated' })
  const privyUserId = session.privyUserId
  const { id } = req.query

  await connectDB()

  if (req.method === 'GET') {
    try {
      const plan = await WorkoutPlan.findOne({ _id: id, privyUserId })
      if (!plan) return res.status(404).json({ error: 'Workout plan not found' })
      res.json(plan)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to fetch workout plan' })
    }

  } else if (req.method === 'DELETE') {
    try {
      const plan = await WorkoutPlan.findOne({ _id: id, privyUserId })
      if (!plan) return res.status(404).json({ error: 'Workout plan not found' })

      const relatedWorkcards = await Workcard.find({ privyUserId, planId: plan._id }).select({ _id: 1 })
      const relatedWorkcardIds = relatedWorkcards.map(wc => String(wc._id))

      await Workcard.deleteMany({ privyUserId, planId: plan._id })

      const workoutFilter = { privyUserId, $or: [{ planId: String(plan._id) }] }
      if (relatedWorkcardIds.length) workoutFilter.$or.push({ workcardId: { $in: relatedWorkcardIds } })
      await Workout.deleteMany(workoutFilter)

      await plan.deleteOne()
      res.json({ success: true })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to delete workout plan' })
    }

  } else {
    res.status(405).end()
  }
}
