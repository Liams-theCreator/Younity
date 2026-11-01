export type LoginCredentials = {
  email: string
  password: string
}

export type UserRole = 'STUDENT' | 'ORGANIZER' | 'ADMIN'

export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED'

export type OrganizationStatus =
  | 'PENDING'
  | 'NEEDS_CHANGES'
  | 'APPROVED'
  | 'REJECTED'

export type AuthAccessProfile = {
  role?: UserRole
  userStatus?: UserStatus
  organizationStatus?: OrganizationStatus | null
}

export type SessionUser = {
  id: string | number
  email: string
  role: UserRole
  userStatus: UserStatus
  organizationStatus: OrganizationStatus | null
}

type LoginErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'SESSION_NOT_ESTABLISHED'

const loginMessages: Record<LoginErrorCode, string> = {
  INVALID_CREDENTIALS: 'Email or password is incorrect.',
  ACCOUNT_UNAVAILABLE: 'Your account cannot sign in. Please contact support.',
  NETWORK_ERROR: 'Unable to connect. Check your connection and try again.',
  SERVICE_UNAVAILABLE:
    'Sign-in is temporarily unavailable. Please try again later.',
  SESSION_NOT_ESTABLISHED:
    'Your session could not be established. Please try again.',
}

export class LoginError extends Error {
  readonly code: LoginErrorCode

  constructor(code: LoginErrorCode) {
    super(loginMessages[code])
    this.name = 'LoginError'
    this.code = code
  }
}

type LogoutErrorCode =
  | 'NETWORK_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'SESSION_STILL_ACTIVE'

const logoutMessages: Record<LogoutErrorCode, string> = {
  NETWORK_ERROR:
    'We could not confirm sign-out. Check your connection and try again.',
  SERVICE_UNAVAILABLE: 'Sign-out is temporarily unavailable. Please try again.',
  SESSION_STILL_ACTIVE:
    'Your session is still active. Please try signing out again.',
}

export class LogoutError extends Error {
  readonly code: LogoutErrorCode

  constructor(code: LogoutErrorCode) {
    super(logoutMessages[code])
    this.name = 'LogoutError'
    this.code = code
  }
}