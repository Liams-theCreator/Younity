import type { FieldErrors } from './model'
import type { OrganizationDetails } from './organizationDraft'
import type { RegistrationError } from './service'

export function registrationFieldErrors(error: RegistrationError) {
  const fields: FieldErrors = {}
  const organization: Partial<Record<keyof OrganizationDetails, string>> = {}
  const accountNames = ['firstName', 'lastName', 'email', 'password', 'university'] as const
  const organizationNames = {
    organizationName: 'organizationName', type: 'category', representativeFullName: 'representativeName',
    academicPosition: 'position', phoneNumber: 'phone',
  } as const
  for (const message of error.details) {
    const field = accountNames.find((name) => new RegExp(`^${name}\\b`, 'i').test(message))
    if (field) fields[field] = message
    for (const [name, target] of Object.entries(organizationNames)) {
      if (new RegExp(`^${name}\\b`, 'i').test(message)) organization[target] = message
    }
  }
  return { fields, organization }
}
