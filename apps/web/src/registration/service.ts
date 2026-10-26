import type { OrganizerRegistrationPayload, StudentRegistrationPayload } from './payload'

export interface RegistrationPageProps {
  policies?: { terms: string; privacy: string }
  signInPath?: string
}

export const REGISTRATION_UNAVAILABLE =
  'Backend integration is not available. No account was created and no data was sent.'

export async function registerStudent(
  payload: StudentRegistrationPayload,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted()
  void payload
  throw new Error(REGISTRATION_UNAVAILABLE)
}

export function mockRegisterOrganizer(signal: AbortSignal): Promise<'pending'> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Submission cancelled', 'AbortError'))
      return
    }
    const cancel = () => {
      clearTimeout(timer)
      reject(new DOMException('Submission cancelled', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', cancel)
      resolve('pending')
    }, 1500)
    signal.addEventListener('abort', cancel, { once: true })
  })
}

export async function registerOrganizer(
  _payload: OrganizerRegistrationPayload,
  signal: AbortSignal,
): Promise<'pending'> {
  if (import.meta.env.DEV) return mockRegisterOrganizer(signal)
  throw new Error(REGISTRATION_UNAVAILABLE)
}

export function mockRevisedDossier(): 'pending' {
  return 'pending'
}
