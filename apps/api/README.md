# Younity API

Younity’s backend, built with NestJS and TypeScript using ES modules.

## Current status

- NestJS application starts successfully.
- PostgreSQL runs through Docker Compose.
- Prisma connects to PostgreSQL and verifies connectivity at startup.
- Unit and end-to-end tests use Vitest.

Application models, authentication, and event features are not implemented yet.
This is a local development setup; HTTPS and containerized API deployment
are still pending.

## Prerequisites

- Linux
- nvm
- Node.js version specified in the repository-root `.nvmrc`
- npm, bundled with Node.js
- Docker Engine and Docker Compose, available to your user
- Ports 3000 and 5432 available

Run the following setup steps from a fresh clone.

## 1. Select Node.js

From the repository root:

```bash
nvm install
nvm use
```

## 2. Configure PostgreSQL

From the repository root:

```bash
cp .env.example .env
```

Edit `.env` and choose a local database password:

```dotenv
POSTGRES_USER=younity
POSTGRES_PASSWORD=YOUR_LOCAL_PASSWORD
POSTGRES_DB=younity
```

These values initialize PostgreSQL when its data volume is first created.
Changing this file later does not change an existing database user's password.

Start the database:

```bash
docker compose up -d --wait db
docker compose ps
```

The `db` service should become healthy. It is available on
`127.0.0.1:5432`; database files persist in a Docker volume.

## 3. Configure the backend

From the repository root:

```bash
cd apps/api
cp .env.example .env
```

Set `DATABASE_URL` in `apps/api/.env`:

```dotenv
DATABASE_URL="postgresql://younity:YOUR_LOCAL_PASSWORD@127.0.0.1:5432/younity?schema=public"
```

Use the same credentials as the root `.env`. URL-encode special characters
in the username or password, such as `@` becoming `%40`.

The root `.env` configures Docker Compose. `apps/api/.env` configures
Prisma and the backend. They are separate files.

Never commit either `.env`. Commit only examples containing placeholders.
Do not overwrite an existing `.env` when repeating setup.

## 4. Install dependencies and generate Prisma Client

From `apps/api`:

```bash
npm ci
npm run prisma:generate
```

`npm ci` installs dependencies from the committed lockfile.

Prisma generates its client into `src/generated/prisma/`. This directory
is excluded from Git. Generate it after a fresh clone and whenever the
Prisma schema changes. Do not edit generated files.

The Prisma CLI configuration is `prisma7.config.ts`.
Our generation script explicitly selects this file.

## 5. Start the backend

From `apps/api`:

```bash
npm run start:dev
```

Expected startup messages include:

- `Database connection verified`
- `Nest application successfully started`

Open http://localhost:3000 to see the starter `Hello World!` response.

Development mode watches for source changes. Use Ctrl+C to stop the API.

## Tests and builds

Run from `apps/api`:

```bash
npm run test
npm run test:e2e
npm run build
```

The starter controller unit test does not require PostgreSQL.
End-to-end tests load the application and currently require the local
development database to be running.

Before adding tests that modify data, configure a separate test database.

## Main files

| Path | Purpose |
| --- | --- |
| `src/main.ts` | Application startup and shutdown hooks |
| `src/app.module.ts` | Root application module |
| `src/prisma/` | Shared Prisma service and module |
| `prisma/schema.prisma` | Database models and client generator |
| `prisma7.config.ts` | Prisma CLI configuration |
| `test/` | End-to-end tests |
| `vitest.config.ts` | Unit-test configuration |
| `vitest.config.e2e.ts` | End-to-end test configuration |

## Stopping PostgreSQL

From the repository root:

```bash
docker compose stop db
```

This preserves the database volume.

## Dependency security

Known audit findings remain in Prisma's development dependency chain
(`deepmerge-ts` and `mysql2`). They have not been fixed.

Review `npm audit` and `npm audit --omit=dev` when updating dependencies
and before deployment. Review proposed version changes before applying
audit fixes, especially `--force`.

## References

- [NestJS documentation](https://docs.nestjs.com/)
- [Prisma documentation](https://www.prisma.io/docs/)
- [Vitest documentation](https://vitest.dev/guide/)
- [Docker Compose documentation](https://docs.docker.com/compose/)
