*This project has been created as part of the 42 curriculum by imellali, asyani, aaferyad, oait-h-m and sboukiou.*

# :camel: Younity

***Younity is a web platform connecting Moroccan university students with campus events and opportunities.***
***Students will be able to discover hackathons, conferences, workshops, and networking events, while organizers will have tools to publish and manage their events.***
***Built with React, Tailwind CSS, NestJS, Prisma, and PostgreSQL.***

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

`./run.sh` creates a private `.env` with a generated database password if it does not exist. Existing configuration is preserved. To configure credentials yourself, copy `.env.example` to `.env` and use matching credentials in `POSTGRES_PASSWORD` and `API_DATABASE_URL`, with `db` as the database hostname. URL-encode special characters in the URL credentials.

Build and start all services:

```bash
./run.sh
```

### Local HTTPS certificate

The API applies committed database migrations and seeds the category catalog before starting. The script waits for the API, frontend, and database, exports Caddy’s public root certificate to `.local/certs/root.crt`, then watches source changes. On the first run, trust that certificate in another terminal (Ubuntu/Debian):

```bash
sudo install -m 0644 \
  .local/certs/root.crt \
  /usr/local/share/ca-certificates/younity-caddy.crt

sudo update-ca-certificates
```

Restart your browser. If it uses its own certificate store, import the certificate there too.

### :mag_right: Access

- Frontend: https://localhost
- Backend: https://localhost/api/
- Health: https://localhost/api/health
- Swagger: https://localhost/api/docs

Source changes update automatically while `./run.sh` is running.

Stop with `Ctrl+C`. Docker volumes preserve the database and certificates.

### Troubleshooting

- Docker must be running and accessible to your user. Ports 80, 443, and 5432 must be free.
- If a Docker build reports `ENOSPC`, inspect available disk space and `docker system df`. Unused build cache can be cleared with `docker builder prune`; this does not delete database volumes. Development images use slim Node bases and discard npm download caches.
- Inspect service output with `docker compose logs -f`. If startup fails, inspect logs and run `docker compose stop` before retrying.
- Changing `.env` does not change the password in an existing PostgreSQL volume. Keep the original credentials or update the database password explicitly.
- Trusting the local certificate is a one-time system/browser step and may require administrator privileges. The script exports it but does not modify your trust store.
- This Compose configuration is for development. Production builds can be checked with `npm run build` in each app; production hosting is not configured.

## Development checks

Select the Node version in `.nvmrc` for host-side commands. In `apps/api`, run `npm ci`, `npm run prisma:generate`, `npm run lint`, `npm test`, and `npm run build`. In `apps/web`, run `npm ci`, `npm run lint`, and `npm run build`.

Database tests require a separate database and `TEST_DATABASE_URL`; see [API setup](apps/api/README.md). Startup-script tests run with `python3 -m unittest discover -s tests -v`. GitHub Actions checks both applications, database migrations/seeds, and clean Docker/HTTPS startup.

See [database foundation](docs/database-foundation.md) for schema mappings, diagram corrections, and verification limits. Authentication and event workflows are not yet implemented.

## AI assistance

Codex assisted with development setup fixes, the SQL-to-Prisma translation, migration/seed setup, API configuration, CI, tests, and documentation. The team should review the documented diagram assumptions and understand the generated implementation before evaluation.
