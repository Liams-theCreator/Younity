# Email verification work report

Test-suite cleanup: the optional live UI suite and HTTPS helper described in the historical validation below have since been removed. Current test commands are in `docs/email-verification-fix.md`. Core UI regressions and API database/Mailpit coverage remain.

Project: Younity  
Branch: `02-verification_email`  
Implementation and validation recorded: 11 November 2026

The email-verification fixes are implemented and the local automated checks pass. Actual narrow-screen rendering and browser-console inspection remain unverified because no interactive browser is available. Changes remain in the working tree; no commit, push, production deployment, pull request, or GitHub issue was created during this work.

## Scope and constraints

The work covered the initial email-verification audit, reproduction of the reported failures, implementation, permanent regression tests, local PostgreSQL/HTTP and Mailpit checks, and feature documentation.

The requested boundaries were preserved:

- Public recovery only requests a verification email. It does not change the stored email or password and never asks for a password.
- Correcting an address entered incorrectly during registration is outside this task.
- Account creation survives SMTP failure.
- Email verification remains separate from organizer moderator approval.
- Verification links remain single-use.
- Project-wide README and `run.sh` cleanup was deferred.
- During the final continuation, CI workflows, pipeline settings, and CI-specific tests were left untouched. One existing CI edit is identified separately below.
- No GitHub issue was opened.

## Initial audit and failure reproduction

The audit reviewed registration, verification, resend eligibility, mail delivery, frontend recovery, database migration/schema support, related tests, and documentation.

The main findings were:

1. The verification page preferred the original router handoff over newer session storage. After a successful retry, refreshing could restore the original delivery-failure warning and immediate retry state.
2. Public recovery hid the address input after submission and continued selecting the previously submitted address, preventing correction of a typo on the page.
3. The existing 60-second resend cooldown did not implement the requested policy of waiting until the current 10-minute link expires.
4. Startup validation accepted a missing `FRONTEND_ORIGIN`, allowing a server to start even though it could not construct verification links.
5. Documentation contained stale authentication claims and incorrect local access/setup instructions. Production SMTP configuration and browser signoff also remained incomplete.

The original audit baseline passed 105 API unit tests, 134 standard frontend tests, 49 database/HTTP tests, and 11 startup-script tests, plus both apps' lint/build checks. Those counts describe the earlier code, not the completed implementation below.

At the start of the final continuation, the existing focused frontend run reproduced **16 passing and 8 failing tests**, including the unfinished refresh regression. A new corrected-address regression also failed before the public form repair: after the first request, the email input was no longer present.

Temporary audit-only reproduction tests were removed. The final regressions are permanent feature tests alongside the code.

## Implemented behavior

### Public email-only recovery

The public form now keeps its email input visible and editable and provides an explicit **Send verification email** button. Editing text does not trigger a request. Each submission reads the controlled input's current value and sends only:

```json
{ "email": "student@example.test" }
```

The address is trimmed and lowercased. A previous submission, registration capability, or private deadline cannot select a different recipient. Duplicate submissions are blocked while a request is pending; the user can still edit the input for the next explicit submission.

The backend looks up the submitted address and sends to the eligible account's stored email. Eligibility requires an unverified, non-suspended account with no current unused, unexpired link. Organizers awaiting moderator approval remain eligible for email verification.

The public endpoint remains:

```text
POST /api/auth/resend-verification
```

Valid requests below the IP limit return the same HTTP 200 body for unknown, verified, suspended, eligible, unexpired-link, and failed-delivery cases:

```json
{ "message": "If this address belongs to an account awaiting verification, check your inbox." }
```

No account-specific deadline, verification status, or delivery result is returned publicly. Passwords, user IDs, and other undeclared fields are rejected. The form does not update account credentials or treat a user ID as ownership proof.

An intermediate draft supplied a public presentation deadline and hid the input after submission. That approach was removed. The final public form remains editable and relies on server-side eligibility rather than private timing information.

### Post-registration waiting page and refresh persistence

Successful registration delivery shows **Check your email**, the masked address, and **Back to sign in**. It does not show **Email verified** merely because an email was sent.

Known delivery failure preserves the saved account and offers **Retry sending** without waiting for link expiry. After a successful retry, the warning and failure flag are cleared and the new stored deadline is saved.

Each registration/recovery context has a flow identifier. Session-storage updates are reconciled only with the matching router flow. The waiting page also replaces router history state when its deadline or failure flag changes. Refresh therefore preserves the successful retry result, while a later registration starts with its own outcome.

Registration responses now include:

| Field | Purpose |
| --- | --- |
| `verificationEmailSent` | Known success or failure of the registration send attempt. |
| `verificationExpiresAt` | The verification token's stored expiry, or `null` after delivery failure. |
| `verificationRecoveryToken` | A signed capability for private status checks and retries for the newly created account. |

The frontend validates this response and uses the server deadline directly. It no longer creates a fresh client-side wait on refresh. Passwords and raw email-link tokens are not placed in registration recovery state or recovery URLs.

### Private recovery status and retry

To keep accurate account timing private, registration receives a scoped, signed recovery capability. Two endpoints accept only `{ "recoveryToken": "..." }`:

```text
POST /api/email-verification/recovery-status
POST /api/email-verification/retry
```

The capability lasts 24 hours and uses the `email-verification-recovery` audience. The backend validates its signature, audience, expiration, and UUID claim. It has no login-token subject and cannot authenticate a normal session or verify the email address.

The private status response contains `verified`, `unavailable`, and `expiresAt`; retry also reports `deliveryFailed`. Bare user IDs, email overrides, login JWTs, forged capabilities, and expired capabilities are rejected.

The registration page checks status on mount, focus/visibility return, and at the stored deadline. It can detect verification completed in another tab and avoid offering another resend. An expired recovery session provides a route to public email-only recovery.

### Stored expiry and concurrency

Verification links last **10 minutes from token creation**. Issuance checks for an unused token whose stored `expiresAt` is still in the future. The retired 60-second cooldown is no longer the resend deadline.

Issuance and verification use the existing PostgreSQL user row lock with a consistent lock order. Eligibility is checked on the server, so direct requests and simultaneous requests from different tabs cannot bypass the deadline or create multiple live links.

SMTP runs after the issuance transaction. On delivery failure, only that attempt's token is removed, allowing immediate retry. Verification still atomically consumes the submitted link and invalidates the account's remaining outstanding links. No additional schema migration was introduced.

### Verification result and access control

Opening an email link does not consume it, including under React StrictMode. The user must explicitly press **Verify email**.

Successful verification shows **Email verified** and **Go to sign in**, separately from the waiting page. Invalid, malformed, expired, or used links expose the editable public recovery form. The frontend does not infer account ownership from a verification token.

Login and existing-cookie protected routes still reject unverified accounts. An email-verified organizer can sign in while moderator approval is pending, but organizer-only access remains blocked until approval.

### FRONTEND_ORIGIN startup validation

Validation was added through the existing API environment-validation mechanism. `FRONTEND_ORIGIN` must be a nonempty HTTP(S) origin without credentials, a path, query, or fragment.

`https://localhost:8443` passes. Missing values produce `FRONTEND_ORIGIN is required`; malformed values produce an error naming `FRONTEND_ORIGIN` and explaining the accepted format. Permanent tests cover valid, missing, blank, and malformed values.

## Files changed

| File | Final change |
| --- | --- |
| `apps/web/src/pages/EmailVerificationPage.tsx` | Separate public form, registration waiting state, and explicit verification result; current-input submission; private status/retry; history persistence. |
| `apps/web/src/auth/emailVerification.ts` | Flow identifiers, scoped recovery context, and reconciliation of matching stored/router state; removal of the old frontend cooldown constant. |
| `apps/web/src/registration/useRegistration.ts` | Save the returned capability and exact backend expiry in the new registration flow. |
| `apps/web/src/registration/service.ts` | Parse and validate registration delivery, expiry, and recovery fields. |
| `apps/web/src/pages/EmailVerificationPage.test.tsx` | Corrected-address, no-auto-send, keyboard, duplicate submission, expiry, cross-tab verification, failure, and explicit verification regressions. |
| `apps/web/src/registration/integration.test.tsx` | Permanent failed-send → retry → refresh → later-registration regression and server-deadline handoff checks. |
| `apps/web/src/registration/service.test.ts` | Response contract, missing/invalid expiry, and failed-delivery recovery tests. |
| `apps/api/src/auth/email-verification/email-verification.service.ts` | Stored-expiry eligibility, private recovery capabilities/status/retry, generic public response, and returned issuance deadline. |
| `apps/api/src/auth/email-verification/email-verification.controller.ts` | Private status and retry routes with validation and no-store responses. |
| `apps/api/src/auth/email-verification/email-verification.module.ts` | Recovery JWT configuration and retry rate-limit guard registration. |
| `apps/api/src/auth/email-verification/settings.ts` | Recovery audience and existing 10-minute TTL; removal of the old account cooldown setting. |
| `apps/api/src/auth/dto/verification-recovery.dto.ts` | New validated DTO accepting only the signed recovery token. |
| `apps/api/src/auth/registration/registration.service.ts` | Return recovery capability and stored expiry for both roles while retaining accounts after SMTP failure. |
| `apps/api/src/auth/registration/registration.controller.ts` | Update feature endpoint documentation for private retry and link-expiry behavior. |
| `apps/api/src/config/environment.ts` | Required startup validation for `FRONTEND_ORIGIN`. |
| `apps/api/src/auth/email-verification/email-verification.service.spec.ts` | Stored expiry, hash/delivery behavior, public response, and capability validation tests. |
| `apps/api/src/auth/registration/registration.service.spec.ts` | Updated registration response and delivery-failure expectations. |
| `apps/api/src/config/environment.spec.ts` | Valid, missing, blank, and malformed origin cases. |
| `apps/api/test/email-verification.e2e-spec.ts` | Real PostgreSQL/HTTP expiry and concurrency checks, capability rejection, immediate retry, generic responses, corrected-address Mailpit delivery, and credential preservation. |
| `apps/api/test/registration-database.e2e-spec.ts` | Update the verification-service test double for the new registration contract. |
| `tests/email-verification-db-check.mjs` | Runs API database/HTTP and Mailpit checks in a disposable database. |
| `docs/email-verification-fix.md` | Current contracts, privacy boundary, behavior, local reproduction commands, and validation record. |
| `report.md` | This consolidated report. |

Temporary styling from an intermediate draft was removed; the verification stylesheet has no final diff.

## Permanent regression coverage

The final tests cover:

- A saved registration whose first email fails, immediate retry succeeds, and refresh keeps **Check your email** without the old warning.
- A later registration in the same tab showing its own address and delivery result.
- Submitting a typo, editing without sending, and submitting the corrected visible address in the second request.
- The public form ignoring a prior registration capability and private deadline.
- Keyboard-only public submission and duplicate-request prevention.
- Stored deadlines surviving refresh without restarting a wait.
- The old 60-second threshold not permitting a new send while a link remains live.
- Expiry and simultaneous retries using controlled clocks or database fixtures rather than a real 10-minute sleep.
- Verification completed in another tab suppressing resend.
- Immediate retry after another known SMTP failure.
- Public response equivalence across eligibility and delivery states, without private timing fields.
- Rejection of user IDs, credential fields, email overrides, and invalid recovery capabilities.
- Unchanged stored email and password hash after corrected-address recovery.
- Explicit verification, invalid/expired/used links, single use, unverified access rejection, and separate organizer approval.

## Final local verification results

| Check | Result |
| --- | --- |
| API unit suite | **123 passed, 0 failed**. |
| Standard frontend suite | **142 passed, 0 failed**; three opt-in live tests skipped in this standard run. |
| PostgreSQL/HTTP suite with SMTP enabled | **53 passed, 0 failed**. |
| Explicit live React/HTTPS/Mailpit suite | **3 passed, 0 failed**, including all three tests skipped by the standard frontend run. |
| API lint and production build | Passed. |
| Frontend lint and production build | Passed. |
| JavaScript syntax checks for the local verification scripts | Passed. |
| `git diff --check` | Passed. |
| DOM keyboard submission | Passed. |
| Interactive narrow-screen/browser-console inspection | Blocked by browser availability; not claimed as passed. |

The three live journeys established:

1. Student registration → Mailpit delivery → explicit verification in a fresh context → sign-in and student dashboard.
2. Organizer registration → Mailpit delivery → explicit verification → sign-in with pending moderator status; organizer-only access returned 403.
3. Public typo request → correction in the still-editable input → explicit second submission → one new Mailpit message to the corrected registered address, with stored credentials unchanged.

Both role journeys rejected sign-in before email verification. The corrected-address journey checked the actual second request payload and verified that no message was delivered to the typo address.

An initial live-fixture run passed the two role journeys but failed the new public journey because jsdom/Vite exposed `import.meta.url` as an HTTP URL unsuitable for Node's `createRequire`. The fixture was corrected to resolve the API package from the live runner's known working directory. The subsequent full database/live run passed all 53 HTTP tests and all three live journeys.

Earlier frontend lint findings in the unfinished draft—reading `Date.now()` during render and updating a test observer during render—were also corrected. Final lint/build and test runs passed after those corrections.

## Local reproduction commands

From `apps/api`:

```sh
npm test -- --maxWorkers=1
npm run lint
npm run build
```

From `apps/web`:

```sh
npm test -- --maxWorkers=1
npm run lint
npm run build
```

From the repository root, with local dependencies installed and Compose PostgreSQL/Mailpit running:

```sh
node tests/email-verification-db-check.mjs
```

The checker requires the root local configuration, Docker access, and running PostgreSQL/Mailpit services. Configuration secrets, passwords, and recovery tokens are not included in this report.

## Test isolation and cleanup

Database checks created unique databases ending in `_test`, deployed the committed migrations, seeded only those databases, and removed the databases after completion. No development database was reset or migrated by these checks.

The live helper used the current compiled API, a generated test JWT secret, a temporary localhost HTTPS proxy, and a disposable certificate trusted explicitly by the test client. It did not change the system trust store or replace the existing development API.

The temporary API/proxy processes, TLS files, and test databases were cleaned up on both the failed fixture run and the successful rerun. The existing development stack was left running as found during the final continuation. Mailpit captured local test mail; no external-inbox delivery was used as evidence.

## Browser limitation

Browser inventory returned no available applications or browsers. An explicit attempt to create an in-app browser returned:

```text
Browser is not available: iab
```

Consequently, there is no new real-browser evidence for narrow-screen layout, screenshots, console errors, or interactive browser keyboard behavior. The passing keyboard and live-form tests use rendered React DOM; their HTTP, database, and SMTP operations are real, but they are not browser rendering checks.

## Existing CI edit for separate review

The working diff already contained this addition in `.github/workflows/ci.yml`, in the API job's environment:

```yaml
FRONTEND_ORIGIN: https://localhost:8443
```

That line was added during the earlier unfinished implementation, before the instruction to leave CI untouched. It was preserved unchanged during the final continuation and remains visible for separate review. No further workflow, pipeline-setting, or CI-specific test changes were made. Hosted CI was not run as part of final verification.

## Deferred findings and unchanged areas

The following are future-issue notes only; no GitHub issue was opened:

- Project-wide documentation still has stale authentication/integration statements.
- Root README and `run.sh` access URLs omit the Compose HTTPS port, and host-side setup instructions need a separate Mailpit/setup review.
- Real-inbox delivery and authenticated production SMTP configuration remain deployment work; the tested transport is local Mailpit.
- Interactive browser layout and console signoff remain outstanding.
- Database tests emitted an existing `pg` concurrent-query deprecation warning. Tests passed; investigating that warning was outside this feature's scope.

The project-wide README, `run.sh`, startup-script tests, account email/password update workflows, and moderator approval logic were left untouched by this continuation.

## Follow-up: no Mailpit email after editing the address

After the user reported that edited-address requests still produced no mail, the running local stack was inspected separately from the workspace and isolated test stack.

The API and frontend containers were still running the earlier intermediate implementation. The frontend container contained the old **Edit email** flow and did not contain the final **Send verification email** form; its source hash differed from the workspace. The API source also differed and still returned the intermediate public presentation deadline. This explains why the previously passing workspace tests did not establish which UI the user's running containers were serving.

Mailpit was healthy and the API's SMTP connection check succeeded. A read-only database summary showed eligible unverified accounts; it did not establish whether the particular address the user submitted belonged to one of those accounts. No existing account's address, password, or token was printed during diagnosis.

Only the local API and frontend services were rebuilt and restarted using:

```sh
docker compose up -d --build --no-deps --wait api web
```

PostgreSQL, Mailpit, and Caddy were not restarted or reset. Both rebuilt services became healthy. Runtime API and frontend source hashes then matched the current workspace, and the frontend contained **Send verification email** rather than the old **Edit email** button. No application-source or CI changes were needed for this follow-up.

A disposable account was then exercised through the rebuilt running API and its actual Mailpit transport:

- Registration saved the test account and delivered the initial verification email.
- Only that account's test link was expired with a controlled database fixture.
- Submitting an unknown typo returned the generic response without delivering mail to the typo.
- Submitting the corrected eligible registered address returned the same generic response and delivered one new verification email to the registered address.
- The stored email and password hash remained unchanged.
- The delivered link verified successfully; reuse was rejected; sign-in succeeded and issued a session cookie.
- The disposable account, its profile, and its verification-token rows were removed afterward. Existing accounts were unchanged. The two local test emails were retained in Mailpit for delivery inspection; their disposable account and tokens no longer exist.

The user should reload the page at `https://localhost:8443` to discard any old UI still open in the browser. Public recovery still does not change the address saved during registration: a different address must already belong to an eligible unverified account. Repeated submissions also cannot bypass an existing link's 10-minute expiry. These eligibility rules were preserved, not relaxed to make delivery tests pass.
