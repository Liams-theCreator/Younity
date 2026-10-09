# Younity frontend

React 19, TypeScript, Vite, and Tailwind CSS 4. Frontend work belongs in this directory.

## Structure

```text
apps/web/
├── public/                 # Static files served by URL, e.g. /favicon.svg
├── src/
│   ├── assets/
│   │   ├── icons/          # SVGs imported by components
│   │   └── images/         # Images imported by components
│   ├── components/
│   │   └── ui/             # Shared buttons, inputs, and other UI primitives
│   ├── features/
│   │   └── auth/           # Authentication screens and feature-specific logic
│   ├── pages/
│   │   └── landing/
│   │       └── LandingPage.tsx
│   ├── App.tsx             # Composes pages; future routing belongs here
│   ├── index.css           # Tailwind import and global styles
│   └── main.tsx            # React entry point
├── index.html              # HTML shell and browser title
├── package.json            # Dependencies and development commands
├── package-lock.json       # Generated dependency lockfile
├── vite.config.ts          # React and Tailwind integration
├── eslint.config.js        # Lint configuration
├── tsconfig*.json          # TypeScript configuration
└── Dockerfile              # Frontend development container
```

The UI and auth directories contain `.gitkeep` files so Git preserves them until
components are added. The existing starter images and icons are retained; they
are not currently used by the landing page. `public/icons.svg` is also retained.

## Where to work

- Edit `src/pages/landing/LandingPage.tsx` for the landing page.
- Put AUTH-05 screens and their related logic in `src/features/auth/`. Add
  `components/`, `hooks/`, or an API module there only when the feature needs them.
- Put a component in `src/components/ui/` when it is shared across features.
  Coordinate shared component changes with other frontend developers.
- Keep page-specific styles beside their component. Use `src/index.css` for
  application-wide styles only; its Tailwind import must remain present.
- Import bundled images from `src/assets/images/` and icons from
  `src/assets/icons/`. Reference public files by URL, such as `/favicon.svg`.
- Connect your screen through `src/App.tsx`. There is no routing library yet.
- Use `.tsx` for JSX components and `.ts` for types and ordinary functions.
- Never edit generated `node_modules/` or `dist/` files.

Backend code is in `../api`. Docker and Caddy configuration are shared project
infrastructure. Frontend feature work should not require changes to those files.

## Running locally

From the repository root, run `./run.sh` and leave it running. Compose watch syncs
source edits to the container and Vite updates the browser when you save.

With the local rootless Docker port mappings `8080:80` and `8443:443`, open
`https://localhost:8443`. Browser certificate trust can be configured without
sudo by importing Caddy's root certificate into a supported browser's authority
store. Keep exported certificates out of feature commits.

For frontend-only work, select the Node version in the repository's `.nvmrc`,
then run from this directory:

```bash
npm ci
npm run dev
```

Use the URL printed by Vite. Frontend-only mode does not provide an `/api` proxy.
For integration, use the full Docker stack and relative `/api/...` requests.
Caddy removes `/api` before forwarding the request to NestJS.

## Before committing

From the repository root, check the running frontend container:

```bash
docker compose exec web npm run lint
docker compose exec web npm run build
git diff --check
git status --short
git diff -- apps/web
```

In the managed cloud environment, include its override in Compose commands:

```bash
docker compose -f compose.yml -f /workspace/.younity/compose.cloud.yml exec web npm run lint
docker compose -f compose.yml -f /workspace/.younity/compose.cloud.yml exec web npm run build
```

Stage the specific files for your task and review `git diff --cached` before
committing. AUTH-05 isolates your commits, but shared files still require team
coordination.
