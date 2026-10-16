#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Engine and Docker Compose 2.32 or newer." >&2
  exit 1
fi
if ! compose_version=$(docker compose version --short 2>/dev/null); then
  echo "Docker Compose is required (version 2.32 or newer)." >&2
  exit 1
fi
if [[ "$compose_version" =~ ^v?([0-9]+)\.([0-9]+)\.[0-9]+([-+].*)?$ ]]; then
  compose_major=$((10#${BASH_REMATCH[1]}))
  compose_minor=$((10#${BASH_REMATCH[2]}))
else
  echo "Could not determine Docker Compose version: $compose_version" >&2
  exit 1
fi
if (( compose_major < 2 || (compose_major == 2 && compose_minor < 32) )); then
  echo "Docker Compose 2.32 or newer is required (found $compose_version). Upgrade Docker Compose." >&2
  exit 1
fi
if ! docker compose watch --help | grep -- '--no-up' >/dev/null; then
  echo "Upgrade Docker Compose to version 2.32 or newer for Watch support." >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "Docker is not available. Start the daemon and check your user's Docker permissions." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  if ! command -v openssl >/dev/null 2>&1; then
    echo "Install OpenSSL, or copy .env.example to .env and configure matching database credentials." >&2
    exit 1
  fi
  database_password=$(openssl rand -hex 24)
  (umask 077; sed "s/REPLACE_WITH_LOCAL_PASSWORD/$database_password/g" .env.example > .env)
  unset database_password
  echo "Created .env with generated local database credentials."
fi

docker compose config --quiet
# Stop services on failure or exit; retain database and certificate volumes.
watch_pid=""
cleanup() {
  if [[ -n "$watch_pid" ]]; then
    kill "$watch_pid" 2>/dev/null || true
    wait "$watch_pid" 2>/dev/null || true
  fi
  docker compose stop
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

docker compose up --build --wait --wait-timeout 180

mkdir -p .local/certs
if docker compose exec -T caddy sh -c '
  for attempt in $(seq 1 30); do
    test -f /data/caddy/pki/authorities/local/root.crt && exit 0
    sleep 1
  done
  exit 1
' && docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt .local/certs/root.crt; then
  echo "Local HTTPS certificate: $PWD/.local/certs/root.crt"
  echo "First run on Ubuntu/Debian:"
  echo "  sudo install -m 0644 '$PWD/.local/certs/root.crt' /usr/local/share/ca-certificates/younity-caddy.crt"
  echo "  sudo update-ca-certificates"
  echo "Restart your browser; import the certificate there if it uses a separate trust store."
else
  echo "Could not export Caddy's certificate. Check: docker compose logs caddy" >&2
  exit 1
fi

echo "Frontend: https://localhost"
echo "Backend:  https://localhost/api/"
echo "Watching source changes. Press Ctrl+C to stop. Logs: docker compose logs -f"
docker compose watch --no-up &
watch_pid=$!
wait "$watch_pid"
