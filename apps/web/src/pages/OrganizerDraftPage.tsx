import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import ProtectedRoute from '../auth/ProtectedRoute'
import { useAuth } from '../auth/useAuth'
import { RegistrationLayout } from '../components/RegistrationForm'
import RegistrationSelect from '../components/RegistrationSelect'
import { organizationTypeLabels, organizationTypes } from '../registration/organizationDraft'
import {
  DraftError, draftChanges, emptyDraft, requestDraft,
  type DraftSnapshot, type DraftValues,
} from '../organizer/draft'
import { SubmissionError, submissionErrors, submitApplication, type SubmissionErrors } from '../organizer/submission'
import './OrganizerDraftPage.css'

export default function OrganizerDraftPage() {
  const { user } = useAuth()
  const destination = user?.organizationStatus === 'NEEDS_CHANGES'
    ? '/organizer/status' : '/organizer/pending'
  return (
    <ProtectedRoute destination={destination} renderRedirect={(to) => <Navigate to={to} replace />}>
      <DraftEditor backTo={destination} />
    </ProtectedRoute>
  )
}

const inputs = [
  ['organizationName', 'Organization / University Entity Name', 'text', 'organization'],
  ['representativeFullName', 'Representative Full Name', 'text', 'name'],
  ['academicPosition', 'Title / Academic Position', 'text', 'organization-title'],
  ['phoneNumber', 'Direct Contact Phone', 'tel', 'tel'],
  ['proofUrl', 'Supporting link (optional)', 'url', 'url'],
] as const

function DraftEditor({ backTo }: { backTo: '/organizer/status' | '/organizer/pending' }) {
  const { requestProtected, refreshSession } = useAuth()
  const navigate = useNavigate()
  const correcting = backTo === '/organizer/status'
  const [snapshot, setSnapshot] = useState<DraftSnapshot | null>(null)
  const [values, setValues] = useState<DraftValues>({ ...emptyDraft })
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
        setNeedsReload(false)
      },
      (cause) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof DraftError ? cause.message : 'Could not load your application draft.')
        }
      },
    ).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => operation.current?.abort()
  }, [requestProtected, attempt])

  useEffect(() => {
    if (!error) return
    const field = form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
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
    if (!snapshot?.canEdit || loading || needsReload || mutationLock.current) return
    setError('')
    setNotice('')
    setFieldErrors({})
    let changes: ReturnType<typeof draftChanges>
    try {
      changes = draftChanges(values, snapshot.values)
    } catch (cause) {
      setError(cause instanceof DraftError ? cause.message : 'Check the supplied values.')
      return
    }
    if (!Object.keys(changes).length) return
    mutationLock.current = true
    operation.current?.abort()
    const controller = new AbortController()
    operation.current = controller
    setPending('save')
    try {
      const saved = await requestDraft(requestProtected, controller.signal, changes)
      if (controller.signal.aborted) return
      setSnapshot(saved)
      setValues(saved.values)
      setNotice('Draft saved.')
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof DraftError ? cause.message : 'Could not save your application draft.')
      }
    } finally {
      mutationLock.current = false
      if (!controller.signal.aborted) setPending(null)
    }
  }

  const dirty = snapshot !== null && Object.keys(values).some((field) => {
    const key = field as keyof DraftValues
    return values[key].trim() !== snapshot.values[key].trim()
  })

  async function submit() {
    if (!snapshot?.canEdit || !snapshot.exists || dirty || loading || needsReload || mutationLock.current) return
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
      navigate('/organizer/pending', { replace: true })
      void refreshSession()
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof SubmissionError ? cause.message : 'Submission could not be confirmed. Reload your application.')
        setNeedsReload(!(cause instanceof SubmissionError) || cause.reload)
      }
    } finally {
      mutationLock.current = false
      if (!controller.signal.aborted) setPending(null)
    }
  }

  return (
    <RegistrationLayout variant="organizer" title={correcting ? 'Update your organizer application' : 'Organizer application draft'}
      headerContent={<p className="helper">{correcting ? 'Application corrections' : 'Organizer onboarding'}</p>}
      introduction="Save your information first, then submit it for review. Drafts can be incomplete. A supporting link is optional.">
      {loading && <p role="status">Loading your saved draft…</p>}
      {error && <p ref={alert} role="alert" tabIndex={-1} className="notice error">{error}</p>}
      {notice && <p role="status" className="notice">{notice}</p>}
      {!loading && (!snapshot || needsReload) && (
        <button type="button" className="secondary" onClick={() => {
          setError(''); setLoading(true); setAttempt((current) => current + 1)
        }}>{snapshot ? 'Reload application' : 'Retry loading draft'}</button>
      )}
      {!loading && snapshot && (
        <>
          {!snapshot.canEdit && <p role="status">Editing is not available for this application.</p>}
          <form ref={form} className="organizer-draft" noValidate aria-label="Organizer application draft" onSubmit={(event) => { void save(event) }}>
            <fieldset disabled={pending !== null || needsReload || !snapshot.canEdit}>
              <legend className="sr-only">Organization details</legend>
              {inputs.map(([field, label, type, autoComplete]) => (
                <div className="form-field" key={field}>
                  <div className="field-label">
                    <label htmlFor={`draft-${field}`}>{label}</label>
                    {field !== 'proofUrl' && <span className="required-hint">Required to submit</span>}
                  </div>
                  <input id={`draft-${field}`} name={field} type={type} autoComplete={autoComplete}
                    maxLength={field === 'proofUrl' ? 512 : 255} value={values[field]}
                    onChange={(event) => change(field, event.target.value)}
                    aria-invalid={Boolean(fieldErrors[field])}
                    aria-describedby={fieldErrors[field] ? `draft-${field}-error` : undefined} />
                  {fieldErrors[field] && <p className="field-error" id={`draft-${field}-error`}>{fieldErrors[field]}</p>}
                </div>
              ))}
              <RegistrationSelect id="draft-type" label="Entity Category" placeholder="Select a category"
                required={false} requirementHint="Required to submit" error={fieldErrors.type}
                options={organizationTypes.map((value) => ({ value, label: organizationTypeLabels[value] }))}
                value={values.type} onChange={(value) => change('type', value)} />
              {snapshot.canEdit && <div className="organizer-draft-actions">
                <button className="secondary" type="submit" disabled={!dirty || pending !== null || needsReload}>
                  {pending === 'save' ? 'Saving draft…' : 'Save draft'}
                </button>
                <button className="primary" type="button" disabled={dirty || !snapshot.exists || pending !== null || needsReload}
                  onClick={() => { void submit() }}>
                  {pending === 'submit' ? 'Submitting…' : correcting ? 'Resubmit application' : 'Submit application'}
                </button>
              </div>}
            </fieldset>
          </form>
          {dirty && pending === null && <p className="helper">You have unsaved changes. Save before leaving or submitting.</p>}
          {pending && <p role="status">{pending === 'save' ? 'Saving your draft…' : 'Submitting your application…'}</p>}
        </>
      )}
      <Link className="organizer-draft-back" to={backTo}>Back to application status</Link>
    </RegistrationLayout>
  )
}