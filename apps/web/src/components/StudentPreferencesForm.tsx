import { useState } from 'react'
import type { PreferenceErrors, StudentPreferences } from '../registration/studentPreferences'
import {
  academicLevels,
  disciplines,
  interests,
  opportunityFormats,
  validatePreferences,
} from '../registration/studentPreferences'

function PreferenceIcon({ kind }: { kind: string }) {
  const paths: Record<string, string> = {
    code: 'M8 8l-4 4 4 4m8-8 4 4-4 4M13 5l-2 14',
    chart: 'M4 20V10m5 10V6m5 14v-9m5 9V3M3 7l6-4 5 3 6-4',
    tools: 'M5 20l7-7m0 0 7-7M4 5l3-2 4 4-2 3-5-5m9 9 6 6 2-2-6-6',
    shield: 'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3m0 4v9m-4-5h8',
    palette:
      'M12 3a9 9 0 1 0 0 18c3 0 2-3 4-4 4-1 5-3 5-5a9 9 0 0 0-9-9M7 9h.1M11 6h.1M16 8h.1M6 14h.1',
    balance: 'M12 3v18M5 21h14M4 6h16M5 6l-4 8h8L5 6m14 0-4 8h8l-4-8',
    leaf: 'M20 3C8 2 2 7 5 15s13 7 15-12M4 21l12-12',
    infinity: 'M12 12C7 3 2 7 2 12s5 9 10 0c5-9 10-5 10 0s-5 9-10 0',
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[kind] ?? paths.code} />
    </svg>
  )
}

export function StudentProgress({ step }: { step: 1 | 2 }) {
  return (
    <div className="student-progress" aria-label="Student experience progress">
      <p>
        <span aria-hidden="true">{step}</span>Step {step} of 2:{' '}
        {step === 1 ? 'Create Student Account' : 'Personalize Your Discovery Experience'}
      </p>
      <ol>
        <li aria-current={step === 1 ? 'step' : undefined} className="filled">
          <span className="sr-only">Account information</span>
        </li>
        <li aria-current={step === 2 ? 'step' : undefined} className={step === 2 ? 'filled' : ''}>
          <span className="sr-only">Discovery preferences</span>
        </li>
      </ol>
    </div>
  )
}

export default function StudentPreferencesForm({
  preferences,
  onChange,
  onBack,
}: {
  preferences: StudentPreferences
  onChange: (next: StudentPreferences) => void
  onBack: () => void
}) {
  const [errors, setErrors] = useState<PreferenceErrors>({})
  const [message, setMessage] = useState('')
  function update<K extends keyof StudentPreferences>(field: K, value: StudentPreferences[K]) {
    onChange({ ...preferences, [field]: value })
    setErrors((current) => ({ ...current, [field]: undefined }))
    setMessage('')
  }
  return (
    <form
      className="student-preferences"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        const nextErrors = validatePreferences(preferences)
        setErrors(nextErrors)
        if (Object.keys(nextErrors).length) {
          const group = nextErrors.discipline
            ? 'discipline'
            : nextErrors.academicLevel
              ? 'academicLevel'
              : nextErrors.interests
                ? 'interests'
                : 'formats'
          document
            .querySelector<HTMLInputElement>(`[data-preference-group="${group}"] input`)
            ?.focus()
          return
        }
        setMessage(
          'Backend integration is not available. No account was created and no preferences were sent.',
        )
      }}
    >
      <p className="helper">
        Local preview only. Backend integration is not available; no data is sent.
      </p>
      <fieldset
        data-preference-group="discipline"
        aria-describedby={errors.discipline ? 'discipline-error' : 'discipline-hint'}
      >
        <legend>
          Field of Study & Academic Discipline{' '}
          <span className="text-outline/70 text-xs font-normal">OPTIONAL</span>
        </legend>
        <p className="preference-hint" id="discipline-hint">
          Select your primary concentration
        </p>
        <div className="discipline-grid">
          {disciplines.map((option) => (
            <label className="discipline-choice" key={option.label}>
              <input
                type="checkbox"
                name="discipline"
                value={option.label}
                checked={preferences.discipline === option.label}
                onChange={() =>
                  update('discipline', preferences.discipline === option.label ? '' : option.label)
                }
                aria-invalid={Boolean(errors.discipline)}
                aria-describedby={errors.discipline ? 'discipline-error' : undefined}
              />
              <span className="discipline-card">
                <span className="discipline-icon">
                  <PreferenceIcon kind={option.icon} />
                </span>
                <span className="selection-mark" aria-hidden="true">
                  ✓
                </span>
                <strong>{option.label}</strong>
                <small>{option.detail}</small>
              </span>
            </label>
          ))}
        </div>
        {errors.discipline && (
          <p className="field-error" id="discipline-error">
            {errors.discipline}
          </p>
        )}
      </fieldset>
      <fieldset
        data-preference-group="academicLevel"
        aria-describedby={errors.academicLevel ? 'academic-level-error' : undefined}
      >
        <legend className="academic-level-legend">
          Current Academic Level in Morocco{' '}
          <span className="text-outline/70 text-xs font-normal">OPTIONAL</span>
        </legend>
        <div className="academic-level-grid">
          {academicLevels.map((option) => (
            <label className="level-choice" key={option}>
              <input
                type="checkbox"
                name="academicLevel"
                value={option}
                checked={preferences.academicLevel === option}
                onChange={() =>
                  update('academicLevel', preferences.academicLevel === option ? '' : option)
                }
                aria-invalid={Boolean(errors.academicLevel)}
                aria-describedby={errors.academicLevel ? 'academic-level-error' : undefined}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
        {errors.academicLevel && (
          <p className="field-error" id="academic-level-error">
            {errors.academicLevel}
          </p>
        )}
      </fieldset>
      <fieldset
        data-preference-group="interests"
        aria-describedby={errors.interests ? 'interests-error interests-hint' : 'interests-hint'}
      >
        <legend>Topics & Activities of Interest</legend>
        <p className="preference-hint" id="interests-hint">
          Select the interests you care about (optional).
        </p>
        <div className="interest-options">
          {interests.map((option, index) => (
            <label className="interest-choice" key={option}>
              <input
                type="checkbox"
                name="interests"
                checked={preferences.interests.includes(option)}
                onChange={() =>
                  update(
                    'interests',
                    preferences.interests.includes(option)
                      ? preferences.interests.filter((value) => value !== option)
                      : [...preferences.interests, option],
                  )
                }
                aria-invalid={Boolean(errors.interests)}
                aria-describedby={errors.interests ? 'interests-error' : undefined}
              />
              <span>
                <PreferenceIcon kind={disciplines[index % disciplines.length].icon} />
                {option}
                <span className="chip-check" aria-hidden="true">
                  ✓
                </span>
              </span>
            </label>
          ))}
        </div>
        {errors.interests && (
          <p className="field-error" id="interests-error">
            {errors.interests}
          </p>
        )}
      </fieldset>
      <fieldset
        data-preference-group="formats"
        aria-describedby={errors.formats ? 'formats-error' : undefined}
      >
        <legend>Preferred Opportunity Formats</legend>
        <div className="format-grid">
          {opportunityFormats.map((option) => (
            <label className="format-choice flex items-start" key={option.label}>
              <input
                className="w-4! h-4! shrink-0 aspect-square mt-1!"
                type="checkbox"
                name="formats"
                checked={preferences.formats === option.label}
                onChange={() =>
                  update('formats', preferences.formats === option.label ? '' : option.label)
                }
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.detail}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {errors.formats && <p className="field-error" id="formats-error">{errors.formats}</p>}
      <div className="preference-actions">
        <button className="secondary" type="button" onClick={onBack}>
          Back to Account Info
        </button>
        <div>
          <button
            className="preference-skip"
            type="button"
            onClick={() =>
              setMessage(
                'Backend integration is not available. No account was created. You can go back to your account information.',
              )
            }
          >
            Skip for now, I'll set this later
          </button>
          <button className="primary" type="submit">
            Review registration availability
          </button>
        </div>
      </div>
      {message && (
        <p className="notice" role="alert">
          {message}
        </p>
      )}
    </form>
  )
}
