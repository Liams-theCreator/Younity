import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { rememberVerification, VERIFICATION_RESEND_SECONDS } from '../auth/emailVerification'
import { RegistrationError, REGISTRATION_UNAVAILABLE, type RegistrationResult } from './service'

export function useRegistration() {
  const navigate = useNavigate()
  const request = useRef<AbortController | null>(null)
  const created = useRef(false)
  const [accountCreated, setAccountCreated] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<RegistrationError | null>(null)

  useEffect(() => () => request.current?.abort(), [])

  async function submit(create: (signal: AbortSignal) => Promise<RegistrationResult>, credentials: { email: string }) {
    if (request.current || created.current) return
    const controller = new AbortController()
    request.current = controller
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await create(controller.signal)
      created.current = true
      if (controller.signal.aborted) return
      setAccountCreated(true)
      const verification = rememberVerification({
        email: credentials.email,
        deliveryFailed: !result.verificationEmailSent,
        resendAvailableAt: result.verificationEmailSent ? Date.now() + VERIFICATION_RESEND_SECONDS * 1000 : 0,
      })
      navigate('/verify-email', { replace: true, state: { verification } })
    } catch (cause) {
      if (!controller.signal.aborted) {
        const failure = cause instanceof RegistrationError ? cause : new RegistrationError(REGISTRATION_UNAVAILABLE)
        setError(failure)
        return failure
      }
    } finally {
      if (!controller.signal.aborted) {
        request.current = null
        setIsSubmitting(false)
      }
    }
  }

  return { submit, isSubmitting, accountCreated, error, clearError: () => setError(null) }
}
