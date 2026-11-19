// lib/v1/weeks.js
// Weeks, today, the monthly goal and streaks (RYR-38), computed from stored
// sessions. Mirrors the behaviour of the app's mock data source.
import { TrainingSession } from './models'
import { addDays, dateOfWeekday, mondayOf, monthOf, weekdayOf } from './dates'
import { currentProgram, dayForWeek, loadWeek, toSession, weekContext, weekEnd } from './programs'
import { rotateAccessories } from './rotation'
import { WEEKDAYS } from './vocab'

const OPEN = ['scheduled', 'moved', 'carried_over'] // still to do

export function summarize(sessions) {
  const finished = sessions.filter(s => s.status === 'done')
  const logs = finished.flatMap(s => s.logs || [])
  const minutes = finished.reduce((sum, s) => {
    if (s.startedAt && s.finishedAt) return sum + Math.round((new Date(s.finishedAt) - new Date(s.startedAt)) / 60000)
    return sum + (s.estimatedMinutes || 0)
  }, 0)
  return {
    sessionsDone: finished.length,
    sessionsPlanned: sessions.filter(s => s.status !== 'skipped').length,
    exercisesDone: logs.filter(l => l.status === 'done').length,
    exercisesSkipped: logs.filter(l => l.status === 'skipped').length,
    musclesHit: [...new Set(finished.flatMap(s => s.focus || []))],
    minutes: Math.max(0, minutes),
  }
}

// Future weeks aren't stored: their sessions are projected from the current
// program, with ids "planned-YYYY-MM-DD" (read-only, see getSessionById).
export function projectedSession(program, date, ctx) {
  const planned = program.days.find(d => d.weekday === weekdayOf(date))
  if (!planned) return null
  const day = dayForWeek(planned, ctx) // pro deload weeks show as such ahead of time
  return {
    _id: `planned-${date}`,
    programId: String(program._id),
    programVersion: program.version,
    date,
    weekday: day.weekday,
    status: 'scheduled',
    name: day.name,
    focus: day.focus,
    estimatedMinutes: day.estimatedMinutes,
    exercises: day.exercises,
    deload: day.deload,
    logs: [],
  }
}

function weekShape(monday, isActive, program, sessions, id) {
  const shaped = sessions.map(toSession)
  return {
    id,
    startDate: monday,
    endDate: weekEnd(monday),
    isActive,
    programId: String(program._id),
    programVersion: program.version,
    sessions: shaped,
    summary: summarize(sessions),
  }
}

/**
 * The contract's Week starting at `monday` (any day snaps to its Monday).
 * Returns null when the user has no program yet.
 */
export async function getWeek(privyUserId, day, today) {
  const monday = mondayOf(day)
  const activeMonday = mondayOf(today)
  const program = await currentProgram(privyUserId)
  if (!program) return null

  // A new week may bring new accessories first (intermediate, every 5 weeks of a block).
  const stored = await loadWeek(privyUserId, monday, today, { prepare: (p, m) => rotateAccessories(privyUserId, p, m) })
  if (stored) {
    return weekShape(monday, monday === activeMonday, { _id: stored.week.programId || program._id, version: stored.week.programVersion || program.version },
      stored.sessions, String(stored.week._id))
  }
  // Future weeks: what the current program plans. Past weeks never stored:
  // nothing happened in the app that week.
  const ctx = monday > activeMonday ? await weekContext(program, monday) : null
  const sessions = monday > activeMonday
    ? WEEKDAYS.map(w => projectedSession(program, dateOfWeekday(monday, w), ctx)).filter(Boolean)
    : []
  return weekShape(monday, false, program, sessions, `week-${monday}`)
}

/** Weeks in a row with at least one finished session, up to this week (or last week if this one has none yet). */
export async function streakWeeks(privyUserId, today) {
  const done = await TrainingSession.distinct('weekStart', { privyUserId, status: 'done' })
  const weeks = new Set(done)
  let monday = mondayOf(today)
  if (!weeks.has(monday)) monday = addDays(monday, -7)
  let streak = 0
  while (weeks.has(monday)) {
    streak++
    monday = addDays(monday, -7)
  }
  return streak
}

// Which day types a session counts toward on Home's monthly goal card, from
// the muscles it focuses on. A session can count toward several types.
const TYPE_MUSCLES = {
  Push: ['chest', 'shoulders', 'triceps'],
  Pull: ['back', 'biceps', 'forearms'],
  Legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  Core: ['abs', 'obliques', 'lower_back'],
}
const typesOf = focus => Object.keys(TYPE_MUSCLES).filter(t => (focus || []).some(m => TYPE_MUSCLES[t].includes(m)))

/** Home's monthly goal: sessions done against what the program plans for the month (from the block start). */
export async function monthGoal(privyUserId, program, today) {
  const { first, days } = monthOf(today)
  const from = program.blockStart && program.blockStart > first ? program.blockStart : first
  const last = addDays(first, days - 1)

  const planned = []
  for (let d = from; d <= last; d = addDays(d, 1)) {
    const day = program.days.find(x => x.weekday === weekdayOf(d))
    if (day) planned.push({ date: d, focus: day.focus })
  }
  const done = await TrainingSession.find({ privyUserId, status: 'done', date: { $gte: first, $lte: last } })
    .select({ focus: 1 }).lean()

  return {
    month: first,
    sessionsDone: done.length,
    sessionsGoal: planned.length,
    sessionsExpectedByToday: planned.filter(p => p.date <= today).length,
    byType: Object.keys(TYPE_MUSCLES)
      .map(type => ({
        type,
        done: done.filter(s => typesOf(s.focus).includes(type)).length,
        goal: planned.filter(p => typesOf(p.focus).includes(type)).length,
      }))
      .filter(t => t.goal > 0 || t.done > 0),
  }
}

/** The contract's Today, or null without a program. */
export async function getToday(privyUserId, today) {
  const week = await getWeek(privyUserId, today, today)
  if (!week) return null
  const program = await currentProgram(privyUserId)
  const lastMonday = addDays(mondayOf(today), -7)
  const missed = await TrainingSession.countDocuments({ privyUserId, weekStart: lastMonday, status: { $in: OPEN } })
  return {
    date: today,
    session: week.sessions.find(s => s.date === today) ?? null,
    week,
    monthGoal: await monthGoal(privyUserId, program, today),
    ...(missed > 0 ? { lastWeekMissedSessions: missed } : {}),
  }
}
