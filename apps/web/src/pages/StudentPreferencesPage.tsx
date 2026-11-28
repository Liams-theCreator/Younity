import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth'
import StudentPreferencesForm from '../components/StudentPreferencesForm'
import { RegistrationLayout } from '../components/RegistrationForm'
import { useStudentPreferences } from '../student/useStudentPreferences'
import './StudentPreferencesPage.css'

export default function StudentPreferencesPage() {
  const { destination } = useAuth()
  // A session refresh during setup must not follow the redirect for old links.
  const [enteredForSetup] = useState(destination === '/student/preferences')
  return enteredForSetup ? <StudentPreferencesSetup /> : <Navigate to="/student/profile" replace />
}

function StudentPreferencesSetup() {
  const { refreshSession } = useAuth()
  const navigate = useNavigate()
  const { draft, setDraft, saved, loading, saving, error, retry, save } = useStudentPreferences()
  const alert = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (error) alert.current?.focus()
  }, [error])

  async function completeOnboarding() {
    if (await save({ preferences: draft.preferences })) {
      navigate('/events', { replace: true })
      void refreshSession({ background: true })
    }
  }

  return (
    <RegistrationLayout
      variant="student-preferences"
      title="Your discovery preferences"
      headerContent={<p className="helper">Student preferences</p>}
      introduction="Choose at least two different interests. Academic information is optional."
    >
      {loading && <p role="status">Loading your saved preferences…</p>}

      {error && (
        <div ref={alert} role="alert" tabIndex={-1} className="notice error">
          {error}
        </div>
      )}

      {!loading && !saved && (
        <button className="secondary" type="button" onClick={() => void retry()}>
          Retry loading preferences
        </button>
      )}

      {!loading && saved && (
        <>
          <StudentPreferencesForm
            mode="preferences"
            preferences={draft.preferences}
            onChange={(preferences) => setDraft((current) => ({ ...current, preferences }))}
            onSubmit={() => void completeOnboarding()}
            disabled={saving}
          />

          {saving && <p role="status">Saving preferences…</p>}
        </>
      )}
    </RegistrationLayout>
  )
}
