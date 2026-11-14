import mongoose from 'mongoose'

let cached = global.mongoose
if (!cached) cached = global.mongoose = { conn: null, promise: null }

export async function connectDB() {
  if (cached.conn) return cached.conn

  // Checked here rather than at import time, so a missing variable becomes a
  // handled error in the request instead of crashing the module load.
  const MONGODB_URI = process.env.MONGODB_URI
  if (!MONGODB_URI) throw new Error('MONGODB_URI is not configured')

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then(m => m)
  }
  try {
    cached.conn = await cached.promise
  } catch (err) {
    // Don't keep a rejected promise cached, or every later request on this
    // server instance would fail without retrying.
    cached.promise = null
    throw err
  }
  return cached.conn
}
