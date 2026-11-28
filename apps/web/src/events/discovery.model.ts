export const formats = ['IN_PERSON', 'ONLINE', 'HYBRID'] as const
export type EventFormat = typeof formats[number]
export type Availability = 'OPEN' | 'FULL' | 'CLOSED'
export type Category = { id: string; name: string; slug: string }
export type EventSummary = {
  id: string
  title: string
  organization: { id: string; name: string }
  startDate: string
  endDate: string
  format: EventFormat
  location: string | null
  categories: Category[]
  registrationMode: 'AUTOMATIC' | 'EXTERNAL'
  registrationDeadline: string | null
  availability: Availability
}
export type EventDetail = EventSummary & {
  description: string
  externalRegistrationUrl: string | null
}
export type EventResults = {
  items: EventSummary[]
  categories: Category[]
  page: number
  pageSize: number
  total: number
}
export type Booking = { id: string; status: 'CONFIRMED' | 'CANCELLED' } | null

export class EventsError extends Error {
  readonly kind: 'unavailable' | 'not-found' | 'session' | 'forbidden'
  constructor(kind: EventsError['kind']) {
    super({
      unavailable: 'Could not load this information. Please try again.',
      'not-found': 'This event is unavailable or no longer published.',
      session: 'Sign in again to check your booking.',
      forbidden: 'Your account cannot access this booking.',
    }[kind])
    this.kind = kind
  }
}

export const formatLabels: Record<EventFormat, string> = {
  IN_PERSON: 'In person', ONLINE: 'Online', HYBRID: 'Hybrid',
}
export function eventDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value))
}
