// lib/apiHandler.js
// Shared wrapper for protected API routes (RYR-3).
//
// Every protected route goes through withAuth, which:
//   1. rejects methods the route doesn't handle (405)
//   2. requires a logged-in session (401)
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
//   })
import mongoose from 'mongoose'
import { getSession } from './session'
import { connectDB } from './mongoose'

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

function sendError(res, status, message) {
  if (!res.headersSent) res.status(status).json({ error: message })
}

export function withAuth(handlers, { idParams = [], errors = {} } = {}) {
  const allowed = Object.keys(handlers)

  return async function handler(req, res) {
    const route = `${req.method} ${req.url?.split('?')[0]}`

    // 1. Method
    const methodHandler = handlers[req.method]
    if (!methodHandler) {
      res.setHeader('Allow', allowed.join(', '))
      return sendError(res, 405, 'Method not allowed')
    }

    // 2. Session
    let privyUserId
    try {
      const session = await getSession(req, res)
      privyUserId = session.privyUserId
    } catch (err) {
      console.error(`[${route}] session error:`, err?.message)
      return sendError(res, 500, 'Internal server error')
    }
    if (!privyUserId) return sendError(res, 401, 'Not authenticated')

    // 3. Route params
    for (const name of idParams) {
      if (!isValidId(req.query[name])) return sendError(res, 404, 'Not found')
    }

    // 4. Database
    try {
      await connectDB()
    } catch (err) {
      console.error(`[${route}] DB connection failed:`, err?.message)
      return sendError(res, 503, 'Service temporarily unavailable')
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
