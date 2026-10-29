import { useAuth } from '../auth/useAuth'
import styles from './AuthShell.module.css'

export default function OrganizerDashboardPage() {
  const { user } = useAuth()

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>
          Organizer workspace
        </p>

        <h1>Organizer dashboard</h1>

        <p>
          Welcome, {user?.email}.
          Your organization is approved.
        </p>

        <p>
          Event management will be connected here in
          the next feature.
        </p>
      </section>
    </main>
  )
}