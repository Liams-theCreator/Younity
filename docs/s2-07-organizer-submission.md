# Organizer submission frontend handoff

Base: Smail's feature/s2-07-onboarding at c1813bc.
This change adds frontend submission/resubmission to the existing draft editor.
It is frontend-tested; real backend integration is pending.

## Audit and ownership

- main 7f7b4c3 is already included in the base branch.
- Aadel's S2-03_draft at 1b6ccad has SaveOrganizerDraftDto and an empty controller.
  There is no draft or submission handler to integrate or test against yet.
- DTO fields are reused: organizationName, type, representativeFullName,
  academicPosition, phoneNumber, optional proofUrl.
- Admin backend a287f5d uses application statuses PENDING, NEEDS_CHANGES,
  APPROVED and REJECTED, matching this frontend's state names.
- Admin UI 132a348 changes AuthRoutes/getAuthDestination. This change leaves
  those files and shared authentication state untouched.
- RegistrationSelect adds an optional requirementHint prop. Existing callers
  keep the same behavior; the draft editor can describe submission requirements.
- Aadel owns persistence, ownership checks and state transitions. Admin status
  refresh and reviewer feedback remain with their existing owners.

## User flow

1. GET /api/organizer-applications/draft restores the application.
2. Typing changes React state only; Save draft explicitly performs PATCH.
3. Unsaved edits disable Submit/Resubmit. Saving never submits automatically.
4. Submission requires saved organizationName, type, representativeFullName,
   academicPosition and phoneNumber. proofUrl remains optional; no upload is required.
5. Submit/Resubmit validates all fields and POSTs the saved application.
6. Only a confirmed submission navigates to pending and refreshes /api/auth/me.
   The session response, not frontend state assignment, determines access/status.
7. NEEDS_CHANGES shows corrections and Resubmit application. It uses the same
   operation; the backend must transition the same application back to PENDING.

All draft fields remain optional when saving. Submission validation reuses draft
format/length checks. Backend validation remains authoritative, including strict
phone validation; client checks only provide earlier feedback.

## Proposed submission contract — not yet agreed or implemented

POST /api/organizer-applications/submit

- HttpOnly session cookie via credentials: include; no request body.
- Submit the current persisted draft belonging to the authenticated organizer.
- First submission: 201; confirmed existing submission/resubmission: 200.
- Both successful responses use this shape:

```json
{
  "application": {
    "id": "the-persisted-application-id",
    "status": "PENDING"
  }
}
```

The client does not send user IDs, roles, status, completion flags or application
IDs. organizationName maps to Organization.orgName on the backend, as for drafts.
It never infers submission from an organization's existing PENDING status.

Backend requirements for Aadel:

- Require verified organizer identity and enforce ownership and complete fields.
- Atomically persist submission/status changes and return only after commit.
- Separate unsubmitted drafts from submitted applications. Return canEdit=false
  from the draft API while review is pending; never use org PENDING alone.
- Resubmit the same NEEDS_CHANGES application; reject closed/unauthorized states.
- Prevent duplicate applications under repeat/concurrent POSTs. A repeat of an
  already committed submission should safely return its existing confirmation.
- Keep /auth/me consistent with the committed transition to PENDING.
- Compute onboarding completion on the backend. A correction does not reset it.
- Preserve reviewer decision history according to the backend's agreed policy.

GET/PATCH draft response and null-clearing remain the earlier frontend proposal
in s2-07-organizer-draft.md; Aadel's DTO still needs nullable clearing support.

## Failure behavior and verification

- Missing/invalid fields: accessible field errors, focus the first invalid input,
  no POST. Enter in a field saves the draft; it never implicitly submits.
- 400/422: keep form values and show a validation error.
- 401: existing authentication handling returns to sign-in.
- 403/409: require a fresh draft read before another action.
- Network/5xx/malformed success: submission is unconfirmed, not assumed to fail.
  Lock writes and require Reload application; do not automatically retry POST.
- A failed reload keeps writes locked. A successful reload uses canonical canEdit.
- AbortController ignores late responses after leaving; it cannot undo a server commit.
- Pending requests lock both Save and Submit to prevent competing local writes.

Maintained regression tests belong in Git/CI. Browser fixtures, screenshots and
QA scripts stay outside the repository; no fake API is shipped in the app.
Real draft persistence, submission, resubmission and duplicate protection still
require backend integration tests once Aadel implements the agreed contracts.

## Checks performed

- Node 22.23.2: lint, TypeScript checks, production build and all 197 frontend tests passed.
- Includes 27 new submission/correction regression cases.
- Chromium API fixtures verified keyboard operation, Save/Submit separation,
  resubmission, pending navigation, uncertain results and read-only reload recovery.
- No horizontal overflow at 320, 390, 768 or 1440px; automated accessibility checks
  found no violations in eight tested states. Fixtures are not a real backend test.