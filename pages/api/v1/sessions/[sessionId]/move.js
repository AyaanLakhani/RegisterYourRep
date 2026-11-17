// pages/api/v1/sessions/[sessionId]/move.js (RYR-38, contract #15)
//   POST /api/v1/sessions/:sessionId/move  { toDate }  -> the updated Week
// Only within the active week, not for finished sessions, and not onto a
// day that already has one.
import { withAuth } from '@/lib/apiHandler'
import { moveSessionBody } from '@/lib/v1/schemas'
import { moveSession } from '@/lib/v1/sessions'
import { timeZoneOf, todayIn } from '@/lib/v1/dates'

export default withAuth({
  POST: async (req, res, { privyUserId }) => {
    const today = todayIn(timeZoneOf(req))
    res.json(await moveSession(privyUserId, req.query.sessionId, req.body.toDate, today))
  },
}, {
  errors: { POST: 'Failed to move the session' },
  schemas: { POST: { body: moveSessionBody } },
})
