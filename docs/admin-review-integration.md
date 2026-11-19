# S2-05 / S2-06 — admin review integration

Owner: Oussama. Reviewers: Smail (frontend), Aadel (reads).
Branch: `S2-05-06_Admin-integration`. Acceptance run: **2026-11-17**.

## Scope and ownership

This branch contains Oussama's screens, S2-06 read endpoints, tests and integration
support. Teammate migrations, decision/auth/mail code and submission endpoints
are not copied into this branch or merged into its history. The test backend is
a separate Git-ignored checkout. Aadel's
[PR #17](https://github.com/Liams-theCreator/Younity/pull/17), now merged upstream,
includes S2-03 and Said's S2-09. Tests pin its commit **`d9db156`** and overlay only
Oussama's read module/tests. Normal deployment must use the upstream backend.

The previous temporary resubmission helper is removed. All eligible fixture
applications are submitted through the actual organizer HTTP APIs. Account and
organization contexts are seeded only into an isolated test database. One
explicitly ineligible legacy application checks unverified-submitter exclusion.
A complete saved draft is created through PATCH without creating an application.

## Published contract alignment

- S2-03 stores drafts in `organizer_application_drafts`. They never appear in the
  application queue; pending/approved/rejected submissions cannot be edited.
- A verified organizer submits complete fields through
  `POST /api/organizer-applications/submit`. Initial revision is 1. A changes
  request allows private PATCH edits; resubmission publishes them atomically,
  keeps the application ID, increments revision and preserves decision history.
- S2-06's [read contract](s2-06-admin-read-api.md) is unchanged: bounded page/limit,
  four status filters and explicitly selected safe summary/detail fields. The
  queue uses 20 rows; search, counts and CSV apply to the current page.
- Decisions use S2-09's `GET /api/admin/applications/:id/review`: content, revision
  and ordered history in one snapshot. No separate metadata read replaces the
  displayed revision. All three POST actions send `{reason, expectedRevision}`.
  The reason is trimmed, required and at most 100 code points, satisfying the
  DTO and persisted audit constraint. Only PENDING exposes actions.
- A 201/count response reloads detail/history; returning to the list re-reads it.
  A 409/412 announces conflict, refreshes the complete snapshot and clears the
  form so a new review is required. Never retry a decision automatically.
- 400/422 preserves input and shows validation; 401 uses session expiry; 403/404
  removes review information/actions. Unknown/lost responses refresh because
  the decision may have committed. Form/page locks prevent duplicate writes.

Active admins alone can mount the screens. Backend authorization checks the
persisted role, active status and verified email. Reasons render as text; proof
links accept absolute HTTP(S). Labeled native radios/textarea and focused
feedback support keyboard navigation. Current and historical decisions are shown.

## Real acceptance evidence

[Committed evidence](evidence/s2-05/README.md) contains sanitized screenshots and
outcome summaries from the actual production frontend build, HTTPS Secure-cookie
login, PostgreSQL and the real organizer/read/decision endpoints.

- Desktop/mobile at **1440px, 390px and 320px**: no page overflow, Tab/Enter,
  radio arrows, required-reason focus, one POST with the displayed revision,
  success focus, history and refreshed list/detail.
- Mobile full cycle: request changes through UI; save a real private draft;
  refresh confirms old submitted content; actual resubmission keeps ID and
  increments revision. A second real request-changes/resubmission makes the
  open review stale. POST returns 409, refresh resets the form, and explicit
  re-review approves the current revision with previous history intact.
- Anonymous navigation redirects to login; a real student session cannot mount
  review screens or issue review reads. Live tests cover actual backend denial.
- **229 standard frontend tests**, **141 standalone API unit tests**,
  **92 standalone database/HTTP tests** pass. **133 combined database/HTTP tests**
  pass in the separate checkout (one unrelated opt-in SMTP case skipped).
- **9 live frontend cases pass** against actual HTTP/DB data, covering all
  decisions, duplicates, stale/concurrent review, private edits, actual
  resubmission, permissions and authoritative refresh. Database checks verify
  reviewer metadata, revisions, approval visibility, audit and unsent mail intents.
- Relevant lint and production builds pass. Database files run sequentially
  because whole-queue assertions share one isolated DB; explicit races still
  execute concurrent requests. No developer database or real email delivery used.

CI pins the same backend separately and uploads `admin-review-acceptance`
(persistence JSON and live log). Test passwords, session files and TLS keys are
excluded. Hosted CI/reviewer status is tracked on the PR; approval is required
before Done. The prior missing-submission implementation blocker is resolved.

## Reproduce without merging teammate code

From the repository root, install both apps' dependencies and fetch/archive the
pinned dependency into an ignored directory:

```bash
git fetch origin refs/pull/17/head
mkdir -p .local/admin-review-backend
git archive d9db156b00804d84252e97f56ba16e9249018da0 | tar -x -C .local/admin-review-backend
node apps/api/scripts/prepare-admin-backend.mjs .local/admin-review-backend/apps/api
npm ci --prefix .local/admin-review-backend/apps/api
```

Set `DATABASE_URL` and `TEST_DATABASE_URL` to the same explicit isolated PostgreSQL
DB ending in `_test`, plus `NODE_ENV=test`, a test-only JWT_SECRET and
`ADMIN_DECISION_EMAIL_ENABLED=false`. Never use the application database.

```bash
npm run build --prefix .local/admin-review-backend/apps/api
npm run db:setup --prefix .local/admin-review-backend/apps/api
npm run test:e2e --prefix .local/admin-review-backend/apps/api -- --maxWorkers=1 --no-file-parallelism
export ADMIN_REVIEW_API_DIRECTORY="$(realpath .local/admin-review-backend/apps/api)"
npm run test:admin-integration --prefix apps/api
```

The runner starts the compiled backend on a free loopback port, creates real
submissions through HTTP and runs the default rendered App. jsdom replaces only
transport to resolve relative URLs/maintain cookies; responses and service logic
are real. The test requests changes, PATCHes the applicant draft, proves the
admin still sees submitted content, POSTs resubmission, rejects the old admin
revision and explicitly decides again. No helper writes application revisions.

Cleanup deletes only owned draft, mail-intent, history, application, organization
and user records in dependency order, then stops its server. Delivery is forced
off. `-- --serve` supports manual browser QA via an HTTPS gateway; local test-only
credentials in `.local/admin-integration/session.json` are removed on shutdown.
