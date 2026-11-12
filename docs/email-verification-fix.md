# Email verification and password-free recovery

## Registration and waiting state

Student and organizer registration return HTTP 201 after saving the account,
including when SMTP delivery fails. The response includes:

- `verificationEmailSent`: known delivery success or failure.
- `verificationExpiresAt`: the stored verification token's expiry, or `null` after
  failed delivery. Links last 10 minutes from token creation.
- `verificationRecoveryToken`: a signed, scoped 24-hour recovery capability for
  this newly created account. It cannot sign in or verify the email address.

Successful delivery shows **Check your email**, a masked address, and **Back to
sign in**. **Resend verification email** becomes available when the backend's
stored deadline expires and the account still needs verification. Known failure
shows the account-created explanation and **Retry sending** immediately.
For both students and organizers, this waiting page has no **Edit email** button,
address input, or link to an address form. Resend and retry use the scoped
registration capability to send to the account's stored address without asking
the user to enter it again.

The browser saves the registration's flow identifier, email, recovery capability,
deadline, and failure flag in router history and tab session storage. Updates are
reconciled only within the same flow. A successful retry replaces the old failure
state in both places, so refresh preserves **Check your email** without the old
warning. A later registration starts its own flow and cannot inherit another
account's result. Passwords and raw verification-link tokens never enter this
recovery context or its URLs.

`POST /api/email-verification/recovery-status` and
`POST /api/email-verification/retry` accept only `{ "recoveryToken": "..." }`.
The backend verifies the signature, audience, expiry, and user ID claim before
reading account state. A bare user ID, a login JWT, or an email override is not
ownership proof. The private response contains `verified`, `unavailable`, and
`expiresAt`; retry additionally returns `deliveryFailed`. Status is checked on
mount, focus, and at expiry, including after another tab verifies the account.
An expired capability keeps the masked address visible and directs the user back
to sign in for assistance, without opening an address form from the waiting page.

## Public email-only recovery

The separate public form, also offered for expired or invalid verification links,
labels its field **Enter the email you registered with.** and provides an explicit
**Send verification email** button. Typing or correcting text never sends mail. Each
submission reads the address currently visible in the input, even after a previous
request used a typo. No password, account ID, or registration capability is sent.
The form only requests mail; it never changes the stored email or password.
Changing an address entered incorrectly during registration is outside this flow.

`POST /api/auth/resend-verification` accepts only:

```json
{ "email": "student@example.com" }
```

Emails are validated, trimmed, lowercased, and limited to 255 characters. Extra
fields, including passwords and user IDs, return 400. The backend looks up that
address and sends only to the eligible account's stored email. Eligible accounts
are unverified and non-suspended; organizers pending moderator approval qualify.

Every valid request below the IP limit returns the same HTTP 200 body:

```json
{ "message": "If this address belongs to an account awaiting verification, check your inbox." }
```

Unknown, verified, suspended, unexpired-link, eligible, and failed-delivery cases
have the same response. No account-specific deadline, status, or delivery result
is returned. The form repeats the conditional message and stays editable. The
backend decides whether another email can be sent, including when the client
calls the API directly.

## Expiry, verification, and concurrency

Issuance and verification take a PostgreSQL user row lock with the same lock order.
Any unused, unexpired link blocks issuance of another link until its stored
`expiresAt`; the retired 60-second cooldown is no longer used. Concurrent requests
across tabs or API instances cannot issue multiple live links. SMTP runs after
the transaction; a failed attempt removes only its own token so retry is immediate.

Opening `/verify-email?token=...` never consumes a token, including under React
StrictMode. **Verify email** explicitly posts to
`POST /api/email-verification/verify-email`. Success shows **Email verified** and
**Go to sign in**, separately from the registration waiting screen. Malformed,
invalid, expired, and used links offer the editable public recovery form. The
client does not infer email ownership from a verification token.

Only verification-link hashes are stored in PostgreSQL. Raw verification links,
recovery capabilities, and passwords are excluded from application logs. Login
and existing-cookie protected routes require verified email. Organizer moderator
approval remains separate and is still required for organizer-only operations.

The public request limiter permits 30 attempts per IP per minute and returns 429
with `Retry-After`, independent of account existence. It is bounded and per process;
Express trusts Caddy's single proxy hop. Aggregate edge limiting for multiple API
replicas remains deployment work. No additional schema migration is needed.

## Local validation

`FRONTEND_ORIGIN` is required and validated during API startup as an HTTP(S)
origin without credentials, path, query, or fragment. `https://localhost:8443`
passes. Missing or malformed values produce an error naming `FRONTEND_ORIGIN`.
Compose supplies the local default. Mailpit at http://localhost:8025 captures test
mail and does not deliver to external inboxes.

In each app, run `npm test -- --maxWorkers=1`, `npm run lint`, and `npm run build`.
For isolated database/HTTP and real SMTP tests, run:

```sh
node tests/email-verification-db-check.mjs
```

The checker requires the root `.env`, local app dependencies, Docker access,
and running Compose PostgreSQL and Mailpit. It creates a unique `_test` database,
applies migrations and seed, runs the API database/HTTP tests, and drops only
that database afterward. The development database is untouched.

The focused UI tests cover both account types reaching the waiting page without
edit controls, returning to sign in, immediate retry after delivery failure, and
refresh after a successful retry. Page tests cover resend at the stored expiry,
explicit verification, and public recovery using the entered registered address.

API tests retain token hashing and expiry, single use, concurrent issuance and
verification, recovery capability validation, generic public responses, and
unchanged account credentials. One Mailpit test checks actual replacement-email
delivery and successful verification. Expiry fixtures avoid ten-minute waits.

The duplicate optional rendered live suite and its temporary HTTPS/API helper
have been removed. There is no `--live-ui` mode; use the regular frontend tests
and the existing database checker. These checks do not establish browser layout
or browser-console signoff.
