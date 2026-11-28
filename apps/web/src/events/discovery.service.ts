import { apiRequest } from '../api/client'
import {
  EventsError, formats, type Category, type EventSummary,
  type EventDetail, type EventResults, type Booking,
} from './discovery.model'

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new EventsError('unavailable')
  return value as Record<string, unknown>
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new EventsError('unavailable')
  return value
}
function nullableText(value: unknown): string | null {
  return value === null ? null : text(value)
}
function date(value: unknown): string {
  const result = text(value)
  if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(result) || !Number.isFinite(Date.parse(result))) throw new EventsError('unavailable')
  return result
}
function integer(value: unknown, minimum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new EventsError('unavailable')
  return value
}
function category(value: unknown): Category {
  const row = object(value)
  return { id: text(row.id), name: text(row.name), slug: text(row.slug) }
}
function categories(value: unknown): Category[] {
  if (!Array.isArray(value)) throw new EventsError('unavailable')
  return value.map(category)
}
function summary(value: unknown): EventSummary {
  const row = object(value), organization = object(row.organization)
  if (!formats.includes(row.format as EventSummary['format']) ||
      !['AUTOMATIC', 'EXTERNAL'].includes(String(row.registrationMode)) ||
      !['OPEN', 'FULL', 'CLOSED'].includes(String(row.availability))) throw new EventsError('unavailable')
  const startDate = date(row.startDate), endDate = date(row.endDate)
  const registrationDeadline = row.registrationDeadline === null ? null : date(row.registrationDeadline)
  const tags = categories(row.categories)
  if (Date.parse(endDate) <= Date.parse(startDate) || tags.length === 0 ||
      (row.registrationMode === 'AUTOMATIC' && registrationDeadline === null &&
        row.availability !== 'CLOSED')) throw new EventsError('unavailable')
  // Whitelist public properties. onlineUrl and unknown private fields never reach views.
  return {
    id: text(row.id), title: text(row.title),
    organization: { id: text(organization.id), name: text(organization.name) },
    startDate, endDate, format: row.format as EventSummary['format'],
    location: nullableText(row.location), categories: tags,
    registrationMode: row.registrationMode as EventSummary['registrationMode'],
    registrationDeadline, availability: row.availability as EventSummary['availability'],
  }
}
function externalUrl(value: unknown): string {
  const result = text(value)
  let url: URL
  try { url = new URL(result) } catch { throw new EventsError('unavailable') }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new EventsError('unavailable')
  return url.href
}
async function read(path: string, signal: AbortSignal, request = apiRequest): Promise<unknown> {
  try {
    const response = await request(path, { method: 'GET', cache: 'no-store', credentials: 'include', signal })
    if (response.status === 404) throw new EventsError('not-found')
    if (response.status === 401) throw new EventsError('session')
    if (response.status === 403) throw new EventsError('forbidden')
    if (!response.ok) throw new EventsError('unavailable')
    return await response.json()
  } catch (cause) {
    if (signal.aborted || cause instanceof EventsError) throw cause
    throw new EventsError('unavailable')
  }
}
export function discoveryQuery(params: URLSearchParams): URLSearchParams {
  const query = new URLSearchParams()
  for (const key of ['q', 'category', 'format']) {
    const value = params.get(key)?.trim()
    if (value) query.set(key, value)
  }
  const page = Number(params.get('page') ?? 1)
  query.set('page', Number.isSafeInteger(page) && page > 0 ? String(page) : '1')
  query.set('pageSize', '12')
  return query
}
export async function getEvents(query: string, signal: AbortSignal): Promise<EventResults> {
  const row = object(await read(`/api/events?${query}`, signal))
  if (!Array.isArray(row.items)) throw new EventsError('unavailable')
  const page = integer(row.page, 1), pageSize = integer(row.pageSize, 1), total = integer(row.total, 0)
  if (row.items.length > pageSize || row.items.length > total) throw new EventsError('unavailable')
  return { items: row.items.map(summary), categories: categories(row.categories), page, pageSize, total }
}
export async function getCategories(signal: AbortSignal): Promise<Category[]> {
  const row = object(await read('/api/categories', signal))
  return categories(row.categories)
}
export async function getEvent(id: string, signal: AbortSignal): Promise<EventDetail> {
  const row = object(object(await read(`/api/events/${encodeURIComponent(id)}`, signal)).event)
  return {
    ...summary(row), description: text(row.description),
    externalRegistrationUrl: row.registrationMode === 'EXTERNAL' ? externalUrl(row.externalRegistrationUrl) : null,
  }
}
export async function getMyBooking(id: string, signal: AbortSignal, request: typeof fetch): Promise<Booking> {
  const row = object(await read(`/api/events/${encodeURIComponent(id)}/my-booking`, signal, request))
  if (row.booking === null) return null
  const booking = object(row.booking)
  if (booking.status !== 'CONFIRMED' && booking.status !== 'CANCELLED') throw new EventsError('unavailable')
  return { id: text(booking.id), status: booking.status }
}
