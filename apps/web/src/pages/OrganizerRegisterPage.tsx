import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AccountFields, PolicyAcceptance, RegistrationLayout } from '../components/RegistrationForm'
import { emptyDraft } from '../registration/model'
import type { FieldErrors } from '../registration/model'
import ReferenceIcon from '../components/ReferenceIcon'
import OrganizerApplicationStatus from '../components/OrganizerApplicationStatus'
import type { ApplicationState } from '../registration/applicationState'
import AlreadyHaveAccount from '../components/AlreadyHaveAccount'
import {
  OrganizationFields,
  OrganizerReviewNotice,
  OrganizerSection,
  OrganizerHeader,
} from '../components/OrganizerSections'
import { emptyOrganizationDetails } from '../registration/organizationDraft'

export default function OrganizerRegistration({
  policies,
  signInPath,
}: {
  policies?: { terms: string; privacy: string }
  signInPath?: string
}) {
  const [account, setAccount] = useState({ ...emptyDraft })
  const [acceptedPolicies, setAcceptedPolicies] = useState(false)
  const [organization, setOrganization] = useState({ ...emptyOrganizationDetails })
  const [document, setDocument] = useState<File | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [organizationErrors, setOrganizationErrors] = useState<
    Partial<Record<keyof typeof organization, string>>
  >({})
  const fileInput = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<ApplicationState>('form')
  useLayoutEffect(() => {
    window.document.getElementById('page-title')?.focus()
  }, [state])
  function selectDocument(file: File | undefined) {
    if (!file) return
    setDocument(file)
    if (fileInput.current) fileInput.current.value = ''
  }
  function changePolicies(value: boolean) {
    setAcceptedPolicies(value)
    setErrors({})
  }
  const previewControls = (
    <nav
      className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-4"
      aria-label="Preview application state"
    >
      <span className="text-sm text-slate-600">Local preview:</span>
      {(['form', 'pending', 'approved', 'rejected', 'needs_edit'] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={state === value}
          onClick={() => setState(value)}
          className={`rounded-lg border px-3 py-2 text-sm ${state === value ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
        >
          {
            {
              form: 'Back to registration',
              pending: 'Pending Approval',
              approved: 'Approved',
              rejected: 'Rejected',
              needs_edit: 'Needs Edit',
            }[value]
          }
        </button>
      ))}
      <p className="w-full text-xs text-slate-500">
        Preview only. Application details, decisions and contact information in status screens are
        examples. No data is sent.
      </p>
    </nav>
  )
  if (state === 'pending')
    return <OrganizerApplicationStatus state={state} onStateChange={setState} />
  if (state !== 'form')
    return (
      <div className="organizer-status-preview">
        {previewControls}
        <OrganizerApplicationStatus state={state} onStateChange={setState} />
      </div>
    )
  return (
    <>
      {previewControls}
      <RegistrationLayout
        variant="organizer"
        headerContent={<OrganizerHeader signInPath={signInPath} />}
        beforeCard={<OrganizerReviewNotice />}
        title="Institutional Organizer Registration"
        introduction="Establish your official university or academic entity profile to publish certified campus initiatives, symposiums, and accredited programs on Younity."
      >
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            setState('pending')
          }}
        >
          <fieldset>
            <legend className="sr-only">Organizer registration details</legend>
            <OrganizationFields
              details={organization}
              errors={organizationErrors}
              onChange={(field, value) => {
                setOrganization((current) => ({ ...current, [field]: value }))
                setOrganizationErrors((current) => ({ ...current, [field]: undefined }))
              }}
            >
              <AccountFields
                omitFirstName
                draft={account}
                errors={errors}
                onChange={(field, value) => {
                  setAccount((current) => ({ ...current, [field]: value }))
                  setErrors((current) => ({ ...current, [field]: undefined }))
                }}
              />
            </OrganizationFields>
            <OrganizerSection number={3} title="Proof of affiliation & authorization">
              <div
                className="document-dropzone"
                role="group"
                aria-label="Upload affiliation document"
                onClick={(event) => {
                  if (event.target instanceof Element && event.target.closest('button, input'))
                    return
                  fileInput.current?.click()
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  selectDocument(event.dataTransfer.files[0])
                }}
              >
                <span className="document-icon">
                  <ReferenceIcon name="upload_file" />
                </span>
                <p>
                  Drop Faculty Endorsement, Department Authorization, or Official Mandate Letter
                  here
                </p>
                <p className="document-browse-line">
                  or{' '}
                  <button
                    className="document-browse"
                    type="button"
                    onClick={() => fileInput.current?.click()}
                  >
                    {document ? 'Replace document' : 'Browse files'}
                  </button>{' '}
                  from your workstation
                </p>
                <input
                  ref={fileInput}
                  id="affiliationDocument"
                  type="file"
                  hidden
                  aria-label="Affiliation or authorization document"
                  aria-describedby="document-note"
                  onChange={(event) => selectDocument(event.target.files?.[0])}
                />
                <p className="helper" id="document-note">
                  Optional preview selection only. Upload formats, size limits, and requirements are
                  awaiting approval. No file is uploaded.
                </p>
                {document && (
                  <div className="document-selection" aria-live="polite">
                    <span>Selected: {document.name}</span>
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => {
                        setDocument(null)
                        if (fileInput.current) fileInput.current.value = ''
                      }}
                    >
                      Remove document
                    </button>
                  </div>
                )}
              </div>
            </OrganizerSection>
            <div
              className="organizer-consent organizer-proof-consent"
              role="group"
              aria-label="Terms & privacy acceptance"
            >
              <PolicyAcceptance
                checked={acceptedPolicies}
                error={errors.acceptedPolicies}
                policies={policies}
                onChange={changePolicies}
              />
            </div>
            <div className="actions">
              <button className="primary" type="submit">
                <span>Submit Organization for Verification</span>
                <ReferenceIcon name="arrow_forward" />
              </button>
            </div>
          </fieldset>
        </form>
        <AlreadyHaveAccount signInPath={signInPath} />
        <Link className="back-link" to="/register">
          Back to account selection
        </Link>
      </RegistrationLayout>
    </>
  )
}
