import { describe, expect, it } from 'vitest'
import { emptyDraft } from './model'
import { emptyOrganizationDetails } from './organizationDraft'
import { mapOrganizerPayload, mapStudentPayload } from './payload'
import { emptyPreferences } from './studentPreferences'

const student = { ...emptyDraft, firstName: ' Sara ', lastName: ' Test ', email: 'SARA@example.com', university: 'Other', customUniversity: ' Custom Institute ', password: 'Password1!' }

describe('registration DTO payloads', () => {
  it('replaces Other with the custom institution and sends only the first interest enum', () => {
    const payload = mapStudentPayload(student, { ...emptyPreferences, interests: ['AI & Data Science', 'Robotics & Smart IoT'] })
    expect(payload).toEqual({ firstName: 'Sara', lastName: 'Test', email: 'sara@example.com', password: 'Password1!', university: 'Custom Institute', interests: 'AI_DATA' })
    expect(payload).not.toHaveProperty('confirmPassword')
    expect(payload).not.toHaveProperty('acceptedPolicies')
  })

  it('handles lowercase other, predefined institutions, and no selected interests', () => {
    expect(mapStudentPayload({ ...student, university: 'other' }, emptyPreferences).university).toBe('Custom Institute')
    const payload = mapStudentPayload({ ...student, university: 'University A' }, emptyPreferences)
    expect(payload.university).toBe('University A')
    expect(payload).not.toHaveProperty('interests')
  })

  it('splits names at the first space, maps organizer fields, and uses a URL instead of a File', () => {
    const payload = mapOrganizerPayload(student, {
      ...emptyOrganizationDetails, organizationName: ' Club ', category: 'other',
      customCategory: ' Research Network ', representativeName: '  Sara   El Amrani ',
      position: ' Director ', phone: ' +212612345678 ',
    }, new File(['proof'], 'proof.pdf'))
    expect(payload).toEqual({ firstName: 'Sara', lastName: 'El Amrani', email: 'sara@example.com', password: 'Password1!', organizationName: 'Club', type: 'OTHER', representativeFullName: 'Sara El Amrani', academicPosition: 'Director', phoneNumber: '+212612345678', customType: 'Research Network', proofUrl: 'https://mock-storage.com/proof.pdf' })
    expect(payload).not.toHaveProperty('document')
  })

  it('omits custom category and proof URL when they are not applicable', () => {
    const payload = mapOrganizerPayload(student, { ...emptyOrganizationDetails, category: 'UNIVERSITY', representativeName: 'Sara Test', customCategory: 'Stale value' }, null)
    expect(payload).not.toHaveProperty('customType')
    expect(payload).not.toHaveProperty('proofUrl')
  })
})
