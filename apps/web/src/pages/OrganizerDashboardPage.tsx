import { Link } from 'react-router'
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
          Plan your next event or view your participants.
        </p>
        <p><Link to="/organizer/events">My events</Link> · <Link to="/organizer/events/new">Create event</Link> · <Link to="/organizer/bookings">Bookings</Link></p>
      </section>
    </main>
  )
}