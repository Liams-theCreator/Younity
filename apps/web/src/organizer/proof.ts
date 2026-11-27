export const proofAccept = '.pdf,.png,.jpg,.jpeg'
export const proofSizeError = 'The proof document must be 10 MB or smaller.'

export type ProofDocument = { id: string; name: string; mediaType: string }

export function isProofDocument(value: unknown): value is ProofDocument {
  return !!value && typeof value === 'object' &&
    'id' in value && typeof value.id === 'string' &&
    /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value.id) &&
    'name' in value && typeof value.name === 'string' && Boolean(value.name.trim()) &&
    'mediaType' in value && typeof value.mediaType === 'string' &&
    ['application/pdf', 'image/png', 'image/jpeg'].includes(value.mediaType)
}

export function proofSelectionError(file: File | null) {
  if (!file) return ''
  if (file.size > 10 * 1024 * 1024) return proofSizeError
  if (file.size === 0 || !/\.(pdf|png|jpe?g)$/i.test(file.name)) return 'Choose a PDF, PNG, or JPEG proof document.'
  return ''
}
