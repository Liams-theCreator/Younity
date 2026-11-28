import { describe, expect, it, vi } from 'vitest'
import { emptyEvent, type EventContext } from './model'
import { organizerEventService as service, organizerEventRules } from './service'
import { validateEvent } from './validation'

const id = '00000000-0000-4000-8000-000000000001'
const categoryId = '00000000-0000-4000-8000-000000000002'
const values = {
  ...emptyEvent, title: 'Campus meetup', description: 'Student talks', format: 'ONLINE' as const,
  registrationMode: 'AUTOMATIC' as const, onlineUrl: 'https://example.test/meet',
  startDate: '2027-06-10T14:00', endDate: '2027-06-10T16:00',
  registrationDeadline: '2027-06-09T18:00', capacity: '120', categoryIds: [categoryId],
}
const event = {
  id, title: values.title, description: values.description, format: values.format,
  registrationMode: values.registrationMode, categoryIds: [categoryId],
  startDate: new Date(values.startDate).toISOString(), endDate: new Date(values.endDate).toISOString(),
  registrationDeadline: new Date(values.registrationDeadline).toISOString(),
  capacity: 120, location: null, onlineUrl: values.onlineUrl, imageUrl: null,
  externalRegistrationUrl: null, status: 'DRAFT', updatedAt: '2026-11-26T10:30:00Z',
}
function context(body: unknown = event, status = 200) {
  const request = vi.fn<typeof fetch>().mockImplementation(async () => Response.json(body, { status }))
  return { request, signal: new AbortController().signal } satisfies EventContext
}

describe('S3-01 event adapter from PR 21', () => {
  it('creates a draft with ISO dates, numeric capacity, nullable optional fields and no UI-only fields', async () => {
    const ctx = context()
    const saved = await service.saveDraft!({ values: { ...values, room: '101', campus: 'Campus' } }, ctx)
    const [path, options] = ctx.request.mock.calls[0]
    expect(path).toBe('/api/organizer-events')
    expect(options).toMatchObject({ method: 'POST', credentials: 'include', cache: 'no-store', signal: ctx.signal })
    expect(JSON.parse(options!.body as string)).toEqual({
      title: values.title, description: values.description, format: 'ONLINE', registrationMode: 'AUTOMATIC',
      startDate: event.startDate, endDate: event.endDate, registrationDeadline: event.registrationDeadline,
      capacity: 120, categoryIds: [categoryId], location: null, onlineUrl: values.onlineUrl,
      imageUrl: null, externalRegistrationUrl: null,
    })
    expect(saved.values.startDate).toBe(values.startDate)
    expect(saved.values.capacity).toBe('120')
    expect(saved.values.categoryIds).toEqual([categoryId])
  })
  it('patches the existing identity and explicitly clears nullable fields/categories', async () => {
    const ctx = context({ ...event, categoryIds: [], capacity: null, imageUrl: null })
    await service.saveDraft!({ id, values: { ...values, categoryIds: [], capacity: '', imageUrl: '' } }, ctx)
    expect(ctx.request.mock.calls[0][0]).toBe(`/api/organizer-events/${id}`)
    expect(ctx.request.mock.calls[0][1]?.method).toBe('PATCH')
    expect(JSON.parse(ctx.request.mock.calls[0][1]!.body as string)).toMatchObject({ categoryIds: [], capacity: null, imageUrl: null })
  })
  it('loads draft data and preserves seconds and milliseconds through the local-date mapping', async () => {
    const startDate = '2027-06-10T14:00:25.125Z'
    const ctx = context({ ...event, startDate })
    const saved = await service.draft!(id, ctx)
    expect(new Date(saved.values.startDate).toISOString()).toBe(startDate)
  })
  it('direct-publishes completed new forms and bodylessly publishes saved drafts without a second writer', async () => {
    const ctx = context({ ...event, status: 'PUBLISHED' })
    await expect(service.publish!({ values }, ctx)).resolves.toEqual({ message: 'Event published.' })
    expect(ctx.request.mock.calls[0][0]).toBe('/api/organizer-events/publish')
    ctx.request.mockClear()
    await service.publish!({ id, values }, ctx)
    expect(ctx.request).toHaveBeenCalledTimes(1)
    expect(ctx.request.mock.calls[0][0]).toBe(`/api/organizer-events/${id}/publish`)
    expect(ctx.request.mock.calls[0][1]).toMatchObject({ method: 'POST' })
    expect(ctx.request.mock.calls[0][1]?.body).toBeUndefined()
  })
  it('rejects incomplete new drafts before any request', async () => {
    const ctx = context()
    await expect(service.saveDraft!({ values: emptyEvent }, ctx)).rejects.toMatchObject({ kind: 'validation', fields: { title: expect.any(String), startDate: expect.any(String) } })
    expect(ctx.request).not.toHaveBeenCalled()
  })
  it('matches publication and storage bounds from the API', () => {
    expect(validateEvent({ ...values, startDate: '2020-01-01T10:00', registrationDeadline: '', capacity: '2147483648', format: 'HYBRID', location: 'x'.repeat(501), onlineUrl: 'https://example.test/' + 'x'.repeat(500) }, 'publish', organizerEventRules)).toMatchObject({ startDate: expect.any(String), registrationDeadline: expect.any(String), capacity: expect.any(String), location: expect.any(String), onlineUrl: expect.any(String) })
    expect(validateEvent({ ...values, registrationMode: 'EXTERNAL', registrationDeadline: 'invalid' }, 'draft', organizerEventRules)).toHaveProperty('registrationDeadline')
  })
  it.each([[403, 'forbidden'], [404, 'not-found'], [409, 'conflict'], [500, 'unavailable']])('maps HTTP %s and never retries writes', async (status, kind) => {
    const ctx = context({}, status as number)
    await expect(service.saveDraft!({ values }, ctx)).rejects.toMatchObject({ kind })
    expect(ctx.request).toHaveBeenCalledTimes(1)
  })
  it('maps Nest field validation responses', async () => {
    const ctx = context({ message: ['categoryIds contains an unknown category', 'title must be a string'] }, 400)
    await expect(service.saveDraft!({ values }, ctx)).rejects.toMatchObject({ kind: 'validation', fields: { categoryIds: expect.any(String), title: expect.any(String) } })
  })
  it('rejects a malformed successful write and a response with the wrong identity', async () => {
    await expect(service.saveDraft!({ values }, context({}))).rejects.toBeInstanceOf(Error)
    await expect(service.saveDraft!({ id, values }, context({ ...event, id: categoryId }))).rejects.toMatchObject({ kind: 'unavailable' })
  })
  it('loads the verified public catalog contract and rejects malformed IDs', async () => {
    const ctx = context({ categories: [{ id: categoryId, name: 'Technology', slug: 'technology' }] })
    await expect(service.categories!(ctx)).resolves.toEqual([{ id: categoryId, label: 'Technology' }])
    expect(ctx.request.mock.calls[0][0]).toBe('/api/categories')
    const invalid = context({ categories: [{ id: 'invalid', name: 'Technology' }] })
    await expect(service.categories!(invalid)).rejects.toMatchObject({ kind: 'unavailable' })
  })
  it('honors cancellation before a write starts', async () => {
    const ctx = context()
    const controller = new AbortController()
    controller.abort()
    await expect(service.saveDraft!({ values }, { ...ctx, signal: controller.signal })).rejects.toBeInstanceOf(Error)
    expect(ctx.request).not.toHaveBeenCalled()
  })
})

it('uploads a banner as multipart form data through the protected transport', async () => {
  const ctx = context({ url: 'https://localhost:8443/api/organizer-event-images/banner.png' })
  const file = new File(['image'], 'banner.png', { type: 'image/png' })
  await expect(service.uploadBanner!(file, ctx)).resolves.toEqual({ url: 'https://localhost:8443/api/organizer-event-images/banner.png' })
  const [path, options] = ctx.request.mock.calls[0]
  expect(path).toBe('/api/organizer-event-images')
  expect(options).toMatchObject({ method: 'POST', credentials: 'include', signal: ctx.signal })
  expect(options?.headers).toBeUndefined()
  expect(options?.body).toBeInstanceOf(FormData)
  expect((options?.body as FormData).get('file')).toBe(file)
})
