// pages/api/workcards/[id]/submit.js
import { withAuth } from '@/lib/apiHandler'
import { Workcard, Workout } from '@/lib/models'
import { calculateCompletion } from '@/lib/apiHelpers'

export default withAuth({
  POST: async (req, res, { privyUserId }) => {
    const workcard = await Workcard.findOne({ _id: req.query.id, privyUserId })
    if (!workcard) return res.status(404).json({ error: 'Workcard not found' })
    if (workcard.status === 'submitted') return res.json({ success: true, workcard, alreadySubmitted: true })
    if (!workcard.date || !workcard.weekday) {
      return res.status(400).json({ error: 'Date and day are required before submit' })
    }

    const checked = Array.isArray(workcard.checked) ? workcard.checked : []
    const today = new Date().toISOString().split('T')[0]
    if (workcard.date > today) {
      return res.status(400).json({ error: 'Date cannot be in the future.' })
    }
    const completion = calculateCompletion(checked, workcard.totalCount || 0)

    workcard.completedCount = completion.completedCount
    workcard.score = completion.score
    workcard.status = 'submitted'
    workcard.submittedAt = new Date()
    await workcard.save()

    const completedNames = (workcard.exercises || [])
      .filter((_ex, idx) => checked[idx])
      .map(ex => ex.name)

    await Workout.create({
      privyUserId,
      source: 'workcard',
      planId: String(workcard.planId),
      workcardId: String(workcard._id),
      dayLabel: workcard.dayLabel,
      completionScore: workcard.score,
      completedCount: workcard.completedCount,
      totalCount: workcard.totalCount,
      sessionDate: workcard.date,
      sessionWeekday: workcard.weekday,
      exercises: completedNames.length ? completedNames : ['No exercises completed'],
    })

    res.json({ success: true, workcard })
  },
}, {
  idParams: ['id'],
  errors: { POST: 'Failed to submit workcard' },
})
