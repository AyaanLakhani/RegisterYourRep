// pages/api/auth/privy.js
// Exchanges a verified Privy access token for our iron-session cookie.
import { getSession } from '@/lib/session'
import { connectDB } from '@/lib/mongoose'
import { User } from '@/lib/models'
import { verifyPrivyToken } from '@/lib/privy'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.body?.token
  if (typeof token !== 'string' || !token) {
    return res.status(400).json({ error: 'No token provided' })
  }

  // 1. Verify the token. No session is created unless this succeeds.
  let privyUserId
  try {
    privyUserId = await verifyPrivyToken(token)
  } catch (err) {
    console.warn('Privy token rejected:', err?.message)
    return res.status(401).json({ error: 'Invalid token' })
  }

  // 2. Create the session.
  try {
    const session = await getSession(req, res)
    session.privyUserId = privyUserId
    await session.save()
  } catch (err) {
    console.error('Session save failed:', err?.message)
    return res.status(500).json({ error: 'Could not create session' })
  }

  // 3. Make sure the user document exists. Login still succeeds if this fails,
  //    but the failure is logged so it doesn't go unnoticed.
  try {
    await connectDB()
    await User.updateOne(
      { privyUserId },
      { $setOnInsert: { privyUserId, createdAt: new Date() } },
      { upsert: true }
    )
  } catch (err) {
    console.error('User upsert failed for', privyUserId, '-', err?.message)
  }

  res.json({ success: true })
}
