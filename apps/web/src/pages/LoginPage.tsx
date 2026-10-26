import { Link, Navigate } from 'react-router'
import LoginForm from '../components/LoginForm'
import ReferenceIcon from '../components/ReferenceIcon'
import { useAuth } from '../auth/useAuth'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const auth = useAuth()

  const {
    status,
    destination,
    error,
    signIn,
    refreshSession,
  } = auth

  if (
    status === 'authenticated' &&
    destination !== null
  ) {
    return <Navigate to={destination} replace />
  }

  return (
    <div className={styles.shell}>
      <main className={styles.page}>
        <section
          className={styles.card}
          aria-labelledby="login-title"
        >
          <header className={styles.header}>
            <h1
              id="login-title"
              className={styles.title}
            >
              Welcome back to Younity
            </h1>

            <p className={styles.subtitle}>
              Manage university club spaces, curate
              hackathons, and verify attendee check-ins.
            </p>
          </header>

          <div className={styles.formArea}>
            {status === 'loading' ? (
              <p role="status">
                Checking your session…
              </p>
            ) : status === 'authenticated' ? (
              <p role="alert">
                Your account does not have access to a
                dashboard. Please contact support.
              </p>
            ) : (
              <>
                {auth.status === 'anonymous' &&
                  auth.reason === 'expired' && (
                    <p
                      className={styles.notice}
                      role="status"
                    >
                      Your session expired. Please sign
                      in again.
                    </p>
                  )}

                {status === 'error' && (
                  <div className={styles.notice}>
                    <p role="status">{error}</p>

                    <button
                      className={styles.retry}
                      type="button"
                      onClick={() => {
                        void refreshSession()
                      }}
                    >
                      Retry session check
                    </button>
                  </div>
                )}

                <LoginForm onSubmit={signIn} />
              </>
            )}
          </div>

          <div className={styles.join}>
            <p>
              <ReferenceIcon name="how_to_reg" />
              New to Younity?
            </p>

            <div className={styles.joinLinks}>
              <Link to="/register/student">
                <ReferenceIcon name="school" />
                Join as Student
              </Link>

              <Link to="/register/organizer">
                <ReferenceIcon name="corporate_fare" />
                Organizer
                <ReferenceIcon name="arrow_forward" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>
          © {new Date().getFullYear()} Younity Morocco
          {' · '}
          The Academic &amp; Civic Campus Network
        </p>

        <details>
          <summary>
            Privacy, terms &amp; support
          </summary>

          <p>
            Official policies and support details will
            be published before account registration
            opens.
          </p>
        </details>
      </footer>
    </div>
  )
}