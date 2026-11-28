# S3-09 — real organizer booking integration

Owner: Oussama. Frontend reviewer: Smail. Backend owner: Aadel; reviewer: Said.
Branch: `fix/s3-09-bookings-adapter`. Base: `feat/s3-02-connect-save-publish-events`
at `42f35d4`. Date: 2026-11-27.

## Contract and ownership

The frontend uses Aadel's S3-03 implementation at `2b3d8fb` on
[`feat/student-reservations`](https://github.com/Liams-theCreator/Younity/tree/feat/student-reservations).
The authoritative contract, response/error examples and backend setup are in
[Aadel's handoff](https://github.com/Liams-theCreator/Younity/blob/2b3d8fb/docs/s3-03-student-reservations.md).

`GET /api/organizer/bookings?status=CONFIRMED&pageSize=20` returns
`{ items, page, pageSize, total }`. `status` is required and accepts CONFIRMED or
CANCELLED. A null frontend page omits the query parameter so the API defaults to
1; later pages send an explicit positive safe integer. The adapter always uses
pageSize 20, the protected cookie transport, no-store and the caller's AbortSignal.

Each item maps `id`, `eventTitle`, `participantName`, `email`, `registeredAt`,
`status` and nullable `cancellationReason`. `eventId` is validated but unused by
the current table. Ticket codes and cancellation timestamps are absent, so their
existing dash fallbacks remain. No value is inferred from another timestamp.

The adapter validates page metadata, item counts, identities and selected status.
Malformed successes and failed requests show the existing error/retry state.
The protected transport retains session-expiry handling. No request is retried
automatically. The view keeps current-page search and server ordering.

Pagination follows Aadel's handoff. `nextPage` exists while page is below
ceil(total / pageSize). When results shrink, `previousPage` jumps back to the
last available page. Empty collections have neither navigation token.
Changing status resets page and search through the existing screen.

Aadel remains the sole participant endpoint owner. This follow-up changes no
booking backend or save/publish code. The earlier proposed S3-10 participant
endpoint is superseded. A different S3-10 supporting backend slice still requires
agreement with Said or Aadel. Said's review of booking lifecycle rules, including
persisted FULL events after cancellation, remains pending on Aadel's branch.

## Repeatable real API and browser check

Build a separate checkout/export of Aadel's backend. Install its dependencies,
generate Prisma, migrate and seed an explicit isolated PostgreSQL database whose
name ends in `_test`. Generate Prisma before seeding a fresh export.

Run from this branch's `apps/api` directory:

```sh
export TEST_DATABASE_URL='postgresql://USER:PASSWORD@127.0.0.1:PORT/younity_bookings_test'
export BOOKINGS_API_DIRECTORY='/path/to/aadel-checkout/apps/api'
# Use an installed Playwright package and Chromium. Optional overrides:
export BOOKINGS_PLAYWRIGHT_MODULE='/path/to/playwright/index.mjs'
export BOOKINGS_BROWSER_EXECUTABLE='/path/to/chromium'
node scripts/organizer-bookings-integration.mjs
```

The runner refuses the current API directory and non-test database names, starts
the separate backend and Vite on free ports, and uses an actual browser login.
No HTTP responses are intercepted. It creates isolated fixture accounts/events,
publishes via the real S3-01 endpoint, reserves/cancels via S3-03, and checks:

- Owner-scoped rows/totals, safe response fields and no-store.
- Anonymous 401, student 403 and invalid-query 400.
- Twenty-one confirmed bookings across two pages and the empty cancelled tab.
- A real cancellation appearing after refresh, with ticket/date dash fallbacks.
- Status changes resetting pagination, desktop/mobile rendering, and no browser exceptions.
- Approval revoked after login clearing the previously displayed participant rows.

The runner closes its processes/browser and removes its database fixtures in
`finally`. It writes sanitized results and screenshots to ignored
`.local/bookings-integration/`. An isolated test database is still required.

## Verification

Frontend lint/build and all 416 frontend tests passed; 9 opt-in integration tests
were skipped. Aadel's focused booking E2E suite passed all 11 tests against
PostgreSQL 17. The backend's intentional rollback test logs an expected database
constraint exception while passing. The API build and all seven migrations passed.

The real API/browser runner passed every check above against the pinned S3-03
backend. Desktop and mobile screenshots were inspected. Its result is recorded
in `.local/bookings-integration/results.json`. Cleanup left zero fixture users,
events or registrations in the isolated database.

Full S3-09 acceptance still requires deployment/integration of the S3-03 backend,
the category and draft-list dependencies, registration-mode agreement and review.
