# Reusable organizer decision notice

Owner: Said. Reviewer: Smail. Aadel owns the status-page data, polling, routing,
and integration. This component is the in-platform notice, with no notification
center, WebSockets, bell, read/unread records, or backend changes.

## Component contract

Import the default `OrganizerDecisionNotice` and its types from
`apps/web/src/components/OrganizerDecisionNotice.tsx`.

| Prop | Contract |
| --- | --- |
| `status` | Required existing `OrganizationStatus`: `PENDING`, `APPROVED`, `NEEDS_CHANGES`, or `REJECTED`. |
| `explanation` | Optional reviewer feedback (`string`, `null`, or omitted). Blank feedback is hidden; it is never fabricated or interpreted as HTML. |
| `actions` | Optional readonly array of `{ id, label, onClick }`. IDs must be stable and unique. Supply only actions permitted for the current account and application. Omitted/empty means no action controls. |
| `busy` | Defaults to `false`. Temporarily disables the supplied actions while the parent handles a request. This does not grant permission or add an action. |
| `busyLabel` | Optional progress text when busy; defaults to `Please wait…`. |
| `headingLevel` | `1`, `2`, or `3`; defaults to `2`. Use the level appropriate to the surrounding status page. |

There are no router, session, API-client, polling, or permission-service imports.
Rendering and prop changes make no requests and invoke no action callbacks.
Callbacks are invoked only by the corresponding button. The parent handles async
errors, request locks, navigation, cancellation, refresh, and approval
acknowledgment. All action buttons are `type="button"` to avoid submitting a
surrounding form.

The component uses a named section and heading, a polite status announcement,
visible decision text, native buttons, visible keyboard focus, and progress
announcements. Feedback longer than 200 Unicode code points has an accessible
expand/collapse button that keeps focus and preserves line breaks. Changed
feedback or decision resets expansion. On narrow screens actions stack, text
wraps, and controls have a minimum 44px height.

## Aadel's integration handoff

Use the authoritative application status and reviewer note already supplied by
the owner-scoped `/api/auth/me` response. The existing frontend parser exposes
them as `user.application.status` and `user.application.reviewerNote`. An
organization's registration-time `PENDING` status alone does not mean an
application has been submitted: show the draft editor until there is an actual
submission. Keep existing page loading/error handling outside the component.

For a submitted pending application or corrections, a parent can supply:

```tsx
import OrganizerDecisionNotice from '../components/OrganizerDecisionNotice'

<OrganizerDecisionNotice
  status={user.application.status}
  explanation={user.application.reviewerNote}
  headingLevel={1}
  busy={saving}
  actions={[
    ...(canOpenApplication ? [{
      id: 'application',
      label: user.application.status === 'NEEDS_CHANGES'
        ? 'Edit application'
        : 'View application',
      onClick: () => navigate('/organizer/application'),
    }] : []),
    {
      id: 'refresh',
      label: 'Check status again',
      onClick: () => { void refreshAndHandleErrors() },
    },
  ]}
/>
```

`canOpenApplication`, `saving`, and `refreshAndHandleErrors` are parent-owned
values/functions in this illustration, not exports from the component. Preserve
Aadel's existing session refresh/polling; do not add a second fetch in the notice.
Derive controls from the agreed API and page policy. For the current workflow:

| Decision | Typical permitted labels | Controls to omit |
| --- | --- | --- |
| `PENDING` | View application; Check status again; optionally Explore campus events | Edit/resubmit while under review |
| `APPROVED` | Explore campus events; Enter organizer dashboard | Edit/resubmit |
| `NEEDS_CHANGES` | Edit application; Check status again; optionally Explore campus events | Organizer dashboard before approval |
| `REJECTED` | Explore campus events; Check status again | Edit/resubmit; organizer dashboard |

These labels describe the existing workflow; the component does not manufacture
or infer permissions. Parent handlers must retain server authorization and the
existing approval-exit acknowledgment before navigating. A shared notice does
not approve an organization or send/acknowledge a decision on its own.

Existing `OrganizationStatusPage` and `OrganizerApprovalPage` are deliberately
unchanged in this component delivery. Aadel should replace their presentation
with this component after reviewing the props contract, retaining their data and
request handling. The legacy `OrganizerApplicationStatus` preview is not used by
this component and is not evidence of production integration.

## Tests and acceptance evidence

Run from `apps/web`:

```sh
npm test -- --maxWorkers=1 src/components/OrganizerDecisionNotice.test.tsx
npm test -- --maxWorkers=1
npm run lint
npm run build
```

The 21 focused cases cover all decisions and explanations, missing feedback,
permitted-action callbacks, keyboard interaction, non-submit buttons, busy
controls, expansion/collapse, Unicode and HTML-like text, prop changes, unique
accessible IDs, heading levels, and zero component fetching. The full local
frontend suite passed with 309 tests; nine unrelated opt-in admin live cases are
skipped in the ordinary frontend run.

See [acceptance evidence](evidence/decision-notice/README.md) for real PostgreSQL
and HTTPS API data, mobile/desktop Chromium, keyboard checks, screenshots, and
automated accessibility results. Those checks use a separate parent harness;
they do not claim that Aadel's production pages have already been changed.

## Remaining completion gates

- Aadel accepts the component contract and integrates it into the existing
  status/approval pages without duplicating session requests.
- Verify that final page integration against the actual API, including approval
  acknowledgment and permitted navigation.
- Hosted CI passes on the published PR, and Smail reviews and approves it.

The component delivery can be reviewed independently. Do not mark the overall
task Done based only on component tests or the isolated acceptance harness.
