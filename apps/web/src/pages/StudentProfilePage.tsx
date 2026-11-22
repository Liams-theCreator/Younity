import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import styles from './AuthShell.module.css'

export default function StudentProfilePage() {
  const { user } = useAuth()

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>
          Student workspace
        </p>

        <h1>Student profile</h1>

        <p>Welcome, {user?.email}.</p>

        <div className={styles.actions}>
          <Link to="/student/preferences">
            Edit discovery preferences
          </Link>
          <Link to="/events">Back to events</Link>
        </div>
      </section>
    </main>
  )
}