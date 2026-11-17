// lib/v1/progress.js
// Progress stats (RYR-39), computed on the server from sessions and logs, and
// swap alternatives from the catalog. Plain counting, no AI.
import { EXERCISES_BY_ID } from '../catalog'
import { TrainingSession } from './models'
import { mondayOf } from './dates'
import { allowedExercises } from './generation'
import { currentProgram } from './programs'
import { latestProfile } from './profiles'
import { groupOfMuscle, primaryMusclesOf, toAppExercise } from './vocab'
import { streakWeeks } from './weeks'

const LEVEL_UP = { minSessions: 12, minCompletion: 85 }
const GROUPS = ['upper', 'lower', 'core']

// Sets per muscle and per group for a list of { exerciseId, sets }.
function tally(entries) {
  const muscles = new Map()
  const groups = new Map(GROUPS.map(g => [g, 0]))
  for (const { exerciseId, sets } of entries) {
    const ms = primaryMusclesOf(exerciseId)
    for (const m of ms) muscles.set(m, (muscles.get(m) || 0) + sets)
    for (const g of new Set(ms.map(groupOfMuscle))) groups.set(g, groups.get(g) + sets)
  }
  return { muscles, groups }
}

export async function getProgress(privyUserId, today) {
  const program = await currentProgram(privyUserId)
  if (!program) return null
  const profile = await latestProfile(privyUserId)

  // The current block: sessions from when the current plan was accepted up to today.
  const blockStart = program.blockStart || '0000-00-00'
  const block = await TrainingSession.find({ privyUserId, date: { $gte: blockStart, $lte: today } })
    .select({ status: 1 }).lean()
  const sessionsDone = block.filter(s => s.status === 'done').length
  const sessionsPlanned = block.length
  const completionPercent = sessionsPlanned ? Math.round((sessionsDone / sessionsPlanned) * 100) : 0

  // Muscle balance this week: sets logged as done vs sets planned.
  const week = await TrainingSession.find({ privyUserId, weekStart: mondayOf(today), status: { $ne: 'skipped' } }).lean()
  const target = tally(week.flatMap(s => s.exercises.map(e => ({ exerciseId: e.exerciseId, sets: e.sets || 0 }))))
  const actual = tally(week.flatMap(s => (s.logs || [])
    .filter(l => l.status === 'done')
    .map(l => ({
      exerciseId: l.exerciseId,
      sets: l.sets?.length || s.exercises.find(e => e.exerciseId === l.exerciseId)?.sets || 0,
    }))))

  const skipped = await TrainingSession.aggregate([
    { $match: { privyUserId, 'logs.status': 'skipped' } },
    { $unwind: '$logs' },
    { $match: { 'logs.status': 'skipped' } },
    { $group: { _id: { exerciseId: '$logs.exerciseId', reason: '$logs.reason' }, count: { $sum: 1 } } },
  ])
  const byExercise = new Map()
  for (const { _id, count } of skipped) {
    const entry = byExercise.get(_id.exerciseId) || { count: 0, reasons: [] }
    entry.count += count
    entry.reasons.push({ reason: _id.reason, count })
    byExercise.set(_id.exerciseId, entry)
  }
  const mostSkipped = [...byExercise.entries()]
    .map(([exerciseId, e]) => ({
      exerciseId,
      name: EXERCISES_BY_ID.get(exerciseId)?.name || exerciseId,
      count: e.count,
      usualReason: e.reasons.sort((a, b) => b.count - a.count)[0].reason,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    completionPercent,
    sessionsDone,
    sessionsPlanned,
    streakWeeks: await streakWeeks(privyUserId, today),
    muscleBalance: GROUPS.map(group => ({ group, actual: actual.groups.get(group), target: target.groups.get(group) })),
    muscleDetail: [...new Set([...target.muscles.keys(), ...actual.muscles.keys()])].map(muscle => ({
      muscle,
      group: groupOfMuscle(muscle),
      actual: actual.muscles.get(muscle) || 0,
      target: target.muscles.get(muscle) || 0,
    })),
    mostSkipped,
    levelUpReady: profile?.level !== 'pro' && sessionsDone >= LEVEL_UP.minSessions && completionPercent >= LEVEL_UP.minCompletion,
  }
}

/**
 * Swap options for an exercise: its catalog alternatives first, then other
 * exercises for the same main muscles and movement, limited to what the
 * user's equipment and level allow.
 */
export async function getAlternatives(privyUserId, exerciseId) {
  const exercise = EXERCISES_BY_ID.get(exerciseId)
  if (!exercise) return null
  const profile = await latestProfile(privyUserId)
  const allowed = profile ? allowedExercises(profile) : null
  const ok = new Set(allowed ? allowed.map(a => a.app.id) : EXERCISES_BY_ID.keys())

  const listed = [...exercise.easier, ...exercise.harder]
  const similar = [...EXERCISES_BY_ID.values()]
    .filter(e => e.movementPattern === exercise.movementPattern && e.primaryMuscles.some(m => exercise.primaryMuscles.includes(m)))
    .map(e => e.id)
  return [...new Set([...listed, ...similar])]
    .filter(id => id !== exerciseId && ok.has(id))
    .slice(0, 6)
    .map(id => toAppExercise(EXERCISES_BY_ID.get(id)))
}
