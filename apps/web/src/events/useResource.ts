import { useCallback, useEffect, useState } from 'react'
import { EventsError } from './discovery.model'

type Result<T> = { key: string; attempt: number } & (
  | { state: 'ready'; data: T }
  | { state: 'error'; error: EventsError }
)

export function useResource<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result<T> | null>(null)
  useEffect(() => {
    if (key === null) return
    const controller = new AbortController()
    void load(controller.signal).then(
      data => {
        if (!controller.signal.aborted) setResult({ key, attempt, state: 'ready', data })
      },
      cause => {
        if (!controller.signal.aborted) setResult({ key, attempt, state: 'error', error: cause instanceof EventsError ? cause : new EventsError('unavailable') })
      },
    )
    return () => controller.abort()
  }, [key, attempt, load])
  const retry = useCallback(() => setAttempt(value => value + 1), [])
  if (key === null) return { state: 'idle' as const, retry }
  if (!result || result.key !== key || result.attempt !== attempt) return { state: 'loading' as const, retry }
  return { ...result, retry }
}
