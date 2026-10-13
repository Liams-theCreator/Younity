export type RegistrationDraft = {
  firstName: string
  university?: string
  lastName?: string
  email: string
  password: string
  confirmPassword: string
  acceptedPolicies: boolean
}
export type FieldErrors = Partial<Record<keyof RegistrationDraft, string>>
export type AccountType = 'student' | 'organizer'
export const emptyDraft: RegistrationDraft = {
  firstName: '',
  email: '',
  password: '',
  confirmPassword: '',
  acceptedPolicies: false,
}
export const accountFields = ['firstName', 'email', 'password', 'confirmPassword'] as const
export const studentAccountFields = [
  'firstName',
  'lastName',
  'email',
  'password',
  'confirmPassword',
] as const
export type StudentRegistrationDraft = RegistrationDraft & { lastName: string; university: string }

export function validateDraft(draft: RegistrationDraft, includePolicies = true): FieldErrors {
  const errors: FieldErrors = {}
  if (!draft.firstName.trim()) errors.firstName = 'Enter your first name.'
  if (!draft.email.trim()) errors.email = 'Enter your email address.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()))
    errors.email = 'Enter a valid email address.'
  for (const field of ['firstName', 'lastName'] as const) {
    if ((draft[field]?.length ?? 0) > 100) errors[field] = 'Use at most 100 characters.'
  }
  if (draft.email.length > 255) errors.email = 'Use at most 255 characters.'
  if (!draft.password) errors.password = 'Enter a password.'
  if (!draft.confirmPassword) errors.confirmPassword = 'Confirm your password.'
  else if (draft.password !== draft.confirmPassword)
    errors.confirmPassword = 'Passwords must match.'
  if (includePolicies && !draft.acceptedPolicies)
    errors.acceptedPolicies = 'Accept the Terms and Privacy Policy to continue.'
  return errors
}

export function validateStudentDraft(draft: StudentRegistrationDraft): FieldErrors {
  const errors = validateDraft(draft)
  if (!draft.university.trim()) errors.university = 'Enter your university.'
  else if (draft.university.length > 255) errors.university = 'Use at most 255 characters.'
  if (!draft.lastName.trim()) errors.lastName = 'Enter your last name.'
  return errors
}
