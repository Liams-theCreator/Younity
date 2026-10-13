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

The script waits for the API, frontend, and database, exports Caddy’s public root certificate to `.local/certs/root.crt`, then watches source changes. On the first run, trust that certificate in another terminal (Ubuntu/Debian):

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

Source changes update automatically while `./run.sh` is running.

Stop with `Ctrl+C`. Docker volumes preserve the database and certificates.

### Troubleshooting

- Docker must be running and accessible to your user. Ports 80, 443, and 5432 must be free.
- Inspect service output with `docker compose logs -f`. If startup fails, inspect logs and run `docker compose stop` before retrying.
- Changing `.env` does not change the password in an existing PostgreSQL volume. Keep the original credentials or update the database password explicitly.
- Trusting the local certificate is a one-time system/browser step and may require administrator privileges. The script exports it but does not modify your trust store.
- This Compose configuration is for development. Production builds can be checked with `npm run build` in each app; production hosting is not configured.
