// lib/rateLimit.js
// Per-user rate limit for Gemini plan generation (RYR-5), stored in MongoDB.
import mongoose from 'mongoose'
import { GenerationLog, GENERATION_LOG_TTL_SECONDS } from './models'

export const GENERATION_LIMIT = 5                // generations per user...
export const GENERATION_WINDOW_MS = 60 * 60 * 1000 // ...per rolling hour
// Ask Coach messages (RYR-40) have their own, larger budget in the same log,
// so chatting doesn't use up plan generations.
export const COACH_LIMIT = 30

// Rows written before `kind` existed are plan generations.
const KIND_FILTER = {
  plan: { kind: { $ne: 'coach' } },
  coach: { kind: 'coach' },
}

if (GENERATION_LOG_TTL_SECONDS * 1000 < GENERATION_WINDOW_MS) {
  throw new Error('GenerationLog TTL must be at least the rate-limit window')
}

// The TTL index was created with a 1-hour expiry in RYR-5. Mongoose won't
// change an existing index's options (createIndex fails with a conflict), so
// the first reservation per server instance updates it in place with collMod.
let ttlChecked = false
async function ensureLogTtl() {
  if (ttlChecked) return
  ttlChecked = true
  try {
    const collection = GenerationLog.collection
    const indexes = await collection.indexes()
    const ttlIndex = indexes.find(i => i.key?.createdAt === 1 && Object.keys(i.key).length === 1)
    if (ttlIndex && ttlIndex.expireAfterSeconds !== GENERATION_LOG_TTL_SECONDS) {
      // The Mongoose collection wrapper has no .db; run it on the connection's database.
      await mongoose.connection.db.command({
        collMod: collection.collectionName,
        index: { keyPattern: { createdAt: 1 }, expireAfterSeconds: GENERATION_LOG_TTL_SECONDS },
      })
      console.info(`GenerationLog TTL updated to ${GENERATION_LOG_TTL_SECONDS}s`)
    }
  } catch (err) {
    // Not fatal: logs just expire sooner than intended until this succeeds.
    console.warn('Could not check the GenerationLog TTL index:', err.message)
  }
}

/**
 * Reserves one generation for this user. The row is inserted first and the
 * window counted afterwards, so two parallel requests can't both slip under
 * the limit.
 *
 * Returns { ok: true, logId, release } or { ok: false, retryAfterSeconds }.
 * The reservation row is also the generation's log (RYR-10): fill it in with
 * finishGenerationLog(). Call release() if the generation never starts
 * (e.g. the plan is busy).
 */
export async function reserveGeneration(privyUserId, planId, { kind = 'plan' } = {}) {
  await ensureLogTtl()
  const limit = kind === 'coach' ? COACH_LIMIT : GENERATION_LIMIT
  const entry = await GenerationLog.create({ privyUserId, planId: String(planId), kind })
  const since = new Date(Date.now() - GENERATION_WINDOW_MS)

  // Entries in the window up to and including ours, oldest first.
  const inWindow = await GenerationLog.find({
    privyUserId,
    ...KIND_FILTER[kind],
    createdAt: { $gte: since },
    _id: { $lte: entry._id },
  }).sort({ _id: 1 }).select({ createdAt: 1 }).lean()

  if (inWindow.length > limit) {
    await GenerationLog.deleteOne({ _id: entry._id })
    const oldest = inWindow[0].createdAt.getTime()
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + GENERATION_WINDOW_MS - Date.now()) / 1000))
    return { ok: false, retryAfterSeconds }
  }

  return {
    ok: true,
    logId: entry._id,
    release: () => GenerationLog.deleteOne({ _id: entry._id }).catch(() => {}),
  }
}

/**
 * Records a generation's outcome on its log row (RYR-10).
 * `meta` comes from generatePlanWithGemini (on the result or the error).
 */
export async function finishGenerationLog(logId, { succeeded, meta, error }) {
  if (!logId) return
  const usage = meta?.usage || {}
  try {
    await GenerationLog.updateOne({ _id: logId }, {
      status: succeeded ? 'succeeded' : 'failed',
      model: meta?.model,
      promptVersion: meta?.promptVersion,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      thinkingTokens: usage.thinkingTokens,
      totalTokens: usage.totalTokens,
      latencyMs: meta?.latencyMs,
      attempts: meta?.attempts,
      finishReason: meta?.finishReason || undefined,
      error: succeeded ? undefined : String(error || '').slice(0, 300),
      finishedAt: new Date(),
    })
  } catch (err) {
    console.error('Could not write the generation log:', err.message)
  }
}
