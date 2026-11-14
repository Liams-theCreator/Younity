# S2-09 admin decisions: frontend and integration handoff

Branch: `feat/admin-panel`. PR: https://github.com/Liams-theCreator/Younity/pull/16.

## Current completion status

Implemented and tested: atomic decisions and approval consistency; revision-aware decision gate; active, email-verified admin authorization; decision audit history; durable email outbox; shared MailService delivery; scheduled queue processing; input validation; isolated PostgreSQL rollback/concurrency/migration tests. The CI web failure was an asynchronous assertion race in EmailVerificationPage.test.tsx: the test now waits for the final status text rather than merely finding the status element that already shows a loading message.

The shared mail service is now present after merging main. S2-09 extends it with `sendDecisionEmail`; no second SMTP transport/service was introduced. A polling worker is wired and ready; it is disabled by default to avoid sending existing queued emails during development/review. Set `ADMIN_DECISION_EMAIL_ENABLED=true` only in an environment authorized for delivery. It uses existing SMTP_HOST/SMTP_PORT/MAIL_FROM settings. Compose passes the flag through from the root environment. No real messages were sent during verification.

Remaining external dependencies:

- **Aadel:** the available `S2-03_draft` branch has no submission/resubmission implementation. Wire the supplied revision helper into that workflow as described below; keep drafts outside PENDING application rows. S2-09 cannot verify a missing organizer workflow.
- **Oussama / S2-06 integration:** use the separate review metadata endpoint below to obtain expectedRevision. S2-06 owns list/detail content. This branch no longer registers its overlapping GET detail URL; eligibility matches the current S2-06 rules. The branches still need combined frontend integration verification.
- **Product review:** confirm the original handoff's working agreement to activate the actual non-suspended ORGANIZER owner on approval. Existing registration creates PENDING owner/organization records and RolesGuard requires ACTIVE + APPROVED, consistent with that agreement; this is implementation evidence, not formal product sign-off. Rejection/request-changes leave organization/user states unchanged because no mirroring rule was confirmed.

No team branch was overwritten, no unrelated organizer endpoint was implemented, and nothing was merged into main or deployed.

## Frontend API contract

All endpoints require the browser's `access_token` JWT cookie (`credentials: 'include'`). The current database identity must be ADMIN, ACTIVE, and email-verified. JWT identity is reloaded on every request. Main's existing global email-verification authentication policy is preserved.

| Method | URL | Success |
| --- | --- | --- |
| GET | `/api/admin/applications/:id/review` | 200 consistent content/revision snapshot and ordered `decisions`; Cache-Control: no-store |
| POST | `/api/admin/applications/:id/approve` | 201, numeric JSON `1` |
| POST | `/api/admin/applications/:id/reject` | 201, numeric JSON `1` |
| POST | `/api/admin/applications/:id/request-changes` | 201, numeric JSON `1` |

All IDs must be UUIDs. All POST bodies require:

```json
{"reason":"Documents verified","expectedRevision":2}
```

`reason` must be a string, trimmed, nonempty after trimming, maximum **100 characters**. `expectedRevision` must be a JSON integer from 1 through 2147483647; strings are not coerced. Unknown properties, including `reviewerId`, are rejected. The server supplies acting admin ID from authenticated identity.

Intentional contract changes: old `{reason}`-only requests now return 400; inactive/unverified admins return 403; missing application returns 404; malformed IDs return 400. Decision URLs and 201/numeric `1` responses are preserved. The provisional S2-09 GET `/api/admin/applications/:id` from the first draft was replaced by `/api/admin/applications/:id/review` to avoid colliding with S2-06's existing content/detail endpoint and DTO. This PR never registers both handlers.

Obtain `expectedRevision` from GET review metadata when opening a review. The response contains application fields (`id`, `organizationId`, `submittedById`, `reviewerId`, `status`, `reviewerNote`, `submittedAt`, `reviewedAt`, `revision`) and `decisions` ordered by `createdAt`, then `id`. Each decision has `id`, `applicationId`, `adminId`, `revision`, `oldStatus`, `newStatus`, `reason`, `createdAt`. Dates are ISO strings. User credentials and email-delivery internals are excluded. The response also includes `organization` (orgName, representativeFullName, type, academicPosition, phoneNumber, proofUrl) and `submittedBy` (firstName, lastName, email). These fields and revision/history are read in one RepeatableRead transaction. Use this response as the decision review snapshot; S2-06 can continue serving its existing list/detail DTOs. Never pair older separately fetched detail content with a newer review revision.

| Code | Meaning / frontend action |
| --- | --- |
| 400 | Invalid UUID/body; display validation errors |
| 401 | Missing/invalid/expired session; authenticate again |
| 403 | Wrong role, inactive/suspended account, or unverified administrator |
| 404 | Missing application; GET review metadata also hides applications excluded by submission eligibility |
| 409 | Existing application is ineligible, not PENDING, stale, or approval owner is ineligible; refresh content and review metadata |
| 500 | Unexpected persistence failure; entire decision rolled back; refresh before retrying |

Typical responses:

```json
{"message":"Application is ineligible, not pending or revision is stale","error":"Conflict","statusCode":409}
```

```json
{"message":"Application not found","error":"Not Found","statusCode":404}
```

Validation `message` is an array, e.g. `{"statusCode":400,"error":"Bad Request","message":["expectedRevision must be an integer number"]}`; additional validation messages may appear. Refresh after success, 409 or observed resubmission. Never automatically retry a decision against a new revision without reviewing the changed content.

## Submission eligibility and revision integration

The current schema has no DRAFT application status and requires submittedAt. Under the existing contract, an application row represents a submission; organization-only drafts have no application row. All decisions now include the S2-06 eligibility predicate atomically with PENDING and expectedRevision: submission time is not in the future; submitter is an email-verified, non-suspended ORGANIZER; required organization name, representative, academic position and phone fields are nonempty. A draft incorrectly persisted as such an eligible PENDING application cannot be distinguished without Aadel's agreed submission lifecycle; do not create those rows for drafts.

Initial submission creates PENDING revision 1. On edit-and-resubmit of submitted content, call `advanceApplicationRevision(tx, id, expectedRevision)` **first**, in the same interactive transaction as all submitted-content writes. It accepts PENDING/NEEDS_CHANGES at that revision, atomically increments revision, moves to PENDING, refreshes submittedAt, and clears latest reviewer metadata. Do not increment on draft saves, commit content separately, swallow conflicts, or edit reviewable content without revision tracking. APPROVED/REJECTED are terminal. History remains intact. This helper is an integration seam, not a replacement organizer submission endpoint.

The application row is the first write/lock for decisions and resubmissions. Competing decisions have one winner; review/resubmission cannot both win at the same revision. P2034 database transaction conflicts map to 409. A failed gate is followed by an existence read to distinguish 404/409; concurrent deletion can yield 404. Approval updates application, organization verifier/time/status, actual owner status, history and email intent atomically. Missing dependencies or any failed write roll everything back. Suspended/non-organizer owners cannot be activated. All other decision types leave organization/owner states unchanged.

## Migrations and history

Two new forward-only migrations follow the original three migrations without rewriting them:

1. `20261114200000_admin_decisions`: history/outbox tables, foreign keys and indexes.
2. `20261114201000_application_revisions`: application revision default/backfill 1, history revision, positive-revision/decision constraints, unique application+revision audit index.

No historical decisions/emails are fabricated for already decided applications. History is append-only through service/API; there are no history update/delete operations. Database owners retain normal SQL privileges. Apply `npm run db:migrate:deploy` before running the API and coordinate schema changes with Aadel.

## Email delivery and operations

Decision/history/email intent are written in one database transaction. Delivery happens afterward through the existing shared MailService, with appropriate approved/rejected/needs-changes subjects and reviewer reason in plain text. Delivery failure cannot undo a decision.

The opt-in worker polls every five seconds, processes at most 20 items per poll, never overlaps its own polls and waits for in-flight work during shutdown. Multiple replicas are safe: PostgreSQL `FOR UPDATE SKIP LOCKED` claims rows with a token and five-minute lease. MailService SMTP timeouts are shorter than that lease. Failures are sanitized in durable rows; unexpected queue-processing errors emit a generic operational log and retry on the next poll.

States: PENDING, SENDING, FAILED, SENT, EXHAUSTED. Rows contain attempts, sanitized lastError, retry time, claim/lease, created/sent timestamps. At most five claims; failure backoff is 1/2/4/8 minutes. Expired claims recover; an expired fifth claim becomes EXHAUSTED with unknown-delivery metadata. Monitor FAILED/EXHAUSTED counts and investigate before manually resetting exhausted or uncertain deliveries. Example read-only query: `SELECT status, count(*) FROM decision_emails GROUP BY status;`.

SMTP delivery is at least once, not exactly once. The shared transport forwards a stable Message-ID `<decision-DECISION_ID@younity.test>`. A crash after send and before recording SENT can duplicate a message; use provider idempotency if available. Never reset SENT automatically. No recipient, reason, credentials or raw provider error is logged by the worker/dispatcher.

## Verification evidence

All database checks used a separate PostgreSQL 17 container (`younity-admin-test`, loopback port 55439) and explicit dedicated TEST_DATABASE_URL. Developer/shared databases were untouched; the container remains available for review. Mail tests mock delivery; the optional real SMTP e2e test remains disabled.

From `apps/api`: Prisma validate/generate, build, full `npx tsc --noEmit --incremental false`, lint and unit tests passed. **141 unit tests passed (14 files); 99 e2e tests passed, 1 optional SMTP test skipped (8 files).** E2e tests include real JWT authorization, all decision endpoints, validation, submission eligibility, actual-owner triple update, stale/concurrent decisions and resubmissions, revision rollback, shared-MailService dispatcher wiring, email retries/concurrent claims/exhaustion. Fixture-scoped PostgreSQL write-failure triggers prove complete rollback at organization, owner, audit and outbox writes.

Fresh and populated migration checks pass using the actual SQL in transaction-isolated schemas; populated checks preserve existing user/organization/application rows and backfill revision 1. Full fresh isolated DB migration deploy passed, db:status is up to date, and Prisma migrate diff reported no schema difference. Existing migrations were not changed. The fresh database was seeded before the complete suite because the existing seed-idempotency test assumes a seeded category catalog.

From `apps/web`: `npm ci`, lint, **149 tests (16 files)** and production build passed after correcting the asynchronous expired-session assertion. Startup shell syntax and all **11 Python startup tests** passed. Existing pg deprecation and expected simulated verification-mail failure logs do not fail the API suite.

Reproduce database checks only with an explicit dedicated `_test` DB, DATABASE_URL/TEST_DATABASE_URL pointing there, a test JWT_SECRET and FRONTEND_ORIGIN/CORS_ORIGINS configured; leave ADMIN_DECISION_EMAIL_ENABLED=false. Never use private developer accounts or enable real delivery during tests.

## Review handoff

Said can review/publish the backend changes and send Oussama this contract, especially the review metadata URL, required expectedRevision, unchanged 100-character limit and refresh-on-409 behavior. The remaining implementation dependency is Aadel's unavailable submission/resubmission transaction. List/detail content remains owned by S2-06. Confirm activation semantics with the team before release. Real email enablement is an environment/release action, not part of this code change. The PR remains draft until external integration/product review is resolved; no merge or deployment is authorized by these checks.
