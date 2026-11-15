# S2-05 — administrator application review frontend

Owner: Oussama. Reviewer: Smail. Branch: `S2-05-06_Admin-integration`.

The frontend is implemented against Said's published revision-aware contract.
**Only Oussama's feature code is on this branch.** S2-09 backend source, schema
and migrations remain in a separate test checkout/teammate PR; they are not merged
here. See [the integration report](admin-review-integration.md) for reproduction.

Implemented: restricted list/detail, loading/empty/error/not-found/denied states,
pagination/filters, submitted information/history, all three decision actions,
required trimmed reasons, duplicate locks, displayed expectedRevision, refresh on
409/uncertain response, explicit re-review, safe text/links, mobile/keyboard focus.

Validation: frontend lint/build and standard tests pass. Nine live cases use a
separately prepared real API/PostgreSQL checkout, including stale transactional
resubmission and history. Mobile/keyboard evidence at 1440/390/320px is in
`.local/admin-integration/revisions-browser/`. No fixture API is wired into App.
The branch's API alone serves S2-06 reads; real decision/review routes require
Said's separately integrated backend.

Before Done: Aadel's actual submission/resubmission workflow and agreement,
combined hosted CI, acceptance attachments and Smail's review approval.
