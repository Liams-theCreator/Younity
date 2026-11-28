# S3-03 student reservations and organizer participants

Owner Aadel · Reviewer Said · Branch `feat/student-reservations`

S3-10 supporting contribution: Oussama implements the optional organizer
`eventId` filter, focused checks and this response documentation. Aadel agreed
the slice on 2026-11-27, confirmed no other implementation owner for the filter,
and retains ownership of the endpoint. The supporting PR targets
`feat/student-reservations` and requests Aadel's review; retarget to `main` if
S3-03 merges first. This slice preserves the booking lifecycle rules below.

## Proposed mutation contract for team review

Use `POST /api/events/:eventId/my-booking` to reserve and
`DELETE /api/events/:eventId/my-booking` to cancel. Both use the session
identity and return the same booking envelope as the S3-07 GET. Cancellation
keeps the row for the organizer's cancelled tab. Neither mutation requires a body.

| Open decision | Behavior in this implementation for review |
| --- | --- |
| Rebooking | A cancelled row stays cancelled; reserve returns 409. Rebooking needs agreement on lifecycle and what the organizer's cancelled history should show. |
| Conflicting reservations | Enforce the student/event unique constraint. Overlapping times are allowed while the team confirms the intended conflict rule. |
| FULL and capacity | A persisted FULL event is readable and cancellable, but closed to new reservations. On PUBLISHED events, compute availability from confirmed registrations. Null capacity is unlimited. Booking writes leave event status unchanged. |
| Duplicate requests | Reserve with any existing row returns 409. Repeated cancellation of a cancelled row returns 409 while registration is open. |
| S3-08 | Ownership and scope of Smail's backend contribution are pending team agreement. |

## HTTP endpoints

| Method and path | Success |
| --- | --- |
| `GET /api/events/:eventId/my-booking` | 200, `{"booking":null}` or `{"booking":{"id":"<uuid>","status":"CONFIRMED"}}` (also supports `CANCELLED`) |
| `POST /api/events/:eventId/my-booking` | 201, booking envelope with `CONFIRMED` |
| `DELETE /api/events/:eventId/my-booking` | 200, same booking ID with `CANCELLED` |
| `GET /api/organizer/bookings?status=CONFIRMED&page=1&pageSize=20` | 200, participant collection |

All four routes use the `access_token` session cookie and return
`Cache-Control: no-store` on success. The student routes require a verified
ACTIVE account with role STUDENT and the existing onboarding requirement of
two distinct interests. Each request uses the signed-in student's ID. Booking
reads resolve PUBLISHED and FULL events and return only the student's own
CONFIRMED or CANCELLED row. A read returns `booking: null` if there is no row in
those statuses. Read access does not depend on an open deadline. Mutations
require AUTOMATIC registration and a non-null deadline strictly after the
server time evaluated after taking the event lock. Cancellation only changes
an existing CONFIRMED row.

Organizer reads require a verified ACTIVE ORGANIZER with exactly one owned
organization in APPROVED state, per the existing JWT strategy and roles guard.
Both the rows and total require the session user to be the event creator and
the owner of its approved organization, matching the S3-01 event API. Session
eligibility is looked up on each request. The UI's approval acknowledgement
remains a frontend step, separate from this API's existing organizer policy.

### Participant query and response

- `status` is required and case-sensitive. Use `CONFIRMED` or `CANCELLED`.
- `eventId` is optional. Omit it to retain the existing all-events read. Supply
  one UUID to restrict both `items` and `total` to that event, still combined
  with status and all organizer ownership/approved-organization checks.
  Empty, malformed or repeated values receive 400. A missing event, an event
  belonging to another organizer, or an accessible event without matching
  bookings returns the same empty collection; the filter does not disclose
  whether an inaccessible event exists.
- `page` is a one-based decimal integer. Default 1, maximum
  9,007,199,254,740,991. `pageSize` defaults to 20 and accepts 1–100.
  Fractions, scientific notation, leading zeroes, repeated parameters and
  unknown parameters receive 400.
- Sort order is `registeredAt` descending, then `id` ascending. `total` counts
  rows in that status across the selected accessible event, or all events the
  organizer can manage when `eventId` is omitted.
  An out-of-range page returns empty items with the actual total and requested
  page. An empty collection has total zero.

Confirmed

```json
{
  "items": [{
    "id": "11111111-1111-4111-8111-111111111111",
    "eventId": "22222222-2222-4222-8222-222222222222",
    "eventTitle": "Campus workshop",
    "participantName": "Student Name",
    "email": "student@example.com",
    "registeredAt": "2027-01-10T10:00:00.000Z",
    "status": "CONFIRMED",
    "cancellationReason": null
  }],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

Cancelled after the student cancels the same registration

```json
{
  "items": [{
    "id": "11111111-1111-4111-8111-111111111111",
    "eventId": "22222222-2222-4222-8222-222222222222",
    "eventTitle": "Campus workshop",
    "participantName": "Student Name",
    "email": "student@example.com",
    "registeredAt": "2027-01-10T10:00:00.000Z",
    "status": "CANCELLED",
    "cancellationReason": null
  }],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

Empty

```json
{"items":[],"page":1,"pageSize":20,"total":0}
```

`registeredAt` is the original booking time in ISO 8601 UTC. The attendee
name is the current first and last name, and the email is the current account
email. `cancellationReason` is a nullable stored string. This cancellation
route leaves it unset. The API omits `ticketCode`, `cancelledAt`, and
`updatedAt`; the schema has no dedicated cancellation timestamp.

### S3-09 callback

For an event-specific consumer, include `eventId` in the query and reset page
when changing the selected event. The response envelope, item fields and
pagination mapping below stay the same. Omitting the filter keeps existing
frontend requests compatible. No event selector is added by this backend slice.

```http
GET /api/organizer/bookings?status=CONFIRMED&eventId=22222222-2222-4222-8222-222222222222&page=1&pageSize=20
```

For an accessible matching event, the confirmed/cancelled response examples
above apply with every item restricted to that event and `total` counting only
the selected status for it. For an unknown or inaccessible UUID, the empty
example applies with HTTP 200. For a malformed filter:

```json
{"statusCode":400,"message":["eventId must be a UUID"],"error":"Bad Request"}
```

Implement `bookings({ status, page }, { request, signal })` in the events
adapter using the supplied protected `request` and `signal`. Send the selected
`status` and omit `page` for a null input. Use one fixed page size for the
tab. Map each item to `Booking` using the fields above (the UI currently has
no use for `eventId`). Omit the optional ticket and cancellation time so the
table renders a dash. Derive navigation from the HTTP response:

```ts
const last = Math.ceil(total / pageSize)
return {
  items,
  previousPage: total > 0 && page > 1 ? String(Math.min(page - 1, last)) : null,
  nextPage: page < last ? String(page + 1) : null,
  label: `Page ${page}`,
}
```

A previous-page token jumps back to the last available page if the collection
shrinks while browsing. The tab change resets pagination via the existing
screen. Search remains local to the current page. Pass HTTP failures into the
existing adapter error flow and let the protected transport handle session
expiry.

### Errors

String exception messages use
`{"statusCode":<status>,"message":"<message>","error":"<HTTP label>"}`.
Validation errors use an array for `message` on the collection route. Within
that array, multiple invalid inputs can produce multiple messages.

| HTTP | Body or message |
| --- | --- |
| 400 Bad Request | Invalid event ID gives `Validation failed (uuid is expected)`. |
| 400 Bad Request | Organizer `eventId` filter is empty, malformed or repeated: `eventId must be a UUID` in the validation message array. |
| 400 Bad Request | Invalid organizer query uses messages from the DTO, such as `status must be one of the following values: CONFIRMED, CANCELLED`, `page must be an integer number`, `page must not be less than 1`, `page must not be greater than 9007199254740991`, and the corresponding `pageSize` messages with bounds 1–100. An extra field such as `ownerId` gives `property ownerId should not exist`. |
| 401 Unauthorized | `{"statusCode":401,"message":"Unauthorized"}` for an absent, invalid or expired session. |
| 403 Forbidden | `Forbidden resource` for role/account authorization denied by the roles guard. The organizer fallback on a student route gets `{"statusCode":403,"message":"Forbidden"}`. |
| 403 Forbidden | `Account suspended` or `Complete student onboarding before managing bookings`. |
| 403 Forbidden | Unverified account gives `{"code":"EMAIL_NOT_VERIFIED","message":"Verify your email before signing in."}`. |
| 404 Not Found | Student route gives `Event not found` for hidden/missing events or `Booking not found` when cancelling with no own booking. |
| 409 Conflict | Student mutation gives `Event uses external registration`, `Registration is closed`, `Booking already exists`, `Only confirmed bookings can be cancelled`, `Event is full`, or `Booking changed concurrently. Reload and try again`. |
| 500 Internal Server Error | `{"statusCode":500,"message":"Internal server error"}` for unexpected server/database failures. |

Organizer collection examples

```json
{"statusCode":400,"message":["status must be one of the following values: CONFIRMED, CANCELLED"],"error":"Bad Request"}
```

```json
{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}
```

## PostgreSQL consistency

Reserve and cancel take a parameterized `SELECT ... FOR UPDATE` lock on the
same event row within a READ COMMITTED transaction. Reads after lock acquisition
see the prior committed booking changes. Confirmed capacity is counted inside
that transaction before insertion. A committed cancellation removes the row
from the confirmed count. PostgreSQL rolls back and releases the lock if a
check or write fails. The existing student/event unique constraint is a second
duplicate guard. Prisma unique and write-conflict errors map to 409.

Current event writers create an event or update/publish a DRAFT. Updates to
the existing event row use PostgreSQL row locks and the S3-01 writer's draft
predicate. There are currently no other application registration writers.
Future writers that create, cancel or otherwise change confirmed occupancy
must acquire the same event lock before checking capacity or changing
registration state. Organizer reads use REPEATABLE READ so the count and
page use the same database snapshot. The data can change between requests.

## Local setup

Start the stack with `./run.sh --watch`. Use a local verified, approved ACTIVE
organizer and a local verified ACTIVE student with two distinct interests.
Set `ORGANIZER_LOGIN_JSON` and `STUDENT_LOGIN_JSON` to paths of private local
files containing each account's email and password. Set `EVENT_PUBLISH_JSON` to
a payload for an AUTOMATIC event with a future registration deadline and a
seeded category ID. See the [API setup and publication examples](../apps/api/README.md).

```sh
BASE=https://localhost:8443/api
umask 077
curl -ksS -c organizer.cookies -H 'Content-Type: application/json' \
  --data-binary "@$ORGANIZER_LOGIN_JSON" "$BASE/auth/login"
curl -ksS -c student.cookies -H 'Content-Type: application/json' \
  --data-binary "@$STUDENT_LOGIN_JSON" "$BASE/auth/login"

# Copy the returned id into EVENT_ID before running the booking calls.
curl -ki -b organizer.cookies -H 'Content-Type: application/json' \
  --data-binary "@$EVENT_PUBLISH_JSON" "$BASE/organizer-events/publish"

curl -ki -b student.cookies "$BASE/events/$EVENT_ID/my-booking"
curl -ki -b student.cookies -X POST "$BASE/events/$EVENT_ID/my-booking"
curl -ki -b organizer.cookies \
  "$BASE/organizer/bookings?status=CONFIRMED&page=1&pageSize=20"
# Optional S3-10 event filter; omission retains the all-events collection.
curl -ki -b organizer.cookies \
  "$BASE/organizer/bookings?status=CONFIRMED&eventId=$EVENT_ID&page=1&pageSize=20"
curl -ki -b student.cookies -X DELETE "$BASE/events/$EVENT_ID/my-booking"
curl -ki -b organizer.cookies "$BASE/organizer/bookings?status=CANCELLED"
curl -ki -b student.cookies "$BASE/organizer/bookings?status=CONFIRMED"
```

Use `-k` only for the local dev certificate. Repeat the organizer read with an
independent organizer cookie jar to check ownership isolation.

For tests, provision a fresh isolated PostgreSQL database named
`younity_s303_test`. Export `TEST_DATABASE_URL` pointing to that database
before running the commands. The E2E suite creates and deletes fixture rows and
the booking rollback test adds and removes a test constraint.

```sh
cd apps/api
: "${TEST_DATABASE_URL:?Set the isolated _test database URL}"
export DATABASE_URL="$TEST_DATABASE_URL"
export NODE_ENV=test FRONTEND_ORIGIN=https://localhost:8443
export JWT_SECRET="$(openssl rand -hex 48)"
npm ci
npm run db:setup
npm run test:e2e -- bookings
npm run lint
npm test
npm run test:e2e
npm run build
```

S3-08 adds a PostgreSQL regression case to the booking suite. It reserves a
place through the API, moves the stored deadline into the past, and verifies
that cancellation returns `409` while the same confirmed booking remains
readable.

## Integration status

The `feat/student-reservations` branch is based on `origin/main`
`309087a` with [PR #21](https://github.com/Liams-theCreator/Younity/pull/21) merged. [PR #22](https://github.com/Liams-theCreator/Younity/pull/22) is on
`origin/feat/s3-02-connect-save-publish-events` at merge commit `637b7c7`.
That branch supplies the S3-09 callback and UI. The organizer adapter is the
remaining UI integration step. Smail's discovery branch supplies the S3-07
booking read shape, and its discovery UI and public category/event endpoints
remain separate integration work.

## Verification

PostgreSQL 17.12 ran on an isolated loopback instance with database
`younity_s303_test`. All seven migrations and the category seed succeeded.
API lint and build passed, all 257 unit/controller tests passed, the focused
booking suite passed all 11 tests, and the complete E2E suite passed 172 tests.
One existing SMTP delivery test was skipped because its opt-in flag was unset.

### S3-10 filter verification (2026-11-27)

All seven migrations and the category seed ran successfully against an isolated
PostgreSQL 17 database named `younity_s310_test`. The focused booking HTTP/DB suite
passes all 15 tests, including:

- Omitted filter preserving the all-events response, and valid UUID/uppercase UUID reads.
- Confirmed and cancelled event-specific rows and totals, stable tie ordering,
  page boundaries and unchanged safe response fields.
- Empty, malformed and repeated filter values returning the documented 400.
- Unknown, empty, other-organizer and mismatched creator/organization events
  returning the same empty 200 collection for both statuses.
- Filtered requests retaining session/organizer guards and approval revocation behavior.
- The optional UUID query appearing in Swagger and successful responses keeping no-store.

Use the isolated test database environment shown above, then run
`npm run test:e2e -- bookings`, `npm run lint`, `npm test` and `npm run build`.
The existing booking rollback test deliberately logs a PostgreSQL constraint
exception while asserting HTTP 500 and successful rollback.

API lint/build and all 257 unit/controller tests pass. The focused suite cleaned
up all fixture users, events and registrations. No schema migration, response
field or frontend change is required for this optional filter.
