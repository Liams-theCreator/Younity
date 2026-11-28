import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { emptyPreferences } from '../registration/studentPreferences'
import { PreferencesError, requestPreferences, type PreferencesDraft, type PreferencesUpdate } from './preferences'

export function useStudentPreferences() {
  const { requestProtected } = useAuth()
  const [draft, setDraft] = useState<PreferencesDraft>({ preferences: emptyPreferences, university: '' })
  const [saved, setSaved] = useState<PreferencesDraft | null>(null)
  const [pending, setPending] = useState<'load' | 'save' | null>('load')
  const [error, setError] = useState('')
  const operation = useRef<AbortController | null>(null)

  const load = useCallback((controller: AbortController) => {
    return requestPreferences(requestProtected, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return

        setDraft(result)
        setSaved(result)
      }, (cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof PreferencesError ? cause.message : 'Could not load your preferences.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          operation.current = null
          setPending(null)
        }
      })
  }, [requestProtected])

  useEffect(() => {
    const controller = new AbortController()
    operation.current = controller
    void load(controller)
    return () => operation.current?.abort()
  }, [load])

  function retry() {
    operation.current?.abort()
    const controller = new AbortController()
    operation.current = controller
    setPending('load')
    setError('')
    return load(controller)
  }

  async function save(update: PreferencesUpdate) {
    if (!saved || operation.current) return false

    const controller = new AbortController()
    operation.current = controller
    setPending('save')
    setError('')

    try {
      const result = await requestPreferences(requestProtected, controller.signal, update)
      if (controller.signal.aborted) return false

      setDraft(result)
      setSaved(result)
      return true
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof PreferencesError ? cause.message : 'Could not save your preferences.')
      }
      return false
    } finally {
      if (!controller.signal.aborted) {
        operation.current = null
        setPending(null)
      }
    }
  }

  return {
    draft,
    setDraft,
    saved,
    loading: pending === 'load',
    saving: pending === 'save',
    error,
    retry,
    save,
  }
}
