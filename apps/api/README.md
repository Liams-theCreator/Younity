# Younity API

NestJS, TypeScript ES modules, Prisma 7, and PostgreSQL. The API includes
authentication, email verification, student preferences and administrator
application reads. See the sections below for contracts and integration status.

## Organizer event drafts and publishing

These routes require an active, email-verified ORGANIZER session with one approved
organization. Ownership comes from the session.

- `POST /api/organizer-events` creates an event with status `DRAFT` and returns it
  with HTTP 201.
- `GET /api/organizer-events/:id` returns the organizer's saved event with HTTP 200
  and `Cache-Control: no-store`.
- `PATCH /api/organizer-events/:id` saves partial changes to a draft and returns
  the updated event with HTTP 200. Omitted fields are preserved; nullable fields
  can be cleared with `null`. For `categoryIds`, omission preserves the saved
  selection, `[]` clears it, and a supplied list replaces it atomically with the
  event changes. `categoryIds: null` is invalid.
- `POST /api/organizer-events/publish` accepts a completed form and creates an
  event directly with status `PUBLISHED`, returning the event with HTTP 201.
- `POST /api/organizer-events/:id/publish` publishes the persisted draft and
  returns the same event with HTTP 200. No request body is needed; save form edits
  with PATCH before publishing.

Creation requires `title`, `description`, `format` (`IN_PERSON`, `ONLINE`, or
`HYBRID`), `startDate`, `endDate`, and `registrationMode` (`AUTOMATIC` or
`EXTERNAL`), matching the existing database requirements. Optional fields are
`location`, `onlineUrl`, `imageUrl`, `registrationDeadline`, `capacity`, and
`externalRegistrationUrl`, plus `categoryIds` (an array of distinct category UUIDs).
Every supplied ID must exist in the category catalog. Malformed, duplicate
(case-insensitive), or unknown IDs return 400 before saving any changes. Drafts
may omit categories or save an empty array. All five routes return the existing
event fields plus `categoryIds`, including `[]` when no links are saved; GET thus
restores the React selection. Category order is not guaranteed.
Dates use ISO 8601; the end must follow the start, and
the registration deadline must not follow the start. Capacity must be a positive
integer. Unknown fields, including ownership and status fields, are rejected.

Both publish routes validate the complete event, require a future `startDate`,
and enforce format and registration requirements: in-person events need
`location`, online events need `onlineUrl`, hybrid events need both, and external
registration needs a valid HTTP(S) `externalRegistrationUrl`. AUTOMATIC registration
requires an explicit `registrationDeadline`; the API never substitutes `startDate`.
The existing deadline date-order rule applies whenever a deadline is supplied,
including EXTERNAL events. EXTERNAL events may omit the deadline.
Direct publish requires at least one existing category in the request; saved-draft
publish requires at least one persisted category link. An invalid direct publish
creates no event; a rejected saved-draft publish leaves it DRAFT and unchanged.
Image and capacity remain optional. Deadlines remain optional when saving drafts.
Incomplete drafts may still be saved through the draft
routes, provided the core database fields are present. Successful publication
sets `PUBLISHED` directly.

Malformed UUIDs or invalid bodies return 400. Missing events and events owned by
another organizer return 404. Editing or publishing a non-draft event (including
a repeated publish), or a draft changed during the save/publication, returns 409.
Reload after a conflict. Saving a draft does not publish it. Direct publication
creates a new event on every successful request; use the saved-draft route when
publishing an existing draft.

### S3-09 handoff and example payloads

Checked Oussama's `S3-09_Event-creation-participants` at `18a6aa0`:
`apps/web/src/events/model.ts` uses `categoryIds: string[]`; its view models are
explicitly not HTTP DTOs. The adapter should set
`rules: { titleMaxLength: 255, categoryRequired: true, automaticDeadlineRequired: true }`.
These last two rules apply to publication; the API preserves the six core draft
fields above. The UI currently permits more incomplete drafts, so Oussama must
align draft feedback with these minimum fields before integration. Description
has no API maximum. For new events supply the agreed `service.registrationMode`;
the UI does not select a default. Convert local schedule values to ISO timestamps
with the intended timezone, capacity to a positive integer, and optional blank
fields to omission/null as appropriate. Do not send `room` or `campus` as separate
fields; their mapping into `location` remains a team decision.

Replace the category UUID below with an existing catalog ID from the target
database (the seed preserves IDs but does not assign portable fixed UUIDs). These
routes do not add a category-list endpoint; Oussama's `categories` callback still
needs an agreed catalog source. Use dates in the future when trying these examples.
Requests use the existing `access_token` session cookie.

Save a draft with `POST /api/organizer-events` (201); categories and deadline may
be omitted:

```json
{
  "title": "Campus technology meetup",
  "description": "Student talks and discussion",
  "format": "ONLINE",
  "startDate": "2027-06-10T10:00:00.000Z",
  "endDate": "2027-06-10T12:00:00.000Z",
  "registrationMode": "AUTOMATIC"
}
```

Edit the returned ID with `PATCH /api/organizer-events/:id` (200):

```json
{
  "onlineUrl": "https://example.com/meetup",
  "registrationDeadline": "2027-06-09T18:00:00.000Z",
  "categoryIds": ["a7495653-79c3-4fd2-98f5-84f92aa5e2da"]
}
```

`{"title":"Revised meetup"}` leaves categories alone; `{"categoryIds":[]}`
clears them and prevents publication until a valid selection is saved. Reload
with GET, then `POST /api/organizer-events/:id/publish` with no body (200).

Alternatively, direct publish with `POST /api/organizer-events/publish` (201):

```json
{
  "title": "Campus technology meetup",
  "description": "Student talks and discussion",
  "format": "ONLINE",
  "onlineUrl": "https://example.com/meetup",
  "startDate": "2027-06-10T10:00:00.000Z",
  "endDate": "2027-06-10T12:00:00.000Z",
  "registrationMode": "AUTOMATIC",
  "registrationDeadline": "2027-06-09T18:00:00.000Z",
  "categoryIds": ["a7495653-79c3-4fd2-98f5-84f92aa5e2da"]
}
```

For EXTERNAL, change `registrationMode` to `EXTERNAL`, omit the deadline if
unused, and include `"externalRegistrationUrl":"https://example.com/register"`.
For IN_PERSON supply `location`; HYBRID requires both `location` and `onlineUrl`.
Registration URLs keep their existing URL validation even on draft saves.

Student discovery is an **S3-05 integration dependency**. A PUBLISHED response
and saved category links verify this writer; visibility/filtering in student
discovery must be verified separately after S3-05 integration. S3-01 does not add
discovery, draft listing, media uploads, or participant APIs.

Focused checks from `apps/api`:

```bash
npm test -- organizer-events
npm run lint
npm run build
# After db:setup on an explicit isolated *_test database, with both DB URLs set:
npm run test:e2e -- organizer-events
```

The focused database suite uses real JWT guards and Prisma to check direct
publish, draft/edit/reload/publish, category persistence, omission/replacement/
clearing, no writes on validation failure, external registration, concurrent
changes, and rejection of a different approved organizer. It does not exercise
the S3-09 browser adapter or S3-05 discovery.

Local verification and broader follow-up audit on 2026-11-25 (Node 22.23.2,
disposable PostgreSQL 17 and local Mailpit):

- `npm run db:setup`: all seven committed migrations applied; ten categories seeded.
- `npm test -- organizer-events`: 90 tests passed across controller/service suites.
- `npm test`: all 257 API unit/controller tests passed across 19 files.
- `npm run test:e2e`: all 162 database/HTTP tests passed across 11 files, with
  `EMAIL_VERIFICATION_SMTP_TEST=1`, SMTP directed to the disposable local Mailpit
  catcher, and no skipped tests. The follow-up used `younity_s301_audit_test`.
  No email was delivered externally.
- Organizer event database coverage now has 26 cases. It includes category-only
  PATCH invalidating stale edits/publication, simultaneous edit/edit,
  edit/publish and publish/publish against the same snapshot (one success and
  one 409), transaction rollback when PostgreSQL rejects category persistence,
  and denial of an existing JWT after approval revocation or suspension. Test
  read hooks coordinate races; guards and database operations remain real.
- `npm run lint`, `npm run build` (including Prisma generation), and
  `git diff --check`: passed. No schema migration was needed.
- `npm run prisma:validate`, `npm run db:status`, and the CI Prisma migration
  diff command: passed; migrations are current and no schema drift was detected.

No S3-01 functional failures were found in this audit; production code required
no further changes. Expected failed-email fixtures log errors. The full database
suite also emits an existing non-failing `pg` deprecation warning traced to
`@prisma/adapter-pg` transaction queries; dependency compatibility with a future
`pg` major version remains a separate maintenance item. Disposable test containers
and their database volume were removed after verification.

Hosted CI, S3-09 browser integration and S3-05 discovery were not run for this
change. Before Aadel's review, confirm the
category catalog source and S3-09 adapter mapping/validation described above;
student visibility remains dependent on S3-05 integration.

## Admin application reads (S2-06)

`GET /api/admin/applications` and `GET /api/admin/applications/:id` require an
ACTIVE, email-verified ADMIN session cookie. The list accepts `page` (default 1),
`limit` (default 20, maximum 100), and an optional exact review status. Responses
contain explicit review fields, use `Cache-Control: no-store`, and are documented
in Swagger. Unknown/ineligible detail IDs return 404; malformed inputs return 400.

See [S2-06 contract and acceptance](../../docs/s2-06-admin-read-api.md) for JSON
examples, eligibility, pagination and verification. The current schema treats
application rows as submitted and organization-only records as drafts. The final
S2-03 lifecycle storage handoff and Aadel's contract approval remain pending;
do not treat the existing timestamp default as a future draft-state rule.
These endpoints do not implement S2-09 decision writes.

## Full development stack

From the repository root, run `./run.sh`. It creates local configuration when absent, builds the containers, applies committed migrations, seeds the category catalog, waits for readiness, and returns your shell prompt with services running detached. Use `./run.sh --watch` for foreground source watching. The root README describes local certificate trust.

- API root: https://localhost/api/
- Database health: https://localhost/api/health
- Swagger UI: https://localhost/api/docs
- OpenAPI JSON: https://localhost/api/docs-json

Caddy preserves `/api`; Nest owns the prefix. Compose does not publish the API's internal port 3000.

## Host-side development

Select the Node version in the root `.nvmrc` using `nvm install` and `nvm use`. Start the database from the root:

```bash
docker compose up -d --wait db
```

From `apps/api`, copy `.env.example` to `.env` only if absent. Set `DATABASE_URL` using the root database credentials and `127.0.0.1:5432`, rather than the container-only hostname `db`. URL-encode special characters in credentials. Do not commit `.env` files.

```bash
npm ci
npm run prisma:generate
npm run db:setup
npm run start:dev
```

The host API is available at http://localhost:3000/api/. Use the full Compose stack for HTTPS. Host-side Vite proxies `/api` to this API.

## Configuration

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | Required PostgreSQL connection URL, including host and database |
| `NODE_ENV` | `development` (default), `test`, or `production` |
| `PORT` | Integer 1–65535; default 3000 |
| `CORS_ORIGINS` | Comma-separated exact HTTP(S) origins without paths or wildcards; development defaults to `https://localhost,http://localhost:5173`; required explicitly in production |
| `TEST_DATABASE_URL` | Explicit isolated database URL for end-to-end tests; never use an application database |
| `FRONTEND_ORIGIN` | Browser origin used in verification links, including the HTTPS port; Compose defaults to `https://localhost:8443` |
| `SMTP_HOST` / `SMTP_PORT` | Mail transport; Compose uses `mailpit:1025`, host development uses `127.0.0.1:1025` |
| `MAIL_FROM` | Verification email sender; defaults to `Younity <no-reply@younity.test>` |

Configuration is validated before application startup. All future request DTOs use the global transforming ValidationPipe, which rejects undeclared fields; DTOs must declare class-validator rules. Swagger documents the current endpoints. Health performs a real database query.

Registration creates an unverified account and returns `verificationEmailSent`.
The web app directs the user to `/verify-email`. A failed email send preserves the
account and returns `verificationEmailSent: false`, allowing recovery through
`POST /api/auth/resend-verification` with only `{ "email": "student@example.com" }` (no password). Successful
email requests have a 60-second per-account cooldown. Mailpit captures development
emails at http://localhost:8025; it does not deliver them to real inboxes.

Verification links expire after 10 minutes. The page asks the user to press
**Verify email**, then posts the token to
`POST /api/email-verification/verify-email`. Verification consumes all outstanding
links for that user. Login and existing JWT cookies require a verified email;
email verification does not approve an organizer's organization. Previously
created unverified accounts can use the resend form with only their email.

The public resend endpoint returns HTTP 200 and
`{"message":"If this address belongs to an account awaiting verification, check your inbox."}`
for unknown, already verified, suspended, cooldown-suppressed and eligible addresses,
including failed delivery. Invalid DTOs return 400; passwords are rejected as extra
fields. Only the registered address of an unverified, non-suspended account receives
mail. Failed sends remove their token so an immediate backend retry is possible.
PostgreSQL row locks preserve the 60-second account cooldown across API instances.
A separate per-process IP limiter allows 30 requests per minute and returns 429
with `Retry-After`, irrespective of account status. Only Caddy should be publicly
exposed: Express trusts one proxy hop for client IPs. Multiple API replicas should
also enforce an aggregate IP limit at the edge.

See [email verification changes](../../docs/email-verification-fix.md) for the full
change list, recovery behavior and checks.

## Database commands

Run from `apps/api`:

```bash
npm run prisma:validate
npm run prisma:generate
npm run db:migrate:dev -- --name describe_change
npm run db:migrate:deploy
npm run db:seed
npm run db:status
```

Use `migrate dev` only on isolated development databases; it uses a shadow database and may propose a reset. Review and commit migration SQL and `migration_lock.toml`. Use `migrate deploy` for committed migrations in CI and container startup. `db:setup` runs deploy then seed; it never resets the database.

Prisma 7 generation and seed execution are explicit. `npm run build` generates the client before compilation. Generated files in `src/generated/prisma` are ignored and must not be edited. The production entry point is `dist/main.js`.

The seed requires only `DATABASE_URL`; HTTP settings such as `PORT` and `CORS_ORIGINS` are validated separately when starting the application.

The seed inserts 10 categories inferred from the diagram's interest vocabulary, keyed by stable slugs. Repeated execution preserves existing records and identifiers; no user accounts or passwords are seeded. See `docs/database-foundation.md` at the repository root for translation decisions.

## Checks

```bash
npm run lint
npm test
npm run build
```

For database/HTTP integration checks, create a separate PostgreSQL database, then supply its URL to both variables:

```bash
export DATABASE_URL='postgresql://USER:PASSWORD@127.0.0.1:5432/younity_test'
export TEST_DATABASE_URL="$DATABASE_URL"
export NODE_ENV=test
npm run db:setup
npm run test:e2e
```

The integration suite checks seed preservation, model relationships, foreign keys, duplicate registrations, deletion behavior, prefix routing, Swagger, CORS, and database health. Temporary model fixtures are rolled back. Seed categories remain in the dedicated test database.

Inside Compose, `docker compose exec api npm test` runs unit tests. For integration tests, provision a separate database and pass `TEST_DATABASE_URL` explicitly; do not point it at the normal development database.

## Watch and persistence

With `./run.sh --watch`, source files, test files, both Vitest configuration files, and `.oxlintrc.json` sync automatically. Changes to test or lint settings are available on the next check inside the running container. Dependency, Prisma, and build-configuration changes rebuild the API image. Rebuilds run committed migrations and seed before starting Nest. A schema edit requires a matching committed migration; Watch does not create migrations.

Ctrl+C in `./run.sh --watch` stops services while retaining database and certificate volumes. In detached mode, use `docker compose stop`. Changing `.env` does not update an existing database password. Inspect `docker compose logs -f` for failures. Do not delete volumes to resolve errors unless you intend to discard their data.

## Administrator frontend integration checks

This branch contains S2-06 reads; Said's S2-09 source/schema/migrations are not
merged here. Full review tests use a separate submission/decision backend checkout pinned to PR #17 (`d9db156`, including S2-09).
Prepare it with `node scripts/prepare-admin-backend.mjs /path/to/checkout/apps/api`,
install/build it, and apply migrations only to an explicit isolated `_test` DB.
Set `ADMIN_REVIEW_API_DIRECTORY` to that API directory before running
`npm run test:admin-integration`. The runner requires the separate directory and
forces email delivery off. Normal lint/unit/database/build checks test only your
branch. See [the integration report](../../docs/admin-review-integration.md) for
complete commands and cleanup behavior. The normal API does not gain decision
routes until the team integrates Said's backend separately.

The live runner creates eligible applications through the actual organizer
PATCH draft/POST submit endpoints and tests private corrections/resubmission.
The former test-only revision bridge has been removed. CI uploads sanitized live
acceptance evidence; screenshots and results are linked from the integration guide.

## Public event discovery (S3-05)

- `GET /api/events` returns `{ items, categories, page, pageSize, total }`. The category catalog is complete even when a page is empty. `GET /api/categories` also returns the catalog as `{ categories }`.
- `GET /api/events/:eventId` returns `{ event }`. Unknown IDs and events outside the public visibility rules return 404. Both endpoints include `PUBLISHED` and `FULL` events through 24 hours after `endDate`.
- Both event endpoints accept anonymous requests. On the list, a valid cookie for an active, email-verified student enables interest ranking. Missing or invalid sessions browse as guests. The list response uses private, no-store caching.

| Query | Behavior |
| --- | --- |
| `q` | Case-insensitive substring in title, description, or organizer name |
| `category` | Exact category slug from the catalog |
| `city` | Case-insensitive substring in the existing public location field. Organizers must include the city in the location for this filter to find it. |
| `format` | `IN_PERSON`, `ONLINE`, or `HYBRID` |
| `from`, `to` | Inclusive UTC calendar days for event start, in `YYYY-MM-DD` format |
| `page`, `pageSize` | Positive integers. Defaults are 1 and 12. Maximums are 1,000,000 and 100. |

Filters combine with AND. Invalid filters and reversed date ranges return 400. An event matching any saved student interest ranks ahead of non-matches, using the seeded category slugs. Each group orders upcoming events by earliest start, then past events by most recent start, with ID as the tie-breaker. Ranking happens before pagination.

Public summaries include `id`, `title`, `organization: { id, name }`, `startDate`, `endDate`, `format`, `location`, `categories: [{ id, name, slug }]`, `registrationMode`, `registrationDeadline`, and `availability`. Timestamps are UTC ISO 8601. Availability is `CLOSED` once the event starts or the registration deadline passes, or when automatic registration has no deadline. Otherwise, a full event or one at confirmed capacity is `FULL`, and the remainder are `OPEN`. Details add `description` and `externalRegistrationUrl` (null for automatic registration). The protected `onlineUrl` field, participant information, and private organizer attributes are excluded from both responses. An automatic event with a null deadline remains readable within the visibility window and always has `availability: "CLOSED"`. Clients should accept this pair and disable reservation actions.

This uses the existing event, category, and student profile tables. The API follows the frontend discovery branch's proposed contract. Search fields, city matching, public status rules, and the ordering policy are documented implementation decisions for team review.

After migrating and seeding an isolated test database as described above, run `npm run test:e2e -- test/organizer-events.e2e-spec.ts` to verify the discovery flow against PostgreSQL.
