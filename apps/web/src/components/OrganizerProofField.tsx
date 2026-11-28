import { useId, useRef } from 'react'
import { proofAccept, proofSelectionError } from '../organizer/proof'
import ReferenceIcon from './ReferenceIcon'

export default function OrganizerProofField({
  file, onChange, savedName, disabled,
}: {
  file: File | null
  onChange: (file: File | null) => void
  savedName?: string
  disabled?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const hint = useId()
  const error = proofSelectionError(file)

  function select(next: File | undefined) {
    if (!next || disabled) return
    onChange(next)
    if (input.current) input.current.value = ''
  }

  return (
    <div
      className="document-dropzone"
      role="group"
      aria-label="Upload affiliation document"
      onClick={(event) => {
        if (disabled || (event.target instanceof Element && event.target.closest('button, input'))) return
        input.current?.click()
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        select(event.dataTransfer.files[0])
      }}
    >
      <span className="document-icon"><ReferenceIcon name="upload_file" /></span>
      <p>Drop Faculty Endorsement, Department Authorization, or Official Mandate Letter here</p>
      <p className="document-browse-line">
        or{' '}
        <button className="document-browse" type="button" disabled={disabled} onClick={() => input.current?.click()}>
          {file || savedName ? 'Replace document' : 'Browse files'}
        </button>
      </p>
      <input
        ref={input}
        type="file"
        hidden
        disabled={disabled}
        accept={proofAccept}
        aria-label="Affiliation or authorization document"
        aria-describedby={error ? `${hint} ${hint}-error` : hint}
        aria-invalid={Boolean(error)}
        onChange={(event) => select(event.currentTarget.files?.[0])}
      />
      <p className="document-note" id={hint}>PDF, PNG, or JPEG up to 10 MB.</p>
      {savedName && <p className="document-note">Saved proof: {savedName}</p>}
      {file && (
        <div className="document-selection" aria-live="polite">
          <span>Selected: {file.name}</span>
          <button className="secondary" type="button" disabled={disabled} onClick={() => onChange(null)}>
            Remove document
          </button>
        </div>
      )}
      {error && <p className="field-error" id={`${hint}-error`} role="alert">{error}</p>}
    </div>
  )
}
