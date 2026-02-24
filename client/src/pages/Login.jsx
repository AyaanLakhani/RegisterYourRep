import { useState } from 'react'
import { useLoginWithOAuth, useLoginWithEmail } from '@privy-io/react-auth'
import Logo from '../components/Logo'
import styles from './Login.module.css'

// Session sync and post-login navigation are handled by AppRoutes in App.jsx.
export default function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [emailError, setEmailError] = useState('')

  const { initOAuth, state: oauthState } = useLoginWithOAuth()
  const { sendCode, loginWithCode, state: emailState } = useLoginWithEmail()

  const awaitingCode = emailState.status === 'awaiting-code-input'
  const sendingCode = emailState.status === 'sending-code'
  const submittingCode = emailState.status === 'submitting-code'
  const googleLoading = oauthState.status === 'loading'

  async function handleSendCode(e) {
    e.preventDefault()
    setEmailError('')
    if (!email.trim()) { setEmailError('Enter your email to continue.'); return }
    try {
      await sendCode({ email: email.trim() })
    } catch (err) {
      setEmailError('Could not send code. Check your email and try again.')
    }
  }

  async function handleLoginWithCode(e) {
    e.preventDefault()
    setEmailError('')
    if (!code.trim()) { setEmailError('Enter the code from your email.'); return }
    try {
      await loginWithCode({ code: code.trim() })
    } catch (err) {
      setEmailError('Incorrect code. Please try again.')
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.blob1} />
      <div className={styles.blob2} />

      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <Logo size={60} />
        </div>
        <h1 className={styles.title}>RegisterYourRep</h1>
        <p className={styles.subtitle}>Your AI-powered workout companion</p>

        <div className={styles.divider} />

        <button
          className={`${styles.googleBtn} ${googleLoading ? styles.dimmed : ''}`}
          onClick={() => initOAuth({ provider: 'google' })}
          disabled={googleLoading}
        >
          <GoogleIcon />
          {googleLoading ? 'Redirecting...' : 'Continue with Google'}
        </button>

        <div className={styles.orRow}>
          <div className={styles.orLine} />
          <span className={styles.orText}>or</span>
          <div className={styles.orLine} />
        </div>

        {!awaitingCode ? (
          <form onSubmit={handleSendCode} className={styles.form}>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={styles.input}
              disabled={sendingCode}
              autoComplete="email"
            />
            <button
              type="submit"
              className={`${styles.emailBtn} ${sendingCode ? styles.dimmed : ''}`}
              disabled={sendingCode}
            >
              {sendingCode ? 'Sending...' : 'Continue with Email'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLoginWithCode} className={styles.form}>
            <p className={styles.codeHint}>
              We sent a code to <strong className={styles.codeEmail}>{email}</strong>
            </p>
            <input
              type="text"
              placeholder="Enter 6-digit code"
              value={code}
              onChange={e => setCode(e.target.value)}
              className={styles.input}
              disabled={submittingCode}
              autoComplete="one-time-code"
              maxLength={6}
            />
            <button
              type="submit"
              className={`${styles.emailBtn} ${submittingCode ? styles.dimmed : ''}`}
              disabled={submittingCode}
            >
              {submittingCode ? 'Verifying...' : 'Verify Code'}
            </button>
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => { setCode(''); setEmailError('') }}
            >
              Use a different email
            </button>
          </form>
        )}

        {emailError && <p className={styles.errorText}>{emailError}</p>}

        <p className={styles.footer}>
          Secured by <span className={styles.footerBrand}>Privy</span>
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  )
}
