import type { RegistrationDraft, StudentRegistrationDraft } from './model'
import type { OrganizationDetails } from './organizationDraft'
import type { StudentPreferences } from './studentPreferences'

const interestCodes = {
  'Hackathons & Coding Competitions': 'HACKATHONS',
  'AI & Data Science': 'AI_DATA',
  'Startups & Entrepreneurship': 'STARTUPS_ENTR',
  'Robotics & Smart IoT': 'ROBOTICS_IOT',
  'UI/UX & Product Design': 'UI_UX_DESIGN',
  'Public Speaking & Debate': 'PUBLIC_SPEAKING',
  'Social Impact & Civic NGOs': 'SOCIAL_IMPACT_NGOS',
  'Fintech, Banking & Consulting': 'FINTECH',
  'Scientific Research & Publishing': 'SCIENTIFIC_RESEARCH',
  'Career Fairs & Executive Networking': 'CAREER_FAIRS_NETWORKING',
} as const

export interface StudentRegistrationPayload {
  firstName: string
  lastName: string
  email: string
  password: string
  university: string
  interests?: (typeof interestCodes)[keyof typeof interestCodes]
}

export interface OrganizerRegistrationPayload {
  firstName: string
  lastName: string
  email: string
  password: string
  organizationName: string
  type: string
  representativeFullName: string
  academicPosition: string
  phoneNumber: string
  customType?: string
  proofUrl?: string
}

export function mapStudentPayload(
  draft: StudentRegistrationDraft,
  preferences: StudentPreferences,
): StudentRegistrationPayload {
  const firstInterest = preferences.interests[0]
  const interests = Object.entries(interestCodes).find(([label]) => label === firstInterest)?.[1]
  return {
    firstName: draft.firstName.trim(),
    lastName: draft.lastName.trim(),
    email: draft.email.trim().toLowerCase(),
    password: draft.password,
    university: (draft.university.toLowerCase() === 'other'
      ? draft.customUniversity ?? ''
      : draft.university).trim(),
    // The DTO uses the plural key `interests` but accepts a single enum value.
    ...(interests ? { interests } : {}),
  }
}

export function mapOrganizerPayload(
  account: RegistrationDraft,
  organization: OrganizationDetails,
  document: File | null,
): OrganizerRegistrationPayload {
  const representativeFullName = organization.representativeName.trim().replace(/\s+/g, ' ')
  const firstSpace = representativeFullName.indexOf(' ')
  return {
    firstName: firstSpace < 0 ? representativeFullName : representativeFullName.slice(0, firstSpace),
    lastName: firstSpace < 0 ? '' : representativeFullName.slice(firstSpace + 1),
    email: account.email.trim().toLowerCase(),
    password: account.password,
    organizationName: organization.organizationName.trim(),
    type: organization.category.toUpperCase(),
    representativeFullName,
    academicPosition: organization.position.trim(),
    phoneNumber: organization.phone.trim(),
    // TODO: Backend needs to add customType field. Its current strict DTO rejects this key.
    ...(organization.category.toLowerCase() === 'other'
      ? { customType: organization.customCategory.trim() }
      : {}),
    // TODO: Replace this mock URL with the URL returned by a real file upload.
    ...(document ? { proofUrl: 'https://mock-storage.com/proof.pdf' } : {}),
  }
}
