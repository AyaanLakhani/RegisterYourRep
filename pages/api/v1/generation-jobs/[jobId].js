// pages/api/v1/generation-jobs/[jobId].js (RYR-37, contract #5)
//   GET /api/v1/generation-jobs/:jobId  the job's status and steps (the app polls this)
import { withAuth } from '@/lib/apiHandler'
import { GenerationJob } from '@/lib/v1/models'
import { STALE_JOB_MS, toJob } from '@/lib/v1/generation'

const STALE_MESSAGE = "Building the plan didn't finish. Please try again."

export default withAuth({
  GET: async (req, res, { privyUserId }) => {
    let job = await GenerationJob.findOne({ _id: req.query.jobId, privyUserId }).lean()
    if (!job) return res.status(404).json({ error: 'Not found' })

    // A run that died (function killed) is reported as failed, not running forever.
    if (job.status === 'running' && Date.now() - new Date(job.createdAt).getTime() > STALE_JOB_MS) {
      job = (await GenerationJob.findOneAndUpdate(
        { _id: job._id, status: 'running' },
        { $set: { status: 'failed', error: STALE_MESSAGE, finishedAt: new Date() }, $unset: { activeKey: 1 } },
        { new: true }
      ).lean()) || job
    }
    res.json(toJob(job))
  },
}, {
  idParams: ['jobId'],
  errors: { GET: 'Failed to load the plan status' },
})
