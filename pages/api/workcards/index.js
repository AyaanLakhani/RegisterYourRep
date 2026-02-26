// pages/api/workcards/index.js  ←  was: app.get('/api/workcards', ...)
import { getSession } from '@/lib/session'
import { connectDB } from '@/lib/mongoose'
import { Workcard } from '@/lib/models'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const session = await getSession(req, res)
  if (!session.privyUserId) return res.status(401).json({ error: 'Not authenticated' })
  const privyUserId = session.privyUserId

  await connectDB()

  try {
    const filter = { privyUserId }
    if (req.query.status === 'pending' || req.query.status === 'submitted') filter.status = req.query.status
    if (req.query.planId) filter.planId = req.query.planId

    const workcards = await Workcard.find(filter).sort({ status: 1, dayIndex: 1, createdAt: -1 })
    res.json(workcards)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch workcards' })
  }
}
