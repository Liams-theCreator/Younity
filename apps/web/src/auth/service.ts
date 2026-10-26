import {
  LoginError,
  LogoutError,
  type LoginCredentials,
  type SessionUser,
} from './model'
import { parseSessionUser } from './parseSessionUser'
import { apiRequest } from '../api/client'

export async function getSession(
  request: typeof fetch = apiRequest,
): Promise<SessionUser | null> {
  try {
    const response = await request('/api/auth/me', {
      credentials: 'include',
      cache: 'no-store',
    })

    if (response.status === 401) return null

    if (response.status === 403) {
      throw new LoginError('ACCOUNT_UNAVAILABLE')
    }

    if (response.status !== 200) {
      throw new LoginError('SERVICE_UNAVAILABLE')
    }

    const data: unknown = await response.json().catch(() => null)

    return parseSessionUser(data)
  } catch (cause) {
    if (cause instanceof LoginError) throw cause
    throw new LoginError('NETWORK_ERROR')
  }
}

export async function login(
  credentials: LoginCredentials,
  request: typeof fetch = apiRequest,
): Promise<SessionUser> {
  try {
    const response = await request('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    })

    if (response.status === 401) {
      throw new LoginError('INVALID_CREDENTIALS')
    }

    if (response.status === 403) {
      throw new LoginError('ACCOUNT_UNAVAILABLE')
    }

    if (!response.ok) {
      throw new LoginError('SERVICE_UNAVAILABLE')
    }

    const user = await getSession(request)

    if (user === null) {
      throw new LoginError('SESSION_NOT_ESTABLISHED')
    }

    return user
  } catch (cause) {
    if (cause instanceof LoginError) throw cause
    throw new LoginError('NETWORK_ERROR')
  }
}

export async function logout(
  request: typeof fetch = apiRequest,
): Promise<void> {
  try {
    const response = await request('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    })

    if (
      response.status !== 200 &&
      response.status !== 204 &&
      response.status !== 401
    ) {
      throw new LogoutError('SERVICE_UNAVAILABLE')
    }

    const user = await getSession(request)

    if (user !== null) {
      throw new LogoutError('SESSION_STILL_ACTIVE')
    }
  } catch (cause) {
    if (cause instanceof LogoutError) throw cause

    if (cause instanceof LoginError && cause.code !== 'NETWORK_ERROR') {
      throw new LogoutError('SERVICE_UNAVAILABLE')
    }

    throw new LogoutError('NETWORK_ERROR')
  }
}