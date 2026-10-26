import type { AuthAccessProfile } from './model'

export type AuthDestination =
  | '/student/dashboard'
  | '/organizer/dashboard'
  | '/organizer/pending'
  | '/organizer/status'

export function getAuthDestination(
  profile: AuthAccessProfile | null | undefined,
): AuthDestination | null {
  if (!profile) return null

  if (profile.role === 'STUDENT') {
    return profile.userStatus === 'ACTIVE' ? '/student/dashboard' : null
  }

  if (profile.role !== 'ORGANIZER') return null

  if (profile.userStatus !== 'ACTIVE' && profile.userStatus !== 'PENDING') {
    return null
  }

  if (profile.organizationStatus === 'PENDING') {
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
    return '/organizer/dashboard'
  }

  return null
}