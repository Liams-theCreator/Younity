import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { apiRequest } from '../api/client'
import { maskEmail, readVerification, rememberVerification, VERIFICATION_RESEND_SECONDS, VERIFICATION_TTL_MINUTES, type VerificationContext } from '../auth/emailVerification'
import styles from './EmailVerificationPage.module.css'

export default function EmailVerificationPage() {
  const [params] = useSearchParams()
  const location = useLocation()
  return <VerificationContent key={location.key} params={params} context={location.state?.verification ?? readVerification()} />
}

function VerificationContent({ params, context }: { params: URLSearchParams; context: VerificationContext | null }) {
  const token = params.get('token')
  const validToken = token !== null && /^[a-f0-9]{64}$/.test(token)
  // Support previously issued handoff URLs; new handoffs keep addresses out of URLs.
  const initialEmail = params.get('email') ?? context?.email ?? ''
  const [email, setEmail] = useState(initialEmail)
  const [knownEmail, setKnownEmail] = useState(initialEmail)
  const [resendAt, setResendAt] = useState(context?.resendAvailableAt ?? 0)
  const [now, setNow] = useState(Date.now)
  const [deliveryFailed, setDeliveryFailed] = useState(params.get('sent') === '0' || Boolean(context?.deliveryFailed))
  const [requestingLink, setRequestingLink] = useState(!token)
  const [invalidLink, setInvalidLink] = useState(token !== null && !validToken)
  const [busy, setBusy] = useState<'verify' | 'resend' | null>(null)
  const [verified, setVerified] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  const feedback = useRef<HTMLParagraphElement>(null)
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000))

  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    if (resendAt <= Date.now()) return
    const timer = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= resendAt) window.clearInterval(timer)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [resendAt])

  async function send(action: 'verify' | 'resend') {
    if (request.current || verified || (action === 'resend' && remaining > 0)) return
    const controller = new AbortController()
    request.current = controller
    setBusy(action)
    setError('')
    setNotice('')
    try {
      const address = (knownEmail || email).trim().toLowerCase()
      const response = await apiRequest(action === 'verify' ? '/api/email-verification/verify-email' : '/api/auth/resend-verification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify(action === 'verify' ? { token } : { email: address }),
      })
      if (controller.signal.aborted) return
      if (action === 'verify' && response.status === 400) {
        setInvalidLink(true)
        return
      }
      if (!response.ok) {
        throw new Error(response.status === 429 ? 'Too many requests. Please try again shortly.' : 'We could not complete your request. Please try again.')
      }
      if (action === 'verify') setVerified(true)
      else {
        const resendAvailableAt = Date.now() + VERIFICATION_RESEND_SECONDS * 1000
        rememberVerification({ email: address, resendAvailableAt, deliveryFailed: false })
        setKnownEmail(address)
        setResendAt(resendAvailableAt)
        setNow(Date.now())
        setDeliveryFailed(false)
        setNotice('If this address belongs to an account awaiting verification, check your inbox. Check your spam folder too.')
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error && !(cause instanceof TypeError) ? cause.message : 'Unable to connect. Check your connection and try again.')
        requestAnimationFrame(() => feedback.current?.focus())
      }
    } finally {
      if (!controller.signal.aborted) {
        request.current = null
        setBusy(null)
      }
    }
  }

  function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void send('resend')
  }

  const canRecover = !token || invalidLink
  const resendLabel = busy === 'resend' ? 'Sending…' : deliveryFailed ? 'Retry sending' : invalidLink ? 'Request a new link' : 'Resend email'

  return (
    <main className={styles.shell}>
      <section className={styles.card} aria-labelledby="verification-title" aria-busy={busy !== null}>
        <Link className={styles.brand} to="/login">Younity<span>.</span></Link>
        <div className={styles.icon} aria-hidden="true">{verified ? '✓' : '✉'}</div>
        <h1 id="verification-title">{verified ? 'Email verified' : token ? 'Verify email' : 'Check your email'}</h1>
        <p className={styles.intro}>
          {verified ? 'Your email is verified. You can now sign in to Younity.' : token
            ? `Confirm your email address to finish setting up your account. Verification links expire after ${VERIFICATION_TTL_MINUTES} minutes.`
            : `Open the verification link in your inbox to finish setting up your account. Check your spam folder too. Links expire after ${VERIFICATION_TTL_MINUTES} minutes.`}
        </p>
        {!verified && knownEmail && <p className={styles.address}>{maskEmail(knownEmail)}</p>}
        {!verified && deliveryFailed && <p className={styles.warning}>Your account was created, but we could not send the email. Retry sending to your existing account.</p>}
        {!verified && invalidLink && <p className={styles.error} role="alert">This link is no longer valid</p>}
        {error && <p ref={feedback} className={styles.error} role="alert" tabIndex={-1}>{error}</p>}
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        {validToken && !invalidLink && !verified && (
          <button className={styles.primary} disabled={busy !== null} onClick={() => void send('verify')}>
            {busy === 'verify' ? 'Verifying…' : 'Verify email'}
          </button>
        )}
        {!verified && canRecover && (
          <div className={styles.resend}>
            {remaining > 0 ? <p role="status">You can request another email in {remaining} seconds.</p> : knownEmail ? <>
              {!invalidLink && !deliveryFailed && <p>Didn’t receive it?</p>}
              <button className={styles.primary} disabled={busy !== null} onClick={() => void send('resend')}>{resendLabel}</button>
            </> : !requestingLink ? (
              <button className={styles.primary} onClick={() => setRequestingLink(true)}>Request a new link</button>
            ) : (
              <form onSubmit={resend}>
                <label htmlFor="verification-email">Email address</label>
                <input id="verification-email" type="email" autoComplete="email" maxLength={255} disabled={busy !== null} required value={email} onChange={(event) => setEmail(event.target.value)} />
                <button className={styles.primary} disabled={busy !== null} type="submit">{resendLabel}</button>
              </form>
            )}
          </div>
        )}
        <Link className={styles.signIn} to="/login">{verified || invalidLink ? 'Go to sign in' : 'Back to sign in'}</Link>
      </section>
    </main>
  )
}
