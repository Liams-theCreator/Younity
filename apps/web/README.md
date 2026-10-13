# Younity web

React and TypeScript frontend, built with Vite and Tailwind CSS. The current starter screen checks API/database health through `/api/health`.

Run the full application with `./run.sh` from the repository root. See the root README for HTTPS and configuration. Caddy routes `/api/` requests to NestJS on the same origin.

For frontend-only development, select the Node version in `.nvmrc`, then run from this directory:

```bash
npm ci
npm run dev
```

Standalone Vite runs at http://localhost:5173 and proxies `/api` to the host API at http://127.0.0.1:3000. `API_PROXY_TARGET` overrides that target; Compose uses `http://api:3000`.

Checks:

```bash
npm run lint
npm run build
```
