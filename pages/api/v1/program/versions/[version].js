// pages/api/v1/program/versions/[version].js (RYR-37, contract #9)
//   GET /api/v1/program/versions/:version  one program version
import { withAuth } from '@/lib/apiHandler'
import { Program } from '@/lib/v1/models'
import { toProgram } from '@/lib/v1/programs'

export default withAuth({
  GET: async (req, res, { privyUserId }) => {
    const version = Number(req.query.version)
    if (!Number.isInteger(version) || version < 1) return res.status(404).json({ error: 'Not found' })
    const program = await Program.findOne({ privyUserId, version }).lean()
    if (!program) return res.status(404).json({ error: 'Not found' })
    res.json(toProgram(program))
  },
}, {
  errors: { GET: 'Failed to load that version' },
})
