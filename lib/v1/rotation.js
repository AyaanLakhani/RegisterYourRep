// lib/v1/rotation.js
// Intermediate accessory rotation (RYR-14, Questions & Decisions Nov 15:
// "rotate accessories every 4-6 weeks"). At the start of weeks 6, 11, … of a
// training block, every accessory (non-compound) exercise is swapped for
// another one that trains the same muscles, so the work stays fresh. Compound
// lifts stay, so progress on them carries on. The result is a new program
// version ("Week 6: new accessory exercises"), so Plan, the week and the
// version history all agree, and Ask Coach can still change it.
import { EXERCISES_BY_ID } from '../catalog'
import { ProfileVersion } from '../models'
import { allowedExercises } from './generation'
import { loadHistory, idsToAvoid } from './history'
import { addProgramVersion, buildDay, weekContext } from './programs'
import { isCompound, isRotationWeek, prescription } from './templates'

const sameMuscles = (a, b) => a.primaryMuscles.length === b.primaryMuscles.length &&
  a.primaryMuscles.every(m => b.primaryMuscles.includes(m))

/**
 * Program days with each accessory swapped for an allowed, unused exercise on
 * the same muscles (the user's familiar and common ones first). Exercises with
 * no such alternative stay. Returns { days, swapped }.
 */
export function rotateDays(days, { allowed, avoided = new Set(), familiar = new Set(), level, goals }) {
  const used = new Set(days.flatMap(d => d.exercises.map(e => e.exerciseId)))
  const score = ex => (familiar.has(ex.id) ? 2 : 0) + (ex.common ? 1 : 0)
  let swapped = 0
  const rotated = days.map(day => buildDay({
    weekday: day.weekday,
    name: day.name,
    exercises: day.exercises.map(e => {
      const current = EXERCISES_BY_ID.get(e.exerciseId)
      if (!current || isCompound(current)) return e
      const next = allowed
        .filter(ex => !isCompound(ex) && !used.has(ex.id) && !avoided.has(ex.id) && sameMuscles(ex, current))
        .sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))[0]
      if (!next) return e
      used.add(next.id)
      swapped++
      return { exerciseId: next.id, sets: e.sets, reps: e.reps, restSeconds: e.restSeconds, formCue: prescription(next.id, { level, goals }).cue || undefined }
    }),
  }))
  return { days: rotated, swapped }
}

/**
 * Called once when a new active week is created (loadWeek's `prepare`).
 * Returns the program to use for that week: a new version with rotated
 * accessories on a rotation week, otherwise `program` unchanged.
 */
export async function rotateAccessories(privyUserId, program, monday) {
  const ctx = await weekContext(program, monday)
  if (!isRotationWeek(ctx.level, ctx.week)) return program
  const profile = await ProfileVersion.findOne({ privyUserId, version: program.profileVersion }).lean()
  if (!profile) return program
  const allowed = allowedExercises(profile).map(a => a.catalog)
  let history = null
  try {
    history = await loadHistory(privyUserId)
  } catch (err) {
    console.error('Rotation: could not load history', err?.message)
  }
  const { days, swapped } = rotateDays(program.days, {
    allowed,
    avoided: idsToAvoid(history, allowed),
    familiar: new Set(profile.familiarExerciseIds || []),
    level: profile.level,
    goals: profile.goals,
  })
  if (!swapped) return program
  return addProgramVersion(privyUserId, { days, note: `Week ${ctx.week}: new accessory exercises` })
}
