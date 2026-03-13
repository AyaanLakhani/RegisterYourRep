// lib/geminiClient.js  ← NEW FILE, create this
import { WORKOUT_SYSTEM_INSTRUCTION } from './workoutPrompt'

// ✅ Built once at module load, reused on every request
const ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

function getEndpoint() {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-pro'
  return `${ENDPOINT_BASE}/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`
}

// Singleton endpoint + system config — constructed once
let _endpointCache = null
export function getGeminiConfig() {
  if (_endpointCache) return _endpointCache
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured')
  _endpointCache = {
    endpoint: getEndpoint(),
    systemInstruction: { parts: [{ text: WORKOUT_SYSTEM_INSTRUCTION }] },
    generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
  }
  return _endpointCache
}