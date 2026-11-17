// pages/api/intake/options.js
// GET /api/intake/options: the intake's answer options (RYR-12): gym types
// with their equipment presets, equipment, goals, training history, injury
// areas and the familiarity exercises. Static and not user-specific, so it's
// public and cacheable; the onboarding screen can load it before login.
import { intakeOptions } from '@/lib/intake'

const options = intakeOptions()

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600')
  res.json(options)
}
