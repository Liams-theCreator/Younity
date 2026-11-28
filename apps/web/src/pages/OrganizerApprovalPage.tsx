import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router'
import ProtectedRoute from '../auth/ProtectedRoute'
import { useAuth } from '../auth/useAuth'
import OrganizerStatusLayout from '../components/OrganizerStatusLayout'
import decisionStyles from '../components/OrganizerStatusLayout.module.css'
import ReferenceIcon from '../components/ReferenceIcon'

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
          onClick={() => { void leave('/organizer/dashboard') }}
        >
          <ReferenceIcon name="dashboard" /> Enter organizer dashboard
        </button>

        <button
          type="button"
          className={decisionStyles.primary}
          disabled={busy}
          onClick={() => { void leave('/events') }}
        >
          <ReferenceIcon name="explore" /> Explore Campus Events as Attendee
        </button>
      </div>

      {busy && <p className={decisionStyles.busy} role="status">Confirming your choice…</p>}

      {error && (
        <button
          type="button"
          className={decisionStyles.refresh}
          onClick={() => { void refreshSession() }}
        >
          <ReferenceIcon name="refresh" /> Refresh status
        </button>
      )}
    </OrganizerStatusLayout>
  )
}
