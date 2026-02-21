import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { usePrivy } from '@privy-io/react-auth'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'

// Wrapper that handles post-login redirect logic
function AuthGate({ children, requireOnboarded }) {
  const { authenticated, ready } = usePrivy()
  const [checking, setChecking] = useState(true)
  const [onboardingComplete, setOnboardingComplete] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!ready) return
    if (!authenticated) {
      setChecking(false)
      return
    }
    fetch('/api/user/profile', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setOnboardingComplete(!!data.onboardingComplete)
        setChecking(false)
      })
      .catch(() => setChecking(false))
  }, [authenticated, ready])

  if (!ready || checking) return <div className="loading">Loading...</div>
  if (!authenticated) return <Navigate to="/" replace />

  if (requireOnboarded && !onboardingComplete) return <Navigate to="/onboarding" replace />
  if (!requireOnboarded && onboardingComplete) return <Navigate to="/dashboard" replace />

  return children
}

function AppRoutes() {
  const { authenticated, ready } = usePrivy()

  if (!ready) return <div className="loading">Loading...</div>

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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
