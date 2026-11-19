// lib/v1/templates.js
// Level templates (RYR-14, Questions & Decisions Nov 15). Code decides the
// structure of a program: the split, how many exercises each session has, and
// the sets, reps and rest for each exercise. The model only picks and orders
// exercises from a filtered catalog list and writes the form cues.
//
// Everything here is plain data and pure functions, so the eval set
// (evals/checks.mjs) can read the same numbers the generator uses.
import { EXERCISES_BY_ID } from '../catalog'
import { WEEKDAYS } from './vocab'
import { mondayOf } from './dates'

// ---- The three templates ----
// The session length the user picked decides how much goes in a session
// (fitSessionTime in lib/v1/generation.js); the template sets the limits.
//   exercises: exercises per session [min, max]. Short sessions get few,
//              long ones many; 45-60 minutes lands around 5-7.
//   sets:      sets per exercise [min, max]. `baseSets` is the starting point;
//              focus muscles get +1 (intermediate and pro), and long sessions
//              add sets up to max.
//   restCap:   longest rest [compound, isolation] in seconds, used to fill
//              long sessions once sets and exercises are at their max.
//   weeklySets: weekly hard sets per trained muscle (pro only), counted on
//              primary muscles, as the eval set does.
//   rotateEvery: (intermediate) accessories change every this many weeks
//              of a training block; compound lifts stay (lib/v1/rotation.js).
//   deloadEvery: (pro) every this many weeks of a block is a lighter week:
//              the same exercises at `deloadSetShare` of the sets.
//   restDays:  (pro) the recommended plan keeps at least this many rest days
//              a week, even when all seven were picked ("as asked" keeps them).
export const TEMPLATES = {
  beginner: {
    exercises: [3, 8],
    sets: [2, 4],
    baseSets: { compound: 3, isolation: 2 },
    restCap: [150, 90],
    focusExtraSets: 0,
    focusBySwaps: true,      // focus muscles get extra exercises (still common ones), not extra sets
    commonOnly: true,        // only "common" catalog exercises (plus ones they know)
    freeWeightCompound: false,
    weeklySets: null,
    guidance: 'Beginner. Simple, repeatable sessions: the same exercises every week so they learn them, progressing by reps first, then weight. Prefer machines and cables, plus basic dumbbell and bodyweight moves. Give each focus muscle one extra exercise across the week.',
  },
  intermediate: {
    exercises: [3, 10],
    sets: [3, 5],
    baseSets: { compound: 3, isolation: 3 },
    restCap: [180, 120],
    focusExtraSets: 1,
    commonOnly: false,
    freeWeightCompound: true, // at least one dumbbell or barbell compound per session, when possible
    weeklySets: null,
    rotateEvery: 5,           // the decision's "every 4-6 weeks"
    guidance: 'Intermediate. Build each session around one or two free-weight compound lifts, then machines, cables and accessories. Give the focus muscles extra exercises across the week.',
  },
  pro: {
    exercises: [3, 12],
    sets: [3, 6],
    baseSets: { compound: 4, isolation: 3 },
    restCap: [240, 120],
    focusExtraSets: 1,
    commonOnly: false,
    freeWeightCompound: true,
    weeklySets: [10, 20],
    deloadEvery: 5,           // weeks 5, 10, … of a block
    deloadSetShare: 0.6,
    restDays: 1,
    guidance: 'Advanced. A wide exercise choice with heavy compound lifts first, then targeted accessories. Give the focus muscles extra exercises across the week. They will tweak the plan themselves, so give a solid, balanced starting point.',
  },
}

export const templateFor = level => TEMPLATES[level] || TEMPLATES.beginner

// ---- Splits ----
// Day types and the catalog muscles (lib/validation.js MUSCLES) each one
// trains. Core fits every day.
export const DAY_TYPES = {
  full_body: { label: 'Full Body', muscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'core', 'full_body'] },
  upper: { label: 'Upper', muscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'core'] },
  lower: { label: 'Lower', muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'core'] },
  push: { label: 'Push', muscles: ['chest', 'shoulders', 'triceps', 'core'] },
  pull: { label: 'Pull', muscles: ['back', 'biceps', 'core'] },
  legs: { label: 'Legs', muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'core'] },
}
export const DAY_TYPE_IDS = Object.keys(DAY_TYPES)

// Muscles each day type should cover; told to the model as guidance.
const DAY_COVERS = {
  full_body: 'one squat or lunge, one hinge, one push, one pull',
  upper: 'one horizontal push, one horizontal pull, one vertical push or pull, then arms',
  lower: 'one squat or leg press, one hinge, then hamstrings, glutes or calves',
  push: 'chest press first, then shoulders and triceps',
  pull: 'one vertical pull, one horizontal pull, then rear delts or biceps',
  legs: 'one squat or leg press, one hinge, then hamstrings, glutes or calves',
}
export const dayCovers = type => DAY_COVERS[type]

// Split by number of training days. Beginners stay on full body or
// upper/lower; intermediate and pro use upper/lower and push/pull/legs.
const BEGINNER_SPLITS = {
  1: ['full_body'],
  2: ['full_body', 'full_body'],
  3: ['full_body', 'full_body', 'full_body'],
  4: ['upper', 'lower', 'upper', 'lower'],
  5: ['upper', 'lower', 'full_body', 'upper', 'lower'],
  6: ['upper', 'lower', 'upper', 'lower', 'upper', 'lower'],
  7: ['upper', 'lower', 'upper', 'lower', 'upper', 'lower', 'full_body'],
}
const SPLITS = {
  1: ['full_body'],
  2: ['full_body', 'full_body'],
  3: ['push', 'pull', 'legs'],
  4: ['upper', 'lower', 'upper', 'lower'],
  5: ['upper', 'lower', 'push', 'pull', 'legs'],
  6: ['push', 'pull', 'legs', 'push', 'pull', 'legs'],
  7: ['push', 'pull', 'legs', 'push', 'pull', 'legs', 'full_body'],
}

/** Day types for `count` training days at this level, in weekday order. */
export function splitFor(level, count) {
  const n = Math.min(7, Math.max(1, count))
  return (level === 'beginner' ? BEGINNER_SPLITS : SPLITS)[n]
}

/** Day names: "Full Body A", "Full Body B" when a type repeats, else the plain label. */
export function dayNames(types) {
  const total = types.reduce((m, t) => m.set(t, (m.get(t) || 0) + 1), new Map())
  const seen = new Map()
  return types.map(t => {
    const i = seen.get(t) || 0
    seen.set(t, i + 1)
    return total.get(t) > 1 ? `${DAY_TYPES[t].label} ${String.fromCharCode(65 + i)}` : DAY_TYPES[t].label
  })
}

// ---- Exercise classes ----
const COMPOUND_PATTERNS = new Set(['squat', 'hinge', 'lunge', 'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull', 'dip'])
const TIMED = new Set(['plank', 'side-plank', 'farmers-carry', 'suitcase-carry'])

export const isCompound = ex => COMPOUND_PATTERNS.has(ex.movementPattern)
export const isFreeWeightCompound = ex => isCompound(ex) && (ex.equipmentType === 'dumbbell' || ex.equipmentType === 'barbell')

/** Does a catalog exercise belong on this day type? (Its primary muscles overlap the day's.) */
export function fitsDay(ex, type) {
  const muscles = DAY_TYPES[type]?.muscles || []
  return ex.primaryMuscles.some(m => muscles.includes(m))
}

// ---- Reps and rest by goal ----
// The goal that sets the rep scheme when several are picked.
const GOAL_PRIORITY = ['get_stronger', 'build_muscle', 'lose_fat', 'endurance', 'general_fitness']
export function mainGoal(goals = []) {
  return GOAL_PRIORITY.find(g => goals.includes(g)) || 'general_fitness'
}

// [compound, isolation] reps and rest seconds, per goal and level.
const SCHEMES = {
  get_stronger: {
    beginner: { reps: ['8-10', '10-12'], rest: [120, 75] },
    intermediate: { reps: ['5-8', '8-12'], rest: [150, 75] },
    pro: { reps: ['3-6', '8-12'], rest: [180, 90] },
  },
  build_muscle: {
    beginner: { reps: ['8-12', '10-12'], rest: [90, 60] },
    intermediate: { reps: ['6-10', '10-12'], rest: [120, 75] },
    pro: { reps: ['6-10', '10-15'], rest: [120, 75] },
  },
  lose_fat: {
    beginner: { reps: ['10-12', '12-15'], rest: [60, 45] },
    intermediate: { reps: ['10-12', '12-15'], rest: [75, 45] },
    pro: { reps: ['8-12', '12-15'], rest: [75, 45] },
  },
  endurance: {
    beginner: { reps: ['12-15', '15-20'], rest: [60, 45] },
    intermediate: { reps: ['12-15', '15-20'], rest: [60, 45] },
    pro: { reps: ['12-15', '15-20'], rest: [60, 45] },
  },
  general_fitness: {
    beginner: { reps: ['8-12', '10-15'], rest: [90, 60] },
    intermediate: { reps: ['8-12', '10-15'], rest: [90, 60] },
    pro: { reps: ['6-10', '10-15'], rest: [90, 60] },
  },
}

/** Sets, reps and rest for one exercise, from the template (before focus and volume balancing). */
export function prescription(exerciseId, { level, goals }) {
  const ex = EXERCISES_BY_ID.get(exerciseId)
  const t = templateFor(level)
  const scheme = SCHEMES[mainGoal(goals)][TEMPLATES[level] ? level : 'beginner']
  const i = ex && isCompound(ex) ? 0 : 1
  const sets = i === 0 ? t.baseSets.compound : t.baseSets.isolation
  if (TIMED.has(exerciseId)) {
    const seconds = ex.movementPattern === 'carry' ? 40 : 30
    return { sets, reps: 'max', restSeconds: 60, cue: `Hold about ${seconds} seconds.` }
  }
  return { sets, reps: scheme.reps[i], restSeconds: scheme.rest[i], cue: '' }
}

// ---- Exercises per session ----
const SET_WORK_SECONDS = 45 // same estimate as lib/v1/programs.js estimateMinutes
const WARMUP_MINUTES = 5

/** Session length in minutes for prescribed exercises (the same estimate the app shows). */
export function sessionMinutesOf(exercises) {
  const seconds = exercises.reduce((sum, e) => sum + e.sets * (SET_WORK_SECONDS + e.restSeconds), 0)
  return Math.round(seconds / 60) + WARMUP_MINUTES
}

/**
 * How many exercises the model is asked for: the time left after warm-up
 * divided by the time an average exercise takes at its starting sets and
 * rest, inside the template's range. fitSessionTime then fine-tunes sets,
 * exercises and rest so each day lands on the asked length.
 */
export function exercisesPerSession({ level, goals, sessionMinutes }) {
  const t = templateFor(level)
  const scheme = SCHEMES[mainGoal(goals)][TEMPLATES[level] ? level : 'beginner']
  // Sized for one set above the starting sets: filling a session adds sets
  // before exercises, so beginners get fewer exercises done well.
  const avgSets = Math.min(t.sets[1], (t.baseSets.compound + t.baseSets.isolation) / 2 + 1)
  const avgRest = (scheme.rest[0] + scheme.rest[1]) / 2
  const perExercise = avgSets * (SET_WORK_SECONDS + avgRest)
  const fit = Math.round(((sessionMinutes || 45) - WARMUP_MINUTES) * 60 / perExercise)
  return Math.min(t.exercises[1], Math.max(t.exercises[0], fit))
}

// ---- Volume after the exercises are picked ----

/** Weekly sets per catalog primary muscle. */
export function weeklySets(days) {
  const sets = {}
  for (const day of days) {
    for (const e of day.exercises) {
      for (const m of EXERCISES_BY_ID.get(e.exerciseId)?.primaryMuscles || []) sets[m] = (sets[m] || 0) + e.sets
    }
  }
  return sets
}

/**
 * Applies the volume rules to picked days (mutates the exercises' sets):
 * 1. focus muscles get +focusExtraSets on their exercises
 * 2. pro: every trained muscle is moved inside weeklySets, set by set
 *    (`volumeScale` < 1 lowers the ceiling for users who struggle to finish)
 * All within the template's sets range. Session length is fitted afterwards
 * (fitSessionTime in lib/v1/generation.js).
 */
export function balanceVolume(days, { level, focusMuscles = [], volumeScale = 1 }) {
  const t = templateFor(level)
  const [minSets, maxSets] = t.sets
  const all = days.flatMap(d => d.exercises)
  const primaries = e => EXERCISES_BY_ID.get(e.exerciseId)?.primaryMuscles || []

  if (t.focusExtraSets && focusMuscles.length) {
    for (const e of all) {
      if (primaries(e).some(m => focusMuscles.includes(m))) e.sets = Math.min(maxSets, e.sets + t.focusExtraSets)
    }
  }

  if (t.weeklySets) {
    const [lo, hi] = weeklyRange(level, volumeScale)
    // Each pass moves one set; stops when nothing in range can still move.
    for (let guard = 0; guard < 300; guard++) {
      const sets = weeklySets(days)
      let moved = false
      // Too many: take a set from the exercise on this muscle that has the most.
      for (const m of Object.keys(sets).filter(m => sets[m] > hi)) {
        const pick = all.filter(e => primaries(e).includes(m) && e.sets > minSets).sort((a, b) => b.sets - a.sets)[0]
        if (pick) { pick.sets--; moved = true; break }
      }
      if (moved) continue
      // Too few: add a set where it doesn't push another muscle over the ceiling.
      for (const m of Object.keys(sets).filter(m => sets[m] < lo && m !== 'full_body')) {
        const pick = all
          .filter(e => primaries(e).includes(m) && e.sets < maxSets && primaries(e).every(p => p === m || (sets[p] || 0) < hi))
          .sort((a, b) => a.sets - b.sets)[0]
        if (pick) { pick.sets++; moved = true; break }
      }
      if (!moved) break
    }
  }

  return days
}

/** Pro weekly sets range [lo, hi] after the history scale (RYR-15); [0, Infinity] for other levels. */
export function weeklyRange(level, volumeScale = 1) {
  const t = templateFor(level)
  if (!t.weeklySets) return [0, Infinity]
  const [lo, hi] = t.weeklySets
  return [lo, Math.max(lo, Math.round(hi * volumeScale))]
}

/** Weekdays in week order. */
export const orderWeekdays = list => [...new Set(list)].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b))

// ---- Training cycles (RYR-14): rotation and deloads ----

/** Week of the training block the week starting `monday` is (1 = the first), or null without a block start. */
export function blockWeek(blockStart, monday) {
  if (!blockStart || !monday) return null
  const days = Math.round((Date.parse(`${mondayOf(monday)}T00:00:00Z`) - Date.parse(`${mondayOf(blockStart)}T00:00:00Z`)) / 86400000)
  return days < 0 ? null : Math.floor(days / 7) + 1
}

/** Pro: weeks 5, 10, … of a block are deload weeks. */
export function isDeloadWeek(level, week) {
  const every = TEMPLATES[level]?.deloadEvery
  return Boolean(every && week && week % every === 0)
}

/** Intermediate: weeks 6, 11, … of a block start with new accessories. */
export function isRotationWeek(level, week) {
  const every = TEMPLATES[level]?.rotateEvery
  return Boolean(every && week && week > 1 && (week - 1) % every === 0)
}

/** A deload week's exercises: the same ones at the template's share of the sets (at least 2). */
export function deloadExercises(exercises, level) {
  const share = templateFor(level).deloadSetShare || 1
  return exercises.map(e => ({ ...e, sets: Math.max(2, Math.round(e.sets * share)) }))
}
