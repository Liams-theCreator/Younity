*This project has been created as part of the 42 curriculum by imellali, asyani, aaferyad, oait-h-m and sboukiou.

# Younity

Younity is a web platform connecting Moroccan university students with campus events and opportunities.

Students will be able to discover hackathons, conferences, workshops, and networking events, while organizers will have tools to publish and manage their events.

Built with React, Tailwind CSS, NestJS, Prisma, and PostgreSQL.

## Build and run

### Requirements

- Git
- Docker Engine
- Docker Compose 2.32 or newer

### Setup

```bash
git clone git@github.com:Liams-theCreator/Younity.git
cd Younity
git switch dev-setup
cp .env.example .env
```

Edit `.env` with your local database credentials. Use matching credentials in `POSTGRES_PASSWORD` and `API_DATABASE_URL`, with `db` as the database hostname.

Build and start all services:

```bash
./run.sh
```

### Local HTTPS certificate

On the first run, execute these commands in another terminal from the repository root (Ubuntu/Debian):

```bash
docker compose cp \
  caddy:/data/caddy/pki/authorities/local/root.crt \
  /tmp/younity-caddy-root.crt

sudo install -m 0644 \
  /tmp/younity-caddy-root.crt \
  /usr/local/share/ca-certificates/younity-caddy.crt

sudo update-ca-certificates
```

Restart your browser. If it uses its own certificate store, import the certificate there too.

### Access

- Frontend: https://localhost
- Backend: https://localhost/api/

Source changes update automatically while `./run.sh` is running.

Stop with `Ctrl+C`. Docker volumes preserve the database and certificates.
