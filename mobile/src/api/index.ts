// Entry point for data access. Screens import `api` from here.
//
// Mock data is the default. Set EXPO_PUBLIC_USE_MOCKS=false to talk to the
// real API at EXPO_PUBLIC_API_URL.
import type { DataSource } from './dataSource';
import { httpDataSource } from './http';
import { mockDataSource } from './mock';

export const usingMocks = process.env.EXPO_PUBLIC_USE_MOCKS !== 'false';

export const api: DataSource = usingMocks ? mockDataSource : httpDataSource;

export type { DataSource } from './dataSource';
export { httpDataSource } from './http';
export { ApiError, setTokenProvider } from './client';
export { useQuery } from './useQuery';
export * from './schemas';
