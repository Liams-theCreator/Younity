import { Link, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth'
import styles from '../pages/AuthShell.module.css'
import AdminHeader from '../admin/AdminHeader'
import DiscoveryAccountNav from './DiscoveryAccountNav'

export default function LogoutButton() {
  const { status, user, destination, signOut } = useAuth()
  const { pathname } = useLocation()
  const isDiscovery = pathname === '/events' || pathname.startsWith('/events/') || pathname === '/student/dashboard'

  if (status !== 'authenticated') {
    return null
  }

  if (destination === '/admin/applications') return <AdminHeader />

  if (isDiscovery) {
    return <DiscoveryAccountNav key={pathname} destination={destination} signOut={signOut} />
  }

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
