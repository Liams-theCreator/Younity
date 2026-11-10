import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth'
import StudentPreferencesForm from '../components/StudentPreferencesForm'
import { RegistrationLayout } from '../components/RegistrationForm'
import { emptyPreferences } from '../registration/studentPreferences'
import {
  PreferencesError,
  requestPreferences,
} from '../student/preferences'

export default function StudentPreferencesPage() {
  const { requestProtected, refreshSession } = useAuth()
  const navigate = useNavigate()

  const [preferences, setPreferences] = useState({
    ...emptyPreferences,
  })
  const [university, setUniversity] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  const operation = useRef<AbortController | null>(null)
  const saveLock = useRef(false)
  const alert = useRef<HTMLDivElement>(null)

  const load = useCallback(
    (controller: AbortController) => {
      return requestPreferences(
        requestProtected,
        controller.signal,
      )
        .then(
          (saved) => {
            if (controller.signal.aborted) return

            setPreferences(saved.preferences)
            setUniversity(saved.university)
            setLoaded(true)
          },
          (cause) => {
            if (!controller.signal.aborted) {
              setError(
                cause instanceof PreferencesError
                  ? cause.message
                  : 'Could not load your preferences.',
              )
            }
          },
        )
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false)
          }
        })
    },
    [requestProtected],
  )

  useEffect(() => {
    const controller = new AbortController()
    operation.current = controller
    void load(controller)

    return () => operation.current?.abort()
  }, [load])

  useEffect(() => {
    if (error) alert.current?.focus()
  }, [error])

  function retry() {
    operation.current?.abort()

    const controller = new AbortController()
    operation.current = controller

    setError('')
    setLoading(true)
    void load(controller)
  }

  async function save() {
    if (
      !loaded ||
      loading ||
      saveLock.current ||
      operation.current?.signal.aborted
    ) {
      return
    }

    saveLock.current = true

    const controller = new AbortController()
    operation.current?.abort()
    operation.current = controller

    setSaving(true)
    setError('')

    try {
      await requestPreferences(
        requestProtected,
        controller.signal,
        { preferences, university },
      )

      if (controller.signal.aborted) return

      // Refresh hides protected children while loading.
      // Navigate only after the confirmed write, then refresh.
      navigate('/student/dashboard', { replace: true })
      void refreshSession()
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(
          cause instanceof PreferencesError
            ? cause.message
            : 'Could not save your preferences.',
        )
      }
    } finally {
      saveLock.current = false

      if (!controller.signal.aborted) {
        operation.current = null
        setSaving(false)
      }
    }
  }

  return (
    <RegistrationLayout
      variant="student-preferences"
      title="Your discovery preferences"
      headerContent={
        <p className="helper">Student preferences</p>
      }
      introduction="Choose at least two different interests. Academic information is optional."
    >
      {loading && (
        <p role="status">Loading your saved preferences…</p>
      )}

      {error && (
        <div
          ref={alert}
          role="alert"
          tabIndex={-1}
          className="notice error"
        >
          {error}
        </div>
      )}

      {!loading && !loaded && (
        <button
          className="secondary"
          type="button"
          onClick={retry}
        >
          Retry loading preferences
        </button>
      )}

      {!loading && loaded && (
        <>
          <div className="form-field">
            <label htmlFor="preferences-university">
              University / Academic Institution (optional)
            </label>

            <input
              id="preferences-university"
              maxLength={255}
              autoComplete="organization"
              disabled={saving}
              value={university}
              onChange={(event) =>
                setUniversity(event.target.value)
              }
            />
          </div>

          <StudentPreferencesForm
            mode="preferences"
            preferences={preferences}
            onChange={setPreferences}
            onBack={() => navigate('/student/dashboard')}
            onSubmit={() => void save()}
            disabled={saving}
          />

          {saving && (
            <p role="status">Saving preferences…</p>
          )}
        </>
      )}

      {!loaded && (
        <Link to="/student/dashboard">
          Back to student dashboard
        </Link>
      )}
    </RegistrationLayout>
  )
}