// lib/v1/sessions.js
// Session actions for /api/v1 (RYR-38): read, move within the active week,
// log an exercise (done / skip / swap) and finish.
//
// Finished sessions never change, and nothing here touches program versions.
import mongoose from 'mongoose'
import { ApiError } from '../apiHandler'
import { EXERCISES_BY_ID } from '../catalog'
import { TrainingSession } from './models'
import { mondayOf, weekdayOf, isDay } from './dates'
import { currentProgram, toSession } from './programs'
import { projectedSession, getWeek, streakWeeks, summarize } from './weeks'

const NOT_FOUND = () => new ApiError(404, 'Not found')

/** A stored session, or a projected one for a future week ("planned-YYYY-MM-DD", read-only). */
export async function getSessionById(privyUserId, id) {
  const planned = /^planned-(\d{4}-\d{2}-\d{2})$/.exec(id || '')
  if (planned && isDay(planned[1])) {
    const program = await currentProgram(privyUserId)
    const session = program && projectedSession(program, planned[1])
    if (!session) throw NOT_FOUND()
    return session
  }
  if (!mongoose.isValidObjectId(id)) throw NOT_FOUND()
  const session = await TrainingSession.findOne({ _id: id, privyUserId }).lean()
  if (!session) throw NOT_FOUND()
  return session
}

async function loadEditable(privyUserId, id) {
  if (!mongoose.isValidObjectId(id)) {
    throw /^planned-/.test(id || '') ? new ApiError(400, "That session isn't scheduled yet.") : NOT_FOUND()
  }
  const session = await TrainingSession.findOne({ _id: id, privyUserId })
  if (!session) throw NOT_FOUND()
  if (session.status === 'done') throw new ApiError(400, 'This session is already finished.')
  return session
}

/** Moves a session to another day of the active week. Returns the updated Week. */
export async function moveSession(privyUserId, id, toDate, today) {
  const session = await loadEditable(privyUserId, id)
  if (session.status === 'skipped') throw new ApiError(400, 'This session was skipped.')
  const activeMonday = mondayOf(today)
  if (session.weekStart !== activeMonday || mondayOf(toDate) !== activeMonday) {
    throw new ApiError(400, 'Sessions can only move within this week.')
  }
  if (toDate !== session.date) {
    const original = session.movedFrom || session.date
    session.date = toDate
    session.weekday = weekdayOf(toDate)
    if (toDate === original) {
      session.status = 'scheduled'
      session.movedFrom = undefined
    } else {
      session.status = 'moved'
      session.movedFrom = original
    }
    try {
      await session.save()
    } catch (err) {
      if (err?.code === 11000) throw new ApiError(400, 'There is already a session on that day.')
      throw err
    }
  }
  return getWeek(privyUserId, today, today)
}

/** done / skip / swap for one exercise. Re-logging replaces the earlier log. Returns the Session. */
export async function logExercise(privyUserId, id, body) {
  const session = await loadEditable(privyUserId, id)
  const planned = session.exercises.find(e => e.exerciseId === body.exerciseId)
  if (!planned) throw new ApiError(404, "That exercise isn't in this session.")
  const now = new Date()
  if (!session.startedAt) session.startedAt = now

  if (body.action === 'swap') {
    const replacement = EXERCISES_BY_ID.get(body.replacementId)
    if (!replacement) throw new ApiError(404, 'Unknown replacement exercise.')
    if (session.exercises.some(e => e.exerciseId === replacement.id)) {
      throw new ApiError(400, `${replacement.name} is already in this session.`)
    }
    // Sets, reps and rest stay; the original is remembered. Its old log goes.
    planned.swappedFromId = planned.swappedFromId || planned.exerciseId
    planned.exerciseId = replacement.id
    planned.name = replacement.name
    planned.formCue = undefined
    session.logs = session.logs.filter(l => l.exerciseId !== body.exerciseId)
  } else {
    session.logs = session.logs.filter(l => l.exerciseId !== body.exerciseId)
    session.logs.push(body.action === 'done'
      ? { status: 'done', exerciseId: body.exerciseId, loggedAt: now, sets: body.sets?.length ? body.sets : undefined }
      : { status: 'skipped', exerciseId: body.exerciseId, loggedAt: now, reason: body.reason })
  }
  await session.save()
  return toSession(session.toObject())
}

const SKIP_REASON_TEXT = {
  no_equipment: 'no equipment was free',
  didnt_know: "you didn't know it",
  pain: 'it hurt',
  time: 'you ran out of time',
}

/** Finishes a session. Returns the contract's SessionCompletionSummary. */
export async function finishSession(privyUserId, id, body, today) {
  const existing = await loadEditable(privyUserId, id)
  const finishedAt = new Date()
  const startedAt = existing.startedAt
    || new Date(finishedAt.getTime() - (body.durationMinutes ?? existing.estimatedMinutes ?? 0) * 60000)
  const durationMinutes = body.durationMinutes ?? Math.max(0, Math.round((finishedAt - startedAt) / 60000))

  // Only one finish wins, even with two taps.
  const session = await TrainingSession.findOneAndUpdate(
    { _id: existing._id, privyUserId, status: { $ne: 'done' } },
    { $set: { status: 'done', finishedAt, startedAt }, $unset: { movedFrom: 1 } },
    { new: true }
  ).lean()
  if (!session) throw new ApiError(400, 'This session is already finished.')

  // Nudge when an exercise skipped today has now been skipped 2+ times overall.
  let repeatSkipNudge = null
  for (const log of session.logs.filter(l => l.status === 'skipped')) {
    const skips = await TrainingSession.aggregate([
      { $match: { privyUserId, 'logs.exerciseId': log.exerciseId } },
      { $unwind: '$logs' },
      { $match: { 'logs.exerciseId': log.exerciseId, 'logs.status': 'skipped' } },
      { $group: { _id: '$logs.reason', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    const count = skips.reduce((n, s) => n + s.count, 0)
    if (count >= 2) {
      const name = EXERCISES_BY_ID.get(log.exerciseId)?.name || session.exercises.find(e => e.exerciseId === log.exerciseId)?.name || 'this exercise'
      const usual = skips[0]._id || log.reason
      repeatSkipNudge = {
        exerciseId: log.exerciseId,
        name,
        reason: usual,
        count,
        message: `You've skipped ${name} ${count} times, mostly because ${SKIP_REASON_TEXT[usual] || 'of other reasons'}. Want me to swap it for something else?`,
      }
      break
    }
  }

  const week = await TrainingSession.find({ privyUserId, weekStart: session.weekStart }).lean()
  const summary = summarize(week)
  return {
    session: toSession(session),
    exercisesDone: session.logs.filter(l => l.status === 'done').length,
    exercisesTotal: session.exercises.length,
    durationMinutes,
    streakWeeks: await streakWeeks(privyUserId, today),
    sessionsThisWeek: { done: summary.sessionsDone, planned: summary.sessionsPlanned },
    repeatSkipNudge,
  }
}
