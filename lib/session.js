// lib/session.js
export const sessionOptions = {
  password: process.env.SESSION_SECRET,
  cookieName: 'ryr_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax',
    httpOnly: true,
  },
}

// Helper: get session from req/res in Pages Router API routes
export async function getSession(req, res) {
  const { getIronSession } = await import('iron-session')
  return getIronSession(req, res, sessionOptions)
}
