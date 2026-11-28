# S3-02 save and publish verification

Verified locally on 2026-11-27 on `feat/s3-02-connect-save-publish-events`, based on
`42f35d40fb2e16b619fc6779ece28b7a31834ff6`. Changes remain uncommitted.
[Trello scope](https://trello.com/c/ikGvf5VF).

## Change and preserved work

The branch HEAD had not moved since the previous review at `42f35d4`. The only
pre-existing working-tree change was formatting in
`apps/api/src/organizer-dashboard/organizer-dashboard.service.ts`; its bytes were
preserved and compared against a copy taken before this task.

The reviewed `apps/web/src/events/service.ts` and `App.tsx` already connect all
writes. They were reused without changes. The missing dependency was the category
catalog: no `CategoriesController` existed or was registered in the current
NestJS app.

Copied only `apps/api/src/categories.controller.ts` verbatim from
`origin/feature/s3-07-event-discovery` at
`b7aa5dc7fd0c3f31e10d7bb8ae53ea64e22e777c` and registered it in `AppModule`.
`GET /api/categories` is public, queries PostgreSQL, sorts by name, and returns
`{ categories: [{ id, name, slug }] }`. No discovery code, schema, migration,
seed changes, frontend rewrite, or fixed category IDs were imported.

Added an API foundation E2E regression that boots the real `AppModule`, requests
the prefixed public route without authentication, compares the exact response
with Prisma's catalog query, and verifies every normal seeded category. It also
checks that the unprefixed route is absent. Existing frontend adapter tests
already cover catalog parsing and `categoryIds` serialization.

Added `tests/s3-02-browser.mjs` as a reproducible browser acceptance check and
saved its request/response and independent database evidence below.

Files added or changed by this task:

- `apps/api/src/categories.controller.ts` (added)
- `apps/api/src/app.module.ts`
- `apps/api/test/app.e2e-spec.ts`
- `tests/s3-02-browser.mjs` (added)
- `docs/s3-02-verification.md` (added)
- `docs/evidence/s3-02/browser.json` (added)
- `docs/evidence/s3-02/browser.txt` (added)
- `docs/evidence/s3-02/database.txt` (added)

## Automated results

| Check | Result |
| --- | --- |
| API `npm run lint` | Passed |
| API `npm test` | 21 files, 264 tests passed |
| API `npm run build` | Passed, including Prisma generation |
| Web `npm run lint` | Passed |
| Web `npm test` | 27 files passed, 1 file skipped; 380 tests passed, 9 skipped |
| Web `npm run build` | Passed, TypeScript and Vite |
| API `npm run test:e2e` | 11 files; 162 passed, 1 optional SMTP test skipped |
| Optional SMTP E2E rerun | `test/email-verification.e2e-spec.ts`: all 10 passed with `EMAIL_VERIFICATION_SMTP_TEST=1` and local Mailpit, covering the skipped case |
| Browser script syntax | `node --check tests/s3-02-browser.mjs` passed |
| Final browser acceptance run | 12 checks passed; exit 0; no browser page errors |
| Diff whitespace | `git diff --check` passed |

The nine skipped web cases belong to `apps/web/src/admin/live.test.tsx`, gated by
its admin live-test URL/fixture environment. Those unrelated admin scenarios were
not configured. They do not supply evidence for the event browser checks.

Both disposable databases used PostgreSQL 17 in `younity-s302-postgres` on
`127.0.0.1:55432`. API E2E used `younity_s302_test`; the live app/browser used the
separate `younity_s302_browser_test`. Both used the repository's `npm run db:setup`
(seven committed migrations, then its ordinary ten-category seed). The browser
account came from `npm run db:demo-accounts`: active, email-verified organizer,
APPROVED organization/application, approval acknowledged. The existing application
PostgreSQL container on port 5432 was not used for these checks.

Initial sandbox runs could not connect to port 55432 (`P1001`) or open Supertest
listeners (`listen EPERM`), causing 34 controller-test failures. Rerunning with
approved local network/listener access resolved them. The first browser harness
attempt timed out because its button locator still expected `Save draft` after
the pending label changed to `Saving…`. The harness was corrected; its interrupted
attempt's disposable draft was removed. Subsequent complete runs passed, including
a final run with full-value retention and exact request-count assertions. There
are no outstanding application test failures.

## Real browser, API and database evidence

The normal React app ran through Vite at `http://localhost:5174`, proxying `/api`
to the built NestJS API at `127.0.0.1:3102`. Local headless Chromium
`156.0.8078.79` used a fresh browser context, normal login form, real secure login
cookie on localhost, and the production default event service. There was no route
interception, response stubbing, fake service injection, or mocked API.

The browser-control connector reported no browsers and its in-app browser was
unavailable. The local Playwright/Chromium fallback ran through an approved shell
command. This is browser execution, separate from the jsdom/mocked unit tests.

| Live check | Observed result |
| --- | --- |
| Actual categories | All ten seeded names appeared as React picker checkboxes; API catalog matched PostgreSQL IDs/names/slugs |
| New draft | Keyboard Enter on Save sent one POST, returned 201/DRAFT with selected AI and Data `categoryIds` |
| Reopen | Open saved draft loaded the same ID, title and checked category |
| Edit | At 390 × 844, edits disabled both Publish controls and showed the explicit save-first message |
| Save existing | Keyboard Enter on the mobile Save dock sent PATCH, returned 200 with the original ID and updated title |
| Publish existing | Keyboard Enter on the mobile Publish dock sent bodyless POST to that ID's `/publish`; PostgreSQL changed the same row to PUBLISHED |
| Direct publish | Keyboard Enter on a new event's Publish sent one POST `/publish`, returned 201; PostgreSQL stored PUBLISHED directly |
| Pending repeated activation | A real `LOCK TABLE events IN SHARE MODE` held each new Save/Publish request in PostgreSQL; checked `pg_stat_activity` for a lock wait; both action areas disabled; three mouse clicks and three Enter presses produced no extra writes |
| Failed Save and Publish | Temporarily removed an unused seeded Fintech row after the picker loaded it; each real request returned 400 `categoryIds contains an unknown category`; alert displayed; title, description, category, URL, capacity, deadline and full serialized schedule stayed intact; no event row was created; category restored in `finally` |
| Narrow layout | 390px viewport, both actions exercised with keyboard through the visible action dock; no horizontal document overflow; screenshots inspected |

Final run IDs (2026-11-27):

| Path | PostgreSQL ID | Final status |
| --- | --- | --- |
| Save → reopen → edit → save → publish | `eccfbb7d-f044-41cf-a0c9-11bbf5485182` | PUBLISHED |
| New event → direct publish | `fbc18d4b-5c27-4857-9232-0c560bc777ee` | PUBLISHED |

Both rows link to the real seeded AI and Data category
`844142dd-86d6-47e0-b959-7947c2ff3e7b` and keep `registration_mode=AUTOMATIC`.
Exactly six event write requests were observed in the final run: four successes
(201, 200, 200, 201) and the two intentional 400s. Exactly two rows have that run's
event titles. Earlier successful complete runs retain their own distinct fixtures
in this disposable database.

Evidence:

- [Browser assertions](evidence/s3-02/browser.txt)
- [Full event request/response capture and database assertions](evidence/s3-02/browser.json) — only disposable form data; no password, cookie or JWT
- [Independent psql query output](evidence/s3-02/database.txt)
- [Desktop form screenshot](../.local/s3-02/browser/desktop-form.png)
- [Mobile saved draft screenshot](../.local/s3-02/browser/mobile-saved-draft.png)
- [Mobile publication screenshot](../.local/s3-02/browser/mobile-published.png)
- [Mobile failed save screenshot](../.local/s3-02/browser/mobile-failed-save.png)
- [Mobile failed publish screenshot](../.local/s3-02/browser/mobile-failed-publish.png)

Screenshots and full automated logs are local ignored artifacts under
`.local/s3-02/`; compact browser/database evidence is in `docs/evidence/s3-02/`.

## Reproduce the browser check

Use a disposable PostgreSQL instance, a database ending in `_browser_test`, and
fresh local credentials. The normal seed creates categories, not accounts.
For example, after starting the isolated container:

```sh
docker run --name younity-s302-postgres -d \
  -e POSTGRES_USER=s302 -e POSTGRES_PASSWORD=s302-disposable-only \
  -e POSTGRES_DB=younity_s302_test -p 127.0.0.1:55432:5432 postgres:17

# In apps/api; migrate deploy creates the separate database if absent.
export DATABASE_URL='postgresql://s302:s302-disposable-only@127.0.0.1:55432/younity_s302_browser_test'
export DEMO_ACCOUNT_PASSWORD='S302-disposable-password-2026'
export NODE_ENV=test
npm run db:setup
npm run db:demo-accounts
npm run build
PORT=3102 JWT_SECRET=s302-disposable-browser-secret JWT_TTL_SECONDS=7200 \
  FRONTEND_ORIGIN=http://localhost:5174 \
  CORS_ORIGINS=https://localhost,http://localhost:5174 node dist/main.js

# In another terminal, apps/web:
API_PROXY_TARGET=http://127.0.0.1:3102 npm run dev -- --host 127.0.0.1 --port 5174 --strictPort

# From repo root, using installed Chromium and an external temporary dependency:
npm install --prefix /tmp/younity-s302-browser --no-save --package-lock=false playwright-core
S302_PLAYWRIGHT_MODULE=/tmp/younity-s302-browser/node_modules/playwright-core \
  TEST_DATABASE_URL='postgresql://s302:s302-disposable-only@127.0.0.1:55432/younity_s302_browser_test' \
  S302_PASSWORD='S302-disposable-password-2026' node tests/s3-02-browser.mjs
```

The script creates two events per successful run, temporarily removes/restores an
unused seeded category, and briefly locks the events table. Its database must be
disposable. Run it separately from API E2E. Screenshots and JSON default to
`.local/s3-02/browser/` and are overwritten on the next run. It does not install a
repository dependency or alter application environment files.

## Registration policy and remaining work

The current registration behavior is preserved: new forms default to AUTOMATIC;
there is no registration-mode selector. A loaded EXTERNAL draft retains EXTERNAL
and exposes its external registration link. The API and adapter support EXTERNAL.
Existing frontend regression coverage for that loaded-draft behavior passed.

The product team still needs to decide whether new events may choose EXTERNAL
from the form and, if so, approve selector/default/validation behavior. This is
not a blocker for the verified AUTOMATIC S3-02 flow. No implementation or runtime
blockers remain. Peer review and any commit/PR/Trello status changes remain with
the team; this task leaves all edits local.

The isolated app/API remain running on ports 5174/3102 and the disposable
PostgreSQL container on 55432 for local review. Existing Compose services were
not restarted or reconfigured. The test database and prior successful run's
fixtures remain available. Stop only `younity-s302-postgres` when finished with
this verification; do not run Compose teardown against the existing stack.
