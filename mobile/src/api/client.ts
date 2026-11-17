// Small fetch wrapper for the RegisterYourRep API.
//
// The app signs in with Privy and sends the Privy access token as
// `Authorization: Bearer <token>`; the API accepts it on every protected route
// (RYR-34). src/auth/AuthProvider sets the token provider after login; before
// that (or with login off) requests go out without auth.
//
// On a phone, EXPO_PUBLIC_API_URL must be the computer's network address
// (e.g. http://192.168.1.184:3000): localhost would be the phone itself.

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

type TokenProvider = () => Promise<string | null>;
let getToken: TokenProvider = async () => null;

export function setTokenProvider(provider: TokenProvider) {
  getToken = provider;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// A request that gets no answer in this time fails, instead of leaving the
// screen on "Loading…" or "Saving…" (e.g. a phone that can't reach the API).
const REQUEST_TIMEOUT_MS = 15_000;
// Ask Coach answers inside the request (one AI call, up to ~50s on the server).
const SLOW_PATHS: { pattern: RegExp; timeoutMs: number }[] = [{ pattern: /\/coach\/messages$/, timeoutMs: 65_000 }];
const timeoutFor = (path: string) => SLOW_PATHS.find((p) => p.pattern.test(path))?.timeoutMs ?? REQUEST_TIMEOUT_MS;

// The server works out "today" in the user's time zone (contract: calendar
// days are local), so every request says which one that is.
const TIME_ZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
})();

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  let res = await send(path, init, token);
  // An expired token gets a 401: ask Privy for a fresh one and retry once.
  if (res.status === 401 && token) {
    const fresh = await getToken();
    if (fresh) res = await send(path, init, fresh);
  }
  return readResponse<T>(res);
}

async function send(path: string, init: RequestInit, token: string | null): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('X-Time-Zone', TIME_ZONE);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const controller = new AbortController();
  const timeoutMs = timeoutFor(path);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, headers, signal: init.signal ?? controller.signal });
  } catch (err) {
    // Status 0: the request never got an HTTP answer (offline, timeout, wrong URL).
    const timedOut = controller.signal.aborted;
    throw new ApiError(
      0,
      timedOut
        ? `No answer from ${BASE_URL} in ${timeoutMs / 1000}s`
        : `Can't reach ${BASE_URL}: ${String(err)}`,
    );
  } finally {
    clearTimeout(timer);
  }
  return res;
}

async function readResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON (e.g. an HTML 404 page for an endpoint that doesn't exist yet).
    data = null;
  }

  if (!res.ok) {
    const serverError = (data as { error?: unknown } | null)?.error;
    const message = (typeof serverError === 'string' && serverError) || `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}
