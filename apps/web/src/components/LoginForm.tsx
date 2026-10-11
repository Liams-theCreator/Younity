import { useRef, useState, type FormEvent } from 'react'
import { LoginError, type LoginCredentials } from '../auth/model'
import styles from './LoginForm.module.css'

type LoginFormProps = {
  onSubmit?: (credentials: LoginCredentials) => Promise<void>
}

export default function LoginForm({ onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const submissionInProgress = useRef(false)

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!onSubmit || submissionInProgress.current) return

    submissionInProgress.current = true
    setError('')
    setIsSubmitting(true)

    try {
        await onSubmit({ email: email.trim(), password })
    } catch (cause) {
        setError(
        cause instanceof LoginError
            ? cause.message
            : 'Unable to sign in. Please try again.',
        )
    } finally {
        submissionInProgress.current = false
        setIsSubmitting(false)
    }
    }

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit}
      aria-label="Sign in to Younity"
      aria-busy={isSubmitting}
    >
      <div>
        <label className={styles.label} htmlFor="login-email">
          Email Address
        </label>

        <input
          className={styles.input}
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="you@university.ac.ma"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isSubmitting}
          required
        />
      </div>

      <div>
        <label className={styles.label} htmlFor="login-password">
          Password
        </label>

        <div className={styles.passwordField}>
          <input
            className={`${styles.input} ${styles.passwordInput}`}
            id="login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isSubmitting}
            required
          />

          <button
            className={styles.toggle}
            type="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-controls="login-password"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((visible) => !visible)}
            disabled={isSubmitting}>
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <button
        className={styles.submit}
        type="submit"
        disabled={!onSubmit || isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign In to Younity'}
      </button>
    </form>
  )
}
