*This project has been created as part of the 42 curriculum by imellali, asyani, aaferyad, oait-h-m and sboukiou*

# :camel: Younity

***Younity is a web platform connecting Moroccan university students with campus events and opportunities.***
***Students will be able to discover hackathons, conferences, workshops, and networking events, while organizers will have tools to publish and manage their events.***
***Built with React, Tailwind CSS, NestJS, Prisma, and PostgreSQL.***

## Current implementation

- Student and organizer registration is connected to the API and PostgreSQL. Inputs are validated, emails are normalized, duplicate emails are rejected, and passwords are hashed with Argon2id. Registration does not issue a session. The frontend sends new accounts to email verification; users sign in after verifying their email.
- Students can register immediately or add optional academic preferences and multiple interests. Organizer registration creates a pending user and organization. Selected proof documents remain local previews; file uploads are not implemented.
- Login, session lookup, and logout use a JWT in a `Secure`, `HttpOnly`, `SameSite=Lax` cookie. The frontend restores sessions through `/api/auth/me` and routes users according to their role, account status, and organization verification status. Suspended accounts and unverified email addresses are blocked by the backend.
- Protected student and organizer dashboard pages exist, but event discovery and management are still placeholders. Pending, rejected, and needs-changes organizer status screens use the session's organization status.
- Email verification is integrated with SMTP delivery, expiring single-use links, recovery status, and rate-limited retry/resend endpoints. Verification links expire after ten minutes. Compose includes Mailpit for inspecting development emails.
- Active, email-verified students can load and update saved preferences at `/student/preferences`. The API requires at least two distinct interests when updating. Registration also accepts optional preferences during account creation.
- Admin review and organizer activation are not implemented on `main`. Organizer registration creates a pending organization, but does not yet create an organization application record. There is no admin UI.
- Database models also cover events, categories, registrations, notifications, and organization follows. Event publishing/discovery, event registration, notifications, and follow workflows are not implemented.

## Project structure

| Path | Purpose |
| --- | --- |
| `apps/web` | React 19, TypeScript, Vite, Tailwind CSS 4, React Router, and frontend tests |
| `apps/api` | NestJS API, authentication, registration, email verification, student preferences, and tests |
| `apps/api/prisma` | Prisma 7 schema, committed PostgreSQL migrations, and category seed |
| `infra/caddy` | Local HTTPS reverse proxy; preserves the API's `/api` prefix |
| `tests` | Startup-script tests and a separate HTTPS authentication journey script |
| `.github/workflows/ci.yml` | Application checks, database checks, and Docker/HTTPS startup smoke test |
| `docs` | Requirements, database decisions, and implementation/acceptance records; some records contain historical behavior |

## :wrench: Build and run

### :page_with_curl: Requirements

- **Git**
- **Docker Engine**
- **Docker Compose 2.32 or newer**
- **OpenSSL** (for automatic first-run credentials)

### :pencil: Setup

```bash
    git clone git@github.com:Liams-theCreator/Younity.git
    cd Younity
```

`./run.sh` creates a private `.env` with a generated database password and JWT secret if it does not exist. Existing values are preserved; a missing `JWT_SECRET` entry is generated and appended. OpenSSL is also required for that upgrade step. To configure credentials yourself, copy `.env.example` to `.env` and use matching credentials in `POSTGRES_PASSWORD` and `API_DATABASE_URL`, with `db` as the database hostname. URL-encode special characters in the URL credentials. Replace the JWT placeholder with a secret generated using `openssl rand -hex 48`. `JWT_TTL_SECONDS` defaults to 900 seconds.

Compose currently publishes HTTPS on port **8443**, HTTP on **8080**, Mailpit on **8025** (web inbox) and **1025** (SMTP), and PostgreSQL on **127.0.0.1:5432**. Set `CORS_ORIGINS=https://localhost:8443,http://localhost:5173` in `.env` to include the published browser origin; the committed template still lists the default HTTPS port. Keep `FRONTEND_ORIGIN=https://localhost:8443` so emailed verification links use the browser address. The API is only exposed through the reverse proxy. Use the HTTPS URL directly: Caddy's automatic HTTP redirect does not account for the host's port mapping.

Build and start all services:

```bash
./run.sh
```

`./run.sh` starts services detached and returns your shell prompt once they are
ready. `-d` / `--detach` remain supported. View logs with `docker compose logs -f`
and stop services with `docker compose stop`.
Use `./run.sh --watch` for foreground source watching, or `./run.sh --help` for options.

### Local HTTPS certificate

The API applies committed database migrations and seeds the category catalog before starting. The script waits for the API, frontend, and database, exports Caddy’s public root certificate to `.local/certs/root.crt`, then returns your shell prompt. On the first run, trust that certificate in another terminal (Ubuntu/Debian):

```bash
sudo install -m 0644 \
  .local/certs/root.crt \
  /usr/local/share/ca-certificates/younity-caddy.crt

sudo update-ca-certificates
```

Restart your browser. If it uses its own certificate store, import the certificate there too.

### :mag_right: Access

- Frontend/sign in: https://localhost:8443/login
- Backend: https://localhost:8443/api/
- Health: https://localhost:8443/api/health
- Swagger: https://localhost:8443/api/docs
- OpenAPI JSON: https://localhost:8443/api/docs-json
- Development email inbox: http://localhost:8025 (Mailpit; messages are captured locally)

The current startup script prints URLs without `:8443`; use the addresses above for the committed Compose configuration. `/` and `/register` redirect to `/login`.

### Application routes and API

| Frontend route | Purpose |
| --- | --- |
| `/login` | Sign in and links to both registration forms |
| `/register/student` | Student account and optional preferences |
| `/register/organizer` | Organizer account and organization details |
| `/verify-email` | Verification links, delivery status, and retry/recovery |
| `/student/preferences` | Protected page to load and save student preferences |
| `/student/dashboard` | Protected student workspace placeholder |
| `/organizer/dashboard` | Protected workspace for active, approved organizers |
| `/organizer/pending` | Protected pending-verification status |
| `/organizer/status` | Protected rejected/needs-changes status |

The API provides `POST /api/auth/register/student`, `POST /api/auth/register/organizer`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`, `GET /api/student/preferences`, and `PATCH /api/student/preferences`. Email verification uses `POST /api/email-verification/verify-email`, `POST /api/email-verification/recovery-status`, `POST /api/email-verification/retry`, and `POST /api/auth/resend-verification`. Role-check endpoints are also present under `/api/auth`. No admin accounts are seeded and the frontend has no admin destination. Logout clears the browser cookie; there is no server-side JWT revocation mechanism.

Source changes update automatically with `./run.sh --watch`. Stop that mode with
`Ctrl+C`. Docker volumes preserve the database and certificates.

### Cleanup

Run `./clean` to remove Younity's containers, service images, networks, and volumes,
including **all local database data and HTTPS certificates**. It also removes host
dependencies (`node_modules`), builds, coverage, generated Prisma Client, and
TypeScript build caches. Source files and `.env` are preserved. Stop any running
foreground `run.sh` session before cleaning.

Use `./clean --keep-data` to preserve database/certificate volumes and the exported
certificate. Add `--docker-cache` to also prune unused Docker build cache across
all projects. Unrelated containers, images, networks, and volumes are preserved;
Docker may retain shared service images used by other containers.

Restart with `./run.sh` or `./run.sh -d`. After a full cleanup, install the newly
exported HTTPS certificate again. For host-side development, run `npm ci` in each
app and `npm run prisma:generate` in `apps/api` to restore local dependencies.

### Troubleshooting

- Docker must be running and accessible to your user. Ports 8080, 8443, 5432, 8025, and 1025 must be free.
- If a Docker build reports `ENOSPC`, inspect available disk space and `docker system df`. Unused build cache can be cleared with `docker builder prune`; this does not delete database volumes. Development images use slim Node bases and discard npm download caches.
- Inspect service output with `docker compose logs -f`. If startup fails, inspect logs and run `docker compose stop` before retrying.
- Changing `.env` does not change the password in an existing PostgreSQL volume. Keep the original credentials or update the database password explicitly.
- Startup rejects a missing or placeholder JWT secret. The script adds a missing entry but does not replace an existing placeholder. Configure `JWT_SECRET` before restarting.
- Trusting the local certificate is a one-time system/browser step and may require administrator privileges. The script exports it but does not modify your trust store.
- This Compose configuration is for development. Production builds can be checked with `npm run build` in each app; production hosting is not configured.

## Development checks

Select Node **22.23.2**, pinned in `.nvmrc`, for host-side commands. Install dependencies separately in each app; the root package is not a workspace runner. In `apps/api`, run `npm ci`, `npm run prisma:generate`, `npm run lint`, `npm test`, and `npm run build`. In `apps/web`, run `npm ci`, `npm run lint`, `npm test`, and `npm run build`.

For host-side API development, configure `apps/api/.env` from its template, including `DATABASE_URL` with host `127.0.0.1`, a generated `JWT_SECRET`, and `FRONTEND_ORIGIN`. For local email delivery, start Mailpit (`docker compose up -d mailpit`) and use the template's SMTP settings. Vite proxies `/api` to `http://127.0.0.1:3000` by default (`API_PROXY_TARGET` overrides it). Use the Compose HTTPS stack for browser authentication with secure cookies.

Database tests require a separate database, `DATABASE_URL` and `TEST_DATABASE_URL` pointing to that isolated database, , JWT configuration, and `FRONTEND_ORIGIN`; see [API setup](apps/api/README.md) for database commands. Run migrations and seeds with `npm run db:setup`, then `npm run test:e2e` in `apps/api`. Startup-script tests run with `python3 -m unittest discover -s tests -v`. GitHub Actions is configured to check both applications, database migrations/seeds and schema drift, and clean Docker/HTTPS startup; this describes configured checks, not a claim that the current revision passes them.

`tests/auth-journeys.mjs` is a separate live HTTPS verification script, outside the CI workflow. It creates accounts and changes database fixtures; use an isolated test stack and inspect its required environment before running it.

The application schema and committed migrations in `apps/api/prisma` are the current database reference. They include multi-interest student profiles and email-verification tokens beyond the initial foundation. The seed adds ten categories without creating user accounts. See [database foundation](docs/database-foundation.md) for the original SQL mapping decisions and [registration acceptance notes](docs/auth-04-acceptance.md) for historical verification records. Older app READMEs and handoff notes may describe behavior superseded by the current code.

## AI assistance

Codex assisted with development setup fixes, the SQL-to-Prisma translation, migration/seed setup, API configuration, CI, tests, and documentation. The team should review the documented diagram assumptions and understand the generated implementation before evaluation.
