// pages/api/workcards/[id].js
// Handles:
//   PATCH  /api/workcards/:id  update date / weekday / checked progress
//   DELETE /api/workcards/:id  remove workcard + linked workout history
// (POST /api/workcards/:id/submit lives in [id]/submit.js)
import { withAuth } from '@/lib/apiHandler'
import { Workcard, Workout } from '@/lib/models'
import { calculateCompletion } from '@/lib/apiHelpers'

export default withAuth({
  PATCH: async (req, res, { privyUserId }) => {
    const workcard = await Workcard.findOne({ _id: req.query.id, privyUserId })
    if (!workcard) return res.status(404).json({ error: 'Workcard not found' })
    if (workcard.status === 'submitted') return res.status(400).json({ error: 'Workcard already submitted' })

    const { date, weekday, checked } = req.body || {} // only allow updating these specific fields
    if (typeof date === 'string') {
      const trimmed = date.trim()
      const today = new Date().toISOString().split('T')[0]
      if (trimmed > today) return res.status(400).json({ error: 'Date cannot be in the future.' })
      workcard.date = trimmed
    }
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
  },

  DELETE: async (req, res, { privyUserId }) => {
    const workcard = await Workcard.findOne({ _id: req.query.id, privyUserId })
    if (!workcard) return res.status(404).json({ error: 'Workcard not found' })

    await Workout.deleteMany({ privyUserId, workcardId: String(workcard._id) })
    await workcard.deleteOne()
    res.json({ success: true })
  },
}, {
  idParams: ['id'],
  errors: { PATCH: 'Failed to update workcard', DELETE: 'Failed to delete workcard' },
})
