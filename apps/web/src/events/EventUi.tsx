import { useRef } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
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
  const menu = useRef<HTMLDialogElement>(null)
  const { pathname } = useLocation()
  const eventsCurrent = pathname === '/organizer/events' || pathname.endsWith('/edit')
  return (
    <>
      <header className={styles.mobileBar}>
        <Link className={styles.brand} to="/organizer/events">
          <EventIcon name="hub" />Younity
        </Link>
        <button type="button" aria-label="Open organizer navigation" aria-haspopup="dialog" onClick={() => menu.current?.showModal()}>
          <EventIcon name="menu" />
        </button>
      </header>
      <dialog ref={menu} className={styles.mobileDialog} aria-label="Organizer navigation" onClick={(event) => {
        if (event.target === event.currentTarget) menu.current?.close()
      }}>
        <button type="button" aria-label="Close organizer navigation" onClick={() => menu.current?.close()}>
          <EventIcon name="close" />
        </button>
        <nav aria-label="Mobile organizer workspace">
          <Link to="/organizer/events" aria-current={eventsCurrent ? 'page' : undefined} onClick={() => menu.current?.close()}><EventIcon name="calendar_month" />My events</Link>
          <NavLink to="/organizer/events/new" onClick={() => menu.current?.close()}><EventIcon name="add_circle" />Create event</NavLink>
          <NavLink to="/organizer/bookings" onClick={() => menu.current?.close()}><EventIcon name="confirmation_number" />Bookings</NavLink>
          <NavLink to="/organizer/" end onClick={() => menu.current?.close()}><EventIcon name="dashboard" />Dashboard</NavLink>
          <button type="button" onClick={() => { void signOut().catch(() => undefined) }}>Sign out</button>
        </nav>
      </dialog>
    <header className={styles.navbar}>
      <nav className={styles.navInner} aria-label="Organizer workspace">
        <Link className={styles.brand} to="/organizer/events">
          <EventIcon name="hub" />
          <span className={styles.brandText}>Younity</span>
        </Link>
        <span className={styles.workspacePill}>
          <EventIcon name="account_balance" />
          Organizer workspace
        </span>
        <div className={styles.navLinks}>
          <NavLink to="/organizer/" end title="Dashboard"><EventIcon name="dashboard" /><span className={styles.navLabel}>Dashboard</span></NavLink>
          <Link to="/organizer/events" aria-current={eventsCurrent ? 'page' : undefined} title="My events"><EventIcon name="calendar_month" /><span className={styles.navLabel}>My events</span></Link>
          <NavLink to="/organizer/events/new" title="Create event"><EventIcon name="add_circle" /><span className={styles.navLabel}>Create event</span></NavLink>
          <NavLink to="/organizer/bookings" title="Bookings"><EventIcon name="confirmation_number" /><span className={styles.navLabel}>Bookings</span></NavLink>
        </div>
        <div className={styles.accountTools}>
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
              <Link to="/organizer/">Dashboard</Link>
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
    </>
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
