import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router'
import ProtectedRoute from '../auth/ProtectedRoute'
import { useAuth } from '../auth/useAuth'
import { RegistrationLayout } from '../components/RegistrationForm'
import RegistrationSelect from '../components/RegistrationSelect'
import { organizationTypeLabels, organizationTypes } from '../registration/organizationDraft'
import {
  DraftError, draftChanges, emptyDraft, requestDraft,
  type DraftSnapshot, type DraftValues,
} from '../organizer/draft'
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
  const { requestProtected } = useAuth()
  const [snapshot, setSnapshot] = useState<DraftSnapshot | null>(null)
  const [values, setValues] = useState<DraftValues>({ ...emptyDraft })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const operation = useRef<AbortController | null>(null)
  const saveLock = useRef(false)
  const alert = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    operation.current = controller
    void requestDraft(requestProtected, controller.signal).then(
      (saved) => {
        if (controller.signal.aborted) return
        setSnapshot(saved)
        setValues(saved.values)
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

  useEffect(() => { if (error) alert.current?.focus() }, [error])

  function change(field: keyof DraftValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setError('')
    setNotice('')
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!snapshot?.canEdit || loading || saveLock.current) return
    setError('')
    setNotice('')
    let changes: ReturnType<typeof draftChanges>
    try {
      changes = draftChanges(values, snapshot.values)
    } catch (cause) {
      setError(cause instanceof DraftError ? cause.message : 'Check the supplied values.')
      return
    }
    if (!Object.keys(changes).length) return
    saveLock.current = true
    operation.current?.abort()
    const controller = new AbortController()
    operation.current = controller
    setSaving(true)
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
      saveLock.current = false
      if (!controller.signal.aborted) setSaving(false)
    }
  }

  const dirty = snapshot !== null && Object.keys(values).some((field) => {
    const key = field as keyof DraftValues
    return values[key].trim() !== snapshot.values[key].trim()
  })

  return (
    <RegistrationLayout variant="organizer" title="Organizer application draft"
      headerContent={<p className="helper">Organizer onboarding</p>}
      introduction="Save what you have completed and return later. Saving a draft does not submit your application for review.">
      {loading && <p role="status">Loading your saved draft…</p>}
      {error && <p ref={alert} role="alert" tabIndex={-1} className="notice error">{error}</p>}
      {notice && <p role="status" className="notice">{notice}</p>}
      {!loading && !snapshot && (
        <button type="button" className="secondary" onClick={() => {
          setError(''); setLoading(true); setAttempt((current) => current + 1)
        }}>Retry loading draft</button>
      )}
      {!loading && snapshot && (
        <>
          {!snapshot.canEdit && <p role="status">Editing is not available for this application.</p>}
          <form className="organizer-draft" noValidate aria-label="Organizer application draft" onSubmit={(event) => { void save(event) }}>
            <fieldset disabled={saving || !snapshot.canEdit}>
              <legend className="sr-only">Organization details</legend>
              {inputs.map(([field, label, type, autoComplete]) => (
                <div className="form-field" key={field}>
                  <label htmlFor={`draft-${field}`}>{label}</label>
                  <input id={`draft-${field}`} name={field} type={type} autoComplete={autoComplete}
                    maxLength={field === 'proofUrl' ? 512 : 255} value={values[field]}
                    onChange={(event) => change(field, event.target.value)} />
                </div>
              ))}
              <RegistrationSelect id="draft-type" label="Entity Category" placeholder="Select a category"
                required={false} options={organizationTypes.map((value) => ({ value, label: organizationTypeLabels[value] }))}
                value={values.type} onChange={(value) => change('type', value)} />
              {snapshot.canEdit && <button className="primary" type="submit" disabled={!dirty || saving}>
                {saving ? 'Saving draft…' : 'Save draft'}
              </button>}
            </fieldset>
          </form>
          {dirty && !saving && <p className="helper">You have unsaved changes. Save before leaving to keep them.</p>}
          {saving && <p role="status">Saving your draft…</p>}
        </>
      )}
      <Link className="organizer-draft-back" to={backTo}>Back to application status</Link>
    </RegistrationLayout>
  )
}