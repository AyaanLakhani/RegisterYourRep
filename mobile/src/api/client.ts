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

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = (data && typeof data.error === 'string' && data.error) || `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}
