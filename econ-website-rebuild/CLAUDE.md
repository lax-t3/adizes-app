# CLAUDE.md — e-con Systems Demo

## What This Is
A local Docker demo showcasing **Payload CMS v3** + **Medusa.js v2** behind a **Next.js 15** storefront,
seeded with 8 real e-con Systems camera SKUs. Built for a sales/engineering workshop to demonstrate the
proposed e-consystems.com rebuild. Runs entirely on localhost via Docker Desktop — not production.

See `README.md` for the user-facing overview and `docs/superpowers/` for the design spec + implementation plan.

## Architecture
- **One `app` container** (port 3000): Next.js 15 with Payload v3 embedded. `/admin` = Payload CMS,
  every other route = storefront. Payload uses its Local API from server components.
- **One `medusa` container** (port 9000): Medusa v2 backend. `/app` = Medusa admin, REST API for cart/products.
- **One `postgres` container** (16-alpine): two databases — `econ_payload` and `econ_medusa` — created
  by `init-db.sql` on first boot. Internal only (not port-mapped).
- Seeding is automatic on first boot. Payload seeds via `onInit` in `payload.config.ts`; Medusa seeds via
  `seed/medusa-seed.ts` called from `medusa-backend/start.sh` after the API is healthy.

## Repo Map
| Path | Purpose |
|------|---------|
| `docker-compose.yml` | 3 services. App has volume mounts for hot-reload: `src/`, `seed/`, `payload.config.ts`, `package.json` |
| `init-db.sql` | Creates `econ_payload` + `econ_medusa` (runs once on empty postgres volume) |
| `Dockerfile` + `start.sh` | App image + entrypoint |
| `payload.config.ts` | Payload config: 3 collections, postgres adapter, `onInit` seed |
| `src/collections/` | `Users` (auth), `Categories`, `Cameras` |
| `src/app/(store)/` | Storefront routes (homepage, catalog, product, cart) |
| `src/app/(payload)/admin/` | Payload admin route group |
| `seed/camera-data.ts` | 8 cameras + 4 categories — single source of truth, imported by both seeders |
| `medusa-backend/` | Medusa v2 app. Dockerfile runs `medusa build` (needs `@medusajs/admin-sdk`) → `.medusa/server`; `start.sh` runs from there with `NODE_ENV=production` |

## Demo Stories (what the workshop walks through)
- **A:** Edit `See3CAM_CU135` in Payload admin → refresh storefront → live.
- **B:** Search "4K global shutter IP67" in `/cameras` → `STURDeCAM57` → add to cart → quote.
- **C:** Publish `NileCAM81` (seeded as **Draft**) in Payload admin → appears on storefront.

`NileCAM81` is intentionally seeded `status: 'draft'` so Story C starts by publishing it, not building from scratch.

## Credentials (local demo only)
| Panel | URL | Email | Password |
|-------|-----|-------|----------|
| Payload | localhost:3000/admin | admin@econ-demo.com | Admin@1234 |
| Medusa | localhost:9000/app | admin@econ-demo.com | Admin@1234 |

---

## ⚠️ Build & Runtime Gotchas (hard-won — read before debugging boot issues)

These were discovered while getting the first end-to-end boot working (18 distinct fixes in total). The
fixes are committed; the reasoning is here so they aren't accidentally reverted. The biggest time-sinks:
**#12b** (Payload admin CSS import), **#13** (Medusa migration SSL hang), and **#18** (Medusa admin
secure-cookie over HTTP).

### Build / Docker / Node

### 1. App/Payload image MUST be Node 22 (Medusa image is Node 20 — see #14)
The **app** `Dockerfile` pins `node:22-alpine`. On `node:20-alpine` (20.20.2) it crashes on startup with
`TypeError: Illegal constructor` from `undici/lib/web/cache/cachestorage.js` — Node 20.20's `CacheStorage`
global is non-constructible and undici v7 (bundled via Payload) tries to instantiate it at import time.
Do not downgrade the app image. (The **medusa** image deliberately uses `node:20-alpine`; they're separate.)

### 2. `payload.config.ts` imports collections with `.ts` extensions
On Node 22 + tsx ESM, extensionless imports (`./src/collections/Users`) fail with
`ERR_MODULE_NOT_FOUND`. Imports use explicit `.ts`:
```ts
import Users from './src/collections/Users.ts'
import { CAMERAS, CATEGORIES } from './seed/camera-data.ts'
```
(TypeScript-ESM convention would be `.js`, but tsx here resolves the literal `.ts` path. `.js` did NOT work.)

### 3. Do NOT run `npx payload migrate` in start.sh
On Node 22, the Payload CLI loads the config via `require()`, hitting
`ERR_REQUIRE_ASYNC_MODULE: require() cannot be used on an ESM graph with top-level await`.
Instead, schema is handled by `push: process.env.NODE_ENV === 'development'` on the postgres adapter, and
seeding by `onInit` in `payload.config.ts` — both run inside Next.js where ESM works.
**`start.sh` only does: wait for postgres → start Next.js.** No migrate step.

### 4. `import.meta.url` removed from payload.config.ts
`fileURLToPath(import.meta.url)` forces the module to be treated as async ESM, which the Payload CLI's
`require()` can't load (see #3). Replaced with `process.cwd()` for `path.resolve` base dirs.

### 5. `.dockerignore` is mandatory
Without it, `COPY . .` bakes `node_modules/` (1.4GB) and `.env` into the image — huge context, slow builds,
and a leaked-secret risk. `.dockerignore` excludes `node_modules/`, `.env`, `.next/`, etc. Never remove it.

### 6. npm cache mount speeds rebuilds
Both Dockerfiles use `RUN --mount=type=cache,target=/root/.npm npm install --prefer-offline` with the
`# syntax=docker/dockerfile:1` header. First build is still slow (Medusa v2 has a huge dep tree); rebuilds
reuse the cache. **Requires BuildKit** (`DOCKER_BUILDKIT=1`, default in modern Docker Desktop).

### 7. package.json is volume-mounted
`docker-compose.yml` mounts `./package.json:/app/package.json` so changes to the `dev` script take effect
on container recreate without an image rebuild. After editing it, you must **recreate** the container
(`docker compose up -d --force-recreate app`), not just `restart` — restart keeps the old mount set.

### Next.js / Payload

### 8. Use webpack, NOT turbopack, for the dev server
`next dev --turbopack` boots and compiles, then **hangs on `Pulling schema from database...`** — turbopack
skips Payload's `withPayload` webpack plugin, breaking the DB-layer init. Plain `next dev` (webpack) compiles
the storefront in ~3s and completes the schema push cleanly (`[✓]`). `package.json` `dev` script is
`next dev` (no `--turbopack`), and `start.sh` invokes it directly (see #9).

### 9. start.sh invokes `next` directly, not via `npm run dev`
`exec npm run dev` with npm as PID 1 sometimes fails to spawn the `next` child (container idles at ~22MiB,
no next-server). `start.sh` uses `exec node_modules/.bin/next dev` directly, which spawns reliably.

### 10. Docker Desktop needs ≥ 6 GB RAM
The Payload **admin** bundle (~3600 modules) is memory-heavy to compile. At the default 3.8 GiB the container
is **OOM-killed** mid-compile (`OOMKilled: true`, silent exit 0) — storefront works but `/admin` dies.
Bump Docker Desktop → Settings → Resources → Memory to **6 GB+**. With 3 containers running, 6 GB is the floor.

### 11. Payload admin requires `(payload)/layout.tsx` + API routes
The admin is NOT just the `[[...segments]]/page.tsx`. It needs:
- **`src/app/(payload)/layout.tsx`** — wraps admin with `RootLayout` from `@payloadcms/next/layouts`,
  passing `config`, `importMap`, and a `serverFunction` (wrapping `handleServerFunctions`). Without it:
  `Error: Cannot destructure property 'config' of '…' as it is undefined`.
- **`src/app/(payload)/api/[...slug]/route.ts`** (REST), **`api/graphql/route.ts`**,
  **`api/graphql-playground/route.ts`** — re-export Payload's route handlers. Needed for admin login + data ops.

### 12. No root `app/layout.tsx` — route groups own `<html>/<body>`
Payload's `RootLayout` renders its own `<html>/<body>`. A root `app/layout.tsx` that also renders them would
**nest `<html>` tags**. So there is **no `src/app/layout.tsx`**; instead `(store)/layout.tsx` provides the
storefront's `<html>/<body>` and `(payload)/layout.tsx` (via RootLayout) provides the admin's. Both `<html>`
and `<body>` carry `suppressHydrationWarning` to absorb browser-extension (Grammarly) attribute injection.

### 12b. Payload admin CSS — `import '@payloadcms/next/css'` (CRITICAL, was a demo-blocker)
`src/app/(payload)/layout.tsx` MUST `import '@payloadcms/next/css'`. Without it, Payload's 381KB admin theme
bundle lands only in the page-level CSS chunk, which Next.js emits as **preload-only (never applied)** — the
admin renders completely unstyled (serif fallback, no theme vars). The import puts the CSS in the *layout*
chunk, which loads as `rel=stylesheet`. Symptom: admin works but looks like raw HTML.

### Medusa

### 13. Medusa DATABASE_URL MUST end with `?sslmode=disable`
**This was the single hardest bug.** Without it, `medusa db:migrate` creates the `mikro_orm_migrations`
table then **hangs forever** — Medusa's migration runner opens a connection attempting SSL, and the local
non-SSL Postgres leaves it stuck on the handshake with no error (Postgres side sits idle on `ClientRead`).
With `?sslmode=disable`, all **164 migrations apply in ~15s**. The `docker-compose.yml` medusa
`DATABASE_URL` is `postgresql://econ:econ@postgres:5432/econ_medusa?sslmode=disable`.
Symptom to recognise: migration count stays at exactly 0, no error, container appears alive but idle.

### 14. Medusa image uses Node 20 (app uses Node 22)
Medusa v2 officially targets Node 20, so `medusa-backend/Dockerfile` is `node:20-alpine`. (The app/Payload
Dockerfile stays `node:22-alpine` for the undici fix — they're separate images.) Note: Node version was NOT
the migration-hang cause (#13 was), but Node 20 is the supported baseline for Medusa.

### 15. Medusa product options need a `values` array
In `seed/medusa-seed.ts`, product `options` must be `[{ title: 'Type', values: ['OEM Module',
'Development Kit'] }]`. Omitting `values` gives `400 Field 'options, 0, values' is required`. The
medusa seed runs (best-effort, non-fatal) from `medusa-backend/start.sh` after the API is healthy.

### 16. Medusa admin must be PRODUCTION-BUILT, and needs `@medusajs/admin-sdk`
Without a build, `medusa start` serves the admin via a **Vite dev server on a random port** — the browser
console shows `GET http://localhost:<random>/app/ net::ERR_CONNECTION_REFUSED` and the admin never loads.
Two requirements:
- **`@medusajs/admin-sdk`** in `medusa-backend/package.json`. A core module (`@medusajs/draft-order`) ships
  an admin extension that imports `defineRouteConfig` from it; without it `medusa build` fails with
  `"defineRouteConfig" is not exported by "__vite-optional-peer-dep:@medusajs/admin-sdk..."`.
- **`RUN npx medusa build`** in `medusa-backend/Dockerfile` (at image-build time) → compiles the admin into
  `.medusa/server/public/admin`. Then `cd .medusa/server && npm install`, and `start.sh` runs from
  `/app/.medusa/server`.

### 17. Medusa container MUST run with `NODE_ENV=production`
Even with a built admin, `medusa start` serves the **Vite dev** admin if `NODE_ENV=development`. The
`docker-compose.yml` medusa service sets `NODE_ENV: production` so `medusa start` serves the compiled
admin from `.medusa/server/public/admin` (HTML references `/app/assets/index-*.js`, no `/@vite/client`).

### 18. Medusa admin login over HTTP needs `cookieOptions: { secure: false }`
A consequence of #17. With `NODE_ENV=production`, Medusa defaults the admin **session cookie** to
`{ secure: true, sameSite: 'none' }` (see `@medusajs/framework/dist/http/express-loader.js`). The browser
**refuses to send a `secure` cookie over plain HTTP `localhost`**, so the admin login *succeeds*
(`POST /auth/user/emailpass` 200 → `POST /auth/session` 200) but every following `GET /admin/users/me`
returns **401** — the dashboard appears stuck on the login page / shows `{"message":"Unauthorized"}`.
Fix in `medusa-backend/medusa-config.ts`:
```ts
projectConfig: {
  // ...
  cookieOptions: { secure: false, sameSite: 'lax' },  // spread LAST over the session cookie → overrides secure
}
```
Verify: a cookie-only `GET /admin/users/me` (no Bearer) returns 200, and the set cookie's `secure` flag is FALSE.
Diagnostic tell: the browser flow logs `POST /auth/session 200` then repeated `GET /admin/users/me 401`.
(Note: API/Bearer auth always worked — `curl` with `Authorization: Bearer <token>` returns 200 — which is
why this looked like a credentials problem at first. It is NOT; it's the cookie's `secure` flag.)

---

## ✅ Full stack working (resolved 2026-06-03)

Everything boots and is verified: storefront (home, catalog, product, cart all HTTP 200), Payload admin
(login + fully styled, 381KB CSS), Medusa (health + admin HTTP 200, **8 products**, **164 migrations**).
First `/admin` compile ~25s; storefront routes 1–3s. **Requires Docker Desktop at 6 GB+ RAM.**

Boot order matters slightly: postgres → app (Payload pushes schema + seeds 8 cameras via onInit) and
medusa (migrates → creates admin user → seeds 8 products → starts API). Both app and medusa wait on
postgres healthcheck. Credentials for both admins: `admin@econ-demo.com` / `Admin@1234`.

---

## Common Commands
```bash
docker compose up --build -d          # build + start detached
docker compose logs -f app            # watch app logs
docker compose logs -f medusa         # watch medusa logs
docker compose down                   # stop + remove containers (keeps data volume)
docker compose down -v                # full reset — wipes seeded data
docker compose up -d --force-recreate app   # recreate app to pick up package.json/compose changes
```

## Reset / Reseed
Seeders are idempotent and only run on an empty DB. To reseed everything: `docker compose down -v` (removes
the postgres volume) then `docker compose up`. The Payload `onInit` seed checks for existing cameras and
skips if present; the Medusa seed checks `/store/products`.

To reseed **only Medusa** (keeps Payload data): stop medusa, drop+recreate just its DB, restart:
```bash
docker compose stop medusa
docker compose exec -T postgres psql -U econ -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='econ_medusa'"
docker compose exec -T postgres psql -U econ -d postgres -c "DROP DATABASE econ_medusa"
docker compose exec -T postgres psql -U econ -d postgres -c "CREATE DATABASE econ_medusa"
docker compose up -d medusa   # migrates (164, ~15s) → creates user → seeds 8 products
```

## Symptom → Fix Quick Reference
| Symptom | Cause | Gotcha |
|---------|-------|--------|
| App crashes at boot, `Illegal constructor` / `cachestorage.js` | app image on Node 20 | #1 |
| `ERR_MODULE_NOT_FOUND` on a collection import | extensionless import | #2 |
| `ERR_REQUIRE_ASYNC_MODULE` | ran `npx payload migrate` / `import.meta.url` | #3, #4 |
| Boot hangs on `Pulling schema from database...` | turbopack skips Payload plugin | #8 |
| Container idle ~22MiB, no next-server | `npm run dev` didn't spawn next | #9 |
| `/admin` dies mid-compile, `OOMKilled: true` | Docker RAM < 6 GB | #10 |
| `Cannot destructure property 'config'` on /admin | missing `(payload)/layout.tsx` | #11 |
| Nested `<html>` / hydration tag errors | root layout + RootLayout both render html | #12 |
| Admin loads but **completely unstyled** (serif) | missing `import '@payloadcms/next/css'` | #12b |
| **Medusa migration count stuck at 0, no error** | SSL handshake hang on non-SSL Postgres | **#13** |
| `400 Field 'options, 0, values' is required` | Medusa product options missing `values` | #15 |
| Browser: `GET localhost:<random>/app/ ERR_CONNECTION_REFUSED` | Medusa admin served via Vite dev (not built) | #16, #17 |
| `medusa build` fails: `defineRouteConfig not exported` | missing `@medusajs/admin-sdk` dep | #16 |
| `/app` HTML has `/@vite/client` | `NODE_ENV` not `production` | #17 |
| Medusa admin login "succeeds" but stays on login / `{"message":"Unauthorized"}`, `/admin/users/me` 401 in browser (but curl+Bearer works) | session cookie `secure:true` not sent over HTTP | **#18** |
