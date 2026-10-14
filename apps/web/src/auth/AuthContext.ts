import { createContext } from 'react'
import type { SessionUser } from './model'

export type AuthState =
  | { status: 'loading'; user: null; error: null }
  | { status: 'authenticated'; user: SessionUser; error: null }
  | { status: 'anonymous'; user: null; error: null }
  | { status: 'error'; user: null; error: string }

type AuthContextValue = AuthState & {
  refreshSession: () => Promise<void>
}

export const AuthContext =
  createContext<AuthContextValue | undefined>(undefined)