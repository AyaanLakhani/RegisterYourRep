// lib/rateLimit.js
// Per-user rate limit for Gemini plan generation (RYR-5), stored in MongoDB.
import { GenerationLog, GENERATION_LOG_TTL_SECONDS } from './models'

export const GENERATION_LIMIT = 5                // generations per user...
export const GENERATION_WINDOW_MS = 60 * 60 * 1000 // ...per rolling hour

if (GENERATION_LOG_TTL_SECONDS * 1000 < GENERATION_WINDOW_MS) {
  throw new Error('GenerationLog TTL must be at least the rate-limit window')
}

/**
 * Reserves one generation for this user. The row is inserted first and the
 * window counted afterwards, so two parallel requests can't both slip under
 * the limit.
 *
 * Returns { ok: true, release } or { ok: false, retryAfterSeconds }.
 * Call release() if the generation never starts (e.g. the plan is busy).
 */
export async function reserveGeneration(privyUserId, planId) {
  const entry = await GenerationLog.create({ privyUserId, planId: String(planId) })
  const since = new Date(Date.now() - GENERATION_WINDOW_MS)

  // Entries in the window up to and including ours, oldest first.
  const inWindow = await GenerationLog.find({
    privyUserId,
    createdAt: { $gte: since },
    _id: { $lte: entry._id },
  }).sort({ _id: 1 }).select({ createdAt: 1 }).lean()

  if (inWindow.length > GENERATION_LIMIT) {
    await GenerationLog.deleteOne({ _id: entry._id })
    const oldest = inWindow[0].createdAt.getTime()
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + GENERATION_WINDOW_MS - Date.now()) / 1000))
    return { ok: false, retryAfterSeconds }
  }

  return {
    ok: true,
    release: () => GenerationLog.deleteOne({ _id: entry._id }).catch(() => {}),
  }
}
