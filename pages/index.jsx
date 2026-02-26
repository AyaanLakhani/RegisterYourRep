// pages/index.jsx  ←  was: the '/' route in App.jsx
// Shows Login page, redirects to /dashboard if already authenticated
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import Login from './login'

export default function HomePage() {
  const { authenticated, ready } = usePrivy()
  const router = useRouter()

  useEffect(() => {
    if (ready && authenticated) router.replace('/dashboard')
  }, [ready, authenticated, router])

  if (!ready) return <div className="loading">Loading...</div>
  if (authenticated) return <div className="loading">Redirecting...</div>

  return <Login />
}
