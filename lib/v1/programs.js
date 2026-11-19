// lib/v1/programs.js
// Program versions and the active week's sessions (RYR-37, RYR-38), plus the
// mapping from stored documents to the contract's shapes.
import { ApiError } from '../apiHandler'
import { EXERCISES_BY_ID } from '../catalog'
import { ProfileVersion } from '../models'
import { Program, TrainingSession, TrainingWeek } from './models'
import { primaryMusclesOf, WEEKDAYS } from './vocab'
import { addDays, dateOfWeekday, mondayOf } from './dates'
import { blockWeek, deloadExercises, isDeloadWeek } from './templates'

const iso = d => (d ? new Date(d).toISOString() : undefined)
const clean = obj => JSON.parse(JSON.stringify(obj)) // drops undefined and Mongoose wrappers

// ---- Building program days ----

// Rough session length: ~45 s of work per set plus its rest, plus 5 minutes
// of warm-up. The same estimate the eval set (RYR-11) uses.
export function estimateMinutes(exercises) {
  const seconds = exercises.reduce((sum, e) => sum + e.sets * (45 + e.restSeconds), 0)
  return Math.max(1, Math.round(seconds / 60) + 5)
}

/** The contract muscles a day's exercises mainly train, most-trained first. */
export function focusOf(exercises) {
  const sets = new Map()
  for (const e of exercises) {
    for (const m of primaryMusclesOf(e.exerciseId)) sets.set(m, (sets.get(m) || 0) + e.sets)
  }
  return [...sets.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m)
}

/**
 * A ProgramDay from catalog ids. Names come from the catalog, never from the
 * model; focus and estimatedMinutes are computed here.
 */
export function buildDay({ weekday, name, exercises }) {
  const prescribed = exercises.map(e => {
    const catalog = EXERCISES_BY_ID.get(e.exerciseId)
    if (!catalog) throw new Error(`Unknown exercise id ${e.exerciseId}`)
    return clean({
      exerciseId: catalog.id,
      name: catalog.name,
      sets: e.sets,
      reps: e.reps,
      restSeconds: e.restSeconds,
      formCue: e.formCue || undefined,
      swappedFromId: e.swappedFromId,
    })
  })
  return { weekday, name, focus: focusOf(prescribed), estimatedMinutes: estimateMinutes(prescribed), exercises: prescribed }
}

export const sortDays = days => [...days].sort((a, b) => WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday))

// ---- Contract shapes ----

const toDay = d => clean({
  weekday: d.weekday,
  name: d.name,
  focus: d.focus,
  estimatedMinutes: d.estimatedMinutes,
  exercises: (d.exercises || []).map(e => ({
    exerciseId: e.exerciseId, name: e.name, sets: e.sets, reps: e.reps, restSeconds: e.restSeconds,
    formCue: e.formCue || undefined, swappedFromId: e.swappedFromId || undefined,
  })),
})

export function toProgram(doc) {
  return {
    id: String(doc._id),
    name: doc.name,
    version: doc.version,
    status: doc.status,
    createdAt: iso(doc.createdAt),
    note: doc.note || '',
    profileVersion: doc.profileVersion || 1,
    days: (doc.days || []).map(toDay),
  }
}

export function toVersionSummary(doc) {
  const { id, name, version, status, createdAt, note } = toProgram(doc)
  return { id, name, version, status, createdAt, note }
}

export function toSession(doc) {
  return clean({
    id: String(doc._id),
    programId: doc.programId,
    programVersion: doc.programVersion,
    date: doc.date,
    weekday: doc.weekday,
    status: doc.status,
    name: doc.name,
    focus: doc.focus || [],
    estimatedMinutes: doc.estimatedMinutes,
    exercises: (doc.exercises || []).map(e => toDay({ exercises: [e] }).exercises[0]),
    logs: (doc.logs || []).map(l => (l.status === 'done'
      ? { status: 'done', exerciseId: l.exerciseId, loggedAt: iso(l.loggedAt), sets: l.sets?.length ? l.sets.map(s => clean({ reps: s.reps, weightKg: s.weightKg })) : undefined }
      : { status: 'skipped', exerciseId: l.exerciseId, loggedAt: iso(l.loggedAt), reason: l.reason })),
    startedAt: iso(doc.startedAt),
    finishedAt: iso(doc.finishedAt),
    movedFrom: doc.movedFrom || undefined,
    deload: doc.deload || undefined,
  })
}

// ---- Program versions ----

export function currentProgram(privyUserId) {
  return Program.findOne({ privyUserId, status: 'current' }).sort({ version: -1 }).lean()
}

export async function requireCurrentProgram(privyUserId) {
  const program = await currentProgram(privyUserId)
  if (!program) throw new ApiError(404, 'No program yet. Finish onboarding to build one.')
  return program
}

/**
 * Appends a program version and archives the others. Two changes at once can
 * pick the same number; the unique index rejects one and it retries.
 */
export async function addProgramVersion(privyUserId, { days, note, name, profileVersion, blockStart, model, promptVersion, generatedAt }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const latest = await Program.findOne({ privyUserId }).sort({ version: -1 }).lean()
    try {
      const doc = await Program.create({
        privyUserId,
        version: (latest?.version ?? 0) + 1,
        status: 'current',
        name: name ?? latest?.name ?? 'My program',
        note,
        profileVersion: profileVersion ?? latest?.profileVersion ?? 1,
        blockStart: blockStart ?? latest?.blockStart,
        // Which model and prompt made the plan (RYR-10): a new plan sets them,
        // later versions of it keep them.
        model: model ?? latest?.model,
        promptVersion: promptVersion ?? latest?.promptVersion,
        generatedAt: generatedAt ?? latest?.generatedAt,
        days: sortDays(days),
      })
      await Program.updateMany({ privyUserId, _id: { $ne: doc._id }, status: 'current' }, { $set: { status: 'archived' } })
      return doc.toObject()
    } catch (err) {
      if (err?.code !== 11000) throw err
    }
  }
  throw new ApiError(409, 'Your program was being changed twice at once. Please try again.')
}

/**
 * Where an accepted plan's training block starts (RYR-27). A rebuilt plan at
 * the same level (new focus muscles, days, goals…) continues the current
 * block, so Progress and the month goal keep counting. The first plan, or one
 * at a new level, starts a fresh block today: a level-up resets the
 * "ready for the next level?" count.
 */
export async function blockStartFor(privyUserId, profileVersion, today) {
  const current = await currentProgram(privyUserId)
  if (!current?.blockStart) return today
  const profiles = await ProfileVersion.find({ privyUserId, version: { $in: [current.profileVersion, profileVersion] } })
    .select({ version: 1, level: 1 }).lean()
  const levelOf = v => profiles.find(p => p.version === v)?.level
  const before = levelOf(current.profileVersion)
  return before && before === levelOf(profileVersion) ? current.blockStart : today
}

// ---- The active week ----

/**
 * Where the week starting `monday` sits for this program (RYR-14): the
 * user's level and the week of the training block (1 = first).
 */
export async function weekContext(program, monday) {
  const profile = program.profileVersion
    ? await ProfileVersion.findOne({ privyUserId: program.privyUserId, version: program.profileVersion }).select({ level: 1 }).lean()
    : null
  return { level: profile?.level, week: blockWeek(program.blockStart, monday) }
}

/**
 * A program day as it's trained that week. Pro deload weeks (every 5th week
 * of a block) keep the exercises at about 60% of the sets.
 */
export function dayForWeek(day, ctx = {}) {
  if (!isDeloadWeek(ctx.level, ctx.week)) return day
  const exercises = deloadExercises(day.exercises, ctx.level)
  return { ...day, name: `${day.name} · Deload`, exercises, estimatedMinutes: estimateMinutes(exercises), deload: true }
}

function sessionFromDay(privyUserId, program, monday, planned, ctx) {
  const day = dayForWeek(planned, ctx)
  const date = dateOfWeekday(monday, day.weekday)
  return {
    privyUserId,
    weekStart: monday,
    programId: String(program._id),
    programVersion: program.version,
    date,
    weekday: day.weekday,
    status: 'scheduled',
    name: day.name,
    focus: day.focus,
    estimatedMinutes: day.estimatedMinutes,
    exercises: day.exercises,
    deload: day.deload || undefined,
    logs: [],
  }
}

async function insertSessions(docs) {
  if (!docs.length) return
  try {
    await TrainingSession.insertMany(docs, { ordered: false })
  } catch (err) {
    // A session already on that day (unique user + date) is fine: keep it.
    if (err?.code !== 11000 && !err?.writeErrors?.every(e => e.code === 11000)) throw err
  }
}

/**
 * After a new program version: brings the active week in line with it.
 * Upcoming sessions nobody has touched are replaced; started, finished,
 * moved and past sessions are left alone. Training days from today on that
 * have no session get one.
 */
export async function syncActiveWeek(privyUserId, program, today) {
  const monday = mondayOf(today)
  await TrainingWeek.updateOne(
    { privyUserId, startDate: monday },
    { $setOnInsert: { privyUserId, startDate: monday, programId: String(program._id), programVersion: program.version } },
    { upsert: true }
  )
  await TrainingWeek.updateOne({ privyUserId, startDate: monday }, { $set: { programId: String(program._id), programVersion: program.version } })
  await TrainingSession.deleteMany({
    privyUserId, weekStart: monday, status: 'scheduled', date: { $gte: today }, 'logs.0': { $exists: false }, startedAt: null,
  })
  const days = program.days.filter(d => dateOfWeekday(monday, d.weekday) >= today)
  const ctx = await weekContext(program, monday)
  await insertSessions(days.map(d => sessionFromDay(privyUserId, program, monday, d, ctx)))
}

/**
 * The stored week starting `monday`, creating the active week the first
 * time it's asked for (once per user and Monday: unique index). A new week
 * gets a session for every training day of the current program.
 * `prepare(program, monday)` runs once, when the week is created, and may
 * return a newer program version to use (intermediate accessory rotation).
 * Returns { week, sessions } or null for a week that isn't stored.
 */
export async function loadWeek(privyUserId, monday, today, { prepare } = {}) {
  let week = await TrainingWeek.findOne({ privyUserId, startDate: monday }).lean()
  if (!week && monday === mondayOf(today)) {
    let program = await currentProgram(privyUserId)
    if (!program) return null
    const result = await TrainingWeek.updateOne(
      { privyUserId, startDate: monday },
      { $setOnInsert: { privyUserId, startDate: monday, programId: String(program._id), programVersion: program.version } },
      { upsert: true }
    )
    if (result.upsertedCount) {
      const prepared = prepare ? await prepare(program, monday) : program
      if (prepared && prepared !== program) {
        program = prepared
        await TrainingWeek.updateOne({ privyUserId, startDate: monday }, { $set: { programId: String(program._id), programVersion: program.version } })
      }
      const ctx = await weekContext(program, monday)
      await insertSessions(program.days.map(d => sessionFromDay(privyUserId, program, monday, d, ctx)))
    }
    week = await TrainingWeek.findOne({ privyUserId, startDate: monday }).lean()
  }
  if (!week) return null
  const sessions = await TrainingSession.find({ privyUserId, weekStart: monday }).sort({ date: 1 }).lean()
  return { week, sessions }
}

export const weekEnd = monday => addDays(monday, 6)
