// lib/workoutPrompt.js

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

// ✅ STATIC — build once, reuse forever
export const WORKOUT_SYSTEM_INSTRUCTION = `You are an expert strength and conditioning coach.
Create personalized workout plans that are effective and realistic.
If no experience level is given, assume beginner.

Output rules (very important):
- Return JSON ONLY. No markdown, no commentary, no backticks.
- Top-level shape: { "title": string, "summary": string, "days": Day[], "notes": string[] }
- Each Day: { "day": string, "focus": string[], "durationMinutes": number, "exercises": Exercise[] }
- Each Exercise: { "name": string, "sets": number, "reps": string, "restSeconds": number, "notes": string }
- "reps" can be a range like "8-10" or "AMRAP in 60s".
- "notes" should explain form or tempo in 1-2 sentences.`

// ✅ DYNAMIC — only user-specific data per call
export function buildUserMessage(input) {
  const level = normalizeLevel(input?.experienceLevel || input?.level || input?.fitnessLevel)
  return `User experience level: ${level.toUpperCase()}
${getLevelInstructions(level)}

User profile:
${JSON.stringify(input, null, 2)}`
}