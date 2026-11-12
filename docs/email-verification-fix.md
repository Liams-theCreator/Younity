# Email verification and password-free recovery

## Contract and behavior

Both student and organizer registration return 201 with `verificationEmailSent`.
Account creation is retained after SMTP failure. Successful delivery hands off to
**Check your email**, a masked address and **Back to sign in**. After 60 seconds,
**Didn’t receive it? Resend email** becomes available. Failed delivery instead
shows the account-created explanation and **Retry sending** immediately, using
the existing account. The browser carries only email and timing context in router
state and tab session storage; registration passwords never enter resend state,
storage or URLs. Existing query-based email handoffs remain compatible.

`POST /api/auth/resend-verification` accepts an email-only DTO:

```json
{ "email": "student@example.com" }
```

Emails are validated, trimmed, lowercased and limited to 255 characters. Extra
fields, including passwords, return 400. Login still requires a password and
verified email. Eligible recipients are registered, unverified and non-suspended;
organizers pending moderator approval are eligible. Recipient and eligibility
are checked again under the PostgreSQL user row lock.

Every valid resend request below the IP limit returns HTTP 200 with:

```json
{ "message": "If this address belongs to an account awaiting verification, check your inbox." }
```

The same status/message covers unknown, already verified, suspended,
cooldown-suppressed and failed-delivery addresses. SMTP failure must not identify
an eligible account. The browser repeats this conditional message without
claiming successful delivery. Failed SMTP attempts delete only their own token,
preserving immediate backend retry and any older delivered links. The explicit
registration failure flag provides immediate UI retry of a known delivery failure.
After a generic resend response, the browser waits 60 seconds before another try.

The existing PostgreSQL row lock and 60-second per-account cooldown serialize
concurrent resends across API instances. SMTP runs after the transaction. The new
request-level guard allows 30 attempts per IP per minute, independent of account
existence; exhausted clients receive 429 with `Retry-After`. It is bounded and
per-process. Express trusts one proxy hop; the deployed topology must expose only
Caddy, which supplies the client IP. Multi-instance deployment should additionally
apply an aggregate IP limit at the edge. There was no existing app-level request
limiter. No schema migration is required.

Verification links expire after 10 minutes. Opening the page does not consume a
token, including under React StrictMode; **Verify email** explicitly submits to
the existing `POST /api/email-verification/verify-email` endpoint. Success shows
**Email verified** and **Go to sign in**. The grouped invalid/expired/used 400
shows **This link is no longer valid**, **Request a new link** and **Go to sign in**.
Known email context enables one-click resend; fresh browsers/devices ask only for
the email. The client does not infer email from a token. Unverified login clears
the password and hands the email to the same recovery page.

Only token hashes are stored. Raw tokens and passwords are excluded from API
responses and application logs. Login and existing-cookie protected routes still
require email verification. Organizer approval remains a separate moderator
requirement for organizer-only event operations.

## Development and validation

Compose starts Mailpit before the API. Links use `FRONTEND_ORIGIN`, defaulting to
`https://localhost:8443`. Mailpit at http://localhost:8025 captures local test mail;
it does not deliver to external inboxes. Environment examples include host SMTP
settings. Frontend presentation timings match the API's existing verification
settings; API timing and locking remain authoritative.

- In each app: `npm test -- --maxWorkers=1`, `npm run lint`, `npm run build`.
- `node tests/email-verification-db-check.mjs` provisions a unique `_test` database,
  migrates/seeds it, runs API database/HTTP tests including real SMTP to Mailpit,
  then drops only that database. It requires the root `.env`, local API
  dependencies, Docker access, and running Compose PostgreSQL and Mailpit.
- `tests/auth-journeys.mjs` checks HTTPS registration, Mailpit, verification,
  unverified-login rejection, sign-in and role protection.
- `apps/web/src/registration/live.test.tsx` runs the real API/Mailpit journey
  through rendered React forms when local HTTPS test variables are supplied.

Automated coverage includes both registration outcomes and roles, email-only
validation, generic public responses, cooldown and concurrent resends, expiry and
single use, unverified sessions, moderator approval separation, page confirmation,
masked handoff, timing across reload, one-click known-address recovery and
email-only recovery on another device.

## Verified on 10 November 2026

- API: all 105 unit tests and all 49 isolated PostgreSQL/HTTP integration tests
  passed, including real Mailpit SMTP, email-only DTO/Swagger validation,
  public response equivalence, concurrent resend locking and request limiting.
  The temporary test database was removed after the run.
- Frontend: all 134 standard tests passed with one worker. The first parallel
  run had one 5-second timeout in an existing registration test; the full serial
  rerun passed. The two normally skipped live tests were then explicitly enabled
  and both passed against the running HTTPS stack and Mailpit.
- Both live form journeys completed registration → Mailpit delivery → explicit
  verification on a fresh context → sign-in. Both rejected unverified sign-in;
  the organizer remained pending approval and organizer-only access returned 403.
- The existing HTTPS authentication smoke script passed for both roles, including
  Mailpit, token reuse rejection, cookies, role protection and logout.
- API and frontend lint and production builds passed.
- Browser inventory was empty. Real browser layout, screenshots and console
  inspection could not be verified; the live UI checks used rendered React DOM
  forms with real HTTP/SMTP, not an interactive browser.
