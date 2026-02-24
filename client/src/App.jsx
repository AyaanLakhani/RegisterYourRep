import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { usePrivy } from '@privy-io/react-auth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Workcards from './pages/Workcards'
import './App.css'

function AuthGate({ children }) {
  const { authenticated, ready } = usePrivy()

  if (!ready) return <div className="loading">Loading...</div>
  if (!authenticated) return <Navigate to="/" replace />
  return children
}

// Establishes the server session ONCE before any route is rendered.
function AppRoutes() {
  const { authenticated, ready, getAccessToken } = usePrivy()
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    if (!ready) return
    if (!authenticated) {
      setSessionReady(false)
      return
    }

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
  }, [authenticated, ready, getAccessToken])

  if (!ready || (authenticated && !sessionReady)) {
    return <div className="loading">Loading...</div>
  }

  return (
    <Routes>
      <Route
        path="/"
        element={authenticated ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/onboarding"
        element={<Navigate to={authenticated ? '/dashboard' : '/'} replace />}
      />
      <Route
        path="/dashboard"
        element={
          <AuthGate>
            <Dashboard />
          </AuthGate>
        }
      />
      <Route
        path="/workcards"
        element={
          <AuthGate>
            <Workcards />
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
