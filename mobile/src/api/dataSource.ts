// The data-access interface screens use (RYR-30).
//
// One async method per endpoint in contract.md. Two implementations:
//   - mock/   in-memory sample data (default while the backend is built)
//   - http.ts the real API via apiFetch
import type {
  AcceptProposalRequest,
  CoachChangeResult,
  CoachReply,
  DayDate,
  ExerciseCatalogEntry,
  FinishSessionRequest,
  GenerationJob,
  LogExerciseRequest,
  Profile,
  ProfileInput,
  Program,
  ProgramProposal,
  ProgramWithVersions,
  ProgressStats,
  SaveDayMovesRequest,
  SendCoachMessageRequest,
  Session,
  SessionCompletionSummary,
  Today,
  Week,
} from './schemas';

export interface DataSource {
  // Profile
  /** Current profile, or null before onboarding. */
  getProfile(): Promise<Profile | null>;
  /** Saves answers as a new profile version. */
  saveProfile(input: ProfileInput): Promise<Profile>;
  /** Catalog entries shown on the onboarding "which of these do you know?" step. */
  getFamiliarityOptions(): Promise<ExerciseCatalogEntry[]>;

  // Generation
  startGeneration(): Promise<GenerationJob>;
  getGenerationJob(jobId: string): Promise<GenerationJob>;
  getProposal(proposalId: string): Promise<ProgramProposal>;
  acceptProposal(proposalId: string, body: AcceptProposalRequest): Promise<Program>;

  // Program
  getProgram(): Promise<ProgramWithVersions>;
  getProgramVersion(version: number): Promise<Program>;
  saveDayMoves(body: SaveDayMovesRequest): Promise<Program>;

  // Today / week / sessions
  getToday(): Promise<Today>;
  getCurrentWeek(): Promise<Week>;
  /** Any week, by its Monday (YYYY-MM-DD). */
  getWeek(startDate: DayDate): Promise<Week>;
  getSession(sessionId: string): Promise<Session>;
  moveSession(sessionId: string, toDate: DayDate): Promise<Week>;
  logExercise(sessionId: string, body: LogExerciseRequest): Promise<Session>;
  finishSession(sessionId: string, body?: FinishSessionRequest): Promise<SessionCompletionSummary>;

  // Progress
  getProgress(): Promise<ProgressStats>;

  // Catalog
  getAlternatives(exerciseId: string): Promise<ExerciseCatalogEntry[]>;

  // Coach
  sendCoachMessage(body: SendCoachMessageRequest): Promise<CoachReply>;
  applyChange(changeId: string): Promise<CoachChangeResult>;
  declineChange(changeId: string): Promise<CoachChangeResult>;
  undoChange(changeId: string): Promise<CoachChangeResult>;
}
