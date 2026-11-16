// Hand-off between the workout screen (RYR-24) and the workout complete
// screen (RYR-25).
//
// When the workout screen gets the SessionCompletionSummary back from
// `api.finishSession`, it stores it here before navigating. The complete
// screen reads it by session id and falls back to re-fetching from the API
// when it isn't here (e.g. the finish is still waiting to sync).
//
// In memory only: it lives for the app run.
import type { SessionCompletionSummary } from '../api';

const summaries = new Map<string, SessionCompletionSummary>();

export function rememberCompletion(summary: SessionCompletionSummary): void {
  summaries.set(summary.session.id, summary);
}

export function getRememberedCompletion(sessionId: string): SessionCompletionSummary | undefined {
  return summaries.get(sessionId);
}
