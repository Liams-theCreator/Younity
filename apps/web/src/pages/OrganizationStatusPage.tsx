import { useAuth } from '../auth/useAuth'
import styles from './AuthShell.module.css'

export default function OrganizationStatusPage() {
  const {
    user,
    refreshSession,
  } = useAuth()

  const status = user?.organizationStatus

  const title =
    status === 'NEEDS_CHANGES'
      ? 'Your application needs changes'
      : status === 'REJECTED'
        ? 'Your application was not approved'
        : 'Organization verification pending'

  const message =
    status === 'NEEDS_CHANGES'
      ? 'Your organization cannot publish events yet. Application editing and reviewer feedback will be provided by the registration flow.'
      : status === 'REJECTED'
        ? 'This application is closed. Your organization cannot publish events.'
        : 'Your organization is waiting for review. You will be able to publish events once it is approved.'

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>
          Organization verification
        </p>

        <h1>{title}</h1>

        <p>{message}</p>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => {
              void refreshSession()
            }}
          >
            Check status again
          </button>
        </div>

        <p>
          Event discovery and application details will
          be connected when those features are
          available.
        </p>
      </section>
    </main>
  )
}