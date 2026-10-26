import type { ReactNode } from 'react'
import type { AuthDestination } from './getAuthDestination'
import { useAuth } from './useAuth'

type ProtectedRouteProps = {
  destination: AuthDestination
  children: ReactNode
  renderRedirect: (to: AuthDestination | '/login') => ReactNode
}

export default function ProtectedRoute({
  destination: requiredDestination,
  children,
  renderRedirect,
}: ProtectedRouteProps) {
  const {
    status,
    destination,
    error,
    refreshSession,
  } = useAuth()

  if (status === 'loading') {
    return <p role="status">Checking your session…</p>
  }

  if (status === 'error') {
    return (
      <div>
        <p role="alert">{error}</p>
        <button
          type="button"
          onClick={() => void refreshSession()}
        >
          Retry session check
        </button>
      </div>
    )
  }

  if (status === 'anonymous') {
    return renderRedirect('/login')
  }

  if (destination === null) {
    return (
      <p role="alert">
        Your account does not have access to this page.
        Please contact support.
      </p>
    )
  }

  if (destination !== requiredDestination) {
    return renderRedirect(destination)
  }

  return <>{children}</>
}