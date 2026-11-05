# SIIP

A free graduate internship and development programme for Nigeria. This repository holds both apps:

| Folder                 | What it is                                                                                                            | Runs on               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------- |
| [backend/](backend/)   | The API: Next.js route handlers, Prisma, Better Auth, emails, PDFs, cron. See [backend/README.md](backend/README.md). | http://localhost:4000 |
| [frontend/](frontend/) | The web app for graduates, companies and admins (being built).                                                        | http://localhost:3000 |
| [shared/](shared/)     | Zod schemas, status enums and Nigerian helpers used by both, so forms and the API validate the same way.              | —                     |

## Quick start

```bash
pnpm install            # installs every package (pnpm workspace)
pnpm db:local           # local Postgres on port 5433 (keep this terminal open)
pnpm --filter @siip/backend db:deploy
pnpm --filter @siip/backend db:seed
pnpm dev:backend        # API on :4000
pnpm dev:frontend       # web app on :3000
```

## How the two apps connect

The frontend proxies every `/api/*` request to the backend via a Next.js rewrite. The browser only ever talks to the frontend's domain, so Better Auth's session cookies are first-party and no CORS or cross-domain cookie setup is needed.

On Vercel, deploy them as **two projects** from this repo:

- **Backend:** root directory `backend`.
- **Frontend:** root directory `frontend`, with `API_URL` set to the backend's URL.
- **The backend's `APP_URL`** must be the frontend's public URL, because email links point there.

## Common commands (from the repo root)

| Command          | What it does                                                |
| ---------------- | ----------------------------------------------------------- |
| `pnpm typecheck` | Type-check every package.                                   |
| `pnpm lint`      | Lint every package.                                         |
| `pnpm test`      | Backend unit and integration tests (needs `pnpm db:local`). |
| `pnpm format`    | Prettier across the repo.                                   |
