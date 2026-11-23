import { organizationTypes } from '../registration/organizationDraft'
import { isMoroccanPhoneNumber, moroccanDialCode, moroccanPhoneError } from '../registration/moroccanPhone'
import { isProofDocument, proofSizeError, type ProofDocument } from './proof'

export const draftFields = [
  'organizationName', 'type', 'representativeFullName',
  'academicPosition', 'phoneNumber',
] as const
export type DraftValues = Record<typeof draftFields[number], string>
export type DraftSnapshot = { values: DraftValues; canEdit: boolean; exists: boolean; proof: ProofDocument | null }
export const emptyDraft: DraftValues = {
  organizationName: '', type: '', representativeFullName: '',
  academicPosition: '', phoneNumber: '',
}
export class DraftError extends Error {}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseDraft(value: unknown): DraftSnapshot {
  if (!isObject(value) || typeof value.canEdit !== 'boolean') {
    throw new DraftError('The draft response could not be verified. Please retry.')
  }
  if (value.draft === null) {
    return { values: { ...emptyDraft }, canEdit: value.canEdit, exists: false, proof: null }
  }
  const data = value.draft
  if (!isObject(data) || draftFields.some((field) =>
    !(field in data) || !(data[field] === null || typeof data[field] === 'string'),
  ) || (data.type !== null && !organizationTypes.some((type) => type === data.type))) {
    throw new DraftError('The draft response could not be verified. Please retry.')
  }
  const values = { ...emptyDraft }
  for (const field of draftFields) values[field] = (data[field] as string | null) ?? ''
  const proof = data.proof ?? null
  if (proof !== null && !isProofDocument(proof)) {
    throw new DraftError('The draft response could not be verified. Please retry.')
  }
  return { values, canEdit: value.canEdit, exists: true, proof }
}

export function draftChanges(values: DraftValues, baseline: DraftValues) {
  const changes: Partial<Record<keyof DraftValues, string | null>> = {}
  for (const field of draftFields) {
    const value = values[field].trim()
    if (value === baseline[field].trim()) continue
    if (value.length > 255) {
      throw new DraftError('Use at most 255 characters per field.')
    }
    if (field === 'type' && value && !organizationTypes.some((type) => type === value)) {
      throw new DraftError('Select a supported entity category.')
    }
    if (field === 'phoneNumber' && value) {
      const valid = value.startsWith(moroccanDialCode) ? isMoroccanPhoneNumber(value) : /^\+[1-9][0-9 ()-]{6,}$/.test(value)
      if (!valid) throw new DraftError(moroccanPhoneError)
    }
    changes[field] = value || null
  }
  return changes
}

export async function requestDraft(
  request: typeof fetch,
  signal: AbortSignal,
  changes?: ReturnType<typeof draftChanges>,
  proof?: File,
): Promise<DraftSnapshot> {
  const form = proof ? new FormData() : undefined
  if (form && proof) {
    form.set('changes', JSON.stringify(changes ?? {}))
    form.set('proof', proof)
  }
  let response: Response
  try {
    response = await request('/api/organizer-applications/draft', {
      method: changes || proof ? 'PATCH' : 'GET',
      credentials: 'include', cache: 'no-store', signal,
      ...(form ? { body: form } : changes ? {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      } : {}),
    })
  } catch (cause) {
    if (signal.aborted) throw cause
    throw new DraftError('Could not connect. Your draft changes have not been confirmed. Please retry.')
  }
  if (response.status === 401) throw new DraftError('Your session expired. Please sign in again.')
  if (response.status === 403) throw new DraftError('You do not have permission to access or edit this draft.')
  if (response.status === 413) throw new DraftError(proofSizeError)
  if (response.status === 400 || response.status === 422) {
    const error: unknown = proof ? await response.json().catch(() => null) : null
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
      throw new DraftError(error.message)
    }
    throw new DraftError('The draft was not accepted. Check the supplied values and try again.')
  }
  if (response.status !== 200) throw new DraftError('The draft service is unavailable. Please try again.')
  const result = parseDraft(await response.json().catch(() => null))
  if ((changes || proof) && (!result.exists || (proof && !result.proof))) {
    throw new DraftError('Saving could not be confirmed. Please retry.')
  }
  return result
}
