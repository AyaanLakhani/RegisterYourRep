import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'

const LEVEL_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  professional: 'Professional',
  unsure: 'Not Sure Yet',
}

const QUOTES = [
  { text: "The only bad workout is the one that didn't happen.", author: "Unknown" },
  { text: "Push yourself because no one else is going to do it for you.", author: "Unknown" },
  { text: "Sweat is just fat crying.", author: "Unknown" },
  { text: "Your body can stand almost anything. It's your mind you have to convince.", author: "Unknown" },
  { text: "Don't wish for it. Work for it.", author: "Unknown" },
  { text: "The pain you feel today will be the strength you feel tomorrow.", author: "Unknown" },
  { text: "Strive for progress, not perfection.", author: "Unknown" },
  { text: "It never gets easier. You just get stronger.", author: "Unknown" },
  { text: "Success starts with self-discipline.", author: "Unknown" },
  { text: "Wake up. Work out. Look hot. Kick ass.", author: "Unknown" },
]

function calcStreak(workouts) {
  if (!workouts.length) return 0
  const days = [...new Set(
    workouts.map(w => new Date(w.savedAt).toDateString())
  )].sort((a, b) => new Date(b) - new Date(a))

  let streak = 0
  let cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  for (const day of days) {
    const d = new Date(day)
    d.setHours(0, 0, 0, 0)
    const diff = Math.round((cursor - d) / 86400000)
    if (diff === 0 || diff === 1) {
      streak++
      cursor = d
    } else {
      break
    }
  }
  return streak
}

function getLast7Days() {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    days.push(d)
  }
  return days
}

function ProgressChart({ workouts }) {
  const days = getLast7Days()
  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const counts = days.map(day => {
    const key = day.toDateString()
    return workouts.filter(w => new Date(w.savedAt).toDateString() === key).length
  })

  const maxCount = Math.max(...counts, 1)
  const today = new Date().toDateString()

  return (
    <div style={s.chartCard}>
      <h2 style={s.sectionTitle}>Last 7 Days</h2>
      <div style={s.chartBars}>
        {days.map((day, i) => {
          const isToday = day.toDateString() === today
          const hasWorkout = counts[i] > 0
          const barHeight = Math.max((counts[i] / maxCount) * 80, hasWorkout ? 12 : 4)

          return (
            <div key={i} style={s.chartCol}>
              <div style={s.barWrapper}>
                <div
                  style={{
                    ...s.bar,
                    height: `${barHeight}px`,
                    background: hasWorkout ? '#ff1e00' : '#2a2a2a',
                    opacity: isToday && !hasWorkout ? 0.5 : 1,
                  }}
                />
              </div>
              <span style={{ ...s.dayLabel, color: isToday ? '#ff1e00' : '#555' }}>
                {DAY_LABELS[day.getDay()]}
              </span>
              {counts[i] > 0 && (
                <span style={s.dayCount}>{counts[i]}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function QuoteCard() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * QUOTES.length))
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % QUOTES.length)
        setVisible(true)
      }, 400)
    }, 7000)
    return () => clearInterval(interval)
  }, [])

  const q = QUOTES[idx]

  return (
    <div style={s.quoteCard}>
      <span style={s.quoteIcon}>"</span>
      <p style={{ ...s.quoteText, opacity: visible ? 1 : 0 }}>
        {q.text}
      </p>
    </div>
  )
}

export default function Dashboard() {
  const { user, logout } = usePrivy()
  const [profile, setProfile] = useState(null)
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/user/profile', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/workouts', { credentials: 'include' }).then(r => r.json()),
    ]).then(([prof, wkts]) => {
      setProfile(prof)
      setWorkouts(Array.isArray(wkts) ? wkts : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function handleLogout() {
    await fetch('/logout', { credentials: 'include' })
    await logout()
  }

  const email = user?.email?.address || user?.google?.email || ''
  const firstName = email ? email.split('@')[0] : 'there'
  const streak = calcStreak(workouts)
  const totalSessions = workouts.length

  return (
    <div style={s.page}>
      {/* Top bar */}
      <div style={s.topBar}>
        <span style={s.logo}>RegisterYourRep</span>
        <button style={s.logoutBtn} onClick={handleLogout}>Logout</button>
      </div>

      <div style={s.content}>
        {loading ? (
          <p style={s.muted}>Loading...</p>
        ) : (
          <>
            <h1 style={s.welcome}>Welcome back, {firstName} 👋</h1>

            {/* Motivational quote */}
            <QuoteCard />

            {/* Stats row */}
            <div style={s.statsRow}>
              <div style={s.statCard}>
                <span style={s.statIcon}>🔥</span>
                <span style={s.statNum}>{streak}</span>
                <span style={s.statLabel}>Day Streak</span>
              </div>
              <div style={s.statCard}>
                <span style={s.statIcon}>💪</span>
                <span style={s.statNum}>{totalSessions}</span>
                <span style={s.statLabel}>Sessions Done</span>
              </div>
              <div style={s.statCard}>
                <span style={s.statIcon}>🎯</span>
                <span style={s.statNum}>{LEVEL_LABELS[profile?.fitnessLevel] || '—'}</span>
                <span style={s.statLabel}>Fitness Level</span>
              </div>
              <div style={s.statCard}>
                <span style={s.statIcon}>⏱️</span>
                <span style={s.statNum}>{profile?.sessionDuration ? `${profile.sessionDuration}m` : '—'}</span>
                <span style={s.statLabel}>Per Session</span>
              </div>
            </div>

            {/* Progress chart */}
            <ProgressChart workouts={workouts} />

            {/* Today's workout plan */}
            <h2 style={{ ...s.sectionTitle, marginTop: '36px' }}>Today's Workout</h2>
            <div style={s.planCard}>
              <div style={s.planIcon}>🏋️</div>
              <h3 style={s.planHeading}>AI Workout Plan</h3>
              <p style={s.planDesc}>
                Your personalized workout will be generated here based on your preferences —
                {profile?.targetMuscles?.length
                  ? ` targeting ${profile.targetMuscles.slice(0, 3).join(', ')}${profile.targetMuscles.length > 3 ? ' & more' : ''}.`
                  : ' set your preferences to get started.'}
              </p>
              <span style={s.badge}>Coming in Phase 2</span>
            </div>

            {/* Past workouts */}
            <h2 style={s.sectionTitle}>Workout History</h2>
            {workouts.length === 0 ? (
              <div style={s.emptyCard}>
                <p style={s.muted}>No workouts logged yet. Complete your first session to see history here.</p>
              </div>
            ) : (
              <div style={s.historyList}>
                {workouts.map((w, i) => (
                  <div key={w._id || i} style={s.historyItem}>
                    <div style={s.historyLeft}>
                      <span style={s.historyDate}>
                        {new Date(w.savedAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })}
                      </span>
                      <span style={s.historyExercises}>
                        {w.exercises?.length || 0} exercise{(w.exercises?.length || 0) !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div style={s.exercisePreview}>
                      {w.exercises?.slice(0, 3).join(' · ')}
                      {w.exercises?.length > 3 ? ` +${w.exercises.length - 3} more` : ''}
                    </div>
                  </div>
                ))}
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
  logo: { color: '#fff', fontWeight: '700', fontSize: '18px' },
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
    maxWidth: '760px',
    margin: '0 auto',
    padding: '40px 24px',
  },
  welcome: {
    color: '#fff',
    fontSize: '26px',
    fontWeight: '700',
    margin: '0 0 20px',
  },
  quoteCard: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderLeft: '3px solid #ff1e00',
    borderRadius: '10px',
    padding: '16px 20px',
    marginBottom: '28px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
  },
  quoteIcon: {
    color: '#ff1e00',
    fontSize: '28px',
    lineHeight: '1',
    fontFamily: 'Georgia, serif',
    flexShrink: 0,
  },
  quoteText: {
    color: '#aaa',
    fontSize: '14px',
    lineHeight: '1.6',
    margin: 0,
    transition: 'opacity 0.4s ease',
    fontStyle: 'italic',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '14px',
    marginBottom: '28px',
  },
  statCard: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    textAlign: 'center',
  },
  statIcon: { fontSize: '22px' },
  statNum: { color: '#fff', fontSize: '20px', fontWeight: '700' },
  statLabel: { color: '#555', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' },
  chartCard: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '20px 24px',
    marginBottom: '0',
  },
  chartBars: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '8px',
    marginTop: '16px',
  },
  chartCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  barWrapper: {
    width: '100%',
    height: '80px',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  bar: {
    width: '100%',
    borderRadius: '4px 4px 0 0',
    transition: 'height 0.3s ease',
    minHeight: '4px',
  },
  dayLabel: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    fontWeight: '600',
  },
  dayCount: {
    color: '#ff1e00',
    fontSize: '11px',
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: '17px',
    fontWeight: '700',
    margin: '0 0 14px',
  },
  planCard: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '28px',
    textAlign: 'center',
    marginBottom: '36px',
  },
  planIcon: { fontSize: '36px', marginBottom: '10px' },
  planHeading: { color: '#fff', fontSize: '17px', fontWeight: '700', margin: '0 0 8px' },
  planDesc: {
    color: '#777',
    fontSize: '14px',
    lineHeight: '1.6',
    maxWidth: '420px',
    margin: '0 auto 18px',
  },
  badge: {
    display: 'inline-block',
    background: '#1f1010',
    border: '1px solid #ff1e00',
    color: '#ff1e00',
    borderRadius: '20px',
    padding: '5px 14px',
    fontSize: '12px',
    fontWeight: '600',
  },
  emptyCard: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '28px',
    textAlign: 'center',
  },
  muted: { color: '#555', fontSize: '14px', margin: 0 },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  historyItem: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '10px',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },
  historyLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: '120px',
  },
  historyDate: { color: '#fff', fontSize: '14px', fontWeight: '600' },
  historyExercises: { color: '#555', fontSize: '12px' },
  exercisePreview: {
    color: '#666',
    fontSize: '13px',
    flex: 1,
    textAlign: 'right',
  },
}
