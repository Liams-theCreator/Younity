import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AuthContext, type AuthState } from './AuthContext'
import type { LoginCredentials } from './model'
import * as authService from './service'

export type AuthService = Pick<typeof authService, 'getSession' | 'login' | 'logout'>
const loadingState: AuthState = { status: 'loading', user: null, error: null }

export default function AuthProvider({ children, service = authService }: {
  children: ReactNode
  service?: AuthService
}) {
  const [state, setState] = useState<AuthState>(loadingState)
  const requestId = useRef(0)
  const mounted = useRef(false)

  const loadSession = useCallback(() => {
    const currentRequest = ++requestId.current
    return service.getSession().then((user) => {
      if (!mounted.current || currentRequest !== requestId.current) return
      setState(user
        ? { status: 'authenticated', user, error: null }
        : { status: 'anonymous', user: null, error: null })
    }, () => {
      if (!mounted.current || currentRequest !== requestId.current) return
      setState({ status: 'error', user: null, error: 'We could not check your session. Please try again.' })
    })
  }, [service])

  const refreshSession = useCallback(async () => {
    setState(loadingState)
    await loadSession()
  }, [loadSession])

  const signIn = useCallback(async (credentials: LoginCredentials) => {
    const currentRequest = ++requestId.current
    const user = await service.login(credentials)
    if (!mounted.current || currentRequest !== requestId.current) return
    setState({ status: 'authenticated', user, error: null })
  }, [service])

  const signOut = useCallback(async () => {
    const currentRequest = ++requestId.current
    setState(loadingState)
    try {
      await service.logout()
      if (!mounted.current || currentRequest !== requestId.current) return
      setState({ status: 'anonymous', user: null, error: null })
    } catch (cause) {
      if (mounted.current && currentRequest === requestId.current) {
        setState({ status: 'error', user: null, error: 'We could not sign you out. Retry sign out or check your session.' })
      }
      throw cause
    }
  }, [service])

  useEffect(() => {
    mounted.current = true
    void loadSession()
    return () => {
      mounted.current = false
      requestId.current += 1
    }
  }, [loadSession])

  return <AuthContext.Provider value={{ ...state, refreshSession, signIn, signOut }}>{children}</AuthContext.Provider>
}
