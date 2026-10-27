# Younity API

NestJS, TypeScript ES modules, Prisma 7, and PostgreSQL. The database foundation is implemented; authentication and event application workflows are not implemented yet.

## Full development stack

From the repository root, run `./run.sh`. It creates local configuration when absent, builds the containers, applies committed migrations, seeds the category catalog, waits for readiness, and returns your shell prompt with services running detached. Use `./run.sh --watch` for foreground source watching. The root README describes local certificate trust.

- API root: https://localhost/api/
- Database health: https://localhost/api/health
- Swagger UI: https://localhost/api/docs
- OpenAPI JSON: https://localhost/api/docs-json

Caddy preserves `/api`; Nest owns the prefix. Compose does not publish the API's internal port 3000.

## Host-side development

Select the Node version in the root `.nvmrc` using `nvm install` and `nvm use`. Start the database from the root:

```bash
docker compose up -d --wait db
```

From `apps/api`, copy `.env.example` to `.env` only if absent. Set `DATABASE_URL` using the root database credentials and `127.0.0.1:5432`, rather than the container-only hostname `db`. URL-encode special characters in credentials. Do not commit `.env` files.

```bash
npm ci
npm run prisma:generate
npm run db:setup
npm run start:dev
```

The host API is available at http://localhost:3000/api/. Use the full Compose stack for HTTPS. Host-side Vite proxies `/api` to this API.

## Configuration

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | Required PostgreSQL connection URL, including host and database |
| `NODE_ENV` | `development` (default), `test`, or `production` |
| `PORT` | Integer 1–65535; default 3000 |
| `CORS_ORIGINS` | Comma-separated exact HTTP(S) origins without paths or wildcards; development defaults to `https://localhost,http://localhost:5173`; required explicitly in production |
| `TEST_DATABASE_URL` | Explicit isolated database URL for end-to-end tests; never use an application database |

Configuration is validated before application startup. All future request DTOs use the global transforming ValidationPipe, which rejects undeclared fields; DTOs must declare class-validator rules. Swagger documents the current endpoints. Health performs a real database query.

## Database commands

Run from `apps/api`:

```bash
npm run prisma:validate
npm run prisma:generate
npm run db:migrate:dev -- --name describe_change
npm run db:migrate:deploy
npm run db:seed
npm run db:status
```

Use `migrate dev` only on isolated development databases; it uses a shadow database and may propose a reset. Review and commit migration SQL and `migration_lock.toml`. Use `migrate deploy` for committed migrations in CI and container startup. `db:setup` runs deploy then seed; it never resets the database.

Prisma 7 generation and seed execution are explicit. `npm run build` generates the client before compilation. Generated files in `src/generated/prisma` are ignored and must not be edited. The production entry point is `dist/main.js`.

The seed requires only `DATABASE_URL`; HTTP settings such as `PORT` and `CORS_ORIGINS` are validated separately when starting the application.

The seed inserts 10 categories inferred from the diagram's interest vocabulary, keyed by stable slugs. Repeated execution preserves existing records and identifiers; no user accounts or passwords are seeded. See `docs/database-foundation.md` at the repository root for translation decisions.

## Checks

```bash
npm run lint
npm test
npm run build
```

For database/HTTP integration checks, create a separate PostgreSQL database, then supply its URL to both variables:

```bash
export DATABASE_URL='postgresql://USER:PASSWORD@127.0.0.1:5432/younity_test'
export TEST_DATABASE_URL="$DATABASE_URL"
export NODE_ENV=test
npm run db:setup
npm run test:e2e
```

The integration suite checks seed preservation, model relationships, foreign keys, duplicate registrations, deletion behavior, prefix routing, Swagger, CORS, and database health. Temporary model fixtures are rolled back. Seed categories remain in the dedicated test database.

Inside Compose, `docker compose exec api npm test` runs unit tests. For integration tests, provision a separate database and pass `TEST_DATABASE_URL` explicitly; do not point it at the normal development database.

## Watch and persistence

With `./run.sh --watch`, source files, test files, both Vitest configuration files, and `.oxlintrc.json` sync automatically. Changes to test or lint settings are available on the next check inside the running container. Dependency, Prisma, and build-configuration changes rebuild the API image. Rebuilds run committed migrations and seed before starting Nest. A schema edit requires a matching committed migration; Watch does not create migrations.

Ctrl+C in `./run.sh --watch` stops services while retaining database and certificate volumes. In detached mode, use `docker compose stop`. Changing `.env` does not update an existing database password. Inspect `docker compose logs -f` for failures. Do not delete volumes to resolve errors unless you intend to discard their data.
