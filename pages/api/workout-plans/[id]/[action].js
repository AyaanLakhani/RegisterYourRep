// pages/api/workout-plans/[id]/[action].js
// Handles:
//   POST /api/workout-plans/:id/generate   ← was: app.post('/api/workout-plans/:id/generate', ...)
//   POST /api/workout-plans/:id/workcards  ← was: app.post('/api/workout-plans/:id/workcards', ...)

import { getSession } from '@/lib/session'
import { connectDB } from '@/lib/mongoose'
import { WorkoutPlan, Workcard } from '@/lib/models'
import { generatePlanWithGemini, normalizeDayExercises } from '@/lib/apiHelpers'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const session = await getSession(req, res)
  if (!session.privyUserId) return res.status(401).json({ error: 'Not authenticated' })
  const privyUserId = session.privyUserId
  const { id, action } = req.query

  await connectDB()

  // POST /api/workout-plans/:id/generate
  if (action === 'generate') {
    try {
      const plan = await WorkoutPlan.findOne({ _id: id, privyUserId })
      if (!plan) return res.status(404).json({ error: 'Workout plan not found' })

      plan.status = 'generating'
      plan.lastError = ''
      await plan.save()

      const generated = await generatePlanWithGemini({
        fitnessLevel: plan.fitnessLevel,
        targetMuscles: plan.targetMuscles,
        frequency: plan.frequency,
        sessionDuration: plan.sessionDuration,
        preferences: plan.preferences,
      })

      plan.generatedPlan = generated
      plan.status = 'ready'
      plan.lastError = ''
      await plan.save()

      res.json({ success: true, plan })
    } catch (err) {
      console.error(err)
      try {
        await WorkoutPlan.findOneAndUpdate(
          { _id: id, privyUserId },
          { status: 'failed', lastError: err.message || 'Generation failed' }
        )
      } catch (_) {}
      res.status(500).json({ error: err.message || 'Failed to generate workout plan' })
    }

  // POST /api/workout-plans/:id/workcards
  } else if (action === 'workcards') {
    try {
      const plan = await WorkoutPlan.findOne({ _id: id, privyUserId })
      if (!plan) return res.status(404).json({ error: 'Workout plan not found' })
      if (plan.status !== 'ready' || !Array.isArray(plan.generatedPlan?.days)) {
        return res.status(400).json({ error: 'Generate the workout plan first' })
      }

      const existing = await Workcard.find({ privyUserId, planId: plan._id }).sort({ dayIndex: 1 })
      if (existing.length) return res.json({ success: true, workcards: existing, reused: true })

      const docs = plan.generatedPlan.days.map((day, index) => {
        const exercises = normalizeDayExercises(day)
        return {
          privyUserId,
          planId: plan._id,
          planName: plan.name,
          dayIndex: index + 1,
          dayLabel: day?.day ? String(day.day) : `Day ${index + 1}`,
          focus: Array.isArray(day?.focus) ? day.focus.filter(Boolean).map(String) : [],
          exercises,
          checked: exercises.map(() => false),
          totalCount: exercises.length,
          completedCount: 0,
          score: 0,
          status: 'pending',
        }
      })

      const workcards = await Workcard.insertMany(docs)
      res.json({ success: true, workcards })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to generate workcards' })
    }

  } else {
    res.status(404).json({ error: 'Unknown action' })
  }
}
