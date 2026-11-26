# S3-09 — organizer event and participant screens

Owner: Oussama. Reviewer: Smail. Branch: `S3-09_Event-creation-participants`.
Started from main `474efaf` on 2026-11-20. No teammate branch was merged or copied
into this feature branch.

## Delivery status

The current organizer interface follows the supplied Academic Kinetic design
system from `DESIGN.md`: Plus Jakarta Sans, cobalt actions, cool tonal surfaces,
12px cards, a 256px desktop sidebar, tablet icon rail, and a native modal mobile
navigation drawer. The campus illustration remains a labeled example cover.

The production frontend now uses one S3-01 adapter in `events/service.ts`, based on
[Abdellah's PR #21](https://github.com/Liams-theCreator/Younity/pull/21) at
`615926aaee0fc582d878d73f90d73e1e90ec2567`. His backend stays on its own branch.
No backend writer was copied or reimplemented. PR #21 was open when inspected.
This checkout's API has not incorporated that module and was not running during
browser verification.

Supported frontend integration includes new draft creation, draft GET/PATCH,
direct publication, and saved-draft publication. The form uses the six required
core draft fields, 255-character title, required publication categories/deadline,
future publication start, and database capacity/URL limits. New events use
AUTOMATIC (Younity RSVP) registration as the frontend default. Saved EXTERNAL
registration settings are restored. Room/campus controls are hidden for this
adapter because their separate fields are outside the DTO.

**Remaining API dependencies prevent complete live acceptance.** PR #21 has no
draft-list, category-list, upload, or participant APIs. The category callback uses
`GET /api/categories` from `origin/feature/s3-07-event-discovery`
(`CategoriesController`, `{ categories: [{ id, name, slug }] }`). That discovery
module must be integrated into the target API. Draft listing and bookings retain
injected callbacks and render their unavailable states until the owners supply
those endpoints. No guessed collection routes or generated category IDs are used.

## Screens and permissions

Approved ACTIVE organizers can use:

- `/organizer/events/new` — event details, format/venue, schedule and registration/media.
- `/organizer/events/:eventId/edit` — loads the actual saved draft into that form.
- `/organizer/events` — draft cards, loaded-draft count, search, sorting and edit links.
- `/organizer/bookings` — confirmed/cancelled tabs, read-only table, current-page
  search and adapter-provided previous/next navigation.

Existing session/onboarding/approval-acknowledgment guards remain. Anonymous,
student, admin, suspended and unapproved organizer sessions cannot mount these
screens or start their reads. Backend denial removes displayed event/participant
data. The protected transport handles session expiry on HTTP 401.

## Creation behavior

Event Details contains title/description counters and category chips/options
supplied by the category callback. The Markdown helper, preview toggle and
bottom documentation/support/accessibility footer were removed at the user’s
request. Descriptions remain editable plain text. Missing categories are reported;
no catalog is invented.

Format & Venue uses radio choices with a visible selected state. In-person/hybrid
location and online/hybrid links appear conditionally. Optional room/campus controls remain available to injected integrations;
the S3-01 adapter hides them because their persistence mapping is pending. Campus suggestions must be supplied through `service.campuses`.

The schedule panel starts expanded as in the reference. Presets use the current
local date. The Monday-first calendar supports arrows, Home/End and Page Up/Down
(Shift changes year); selecting a date does not submit the form. Time selectors offer half-hour choices. The Custom time option has been removed;
a saved nonstandard minute value is retained as an option when editing. The separate End date field was removed. New schedules use the selected
calendar date for both times; existing multi-day draft dates are retained. Duration and timezone
are calculated from actual selections. No sample date/time is inserted.

Edits remain staged until Apply Schedule. Cancel/Escape restores applied values
and focuses the trigger. Save/publish are blocked while schedule edits are staged,
including programmatic form submissions. Validation-summary links reveal and focus
category/schedule controls. Changing the schedule does not imply a registration
deadline or attendee timezone-conversion service.

Registration & Ticketing contains optional positive capacity, a conditional
deadline/external link, and banner controls. Existing drafts retain their stored
AUTOMATIC/EXTERNAL setting. New events use the integration-owned
`service.registrationMode` setting; the UI does not guess a default. If it is absent,
partial draft saves remain possible and publication is disabled with feedback.
The design's zero-for-unlimited behavior is not assumed. The title/description
limits default to the reference's 100/2000 presentation bounds; `service.rules`
replaces them with the backend owner's final policy. Required categories/deadlines
also come from those rules.

The custom campus artwork is a visual example:
`apps/web/public/images/campus-gathering.webp`. It is labeled Example image
in the banner panel and never populates `values.imageUrl`. Selected safe HTTP(S)
URLs update both thumbnails. File selection/drop requires the optional owner's
`uploadBanner` callback. The UI checks PNG/JPEG/WebP and 5MB; server validation
remains authoritative. Only the callback-confirmed URL is used, concurrent uploads
and event writes are blocked, and leaving the page aborts pending requests.

The attendee card previews current form values; its RSVP button is disabled.
It does not claim price, registrations or available spots. Header and action-dock
buttons share the same guarded write operation. Last-saved time and success
feedback require a confirmed callback response; Discard restores that snapshot
or the empty form after confirmation. No backend deletion is performed.

The S3-01 adapter requires title, description, format, start/end dates and
registration mode on draft saves. Injected integrations can retain partial-draft
validation through their rules. Validation failures preserve entered values. Unknown/
lost responses and conflicts lock writes until saved data is inspected/reloaded.
No write is automatically retried. Permission/not-found errors remove the editor
and preview. The page stacks on mobile, keeps labels/focus feedback and reserves
space for input icons and the fixed dock.

## Bookings

Confirmed/Cancelled are keyboard-accessible tabs with Arrow Left/Right and
Home/End navigation. Each selection resets pagination/search and ignores aborted
or stale responses. Loading, API error/retry, no-data and no-search-match states
appear separately; a failed refresh removes stale participant rows.

The table shows attendee, email, event, ticket, booking time, cancellation time
and status, plus cancellation reasons when supplied. `ticketCode`/`cancelledAt`
are optional presentation fields; absent values show a dash. No ticket is generated
and no booking mutation action is included. Counts/search describe the loaded
page, not all registrations. Pagination metadata comes from the adapter. The table
scrolls on mobile and has a named focusable region, header scopes and caption.

## API handoff

`apps/web/src/events/model.ts` defines frontend view models.
`App.eventServices` defaults to `organizerEventService`; callers can inject an
existing integration. `service.ts` is the single frontend HTTP boundary for S3-01.

| Callback/data | Purpose |
| --- | --- |
| `registrationMode` | Owner-supplied registration setting for new events; no selector. |
| `rules` | Final field bounds and category/deadline requirements. |
| `categories` | S3-01 category IDs/labels. |
| `campuses` | Optional owner-supplied location suggestions. |
| `uploadBanner` | Optional image upload integration returning a confirmed URL. |
| `drafts` | Current organizer's draft summaries; optional artwork/location. |
| `draft(id)` | Saved values, identity and last-saved timestamp. |
| `saveDraft({id?, values})` | POST/PATCH through the S3-01 adapter; returns the confirmed saved draft. |
| `publish({id?, values})` | New forms POST /publish; saved drafts POST /:id/publish without a body. |
| `bookings({status, page})` | Aadel's owner-scoped data and pagination metadata. |

Adapters receive the existing protected request and AbortSignal. They must map
local datetime strings, null/omission, inactive mode fields and optional UI venue
details according to S3-01. Do not POST the view model blindly or duplicate the
owner's save/publish/upload clients.

Needed before full live acceptance:

1. Integrate Abdellah's PR #21 backend and the discovery category catalog module.
2. Supply an owner-scoped draft-list contract and Aadel's confirmed/cancelled
   participant contract, including pagination and error examples.
3. Confirm the new-event registration default and any future venue/media mapping.
4. Exercise the full authenticated API/database journey and obtain team review.

For saved drafts, edited values must be explicitly saved before publication.
Publication sends no implicit PATCH and never retries. Local form datetimes are
converted to ISO timestamps using the browser's displayed timezone. Responses are
mapped back to local datetimes, retaining seconds/milliseconds when supplied.
Blank nullable fields become null; categoryIds preserves [] clearing. HTTP 400/422
maps field messages; 403/404/409 and unknown outcomes retain the editor's existing
restriction and recovery behavior. A successful save exposes an Open saved draft
link, allowing access to the authoritative GET route while listing is pending.

## Verification and local preview

Run from `apps/web`: `npm run lint`, `npm run build` and
`npm test -- --maxWorkers=1`. Frontend fixtures exercise callbacks and do not
establish API/database acceptance. Focused checks cover route permissions,
conditional/validation states, live preview versus confirmed saves, both action
locations, duplicate/uncertain writes, schedule staging and keyboard navigation,
file handling, 401/403, missing drafts, search/pagination and booking tabs.

Local Docker URL: `https://localhost:8443/organizer/events/new`.
`./run.sh` does not watch source by default. Rebuild/recreate the web service after
editing or use `./run.sh --watch`. No production preview fixture is registered.

Browser access reported an unavailable host on 2026-11-23. The responsive rules
and keyboard behavior have automated coverage where applicable; fresh browser
visual/mobile verification remains outstanding. Earlier `.local/s3-09/`
screenshots show previous designs and do not approve the current reference.

Latest automated verification (2026-11-23): **338 frontend tests passed**, including
**50 focused event tests**; 9 opt-in S2 API integration tests were skipped.
Frontend lint, TypeScript/production build and the Docker frontend image build
passed. The image was rebuilt after the custom-time focus fix.

Runtime delivery check: the healthy web container serves the page route, transformed
editor/calendar/CSS and reference JPEG with HTTP 200. Container hashes match the
workspace files. This confirms current sources, not a visual browser inspection.
The API and Caddy services were not running during this check; start `./run.sh`
for the full authenticated HTTPS app at the URL above.

The resupplied HTML on 2026-11-23 is identical to the previous reference. The
follow-up tightens its 16px card spacing, inline category suggestions, venue grid,
select chevrons, full-width white footer and page background. `run.sh` now prints
the actual HTTPS port, 8443. `/organizer/events` is the draft list; the referenced
creation design belongs to `/organizer/events/new`. The Docker service must be
rebuilt when running without source watching; use `./run.sh --watch` during edits.

Follow-up verification: 50 focused event tests, frontend lint/build, `bash -n
run.sh` and `git diff --check` pass. The web image/container was refreshed and is
healthy. HTTPS requests to the creation route, editor module and stylesheet return
200 with the revised footer/category selectors. Unlike the earlier runtime check,
Caddy/API are now running. Browser visual inspection is still unavailable.

### Redesign verification — 2026-11-24

Frontend lint and production build passed. All 51 event and schedule tests passed.
The existing artwork test now scopes image assertions to the draft list because
the workspace header also contains decorative artwork. The broader suite had
338 passing tests and 9 opt-in skips before that assertion was updated.

Headless browser checks used temporary, ignored fixture callbacks and a mocked
organizer session. Creation, saved-draft editing, draft lists, confirmed/cancelled
bookings, booking errors, and empty drafts rendered at 1440px and 390px. No page
errors or horizontal mobile overflow were observed. Screenshots were reviewed.
These checks cover frontend behavior. Abdellah's and Aadel's real response
examples and integration acceptance remain pending as listed above.

### Academic Kinetic and S3-01 adapter — 2026-11-26

The supplied design file was used as the visual specification. The organizer
screens use its cobalt palette, typography, spacing, status colors, and responsive
navigation. The earlier ivory/deep-green redesign is superseded.

The focused adapter suite verifies real request paths/methods and payload mapping,
minimum draft requirements, category IDs, ISO dates, nullable values, saved-draft
publication, error mapping, malformed responses, identity checks, and aborts.
Browser checks use mocked HTTP responses with the default production adapter and
confirm saved-draft GET/PATCH/publication, explicit-save gating, validation/input
preservation, uncertain-write locking, and minimum-field feedback. Separate
injected fixtures cover confirmed/cancelled bookings and draft display. This is
frontend acceptance, with live API/database acceptance pending the dependencies
above.

Responsive browser checks at 1440px, 1280px, 900px and 390px reported no page errors
or horizontal document overflow. The mobile modal menu opened and closed with
Escape. Reviewed screenshots include the editor, booking table/cards and errors.

Targeted verification: all 66 event tests pass, including 14 API adapter cases
and the explicit-save publication regression. Frontend lint and production build
pass. Earlier full-suite runs each had one timing-sensitive failure in existing
onboarding/admin tests; those files each passed when rerun in isolation. The final
full-suite result is recorded below. Temporary browser fixture entrypoints were
removed after inspection.

Final full-suite run: 354 frontend tests passed, 9 opt-in integration tests skipped.
The user confirmed that Aadel's PR/response examples are not yet available.
Organizer draft listing and live bookings therefore remain blocked by their API
contracts. The supported frontend adapter is ready for the S3-01 backend and
category module to be integrated and exercised against a real session/database.

### Event picture changes and timing controls — 2026-11-26

The Custom time option and its alternate input state were removed. Existing saved
minute values remain selectable. Organizers can now choose or drop a PNG/JPEG/WebP
banner through the default upload callback. The confirmed upload URL updates both
previews and is included in the existing draft/publish imageUrl mapping. Remove
clears the form's image reference.

POST /api/organizer-event-images accepts a single multipart file (5 MB maximum)
for approved active organizers, using the existing session/role guards. File type
and signature are checked server-side. Images receive random filenames and are
served from GET /api/organizer-event-images/:filename with explicit image content
types and nosniff. Docker stores them in the event_images named volume. This
module supplies image storage while the S3-01 event endpoints remain a separate
backend integration dependency.

Verification for this update: web build/lint passed; 355 frontend tests passed on
the final run, with 9 opt-in checks skipped. The first full frontend run timed out
loading one draft during concurrent container builds. API build/lint and all 170
backend tests passed. Live HTTPS checks with the demo organizer confirmed upload,
both previews, Remove, and absence of Custom time. Anonymous upload returned 401,
student upload 403, mismatched content 400, and oversized multipart upload 413.
The uploaded image returned the original bytes and remained HTTP 200 after API
container replacement. Both updated app containers are healthy. Associating the
URL with a persisted event still depends on the S3-01 event module integration
noted above.

## Organizer dashboard — 2026-11-26

The approved-organizer dashboard follows the supplied HTML reference within the
existing responsive organizer sidebar. It includes organization identity, creation
and management shortcuts, four metrics, upcoming events, recent drafts, recent
confirmed/cancelled booking activity, and workspace tools. Reference names, campus
resources and example totals were replaced by data-backed content.

GET /api/organizer/dashboard is a session-guarded, no-store read. All event and
participant queries require the session user to be the event creator and approved
organization owner. Metrics and bounded lists are read in one repeatable-read
transaction. Active events are PUBLISHED/FULL events whose end is in the future.
Confirmed bookings cover the organizer's events. Utilization is weighted across
active events with a capacity and is null when no capacity is available. Recent
activity uses the registration updatedAt timestamp and current status. Draft and
upcoming lists show up to three entries, with five recent booking activities.

The UI displays real zero/empty states and handles loading, denial, request errors
and retry. A failed refresh clears previously loaded participant information.
No sample events or bookings were inserted into the database. The existing
My events, draft editor and booking directory retain their previously documented
API integration dependencies.

Verification: frontend build/lint passed, with 359 frontend tests passing and
9 opt-in checks skipped. Four focused backend tests cover scoping, revoked
approval, snapshot isolation and utilization. Live HTTPS checks confirmed owner
reads, no-store, 401 for anonymous access and 403 for students/admins. Browser
checks at 1440px, 1280px, 900px and 390px passed without page errors or horizontal
overflow, including mobile navigation and error retry. Populated layouts were
checked using intercepted test responses, while the live demo organization
correctly reports zero events/bookings and no capacity utilization.

Full backend verification: build/lint passed and all 174 backend tests passed.

## S3-02 integration PR preparation — 2026-11-26

The requested PR base is feat/s3-02-connect-save-publish-events. The published
base was 5bfeeccfe7de2285435579d88aea7687b77a8726 when checked. Its existing
organizer-decision-notice changes were incorporated into this feature branch
without conflicts. Final frontend build/lint pass with 380 tests passing and
9 opt-in integration checks skipped. API build/lint and all 174 unit/controller
tests pass. An existing admin abort test now explicitly waits for the pending
request before reading its signal, resolving the observed timing race.

S3-01/category integration, organizer draft listing, Aadel's participant contract,
registration-mode agreement, and Smail's frontend review remain the acceptance
dependencies described above.
