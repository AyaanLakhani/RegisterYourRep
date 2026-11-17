// pages/api/v1/program/index.js (RYR-37, contract #8)
//   GET /api/v1/program  { current, versions }  (versions newest first)
import { withAuth } from '@/lib/apiHandler'
import { Program } from '@/lib/v1/models'
import { requireCurrentProgram, toProgram, toVersionSummary } from '@/lib/v1/programs'

export default withAuth({
  GET: async (req, res, { privyUserId }) => {
    const current = await requireCurrentProgram(privyUserId)
    const versions = await Program.find({ privyUserId }).sort({ version: -1 }).lean()
    res.json({ current: toProgram(current), versions: versions.map(toVersionSummary) })
  },
}, {
  errors: { GET: 'Failed to load your program' },
})
