// lib/geminiClient.js
import axios from 'axios'
import { WORKOUT_SYSTEM_INSTRUCTION } from './workoutPrompt'
import { GEMINI_PLAN_SCHEMA } from './planSchema'

// ✅ Built once at module load, reused on every request
const ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

// Caps Gemini 2.5's hidden "thinking", which is most of a slow Pro call.
// Only sent to 2.5 models (other models may not accept the field).
export function thinkingConfig(budgetTokens) {
  return /^gemini-2\.5/.test(getModelName()) ? { thinkingConfig: { thinkingBudget: budgetTokens } } : {}
}

export function getModelName() {
  return process.env.GEMINI_MODEL || 'gemini-2.5-pro'
}

function getEndpoint() {
  // The API key is sent in the x-goog-api-key header, never in the URL,
  // so it can't leak through logged request URLs (RYR-2).
  return `${ENDPOINT_BASE}/${getModelName()}:generateContent`
}

// Singleton endpoint + system config — constructed once
let _endpointCache = null
export function getGeminiConfig() {
  if (_endpointCache) return _endpointCache
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured')
  _endpointCache = {
    endpoint: getEndpoint(),
    model: getModelName(),
    headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY },
    systemInstruction: { parts: [{ text: WORKOUT_SYSTEM_INSTRUCTION }] },
    generationConfig: {
      temperature: 0.4,
      responseMimeType: 'application/json',
      // Gemini must return this shape (RYR-6). The result is still checked with zod.
      responseSchema: GEMINI_PLAN_SCHEMA,
    },
  }
  return _endpointCache
}

// ---------------------------------------------------------------------------
// Calling Gemini: timeout, retries and finishReason handling (RYR-7)
// ---------------------------------------------------------------------------

// Total time for one generation, retries included. It has to fit inside the
// generate route's maxDuration, with room left to save the result.
export const GEMINI_BUDGET_MS = 50 * 1000
const MAX_RETRIES = 2
// Don't start another attempt with less time than this left; a plan takes
// gemini-2.5-pro well over a few seconds.
const MIN_ATTEMPT_MS = 15 * 1000
const BACKOFF_BASE_MS = 1000
const BACKOFF_MAX_MS = 8000

export const GENERATION_FAILED = 'Failed to generate workout plan'
const MESSAGES = {
  blocked: "We couldn't create a plan from these preferences. Try rewording them and generate again.",
  tooLong: 'The generated plan came out too long. Please try again.',
  timeout: 'Generating the plan took too long. Please try again.',
  busy: 'The AI service is busy right now. Please try again in a few minutes.',
}

// A failed generation. `message` is for server logs and holds no user input
// or secrets; `userMessage` is what the dashboard shows.
export class GenerationError extends Error {
  constructor(message, userMessage = GENERATION_FAILED, { attempts } = {}) {
    super(message)
    this.name = 'GenerationError'
    this.userMessage = userMessage
    this.attempts = attempts // HTTP attempts made, when known (RYR-10)
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const NETWORK_ERRORS = new Set(['ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT'])

function isTimeout(err) {
  return err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || err.code === 'ERR_CANCELED'
}

// 429, 5xx and dropped connections are worth retrying. Other 4xx are not.
function isRetryable(err) {
  const status = err.response?.status
  if (status) return status === 429 || status >= 500
  return NETWORK_ERRORS.has(err.code)
}

function backoffMs(attempt, err) {
  const retryAfter = Number(err.response?.headers?.['retry-after'])
  const base = Number.isFinite(retryAfter) && retryAfter > 0
    ? retryAfter * 1000
    : BACKOFF_BASE_MS * 2 ** attempt
  // Full jitter, so retries from several users don't line up.
  return Math.min(base, BACKOFF_MAX_MS) * (0.5 + Math.random() / 2)
}

// Short description of an axios error for logs. Never log the error object:
// its config holds the request headers, including the API key (RYR-2).
function describeHttpError(err) {
  return `${err.response?.status ?? err.code ?? '-'} ${err.message}`
}

// POST to Gemini, retrying temporary failures until `deadline` (ms timestamp).
// Returns { data, attempts }.
export async function postToGemini(body, { deadline = Date.now() + GEMINI_BUDGET_MS } = {}) {
  const { endpoint, headers } = getGeminiConfig()

  for (let attempt = 0; ; attempt++) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) throw new GenerationError('Gemini budget used up before the call', MESSAGES.timeout, { attempts: attempt })
    try {
      const response = await axios.post(endpoint, body, { headers, timeout: remaining })
      return { data: response.data, attempts: attempt + 1 }
    } catch (err) {
      if (isTimeout(err)) {
        throw new GenerationError(`Gemini call timed out (attempt ${attempt + 1})`, MESSAGES.timeout, { attempts: attempt + 1 })
      }
      const delay = backoffMs(attempt, err)
      const canRetry = isRetryable(err) && attempt < MAX_RETRIES &&
        deadline - Date.now() - delay >= MIN_ATTEMPT_MS
      if (!canRetry) {
        const userMessage = err.response?.status === 429 || err.response?.status === 503 ? MESSAGES.busy : GENERATION_FAILED
        throw new GenerationError(`Gemini call failed (attempt ${attempt + 1}): ${describeHttpError(err)}`, userMessage, { attempts: attempt + 1 })
      }
      console.warn(`Gemini call failed, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}):`, describeHttpError(err))
      await sleep(delay)
    }
  }
}

const BLOCKED_FINISH_REASONS = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'IMAGE_SAFETY'])

// The answer text of a Gemini response, or a GenerationError saying why there
// isn't one (blocked prompt, safety stop, cut off by MAX_TOKENS, ...).
export function getResponseText(data) {
  const blockReason = data?.promptFeedback?.blockReason
  if (blockReason) throw new GenerationError(`Gemini blocked the prompt: ${blockReason}`, MESSAGES.blocked)

  const candidate = data?.candidates?.[0]
  if (!candidate) throw new GenerationError('Gemini returned no candidates')

  const reason = candidate.finishReason
  if (BLOCKED_FINISH_REASONS.has(reason)) {
    throw new GenerationError(`Gemini stopped the response: ${reason}`, MESSAGES.blocked)
  }
  if (reason === 'MAX_TOKENS') throw new GenerationError('Gemini response cut off: MAX_TOKENS', MESSAGES.tooLong)
  if (reason && reason !== 'STOP') throw new GenerationError(`Gemini response ended early: ${reason}`)

  // Gemini 2.5 can return "thought" parts; only the answer parts hold the plan.
  const parts = candidate.content?.parts || []
  const text = parts.filter(p => !p.thought).map(p => p.text || '').join('').trim()
  if (!text) throw new GenerationError('Empty Gemini response')
  return text
}
