import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth'
import type { LoginCredentials } from '../auth/model'
import { RegistrationError, REGISTRATION_UNAVAILABLE } from './service'

export function useRegistration() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const request = useRef<AbortController | null>(null)
  const created = useRef(false)
  const [accountCreated, setAccountCreated] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<RegistrationError | null>(null)

  useEffect(() => () => request.current?.abort(), [])

  async function submit(create: (signal: AbortSignal) => Promise<void>, credentials: LoginCredentials) {
    if (request.current || created.current) return
    const controller = new AbortController()
    request.current = controller
    setIsSubmitting(true)
    setError(null)
    try {
      await create(controller.signal)
      created.current = true
      if (controller.signal.aborted) return
      setAccountCreated(true)
      try {
        await signIn(credentials)
        if (!controller.signal.aborted) navigate('/login', { replace: true })
      } catch {
        return
      }
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
