import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import styles from '../pages/AuthShell.module.css'

export default function LogoutButton() {
  const { status, user, signOut } = useAuth()

  if (status !== 'authenticated') {
    return null
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