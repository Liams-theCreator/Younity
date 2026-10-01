#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if [[ ! -f .env ]]; then
  echo "Missing root .env. Copy .env.example to .env and configure it first."
  exit 1
fi

docker compose config --quiet
exec docker compose up --build --watch
