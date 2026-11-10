# S2-07 verification checkpoint

Integration: onboarding branch at 1ae7506 plus Abdellah's 091c1b3.
This checkpoint supersedes the verification-pending notes in s2-07-integration.md.

## Implemented

- Both registration forms lead to /verify-email without automatic login.
- Student academic fields remain optional; existing preferences routes remain available.
- Verification and resend reuse Abdellah's screens, APIs, migration and Mailpit setup.
- The recovery context stores only email, resend timing and delivery-failure state
  in sessionStorage. It never stores a password, access token or verification token.
- Unverified login clears the entered password and offers email-only recovery.
- An unverified session on reload redirects protected routes to login with a
  verification notice instead of reporting a service outage.
- Verification does not establish a login session or approve an organizer.
- Shared authentication distinguishes EMAIL_NOT_VERIFIED from other failures.

## Local use

- Set FRONTEND_ORIGIN=https://localhost:8443 in the root .env file.
- Run ./dev.sh for checks followed by startup, or ./start.sh for development.
- Register at https://localhost:8443 and open Mailpit at http://localhost:8025.
- Open the delivered link, confirm verification, then sign in.
- Use fresh test accounts to verify the whole registration journey.

## Validation

- Frontend lint/build passed: 147 tests passed; two optional live tests skipped.
- API lint/build passed: 105 unit tests passed.
- Database/API suite: 60 tests passed, including real SMTP delivery via Mailpit.
- Migration tested on fresh and existing-data isolated databases; schema agrees.
- Real Chromium journeys passed for both roles, including unverified login,
  reused links, resend and secure HttpOnly cookie handling.
- Student preferences still save; organizers remain PENDING after verification.
- Verification layouts checked at 320, 390, 768 and 1440px; no overflow.
- Automated WCAG checks found no violations in the three checked verification
  states; no uncaught JavaScript exceptions occurred.
- The existing pg query-concurrency deprecation warning remains in the database
  foundation test; it is separate from this integration.
- Temporary QA scripts, screenshots and test databases stay outside version control.

## Still pending

The combined Trello item "verification and onboarding routing" is only partially
complete: verification is integrated, but /auth/me still lacks completion/nextStep.
Automatic onboarding resume, completion gating, organizer drafts/submission and
approval acknowledgment remain separate implementation/integration work.
The current student dashboard and organizer pending page are existing destinations,
not evidence that the remaining onboarding requirements are implemented.