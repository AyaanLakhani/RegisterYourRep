// pages/api/workout-plans/[id]/[action].js
// Handles:
//   POST /api/workout-plans/:id/generate
//   POST /api/workout-plans/:id/workcards
import { withAuth } from '@/lib/apiHandler'
import { WorkoutPlan, Workcard } from '@/lib/models'
import { generatePlanWithGemini, normalizeDayExercises } from '@/lib/apiHelpers'
import { reserveGeneration, GENERATION_LIMIT } from '@/lib/rateLimit'
import { GenerationError, GENERATION_FAILED } from '@/lib/geminiClient'

// A plan left in 'generating' longer than this (e.g. the function timed out
// mid-run) is treated as stale, so it can be retried.
const STALE_GENERATION_MS = 5 * 60 * 1000

async function generate(req, res, privyUserId) {
  const { id } = req.query

  // 1. Per-user rate limit (RYR-5).
  const reservation = await reserveGeneration(privyUserId, id)
  if (!reservation.ok) {
    const minutes = Math.ceil(reservation.retryAfterSeconds / 60)
    res.setHeader('Retry-After', String(reservation.retryAfterSeconds))
    return res.status(429).json({
      error: `You've reached the limit of ${GENERATION_LIMIT} plan generations per hour. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    })
  }

  // 2. Atomically claim the plan, so two concurrent requests can't both start
  //    a Gemini call. Only one update can flip the status to 'generating'.
  let plan
  try {
    plan = await WorkoutPlan.findOneAndUpdate(
      {
        _id: id,
        privyUserId,
        $or: [
          { status: { $ne: 'generating' } },
          { updatedAt: { $lt: new Date(Date.now() - STALE_GENERATION_MS) } },
        ],
      },
      { status: 'generating', lastError: '' },
      { new: true }
    )
  } catch (err) {
    await reservation.release()
    throw err
  }

  if (!plan) {
    await reservation.release()
    const exists = await WorkoutPlan.exists({ _id: id, privyUserId })
    if (!exists) return res.status(404).json({ error: 'Workout plan not found' })
    return res.status(409).json({ error: 'This plan is already being generated. Please wait for it to finish.' })
  }

  // 3. Generate. A failed attempt still counts toward the limit.
  try {
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
    // Log only the message. A raw axios error carries the request config
    // (headers), which would put the Gemini API key in logs (RYR-2).
    console.error('Plan generation failed:', err.response?.status ?? '-', err.message)
    // lastError is shown in the dashboard: a GenerationError carries a
    // readable message (RYR-7); anything else gets the generic one.
    const userMessage = err instanceof GenerationError ? err.userMessage : GENERATION_FAILED
    try {
      await WorkoutPlan.findOneAndUpdate({ _id: id, privyUserId }, { status: 'failed', lastError: userMessage })
    } catch (_) {}
    res.status(500).json({ error: userMessage })
  }
}

async function createWorkcards(req, res, privyUserId) {
  const plan = await WorkoutPlan.findOne({ _id: req.query.id, privyUserId })
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
}

export default withAuth({
  POST: async (req, res, { privyUserId }) => {
    const { action } = req.query
    if (action === 'generate') return generate(req, res, privyUserId)
    if (action === 'workcards') return createWorkcards(req, res, privyUserId)
    res.status(404).json({ error: 'Unknown action' })
  },
}, {
  idParams: ['id'],
  errors: { POST: 'Workout plan request failed' },
})
