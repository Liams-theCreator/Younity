import { describe, expect, it } from 'vitest'
import { emptyDraft } from './model'
import { emptyOrganizationDetails } from './organizationDraft'
import { mapOrganizerPayload, mapStudentPayload } from './payload'
import { emptyPreferences } from './studentPreferences'

const student = { ...emptyDraft, firstName: ' Sara ', lastName: ' Test ', email: 'SARA@example.com', university: 'Other', customUniversity: ' Custom Institute ', password: 'Password1!' }

describe('AUTH-02 registration DTO mapping', () => {
  it('sends every selected interest with enum values and maps optional preferences', () => {
    const payload = mapStudentPayload(student, { discipline: 'Computer Science & AI', academicLevel: 'Master / Ingénieur', formats: 'Hybrid Events', interests: ['AI & Data Science', 'Robotics & Smart IoT'] })
    expect(payload).toEqual({ firstName: 'Sara', lastName: 'Test', email: 'sara@example.com', password: 'Password1!', university: 'Custom Institute', interests: ['AI_DATA', 'ROBOTICS_IOT'], academicField: 'COMPUTER_SCIENCE', studyLevel: 'MASTER', opportunityFormat: 'HYBRID' })
    expect(payload).not.toHaveProperty('confirmPassword')
    expect(payload).not.toHaveProperty('acceptedPolicies')
  })
  it('supports empty preferences and predefined universities', () => {
    expect(mapStudentPayload({ ...student, university: 'other' }, emptyPreferences).university).toBe('Custom Institute')
    expect(mapStudentPayload({ ...student, university: 'University A' }, emptyPreferences)).toEqual(expect.objectContaining({ university: 'University A', interests: [] }))
  })
  it('omits unsupported customType and fabricated proof URL', () => {
    const payload = mapOrganizerPayload(student, { ...emptyOrganizationDetails, organizationName: ' Club ', category: 'OTHER', customCategory: ' Research Network ', representativeName: ' Sara   El Amrani ', position: ' Director ', phone: ' +212612345678 ' })
    expect(payload).toEqual({ firstName: 'Sara', lastName: 'El Amrani', email: 'sara@example.com', password: 'Password1!', organizationName: 'Club', type: 'OTHER', representativeFullName: 'Sara El Amrani', academicPosition: 'Director', phoneNumber: '+212612345678' })
    expect(payload).not.toHaveProperty('document')
    expect(payload).not.toHaveProperty('customType')
    expect(payload).not.toHaveProperty('proofUrl')
  })
})
