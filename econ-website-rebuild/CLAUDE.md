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
| `medusa-backend/` | Medusa v2 app (Dockerfile, start.sh, medusa-config.ts) |

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

These were discovered during the first end-to-end boot. The fixes are committed; the reasoning is here so
they aren't accidentally reverted.

### 1. Node.js MUST be 22, not 20
`node:20-alpine` (currently 20.20.2) crashes on startup with
`TypeError: Illegal constructor` from `undici/lib/web/cache/cachestorage.js`. Node 20.20's `CacheStorage`
global is non-constructible and undici v7 (bundled via Payload) tries to instantiate it at import time.
**Both Dockerfiles pin `node:22-alpine`.** Do not downgrade.

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
`docker-compose.yml` mounts `./package.json:/app/package.json` so changes to the `dev` script (webpack vs
turbopack) take effect on container recreate without an image rebuild. After editing it, you must
**recreate** the container (`docker compose up -d --force-recreate app`), not just `restart` — restart
keeps the old mount set.

---

## 🚧 UNRESOLVED: Task 9 — app won't finish booting in Docker (as of 2026-06-03)

Tasks 1–8 (all code) are complete, reviewed, and committed. The app **image builds fine** and **postgres
works**, but the Payload app does not finish its first boot. Two failure modes, depending on dev bundler:

- **Turbopack (`next dev --turbopack`):** server boots, banner prints, compiles in ~135s, then logs
  `Pulling schema from database...` and **hangs forever**. Root cause (strong suspicion): Turbopack skips
  Payload's `withPayload` webpack plugin, and drizzle's `push: true` schema sync waits on an interactive
  TTY confirmation that never comes in a non-TTY container.
- **Webpack (`next dev`, no flag):** `npm run dev` as PID 1 **never spawns the `next` child** (container
  sits at 22MiB RAM, only `npm` running). BUT invoking `./node_modules/.bin/next dev` **directly** inside
  the container DID start node and begin compiling — pointing at the fix.

### Recommended fix (not yet applied — awaiting restart approval)
1. **Invoke Next directly** in `start.sh`: `exec node_modules/.bin/next dev` (or `next start` after a build)
   instead of `exec npm run dev`. The npm-as-PID-1 wrapper is the webpack-mode blocker.
2. **Replace interactive `push: true`** with a **pre-generated migration** applied non-interactively, so
   schema creation never waits on a TTY prompt. Generate the migration once on the host (Node 25 there works),
   commit it, and apply it programmatically via `payload.db.migrate()` in `onInit` or a dedicated step — OR
   add `--accept-data-loss` / non-interactive flag to the drizzle push if Payload exposes one.

When picking this back up: confirm the bundler choice first, fix `start.sh` invocation, then resolve the
schema-push interactivity. Don't re-litigate #1–#6 above — those are settled.

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
Seeders are idempotent and only run on an empty DB. To reseed: `docker compose down -v` (removes the
postgres volume) then `docker compose up`. The `onInit` seed checks for existing cameras and skips if present.
