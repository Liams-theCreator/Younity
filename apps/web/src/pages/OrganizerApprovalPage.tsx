import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router'
import ProtectedRoute from '../auth/ProtectedRoute'
import { useAuth } from '../auth/useAuth'
import styles from './AuthShell.module.css'

export default function OrganizerApprovalPage() {
  const [exit, setExit] = useState<
    '/events' | '/organizer/' | null
  >(null)

  if (exit) return <Navigate to={exit} replace />

  return (
    <ProtectedRoute
      destination="/organizer/approved"
      renderRedirect={(to) => <Navigate to={to} replace />}
    >
      <ApprovalChoices onExit={setExit} />
    </ProtectedRoute>
  )
}

function ApprovalChoices({
  onExit,
}: {
  onExit: (to: '/events' | '/organizer/') => void
}) {
  const { requestProtected, refreshSession } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const operation = useRef<AbortController | null>(null)
  const alert = useRef<HTMLParagraphElement>(null)

  useEffect(() => () => operation.current?.abort(), [])

  useEffect(() => {
    if (error) alert.current?.focus()
  }, [error])

  async function leave(to: '/events' | '/organizer/') {
    if (lock.current) return

    lock.current = true
    const controller = new AbortController()
    operation.current = controller
    setBusy(true)
    setError('')

    try {
      const response = await requestProtected(
        '/api/auth/acknowledge-approval',
        {
          method: 'POST',
          cache: 'no-store',
          signal: controller.signal,
        },
      )

      if (controller.signal.aborted) return

      if (response.status !== 204) {
        throw new Error(
          'Approval acknowledgment was not confirmed. Please retry, or refresh your session.',
        )
      }

      onExit(to)
      void refreshSession()
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not confirm acknowledgment. Please retry.',
        )
      }
    } finally {
      lock.current = false
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Application decision</p>
        <h1>Your organizer application is approved</h1>

        <p>
          You can now enter your organizer dashboard or explore campus events.
        </p>

        {error && (
          <p ref={alert} role="alert" tabIndex={-1}>
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <button
            disabled={busy}
            onClick={() => { void leave('/events') }}
          >
            Explore campus events
          </button>

          <button
            disabled={busy}
            onClick={() => { void leave('/organizer/') }}
          >
            Enter organizer dashboard
          </button>
        </div>

        {busy && <p role="status">Confirming your choice…</p>}

        <button
          disabled={busy}
          onClick={() => { void refreshSession() }}
        >
          Refresh status
        </button>
      </section>
    </main>
  )
}

export function EventsPortalPage() {
  const { destination } = useAuth()

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>Campus events</h1>
        <p>Event discovery is coming soon.</p>

        <Link to={destination ?? '/login'}>
          {destination ? 'Back to your account' : 'Sign in'}
        </Link>
      </section>
    </main>
  )
}