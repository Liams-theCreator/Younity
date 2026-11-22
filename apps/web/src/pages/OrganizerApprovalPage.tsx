import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router'
import ProtectedRoute from '../auth/ProtectedRoute'
import { useAuth } from '../auth/useAuth'
import OrganizerStatusLayout from '../components/OrganizerStatusLayout'
import decisionStyles from '../components/OrganizerStatusLayout.module.css'
import styles from './AuthShell.module.css'

export default function OrganizerApprovalPage() {
  const [exit, setExit] = useState<
    '/events' | '/organizer/dashboard' | null
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
  onExit: (to: '/events' | '/organizer/dashboard') => void
}) {
  const { user, requestProtected, refreshSession } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const operation = useRef<AbortController | null>(null)
  const alert = useRef<HTMLParagraphElement>(null)

  useEffect(() => () => operation.current?.abort(), [])

  useEffect(() => {
    if (error) alert.current?.focus()
  }, [error])

  async function leave(to: '/events' | '/organizer/dashboard') {
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
    <OrganizerStatusLayout
      status="APPROVED"
      applicationId={user?.application?.id}
      eyebrow="Application decision"
      title="Your organizer application is approved"
      description="You can now enter your organizer dashboard or explore campus events."
    >
      {error && (
        <p className={decisionStyles.alert} ref={alert} role="alert" tabIndex={-1}>
          {error}
        </p>
      )}

      <div className={decisionStyles.actions}>
        <button
          type="button"
          disabled={busy}
          onClick={() => { void leave('/events') }}
        >
          Explore campus events
        </button>

        <button
          type="button"
          className={decisionStyles.primary}
          disabled={busy}
          onClick={() => { void leave('/organizer/dashboard') }}
        >
          Enter organizer dashboard
        </button>
      </div>

      {busy && <p role="status">Confirming your choice…</p>}

      <button
        type="button"
        className={decisionStyles.refresh}
        disabled={busy}
        onClick={() => { void refreshSession() }}
      >
        Refresh status
      </button>
    </OrganizerStatusLayout>
  )
}

export function EventsPortalPage() {
  const { status } = useAuth()

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>Campus events</h1>
        <p>Event discovery is coming soon.</p>

        {(status === 'anonymous' || status === 'error') && <Link to="/login">Sign in</Link>}
      </section>
    </main>
  )
}
