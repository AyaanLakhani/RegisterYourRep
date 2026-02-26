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
  exercises: [{ name: String, sets: Number, reps: String, restSeconds: Number, notes: String }],
  checked: [Boolean],
  completedCount: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'submitted'], default: 'pending' },
  submittedAt: Date,
}, { timestamps: true })
export const Workcard = mongoose.models.Workcard || mongoose.model('Workcard', workcardSchema)
