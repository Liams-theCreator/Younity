# S2-05 acceptance evidence — 2026-11-17

All people/accounts/data shown here are isolated test fixtures. The admin screen
is the actual production frontend build, served with HTTPS/Secure cookies, backed
by PostgreSQL and the real S2-03/S2-09 APIs at PR #17 commit `d9db156`.

- [Desktop queue](list-1440.png): actual submitted applications; saved drafts and
  unverified applications excluded.
- [Private corrections](private-draft-390.png): after a real PATCH draft and admin
  refresh, the admin still sees the prior submitted content.
- [Stale decision](stale-390.png): a real request-changes/resubmission makes the
  displayed revision stale; the POST returns 409 and refreshes/reset the form.
- [Reviewed resubmission](resubmitted-390.png): an explicit new review approves
  the current revision while preserving the two previous decisions.
- [Browser outcomes](browser-results.json): 1440px, 390px, 320px, keyboard radios,
  Tab/Enter, validation/feedback focus, history/list updates and student blocking.
- [Database outcomes](persistence-results.json): real draft/submission/resubmission,
  reviewer metadata, revisions, audit and unsent email intents persisted.

The organizer steps use actual HTTP endpoints; no submission/revision helper or
mock response is used. The admin steps run through the rendered UI. Mail delivery
is disabled. Passwords, session cookies, private keys and database URLs are excluded.
CI attaches a fresh `admin-review-acceptance` artifact with the live test log and
persistence summary. See [the integration guide](../../admin-review-integration.md)
for reproduction. Reviewer approval is tracked on the PR.
