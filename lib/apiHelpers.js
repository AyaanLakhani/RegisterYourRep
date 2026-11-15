// lib/apiHelpers.js — all the helper functions from original index.js

import axios from 'axios'
import { buildUserMessage } from './workoutPrompt'
import { getGeminiConfig } from './geminiClient'
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

// The response schema makes Gemini return plain JSON, so there are no code
// fences to strip. Anything that doesn't parse is a failed generation.
function parseGeminiResponse(data) {
  const parts = data?.candidates?.[0]?.content?.parts || []
  // Gemini 2.5 can return "thought" parts; only the answer parts hold the plan.
  const text = parts.filter(p => !p.thought).map(p => p.text || '').join('').trim()
  if (!text) throw new Error('Empty Gemini response')
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Gemini response was not valid JSON')
  }
}

export async function generatePlanWithGemini(input) {
  const { endpoint, headers, systemInstruction, generationConfig } = getGeminiConfig()

  const body = {
    system_instruction: systemInstruction,        // ✅ static, separated out
    contents: [{
      role: 'user',
      parts: [{ text: buildUserMessage(input) }]  // ✅ only dynamic user data
    }],
    generationConfig,
  }

  const response = await axios.post(endpoint, body, { headers })
  const parsed = parseGeminiResponse(response.data)

  // RYR-6: only a plan that matches the schema is returned (and saved).
  const result = generatedPlanSchema({ frequency: input?.frequency }).safeParse(parsed)
  if (!result.success) {
    throw new Error(`Plan did not match the schema: ${describePlanIssues(result.error)}`)
  }
  return result.data
}
