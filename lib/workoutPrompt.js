// lib/workoutPrompt.js — identical logic to original, ES module export

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
- Use mostly machines and simple dumbbell/barbell work.
- Include a brief cool-down and stretching routine.
`
    case 'intermediate': return `
The user is INTERMEDIATE.
Guidelines:
- Looking to build muscle and strength with more variety and structure.
- Include more free weights and compound movements plus machines.
- Keep exercises per session moderate (6-8), sets (3-4), reps (8-12).
- Total weekly volume higher than beginner but not too high.
`
    case 'professional': return `
The user is ADVANCED/PROFESSIONAL.
Guidelines:
- Optimal muscle growth and strength gains with higher volume/intensity.
- Focused splits per muscle group across the week.
- Exercises per session (8-12), sets (4-5), reps 6-12 hypertrophy / 1-5 strength.
- Use advanced methods like tempo, supersets, RPE where appropriate.
- Emphasize progression, deloads, and recovery.
`
    default: return ''
  }
}

export function buildWorkoutPrompt(input) {
  const level = normalizeLevel(input?.experienceLevel || input?.level || input?.fitnessLevel)
  const levelBlock = getLevelInstructions(level)

  return [
    'You are an expert strength and conditioning coach.',
    'Create a personalized workout plan for this user.',
    'Follow the user preferences and constraints but keep the plan effective and realistic.',
    'If no experience level is given, assume beginner.',
    `User experience level (normalized): ${level.toUpperCase()}.`,
    levelBlock,
    '',
    'Output rules (very important):',
    '- Return JSON ONLY. No markdown, no commentary, no backticks.',
    '- Use this exact top-level shape:',
    '{ "title": string, "summary": string, "days": Day[], "notes": string[] }',
    '',
    'Day rules:',
    '- Each Day: { "day": string, "focus": string[], "durationMinutes": number, "exercises": Exercise[] }',
    '- `day` is a label like "Day 1" or "Monday Push".',
    '',
    'Exercise rules:',
    '- Each Exercise: { "name": string, "sets": number, "reps": string, "restSeconds": number, "notes": string }',
    '- `reps` can be a range like "8-10" or "AMRAP in 60s".',
    '- `notes` should explain form or tempo in 1-2 sentences.',
    '',
    'General constraints:',
    '- The plan must be realistic for the given level.',
    '- Total weekly volume and frequency must match the level block above.',
    '',
    'User profile (JSON):',
    JSON.stringify(input, null, 2),
  ].join('\n')
}
