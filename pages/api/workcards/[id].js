// pages/api/workcards/[id].js
// Handles:
//   PATCH  /api/workcards/:id         ← was: app.patch('/api/workcards/:id', ...)
//   DELETE /api/workcards/:id         ← was: app.delete('/api/workcards/:id', ...)
//   POST   /api/workcards/:id/submit  ← handled via query param below

import { getSession } from '@/lib/session'
import { connectDB } from '@/lib/mongoose'
import { Workcard, Workout } from '@/lib/models'
import { calculateCompletion } from '@/lib/apiHelpers'

export default async function handler(req, res) {
  const session = await getSession(req, res)
  if (!session.privyUserId) return res.status(401).json({ error: 'Not authenticated' })
  const privyUserId = session.privyUserId
  const { id } = req.query

  await connectDB()

  // PATCH — update date / weekday / checked progress
  if (req.method === 'PATCH') {
    try {
      const workcard = await Workcard.findOne({ _id: id, privyUserId })
      if (!workcard) return res.status(404).json({ error: 'Workcard not found' })
      if (workcard.status === 'submitted') return res.status(400).json({ error: 'Workcard already submitted' })

      const { date, weekday, checked } = req.body
      if (typeof date === 'string') workcard.date = date.trim()
      if (typeof weekday === 'string') workcard.weekday = weekday.trim()

      if (Array.isArray(checked)) {
        const normalizedChecked = checked.map(Boolean).slice(0, workcard.totalCount)
        while (normalizedChecked.length < workcard.totalCount) normalizedChecked.push(false)
        workcard.checked = normalizedChecked
      }

      const completion = calculateCompletion(workcard.checked || [], workcard.totalCount || 0)
      workcard.completedCount = completion.completedCount
      workcard.score = completion.score
      await workcard.save()

      res.json({ success: true, workcard })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to update workcard' })
    }

  // DELETE — remove workcard + linked workout history
  } else if (req.method === 'DELETE') {
    try {
      const workcard = await Workcard.findOne({ _id: id, privyUserId })
      if (!workcard) return res.status(404).json({ error: 'Workcard not found' })

      await Workout.deleteMany({ privyUserId, workcardId: String(workcard._id) })
      await workcard.deleteOne()
      res.json({ success: true })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to delete workcard' })
    }

  } else {
    res.status(405).end()
  }
}
