import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePrivy } from '@privy-io/react-auth'
import Logo from '../components/Logo'
import styles from './Workcards.module.css'

function useToast() {
  const [toasts, setToasts] = useState([])
  const timerRef = useRef({})

  function showToast(message, type = 'success') {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    timerRef.current[id] = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      delete timerRef.current[id]
    }, 3000)
  }

  return { toasts, showToast }
}

function ToastContainer({ toasts }) {
  if (!toasts.length) return null
  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 9999 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === 'error' ? '#2b1212' : '#0f2418',
          border: `1px solid ${t.type === 'error' ? '#4d2323' : '#2da25f'}`,
          color: t.type === 'error' ? '#ff6a6a' : '#4fda83',
          borderRadius: '8px',
          padding: '10px 16px',
          fontSize: '13px',
          fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          maxWidth: '320px',
        }}>
          {t.message}
        </div>
      ))}
    </div>
  )
}

function ensureCheckedLength(checked, total) {
  const next = Array.isArray(checked) ? checked.map(Boolean).slice(0, total) : []
  while (next.length < total) next.push(false)
  return next
}

function getWeekdayFromDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

export default function Workcards() {
  const navigate = useNavigate()
  const { getAccessToken, logout } = usePrivy()

  const [loading, setLoading] = useState(true)
  const { toasts, showToast } = useToast()
  const [workcards, setWorkcards] = useState([])
  const [savingId, setSavingId] = useState('')
  const [submittingId, setSubmittingId] = useState('')
  const [deletingId, setDeletingId] = useState('')

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
    try {
      const data = await requestJson('/api/workcards')
      setWorkcards(Array.isArray(data) ? data : [])
    } catch (err) {
      showToast(err.message || 'Failed to load workcards.', 'error')
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
      showToast('Progress saved!')
    } catch (err) {
      showToast(err.message || 'Failed to save workcard.', 'error')
    } finally {
      setSavingId('')
    }
  }

  async function submitCard(card) {
    setSubmittingId(card._id)
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
      showToast('Workcard submitted!')
    } catch (err) {
      showToast(err.message || 'Failed to submit workcard.', 'error')
    } finally {
      setSubmittingId('')
    }
  }

  async function deleteCard(card) {
    const cardId = String(card?._id || '')
    if (!cardId) return

    const confirmed = window.confirm(
      `Delete "${card.planName || 'Workout Plan'} - ${card.dayLabel || `Day ${card.dayIndex}`}"?`
    )
    if (!confirmed) return

    setDeletingId(cardId)
    try {
      const data = await requestJson(`/api/workcards/${cardId}`, {
        method: 'DELETE',
      })
      if (!data?.success) throw new Error(data?.error || 'Failed to delete workcard')

      setWorkcards(prev => prev.filter(c => c._id !== cardId))
      showToast('Workcard deleted.')
    } catch (err) {
      showToast(err.message || 'Failed to delete workcard.', 'error')
    } finally {
      setDeletingId('')
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
    <div className={styles.page}>
      <ToastContainer toasts={toasts} />
      <div className={styles.topBar}>
        <div className={styles.logoRow}>
          <Logo size={34} />
          <span className={styles.logoText}>RegisterYourRep</span>
        </div>
        <div className={styles.topActions}>
          <button className={styles.ghostBtn} onClick={() => navigate('/dashboard')}>Dashboard</button>
          <button className={styles.ghostBtn} onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.pageHeader}>
          <h1 className={styles.heading}>Workcards</h1>
          <p className={styles.sub}>Track each workout day as a checklist and submit your completion score.</p>
        </div>

        {loading ? (
          <p className={styles.muted}>Loading workcards...</p>
        ) : (
          <>
            <h2 className={styles.sectionTitle}>Pending</h2>
            {pendingCards.length === 0 ? (
              <div className={styles.emptyCard}>
                <p className={styles.muted}>No pending workcards. Generate them from Workout Ideas in Dashboard.</p>
              </div>
            ) : (
              <div className={styles.cardGrid}>
                {pendingCards.map(card => {
                  const total = card.totalCount || (card.exercises?.length || 0)
                  const checked = ensureCheckedLength(card.checked, total)
                  const canCheck = Boolean(card.date && card.weekday)
                  const isSaving = savingId === card._id
                  const isSubmitting = submittingId === card._id
                  const isDeleting = deletingId === card._id
                  return (
                    <div key={card._id} className={styles.workcard}>
                      <div className={styles.workcardTop}>
                        <h3 className={styles.cardTitle}>{card.planName || 'Workout Plan'}</h3>
                        <span className={styles.pendingBadge}>Pending</span>
                      </div>
                      <p className={styles.dayLabel}>{card.dayLabel || `Day ${card.dayIndex}`}</p>
                      {!!card.focus?.length && (
                        <p className={styles.focusText}>Focus: {card.focus.join(', ')}</p>
                      )}

                      <div className={styles.fieldsRow}>
                        <div className={styles.fieldCol}>
                          <label className={styles.label}>Date</label>
                          <input
                            type="date"
                            value={card.date || ''}
                            className={styles.input}
                            onChange={e => {
                              const date = e.target.value
                              onFieldChange(card._id, 'date', date)
                              const weekday = getWeekdayFromDate(date)
                              onFieldChange(card._id, 'weekday', weekday)
                            }}
                          />
                        </div>
                        <div className={styles.fieldCol}>
                          <label className={styles.label}>Day</label>
                          <input
                            type="text"
                            placeholder="Auto-filled"
                            value={card.weekday || ''}
                            className={styles.input}
                            readOnly
                          />
                        </div>
                      </div>
                      
                      <div className={styles.exerciseList}>
                        {(card.exercises || []).map((ex, idx) => (
                          <label key={`${card._id}-${idx}`} className={`${styles.exerciseItem} ${!canCheck ? styles.exerciseItemDisabled : ''}`}>
                            <input
                              type="checkbox"
                              checked={!!checked[idx]}
                              disabled={!canCheck}
                              onChange={() => onToggleExercise(card, idx)}
                              className={styles.checkboxInput}
                            />
                            <span className={`${styles.checkboxBox} ${!!checked[idx] ? styles.checkboxChecked : ''} ${!canCheck ? styles.checkboxDisabled : ''}`}>
                              {!!checked[idx] && (
                                <svg viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.checkmark}>
                                  <path d="M1 5l3.5 3.5L11 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </span>
                            <span className={styles.exerciseText}>
                              {ex.name}
                              {(ex.sets && ex.reps) ? <span className={styles.exerciseMeta}> - {ex.sets}x{ex.reps}</span> : null}
                            </span>
                          </label>
                        ))}
                      </div>

                      {!canCheck && <p className={styles.hint}>Enter date and day before checking boxes.</p>}
                      <p className={styles.score}>Progress: {checked.filter(Boolean).length}/{total} ({total ? Math.round((checked.filter(Boolean).length / total) * 100) : 0}%)</p>

                      <div className={styles.actionsRow}>
                        <button
                          className={`${styles.ghostBtn} ${isSaving ? styles.btnDisabled : ''}`}
                          onClick={() => saveCard(card)}
                          disabled={isSaving || isDeleting}
                        >
                          {isSaving ? 'Saving...' : 'Save Progress'}
                        </button>
                        <button
                          className={`${styles.primaryBtn} ${(!canCheck || isSubmitting) ? styles.btnDisabled : ''}`}
                          onClick={() => canCheck && submitCard(card)}
                          disabled={!canCheck || isSubmitting || isDeleting}
                        >
                          {isSubmitting ? 'Submitting...' : 'Submit Day'}
                        </button>
                        <button
                          className={`${styles.ghostBtn} ${isDeleting ? styles.btnDisabled : ''}`}
                          onClick={() => !isDeleting && deleteCard(card)}
                          disabled={isDeleting || isSaving || isSubmitting}
                        >
                          {isDeleting ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <h2 className={styles.sectionTitleSubmitted}>Submitted</h2>
            {submittedCards.length === 0 ? (
              <div className={styles.emptyCard}>
                <p className={styles.muted}>No submitted workcards yet.</p>
              </div>
            ) : (
              <div className={styles.submittedList}>
                {submittedCards.map(card => (
                  <div key={card._id} className={styles.submittedItem}>
                    <div>
                      <p className={styles.submittedTitle}>{card.planName} - {card.dayLabel || `Day ${card.dayIndex}`}</p>
                      <p className={styles.submittedMeta}>{card.date || '-'} | {card.weekday || '-'}</p>
                    </div>
                    <div className={styles.actionsRow}>
                      <div className={styles.scoreBadge}>{card.score || 0}% ({card.completedCount || 0}/{card.totalCount || 0})</div>
                      <button
                        className={`${styles.ghostBtn} ${deletingId === card._id ? styles.btnDisabled : ''}`}
                        onClick={() => deletingId !== card._id && deleteCard(card)}
                        disabled={deletingId === card._id}
                      >
                        {deletingId === card._id ? 'Deleting...' : 'Delete'}
                      </button>
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
