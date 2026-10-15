# PR draft: Complete authentication development and database foundation

Base: `main`
Head: `core/auth01`
Reviewer: smail (task label; GitHub username unconfirmed)

## Description

A fresh development checkout can now start the frontend, API, PostgreSQL, and local HTTPS proxy with `./run.sh`. Startup creates missing local configuration, generates the Prisma client during the image build, applies committed migrations, seeds categories, waits for readiness, exports the local CA certificate, and watches source changes.

The initial Prisma schema implements the diagram's 11 valid domain tables, mapped enums, relationships, indexes, and unique constraints. The initial migration and repeatable category seed establish a database foundation for the upcoming authentication workflows. API setup adds environment validation, DTO validation, exact-origin CORS, `/api`, Swagger, and database health, with matching Caddy and Vite routing.

GitHub Actions checks installation, Prisma generation/validation, migration deployment and drift, lint, unit/integration tests, production builds, and clean Docker/HTTPS startup. Slim Node images reduce build storage; database seeding validates its connection without requiring API-only HTTP configuration.

## Validation

- API and frontend lint and production builds passed.
- 22 API unit tests, 10 PostgreSQL 17/HTTP integration tests, and four startup-script tests passed.
- Fresh migration, repeated seed, status, and schema-drift checks passed on a separate PostgreSQL 17 review database.
- Full Docker startup and certificate-verified HTTPS health/Swagger requests passed.
- A fresh checkout also generated its own configuration/certificate and migrated/seeded an isolated database successfully; test database storage was redirected under `/tmp` to avoid the constrained root disk. Test containers and named volumes were removed afterward.
- Headless Chromium desktop/mobile UI, live API status, Swagger, and browser console checks passed.
- Compose Watch synchronized frontend/API probes and their removal.
- The `main` base was an ancestor of the branch at preparation time; no local merge conflict exists against that fetched base.
- Hosted GitHub Actions results remain unverified pending GitHub API access.

## Review notes

Authentication endpoints and event workflows are outside this foundation change. Review `docs/database-foundation.md` for the inferred missing registration enum, corrected profile foreign key, omitted invalid self-join, retained dual interest representations, category vocabulary, timestamp behavior, and non-cascading deletion policy. No default user accounts or passwords are seeded.

This is prepared PR content, not evidence that a GitHub pull request has been opened. Creation and hosted CI inspection require an authenticated GitHub connection; reviewer approval must come from the reviewer.
