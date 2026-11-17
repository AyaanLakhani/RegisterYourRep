// lib/apiHelpers.js — all the helper functions from original index.js

import { buildUserMessage, PROMPT_VERSION } from './workoutPrompt'
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

// Token counts from Gemini's usageMetadata (RYR-10).
function readUsage(usage) {
  if (!usage) return null
  return {
    inputTokens: usage.promptTokenCount ?? 0,
    outputTokens: usage.candidatesTokenCount ?? 0,
    thinkingTokens: usage.thoughtsTokenCount ?? 0,
    totalTokens: usage.totalTokenCount ?? 0,
  }
}

/**
 * Generates one plan. Returns { plan, meta }. On failure the thrown error
 * carries the same `meta`, so failed calls can be logged too (RYR-10).
 * meta: { model, promptVersion, attempts, latencyMs, finishReason, usage }
 */
export async function generatePlanWithGemini(input, { deadline } = {}) {
  const { model, systemInstruction, generationConfig } = getGeminiConfig()
  const started = Date.now()
  const meta = { model, promptVersion: PROMPT_VERSION, attempts: 0, latencyMs: 0, finishReason: null, usage: null }

  try {
    const body = {
      system_instruction: systemInstruction,        // ✅ static, separated out
      contents: [{
        role: 'user',
        parts: [{ text: buildUserMessage(input) }]  // ✅ only dynamic user data
      }],
      generationConfig,
    }

    // RYR-7: timeout + retries, then a clear error for blocked or cut-off answers.
    const { data, attempts } = await postToGemini(body, { deadline })
    meta.attempts = attempts
    meta.usage = readUsage(data?.usageMetadata)
    meta.finishReason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || null
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
    meta.latencyMs = Date.now() - started
    return { plan: result.data, meta }
  } catch (err) {
    if (err?.attempts) meta.attempts = err.attempts
    meta.latencyMs = Date.now() - started
    if (err && typeof err === 'object') err.meta = meta
    throw err
  }
}
