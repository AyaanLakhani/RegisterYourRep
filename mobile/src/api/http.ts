// DataSource backed by the real API (paths from contract.md).
//
// Stub until the /api/v1 routes exist on the server. Responses are parsed with
// the shared schemas so a contract mismatch fails loudly instead of rendering
// half-broken screens.
import type { z } from 'zod';
import { ApiError, apiFetch } from './client';
import type { DataSource } from './dataSource';
import {
  CoachChangeResultSchema,
  CoachReplySchema,
  ExerciseCatalogEntrySchema,
  GenerationJobSchema,
  ProfileSchema,
  ProgramProposalSchema,
  ProgramSchema,
  ProgramWithVersionsSchema,
  ProgressStatsSchema,
  SessionCompletionSummarySchema,
  SessionSchema,
  TodaySchema,
  WeekSchema,
} from './schemas';

const V1 = '/api/v1';
const enc = encodeURIComponent;

async function call<S extends z.ZodType>(schema: S, path: string, method = 'GET', body?: unknown): Promise<z.infer<S>> {
  const data = await apiFetch<unknown>(`${V1}${path}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    console.warn(`[api] ${method} ${path} response did not match the contract`, parsed.error.issues[0]);
    throw new ApiError(502, 'Unexpected response from server');
  }
  return parsed.data;
}

const CatalogListSchema = ExerciseCatalogEntrySchema.array();

export const httpDataSource: DataSource = {
  getProfile: () => call(ProfileSchema.nullable(), '/profile'),
  saveProfile: (input) => call(ProfileSchema, '/profile', 'PUT', input),
  getFamiliarityOptions: (equipment) =>
    call(
      CatalogListSchema,
      equipment ? `/catalog/familiarity?equipment=${encodeURIComponent(equipment.join(','))}` : '/catalog/familiarity',
    ),

  startGeneration: () => call(GenerationJobSchema, '/generation-jobs', 'POST', {}),
  getGenerationJob: (jobId) => call(GenerationJobSchema, `/generation-jobs/${enc(jobId)}`),
  getProposal: (proposalId) => call(ProgramProposalSchema, `/proposals/${enc(proposalId)}`),
  acceptProposal: (proposalId, body) => call(ProgramSchema, `/proposals/${enc(proposalId)}/accept`, 'POST', body),

  getProgram: () => call(ProgramWithVersionsSchema, '/program'),
  getProgramVersion: (version) => call(ProgramSchema, `/program/versions/${version}`),
  saveDayMoves: (body) => call(ProgramSchema, '/program/day-moves', 'POST', body),

  getToday: () => call(TodaySchema, '/today'),
  getCurrentWeek: () => call(WeekSchema, '/weeks/current'),
  getWeek: (startDate) => call(WeekSchema, `/weeks/${enc(startDate)}`),
  getSession: (sessionId) => call(SessionSchema, `/sessions/${enc(sessionId)}`),
  moveSession: (sessionId, toDate) => call(WeekSchema, `/sessions/${enc(sessionId)}/move`, 'POST', { toDate }),
  logExercise: (sessionId, body) => call(SessionSchema, `/sessions/${enc(sessionId)}/logs`, 'POST', body),
  finishSession: (sessionId, body = {}) =>
    call(SessionCompletionSummarySchema, `/sessions/${enc(sessionId)}/finish`, 'POST', body),

  getProgress: () => call(ProgressStatsSchema, '/progress'),

  getAlternatives: (exerciseId) => call(CatalogListSchema, `/catalog/${enc(exerciseId)}/alternatives`),

  sendCoachMessage: (body) => call(CoachReplySchema, '/coach/messages', 'POST', body),
  applyChange: (changeId) => call(CoachChangeResultSchema, `/coach/changes/${enc(changeId)}/apply`, 'POST', {}),
  declineChange: (changeId) => call(CoachChangeResultSchema, `/coach/changes/${enc(changeId)}/decline`, 'POST', {}),
  undoChange: (changeId) => call(CoachChangeResultSchema, `/coach/changes/${enc(changeId)}/undo`, 'POST', {}),
};
