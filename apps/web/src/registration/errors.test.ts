import { describe, expect, it } from 'vitest'
import { registrationFieldErrors } from './errors'
import { RegistrationError } from './service'

describe('real DTO validation messages', () => {
  it('maps default and custom human-readable messages to account and organization fields', () => {
    const result = registrationFieldErrors(new RegistrationError('Invalid details', 400, [
      'First name must contain a letter', 'Password must contain a lowercase letter',
      'phoneNumber must be a valid phone number', 'organizationName should not be empty',
    ]))
    expect(result.fields).toEqual({ firstName: 'First name must contain a letter', password: 'Password must contain a lowercase letter' })
    expect(result.organization).toEqual({ phone: 'phoneNumber must be a valid phone number', organizationName: 'organizationName should not be empty' })
  })
})
