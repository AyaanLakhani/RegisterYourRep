// Entry point for data access. Screens import `api` from here.
//
// Mock data is the default. Set EXPO_PUBLIC_USE_MOCKS=false to talk to the
// real API at EXPO_PUBLIC_API_URL.
//
// While the /api/v1 endpoints are being built (RYR-36 to RYR-41), real mode
// uses the server for the methods in REAL_METHODS and mock data for the rest,
// so each finished part can be tried without waiting for the others. Add
// methods here as their endpoints land; when every method is listed, real
// mode is fully real.
import type { DataSource } from './dataSource';
import { httpDataSource } from './http';
import { mockDataSource } from './mock';

export const usingMocks = process.env.EXPO_PUBLIC_USE_MOCKS !== 'false';

const REAL_METHODS = new Set<keyof DataSource>([
  // RYR-36: profile and exercise catalog (onboarding)
  'getProfile',
  'saveProfile',
  'getFamiliarityOptions',
  // RYR-37: generation, proposal, program versions
  'startGeneration',
  'getGenerationJob',
  'getProposal',
  'acceptProposal',
  'getPendingProposal',
  'getProgram',
  'getProgramVersion',
  'saveDayMoves',
  // RYR-38: today, weeks, sessions, logging
  'getToday',
  'getCurrentWeek',
  'getWeek',
  'getSession',
  'moveSession',
  'logExercise',
  'finishSession',
  // RYR-39: progress and swap alternatives
  'getProgress',
  'getAlternatives',
  // RYR-40: Ask Coach
  'getCoachMessages',
  'sendCoachMessage',
  'applyChange',
  'declineChange',
  'undoChange',
]);

function hybridDataSource(): DataSource {
  const source = {} as Record<keyof DataSource, unknown>;
  for (const key of Object.keys(httpDataSource) as (keyof DataSource)[]) {
    source[key] = REAL_METHODS.has(key) ? httpDataSource[key] : mockDataSource[key];
  }
  const real = source as unknown as DataSource;
  // Mock generation reads the mock's profile, so mirror real saves into it.
  return {
    ...real,
    saveProfile: async (input) => {
      const saved = await httpDataSource.saveProfile(input);
      await mockDataSource.saveProfile(input);
      return saved;
    },
  };
}

if (__DEV__ && !usingMocks) {
  const mocked = (Object.keys(httpDataSource) as (keyof DataSource)[]).filter((k) => !REAL_METHODS.has(k));
  console.info(`[api] Real API for: ${[...REAL_METHODS].join(', ')}. Still mock: ${mocked.join(', ')}.`);
}

export const api: DataSource = usingMocks ? mockDataSource : hybridDataSource();

export type { DataSource } from './dataSource';
export { httpDataSource } from './http';
export { ApiError, setTokenProvider } from './client';
export { useQuery } from './useQuery';
export * from './schemas';
export { GYM_TYPE_PRESETS, canDoWith, suggestLevel } from './level';
