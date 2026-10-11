import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AuthContext, type AuthState } from './AuthContext'
import { getSession } from './service'

const loadingState: AuthState = {
  status: 'loading',
  user: null,
  error: null,
}

export default function AuthProvider({
  children,
}: {
  children: ReactNode
}) {
  const [state, setState] = useState<AuthState>(loadingState)
  const requestId = useRef(0)

  const loadSession = useCallback(() => {
    const currentRequest = ++requestId.current

    return getSession().then(
      (user) => {
        if (currentRequest !== requestId.current) return

        setState(
          user === null
            ? { status: 'anonymous', user: null, error: null }
            : { status: 'authenticated', user, error: null },
        )
      },
      () => {
        if (currentRequest !== requestId.current) return

        setState({
          status: 'error',
          user: null,
          error: 'We could not check your session. Please try again.',
        })
      },
    )
  }, [])

  const refreshSession = useCallback(async () => {
    setState(loadingState)
    await loadSession()
  }, [loadSession])

  useEffect(() => {
    void loadSession()

    return () => {
      requestId.current += 1
    }
  }, [loadSession])

  return (
    <AuthContext.Provider value={{ ...state, refreshSession }}>
      {children}
    </AuthContext.Provider>
  )
}