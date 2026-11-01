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
  const auth = useAuth()

  if (auth.status === 'loading') {
    return <p role="status">Checking your session…</p>
  }

  if (auth.status === 'error') {
    return (
      <div>
        <p role="alert">{auth.error}</p>

        <button
          type="button"
          onClick={() => {
            if (auth.operation === 'logout') {
              void auth.signOut().catch(() => undefined)
            } else {
              void auth.refreshSession()
            }
          }}
        >
          {auth.operation === 'logout'
            ? 'Retry sign out'
            : 'Retry session check'}
        </button>
      </div>
    )
  }

  if (auth.status === 'anonymous') {
    return renderRedirect('/login')
  }

  if (auth.destination === null) {
    return (
      <p role="alert">
        Your account does not have access to this page.
        Please contact support.
      </p>
    )
  }

  if (auth.destination !== requiredDestination) {
    return renderRedirect(auth.destination)
  }

  return <>{children}</>
}