// lib/v1/models.js
// Storage for the /api/v1 data model (RYR-37 to RYR-40), in the contract's
// vocabulary (mobile/src/api/schemas.ts). ProfileVersion lives in
// lib/models/index.js with the older models.
//
// Programs and coach changes are append-only: a change makes a new program
// version and archives the old one, so history is never edited.
import mongoose from 'mongoose'

const { Schema } = mongoose
const model = (name, schema) => mongoose.models[name] || mongoose.model(name, schema)

const prescribedExercise = new Schema({
  exerciseId: { type: String, required: true },
  name: { type: String, required: true },
  sets: Number,
  reps: String,
  restSeconds: Number,
  formCue: String,
  swappedFromId: String,
}, { _id: false })

const programDay = new Schema({
  weekday: String,
  name: String,
  focus: [String],
  estimatedMinutes: Number,
  exercises: [prescribedExercise],
}, { _id: false })

// ---- Generation (RYR-37) ----

// One plan-generation run. Steps are derived from status and elapsed time
// when read; the run itself is a single Gemini call.
const generationJobSchema = new Schema({
  privyUserId: { type: String, required: true },
  profileVersion: Number,
  status: { type: String, enum: ['pending', 'running', 'done', 'failed'], default: 'running' },
  proposalId: String,
  error: String,          // client-safe message when failed
  logId: Schema.Types.ObjectId, // the GenerationLog row (rate limit + call log)
  finishedAt: Date,
  // Set to the user id only while the job runs. The unique sparse index means
  // a user can have one running job at a time, even with two taps at once.
  activeKey: String,
}, { timestamps: true })
generationJobSchema.index({ privyUserId: 1, createdAt: -1 })
generationJobSchema.index({ activeKey: 1 }, { unique: true, sparse: true })
export const GenerationJob = model('GenerationJob', generationJobSchema)

const proposalOption = new Schema({
  kind: String,
  name: String,
  summary: String,
  days: [programDay],
}, { _id: false })

const programProposalSchema = new Schema({
  privyUserId: { type: String, required: true },
  jobId: { type: String, required: true },
  profileVersion: Number,
  recommended: proposalOption,
  asAsked: proposalOption,
  coachNote: String,
  acceptedAt: Date,
}, { timestamps: { createdAt: true, updatedAt: false } })
programProposalSchema.index({ privyUserId: 1, createdAt: -1 })
export const ProgramProposal = model('ProgramProposal', programProposalSchema)

// ---- Program versions ----

const programSchema = new Schema({
  privyUserId: { type: String, required: true },
  version: { type: Number, required: true },
  status: { type: String, enum: ['current', 'archived'], default: 'current' },
  name: String,
  note: String,
  profileVersion: Number,
  // When the training block this version belongs to started: set when the
  // first plan, or a plan at a new level, is accepted; carried over by
  // same-level rebuilds, day moves and coach changes (RYR-27).
  // Progress (RYR-39) counts sessions from here.
  blockStart: String, // YYYY-MM-DD
  days: [programDay],
}, { timestamps: { createdAt: true, updatedAt: false } })
programSchema.index({ privyUserId: 1, version: -1 }, { unique: true })
programSchema.index({ privyUserId: 1, status: 1 })
export const Program = model('Program', programSchema)

// ---- Weeks and sessions (RYR-38) ----

// The active week is created once per user and Monday (unique index), when
// a program is accepted or the week is first requested.
const trainingWeekSchema = new Schema({
  privyUserId: { type: String, required: true },
  startDate: { type: String, required: true }, // Monday, YYYY-MM-DD
  programId: String,
  programVersion: Number,
}, { timestamps: true })
trainingWeekSchema.index({ privyUserId: 1, startDate: 1 }, { unique: true })
export const TrainingWeek = model('TrainingWeek', trainingWeekSchema)

const exerciseLog = new Schema({
  status: { type: String, enum: ['done', 'skipped'], required: true },
  exerciseId: { type: String, required: true },
  loggedAt: { type: Date, required: true },
  sets: { type: [{ reps: Number, weightKg: Number, _id: false }], default: undefined },
  reason: String,
}, { _id: false })

const trainingSessionSchema = new Schema({
  privyUserId: { type: String, required: true },
  weekStart: { type: String, required: true },
  programId: String,
  programVersion: Number,
  date: { type: String, required: true },
  weekday: String,
  status: { type: String, enum: ['scheduled', 'done', 'skipped', 'moved', 'carried_over'], default: 'scheduled' },
  name: String,
  focus: [String],
  estimatedMinutes: Number,
  exercises: [prescribedExercise],
  logs: [exerciseLog],
  startedAt: Date,
  finishedAt: Date,
  movedFrom: String,
  deload: Boolean, // a pro deload week's lighter session (RYR-14)
}, { timestamps: true })
// One session per user and day: moves can only go to an empty day.
trainingSessionSchema.index({ privyUserId: 1, date: 1 }, { unique: true })
trainingSessionSchema.index({ privyUserId: 1, weekStart: 1 })
export const TrainingSession = model('TrainingSession', trainingSessionSchema)

// ---- Coach (RYR-40) ----

const coachMessageSchema = new Schema({
  privyUserId: { type: String, required: true },
  role: { type: String, enum: ['user', 'coach'], required: true },
  text: { type: String, required: true },
  changeId: String,
}, { timestamps: { createdAt: true, updatedAt: false } })
coachMessageSchema.index({ privyUserId: 1, createdAt: -1 })
export const CoachMessage = model('CoachMessage', coachMessageSchema)

// A change the coach proposed: validated operations on catalog ids, applied
// by the server (lib/v1/coach.js). Two kinds:
//   target 'program': a change to the active plan, applied when the user taps Apply.
//   target 'draft':   a tweak to an unconfirmed proposal option, made right away;
//                     beforeDays keeps the option as it was, for Undo.
const coachChangeSchema = new Schema({
  privyUserId: { type: String, required: true },
  target: { type: String, enum: ['program', 'draft'], default: 'program' },
  status: { type: String, enum: ['pending', 'applied', 'declined'], default: 'pending' },
  title: String,
  lines: [{ kind: String, text: String, _id: false }],
  operations: [Schema.Types.Mixed],
  baseProgramVersion: Number,
  resultingProgramVersion: Number,
  proposalId: String,
  option: { type: String, enum: ['recommended', 'as_asked'] },
  beforeDays: [Schema.Types.Mixed],
}, { timestamps: { createdAt: true, updatedAt: false } })
coachChangeSchema.index({ privyUserId: 1, createdAt: -1 })
export const CoachChange = model('CoachChange', coachChangeSchema)
