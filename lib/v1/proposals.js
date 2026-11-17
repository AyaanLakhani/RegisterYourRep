// lib/v1/proposals.js
// A stored proposal as the contract's ProgramProposal (RYR-37), and the
// user's pending draft (a built plan they haven't started yet).
import { Program, ProgramProposal } from './models'

// A draft older than this isn't offered again; a new plan gets built instead.
const PENDING_DAYS = 7

function toOption(o) {
  return JSON.parse(JSON.stringify({
    kind: o.kind,
    name: o.name,
    summary: o.summary || '',
    days: (o.days || []).map(d => ({
      weekday: d.weekday,
      name: d.name,
      focus: d.focus,
      estimatedMinutes: d.estimatedMinutes,
      exercises: d.exercises.map(e => ({
        exerciseId: e.exerciseId, name: e.name, sets: e.sets, reps: e.reps, restSeconds: e.restSeconds,
        formCue: e.formCue || undefined,
      })),
    })),
  }))
}

export function toProposal(doc) {
  return {
    id: String(doc._id),
    jobId: doc.jobId,
    createdAt: new Date(doc.createdAt).toISOString(),
    recommended: toOption(doc.recommended),
    asAsked: toOption(doc.asAsked),
    coachNote: doc.coachNote || '',
  }
}

/**
 * The newest proposal the user hasn't accepted, if it's recent and newer than
 * their current program. Home goes back to it instead of building a new plan.
 */
export async function pendingProposal(privyUserId) {
  const since = new Date(Date.now() - PENDING_DAYS * 24 * 60 * 60 * 1000)
  const proposal = await ProgramProposal.findOne({ privyUserId, acceptedAt: null, createdAt: { $gte: since } })
    .sort({ createdAt: -1 }).lean()
  if (!proposal) return null
  const program = await Program.findOne({ privyUserId, status: 'current' }).sort({ version: -1 }).select({ createdAt: 1 }).lean()
  if (program && program.createdAt > proposal.createdAt) return null
  return toProposal(proposal)
}
