import { Link } from 'react-router'
import { useRegistration } from '../registration/useRegistration'
import { registrationFieldErrors } from '../registration/errors'
import { mapOrganizerPayload } from '../registration/payload'
import type { FormEvent } from 'react'
import { useRef, useState } from 'react'
import { AccountFields, PolicyAcceptance, RegistrationLayout } from '../components/RegistrationForm'
import { emptyDraft, validateDraft } from '../registration/model'
import type { RegistrationDraft, FieldErrors } from '../registration/model'
import ReferenceIcon from '../components/ReferenceIcon'
import AlreadyHaveAccount from '../components/AlreadyHaveAccount'
import {
  OrganizationFields,
  OrganizerReviewNotice,
  OrganizerSection,
  OrganizerHeader,
} from '../components/OrganizerSections'
import type { OrganizationDetails } from '../registration/organizationDraft'
import { registerOrganizer } from '../registration/service'
import type { RegistrationPageProps } from '../registration/service'
import { emptyOrganizationDetails, validateOrganization } from '../registration/organizationDraft'

export default function OrganizerRegistration({
  policies,
  signInPath,
}: RegistrationPageProps) {
  const [account, setAccount] = useState<RegistrationDraft>({ ...emptyDraft })
  const [acceptedPolicies, setAcceptedPolicies] = useState(false)
  const [organization, setOrganization] = useState<OrganizationDetails>({ ...emptyOrganizationDetails })
  const [document, setDocument] = useState<File | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [organizationErrors, setOrganizationErrors] = useState<
    Partial<Record<keyof OrganizationDetails, string>>
  >({})
  const fileInput = useRef<HTMLInputElement>(null)
  const { submit, isSubmitting, accountCreated, error, clearError } = useRegistration()

  function selectDocument(file: File | undefined) {
    if (!file || isSubmitting || accountCreated) return
    setDocument(file)
    if (fileInput.current) fileInput.current.value = ''
  }
  function changePolicies(value: boolean) {
    clearError()
    setAcceptedPolicies(value)
    setErrors((current) => ({ ...current, acceptedPolicies: undefined }))
  }
  function validateForm() {
    const accountErrors = validateDraft({ ...account, acceptedPolicies }, true, false)
    const detailErrors = validateOrganization(organization)
    setErrors(accountErrors)
    setOrganizationErrors(detailErrors)
    return { ...detailErrors, ...accountErrors }
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (isSubmitting || accountCreated) return
    const nextErrors = validateForm()
    const firstError = Object.keys(nextErrors)[0]
    if (firstError) {
      window.document.getElementById(firstError)?.focus()
      return
    }
    const payload = mapOrganizerPayload(account, organization)
    const failure = await submit((signal) => registerOrganizer(payload, signal), { email: payload.email, password: payload.password })
    if (failure) {
      const result = registrationFieldErrors(failure)
      const { firstName, lastName, ...accountErrors } = result.fields
      setErrors(accountErrors)
      setOrganizationErrors({ ...result.organization, ...((firstName || lastName) ? { representativeName: firstName || lastName } : {}) })
    }
  }

  return (
    <>
      <RegistrationLayout
        variant="organizer"
        headerContent={<OrganizerHeader />}
        beforeCard={<OrganizerReviewNotice />}
        title="Institutional Organizer Registration"
        introduction="Establish your official university or academic entity profile to publish certified campus initiatives, symposiums, and accredited programs on Younity."
      >
        <form
          aria-busy={isSubmitting}
          onInvalid={validateForm}
          onSubmit={handleSubmit}
        >
          <fieldset disabled={isSubmitting || accountCreated}>
            <legend className="sr-only">Organizer registration details</legend>
            <OrganizationFields
              details={organization}
              errors={organizationErrors}
              onChange={(field, value) => {
                clearError()
                setOrganization((current) => ({ ...current, [field]: value }))
                setOrganizationErrors((current) => ({ ...current, [field]: undefined }))
              }}
            >
              <AccountFields
                omitFirstName
                draft={account}
                errors={errors}
                onChange={(field, value) => {
                  clearError()
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
                  Optional local selection only. Upload is not connected; this file will not be sent with registration.
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
              <button className="primary" type="submit" disabled={isSubmitting || accountCreated}>
                <span>{isSubmitting ? 'Submitting...' : 'Submit Organization for Verification'}</span>
                <ReferenceIcon name="arrow_forward" />
              </button>
            </div>
          </fieldset>
          {error && <p className="notice error" role="alert">{error.message}</p>}
          <p role="status" aria-live="polite">{isSubmitting ? 'Submitting...' : ''}</p>
        </form>
        {accountCreated && !isSubmitting && (
          <p className="notice" role="status">Account created; please sign in. <Link to="/login">Sign in</Link></p>
        )}
        <AlreadyHaveAccount signInPath={signInPath} />
      </RegistrationLayout>
    </>
  )
}
