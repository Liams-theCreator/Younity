import { describe, expect, it, vi } from 'vitest'
import { registerOrganizer, registerStudent, REGISTRATION_UNAVAILABLE } from './service'
import { mapStudentPayload, mapOrganizerPayload } from './payload'
import { emptyDraft } from './model'
import { emptyPreferences } from './studentPreferences'
import { emptyOrganizationDetails } from './organizationDraft'

const student = mapStudentPayload({ ...emptyDraft, firstName: 'Sara', lastName: 'Test', email: 'sara@example.test', university: 'University' }, emptyPreferences)
const organizer = mapOrganizerPayload({ ...emptyDraft, email: student.email }, { ...emptyOrganizationDetails, representativeName: 'Sara Test' })

describe('registration HTTP boundary', () => {
  it.each([
    ['student', student, registerStudent], ['organizer', organizer, registerOrganizer],
  ] as const)('posts a real %s request with cookies, JSON and cancellation', async (kind, payload, register) => {
    const signal = new AbortController().signal
    const request = vi.fn().mockResolvedValue(Response.json({ id: 'created-user', email: payload.email }, { status: 201 }))
    await register(payload as typeof student & typeof organizer, signal, request)
    expect(request).toHaveBeenCalledOnce()
    expect(request).toHaveBeenCalledWith(`/api/auth/register/${kind}`, { method: 'POST', credentials: 'include', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  })
  it('handles duplicate email and field validation separately', async () => {
    await expect(registerStudent(student, new AbortController().signal, vi.fn().mockResolvedValue(Response.json({}, { status: 409 })))).rejects.toMatchObject({ status: 409, message: expect.stringContaining('already registered'), details: ['email is already registered'] })
    await expect(registerStudent(student, new AbortController().signal, vi.fn().mockResolvedValue(Response.json({ message: ['email must be an email', 'password is too long'] }, { status: 400 })))).rejects.toMatchObject({ status: 400, details: ['email must be an email', 'password is too long'] })
  })
  it('does not accept an HTML fallback or mismatched account as confirmed registration', async () => {
    for (const response of [new Response('<html>Vite fallback</html>'), Response.json({ id: 1, email: 'another@example.test' })]) {
      await expect(registerStudent(student, new AbortController().signal, vi.fn().mockResolvedValue(response))).rejects.toThrow('could not be verified')
    }
  })
  it('reports network uncertainty and server failure without inventing success', async () => {
    await expect(registerStudent(student, new AbortController().signal, vi.fn().mockRejectedValue(new TypeError('network')))).rejects.toThrow('Unable to confirm registration')
    await expect(registerStudent(student, new AbortController().signal, vi.fn().mockResolvedValue(new Response(null, { status: 500 })))).rejects.toThrow(REGISTRATION_UNAVAILABLE)
  })
  it('does not start an aborted registration', async () => {
    const controller = new AbortController(); controller.abort()
    const request = vi.fn()
    await expect(registerStudent(student, controller.signal, request)).rejects.toMatchObject({ name: 'AbortError' })
    expect(request).not.toHaveBeenCalled()
  })
})
