import { useEffect } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import layoutStyles from '../components/AuthPageLayout.module.css'
import OrganizerStatusLayout from '../components/OrganizerStatusLayout'
import ReferenceIcon from '../components/ReferenceIcon'
import styles from '../components/OrganizerStatusLayout.module.css'

export default function OrganizationStatusPage() {
  const { user, refreshSession } = useAuth()
  const status = user?.organizationStatus ?? 'PENDING'
  const correcting = status === 'NEEDS_CHANGES'

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
      status={status}
      applicationId={user?.application?.id}
      email={user?.email}
      reviewerNote={user?.application?.reviewerNote}
      back={status === 'PENDING' && (
        <Link className={layoutStyles.back} to="/organizer/application">
          <ReferenceIcon name="arrow_back" /> Back to Registration Step 2
        </Link>
      )}
    >
      <div className={styles.actions}>
        {!correcting && (
          <button type="button" onClick={() => { void refreshSession() }}>
            <ReferenceIcon name="refresh" /> Check status again
          </button>
        )}

        <Link className={correcting ? undefined : styles.primary} to="/events">
          <ReferenceIcon name="explore" /> Explore Campus Events as Attendee
        </Link>

        {correcting && (
          <Link className={styles.primary} to="/organizer/application">
            <ReferenceIcon name="edit_note" /> Update application
          </Link>
        )}
      </div>

      {correcting && (
        <button className={styles.refresh} type="button" onClick={() => { void refreshSession() }}>
          <ReferenceIcon name="refresh" /> Check status again
        </button>
      )}
    </OrganizerStatusLayout>
  )
}
