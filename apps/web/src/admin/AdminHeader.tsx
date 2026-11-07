import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import AdminIcon from './AdminIcon'
import styles from './review.module.css'

export default function AdminHeader() {
  const { user, signOut } = useAuth()
  return (
    <header className={styles.navbar}>
      <nav className={styles.navInner} aria-label="Account">
        <Link to="/admin/applications" className={styles.brand}>
          <span className={styles.brandMark}><AdminIcon name="verified_user" /></span>
          <span>Younity Admin</span>
          <span className={styles.adminPill}>ADMIN</span>
        </Link>
        <Link to="/admin/applications" className={styles.navActive} aria-current="page">Application reviews</Link>
        <div className={styles.account}>
          <span className={styles.avatar} aria-hidden="true">{user?.email.slice(0, 2).toUpperCase()}</span>
          <div className={styles.accountInfo}><strong>{user?.email}</strong><span>Administrator</span></div>
          <button type="button" className={styles.signOut} onClick={() => { void signOut().catch(() => undefined) }}>
            <AdminIcon name="logout" /> Sign out
          </button>
        </div>
      </nav>
    </header>
  )
}
