export type LoginCredentials = {
  email: string
  password: string
}

export type SessionUser = {
  id: string | number
  email: string
}

type LoginErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'SESSION_NOT_ESTABLISHED'

const loginMessages: Record<LoginErrorCode, string> = {
  INVALID_CREDENTIALS: 'Email or password is incorrect.',
  ACCOUNT_UNAVAILABLE:
    'Your account cannot sign in. Please contact support.',
  NETWORK_ERROR:
    'Unable to connect. Check your connection and try again.',
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