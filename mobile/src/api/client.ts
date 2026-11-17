// Small fetch wrapper for the RegisterYourRep API.
//
// The app signs in with Privy and sends the Privy access token as a bearer
// token. The Privy provider is wired up with the login screen; until then no
// token provider is set and requests go out without auth.
//
// Note: the web API currently authenticates with the iron-session cookie only.
// Accepting `Authorization: Bearer <privy token>` on the server is tracked in
// RYR-30.

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

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, headers, signal: init.signal ?? controller.signal });
  } catch (err) {
    // Status 0: the request never got an HTTP answer (offline, timeout, wrong URL).
    const timedOut = controller.signal.aborted;
    throw new ApiError(0, timedOut ? `No answer from ${BASE_URL} in ${REQUEST_TIMEOUT_MS / 1000}s` : `Can't reach ${BASE_URL}: ${String(err)}`);
  } finally {
    clearTimeout(timer);
  }

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
