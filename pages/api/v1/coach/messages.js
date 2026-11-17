// pages/api/v1/coach/messages.js (RYR-40, contract #20)
//   POST /api/v1/coach/messages  { text }  -> CoachReply (reply.change holds a proposed change, if any)
import { withAuth } from '@/lib/apiHandler'
import { coachMessageBody } from '@/lib/v1/schemas'
import { sendCoachMessage } from '@/lib/v1/coach'
import { timeZoneOf, todayIn } from '@/lib/v1/dates'

// One Gemini call inside the request (budget 50s, RYR-7).
export const config = { maxDuration: 60 }

export default withAuth({
  POST: async (req, res, { privyUserId }) => {
    res.json(await sendCoachMessage(privyUserId, req.body.text, todayIn(timeZoneOf(req))))
  },
}, {
  errors: { POST: "The coach can't answer right now" },
  schemas: { POST: { body: coachMessageBody } },
})
