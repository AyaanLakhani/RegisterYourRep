import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { usePrivy } from '@privy-io/react-auth'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Workcards from './pages/Workcards'

// Guards a route: checks onboarding status and redirects accordingly.
// Session is always established before this runs (see AppRoutes sync).
function AuthGate({ children, requireOnboarded }) {
  const { authenticated, ready } = usePrivy()
  const [checking, setChecking] = useState(true)
  const [onboardingComplete, setOnboardingComplete] = useState(null)

  useEffect(() => {
    if (!ready) return
    if (!authenticated) { setChecking(false); return }

    fetch('/api/user/profile', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setOnboardingComplete(!!data.onboardingComplete))
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [authenticated, ready])

  if (!ready || checking) return <div style={s.loading}>Loading…</div>
  if (!authenticated) return <Navigate to="/" replace />
  if (requireOnboarded && !onboardingComplete) return <Navigate to="/onboarding" replace />
  if (!requireOnboarded && onboardingComplete) return <Navigate to="/dashboard" replace />
  return children
}

// Establishes the server session ONCE before any route is rendered.
// This fixes the loop caused by Google OAuth returning to / with
// authenticated=true but no server session yet.
function AppRoutes() {
  const { authenticated, ready, getAccessToken } = usePrivy()
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    if (!ready) return
    if (!authenticated) { setSessionReady(false); return }

    getAccessToken()
      .then(token =>
        fetch('/auth/privy', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
      )
      .catch(() => {})
      .finally(() => setSessionReady(true))
  }, [authenticated, ready])

  if (!ready || (authenticated && !sessionReady)) {
    return <div style={s.loading}>Loading…</div>
  }

  return (
    <Routes>
      <Route
        path="/"
        element={authenticated ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/onboarding"
        element={
          <AuthGate requireOnboarded={false}>
            <Onboarding />
          </AuthGate>
        }
      />
      <Route
        path="/dashboard"
        element={
          <AuthGate requireOnboarded={true}>
            <Dashboard />
          </AuthGate>
        }
      />
      <Route
        path="/workcards"
        element={
          <AuthGate requireOnboarded={true}>
            <Workcards />
          </AuthGate>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

const s = {
  loading: {
    minHeight: '100vh',
    background: '#0f0f0f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#555',
    fontSize: '14px',
    fontFamily: 'Arial, sans-serif',
  },
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
