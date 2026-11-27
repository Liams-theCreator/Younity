import type { AuthAccessProfile } from './model'

export type AuthDestination =
  | '/admin/applications'
  | '/student/preferences'
  | '/organizer/application'
  | '/organizer/approved'
  | '/student/dashboard'
  | '/organizer/'
  | '/organizer/pending'
  | '/organizer/status'

export function getAuthDestination(
  profile: AuthAccessProfile | null | undefined,
): AuthDestination | null {
  if (!profile) return null

  if (profile.role === 'ADMIN') {
    return profile.userStatus === 'ACTIVE' ? '/admin/applications' : null
  }

  if (profile.role === 'STUDENT') {
    if (
      profile.userStatus === 'ACTIVE' &&
      profile.onboarding?.complete === false
    ) {
      return '/student/preferences'
    }

    return profile.userStatus === 'ACTIVE' ? '/student/dashboard' : null
  }

  if (profile.role !== 'ORGANIZER') return null

  if (
    profile.userStatus !== 'ACTIVE' &&
    profile.userStatus !== 'PENDING'
  ) {
    return null
  }

  if (profile.organizationStatus === 'PENDING') {
    if (profile.onboarding?.complete === false) {
      return '/organizer/application'
    }

    return '/organizer/pending'
  }

  if (
    profile.organizationStatus === 'NEEDS_CHANGES' ||
    profile.organizationStatus === 'REJECTED'
  ) {
    return '/organizer/status'
  }

  if (
    profile.userStatus === 'ACTIVE' &&
    profile.organizationStatus === 'APPROVED'
  ) {
    if (profile.approvalAcknowledged === false) {
      return '/organizer/approved'
    }

    return '/organizer/'
  }

  return null
}