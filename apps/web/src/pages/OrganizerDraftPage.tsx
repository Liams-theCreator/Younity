import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router'
import ProtectedRoute from '../auth/ProtectedRoute'
import { useAuth } from '../auth/useAuth'
import MoroccanPhoneInput from '../components/MoroccanPhoneInput'
import OrganizerProofField from '../components/OrganizerProofField'
import { RegistrationLayout } from '../components/RegistrationForm'
import RegistrationSelect from '../components/RegistrationSelect'
import { proofSelectionError } from '../organizer/proof'
import {
  organizationTypeLabels,
  organizationTypes,
} from '../registration/organizationDraft'
import {
  DraftError,
  draftChanges,
  emptyDraft,
  requestDraft,
  type DraftSnapshot,
  type DraftValues,
} from '../organizer/draft'
import {
  SubmissionError,
  submissionErrors,
  submitApplication,
  type SubmissionErrors,
} from '../organizer/submission'
import './OrganizerDraftPage.css'

export default function OrganizerDraftPage() {
  const { user } = useAuth()
  const [submitted, setSubmitted] = useState(false)

  if (submitted) return <Navigate to="/organizer/pending" replace />

  return (
    <ProtectedRoute
      destination="/organizer/status"
      renderRedirect={(to) => <Navigate to={to} replace />}
    >
      {user?.organizationStatus === 'NEEDS_CHANGES'
        ? <DraftEditor onSubmitted={() => setSubmitted(true)} />
        : <Navigate to="/organizer/status" replace />}
    </ProtectedRoute>
  )
}

const inputs = [
  ['organizationName', 'Organization / University Entity Name', 'text', 'organization'],
  ['representativeFullName', 'Representative Full Name', 'text', 'name'],
  ['academicPosition', 'Title / Academic Position', 'text', 'organization-title'],
  ['phoneNumber', 'Direct Contact Phone', 'tel', 'tel'],
] as const

function DraftEditor({
  onSubmitted,
}: {
  onSubmitted: () => void
}) {
  const { requestProtected, refreshSession } = useAuth()
  const [snapshot, setSnapshot] = useState<DraftSnapshot | null>(null)
  const [values, setValues] = useState<DraftValues>({ ...emptyDraft })
  const [proof, setProof] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<'save' | 'submit' | null>(null)
  const [fieldErrors, setFieldErrors] = useState<SubmissionErrors>({})
  const [needsReload, setNeedsReload] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const operation = useRef<AbortController | null>(null)
  const mutationLock = useRef(false)
  const alert = useRef<HTMLParagraphElement>(null)
  const form = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    operation.current = controller

    void requestDraft(requestProtected, controller.signal).then(
      (saved) => {
        if (controller.signal.aborted) return
        setSnapshot(saved)
        setValues(saved.values)
        setProof(null)
        setNeedsReload(false)
      },
      (cause) => {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof DraftError
              ? cause.message
              : 'Could not load your application draft.',
          )
        }
      },
    ).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })

    return () => operation.current?.abort()
  }, [requestProtected, attempt])

  useEffect(() => {
    if (!error) return

    const field = form.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"]',
    )

    if (field) field.focus()
    else alert.current?.focus()
  }, [error, fieldErrors])

  function change(field: keyof DraftValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setError('')
    setNotice('')
    setFieldErrors({})
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (
      !snapshot?.canEdit ||
      loading ||
      needsReload ||
      mutationLock.current ||
      proofSelectionError(proof)
    ) return

    setError('')
    setNotice('')
    setFieldErrors({})

    let changes: ReturnType<typeof draftChanges>

    try {
      changes = draftChanges(values, snapshot.values)
    } catch (cause) {
      setError(
        cause instanceof DraftError
          ? cause.message
          : 'Check the supplied values.',
      )
      return
    }

    if (!Object.keys(changes).length && !proof) return

    mutationLock.current = true
    operation.current?.abort()

    const controller = new AbortController()
    operation.current = controller
    setPending('save')

    try {
      const saved = await requestDraft(
        requestProtected,
        controller.signal,
        changes,
        proof ?? undefined,
      )

      if (controller.signal.aborted) return

      setSnapshot(saved)
      setValues(saved.values)
      setProof(null)
      setNotice('Draft saved.')
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(
          cause instanceof DraftError
            ? cause.message
            : 'Could not save your application draft.',
        )
      }
    } finally {
      mutationLock.current = false
      if (!controller.signal.aborted) setPending(null)
    }
  }

  const dirty =
    snapshot !== null &&
    (proof !== null || Object.keys(values).some((field) => {
      const key = field as keyof DraftValues
      return values[key].trim() !== snapshot.values[key].trim()
    }))

  async function submit() {
    if (
      !snapshot?.canEdit ||
      !snapshot.exists ||
      dirty ||
      loading ||
      needsReload ||
      mutationLock.current
    ) return

    setNotice('')
    const errors = submissionErrors(values)
    setFieldErrors(errors)

    if (Object.keys(errors).length) {
      setError('Complete the required information before submitting.')
      return
    }

    setError('')
    mutationLock.current = true
    operation.current?.abort()

    const controller = new AbortController()
    operation.current = controller
    setPending('submit')

    try {
      await submitApplication(requestProtected, controller.signal)

      if (controller.signal.aborted) return

      onSubmitted()
      void refreshSession()
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(
          cause instanceof SubmissionError
            ? cause.message
            : 'Submission could not be confirmed. Reload your application.',
        )

        setNeedsReload(
          !(cause instanceof SubmissionError) || cause.reload,
        )
      }
    } finally {
      mutationLock.current = false
      if (!controller.signal.aborted) setPending(null)
    }
  }

  return (
    <RegistrationLayout
      variant="organizer"
      title="Update your organizer application"
      headerContent={<p className="helper">Application corrections</p>}
      introduction="Update the requested details, save your changes, and resubmit for review."
    >
      {loading && <p role="status">Loading your saved draft…</p>}

      {error && (
        <p ref={alert} role="alert" tabIndex={-1} className="notice error">
          {error}
        </p>
      )}

      {notice && <p role="status" className="notice">{notice}</p>}

      {!loading && (!snapshot || needsReload) && (
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setError('')
            setLoading(true)
            setAttempt((current) => current + 1)
          }}
        >
          {snapshot ? 'Reload application' : 'Retry loading draft'}
        </button>
      )}

      {!loading && snapshot && (
        <>
          {!snapshot.canEdit && (
            <p role="status">
              Editing is not available for this application.
            </p>
          )}

          <form
            ref={form}
            className="organizer-draft"
            noValidate
            aria-label="Organizer application draft"
            onSubmit={(event) => { void save(event) }}
          >
            <fieldset
              disabled={
                pending !== null ||
                needsReload ||
                !snapshot.canEdit
              }
            >
              <legend className="sr-only">Organization details</legend>

              {inputs.map(([field, label, type, autoComplete]) => (
                <div className="form-field" key={field}>
                  <div className="field-label">
                    <label htmlFor={`draft-${field}`}>{label}</label>

                    <span className="required-hint">Required to submit</span>
                  </div>

                  {field === 'phoneNumber' ? (
                    <MoroccanPhoneInput
                      id={`draft-${field}`}
                      name={field}
                      value={values[field]}
                      error={fieldErrors[field]}
                      onChange={(value) => change(field, value)}
                    />
                  ) : <input
                    id={`draft-${field}`}
                    name={field}
                    type={type}
                    autoComplete={autoComplete}
                    maxLength={255}
                    value={values[field]}
                    onChange={(event) =>
                      change(field, event.target.value)
                    }
                    aria-invalid={Boolean(fieldErrors[field])}
                    aria-describedby={
                      fieldErrors[field]
                        ? `draft-${field}-error`
                        : undefined
                    }
                  />}

                  {fieldErrors[field] && (
                    <p
                      className="field-error"
                      id={`draft-${field}-error`}
                    >
                      {fieldErrors[field]}
                    </p>
                  )}
                </div>
              ))}

              <RegistrationSelect
                id="draft-type"
                label="Entity Category"
                placeholder="Select a category"
                required={false}
                requirementHint="Required to submit"
                error={fieldErrors.type}
                options={organizationTypes.map((value) => ({
                  value,
                  label: organizationTypeLabels[value],
                }))}
                value={values.type}
                onChange={(value) => change('type', value)}
              />

              <section className="organizer-draft-proof" aria-labelledby="draft-proof-title">
                <h2 id="draft-proof-title">Proof of affiliation &amp; authorization</h2>
                <OrganizerProofField
                  file={proof}
                  savedName={snapshot.proof?.name}
                  disabled={pending !== null || needsReload || !snapshot.canEdit}
                  onChange={(file) => {
                    setProof(file)
                    setError('')
                    setNotice('')
                  }}
                />
              </section>

              {snapshot.canEdit && (
                <div className="organizer-draft-actions">
                  <button
                    className="secondary"
                    type="submit"
                    disabled={
                      !dirty ||
                      pending !== null ||
                      needsReload ||
                      Boolean(proofSelectionError(proof))
                    }
                  >
                    {pending === 'save' ? 'Saving draft…' : 'Save draft'}
                  </button>

                  <button
                    className="primary"
                    type="button"
                    disabled={
                      dirty ||
                      !snapshot.exists ||
                      pending !== null ||
                      needsReload
                    }
                    onClick={() => { void submit() }}
                  >
                    {pending === 'submit' ? 'Submitting…' : 'Resubmit application'}
                  </button>
                </div>
              )}
            </fieldset>
          </form>

          {dirty && pending === null && (
            <p className="helper">
              You have unsaved changes. Save before leaving or submitting.
            </p>
          )}

          {pending && (
            <p role="status">
              {pending === 'save'
                ? 'Saving your draft…'
                : 'Submitting your application…'}
            </p>
          )}
        </>
      )}

      <Link className="organizer-draft-back" to="/organizer/status">
        Back to application status
      </Link>
    </RegistrationLayout>
  )
}
