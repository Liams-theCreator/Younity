import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AuthContext, type AuthState } from './AuthContext'
import {
  LoginError,
  LogoutError,
  type LoginCredentials,
  type SessionUser,
} from './model'
import { getSession, login, logout } from './service'
import { getAuthDestination } from './getAuthDestination'
import { apiRequest } from '../api/client'

const loadingState: AuthState = {
  status: 'loading',
  user: null,
  error: null,
}

const anonymousState: AuthState = {
  status: 'anonymous',
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
  const pendingLogin = useRef<Promise<SessionUser> | null>(null)
  const pendingLogout = useRef<Promise<void> | null>(null)

  const loadSession = useCallback(() => {
    const currentRequest = ++requestId.current

    return getSession().then(
      (user) => {
        if (currentRequest !== requestId.current) return

        setState(
          user === null
            ? anonymousState
            : {
                status: 'authenticated',
                user,
                error: null,
              },
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
    if (pendingLogin.current || pendingLogout.current) return

    setState(loadingState)
    await loadSession()
  }, [loadSession])

  const signIn = useCallback(async (credentials: LoginCredentials) => {
    if (pendingLogin.current || pendingLogout.current) {
      throw new LoginError('SERVICE_UNAVAILABLE')
    }

    const currentRequest = ++requestId.current
    const operation = login(credentials)
    pendingLogin.current = operation

    try {
      const user = await operation

      if (currentRequest !== requestId.current) return

      setState({
        status: 'authenticated',
        user,
        error: null,
      })
    } finally {
      if (pendingLogin.current === operation) {
        pendingLogin.current = null
      }
    }
  }, [])

  const signOut = useCallback((): Promise<void> => {
    if (pendingLogout.current) return pendingLogout.current

    const currentRequest = ++requestId.current
    const loginToFinish = pendingLogin.current

    setState(loadingState)

    const operation: Promise<void> = (async () => {
      try {
        // Finish an earlier login before clearing its cookie.
        if (loginToFinish) {
          await loginToFinish.catch(() => undefined)
        }

        await logout()

        if (currentRequest === requestId.current) {
          setState(anonymousState)
        }
      } catch (cause) {
        if (currentRequest === requestId.current) {
          setState({
            status: 'error',
            user: null,
            error:
              cause instanceof LogoutError
                ? cause.message
                : 'We could not confirm sign-out. Please try again.',
          })
        }

        throw cause
      }
    })().finally(() => {
      if (pendingLogout.current === operation) {
        pendingLogout.current = null
      }
    })

    pendingLogout.current = operation
    return operation
  }, [])

  const requestProtected = useCallback(
    async (
      input: RequestInfo | URL,
      options?: RequestInit,
      request: typeof fetch = apiRequest,
    ): Promise<Response> => {
      const sessionRequest = requestId.current

      const response = await request(input, {
        ...options,
        credentials: 'include',
      })

      if (
        response.status === 401 &&
        sessionRequest === requestId.current &&
        !pendingLogin.current &&
        !pendingLogout.current
      ) {
        requestId.current += 1

        setState({
          status: 'anonymous',
          user: null,
          error: null,
          reason: 'expired',
        })
      }

      return response
    },
    [],
  )

  useEffect(() => {
    void loadSession()

    return () => {
      requestId.current += 1
    }
  }, [loadSession])

  const destination =
    state.status === 'authenticated'
      ? getAuthDestination(state.user)
      : null

  return (
    <AuthContext.Provider
      value={{
        ...state,
        destination,
        refreshSession,
        signIn,
        signOut,
        requestProtected,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}