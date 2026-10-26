import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { accountFields } from '../registration/model'
import type { FieldErrors, RegistrationDraft } from '../registration/model'
import '../registration/stitch.css'
import ReferenceIcon from './ReferenceIcon'
import PasswordFeedback from './PasswordFeedback'

export function RegistrationLayout({
  title,
  introduction,
  children,
  beforeCard,
  headerContent,
  variant = 'selection',
}: {
  title: string
  introduction: string
  children: ReactNode
  beforeCard?: ReactNode
  headerContent?: ReactNode
  variant?: 'selection' | 'student' | 'student-preferences' | 'organizer' | 'pending'
}) {
  return (
    <main className={`registration-shell registration-${variant}`}>
      <div className="registration-frame">
        {headerContent ?? (
          <header className="registration-header">
            <Link className="brand" to="/login">
              Younity<span aria-hidden="true">.</span>
            </Link>
            <span className="registration-context">
              {variant === 'student'
                ? 'Student registration'
                : variant === 'organizer'
                  ? 'Organizer registration'
                  : variant === 'pending'
                    ? 'Organizer verification'
                    : 'Create an account'}
            </span>
          </header>
        )}
        {beforeCard}
        <section className="registration-card" aria-labelledby="page-title">
          <div className="registration-title-block">
            <h1 id="page-title" tabIndex={-1}>
              {title}
            </h1>
            <p className="introduction">{introduction}</p>
          </div>
          {children}
        </section>
      </div>
    </main>
  )
}

const labels = {
  firstName: 'First Name',
  lastName: 'Last Name',
  email: 'Email Address',
  password: 'Account Password',
  confirmPassword: 'Confirm password',
}
const autocomplete = {
  firstName: 'given-name',
  lastName: 'family-name',
  email: 'email',
  password: 'new-password',
  confirmPassword: 'new-password',
}
const placeholders = {
  firstName: 'e.g. Yassine',
  lastName: 'e.g. Amrani',
  email: 'student@university.ac.ma',
  password: 'Choose a strong password',
  confirmPassword: 'Repeat your password',
}
type AccountField = keyof typeof labels

function FieldIcon({ field }: { field: AccountField }) {
  if (field === 'lastName') return null
  return (
    <span className="field-icon">
      <ReferenceIcon
        name={field === 'firstName' ? 'person' : field === 'email' ? 'alternate_email' : 'lock'}
      />
    </span>
  )
}

export function AccountFields({
  draft,
  errors,
  onChange,
  includeLastName = false,
  afterNames,
  omitFirstName = false,
}: {
  draft: RegistrationDraft
  errors: FieldErrors
  includeLastName?: boolean
  afterNames?: ReactNode
  omitFirstName?: boolean
  onChange: <K extends keyof RegistrationDraft>(field: K, value: RegistrationDraft[K]) => void
}) {
  const [passwordVisible, setPasswordVisible] = useState(false)
  function renderField(field: AccountField) {
    return (
      <div className="form-field" key={field}>
        <div className="field-label">
          <label htmlFor={field}>{labels[field]}</label>
          <span className="required-hint" aria-hidden="true">
            Required
          </span>
        </div>
        <div className={`input-wrapper ${field === 'lastName' ? '' : 'has-icon'}`}>
          <FieldIcon field={field} />
          <input
            className={field === 'password' ? 'has-visibility-toggle' : undefined}
            id={field}
            name={field}
            type={
              field === 'firstName' ||
              field === 'lastName' ||
              (field === 'password' && passwordVisible)
                ? 'text'
                : field === 'email'
                  ? 'email'
                  : 'password'
            }
            autoComplete={autocomplete[field]}
            placeholder={placeholders[field]}
            required
            value={draft[field] ?? ''}
            onChange={(event) => onChange(field, event.target.value)}
            aria-invalid={Boolean(errors[field])}
            aria-describedby={
              [
                errors[field] ? `${field}-error` : '',
                field === 'password' ? 'password-guidance-note' : '',
              ]
                .filter(Boolean)
                .join(' ') || undefined
            }
          />
          {field === 'password' && (
            <button
              className="password-toggle"
              type="button"
              aria-label={passwordVisible ? 'Hide password' : 'Show password'}
              aria-controls="password"
              aria-pressed={passwordVisible}
              onClick={() => setPasswordVisible((visible) => !visible)}
            >
              <ReferenceIcon name={passwordVisible ? 'visibility_off' : 'visibility'} />
            </button>
          )}
        </div>
        {errors[field] && (
          <p className="field-error" id={`${field}-error`}>
            {errors[field]}
          </p>
        )}
        {field === 'password' && <PasswordFeedback password={draft.password} />}
      </div>
    )
  }
  return (
    <div className="fields">
      {includeLastName ? (
        <>
          <div className="name-row">
            {renderField('firstName')}
            {renderField('lastName')}
          </div>
          {afterNames}
          {accountFields.filter((field) => field !== 'firstName').map(renderField)}
        </>
      ) : (
        accountFields.filter((field) => !omitFirstName || field !== 'firstName').map(renderField)
      )}
    </div>
  )
}

export function PolicyAcceptance({
  checked,
  error,
  policies,
  onChange,
}: {
  checked: boolean
  error?: string
  policies: { terms: string; privacy: string } | undefined
  onChange: (value: boolean) => void
}) {
  return (
    <div className="policies">
      <label className="checkbox-label flex items-start" htmlFor="acceptedPolicies">
        <input
          className="w-4! h-4! shrink-0 aspect-square mt-1!"
          id="acceptedPolicies"
          name="acceptedPolicies"
          type="checkbox"
          required
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'policy-note policy-error' : 'policy-note'}
        />
        <span>
          I accept the{' '}
          {policies ? (
            <>
              <a href={policies.terms} target="_blank" rel="noopener noreferrer">
                Terms
              </a>{' '}
              and{' '}
              <a href={policies.privacy} target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>{' '}
              (open in new tabs)
            </>
          ) : (
            <><a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a></>
          )}
          .
        </span>
      </label>
      <p className="helper" id="policy-note">
        {policies
          ? 'Read both documents before accepting.'
          : 'Policy links are preview placeholders; full documents are not available yet.'}
      </p>
      {error && (
        <p className="field-error" id="policy-error">
          {error}
        </p>
      )}
    </div>
  )
}

export function SubmissionStatus({ pending, message }: { pending: boolean; message: string }) {
  return (
    <div aria-live="polite" aria-atomic="true">
      {pending && <p className="notice">Submitting your registration…</p>}
      {message && (
        <p className="notice error" role="alert">
          {message}
        </p>
      )}
    </div>
  )
}
