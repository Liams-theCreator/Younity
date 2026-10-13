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
}: {
  policies?: { terms: string; privacy: string }
  signInPath?: string
}) {
  const [draft, setDraft] = useState<StudentRegistrationDraft>({
    ...emptyDraft,
    lastName: '',
    university: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [step, setStep] = useState<1 | 2>(1)
  const [preferences, setPreferences] = useState({ ...emptyPreferences })
  const [message, setMessage] = useState('')
  function change(field: keyof RegistrationDraft, value: string | boolean) {
    setMessage('')
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }
  useLayoutEffect(() => {
    document.getElementById('page-title')?.focus()
  }, [step])
  function move(next: 1 | 2) {
    setStep(next)
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
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              const nextErrors = validateStudentDraft(draft)
              setErrors(nextErrors)
              if (Object.keys(nextErrors).length) {
                focusFirstError(nextErrors)
                return
              }
              setMessage(
                'Backend integration is not available. No account was created and no data was sent.',
              )
            }}
          >
            <fieldset>
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
                <span>Create student account</span>
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
            <SubmissionStatus pending={false} message={message} />
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
