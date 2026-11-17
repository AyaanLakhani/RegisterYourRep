// pages/api/v1/proposals/pending.js (contract #25)
//   GET /api/v1/proposals/pending  the plan the user built but hasn't started yet, or null
// Home uses it to go back to that draft instead of building a new plan.
import { withAuth } from '@/lib/apiHandler'
import { pendingProposal } from '@/lib/v1/proposals'

export default withAuth({
  GET: async (req, res, { privyUserId }) => {
    res.json(await pendingProposal(privyUserId))
  },
}, {
  errors: { GET: 'Failed to load your plan' },
})
