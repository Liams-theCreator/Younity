# S2-05 — administrator application review frontend

Owner: Oussama. Reviewer: Smail. Branch: `S2-05-06_Admin-integration`.
Verified 2026-11-17 against real S2-03/S2-06/S2-09 APIs and PostgreSQL.

Implemented: restricted list/detail; loading, empty, validation, denied and
not-found states; pagination/status filtering; submitted content/history;
approve/request-changes/reject; required trimmed explanations; synchronous
duplicate locks; displayed expectedRevision; conflict/uncertain-outcome refresh;
explicit re-review; safe links/text; mobile and keyboard/focus support.

Published S2-03 storage now confirms drafts are separate. All eligible live
fixtures are actually submitted through the organizer API. Corrections remain
private until real resubmission. The former direct revision helper is removed.
No teammate production code is copied or merged into this feature branch.

Checks pass: 229 frontend tests, 141 standalone API unit tests, 92 standalone
DB/HTTP tests, 133 combined DB/HTTP tests and 9 live frontend cases. One unrelated
opt-in SMTP test is skipped. Relevant lint and production builds pass.

[Acceptance screenshots and results](evidence/s2-05/README.md) cover real HTTPS
login, 1440/390/320px, keyboard navigation, permissions, private draft edits,
resubmission, stale decisions, history and fresh list/detail state.
[Integration guide](admin-review-integration.md) documents contracts and commands.
CI attaches fresh live evidence. Hosted checks and review requests are tracked
on the PR. **Smail's approval is required before marking the card Done.**
