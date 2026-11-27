# S3-10 — proposed organizer bookings event filter

Status: awaiting Said or Aadel's agreement before implementation.

Branch: `feat/s3-10-bookings-event-filter`, based on Aadel's S3-03 branch
`feat/student-reservations` at `2b3d8fb`.

## Proposed ownership agreement

Aadel retains sole ownership of `GET /api/organizer/bookings`. Oussama owns only
the optional event filter contribution and its focused checks/documentation.
Said reviews the backend change. Confirm that no other contributor, including
S3-08, is implementing this filter. Agree the PR target with Aadel.

No agreement was found in repository issues, current branch contracts or the
S3-09 follow-up discussion during preparation. Aadel's frontend handoff confirms
his existing participant endpoint; it does not assign this additional filter.

## Bounded contract proposal

```http
GET /api/organizer/bookings?status=CONFIRMED&eventId=<event-uuid>&page=1&pageSize=20
```

- Add one optional `eventId` query field. Omission preserves the current read.
- Accept a UUID; reject empty, malformed or repeated values with 400.
- Combine eventId with the existing status, authenticated event creator and
  approved organization ownership conditions in both row and count queries.
- Preserve response fields, sorting, pagination limits, no-store and the
  existing repeatable-read transaction.
- An unknown or inaccessible event returns an empty collection with total 0.
  The filter does not disclose another organizer's event existence.
- Do not change booking writes, capacity rules or event publication.

Existing response shape remains `{ items, page, pageSize, total }`. Confirmed
and cancelled examples remain those in `docs/s3-03-student-reservations.md`,
with every item restricted to the selected accessible event. Example empty
response for a valid UUID without matching accessible bookings:

```json
{"items":[],"page":1,"pageSize":20,"total":0}
```

The existing safe item fields remain id, eventId, eventTitle, participantName,
email, registeredAt, status and nullable cancellationReason. Ticket codes and
cancellation timestamps remain absent.

## Focused checks after agreement

1. HTTP query validation for omitted, valid, malformed, empty and repeated IDs.
2. Real isolated PostgreSQL fixtures with two owned events and a second
   organizer. Confirm row/count filtering for both statuses, pagination,
   unknown events, mismatched creator/organization and revoked approval.
3. Preserve unauthenticated 401 and unauthorized 403 behavior, safe selected
   fields, no-store and existing unfiltered responses.
4. Run the focused booking E2E suite, API lint and build. Document results and
   response/error examples, then request Said's review.

## Frontend handoff after agreement

Keep status mandatory. The frontend may supply eventId for a selected event and
omit it for all events. Changing event selection must reset pagination. Existing
BookingPage response mapping and error handling remain applicable. Agree the
frontend consumer and integration location with the team before extending UI.

## Confirmation message

> Hi Aadel, for S3-10, can I add an optional eventId UUID filter to your
> GET /api/organizer/bookings endpoint? You remain the endpoint owner; I own
> only this filter, its tests and documentation, with Said reviewing. Rows and
> totals keep all existing ownership checks, and the response stays unchanged.
> Please confirm no one else owns this filter and which branch my PR should target.

No endpoint code, tests or frontend integration has been changed by this proposal.
