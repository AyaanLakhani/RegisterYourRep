// pages/api/workcards/[id]/submit.js  ←  was: app.post('/api/workcards/:id/submit', ...)
import { getSession } from '@/lib/session'
import { connectDB } from '@/lib/mongoose'
import { Workcard, Workout } from '@/lib/models'
import { calculateCompletion } from '@/lib/apiHelpers'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const session = await getSession(req, res)
  if (!session.privyUserId) return res.status(401).json({ error: 'Not authenticated' })
  const privyUserId = session.privyUserId
  const { id } = req.query

  await connectDB()

  try {
    const workcard = await Workcard.findOne({ _id: id, privyUserId })
    if (!workcard) return res.status(404).json({ error: 'Workcard not found' })
    if (workcard.status === 'submitted') return res.json({ success: true, workcard, alreadySubmitted: true })
    if (!workcard.date || !workcard.weekday) {
      return res.status(400).json({ error: 'Date and day are required before submit' })
    }

    const checked = Array.isArray(workcard.checked) ? workcard.checked : []
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
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to submit workcard' })
  }
}
