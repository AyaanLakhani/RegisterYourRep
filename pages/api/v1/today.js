// pages/api/v1/today.js (RYR-38, contract #11)
//   GET /api/v1/today  today's session (null on rest days), the active week,
//   the monthly goal, and last week's missed sessions.
import { withAuth } from '@/lib/apiHandler'
import { getToday } from '@/lib/v1/weeks'
import { timeZoneOf, todayIn } from '@/lib/v1/dates'

export default withAuth({
  GET: async (req, res, { privyUserId }) => {
    const today = await getToday(privyUserId, todayIn(timeZoneOf(req)))
    if (!today) return res.status(404).json({ error: 'No program yet. Finish onboarding to build one.' })
    res.json(today)
  },
}, {
  errors: { GET: "Failed to load today's session" },
})
