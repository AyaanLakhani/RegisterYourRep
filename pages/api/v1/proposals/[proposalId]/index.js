// pages/api/v1/proposals/[proposalId]/index.js (RYR-37, contract #6)
//   GET /api/v1/proposals/:proposalId  the program proposal (both options)
import { withAuth } from '@/lib/apiHandler'
import { ProgramProposal } from '@/lib/v1/models'
import { toProposal } from '@/lib/v1/proposals'

export default withAuth({
  GET: async (req, res, { privyUserId }) => {
    const proposal = await ProgramProposal.findOne({ _id: req.query.proposalId, privyUserId }).lean()
    if (!proposal) return res.status(404).json({ error: 'Not found' })
    res.json(toProposal(proposal))
  },
}, {
  idParams: ['proposalId'],
  errors: { GET: 'Failed to load the proposal' },
})
