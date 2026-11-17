// pages/api/v1/weeks/[startDate].js (RYR-38, contract #12-13)
//   GET /api/v1/weeks/current      the active week
//   GET /api/v1/weeks/:startDate   any week (the date snaps to its Monday)
import { withAuth } from '@/lib/apiHandler'
import { getWeek } from '@/lib/v1/weeks'
import { isDay, timeZoneOf, todayIn } from '@/lib/v1/dates'

export default withAuth({
  GET: async (req, res, { privyUserId }) => {
    const today = todayIn(timeZoneOf(req))
    const { startDate } = req.query
    if (startDate !== 'current' && !isDay(startDate)) {
      return res.status(400).json({ error: 'Week must be "current" or a date (YYYY-MM-DD)' })
    }
    const week = await getWeek(privyUserId, startDate === 'current' ? today : startDate, today)
    if (!week) return res.status(404).json({ error: 'No program yet. Finish onboarding to build one.' })
    res.json(week)
  },
}, {
  errors: { GET: 'Failed to load the week' },
})
