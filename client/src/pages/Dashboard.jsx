import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'

const LEVEL_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  professional: 'Professional',
  unsure: 'Not Sure Yet',
}

export default function Dashboard() {
  const { user, logout } = usePrivy()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/user/profile', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setProfile(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleLogout() {
    await fetch('/logout', { credentials: 'include' })
    await logout()
  }

  const email = user?.email?.address || user?.google?.email || 'there'
  const firstName = email.split('@')[0]

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <span style={s.logo}>RegisterYourRep</span>
        <button style={s.logoutBtn} onClick={handleLogout}>Logout</button>
      </div>

      <div style={s.content}>
        {loading ? (
          <p style={{ color: '#888' }}>Loading your profile...</p>
        ) : (
          <>
            <h1 style={s.welcome}>Welcome back, {firstName} 👋</h1>

            {/* Profile summary */}
            <div style={s.summaryGrid}>
              <div style={s.summaryCard}>
                <span style={s.cardLabel}>Fitness Level</span>
                <span style={s.cardValue}>{LEVEL_LABELS[profile?.fitnessLevel] || '—'}</span>
              </div>
              <div style={s.summaryCard}>
                <span style={s.cardLabel}>Target Muscles</span>
                <span style={s.cardValue}>
                  {profile?.targetMuscles?.length
                    ? profile.targetMuscles.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(', ')
                    : '—'}
                </span>
              </div>
              <div style={s.summaryCard}>
                <span style={s.cardLabel}>Frequency</span>
                <span style={s.cardValue}>{profile?.frequency ? `${profile.frequency}x / week` : '—'}</span>
              </div>
              <div style={s.summaryCard}>
                <span style={s.cardLabel}>Session Length</span>
                <span style={s.cardValue}>{profile?.sessionDuration ? `${profile.sessionDuration} min` : '—'}</span>
              </div>
            </div>

            {/* Workout plan placeholder */}
            <div style={s.planCard}>
              <div style={s.planIcon}>🏋️</div>
              <h2 style={s.planTitle}>Your AI Workout Plan</h2>
              <p style={s.planDesc}>
                AI-generated workouts are coming in the next phase. Your preferences are saved
                and ready — we'll use them to generate a personalized plan tailored to your goals.
              </p>
              <div style={s.comingSoonBadge}>Coming Soon</div>
            </div>

            {profile?.preferences && (
              <div style={s.notesCard}>
                <span style={s.cardLabel}>Your Notes</span>
                <p style={s.notesText}>{profile.preferences}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#0f0f0f',
    fontFamily: 'Arial, sans-serif',
  },
  topBar: {
    background: '#1a1a1a',
    borderBottom: '1px solid #2a2a2a',
    padding: '16px 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    color: '#fff',
    fontWeight: '700',
    fontSize: '18px',
  },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid #444',
    borderRadius: '8px',
    padding: '8px 16px',
    color: '#888',
    fontSize: '14px',
    cursor: 'pointer',
  },
  content: {
    maxWidth: '720px',
    margin: '0 auto',
    padding: '40px 24px',
  },
  welcome: {
    color: '#fff',
    fontSize: '28px',
    fontWeight: '700',
    marginBottom: '28px',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '28px',
  },
  summaryCard: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  cardLabel: {
    color: '#555',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  cardValue: {
    color: '#fff',
    fontSize: '15px',
    fontWeight: '600',
  },
  planCard: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '32px',
    textAlign: 'center',
    marginBottom: '20px',
  },
  planIcon: {
    fontSize: '40px',
    marginBottom: '12px',
  },
  planTitle: {
    color: '#fff',
    fontSize: '20px',
    fontWeight: '700',
    margin: '0 0 10px',
  },
  planDesc: {
    color: '#777',
    fontSize: '14px',
    lineHeight: '1.6',
    maxWidth: '440px',
    margin: '0 auto 20px',
  },
  comingSoonBadge: {
    display: 'inline-block',
    background: '#2a1010',
    border: '1px solid #ff1e00',
    color: '#ff1e00',
    borderRadius: '20px',
    padding: '6px 16px',
    fontSize: '13px',
    fontWeight: '600',
  },
  notesCard: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  notesText: {
    color: '#aaa',
    fontSize: '14px',
    margin: 0,
    lineHeight: '1.5',
  },
}
