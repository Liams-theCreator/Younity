# Authentication foundation task checklist

Task source: repository-root `task.txt`. Status recorded 2026-10-13.

## Implementation

- [x] Translate valid diagram tables, enums, indexes, and relations into the application Prisma schema.
- [x] Document source defects and implementation assumptions in `database-foundation.md`.
- [x] Add and apply the initial migration to an isolated fresh database.
- [x] Add a transactional, repeatable category seed without seeded passwords/accounts.
- [x] Add explicit migration, seed, setup, validation, and generation commands.
- [x] Generate Prisma Client before backend builds and inside the API image.
- [x] Configure exact-origin CORS, global DTO validation, `/api`, Swagger, and startup environment validation.
- [x] Preserve the Nest API prefix through Caddy and check database connectivity in `/api/health`.
- [x] Start migrations and seed before the API; use readiness checks in Compose.
- [x] Keep frontend integration and verify its proxy can reach the compiled API and database.
- [x] Improve `run.sh` configuration, certificate export, source watching, and cleanup on failure/signal/exit.
- [x] Add GitHub Actions for API, frontend, PostgreSQL, and clean Docker/HTTPS startup checks.
- [x] Update setup, database decisions, and verification documentation.

## Local acceptance evidence

- [x] API lint, generation, and production build pass using Node 22.23.2.
- [x] Frontend lint and production build pass.
- [x] 22 API unit tests pass, including environment and request validation.
- [x] 10 real database/HTTP integration tests pass, including repeat seeding.
- [x] Four startup-script checks pass using a simulated Docker command.
- [x] Migration deployment and repeated setup succeed; migration status is current.
- [x] Initial migration and category seed applied to the actual Docker PostgreSQL 17 development database; schema drift check passed.
- [x] Prisma reports no difference between migrated database and application schema.
- [x] Live host smoke test confirms Vite -> compiled Nest -> PostgreSQL communication and Swagger.
- [x] Bash syntax, YAML parsing, and whitespace checks pass.

Local database verification used a temporary PostgreSQL 18 instance. Compose and CI target PostgreSQL 17. No application database was reset or modified during local verification.

## Outstanding completion steps

- [ ] Run hosted GitHub Actions and confirm all jobs pass, including PostgreSQL 17 and live clean-clone Compose/HTTPS startup. Docker is unavailable in this execution environment.
- [ ] Review the documented diagram corrections and initial category vocabulary with the team before downstream workflows depend on them.
- [ ] Commit/push the implementation, open the pull request, and add its URL to the task record.
- [ ] Resolve any PR comments or merge conflicts and obtain reviewer approval.

Adding CI does not establish that hosted CI has passed. Reviewer approval is an external task state, not an implementation claim.
