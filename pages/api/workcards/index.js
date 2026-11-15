// pages/api/workcards/index.js
import { withAuth } from '@/lib/apiHandler'
import { Workcard } from '@/lib/models'
import { listWorkcardsQuery } from '@/lib/validation'

export default withAuth({
  GET: async (req, res, { privyUserId }) => {
    const { status, planId } = req.validatedQuery
    const filter = { privyUserId }
    if (status) filter.status = status
    if (planId) filter.planId = planId

    const workcards = await Workcard.find(filter).sort({ status: 1, dayIndex: 1, createdAt: -1 })
    res.json(workcards)
  },
}, {
  errors: { GET: 'Failed to fetch workcards' },
  schemas: { GET: { query: listWorkcardsQuery } },
})
