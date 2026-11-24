# S3-09 — organizer event and participant screens

Owner: Oussama. Reviewer: Smail. Branch: `S3-09_Event-creation-participants`.
Started from main `474efaf` on 2026-11-20. No teammate branch was merged or copied
into this feature branch.

## Delivery status

The latest supplied HTML reference is implemented with its 1280px workspace,
Plus Jakarta Sans font, blue actions, three white form sections, sticky attendee
preview, expanded calendar/time picker and fixed action dock. The organizer
header uses the authenticated email/initial and an account menu. The reference's
invented names, campuses, prices, attendance totals and operational claims are
not treated as real data. Notifications are disabled. The Registration Mode selector was removed at the
user’s request; it is not displayed in the form.

Independent frontend work is implemented. **Real S3 API integration is pending:**
this checkout does not supply S3-01/S3-03 adapters or Abdellah's save/publish
integration. Production contains no example events/bookings, guessed HTTP calls,
local-storage save implementation or simulated successful writes. Save/publish
remain disabled without their callbacks. Unavailable reads report an error.
This is not real-API/database acceptance and is not ready for Done.

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
location and online/hybrid links appear conditionally. Optional room/campus
controls match the design, but their mapping into the final event contract is
pending. Campus suggestions must be supplied through `service.campuses`.

The schedule panel starts expanded as in the reference. Presets use the current
local date. The Monday-first calendar supports arrows, Home/End and Page Up/Down
(Shift changes year); selecting a date does not submit the form. Time suggestions
allow half-hour choices plus arbitrary minute values through Custom time. The
extra end-date control retains support for multi-day events. Duration and timezone
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

The local robotics artwork copied from the supplied HTML is a visual example:
`apps/web/public/images/reference-event-cover.jpg`. It is labeled Example image
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

Partial drafts are allowed. Validation failures preserve entered values. Unknown/
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

`apps/web/src/events/model.ts` defines frontend view models, not HTTP DTOs or
agreed routes. `App.eventServices` defaults to an unavailable object.

| Callback/data | Purpose |
| --- | --- |
| `registrationMode` | Owner-supplied registration setting for new events; no selector. |
| `rules` | Final field bounds and category/deadline requirements. |
| `categories` | S3-01 category IDs/labels. |
| `campuses` | Optional owner-supplied location suggestions. |
| `uploadBanner` | Optional image upload integration returning a confirmed URL. |
| `drafts` | Current organizer's draft summaries; optional artwork/location. |
| `draft(id)` | Saved values, identity and last-saved timestamp. |
| `saveDraft({id?, values})` | Abdellah's writer; returns the confirmed saved draft. |
| `publish({id?, values})` | Abdellah's integration; returns the actual outcome message. |
| `bookings({status, page})` | Aadel's owner-scoped data and pagination metadata. |

Adapters receive the existing protected request and AbortSignal. They must map
local datetime strings, null/omission, inactive mode fields and optional UI venue
details according to S3-01. Do not POST the view model blindly or duplicate the
owner's save/publish/upload clients.

Needed before real integration/Done:

1. Abdellah's final DTOs/examples, category source, format/mode requirements,
   draft/publish validation, dates/timezone/capacity semantics and errors.
2. Abdellah's write integration; agreement on venue details and media support.
3. Aadel's participant contract, ownership, status/pagination and safe optional metadata.
4. Real API/database flow, mobile/keyboard evidence, CI and Smail's review.

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
