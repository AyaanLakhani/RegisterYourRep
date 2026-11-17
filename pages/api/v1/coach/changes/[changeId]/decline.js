// pages/api/v1/coach/changes/[changeId]/decline.js (RYR-40, contract #22)
//   POST /api/v1/coach/changes/:changeId/decline  -> CoachChangeResult
import { withAuth } from '@/lib/apiHandler'
import { emptyBody } from '@/lib/v1/schemas'
import { declineChange } from '@/lib/v1/coach'

export default withAuth({
  POST: async (req, res, { privyUserId }) => {
    res.json(await declineChange(privyUserId, req.query.changeId))
  },
}, {
  idParams: ['changeId'],
  errors: { POST: 'Failed to decline the change' },
  schemas: { POST: { body: emptyBody } },
})
