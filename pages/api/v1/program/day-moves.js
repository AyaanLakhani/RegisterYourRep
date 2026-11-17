// pages/api/v1/program/day-moves.js (RYR-37, contract #10)
//   POST /api/v1/program/day-moves  { moves: [{ from, to }], note? }  -> new Program version
// Changes which weekday each training day falls on, from next week. The
// active week keeps its dates (moving one session this week is RYR-38).
import { withAuth, ApiError } from '@/lib/apiHandler'
import { dayMovesBody } from '@/lib/v1/schemas'
import { addProgramVersion, requireCurrentProgram, toProgram } from '@/lib/v1/programs'

const LABEL = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }

export default withAuth({
  POST: async (req, res, { privyUserId }) => {
    const current = await requireCurrentProgram(privyUserId)
    const { moves, note } = req.body
    for (const { from } of moves) {
      if (!current.days.some(d => d.weekday === from)) {
        throw new ApiError(400, `There's no training day on ${LABEL[from]}.`)
      }
    }
    // Every move is read against the days as they were, so a swap
    // ({ mon -> wed, wed -> mon }) works. The result needs one day per weekday.
    const moved = current.days.map(d => {
      const move = moves.find(m => m.from === d.weekday)
      return move ? { ...d, weekday: move.to } : d
    })
    if (new Set(moved.map(d => d.weekday)).size !== moved.length) {
      throw new ApiError(400, 'Two training days would land on the same day.')
    }
    const summary = moves.map(m => `${LABEL[m.from]} → ${LABEL[m.to]}`).join(', ')
    const program = await addProgramVersion(privyUserId, { days: moved, note: note || `Moved ${summary}` })
    res.json(toProgram(program))
  },
}, {
  errors: { POST: 'Failed to move your training days' },
  schemas: { POST: { body: dayMovesBody } },
})
