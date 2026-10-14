import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth'
import LoginForm from '../components/LoginForm'
import type { LoginCredentials } from '../auth/model'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const auth = useAuth()
  const location = useLocation()
  const from: unknown = location.state?.from
  const destination = typeof from === 'string' && /^\/organizer\/pending(?:[?#].*)?$/.test(from) ? from : '/register'

  if (auth.status === 'authenticated') return <Navigate to={destination} replace />

  async function handleLogin(credentials: LoginCredentials) {
    await auth.signIn(credentials)
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="login-title">
        <header className={styles.header}>
          <h1 id="login-title" className={styles.title}>
            Welcome back to Younity
          </h1>

          <p className={styles.subtitle}>
            Manage university club spaces, curate hackathons, and verify
            attendee check-ins.
          </p>
        </header>

        <div className={styles.formArea}>
          {auth.status === 'loading' ? <p role="status">Checking your session…</p> : <LoginForm onSubmit={handleLogin} />}
        </div>
      </section>
    </main>
  )
}