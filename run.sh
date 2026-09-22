#!/bin/bash

set -e

docker compose up --build --watch api caddy

docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt /tmp/younity-caddy-root.crt
sudo cp /tmp/younity-caddy-root.crt /usr/local/share/ca-certificates/younity-caddy.crt
sudo update-ca-certificates
