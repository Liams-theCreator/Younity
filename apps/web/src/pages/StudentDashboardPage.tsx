import { useAuth } from '../auth/useAuth'
import styles from './AuthShell.module.css'

export default function StudentDashboardPage() {
  const { user } = useAuth()

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>
          Student workspace
        </p>

        <h1>Student dashboard</h1>

        <p>Welcome, {user?.email}.</p>

        <p>
          You are signed in. Event discovery will be
          connected here in the next feature.
        </p>
      </section>
    </main>
  )
}