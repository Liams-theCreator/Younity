# S2-09 admin decisions: frontend contract and review handoff

Verified 2026-11-14 on `feat/admin-panel`, starting at `f886af9`.

## Status

- **Done:** atomic approval of application and organization plus activation of the actual organization owner; suspended/non-organizer owners cannot be activated. Conditional writes validate related records and roll back on failure.
- **Done:** revision-aware decision gate, strict administrator authorization, input validation, detail/history endpoint, append-only decision writes, transactional notification intents and tested dispatcher seam.
- **Partial / integration dependency:** no organizer submission/resubmission backend exists in this checkout or locally available `origin/main`. Revision tracking is provided but Aadel must wire the helper into his transaction. Draft eligibility cannot be verified against an implementation that is not present.
- **Blocked:** shared decision email delivery and worker scheduling. The locally available `origin/main` contains `auth/mail/MailService`, but exposes only `sendVerificationEmail(email, link)`. Do not merge a second SMTP implementation. Abdellah must add/agree the decision method and supply an adapter for `DecisionEmailSender`; register/schedule the dispatcher using team worker infrastructure. Nothing sends real email automatically in this change.
- **Team confirmation outstanding:** approval activates a non-suspended ORGANIZER owner, following the original handoff's working agreement. Registration creates PENDING organizer/organization records and RolesGuard requires ACTIVE + APPROVED for organizer privileges, consistent with that agreement; these are implementation evidence, not formal product sign-off. Said/Aadel must confirm this rule before release. Rejection/request-changes leave organization/user states unchanged because no authoritative mirroring contract was found.

## Frontend API

All endpoints require the browser's `access_token` JWT cookie (`credentials: 'include'`). The current database identity must be role ADMIN, status ACTIVE, and have non-null `emailVerifiedAt`. JWT identity is reloaded for each request; inactive/unverified admins receive 403. Other authentication flows retain their existing rules.

| Method | URL | Success |
| --- | --- | --- |
| GET | `/api/admin/applications/:id` | 200 application with `revision` and ordered `decisions` |
| POST | `/api/admin/applications/:id/approve` | 201, numeric JSON `1` |
| POST | `/api/admin/applications/:id/reject` | 201, numeric JSON `1` |
| POST | `/api/admin/applications/:id/request-changes` | 201, numeric JSON `1` |

All IDs must be UUIDs. All POST bodies require:

```json
{"reason":"Documents verified","expectedRevision":2}
```

`reason` must be a string, trimmed, nonempty after trimming, maximum **100 characters**. `expectedRevision` must be a JSON integer from 1 through 2147483647; strings are not coerced. Unknown properties (including `reviewerId`) are rejected. The authenticated identity supplies reviewer ID.

**Intentional breaking changes requested by frontend integration:** old `{reason}`-only bodies now receive 400; inactive/unverified admins now receive 403. Missing applications return 404 rather than the old ambiguous 409; malformed IDs return 400. Existing decision URLs, 201 status and numeric `1` success body are preserved.

Obtain `expectedRevision` from GET when opening the review. Its response contains application fields (`id`, `organizationId`, `submittedById`, `reviewerId`, `status`, `reviewerNote`, `submittedAt`, `reviewedAt`, `revision`) and `decisions`, ordered by `createdAt`, then `id`. Each decision has `id`, `applicationId`, `adminId`, `revision`, `oldStatus`, `newStatus`, `reason`, `createdAt`. Dates are ISO strings. It excludes user credentials and email-delivery internals.

Example excerpt:

```json
{"id":"application-uuid","status":"PENDING","revision":2,"decisions":[]}
```

The excerpt uses a placeholder; real IDs are UUIDs. A pending-list API is still absent; Aadel/Oussama must confirm ownership. This change adds only the explicitly requested detail/revision/history read API.

| Code | Meaning / frontend action |
| --- | --- |
| 400 | Invalid UUID/body; display validation errors |
| 401 | Missing/invalid/expired JWT; authenticate again |
| 403 | Wrong role, inactive/suspended account, or unverified administrator |
| 404 | Application does not exist; remove/close the stale review |
| 409 | Revision changed, application not PENDING, or approval owner/organization is ineligible; refresh detail before further review |
| 500 | Unexpected persistence failure; transaction rolled back; refresh before retrying |

Typical Nest responses:

```json
{"message":"Application is not pending or revision is stale","error":"Conflict","statusCode":409}
```

```json
{"message":"Application not found","error":"Not Found","statusCode":404}
```

Validation response `message` is an array, e.g. `{"statusCode":400,"error":"Bad Request","message":["expectedRevision must be an integer number"]}` (other validation messages may also appear).

Refresh after any successful decision, after 409, and whenever a resubmission is observed. Do not blindly retry using an old revision or replace the administrator's viewed revision with a fresh one without reopening/reviewing the changed application.

## Aadel: submission integration contract

There is no DRAFT enum or nullable submission timestamp in this schema: OrganizationApplication rows have required `submittedAt` and default revision 1. Under the current contract a PENDING application row represents a submission; organization registration alone does not create one. Do not store drafts as PENDING applications. If Aadel's unmerged design does that, eligibility needs an agreed submission marker before release; this patch cannot distinguish such draft rows.

Initial submission creates PENDING revision 1. On every edit-and-resubmit of submitted content, call `advanceApplicationRevision(tx, id, expectedRevision)` **first**, in the same interactive transaction as all submitted-content writes. It conditionally accepts PENDING/NEEDS_CHANGES at that revision, increments revision atomically, moves to PENDING, refreshes submittedAt, and clears latest reviewer metadata. Do not increment on an unsubmitted draft save. Do not commit content updates separately, swallow conflicts, or edit reviewable content without revision tracking. APPROVED/REJECTED are terminal. Decision history remains intact. The helper is an integration seam, not a new organizer endpoint.

The application row is the first write/lock for both decisions and resubmissions. Competing admin decisions yield exactly one winner; competing review/resubmission transactions cannot both win against the same revision. PostgreSQL transaction conflicts (P2034) map to 409. A failed decision gate is followed by an existence read to distinguish 404/409; a concurrent deletion can yield 404. Every dependent write is inside the same transaction.

## History, email and migrations

Two forward-only migrations are added, following existing migrations without changing them:

1. `20261114200000_admin_decisions`: history and email-outbox tables, foreign keys/indexes.
2. `20261114201000_application_revisions`: existing applications backfilled to revision 1; history revision; positive-revision/decision constraints; unique `(application_id, revision)` prevents duplicate audit decisions for a revision.

History is append-only through the application service/API: there are no update/delete history operations. Foreign keys prevent accidental parent deletion; database owners retain normal direct SQL privileges. No fabricated historical decisions or emails are backfilled for previously decided applications. Apply with `npm run db:migrate:deploy` before starting the new API. Schema coordination with Aadel is required before combining migrations on his branch.

The transaction records one decision plus one unique email intent to the actual organization's owner. SMTP is never called from the transaction. `DecisionEmailDispatcher` claims due rows with `FOR UPDATE SKIP LOCKED`, then delivers outside the transaction using the supplied shared-service adapter. States: PENDING, SENDING, FAILED, SENT, EXHAUSTED. It stores attempts, sanitized error, retry time, lease/token, created/sent timestamps. Retries back off 1/2/4/8 minutes, with at most five claims. A five-minute lease recovers crashed claims; an expired fifth claim becomes EXHAUSTED with an unknown-delivery marker. Sender timeouts must be shorter than the lease (the shared SMTP service has short timeouts).

Delivery is **at least once**, not SMTP exactly-once. Stable Message-ID `<decision-DECISION_ID@younity.test>` is passed to the adapter; forward it and use provider idempotency when available. A crash between delivery and recording SENT can cause a duplicate. Monitor FAILED/EXHAUSTED rows; exhausted/unknown outcomes need operator review before resetting for another attempt. Raw provider errors, addresses, reasons and secrets are not logged by the dispatcher. Adapter wiring, monitoring and scheduling remain team integration work.

## Verification evidence

All database checks used a separately created PostgreSQL 17 container (`younity-admin-test`, loopback port 55439) and explicit dedicated `TEST_DATABASE_URL`; no developer/shared DB was changed. The container remains available for review. No real mail delivery occurred.

From `apps/api`:

| Command | Result |
| --- | --- |
| `npm run prisma:validate` | pass |
| `npm run prisma:generate` | pass |
| `npm run build` | pass |
| `npx tsc --noEmit --incremental false` | pass, includes test compilation |
| `npm test` | **92 passed**, 9 files |
| `npm run lint` | pass, no diagnostics |
| `npm run db:migrate:deploy` with isolated DATABASE_URL | all five migrations applied |
| `npm run db:status` with isolated DATABASE_URL | up to date |
| `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code --config prisma7.config.ts` | no difference |
| `npm run db:seed` with isolated DATABASE_URL | 10 categories, existing records preserved |
| `npm run test:e2e` with isolated TEST_DATABASE_URL, DATABASE_URL and test JWT/CORS settings | **73 passed**, 6 files |

Fresh/populated migration tests apply the actual SQL in transaction-isolated schemas; populated checks preserve an existing user, organization and application and assert revision=1, FK integrity and positive revision constraints. Full deploy was also exercised on the fresh dedicated database. Real JWT/HTTP checks cover every decision route, validation, current admin authorization, read/history, successful triple update, stale/conflicting decisions, concurrent decisions/resubmissions and terminal states. Fixture-scoped PostgreSQL failure triggers verify rollback at organization, owner, history and outbox writes. Email tests use a fake sender and real queue/claims for failure, retry, concurrent dispatch and exhaustion.

The first full e2e run had 63 passing/1 failing because the pre-existing seed-idempotency test assumes the category catalog is already seeded. After explicitly seeding the fresh isolated DB, the suite passed; subsequent additions brought it to 73 passing. A pre-existing pg client-query deprecation warning is emitted by the e2e suite; it does not fail tests.

For manual verification, apply migrations/seed only to a dedicated `_test` DB, create independent verified ACTIVE admin and PENDING organizer/organization/application fixtures, obtain a real admin cookie, GET detail, then POST a decision using its revision. Inspect application/organization/owner plus history/email intent. Repeat POST for 409; resubmit through the helper transaction and verify the old revision gets 409. Never reuse private local dev accounts or send real emails as part of this check.

## Said: review and frontend handoff

Review the approval activation assumption with Aadel, migration ordering with schema owners, and read the added database/HTTP tests. Send Oussama the Frontend API section, specifically the required `expectedRevision`, detail URL and refresh-on-409 rule. Ask Aadel to wire the revision helper and confirm drafts never become PENDING applications; ask Abdellah to supply shared decision delivery and schedule the dispatcher. No teammate messages, deployment, merge, push or real email delivery were performed.

## Remote refresh before PR creation

A subsequent `git fetch origin` exposed additional teammate branches that were absent from the original local remote refs:

- `origin/S2-06_Admin-application-api` already implements list/detail reads. Its `GET /api/admin/applications/:id` overlaps this branch's detail endpoint and returns a different, frontend-oriented DTO. **Do not register both controllers on merge.** Reconcile one canonical detail endpoint, preserving S2-06 fields and adding revision/history, then update frontend tests. The earlier pending-list ownership gap is therefore resolved at the branch level, but integration remains outstanding.
- S2-06 also filters reads by verified/non-suspended ORGANIZER submitter, non-future submittedAt, and nonempty required organization fields. This branch's decisions currently rely on the persisted PENDING submission convention and eligible owner for approval. Agree a shared read/decision eligibility predicate with Aadel; these branch contracts currently differ. This is a merge blocker, not a verified end-to-end combined workflow.
- `origin/S2-03_draft` still has an empty organizer-applications controller and no application revision field. The resubmission integration dependency remains.
- `origin/02-verification_email` has the same verification-only mail service; no decision-delivery method was found there.

Keep the PR in draft until the endpoint/eligibility conflict and the documented release dependencies are resolved. The recorded test results apply to this feature branch alone, not a merge with those teammate branches.

## Main merge conflict resolution

Merged `origin/main` at `ae6998a` into the feature branch to resolve PR conflicts. AuthModule preserves main's EmailVerificationModule, MailModule and ResendRateLimitGuard alongside this branch's exported PassportModule/JwtAuthGuard/RolesGuard. JwtStrategy preserves main's global EMAIL_NOT_VERIFIED rejection and selects emailVerifiedAt for the administrator checks. This supersedes the earlier branch-only statement about unchanged non-admin email-verification rules: the merged branch follows main's current authentication policy.

Combined-branch verification: build, full TypeScript compilation and lint passed; **133 unit tests passed** (13 files); **93 end-to-end tests passed, 1 skipped** (8 files) against the same isolated PostgreSQL container. The skip is main's optional SMTP delivery test (`EMAIL_VERIFICATION_SMTP_TEST` was not enabled); a simulated verification-delivery failure emits the expected registration recovery log. No real mail delivery occurred. The S2-06 endpoint/eligibility reconciliation, organizer revision integration and decision-mail scheduling dependencies still apply; merging main does not include those unmerged teammate features.
