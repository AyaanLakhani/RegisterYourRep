import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'

async function syncSession(getAccessToken) {
  const token = await getAccessToken()
  const res = await fetch('/auth/privy', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(`Auth failed (${res.status}): ${data.error || 'unknown'}`)
  }
}

const MUSCLES = [
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'biceps', label: 'Biceps' },
  { id: 'triceps', label: 'Triceps' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'core', label: 'Core' },
  { id: 'quadriceps', label: 'Quads' },
  { id: 'hamstrings', label: 'Hamstrings' },
  { id: 'glutes', label: 'Glutes' },
  { id: 'calves', label: 'Calves' },
  { id: 'full_body', label: 'Full Body' },
]

const DURATIONS = [15, 30, 45, 60, 90]

export default function Onboarding() {
  const { user, getAccessToken } = usePrivy()

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [fitnessLevel, setFitnessLevel] = useState('')
  const [targetMuscles, setTargetMuscles] = useState([])
  const [frequency, setFrequency] = useState(3)
  const [sessionDuration, setSessionDuration] = useState(45)
  const [preferences, setPreferences] = useState('')

  function toggleMuscle(id) {
    setTargetMuscles(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  function canAdvance() {
    if (step === 1) return fitnessLevel !== ''
    if (step === 2) return targetMuscles.length > 0
    return true
  }

  async function finish() {
    setSaving(true)
    setError('')
    try {
      const email = user?.email?.address || ''
      const body = JSON.stringify({ email, fitnessLevel, targetMuscles, frequency, sessionDuration, preferences })

      let res = await fetch('/api/user/profile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body,
      })

      if (res.status === 401) {
        await syncSession(getAccessToken)
        res = await fetch('/api/user/profile', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
      }

      const data = await res.json()
      if (data.success) {
        // Hard redirect so App re-runs session sync before reaching /dashboard.
        // React Router navigation races with the session state; a full reload
        // is reliable and matches what a manual refresh does.
        window.location.href = '/dashboard'
      } else {
        setError('Something went wrong. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* Progress bar */}
        <div style={s.progressTrack}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{ ...s.progressDot, background: n <= step ? '#ff1e00' : '#333' }} />
          ))}
        </div>
        <p style={s.stepLabel}>Step {step} of 3</p>

        {/* Step 1 — Fitness Level */}
        {step === 1 && (
          <>
            <h2 style={s.heading}>What's your fitness level?</h2>
            <p style={s.sub}>We'll tailor your workout plan to match your experience.</p>
            <div style={s.levelGrid}>
              {[
                { id: 'beginner', label: 'Beginner', desc: 'Just getting started' },
                { id: 'intermediate', label: 'Intermediate', desc: 'Some experience' },
                { id: 'professional', label: 'Professional', desc: 'Advanced athlete' },
                { id: 'unsure', label: 'Not Sure Yet', desc: "We'll figure it out" },
              ].map(opt => (
                <button
                  key={opt.id}
                  style={{ ...s.levelCard, ...(fitnessLevel === opt.id ? s.levelCardActive : {}) }}
                  onClick={() => setFitnessLevel(opt.id)}
                >
                  <span style={s.levelLabel}>{opt.label}</span>
                  <span style={s.levelDesc}>{opt.desc}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 2 — Target Muscles */}
        {step === 2 && (
          <>
            <h2 style={s.heading}>Which muscles do you want to target?</h2>
            <p style={s.sub}>Select all that apply.</p>
            <div style={s.muscleGrid}>
              {MUSCLES.map(m => (
                <button
                  key={m.id}
                  style={{ ...s.muscleChip, ...(targetMuscles.includes(m.id) ? s.muscleChipActive : {}) }}
                  onClick={() => toggleMuscle(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 3 — Schedule */}
        {step === 3 && (
          <>
            <h2 style={s.heading}>How do you want to train?</h2>
            <p style={s.sub}>Set your schedule and any preferences.</p>

            <label style={s.label}>Days per week: <strong style={{ color: '#ff1e00' }}>{frequency}</strong></label>
            <input
              type="range" min={1} max={7} value={frequency}
              onChange={e => setFrequency(Number(e.target.value))}
              style={s.slider}
            />
            <div style={s.sliderLabels}><span>1</span><span>7</span></div>

            <label style={s.label}>Session length (minutes):</label>
            <div style={s.durationRow}>
              {DURATIONS.map(d => (
                <button
                  key={d}
                  style={{ ...s.durationBtn, ...(sessionDuration === d ? s.durationBtnActive : {}) }}
                  onClick={() => setSessionDuration(d)}
                >
                  {d}
                </button>
              ))}
            </div>

            <label style={s.label}>Anything else we should know? <span style={{ color: '#555' }}>(optional)</span></label>
            <textarea
              value={preferences}
              onChange={e => setPreferences(e.target.value)}
              placeholder="e.g. bad knees, prefer no jumping exercises..."
              style={s.textarea}
              rows={3}
            />

            {error && <p style={s.error}>{error}</p>}
          </>
        )}

        {/* Navigation */}
        <div style={s.navRow}>
          {step > 1 && (
            <button style={s.backBtn} onClick={() => setStep(step - 1)}>Back</button>
          )}
          {step < 3 ? (
            <button
              style={{ ...s.nextBtn, ...(canAdvance() ? {} : s.btnDisabled) }}
              onClick={() => canAdvance() && setStep(step + 1)}
              disabled={!canAdvance()}
            >
              Next
            </button>
          ) : (
            <button
              style={{ ...s.nextBtn, ...(saving ? s.btnDisabled : {}) }}
              onClick={finish}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Finish'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f0f0f',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
  },
  card: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '16px',
    padding: '40px',
    width: '100%',
    maxWidth: '520px',
  },
  progressTrack: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px',
  },
  progressDot: {
    flex: 1,
    height: '4px',
    borderRadius: '2px',
    transition: 'background 0.3s',
  },
  stepLabel: {
    color: '#555',
    fontSize: '13px',
    margin: '0 0 24px',
  },
  heading: {
    color: '#fff',
    fontSize: '22px',
    fontWeight: '700',
    margin: '0 0 8px',
  },
  sub: {
    color: '#888',
    fontSize: '14px',
    margin: '0 0 24px',
  },
  levelGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginBottom: '28px',
  },
  levelCard: {
    background: '#222',
    border: '2px solid #333',
    borderRadius: '10px',
    padding: '16px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    textAlign: 'left',
    transition: 'border-color 0.2s',
  },
  levelCardActive: {
    border: '2px solid #ff1e00',
    background: '#2a1010',
  },
  levelLabel: {
    color: '#fff',
    fontSize: '15px',
    fontWeight: '600',
  },
  levelDesc: {
    color: '#777',
    fontSize: '12px',
  },
  muscleGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginBottom: '28px',
  },
  muscleChip: {
    background: '#222',
    border: '2px solid #333',
    borderRadius: '20px',
    padding: '8px 16px',
    color: '#ccc',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  muscleChipActive: {
    background: '#2a1010',
    border: '2px solid #ff1e00',
    color: '#ff1e00',
  },
  label: {
    display: 'block',
    color: '#ccc',
    fontSize: '14px',
    marginBottom: '10px',
  },
  slider: {
    width: '100%',
    accentColor: '#ff1e00',
    marginBottom: '4px',
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#555',
    fontSize: '12px',
    marginBottom: '24px',
  },
  durationRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  durationBtn: {
    background: '#222',
    border: '2px solid #333',
    borderRadius: '8px',
    padding: '8px 16px',
    color: '#ccc',
    fontSize: '14px',
    cursor: 'pointer',
  },
  durationBtnActive: {
    background: '#2a1010',
    border: '2px solid #ff1e00',
    color: '#ff1e00',
  },
  textarea: {
    width: '100%',
    background: '#222',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '12px',
    color: '#ccc',
    fontSize: '14px',
    resize: 'vertical',
    boxSizing: 'border-box',
    marginBottom: '24px',
    outline: 'none',
  },
  error: {
    color: '#ff4444',
    fontSize: '13px',
    marginBottom: '12px',
  },
  navRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  backBtn: {
    background: 'transparent',
    border: '1px solid #444',
    borderRadius: '8px',
    padding: '12px 24px',
    color: '#888',
    fontSize: '15px',
    cursor: 'pointer',
  },
  nextBtn: {
    background: '#ff1e00',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 28px',
    color: '#fff',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  btnDisabled: {
    background: '#444',
    cursor: 'not-allowed',
  },
}
