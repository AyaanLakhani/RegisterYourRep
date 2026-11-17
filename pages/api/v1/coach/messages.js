// pages/api/v1/coach/messages.js (RYR-40, contract #20 and #24)
//   GET  /api/v1/coach/messages  the chat so far (oldest first), so it reloads when the app opens Ask Coach
//   POST /api/v1/coach/messages  { text, proposalId?, option? }  -> CoachReply
//        With proposalId + option the coach tweaks that draft (made right away);
//        without them it proposes changes to the active program.
import { withAuth } from '@/lib/apiHandler'
import { coachMessageBody } from '@/lib/v1/schemas'
import { getCoachHistory, sendCoachMessage } from '@/lib/v1/coach'
import { timeZoneOf, todayIn } from '@/lib/v1/dates'

// One Gemini call inside the request (budget 50s, RYR-7).
export const config = { maxDuration: 60 }

export default withAuth({
  GET: async (req, res, { privyUserId }) => {
    res.json(await getCoachHistory(privyUserId))
  },
  POST: async (req, res, { privyUserId }) => {
    res.json(await sendCoachMessage(privyUserId, req.body, todayIn(timeZoneOf(req))))
  },
}, {
  errors: { GET: 'Failed to load the chat', POST: "The coach can't answer right now" },
  schemas: { POST: { body: coachMessageBody } },
})
