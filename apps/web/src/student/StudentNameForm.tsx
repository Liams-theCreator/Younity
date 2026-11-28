import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import styles from '../pages/StudentProfilePage.module.css'

type StudentName = { firstName: string; lastName: string }

async function requestName(
  request: typeof fetch,
  signal: AbortSignal,
  changes?: Partial<StudentName>,
): Promise<StudentName> {
  const errorMessage = changes ? 'Could not save your name. Please retry.' : 'Could not load your name.'
  const response = await request('/api/student/profile', {
    cache: 'no-store',
    signal,
    ...(changes && {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    }),
  }).catch(() => { throw new Error(errorMessage) })

  if (response.status === 400 && changes) {
    throw new Error('Enter a first and last name using letters, spaces, hyphens or underscores (up to 100 characters each).')
  }
  if (!response.ok) throw new Error(errorMessage)

  const data: unknown = await response.json().catch(() => null)
  if (typeof data !== 'object' || data === null ||
    !('firstName' in data) || typeof data.firstName !== 'string' ||
    !('lastName' in data) || typeof data.lastName !== 'string') {
    throw new Error(errorMessage)
  }
  return { firstName: data.firstName, lastName: data.lastName }
}

export default function StudentNameForm() {
  const { requestProtected } = useAuth()
  const [saved, setSaved] = useState<StudentName | null>(null)
  const [draft, setDraft] = useState<StudentName>({ firstName: '', lastName: '' })
  const [attempt, setAttempt] = useState(0)
  const [alert, setAlert] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const pendingSave = useRef<AbortController | null>(null)
  const firstName = draft.firstName.trim()
  const lastName = draft.lastName.trim()
  const changed = saved !== null && (firstName !== saved.firstName || lastName !== saved.lastName)

  useEffect(() => {
    const controller = new AbortController()
    void requestName(requestProtected, controller.signal).then((name) => {
      if (controller.signal.aborted) return
      setSaved(name)
      setDraft(name)
    }, (error: Error) => {
      if (!controller.signal.aborted) setAlert(error.message)
    })

    return () => {
      controller.abort()
      pendingSave.current?.abort()
    }
  }, [attempt, requestProtected])

  function change(field: keyof StudentName, value: string) {
    setNotice('')
    setAlert('')
    setDraft((current) => ({ ...current, [field]: value }))
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!saved || !changed || pendingSave.current) return

    const controller = new AbortController()
    pendingSave.current = controller
    setAlert('')
    setNotice('')
    setSaving(true)

    try {
      const name = await requestName(requestProtected, controller.signal, {
        ...(firstName !== saved.firstName ? { firstName } : {}),
        ...(lastName !== saved.lastName ? { lastName } : {}),
      })
      if (controller.signal.aborted) return
      setSaved(name)
      setDraft(name)
      setNotice('Name saved.')
    } catch (error) {
      if (!controller.signal.aborted) {
        setAlert(error instanceof Error ? error.message : 'Could not save your name. Please retry.')
      }
    } finally {
      pendingSave.current = null
      if (!controller.signal.aborted) setSaving(false)
    }
  }

  return (
    <div className={styles.profileName}>
      {alert && <p className={styles.error} role="alert">{alert}</p>}
      {!saved && (alert ? (
        <button className={styles.retry} type="button" onClick={() => {
          setAlert('')
          setAttempt((current) => current + 1)
        }}>Retry loading name</button>
      ) : <p role="status">Loading your name…</p>)}

      {saved && (
        <form onSubmit={(event) => void save(event)} aria-busy={saving}>
          <fieldset disabled={saving}>
            <label className={styles.field}>
              First name
              <input required maxLength={100} autoComplete="given-name" value={draft.firstName}
                onChange={(event) => change('firstName', event.target.value)} />
            </label>
            <label className={styles.field}>
              Last name
              <input required maxLength={100} autoComplete="family-name" value={draft.lastName}
                onChange={(event) => change('lastName', event.target.value)} />
            </label>
            <button className={styles.save} type="submit" disabled={!changed || saving}>
              {saving ? 'Saving name…' : 'Save name'}
            </button>
          </fieldset>
          <p className={styles.notice} role="status">{notice}</p>
        </form>
      )}
    </div>
  )
}
