import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { apiRequest } from '../api/client'
import { maskEmail, resolveVerification, rememberVerification, VERIFICATION_TTL_MINUTES, type VerificationContext } from '../auth/emailVerification'
import styles from './EmailVerificationPage.module.css'

const genericNotice = 'If this address belongs to an account awaiting verification, check your inbox. Check your spam folder too.'
type RecoveryStatus = { verified: boolean; unavailable: boolean; expiresAt: string | null; deliveryFailed?: boolean }

function parseStatus(value: unknown): RecoveryStatus {
  if (typeof value !== 'object' || value === null || !('verified' in value) || typeof value.verified !== 'boolean' ||
    !('unavailable' in value) || typeof value.unavailable !== 'boolean' || !('expiresAt' in value) ||
    !(value.expiresAt === null || typeof value.expiresAt === 'string' && Number.isFinite(Date.parse(value.expiresAt))) ||
    ('deliveryFailed' in value && typeof value.deliveryFailed !== 'boolean')) {
    throw new Error('Unable to check verification status. Please try again.')
  }
  return value as RecoveryStatus
}

function Frame({ title, children, verified = false }: { title: string; children: ReactNode; verified?: boolean }) {
  return <main className={styles.shell}>
    <section className={styles.card} aria-labelledby="verification-title">
      <Link className={styles.brand} to="/login">Younity<span>.</span></Link>
      <div className={styles.icon} aria-hidden="true">{verified ? '✓' : '✉'}</div>
      <h1 id="verification-title">{title}</h1>
      {children}
      <Link className={styles.signIn} to="/login">{verified ? 'Go to sign in' : 'Back to sign in'}</Link>
    </section>
  </main>
}

export default function EmailVerificationPage() {
  const [params] = useSearchParams()
  const location = useLocation()
  const context = resolveVerification(location.state?.verification)
  const token = params.get('token')
  const email = params.get('email') ?? context?.email ?? ''
  if (token !== null) return <VerificationLink key={token} token={token} email={email} />
  if (params.get('recover') !== '1' && context?.recoveryToken) {
    return <RegistrationWaiting key={context.flowId} context={context} />
  }
  return <Frame title="Request a verification email"><PublicRecoveryForm key={location.key} initialEmail={email} /></Frame>
}

function PublicRecoveryForm({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  const feedback = useRef<HTMLParagraphElement>(null)
  useEffect(() => () => request.current?.abort(), [])

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true); setNotice(''); setError('')
    try {
      // Read the controlled input on this submission. A previous request or a
      // registration capability must never select the public form's recipient.
      const response = await apiRequest('/api/auth/resend-verification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      if (controller.signal.aborted) return
      if (!response.ok) throw new Error(response.status === 429 ? 'Too many requests. Please try again shortly.' : 'We could not complete your request. Please try again.')
      setNotice(genericNotice)
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof TypeError ? 'Unable to connect. Check your connection and try again.' : cause instanceof Error ? cause.message : 'We could not complete your request. Please try again.')
        requestAnimationFrame(() => feedback.current?.focus())
      }
    } finally {
      if (!controller.signal.aborted) { request.current = null; setBusy(false) }
    }
  }

  return <form className={styles.resend} onSubmit={(event) => { void send(event) }} aria-busy={busy}>
    <p>Enter the email used to register. This form only requests a verification email; it does not change your account details.</p>
    <label htmlFor="verification-email">Enter the email you registered with.</label>
    <input id="verification-email" type="email" autoComplete="email" maxLength={255} required value={email} onChange={(event) => setEmail(event.target.value)} />
    {error && <p ref={feedback} className={styles.error} role="alert" tabIndex={-1}>{error}</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    <button className={styles.primary} disabled={busy} type="submit">{busy ? 'Sending…' : 'Send verification email'}</button>
  </form>
}

function VerificationLink({ token, email }: { token: string; email: string }) {
  const [invalid, setInvalid] = useState(!/^[a-f0-9]{64}$/.test(token))
  const [verified, setVerified] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  async function verify() {
    if (request.current || verified || invalid) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true); setError('')
    try {
      const response = await apiRequest('/api/email-verification/verify-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ token }),
      })
      if (controller.signal.aborted) return
      if (response.status === 400) setInvalid(true)
      else if (!response.ok) setError('We could not verify your email. Please try again.')
      else setVerified(true)
    } catch {
      if (!controller.signal.aborted) setError('Unable to connect. Check your connection and try again.')
    } finally {
      if (!controller.signal.aborted) { request.current = null; setBusy(false) }
    }
  }
  return <Frame title={verified ? 'Email verified' : 'Verify email'} verified={verified}>
    <p className={styles.intro}>{verified ? 'Your email is verified. You can now sign in to Younity.' : `Confirm your email address to finish setting up your account. Verification links expire after ${VERIFICATION_TTL_MINUTES} minutes.`}</p>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {!verified && (invalid ? <>
      <p className={styles.error} role="alert">This link is no longer valid</p>
      <PublicRecoveryForm initialEmail={email} />
    </> : <button className={styles.primary} disabled={busy} onClick={() => { void verify() }}>{busy ? 'Verifying…' : 'Verify email'}</button>)}
  </Frame>
}

function RegistrationWaiting({ context }: { context: VerificationContext }) {
  const navigate = useNavigate()
  const [verification, setVerification] = useState(context)
  const current = useRef(context)
  const [status, setStatus] = useState<RecoveryStatus | null>(null)
  const [checking, setChecking] = useState(true)
  const [busy, setBusy] = useState(false)
  const [expiredSession, setExpiredSession] = useState(false)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [now, setNow] = useState(Date.now)
  const request = useRef<AbortController | null>(null)
  const persist = useCallback((state: RecoveryStatus) => {
    const previous = current.current
    const next = { ...previous, resendAvailableAt: state.expiresAt ? Date.parse(state.expiresAt) : 0,
      deliveryFailed: state.expiresAt || state.verified ? false : state.deliveryFailed ?? previous.deliveryFailed }
    if (next.resendAvailableAt !== previous.resendAvailableAt || next.deliveryFailed !== previous.deliveryFailed) {
      current.current = rememberVerification(next)
      setVerification(current.current)
      // Keep history state current as well, including when session storage is unavailable.
      void navigate('/verify-email', { replace: true, state: { verification: current.current } })
    }
    setStatus(state)
    setNow(Date.now())
  }, [navigate])

  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    async function check() {
      setChecking(true)
      try {
        const response = await apiRequest('/api/email-verification/recovery-status', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal: controller.signal,
          body: JSON.stringify({ recoveryToken: context.recoveryToken }),
        })
        if (!active || request.current) return
        if (response.status === 401) { setExpiredSession(true); return }
        if (!response.ok) throw new Error()
        const state = parseStatus(await response.json())
        if (!active || request.current) return
        persist(state); setError('')
      } catch {
        if (active) setError('Unable to check verification status. Please try again.')
      } finally {
        if (active) setChecking(false)
      }
    }
    void check()
    return () => { active = false; controller.abort() }
  }, [context.recoveryToken, refresh, persist])

  useEffect(() => {
    const focus = () => { if (!request.current) setRefresh((value) => value + 1) }
    const visibility = () => { if (document.visibilityState === 'visible') focus() }
    window.addEventListener('focus', focus)
    document.addEventListener('visibilitychange', visibility)
    const deadline = verification.resendAvailableAt
    const timer = deadline > Date.now() ? window.setTimeout(focus, deadline - Date.now()) : undefined
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', focus)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [verification.resendAvailableAt])

  async function retry() {
    if (request.current || checking || expiredSession || status?.verified || status?.unavailable || current.current.resendAvailableAt > Date.now()) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true); setError('')
    try {
      const response = await apiRequest('/api/email-verification/retry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ recoveryToken: context.recoveryToken }),
      })
      if (controller.signal.aborted) return
      if (response.status === 401) { setExpiredSession(true); return }
      if (!response.ok) throw new Error(response.status === 429 ? 'Too many requests. Please try again shortly.' : 'We could not complete your request. Please try again.')
      const state = parseStatus(await response.json())
      if (!controller.signal.aborted) persist(state)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error && !(cause instanceof TypeError) ? cause.message : 'Unable to connect. Check your connection and try again.')
    } finally {
      if (!controller.signal.aborted) { request.current = null; setBusy(false) }
    }
  }
  const verified = status?.verified === true
  const canRetry = !checking && !expiredSession && !status?.unavailable && verification.resendAvailableAt <= now && (status !== null || verification.deliveryFailed)
  return <Frame title={verified ? 'Email verified' : 'Check your email'} verified={verified}>
    <p className={styles.intro}>{verified ? 'Your email is verified. You can now sign in to Younity.' : `Open the verification link in your inbox to finish setting up your account. Check your spam folder too. Links expire after ${VERIFICATION_TTL_MINUTES} minutes.`}</p>
    {!verified && <>
      <p className={styles.address}>{maskEmail(verification.email)}</p>
      {verification.deliveryFailed && <p className={styles.warning}>Your account was created, but we could not send the email. Retry sending to your existing account.</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {expiredSession ? <p role="status">This verification session expired. Return to sign in for account assistance.</p>
        : status?.unavailable ? <p>Please return to sign in for account assistance.</p>
        : checking ? <p role="status">Checking verification status…</p>
        : canRetry ? <button className={styles.primary} disabled={busy} onClick={() => { void retry() }}>{busy ? 'Sending…' : verification.deliveryFailed ? 'Retry sending' : 'Resend verification email'}</button>
        : status === null ? <button className={styles.primary} onClick={() => setRefresh((value) => value + 1)}>Retry status check</button>
        : <p>You can request another email when the current link expires.</p>}
    </>}
  </Frame>
}
