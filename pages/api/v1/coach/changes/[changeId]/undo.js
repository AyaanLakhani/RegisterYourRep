// pages/api/v1/coach/changes/[changeId]/undo.js (RYR-40, contract #23)
//   POST /api/v1/coach/changes/:changeId/undo  -> CoachChangeResult
// Undoing an applied change restores the earlier days as a new version;
// undoing a decline just puts the change back to pending.
import { withAuth } from '@/lib/apiHandler'
import { emptyBody } from '@/lib/v1/schemas'
import { undoChange } from '@/lib/v1/coach'
import { timeZoneOf, todayIn } from '@/lib/v1/dates'

export default withAuth({
  POST: async (req, res, { privyUserId }) => {
    res.json(await undoChange(privyUserId, req.query.changeId, todayIn(timeZoneOf(req))))
  },
}, {
  idParams: ['changeId'],
  errors: { POST: 'Failed to undo the change' },
  schemas: { POST: { body: emptyBody } },
})
