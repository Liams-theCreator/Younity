import { organizationTypes } from '../registration/organizationDraft'

export const draftFields = [
  'organizationName', 'type', 'representativeFullName',
  'academicPosition', 'phoneNumber', 'proofUrl',
] as const
export type DraftValues = Record<typeof draftFields[number], string>
export type DraftSnapshot = { values: DraftValues; canEdit: boolean; exists: boolean }
export const emptyDraft: DraftValues = {
  organizationName: '', type: '', representativeFullName: '',
  academicPosition: '', phoneNumber: '', proofUrl: '',
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
    return { values: { ...emptyDraft }, canEdit: value.canEdit, exists: false }
  }
  const data = value.draft
  if (!isObject(data) || draftFields.some((field) =>
    !(field in data) || !(data[field] === null || typeof data[field] === 'string'),
  ) || (data.type !== null && !organizationTypes.some((type) => type === data.type))) {
    throw new DraftError('The draft response could not be verified. Please retry.')
  }
  const values = { ...emptyDraft }
  for (const field of draftFields) values[field] = (data[field] as string | null) ?? ''
  return { values, canEdit: value.canEdit, exists: true }
}

export function draftChanges(values: DraftValues, baseline: DraftValues) {
  const changes: Partial<Record<keyof DraftValues, string | null>> = {}
  for (const field of draftFields) {
    const value = values[field].trim()
    if (value === baseline[field].trim()) continue
    if (value.length > (field === 'proofUrl' ? 512 : 255)) {
      throw new DraftError(`Use at most ${field === 'proofUrl' ? 512 : 255} characters per field.`)
    }
    if (field === 'type' && value && !organizationTypes.some((type) => type === value)) {
      throw new DraftError('Select a supported entity category.')
    }
    if (field === 'phoneNumber' && value && !/^\+[1-9][0-9 ()-]{6,}$/.test(value)) {
      throw new DraftError('Enter a contact phone number including its country code.')
    }
    if (field === 'proofUrl' && value) {
      try {
        const url = new URL(value)
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
      } catch {
        throw new DraftError('Enter a complete http:// or https:// supporting link.')
      }
    }
    changes[field] = value || null
  }
  return changes
}

export async function requestDraft(
  request: typeof fetch,
  signal: AbortSignal,
  changes?: ReturnType<typeof draftChanges>,
): Promise<DraftSnapshot> {
  let response: Response
  try {
    response = await request('/api/organizer-applications/draft', {
      method: changes ? 'PATCH' : 'GET',
      credentials: 'include', cache: 'no-store', signal,
      ...(changes ? {
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
  if (response.status === 400 || response.status === 422) {
    throw new DraftError('The draft was not accepted. Check the supplied values and try again.')
  }
  if (response.status !== 200) throw new DraftError('The draft service is unavailable. Please try again.')
  const result = parseDraft(await response.json().catch(() => null))
  if (changes && !result.exists) throw new DraftError('Saving could not be confirmed. Please retry.')
  return result
}