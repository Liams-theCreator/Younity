# Younity frontend

React 19, TypeScript, Vite, Tailwind CSS 4, and React Router. AUTH-04 owner:
oussama; reviewer: abdellah. Branch: `feature/auth-04-registration-ui`.


**Latest organizer change:** At the owner's request, Account credentials and all
four fields (First Name, Email, Password, Confirm password) were removed.
The organizer wizard is now Organization details → Policies → Review. No hidden
account-field validation runs. Organization fields/files stay optional previews,
and policy acceptance is required to advance to Review. Values/files survive Back.
Final submission explicitly reports unavailable integration and never invokes the
account-based service, even if a success adapter is injected. No pending redirect
occurs from this preview. The team must approve a credentials-free organizer
contract or an authenticated organizer-onboarding flow before integration. The
older implementation records below describe the earlier account-based version.
Student registration and its submission lifecycle are unchanged.

## Run and verify

From `apps/web`, using the Node version in the repository-root `.nvmrc`:

```bash
npm ci
npm run dev
npm run build
npm run lint
npm run test
```

`npm run test:watch` reruns interaction tests while editing. The production
build checks TypeScript before bundling. Vitest follows the backend's choice
of test runner; Testing Library and jsdom exercise the rendered UI. Tests
use injected registration outcomes and test-only policy URLs. They do not
prove real API integration or browser rendering.

For the containerized HTTPS setup, follow the root README.

## Routes and current behavior

| Route | Behavior |
| --- | --- |
| `/`, `/register` | Account-type selection |
| `/register/student` | Account form plus local discovery-preference preview; Back/Continue preserve both drafts |
| `/register/organizer` | Account details → Policies → Review; Back/Next preserve all values |
| `/organizer/pending` | Pending-verification screen; direct visits do not claim a successful submission or confirmed account status |

Registration is **not integrated with a real API**. The checked-out backend
contains only the starter GET controller and an empty Prisma schema. Approved
SPRINT-01 outcomes, registration DTOs/controllers, policy destinations,
and student success behavior were not found. The Stitch export was supplied
later and has now been inspected (see the visual alignment record below). The user confirmed
that approved planning outcomes/contracts are still being requested from the
team. AUTH-04 remains incomplete.

The first name, student last name, email, password, and password confirmation are a **provisional
UI draft**, not an approved backend payload. Validation currently checks
required values (including a nonblank last name for students), basic email syntax,
matching passwords, and explicit policy
acceptance. Password minimum length/complexity, organization fields, uploads,
are not inferred. Student discovery choices now follow the supplied reference as a local UI preview only. No network request is
made by the production registration service. Attempting submission reports
unavailability and never shows simulated success.

No auth context, token storage, protected routes, shared API client, or login
screen was introduced. The pending route is a presentation page, not an
authorization boundary. Navigation state is not proof of verification. Leaving
a form resets its draft; student and organizer step changes preserve it. Passwords are not
stored in local/session storage, put into navigation state, or shown on Review.

## Files and concepts

| File | Responsibility / C++ comparison |
| --- | --- |
| `src/App.tsx` | Router chooses a component from the URL, similar to dispatching by a key |
| `src/pages/StudentRegisterPage.tsx` | `useState` owns the draft; controlled inputs display state and update it on change |
| `src/pages/OrganizerRegisterPage.tsx` | Parent owns draft and step index; conditionally rendered children do not own persistent values |
| `src/components/RegistrationForm.tsx` | Shared labeled inputs, policy acceptance, layout and status; props are typed function arguments |
| `src/registration/model.ts` | Draft type resembles a struct; validation returns an error map without changing its argument |
| `src/registration/service.ts` | Registration-local boundary; outcome union resembles a tagged variant, not an API response definition |
| `src/registration/useRegistration.ts` | Shared submission lifecycle; Promise is an asynchronous result, `await` resumes after completion |
| `src/registration/focus.ts` | Moves keyboard focus to the first invalid field |
| `src/index.css` | Light palette, focus styles, responsive grids and layout |
| `src/registration/registration.test.tsx` | User interaction tests using injected services |

React redraws a component when its state setter is called. Updating an ordinary
local variable does not trigger a redraw. `{ ...current, [field]: value }`
creates a new object with one field replaced, similar to copying a struct then
assigning a member. The draft remains in its parent while wizard steps mount
and unmount.

The submission hook uses both a ref and state: the ref locks synchronously
against duplicate calls; state displays loading and disables the fieldset.
`finally` restores controls after every outcome. Errors retain the draft for
correction/retry. Organizer success navigates to the pending page; student
success currently has an inline state for testing only, pending an approved
student flow. Neither success is reachable with the production stub.

## Manual verification

1. Open `/register`; check Student and Organizer links using mouse and keyboard.
2. On Student, submit an empty form. The first invalid input gains focus, and
   labels, inline errors and `aria-describedby` identify the problem.
3. Try a malformed email and mismatched passwords. Complete the fields, then
   submit without checking policies; acceptance is explicitly required.
4. On Organizer, try Next with empty fields. Enter details, proceed to Policies,
   and verify Next requires acceptance. Check the box and reach Review.
5. Use Back twice: first name, email, passwords and policy acceptance remain.
   Review displays no password. Edit fields and verify the review updates.
6. Submit either form with valid draft values. Production must report that
   registration is unavailable, create no account, and remain on the form.
7. Visit `/organizer/pending` directly. It must not claim registration success
   or a confirmed verification status.
8. At desktop width (1440px) and mobile widths (390px and 320px), check readable
   labels/errors, usable buttons, no horizontal overflow, and keyboard focus.
   Check the browser console. Headless Brave verification now passed at 1440px,
   390px and 320px for all four routes, with no horizontal overflow or browser
   console warnings/errors. A manual Chrome check remains useful for team review.
9. Use `npm run test` for delayed submission, disabled Back/submit controls,
   repeated submission, injected network/server/field failures, retry and
   successful organizer navigation. These are test fixtures, not live requests.

## Integration handoff: information needed

Ask SPRINT-01/backend owners for the approved backend branch/PR and:

- Both registration HTTP methods and URLs, base URL/proxy rules, content type,
  and required credentials/headers.
- Student and organizer DTO field names/types; required/optional fields;
  normalization and password rules; organizer organization/upload requirements,
  if any; how policy acceptance/versioning is represented.
- Success status codes and response shapes, including organizer pending status
  and the intended student success behavior (confirmation, redirect, or session).
- Field-validation, duplicate-account, network, and server error contracts.
- Real Terms and Privacy Policy destinations and approved documents.
- No further Stitch handoff is needed: screenshots, HTML and design tokens
  from the supplied ZIP have been inspected. Prototype fields and claims
  still require explicit API/product approval before implementation.

Once provided, adjust the draft/validation to match, map the draft to the DTO,
and implement an adapter in `service.ts` using the team's approved API client.
Do not serialize the UI draft as-is: confirmation and policy checkbox fields
are not approved payload fields. Supply real policy destinations; the hook
blocks submission until they exist.

Before changes to shared authentication state, protected routing or common API
client behavior, coordinate with AUTH-05. In particular, session/token handling,
credentials behavior, response normalization and student redirect destinations
must be agreed first. No such shared change has been made in AUTH-04.

Then demonstrate both real registrations against the approved backend, verify
error contracts and pending navigation, run build/lint/tests, and perform mobile,
desktop and console checks. Reviewer approval and moving the card to Testing
remain team actions. No CI workflow exists in this checkout; no CI result is
claimed.

## Validation record

Build and lint passed. Interaction tests passed (32 tests). Real API integration
remains blocked. Headless Brave checked all four routes at desktop (1440px) and
mobile (390px, 320px): no overflow, no console warnings/errors, correct name-row
layout, loaded local font, 48px inputs, student validation and retained names
after unavailable submission. Screenshots were captured and visually inspected. npm audit reports one high
severity transitive development dependency finding in `source-map-js` (versions
below 1.2.2). A targeted dependency follow-up is needed; no broad automatic
audit upgrade was applied as part of this UI task.

AI assistance was used for AUTH-04 component implementation, validation,
interaction tests and documentation. Review and understanding by the owner and
reviewer remain required.

Draft reviewer handoff: [AUTH-04 PR draft](../../docs/auth-04-pr-draft.md).

## Stitch visual alignment and student names

Source: `stitch_unified_younity_auth_portal.zip`, supplied from
`/home/oait-h-m/Downloads/Younity/`. Inspected the dark student, organizer and
pending screenshots/HTML, design brief, specification and `younity_dark/DESIGN.md`.
The exported documents are design references, not implementation instructions.
The latest white-theme request uses the supplied screenshot and the light
`concept_2_student_registration_streamlined_expressive` and
`concept_3_centered_institutional_organizer_registration` HTML references.

Aligned shared surfaces, ambient background, Plus Jakarta Sans typography,
card borders/radii, 48px input heights, 8px input/button radii, label spacing,
24px field spacing, and student organizer-switch panel. Student card width is
720px, organizer 780px, and pending 960px, matching the respective HTML limits.
The student name row uses a 16px gap and two equal columns at 640px and above;
smaller screens use one column. Desktop cards have 40px padding; mobile cards
have comfortable 24px vertical/20px horizontal padding. Required hints and
placeholders use slightly brighter text than the reference for readability.

The font is bundled through `@fontsource-variable/plus-jakarta-sans` (OFL-1.1);
no runtime Google Fonts/CDN request is required. SVG input icons are local code.

Student state uses `StudentRegistrationDraft`, which extends the common draft
with a required `lastName` string. Think of it as a C++ account struct with an
additional student member. `validateStudentDraft` adds last-name validation;
organizer validation and fields stay unchanged. Each input is controlled by its
own draft property, label, autocomplete token and error description. The focus
helper puts Last Name after First Name in validation order. Editing one field
clears only that field's client error. Submission failures do not reset values.

**Contract mismatch:** the UI now collects separate First Name and Last Name,
but no approved API contract exists to establish whether the backend accepts
two fields or one combined name. No HTTP payload mapping has been added or
changed. `lastName` is only a UI draft property. Confirm the approved name DTO
before implementing the adapter; do not assume it accepts `firstName`/`lastName`
or silently concatenate them.

Intentional reference differences: keep real Terms/Privacy acceptance and
password confirmation; do not add university dropdowns, enforced password-strength rules,
unapproved login/completion navigation, real uploads, fake dossier
IDs/timestamps, review-stage claims, or invented support destinations. Existing
organizer Back/Next behavior is preserved. Pending amber styling is used only
when reached with the existing successful-registration navigation context; a
direct visit continues to avoid claiming a registered account.

Latest white-theme browser evidence is in `/tmp/younity-auth04-white-visual/` (12 screenshots
and `results.json`). Checked with an isolated headless Brave profile, not the
user's signed-in browser. No real API integration was demonstrated.

## White theme maintenance

All registration routes now use the light Stitch palette: page `#f7f9fe`,
white cards/inputs, text `#181c20`, cobalt actions `#2854d9`, darker blue links,
and light gray-blue panels. The shared header uses a cobalt rule and names the
current registration context, with a two-step indicator on the local student preview. Error text uses dark red on pale red; pending status
uses dark amber on pale orange. Browser-native inputs use `color-scheme: light`.

The variables at the top of `src/index.css` define the page, card, text,
border, primary, link and panel colors. Change these named values to keep the
forms consistent. No authentication behavior or payload mapping changed.

Build, lint and all 32 interaction tests passed after the theme change.
Headless Brave checked all four routes at 1440px, 390px and 320px, including
white computed card/input backgrounds, light color scheme, no horizontal
overflow, name layout, preserved values and zero console warnings/errors.
Captured desktop/mobile screenshots were visually reviewed. The university
selector, enforced password rules/security guarantees and prototype navigation remain
excluded until their contracts are approved.

## Password feedback and Sign In handoff

`src/components/PasswordFeedback.tsx` displays the four Stitch suggestions:
8+ characters, a number, a special symbol, and an uppercase letter. Each check
updates from the controlled password value; four bars count the checks met.
There are no timers or preset success/strength values. This is advisory UI,
not a security guarantee or approved backend validation. Server password policy
must still be supplied by SPRINT-01. Existing required/matching-password checks
and API boundaries remain unchanged.

`AccountFields` includes an accessible Show/Hide password button. It changes
only the input type, preserves the password, never submits the form, and is
disabled with the fieldset while a registration is pending. The confirmation
input remains masked. Checklist values are computed during rendering rather
than stored in separate state; like a C++ function of the current string,
they cannot get out of sync with the entered password.

`src/components/AlreadyHaveAccount.tsx` displays the “Already have an account?
Sign In” footer below registration. The merged AUTH-05 login screen is available
at `/login`; `App.tsx` passes that route through `signInPath` to the student and
organizer registration pages. The root route continues to show account selection.

Tests in `src/registration/passwordFeedback.test.tsx` cover live feedback,
reduced feedback after edits, spaces, visibility, advisory validation,
unavailable login, and navigation to an injected test-only login destination.
All 32 tests, build and lint passed. Headless Brave checked four routes at
1440px, 390px and 320px, including feedback, visibility, names retained after
unavailable submission, and zero console warnings/errors. Screenshots are in
`/tmp/younity-auth04-password-visual/`.

## Organizer application and pending-page alignment

The user confirmed keeping Back/Next rather than switching to the prototype's
single-page form. The application still has three internal steps and then the
separate `/organizer/pending` route. The supplied organizer screenshots and the
light `concept_3_centered_institutional_organizer_registration` and
`concept_3_institutional_organizer_application_pending_approval_status` HTML
informed numbered sections, the external review notice, document selection
surface, consent card, amber status banner, timeline and support layout.

`src/components/OrganizerSections.tsx` supplies the numbered organization and
lead-organizer sections plus the review notice. `registration/organizationDraft.ts`
defines local preview values. The parent page owns these values and a selected
`File`, so they survive Back/Next just like the original account draft. Document
selection supports the file picker, drag/drop and removal, including reselecting
the same document. This selects a local file only; it does not upload it.

New organization name, category, campus, representative name, position and phone
fields are explicitly optional UI previews pending approved DTOs. Category
labels come from the design concept, not backend enum values. Campus remains a
text input until an approved institution/campus list exists. No attachment
format, size limit or mandatory proof rule was inferred from the prototype.
Preview details and documents are **not passed to the registration service**.
Existing first-name/email/password validation and policy acceptance remain.

`OrganizerPendingPage.tsx` shows a two-column timeline/support layout on desktop
and stacks it on mobile. Navigation after an injected/real service success
shows receipt and pending verification; a direct visit shows status unavailable
and no confirmed timeline stages. No fake application ID, timestamp, received
upload, active review, email receipt, support email, WhatsApp number or event
route is shown. Links point to actual application/account-selection routes.
Status remains presentation-only, not an auth boundary or server status lookup.

For manual checks: enter organization details and valid account fields, use
Next, choose a document and accept policies, then reach Review. Back twice must
retain organization values and the selected filename; Remove must allow choosing
the same file again. Production submission still reports unavailable. Visit the
pending route directly to inspect its layout without a false success claim.

Build, lint and all 32 tests passed. Headless Brave verified all four routes at
1440px, 390px and 320px, including organizer Back/Next, retained organization
values, document-step layout, review layout and zero console warnings/errors
or overflow. Screenshots: `/tmp/younity-auth04-organizer-visual/`.

Remaining organizer handoff: approved DTO fields/required rules and category
values, institution/campus data, upload endpoint/format/size requirements, real
status response/stage semantics, and official support destinations. These must
be approved before integrating the new preview values into any API request.

## Student step 2: local discovery-preference preview

The latest request explicitly adds this screen to student registration/onboarding
scope. Its source is the supplied screenshot and the actual
`student_onboarding_set_discovery_preferences/code.html` export. That filename
and the optional Skip action suggest onboarding, but do not establish approved
registration timing. No approved preferences controller, DTO, endpoint or
student completion flow exists in this checkout.

`StudentPreferencesForm.tsx` renders eight discipline radio cards, four academic
level radio choices, ten interest checkboxes and three optional format checkboxes.
`registration/studentPreferences.ts` holds reference labels and pure local
validation: a discipline, an academic level and at least two distinct valid
interests. These labels are not backend enum IDs or approved required rules.
Nothing is preselected from the screenshot's example values. Native radios
support arrow keys; checkboxes support Space. Selection is shown with color and
checkmarks, with visible focus and associated inline errors.

`StudentRegisterPage.tsx` owns both drafts and the step index, like a C++ struct
owned by a longer-lived controller. Changing the displayed child does not destroy
its values. Continue validates account details and opens the preview **without
calling registration**. The existing Create student account action remains
separate until submission timing is agreed. Back retains names, email, passwords,
policy acceptance and preferences in memory. Refresh/leaving the page resets
them; passwords are never persisted. `useLayoutEffect` moves focus to the heading
when the step changes, after React commits the screen, without a delayed focus
change overriding subsequent validation.

Save validates the reference choices, then explicitly reports unavailable
integration. Skip also reports the missing completion flow. Neither makes a
request, claims success, registers an account again, or navigates to a placeholder
destination. Existing registration outcomes and shared authentication behavior
are unchanged.

The white 896px reference frame uses local Plus Jakarta Sans, cobalt progress
segments, pale discipline/chip surfaces and sky selected cards. Four study/level
columns become two below 768px and one below 360px; format columns and actions
stack on mobile. Card spacing follows the export, with explicit preview guidance
added so the screen cannot be mistaken for connected onboarding.

Manual verification:

1. Enter valid step-1 values and accept policies; choose Continue to preferences.
   No account should be created. Empty details must keep you on step 1.
2. Try Save with no choices: focus moves to study and errors describe required
   selections. Select a study, level and one interest: Save still requires two.
3. Select two interests and an optional format. Save must report unavailable,
   retain selections and keep the current page. Skip must also remain here.
4. Use Back, verify all account values, then Continue. Preferences must remain.
5. Tab through choices, use arrow keys on radios and Space on checkboxes.
   Inspect selected states/focus at 1440px, 390px and 320px.

Integration decisions needed: registration versus post-registration timing;
approved option IDs/DTOs, required selections and format rules; endpoint/method,
response/error contracts and authentication requirements; Save and Skip behavior
and actual completion destination. Coordinate any session/protected-route/shared
client changes with AUTH-05. Do not pass the preferences draft to the current
registration service or serialize reference labels as API IDs.

Latest checks: build and lint passed; 37 tests passed, including preview-only
forward/back navigation, retained values, selection validation, keyboard radios,
Skip and zero registration calls from step 2. Isolated headless Brave checked
1440px, 390px and 320px, forward/back retention, study-grid stacking and console
errors. Evidence: `/tmp/younity-auth04-student-step2-visual/`. Real API integration
remains blocked and AUTH-04 is not complete.

## Organizer screenshot refinement

The latest organizer screenshot and matching light Stitch HTML were inspected.
The frame remains 780px with white cards, 40px desktop padding, 48px inputs,
local Plus Jakarta Sans and the existing cobalt/pale-panel tokens. The progress
indicator now sits above the review notice with three segments for the actual
Account details → Policies → Review wizard. The reference's two segments describe
its single application screen plus status; copying that count would misrepresent
this required multi-step form. `/organizer/pending` remains separate.

`OrganizerProgress` lives in `OrganizerSections.tsx`; step labels live in
`registration/organizationDraft.ts`. Shared `AccountFields` accepts an optional
email companion so organizer email and the existing local phone preview appear
side by side, without duplicating account inputs or changing student layout.
Password/confirmation are paired; all pairs stack below 640px. Numbered sections,
heading rules, consent/review panels and right-aligned desktop actions use the
same design across steps. Step heading focus runs after React commits the screen.

No payload, shared auth behavior, registration adapter or pending navigation
condition changed. Only the final step submits. The existing synchronous request
lock and disabled fieldset prevent duplicate submission and Back during loading.
Success navigation still requires a successful service outcome; production cannot
reach it because the real backend adapter/contracts are absent. Success tests use
explicit injected fixtures and do not demonstrate a real registration response.

Intentional reference differences: organization/representative/phone fields and
files remain optional local previews; campus is a text input without an approved
campus catalog; no fixed +212 phone prefix, required PDF/DOCX or 10MB limit is
imposed; no academic privileges, notification timing or email-domain verification
claim is made. Account fields and actual Terms/Privacy acceptance remain. The
header's Back to Sign In appears only when the login owner provides `signInPath`.

Build and lint passed. All 38 tests passed, including added progress/step validation
and final-step-only submission coverage plus existing document retention, pending
lock, server errors and success navigation fixtures. Headless Brave checked all
four routes at 1440px, 390px and 320px with zero console warnings/errors and no
horizontal overflow; organizer Back/Next and retained values passed. The same checks passed against the production build. Desktop
application and mobile proof-step screenshots were visually compared with the
reference. Evidence: `/tmp/younity-auth04-organizer-refined-visual/`.

Real API registration/upload verification remains unavailable until approved
backend contracts and implementation are supplied. No commit or push was made.

## AUTH-05 merge

The login UI is in `src/pages/LoginPage.tsx` and `src/components/LoginForm.tsx`,
with page-specific CSS modules. `src/auth/` contains the login service and session
state, guards, logout and tests owned by AUTH-05. AUTH-04 owns shared API transport
and registration/pending UI. `main.tsx` mounts one `BrowserRouter` and one
`AuthProvider`; `App.tsx` defines the sole guarded `/organizer/pending` route.
Login updates the provider and returns to guarded pending when requested, or
account selection otherwise. Session errors block protected content and offer
retry. Logout waits for the server and blocks protected content on failure.

The existing Vitest/jsdom setup runs auth and registration tests together.
The auth adapter uses cookie credentials for `/api/auth/login`, `/api/auth/me`
and POST `/api/auth/logout`. These endpoints are not implemented in this API
checkout; logout and live session behavior require backend verification. The
session response currently exposes ID and email only, so the guard verifies
sign-in, not organizer role or approval status. AUTH-04's pending UI remains a
preview; authentication does not validate the application details it displays.
No new shared HTTP transport or pending UI was introduced.
Registration API and onboarding integration limitations described above still apply.


## AUTH-05 integration update - 26 October 2026

The latest AUTH-05 implementation is merged into AUTH-04. `main.tsx` mounts
one BrowserRouter, `App.tsx` mounts one AuthProvider, and `AuthRoutes.tsx`
defines the single route table. The root and the legacy `/register` URL redirect to `/login`. Login links lead directly to student and organizer registration; no account-selection screen is rendered.
AUTH-04 registration forms, provisional payload mappings and production
unavailable behavior remain intact. The existing Vitest/jsdom configuration
runs registration and auth suites together.

`ProtectedRoute` and `getAuthDestination` replace the earlier sign-in-only guard.
Active students reach `/student/dashboard`; approved active organizers reach
`/organizer/dashboard`; pending organizers reach `/organizer/pending`; rejected
or needs-changes organizers reach `/organizer/status`. Unsupported or suspended
profiles are blocked. The one pending route renders AUTH-04's pending page:
development can show the existing preview, while production explicitly reports
that application details are not connected. Local registration preview states
are not server authorization decisions.

Auth startup and login parse an ID, email, role, user status and organization
verification status. Protected requests returning 401 expire shared auth state.
Logout verifies that `/api/auth/me` no longer returns a session. Earlier narrow
auth tests are superseded by AUTH-05 flow/service coverage, with merged routing
and production pending behavior tested in `App.test.tsx`.

This frontend expects cookie-based `/api/auth/login`, `/api/auth/me` and
`/api/auth/logout`. It is not proof of compatibility with the bearer-token
backend branch or approval of a changed backend contract. Backend owners must
confirm cookies, logout and the full session profile before real end-to-end
acceptance. Registration and file upload remain unconnected. The jury PDF is a
historical snapshot from before this merge.


### Registration navigation

Start at `/login`, then choose Join as Student or Organizer to open the matching
registration form directly. `/` and legacy `/register` URLs (including a trailing
slash) redirect to `/login`. Registration back links and the shared registration
brand link return to sign in. The old account-selection page has been removed.
Auth session, guards and logout behavior are unchanged by this navigation update.

## AUTH-04 real registration handoff - 26 October 2026

Registration now posts JSON through the existing `apiRequest` transport to
`/api/auth/register/student` and `/api/auth/register/organizer`, in development
and production. A confirmed response must contain the created account's ID and
matching email; HTML fallbacks are rejected. Validation messages and duplicate
email conflicts are shown without starting login. Network failures do not claim
that no account was created, because a response can be lost after server success.

Payload mapping follows AUTH-02's `6398da6` DTOs: all selected interests are sent
as an array, academic preferences are mapped to database enums, and unsupported
`customType`, UI-only confirmation/policy fields and fabricated proof URLs are
omitted. The unsupported third-year option is not offered. Organizer account
names currently derive from the representative's full name; backend name errors
are shown on that field. Selected proof documents remain local and are not sent;
real upload integration is a separate requirement.

Students can create an account immediately or choose optional preferences first.
Submitting preferences includes them in registration; Skip creates the account
with empty preferences. Both flows call the existing AUTH-05 `signIn` only after
account creation, then replace the route with `/login`, where shared role/status
rules choose the destination. The pending-route renderer matches AUTH-05's latest
verified-session status screen rather than a local dossier simulation.

If creation succeeds but sign-in fails, the page shows "Account created; please
sign in." and locks registration submission. The user can retry login on the
existing login page without posting registration again. In-flight requests are
locked against duplicates and cancelled on unmount. No new auth provider, cookie
strategy, logout behavior, guard implementation or transport was introduced.

Use the integrated HTTPS stack that routes `/api` to the backend. Vite alone on
port 5173 does not supply API endpoints or an API proxy. The checked-out API still
contains only starter controllers; AUTH-02 and AUTH-03 must be integrated into the
running backend. AUTH-03's currently fetched `/auth/me` implementation still returns
only ID/email, while AUTH-05 needs role/status/organization fields. A real login
journey therefore also requires that backend session contract to be completed.
Local API ports were unavailable during this implementation, so automated tests
use HTTP response fixtures; they do not establish live database or cookie behavior.
