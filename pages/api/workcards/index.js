// pages/api/workcards/index.js
import { withAuth, isValidId, ApiError } from '@/lib/apiHandler'
import { Workcard } from '@/lib/models'

export default withAuth({
  GET: async (req, res, { privyUserId }) => {
    const filter = { privyUserId }
    const { status, planId } = req.query
    if (status === 'pending' || status === 'submitted') filter.status = status
    if (planId !== undefined) {
      if (!isValidId(planId)) throw new ApiError(400, 'Invalid planId')
      filter.planId = planId
    }

    const workcards = await Workcard.find(filter).sort({ status: 1, dayIndex: 1, createdAt: -1 })
    res.json(workcards)
  },
}, {
  errors: { GET: 'Failed to fetch workcards' },
})
