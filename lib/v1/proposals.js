// lib/v1/proposals.js
// A stored proposal as the contract's ProgramProposal (RYR-37).

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
