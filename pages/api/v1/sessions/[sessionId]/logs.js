// pages/api/v1/sessions/[sessionId]/logs.js (RYR-38, contract #16)
//   POST /api/v1/sessions/:sessionId/logs  { action: done | skip | swap, ... }  -> the Session
// Each log is saved as it happens, so a dropped connection mid-workout loses
// nothing already sent.
import { withAuth } from '@/lib/apiHandler'
import { logExerciseBody } from '@/lib/v1/schemas'
import { logExercise } from '@/lib/v1/sessions'

export default withAuth({
  POST: async (req, res, { privyUserId }) => {
    res.json(await logExercise(privyUserId, req.query.sessionId, req.body))
  },
}, {
  errors: { POST: 'Failed to save that exercise' },
  schemas: { POST: { body: logExerciseBody } },
})
