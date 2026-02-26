// pages/api/workouts/index.js  ←  was: app.get/post('/api/workouts', ...)
import { getSession } from '@/lib/session'
import { connectDB } from '@/lib/mongoose'
import { Workout } from '@/lib/models'

export default async function handler(req, res) {
  const session = await getSession(req, res)
  if (!session.privyUserId) return res.status(401).json({ error: 'Not authenticated' })
  const privyUserId = session.privyUserId

  await connectDB()

  if (req.method === 'GET') {
    try {
      const workouts = await Workout.find({ privyUserId }).sort({ savedAt: -1 })
      res.json(workouts)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to fetch workouts' })
    }

  } else if (req.method === 'POST') {
    try {
      const { exercises } = req.body
      if (!exercises || !exercises.length) return res.status(400).json({ error: 'No exercises provided' })
      const workout = new Workout({ privyUserId, exercises })
      await workout.save()
      res.json({ success: true })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to save workout' })
    }

  } else {
    res.status(405).end()
  }
}
