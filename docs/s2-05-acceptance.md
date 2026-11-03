# S2-05 — administrator application review frontend

Owner: Oussama. Reviewer: Smail. Branch: `S2-05_Build-admin`.

## Current delivery status

Frontend components and access routing are implemented. **S2-05 is not ready for
Done:** the S2-06/S2-09 HTTP contracts and endpoints are absent from this checkout.
Production renders an unavailable state, makes no guessed review requests, and
contains no review fixture data. Backend code and database schema are unchanged.

The supplied [Sprint 02 agreements](https://trello.com/c/801rAaHz),
[backlog reference](https://trello.com/c/m7DRg89C), and
[board](https://trello.com/b/tKQ0FLbb/younity) could not be read in this session.
The available web reader could not access them, browser control was unavailable,
and the Trello integration was not connected. Their contents have not been
treated as an agreed contract.

## Implemented frontend behavior

- Active admin sessions land on `/admin/applications`, with a review navigation
  link. `/admin/applications/:applicationId` is protected by the existing session
  guard. Students, organizers, inactive admins, and anonymous visitors cannot
  mount review components or start review reads.
- List: loading, empty, failure/retry, status filter, refresh, and previous/next
  navigation. Filter options and pagination navigation values come from the
  adapter. Changing a filter clears the previous page; list navigation is
  preserved in detail/back links. These are frontend URLs, not proposed API URLs.
- Detail: safe, explicitly rendered submitted information, supporting document,
  status, submission/review dates, reviewer reason, missing/denied/error states.
  Document links accept absolute HTTP(S) URLs only. Reasons render as text.
- Decision form: native radio group, reason textarea, confirmation, adapter-driven
  required/maximum-length rules, inline feedback and focus. Allowed actions come
  from the adapter, with no inferred transition policy.
- A synchronous submission lock prevents repeated events. Decision controls and
  detail refresh are disabled during submission. Successful decisions trigger
  a detail reload; returning to the list performs a fresh read.
- Conflicts and uncertain outcomes trigger a fresh detail read without resending
  the decision. No actions are shown during refresh or after a failed refresh.
  Permission/not-found decision failures hide the submitted information and form.
- All adapter operations receive the existing `requestProtected` function and an
  abort signal. A 401 uses the existing session-expiry flow. Old read responses
  and decision responses are ignored after navigating away.
- CSS uses existing design tokens, a two-column desktop detail layout and a
  one-column layout below 768px, wrapping controls and long submitted values.

## Integration handoff — required before acceptance

`apps/web/src/admin/model.ts` defines a **frontend service boundary**, not a
backend API schema. Its fields are based on the existing Prisma model; they do
not establish the pending Sprint 02 response contract. No mock is wired into the
production app. Configure a stable `ApplicationReviewService` instance through
`App`'s `reviewService` prop once the actual adapter can be implemented.

The adapter must:

1. Use the agreed S2-06 methods/routes and explicitly map validated responses into
   the safe view models. Confirm fields allowed in list/detail responses.
2. Translate frontend selection into the agreed bounded pagination and status
   filters. Return accurate page labels and previous/next navigation values.
3. Enforce the agreed S2-03 eligibility rule for list **and detail**. The current
   registration service creates a pending organization but no application, and
   the current application schema has no draft/submission lifecycle. Pending
   organization status alone must not be interpreted as review eligibility.
   Confirm how verified email and submitted applications are represented.
4. Supply the agreed decision transitions, reason requirements/limits, and S2-09
   method/path/payload. Preserve the server concurrency precondition for each
   exact detail snapshot. Client-side locking does not replace atomic backend
   decisions.
5. Normalize documented API errors to `ReviewError`, using `forbidden`,
   `not-found`, `conflict`, `validation`, or `unavailable`. HTTP 401 must pass
   through `requestProtected`. Preserve the ambiguity of timeouts/lost responses;
   never automatically resubmit a write.
6. Use fresh, uncached reads after decisions and propagate abort signals to
   requests. The backend must return authoritative state after a successful write.

Required contract inputs: read routes/response fields, pagination bounds/format,
filter values, eligibility, detail visibility, decision routes/body/response,
reason requirements, conflict response/preconditions, and error shapes.

## Acceptance evidence

The focused `src/admin/review.test.tsx` suite uses an injected frontend service
fixture. It verifies access, list/detail states, filter/page behavior, safe
links, reason validation/focus, keyboard submission, repeated submissions,
successful refresh/list return, stale decisions, uncertain write outcomes,
failed conflict recovery, permission denial, session expiry, and aborted reads.
These tests do **not** demonstrate real S2-06/S2-09 API or database integration,
nor the final submission/verification eligibility policy.

Validated on 2026-11-03:

- `npm test -- --maxWorkers=1`: 150 passed, 2 existing live-registration tests
  skipped because no isolated live API configuration was supplied.
- An initial default parallel test run had one existing registration-test
  timeout; the single-worker run passed without changing its test or timeout.
- `npm run lint` and `npm run build`: passed.
- Headless Chromium at 320px, 390px and 1280px: list/detail had no horizontal
  overflow. Keyboard-only navigation through refresh, proof link, decision radio
  group (including ArrowRight), reason and confirmation worked. Missing required
  reason focused the textarea; keyboard submission updated detail and list. Each
  scenario submitted once, with no page or console errors. Screenshot inspection
  confirmed the stacked mobile panels and desktop columns.
- Browser QA used a temporary entry point with fixtures and intercepted session
  restoration, not real review APIs. It was removed after verification. No new
  browser test dependency was added to either app.
- Local screenshots and structured browser results are in
  `.local/s2-05-review/` (Git-ignored): `list-320.png`, `list-390.png`,
  `list-1280.png`, corresponding `detail-*.png` and `decided-*.png`, and
  `browser-results.json`. Attach selected evidence to the eventual PR/card.
- Hosted CI and real review API/database checks have not been run; no PR,
  reviewer approval, commit, or push is claimed.

Before Done: integrate actual dependencies, test real eligible/ineligible data
and concurrent admins, attach real API/database evidence, update Swagger/API
contract with endpoint owners, run hosted CI, and obtain Smail's PR approval.
