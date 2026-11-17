# S2-03 Organizer applications

The organizer draft and submission endpoints use the signed-in organizer’s session cookie. The backend derives ownership from the session. The frontend does not send an owner ID.

| Endpoint | Request and response |
|---|---|
| `GET /api/organizer-applications/draft` | Returns `200 { draft, canEdit }`. A new organizer gets `{ "draft": null, "canEdit": true }`. While review is pending, the response contains the submitted fields with `canEdit: false`. When changes are requested, the editor opens with saved corrections if available, or the previously submitted fields. |
| `PATCH /api/organizer-applications/draft` | Send only changed fields. Omitting a field preserves it. Sending `null` clears it. Incomplete drafts can be saved. Success returns `200 { draft, canEdit: true }`. Saving while the application is pending, approved, or rejected returns `409`. |
| `POST /api/organizer-applications/submit` | Takes no request body. A verified organizer with a complete draft receives `201 { "application": { "id": "...", "status": "PENDING" } }`. First submission creates revision 1. Resubmission after `NEEDS_CHANGES` keeps the application ID, advances the revision, and preserves decision history. An incomplete draft returns `400`, an unverified organizer receives `403`, and a repeat submission while pending returns `409`. |
| `GET /api/auth/me` | For organizers, `onboarding` is `{ "complete": false, "nextStep": "COMPLETE_ORGANIZER_APPLICATION" }` until the first successful submission. It then becomes `{ "complete": true, "nextStep": "NONE" }` and stays complete during corrections. Approval status is separate. |

## Form fields

Submission requires `organizationName`, `type`, `representativeFullName`, `academicPosition`, and `phoneNumber`. `proofUrl` is optional. Saving a draft does not create an application for admin review.

## Verification

The local API run passed lint, all 149 unit tests, and 101 end-to-end tests. One end-to-end test was skipped. The organizer tests cover owner isolation, draft recovery after signing in again, explicit field clearing, incomplete and unverified submission, onboarding completion, and resubmission with preserved review history.
