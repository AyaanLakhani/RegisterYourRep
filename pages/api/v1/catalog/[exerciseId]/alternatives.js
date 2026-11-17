// pages/api/v1/catalog/[exerciseId]/alternatives.js (RYR-39, contract #19)
//   GET /api/v1/catalog/:exerciseId/alternatives  swap options the user can do
import { withAuth } from '@/lib/apiHandler'
import { getAlternatives } from '@/lib/v1/progress'

export default withAuth({
  GET: async (req, res, { privyUserId }) => {
    const alternatives = await getAlternatives(privyUserId, req.query.exerciseId)
    if (!alternatives) return res.status(404).json({ error: 'Not found' })
    res.json(alternatives)
  },
}, {
  errors: { GET: 'Failed to load alternatives' },
})
