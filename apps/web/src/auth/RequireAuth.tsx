import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './useAuth'

export default function RequireAuth() {
  const auth = useAuth()
  const location = useLocation()
  const [logoutError, setLogoutError] = useState('')

  async function handleLogout() {
    setLogoutError('')
    try {
      await auth.signOut()
    } catch {
      setLogoutError('Sign out failed. Please try again.')
    }
  }

  if (auth.status === 'loading') return <p role="status">Checking your session…</p>
  if (auth.status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search + location.hash }} />
  }
  if (auth.status === 'error') {
    return <main><p role="alert">{auth.error}</p><button onClick={() => void auth.refreshSession()}>Retry session check</button><button onClick={() => void handleLogout()}>Sign out</button></main>
  }
  return <><nav aria-label="Account"><button onClick={() => void handleLogout()}>Sign out</button>{logoutError && <p role="alert">{logoutError}</p>}</nav><Outlet /></>
}
