# Administrator review integration — Oussama's S2-05 / S2-06

Owner: Oussama. Reviewers: Smail (frontend), Aadel (read API).
Branch: `S2-05-06_Admin-integration`. Ownership cleanup verified 2026-11-15.

## Branch boundary

This branch contains Oussama's frontend, S2-06 read endpoints, tests and integration
support. **Said's backend implementation is not merged or copied into this branch.**
Its decision module, migrations, schema changes, auth/mail edits and teammate tests
were removed from the working tree. No teammate branch was merged into this
feature's history.

Integration uses a separate, Git-ignored backend checkout at
`.local/admin-review-backend`, pinned to Said's
[PR #16 / 42346ac](https://github.com/Liams-theCreator/Younity/pull/16).
`prepare-admin-backend.mjs` copies only Oussama's S2-06 read module and its tests
into that isolated checkout. It never copies dependency code into this branch.
The normal API source remains the S2-06 branch based on `main`.

The branch's API alone provides S2-06 reads. Decision/review APIs must come from
a separately integrated/deployed S2-09 backend. Starting this branch alone does
not create Said's routes or database tables. The production frontend has no mocks.

## Frontend contract

S2-06 list/detail routes and safe DTOs remain unchanged; see
[the read contract](s2-06-admin-read-api.md). Queue pagination is bounded, with
20 rows per page and the published four status filters. Search/counts/CSV apply
to the loaded page. Active admins land on `/admin/applications`.

The decision screen uses `GET /api/admin/applications/:id/review` from S2-09 to
obtain content, revision and ordered history in one consistent snapshot. The
adapter validates/picks safe fields and never pairs older S2-06 detail content
with separately fetched revision metadata.

POST `/api/admin/applications/:id/{approve,request-changes,reject}` sends exactly:

```json
{"reason":"Documents verified","expectedRevision":2}
```

The reason is trimmed, required for every action and limited to 100 Unicode
code points, satisfying the published DTO and database audit constraint.
`expectedRevision` is the displayed snapshot's integer revision (1–2147483647).
No pre-submit read silently substitutes a newer revision. A successful 201/count
response reloads detail/history; returning to the queue reloads the list.

- 400/422: validation feedback preserving choice/explanation.
- 401: existing session-expiry/login flow.
- 403: remove review data/actions and show denial.
- 404: missing/excluded application, no actions.
- 409/412: announce conflict, reload the complete snapshot and clear the old form.
  The administrator must inspect the updated content and make a new decision.
- Lost/unknown response: refresh before enabling another action; never retry a
  decision automatically.

Form/page request locks prevent duplicate submissions. Controls/refresh stay
disabled while pending. Proof links permit absolute HTTP(S) only; reasons render
as text. Native radios, labels and feedback focus support keyboard review.
Historical decisions identify the submission; legacy rows retain latest metadata
when no history exists.

## Running real integration without merging dependencies

Fetch/archive the pinned backend into an ignored directory (or use a separate
checkout). From the repository root:

```bash
mkdir -p .local/admin-review-backend
git archive 42346ac45a3700cec2e34dc4754784a578e0b445 | tar -x -C .local/admin-review-backend
node apps/api/scripts/prepare-admin-backend.mjs .local/admin-review-backend/apps/api
npm ci --prefix .local/admin-review-backend/apps/api
```

Install both apps' own dependencies. Set `DATABASE_URL` and `TEST_DATABASE_URL` to
the same isolated PostgreSQL database whose name ends in `_test`, plus
`NODE_ENV=test`, a test-only `JWT_SECRET`, and `ADMIN_DECISION_EMAIL_ENABLED=false`.
Never use the application database. Then:

```bash
npm run build --prefix .local/admin-review-backend/apps/api
npm run db:setup --prefix .local/admin-review-backend/apps/api
npm run test:e2e --prefix .local/admin-review-backend/apps/api -- --maxWorkers=1 test/admin-applications.e2e-spec.ts
export ADMIN_REVIEW_API_DIRECTORY="$(realpath .local/admin-review-backend/apps/api)"
npm run test:admin-integration --prefix apps/api
```

The runner requires the explicit separate backend directory. It loads that
checkout's generated client and compiled API, seeds only owned fixtures, runs
the real frontend against HTTP/PostgreSQL, verifies revision/history/outbox
persistence, and cleans up its records/server. Only transport is replaced in jsdom
to resolve relative URLs and maintain cookies; no API responses are mocked.

The resubmission helper is test-only, restricts writes to the runner-owned
fixture, and calls Said's actual revision helper inside the same transaction as
submitted-content changes. It proves revision integration, not Aadel's unpublished
organizer endpoint. Delivery is forced off; email intents remain unsent.

`-- --serve` supports manual browser QA through an HTTPS gateway for Secure
cookies. It writes test-only credentials to Git-ignored `session.json`, removed
on shutdown. Do not attach that file to a PR. CI likewise checks out the pinned
decision dependency separately, overlays only S2-06, and runs integration there.

## Evidence and remaining acceptance

After removing dependency files, standalone checks pass: **141 API unit tests**,
**92 database/HTTP tests** (one unrelated opt-in SMTP case skipped), API lint/build,
and frontend lint/build/tests. The separate checkout checks S2-06's **32 read
cases** and the **9 live frontend cases**, including all three decisions,
duplicate prevention, backend denial, history preservation and stale resubmission.
Current logs are Git-ignored under `.local/admin-integration/own-*` and
`separate-backend-*`.

On 2026-11-14 the same frontend also passed real HTTPS Chromium checks at 1440px,
390px and 320px, including keyboard focus, one POST with expectedRevision,
history/list refresh, and a mobile 409 followed by explicit re-review. Screenshots
and structured results remain in `.local/admin-integration/revisions-browser/`.
Moving backend dependencies outside the branch does not change that UI code.
The previous 159-unit/139-database totals included Said's suites; they are not
this branch's standalone test totals.

Remaining: Aadel must confirm final draft/submission storage and eligibility,
keep drafts outside submitted application rows (or provide a discriminator),
and call `advanceApplicationRevision` first in the resubmission transaction.
Test the actual organizer endpoint when available. Combined hosted CI, attached
acceptance evidence and Smail/Aadel review approvals are still required. Said's
PR is a separately owned dependency; this work does not merge, approve or deploy it.
