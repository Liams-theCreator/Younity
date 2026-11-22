import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import ReferenceIcon from '../components/ReferenceIcon'
import {
  academicLevels,
  disciplines,
  interests,
  opportunityFormats,
  type StudentPreferences,
} from '../registration/studentPreferences'
import { useStudentPreferences } from '../student/useStudentPreferences'
import styles from './StudentProfilePage.module.css'

const academicFields = [
  { key: 'discipline', label: 'Field of study', options: disciplines.map(({ label }) => label) },
  { key: 'academicLevel', label: 'Academic level', options: academicLevels },
  { key: 'formats', label: 'Preferred event format', options: opportunityFormats.map(({ label }) => label) },
] as const

export default function StudentProfilePage() {
  const { user } = useAuth()
  const { draft, setDraft, saved, loading, saving, error, retry, save } = useStudentPreferences()
  const [notice, setNotice] = useState('')
  const alert = useRef<HTMLParagraphElement>(null)
  const { preferences, university } = draft
  const changed = saved !== null && (
    university !== saved.university ||
    academicFields.some(({ key }) => preferences[key] !== saved.preferences[key]) ||
    preferences.interests.length !== saved.preferences.interests.length ||
    preferences.interests.some((interest) => !saved.preferences.interests.includes(interest))
  )

  useEffect(() => {
    if (error) alert.current?.focus()
  }, [error])

  function changePreference<Field extends keyof StudentPreferences>(
    field: Field,
    value: StudentPreferences[Field],
  ) {
    setNotice('')
    setDraft((current) => ({ ...current, preferences: { ...current.preferences, [field]: value } }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!changed) return

    setNotice('')
    if (await save()) setNotice('Preferences saved.')
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <Link to="/events" className={styles.back}>
          <ReferenceIcon name="arrow_back" /> Back to events
        </Link>
        <h1>Student profile</h1>
        <p>Manage your interests and how you discover campus events.</p>
      </header>

      <div className={styles.dashboard}>
        <aside className={styles.account} aria-labelledby="profile-account-title">
          <span className={styles.avatar}><ReferenceIcon name="person" /></span>
          <h2 id="profile-account-title">Your account</h2>
          <dl>
            <dt>Email address</dt>
            <dd>{user?.email}</dd>
          </dl>
        </aside>

        <section className={styles.panel} aria-labelledby="profile-preferences-title">
          <h2 id="profile-preferences-title">Discovery preferences</h2>
          <p className={styles.intro}>Choose at least two interests. Academic details are optional.</p>

          {error && <p className={styles.error} ref={alert} tabIndex={-1} role="alert">{error}</p>}
          {loading && <p role="status">Loading your saved preferences…</p>}
          {!loading && !saved && (
            <button className={styles.retry} type="button" onClick={() => void retry()}>
              Retry loading preferences
            </button>
          )}

          {saved && (
            <form onSubmit={(event) => void submit(event)} aria-busy={saving}>
              <fieldset disabled={saving} className={styles.editor}>
                <fieldset className={styles.interests}>
                  <legend>Interests</legend>
                  <p className={styles.selection} aria-live="polite">{preferences.interests.length} selected</p>
                  <div className={styles.chips}>
                    {interests.map((interest) => {
                      const selected = preferences.interests.includes(interest)
                      return (
                        <label className={styles.chip} key={interest}>
                          <input
                            className="sr-only"
                            type="checkbox"
                            checked={selected}
                            onChange={() => changePreference(
                              'interests',
                              selected
                                ? preferences.interests.filter((item) => item !== interest)
                                : [...preferences.interests, interest],
                            )}
                          />
                          {selected && <ReferenceIcon name="check" />}
                          {interest}
                        </label>
                      )
                    })}
                  </div>
                </fieldset>

                <div className={styles.academics}>
                  <label className={styles.field}>
                    University / Academic Institution (optional)
                    <input
                      autoComplete="organization"
                      maxLength={255}
                      value={university}
                      onChange={(event) => {
                        const nextUniversity = event.target.value
                        setNotice('')
                        setDraft((current) => ({ ...current, university: nextUniversity }))
                      }}
                    />
                  </label>

                  {academicFields.map(({ key, label, options }) => (
                    <label className={styles.field} key={key}>
                      {label}
                      <select value={preferences[key]} onChange={(event) => changePreference(key, event.target.value)}>
                        <option value="">No preference</option>
                        {options.map((option) => <option key={option}>{option}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className={styles.footer}>
                <span className={styles.notice} role="status">{notice}</span>
                <button className={styles.save} type="submit" disabled={!changed || saving}>
                  <ReferenceIcon name="save" /> {saving ? 'Saving changes…' : 'Save changes'}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  )
}
