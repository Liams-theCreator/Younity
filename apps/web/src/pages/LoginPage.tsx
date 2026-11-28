import { Link, Navigate } from 'react-router'
import AuthPageLayout from '../components/AuthPageLayout'
import layoutStyles from '../components/AuthPageLayout.module.css'
import LoginForm from '../components/LoginForm'
import ReferenceIcon from '../components/ReferenceIcon'
import { useAuth } from '../auth/useAuth'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const auth = useAuth()

  if (
    auth.status === 'authenticated' &&
    auth.destination !== null
  ) {
    return <Navigate to={auth.destination} replace />
  }

  return (
    <AuthPageLayout variant="login">
      <div className={styles.frame}>
        <Link className={layoutStyles.back} to="/events">
          <ReferenceIcon name="arrow_back" />
          Back to Directory
        </Link>

        <section
          className={layoutStyles.card}
          aria-labelledby="login-title"
        >
          <header>
            <h1
              id="login-title"
              className={layoutStyles.title}
            >
              Welcome back to Younity
            </h1>

            <p className={layoutStyles.subtitle}>
              Manage university club spaces, curate hackathons,
              and verify attendee check-ins.
            </p>
          </header>

          <div className={styles.formArea}>
            {auth.status === 'loading' ? (
              <p role="status">
                Checking your session…
              </p>
            ) : auth.status === 'authenticated' ? (
              <p role="alert">
                Your account does not have access to a dashboard.
                Please contact support.
              </p>
            ) : (
              <>
                {auth.status === 'anonymous' &&
                  auth.reason === 'expired' && (
                    <p
                      className={styles.notice}
                      role="status"
                    >
                      Your session expired. Please sign in again.
                    </p>
                  )}

                {auth.status === 'anonymous' &&
                  auth.reason === 'email-unverified' && (
                    <div className={styles.notice} role="status">
                      <p>Verify your email before signing in.</p>
                      <Link to="/verify-email">Resend verification email</Link>
                    </div>
                  )}

                {auth.status === 'error' && (
                  <div className={styles.notice}>
                    <p role="alert">{auth.error}</p>

                    <button
                      className={styles.retry}
                      type="button"
                      onClick={() => {
                        if (auth.operation === 'logout') {
                          void auth
                            .signOut()
                            .catch(() => undefined)
                        } else {
                          void auth.refreshSession()
                        }
                      }}
                    >
                      {auth.operation === 'logout'
                        ? 'Retry sign out'
                        : 'Retry session check'}
                    </button>
                  </div>
                )}

                <LoginForm onSubmit={auth.signIn} />
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
        <footer className={styles.footer}>
          <p>
            © {new Date().getFullYear()} Younity Morocco
            {' · '}
            The Academic &amp; Civic Campus Network
          </p>

          <details>
            <summary>Privacy, terms &amp; support</summary>
            <p>
              Official policies and support details will be
              published before account registration opens.
            </p>
          </details>
        </footer>
      </div>
    </AuthPageLayout>
  )
}
