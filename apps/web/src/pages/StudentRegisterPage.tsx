import type { FormEvent } from 'react'
import { registerStudent, REGISTRATION_UNAVAILABLE } from '../registration/service'
import type { RegistrationPageProps } from '../registration/service'
import type { StudentPreferences } from '../registration/studentPreferences'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submissionRequest = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => submissionRequest.current?.abort()
  }, [])
  useLayoutEffect(() => {
    document.getElementById('page-title')?.focus()
  }, [step])

  function change<K extends keyof RegistrationDraft>(field: K, value: RegistrationDraft[K]) {
    setMessage('')
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }
  function move(next: 1 | 2) {
    setStep(next)
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (submissionRequest.current) return
    const nextErrors = validateStudentDraft(draft)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      focusFirstError(nextErrors)
      return
    }
    const controller = new AbortController()
    submissionRequest.current = controller
    setIsSubmitting(true)
    setMessage('')
    try {
      await registerStudent(draft, controller.signal)
      // TODO: Navigate to the approved completion route after confirmed API success.
    } catch {
      if (!controller.signal.aborted) setMessage(REGISTRATION_UNAVAILABLE)
    } finally {
      if (!controller.signal.aborted) {
        submissionRequest.current = null
        setIsSubmitting(false)
      }
    }
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
        />
      ) : (
        <>
          <form noValidate aria-busy={isSubmitting} onSubmit={handleSubmit}>
            <fieldset disabled={isSubmitting}>
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
                Preferences are a local preview. No account is created by continuing.
              </p>
            </fieldset>
            <SubmissionStatus pending={isSubmitting} message={message} />
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
          <Link className="back-link" to="/register">
            Back to account selection
          </Link>
        </>
      )}
    </RegistrationLayout>
  )
}
