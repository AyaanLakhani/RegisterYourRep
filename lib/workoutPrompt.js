// lib/workoutPrompt.js
import { EQUIPMENT, GYM_TYPES, EXERCISES_BY_ID } from './catalog'
import { GOALS, TRAINING_HISTORY, INJURY_AREAS } from './intake'

function normalizeLevel(rawLevel) {
  if (!rawLevel) return 'beginner'
  const s = String(rawLevel).toLowerCase()
  if (s.startsWith('beg')) return 'beginner'
  if (s.startsWith('int')) return 'intermediate'
  if (s.startsWith('pro') || s.startsWith('adv')) return 'professional'
  return 'beginner'
}

function getLevelInstructions(level) {
  switch (level) {
    case 'beginner': return `
The user is a BEGINNER.
Guidelines:
- Focus on learning basic movement patterns.
- Lower volume and intensity, higher focus on form.
- Keep exercises per session low (5-6), sets (2-3), reps (8-10).
- Repeat same exercises across the week, change order/rep scheme.
- Use mostly machines (unless they mention they don't have certain machines) and simple dumbbell/barbell work.
- Don't include advanced free-weight exercises or workouts, and mostly used cabled exercises. Dumbell or barbell bicep-curls are fine`
    case 'intermediate': return `
The user is INTERMEDIATE.
Guidelines:
- Looking to build muscle and strength with more variety and structure.
- Include a mix of free weights and compound movements plus machines.
- Keep exercises per session moderate (6-8), sets (3-4), reps (8-12).
- Total weekly volume higher than beginner but not too high.`
    case 'professional': return `
The user is ADVANCED/PROFESSIONAL.
Guidelines:
- Optimal muscle growth and strength gains with higher volume/intensity.
- Focused splits per muscle group across the week.
- Exercises per session (8-12), sets (4-5), reps 6-12 hypertrophy / 1-5 strength.
- Use advanced methods like tempo, supersets, RPE where appropriate.
- Emphasize progression, deloads, and recovery.`
    default: return ''
  }
}

// Bump on every change to the system instruction or the user message, so each
// plan and generation log says which prompt made it (RYR-10). RYR-9 owns the
// wider prompt-versioning work; this is the value it builds on.
export const PROMPT_VERSION = '2026-11-15.2' // .2: intake section (RYR-12)

// ✅ STATIC — build once, reuse forever
export const WORKOUT_SYSTEM_INSTRUCTION = `You are an expert strength and conditioning coach.
Create personalized workout plans that are effective and realistic.
If no experience level is given, assume beginner.

Output rules (very important):
- Return JSON ONLY. No markdown, no commentary, no backticks.
- Top-level shape: { "title": string, "summary": string, "days": Day[], "notes": string[] }
- Each Day: { "day": string, "focus": string[], "durationMinutes": number, "exercises": Exercise[] }
- Each Exercise: { "name": string, "sets": number, "reps": string, "restSeconds": number, "notes": string }
- "sets" is a whole number from 1 to 10. "restSeconds" is a whole number from 0 to 600.
- Each day has 1 to 15 exercises.
- "reps" can be a range like "8-10" or "AMRAP in 60s".
- "notes" should explain form or tempo in 1-2 sentences.`

// The intake answers (RYR-12) as plain sentences. Ids are turned into the
// catalog's labels and names, so the model sees "Lat pulldown machine", not ids.
function buildSetupSection(input) {
  const lines = []
  if (Array.isArray(input?.equipment)) {
    const labels = input.equipment.map(id => EQUIPMENT[id]).filter(Boolean)
    lines.push(`Available equipment: ${labels.length ? labels.join(', ') : 'none'} (bodyweight exercises are always possible).`)
    lines.push('Only use exercises that need nothing beyond this equipment.')
  }
  if (input?.gymType && GYM_TYPES[input.gymType]) lines.push(`Trains at: ${GYM_TYPES[input.gymType]}.`)
  if (input?.goal && GOALS[input.goal]) lines.push(`Main goal: ${GOALS[input.goal]}.`)
  if (input?.trainingHistory && TRAINING_HISTORY[input.trainingHistory]) {
    lines.push(`Has trained consistently for: ${TRAINING_HISTORY[input.trainingHistory]}.`)
  }
  const injuries = (input?.injuries || []).map(id => INJURY_AREAS[id]).filter(Boolean)
  if (injuries.length || input?.injuryNotes) {
    const areas = injuries.length ? injuries.join(', ') : 'see note'
    lines.push(`Injuries or limitations: ${areas}. Avoid exercises that load these areas, or pick gentler alternatives.`)
    if (input?.injuryNotes) lines.push(`Injury note from the user: ${JSON.stringify(input.injuryNotes)}`)
  }
  if (Array.isArray(input?.familiarExercises)) {
    const names = input.familiarExercises.map(id => EXERCISES_BY_ID.get(id)?.name).filter(Boolean)
    lines.push(names.length
      ? `Exercises they are comfortable doing: ${names.join(', ')}. Harder exercises not on this list are new to them.`
      : 'They did not tick any exercises as familiar, so avoid technical free-weight lifts.')
  }
  return lines.length ? `\nTraining setup:\n${lines.map(l => `- ${l}`).join('\n')}\n` : ''
}

// ✅ DYNAMIC — only user-specific data per call
export function buildUserMessage(input) {
  const level = normalizeLevel(input?.experienceLevel || input?.level || input?.fitnessLevel)
  const frequency = Number.isInteger(input?.frequency) && input.frequency > 0 ? input.frequency : null
  // The plan is rejected unless it has exactly this many days (RYR-6).
  const dayRule = frequency
    ? `\nCreate exactly ${frequency} training day${frequency === 1 ? '' : 's'} (one entry in "days" per training day).\n`
    : ''
  const profile = {
    fitnessLevel: input?.fitnessLevel,
    targetMuscles: input?.targetMuscles,
    frequency: input?.frequency,
    sessionDuration: input?.sessionDuration,
    preferences: input?.preferences,
  }
  return `User experience level: ${level.toUpperCase()}
${getLevelInstructions(level)}
${dayRule}${buildSetupSection(input)}
User profile:
${JSON.stringify(profile, null, 2)}`
}
