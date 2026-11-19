// evals/v1.mjs
// The eval personas for the app's plan builder (lib/v1/generation.js, behind
// /api/v1; `--generator app`, the default). Personas are written in the
// website's vocabulary, so they're translated into an app profile here, and
// the "recommended" option is turned back into the plan shape the checks read.
import { EQUIPMENT_IDS, EXERCISES_BY_ID } from '@/lib/catalog'
import { INJURY_AREAS } from '@/lib/intake'
import { toAppEquipment } from '@/lib/v1/vocab'

const LEVEL = { beginner: 'beginner', intermediate: 'intermediate', professional: 'pro', unsure: 'beginner' }
const GYM = { home: 'home', apartment: 'apartment_gym', community: 'community_center', commercial: 'commercial_gym' }
const HISTORY = { under_6_months: 'under_6_months', '6_to_24_months': 'six_months_to_2_years', over_2_years: 'over_2_years' }
// Training days for a weekly frequency, spread across the week.
const DAYS = {
  1: ['mon'],
  2: ['mon', 'thu'],
  3: ['mon', 'wed', 'fri'],
  4: ['mon', 'tue', 'thu', 'fri'],
  5: ['mon', 'tue', 'wed', 'fri', 'sat'],
  6: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  7: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
}

// Persona target muscles (catalog ids) -> onboarding focus groups, as the app saves them.
const FOCUS_GROUP = { quadriceps: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs' }
export function toFocusGroups(targetMuscles = []) {
  const groups = [...new Set(targetMuscles.map(m => FOCUS_GROUP[m] || m))]
  if (!groups.length || groups.includes('full_body')) return ['full_body']
  return groups.slice(0, 3)
}

/** v1 level name for a persona's fitnessLevel. */
export const v1Level = fitnessLevel => LEVEL[fitnessLevel] || 'beginner'

/**
 * A persona as an app ProfileVersion. `equipment` must already be resolved
 * (preset or override); `appEquipment` (the app's coarse list, set by the
 * runner) is used when present.
 */
export function personaToProfile(persona) {
  const equipment = persona.appEquipment ||
    [...new Set((persona.equipment || []).filter(e => EQUIPMENT_IDS.includes(e)).map(toAppEquipment))]
  const injuries = (persona.injuries || []).map(id => INJURY_AREAS[id]).filter(Boolean)
  const limitations = [
    injuries.length ? `Injuries: ${injuries.join(', ')}.` : '',
    persona.injuryNotes || '',
    persona.preferences || '',
  ].filter(Boolean).join(' ')
  return {
    version: 1,
    level: v1Level(persona.fitnessLevel),
    goals: [persona.goal || 'general_fitness'],
    trainingDays: DAYS[Math.min(7, Math.max(1, persona.frequency || 3))],
    sessionMinutes: Math.max(15, persona.sessionDuration || 45),
    gymType: GYM[persona.gymType] || 'commercial_gym',
    equipment: [...new Set([...equipment, 'bodyweight'])],
    trainingHistory: HISTORY[persona.trainingHistory] || 'under_6_months',
    familiarExerciseIds: (persona.familiarExercises || []).filter(id => EXERCISES_BY_ID.has(id)),
    limitations,
    focusMuscles: toFocusGroups(persona.targetMuscles),
  }
}

/** A proposal option as the plan shape evals/checks.mjs reads (catalog ids kept for exact matching). */
export function optionToPlan(option, coachNote = '') {
  return {
    title: option.name,
    summary: option.summary,
    days: option.days.map(d => ({
      day: d.name,
      focus: d.focus,
      durationMinutes: Math.max(5, d.estimatedMinutes),
      exercises: d.exercises.map(e => ({
        exerciseId: e.exerciseId, name: e.name, sets: e.sets, reps: e.reps, restSeconds: e.restSeconds, notes: e.formCue || '',
      })),
    })),
    notes: coachNote ? [coachNote.slice(0, 300)] : [],
  }
}
