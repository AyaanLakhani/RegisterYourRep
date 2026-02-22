import { useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const { login, authenticated, ready, getAccessToken, user } = usePrivy()
  const navigate = useNavigate()

  useEffect(() => {
    if (!ready || !authenticated) return

    // Once Privy authenticates, exchange token for a backend session
    async function syncSession() {
      try {
        const token = await getAccessToken()
        const res = await fetch('/auth/privy', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await res.json()
        if (!data.success) return

        // Check onboarding status
        const profileRes = await fetch('/api/user/profile', { credentials: 'include' })
        const profile = await profileRes.json()

        if (profile.onboardingComplete) {
          navigate('/dashboard')
        } else {
          navigate('/onboarding')
        }
      } catch (err) {
        console.error('Session sync failed:', err)
      }
    }

    syncSession()
  }, [authenticated, ready])

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>RegisterYourRep</h1>
        <p style={styles.subtitle}>Build and track your perfect workout</p>

        <button style={styles.btn} onClick={login}>
          Sign In / Sign Up
        </button>

        <p style={styles.hint}>
          Continue with Google or email — no password needed.
        </p>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f0f0f',
  },
  card: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '16px',
    padding: '48px 40px',
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center',
  },
  title: {
    color: '#fff',
    fontSize: '28px',
    fontWeight: '700',
    margin: '0 0 8px',
    fontFamily: 'Arial, sans-serif',
  },
  subtitle: {
    color: '#888',
    fontSize: '15px',
    margin: '0 0 36px',
    fontFamily: 'Arial, sans-serif',
  },
  btn: {
    width: '100%',
    padding: '14px',
    background: '#ff1e00',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'Arial, sans-serif',
  },
  hint: {
    color: '#555',
    fontSize: '13px',
    marginTop: '16px',
    fontFamily: 'Arial, sans-serif',
  },
}
