# Organizer decision notice acceptance

Component owner: Said. Reviewer: Smail. Verification date: 2026-11-22.

The component was tested with a temporary parent harness and the real compiled
API from `main` at `474efaf04465a652bcf97ac4e88e2c03a97d692e`, an isolated
PostgreSQL 17 database, and Caddy HTTPS. Fixtures were synthetic verified accounts.
No developer data was changed and decision-email delivery was disabled.

The harness alone owns API calls, session mapping, callback handling and busy
state. It imports the actual component source. It is not a production route and
does not replace Aadel's status-page integration. Rendering, prop changes, and
feedback expansion were checked to cause no requests; a parent refresh callback
made exactly one session request.

## Verified scenarios

- A club-name-only draft survives logout/login. Complete verified submission
  produces the real `PENDING` application used for notice props.
- Admin request-changes supplies the actual explanation. The owner sees an edit
  callback, while dashboard/resubmit actions are absent from the supplied list.
- Saved corrections remain private. Resubmission keeps the application ID and
  advances to revision 2; an old revision decision is rejected.
- Real approval is displayed. The parent's dashboard callback performs actual
  approval acknowledgment and temporarily disables action buttons.
- A separate real rejected application has no edit/resubmit/dashboard controls.
- All four API-derived decisions are checked at 320px, 390px and 1440px widths.
- Native keyboard callbacks and feedback expansion/collapse retain focus.
- A separate long-feedback fixture exercises multiline Arabic, Unicode,
  unbroken text, and HTML-like text. It is presentation stress data, not a claim
  that the current 100-code-point admin reason limit permits such a new decision.

`acceptance-results.json` records the component source hash, actual checks,
accessibility scan count and screenshots. Browser screenshots are acceptance
evidence; the generated harness, test credentials, tokens and database files are
excluded from Git.

## Screenshots

| Evidence | Scenario |
| --- | --- |
| [pending-390.png](pending-390.png) | Pending submission, mobile |
| [needs_changes-390.png](needs_changes-390.png) | Actual reviewer feedback and correction action |
| [approved-390.png](approved-390.png) | Approval and permitted exit actions |
| [rejected-390.png](rejected-390.png) | Rejection without edit/resubmit controls |
| [approved-1440.png](approved-1440.png) | Desktop layout |
| [approved-busy-390.png](approved-busy-390.png) | Real acknowledgment callback in progress |
| [long-feedback-expanded-320.png](long-feedback-expanded-320.png) | Expanded multilingual feedback at 320px |
| [long-feedback-collapsed-320.png](long-feedback-collapsed-320.png) | Collapsed feedback at 320px |

Local component tests and dependency checks do not replace production page
integration, hosted CI, or Smail's approval. See the
[component contract and handoff](../../organizer-decision-notice.md).
