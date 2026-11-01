import { apiRequest } from '../api/client'
import type { OrganizerRegistrationPayload, StudentRegistrationPayload } from './payload'

export interface RegistrationPageProps {
  policies?: { terms: string; privacy: string }
  signInPath?: string
}

export const REGISTRATION_UNAVAILABLE = 'Registration is temporarily unavailable. Please try again later.'

export class RegistrationError extends Error {
  readonly status?: number
  readonly details: string[]
  constructor(message: string, status?: number, details: string[] = []) {
    super(message)
    this.name = 'RegistrationError'
    this.status = status
    this.details = details
  }
}

async function register(
  path: string,
  payload: StudentRegistrationPayload | OrganizerRegistrationPayload,
  signal: AbortSignal,
  request: typeof fetch,
): Promise<void> {
  signal.throwIfAborted()
  let response: Response
  try {
    response = await request(path, {
      method: 'POST', credentials: 'include', signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
  } catch (cause) {
    if (signal.aborted) throw cause
    throw new RegistrationError('Unable to confirm registration. Check your connection. If you already have an account, please sign in.')
  }
  if (response.status >= 200 && response.status < 300) {
    const account: unknown = await response.json().catch(() => null)
    if (typeof account === 'object' && account !== null && 'id' in account && 'email' in account &&
        ((typeof account.id === 'string' && account.id.trim()) || (typeof account.id === 'number' && Number.isSafeInteger(account.id) && account.id > 0)) &&
        account.email === payload.email) return
    throw new RegistrationError('Registration response could not be verified. Please sign in before trying to register again.')
  }
  const data: unknown = await response.json().catch(() => null)
  const raw = typeof data === 'object' && data !== null && 'message' in data ? data.message : null
  const details = typeof raw === 'string' ? [raw] : Array.isArray(raw)
    ? raw.filter((item): item is string => typeof item === 'string') : []
  if (response.status === 409) {
    throw new RegistrationError('This email is already registered. Please sign in or use another email.', 409, ['email is already registered'])
  }
  if (response.status === 400 || response.status === 422) {
    throw new RegistrationError(details.join(' ') || 'Check your registration details and try again.', response.status, details)
  }
  throw new RegistrationError(REGISTRATION_UNAVAILABLE, response.status)
}

export function registerStudent(payload: StudentRegistrationPayload, signal: AbortSignal, request: typeof fetch = apiRequest): Promise<void> {
  return register('/api/auth/register/student', payload, signal, request)
}

export function registerOrganizer(payload: OrganizerRegistrationPayload, signal: AbortSignal, request: typeof fetch = apiRequest): Promise<void> {
  return register('/api/auth/register/organizer', payload, signal, request)
}
