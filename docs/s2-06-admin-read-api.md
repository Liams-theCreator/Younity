# S2-06 — administrator application read API

Owner: Oussama. Reviewer: Aadel.
Implementation branch: `S2-06_Admin-application-api`, based on published
`origin/main` at `ae6998a` (2026-11-13 checkout).

## Scope and agreement status

This branch adds read-only list/detail endpoints and documents their concrete
response contract for frontend integration and Aadel's review. It contains no
decision writes, submission endpoints, schema edits, or migrations.

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

**The final S2-03 storage agreement is still not published.** Current-schema
compatibility treats an `OrganizationApplication` row as a submission and an
organization without an application row as a draft. This is an explicit
implementation assumption, not proof of the forthcoming submission workflow.
The lifecycle predicate and the read contract need Aadel's signoff before Done.
If S2-03 starts storing drafts in the application table, its migration must
provide a submitted-state discriminator and this predicate/tests must be updated
before integration. A filled draft must never become visible merely because its
fields look complete.

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

Do not infer `allowedDecisions` from these reads: confirm allowed transitions,
reason validation and conflict metadata with S2-09 first. Its controller is not
published yet. Frontend wiring and decision forms remain S2-05 integration work;
this backend branch does not add mock decisions or modify that feature branch.

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

Before Done: Aadel confirms the schema/eligibility/pagination/response agreement;
integrate the eventual real S2-03 draft/submission workflow; get hosted CI green,
attach acceptance evidence to the PR/card and obtain Aadel's review approval.
