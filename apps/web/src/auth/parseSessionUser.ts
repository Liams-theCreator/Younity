import {
  LoginError,
  type OrganizationStatus,
  type SessionUser,
} from './model'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseSessionUser(data: unknown): SessionUser {
  if (
    !isObject(data) ||
    typeof data.email !== 'string' ||
    !data.email.trim() ||
    !(
      (typeof data.id === 'string' && data.id.trim().length > 0) ||
      (typeof data.id === 'number' &&
        Number.isSafeInteger(data.id) &&
        data.id > 0)
    )
  ) {
    throw new LoginError('SERVICE_UNAVAILABLE')
  }

  if (
    data.role !== 'STUDENT' &&
    data.role !== 'ORGANIZER' &&
    data.role !== 'ADMIN'
  ) {
    throw new LoginError('SERVICE_UNAVAILABLE')
  }

  if (
    data.status !== 'PENDING' &&
    data.status !== 'ACTIVE' &&
    data.status !== 'SUSPENDED'
  ) {
    throw new LoginError('SERVICE_UNAVAILABLE')
  }

  let organizationStatus: OrganizationStatus | null = null

  if (data.organization !== null && data.organization !== undefined) {
    if (!isObject(data.organization)) {
      throw new LoginError('SERVICE_UNAVAILABLE')
    }

    const verificationStatus = data.organization.verificationStatus

    if (
      verificationStatus !== 'PENDING' &&
      verificationStatus !== 'NEEDS_CHANGES' &&
      verificationStatus !== 'APPROVED' &&
      verificationStatus !== 'REJECTED'
    ) {
      throw new LoginError('SERVICE_UNAVAILABLE')
    }

    organizationStatus = verificationStatus
  }

  if (data.role === 'ORGANIZER' && organizationStatus === null) {
    throw new LoginError('SERVICE_UNAVAILABLE')
  }

  return {
    id: data.id,
    email: data.email,
    role: data.role,
    userStatus: data.status,
    organizationStatus,
  }
}