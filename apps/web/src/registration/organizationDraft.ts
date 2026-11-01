export type OrganizationDetails = {
  organizationName: string
  customCategory: string
  category: string
  representativeName: string
  position: string
  phone: string
}
export const emptyOrganizationDetails: OrganizationDetails = {
  organizationName: '',
  category: '',
  customCategory: '',
  representativeName: '',
  position: '',
  phone: '',
}

export const organizationTypes = [
  'UNIVERSITY',
  'STUDENT_CLUB',
  'NGO',
  'ASSOCIATION',
  'COMPANY',
  'COMMUNITY',
  'OTHER',
] as const
export function validateOrganization(
  details: OrganizationDetails,
): Partial<Record<keyof OrganizationDetails, string>> {
  const errors: Partial<Record<keyof OrganizationDetails, string>> = {}
  for (const field of ['organizationName', 'representativeName', 'position', 'phone'] as const) {
    if (!details[field].trim()) errors[field] = 'Complete this field.'
    else if (details[field].length > 255) errors[field] = 'Use at most 255 characters.'
  }
  if (!organizationTypes.some((value) => value === details.category))
    errors.category = 'Select an entity category.'
  const names = details.representativeName.trim().replace(/\s+/g, ' ').split(' ')
  if (details.representativeName.trim() && (names.length < 2 || names[0].length > 100 || names.slice(1).join(' ').length > 100 || !/^(?=.*\p{L})[\p{L}\p{M} _-]+$/u.test(details.representativeName.trim())))
    errors.representativeName = 'Enter your first and last name using letters, spaces, hyphens or underscores.'
  if (details.phone && !/^\+[1-9][0-9 ()-]{6,}$/.test(details.phone))
    errors.phone = 'Enter a valid contact phone number.'
  return errors
}

export const organizationTypeLabels: Record<(typeof organizationTypes)[number], string> = {
  UNIVERSITY: 'University / Academic Institution',
  STUDENT_CLUB: 'Student Club / Campus Society',
  NGO: 'Non-Governmental Organization (NGO)',
  ASSOCIATION: 'Registered Association',
  COMPANY: 'Company / Corporate Partner',
  COMMUNITY: 'Professional Community / Tech Chapter',
  OTHER: 'Other',
}
