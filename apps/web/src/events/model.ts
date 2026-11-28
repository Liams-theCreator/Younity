// Frontend view models only. S3-01/S3-03 must supply adapters and final rules;
// these types do not define HTTP routes, request bodies or response contracts.
export type EventFormat = '' | 'IN_PERSON' | 'ONLINE' | 'HYBRID'
export type RegistrationMode = '' | 'AUTOMATIC' | 'EXTERNAL'
export type EventValues = {
  title: string
  description: string
  categoryIds: string[]
  format: EventFormat
  location: string
  onlineUrl: string
  startDate: string
  endDate: string
  registrationDeadline: string
  capacity: string
  registrationMode: RegistrationMode
  externalRegistrationUrl: string
  imageUrl: string
  // Optional UI venue details; final persistence mapping belongs to S3-01.
  room?: string
  campus?: string
}
export const emptyEvent: EventValues = {
  title: '',
  description: '',
  categoryIds: [],
  format: '',
  location: '',
  onlineUrl: '',
  startDate: '',
  endDate: '',
  registrationDeadline: '',
  capacity: '',
  registrationMode: '',
  externalRegistrationUrl: '',
  imageUrl: '',
  room: '',
  campus: '',
}
export type EventField = keyof EventValues
export type FieldErrors = Partial<Record<EventField, string>>
export type EventRules = {
  titleMaxLength: number
  descriptionMaxLength?: number
  categoryRequired: boolean
  automaticDeadlineRequired: boolean
  draftCoreRequired?: boolean
  futureStartRequired?: boolean
  capacityMax?: number
  urlMaxLength?: number
  locationMaxLength?: number
}
// Bounds/options reflect the current Prisma schema, not a final publish policy.
export const baselineRules: EventRules = {
  titleMaxLength: 255,
  categoryRequired: false,
  automaticDeadlineRequired: false,
}
export type CategoryOption = { id: string; label: string }
export type DraftSummary = {
  id: string
  title: string
  updatedAt: string
  startDate: string | null
  format: EventFormat
  // Optional presentation data; adapters map only fields supplied by the API.
  imageUrl?: string | null
  location?: string | null
}
export type EventDraft = { id: string; values: EventValues; updatedAt: string }
export type Booking = {
  id: string
  eventTitle: string
  participantName: string
  email: string
  registeredAt: string
  status: 'CONFIRMED' | 'CANCELLED'
  cancellationReason: string | null
  // Optional display values from the owner's adapter, not a new HTTP contract.
  ticketCode?: string | null
  cancelledAt?: string | null
}
export type BookingPage = {
  items: Booking[]
  previousPage: string | null
  nextPage: string | null
  label: string
}
export type OrganizerDashboard = {
  organizationName: string
  organizerName: string
  metrics: { activeEvents: number; confirmedBookings: number; draftCount: number; capacityUtilization: number | null }
  upcomingEvents: {
    id: string; title: string; startDate: string; endDate: string; format: Exclude<EventFormat, ''>
    location: string | null; imageUrl: string | null; capacity: number | null; confirmedCount: number
  }[]
  drafts: DraftSummary[]
  recentBookings: { id: string; participantName: string; eventTitle: string; status: 'CONFIRMED' | 'CANCELLED'; updatedAt: string }[]
}
export type EventContext = { request: typeof fetch; signal: AbortSignal }
export type EventServices = {
  // Integration-owned setting for new events; the form does not expose a selector.
  registrationMode?: Exclude<RegistrationMode, ''>
  rules?: EventRules
  venueDetails?: boolean
  publishSavedOnly?: boolean
  dashboard?: (context: EventContext) => Promise<OrganizerDashboard>
  categories?: (context: EventContext) => Promise<CategoryOption[]>
  campuses?: CategoryOption[]
  // Owner-supplied upload integration; this does not specify an HTTP endpoint.
  uploadBanner?: (file: File, context: EventContext) => Promise<{ url: string }>
  drafts?: (context: EventContext) => Promise<DraftSummary[]>
  draft?: (id: string, context: EventContext) => Promise<EventDraft>
  // Abdellah owns implementation of these callbacks; no second write client.
  saveDraft?: (
    input: { id?: string; values: EventValues },
    context: EventContext,
  ) => Promise<EventDraft>
  publish?: (
    input: { id?: string; values: EventValues },
    context: EventContext,
  ) => Promise<{ message: string }>
  bookings?: (
    selection: { status: 'CONFIRMED' | 'CANCELLED'; page: string | null },
    context: EventContext,
  ) => Promise<BookingPage>
}
export const unavailableEventServices: EventServices = {}
export class EventUiError extends Error {
  readonly kind: 'unavailable' | 'forbidden' | 'not-found' | 'validation' | 'conflict'
  readonly fields: FieldErrors
  constructor(kind: EventUiError['kind'], fields: FieldErrors = {}) {
    super(
      {
        unavailable: 'This service is temporarily unavailable. Please try again later.',
        forbidden: 'You do not have permission to access this information.',
        'not-found': 'The requested information could not be found.',
        validation: 'Check the highlighted information and try again.',
        conflict: 'This draft changed. Reload the saved version before continuing.',
      }[kind],
    )
    this.name = 'EventUiError'
    this.kind = kind
    this.fields = fields
  }
}
export const formatLabels = { IN_PERSON: 'In person', ONLINE: 'Online', HYBRID: 'Hybrid' }
