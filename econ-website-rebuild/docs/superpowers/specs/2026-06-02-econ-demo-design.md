# e-con Systems — Payload CMS + Medusa.js Workshop Demo

**Date:** 2026-06-02  
**Context:** Workshop with e-con Systems team to showcase Payload CMS and Medusa.js as the CMS and commerce engine for the proposed e-consystems.com rebuild.  
**Constraint:** Must run on a single laptop (Docker Desktop) within 2–3 hours.

---

## Goal

Build a local demo site that tells three connected stories in sequence:

| Story | Arc | Key moment |
|-------|-----|------------|
| A — Edit → Live | Open Payload admin → update See3CAM_CU135 description → Publish → refresh storefront → change visible | Headless CMS concept in 60 seconds |
| B — Search & Buy | Browse `/cameras` → search "4K global shutter IP67" → STURDeCAM57 appears → view specs → Add to Cart → quote form | How engineers actually shop today vs the old site |
| C — Launch Product | Payload admin → find NileCAM81 (Draft) → fill final fields → Publish → appears on storefront immediately | Full content → commerce → customer pipeline |

---

## Architecture

Three Docker containers managed via Docker Desktop, defined in a single `docker-compose.yml` at the repo root.

```
┌─────────────────────────────────────────────────────────────┐
│                     docker-compose.yml                       │
├──────────────────┬──────────────────┬───────────────────────┤
│   app            │   medusa         │   postgres            │
│   Next.js 15     │   Medusa v2      │   PostgreSQL 16       │
│   + Payload v3   │   backend        │                       │
│                  │                  │   econ_payload (db)   │
│   :3000          │   :9000          │   econ_medusa  (db)   │
│   /admin → CMS   │   /app → admin   │   :5432 (internal)    │
│   / → storefront │   REST API       │                       │
└──────────────────┴──────────────────┴───────────────────────┘
```

**Data flow:** Browser → Next.js app (Payload Local API for content) + (Medusa Storefront API for cart/pricing)

**Key principle:** Payload v3 runs *inside* the Next.js app (not as a separate service). The `/admin` route is Payload CMS; all other routes are the storefront reading from Payload's Local API. Medusa handles cart, variants, and pricing only.

---

## Tech Stack

| Layer | Choice | Version |
|-------|--------|---------|
| Framework | Next.js (App Router) | 15 |
| CMS | Payload | v3 |
| Commerce | Medusa | v2 |
| Database | PostgreSQL | 16 |
| Styling | Tailwind CSS | v4 |
| Containerisation | Docker + Docker Compose | — |
| Language | TypeScript | 5 |

---

## Repository Structure

```
econ-website-rebuild/
├── docker-compose.yml
├── .env.example
├── app/                         # Next.js 15 + Payload v3
│   ├── payload.config.ts        # Payload configuration
│   ├── (payload)/               # Payload admin routes
│   │   └── admin/[[...segments]]/
│   ├── (app)/                   # Storefront routes
│   │   ├── page.tsx             # Homepage
│   │   ├── cameras/
│   │   │   ├── page.tsx         # Catalog
│   │   │   └── [slug]/page.tsx  # Product detail
│   │   └── cart/page.tsx        # Cart / quote form
│   └── api/
│       └── cart/route.ts        # Medusa cart proxy
├── collections/
│   ├── Cameras.ts               # Payload camera collection
│   └── Categories.ts            # Payload categories collection
├── seed/
│   ├── payload-seed.ts          # Seeds 8 cameras into Payload
│   └── medusa-seed.ts           # Seeds 8 products into Medusa
└── medusa-backend/              # Medusa v2 app
    ├── medusa-config.ts
    └── Dockerfile
```

---

## Data Model

### Payload — `cameras` collection

| Field | Type | Notes |
|-------|------|-------|
| `sku` | text | Unique, e.g. `See3CAM_CU135` |
| `name` | text | Display name |
| `slug` | text | Auto-generated from name |
| `tagline` | text | One-line description |
| `description` | richText | Full product description |
| `thumbnail` | upload | Product image |
| `interface` | select | `USB3.0` \| `MIPI-CSI2` \| `GMSL2` \| `GigE` |
| `resolution` | text | e.g. `13MP`, `4K (3840×2160)` |
| `sensor` | text | e.g. `Sony IMX335` |
| `features` | checkboxes | globalShutter, HDR, IP67, IP69K, autofocus, wideAngle |
| `platforms` | multiSelect | Jetson Orin NX, Jetson AGX, Raspberry Pi, etc. |
| `datasheet` | upload | PDF |
| `price_usd` | number | Base OEM module price |
| `medusa_product_id` | text | FK to Medusa product |
| `category` | relationship | → `categories` collection |
| `status` | select | `draft` \| `published` |
| `publishedAt` | datetime | — |

### Payload — `categories` collection

`name`, `slug`, `description`  
Seeded values: USB Cameras · MIPI Cameras · Industrial / Rugged · Automotive / ADAS

### Medusa — products

8 cameras mirrored from Payload seed data. Each product has two variants:
- **OEM Module** — base price
- **Development Kit** — base price + $150

Organised into 3 Medusa collections: USB Cameras · MIPI Cameras · Industrial/Rugged

---

## Seeded Cameras (8)

| SKU | Resolution | Interface | Key Feature | Demo Role |
|-----|-----------|-----------|-------------|-----------|
| See3CAM_CU135 | 13MP | USB 3.0 | Fixed focus, compact | **Story A** — edited live |
| See3CAM_CU81 | 8MP 4K | USB 3.0 | Wide angle | Catalog browse |
| See3CAM_130 | 13MP | USB 3.0 | Autofocus | Catalog browse |
| STURDeCAM57 | 4K HDR | GMSL2 | Global shutter, IP67 | **Story B** — search result |
| STURDeCAM31 | Full HD | GMSL2 | Global shutter, IP67, low-light | **Story B** — search result |
| NileCAM81 | 8MP | MIPI CSI-2 | NVIDIA Jetson Orin | **Story C** — starts as Draft |
| NileCAM21 | 2MP HDR | MIPI CSI-2 | NVIDIA Jetson, HDR | Catalog browse |
| e-CAM55_CUMI1335 | 5MP | MIPI CSI-2 | Compact OEM module | Comparison |

NileCAM81 is intentionally seeded as `status: draft` so Story C (launch product) starts with publishing it, not building from scratch — safer for a live demo.

---

## Storefront Pages

| Route | Page | Data source |
|-------|------|-------------|
| `/` | Homepage — hero + 3 featured cameras | Payload Local API |
| `/cameras` | Catalog — grid + filter sidebar (interface, features) | Payload Local API |
| `/cameras/[slug]` | Product detail — specs, variants, datasheet, Add to Cart | Payload (content) + Medusa (price/variants) |
| `/cart` | Cart — line items + B2B quote request form | Medusa Storefront API |
| `/admin/...` | Payload CMS admin | Payload (built-in) |
| `:9000/app` | Medusa admin — orders, pricing, inventory | Medusa (built-in) |

### Catalog filter behaviour
Filters (interface, features) are query-param driven (`/cameras?interface=GMSL2&features=IP67`). Payload query passed server-side; no client-side JS filtering needed. This demonstrates Payload's query capability naturally.

### Cart / quote flow
Cart uses Medusa's Storefront API. Checkout is a **quote request form** (company name, email, message) — not a full payment flow. Matches e-con's actual B2B process and avoids Stripe configuration during setup.

---

## Docker Compose Services

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: econ
      POSTGRES_PASSWORD: econ
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql  # creates both DBs

  app:
    build: .
    ports: ["3000:3000"]
    environment:
      DATABASE_URI: postgresql://econ:econ@postgres:5432/econ_payload
      PAYLOAD_SECRET: econ-demo-secret-change-in-prod
      MEDUSA_BACKEND_URL: http://medusa:9000
      NEXT_PUBLIC_MEDUSA_BACKEND_URL: http://localhost:9000
    depends_on: [postgres]

  medusa:
    build: ./medusa-backend
    ports: ["9000:9000"]
    environment:
      DATABASE_URL: postgresql://econ:econ@postgres:5432/econ_medusa
    depends_on: [postgres]
```

A single `init-db.sql` creates both `econ_payload` and `econ_medusa` databases on first boot.

---

## Seed Strategy

Both seed scripts run automatically via Docker entrypoint on first boot (skipped if data already exists).

1. **`payload-seed.ts`** — Creates categories, then inserts all 8 cameras via Payload Local API. NileCAM81 inserted with `status: draft`.
2. **`medusa-seed.ts`** — Creates 3 collections, inserts 8 products with OEM Module + Dev Kit variants and prices. Creates a seed admin user (`admin@econ-demo.com` / `Admin@1234`) via Medusa's `createUser` API before inserting products.

---

## Demo Script (workshop)

### Setup (before the room fills)
```bash
cd /Users/vrln/econ-website-rebuild
docker compose up --build
# Wait ~3 min for first boot + seed
# Open localhost:3000 and localhost:3000/admin in two browser tabs
# Payload admin login: admin@econ-demo.com / Admin@1234
# Medusa admin login (localhost:9000/app): admin@econ-demo.com / Admin@1234
```

### Story A — "Edit a product, see it live" (~3 min)
1. Open `localhost:3000/admin` → log in → Cameras → See3CAM_CU135
2. Change the tagline to something visible (e.g. "Now with enhanced low-light performance")
3. Hit Save & Publish
4. Switch to `localhost:3000/cameras/see3cam-cu135` → refresh → change is live

### Story B — "Engineer finds and buys a camera" (~4 min)
1. Open `localhost:3000/cameras`
2. Type "4K global shutter outdoor robot IP67" in the search bar
3. STURDeCAM57 and STURDeCAM31 appear at the top
4. Click STURDeCAM57 → view specs, sensor, platform compatibility
5. Select "Development Kit" variant → Add to Cart
6. Go to cart → fill in quote form → Submit

### Story C — "Launch a new product" (~3 min)
1. Back in `localhost:3000/admin` → Cameras → NileCAM81 (shows Draft badge)
2. Update the description, confirm price, set status to Published → Save
3. Switch to `localhost:3000/cameras` → NileCAM81 appears in the grid
4. Open `localhost:9000/app` → show NileCAM81 already exists as a Medusa product with pricing

---

## Out of Scope (for this demo)

- Semantic / vector search (Algolia) — search uses Payload's built-in text query
- Authentication / Cognito
- Real payment processing (Stripe)
- Multilingual content (i18n)
- Datasheet RAG / AI features
- Production deployment
