import { createContext } from 'react'
import type { LoginCredentials, SessionUser } from './model'

export type AuthState =
  | { status: 'loading'; user: null; error: null }
  | { status: 'authenticated'; user: SessionUser; error: null }
  | { status: 'anonymous'; user: null; error: null }
  | { status: 'error'; user: null; error: string }

type AuthContextValue = AuthState & {
  signIn: (credentials: LoginCredentials) => Promise<void>
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

export const AuthContext =
  createContext<AuthContextValue | undefined>(undefined)