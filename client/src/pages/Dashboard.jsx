import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import styles from './Dashboard.module.css'

const LEVEL_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  professional: 'Professional',
  unsure: 'Not Sure Yet',
}

const MUSCLE_LABELS = {
  chest: 'Chest',
  back: 'Back',
  biceps: 'Biceps',
  triceps: 'Triceps',
  shoulders: 'Shoulders',
  core: 'Core',
  quadriceps: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  full_body: 'Full Body',
}

const MUSCLES = Object.entries(MUSCLE_LABELS).map(([id, label]) => ({ id, label }))
const DURATIONS = [15, 30, 45, 60, 90]

const QUOTES = [
  { text: "The only bad workout is the one that didn't happen.", author: 'Unknown' },
  { text: 'Push yourself because no one else is going to do it for you.', author: 'Unknown' },
  { text: 'Sweat is just fat crying.', author: 'Unknown' },
  { text: "Your body can stand almost anything. It's your mind you have to convince.", author: 'Unknown' },
  { text: "Don't wish for it. Work for it.", author: 'Unknown' },
]

function calcStreak(workouts) {
  if (!workouts.length) return 0
  const days = [...new Set(workouts.map(w => new Date(w.savedAt).toDateString()))]
    .sort((a, b) => new Date(b) - new Date(a))

  let streak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  for (const day of days) {
    const d = new Date(day)
    d.setHours(0, 0, 0, 0)
    const diff = Math.round((cursor - d) / 86400000)
    if (diff === 0 || diff === 1) {
      streak += 1
      cursor.setTime(d.getTime())
    } else {
      break
    }
  }

  return streak
}

function getScoreColor(score) {
  if (score >= 80) return '#2da25f'
  if (score >= 50) return '#d6a127'
  return '#ff1e00'
}

function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function CalendarView({ workouts, workcards }) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedKey, setSelectedKey] = useState(null)

  // Build lookup: 'YYYY-MM-DD' -> submitted sessions[]
  const sessionMap = {}
  workouts.forEach(w => {
    if (w.sessionDate) {
      if (!sessionMap[w.sessionDate]) sessionMap[w.sessionDate] = []
      sessionMap[w.sessionDate].push(w)
    }
  })

  // Build lookup: 'YYYY-MM-DD' -> pending workcard (saved but not submitted)
  const pendingMap = {}
  workcards.forEach(wc => {
    if (wc.date && wc.status === 'pending') {
      pendingMap[wc.date] = wc
    }
  })

  // Build grid cells (nulls for leading padding)
  const firstDay = new Date(viewYear, viewMonth, 1)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const calCells = []
  for (let i = 0; i < firstDay.getDay(); i++) calCells.push(null)
  for (let d = 1; d <= daysInMonth; d++) calCells.push(new Date(viewYear, viewMonth, d))
  while (calCells.length % 7 !== 0) calCells.push(null)

  const todayKey = toDateKey(today)
  const selectedSessions = selectedKey ? (sessionMap[selectedKey] || []) : []
  const selectedPending = selectedKey ? (pendingMap[selectedKey] || null) : null

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
    setSelectedKey(null)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
    setSelectedKey(null)
  }

  return (
    <div className={styles.calCard}>
      <div className={styles.calHeader}>
        <h2 className={styles.sectionTitle}>Calendar</h2>
        <div className={styles.calNav}>
          <button className={styles.calNavBtn} onClick={prevMonth}>‹</button>
          <span className={styles.calMonthLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button className={styles.calNavBtn} onClick={nextMonth}>›</button>
        </div>
      </div>

      <div className={styles.calGrid}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className={styles.calDayHeader}>{d}</div>
        ))}
        {calCells.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} className={styles.calEmpty} />
          const key = toDateKey(day)
          const sessions = sessionMap[key] || []
          const pending = pendingMap[key] || null
          const hasSubmitted = sessions.length > 0
          const hasPending = !hasSubmitted && !!pending
          const hasActivity = hasSubmitted || hasPending

          const avgScore = hasSubmitted
            ? Math.round(sessions.reduce((sum, s) => sum + (s.completionScore || 0), 0) / sessions.length)
            : hasPending ? (pending.score || 0) : 0

          const color = hasSubmitted ? getScoreColor(avgScore) : null
          const isToday = key === todayKey
          const isSelected = key === selectedKey

          return (
            <div
              key={key}
              className={styles.calCell}
              style={{
                background: hasSubmitted ? `${color}20` : hasPending ? '#1e1a10' : '#131313',
                border: isSelected && hasSubmitted
                  ? `2px solid ${color}`
                  : isSelected && hasPending
                  ? '2px dashed #d6a127'
                  : isToday
                  ? '2px solid #ff1e00'
                  : hasPending
                  ? '2px dashed #333'
                  : '2px solid transparent',
                cursor: hasActivity ? 'pointer' : 'default',
              }}
              onClick={() => hasActivity && setSelectedKey(isSelected ? null : key)}
            >
              <span className={styles.calDayNum} style={{ color: isToday ? '#ff1e00' : hasSubmitted ? '#fff' : hasPending ? '#888' : '#3a3a3a' }}>
                {day.getDate()}
              </span>
              {hasSubmitted && (
                <span className={styles.calScore} style={{ color }}>{avgScore}%</span>
              )}
              {hasPending && (
                <span className={styles.calScore} style={{ color: '#555' }}>{avgScore > 0 ? `${avgScore}%` : '···'}</span>
              )}
              {sessions.length > 1 && (
                <span className={styles.calMulti}>{sessions.length}×</span>
              )}
            </div>
          )
        })}
      </div>

      <div className={styles.chartLegend}>
        <span className={styles.legendItem}><span style={{ color: '#2da25f' }}>●</span> ≥80% great</span>
        <span className={styles.legendItem}><span style={{ color: '#d6a127' }}>●</span> 50–79% good</span>
        <span className={styles.legendItem}><span style={{ color: '#ff1e00' }}>●</span> &lt;50% keep going</span>
      </div>

      {(selectedSessions.length > 0 || selectedPending) && (
        <div className={styles.calDetail}>
          {selectedSessions.map((session, i) => {
            const scoreColor = getScoreColor(session.completionScore || 0)
            return (
              <div key={i} className={styles.calDetailItem}>
                <div className={styles.calDetailTop}>
                  <div>
                    <p className={styles.calDetailTitle}>{session.dayLabel || 'Workout'}</p>
                    <p className={styles.calDetailMeta}>
                      {selectedKey}{session.sessionWeekday ? ` · ${session.sessionWeekday}` : ''}
                    </p>
                  </div>
                  <span className={styles.calScoreBadge} style={{
                    background: `${scoreColor}20`,
                    border: `1px solid ${scoreColor}`,
                    color: scoreColor,
                  }}>
                    {session.completionScore || 0}%
                  </span>
                </div>
                <p className={styles.calDetailExCount}>
                  {session.completedCount || 0}/{session.totalCount || 0} exercises completed
                </p>
                {session.exercises?.length > 0 && (
                  <div className={styles.calExList}>
                    {session.exercises.slice(0, 6).map((ex, j) => (
                      <span key={j} className={styles.calExChip}>{ex}</span>
                    ))}
                    {session.exercises.length > 6 && (
                      <span className={styles.calExMore}>+{session.exercises.length - 6} more</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {selectedPending && (
            <div className={`${styles.calDetailItem} ${styles.calDetailItemPending}`}>
              <div className={styles.calDetailTop}>
                <div>
                  <p className={styles.calDetailTitle}>{selectedPending.dayLabel || 'Workout'}</p>
                  <p className={styles.calDetailMeta}>
                    {selectedKey}{selectedPending.weekday ? ` · ${selectedPending.weekday}` : ''}
                    {selectedPending.planName ? ` · ${selectedPending.planName}` : ''}
                  </p>
                </div>
                <span className={styles.calInProgressBadge}>In Progress</span>
              </div>
              <p className={styles.calDetailExCount}>
                {selectedPending.completedCount || 0}/{selectedPending.totalCount || 0} exercises checked
                {selectedPending.score > 0 ? ` · ${selectedPending.score}%` : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function submittedWorkcardSessions(workouts) {
  return workouts.filter(w => w?.source === 'workcard')
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
      }, 300)
    }, 6000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className={styles.quoteCard}>
      <span className={styles.quoteIcon}>"</span>
      <p className={styles.quoteText} style={{ opacity: visible ? 1 : 0 }}>
        {QUOTES[idx].text}
      </p>
    </div>
  )
}

function statusStyle(status) {
  if (status === 'ready') return styles.statusReady
  if (status === 'generating') return styles.statusGenerating
  if (status === 'failed') return styles.statusFailed
  return styles.statusDraft
}

export default function Dashboard() {
  const { user, logout, getAccessToken } = usePrivy()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('overview')
  const [profile, setProfile] = useState(null)
  const [workouts, setWorkouts] = useState([])
  const [workcards, setWorkcards] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [plansError, setPlansError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showOverviewGuide, setShowOverviewGuide] = useState(true)
  const [creatingPlan, setCreatingPlan] = useState(false)
  const [generatingPlanId, setGeneratingPlanId] = useState('')
  const [generatingWorkcardsPlanId, setGeneratingWorkcardsPlanId] = useState('')
  const [deletingPlanId, setDeletingPlanId] = useState('')
  const [newPlan, setNewPlan] = useState({
    name: '',
    fitnessLevel: '',
    targetMuscles: [],
    sessionDuration: 45,
    frequency: 3,
    preferences: '',
  })

  async function syncSession() {
    const token = await getAccessToken()
    const res = await fetch('/auth/privy', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data?.error || 'Auth failed')
    }
  }

  async function requestJson(url, options = {}) {
    let res = await fetch(url, { credentials: 'include', ...options })
    if (res.status === 401) {
      await syncSession()
      res = await fetch(url, { credentials: 'include', ...options })
    }

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data?.error || `Request failed (${res.status})`)
    }
    return data
  }

  useEffect(() => {
    Promise.all([
      requestJson('/api/user/profile'),
      requestJson('/api/workouts'),
      requestJson('/api/workout-plans'),
      requestJson('/api/workcards'),
    ])
      .then(([prof, wkts, plns, wcds]) => {
        setProfile(prof)
        setWorkouts(Array.isArray(wkts) ? wkts : [])
        setPlans(Array.isArray(plns) ? plns : [])
        setWorkcards(Array.isArray(wcds) ? wcds : [])
      })
      .catch(() => {
        setPlansError('Failed to load workout ideas.')
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleLogout() {
    await fetch('/logout', { credentials: 'include' })
    await logout()
  }

  function toggleNewPlanMuscle(id) {
    setNewPlan(prev => ({
      ...prev,
      targetMuscles: prev.targetMuscles.includes(id)
        ? prev.targetMuscles.filter(m => m !== id)
        : [...prev.targetMuscles, id],
    }))
  }

  function resetNewPlan() {
    setNewPlan({
      name: '',
      fitnessLevel: '',
      targetMuscles: [],
      sessionDuration: 45,
      frequency: 3,
      preferences: '',
    })
  }

  async function createPlan() {
    if (!newPlan.targetMuscles.length) return
    setCreatingPlan(true)
    setPlansError('')

    try {
      const data = await requestJson('/api/workout-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPlan.name.trim() || `Plan - ${newPlan.targetMuscles.map(m => MUSCLE_LABELS[m] || m).join(', ')}`,
          source: 'custom',
          fitnessLevel: newPlan.fitnessLevel || profile?.fitnessLevel || 'unsure',
          targetMuscles: newPlan.targetMuscles,
          sessionDuration: Number(newPlan.sessionDuration),
          frequency: Number(newPlan.frequency),
          preferences: newPlan.preferences.trim(),
        }),
      })
      if (!data?.success || !data?.plan) {
        throw new Error(data?.error || 'Failed to create plan')
      }

      setPlans(prev => [data.plan, ...prev])
      setShowCreateModal(false)
      resetNewPlan()
      setActiveTab('workout_ideas')
    } catch (err) {
      setPlansError(err.message || 'Failed to create workout idea.')
    } finally {
      setCreatingPlan(false)
    }
  }

  async function generatePlan(planId) {
    setGeneratingPlanId(planId)
    setPlansError('')
    setPlans(prev => prev.map(p => (p._id === planId ? { ...p, status: 'generating', lastError: '' } : p)))

    try {
      const data = await requestJson(`/api/workout-plans/${planId}/generate`, {
        method: 'POST',
      })
      if (!data?.success || !data?.plan) {
        throw new Error(data?.error || 'Failed to generate workout plan')
      }
      setPlans(prev => prev.map(p => (p._id === planId ? data.plan : p)))
    } catch (err) {
      setPlansError(err.message || 'Failed to generate workout plan.')
      setPlans(prev => prev.map(p => (p._id === planId ? { ...p, status: 'failed' } : p)))
    } finally {
      setGeneratingPlanId('')
    }
  }

  async function generateWorkcards(planId) {
    setGeneratingWorkcardsPlanId(planId)
    setPlansError('')
    try {
      const data = await requestJson(`/api/workout-plans/${planId}/workcards`, {
        method: 'POST',
      })
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to generate workcards')
      }
      navigate('/workcards')
    } catch (err) {
      setPlansError(err.message || 'Failed to generate workcards.')
    } finally {
      setGeneratingWorkcardsPlanId('')
    }
  }

  async function deletePlan(plan) {
    const planId = String(plan?._id || '')
    if (!planId) return

    const confirmed = window.confirm(
      `Delete "${plan.name || 'Workout Plan'}"? This will also delete related workcards and workout history from those workcards.`
    )
    if (!confirmed) return

    setDeletingPlanId(planId)
    setPlansError('')
    try {
      const data = await requestJson(`/api/workout-plans/${planId}`, {
        method: 'DELETE',
      })
      if (!data?.success) throw new Error(data?.error || 'Failed to delete workout plan')

      setPlans(prev => prev.filter(p => p._id !== planId))

      // Keep dashboard stats/calendar in sync after cascade delete.
      const [wkts, wcds] = await Promise.all([
        requestJson('/api/workouts'),
        requestJson('/api/workcards'),
      ])
      setWorkouts(Array.isArray(wkts) ? wkts : [])
      setWorkcards(Array.isArray(wcds) ? wcds : [])
    } catch (err) {
      setPlansError(err.message || 'Failed to delete workout plan.')
    } finally {
      setDeletingPlanId('')
    }
  }

  const email = user?.email?.address || user?.google?.email || ''
  const firstName = email ? email.split('@')[0] : 'there'
  const submittedSessions = submittedWorkcardSessions(workouts)
  const streak = calcStreak(submittedSessions)
  const totalSessions = submittedSessions.length

  const last7DayStrings = new Set()
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    last7DayStrings.add(d.toDateString())
  }
  const weekSessions = submittedSessions.filter(w => last7DayStrings.has(new Date(w.savedAt).toDateString()))
  const weekSessionCount = weekSessions.length
  const weekExercises = weekSessions.reduce((sum, s) => sum + (s.completedCount || 0), 0)
  const weekAvgScore = weekSessionCount > 0
    ? Math.round(weekSessions.reduce((sum, s) => sum + (s.completionScore || 0), 0) / weekSessionCount)
    : 0
  const latestPlanLevel = plans.find(p => typeof p?.fitnessLevel === 'string' && p.fitnessLevel.trim())?.fitnessLevel
  const overviewLevel = LEVEL_LABELS[latestPlanLevel] || LEVEL_LABELS[profile?.fitnessLevel] || 'Not set'

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.logoRow}>
          <Logo size={34} />
          <span className={styles.logoText}>RegisterYourRep</span>
        </div>
        <button className={styles.logoutBtn} onClick={handleLogout}>Logout</button>
      </div>

      <div className={styles.content}>
        {loading ? (
          <p className={styles.muted}>Loading...</p>
        ) : (
          <>
            <h1 className={styles.welcome}>Welcome back, {firstName}</h1>

            <div className={styles.tabRow}>
              <button
                className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button
                className={`${styles.tabBtn} ${activeTab === 'workout_ideas' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('workout_ideas')}
              >
                Workout Ideas
              </button>
              <button
                className={`${styles.tabBtn} ${activeTab === 'history' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('history')}
              >
                History
              </button>
              <button
                className={styles.tabBtn}
                onClick={() => navigate('/workcards')}
              >
                Workcards
              </button>
            </div>

            {plansError && <p className={styles.error}>{plansError}</p>}

            {activeTab === 'overview' && (
              <>
                <QuoteCard />
                {showOverviewGuide && (
                  <div className={`${styles.emptyCard} ${styles.overviewGuide}`}>
                    <div className={styles.overviewGuideHeader}>
                      <p className={styles.muted}>
                        New here? Go to <strong>Workout Ideas</strong> to create your first plan and begin your workout tracking journey.
                      </p>
                      <button
                        className={styles.guideCloseBtn}
                        onClick={() => setShowOverviewGuide(false)}
                        aria-label="Close guide"
                      >
                        Close
                      </button>
                    </div>
                    <div style={{ marginTop: '12px' }}>
                      <button
                        className={styles.primaryBtn}
                        onClick={() => setActiveTab('workout_ideas')}
                      >
                        Go To Workout Ideas
                      </button>
                    </div>
                  </div>
                )}

                <div className={styles.statsRow}>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>{streak}</span>
                    <span className={styles.statLabel}>Day Streak</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>{totalSessions}</span>
                    <span className={styles.statLabel}>Total Sessions</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>{weekSessionCount}</span>
                    <span className={styles.statLabel}>This Week</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statNum} style={{ color: weekAvgScore > 0 ? getScoreColor(weekAvgScore) : '#fff' }}>
                      {weekAvgScore > 0 ? `${weekAvgScore}%` : '—'}
                    </span>
                    <span className={styles.statLabel}>Avg Score</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>{weekExercises}</span>
                    <span className={styles.statLabel}>Exercises</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>{overviewLevel}</span>
                    <span className={styles.statLabel}>Level</span>
                  </div>
                </div>

                <CalendarView workouts={submittedSessions} workcards={workcards} />
              </>
            )}

            {activeTab === 'workout_ideas' && (
              <>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Workout Ideas</h2>
                  <button
                    className={styles.primaryBtn}
                    onClick={() => setShowCreateModal(true)}
                  >
                    + New Workout Plan
                  </button>
                </div>

                {plans.length === 0 ? (
                  <div className={styles.emptyCard}>
                    <p className={styles.muted}>No workout ideas yet. Create your first plan to start generating workouts.</p>
                  </div>
                ) : (
                  <div className={styles.ideaGrid}>
                    {plans.map(plan => {
                      const isGenerating = generatingPlanId === plan._id || plan.status === 'generating'
                      const canGenerate = !isGenerating
                      const isGeneratingWorkcards = generatingWorkcardsPlanId === plan._id
                      const canGenerateWorkcards = plan.status === 'ready' && !isGeneratingWorkcards
                      const isDeleting = deletingPlanId === plan._id
                      return (
                        <div key={plan._id} className={styles.ideaCard}>
                          <div className={styles.ideaTopRow}>
                            <h3 className={styles.ideaName}>{plan.name || 'Workout Plan'}</h3>
                            <span className={`${styles.statusBadge} ${statusStyle(plan.status)}`}>
                              {plan.status || 'draft'}
                            </span>
                          </div>

                          <div className={styles.metaRow}>
                            <span className={styles.metaText}>{LEVEL_LABELS[plan.fitnessLevel] || 'Not set'}</span>
                            <span className={styles.metaText}>{plan.sessionDuration ? `${plan.sessionDuration} min` : 'Duration not set'}</span>
                            <span className={styles.metaText}>{plan.frequency ? `${plan.frequency}x / week` : 'Frequency not set'}</span>
                          </div>

                          <div className={styles.chipsRow}>
                            {(plan.targetMuscles || []).map(m => (
                              <span key={`${plan._id}-${m}`} className={styles.muscleTag}>{MUSCLE_LABELS[m] || m}</span>
                            ))}
                          </div>

                          {plan.generatedPlan?.summary && (
                            <p className={styles.planSummary}>{plan.generatedPlan.summary}</p>
                          )}

                          {plan.generatedPlan?.days?.length > 0 && (
                            <div className={styles.previewBox}>
                              {plan.generatedPlan.days.map((day, dayIdx) => (
                                <div key={dayIdx} className={styles.previewDay} style={{ marginBottom: dayIdx < plan.generatedPlan.days.length - 1 ? '12px' : 0 }}>
                                  <span className={styles.previewTitle}>{day.day || `Day ${dayIdx + 1}`}{day.focus?.length > 0 ? ` — ${day.focus.join(', ')}` : ''}</span>
                                  <div className={styles.previewExercises}>
                                    {(day.exercises || []).map((ex, exIdx) => (
                                      <span key={exIdx} className={styles.exerciseRow}>
                                        {ex.name}
                                        {ex.sets && ex.reps ? (
                                          <span className={styles.exerciseSetsReps}> — {ex.sets}×{ex.reps} reps</span>
                                        ) : null}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {plan.lastError && <p className={styles.errorSmall}>{plan.lastError}</p>}

                          <div className={styles.ideaActions}>
                            <button
                              className={`${styles.primaryBtn} ${canGenerate ? '' : styles.btnDisabled}`}
                              onClick={() => canGenerate && generatePlan(plan._id)}
                              disabled={!canGenerate}
                            >
                              {isGenerating ? 'Generating...' : plan.status === 'ready' ? 'Regenerate Workout' : 'Generate Workout'}
                            </button>
                            <button
                              className={`${styles.ghostBtn} ${canGenerateWorkcards ? '' : styles.btnDisabledGhost}`}
                              onClick={() => canGenerateWorkcards && generateWorkcards(plan._id)}
                              disabled={!canGenerateWorkcards}
                            >
                              {isGeneratingWorkcards ? 'Generating Cards...' : 'Generate Workcards'}
                            </button>
                            <button
                              className={`${styles.ghostBtn} ${isDeleting ? styles.btnDisabledGhost : ''}`}
                              onClick={() => !isDeleting && deletePlan(plan)}
                              disabled={isDeleting}
                            >
                              {isDeleting ? 'Deleting...' : 'Delete Plan'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {activeTab === 'history' && (
              <>
                <h2 className={styles.sectionTitle}>Workout History</h2>
                {workouts.length === 0 ? (
                  <div className={styles.emptyCard}>
                    <p className={styles.muted}>No workouts logged yet. Complete your first session to see history here.</p>
                  </div>
                ) : (
                  <div className={styles.historyList}>
                    {workouts.map((w, i) => (
                      <div key={w._id || i} className={styles.historyItem}>
                        <div className={styles.historyLeft}>
                          <span className={styles.historyDate}>
                            {new Date(w.savedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          <span className={styles.historyExercises}>
                            {w.source === 'workcard'
                              ? `${w.completedCount || 0}/${w.totalCount || 0} complete (${w.completionScore || 0}%)`
                              : `${w.exercises?.length || 0} exercise${(w.exercises?.length || 0) !== 1 ? 's' : ''}`}
                          </span>
                        </div>
                        <div className={styles.exercisePreview}>
                          {w.source === 'workcard'
                            ? `${w.dayLabel || 'Workout Day'}${w.sessionWeekday ? ` | ${w.sessionWeekday}` : ''}${w.sessionDate ? ` | ${w.sessionDate}` : ''}`
                            : `${w.exercises?.slice(0, 3).join(' | ')}${w.exercises?.length > 3 ? ` +${w.exercises.length - 3} more` : ''}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {showCreateModal && (
        <div className={styles.modalBackdrop} onClick={() => !creatingPlan && setShowCreateModal(false)}>
          <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>New Workout Plan</h3>

            <label className={styles.label}>Plan name</label>
            <input
              className={styles.input}
              value={newPlan.name}
              onChange={e => setNewPlan(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Upper Body Focus"
            />

            <label className={styles.label}>Fitness level</label>
            <select
              className={styles.select}
              value={newPlan.fitnessLevel}
              onChange={e => setNewPlan(prev => ({ ...prev, fitnessLevel: e.target.value }))}
            >
              <option value="">Use profile level</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="professional">Professional</option>
              <option value="unsure">Not Sure Yet</option>
            </select>

            <label className={styles.label}>Target muscles</label>
            <div className={styles.modalMuscleGrid}>
              {MUSCLES.map(m => (
                <button
                  type="button"
                  key={m.id}
                  className={`${styles.muscleChip} ${newPlan.targetMuscles.includes(m.id) ? styles.muscleChipActive : ''}`}
                  onClick={() => toggleNewPlanMuscle(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <label className={styles.label}>Session length</label>
            <div className={styles.durationRow}>
              {DURATIONS.map(d => (
                <button
                  type="button"
                  key={d}
                  className={`${styles.durationBtn} ${newPlan.sessionDuration === d ? styles.durationBtnActive : ''}`}
                  onClick={() => setNewPlan(prev => ({ ...prev, sessionDuration: d }))}
                >
                  {d}m
                </button>
              ))}
            </div>

            <label className={styles.label}>Days per week</label>
            <input
              className={styles.slider}
              type="range"
              min={1}
              max={7}
              value={newPlan.frequency}
              onChange={e => setNewPlan(prev => ({ ...prev, frequency: Number(e.target.value) }))}
            />
            <p className={styles.sliderHint}>{newPlan.frequency} days / week</p>

            <label className={styles.label}>Preferences</label>
            <textarea
              className={styles.textarea}
              rows={3}
              value={newPlan.preferences}
              onChange={e => setNewPlan(prev => ({ ...prev, preferences: e.target.value }))}
              placeholder="Any injuries, equipment limits, or constraints"
            />

            <div className={styles.modalActions}>
              <button
                className={styles.ghostBtn}
                onClick={() => !creatingPlan && setShowCreateModal(false)}
                disabled={creatingPlan}
              >
                Cancel
              </button>
              <button
                className={`${styles.primaryBtn} ${(creatingPlan || !newPlan.targetMuscles.length) ? styles.btnDisabled : ''}`}
                onClick={createPlan}
                disabled={creatingPlan || !newPlan.targetMuscles.length}
              >
                {creatingPlan ? 'Creating...' : 'Create Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

