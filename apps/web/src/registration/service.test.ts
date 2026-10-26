import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptyDraft } from './model'
import { emptyOrganizationDetails } from './organizationDraft'
import { mockRegisterOrganizer, registerOrganizer, registerStudent, REGISTRATION_UNAVAILABLE } from './service'

const input = { account: emptyDraft, organization: emptyOrganizationDetails, document: null }

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('registration integration boundary', () => {
  it('rejects production organizer submission without pretending success', async () => {
    vi.stubEnv('DEV', false)
    await expect(registerOrganizer(input, new AbortController().signal)).rejects.toThrow(REGISTRATION_UNAVAILABLE)
  })

  it('leaves student registration unavailable until the real API is connected', async () => {
    await expect(registerStudent({ ...emptyDraft, lastName: '', university: '' }, new AbortController().signal))
      .rejects.toThrow(REGISTRATION_UNAVAILABLE)
  })

  it('resolves the development mock only after its full delay', async () => {
    vi.useFakeTimers()
    const resolved = vi.fn()
    const request = mockRegisterOrganizer(new AbortController().signal).then(resolved)
    await vi.advanceTimersByTimeAsync(1499)
    expect(resolved).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await request
    expect(resolved).toHaveBeenCalledWith('pending')
  })

  it('cancels the mock and clears its timer when the component leaves', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const request = mockRegisterOrganizer(controller.signal)
    const rejection = expect(request).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await rejection
    expect(vi.getTimerCount()).toBe(0)
  })
})
