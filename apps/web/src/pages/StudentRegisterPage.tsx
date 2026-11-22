import { useRegistration } from '../registration/useRegistration'
import { registrationFieldErrors } from '../registration/errors'
import { mapStudentPayload } from '../registration/payload'
import type { FormEvent } from 'react'
import { registerStudent } from '../registration/service'
import type { RegistrationPageProps } from '../registration/service'
import { useLayoutEffect, useState } from 'react'
import {
  AccountFields,
  PolicyAcceptance,
  RegistrationLayout,
  SubmissionStatus,
} from '../components/RegistrationForm'
import { focusFirstError } from '../registration/focus'
import {
  emptyDraft,
  validateStudentDraft,
} from '../registration/model'
import type {
  FieldErrors,
  RegistrationDraft,
  StudentRegistrationDraft,
} from '../registration/model'
import RegistrationSelect from '../components/RegistrationSelect'
import ReferenceIcon from '../components/ReferenceIcon'
import { StudentProgress } from '../components/StudentPreferencesForm'
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

  const {
    submit,
    isSubmitting,
    accountCreated,
    error,
    clearError,
  } = useRegistration()

  useLayoutEffect(() => {
    document.getElementById('page-title')?.focus()
  }, [])

  function change<K extends keyof RegistrationDraft>(
    field: K,
    value: RegistrationDraft[K],
  ) {
    clearError()
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (isSubmitting || accountCreated) return

    const nextErrors = validateStudentDraft(draft)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length) {
      focusFirstError(nextErrors)
      return
    }

    const payload = mapStudentPayload(draft, emptyPreferences)

    const failure = await submit(
      (signal) => registerStudent(payload, signal),
      {
        email: payload.email,
      },
    )

    if (failure) setErrors(registrationFieldErrors(failure).fields)
  }

  return (
    <RegistrationLayout
      variant="student"
      backToSignIn={signInPath}
      headerContent={<StudentProgress step={1} />}
      title="Create Student Account"
      introduction="Create your student account using your email address. Academic information is optional."
    >
      <form
        noValidate
        aria-busy={isSubmitting}
        onSubmit={handleSubmit}
      >
        <fieldset disabled={isSubmitting || accountCreated}>
          <legend className="sr-only">
            Student account details
          </legend>

          <AccountFields
            includeLastName
            draft={draft}
            errors={errors}
            onChange={change}
            afterNames={
              <>
                <RegistrationSelect
                  id="university"
                  required={false}
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
                  ].map((value) => ({
                    value,
                    label: value,
                  }))}
                  value={draft.university}
                  error={errors.university}
                  onChange={(value) =>
                    change('university', value)
                  }
                />

                {draft.university === 'Other' && (
                  <div className="form-field">
                    <div className="field-label">
                      <label htmlFor="customUniversity">
                        Custom University / Academic Institution
                      </label>
                      <span className="required-hint">
                        Required
                      </span>
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
                      onChange={(event) =>
                        change(
                          'customUniversity',
                          event.target.value,
                        )
                      }
                      aria-invalid={
                        Boolean(errors.customUniversity)
                      }
                      aria-describedby={
                        errors.customUniversity
                          ? 'customUniversity-error'
                          : undefined
                      }
                    />

                    {errors.customUniversity && (
                      <p
                        className="field-error"
                        id="customUniversity-error"
                      >
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
            onChange={(value) =>
              change('acceptedPolicies', value)
            }
          />

          <button className="primary" type="submit">
            <span>
              {isSubmitting
                ? 'Submitting...'
                : 'Create student account'}
            </span>
            <ReferenceIcon name="arrow_forward" />
          </button>
        </fieldset>
      </form>

      <SubmissionStatus
        pending={isSubmitting}
        message={error?.message ?? ''}
      />

      {accountCreated && !isSubmitting && (
        <p className="notice" role="status">
          Account created. Check your email to verify your account.
        </p>
      )}
    </RegistrationLayout>
  )
}
