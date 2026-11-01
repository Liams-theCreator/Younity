import { createContext } from 'react'
import type { LoginCredentials, SessionUser } from './model'
import type { AuthDestination } from './getAuthDestination'

export type AuthState =
  | {
      status: 'loading'
      user: null
      error: null
    }
  | {
      status: 'authenticated'
      user: SessionUser
      error: null
    }
  | {
      status: 'anonymous'
      user: null
      error: null
      reason?: 'expired'
    }
  | {
      status: 'error'
      user: null
      error: string
      operation: 'session' | 'logout'
    }

type AuthContextValue = AuthState & {
  destination: AuthDestination | null
  refreshSession: () => Promise<void>
  signIn: (credentials: LoginCredentials) => Promise<void>
  signOut: () => Promise<void>
  requestProtected: (
    input: RequestInfo | URL,
    options?: RequestInit,
    request?: typeof fetch,
  ) => Promise<Response>
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
)