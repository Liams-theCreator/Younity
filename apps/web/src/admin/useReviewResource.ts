import { useEffect, useReducer, useState } from 'react'
import { ReviewError } from './model'

type Resource<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: ReviewError }

export function useReviewResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [generation, reload] = useReducer((value: number) => value + 1, 0)
  const [result, setResult] = useState<{
    load: typeof load
    generation: number
    resource: Resource<T>
  } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) {
          setResult({ load, generation, resource: { status: 'ready', data } })
        }
      },
      (cause: unknown) => {
        if (!controller.signal.aborted) {
          setResult({
            load,
            generation,
            resource: {
              status: 'error',
              error: cause instanceof ReviewError ? cause : new ReviewError('unavailable'),
            },
          })
        }
      },
    )
    return () => controller.abort()
  }, [load, generation])

  const resource: Resource<T> = result?.load === load && result.generation === generation
    ? result.resource
    : { status: 'loading' }

  return { resource, reload }
}
