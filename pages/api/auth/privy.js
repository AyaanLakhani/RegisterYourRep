// pages/api/auth/privy.js  ←  was: app.post('/auth/privy', ...)
import { getSession } from '@/lib/session'
import { connectDB } from '@/lib/mongoose'
import { User } from '@/lib/models'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.body?.token
  if (!token) return res.status(400).json({ error: 'No token provided' })

  try {
    const parts = token.split('.')
    if (parts.length !== 3) throw new Error('Invalid JWT format')
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    const privyUserId = payload.sub
    if (!privyUserId) throw new Error('No sub in token')

    const session = await getSession(req, res)
    session.privyUserId = privyUserId
    await session.save()

    // Ensure user document exists
    try {
      await connectDB()
      await User.updateOne(
        { privyUserId },
        { $setOnInsert: { privyUserId, createdAt: new Date() } },
        { upsert: true }
      )
    } catch (e) {
      console.error('Ensure user error:', e)
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Token decode error:', err.message)
    res.status(401).json({ error: 'Invalid token' })
  }
}
