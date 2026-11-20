# S2-07 final onboarding integration

This handoff supersedes the earlier S2-07 proposal documents for this integration.
Nothing was pushed or merged remotely by this work.

## Audited revisions

| Branch | Revision | Integration result |
| --- | --- | --- |
| feature/s2-07-onboarding | ca54a7f | Preserved draft/submission frontend and tests. |
| main | bbd094a | Includes Aadel's final GET/PATCH/submit wrappers and admin decisions. |
| S2-03_draft | e145a70 | Older POST-only draft controller; use main's d9db156 integration instead. |
| feat/admin-panel | 42346ac | Already included in main; review revisions/outbox preserved. |
| S2-05-06_Admin-integration | 5f84f74 | Combined locally; retained admin read API, screens and real integration runner. |
| S2-06_Admin-application-api | b3318f0 | Read API included through the admin integration branch. |
| 02-verification_email | 969b143 | Verification fixes already included through main; kept incoming verification fixtures. |

Older AUTH-05, email and standalone admin UI branches are superseded; do not merge
them again. readme-update is documentation-only and is not required here.

Conflicts resolved: take main's verificationIntegration.test.tsx, then retain both
admin and onboarding routes in AuthRoutes/getAuthDestination. Do not choose an
entire side for the routing files. The final files include both features.

## Implemented behavior

- /auth/me calculates student completion from at least two distinct saved interests;
  academic values remain optional. Organizer completion still means a submitted
  application exists, including NEEDS_CHANGES and REJECTED applications.
- Incomplete students resume /student/preferences; unsubmitted organizers resume
  /organizer/application. Completed-account destinations redirect to that step.
- Session parsing accepts old branch fixtures without additive fields; when supplied,
  malformed completion/acknowledgment metadata fails the session check. The current
  integrated API always supplies completion for students and organizers.
- /auth/me exposes the owner's safe application id/status/reviewerNote and a boolean
  organization.approvalAcknowledged. It never exposes acknowledgment timestamps.
- Review status comes from the actual application when present. This prevents stale
  organization status after request-changes/reject decisions from misrouting users.
- Resubmission synchronizes organization.verificationStatus to PENDING inside Aadel's
  existing transaction; application ID, revisions, decisions and outbox are retained.
- Visible pending pages refresh shared AuthProvider state every 30 seconds and on
  returning to the tab. Hidden tabs do not poll. No WebSockets or notification center.
- Feedback is shown briefly, with expandable text for long notes. Corrections use the
  existing draft editor; closed applications have no edit/resubmit action.
- Approved organizers see /organizer/approved until choosing an exit. Both buttons
  POST /api/auth/acknowledge-approval (no body; 204); backend ownership, verified
  approved organizer access and persisted acknowledgment are enforced.
- The nullable organizations.approval_acknowledged_at migration preserves existing
  data. Repeat acknowledgments preserve the original timestamp. A new login/browser
  skips the approval page after acknowledgment. Opening the page alone does not ack.
- Failed acknowledgment stays on approval with Retry via the exit buttons. Navigation
  intent survives the session refresh, so the events choice is not lost to dashboard.
- /events is an honest discovery placeholder; event discovery and management remain
  separate backlog work. Existing dashboard placeholders are retained.
- Admin integration fixtures now create a completed student for authorization tests,
  and clean student profiles/notifications. Muted admin text contrast was corrected.

## Validation

- Node 22.23.2, PostgreSQL 17, newly migrated isolated databases.
- API lint/build and 167 API unit tests passed.
- All 135 database/API tests passed; one existing optional test is skipped.
- Frontend lint/TypeScript/production build and 288 tests passed. The 9 normally
  skipped admin live tests were separately enabled: all passed against real HTTP
  APIs/PostgreSQL, including decision history, revisions and email outbox persistence.
- Real Chromium HTTPS flow: login, draft save/reload, submit, read-only pending,
  admin request-changes, saved corrections, same-ID resubmit, automatic approval
  refresh, failed/retried acknowledgment, events exit and fresh-login dashboard.
- Real student login resumes interests; saving two interests without academics
  completes onboarding and a new login resumes dashboard. Admin list/detail were
  checked in the same combined frontend/backend.
- Approval layouts checked at 320/768/1440px. Automated accessibility checks covered
  read-only submission, corrections, approval, acknowledgment failure, student
  dashboard and admin detail. QA fixtures/screenshots/scripts remain outside Git.
- Migration status and schema/database diff passed. Existing pg driver deprecation
  warnings still appear in upstream database tests; no dependency upgrade is bundled.

## Local handoff

1. Start with a clean feature/s2-07-onboarding branch. Fetch origin.
2. Merge origin/main; resolve verificationIntegration.test.tsx with main's version.
3. Merge origin/S2-05-06_Admin-integration; resolve routes using the final files.
4. Apply this change's source files and new migration. Keep maintained tests tracked.
5. Rebuild API/Prisma, deploy migrations and restart services. Never reset the DB.
6. Run frontend checks and backend checks against a separate database ending _test.
7. Manually exercise both roles and admin decisions before requesting final review.

The implementation is ready for code review. Remote CI, teammate approval and the
merge into main must still be completed on the actual PR. Do not mark review done
based only on these local checks.