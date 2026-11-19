# S2-06 — administrator application read API

Owner: Oussama. Reviewer: Aadel.
Implementation branch: `S2-06_Admin-application-api`, based on published
`origin/main` at `ae6998a` (2026-11-13 checkout).

## Scope and agreement status

The S2-06 implementation adds read-only list/detail endpoints and documents
their concrete response contract for frontend integration and Aadel's review.
Said's decision implementation is kept in a separate test checkout, outside
this branch. See [the integration report](admin-review-integration.md) for the
ownership boundary and integration checks. S2-06 itself adds no decision, submission, schema or migration logic.

GitHub branches were fetched and inspected before implementation:

- `origin/main` / `ae6998a`: current persisted application schema, email
  verification and JWT cookie authentication.
- `origin/S2-03_draft` / `1b6ccad`: draft DTO and empty controller; no runnable
  draft/submission persistence or new draft-state migration.
- `origin/feat/admin-panel` / `a287f5d`: prototype decision service using the
  existing application table; no decision HTTP controller.
- `origin/feature/s2-07-onboarding` / `c1813bc`,
  `docs/s2-07-integration.md`: published rules separate draft saving/submission,
  require verified email and complete required fields for submission, make proof
  optional, permit NEEDS_CHANGES resubmission and disallow REJECTED resubmission.

S2-03 PR #17 at `d9db156`, now merged upstream, confirms application rows
represent submissions and stores drafts in a separate `organizer_application_drafts`
table. The existing read predicate needs no schema change. Real HTTP draft,
submission and resubmission checks now verify this boundary, including private
corrections that do not change submitted data before resubmission. Original
branch inspections above describe the initial implementation, not current blockers.

## Authentication and eligibility

Both routes use the existing JWT cookie strategy and role guard. The reader must
be an ACTIVE, email-verified ADMIN. Missing, invalid, expired or deleted-user
sessions return 401; non-admin, inactive, suspended or unverified readers return
403. Roles and verification are checked against persisted user data per request.
Clients cannot supply an administrator ID or role to select another identity.

The same eligibility predicate applies to list **and detail**:

- An application row exists and its `submittedAt` is not in the future.
- Its submitter is an ORGANIZER with PENDING or ACTIVE user status and a
  non-null `emailVerifiedAt`.
- The linked organization's name, representative, academic position and phone
  are nonempty stored strings. This is a minimal read filter, not a replacement
  for S2-03 submission validation/trimming.
- Organization approval is not required to appear in the review queue.
- Supporting proof is optional. All four application review statuses may be
  read, including previously decided applications.

## List

`GET /api/admin/applications`

Query parameters:

| Parameter | Contract |
| --- | --- |
| `page` | One-based positive decimal integer; default 1, maximum 1,000,000. |
| `limit` | Positive decimal integer; default 20, maximum 100. |
| `status` | Optional exact value: PENDING, NEEDS_CHANGES, APPROVED, REJECTED. Omission includes all four. |

Unknown fields, repeated values, fractional/scientific notation and invalid
values return 400. Ordering is `submittedAt DESC, id DESC`; the unique ID breaks
timestamp ties. Count and items are obtained in a repeatable-read transaction
with the same predicate. Page and count describe one snapshot; offset
pagination does not promise a frozen registry across separate requests.

Example HTTP 200 response:

```json
{
  "items": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "orgName": "Campus Robotics Club",
      "representativeFullName": "Sara Example",
      "status": "PENDING",
      "submittedAt": "2026-11-13T09:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1,
  "hasNextPage": false,
  "hasPreviousPage": false
}
```

`total` counts eligible applications matching the optional status filter.
Empty results use `items: []`, `total: 0`, `totalPages: 0`; a page beyond the last
page also returns 200 with empty items and the actual matching total.
`hasPreviousPage` is `page > 1`; `hasNextPage` indicates another matching page.

## Detail

`GET /api/admin/applications/:id`

The identifier is an **application UUID**, not an organization/user UUID.
Malformed UUIDs return 400. Unknown or excluded applications return the same 404
response to avoid exposing an ineligible application's details.

Example HTTP 200 response:

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "orgName": "Campus Robotics Club",
  "representativeFullName": "Sara Example",
  "status": "NEEDS_CHANGES",
  "submittedAt": "2026-11-13T09:00:00.000Z",
  "type": "STUDENT_CLUB",
  "academicPosition": "Club coordinator",
  "phoneNumber": "+212612345678",
  "proofUrl": null,
  "submittedBy": {
    "firstName": "Sara",
    "lastName": "Example",
    "email": "sara@example.test"
  },
  "reviewerNote": "Please update your supporting information.",
  "reviewedAt": "2026-11-13T10:00:00.000Z"
}
```

`proofUrl`, `reviewerNote` and `reviewedAt` may be null. Dates are UTC ISO strings.
Both endpoints select safe fields explicitly and send `Cache-Control: no-store`.
Password hashes, verification token hashes, token relations, authentication
credentials and unrelated account/profile information are never selected.

| HTTP status | Meaning |
| --- | --- |
| 200 | Read succeeded, including an empty list. |
| 400 | Invalid query or malformed application UUID. |
| 401 | Missing/invalid/expired session or missing session user. |
| 403 | Reader does not meet the admin access rule. |
| 404 | Detail application does not exist or is ineligible. |

Validation errors follow the existing NestJS `message` array/`error`/`statusCode`
format. Missing detail uses `{"message":"Application not found","error":"Not Found","statusCode":404}`.
Swagger at `/api/docs` and `/api/docs-json` documents cookie authentication,
query bounds/enums, response DTOs and errors. There are no decision methods on
these routes; S2-09 remains responsible for writes and concurrency preconditions.

## Frontend handoff

Summary/detail JSON fields match the S2-05 `ApplicationSummary` and
`ApplicationDetail` view models at commit `132a348`. The frontend adapter maps:

- Its opaque page string to the numeric `page` query parameter.
- `hasPreviousPage` / `hasNextPage` to previous/next page strings or null, and
  creates the display label from `page` / `totalPages`.
- The raw detail response into `ReviewDetail.application`.
- HTTP status codes into existing authentication and review error handling.

The frontend targets S2-09's revision-aware contract included in S2-03 PR #17
at `d9db156`, tested separately without adding teammate implementation here.
S2-06 list/detail routes and DTOs remain unchanged. The decision screen consumes
`GET /api/admin/applications/:id/review` for content, revision and history in one
consistent snapshot, and sends that displayed `expectedRevision` with the reason.
It never combines this flat detail DTO with separately obtained revision data.
See [the integration report](admin-review-integration.md) for conflict recovery,
authorization, tests and remaining submission integration requirements.

## Verification and remaining acceptance

The maintained tests live in:

- `src/admin-applications/dto/list-admin-applications.dto.spec.ts`
- `test/admin-applications.e2e-spec.ts`

Database tests use the actual application module, JWT signing/validation,
persisted roles, Prisma and PostgreSQL. Guards/database delegates are not
overridden. Cases cover unauthorized roles, inactive/unverified admins, stale
role claims, list/detail eligibility, organization-only drafts, missing IDs,
unsafe field exclusion, exact safe JSON, stable tied ordering, defaults/bounds,
more than 100 records, filters, out-of-range/empty pages, verification changes,
fresh decision reads and Swagger schema/parameter/security consistency.

Use an isolated database whose name ends in `_test`, as documented in the API
README. Supply `DATABASE_URL`, `TEST_DATABASE_URL`, `NODE_ENV=test` and a test
`JWT_SECRET`, apply migrations/seeds, then run:

```bash
npm run prisma:validate
npm run db:setup
npm run db:status
npm run lint
npm test -- --maxWorkers=1
npm run test:e2e -- --maxWorkers=1
npm run build
```

The CI API job already discovers the new unit/integration tests through the
existing file patterns. Local logs are kept under `.local/s2-06/` (Git-ignored).
Validated on 2026-11-13 using a separate PostgreSQL 17 container and
`younity_s206_test` database:

- API build and type-aware lint: passed.
- Unit suite: **141 passed**, including 18 query-validation cases.
- Complete database/HTTP suite: **92 passed, 1 skipped**. The skipped existing
  email-delivery test requires `EMAIL_VERIFICATION_SMTP_TEST=1` and a test SMTP
  server; it is unrelated to admin reads.
- Focused admin HTTP/database suite: **32 passed** using real JWT guards and
  PostgreSQL. Per-case evidence is in `.local/s2-06/admin-http-tests.log`.
- Prisma validation, migration deployment/seed, migration status and database
  versus schema diff: passed; no schema drift. Migrations and seed were also
  rerun successfully against the populated isolated test database.
- `git diff --check`: passed. Database fixture cleanup deletes only suite-owned
  records. The developer application database was not used.
- No frontend code was changed by this backend task. Mobile/keyboard verification
  with actual read/decision integration remains part of S2-05.
- Hosted CI, PR creation and Aadel's approval remain pending; local test results
  do not establish reviewer approval or the final team contract.

Before Done: obtain passing hosted checks, attach acceptance evidence and get
Aadel's review approval. Published submission storage and decision contracts are
aligned and verified; formal review status is tracked on the PR.

## Full-flow integration verification — 2026-11-17

Standalone API: **141 unit tests**, **92 DB/HTTP tests** pass. Separate backend
checkout with actual S2-03/S2-09: **133 combined DB/HTTP tests**, including the
**32 S2-06 read cases**, and **9 real frontend cases** pass. One unrelated opt-in
SMTP case is skipped. List/detail DTOs and Swagger remain unchanged. Real
submissions, private corrections, resubmission revision/history, mobile/keyboard,
permissions and stale review are verified. See the
[integration report](admin-review-integration.md) and
[committed evidence](evidence/s2-05/README.md). No teammate code is merged here.
