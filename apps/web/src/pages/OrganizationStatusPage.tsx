import { useEffect } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import OrganizerStatusLayout from '../components/OrganizerStatusLayout'
import styles from '../components/OrganizerStatusLayout.module.css'

export default function OrganizationStatusPage() {
  const { user, refreshSession } = useAuth()
  const status = user?.organizationStatus
  const note = user?.application?.reviewerNote

  useEffect(() => {
    if (status !== 'PENDING') return

    let refreshing = false

    async function refresh() {
      if (document.hidden || refreshing) return
      refreshing = true

      try {
        await refreshSession({ background: true })
      } finally {
        refreshing = false
      }
    }

    const timer = window.setInterval(() => {
      void refresh()
    }, 30000)

    const visible = () => {
      if (!document.hidden) void refresh()
    }

    document.addEventListener('visibilitychange', visible)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [status, refreshSession])

  return (
    <OrganizerStatusLayout
      status={status ?? 'PENDING'}
      applicationId={user?.application?.id}
      eyebrow="Organization verification"
      title={status === 'NEEDS_CHANGES'
        ? 'Your application needs changes'
        : status === 'REJECTED'
          ? 'Your application was not approved'
          : 'Organization verification pending'}
      description={status === 'NEEDS_CHANGES'
        ? 'Update your saved application and resubmit it for review.'
        : status === 'REJECTED'
          ? 'This application is closed. Your organization cannot publish events.'
          : 'Your application is waiting for review. This page checks for updates while it is visible.'}
      feedback={note && (
        <>
          <p>{note.length > 200 ? `${note.slice(0, 200)}…` : note}</p>

          {note.length > 200 && (
            <details>
              <summary>Read full feedback</summary>
              <p>{note}</p>
            </details>
          )}
        </>
      )}
    >
      <div className={styles.actions}>
        {(status === 'PENDING' || status === 'NEEDS_CHANGES') && (
          <Link
            className={status === 'NEEDS_CHANGES' ? styles.primary : undefined}
            to="/organizer/application"
          >
            View application
          </Link>
        )}

        <Link
          className={status === 'NEEDS_CHANGES' ? undefined : styles.primary}
          to="/events"
        >
          Explore campus events
        </Link>

        <button type="button" onClick={() => { void refreshSession() }}>
          Check status again
        </button>
      </div>
    </OrganizerStatusLayout>
  )
}
