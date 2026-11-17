// pages/api/v1/generation-jobs/index.js (RYR-37, contract #4)
//   POST /api/v1/generation-jobs  start building a plan from the current profile (202)
// The Gemini call runs after the response (waitUntil); the app polls
// GET /api/v1/generation-jobs/:jobId.
import { waitUntil } from '@vercel/functions'
import { withAuth } from '@/lib/apiHandler'
import { reserveGeneration, GENERATION_LIMIT } from '@/lib/rateLimit'
import { GenerationJob } from '@/lib/v1/models'
import { requireProfile } from '@/lib/v1/profiles'
import { runProposalJob, STALE_JOB_MS, toJob } from '@/lib/v1/generation'

// Generation keeps running after the response (waitUntil) for up to this many
// seconds; it must stay above PROPOSAL_BUDGET_MS (150s). Vercel only reads a
// literal here. Up to 300 needs Fluid compute (the default for Vercel
// projects); without it, Hobby caps functions at 60s.
export const config = { maxDuration: 180 }

const STALE_MESSAGE = "Building the plan didn't finish. Please try again."

export default withAuth({
  POST: async (req, res, { privyUserId }) => {
    const profile = await requireProfile(privyUserId)

    // A job that has been "running" too long lost its run: free the slot.
    await GenerationJob.updateMany(
      { activeKey: privyUserId, createdAt: { $lt: new Date(Date.now() - STALE_JOB_MS) } },
      { $set: { status: 'failed', error: STALE_MESSAGE, finishedAt: new Date() }, $unset: { activeKey: 1 } }
    )

    const reservation = await reserveGeneration(privyUserId, 'v1-job')
    if (!reservation.ok) {
      const minutes = Math.ceil(reservation.retryAfterSeconds / 60)
      res.setHeader('Retry-After', String(reservation.retryAfterSeconds))
      return res.status(429).json({
        error: `You've reached the limit of ${GENERATION_LIMIT} plan builds per hour. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      })
    }

    let job
    try {
      job = await GenerationJob.create({
        privyUserId,
        profileVersion: profile.version,
        status: 'running',
        logId: reservation.logId,
        activeKey: privyUserId, // unique: one running job per user
      })
    } catch (err) {
      await reservation.release()
      if (err?.code === 11000) {
        return res.status(409).json({ error: 'Your plan is already being built. Please wait for it to finish.' })
      }
      throw err
    }

    waitUntil(runProposalJob(job.toObject(), profile))
    res.status(202).json(toJob(job.toObject()))
  },
}, {
  errors: { POST: 'Failed to start building your plan' },
})
