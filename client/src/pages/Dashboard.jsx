import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'

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

function getLast7Days() {
  const days = []
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    days.push(d)
  }
  return days
}

function ProgressChart({ workouts }) {
  const days = getLast7Days()
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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
            <div key={day.toISOString()} style={s.chartCol}>
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
                {dayLabels[day.getDay()]}
              </span>
              {counts[i] > 0 && <span style={s.dayCount}>{counts[i]}</span>}
            </div>
          )
        })}
      </div>
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
    <div style={s.quoteCard}>
      <span style={s.quoteIcon}>"</span>
      <p style={{ ...s.quoteText, opacity: visible ? 1 : 0 }}>
        {QUOTES[idx].text}
      </p>
    </div>
  )
}

function statusStyle(status) {
  if (status === 'ready') return s.statusReady
  if (status === 'generating') return s.statusGenerating
  if (status === 'failed') return s.statusFailed
  return s.statusDraft
}

export default function Dashboard() {
  const { user, logout, getAccessToken } = usePrivy()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('overview')
  const [profile, setProfile] = useState(null)
  const [workouts, setWorkouts] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [plansError, setPlansError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creatingPlan, setCreatingPlan] = useState(false)
  const [generatingPlanId, setGeneratingPlanId] = useState('')
  const [generatingWorkcardsPlanId, setGeneratingWorkcardsPlanId] = useState('')
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
    ])
      .then(([prof, wkts, plns]) => {
        setProfile(prof)
        setWorkouts(Array.isArray(wkts) ? wkts : [])
        setPlans(Array.isArray(plns) ? plns : [])
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

  const email = user?.email?.address || user?.google?.email || ''
  const firstName = email ? email.split('@')[0] : 'there'
  const submittedSessions = submittedWorkcardSessions(workouts)
  const streak = calcStreak(submittedSessions)
  const totalSessions = submittedSessions.length

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div style={s.logoRow}>
          <Logo size={34} />
          <span style={s.logoText}>RegisterYourRep</span>
        </div>
        <button style={s.logoutBtn} onClick={handleLogout}>Logout</button>
      </div>

      <div style={s.content}>
        {loading ? (
          <p style={s.muted}>Loading...</p>
        ) : (
          <>
            <h1 style={s.welcome}>Welcome back, {firstName}</h1>

            <div style={s.tabRow}>
              <button
                style={{ ...s.tabBtn, ...(activeTab === 'overview' ? s.tabBtnActive : {}) }}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button
                style={{ ...s.tabBtn, ...(activeTab === 'workout_ideas' ? s.tabBtnActive : {}) }}
                onClick={() => setActiveTab('workout_ideas')}
              >
                Workout Ideas
              </button>
              <button
                style={{ ...s.tabBtn, ...(activeTab === 'history' ? s.tabBtnActive : {}) }}
                onClick={() => setActiveTab('history')}
              >
                History
              </button>
              <button
                style={s.tabBtn}
                onClick={() => navigate('/workcards')}
              >
                Workcards
              </button>
            </div>

            {plansError && <p style={s.error}>{plansError}</p>}

            {activeTab === 'overview' && (
              <>
                <QuoteCard />

                <div style={s.statsRow}>
                  <div style={s.statCard}>
                    <span style={s.statNum}>{streak}</span>
                    <span style={s.statLabel}>Day Streak</span>
                  </div>
                  <div style={s.statCard}>
                    <span style={s.statNum}>{totalSessions}</span>
                    <span style={s.statLabel}>Sessions Done</span>
                  </div>
                  <div style={s.statCard}>
                    <span style={s.statNum}>{LEVEL_LABELS[profile?.fitnessLevel] || '-'}</span>
                    <span style={s.statLabel}>Fitness Level</span>
                  </div>
                  <div style={s.statCard}>
                    <span style={s.statNum}>{profile?.sessionDuration ? `${profile.sessionDuration}m` : '-'}</span>
                    <span style={s.statLabel}>Per Session</span>
                  </div>
                </div>

                <ProgressChart workouts={submittedSessions} />
              </>
            )}

            {activeTab === 'workout_ideas' && (
              <>
                <div style={s.sectionHeader}>
                  <h2 style={s.sectionTitle}>Workout Ideas</h2>
                  <button
                    style={s.primaryBtn}
                    onClick={() => setShowCreateModal(true)}
                  >
                    + New Workout Plan
                  </button>
                </div>

                {plans.length === 0 ? (
                  <div style={s.emptyCard}>
                    <p style={s.muted}>No workout ideas yet. Create your first plan to start generating workouts.</p>
                  </div>
                ) : (
                  <div style={s.ideaGrid}>
                    {plans.map(plan => {
                      const isGenerating = generatingPlanId === plan._id || plan.status === 'generating'
                      const canGenerate = !isGenerating
                      const isGeneratingWorkcards = generatingWorkcardsPlanId === plan._id
                      const canGenerateWorkcards = plan.status === 'ready' && !isGeneratingWorkcards
                      return (
                        <div key={plan._id} style={s.ideaCard}>
                          <div style={s.ideaTopRow}>
                            <h3 style={s.ideaName}>{plan.name || 'Workout Plan'}</h3>
                            <span style={{ ...s.statusBadge, ...statusStyle(plan.status) }}>
                              {plan.status || 'draft'}
                            </span>
                          </div>

                          <div style={s.metaRow}>
                            <span style={s.metaText}>{LEVEL_LABELS[plan.fitnessLevel] || 'Not set'}</span>
                            <span style={s.metaText}>{plan.sessionDuration ? `${plan.sessionDuration} min` : 'Duration not set'}</span>
                            <span style={s.metaText}>{plan.frequency ? `${plan.frequency}x / week` : 'Frequency not set'}</span>
                          </div>

                          <div style={s.chipsRow}>
                            {(plan.targetMuscles || []).map(m => (
                              <span key={`${plan._id}-${m}`} style={s.muscleTag}>{MUSCLE_LABELS[m] || m}</span>
                            ))}
                          </div>

                          {plan.generatedPlan?.summary && (
                            <p style={s.planSummary}>{plan.generatedPlan.summary}</p>
                          )}

                          {plan.generatedPlan?.days?.length > 0 && (
                            <div style={s.previewBox}>
                              {plan.generatedPlan.days.map((day, dayIdx) => (
                                <div key={dayIdx} style={{ marginBottom: dayIdx < plan.generatedPlan.days.length - 1 ? '12px' : 0 }}>
                                  <span style={s.previewTitle}>{day.day || `Day ${dayIdx + 1}`}{day.focus?.length > 0 ? ` — ${day.focus.join(', ')}` : ''}</span>
                                  <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    {(day.exercises || []).map((ex, exIdx) => (
                                      <span key={exIdx} style={s.exerciseRow}>
                                        {ex.name}
                                        {ex.sets && ex.reps ? (
                                          <span style={s.exerciseSetsReps}> — {ex.sets}×{ex.reps} reps</span>
                                        ) : null}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {plan.lastError && <p style={s.errorSmall}>{plan.lastError}</p>}

                          <div style={s.ideaActions}>
                            <button
                              style={{ ...s.primaryBtn, ...(canGenerate ? {} : s.btnDisabled) }}
                              onClick={() => canGenerate && generatePlan(plan._id)}
                              disabled={!canGenerate}
                            >
                              {isGenerating ? 'Generating...' : plan.status === 'ready' ? 'Regenerate Workout' : 'Generate Workout'}
                            </button>
                            <button
                              style={{ ...s.ghostBtn, ...(canGenerateWorkcards ? {} : s.btnDisabledGhost) }}
                              onClick={() => canGenerateWorkcards && generateWorkcards(plan._id)}
                              disabled={!canGenerateWorkcards}
                            >
                              {isGeneratingWorkcards ? 'Generating Cards...' : 'Generate Workcards'}
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
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          <span style={s.historyExercises}>
                            {w.source === 'workcard'
                              ? `${w.completedCount || 0}/${w.totalCount || 0} complete (${w.completionScore || 0}%)`
                              : `${w.exercises?.length || 0} exercise${(w.exercises?.length || 0) !== 1 ? 's' : ''}`}
                          </span>
                        </div>
                        <div style={s.exercisePreview}>
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
        <div style={s.modalBackdrop} onClick={() => !creatingPlan && setShowCreateModal(false)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <h3 style={s.modalTitle}>New Workout Plan</h3>

            <label style={s.label}>Plan name</label>
            <input
              style={s.input}
              value={newPlan.name}
              onChange={e => setNewPlan(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Upper Body Focus"
            />

            <label style={s.label}>Fitness level</label>
            <select
              style={s.select}
              value={newPlan.fitnessLevel}
              onChange={e => setNewPlan(prev => ({ ...prev, fitnessLevel: e.target.value }))}
            >
              <option value="">Use profile level</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="professional">Professional</option>
              <option value="unsure">Not Sure Yet</option>
            </select>

            <label style={s.label}>Target muscles</label>
            <div style={s.modalMuscleGrid}>
              {MUSCLES.map(m => (
                <button
                  type="button"
                  key={m.id}
                  style={{
                    ...s.muscleChip,
                    ...(newPlan.targetMuscles.includes(m.id) ? s.muscleChipActive : {}),
                  }}
                  onClick={() => toggleNewPlanMuscle(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <label style={s.label}>Session length</label>
            <div style={s.durationRow}>
              {DURATIONS.map(d => (
                <button
                  type="button"
                  key={d}
                  style={{ ...s.durationBtn, ...(newPlan.sessionDuration === d ? s.durationBtnActive : {}) }}
                  onClick={() => setNewPlan(prev => ({ ...prev, sessionDuration: d }))}
                >
                  {d}m
                </button>
              ))}
            </div>

            <label style={s.label}>Days per week</label>
            <input
              style={s.slider}
              type="range"
              min={1}
              max={7}
              value={newPlan.frequency}
              onChange={e => setNewPlan(prev => ({ ...prev, frequency: Number(e.target.value) }))}
            />
            <p style={s.sliderHint}>{newPlan.frequency} days / week</p>

            <label style={s.label}>Preferences</label>
            <textarea
              style={s.textarea}
              rows={3}
              value={newPlan.preferences}
              onChange={e => setNewPlan(prev => ({ ...prev, preferences: e.target.value }))}
              placeholder="Any injuries, equipment limits, or constraints"
            />

            <div style={s.modalActions}>
              <button
                style={s.ghostBtn}
                onClick={() => !creatingPlan && setShowCreateModal(false)}
                disabled={creatingPlan}
              >
                Cancel
              </button>
              <button
                style={{
                  ...s.primaryBtn,
                  ...((creatingPlan || !newPlan.targetMuscles.length) ? s.btnDisabled : {}),
                }}
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
  logoRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  logoText: { color: '#fff', fontWeight: '700', fontSize: '18px' },
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
    maxWidth: '900px',
    margin: '0 auto',
    padding: '36px 24px',
  },
  welcome: {
    color: '#fff',
    fontSize: '26px',
    fontWeight: '700',
    margin: '0 0 16px',
  },
  tabRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  tabBtn: {
    background: '#171717',
    border: '1px solid #2d2d2d',
    borderRadius: '999px',
    padding: '8px 14px',
    color: '#999',
    fontSize: '13px',
    cursor: 'pointer',
  },
  tabBtnActive: {
    background: '#26100d',
    border: '1px solid #ff1e00',
    color: '#ff6a57',
  },
  quoteCard: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderLeft: '3px solid #ff1e00',
    borderRadius: '10px',
    padding: '16px 20px',
    marginBottom: '24px',
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
    transition: 'opacity 0.3s ease',
    fontStyle: 'italic',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))',
    gap: '14px',
    marginBottom: '24px',
  },
  statCard: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '4px',
  },
  statNum: { color: '#fff', fontSize: '18px', fontWeight: '700' },
  statLabel: { color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  chartCard: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '20px 24px',
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
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '14px',
    gap: '12px',
    flexWrap: 'wrap',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: '17px',
    fontWeight: '700',
    margin: 0,
  },
  ideaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '12px',
  },
  ideaCard: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  ideaTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    alignItems: 'flex-start',
  },
  ideaName: {
    color: '#fff',
    fontSize: '16px',
    fontWeight: '700',
    margin: 0,
  },
  statusBadge: {
    borderRadius: '999px',
    padding: '4px 9px',
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  statusDraft: {
    background: '#1f1f1f',
    border: '1px solid #3a3a3a',
    color: '#888',
  },
  statusGenerating: {
    background: '#2a2410',
    border: '1px solid #d6a127',
    color: '#f3bc3f',
  },
  statusReady: {
    background: '#102418',
    border: '1px solid #2da25f',
    color: '#4fda83',
  },
  statusFailed: {
    background: '#2b1212',
    border: '1px solid #c44242',
    color: '#ff6a6a',
  },
  metaRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  metaText: {
    color: '#888',
    fontSize: '12px',
    background: '#151515',
    border: '1px solid #2a2a2a',
    borderRadius: '7px',
    padding: '4px 8px',
  },
  chipsRow: {
    display: 'flex',
    gap: '7px',
    flexWrap: 'wrap',
  },
  muscleTag: {
    background: '#23100d',
    border: '1px solid #4a221d',
    borderRadius: '999px',
    padding: '4px 10px',
    color: '#ff8a7c',
    fontSize: '12px',
  },
  planSummary: {
    color: '#aaa',
    fontSize: '13px',
    margin: 0,
    lineHeight: 1.5,
  },
  previewBox: {
    background: '#151515',
    border: '1px solid #2a2a2a',
    borderRadius: '9px',
    padding: '10px',
  },
  previewTitle: {
    color: '#ccc',
    fontSize: '12px',
    fontWeight: '600',
  },
  previewList: {
    color: '#777',
    margin: '6px 0 0',
    fontSize: '12px',
  },
  exerciseRow: {
    color: '#bbb',
    fontSize: '12px',
    lineHeight: '1.5',
  },
  exerciseSetsReps: {
    color: '#ff7a67',
    fontWeight: '600',
  },
  ideaActions: {
    marginTop: '4px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    flexWrap: 'wrap',
  },
  primaryBtn: {
    background: '#ff1e00',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  ghostBtn: {
    background: 'transparent',
    border: '1px solid #444',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#aaa',
    fontSize: '13px',
    cursor: 'pointer',
  },
  btnDisabled: {
    background: '#444',
    cursor: 'not-allowed',
  },
  btnDisabledGhost: {
    border: '1px solid #444',
    color: '#666',
    cursor: 'not-allowed',
  },
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
  historyExercises: { color: '#666', fontSize: '12px' },
  exercisePreview: {
    color: '#666',
    fontSize: '13px',
    flex: 1,
    textAlign: 'right',
  },
  emptyCard: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '28px',
    textAlign: 'center',
  },
  muted: {
    color: '#666',
    fontSize: '14px',
    margin: 0,
  },
  error: {
    color: '#ff6a6a',
    background: '#2b1212',
    border: '1px solid #4d2323',
    borderRadius: '8px',
    padding: '10px 12px',
    marginBottom: '14px',
    fontSize: '13px',
  },
  errorSmall: {
    color: '#ff6a6a',
    margin: 0,
    fontSize: '12px',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '18px',
    zIndex: 1000,
  },
  modalCard: {
    width: '100%',
    maxWidth: '560px',
    background: '#141414',
    border: '1px solid #2d2d2d',
    borderRadius: '14px',
    padding: '18px',
  },
  modalTitle: {
    margin: '0 0 14px',
    color: '#fff',
    fontSize: '18px',
  },
  label: {
    display: 'block',
    color: '#ccc',
    fontSize: '13px',
    margin: '10px 0 6px',
  },
  input: {
    width: '100%',
    background: '#1d1d1d',
    border: '1px solid #343434',
    borderRadius: '8px',
    color: '#ddd',
    padding: '10px 12px',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    background: '#1d1d1d',
    border: '1px solid #343434',
    borderRadius: '8px',
    color: '#ddd',
    padding: '10px 12px',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  modalMuscleGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '8px',
  },
  muscleChip: {
    background: '#222',
    border: '2px solid #333',
    borderRadius: '20px',
    padding: '7px 12px',
    color: '#ccc',
    fontSize: '13px',
    cursor: 'pointer',
  },
  muscleChipActive: {
    background: '#2a1010',
    border: '2px solid #ff1e00',
    color: '#ff7a67',
  },
  durationRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px',
    flexWrap: 'wrap',
  },
  durationBtn: {
    background: '#222',
    border: '2px solid #333',
    borderRadius: '8px',
    padding: '8px 12px',
    color: '#ccc',
    fontSize: '13px',
    cursor: 'pointer',
  },
  durationBtnActive: {
    background: '#2a1010',
    border: '2px solid #ff1e00',
    color: '#ff7a67',
  },
  slider: {
    width: '100%',
    accentColor: '#ff1e00',
  },
  sliderHint: {
    margin: '6px 0 0',
    color: '#777',
    fontSize: '12px',
  },
  textarea: {
    width: '100%',
    background: '#1d1d1d',
    border: '1px solid #343434',
    borderRadius: '8px',
    color: '#ddd',
    padding: '10px 12px',
    fontSize: '14px',
    boxSizing: 'border-box',
    resize: 'vertical',
  },
  modalActions: {
    marginTop: '14px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
  },
}
