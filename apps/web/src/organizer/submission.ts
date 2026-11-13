import { DraftError, draftChanges, draftFields, emptyDraft, type DraftValues } from './draft'

export type SubmissionErrors = Partial<Record<keyof DraftValues, string>>

export function submissionErrors(values: DraftValues): SubmissionErrors {
  const errors: SubmissionErrors = {}
  for (const field of draftFields) {
    if (field !== 'proofUrl' && !values[field].trim()) {
      errors[field] = 'Required before submitting your application.'
      continue
    }
    try {
      draftChanges({ ...emptyDraft, [field]: values[field] }, emptyDraft)
    } catch (cause) {
      errors[field] = cause instanceof DraftError ? cause.message : 'Check this value.'
    }
  }
  return errors
}

export class SubmissionError extends Error {
  readonly reload: boolean

  constructor(message: string, reload = false) {
    super(message)
    this.reload = reload
  }
}

// Proposed contract: submit the saved draft; the backend decides first submission
// versus resubmission from its persisted state, never from a client status flag.
export async function submitApplication(request: typeof fetch, signal: AbortSignal) {
  const unconfirmed = 'Submission could not be confirmed. Reload your application to check its state before trying again.'
  let response: Response
  try {
    response = await request('/api/organizer-applications/submit', {
      method: 'POST', credentials: 'include', cache: 'no-store', signal,
    })
  } catch (cause) {
    if (signal.aborted) throw cause
    throw new SubmissionError(unconfirmed, true)
  }
  if (response.status === 401) throw new SubmissionError('Your session expired. Please sign in again.')
  if (response.status === 403) {
    throw new SubmissionError('You do not have permission to submit this application. Reload to check access.', true)
  }
  if (response.status === 409) {
    throw new SubmissionError('This application changed. Reload it before taking another action.', true)
  }
  if (response.status === 400 || response.status === 422) {
    throw new SubmissionError('The application was not accepted. Check the required information and try again.')
  }
  if (response.status !== 200 && response.status !== 201) {
    throw new SubmissionError(unconfirmed, true)
  }
  const value: unknown = await response.json().catch(() => null)
  if (!value || typeof value !== 'object' || !('application' in value)) {
    throw new SubmissionError(unconfirmed, true)
  }
  const application = value.application
  if (!application || typeof application !== 'object' ||
    !('id' in application) || typeof application.id !== 'string' || !application.id.trim() ||
    !('status' in application) || application.status !== 'PENDING') {
    throw new SubmissionError(unconfirmed, true)
  }
}