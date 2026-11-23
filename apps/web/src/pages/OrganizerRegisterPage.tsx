import { useRegistration } from '../registration/useRegistration'
import { registrationFieldErrors } from '../registration/errors'
import { mapOrganizerPayload } from '../registration/payload'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { AccountFields, PolicyAcceptance, RegistrationLayout } from '../components/RegistrationForm'
import { emptyDraft, validateDraft } from '../registration/model'
import type { RegistrationDraft, FieldErrors } from '../registration/model'
import ReferenceIcon from '../components/ReferenceIcon'
import OrganizerProofField from '../components/OrganizerProofField'
import { proofSelectionError } from '../organizer/proof'
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
  const [proof, setProof] = useState<File | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [organizationErrors, setOrganizationErrors] = useState<
    Partial<Record<keyof OrganizationDetails, string>>
  >({})
  const { submit, isSubmitting, accountCreated, error, clearError } = useRegistration()

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
    if (proofSelectionError(proof)) return
    const payload = mapOrganizerPayload(account, organization)
    const failure = await submit((signal) => registerOrganizer(payload, signal, undefined, proof ?? undefined), { email: payload.email })
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
        backToSignIn={signInPath}
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
              <OrganizerProofField
                file={proof}
                disabled={isSubmitting || accountCreated}
                onChange={(file) => {
                  clearError()
                  setProof(file)
                }}
              />
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
          <p className="notice" role="status">Account created. Check your email to verify your account.</p>
        )}
        <AlreadyHaveAccount signInPath={signInPath} />
      </RegistrationLayout>
    </>
  )
}
