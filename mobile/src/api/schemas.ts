// Shared data types for the app (RYR-30).
//
// Every entity the screens use is defined here as a zod schema, and the
// TypeScript type is inferred from it. The backend should validate its
// responses against the same shapes (see contract.md).
//
// Conventions:
//   - ids are opaque strings (Mongo ObjectIds on the server, short ids in mocks)
//   - timestamps are ISO 8601 strings (`2026-11-12T09:30:00.000Z`)
//   - calendar days are `YYYY-MM-DD` strings in the user's local time
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const IdSchema = z.string().min(1);
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export const DayDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
export type DayDate = z.infer<typeof DayDateSchema>;

export const WeekdaySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
export type Weekday = z.infer<typeof WeekdaySchema>;

export const MuscleGroupSchema = z.enum(['upper', 'lower', 'core']);
export type MuscleGroup = z.infer<typeof MuscleGroupSchema>;

export const MuscleSchema = z.enum([
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
  'obliques',
  'lower_back',
]);
export type Muscle = z.infer<typeof MuscleSchema>;

export const LevelSchema = z.enum(['beginner', 'intermediate', 'advanced']);
export type Level = z.infer<typeof LevelSchema>;

export const EquipmentSchema = z.enum([
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'bodyweight',
  'kettlebell',
  'band',
  'bench',
  'pullup_bar',
]);
export type Equipment = z.infer<typeof EquipmentSchema>;

export const MovementPatternSchema = z.enum([
  'push_horizontal',
  'push_vertical',
  'pull_horizontal',
  'pull_vertical',
  'squat',
  'hinge',
  'lunge',
  'isolation',
  'core',
  'carry',
]);
export type MovementPattern = z.infer<typeof MovementPatternSchema>;

/** Reps can be a number, a range like "8-10", or "max". Stored as a string. */
export const RepsSchema = z.string().regex(/^(\d+(-\d+)?|max)$/, 'Expected a number, a range like 8-10, or "max"');
export type Reps = z.infer<typeof RepsSchema>;

// ---------------------------------------------------------------------------
// Exercise catalog
// ---------------------------------------------------------------------------

export const ExerciseCatalogEntrySchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  muscles: z.array(MuscleSchema).min(1),
  muscleGroup: MuscleGroupSchema,
  equipment: z.array(EquipmentSchema),
  difficulty: LevelSchema,
  movementPattern: MovementPatternSchema,
  /** Catalog ids that can stand in for this exercise (used by swap). */
  alternatives: z.array(IdSchema),
});
export type ExerciseCatalogEntry = z.infer<typeof ExerciseCatalogEntrySchema>;

// ---------------------------------------------------------------------------
// Profile (versioned)
// ---------------------------------------------------------------------------

export const GoalSchema = z.enum(['build_muscle', 'get_stronger', 'lose_fat', 'general_fitness', 'endurance']);
export type Goal = z.infer<typeof GoalSchema>;

export const GymTypeSchema = z.enum(['full_gym', 'home_gym', 'bodyweight_only']);
export type GymType = z.infer<typeof GymTypeSchema>;

/** What the user fills in during onboarding (and edits later). */
export const ProfileInputSchema = z.object({
  goals: z.array(GoalSchema).min(1),
  trainingDays: z.array(WeekdaySchema).min(1).max(7),
  sessionMinutes: z.number().int().min(15).max(180),
  gymType: GymTypeSchema,
  equipment: z.array(EquipmentSchema),
  /** Catalog ids of exercises the user already knows. */
  familiarExerciseIds: z.array(IdSchema),
  /** Free text, e.g. "left knee hurts on deep squats". */
  limitations: z.string().max(1000),
});
export type ProfileInput = z.infer<typeof ProfileInputSchema>;

export const ProfileSchema = ProfileInputSchema.extend({
  id: IdSchema,
  version: z.number().int().min(1),
  createdAt: IsoDateTimeSchema,
  /** Level the server assessed from the answers (not chosen by the user). */
  assessedLevel: LevelSchema,
});
export type Profile = z.infer<typeof ProfileSchema>;

// ---------------------------------------------------------------------------
// Program (versioned)
// ---------------------------------------------------------------------------

export const PrescribedExerciseSchema = z.object({
  exerciseId: IdSchema,
  /** Denormalised for display. */
  name: z.string().min(1),
  sets: z.number().int().min(1).max(10),
  reps: RepsSchema,
  restSeconds: z.number().int().min(0).max(600),
  formCue: z.string().optional(),
  /** Set when the user swapped the planned exercise for this one in a session. */
  swappedFromId: IdSchema.optional(),
});
export type PrescribedExercise = z.infer<typeof PrescribedExerciseSchema>;

export const ProgramDaySchema = z.object({
  weekday: WeekdaySchema,
  /** e.g. "Push", "Upper". Rest days are simply not listed. */
  name: z.string().min(1),
  focus: z.array(MuscleSchema),
  estimatedMinutes: z.number().int().min(1),
  exercises: z.array(PrescribedExerciseSchema).min(1),
});
export type ProgramDay = z.infer<typeof ProgramDaySchema>;

export const ProgramStatusSchema = z.enum(['current', 'archived']);
export type ProgramStatus = z.infer<typeof ProgramStatusSchema>;

export const ProgramSchema = z.object({
  id: IdSchema,
  /** e.g. "Upper · Lower · PPL" */
  name: z.string().min(1),
  version: z.number().int().min(1),
  status: ProgramStatusSchema,
  createdAt: IsoDateTimeSchema,
  /** Why this version exists, e.g. "Chest/Back focus" or "Moved Pull to Friday". */
  note: z.string(),
  profileVersion: z.number().int().min(1),
  days: z.array(ProgramDaySchema).min(1),
});
export type Program = z.infer<typeof ProgramSchema>;

/** One row in the version history list. */
export const ProgramVersionSummarySchema = ProgramSchema.pick({
  id: true,
  name: true,
  version: true,
  status: true,
  createdAt: true,
  note: true,
});
export type ProgramVersionSummary = z.infer<typeof ProgramVersionSummarySchema>;

export const ProgramWithVersionsSchema = z.object({
  current: ProgramSchema,
  versions: z.array(ProgramVersionSummarySchema),
});
export type ProgramWithVersions = z.infer<typeof ProgramWithVersionsSchema>;

/** Moving a training day to another weekday. Saving moves creates a new program version. */
export const DayMoveSchema = z.object({
  from: WeekdaySchema,
  to: WeekdaySchema,
});
export type DayMove = z.infer<typeof DayMoveSchema>;

export const SaveDayMovesRequestSchema = z.object({
  moves: z.array(DayMoveSchema).min(1),
  note: z.string().max(200).optional(),
});
export type SaveDayMovesRequest = z.infer<typeof SaveDayMovesRequestSchema>;

// ---------------------------------------------------------------------------
// Generation job + proposal
// ---------------------------------------------------------------------------

export const GenerationStepIdSchema = z.enum([
  'reading_answers',
  'picking_exercises',
  'balancing_muscles',
  'setting_sets_reps',
]);
export type GenerationStepId = z.infer<typeof GenerationStepIdSchema>;

export const JobStatusSchema = z.enum(['pending', 'running', 'done', 'failed']);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const GenerationStepSchema = z.object({
  id: GenerationStepIdSchema,
  label: z.string().min(1),
  status: JobStatusSchema,
});
export type GenerationStep = z.infer<typeof GenerationStepSchema>;

export const GenerationJobSchema = z.object({
  id: IdSchema,
  status: JobStatusSchema,
  steps: z.array(GenerationStepSchema).length(4),
  createdAt: IsoDateTimeSchema,
  /** Set when status is "done". */
  proposalId: IdSchema.optional(),
  /** Client-safe message, set when status is "failed". */
  error: z.string().optional(),
});
export type GenerationJob = z.infer<typeof GenerationJobSchema>;

export const ProposalOptionKindSchema = z.enum(['recommended', 'as_asked']);
export type ProposalOptionKind = z.infer<typeof ProposalOptionKindSchema>;

export const ProposalOptionSchema = z.object({
  kind: ProposalOptionKindSchema,
  name: z.string().min(1),
  /** Short line under the option title, e.g. "4 days · ~50 min". */
  summary: z.string(),
  days: z.array(ProgramDaySchema).min(1),
});
export type ProposalOption = z.infer<typeof ProposalOptionSchema>;

export const ProgramProposalSchema = z.object({
  id: IdSchema,
  jobId: IdSchema,
  createdAt: IsoDateTimeSchema,
  recommended: ProposalOptionSchema,
  asAsked: ProposalOptionSchema,
  /** Why the coach recommends what it does. */
  coachNote: z.string(),
});
export type ProgramProposal = z.infer<typeof ProgramProposalSchema>;

export const AcceptProposalRequestSchema = z.object({
  choice: ProposalOptionKindSchema,
});
export type AcceptProposalRequest = z.infer<typeof AcceptProposalRequestSchema>;

// ---------------------------------------------------------------------------
// Sessions and exercise logs
// ---------------------------------------------------------------------------

export const SkipReasonSchema = z.enum(['no_equipment', 'didnt_know', 'pain', 'time']);
export type SkipReason = z.infer<typeof SkipReasonSchema>;

export const SetLogSchema = z.object({
  reps: z.number().int().min(0),
  weightKg: z.number().min(0).optional(),
});
export type SetLog = z.infer<typeof SetLogSchema>;

export const ExerciseLogSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('done'),
    exerciseId: IdSchema,
    loggedAt: IsoDateTimeSchema,
    /** Per-set detail; optional for now, filled in by later issues. */
    sets: z.array(SetLogSchema).optional(),
  }),
  z.object({
    status: z.literal('skipped'),
    exerciseId: IdSchema,
    loggedAt: IsoDateTimeSchema,
    reason: SkipReasonSchema,
  }),
]);
export type ExerciseLog = z.infer<typeof ExerciseLogSchema>;

/**
 * scheduled    planned for `date`, not started or finished yet
 * done         finished (some exercises may have been skipped)
 * skipped      the whole session was skipped
 * moved        rescheduled to `date` from `movedFrom` (still to do)
 * carried_over missed last week and carried into this week (still to do)
 */
export const SessionStatusSchema = z.enum(['scheduled', 'done', 'skipped', 'moved', 'carried_over']);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const SessionSchema = z.object({
  id: IdSchema,
  programId: IdSchema,
  programVersion: z.number().int().min(1),
  date: DayDateSchema,
  weekday: WeekdaySchema,
  status: SessionStatusSchema,
  name: z.string().min(1),
  focus: z.array(MuscleSchema),
  estimatedMinutes: z.number().int().min(1),
  exercises: z.array(PrescribedExerciseSchema).min(1),
  logs: z.array(ExerciseLogSchema),
  startedAt: IsoDateTimeSchema.optional(),
  finishedAt: IsoDateTimeSchema.optional(),
  /** For moved / carried_over sessions: the date it was originally planned for. */
  movedFrom: DayDateSchema.optional(),
});
export type Session = z.infer<typeof SessionSchema>;

export const MoveSessionRequestSchema = z.object({
  toDate: DayDateSchema,
});
export type MoveSessionRequest = z.infer<typeof MoveSessionRequestSchema>;

export const LogExerciseRequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('done'),
    exerciseId: IdSchema,
    sets: z.array(SetLogSchema).optional(),
  }),
  z.object({
    action: z.literal('skip'),
    exerciseId: IdSchema,
    reason: SkipReasonSchema,
  }),
  z.object({
    /** Replace the planned exercise with a catalog alternative for this session. */
    action: z.literal('swap'),
    exerciseId: IdSchema,
    replacementId: IdSchema,
  }),
]);
export type LogExerciseRequest = z.infer<typeof LogExerciseRequestSchema>;

export const FinishSessionRequestSchema = z.object({
  durationMinutes: z.number().int().min(0).max(600).optional(),
});
export type FinishSessionRequest = z.infer<typeof FinishSessionRequestSchema>;

export const RepeatSkipNudgeSchema = z.object({
  exerciseId: IdSchema,
  name: z.string(),
  reason: SkipReasonSchema,
  count: z.number().int().min(2),
  /** e.g. "You've skipped Cable fly 4 times. Want me to swap it?" */
  message: z.string(),
});
export type RepeatSkipNudge = z.infer<typeof RepeatSkipNudgeSchema>;

export const SessionCompletionSummarySchema = z.object({
  session: SessionSchema,
  exercisesDone: z.number().int().min(0),
  exercisesTotal: z.number().int().min(0),
  durationMinutes: z.number().int().min(0),
  streakWeeks: z.number().int().min(0),
  sessionsThisWeek: z.object({
    done: z.number().int().min(0),
    planned: z.number().int().min(0),
  }),
  repeatSkipNudge: RepeatSkipNudgeSchema.nullable(),
});
export type SessionCompletionSummary = z.infer<typeof SessionCompletionSummarySchema>;

// ---------------------------------------------------------------------------
// Week
// ---------------------------------------------------------------------------

export const WeekSummarySchema = z.object({
  sessionsDone: z.number().int().min(0),
  sessionsPlanned: z.number().int().min(0),
  exercisesDone: z.number().int().min(0),
  exercisesSkipped: z.number().int().min(0),
  musclesHit: z.array(MuscleSchema),
  minutes: z.number().int().min(0),
});
export type WeekSummary = z.infer<typeof WeekSummarySchema>;

export const WeekSchema = z.object({
  id: IdSchema,
  /** Monday of the week. */
  startDate: DayDateSchema,
  /** Sunday of the week. */
  endDate: DayDateSchema,
  isActive: z.boolean(),
  programId: IdSchema,
  programVersion: z.number().int().min(1),
  /** Training sessions only; days with no session are rest days. */
  sessions: z.array(SessionSchema),
  summary: WeekSummarySchema,
});
export type Week = z.infer<typeof WeekSchema>;

/** Home screen: today's session (null on rest days) plus the active week. */
export const TodaySchema = z.object({
  date: DayDateSchema,
  session: SessionSchema.nullable(),
  week: WeekSchema,
});
export type Today = z.infer<typeof TodaySchema>;

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export const MuscleBalanceEntrySchema = z.object({
  group: MuscleGroupSchema,
  /** Sets (or sessions) hit in the period. */
  actual: z.number().int().min(0),
  target: z.number().int().min(0),
});
export type MuscleBalanceEntry = z.infer<typeof MuscleBalanceEntrySchema>;

/** Per-muscle breakdown behind `muscleBalance` (Progress "See every muscle"). */
export const MuscleDetailEntrySchema = z.object({
  muscle: MuscleSchema,
  group: MuscleGroupSchema,
  actual: z.number().int().min(0),
  target: z.number().int().min(0),
});
export type MuscleDetailEntry = z.infer<typeof MuscleDetailEntrySchema>;

export const MostSkippedEntrySchema = z.object({
  exerciseId: IdSchema,
  name: z.string(),
  count: z.number().int().min(1),
  usualReason: SkipReasonSchema,
});
export type MostSkippedEntry = z.infer<typeof MostSkippedEntrySchema>;

export const ProgressStatsSchema = z.object({
  /** 0-100 */
  completionPercent: z.number().min(0).max(100),
  sessionsDone: z.number().int().min(0),
  sessionsPlanned: z.number().int().min(0),
  streakWeeks: z.number().int().min(0),
  muscleBalance: z.array(MuscleBalanceEntrySchema),
  /** Optional per-muscle breakdown, same period and unit as `muscleBalance`. */
  muscleDetail: z.array(MuscleDetailEntrySchema).optional(),
  mostSkipped: z.array(MostSkippedEntrySchema),
  /** True when the server thinks the user is ready for a harder program. */
  levelUpReady: z.boolean(),
});
export type ProgressStats = z.infer<typeof ProgressStatsSchema>;

// ---------------------------------------------------------------------------
// Coach
// ---------------------------------------------------------------------------

export const ChangeLineKindSchema = z.enum(['remove', 'add', 'result']);
export type ChangeLineKind = z.infer<typeof ChangeLineKindSchema>;

export const ChangeLineSchema = z.object({
  kind: ChangeLineKindSchema,
  text: z.string().min(1),
});
export type ChangeLine = z.infer<typeof ChangeLineSchema>;

export const ChangeStatusSchema = z.enum(['pending', 'applied', 'declined']);
export type ChangeStatus = z.infer<typeof ChangeStatusSchema>;

export const CoachChangeProposalSchema = z.object({
  id: IdSchema,
  status: ChangeStatusSchema,
  createdAt: IsoDateTimeSchema,
  title: z.string(),
  lines: z.array(ChangeLineSchema).min(1),
  /** Program version this change was proposed against. */
  baseProgramVersion: z.number().int().min(1),
  /** Program version created when the change was applied. */
  resultingProgramVersion: z.number().int().min(1).optional(),
});
export type CoachChangeProposal = z.infer<typeof CoachChangeProposalSchema>;

export const CoachMessageSchema = z.object({
  id: IdSchema,
  role: z.enum(['user', 'coach']),
  text: z.string().min(1),
  createdAt: IsoDateTimeSchema,
  /** Coach messages may carry a proposed program change. */
  change: CoachChangeProposalSchema.optional(),
});
export type CoachMessage = z.infer<typeof CoachMessageSchema>;

export const SendCoachMessageRequestSchema = z.object({
  text: z.string().trim().min(1).max(2000),
});
export type SendCoachMessageRequest = z.infer<typeof SendCoachMessageRequestSchema>;

export const CoachReplySchema = z.object({
  message: CoachMessageSchema,
  reply: CoachMessageSchema,
});
export type CoachReply = z.infer<typeof CoachReplySchema>;

export const CoachChangeResultSchema = z.object({
  change: CoachChangeProposalSchema,
  /** The program after apply / decline / undo. */
  program: ProgramSchema,
});
export type CoachChangeResult = z.infer<typeof CoachChangeResultSchema>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export const ApiErrorBodySchema = z.object({ error: z.string() });
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;
