import {
  EventUiError, emptyEvent,
  type BookingPage, type OrganizerDashboard, type EventContext, type EventDraft, type EventServices, type EventValues, type FieldErrors,
} from './model'
import { safeImageUrl, validateEvent } from './validation'

// Abdellah's S3-01 API, PR #21 at 615926a. All event writes go through this adapter.
const base = '/api/organizer-events'
export const organizerEventRules = {
  titleMaxLength: 255,
  categoryRequired: true,
  automaticDeadlineRequired: true,
  draftCoreRequired: true,
  futureStartRequired: true,
  capacityMax: 2147483647,
  urlMaxLength: 500,
  locationMaxLength: 500,
}
const uuidPattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new EventUiError('unavailable')
  return value as Record<string, unknown>
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw new EventUiError('unavailable')
  return value
}
function nullableText(value: unknown): string {
  return value === null ? '' : text(value)
}
function uuid(value: unknown): string {
  const id = text(value)
  if (!uuidPattern.test(id)) throw new EventUiError('unavailable')
  return id
}
function isoDate(value: unknown): string {
  const result = text(value)
  if (!Number.isFinite(Date.parse(result))) throw new EventUiError('unavailable')
  return result
}
function localDate(value: unknown): string {
  const date = new Date(isoDate(value))
  const pad = (part: number) => String(part).padStart(2, '0')
  const minute = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  const milliseconds = date.getMilliseconds() ? `.${String(date.getMilliseconds()).padStart(3, '0')}` : ''
  return date.getSeconds() || date.getMilliseconds() ? `${minute}:${pad(date.getSeconds())}${milliseconds}` : minute
}
function parseEvent(value: unknown, expectedStatus: 'DRAFT' | 'PUBLISHED'): EventDraft {
  const event = record(value)
  if (event.status !== expectedStatus) throw new EventUiError('conflict')
  if (!['IN_PERSON', 'ONLINE', 'HYBRID'].includes(text(event.format)) ||
      !['AUTOMATIC', 'EXTERNAL'].includes(text(event.registrationMode)) ||
      !Array.isArray(event.categoryIds) ||
      (event.capacity !== null && (!Number.isInteger(event.capacity) || Number(event.capacity) < 1 || Number(event.capacity) > 2147483647))) {
    throw new EventUiError('unavailable')
  }
  const categoryIds = event.categoryIds.map(uuid)
  if (new Set(categoryIds.map(id => id.toLowerCase())).size !== categoryIds.length) throw new EventUiError('unavailable')
  return {
    id: uuid(event.id), updatedAt: isoDate(event.updatedAt),
    values: {
      ...emptyEvent,
      title: text(event.title), description: text(event.description),
      format: event.format as EventValues['format'],
      registrationMode: event.registrationMode as EventValues['registrationMode'],
      categoryIds, startDate: localDate(event.startDate), endDate: localDate(event.endDate),
      registrationDeadline: event.registrationDeadline === null ? '' : localDate(event.registrationDeadline),
      location: nullableText(event.location), onlineUrl: nullableText(event.onlineUrl),
      externalRegistrationUrl: nullableText(event.externalRegistrationUrl), imageUrl: nullableText(event.imageUrl),
      capacity: event.capacity === null ? '' : String(event.capacity),
    },
  }
}
function payload(values: EventValues, intent: 'draft' | 'publish') {
  const errors = validateEvent(values, intent, organizerEventRules)
  if (values.categoryIds.some(id => !uuidPattern.test(id)) ||
      new Set(values.categoryIds.map(id => id.toLowerCase())).size !== values.categoryIds.length) {
    errors.categoryIds = 'Choose distinct categories from the catalog.'
  }
  if (Object.values(errors).some(Boolean)) throw new EventUiError('validation', errors)
  return {
    title: values.title.trim(), description: values.description.trim(),
    format: values.format, registrationMode: values.registrationMode,
    startDate: new Date(values.startDate).toISOString(), endDate: new Date(values.endDate).toISOString(),
    categoryIds: values.categoryIds,
    location: values.format === 'ONLINE' ? null : values.location.trim() || null,
    onlineUrl: values.format === 'IN_PERSON' ? null : values.onlineUrl.trim() || null,
    imageUrl: values.imageUrl.trim() || null,
    capacity: values.capacity ? Number(values.capacity) : null,
    registrationDeadline: values.registrationDeadline ? new Date(values.registrationDeadline).toISOString() : null,
    externalRegistrationUrl: values.registrationMode === 'EXTERNAL' ? values.externalRegistrationUrl.trim() || null : null,
  }
}
async function json(response: Response): Promise<unknown> {
  try { return await response.json() } catch { throw new EventUiError('unavailable') }
}
async function response(path: string, context: EventContext, options?: RequestInit) {
  context.signal.throwIfAborted()
  const result = await context.request(path, {
    ...options, credentials: 'include', cache: 'no-store', signal: context.signal,
  })
  if (result.ok) return result
  if (result.status === 403) throw new EventUiError('forbidden')
  if (result.status === 404) throw new EventUiError('not-found')
  if (result.status === 409 || result.status === 412) throw new EventUiError('conflict')
  if (result.status === 400 || result.status === 422) {
    const data = record(await json(result))
    const messages = Array.isArray(data.message) ? data.message : [data.message]
    const fields: FieldErrors = {}
    for (const message of messages) {
      if (typeof message !== 'string') continue
      const field = Object.keys(emptyEvent).find(key => message.startsWith(`${key} `)) as keyof EventValues | undefined
      if (field) fields[field] = message
    }
    throw new EventUiError('validation', fields)
  }
  // The protected transport owns 401. A failed/unknown write is never retried.
  throw new EventUiError('unavailable')
}
function eventPath(id: string) {
  if (!uuidPattern.test(id)) throw new EventUiError('not-found')
  return `${base}/${encodeURIComponent(id)}`
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new EventUiError('unavailable')
  return value
}
function rows(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new EventUiError('unavailable')
  return value
}
const bookingPageSize = 20
function bookingPage(value: unknown, status: 'CONFIRMED' | 'CANCELLED', requestedPage: number): BookingPage {
  const data = record(value)
  const page = count(data.page)
  const pageSize = count(data.pageSize)
  const total = count(data.total)
  if (page !== requestedPage || pageSize !== bookingPageSize) throw new EventUiError('unavailable')
  const last = Math.ceil(total / pageSize)
  const items = rows(data.items).map(value => {
    const item = record(value)
    if (item.status !== status) throw new EventUiError('unavailable')
    uuid(item.eventId)
    return {
      id: uuid(item.id), eventTitle: text(item.eventTitle), participantName: text(item.participantName),
      email: text(item.email), registeredAt: isoDate(item.registeredAt), status,
      cancellationReason: item.cancellationReason === null ? null : text(item.cancellationReason),
    }
  })
  const expectedCount = page <= last ? Math.min(pageSize, total - (page - 1) * pageSize) : 0
  if (items.length !== expectedCount || new Set(items.map(item => item.id.toLowerCase())).size !== items.length) {
    throw new EventUiError('unavailable')
  }
  return {
    items,
    previousPage: total > 0 && page > 1 ? String(Math.min(page - 1, last)) : null,
    nextPage: page < last ? String(page + 1) : null,
    label: `Page ${page}`,
  }
}
function format(value: unknown): Exclude<EventValues['format'], ''> {
  if (value !== 'IN_PERSON' && value !== 'ONLINE' && value !== 'HYBRID') throw new EventUiError('unavailable')
  return value
}
function dashboard(value: unknown): OrganizerDashboard {
  const data = record(value)
  const metrics = record(data.metrics)
  const utilization = metrics.capacityUtilization
  if (utilization !== null && (typeof utilization !== 'number' || !Number.isFinite(utilization) || utilization < 0)) throw new EventUiError('unavailable')
  return {
    organizationName: text(data.organizationName), organizerName: text(data.organizerName),
    metrics: {
      activeEvents: count(metrics.activeEvents), confirmedBookings: count(metrics.confirmedBookings),
      draftCount: count(metrics.draftCount), capacityUtilization: utilization,
    },
    upcomingEvents: rows(data.upcomingEvents).map(value => {
      const event = record(value)
      return {
        id: uuid(event.id), title: text(event.title), startDate: isoDate(event.startDate), endDate: isoDate(event.endDate),
        format: format(event.format), location: nullableText(event.location) || null, imageUrl: nullableText(event.imageUrl) || null,
        capacity: event.capacity === null ? null : count(event.capacity), confirmedCount: count(event.confirmedCount),
      }
    }),
    drafts: rows(data.drafts).map(value => {
      const draft = record(value)
      return { id: uuid(draft.id), title: text(draft.title), startDate: draft.startDate === null ? null : isoDate(draft.startDate), updatedAt: isoDate(draft.updatedAt), format: format(draft.format), location: nullableText(draft.location) || null }
    }),
    recentBookings: rows(data.recentBookings).map(value => {
      const booking = record(value)
      if (booking.status !== 'CONFIRMED' && booking.status !== 'CANCELLED') throw new EventUiError('unavailable')
      return { id: uuid(booking.id), participantName: text(booking.participantName), eventTitle: text(booking.eventTitle), status: booking.status, updatedAt: isoDate(booking.updatedAt) }
    }),
  }
}
export const organizerEventService: EventServices = {
  registrationMode: 'AUTOMATIC',
  rules: organizerEventRules,
  venueDetails: false,
  publishSavedOnly: true,
  async dashboard(context) {
    return dashboard(await json(await response('/api/organizer-dashboard', context)))
  },
  async bookings({ status, page }, context) {
    if ((status !== 'CONFIRMED' && status !== 'CANCELLED') ||
        (page !== null && (!/^[1-9]\d*$/.test(page) || !Number.isSafeInteger(Number(page))))) {
      throw new EventUiError('unavailable')
    }
    const query = new URLSearchParams({ status, pageSize: String(bookingPageSize) })
    if (page !== null) query.set('page', page)
    return bookingPage(await json(await response(`/api/organizer/bookings?${query}`, context)), status, page === null ? 1 : Number(page))
  },
  async uploadBanner(file, context) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      throw new EventUiError('validation', { imageUrl: 'Choose a PNG, JPG or WebP image up to 5 MB.' })
    }
    const body = new FormData()
    body.append('file', file)
    const result = record(await json(await response('/api/organizer-event-images', context, { method: 'POST', body })))
    const url = text(result.url)
    if (!safeImageUrl(url) || url.length > organizerEventRules.urlMaxLength) throw new EventUiError('unavailable')
    return { url }
  },
  async categories(context) {
    // Public catalog supplied by the discovery branch. No fixed category IDs.
    const data = record(await json(await response('/api/categories', context)))
    if (!Array.isArray(data.categories)) throw new EventUiError('unavailable')
    const categories = data.categories.map(value => {
      const category = record(value)
      return { id: uuid(category.id), label: text(category.name) }
    })
    if (new Set(categories.map(category => category.id.toLowerCase())).size !== categories.length) throw new EventUiError('unavailable')
    return categories
  },
  async draft(id, context) {
    const draft = parseEvent(await json(await response(eventPath(id), context)), 'DRAFT')
    if (draft.id.toLowerCase() !== id.toLowerCase()) throw new EventUiError('unavailable')
    return draft
  },
  async saveDraft(input, context) {
    const saved = parseEvent(await json(await response(input.id ? eventPath(input.id) : base, context, {
      method: input.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload(input.values, 'draft')),
    })), 'DRAFT')
    if (input.id && saved.id.toLowerCase() !== input.id.toLowerCase()) throw new EventUiError('unavailable')
    return saved
  },
  async publish(input, context) {
    // Existing drafts publish their saved snapshot. The editor requires an explicit
    // save first when dirty, so publishing never performs an implicit PATCH.
    const options = input.id
      ? { method: 'POST' }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload(input.values, 'publish')) }
    const saved = parseEvent(await json(await response(input.id ? `${eventPath(input.id)}/publish` : `${base}/publish`, context, options)), 'PUBLISHED')
    if (input.id && saved.id.toLowerCase() !== input.id.toLowerCase()) throw new EventUiError('unavailable')
    return { message: 'Event published.' }
  },
}
