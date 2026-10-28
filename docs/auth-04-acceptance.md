# AUTH-04 implementation and acceptance handoff

Reviewed on 28 October 2026. This records current evidence, not Trello approval.

## Checklist

| Task | Implementation | Evidence / remaining check |
| --- | --- | --- |
| React, TypeScript, Tailwind | Complete | Strict type checking, lint and production build pass. |
| Routing and API client | Complete | One router/provider, relative `/api` transport, Vite proxy and HTTPS routing. |
| Reusable form components | Complete | Shared layouts, labels, field errors, password feedback and selects. |
| Account-type selection | Complete with approved navigation change | Login links directly to Student/Organizer; legacy `/register` redirects to login. |
| Student registration | Complete | Optional preferences, all interests, real creation and shared sign-in/dashboard handoff. |
| Multi-step organizer registration | Complete | Existing application form -> Review & Submit. Back retains drafts/file/policies; only final submission creates the account. |
| Validation/loading/success/errors | Complete | Backend-aligned password/name rules, server field messages, duplicate email, cancellation and duplicate prevention. Created-account login failure locks registration and links to sign in. |
| Real registration endpoints | Complete | AUTH-02 plus AUTH-03/main integrated; HTTPS/database checks confirmed both real creations. |
| Responsive/frontend tests | Implemented | Responsive CSS and review stacking exist. Automated DOM tests pass; final visual inspection is still required. |
| Production build/browser console | Build verified; browser audit pending | Production HTML/assets and API served by an isolated HTTPS stack. No browser-control tool was exposed in this session, so no fresh visual or console audit is claimed. |

## Changes needed to make integration work

- Integrated `origin/integration/auth-03-main-test` (`e890b72`), which includes AUTH-02/main and cookie authentication with the complete `/auth/me` profile.
- Aligned frontend passwords to the backend: 8-128 characters, ASCII uppercase/lowercase, digit and special character. Kept shared password feedback and validation on the same rule source.
- Removed the unsupported custom-category input. OTHER remains an accepted category enum, but no unsupported `customType` is sent. Proof files remain explicitly local; no fake URL is sent.
- Require first and last name parts for the organizer representative so the existing account-name mapping cannot silently submit an empty last name.
- Map custom backend messages such as "First name ..." and "Password ..." to the corresponding fields.
- Parse JWT lifetime configuration into numeric seconds. Raw environment text can otherwise be interpreted as a millisecond duration by JWT signing.
- Reuse the existing application configurator rather than registering duplicate CORS, validation and global-prefix settings.
- Generate JWT secrets with local startup credentials and provide explicit CI-only JWT configuration.
- Fixed a defect discovered through a real HTTPS request: pending/rejected/needs-changes organizers were accepted by organizer-only backend guards. Approved-organizer access now requires both ACTIVE status and one APPROVED organization; attendee access remains available to pending organizers.
- Removed two empty email-verification placeholders; this task does not implement email verification.

AUTH-05's provider, frontend guards, login/logout and client implementations were reused, not replaced. Backend integration fixes should be included in the backend owners' review.

## Verification performed

All database work used isolated databases ending in `_test`, generated temporary credentials, and separate Docker resources. No existing developer database was reset.

- Frontend local suite: 120 tests passed. Two opt-in live UI tests also passed against the real HTTPS backend.
- API unit/configuration suite: 82 tests passed.
- API/database end-to-end suite: 14 tests passed against migrated PostgreSQL.
- Startup-script suite: 11 tests passed, including generated JWT credentials and preserving existing configuration.
- API and frontend lint/build, Prisma validation, shell syntax and whitespace checks passed.
- Isolated production-mode Docker services started healthy behind Caddy TLS.
- Real HTTPS checks passed for invalid registration (400), duplicate email (409), invalid credentials (401), student creation/preferences persistence, organizer creation/pending status, cookie login, full `/auth/me`, wrong-role rejection, pending-organizer rejection (403), approval refresh, suspended-account rejection, expiry and logout cookie clearing.
- Production HTML and referenced assets returned successfully over HTTPS.
- React/jsdom forms were exercised against that real backend: student -> dashboard and organizer -> verified pending. These tests are not a real-browser audit.

Logout clears the browser cookie; this does not claim server-side revocation of a copied stateless JWT before its expiry.

## Reproduce

For normal development, run `./run.sh --watch` from the root and use the HTTPS URL it prints. Startup generates local credentials if `.env` is absent and adds missing JWT settings to older local configuration. Do not use placeholder JWT secrets.

Run frontend checks from `apps/web`:

```sh
npm run lint
npm test
npm run build
```

The live suites create test accounts. Run them only against an isolated local stack:

```sh
AUTH_TEST_BASE_URL=https://localhost:8443 \
AUTH_TEST_CA_FILE=.local/certs/root.crt \
node tests/auth-journeys.mjs
```

Set `JWT_SECRET` to the isolated stack's secret to include expired-token checks. Set `AUTH_TEST_DATABASE_URL` only to its dedicated localhost `_test` database to include controlled approval/suspension fixtures. Neither value is printed by the test script.

From `apps/web`, opt in to real UI/API tests:

```sh
AUTH_TEST_BASE_URL=https://localhost:8443 \
AUTH_TEST_CA_FILE=../../.local/certs/root.crt \
npx vitest run src/registration/live.test.tsx
```

API database tests require `TEST_DATABASE_URL` for a dedicated migrated `_test` database, plus JWT settings. CI config supplies these for its isolated PostgreSQL service.

## Remaining manual signoff

1. Review the production UI at desktop, 390px and 320px widths; verify no horizontal overflow, clipped controls, unreadable review values or overlapping notices.
2. Use keyboard-only navigation, check focus after Next/Back/errors and confirm labels/error announcements.
3. Open DevTools Console and Network. Complete both real journeys; confirm no unexpected errors, one registration POST per final submission, and no POST while reviewing/backtracking.
4. Confirm the assigned reviewer accepts the login-based account choice and two-step organizer workflow, then update the card and request review. No Trello state or PR approval was changed by this work.

Real document upload and real Terms/Privacy destinations require supplied backend/product contracts; the UI continues to disclose their current limitations. They must not be presented as implemented upload or approved policy documents.
