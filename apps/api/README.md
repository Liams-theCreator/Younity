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
  can be cleared with `null`.
- `POST /api/organizer-events/publish` accepts a completed form and creates an
  event directly with status `PUBLISHED`, returning the event with HTTP 201.
- `POST /api/organizer-events/:id/publish` publishes the persisted draft and
  returns the same event with HTTP 200. No request body is needed; save form edits
  with PATCH before publishing.

Creation requires `title`, `description`, `format` (`IN_PERSON`, `ONLINE`, or
`HYBRID`), `startDate`, `endDate`, and `registrationMode` (`AUTOMATIC` or
`EXTERNAL`), matching the existing database requirements. Optional fields are
`location`, `onlineUrl`, `imageUrl`, `registrationDeadline`, `capacity`, and
`externalRegistrationUrl`. Dates use ISO 8601; the end must follow the start, and
the registration deadline must not follow the start. Capacity must be a positive
integer. Unknown fields, including ownership and status fields, are rejected.

Both publish routes validate the complete event, require a future `startDate`,
and enforce format and registration requirements: in-person events need
`location`, online events need `onlineUrl`, hybrid events need both, and external
registration needs `externalRegistrationUrl`. Image, capacity, and registration
deadline remain optional. Incomplete drafts may still be saved through the draft
routes, provided the core database fields are present. Successful publication
sets `PUBLISHED` directly.

Malformed UUIDs or invalid bodies return 400. Missing events and events owned by
another organizer return 404. Editing or publishing a non-draft event (including
a repeated publish), or a draft changed during the save/publication, returns 409.
Reload after a conflict. Saving a draft does not publish it. Direct publication
creates a new event on every successful request; use the saved-draft route when
publishing an existing draft.

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
