// pages/api/v1/sessions/[sessionId]/finish.js (RYR-38, contract #17)
//   POST /api/v1/sessions/:sessionId/finish  { durationMinutes? }  -> SessionCompletionSummary
import { withAuth } from '@/lib/apiHandler'
import { finishSessionBody } from '@/lib/v1/schemas'
import { finishSession } from '@/lib/v1/sessions'
import { timeZoneOf, todayIn } from '@/lib/v1/dates'

export default withAuth({
  POST: async (req, res, { privyUserId }) => {
    const today = todayIn(timeZoneOf(req))
    res.json(await finishSession(privyUserId, req.query.sessionId, req.body, today))
  },
}, {
  errors: { POST: 'Failed to finish the session' },
  schemas: { POST: { body: finishSessionBody } },
})
