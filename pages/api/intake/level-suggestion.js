// pages/api/intake/level-suggestion.js
// POST /api/intake/level-suggestion: the level to suggest from training
// history and familiarity ticks (RYR-12), so the onboarding screen can ask
// "We'll start you as intermediate. Sound right?". Nothing is saved here;
// the confirmed answer is saved with POST /api/user/profile.
import { withAuth } from '@/lib/apiHandler'
import { levelSuggestionBody, suggestLevel } from '@/lib/intake'

export default withAuth({
  POST: async (req, res) => {
    const { level } = suggestLevel(req.body)
    res.json({ suggestedLevel: level })
  },
}, {
  errors: { POST: 'Failed to suggest a level' },
  schemas: { POST: { body: levelSuggestionBody } },
})
