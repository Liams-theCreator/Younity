import { Link, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth'
import styles from '../pages/AuthShell.module.css'
import AdminHeader from '../admin/AdminHeader'
import { OrganizerEventHeader } from '../events/EventUi'

export default function LogoutButton() {
  const { status, user, destination, signOut } = useAuth()
  const { pathname } = useLocation()

  if (status !== 'authenticated') {
    return null
  }

  const organizerPage = pathname === '/organizer' || pathname === '/organizer/' ||
    pathname.startsWith('/organizer/events') || pathname === '/organizer/bookings'
  if (destination === '/organizer/' && organizerPage) return <OrganizerEventHeader />

  if (destination === '/admin/applications') return <AdminHeader />

  return (
    <nav className={styles.nav} aria-label="Account">
      <Link to="/">Younity</Link>

      <span>{user.email}</span>

      <button
        type="button"
        onClick={() => {
          void signOut().catch(() => undefined)
        }}
      >
        Sign out
      </button>
    </nav>
  )
}
