// pages/api/v1/sessions/[sessionId]/index.js (RYR-38, contract #14)
//   GET /api/v1/sessions/:sessionId  one session (future weeks: "planned-YYYY-MM-DD", read-only)
import { withAuth } from '@/lib/apiHandler'
import { getSessionById } from '@/lib/v1/sessions'
import { toSession } from '@/lib/v1/programs'

export default withAuth({
  GET: async (req, res, { privyUserId }) => {
    res.json(toSession(await getSessionById(privyUserId, req.query.sessionId)))
  },
}, {
  errors: { GET: 'Failed to load the session' },
})
