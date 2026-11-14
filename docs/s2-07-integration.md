# S2-07 — API contracts and integration handoff

Owner: Smail
Reviewer: Oussama
Baseline: feature/s2-07-onboarding at 8ec7d7c

Implemented contracts and proposed extensions are distinguished below.

## Authentication

- POST /api/auth/login accepts email and password.
- The backend sets the HttpOnly, Secure, SameSite=Lax access_token cookie.
- Frontend requests use credentials: 'include'; the browser sends the cookie.
- Do not store tokens/passwords in browser storage or send a Bearer token.
- GET /api/auth/me currently returns id, email, role, status and organization.
- AuthProvider stores the parsed session in React state; components use useAuth().
- POST /api/auth/logout clears the cookie; the frontend confirms logout with /me.

For organizers, organization.verificationStatus is PENDING, APPROVED,
NEEDS_CHANGES or REJECTED. Current /me does not expose onboarding completion.

## Implemented student preferences API

| Endpoint | Purpose |
| --- | --- |
| GET /api/student/preferences | Restore the signed-in student's preferences. |
| PATCH /api/student/preferences | Save interests and supplied academic fields. |

Both require an ACTIVE, email-verified STUDENT with an existing student profile.
Ownership comes from the JWT. Do not send user IDs, roles or completion flags.

Successful GET/PATCH responses return HTTP 200 with all five fields:

```json
{
  "interests": ["AI_DATA", "ROBOTICS_IOT"],
  "university": null,
  "academicField": null,
  "studyLevel": null,
  "opportunityFormat": null
}
```

PATCH rules:
- At least two distinct, supported interests are required.
- Academic fields are optional: omission preserves a value; null clears it.
- Nonempty university values are trimmed and limited to 255 characters.
- Use exact Prisma enum values, including ENVIRONMENT_ARGO.
- Invalid values, duplicate interests and unknown fields return 400.
- Missing/expired authentication returns 401; ineligible access returns 403.

Frontend behavior:
- GET may return fewer than two interests for an incomplete profile.
- Failed/malformed reads show an error and Retry, not an editable empty form.
- Failed saves preserve unsaved inputs; repeated submissions are prevented.
- A confirmed save navigates to the current dashboard and refreshes /me.
- The dashboard is a temporary destination; event discovery is not implemented.
- Saving preferences does not itself mark onboarding complete.
- Optional interests in the existing signup wizard do not establish completion.

Source:
- apps/web/src/student/preferences.ts
- apps/web/src/pages/StudentPreferencesPage.tsx
- apps/api/src/student/student-preferences.controller.ts
- apps/api/src/student/student-preferences.service.ts
- apps/api/src/student/update-preferences.dto.ts
- apps/api/prisma/schema.prisma

## Expected onboarding contract — proposed, not implemented

Aadel owns backend completion information; Smail owns frontend parsing/routing.

Proposed additive /me fields:

```json
{
  "onboarding": {
    "complete": false,
    "nextStep": "SELECT_INTERESTS"
  }
}
```

Next steps: SELECT_INTERESTS, COMPLETE_ORGANIZER_APPLICATION or NONE.

Required behavior:
- The backend calculates completion from persisted facts.
- Incomplete users resume the required step after login/reload.
- Incomplete users cannot reach completed-account destinations.
- Every student completion path requires verified email and two distinct interests.
- Organizer onboarding completes only after successful verified submission.
- NEEDS_CHANGES keeps onboarding complete; application status routes to correction.
- One-time approval display requires persisted acknowledgment, proposed as
  organization.approvalAcknowledged. Browser-only storage is insufficient.

## Integration responsibilities

| Area | Handoff |
| --- | --- |
| Verification | Abdellah supplies screens/APIs; Smail connects shared routing. |
| Organizer draft | Aadel supplies owner-only read/save APIs; Smail restores/saves forms. |
| Submission/corrections | Aadel supplies APIs; Smail connects validation and form actions. |
| Application status | Aadel owns fetch/refresh/actions; Smail connects navigation and draft links. |
| Decision notice | Said supplies the component; Aadel integrates it into the status page. |
| Approval acknowledgment | Confirm backend endpoint/persistence; Smail connects exit actions. |

Verification branch 091c1b3 exposes:
- POST /api/email-verification/verify-email with a token body field.
- POST /api/auth/resend-verification with an email body field.
- Unverified login/session denial: 403 with code EMAIL_NOT_VERIFIED.

These changes are not yet merged into this branch. Email verification alone
does not establish a session or approve an organization.

Aadel's draft DTO at 1b6ccad contains organizationName, type,
representativeFullName, academicPosition, phoneNumber and optional proofUrl.
Runnable draft/submission endpoints and final response shapes are not yet present.
Confirm route names, absent-draft response, clearing semantics, error codes,
allowed actions and acknowledgment behavior before connecting the client.

Draft/submission rules:
- Confirmed absent draft: display an empty form.
- Failed draft retrieval: display an error and Retry.
- Persist saved organization fields, never passwords.
- Draft saving and submission are separate operations.
- Submission requires verified email and complete required application fields.
- Supporting documents are not mandatory under the PO's current rule.
- NEEDS_CHANGES allows editing/resubmitting the same application to PENDING.
- REJECTED applications cannot be edited/resubmitted.
- The backend enforces ownership, permissions and state transitions.

## Shared files and integration checks

Shared frontend integration points:
- apps/web/src/auth/AuthProvider.tsx
- apps/web/src/auth/parseSessionUser.ts
- apps/web/src/auth/getAuthDestination.ts
- apps/web/src/auth/AuthRoutes.tsx
- apps/web/src/pages/StudentRegisterPage.tsx

Preview merge results at this baseline:
- main 70531c3: no content conflicts.
- Verification branch 091c1b3: conflict in StudentRegisterPage.tsx.
  Preserve optional academics/payload omission and verification handoff.
  Retain both verification and preferences routes.

Preferences checks passed:
- Frontend lint/build and 128 tests; two optional live tests skipped.
- Backend lint/build, 82 unit tests and 48 database/API tests.
- Manual saving, restoration, error, access and responsive checks.
- Additional keyboard, contrast and enum compatibility checks.

These results do not prove unfinished onboarding journeys.
After integration, verify real verification, login/reload resume, draft restore,
submission, correction/resubmission and approval acknowledgment.

Keep maintained tests in Git/CI. Temporary QA scripts, screenshots, logs,
environment files and test databases stay local.