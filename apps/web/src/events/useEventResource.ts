import { useEffect, useReducer, useState } from 'react'
import { EventUiError } from './model'
export function useEventResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [generation, reload] = useReducer((value: number) => value + 1, 0)
  const [result, setResult] = useState<{
    load: typeof load
    generation: number
    data?: T
    error?: EventUiError
  }>()
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ load, generation, data })
      },
      (cause) => {
        if (!controller.signal.aborted)
          setResult({
            load,
            generation,
            error: cause instanceof EventUiError ? cause : new EventUiError('unavailable'),
          })
      },
    )
    return () => controller.abort()
  }, [load, generation])
  const current = result?.load === load && result.generation === generation ? result : undefined
  return { loading: !current, data: current?.data, error: current?.error, reload }
}
