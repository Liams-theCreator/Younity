import { useState } from 'react'
import LoginForm from '../components/LoginForm'
import type { LoginCredentials } from '../auth/model'
import { login } from '../auth/service'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const [signedIn, setSignedIn] = useState(false)

  async function handleLogin(credentials: LoginCredentials) {
    await login(credentials)
    setSignedIn(true)
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
          {signedIn ? (
            <p role="status">Signed in successfully.</p>
          ) : (
            <LoginForm onSubmit={handleLogin} />
          )}
        </div>
      </section>
    </main>
  )
}