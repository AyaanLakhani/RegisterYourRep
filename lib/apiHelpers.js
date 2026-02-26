// lib/apiHelpers.js — all the helper functions from original index.js

import axios from 'axios'
import { buildWorkoutPrompt } from './workoutPrompt'

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

function extractJsonObject(rawText) {
  if (!rawText || typeof rawText !== 'string') return null
  const cleaned = rawText.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  return cleaned.slice(start, end + 1)
}

function parseGeminiResponse(data) {
  const parts = data?.candidates?.[0]?.content?.parts || []
  const text = parts.map(p => p.text || '').join('\n').trim()
  if (!text) throw new Error('Empty Gemini response')
  try {
    return JSON.parse(text)
  } catch {
    const jsonSlice = extractJsonObject(text)
    if (!jsonSlice) throw new Error('Gemini response was not valid JSON')
    return JSON.parse(jsonSlice)
  }
}

export async function generatePlanWithGemini(input) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured')
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-pro'
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`
  const prompt = buildWorkoutPrompt(input)
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
  }
  const response = await axios.post(endpoint, body)
  const parsed = parseGeminiResponse(response.data)
  if (!parsed || !Array.isArray(parsed.days) || !parsed.days.length) {
    throw new Error('Plan must include at least one day')
  }
  return parsed
}
