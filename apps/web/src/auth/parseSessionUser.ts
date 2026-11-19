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

  // Optional for older branch fixtures; the current API supplies these fields.
  const extras: Pick<
    SessionUser,
    'onboarding' | 'approvalAcknowledged' | 'application'
  > = {}

  if ('onboarding' in data) {
    const state = data.onboarding

    if (
      !isObject(state) ||
      typeof state.complete !== 'boolean' ||
      (
        state.complete
          ? state.nextStep !== 'NONE'
          : state.nextStep !== (
              data.role === 'STUDENT'
                ? 'SELECT_INTERESTS'
                : 'COMPLETE_ORGANIZER_APPLICATION'
            )
      )
    ) {
      throw new LoginError('SERVICE_UNAVAILABLE')
    }

    extras.onboarding = {
      complete: state.complete,
      nextStep:
        state.nextStep as NonNullable<SessionUser['onboarding']>['nextStep'],
    }
  }

  if (
    isObject(data.organization) &&
    'approvalAcknowledged' in data.organization
  ) {
    if (typeof data.organization.approvalAcknowledged !== 'boolean') {
      throw new LoginError('SERVICE_UNAVAILABLE')
    }

    extras.approvalAcknowledged = data.organization.approvalAcknowledged
  }

  if (isObject(data.organization) && 'application' in data.organization) {
    const application = data.organization.application

    if (application === null) {
      extras.application = null
    } else {
      if (
        !isObject(application) ||
        typeof application.id !== 'string' ||
        !application.id.trim() ||
        !['PENDING', 'NEEDS_CHANGES', 'APPROVED', 'REJECTED'].includes(
          String(application.status),
        ) ||
        !(
          application.reviewerNote === null ||
          typeof application.reviewerNote === 'string'
        )
      ) {
        throw new LoginError('SERVICE_UNAVAILABLE')
      }

      extras.application = {
        id: application.id,
        status: application.status as OrganizationStatus,
        reviewerNote: application.reviewerNote,
      }
    }
  }

  return {
    ...extras,
    id: data.id,
    email: data.email,
    role: data.role,
    userStatus: data.status,
    organizationStatus,
  }
}