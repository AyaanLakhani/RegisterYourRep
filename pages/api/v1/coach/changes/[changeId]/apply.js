// pages/api/v1/coach/changes/[changeId]/apply.js (RYR-40, contract #21)
//   POST /api/v1/coach/changes/:changeId/apply  -> CoachChangeResult (new program version)
import { withAuth } from '@/lib/apiHandler'
import { emptyBody } from '@/lib/v1/schemas'
import { applyChange } from '@/lib/v1/coach'
import { timeZoneOf, todayIn } from '@/lib/v1/dates'

export default withAuth({
  POST: async (req, res, { privyUserId }) => {
    res.json(await applyChange(privyUserId, req.query.changeId, todayIn(timeZoneOf(req))))
  },
}, {
  idParams: ['changeId'],
  errors: { POST: 'Failed to apply the change' },
  schemas: { POST: { body: emptyBody } },
})
