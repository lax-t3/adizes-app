# Organisation Onboarding Module — Design Spec
**Date:** 2026-03-19
**Status:** Draft
**Platform:** Adizes PAEI Assessment (HIL Adizes India)

---

## 1. Overview

Add an Organisation Onboarding module to the admin platform that allows HIL's admin team to:

1. Create and manage client organisations with an unlimited-depth hierarchy (company → division → department → team → …)
2. Add employees (single or bulk CSV) to any node — which creates their platform account and sends a welcome email
3. Optionally associate cohorts with one or more organisations, unlocking bulk enrolment of employees by org/node scope

The feature is **admin-managed only** — no self-service by client organisations. The existing role model (HIL admin vs user) is unchanged.

---

## 2. Data Model

### 2.1 New Tables (Migration 007)

#### `organizations`
Root record for each client company.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text NOT NULL | e.g. "Acme Corporation" |
| `description` | text | |
| `created_at` | timestamptz | |

#### `org_nodes`
Every unit in the hierarchy. Creating an organisation automatically creates its root node (the company itself).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `org_id` | uuid FK → organizations NOT NULL | |
| `parent_id` | uuid FK → org_nodes | NULL = root node |
| `is_root` | boolean NOT NULL DEFAULT false | True only for the single root node per org |
| `path` | text NOT NULL | Materialized path — see §2.2 |
| `name` | text NOT NULL | e.g. "North India Division" |
| `node_type` | text | Optional label: company / division / department / team |
| `display_order` | int DEFAULT 0 | For ordering siblings |
| `created_at` | timestamptz | |

**Indexes:**
- `org_nodes(org_id)`
- `org_nodes(path text_pattern_ops)` — enables fast `LIKE 'prefix/%'` subtree queries
- `org_nodes(parent_id)`
- `UNIQUE(org_id) WHERE is_root = true` — enforces exactly one root per org at the DB level; also used by the app-layer root-deletion guard to identify the root node reliably

#### `org_employees`
Associates a platform user with exactly one node. A user may belong to at most one node per organisation; they may appear in multiple organisations (e.g. a contractor shared across clients).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `org_id` | uuid FK → organizations NOT NULL | Denormalized for fast org-scoped queries |
| `node_id` | uuid FK → org_nodes NOT NULL | The employee's department/team |
| `user_id` | uuid FK → auth.users | |
| `employee_id` | text | Optional external HR ID |
| `title` | text | Job title |
| `joined_at` | timestamptz | |
| UNIQUE | `(org_id, user_id)` | One node per user per org; allows same user in multiple orgs |

**Indexes:**
- `org_employees(org_id)`
- `org_employees(node_id)`
- `org_employees(user_id)`

#### `cohort_organizations`
Junction table — a cohort can be linked to multiple organisations; an org can be linked to multiple cohorts.

| Column | Type | Notes |
|--------|------|-------|
| `cohort_id` | uuid FK → cohorts NOT NULL | |
| `org_id` | uuid FK → organizations NOT NULL | |
| `linked_at` | timestamptz | |
| PK | `(cohort_id, org_id)` | |

### 2.2 Materialized Path Convention

The `path` column on `org_nodes` stores the full ancestry chain using node UUIDs separated by `/`:

```
Root node:  "<org_id>/<root_node_id>"
Child:      "<org_id>/<root_node_id>/<child_id>"
Grandchild: "<org_id>/<root_node_id>/<child_id>/<grandchild_id>"
```

**Set on create:** `new_node.path = parent.path + "/" + new_node.id`
**Root node:** `root_node.path = org_id + "/" + root_node.id`

**`parent_id` is immutable** — nodes cannot be reparented in v1. The PUT endpoint does not accept `parent_id`. This ensures paths are always valid.

**Subtree query:** To fetch all nodes under a given node (including itself):
```sql
SELECT * FROM org_nodes
WHERE org_id = $org_id
  AND (id = $node_id OR path LIKE $node_path || '/%')
```
The `OR id = $node_id` clause ensures the node itself is included (the `LIKE` only matches descendants).

**Rename:** Renaming a node does not affect `path` (path uses IDs, not names), so no cascade update is needed.

### 2.3 Existing Tables — No Changes
`auth.users`, `cohorts`, `cohort_members`, `assessments`, `answers`, `app_settings` — unchanged.

---

## 3. Backend API

All endpoints require admin JWT. Added to the existing `/admin` router.

### 3.1 Organisation CRUD

| Method | Path | Response notes |
|--------|------|---------------|
| `GET` | `/admin/organizations` | List: id, name, description, node_count, employee_count (JOINed on-the-fly), created_at |
| `POST` | `/admin/organizations` | Body: `{name, description}`. Creates org + root node atomically. Returns org + root node. |
| `GET` | `/admin/organizations/{org_id}` | Org detail + full node tree + linked_cohort_count |
| `PUT` | `/admin/organizations/{org_id}` | Update name/description only |
| `DELETE` | `/admin/organizations/{org_id}` | App-layer guard: reject if any `org_employees` rows exist for this org (clean 400 error). DB RESTRICT on `org_employees.node_id → org_nodes` acts as safety net if guard is bypassed. |

**Note on aggregate counts:** `node_count` and `employee_count` in the list endpoint are computed via JOIN for v1 (acceptable at expected org scale of hundreds, not millions). Add a DB view or denormalized counters if performance becomes an issue.

### 3.2 Node Management

Allowed fields for `PUT` (rename/reorder only — `parent_id` is immutable):

| Method | Path | Body / notes |
|--------|------|-------------|
| `POST` | `/admin/organizations/{org_id}/nodes` | `{parent_id, name, node_type, display_order}`. Sets path automatically. |
| `PUT` | `/admin/organizations/{org_id}/nodes/{node_id}` | `{name, node_type, display_order}` only. `parent_id` not accepted. |
| `DELETE` | `/admin/organizations/{org_id}/nodes/{node_id}` | Guard: reject if node or any descendant has employees. DB RESTRICT on `org_employees.node_id` is the safety net. Cannot delete root node. |

### 3.3 Employee Management

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/admin/organizations/{org_id}/nodes/{node_id}/employees` | Query param `?include_descendants=true` fetches subtree using path LIKE. |
| `POST` | `/admin/organizations/{org_id}/nodes/{node_id}/employees` | Add single employee (see logic below). |
| `POST` | `/admin/organizations/{org_id}/nodes/{node_id}/employees/bulk` | Bulk upload multipart CSV. |
| `DELETE` | `/admin/organizations/{org_id}/employees/{org_employee_id}` | `{org_employee_id}` is the `org_employees.id` UUID PK. Does NOT delete auth user or cohort memberships. |

**Single employee add — logic (3 cases):**
1. **Email not in `auth.users`:** Call Supabase Admin API `generate_link(type="invite", email=...)` to get a one-time activation URL. Create `auth.users` record (Supabase handles this internally via the invite flow). Insert `org_employees`. Send `org_welcome` email with the returned `action_link` as `activation_url`.
2. **In `auth.users` but not yet activated (`email_confirmed_at IS NULL`):** Call Supabase Admin API `generate_link(type="recovery", email=...)` to get a password-reset/activation URL. Insert `org_employees`. Send `org_welcome` email with the returned `action_link` as `activation_url`. (Same template as case 1; the link type differs but the user experience is identical — they set a password and gain access.)
3. **Already activated:** Insert `org_employees` only. No email — user already has an account and will receive a cohort enrolment email when added to a cohort.

**Bulk upload — CSV columns:**
```
name, email, title, employee_id, node_path
```
- `node_path` is optional; if omitted, placed in the selected node.
- `node_path` is a `/`-separated chain of node `name` values from root to target, e.g. `"North India Division/Sales"`. Matching is **case-insensitive and trimmed** against the stored `name` column. The root org node name is not included in the path (path starts from the first child level). If multiple nodes share the same name at the same level, the first match by `display_order` is used — admins should ensure sibling names are unique.
- Pre-import validation: invalid email format, duplicate email within file, `node_path` not found → flagged in preview, not imported.
- Already-in-org emails: skipped with reason "already in org".
- Response: `{ created: N, skipped: N, errors: [{row, reason}] }`

### 3.4 Cohort ↔ Organisation Linking

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/admin/cohorts/{cohort_id}/organizations` | Orgs linked to a cohort |
| `POST` | `/admin/cohorts/{cohort_id}/organizations` | Body: `{org_id}`. Links org to cohort. |
| `DELETE` | `/admin/cohorts/{cohort_id}/organizations/{org_id}` | Unlink. Does not affect enrolments already created. |
| `GET` | `/admin/organizations/{org_id}/cohorts` | Cohorts linked to a given org (used by org detail page stats). |

### 3.5 Enrol from Org

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/admin/cohorts/{cohort_id}/enroll-from-org` | Bulk or individual enrol from org employees. |

**Request body:**
```json
{
  "org_id": "<uuid>",
  "node_id": "<uuid> | null",
  "include_descendants": true,
  "user_ids": ["<uuid>", ...] // optional — if provided, overrides node scope
}
```

- `user_ids` present → enrol exactly those users (individual selection mode; used for picking specific employees in the org modal).
- `user_ids` absent + `node_id` null → enrol entire org.
- `user_ids` absent + `node_id` set + `include_descendants: true` → enrol node + all descendants.
- `user_ids` absent + `node_id` set + `include_descendants: false` → direct members of that node only.
- Already-enrolled users are silently skipped in all cases.
- Sends enrolment emails using the existing 3-case email logic (same as `bulk_enroll`).
- Returns `{ enrolled: N, skipped: N }`.

---

## 4. Frontend

### 4.1 Admin Navigation
`Organizations` added to the admin sidebar between **Dashboard** and **Cohorts**.

### 4.2 New Pages

#### `AdminOrganizations` (`/admin/organizations`)
- Table: Name, description, node count, employee count, created date, Actions (View, Delete)
- "New Organisation" button → modal: name + description → creates org + root node

#### `AdminOrgDetail` (`/admin/organizations/:orgId`)
**Split-panel layout — tree (35%) + detail panel (65%):**

**Left panel — node tree:**
- Collapsible tree of all nodes with employee count per node
- Click any node to load its detail in the right panel
- `+ Add sub-node` inline button at any level
- Root node always expanded by default

**Right panel — selected node detail:**
- Node name, type badge, breadcrumb path
- Stats row: direct employees · total in subtree · linked cohorts
- **Employees tab:**
  - Table: name, email, title, employee_id, status (Active / Pending activation)
  - Toggle: "Include sub-nodes" (fetches subtree via `?include_descendants=true`)
  - `+ Add Employee` → modal: name, email, title, employee_id (optional)
  - `Bulk Upload` → CSV upload flow: template download → file select → preview table with validation errors highlighted → confirm
  - Remove button per row (calls DELETE, confirms with dialog)

### 4.3 Modified Pages

#### `AdminCohortDetail` — two additions:

**"Linked Organisations" section** (new, below existing enrol controls):
- List of linked orgs with name, employee count, Unlink button
- `Link Organisation` button → searchable dropdown of all orgs → select → save
- If no orgs linked: section shows "No organisations linked yet" with Link button

**"Enrol from Org" button** (only visible when ≥1 org is linked):
- Opens modal with two tabs:
  - **By Scope:** org tree selector (radio: entire org / specific node with Include descendants toggle) — shows employee count per option — Enrol button
  - **By Individual:** searchable list of org employees (name, email, department) — multi-select checkboxes — Enrol selected button
- Both tabs show preview: "X employees will be enrolled. Y already enrolled — will be skipped."
- On confirm: POST to `enroll-from-org` with appropriate body, toast summary on success

---

## 5. Email Templates

### `org_welcome` (new)
Sent when an employee is added to the org and either a new account is created (case 1) or an existing unactivated account is found (case 2).

**Variables:** `user_name`, `org_name`, `platform_name`, `platform_url`, `activation_url`

**Subject:** `You've been added to {{org_name}} on the Adizes PAEI Platform`

**Content:**
- Welcome to `{org_name}` on the platform
- Brief: your organisation has registered you on the Adizes PAEI assessment platform
- CTA: "Activate Your Account" → `activation_url`
- Footer note: you may be invited to an assessment cohort by your administrator

**Case 3 (already-activated user):** No email sent. User will receive the standard cohort enrolment email when added to a cohort.

---

## 6. Guards & Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Delete org with employees | App: 400 "Remove all employees first". DB RESTRICT is safety net. |
| Delete node with employees in subtree | App: 400 "Node or sub-nodes contain employees". DB RESTRICT is safety net. |
| Delete root node | App-layer guard checks `is_root = true` on the node and returns 400. The `UNIQUE(org_id) WHERE is_root` partial index provides a DB-level invariant (one root per org) but not a deletion barrier — the app guard is the sole protection for this case. |
| Reparent node via PUT | `parent_id` field silently ignored (immutable in v1). |
| Bulk upload: duplicate email in file | Flagged in preview, second row skipped. |
| Bulk upload: email already in org | Skipped, counted in `skipped`, reason shown in summary. |
| Bulk upload: invalid email | Flagged in preview, not imported. |
| Bulk upload: `node_path` not found | Row flagged with "node not found", not imported. |
| Enrol from org: user already in cohort | Silently skipped, counted in `skipped`. |
| Remove employee from org | `org_employees` row deleted. `cohort_members`, `assessments`, `auth.users` untouched. |
| Same user in multiple orgs | Allowed — `UNIQUE(org_id, user_id)` permits this. |
| Move employee to different node | Admin removes from current node, re-adds to new node (v1: two-step, no bulk move). |
| Cohort unlinked from org after bulk enrol | Existing `cohort_members` rows are kept — unlinking only prevents future bulk enrol. |

---

## 7. Migration

**New file:** `migrations/007_organizations.sql`

```sql
-- Organizations
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Org nodes (unlimited depth via materialized path)
CREATE TABLE org_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES org_nodes(id) ON DELETE RESTRICT,
  is_root boolean NOT NULL DEFAULT false,
  path text NOT NULL,
  name text NOT NULL,
  node_type text DEFAULT 'department',
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX org_nodes_org_id_idx ON org_nodes(org_id);
CREATE INDEX org_nodes_path_idx ON org_nodes(path text_pattern_ops);
CREATE INDEX org_nodes_parent_id_idx ON org_nodes(parent_id);
-- Enforces exactly one root per org at DB level; app guard checks is_root before allowing delete
CREATE UNIQUE INDEX org_nodes_one_root_per_org ON org_nodes(org_id) WHERE is_root = true;

-- Org employees
CREATE TABLE org_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES org_nodes(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id text,
  title text,
  joined_at timestamptz DEFAULT now(),
  UNIQUE (org_id, user_id)
);
CREATE INDEX org_employees_org_id_idx ON org_employees(org_id);
CREATE INDEX org_employees_node_id_idx ON org_employees(node_id);
CREATE INDEX org_employees_user_id_idx ON org_employees(user_id);

-- Cohort ↔ org junction
CREATE TABLE cohort_organizations (
  cohort_id uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  linked_at timestamptz DEFAULT now(),
  PRIMARY KEY (cohort_id, org_id)
);
```

---

## 8. Scope & Phasing

### In Scope (v1)
- Full org/node CRUD with unlimited depth
- Single + bulk employee add with account creation and welcome email
- Cohort ↔ org linking (many-to-many)
- Bulk enrol from org/node with subtree support
- Individual employee selection on cohort enrol modal (via `user_ids` in enroll-from-org)
- Remove employee from org

### Out of Scope (v1 — revisit later)
- Node reparenting / move subtree
- Drag-to-reorder nodes in tree
- Org-level analytics (aggregate PAEI reports across an org)
- Employee self-service (update profile, view own org position)
- Org-scoped admin role (client-side org manager)

---

## 9. File Changes Summary

### Backend (`adizes-backend`)
| File | Change |
|------|--------|
| `migrations/007_organizations.sql` | New — all 4 tables |
| `app/routers/admin.py` | Add org, node, employee, cohort-org, enroll-from-org endpoints |
| `app/services/email_service.py` | Add `org_welcome` template |

### Frontend (`adizes-frontend`)
| File | Change |
|------|--------|
| `src/pages/AdminOrganizations.tsx` | New — org list page |
| `src/pages/AdminOrgDetail.tsx` | New — tree + detail split panel |
| `src/pages/AdminCohortDetail.tsx` | Add linked orgs section + enrol from org modal |
| `src/components/layout/Sidebar.tsx` | Add Organizations nav item |
| `src/App.tsx` | Add org routes |
| `src/stores/orgStore.ts` | New Zustand store for org/node/employee state |
| `src/api/organizations.ts` | New API client module |
