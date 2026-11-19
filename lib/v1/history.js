// lib/v1/history.js
// Workout history for plan regeneration (RYR-15). The user's recent sessions
// are summarised in code into a few numbers and lists; only that summary
// reaches the generator, never the raw history.
import { EXERCISES_BY_ID } from '../catalog'
import { TrainingSession } from './models'
import { currentProgram } from './programs'

export const HISTORY_RULES = {
  sessions: 12,     // how many recent finished sessions are looked at
  skipLimit: 3,     // skipped in this many of them = left out of the next plan
  reliableDone: 3,  // done this many times and never skipped = "done reliably"
  lowCompletion: 60, // below this % of sessions done, pros get less weekly volume
}

/**
 * Summary of recent sessions (newest first; only 'done' and 'skipped' ones
 * count). Returns null when there is no history, so users without any get
 * exactly the same plan as before.
 *   { sessionsConsidered, sessionsDone, completionPercent,
 *     oftenSkipped: [{ exerciseId, name, skipped, reason }],
 *     reliable: [exerciseId], currentExerciseIds: [exerciseId] }
 */
export function summarizeSessions(sessions, { currentExerciseIds = [] } = {}, rules = HISTORY_RULES) {
  const recent = sessions.filter(s => s.status === 'done' || s.status === 'skipped').slice(0, rules.sessions)
  if (!recent.length) return null

  const stats = new Map() // exerciseId -> { done, skipped, reasons }
  const stat = id => stats.get(id) || stats.set(id, { done: 0, skipped: 0, reasons: new Map() }).get(id)
  for (const s of recent) {
    // One count per session, even if an exercise was logged twice.
    const seen = new Map()
    for (const log of s.logs || []) seen.set(log.exerciseId, log)
    for (const [id, log] of seen) {
      const entry = stat(id)
      if (log.status === 'done') entry.done++
      else {
        entry.skipped++
        if (log.reason) entry.reasons.set(log.reason, (entry.reasons.get(log.reason) || 0) + 1)
      }
    }
  }

  const sessionsDone = recent.filter(s => s.status === 'done').length
  const topReason = reasons => [...reasons.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null
  const oftenSkipped = [...stats.entries()]
    .filter(([, e]) => e.skipped >= rules.skipLimit)
    .sort((a, b) => b[1].skipped - a[1].skipped)
    .map(([exerciseId, e]) => ({ exerciseId, name: EXERCISES_BY_ID.get(exerciseId)?.name || exerciseId, skipped: e.skipped, reason: topReason(e.reasons) }))
  const reliable = [...stats.entries()]
    .filter(([, e]) => e.skipped === 0 && e.done >= rules.reliableDone)
    .map(([id]) => id)

  return {
    sessionsConsidered: recent.length,
    sessionsDone,
    completionPercent: Math.round((sessionsDone / recent.length) * 100),
    oftenSkipped,
    reliable,
    currentExerciseIds: [...new Set(currentExerciseIds)],
  }
}

/** The history summary for a user, or null when they have none. */
export async function loadHistory(privyUserId) {
  const [sessions, program] = await Promise.all([
    TrainingSession.find({ privyUserId, status: { $in: ['done', 'skipped'] } })
      .sort({ date: -1 }).limit(HISTORY_RULES.sessions).select({ status: 1, logs: 1, date: 1 }).lean(),
    currentProgram(privyUserId),
  ])
  const currentExerciseIds = (program?.days || []).flatMap(d => (d.exercises || []).map(e => e.exerciseId))
  return summarizeSessions(sessions, { currentExerciseIds })
}

/**
 * Exercise ids to leave out of the next plan: the often-skipped ones, except
 * those with no alternative in `pool` (another exercise for one of the same
 * primary muscles), so a muscle never loses its only option.
 */
export function idsToAvoid(history, pool) {
  if (!history?.oftenSkipped?.length) return new Set()
  const skip = new Set(history.oftenSkipped.map(s => s.exerciseId))
  const avoid = new Set()
  for (const id of skip) {
    const ex = EXERCISES_BY_ID.get(id)
    if (!ex) continue
    const hasAlternative = pool.some(p => !skip.has(p.id) && p.primaryMuscles.some(m => ex.primaryMuscles.includes(m)))
    if (hasAlternative) avoid.add(id)
  }
  return avoid
}

/** Pro volume from history: users finishing few sessions get a lower weekly ceiling. */
export function volumeScaleFor(history, rules = HISTORY_RULES) {
  if (!history || history.sessionsConsidered < 4) return 1
  return history.completionPercent < rules.lowCompletion ? 0.8 : 1
}

/** The few lines of history the model sees. '' without history. */
export function historyLines(history, { level, avoided }) {
  if (!history) return ''
  const lines = [`Last ${history.sessionsConsidered} sessions: ${history.sessionsDone} done (${history.completionPercent}%).`]
  const removed = history.oftenSkipped.filter(s => avoided.has(s.exerciseId))
  if (removed.length) {
    lines.push(`Left out because they keep skipping them: ${removed.map(s => `${s.name} (${s.skipped}x${s.reason ? `, ${s.reason}` : ''})`).join(', ')}. Pick other exercises for those muscles.`)
  }
  const reliable = history.reliable.map(id => EXERCISES_BY_ID.get(id)?.name).filter(Boolean).slice(0, 8)
  if (reliable.length) lines.push(`Done reliably: ${reliable.join(', ')}.`)
  if (level === 'beginner') {
    const keep = history.currentExerciseIds.filter(id => !avoided.has(id))
    if (keep.length) lines.push(`Keep their current exercises where they fit (ids): ${keep.join(', ')}.`)
  }
  return lines.join('\n')
}
