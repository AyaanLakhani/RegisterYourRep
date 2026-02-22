import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePrivy } from '@privy-io/react-auth'
import Logo from '../components/Logo'

function ensureCheckedLength(checked, total) {
  const next = Array.isArray(checked) ? checked.map(Boolean).slice(0, total) : []
  while (next.length < total) next.push(false)
  return next
}

export default function Workcards() {
  const navigate = useNavigate()
  const { getAccessToken, logout } = usePrivy()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [workcards, setWorkcards] = useState([])
  const [savingId, setSavingId] = useState('')
  const [submittingId, setSubmittingId] = useState('')

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

  async function loadWorkcards() {
    setError('')
    try {
      const data = await requestJson('/api/workcards')
      setWorkcards(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Failed to load workcards.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWorkcards()
  }, [])

  async function handleLogout() {
    await fetch('/logout', { credentials: 'include' })
    await logout()
  }

  function updateLocalCard(cardId, updater) {
    setWorkcards(prev => prev.map(card => (card._id === cardId ? updater(card) : card)))
  }

  function onFieldChange(cardId, field, value) {
    updateLocalCard(cardId, card => ({ ...card, [field]: value }))
  }

  function onToggleExercise(card, index) {
    if (card.status === 'submitted') return
    if (!card.date || !card.weekday) return

    const total = card.totalCount || (card.exercises?.length || 0)
    const checked = ensureCheckedLength(card.checked, total)
    checked[index] = !checked[index]
    const completedCount = checked.filter(Boolean).length
    const score = total > 0 ? Math.round((completedCount / total) * 100) : 0

    updateLocalCard(card._id, prev => ({
      ...prev,
      checked,
      completedCount,
      score,
    }))
  }

  async function saveCard(card) {
    setSavingId(card._id)
    setError('')
    try {
      const total = card.totalCount || (card.exercises?.length || 0)
      const checked = ensureCheckedLength(card.checked, total)
      const data = await requestJson(`/api/workcards/${card._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: card.date || '',
          weekday: card.weekday || '',
          checked,
        }),
      })
      if (!data?.success || !data?.workcard) throw new Error('Failed to save workcard')
      updateLocalCard(card._id, () => data.workcard)
    } catch (err) {
      setError(err.message || 'Failed to save workcard.')
    } finally {
      setSavingId('')
    }
  }

  async function submitCard(card) {
    setSubmittingId(card._id)
    setError('')
    try {
      const total = card.totalCount || (card.exercises?.length || 0)
      const checked = ensureCheckedLength(card.checked, total)

      await requestJson(`/api/workcards/${card._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: card.date || '',
          weekday: card.weekday || '',
          checked,
        }),
      })

      const submitted = await requestJson(`/api/workcards/${card._id}/submit`, {
        method: 'POST',
      })
      if (!submitted?.success || !submitted?.workcard) throw new Error('Failed to submit workcard')
      updateLocalCard(card._id, () => submitted.workcard)
    } catch (err) {
      setError(err.message || 'Failed to submit workcard.')
    } finally {
      setSubmittingId('')
    }
  }

  const pendingCards = useMemo(
    () => workcards.filter(card => card.status !== 'submitted'),
    [workcards]
  )
  const submittedCards = useMemo(
    () => workcards.filter(card => card.status === 'submitted'),
    [workcards]
  )

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div style={s.logoRow}>
          <Logo size={34} />
          <span style={s.logoText}>RegisterYourRep</span>
        </div>
        <div style={s.topActions}>
          <button style={s.ghostBtn} onClick={() => navigate('/dashboard')}>Dashboard</button>
          <button style={s.ghostBtn} onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div style={s.content}>
        <div style={s.pageHeader}>
          <h1 style={s.heading}>Workcards</h1>
          <p style={s.sub}>Track each workout day as a checklist and submit your completion score.</p>
        </div>

        {error && <p style={s.error}>{error}</p>}

        {loading ? (
          <p style={s.muted}>Loading workcards...</p>
        ) : (
          <>
            <h2 style={s.sectionTitle}>Pending</h2>
            {pendingCards.length === 0 ? (
              <div style={s.emptyCard}>
                <p style={s.muted}>No pending workcards. Generate them from Workout Ideas in Dashboard.</p>
              </div>
            ) : (
              <div style={s.cardGrid}>
                {pendingCards.map(card => {
                  const total = card.totalCount || (card.exercises?.length || 0)
                  const checked = ensureCheckedLength(card.checked, total)
                  const canCheck = Boolean(card.date && card.weekday)
                  const isSaving = savingId === card._id
                  const isSubmitting = submittingId === card._id
                  return (
                    <div key={card._id} style={s.workcard}>
                      <div style={s.workcardTop}>
                        <h3 style={s.cardTitle}>{card.planName || 'Workout Plan'}</h3>
                        <span style={s.pendingBadge}>Pending</span>
                      </div>
                      <p style={s.dayLabel}>{card.dayLabel || `Day ${card.dayIndex}`}</p>
                      {!!card.focus?.length && (
                        <p style={s.focusText}>Focus: {card.focus.join(', ')}</p>
                      )}

                      <div style={s.fieldsRow}>
                        <div style={s.fieldCol}>
                          <label style={s.label}>Date</label>
                          <input
                            type="date"
                            value={card.date || ''}
                            style={s.input}
                            onChange={e => onFieldChange(card._id, 'date', e.target.value)}
                          />
                        </div>
                        <div style={s.fieldCol}>
                          <label style={s.label}>Day</label>
                          <input
                            type="text"
                            placeholder="e.g. Monday"
                            value={card.weekday || ''}
                            style={s.input}
                            onChange={e => onFieldChange(card._id, 'weekday', e.target.value)}
                          />
                        </div>
                      </div>

                      <div style={s.exerciseList}>
                        {(card.exercises || []).map((ex, idx) => (
                          <label key={`${card._id}-${idx}`} style={s.exerciseItem}>
                            <input
                              type="checkbox"
                              checked={!!checked[idx]}
                              disabled={!canCheck}
                              onChange={() => onToggleExercise(card, idx)}
                            />
                            <span style={s.exerciseText}>
                              {ex.name}
                              {(ex.sets && ex.reps) ? <span style={s.exerciseMeta}> - {ex.sets}x{ex.reps}</span> : null}
                            </span>
                          </label>
                        ))}
                      </div>

                      {!canCheck && <p style={s.hint}>Enter date and day before checking boxes.</p>}
                      <p style={s.score}>Progress: {checked.filter(Boolean).length}/{total} ({total ? Math.round((checked.filter(Boolean).length / total) * 100) : 0}%)</p>

                      <div style={s.actionsRow}>
                        <button
                          style={{ ...s.ghostBtn, ...(isSaving ? s.btnDisabled : {}) }}
                          onClick={() => saveCard(card)}
                          disabled={isSaving}
                        >
                          {isSaving ? 'Saving...' : 'Save Progress'}
                        </button>
                        <button
                          style={{ ...s.primaryBtn, ...((!canCheck || isSubmitting) ? s.btnDisabled : {}) }}
                          onClick={() => canCheck && submitCard(card)}
                          disabled={!canCheck || isSubmitting}
                        >
                          {isSubmitting ? 'Submitting...' : 'Submit Day'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <h2 style={{ ...s.sectionTitle, marginTop: '28px' }}>Submitted</h2>
            {submittedCards.length === 0 ? (
              <div style={s.emptyCard}>
                <p style={s.muted}>No submitted workcards yet.</p>
              </div>
            ) : (
              <div style={s.submittedList}>
                {submittedCards.map(card => (
                  <div key={card._id} style={s.submittedItem}>
                    <div>
                      <p style={s.submittedTitle}>{card.planName} - {card.dayLabel || `Day ${card.dayIndex}`}</p>
                      <p style={s.submittedMeta}>{card.date || '-'} | {card.weekday || '-'}</p>
                    </div>
                    <div style={s.scoreBadge}>{card.score || 0}% ({card.completedCount || 0}/{card.totalCount || 0})</div>
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
  logoRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  logoText: { color: '#fff', fontWeight: '700', fontSize: '18px' },
  topActions: { display: 'flex', gap: '10px' },
  content: {
    maxWidth: '980px',
    margin: '0 auto',
    padding: '32px 20px',
  },
  pageHeader: { marginBottom: '18px' },
  heading: { color: '#fff', fontSize: '28px', margin: '0 0 6px' },
  sub: { color: '#888', margin: 0, fontSize: '14px' },
  sectionTitle: { color: '#fff', fontSize: '18px', margin: '0 0 12px' },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '12px',
  },
  workcard: {
    background: '#171717',
    border: '1px solid #2d2d2d',
    borderRadius: '12px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  workcardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' },
  cardTitle: { color: '#fff', fontSize: '16px', margin: 0 },
  pendingBadge: {
    background: '#2a2410',
    border: '1px solid #d6a127',
    color: '#f3bc3f',
    borderRadius: '999px',
    padding: '4px 9px',
    fontSize: '11px',
    fontWeight: '700',
  },
  dayLabel: { color: '#ddd', margin: 0, fontSize: '14px', fontWeight: '700' },
  focusText: { color: '#888', margin: 0, fontSize: '12px' },
  fieldsRow: { display: 'flex', gap: '8px' },
  fieldCol: { flex: 1 },
  label: { display: 'block', color: '#bbb', fontSize: '12px', marginBottom: '4px' },
  input: {
    width: '100%',
    background: '#222',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '8px',
    color: '#ddd',
    boxSizing: 'border-box',
  },
  exerciseList: {
    background: '#121212',
    border: '1px solid #2a2a2a',
    borderRadius: '10px',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  exerciseItem: { display: 'flex', alignItems: 'center', gap: '8px', color: '#ddd' },
  exerciseText: { fontSize: '13px' },
  exerciseMeta: { color: '#ff7a67', fontWeight: '700' },
  hint: { color: '#ddad59', margin: 0, fontSize: '12px' },
  score: { color: '#9bd19b', margin: 0, fontSize: '12px', fontWeight: '700' },
  actionsRow: { display: 'flex', justifyContent: 'flex-end', gap: '8px' },
  primaryBtn: {
    background: '#ff1e00',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    padding: '9px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '700',
  },
  ghostBtn: {
    background: 'transparent',
    border: '1px solid #444',
    borderRadius: '8px',
    color: '#aaa',
    padding: '9px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '700',
  },
  btnDisabled: {
    background: '#444',
    cursor: 'not-allowed',
  },
  submittedList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  submittedItem: {
    background: '#171717',
    border: '1px solid #2d2d2d',
    borderRadius: '10px',
    padding: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },
  submittedTitle: { color: '#fff', margin: 0, fontSize: '14px', fontWeight: '700' },
  submittedMeta: { color: '#888', margin: '4px 0 0', fontSize: '12px' },
  scoreBadge: {
    background: '#102418',
    border: '1px solid #2da25f',
    color: '#4fda83',
    borderRadius: '999px',
    padding: '5px 10px',
    fontSize: '12px',
    fontWeight: '700',
    whiteSpace: 'nowrap',
  },
  emptyCard: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'center',
  },
  muted: { color: '#666', fontSize: '14px', margin: 0 },
  error: {
    color: '#ff6a6a',
    background: '#2b1212',
    border: '1px solid #4d2323',
    borderRadius: '8px',
    padding: '10px 12px',
    marginBottom: '12px',
    fontSize: '13px',
  },
}
