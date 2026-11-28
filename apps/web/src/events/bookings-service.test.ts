import { describe, expect, it, vi } from 'vitest'
import type { EventContext } from './model'
import { organizerEventService as service } from './service'

const item = {
  id: '11111111-1111-4111-8111-111111111111',
  eventId: '22222222-2222-4222-8222-222222222222',
  eventTitle: 'Campus workshop', participantName: 'Student Name', email: 'student@example.test',
  registeredAt: '2027-01-10T10:00:00.000Z', status: 'CONFIRMED', cancellationReason: null,
}
function context(body: unknown, status = 200) {
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status }))
  return { request, signal: new AbortController().signal } satisfies EventContext
}
const envelope = { items: [item], page: 1, pageSize: 20, total: 1 }

describe('Aadel’s S3-03 organizer booking contract', () => {
  it('uses the protected request with cancellation and maps confirmed rows without inventing ticket or cancellation data', async () => {
    const ctx = context({ ...envelope, items: [{ ...item, ticketCode: 'unagreed', cancelledAt: '2027-01-11T10:00:00Z' }] })
    const result = await service.bookings!({ status: 'CONFIRMED', page: null }, ctx)
    const [path, options] = ctx.request.mock.calls[0]
    const url = new URL(String(path), 'https://example.test')
    expect(url.pathname).toBe('/api/organizer/bookings')
    expect(Object.fromEntries(url.searchParams)).toEqual({ status: 'CONFIRMED', pageSize: '20' })
    expect(options).toMatchObject({ credentials: 'include', cache: 'no-store', signal: ctx.signal })
    expect(result).toEqual({
      items: [{ id: item.id, eventTitle: item.eventTitle, participantName: item.participantName,
        email: item.email, registeredAt: item.registeredAt, status: 'CONFIRMED', cancellationReason: null }],
      previousPage: null, nextPage: null, label: 'Page 1',
    })
  })
  it('maps cancellation reasons and a supplied page', async () => {
    const ctx = context({ ...envelope, page: 2, total: 21, items: [{ ...item, status: 'CANCELLED', cancellationReason: 'Unable to attend.' }] })
    expect(await service.bookings!({ status: 'CANCELLED', page: '2' }, ctx)).toMatchObject({
      items: [{ status: 'CANCELLED', cancellationReason: 'Unable to attend.' }],
      previousPage: '1', nextPage: null, label: 'Page 2',
    })
    expect(new URL(String(ctx.request.mock.calls[0][0]), 'https://example.test').searchParams.get('page')).toBe('2')
  })
  it('exposes the next page and preserves server order', async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ ...item, id: `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`, participantName: `Attendee ${i}` }))
    const result = await service.bookings!({ status: 'CONFIRMED', page: null }, context({ ...envelope, items, total: 21 }))
    expect(result.nextPage).toBe('2')
    expect(result.items.map(row => row.participantName)).toEqual(items.map(row => row.participantName))
  })
  it.each([
    [1, 0, null], [3, 21, '2'], [Number.MAX_SAFE_INTEGER, 1, '1'], [4, 0, null],
  ])('handles empty/out-of-range page %s with total %s', async (page, total, previousPage) => {
    await expect(service.bookings!({ status: 'CONFIRMED', page: String(page) }, context({ items: [], page, pageSize: 20, total })))
      .resolves.toEqual({ items: [], previousPage, nextPage: null, label: `Page ${page}` })
  })
  it.each(['0', '-1', '01', '1.5', '1e2', '9007199254740992', '1&ownerId=other'])('rejects invalid page %s before reading', async page => {
    const ctx = context(envelope)
    await expect(service.bookings!({ status: 'CONFIRMED', page }, ctx)).rejects.toMatchObject({ kind: 'unavailable' })
    expect(ctx.request).not.toHaveBeenCalled()
  })
  it.each([
    { ...envelope, total: -1 }, { ...envelope, total: 1.5 }, { ...envelope, total: '1' },
    { ...envelope, page: 2 }, { ...envelope, pageSize: 0 }, { ...envelope, pageSize: 101 },
    { ...envelope, items: [] }, { ...envelope, items: [item, item], total: 2 },
    ...[
      { status: 'CANCELLED' }, { status: 'PENDING' }, { id: 'invalid' }, { eventId: 'invalid' },
      { email: null }, { participantName: null }, { registeredAt: 'invalid' }, { cancellationReason: undefined },
    ].map(change => ({ ...envelope, items: [{ ...item, ...change }] })),
  ])('rejects malformed or contradictory successful responses %#', async body => {
    await expect(service.bookings!({ status: 'CONFIRMED', page: null }, context(body))).rejects.toMatchObject({ kind: 'unavailable' })
  })
  it.each([[400, 'validation'], [401, 'unavailable'], [403, 'forbidden'], [500, 'unavailable']])('propagates HTTP %s without treating it as an empty list or retrying', async (status, kind) => {
    const ctx = context({ message: 'Request failed' }, status as number)
    await expect(service.bookings!({ status: 'CONFIRMED', page: null }, ctx)).rejects.toMatchObject({ kind })
    expect(ctx.request).toHaveBeenCalledTimes(1)
  })
  it('does not start an aborted request or swallow network failures', async () => {
    const ctx = context(envelope)
    const controller = new AbortController()
    controller.abort()
    await expect(service.bookings!({ status: 'CONFIRMED', page: null }, { ...ctx, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(ctx.request).not.toHaveBeenCalled()
    ctx.request.mockRejectedValue(new TypeError('offline'))
    await expect(service.bookings!({ status: 'CONFIRMED', page: null }, ctx)).rejects.toThrow('offline')
  })
})
