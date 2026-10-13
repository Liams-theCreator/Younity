# Younity API

Younity’s backend, built with NestJS and TypeScript using ES modules.

## Current status

- NestJS application starts successfully.
- PostgreSQL runs through Docker Compose.
- Prisma connects to PostgreSQL and verifies connectivity at startup.
- Unit and end-to-end tests use Vitest.

Application models, authentication, and event features are not implemented yet.
The full local development stack runs in Docker with HTTPS through Caddy.
See the root README and run `./run.sh` from the repository root.

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

Review `npm audit` and `npm audit --omit=dev` when updating dependencies
and before deployment. Review proposed version changes before applying
audit fixes, especially `--force`.

## References

- [NestJS documentation](https://docs.nestjs.com/)
- [Prisma documentation](https://www.prisma.io/docs/)
- [Vitest documentation](https://vitest.dev/guide/)
- [Docker Compose documentation](https://docs.docker.com/compose/)


## Development with Docker Compose

This workflow runs both the API and PostgreSQL in containers.
It requires Docker Engine and Docker Compose with Watch support.
Node.js and npm run inside the API image.

Run all commands below from the repository root.

### First-time setup

Copy the root environment template if `.env` does not already exist:

```bash
cp .env.example .env
```

Configure the PostgreSQL credentials and `API_DATABASE_URL`.
The URL must use the same credentials, with `db:5432` as the database
address. URL-encode special characters in the URL credentials.

Compose supplies the API's environment variables directly.
`apps/api/.env` is only needed when running the backend outside Docker.

### Start development

To start only the API and database (without the public HTTPS entry point), run:

```bash
docker compose up --build --watch api
```

The API container port is not published directly to the host. Run the full
stack with `./run.sh` to access https://localhost/api/.

- Source changes sync automatically and trigger Nest's watcher.
- Dependency changes rebuild the API image.
- Prisma schema changes rebuild the image and regenerate the client.
- Database migrations must be applied separately.

For changes outside the configured watch paths, such as test files or
TypeScript configuration, rebuild the API:

```bash
docker compose up -d --build api
```

### Run tests

With the containers running:

```bash
docker compose exec api npm run test
docker compose exec api npm run test:e2e
```

### Stop development

Press Ctrl+C in the Watch terminal, then stop both services:

```bash
docker compose stop api db
```

Database data remains in the named volume.

## HTTPS development

Run `./run.sh` from the repository root to start the full stack.
Caddy serves the frontend at https://localhost and the API at
https://localhost/api/. Follow the root README to trust its local certificate.

`npm run build` generates Prisma Client automatically before compiling.
The production entry point is `dist/main.js`. Database models and migrations
will be added once the schema is agreed.
