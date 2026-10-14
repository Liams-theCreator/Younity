import {
  LoginError,
  type LoginCredentials,
  type SessionUser,
} from './model'

export async function getSession(
  request: typeof fetch = fetch,
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

    if (
      typeof data !== 'object' || data === null ||
      !('id' in data) || !('email' in data) ||
      typeof data.email !== 'string' || !data.email.trim() ||
      !(
        (typeof data.id === 'string' && data.id.trim().length > 0) ||
        (typeof data.id === 'number' &&
          Number.isSafeInteger(data.id) && data.id > 0)
      )
    ) {
      throw new LoginError('SERVICE_UNAVAILABLE')
    }

    return { id: data.id, email: data.email }
  } catch (cause) {
    if (cause instanceof LoginError) throw cause
    throw new LoginError('NETWORK_ERROR')
  }
}

export async function login(
  credentials: LoginCredentials,
  request: typeof fetch = fetch,
): Promise<SessionUser> {
  try {
    const response = await request('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
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

export async function logout(request: typeof fetch = fetch): Promise<void> {
  try {
    const response = await request('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
    if (!response.ok && response.status !== 401) {
      throw new LoginError('SERVICE_UNAVAILABLE')
    }
  } catch (cause) {
    if (cause instanceof LoginError) throw cause
    throw new LoginError('NETWORK_ERROR')
  }
}
