# S3-07: event discovery integration

Status: proposal for Said, Aadel and Smail; these endpoints are not implemented yet.

## Scope and ownership

- Smail: public event list/detail pages, request states and current booking display (S3-07).
- Said: discovery API and the agreed filter integration slice (S3-05/S3-06).
- Aadel: reservation/cancellation API and action integration (S3-03/S3-04).
- S3-08: Smail's bounded backend contribution; agree ownership with Aadel before coding.
- Oussama reviews S3-07. Reserve/cancel components must have one implementation owner.

## Proposed interfaces

| Method and path | Purpose | Response |
| --- | --- | --- |
| GET /api/events | Public discovery | `{ items, categories, page, pageSize, total }` |
| GET /api/events/:eventId | Public event details | `{ event }`; 404 when not publicly available |
| GET /api/events/:eventId/my-booking | Eligible student's own booking | `{ booking: null }` or `{ booking: { id, status } }` |

Proposed list query: `q`, `category`, `city`, `format`, `from`, `to`, `page`, `pageSize`.
`category` is a category slug; `format` is IN_PERSON, ONLINE or HYBRID.
`from` and `to` are YYYY-MM-DD; proposed start-date boundaries are inclusive UTC calendar days.
`page` starts at 1. Frontend requests pageSize=12. Backend must validate and cap pagination.
The top-level categories array is the full public filter catalog, including on empty pages.
Backend applies search/filters and personalization before pagination; frontend preserves order.
Public endpoints accept anonymous requests; authenticated cookies optionally personalize results.

Public summaries need ID, title, organizer name, start/end dates, format, public location,
categories, registration mode, registration deadline and an availability indicator.
Details add description and the external registration URL when applicable.
Use ISO 8601 timestamps with an explicit timezone. Never return `onlineUrl` publicly.
Booking reads use authenticated identity, not a client-supplied student ID.
Only a successful response with `booking: null` means no booking; request failures show retry.

## Rules from YP-06 and YP-07

- Visitors browse without signing in. Browsing and external links never create a Younity booking.
- Only eligible students get Younity booking actions; organizers can browse.
- Search and filters combine and can be cleared. Empty results offer clear filters.
- Matching student interests rank first within filtered results; other events remain visible.
- Proposed non-personalized ordering: nearest upcoming first; PO confirmation still needed.
- Drafts and unpublished events stay private. Agree how FULL/COMPLETED/CANCELLED states
  appear publicly; do not accidentally hide a full published event that must display as full.
- Automatic booking/cancellation uses the explicit deadline, with no event-start fallback.
- No booking emails, waiting list, payments or participant approval in this scope.
- Tickets belong to YP-08 and are not a promised S3-07 deliverable.

## Integration decisions before implementation

- Define city storage/filter behavior: current Event has `location`, but no `city` field.
- Map saved `StudentProfile.interests` enum values to event category IDs/slugs.
- Completed students keep the existing /student/dashboard URL, now containing discovery.
  /events and /events/:eventId are public. Preferences remain accessible.
- Agree booking response/status values and reserve/cancel component ownership with Aadel.
- Correct S3-02's dependency: event form is S3-09, not S3-04.
- Include loading, empty, error/retry, unavailable-event and booking-status-unknown states.
- Final completion requires real API/database journeys, mobile/keyboard checks and reviewed CI.

## Proposed detail response example

```json
{
  "event": {
    "id": "event-uuid",
    "title": "Campus AI meetup",
    "organization": { "id": "organization-uuid", "name": "Campus Club" },
    "startDate": "2027-01-12T10:00:00Z",
    "endDate": "2027-01-12T12:00:00Z",
    "format": "HYBRID",
    "location": "Rabat campus",
    "categories": [{ "id": "category-uuid", "name": "AI & Data", "slug": "ai-data" }],
    "registrationMode": "AUTOMATIC",
    "registrationDeadline": "2027-01-11T18:00:00Z",
    "availability": "OPEN",
    "description": "Meet students and build something together.",
    "externalRegistrationUrl": null
  }
}
```

List items contain the same fields except description and externalRegistrationUrl.
List/detail schemas must never include onlineUrl or private participant information.
Availability values: OPEN, FULL, CLOSED; backend computes these from authoritative state/deadline/capacity.
External details require an absolute http/https externalRegistrationUrl; automatic details use null.
Do not substitute the protected joining link for that URL. Send explicit null for absent optional fields.
Booking response: `{ "booking": null }` or
`{ "booking": { "id": "booking-uuid", "status": "CONFIRMED" } }`; CANCELLED is also supported.
Only verified ACTIVE students with completed onboarding can read their own booking.
Use 401 for absent/expired authentication, 403 for ineligible accounts, 404 for unavailable events,
400 for invalid filters, and 5xx for server failure. A booking error never means no booking.

## Implementation and verification

- Frontend model, request mapping and response validation live under apps/web/src/events.
- No backend endpoint, database migration, reserve/cancel mutation or ticket UI is added here.
- Service uses the existing cookie API client; booking reads use AuthProvider.requestProtected.
- Requests abort on navigation/filter changes; stale results and old-account booking state are discarded.
- Component/service tests use fixtures; they do not prove integration with Said/Aadel's APIs.
- Before marking S3-07 Done, verify public visibility, filters/order and current booking status with
  real APIs/database, then obtain reviewer approval and passing CI.
