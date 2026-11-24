import { Link, NavLink } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { EventUiError } from './model'
import styles from './events.module.css'
export function EventIcon({ name }: { name: string }) {
  return (
    <span className={styles.icon} aria-hidden="true">
      {name}
    </span>
  )
}
export function OrganizerEventHeader() {
  const { user, signOut } = useAuth()
  return (
    <header className={styles.navbar}>
      <nav className={styles.navInner} aria-label="Organizer workspace">
        <Link className={styles.brand} to="/organizer/events">
          <EventIcon name="hub" />
          Younity
        </Link>
        <span className={styles.workspacePill}>
          <EventIcon name="account_balance" />
          Organizer workspace
        </span>
        <div className={styles.navLinks}>
          <NavLink to="/organizer/events">My events</NavLink>
          <NavLink to="/organizer/bookings">Bookings</NavLink>
        </div>
        <div className={styles.accountTools}>
          <button
            type="button"
            className={styles.notifications}
            disabled
            aria-label="Notifications unavailable"
            title="Notifications are not available yet"
          >
            <EventIcon name="notifications" />
          </button>
          <details
            className={styles.account}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.currentTarget.open = false
                event.currentTarget.querySelector('summary')?.focus()
              }
            }}
          >
            <summary aria-label="Organizer account">
              <span className={styles.avatar} aria-hidden="true">
                {user?.email.slice(0, 1).toUpperCase()}
              </span>
              <span className={styles.accountInfo}>
                <span className={styles.accountEmail} title={user?.email}>
                  {user?.email}
                </span>
                <span className={styles.accountRole}>Organizer</span>
              </span>
              <EventIcon name="expand_more" />
            </summary>
            <div className={styles.accountMenu}>
              <Link to="/organizer/dashboard">Dashboard</Link>
              <button
                type="button"
                className={styles.signOut}
                onClick={() => {
                  void signOut().catch(() => undefined)
                }}
              >
                Sign out
              </button>
            </div>
          </details>
        </div>
      </nav>
    </header>
  )
}
export function EventState({
  loading,
  error,
  retry,
  unavailableTitle = 'Unable to load information',
}: {
  loading?: boolean
  error?: EventUiError
  retry?: () => void
  unavailableTitle?: string
}) {
  if (loading)
    return (
      <div className={styles.state} role="status">
        <EventIcon name="hourglass_top" />
        <p>Loading…</p>
        <div className={styles.skeleton} />
      </div>
    )
  if (!error) return null
  return (
    <section className={styles.state}>
      <EventIcon name={error.kind === 'forbidden' ? 'lock' : 'cloud_off'} />
      <h2>
        {error.kind === 'forbidden'
          ? 'Access restricted'
          : error.kind === 'not-found'
            ? 'Information unavailable'
            : unavailableTitle}
      </h2>
      <p role="alert">{error.message}</p>
      {retry && error.kind !== 'forbidden' && error.kind !== 'not-found' && (
        <button type="button" onClick={retry}>
          Try again
        </button>
      )}
    </section>
  )
}
