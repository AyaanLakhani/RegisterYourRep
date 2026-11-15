// lib/apiHelpers.js — all the helper functions from original index.js

import { buildUserMessage } from './workoutPrompt'
import { getGeminiConfig, postToGemini, getResponseText, GenerationError } from './geminiClient'
import { generatedPlanSchema, describePlanIssues } from './planSchema'

export function normalizeMuscles(input) {
  if (!Array.isArray(input)) return []
  return input.filter(m => typeof m === 'string').map(m => m.trim()).filter(Boolean)
}

export function safeNumber(input) {
  const num = Number(input)
  return Number.isFinite(num) ? num : undefined
}

export function calculateCompletion(checked, totalCount) {
  const completedCount = checked.filter(Boolean).length
  const score = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  return { completedCount, score }
}

export function normalizeDayExercises(day) {
  const items = Array.isArray(day?.exercises) ? day.exercises : []
  return items
    .filter(ex => ex && typeof ex.name === 'string' && ex.name.trim())
    .map(ex => ({
      name: String(ex.name).trim(),
      sets: safeNumber(ex.sets),
      reps: ex.reps ? String(ex.reps).trim() : '',
      restSeconds: safeNumber(ex.restSeconds),
      notes: ex.notes ? String(ex.notes).trim() : '',
    }))
}

export async function generatePlanWithGemini(input, { deadline } = {}) {
  const { systemInstruction, generationConfig } = getGeminiConfig()

  const body = {
    system_instruction: systemInstruction,        // ✅ static, separated out
    contents: [{
      role: 'user',
      parts: [{ text: buildUserMessage(input) }]  // ✅ only dynamic user data
    }],
    generationConfig,
  }

  // RYR-7: timeout + retries, then a clear error for blocked or cut-off answers.
  const data = await postToGemini(body, { deadline })
  const text = getResponseText(data)

  // The response schema makes Gemini return plain JSON, so there are no code
  // fences to strip. Anything that doesn't parse is a failed generation.
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new GenerationError('Gemini response was not valid JSON')
  }

  // RYR-6: only a plan that matches the schema is returned (and saved).
  const result = generatedPlanSchema({ frequency: input?.frequency }).safeParse(parsed)
  if (!result.success) {
    throw new GenerationError(`Plan did not match the schema: ${describePlanIssues(result.error)}`)
  }
  return result.data
}
