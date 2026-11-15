// lib/planGeneration.js
// Plan generation that runs after the HTTP response (RYR-8).
//
// POST /api/workout-plans/:id/generate claims the plan, answers 202 straight
// away, and hands runGeneration() to Vercel's waitUntil(). The dashboard polls
// the plan until its status leaves 'generating'.
import { WorkoutPlan } from './models'
import { generatePlanWithGemini } from './apiHelpers'
import { GenerationError, GENERATION_FAILED, GEMINI_BUDGET_MS } from './geminiClient'

// The generate route's maxDuration, in seconds. Vercel only reads the literal
// in the route's `config`, so keep the two in step. 60s works on every Vercel
// plan; with Fluid compute it can go up to 300s (then raise GEMINI_BUDGET_MS).
export const GENERATION_MAX_DURATION_S = 60

// A plan still 'generating' after this long has lost its run (the function
// was killed, or crashed). It's marked failed so the user can retry.
// maxDuration plus a margin, so a run that is still going is never cut off.
export const STALE_GENERATION_MS = (GENERATION_MAX_DURATION_S + 60) * 1000
const STALE_MESSAGE = "Generating the plan didn't finish. Please try again."

if (GEMINI_BUDGET_MS >= GENERATION_MAX_DURATION_S * 1000) {
  throw new Error('GEMINI_BUDGET_MS must be shorter than the generate route maxDuration')
}

// Mark this user's stuck plans as failed. Called when plans are read, so a
// stuck plan is fixed the next time the dashboard looks at it.
export async function failStaleGenerations(privyUserId, planId) {
  const filter = {
    privyUserId,
    status: 'generating',
    updatedAt: { $lt: new Date(Date.now() - STALE_GENERATION_MS) },
  }
  if (planId) filter._id = planId
  await WorkoutPlan.updateMany(filter, { status: 'failed', lastError: STALE_MESSAGE })
}

// Generate and save the plan. Never throws: every outcome is written to the
// plan. Writes only apply while the plan still carries this run's
// generationId, so a stale run can't overwrite a newer one (or a deleted plan).
export async function runGeneration(plan, generationId) {
  const deadline = Date.now() + GEMINI_BUDGET_MS
  const current = { _id: plan._id, privyUserId: plan.privyUserId, generationId }

  try {
    const generated = await generatePlanWithGemini({
      fitnessLevel: plan.fitnessLevel,
      targetMuscles: plan.targetMuscles,
      frequency: plan.frequency,
      sessionDuration: plan.sessionDuration,
      preferences: plan.preferences,
    }, { deadline })

    await WorkoutPlan.updateOne(current, { generatedPlan: generated, status: 'ready', lastError: '' })
  } catch (err) {
    // Log only the message. A raw axios error carries the request config
    // (headers), which would put the Gemini API key in logs (RYR-2).
    console.error('Plan generation failed:', err.response?.status ?? '-', err.message)
    // lastError is shown in the dashboard: a GenerationError carries a
    // readable message (RYR-7); anything else gets the generic one.
    const userMessage = err instanceof GenerationError ? err.userMessage : GENERATION_FAILED
    try {
      await WorkoutPlan.updateOne(current, { status: 'failed', lastError: userMessage })
    } catch (saveErr) {
      // The plan stays 'generating' until failStaleGenerations picks it up.
      console.error('Could not save failed generation:', saveErr.message)
    }
  }
}
