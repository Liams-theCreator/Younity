import type { RegistrationDraft, StudentRegistrationDraft } from './model'
import type { OrganizationDetails } from './organizationDraft'

export interface RegistrationPageProps {
  policies?: { terms: string; privacy: string }
  signInPath?: string
}

export interface OrganizerRegistrationInput {
  account: RegistrationDraft
  organization: OrganizationDetails
  document: File | null
}

export const REGISTRATION_UNAVAILABLE =
  'Backend integration is not available. No account was created and no data was sent.'

export async function registerStudent(
  draft: StudentRegistrationDraft,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted()
  // Retain the typed input boundary until the approved DTO mapping is supplied.
  void draft
  // TODO: Connect real API. Map approved DTO fields explicitly; never send
  // confirmPassword or assume UI institution labels are backend identifiers.
  throw new Error(REGISTRATION_UNAVAILABLE)
}

/** Development-only Mock API: no account is created and no file is uploaded. */
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
  _input: OrganizerRegistrationInput,
  signal: AbortSignal,
): Promise<'pending'> {
  if (import.meta.env.DEV) return mockRegisterOrganizer(signal)
  // TODO: Connect real API with fetch(..., { signal }). Map the approved DTO
  // and upload contract; return pending only after confirmed server success.
  throw new Error(REGISTRATION_UNAVAILABLE)
}

/** Local status-screen fixture, not an application decision from the server. */
export function mockRevisedDossier(): 'pending' {
  return 'pending'
}
