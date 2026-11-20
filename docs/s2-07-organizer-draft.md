# Organizer draft frontend handoff

Base: Smail's onboarding branch c821db8, fast-forwarded locally to main 7f7b4c3
(PR #12). Sync main before applying these files. GET/PATCH endpoint agreed with Aadel:
`/api/organizer-applications/draft`.

## Proposed response contract

Both methods return HTTP 200 with `{ draft, canEdit }`.
Only the endpoint is agreed; this envelope and null-clearing are frontend proposals.

```json
{
  "draft": {
    "organizationName": "Campus Club",
    "type": "STUDENT_CLUB",
    "representativeFullName": "Sara Test",
    "academicPosition": null,
    "phoneNumber": "+212612345678",
    "proofUrl": null
  },
  "canEdit": true
}
```

All six draft fields must be present, each a string or null. Type is an exact
OrganizationType enum or null. A confirmed absent draft is
`{ "draft": null, "canEdit": true }`. A missing/malformed response or HTTP 404 is
an error, not an empty draft. canEdit=false displays the returned fields read-only.
PENDING alone does not prove that an application is still editable.

## PATCH and persistence

- Read on page load; edit in React state; PATCH only when Save draft is clicked.
- Send only changed fields. Omission preserves a field; proposed null clears it.
- Trim text and omit unchanged values. Permit incomplete forms.
- Return the full canonical response after saving; do not return a null draft.
- Send the HttpOnly session cookie with credentials: include and disable caching.
- Never send a user ID, password, account role, approval or submission state.
- proofUrl is an optional existing supporting URL, not a simulated file upload.
- Backend ownership, eligibility, validation and edit permissions remain authoritative.
- Require a verified organizer session and derive ownership from it on the backend.
- Failed saves retain unsaved inputs; leaving/reloading discards unsaved edits.

Aadel's DTO at 1b6ccad rejects null for most fields. It needs nullable clearing
support if this proposal is accepted. His inspected branch has no draft handlers
yet, and partial-draft persistence also needs his backend/schema implementation.
This frontend does not implement or modify those backend responsibilities.

## Frontend entry and verification

The status page links to `/organizer/application`. The existing auth guard permits
PENDING/NEEDS_CHANGES organizer destinations; the GET response controls editing.
Students, rejected and approved organizers cannot open this draft editor.
An existing submitted PENDING application can be returned with canEdit=false.

Tests in apps/web/src/organizer/draft.test.tsx use mocked API responses. Actual
browser checks use a temporary API fixture outside the repository. No mock API,
demo accounts or browser-storage persistence is shipped in application code.
After Aadel implements the contract, repeat restore/save/clear/reload/denial
checks against the real API. Until then, this is frontend-ready, not fully integrated.
On the current backend, a service-unavailable error is expected for this endpoint.

Submission, corrections/resubmission, automatic onboarding resume, status-page
fetching and approval acknowledgment remain separate tasks. Saving a draft
does not mark onboarding complete, submit for review or change approval status.

## Verification performed

- Frontend lint, TypeScript checks and production build passed.
- Full frontend suite: 170 tests passed using two workers.
- Includes 21 organizer draft regression tests.
- Updated verification integration fixtures to match PR #12's headings, expiry
  and recovery-token response. No verification runtime logic was changed here.
- Chromium fixture checks covered save/restore/retry, keyboard operation and layouts
  from 320px to 1440px. Automated accessibility checks found no violations in
  nine tested states. Real backend persistence still needs integration testing.