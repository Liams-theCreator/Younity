import { useRegistration } from '../registration/useRegistration'
import { registrationFieldErrors } from '../registration/errors'
import { mapStudentPayload } from '../registration/payload'
import type { FormEvent } from 'react'
import { registerStudent } from '../registration/service'
import type { RegistrationPageProps } from '../registration/service'
import type { StudentPreferences } from '../registration/studentPreferences'
import { useLayoutEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  AccountFields,
  PolicyAcceptance,
  RegistrationLayout,
  SubmissionStatus,
} from '../components/RegistrationForm'
import { focusFirstError } from '../registration/focus'
import { emptyDraft, validateStudentDraft } from '../registration/model'
import type {
  FieldErrors,
  RegistrationDraft,
  StudentRegistrationDraft,
} from '../registration/model'

import RegistrationSelect from '../components/RegistrationSelect'
import ReferenceIcon from '../components/ReferenceIcon'
import AlreadyHaveAccount from '../components/AlreadyHaveAccount'
import StudentPreferencesForm, { StudentProgress } from '../components/StudentPreferencesForm'
import { emptyPreferences } from '../registration/studentPreferences'

export default function StudentRegisterPage({
  policies,
  signInPath,
}: RegistrationPageProps) {
  const [draft, setDraft] = useState<StudentRegistrationDraft>({
    ...emptyDraft,
    lastName: '',
    university: '',
    customUniversity: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [step, setStep] = useState<1 | 2>(1)
  const [preferences, setPreferences] = useState<StudentPreferences>({ ...emptyPreferences })
  const { submit, isSubmitting, accountCreated, error, clearError } = useRegistration()
  useLayoutEffect(() => {
    document.getElementById('page-title')?.focus()
  }, [step])

  function change<K extends keyof RegistrationDraft>(field: K, value: RegistrationDraft[K]) {
    clearError()
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }
  function move(next: 1 | 2) {
    setStep(next)
  }
  async function submitAccount(selectedPreferences: StudentPreferences = preferences): Promise<void> {
    if (isSubmitting || accountCreated) return
    const nextErrors = validateStudentDraft(draft)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      move(1)
      focusFirstError(nextErrors)
      return
    }
    const payload = mapStudentPayload(draft, selectedPreferences)
    const failure = await submit((signal) => registerStudent(payload, signal), { email: payload.email, password: payload.password })
    if (failure) {
      const nextErrors = registrationFieldErrors(failure).fields
      setErrors(nextErrors)
      if (Object.keys(nextErrors).length) move(1)
    }
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    await submitAccount()
  }

  return (
    <RegistrationLayout
      variant={step === 1 ? 'student' : 'student-preferences'}
      headerContent={<StudentProgress step={step} />}
      title={step === 1 ? 'Create Student Account' : 'Tailor Your Campus Journey'}
      introduction={
        step === 1
          ? 'Connect using your verified Moroccan university credentials to get immediate access to sanctioned campus hackathons.'
          : 'Choose the topics, academic tracks, and formats you care about most to personalize your campus journey.'
      }
    >
      {step === 2 ? (
        <StudentPreferencesForm
          preferences={preferences}
          onChange={setPreferences}
          onBack={() => move(1)}
          onSubmit={() => void submitAccount()}
          onSkip={() => void submitAccount(emptyPreferences)}
          disabled={isSubmitting || accountCreated}
        />
      ) : (
        <>
          <form noValidate aria-busy={isSubmitting} onSubmit={handleSubmit}>
            <fieldset disabled={isSubmitting || accountCreated}>
              <legend className="sr-only">Student account details</legend>
              <AccountFields
                includeLastName
                draft={draft}
                errors={errors}
                onChange={change}
                afterNames={
                  <>
                    <RegistrationSelect
                      id="university"
                      label="University / Academic Institution"
                      placeholder="Select your enrolled university"
                      options={[
                        'UM6P - Mohammed VI Polytechnic University (Benguerir / Rabat)',
                        'Mohammed V University (Rabat - ENSIAS, FSR, EMI)',
                        'Hassan II University (Casablanca - ENSEM, FSAC, FSJES)',
                        'Cadi Ayyad University (Marrakech - FST, ENSA)',
                        'Al Akhawayn University in Ifrane (AUI)',
                        'National Institute of Posts and Telecommunications (INPT Rabat)',
                        'Ibn Tofail University (Kénitra - ENSA, ENCG)',
                        'Other',
                      ].map((value) => ({ value, label: value }))}
                      value={draft.university}
                      error={errors.university}
                      onChange={(value) => change('university', value)}
                    />
                    {draft.university === 'Other' && (
                      <div className="form-field">
                        <div className="field-label">
                          <label htmlFor="customUniversity">
                            Custom University / Academic Institution
                          </label>
                          <span className="required-hint">Required</span>
                        </div>
                        <input
                          id="customUniversity"
                          name="customUniversity"
                          type="text"
                          required
                          maxLength={255}
                          autoComplete="organization"
                          placeholder="Enter your institution name"
                          value={draft.customUniversity ?? ''}
                          onChange={(event) => change('customUniversity', event.target.value)}
                          aria-invalid={Boolean(errors.customUniversity)}
                          aria-describedby={errors.customUniversity ? 'customUniversity-error' : undefined}
                        />
                        {errors.customUniversity && (
                          <p className="field-error" id="customUniversity-error">
                            {errors.customUniversity}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                }
              />
              <PolicyAcceptance
                checked={draft.acceptedPolicies}
                error={errors.acceptedPolicies}
                policies={policies}
                onChange={(value) => change('acceptedPolicies', value)}
              />
              <button className="primary" type="submit">
                <span>{isSubmitting ? 'Submitting...' : 'Create student account'}</span>
                <ReferenceIcon name="arrow_forward" />
              </button>
              <button
                className="secondary student-preview-continue"
                type="button"
                onClick={() => {
                  const nextErrors = validateStudentDraft(draft)
                  setErrors(nextErrors)
                  if (Object.keys(nextErrors).length) {
                    focusFirstError(nextErrors)
                    return
                  }
                  move(2)
                }}
              >
                Continue to preferences
              </button>
              <p className="helper student-preview-note">
                You can optionally choose your preferences before creating your account.
              </p>
            </fieldset>
          </form>
          <AlreadyHaveAccount signInPath={signInPath} />
          <aside className="role-switcher" aria-label="Organizer registration">
            <div className="student-organizer-prompt">
              <span className="student-organizer-icon">
                <ReferenceIcon name="diversity_3" />
              </span>
              <div>
                <h2>Event Organizer or Institution?</h2>
                <p>Register through our institutional verification gateway</p>
              </div>
            </div>
            <Link className="secondary" to="/register/organizer">
              Register as organizer <ReferenceIcon name="arrow_outward" />
            </Link>
          </aside>
        </>
      )}
      <SubmissionStatus pending={isSubmitting} message={error?.message ?? ''} />
      {accountCreated && !isSubmitting && (
        <p className="notice" role="status">Account created; please sign in. <Link to="/login">Sign in</Link></p>
      )}
    </RegistrationLayout>
  )
}
