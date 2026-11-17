// pages/api/v1/catalog/familiarity.js (RYR-36, contract #3)
//   GET /api/v1/catalog/familiarity?equipment=dumbbell,bench
// The onboarding "which of these are you comfortable doing?" list, limited to
// exercises the given equipment allows (all of them when it's left out).
import { withAuth } from '@/lib/apiHandler'
import { familiarityQuery } from '@/lib/v1/schemas'
import { familiarityOptions } from '@/lib/v1/vocab'

export default withAuth({
  GET: async (req, res) => {
    res.json(familiarityOptions(req.validatedQuery.equipment))
  },
}, {
  errors: { GET: 'Failed to load exercises' },
  schemas: { GET: { query: familiarityQuery } },
})
