// pages/api/v1/proposals/[proposalId]/accept.js (RYR-37, contract #7)
//   POST /api/v1/proposals/:proposalId/accept  { choice }  -> the new current Program
// Creates a new program version (a new training block) and this week's
// sessions from today on.
import { withAuth } from '@/lib/apiHandler'
import { ProgramProposal } from '@/lib/v1/models'
import { acceptProposalBody } from '@/lib/v1/schemas'
import { addProgramVersion, syncActiveWeek, toProgram } from '@/lib/v1/programs'
import { timeZoneOf, todayIn } from '@/lib/v1/dates'

export default withAuth({
  POST: async (req, res, { privyUserId }) => {
    // Claim the proposal first, so a double tap can't create two programs.
    const proposal = await ProgramProposal.findOneAndUpdate(
      { _id: req.query.proposalId, privyUserId, acceptedAt: null },
      { $set: { acceptedAt: new Date() } },
      { new: true }
    ).lean()
    if (!proposal) {
      const exists = await ProgramProposal.exists({ _id: req.query.proposalId, privyUserId })
      return exists
        ? res.status(409).json({ error: 'This plan was already accepted.' })
        : res.status(404).json({ error: 'Not found' })
    }

    const recommended = req.body.choice === 'recommended'
    const option = recommended ? proposal.recommended : proposal.asAsked
    const today = todayIn(timeZoneOf(req))
    const program = await addProgramVersion(privyUserId, {
      days: option.days,
      name: option.name,
      note: `Accepted the ${recommended ? 'recommended' : 'as-asked'} plan`,
      profileVersion: proposal.profileVersion,
      blockStart: today,
    })
    await syncActiveWeek(privyUserId, program, today)
    res.json(toProgram(program))
  },
}, {
  idParams: ['proposalId'],
  errors: { POST: 'Failed to accept the plan' },
  schemas: { POST: { body: acceptProposalBody } },
})
