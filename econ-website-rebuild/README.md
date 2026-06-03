# e-con Systems — Payload CMS + Medusa.js Workshop Demo

A local, Docker-based demo that shows **Payload CMS** (content) and **Medusa.js** (commerce)
working together behind a **Next.js 15** storefront — built to showcase the proposed
e-consystems.com rebuild during a workshop.

It seeds **8 real e-con Systems camera SKUs** across USB 3.0, MIPI CSI-2, and GMSL2 interfaces,
so the team can see a working catalog, product pages, a cart/quote flow, and both admin panels.

---

## What this demonstrates

Three connected stories the demo is built to walk through:

| Story | Flow | Point |
|-------|------|-------|
| **A — Edit → Live** | Payload admin → edit `See3CAM_CU135` → refresh storefront → change is live | Headless CMS in 60 seconds |
| **B — Search & Buy** | `/cameras` → search "4K global shutter IP67" → `STURDeCAM57` → Add to Cart → quote | How engineers actually shop |
| **C — Launch Product** | Payload admin → publish `NileCAM81` (starts as Draft) → appears on storefront | Content → commerce pipeline |

---

## Architecture

Three Docker containers, one `docker-compose.yml`, managed in Docker Desktop.

```
┌──────────────────┬──────────────────┬───────────────────────┐
│   app            │   medusa         │   postgres            │
│   Next.js 15     │   Medusa v2      │   PostgreSQL 16       │
│   + Payload v3   │   backend        │                       │
│   :3000          │   :9000          │   econ_payload  (db)  │
│   /        store │   /app    admin  │   econ_medusa   (db)  │
│   /admin   CMS   │   REST API       │   :5432 (internal)    │
└──────────────────┴──────────────────┴───────────────────────┘
```

- **Payload v3 runs *inside* the Next.js app** — `/admin` is the CMS, every other route is the storefront.
- **Medusa v2 is a separate backend** — handles products, variants, pricing, cart.
- **One Postgres instance, two databases** (`econ_payload`, `econ_medusa`) created by `init-db.sql` on first boot.

### URL map

| URL | What it is |
|-----|------------|
| http://localhost:3000 | Storefront homepage |
| http://localhost:3000/cameras | Catalog with interface/feature filters + search |
| http://localhost:3000/cameras/[slug] | Product detail + add-to-cart |
| http://localhost:3000/cart | Cart + B2B quote form |
| http://localhost:3000/admin | Payload CMS admin |
| http://localhost:9000/app | Medusa admin |

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| CMS | Payload v3 (`@payloadcms/db-postgres`, `@payloadcms/richtext-lexical`) |
| Commerce | Medusa v2 |
| Database | PostgreSQL 16 |
| Styling | Tailwind CSS v4 |
| Runtime | Node.js 22 (Alpine) |
| Containers | Docker + Docker Compose |

---

## Quick start

> **Prerequisites:** Docker Desktop running with **≥ 6 GB memory** allocated
> (Settings → Resources → Memory — the Payload admin compile OOMs at the 3.8 GB default).
> Ports 3000, 9000 free.

```bash
cd /Users/vrln/econ-website-rebuild
docker compose up --build
```

First build pulls dependencies and is slow (several minutes — Medusa v2 has a large dependency tree).
Subsequent builds reuse the npm cache mount and are much faster.

On first boot, the stack automatically:
1. Creates `econ_payload` + `econ_medusa` databases (`init-db.sql`)
2. Payload pushes its schema and seeds 8 cameras + 4 categories + an admin user
3. Medusa migrates, creates an admin user, and seeds 8 products (OEM Module + Dev Kit variants)

### Login credentials (local demo only)

| Panel | URL | Email | Password |
|-------|-----|-------|----------|
| Payload CMS | localhost:3000/admin | `admin@econ-demo.com` | `Admin@1234` |
| Medusa admin | localhost:9000/app | `admin@econ-demo.com` | `Admin@1234` |

---

## Seeded cameras

| SKU | Resolution | Interface | Key feature | Status |
|-----|-----------|-----------|-------------|--------|
| See3CAM_CU135 | 13MP | USB 3.0 | Machine vision | Published |
| See3CAM_CU81 | 8MP 4K | USB 3.0 | Wide angle | Published |
| See3CAM_130 | 13MP | USB 3.0 | Autofocus | Published |
| STURDeCAM57 | 4K HDR | GMSL2 | Global shutter, IP67 | Published |
| STURDeCAM31 | Full HD | GMSL2 | Global shutter, IP67, low-light | Published |
| **NileCAM81** | 8MP | MIPI CSI-2 | NVIDIA Jetson Orin | **Draft** (publish live in Story C) |
| NileCAM21 | 2MP HDR | MIPI CSI-2 | NVIDIA Jetson, HDR | Published |
| e-CAM55_CUMI1335 | 5MP | MIPI CSI-2 | Compact OEM module | Published |

Each Medusa product has two variants: **OEM Module** (base price) and **Development Kit** (+$150).

---

## Project structure

```
econ-website-rebuild/
├── docker-compose.yml        # 3 services: postgres, app, medusa
├── init-db.sql               # creates both databases
├── Dockerfile                # app image (Next.js + Payload)
├── start.sh                  # app entrypoint: wait for postgres → next dev
├── payload.config.ts         # Payload config: collections, DB, onInit seed
├── next.config.ts            # withPayload wrapper
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                       # root layout (html/body)
│   │   ├── (payload)/admin/...              # Payload admin route group
│   │   └── (store)/                         # storefront route group
│   │       ├── layout.tsx                   # nav header + footer
│   │       ├── page.tsx                     # homepage
│   │       ├── cameras/page.tsx             # catalog
│   │       ├── cameras/[slug]/page.tsx      # product detail
│   │       └── cart/page.tsx                # cart + quote form
│   ├── collections/          # Payload: Users, Categories, Cameras
│   ├── components/           # CameraCard, CatalogFilters, AddToCartButton, CartLineItems
│   └── lib/payload.ts        # getPayloadClient() helper
│
├── seed/
│   ├── camera-data.ts        # 8 cameras + 4 categories (single source of truth)
│   ├── payload-seed.ts       # standalone Payload seeder
│   └── medusa-seed.ts        # Medusa seeder (REST API)
│
└── medusa-backend/           # Medusa v2 app
    ├── Dockerfile
    ├── start.sh              # wait → migrate → create user → seed → start
    └── medusa-config.ts
```

---

## Common operations

```bash
# Start (detached)
docker compose up --build -d

# Watch logs
docker compose logs -f app
docker compose logs -f medusa

# Stop and remove containers
docker compose down

# Full reset (wipes seeded data — postgres volume removed)
docker compose down -v

# Reseed only: down -v then up again (seeds run on empty DB)
```

---

## Scope (this is a demo)

**In scope:** Payload CMS, Medusa commerce, Next.js storefront, catalog filters, keyword search,
cart + quote flow, both admin panels, automatic seeding.

**Out of scope (intentionally):** semantic/vector search (Algolia), real payments (Stripe), auth/SSO
(Cognito), multilingual content, AI features, production deployment. These are part of the full proposal,
not this workshop demo.

---

## Documentation

- **Design spec:** `docs/superpowers/specs/2026-06-02-econ-demo-design.md`
- **Implementation plan:** `docs/superpowers/plans/2026-06-02-econ-demo.md`
- **Original proposal:** `e-con-systems-technical-proposal.pdf`
- **Build/runtime gotchas:** `CLAUDE.md`
