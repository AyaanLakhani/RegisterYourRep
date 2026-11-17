// pages/api/v1/progress.js (RYR-39, contract #18)
//   GET /api/v1/progress  completion, streak, muscle balance, most skipped
import { withAuth } from '@/lib/apiHandler'
import { getProgress } from '@/lib/v1/progress'
import { timeZoneOf, todayIn } from '@/lib/v1/dates'

export default withAuth({
  GET: async (req, res, { privyUserId }) => {
    const progress = await getProgress(privyUserId, todayIn(timeZoneOf(req)))
    if (!progress) return res.status(404).json({ error: 'No program yet. Finish onboarding to build one.' })
    res.json(progress)
  },
}, {
  errors: { GET: 'Failed to load your progress' },
})
