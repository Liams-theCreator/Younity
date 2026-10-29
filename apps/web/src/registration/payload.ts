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
  interests: (typeof interestCodes)[keyof typeof interestCodes][]
  studyLevel?: 'FIRST_YEAR' | 'SECOND_YEAR' | 'MASTER' | 'PHD'
  academicField?: 'COMPUTER_SCIENCE' | 'BUSINESS_MGMT' | 'ENGINEERING_ROBOTICS' | 'HEALTHCARE_BIOTECH' | 'ARTS_DESIGN' | 'LAW_SOCIAL_SCIENCES' | 'ENVIRONMENT_ARGO'
  opportunityFormat?: 'IN_PERSON' | 'ONLINE' | 'HYBRID'
}

export interface OrganizerRegistrationPayload {
  firstName: string
  lastName: string
  email: string
  password: string
  organizationName: string
  type: OrganizationDetails['category']
  representativeFullName: string
  academicPosition: string
  phoneNumber: string
  proofUrl?: string
}

export function mapStudentPayload(
  draft: StudentRegistrationDraft,
  preferences: StudentPreferences,
): StudentRegistrationPayload {
  const studyLevels: Record<string, StudentRegistrationPayload['studyLevel']> = {
    'First Year (CPGE / L1)': 'FIRST_YEAR', 'Second Year (L2)': 'SECOND_YEAR',
    'Master / Ingénieur': 'MASTER', 'PhD / Doctorate': 'PHD',
  }
  const fields: Record<string, StudentRegistrationPayload['academicField']> = {
    'Computer Science & AI': 'COMPUTER_SCIENCE', 'Business & Mgmt': 'BUSINESS_MGMT',
    'Engineering & Robotics': 'ENGINEERING_ROBOTICS', 'Healthcare & Biotech': 'HEALTHCARE_BIOTECH',
    'Arts & Design': 'ARTS_DESIGN', 'Law & Social Sciences': 'LAW_SOCIAL_SCIENCES',
    'Environment & Agro': 'ENVIRONMENT_ARGO',
  }
  const formats: Record<string, StudentRegistrationPayload['opportunityFormat']> = {
    'In-person Campus Events': 'IN_PERSON', 'Online Events': 'ONLINE', 'Hybrid Events': 'HYBRID',
  }
  return {
    firstName: draft.firstName.trim(),
    lastName: draft.lastName.trim(),
    email: draft.email.trim().toLowerCase(),
    password: draft.password,
    university: (draft.university.toLowerCase() === 'other'
      ? draft.customUniversity ?? ''
      : draft.university).trim(),
    interests: preferences.interests.map((label) => interestCodes[label as keyof typeof interestCodes]),
    ...(preferences.academicLevel ? { studyLevel: studyLevels[preferences.academicLevel] } : {}),
    ...(preferences.discipline ? { academicField: fields[preferences.discipline] } : {}),
    ...(preferences.formats ? { opportunityFormat: formats[preferences.formats] } : {}),
  }
}

export function mapOrganizerPayload(
  account: RegistrationDraft,
  organization: OrganizationDetails,
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
  }
}
