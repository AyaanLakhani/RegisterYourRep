import { useState } from 'react'
import { useLoginWithOAuth, useLoginWithEmail } from '@privy-io/react-auth'
import Logo from '../components/Logo'

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
    <div style={s.page}>
      <div style={s.blob1} />
      <div style={s.blob2} />

      <div style={s.card}>
        {/* Logo */}
        <div style={s.logoWrap}>
          <Logo size={60} />
        </div>
        <h1 style={s.title}>RegisterYourRep</h1>
        <p style={s.subtitle}>Your AI-powered workout companion</p>

        <div style={s.divider} />

        {/* Google */}
        <button
          style={{ ...s.googleBtn, opacity: googleLoading ? 0.6 : 1 }}
          onClick={() => initOAuth({ provider: 'google' })}
          disabled={googleLoading}
        >
          <GoogleIcon />
          {googleLoading ? 'Redirecting…' : 'Continue with Google'}
        </button>

        {/* Divider */}
        <div style={s.orRow}>
          <div style={s.orLine} />
          <span style={s.orText}>or</span>
          <div style={s.orLine} />
        </div>

        {/* Email flow */}
        {!awaitingCode ? (
          <form onSubmit={handleSendCode} style={s.form}>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={s.input}
              disabled={sendingCode}
              autoComplete="email"
            />
            <button
              type="submit"
              style={{ ...s.emailBtn, opacity: sendingCode ? 0.6 : 1 }}
              disabled={sendingCode}
            >
              {sendingCode ? 'Sending…' : 'Continue with Email'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLoginWithCode} style={s.form}>
            <p style={s.codeHint}>
              We sent a code to <strong style={{ color: '#ccc' }}>{email}</strong>
            </p>
            <input
              type="text"
              placeholder="Enter 6-digit code"
              value={code}
              onChange={e => setCode(e.target.value)}
              style={s.input}
              disabled={submittingCode}
              autoComplete="one-time-code"
              maxLength={6}
            />
            <button
              type="submit"
              style={{ ...s.emailBtn, opacity: submittingCode ? 0.6 : 1 }}
              disabled={submittingCode}
            >
              {submittingCode ? 'Verifying…' : 'Verify Code'}
            </button>
            <button
              type="button"
              style={s.backBtn}
              onClick={() => { setCode(''); setEmailError('') }}
            >
              Use a different email
            </button>
          </form>
        )}

        {emailError && <p style={s.errorText}>{emailError}</p>}

        <p style={s.footer}>
          Secured by <span style={{ color: '#555', fontWeight: '600' }}>Privy</span>
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

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0a0a',
    fontFamily: 'Arial, sans-serif',
    position: 'relative',
    overflow: 'hidden',
  },
  blob1: {
    position: 'absolute',
    top: '-120px',
    left: '-120px',
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,30,0,0.15) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  blob2: {
    position: 'absolute',
    bottom: '-100px',
    right: '-100px',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,30,0,0.1) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    background: '#141414',
    border: '1px solid #2a2a2a',
    borderRadius: '20px',
    padding: '44px 36px',
    width: '100%',
    maxWidth: '380px',
    textAlign: 'center',
    boxShadow: '0 0 60px rgba(255,30,0,0.06)',
  },
  logoWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  title: {
    color: '#fff',
    fontSize: '22px',
    fontWeight: '700',
    margin: '0 0 6px',
    letterSpacing: '-0.3px',
  },
  subtitle: {
    color: '#555',
    fontSize: '14px',
    margin: 0,
  },
  divider: {
    height: '1px',
    background: '#222',
    margin: '28px 0',
  },
  googleBtn: {
    width: '100%',
    padding: '13px 16px',
    background: '#1e1e1e',
    color: '#e0e0e0',
    border: '1px solid #333',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    fontFamily: 'Arial, sans-serif',
  },
  orRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    margin: '14px 0',
  },
  orLine: {
    flex: 1,
    height: '1px',
    background: '#222',
  },
  orText: {
    color: '#444',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  input: {
    width: '100%',
    padding: '13px 14px',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '15px',
    fontFamily: 'Arial, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
  },
  emailBtn: {
    width: '100%',
    padding: '13px 16px',
    background: '#ff1e00',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'Arial, sans-serif',
  },
  backBtn: {
    background: 'transparent',
    border: 'none',
    color: '#555',
    fontSize: '13px',
    cursor: 'pointer',
    textDecoration: 'underline',
    fontFamily: 'Arial, sans-serif',
    padding: 0,
  },
  codeHint: {
    color: '#666',
    fontSize: '13px',
    margin: '0 0 4px',
    textAlign: 'left',
  },
  errorText: {
    color: '#ff4444',
    fontSize: '13px',
    marginTop: '10px',
    marginBottom: 0,
  },
  footer: {
    color: '#444',
    fontSize: '12px',
    marginTop: '24px',
    marginBottom: 0,
  },
}
