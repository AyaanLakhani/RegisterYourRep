// lib/models/index.js — all schemas identical to original index.js
import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  privyUserId: { type: String, required: true, unique: true },
  email: String,
  fitnessLevel: String,
  targetMuscles: [String],
  frequency: Number,
  sessionDuration: Number,
  preferences: String,
  onboardingComplete: { type: Boolean, default: false },
  // Structured intake answers (RYR-12). fitnessLevel above holds the
  // confirmed level; the suggestion and its inputs are kept alongside it.
  intake: {
    type: new mongoose.Schema({
      gymType: String,
      equipment: [String],         // the confirmed list, not just the preset
      goal: String,
      injuries: [String],
      injuryNotes: String,
      trainingHistory: String,
      familiarExercises: [String], // catalog ids
      suggestedLevel: String,
      confirmedLevel: String,
      completedAt: Date,
    }, { _id: false }),
    default: undefined,
  },
})
export const User = mongoose.models.User || mongoose.model('User', userSchema)

const workoutSchema = new mongoose.Schema({
  privyUserId: { type: String, required: true },
  exercises: [String],
  source: { type: String, default: 'manual' },
  planId: String,
  workcardId: String,
  dayLabel: String,
  completionScore: Number,
  completedCount: Number,
  totalCount: Number,
  sessionDate: String,
  sessionWeekday: String,
  savedAt: { type: Date, default: Date.now },
})
export const Workout = mongoose.models.Workout || mongoose.model('Workout', workoutSchema)

const workoutPlanSchema = new mongoose.Schema({
  privyUserId: { type: String, required: true },
  name: { type: String, required: true },
  source: { type: String, enum: ['onboarding', 'custom'], default: 'custom' },
  fitnessLevel: String,
  targetMuscles: [String],
  frequency: Number,
  sessionDuration: Number,
  preferences: String,
  status: { type: String, enum: ['draft', 'generating', 'ready', 'failed'], default: 'draft' },
  generatedPlan: mongoose.Schema.Types.Mixed,
  lastError: String,
  // Id of the generation run that owns this plan while it's 'generating'.
  // A run only saves its result if this still matches (RYR-8).
  generationId: String,
  // Which model and prompt made generatedPlan, and when (RYR-10).
  model: String,
  promptVersion: String,
  generatedAt: Date,
  // The intake answers this plan was generated with (RYR-12).
  intakeSnapshot: mongoose.Schema.Types.Mixed,
}, { timestamps: true })
export const WorkoutPlan = mongoose.models.WorkoutPlan || mongoose.model('WorkoutPlan', workoutPlanSchema)

const workcardSchema = new mongoose.Schema({
  privyUserId: { type: String, required: true },
  planId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'WorkoutPlan' },
  planName: String,
  dayIndex: Number,
  dayLabel: String,
  focus: [String],
  date: String,
  weekday: String,
  // Future-proofing if you want progress tracking
  exercises: [{ name: String, sets: Number, reps: String, restSeconds: Number, notes: String }],
  checked: [Boolean],
  completedCount: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'submitted'], default: 'pending' },
  submittedAt: Date,
}, { timestamps: true })
export const Workcard = mongoose.models.Workcard || mongoose.model('Workcard', workcardSchema)

// One document per plan generation (RYR-5, RYR-10). It's inserted as the
// rate-limit reservation, then filled in with the Gemini call's outcome.
// Holds ids, numbers and internal error text only: no email, no preferences.
// Kept ~90 days by the TTL index; the rate limit only reads the last hour.
export const GENERATION_LOG_TTL_SECONDS = 90 * 24 * 60 * 60
const generationLogSchema = new mongoose.Schema({
  privyUserId: { type: String, required: true },
  planId: String,
  createdAt: { type: Date, default: Date.now, expires: GENERATION_LOG_TTL_SECONDS },
  kind: { type: String, enum: ['plan', 'coach'], default: 'plan' }, // which rate-limit budget
  status: { type: String, enum: ['started', 'succeeded', 'failed'], default: 'started' },
  model: String,
  promptVersion: String,
  inputTokens: Number,
  outputTokens: Number,
  thinkingTokens: Number,
  totalTokens: Number,
  latencyMs: Number,
  attempts: Number,   // HTTP calls made, so retries = attempts - 1
  finishReason: String,
  error: String,      // internal reason for a failure (not shown to users)
  finishedAt: Date,
})
generationLogSchema.index({ privyUserId: 1, createdAt: -1 })
export const GenerationLog = mongoose.models.GenerationLog || mongoose.model('GenerationLog', generationLogSchema)

// The exercise catalog (RYR-13). Source of truth is lib/catalog/exercises.js;
// scripts/seed-exercises.mjs copies it here, keyed by slug (the catalog id).
const exerciseSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  aliases: [String],
  primaryMuscles: [String],
  secondaryMuscles: [String],
  equipment: [String],         // all of these are needed; [] = bodyweight
  equipmentType: { type: String, enum: ['machine_cable', 'barbell', 'dumbbell', 'bodyweight', 'other'] },
  movementPattern: String,
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'professional'] },
  common: { type: Boolean, default: false },
  easier: [String],            // slugs of easier alternatives
  harder: [String],            // slugs of harder alternatives
}, { timestamps: true })
exerciseSchema.index({ primaryMuscles: 1, difficulty: 1 })
exerciseSchema.index({ equipment: 1 })
exerciseSchema.index({ difficulty: 1, common: 1 })
export const Exercise = mongoose.models.Exercise || mongoose.model('Exercise', exerciseSchema)

// Profile for /api/v1 (RYR-36): the mobile app's onboarding answers, in the
// contract's vocabulary (lib/v1/vocab.js). Append-only: every save is a new
// version, and GET returns the newest. A user with no versions hasn't done
// onboarding, so the app sends them there.
const profileVersionSchema = new mongoose.Schema({
  privyUserId: { type: String, required: true },
  version: { type: Number, required: true },
  goals: [String],
  trainingDays: [String],
  sessionMinutes: Number,
  gymType: String,
  equipment: [String],          // the confirmed list
  trainingHistory: String,
  familiarExerciseIds: [String], // catalog ids
  limitations: String,
  suggestedLevel: String,       // worked out by the server
  level: String,                // what the user confirmed; plans use this
}, { timestamps: { createdAt: true, updatedAt: false } })
profileVersionSchema.index({ privyUserId: 1, version: -1 }, { unique: true })
export const ProfileVersion = mongoose.models.ProfileVersion || mongoose.model('ProfileVersion', profileVersionSchema)
