// In-memory outbox for workout writes (RYR-24).
//
// The workout screen updates its own state first and puts the API call here,
// so ticking an exercise never waits on the network. Calls run one at a time
// in the order they were queued (a swap must reach the server before the log
// for the replacement). A call that fails because of the network or a server
// error stays at the head of the queue and is retried with backoff; a call
// the server rejects (4xx other than 408/429) is dropped.
//
// Not persisted: the queue is lost if the app is killed. Persisting it
// (e.g. SQLite / MMKV) is a follow-up.
import { api, ApiError, type FinishSessionRequest, type LogExerciseRequest, type SessionCompletionSummary } from '../api';

export type QueuedOp =
  | { kind: 'log'; sessionId: string; body: LogExerciseRequest }
  | { kind: 'finish'; sessionId: string; body: FinishSessionRequest };

type Entry = {
  op: QueuedOp;
  attempts: number;
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
};

export type QueueStatus = {
  /** Calls not yet confirmed by the server. */
  pending: number;
  /** True while the head call has failed at least once and is waiting to retry. */
  retrying: boolean;
};

const queue: Entry[] = [];
const listeners = new Set<() => void>();
let running = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let status: QueueStatus = { pending: 0, retrying: false };

const MAX_DELAY_MS = 30_000;

function notify() {
  status = { pending: queue.length, retrying: (queue[0]?.attempts ?? 0) > 0 };
  listeners.forEach((fn) => fn());
}

function isRetryable(err: unknown): boolean {
  if (err instanceof ApiError) return err.status >= 500 || err.status === 408 || err.status === 429;
  // fetch network failures are TypeErrors; anything unknown is treated as transient.
  return true;
}

function run(op: QueuedOp): Promise<unknown> {
  return op.kind === 'log' ? api.logExercise(op.sessionId, op.body) : api.finishSession(op.sessionId, op.body);
}

async function pump() {
  if (running) return;
  running = true;
  clearTimeout(retryTimer);
  retryTimer = undefined;
  while (queue.length > 0) {
    const entry = queue[0];
    try {
      const result = await run(entry.op);
      queue.shift();
      entry.resolve(result);
      notify();
    } catch (err) {
      if (!isRetryable(err)) {
        queue.shift();
        console.warn('[workout] dropped a queued call the server rejected', entry.op, err);
        entry.reject(err);
        notify();
        continue;
      }
      entry.attempts += 1;
      notify();
      const delay = Math.min(MAX_DELAY_MS, 1000 * 2 ** Math.min(entry.attempts - 1, 5));
      running = false;
      retryTimer = setTimeout(pump, delay);
      return;
    }
  }
  running = false;
}

function enqueue<T>(op: QueuedOp): Promise<T> {
  const promise = new Promise<T>((resolve, reject) => {
    queue.push({ op, attempts: 0, resolve: resolve as (v: unknown) => void, reject });
  });
  // Callers may ignore the result; don't surface unhandled rejections for that.
  promise.catch(() => {});
  notify();
  void pump();
  return promise;
}

export const logQueue = {
  log: (sessionId: string, body: LogExerciseRequest) => enqueue({ kind: 'log', sessionId, body }),
  finish: (sessionId: string, body: FinishSessionRequest) =>
    enqueue<SessionCompletionSummary>({ kind: 'finish', sessionId, body }),
  /** Skip the backoff wait and try the head call now. */
  retryNow: () => void pump(),
  getStatus: (): QueueStatus => status,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
