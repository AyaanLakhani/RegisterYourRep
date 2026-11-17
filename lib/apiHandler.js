// lib/apiHandler.js
// Shared wrapper for protected API routes (RYR-3).
//
// Every protected route goes through withAuth, which:
//   1. rejects methods the route doesn't handle (405)
//   2. requires a logged-in user (401): a Privy access token in an
//      `Authorization: Bearer` header (the mobile app, RYR-34) or, without
//      that header, the iron-session cookie (the website)
//   3. rejects malformed ObjectId route params (404)
//   4. connects to MongoDB inside error handling (503 on failure)
//   5. turns any thrown error into `{ error: string }` with no internal details
//
// Usage:
//   export default withAuth({
//     GET: async (req, res, { privyUserId }) => { ... },
//     DELETE: async (req, res, { privyUserId }) => { ... },
//   }, {
//     idParams: ['id'],
//     errors: { GET: 'Failed to fetch X', DELETE: 'Failed to delete X' },
//     schemas: { POST: { body: zodSchema, query: zodSchema } },  // see lib/validation.js
//   })
//
// Validated body replaces req.body; validated query is on req.validatedQuery.
import mongoose from 'mongoose'
import { getSession } from './session'
import { connectDB } from './mongoose'
import { verifyPrivyToken } from './privy'
import { User } from './models'

/** Throw from a handler to send a specific status and client-safe message. */
export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** True if `value` is a string that Mongoose can use as an ObjectId. */
export function isValidId(value) {
  return typeof value === 'string' && mongoose.isValidObjectId(value)
}

// The token from an `Authorization: Bearer <token>` header, '' for a Bearer
// header with no token, or null when there's no Bearer header at all.
function bearerToken(req) {
  const header = req.headers?.authorization
  if (typeof header !== 'string') return null
  const match = /^Bearer(?:\s+(.*))?$/i.exec(header.trim())
  return match ? (match[1] || '').trim() : null
}

// Users this server instance has already made sure exist, so the upsert
// below runs once per user per instance, not on every request.
const knownUsers = new Set()

// The cookie login creates the user document in /api/auth/privy. Bearer
// requests never go through that route, so the first one does it here.
async function ensureUser(privyUserId) {
  if (knownUsers.has(privyUserId)) return
  await User.updateOne(
    { privyUserId },
    { $setOnInsert: { privyUserId, createdAt: new Date() } },
    { upsert: true }
  )
  knownUsers.add(privyUserId)
}

function sendError(res, status, message) {
  if (!res.headersSent) res.status(status).json({ error: message })
}

// One short, readable message from a zod error (the first issue).
function validationMessage(zodError) {
  const issue = zodError.issues[0]
  if (!issue) return 'Invalid request'
  const field = issue.path.join('.')
  if (issue.code === 'invalid_type' && issue.received === 'undefined') {
    return field ? `${field} is required` : 'Request body is required'
  }
  return issue.message
}

// Validates req.body / req.query against the method's schemas and replaces
// them with the parsed (trimmed, coerced, stripped) values.
// Returns an error message, or null if the request is valid.
function validate(req, schemas) {
  for (const part of ['query', 'body']) {
    const schema = schemas?.[part]
    if (!schema) continue
    const result = schema.safeParse(req[part] ?? {})
    if (!result.success) return validationMessage(result.error)
    if (part === 'body') req.body = result.data
    else req.validatedQuery = result.data // req.query is read-only in some runtimes
  }
  return null
}

export function withAuth(handlers, { idParams = [], errors = {}, schemas = {} } = {}) {
  const allowed = Object.keys(handlers)

  return async function handler(req, res) {
    const route = `${req.method} ${req.url?.split('?')[0]}`

    // 1. Method
    const methodHandler = handlers[req.method]
    if (!methodHandler) {
      res.setHeader('Allow', allowed.join(', '))
      return sendError(res, 405, 'Method not allowed')
    }

    // 2. Who is calling: a Bearer token if one is sent, otherwise the cookie.
    //    A bad Bearer token is a 401; it never falls back to the cookie.
    let privyUserId
    const token = bearerToken(req)
    if (token !== null) {
      if (!token) return sendError(res, 401, 'Invalid token')
      try {
        privyUserId = await verifyPrivyToken(token)
      } catch (err) {
        console.warn(`[${route}] Bearer token rejected:`, err?.message)
        return sendError(res, 401, 'Invalid token')
      }
    } else {
      try {
        const session = await getSession(req, res)
        privyUserId = session.privyUserId
      } catch (err) {
        console.error(`[${route}] session error:`, err?.message)
        return sendError(res, 500, 'Internal server error')
      }
    }
    if (!privyUserId) return sendError(res, 401, 'Not authenticated')

    // 3. Route params
    for (const name of idParams) {
      if (!isValidId(req.query[name])) return sendError(res, 404, 'Not found')
    }

    // 3b. Body / query validation (before any DB work)
    const invalid = validate(req, schemas[req.method])
    if (invalid) return sendError(res, 400, invalid)

    // 4. Database
    try {
      await connectDB()
    } catch (err) {
      console.error(`[${route}] DB connection failed:`, err?.message)
      return sendError(res, 503, 'Service temporarily unavailable')
    }

    // 4b. First Bearer request from a user: create their user document.
    if (token) {
      try {
        await ensureUser(privyUserId)
      } catch (err) {
        // Not fatal, same as the cookie login: log it and carry on.
        console.error(`[${route}] user upsert failed:`, err?.message)
      }
    }

    // 5. Handler
    try {
      await methodHandler(req, res, { privyUserId })
    } catch (err) {
      if (err instanceof ApiError) return sendError(res, err.status, err.message)
      // Log message only; raw error objects can carry request config or secrets.
      console.error(`[${route}]`, err?.name, err?.message)
      sendError(res, 500, errors[req.method] || 'Internal server error')
    }
  }
}
