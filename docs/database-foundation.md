# Database foundation

Implemented from `db_diagram.sql` on 2026-10-13 following authorization to continue the foundation task. The initial review draft remains in `docs/database-draft/` as historical context; the application schema and committed migration are authoritative.

## Models and mapping

The schema contains User, StudentProfile, Organization, OrganizationApplication, Event, Category, EventCategory, StudentInterest, EventRegistration, Notification, and OrganizationFollow. Explicit join models preserve composite primary keys. Email, category name/slug, and student/event registration uniqueness follow the diagram. Supplied indexes are retained.

PascalCase models and camelCase fields map to the supplied PostgreSQL table/column names. Native UUID, varchar lengths, text, and timestamp(6) types are retained. Distinct relation names disambiguate owners, submitters, reviewers, creators, and recipients.

## Diagram corrections and implementation choices

- Define the missing `RegistrationStatus` with PENDING, CONFIRMED, REJECTED, and CANCELLED, inferred from notification names. Review this vocabulary with the authentication/event teams before adding workflows.
- Reverse the user/profile foreign key: `student_profiles.user_id` references `users.id`, allowing organizer/admin users without a student profile.
- Omit `student_profiles_student_profiles`, an invalid self-join targeting non-unique enum fields with incorrectly unquoted enum type names.
- Expose `OpportunityFormat` in TypeScript while mapping the database enum to the supplied `OppotunityFormat` spelling. Preserve `ENVIRONMENT_ARGO` rather than silently changing the stored vocabulary.
- Preserve both the optional single profile interest enum and category-based `StudentInterest` links. Their future product roles remain to be resolved; no multi-selection redesign is assumed.
- Add Prisma-generated UUIDs, creation/submission/registration timestamp defaults, and Prisma-managed updated-at values. UUID/update behavior requires Prisma or explicit values from raw SQL writers.
- Keep role, status, registration mode, format, and read-state values explicit. No guessed lifecycle defaults or cascade deletion rules.
- Use `NoAction` for foreign-key deletion and update. Services must handle dependents explicitly before deleting referenced rows.
- Use ordinary immediate Prisma-generated foreign keys. The diagram's deferrable clauses are not reproduced; no current workflow requires deferred constraints.
- Preserve timestamps without timezone. Application code should pass UTC dates consistently; a timezone-type change requires a reviewed migration.

Role-specific relationships, authorization, normalized email handling, dates/capacity, registration-mode requirements, and notification read-state consistency belong to the upcoming workflows and their validation. This foundation does not claim those workflows are implemented.

## Migration and seed

`apps/api/prisma/migrations/20261013000000_initial_foundation/migration.sql` is generated from the application schema with the explicit `prisma7.config.ts` datasource configuration. The previous draft command omitted this configuration; Prisma's engine required it even for an empty-to-schema comparison. With the configuration supplied, DDL generation works.

Container startup runs `db:setup` before Nest: deploy committed migrations, then idempotently seed categories. The seed is transactional, inserts only missing category slugs, and preserves edited existing records. The ten category labels/slugs are initial vocabulary inferred from the Interests enum, not a formally agreed taxonomy. No credentials or privileged accounts are seeded.

## Verification and remaining external checks

Initial verification used the pinned Node 22.23.2 runtime and an isolated PostgreSQL 18 instance because Docker was unavailable at that time. The initial migration and seed succeeded; comparing the migrated database to the Prisma schema reported no difference. Integration tests exercise all 11 models, repeat the real seed, and verify constraints and HTTP configuration. A live host smoke test also passed through Vite’s proxy to the compiled Nest API and PostgreSQL. See `foundation-checklist.md` for the full verification record.

CI targets PostgreSQL 17, matching Compose. It checks install, validation/generation, lint, unit tests, deploy/seed, migration status/drift, end-to-end tests, and builds. A separate job starts `./run.sh` from a clean checkout and verifies Caddy HTTPS with its exported CA certificate.

Hosted CI and live Compose checks passed on 2026-10-15. PR creation and reviewer approval remain external completion steps.

## Development database migration

On 2026-10-13, Docker PostgreSQL 17 was started for the configured `younity` development database. Migration `20261013000000_initial_foundation` applied successfully and the 10-category seed completed. Migration status is current; Prisma detected no difference between the live development database and the schema. The database container was left running. Full application/HTTPS startup was verified in the 2026-10-15 follow-up review; hosted CI subsequently passed in the CI compatibility verification below.

## Follow-up review — 2026-10-15

Full Compose startup initially exhausted disk space during dependency installation. Both development images now use Node 22.23.2 Bookworm Slim and discard npm download caches before the install layer is saved. The API image explicitly installs OpenSSL and CA certificates for Prisma. After clearing disposable Docker build cache, both images built and `./run.sh` started all services successfully.

The seed previously validated HTTP settings as well as the database URL. It now shares only the database-URL validator with the application, so production seeding does not require CORS or a valid API port. The real-seed regression test checks this behavior and preserves repeat-run identifiers and records.

API validation, migrations, seed, status/drift, 22 unit tests, 10 integration tests, lint, and build passed inside the pinned Node image against the separate PostgreSQL 17 review database. Frontend lint/build and all four startup-script tests also passed. Certificate-verified HTTPS requests, headless Chromium desktop/mobile rendering, live API status, Swagger, and browser console checks passed. Watch synchronized temporary frontend/API probes and their deletion; probes were removed. Browser tooling and certificates were scoped to the checks, without changing the system/browser trust store.

## Clean-checkout acceptance check — 2026-10-15

A fresh checkout of `core/auth01` with no `.env` or local certificates passed `./run.sh` under a separate Compose project. The check verified generated configuration, automatic migration/seed, current migration status, repeat seeding, and certificate-verified HTTPS frontend, health, and OpenAPI endpoints. To avoid the constrained root disk, only the test project's PostgreSQL data volume was redirected to a bind directory under `/tmp`; application service definitions and startup code were unchanged. Its test containers and named volumes were removed afterward. Development data and certificates were not reused or deleted.

`origin/main` was an ancestor of the foundation branch when preparing the PR, so that fetched base introduces no merge conflict. Opening the PR requires authenticated GitHub write access. Hosted Actions summaries and annotations were readable through the public GitHub API and were used to diagnose and verify CI.

## CI compatibility verification — 2026-10-15

The API and frontend jobs passed, but the hosted startup job initially failed because the runner’s bundled Compose rejected `initial_sync`. The startup job now explicitly installs the locally verified Compose v5.6.0 through Docker’s official setup action. `run.sh` validates the required Compose version before creating configuration or starting containers, and regression tests cover versions below the minimum as well as supported 2.x and 5.x versions.

The workflow supervises `run.sh` directly and preserves its failure status during cleanup. On failure it publishes a bounded startup-log excerpt as a check annotation, allowing diagnosis without authenticated log downloads. The revised smoke-test commands passed locally against a fresh isolated checkout, and all six startup-script tests passed.

All three hosted jobs (`api`, `web`, `startup`) passed in [run 38741177016](https://github.com/Liams-theCreator/Younity/actions/runs/38741177016) for commit `7459613`, including database migration/seed, schema drift, lint, tests, builds, and full Docker/HTTPS startup.

## Branch recheck — 2026-10-16

Hosted CI on commit `fea8165` was confirmed successful in [run 38741467434](https://github.com/Liams-theCreator/Younity/actions/runs/38741467434). Local lint and builds for both apps, 22 API unit tests, six startup-script tests, and the full Docker API suite were rerun successfully. The Docker suite used the separate PostgreSQL 17 review database: migration/seed/status, no schema drift, and all 10 integration tests passed. Certificate-verified HTTPS frontend, health, and Swagger requests also passed.

The review identified a Watch gap: API test and lint configuration changes were absent from the running container. Compose now synchronizes both Vitest configs and `.oxlintrc.json`, including initial synchronization. Temporary whitespace-only edits confirmed byte-for-byte synchronization of all three files; their original content was restored locally and in the container before running the checks. Services were stopped after verification; development data was not reset.
