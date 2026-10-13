// These are local preview values, not backend DTO fields or upload requirements.
export type OrganizationDetails = {
  organizationName: string
  category: string
  representativeName: string
  position: string
  phone: string
}
export const emptyOrganizationDetails: OrganizationDetails = {
  organizationName: '', category: '', representativeName: '', position: '', phone: '',
}



export const organizationTypes = ['UNIVERSITY', 'STUDENT_CLUB', 'NGO', 'ASSOCIATION', 'COMPANY', 'COMMUNITY', 'OTHER'] as const
export function validateOrganization(details: OrganizationDetails): Partial<Record<keyof OrganizationDetails, string>> {
  const errors: Partial<Record<keyof OrganizationDetails, string>> = {}
  for (const field of ['organizationName', 'representativeName', 'position', 'phone'] as const) {
    if (!details[field].trim()) errors[field] = 'Complete this field.'
    else if (details[field].length > 255) errors[field] = 'Use at most 255 characters.'
  }
  if (!organizationTypes.some(value => value === details.category)) errors.category = 'Select an entity category.'
  if (details.phone && !/^\+?[0-9 ()-]+$/.test(details.phone)) errors.phone = 'Enter a valid contact phone number.'
  return errors
}

export const organizationTypeLabels: Record<typeof organizationTypes[number], string> = {
  UNIVERSITY: 'University / Academic Institution',
  STUDENT_CLUB: 'Student Club / Campus Society',
  NGO: 'Non-Governmental Organization (NGO)',
  ASSOCIATION: 'Registered Association',
  COMPANY: 'Company / Corporate Partner',
  COMMUNITY: 'Professional Community / Tech Chapter',
  OTHER: 'Other Organization',
}
