# Organisation Onboarding Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an org hierarchy module to the Adizes admin — HIL admins create orgs with unlimited-depth node trees, add employees (creating platform accounts), link cohorts to orgs, and bulk-enrol employees into cohorts by org/node scope.

**Architecture:** Four new Supabase tables (`organizations`, `org_nodes`, `org_employees`, `cohort_organizations`) with materialized-path hierarchy. A new `app/schemas/org.py` keeps Pydantic models separate from the existing `app/schemas/admin.py`. New endpoints are appended to the existing `/admin` router. Frontend adds two new admin pages and extends `AdminCohortDetail`.

**Tech Stack:** FastAPI + supabase-py (backend) · React 19 + TypeScript + Tailwind v4 + Zustand v5 + axios (frontend) · pytest (backend tests) · Supabase Admin API for auth link generation

**Spec:** `/Users/vrln/adizes-frontend/docs/superpowers/specs/2026-03-19-org-onboarding-design.md`

> **Path notes:** Frontend store lives at `src/store/orgStore.ts` (singular — matches actual directory on disk). Sidebar component is `src/components/layout/AdminSidebar.tsx` (not `Sidebar.tsx`). These differ from early spec drafts; the plan's file map is authoritative.

---

## File Map

### Backend (`/Users/vrln/adizes-backend`)
| File | Action | Purpose |
|------|--------|---------|
| `migrations/007_organizations.sql` | Create | 4 new tables + indexes |
| `app/schemas/org.py` | Create | All Pydantic request/response models for org module |
| `app/routers/admin.py` | Modify | Append ~12 new endpoint functions |
| `app/services/email_service.py` | Modify | Add `_org_welcome_html()` + register in `DEFAULT_TEMPLATES` |
| `tests/test_org_module.py` | Create | Unit tests for org service logic |

### Frontend (`/Users/vrln/adizes-frontend`)
| File | Action | Purpose |
|------|--------|---------|
| `src/types/api.ts` | Modify | Add org/node/employee TypeScript interfaces |
| `src/api/organizations.ts` | Create | All API calls for org module |
| `src/store/orgStore.ts` | Create | Zustand store for org tree + selected node state |
| `src/pages/AdminOrganizations.tsx` | Create | Org list page |
| `src/pages/AdminOrgDetail.tsx` | Create | Tree + detail split-panel page |
| `src/pages/AdminCohortDetail.tsx` | Modify | Add Linked Orgs section + Enrol from Org modal |
| `src/components/layout/AdminSidebar.tsx` | Modify | Add Organizations nav item |
| `src/App.tsx` | Modify | Add `/admin/organizations` and `/admin/organizations/:orgId` routes |

---

## Task 1: Database Migration

**Files:**
- Create: `migrations/007_organizations.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- migrations/007_organizations.sql

-- Organizations: one record per client company
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Org nodes: unlimited-depth hierarchy via materialized path
-- path format: "<org_id>/<root_node_id>[/<child_id>...]"
-- is_root=true marks the single root node per org (the company itself)
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
-- Enforces exactly one root per org; app guard checks is_root before allowing delete
CREATE UNIQUE INDEX org_nodes_one_root_per_org ON org_nodes(org_id) WHERE is_root = true;

-- Org employees: one row per user per org (UNIQUE org_id+user_id allows same user in multiple orgs)
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

-- Cohort <-> org junction (many-to-many)
CREATE TABLE cohort_organizations (
  cohort_id uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  linked_at timestamptz DEFAULT now(),
  PRIMARY KEY (cohort_id, org_id)
);
```

- [ ] **Step 2: Apply migration to local Supabase**

```bash
cd /Users/vrln/adizes-backend
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres \
  < migrations/007_organizations.sql
```

Expected: commands complete with no errors.

- [ ] **Step 3: Verify tables exist**

```bash
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres -c \
  "\dt organizations; \dt org_nodes; \dt org_employees; \dt cohort_organizations;"
```

Expected: four tables listed.

- [ ] **Step 4: Commit**

```bash
cd /Users/vrln/adizes-backend
git add migrations/007_organizations.sql
git commit -m "feat: add migration 007 for org hierarchy tables"
```

---

## Task 2: Backend Pydantic Schemas

**Files:**
- Create: `app/schemas/org.py`

- [ ] **Step 1: Create the schemas file**

```python
# app/schemas/org.py
from pydantic import BaseModel, EmailStr
from typing import Optional, List


# ── Organization ──────────────────────────────────────────────
class CreateOrgRequest(BaseModel):
    name: str
    description: Optional[str] = None


class UpdateOrgRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class OrgSummary(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    node_count: int
    employee_count: int
    created_at: str


class OrgNode(BaseModel):
    id: str
    org_id: str
    parent_id: Optional[str] = None
    is_root: bool
    path: str
    name: str
    node_type: Optional[str] = None
    display_order: int
    employee_count: int = 0
    children: List["OrgNode"] = []


OrgNode.model_rebuild()  # required for self-referential model


class OrgDetail(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at: str
    linked_cohort_count: int
    tree: List[OrgNode]   # single-element list — the root node with nested children


# ── Nodes ─────────────────────────────────────────────────────
class CreateNodeRequest(BaseModel):
    parent_id: str
    name: str
    node_type: Optional[str] = "department"
    display_order: int = 0


class UpdateNodeRequest(BaseModel):
    name: Optional[str] = None
    node_type: Optional[str] = None
    display_order: Optional[int] = None
    # parent_id intentionally omitted — immutable in v1


# ── Employees ─────────────────────────────────────────────────
class AddEmployeeRequest(BaseModel):
    name: str
    email: EmailStr
    title: Optional[str] = None
    employee_id: Optional[str] = None


class OrgEmployeeSummary(BaseModel):
    id: str           # org_employees.id UUID — use this for DELETE
    user_id: str
    name: str
    email: str
    title: Optional[str] = None
    employee_id: Optional[str] = None
    status: str       # 'active' | 'pending'
    node_id: str
    joined_at: str


class BulkEmployeeRow(BaseModel):
    row: int
    name: str
    email: str
    title: Optional[str] = None
    employee_id: Optional[str] = None
    node_path: Optional[str] = None


class BulkUploadPreview(BaseModel):
    valid: List[BulkEmployeeRow]
    errors: List[dict]   # [{row, email, reason}]


class BulkUploadResult(BaseModel):
    created: int
    skipped: int
    errors: List[dict]


# ── Cohort ↔ Org linking ──────────────────────────────────────
class LinkOrgRequest(BaseModel):
    org_id: str


class LinkedOrgSummary(BaseModel):
    org_id: str
    name: str
    employee_count: int
    linked_at: str


class LinkedCohortSummary(BaseModel):
    cohort_id: str
    name: str
    linked_at: str


# ── Enrol from org ────────────────────────────────────────────
class EnrollFromOrgRequest(BaseModel):
    org_id: str
    node_id: Optional[str] = None
    include_descendants: bool = True
    user_ids: Optional[List[str]] = None   # if set, overrides node scope


class EnrollFromOrgResult(BaseModel):
    enrolled: int
    skipped: int
```

- [ ] **Step 2: Verify it imports cleanly**

```bash
cd /Users/vrln/adizes-backend
docker exec adizes-backend python -c "from app.schemas.org import OrgSummary; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add app/schemas/org.py
git commit -m "feat: add Pydantic schemas for org module"
```

---

## Task 3: Backend — Org & Node CRUD Endpoints

**Files:**
- Modify: `app/routers/admin.py`
- Modify: `app/schemas/org.py` (import already in place)
- Create: `tests/test_org_module.py`

- [ ] **Step 1: Write failing tests for org helpers**

```python
# tests/test_org_module.py
"""Tests for org module service helpers (pure functions, no DB)."""
import pytest


def _make_flat_nodes(specs):
    """Build flat org_nodes rows from list of (id, parent_id, path, name, is_root)."""
    return [
        {"id": id_, "parent_id": pid, "path": path,
         "name": name, "is_root": is_root,
         "org_id": "org1", "node_type": "department",
         "display_order": 0, "created_at": "2026-01-01T00:00:00"}
        for id_, pid, path, name, is_root in specs
    ]


class TestBuildOrgTree:
    def test_single_root(self):
        from app.routers.admin import _build_org_tree
        nodes = _make_flat_nodes([
            ("root1", None, "org1/root1", "Acme Corp", True),
        ])
        tree = _build_org_tree(nodes, employee_counts={})
        assert len(tree) == 1
        assert tree[0]["name"] == "Acme Corp"
        assert tree[0]["children"] == []

    def test_two_levels(self):
        from app.routers.admin import _build_org_tree
        nodes = _make_flat_nodes([
            ("root1", None,   "org1/root1",        "Acme Corp",    True),
            ("div1",  "root1","org1/root1/div1",   "North",        False),
            ("div2",  "root1","org1/root1/div2",   "South",        False),
        ])
        tree = _build_org_tree(nodes, employee_counts={"div1": 5, "div2": 3})
        assert len(tree[0]["children"]) == 2
        children_names = {c["name"] for c in tree[0]["children"]}
        assert children_names == {"North", "South"}
        north = next(c for c in tree[0]["children"] if c["name"] == "North")
        assert north["employee_count"] == 5

    def test_three_levels(self):
        from app.routers.admin import _build_org_tree
        nodes = _make_flat_nodes([
            ("root1", None,   "org1/root1",             "Acme Corp", True),
            ("div1",  "root1","org1/root1/div1",         "North",    False),
            ("dep1",  "div1", "org1/root1/div1/dep1",    "Sales",    False),
        ])
        tree = _build_org_tree(nodes, employee_counts={})
        north = tree[0]["children"][0]
        assert north["children"][0]["name"] == "Sales"


class TestResolveNodePath:
    def test_finds_by_name_chain(self):
        from app.routers.admin import _resolve_node_path
        nodes = _make_flat_nodes([
            ("root1", None,   "org1/root1",           "Acme Corp", True),
            ("div1",  "root1","org1/root1/div1",       "North",    False),
            ("dep1",  "div1", "org1/root1/div1/dep1",  "Sales",    False),
        ])
        result = _resolve_node_path("North/Sales", nodes)
        assert result == "dep1"

    def test_case_insensitive(self):
        from app.routers.admin import _resolve_node_path
        nodes = _make_flat_nodes([
            ("root1", None,   "org1/root1",           "Acme",  True),
            ("div1",  "root1","org1/root1/div1",       "north", False),
        ])
        assert _resolve_node_path("NORTH", nodes) == "div1"

    def test_not_found_returns_none(self):
        from app.routers.admin import _resolve_node_path
        nodes = _make_flat_nodes([
            ("root1", None, "org1/root1", "Acme", True),
        ])
        assert _resolve_node_path("Nonexistent", nodes) is None

    def test_empty_path_returns_none(self):
        from app.routers.admin import _resolve_node_path
        nodes = _make_flat_nodes([
            ("root1", None, "org1/root1", "Acme", True),
        ])
        assert _resolve_node_path("", nodes) is None
```

- [ ] **Step 2: Run tests — verify they fail (function not yet defined)**

```bash
cd /Users/vrln/adizes-backend
docker exec adizes-backend python -m pytest tests/test_org_module.py -v 2>&1 | tail -20
```

Expected: `ImportError` or `AttributeError` — `_build_org_tree` not found.

- [ ] **Step 3: Add helper functions + org/node endpoints to `app/routers/admin.py`**

At the top of `admin.py`, add to the imports:
```python
from app.schemas.org import (
    CreateOrgRequest, UpdateOrgRequest, OrgSummary, OrgDetail, OrgNode,
    CreateNodeRequest, UpdateNodeRequest,
    AddEmployeeRequest, OrgEmployeeSummary, BulkUploadResult,
    LinkOrgRequest, LinkedOrgSummary, LinkedCohortSummary,
    EnrollFromOrgRequest, EnrollFromOrgResult,
)
import csv, io as _io
```

Then append the following to the bottom of `admin.py`:

```python
# ─────────────────────────────────────────────────────────────
# Org module helpers
# ─────────────────────────────────────────────────────────────

def _build_org_tree(flat_nodes: list[dict], employee_counts: dict) -> list[dict]:
    """Convert flat node list into nested tree. Returns list with single root element."""
    node_map = {}
    for n in flat_nodes:
        node_map[n["id"]] = {**n, "employee_count": employee_counts.get(n["id"], 0), "children": []}

    roots = []
    for n in flat_nodes:
        entry = node_map[n["id"]]
        if n["parent_id"] is None:
            roots.append(entry)
        else:
            parent = node_map.get(n["parent_id"])
            if parent:
                parent["children"].append(entry)

    # Sort children by display_order
    def _sort(node):
        node["children"].sort(key=lambda x: x["display_order"])
        for child in node["children"]:
            _sort(child)
    for r in roots:
        _sort(r)
    return roots


def _resolve_node_path(node_path: str, flat_nodes: list[dict]) -> str | None:
    """
    Resolve a "/"-separated name chain to a node id.
    e.g. "North India Division/Sales" -> "dep-uuid"
    Matching is case-insensitive and trimmed. Root node is excluded from the path.
    Returns None if not found or path is empty.
    """
    if not node_path or not node_path.strip():
        return None
    parts = [p.strip().lower() for p in node_path.strip("/").split("/")]
    # Start from children of root (exclude root itself from path resolution)
    # Build parent→children map
    children_map: dict[str | None, list[dict]] = {}
    for n in flat_nodes:
        children_map.setdefault(n["parent_id"], []).append(n)

    # Root's children are the first level
    root = next((n for n in flat_nodes if n["is_root"]), None)
    if not root:
        return None

    current_candidates = children_map.get(root["id"], [])
    current_id = None
    for part in parts:
        match = next(
            (n for n in sorted(current_candidates, key=lambda x: x["display_order"])
             if n["name"].strip().lower() == part),
            None,
        )
        if not match:
            return None
        current_id = match["id"]
        current_candidates = children_map.get(current_id, [])
    return current_id


# ─────────────────────────────────────────────────────────────
# Organization CRUD
# ─────────────────────────────────────────────────────────────

@router.get("/organizations", response_model=list[OrgSummary])
def list_organizations(admin: dict = Depends(require_admin)):
    orgs = supabase_admin.table("organizations").select("*").order("created_at", desc=True).execute()
    result = []
    for org in (orgs.data or []):
        node_count = len(
            supabase_admin.table("org_nodes").select("id").eq("org_id", org["id"]).execute().data or []
        )
        emp_count = len(
            supabase_admin.table("org_employees").select("id").eq("org_id", org["id"]).execute().data or []
        )
        result.append(OrgSummary(
            id=org["id"], name=org["name"], description=org.get("description"),
            node_count=node_count, employee_count=emp_count, created_at=org["created_at"],
        ))
    return result


@router.post("/organizations", response_model=OrgDetail, status_code=201)
def create_organization(body: CreateOrgRequest, admin: dict = Depends(require_admin)):
    org = supabase_admin.table("organizations").insert(
        {"name": body.name, "description": body.description}
    ).execute().data[0]

    org_id = org["id"]
    root_id = str(uuid.uuid4())
    root_path = f"{org_id}/{root_id}"
    supabase_admin.table("org_nodes").insert({
        "id": root_id, "org_id": org_id, "parent_id": None,
        "is_root": True, "path": root_path,
        "name": body.name, "node_type": "company", "display_order": 0,
    }).execute()

    return _get_org_detail(org_id)


@router.get("/organizations/{org_id}", response_model=OrgDetail)
def get_organization(org_id: str, admin: dict = Depends(require_admin)):
    org = supabase_admin.table("organizations").select("*").eq("id", org_id).maybe_single().execute()
    if not org.data:
        raise HTTPException(status_code=404, detail="Organisation not found")
    return _get_org_detail(org_id)


@router.put("/organizations/{org_id}", response_model=OrgDetail)
def update_organization(org_id: str, body: UpdateOrgRequest, admin: dict = Depends(require_admin)):
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nothing to update")
    supabase_admin.table("organizations").update(update_data).eq("id", org_id).execute()
    return _get_org_detail(org_id)


@router.delete("/organizations/{org_id}", status_code=204)
def delete_organization(org_id: str, admin: dict = Depends(require_admin)):
    emp_check = supabase_admin.table("org_employees").select("id").eq("org_id", org_id).limit(1).execute()
    if emp_check.data:
        raise HTTPException(status_code=400, detail="Remove all employees before deleting this organisation")
    supabase_admin.table("organizations").delete().eq("id", org_id).execute()


# NOTE: _get_org_detail is called by create_organization (above) and the GET/PUT endpoints
# that follow. Python resolves module-level names at call time, so forward calls work as
# long as all these functions are appended to the same file in a single commit.
def _get_org_detail(org_id: str) -> OrgDetail:
    """Shared helper: fetch org + full tree + linked cohort count."""
    org = supabase_admin.table("organizations").select("*").eq("id", org_id).single().execute().data
    flat_nodes = (
        supabase_admin.table("org_nodes").select("*")
        .eq("org_id", org_id).order("display_order").execute().data or []
    )
    emp_rows = (
        supabase_admin.table("org_employees").select("id, node_id")
        .eq("org_id", org_id).execute().data or []
    )
    emp_counts: dict[str, int] = {}
    for e in emp_rows:
        emp_counts[e["node_id"]] = emp_counts.get(e["node_id"], 0) + 1

    cohort_count = len(
        supabase_admin.table("cohort_organizations").select("cohort_id")
        .eq("org_id", org_id).execute().data or []
    )
    tree = _build_org_tree(flat_nodes, emp_counts)
    return OrgDetail(
        id=org["id"], name=org["name"], description=org.get("description"),
        created_at=org["created_at"], linked_cohort_count=cohort_count, tree=tree,
    )


# ─────────────────────────────────────────────────────────────
# Node Management
# ─────────────────────────────────────────────────────────────

@router.post("/organizations/{org_id}/nodes", status_code=201)
def create_node(org_id: str, body: CreateNodeRequest, admin: dict = Depends(require_admin)):
    parent = (
        supabase_admin.table("org_nodes").select("*")
        .eq("id", body.parent_id).eq("org_id", org_id).maybe_single().execute()
    )
    if not parent.data:
        raise HTTPException(status_code=404, detail="Parent node not found in this organisation")
    new_id = str(uuid.uuid4())
    new_path = f"{parent.data['path']}/{new_id}"
    supabase_admin.table("org_nodes").insert({
        "id": new_id, "org_id": org_id, "parent_id": body.parent_id,
        "is_root": False, "path": new_path, "name": body.name,
        "node_type": body.node_type, "display_order": body.display_order,
    }).execute()
    return {"id": new_id, "path": new_path}


@router.put("/organizations/{org_id}/nodes/{node_id}")
def update_node(org_id: str, node_id: str, body: UpdateNodeRequest, admin: dict = Depends(require_admin)):
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nothing to update")
    supabase_admin.table("org_nodes").update(update_data).eq("id", node_id).eq("org_id", org_id).execute()
    return {"updated": True}


@router.delete("/organizations/{org_id}/nodes/{node_id}", status_code=204)
def delete_node(org_id: str, node_id: str, admin: dict = Depends(require_admin)):
    node = (
        supabase_admin.table("org_nodes").select("*")
        .eq("id", node_id).eq("org_id", org_id).maybe_single().execute()
    )
    if not node.data:
        raise HTTPException(status_code=404, detail="Node not found")
    if node.data["is_root"]:
        raise HTTPException(status_code=400, detail="Cannot delete the root node of an organisation")

    # Check this node and all descendants for employees
    node_path = node.data["path"]
    subtree_ids = [
        n["id"] for n in (
            supabase_admin.table("org_nodes").select("id")
            .eq("org_id", org_id)
            .or_(f"id.eq.{node_id},path.like.{node_path}/%")
            .execute().data or []
        )
    ]
    emp_check = (
        supabase_admin.table("org_employees").select("id")
        .in_("node_id", subtree_ids).limit(1).execute()
    )
    if emp_check.data:
        raise HTTPException(status_code=400, detail="Node or sub-nodes contain employees — remove them first")
    supabase_admin.table("org_nodes").delete().eq("id", node_id).execute()
```

- [ ] **Step 4: Run the helper tests — verify they pass**

```bash
cd /Users/vrln/adizes-backend
docker compose up --build -d && sleep 3
docker exec adizes-backend python -m pytest tests/test_org_module.py -v 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 5: Smoke-test org CRUD via API**

```bash
# Get a token first
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@adizes.com","password":"Admin@1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Create org
curl -s -X POST http://localhost:8000/admin/organizations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Corp","description":"Test org"}' | python3 -m json.tool
```

Expected: JSON with `id`, `tree` containing one root node.

- [ ] **Step 6: Commit**

```bash
git add app/schemas/org.py app/routers/admin.py tests/test_org_module.py
git commit -m "feat: add org/node CRUD endpoints and helper functions"
```

---

## Task 4: Backend — Employee Endpoints + org_welcome Email

**Files:**
- Modify: `app/routers/admin.py` (append employee endpoints)
- Modify: `app/services/email_service.py` (add `org_welcome` template)

- [ ] **Step 1: Add `org_welcome` email template to `email_service.py`**

In `email_service.py`, add this function alongside the other `_*_html` functions (before `DEFAULT_TEMPLATES`):

```python
def _org_welcome_html() -> str:
    cta = _cta("{{activation_url}}", "Activate Your Account")
    body = f"""
  <!-- Body -->
  <tr>
    <td style="padding:40px 48px 36px;" bgcolor="#ffffff">
      <p style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;font-weight:400;line-height:1.35;">Welcome, {{{{user_name}}}}.</p>
      <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;"><strong style="color:#1a1a1a;">{{{{org_name}}}}</strong> has registered you on the <strong style="color:#1a1a1a;">Adizes PAEI Assessment Platform</strong>.</p>
      <p style="margin:0 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">Click the button below to activate your account and set your password. Your administrator will invite you to an assessment cohort separately.</p>
      {cta}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 24px;"><tr><td style="border-top:1px solid #e8e8e8;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#666666;line-height:1.75;">If you did not expect this email, you can safely ignore it.</p>
    </td>
  </tr>"""
    return _build_template("user_email", body)
```

Then add to `DEFAULT_TEMPLATES` dict:
```python
"org_welcome": {
    "id": "org_welcome",
    "subject": "You've been added to {{org_name}} on the Adizes PAEI Platform",
    "html_body": _org_welcome_html(),
},
```

- [ ] **Step 2: Append employee endpoints to `app/routers/admin.py`**

```python
# ─────────────────────────────────────────────────────────────
# Employee Management
# ─────────────────────────────────────────────────────────────

@router.get("/organizations/{org_id}/nodes/{node_id}/employees",
            response_model=list[OrgEmployeeSummary])
def list_node_employees(
    org_id: str, node_id: str,
    include_descendants: bool = False,
    admin: dict = Depends(require_admin),
):
    if include_descendants:
        node = (
            supabase_admin.table("org_nodes").select("path")
            .eq("id", node_id).eq("org_id", org_id).single().execute()
        )
        node_path = node.data["path"]
        subtree_ids = [
            n["id"] for n in (
                supabase_admin.table("org_nodes").select("id")
                .eq("org_id", org_id)
                .or_(f"id.eq.{node_id},path.like.{node_path}/%")
                .execute().data or []
            )
        ]
        emp_rows = (
            supabase_admin.table("org_employees").select("*")
            .in_("node_id", subtree_ids).execute().data or []
        )
    else:
        emp_rows = (
            supabase_admin.table("org_employees").select("*")
            .eq("node_id", node_id).execute().data or []
        )

    auth_users = _get_auth_users_map()
    result = []
    for e in emp_rows:
        u = auth_users.get(e["user_id"])
        name = (u.user_metadata or {}).get("name", "") if u else ""
        email = u.email if u else ""
        status = "active" if (u and u.email_confirmed_at) else "pending"
        result.append(OrgEmployeeSummary(
            id=e["id"], user_id=e["user_id"], name=name, email=email,
            title=e.get("title"), employee_id=e.get("employee_id"),
            status=status, node_id=e["node_id"], joined_at=str(e["joined_at"]),
        ))
    return result


@router.post("/organizations/{org_id}/nodes/{node_id}/employees", status_code=201)
def add_employee(
    org_id: str, node_id: str, body: AddEmployeeRequest,
    admin: dict = Depends(require_admin),
):
    # Verify node belongs to org
    node = (
        supabase_admin.table("org_nodes").select("id")
        .eq("id", node_id).eq("org_id", org_id).maybe_single().execute()
    )
    if not node.data:
        raise HTTPException(status_code=404, detail="Node not found in this organisation")

    org = supabase_admin.table("organizations").select("name").eq("id", org_id).single().execute().data
    org_name = org["name"]

    return _add_employee_to_node(
        org_id=org_id, org_name=org_name, node_id=node_id,
        email=str(body.email), name=body.name, title=body.title,
        employee_id=body.employee_id,
    )


def _add_employee_to_node(
    org_id: str, org_name: str, node_id: str,
    email: str, name: str,
    title: str | None = None, employee_id: str | None = None,
) -> dict:
    """
    3-case logic:
      1. New user    → generate_link(invite) → insert org_employees → send org_welcome
      2. Unactivated → generate_link(recovery) → insert org_employees → send org_welcome
      3. Active      → insert org_employees only, no email
    Returns {"user_id": ..., "created": bool, "emailed": bool}
    """
    # Check if already in this org
    try:
        existing_users = supabase_admin.auth.admin.list_users()
        target = next((u for u in existing_users if u.email == email), None)
    except Exception:
        target = None

    activation_url = settings.frontend_url
    is_new = target is None
    is_unactivated = target is not None and target.email_confirmed_at is None

    if is_new:
        try:
            lr = supabase_admin.auth.admin.generate_link({
                "type": "invite",
                "email": email,
                "data": {"name": name},
            })
            activation_url = lr.properties.action_link
            target = supabase_admin.auth.admin.get_user_by_id(lr.user.id).user
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not create user: {e}")

    elif is_unactivated:
        try:
            lr = supabase_admin.auth.admin.generate_link({
                "type": "recovery",
                "email": email,
            })
            activation_url = lr.properties.action_link
        except Exception:
            activation_url = settings.frontend_url

    user_id = str(target.id)

    # Check not already in this org
    dup = (
        supabase_admin.table("org_employees").select("id")
        .eq("org_id", org_id).eq("user_id", user_id).maybe_single().execute()
    )
    if dup.data:
        raise HTTPException(status_code=409, detail="Employee already in this organisation")

    supabase_admin.table("org_employees").insert({
        "org_id": org_id, "node_id": node_id, "user_id": user_id,
        "employee_id": employee_id, "title": title,
    }).execute()

    emailed = False
    if (is_new or is_unactivated) and smtp_configured():
        try:
            send_template_email("org_welcome", email, {
                "user_name": name,
                "org_name": org_name,
                "platform_name": "Adizes India",
                "platform_url": settings.frontend_url,
                "activation_url": activation_url,
            })
            emailed = True
        except Exception as exc:
            logger.error(f"[org] Welcome email failed for {email}: {exc}")

    return {"user_id": user_id, "created": is_new, "emailed": emailed}


@router.post("/organizations/{org_id}/nodes/{node_id}/employees/bulk")
async def bulk_upload_employees(
    org_id: str, node_id: str,
    file: UploadFile,
    admin: dict = Depends(require_admin),
):
    node = (
        supabase_admin.table("org_nodes").select("id")
        .eq("id", node_id).eq("org_id", org_id).maybe_single().execute()
    )
    if not node.data:
        raise HTTPException(status_code=404, detail="Node not found")

    org = supabase_admin.table("organizations").select("name").eq("id", org_id).single().execute().data
    org_name = org["name"]

    flat_nodes = (
        supabase_admin.table("org_nodes").select("*").eq("org_id", org_id).execute().data or []
    )

    contents = await file.read()
    reader = csv.DictReader(_io.StringIO(contents.decode("utf-8-sig")))

    created = skipped = 0
    errors = []

    seen_emails = set()
    for row_idx, row in enumerate(reader, start=2):  # row 1 = header
        email = (row.get("email") or "").strip()
        name = (row.get("name") or "").strip()
        title = (row.get("title") or "").strip() or None
        ext_id = (row.get("employee_id") or "").strip() or None
        node_path_val = (row.get("node_path") or "").strip() or None

        # Validate email
        import re as _re
        if not _re.match(r"[^@]+@[^@]+\.[^@]+", email):
            errors.append({"row": row_idx, "email": email, "reason": "invalid email"})
            continue

        # Duplicate in file
        if email.lower() in seen_emails:
            errors.append({"row": row_idx, "email": email, "reason": "duplicate in file"})
            continue
        seen_emails.add(email.lower())

        # Resolve target node
        target_node_id = node_id
        if node_path_val:
            resolved = _resolve_node_path(node_path_val, flat_nodes)
            if resolved is None:
                errors.append({"row": row_idx, "email": email, "reason": f"node_path not found: {node_path_val}"})
                continue
            target_node_id = resolved

        try:
            _add_employee_to_node(
                org_id=org_id, org_name=org_name, node_id=target_node_id,
                email=email, name=name, title=title, employee_id=ext_id,
            )
            created += 1
        except HTTPException as he:
            if he.status_code == 409:
                skipped += 1
            else:
                errors.append({"row": row_idx, "email": email, "reason": he.detail})
        except Exception as e:
            errors.append({"row": row_idx, "email": email, "reason": str(e)})

    return BulkUploadResult(created=created, skipped=skipped, errors=errors)


@router.delete("/organizations/{org_id}/employees/{org_employee_id}", status_code=204)
def remove_employee(org_id: str, org_employee_id: str, admin: dict = Depends(require_admin)):
    """Remove employee from org. Does NOT delete auth user or cohort memberships."""
    supabase_admin.table("org_employees").delete()\
        .eq("id", org_employee_id).eq("org_id", org_id).execute()
```

Note: add `UploadFile` to the FastAPI imports at the top of `admin.py`:
```python
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile
```

- [ ] **Step 3: Rebuild and verify**

```bash
cd /Users/vrln/adizes-backend
docker compose up --build -d && sleep 5
curl -s http://localhost:8000/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 3b: Smoke-test employee addition**

```bash
# Get an admin JWT first
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@adizes.com","password":"Admin@1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Create a test org (get the org_id from response)
ORG=$(curl -s -X POST http://localhost:8000/admin/organizations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Corp"}')
ORG_ID=$(echo $ORG | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
ROOT_ID=$(echo $ORG | python3 -c "import sys,json; print(json.load(sys.stdin)['tree'][0]['id'])")

# Add an employee
curl -s -X POST "http://localhost:8000/admin/organizations/$ORG_ID/nodes/$ROOT_ID/employees" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Employee","email":"testemployee@example.com","title":"Engineer"}'
```

Expected: response includes `"created": true, "emailed": true` (or `false` if SMTP is not configured locally — either is acceptable; what matters is no 500 error).

- [ ] **Step 4: Commit**

```bash
git add app/routers/admin.py app/services/email_service.py
git commit -m "feat: add employee management endpoints and org_welcome email"
```

---

## Task 5: Backend — Cohort-Org Linking + Enrol from Org

**Files:**
- Modify: `app/routers/admin.py` (append linking + enrol endpoints)

- [ ] **Step 1: Append cohort-org linking and enrol-from-org endpoints**

```python
# ─────────────────────────────────────────────────────────────
# Cohort ↔ Organisation linking
# ─────────────────────────────────────────────────────────────

@router.get("/cohorts/{cohort_id}/organizations", response_model=list[LinkedOrgSummary])
def list_cohort_orgs(cohort_id: str, admin: dict = Depends(require_admin)):
    rows = (
        supabase_admin.table("cohort_organizations").select("org_id, linked_at")
        .eq("cohort_id", cohort_id).execute().data or []
    )
    result = []
    for r in rows:
        org = supabase_admin.table("organizations").select("name").eq("id", r["org_id"]).single().execute().data
        emp_count = len(
            supabase_admin.table("org_employees").select("id").eq("org_id", r["org_id"]).execute().data or []
        )
        result.append(LinkedOrgSummary(
            org_id=r["org_id"], name=org["name"],
            employee_count=emp_count, linked_at=str(r["linked_at"]),
        ))
    return result


@router.post("/cohorts/{cohort_id}/organizations", status_code=201)
def link_org_to_cohort(cohort_id: str, body: LinkOrgRequest, admin: dict = Depends(require_admin)):
    try:
        supabase_admin.table("cohort_organizations").insert(
            {"cohort_id": cohort_id, "org_id": body.org_id}
        ).execute()
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Organisation already linked to this cohort")
        raise HTTPException(status_code=400, detail=str(e))
    return {"linked": True}


@router.delete("/cohorts/{cohort_id}/organizations/{org_id}", status_code=204)
def unlink_org_from_cohort(cohort_id: str, org_id: str, admin: dict = Depends(require_admin)):
    supabase_admin.table("cohort_organizations").delete()\
        .eq("cohort_id", cohort_id).eq("org_id", org_id).execute()


@router.get("/organizations/{org_id}/cohorts", response_model=list[LinkedCohortSummary])
def list_org_cohorts(org_id: str, admin: dict = Depends(require_admin)):
    rows = (
        supabase_admin.table("cohort_organizations").select("cohort_id, linked_at")
        .eq("org_id", org_id).execute().data or []
    )
    result = []
    for r in rows:
        cohort = supabase_admin.table("cohorts").select("name").eq("id", r["cohort_id"]).single().execute().data
        result.append(LinkedCohortSummary(
            cohort_id=r["cohort_id"], name=cohort["name"], linked_at=str(r["linked_at"]),
        ))
    return result


# ─────────────────────────────────────────────────────────────
# Enrol from Org
# ─────────────────────────────────────────────────────────────

@router.post("/cohorts/{cohort_id}/enroll-from-org", response_model=EnrollFromOrgResult)
def enroll_from_org(cohort_id: str, body: EnrollFromOrgRequest, admin: dict = Depends(require_admin)):
    # Resolve which user_ids to enrol
    if body.user_ids:
        target_user_ids = body.user_ids
    else:
        # Resolve by scope
        if body.node_id and body.include_descendants:
            node = (
                supabase_admin.table("org_nodes").select("path")
                .eq("id", body.node_id).single().execute()
            )
            node_path = node.data["path"]
            subtree_ids = [
                n["id"] for n in (
                    supabase_admin.table("org_nodes").select("id")
                    .eq("org_id", body.org_id)
                    .or_(f"id.eq.{body.node_id},path.like.{node_path}/%")
                    .execute().data or []
                )
            ]
            emp_rows = (
                supabase_admin.table("org_employees").select("user_id")
                .in_("node_id", subtree_ids).execute().data or []
            )
        elif body.node_id and not body.include_descendants:
            emp_rows = (
                supabase_admin.table("org_employees").select("user_id")
                .eq("node_id", body.node_id).execute().data or []
            )
        else:
            # Entire org
            emp_rows = (
                supabase_admin.table("org_employees").select("user_id")
                .eq("org_id", body.org_id).execute().data or []
            )
        target_user_ids = [e["user_id"] for e in emp_rows]

    if not target_user_ids:
        return EnrollFromOrgResult(enrolled=0, skipped=0)

    # Check existing cohort members
    existing = {
        m["user_id"] for m in (
            supabase_admin.table("cohort_members").select("user_id")
            .eq("cohort_id", cohort_id).in_("user_id", target_user_ids).execute().data or []
        )
    }

    to_enrol = [uid for uid in target_user_ids if uid not in existing]
    skipped = len(target_user_ids) - len(to_enrol)
    enrolled = 0

    # Reuse existing enroll_user logic per user
    for user_id in to_enrol:
        try:
            u = supabase_admin.auth.admin.get_user_by_id(user_id).user
            if not u:
                continue
            # Get name from org_employees
            emp = (
                supabase_admin.table("org_employees").select("*")
                .eq("user_id", user_id).eq("org_id", body.org_id).maybe_single().execute()
            )
            # Reuse the existing _enroll_single_user helper
            _enroll_single_user(cohort_id=cohort_id, user_id=user_id,
                                email=u.email, name=None,
                                email_confirmed_at=u.email_confirmed_at)
            enrolled += 1
        except Exception as e:
            logger.error(f"[enroll-from-org] Failed for user {user_id}: {e}")

    return EnrollFromOrgResult(enrolled=enrolled, skipped=skipped)
```

Note: This requires extracting the per-user enrollment email logic into a `_enroll_single_user` helper. In `admin.py`, find the `enroll_user` endpoint — the per-user block to extract looks like this (after the duplicate-check guard and `cohort_members.insert` call):
```python
# existing enroll_user inner logic (to extract):
    cohort = supabase_admin.table("cohorts").select("name").eq("id", cohort_id).single().execute().data
    cohort_name = cohort["name"]
    display_name = user_name or email
    if smtp_configured():
        if email_confirmed_at is None:
            lr = supabase_admin.auth.admin.generate_link({"type": "recovery", "email": email})
            invite_link_val = lr.properties.action_link if lr else settings.frontend_url
            send_template_email("user_enrolled", email, {
                "user_name": display_name, "cohort_name": cohort_name,
                "platform_name": "Adizes India", "platform_url": settings.frontend_url,
                "invite_link": invite_link_val,  # ← renamed to invite_link in helper below
            })
        else:
            send_template_email("cohort_enrollment_existing", email, { ... })
```
Extract this into `_enroll_single_user` (note: rename `invite_link_val` → `invite_link` inside the helper to match the template key):

```python
def _enroll_single_user(cohort_id: str, user_id: str, email: str,
                        name: str | None, email_confirmed_at) -> None:
    """Insert cohort_members row and send appropriate enrolment email."""
    supabase_admin.table("cohort_members").insert(
        {"cohort_id": cohort_id, "user_id": user_id}
    ).execute()

    cohort = supabase_admin.table("cohorts").select("name").eq("id", cohort_id).single().execute().data
    cohort_name = cohort["name"]
    display_name = name or email

    if not smtp_configured():
        return

    if email_confirmed_at is None:
        try:
            lr = supabase_admin.auth.admin.generate_link({"type": "recovery", "email": email})
            invite_link = lr.properties.action_link
        except Exception:
            invite_link = settings.frontend_url
        send_template_email("user_enrolled", email, {
            "user_name": display_name, "cohort_name": cohort_name,
            "platform_name": "Adizes India", "platform_url": settings.frontend_url,
            "invite_link": invite_link,
        })
    else:
        send_template_email("cohort_enrollment_existing", email, {
            "user_name": display_name, "cohort_name": cohort_name,
            "platform_name": "Adizes India", "platform_url": settings.frontend_url,
        })
```

Then update `enroll_user` to call `_enroll_single_user` instead of duplicating the logic.

- [ ] **Step 2: Rebuild and smoke-test**

```bash
cd /Users/vrln/adizes-backend
docker compose up --build -d && sleep 3
curl -s http://localhost:8000/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 3: Commit**

```bash
git add app/routers/admin.py
git commit -m "feat: add cohort-org linking and enroll-from-org endpoints"
```

---

## Task 6: Frontend — TypeScript Types + API Client + Store

**Files:**
- Modify: `src/types/api.ts`
- Create: `src/api/organizations.ts`
- Create: `src/store/orgStore.ts`

- [ ] **Step 1: Add org TypeScript interfaces to `src/types/api.ts`**

Append to the existing `api.ts`:

```typescript
// ── Organisation types ────────────────────────────────────────

export interface OrgNode {
  id: string;
  org_id: string;
  parent_id: string | null;
  is_root: boolean;
  path: string;
  name: string;
  node_type: string | null;
  display_order: number;
  employee_count: number;
  children: OrgNode[];
}

export interface OrgSummary {
  id: string;
  name: string;
  description: string | null;
  node_count: number;
  employee_count: number;
  created_at: string;
}

export interface OrgDetail {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  linked_cohort_count: number;
  tree: OrgNode[];  // single root element
}

export interface OrgEmployeeSummary {
  id: string;         // org_employees.id — use for DELETE
  user_id: string;
  name: string;
  email: string;
  title: string | null;
  employee_id: string | null;
  status: 'active' | 'pending';
  node_id: string;
  joined_at: string;
}

export interface LinkedOrgSummary {
  org_id: string;
  name: string;
  employee_count: number;
  linked_at: string;
}

export interface BulkUploadResult {
  created: number;
  skipped: number;
  errors: { row: number; email: string; reason: string }[];
}

export interface EnrollFromOrgResult {
  enrolled: number;
  skipped: number;
}
```

- [ ] **Step 2: Create `src/api/organizations.ts`**

```typescript
import { apiClient } from './client';
import type {
  OrgSummary, OrgDetail, OrgNode, OrgEmployeeSummary,
  LinkedOrgSummary, BulkUploadResult, EnrollFromOrgResult,
} from '@/types/api';

// ── Organisations ─────────────────────────────────────────────
export async function listOrganizations(): Promise<OrgSummary[]> {
  const { data } = await apiClient.get<OrgSummary[]>('/admin/organizations');
  return data;
}

export async function createOrganization(name: string, description?: string): Promise<OrgDetail> {
  const { data } = await apiClient.post<OrgDetail>('/admin/organizations', { name, description });
  return data;
}

export async function getOrganization(orgId: string): Promise<OrgDetail> {
  const { data } = await apiClient.get<OrgDetail>(`/admin/organizations/${orgId}`);
  return data;
}

export async function updateOrganization(orgId: string, fields: { name?: string; description?: string }): Promise<OrgDetail> {
  const { data } = await apiClient.put<OrgDetail>(`/admin/organizations/${orgId}`, fields);
  return data;
}

export async function deleteOrganization(orgId: string): Promise<void> {
  await apiClient.delete(`/admin/organizations/${orgId}`);
}

// ── Nodes ─────────────────────────────────────────────────────
export async function createNode(
  orgId: string,
  parentId: string,
  name: string,
  nodeType?: string,
  displayOrder?: number,
): Promise<{ id: string; path: string }> {
  const { data } = await apiClient.post(`/admin/organizations/${orgId}/nodes`, {
    parent_id: parentId, name, node_type: nodeType ?? 'department',
    display_order: displayOrder ?? 0,
  });
  return data;
}

export async function updateNode(
  orgId: string,
  nodeId: string,
  fields: { name?: string; node_type?: string; display_order?: number },
): Promise<void> {
  await apiClient.put(`/admin/organizations/${orgId}/nodes/${nodeId}`, fields);
}

export async function deleteNode(orgId: string, nodeId: string): Promise<void> {
  await apiClient.delete(`/admin/organizations/${orgId}/nodes/${nodeId}`);
}

// ── Employees ─────────────────────────────────────────────────
export async function listNodeEmployees(
  orgId: string,
  nodeId: string,
  includeDescendants = false,
): Promise<OrgEmployeeSummary[]> {
  const { data } = await apiClient.get<OrgEmployeeSummary[]>(
    `/admin/organizations/${orgId}/nodes/${nodeId}/employees`,
    { params: { include_descendants: includeDescendants } },
  );
  return data;
}

export async function addEmployee(
  orgId: string,
  nodeId: string,
  payload: { name: string; email: string; title?: string; employee_id?: string },
): Promise<{ user_id: string; created: boolean; emailed: boolean }> {
  const { data } = await apiClient.post(
    `/admin/organizations/${orgId}/nodes/${nodeId}/employees`, payload,
  );
  return data;
}

export async function bulkUploadEmployees(
  orgId: string,
  nodeId: string,
  file: File,
): Promise<BulkUploadResult> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<BulkUploadResult>(
    `/admin/organizations/${orgId}/nodes/${nodeId}/employees/bulk`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export async function removeEmployee(orgId: string, orgEmployeeId: string): Promise<void> {
  await apiClient.delete(`/admin/organizations/${orgId}/employees/${orgEmployeeId}`);
}

// ── Cohort ↔ Org ──────────────────────────────────────────────
export async function listCohortOrgs(cohortId: string): Promise<LinkedOrgSummary[]> {
  const { data } = await apiClient.get<LinkedOrgSummary[]>(`/admin/cohorts/${cohortId}/organizations`);
  return data;
}

export async function linkOrgToCohort(cohortId: string, orgId: string): Promise<void> {
  await apiClient.post(`/admin/cohorts/${cohortId}/organizations`, { org_id: orgId });
}

export async function unlinkOrgFromCohort(cohortId: string, orgId: string): Promise<void> {
  await apiClient.delete(`/admin/cohorts/${cohortId}/organizations/${orgId}`);
}

export async function enrollFromOrg(
  cohortId: string,
  payload: {
    org_id: string;
    node_id?: string | null;
    include_descendants?: boolean;
    user_ids?: string[];
  },
): Promise<EnrollFromOrgResult> {
  const { data } = await apiClient.post<EnrollFromOrgResult>(
    `/admin/cohorts/${cohortId}/enroll-from-org`, payload,
  );
  return data;
}
```

- [ ] **Step 3: Create `src/store/orgStore.ts`**

```typescript
import { create } from 'zustand';
import type { OrgDetail, OrgNode, OrgEmployeeSummary } from '@/types/api';

interface OrgState {
  // Currently loaded org detail (tree + meta)
  currentOrg: OrgDetail | null;
  setCurrentOrg: (org: OrgDetail | null) => void;

  // Selected node in the tree panel
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;

  // Employees for the selected node (loaded on demand)
  employees: OrgEmployeeSummary[];
  setEmployees: (employees: OrgEmployeeSummary[]) => void;

  // Include descendants toggle on the employees tab
  includeDescendants: boolean;
  setIncludeDescendants: (v: boolean) => void;

  reset: () => void;
}

export const useOrgStore = create<OrgState>((set) => ({
  currentOrg: null,
  setCurrentOrg: (org) => set({ currentOrg: org }),

  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  employees: [],
  setEmployees: (employees) => set({ employees }),

  includeDescendants: false,
  setIncludeDescendants: (v) => set({ includeDescendants: v }),

  reset: () => set({ currentOrg: null, selectedNodeId: null, employees: [], includeDescendants: false }),
}));

/** Find a node anywhere in the tree by id */
export function findNode(tree: OrgNode[], id: string): OrgNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

/** Build breadcrumb string for a node using its path (resolves names from tree) */
export function buildBreadcrumb(tree: OrgNode[], nodeId: string): string {
  const parts: string[] = [];
  function walk(nodes: OrgNode[], target: string): boolean {
    for (const n of nodes) {
      if (n.id === target) { parts.push(n.name); return true; }
      if (walk(n.children, target)) { parts.unshift(n.name); return true; }
    }
    return false;
  }
  walk(tree, nodeId);
  return parts.join(' › ');
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/vrln/adizes-frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/types/api.ts src/api/organizations.ts src/store/orgStore.ts
git commit -m "feat: add org TypeScript types, API client, and Zustand store"
```

---

## Task 7: Frontend — AdminOrganizations List Page

**Files:**
- Create: `src/pages/AdminOrganizations.tsx`

- [ ] **Step 1: Create the page**

```tsx
// src/pages/AdminOrganizations.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Trash2 } from 'lucide-react';
import { listOrganizations, createOrganization, deleteOrganization } from '@/api/organizations';
import type { OrgSummary } from '@/types/api';

export function AdminOrganizations() {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    listOrganizations()
      .then(setOrgs)
      .catch(() => setError('Failed to load organisations'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createOrganization(newName.trim(), newDesc.trim() || undefined);
      setShowModal(false);
      setNewName(''); setNewDesc('');
      load();
    } catch {
      setError('Failed to create organisation');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (org: OrgSummary) => {
    if (!confirm(`Delete "${org.name}"? This cannot be undone.`)) return;
    try {
      await deleteOrganization(org.id);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Delete failed');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="h-7 w-7 text-[#C8102E]" />
          <h1 className="text-2xl font-bold text-gray-900">Organisations</h1>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#C8102E] text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> New Organisation
        </button>
      </div>

      {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : orgs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No organisations yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="pb-3 pr-4">Name</th>
                <th className="pb-3 pr-4">Description</th>
                <th className="pb-3 pr-4 text-right">Nodes</th>
                <th className="pb-3 pr-4 text-right">Employees</th>
                <th className="pb-3 pr-4">Created</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr
                  key={org.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/admin/organizations/${org.id}`)}
                >
                  <td className="py-3 pr-4 font-medium text-gray-900">{org.name}</td>
                  <td className="py-3 pr-4 text-gray-500 max-w-xs truncate">{org.description ?? '—'}</td>
                  <td className="py-3 pr-4 text-right text-gray-700">{org.node_count}</td>
                  <td className="py-3 pr-4 text-right text-gray-700">{org.employee_count}</td>
                  <td className="py-3 pr-4 text-gray-500">
                    {new Date(org.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleDelete(org)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Org Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">New Organisation</h2>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
              placeholder="e.g. Acme Corporation"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
              rows={2}
              placeholder="Optional"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowModal(false); setNewName(''); setNewDesc(''); }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="px-4 py-2 text-sm bg-[#C8102E] text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/vrln/adizes-frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/pages/AdminOrganizations.tsx
git commit -m "feat: add AdminOrganizations list page"
```

---

## Task 8: Frontend — AdminOrgDetail (Tree + Detail Panel)

**Files:**
- Create: `src/pages/AdminOrgDetail.tsx`

- [ ] **Step 1: Create the page**

```tsx
// src/pages/AdminOrgDetail.tsx
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, ChevronDown, Plus, Trash2, Users, Download } from 'lucide-react';
import {
  getOrganization, createNode, deleteNode, updateNode,
  listNodeEmployees, addEmployee, bulkUploadEmployees, removeEmployee,
} from '@/api/organizations';
import { useOrgStore, findNode, buildBreadcrumb } from '@/store/orgStore';
import type { OrgNode, OrgEmployeeSummary } from '@/types/api';

// ── Tree node (recursive) ─────────────────────────────────────
function TreeNode({
  node, selectedId, onSelect, onAddChild, depth = 0,
}: {
  node: OrgNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string) => void;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth === 0);
  const isSelected = node.id === selectedId;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer group text-sm
          ${isSelected ? 'bg-[#C8102E] text-white' : 'hover:bg-gray-100 text-gray-700'}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => { onSelect(node.id); if (hasChildren) setOpen((o) => !o); }}
      >
        {hasChildren ? (
          open
            ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}
        <span className="flex-1 truncate">{node.name}</span>
        <span className={`text-xs ml-1 flex-shrink-0 ${isSelected ? 'text-red-200' : 'text-gray-400'}`}>
          {node.employee_count > 0 ? node.employee_count : ''}
        </span>
        <button
          className={`ml-1 opacity-0 group-hover:opacity-100 flex-shrink-0
            ${isSelected ? 'text-red-200 hover:text-white' : 'text-gray-400 hover:text-[#C8102E]'}`}
          onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }}
          title="Add sub-node"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && node.children.map((child) => (
        <TreeNode key={child.id} node={child} selectedId={selectedId}
          onSelect={onSelect} onAddChild={onAddChild} depth={depth + 1} />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export function AdminOrgDetail() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { currentOrg, setCurrentOrg, selectedNodeId, setSelectedNodeId,
    employees, setEmployees, includeDescendants, setIncludeDescendants } = useOrgStore();

  const [loading, setLoading] = useState(true);
  const [empLoading, setEmpLoading] = useState(false);

  // Add employee modal state
  const [showAddEmp, setShowAddEmp] = useState(false);
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empTitle, setEmpTitle] = useState('');
  const [empExtId, setEmpExtId] = useState('');
  const [addingEmp, setAddingEmp] = useState(false);
  const [empError, setEmpError] = useState<string | null>(null);

  // Add sub-node modal state
  const [showAddNode, setShowAddNode] = useState(false);
  const [addNodeParentId, setAddNodeParentId] = useState<string | null>(null);
  const [nodeName, setNodeName] = useState('');
  const [nodeType, setNodeType] = useState('department');
  const [addingNode, setAddingNode] = useState(false);

  // Bulk upload state
  const [showBulk, setShowBulk] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkResult, setBulkResult] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  const loadOrg = useCallback(() => {
    if (!orgId) return;
    setLoading(true);
    getOrganization(orgId)
      .then((org) => {
        setCurrentOrg(org);
        // Auto-select root node
        if (!selectedNodeId && org.tree.length > 0) {
          setSelectedNodeId(org.tree[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, [orgId]);

  useEffect(() => { loadOrg(); }, [loadOrg]);

  const loadEmployees = useCallback(() => {
    if (!orgId || !selectedNodeId) return;
    setEmpLoading(true);
    listNodeEmployees(orgId, selectedNodeId, includeDescendants)
      .then(setEmployees)
      .finally(() => setEmpLoading(false));
  }, [orgId, selectedNodeId, includeDescendants]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const handleAddEmployee = async () => {
    if (!orgId || !selectedNodeId || !empName.trim() || !empEmail.trim()) return;
    setAddingEmp(true); setEmpError(null);
    try {
      await addEmployee(orgId, selectedNodeId, {
        name: empName.trim(), email: empEmail.trim(),
        title: empTitle.trim() || undefined, employee_id: empExtId.trim() || undefined,
      });
      setShowAddEmp(false);
      setEmpName(''); setEmpEmail(''); setEmpTitle(''); setEmpExtId('');
      loadOrg(); loadEmployees();
    } catch (e: any) {
      setEmpError(e?.response?.data?.detail ?? 'Failed to add employee');
    } finally {
      setAddingEmp(false);
    }
  };

  const handleAddNode = async () => {
    if (!orgId || !addNodeParentId || !nodeName.trim()) return;
    setAddingNode(true);
    try {
      await createNode(orgId, addNodeParentId, nodeName.trim(), nodeType);
      setShowAddNode(false); setNodeName(''); setNodeType('department');
      loadOrg();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Failed to create node');
    } finally {
      setAddingNode(false);
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (!orgId || !confirm('Delete this node?')) return;
    try {
      await deleteNode(orgId, nodeId);
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
      loadOrg();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Delete failed');
    }
  };

  const handleRemoveEmployee = async (emp: OrgEmployeeSummary) => {
    if (!orgId || !confirm(`Remove ${emp.name} from this organisation?`)) return;
    try {
      await removeEmployee(orgId, emp.id);
      loadOrg(); loadEmployees();
    } catch {
      alert('Failed to remove employee');
    }
  };

  const handleBulkUpload = async () => {
    if (!orgId || !selectedNodeId || !bulkFile) return;
    setUploading(true);
    try {
      const result = await bulkUploadEmployees(orgId, selectedNodeId, bulkFile);
      setBulkResult(result);
      loadOrg(); loadEmployees();
    } catch {
      alert('Bulk upload failed');
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const csv = 'name,email,title,employee_id,node_path\nJane Smith,jane@example.com,Manager,E001,\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'employee_upload_template.csv';
    a.click();
  };

  const selectedNode = currentOrg && selectedNodeId
    ? findNode(currentOrg.tree, selectedNodeId)
    : null;
  const breadcrumb = currentOrg && selectedNodeId
    ? buildBreadcrumb(currentOrg.tree, selectedNodeId)
    : '';

  if (loading) return <div className="p-6 text-gray-500">Loading…</div>;
  if (!currentOrg) return <div className="p-6 text-red-600">Organisation not found.</div>;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
        <button onClick={() => navigate('/admin/organizations')} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">{currentOrg.name}</h1>
        {currentOrg.description && (
          <span className="text-sm text-gray-400">— {currentOrg.description}</span>
        )}
        <div className="ml-auto flex gap-4 text-sm text-gray-500">
          <span>{currentOrg.linked_cohort_count} cohort{currentOrg.linked_cohort_count !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Split panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: tree (35%) */}
        <div className="w-[35%] border-r border-gray-200 overflow-y-auto p-3">
          {currentOrg.tree.map((root) => (
            <TreeNode
              key={root.id}
              node={root}
              selectedId={selectedNodeId}
              onSelect={setSelectedNodeId}
              onAddChild={(parentId) => { setAddNodeParentId(parentId); setShowAddNode(true); }}
            />
          ))}
        </div>

        {/* Right: detail (65%) */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedNode ? (
            <p className="text-gray-400">Select a node on the left.</p>
          ) : (
            <>
              {/* Node header */}
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-xl font-bold text-gray-900">{selectedNode.name}</h2>
                  {selectedNode.node_type && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full capitalize">
                      {selectedNode.node_type}
                    </span>
                  )}
                  {!selectedNode.is_root && (
                    <button
                      onClick={() => handleDeleteNode(selectedNode.id)}
                      className="ml-auto text-gray-400 hover:text-red-600"
                      title="Delete node"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {breadcrumb && (
                  <p className="text-xs text-gray-400">{breadcrumb}</p>
                )}
              </div>

              {/* Stats row */}
              <div className="flex gap-4 mb-6 text-sm">
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-center">
                  <div className="font-bold text-lg text-gray-900">{selectedNode.employee_count}</div>
                  <div className="text-gray-500 text-xs">Direct employees</div>
                </div>
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-center">
                  <div className="font-bold text-lg text-gray-900">{selectedNode.children.length}</div>
                  <div className="text-gray-500 text-xs">Sub-nodes</div>
                </div>
              </div>

              {/* Employee controls */}
              <div className="flex items-center gap-3 mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="h-4 w-4" /> Employees
                </h3>
                <label className="flex items-center gap-1.5 text-sm text-gray-600 ml-auto cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDescendants}
                    onChange={(e) => setIncludeDescendants(e.target.checked)}
                    className="rounded"
                  />
                  Include sub-nodes
                </label>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50"
                >
                  <Download className="h-3.5 w-3.5" /> Template
                </button>
                <button
                  onClick={() => setShowBulk(true)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 text-gray-600"
                >
                  Bulk Upload
                </button>
                <button
                  onClick={() => setShowAddEmp(true)}
                  className="flex items-center gap-1.5 text-sm bg-[#C8102E] text-white rounded-lg px-3 py-1.5 hover:bg-red-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Employee
                </button>
              </div>

              {/* Employee table */}
              {empLoading ? (
                <p className="text-sm text-gray-400">Loading…</p>
              ) : employees.length === 0 ? (
                <p className="text-sm text-gray-400">No employees in this node.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide text-left">
                      <th className="pb-2 pr-3">Name</th>
                      <th className="pb-2 pr-3">Email</th>
                      <th className="pb-2 pr-3">Title</th>
                      <th className="pb-2 pr-3">Status</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 pr-3 font-medium text-gray-900">{emp.name}</td>
                        <td className="py-2 pr-3 text-gray-500">{emp.email}</td>
                        <td className="py-2 pr-3 text-gray-500">{emp.title ?? '—'}</td>
                        <td className="py-2 pr-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                            ${emp.status === 'active'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-amber-50 text-amber-700'}`}>
                            {emp.status === 'active' ? 'Active' : 'Pending'}
                          </span>
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => handleRemoveEmployee(emp)}
                            className="text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add Employee Modal */}
      {showAddEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Add Employee</h2>
            {empError && <p className="text-red-600 text-sm mb-3">{empError}</p>}
            {[
              { label: 'Name *', value: empName, set: setEmpName, placeholder: 'Full name' },
              { label: 'Email *', value: empEmail, set: setEmpEmail, placeholder: 'work@company.com' },
              { label: 'Job Title', value: empTitle, set: setEmpTitle, placeholder: 'Optional' },
              { label: 'Employee ID', value: empExtId, set: setEmpExtId, placeholder: 'Optional HR ID' },
            ].map(({ label, value, set, placeholder }) => (
              <div key={label} className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                  placeholder={placeholder}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                />
              </div>
            ))}
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setShowAddEmp(false); setEmpError(null); }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button
                onClick={handleAddEmployee}
                disabled={addingEmp || !empName.trim() || !empEmail.trim()}
                className="px-4 py-2 text-sm bg-[#C8102E] text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {addingEmp ? 'Adding…' : 'Add Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Sub-node Modal */}
      {showAddNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Add Sub-node</h2>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
              placeholder="e.g. North India Division"
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              autoFocus
            />
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
              value={nodeType}
              onChange={(e) => setNodeType(e.target.value)}
            >
              {['company', 'division', 'department', 'team'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowAddNode(false); setNodeName(''); }}
                className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button
                onClick={handleAddNode}
                disabled={addingNode || !nodeName.trim()}
                className="px-4 py-2 text-sm bg-[#C8102E] text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {addingNode ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-2">Bulk Upload Employees</h2>
            <p className="text-sm text-gray-500 mb-4">
              Upload a CSV with columns: <code className="bg-gray-100 px-1 rounded">name, email, title, employee_id, node_path</code>
            </p>
            <input
              type="file" accept=".csv"
              onChange={(e) => { setBulkFile(e.target.files?.[0] ?? null); setBulkResult(null); }}
              className="block w-full text-sm text-gray-600 mb-4"
            />
            {bulkResult && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm mb-4">
                <p className="text-green-700 font-medium">✓ {bulkResult.created} created, {bulkResult.skipped} skipped</p>
                {bulkResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-red-600 font-medium">{bulkResult.errors.length} error(s):</p>
                    {bulkResult.errors.map((e: any, i: number) => (
                      <p key={i} className="text-red-500 text-xs">Row {e.row}: {e.email} — {e.reason}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowBulk(false); setBulkFile(null); setBulkResult(null); }}
                className="px-4 py-2 text-sm text-gray-600">Close</button>
              <button
                onClick={handleBulkUpload}
                disabled={!bulkFile || uploading}
                className="px-4 py-2 text-sm bg-[#C8102E] text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/vrln/adizes-frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/pages/AdminOrgDetail.tsx
git commit -m "feat: add AdminOrgDetail tree+panel page"
```

---

## Task 9: Frontend — AdminCohortDetail Modifications

**Files:**
- Modify: `src/pages/AdminCohortDetail.tsx`

- [ ] **Step 1: Add linked orgs state and load function**

Near the top of `AdminCohortDetail`, add imports:
```typescript
import { listCohortOrgs, linkOrgToCohort, unlinkOrgFromCohort,
         enrollFromOrg, listOrganizations, getOrganization,
         listNodeEmployees } from '@/api/organizations';
import type { LinkedOrgSummary, OrgSummary, OrgDetail, OrgEmployeeSummary } from '@/types/api';
```

Add state variables inside the component:
```typescript
const [linkedOrgs, setLinkedOrgs] = useState<LinkedOrgSummary[]>([]);
const [allOrgs, setAllOrgs] = useState<OrgSummary[]>([]);
const [showLinkModal, setShowLinkModal] = useState(false);
const [linkOrgId, setLinkOrgId] = useState('');
const [linking, setLinking] = useState(false);
const [showEnrolModal, setShowEnrolModal] = useState(false);
const [enrolOrg, setEnrolOrg] = useState<OrgDetail | null>(null);
const [enrolScope, setEnrolScope] = useState<{ nodeId: string | null; includeDesc: boolean }>({
  nodeId: null, includeDesc: true,
});
const [enrolUserIds, setEnrolUserIds] = useState<string[]>([]);
const [enrolTab, setEnrolTab] = useState<'scope' | 'individual'>('scope');
const [enrolling, setEnrolling] = useState(false);
const [enrolResult, setEnrolResult] = useState<{ enrolled: number; skipped: number } | null>(null);
const [orgEmployees, setOrgEmployees] = useState<OrgEmployeeSummary[]>([]);
const [empSearch, setEmpSearch] = useState('');
const [empLoading, setEmpLoading] = useState(false);
```

Add these to the `useEffect` data-loading:
```typescript
listCohortOrgs(cohortId!).then(setLinkedOrgs).catch(() => {});
listOrganizations().then(setAllOrgs).catch(() => {});
```

- [ ] **Step 2: Add linked orgs section JSX**

Find the closing area of the enrol section in `AdminCohortDetail.tsx` and add after it:

```tsx
{/* ── Linked Organisations ────────────────────── */}
<div className="bg-white rounded-xl border border-gray-200 p-6">
  <div className="flex items-center justify-between mb-4">
    <h3 className="font-semibold text-gray-900">Linked Organisations</h3>
    <button
      onClick={() => setShowLinkModal(true)}
      className="flex items-center gap-1.5 text-sm border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 text-gray-600"
    >
      <Plus className="h-3.5 w-3.5" /> Link Organisation
    </button>
  </div>

  {linkedOrgs.length === 0 ? (
    <p className="text-sm text-gray-400">No organisations linked yet.</p>
  ) : (
    <div className="space-y-2">
      {linkedOrgs.map((lo) => (
        <div key={lo.org_id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
          <div>
            <span className="font-medium text-sm text-gray-900">{lo.name}</span>
            <span className="ml-2 text-xs text-gray-400">{lo.employee_count} employees</span>
          </div>
          <button
            onClick={async () => {
              if (!confirm(`Unlink ${lo.name}?`)) return;
              await unlinkOrgFromCohort(cohortId!, lo.org_id);
              setLinkedOrgs((prev) => prev.filter((o) => o.org_id !== lo.org_id));
            }}
            className="text-xs text-gray-400 hover:text-red-600"
          >
            Unlink
          </button>
        </div>
      ))}
    </div>
  )}

  {linkedOrgs.length > 0 && (
    linkedOrgs.length === 1 ? (
      <button
        onClick={async () => {
          const org = await getOrganization(linkedOrgs[0].org_id);
          setEnrolOrg(org);
          setEnrolResult(null);
          setEnrolScope({ nodeId: null, includeDesc: true });
          setEnrolUserIds([]);
          setEmpSearch('');
          // Pre-fetch all employees (root node + descendants) for the individual tab
          if (org.tree[0]) {
            setEmpLoading(true);
            listNodeEmployees(org.id, org.tree[0].id, true)
              .then(setOrgEmployees).catch(() => {}).finally(() => setEmpLoading(false));
          }
          setShowEnrolModal(true);
        }}
        className="mt-4 w-full text-sm bg-[#1D3557] text-white rounded-lg py-2 hover:bg-blue-900"
      >
        Enrol from Organisation
      </button>
    ) : (
      <div className="mt-4 space-y-2">
        <p className="text-xs text-gray-500">Enrol from a linked organisation:</p>
        {linkedOrgs.map((lo) => (
          <button
            key={lo.org_id}
            onClick={async () => {
              const org = await getOrganization(lo.org_id);
              setEnrolOrg(org);
              setEnrolResult(null);
              setEnrolScope({ nodeId: null, includeDesc: true });
              setEnrolUserIds([]);
              setEmpSearch('');
              if (org.tree[0]) {
                listNodeEmployees(org.id, org.tree[0].id, true).then(setOrgEmployees).catch(() => {});
              }
              setShowEnrolModal(true);
            }}
            className="w-full text-left text-sm bg-[#1D3557] text-white rounded-lg px-3 py-2 hover:bg-blue-900"
          >
            {lo.name} ({lo.employee_count} employees)
          </button>
        ))}
      </div>
    )
  )}
</div>

{/* ── Link Org Modal ───────────────────────────── */}
{showLinkModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
      <h2 className="text-lg font-semibold mb-4">Link Organisation</h2>
      <select
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
        value={linkOrgId}
        onChange={(e) => setLinkOrgId(e.target.value)}
      >
        <option value="">Select an organisation…</option>
        {allOrgs
          .filter((o) => !linkedOrgs.some((lo) => lo.org_id === o.id))
          .map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
      </select>
      <div className="flex justify-end gap-3">
        <button onClick={() => setShowLinkModal(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
        <button
          disabled={!linkOrgId || linking}
          onClick={async () => {
            setLinking(true);
            try {
              await linkOrgToCohort(cohortId!, linkOrgId);
              const updated = await listCohortOrgs(cohortId!);
              setLinkedOrgs(updated);
              setShowLinkModal(false); setLinkOrgId('');
            } finally { setLinking(false); }
          }}
          className="px-4 py-2 text-sm bg-[#C8102E] text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {linking ? 'Linking…' : 'Link'}
        </button>
      </div>
    </div>
  </div>
)}

{/* ── Enrol from Org Modal ─────────────────────── */}
{showEnrolModal && enrolOrg && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
      <h2 className="text-lg font-semibold mb-1">Enrol from {enrolOrg.name}</h2>
      <div className="flex gap-4 mb-4 border-b border-gray-200 text-sm">
        {(['scope', 'individual'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setEnrolTab(tab)}
            className={`py-2 border-b-2 -mb-px font-medium capitalize
              ${enrolTab === tab ? 'border-[#C8102E] text-[#C8102E]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {tab === 'scope' ? 'By Scope' : 'By Individual'}
          </button>
        ))}
      </div>

      {enrolTab === 'scope' && (
        <div className="space-y-2 mb-4">
          <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input type="radio" checked={enrolScope.nodeId === null}
              onChange={() => setEnrolScope({ nodeId: null, includeDesc: true })} />
            <span className="text-sm">Entire organisation</span>
          </label>
          {enrolOrg.tree[0]?.children.map((node) => (
            <label key={node.id} className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="radio" checked={enrolScope.nodeId === node.id}
                onChange={() => setEnrolScope({ nodeId: node.id, includeDesc: true })} />
              <span className="text-sm flex-1">{node.name}</span>
              <span className="text-xs text-gray-400">{node.employee_count} employees</span>
            </label>
          ))}
          {enrolScope.nodeId && (
            <label className="flex items-center gap-2 text-sm text-gray-600 mt-2">
              <input type="checkbox" checked={enrolScope.includeDesc}
                onChange={(e) => setEnrolScope((s) => ({ ...s, includeDesc: e.target.checked }))} />
              Include sub-nodes
            </label>
          )}
        </div>
      )}

      {enrolTab === 'individual' && (
        // orgEmployees is pre-fetched when the modal opens (listNodeEmployees on root + descendants)
        // empSearch and orgEmployees are component-level state (declared above with other state vars)
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by name or email…"
            value={empSearch}
            onChange={(e) => setEmpSearch(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
          />
          <div className="max-h-52 overflow-y-auto space-y-1">
            {orgEmployees
              .filter(
                (e) => e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
                       e.email.toLowerCase().includes(empSearch.toLowerCase())
              )
              .map((emp) => (
                <label key={emp.user_id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={enrolUserIds.includes(emp.user_id)}
                    onChange={(e) => setEnrolUserIds((ids) =>
                      e.target.checked ? [...ids, emp.user_id] : ids.filter((id) => id !== emp.user_id)
                    )}
                  />
                  <span className="flex-1">{emp.name}</span>
                  <span className="text-xs text-gray-400">{emp.email}</span>
                </label>
              ))}
            {orgEmployees.filter(
              (e) => e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
                     e.email.toLowerCase().includes(empSearch.toLowerCase())
            ).length === 0 && (
              <p className="text-xs text-gray-400 p-2">
                {empLoading ? 'Loading employees…' : 'No employees found.'}
              </p>
            )}
          </div>
          {enrolUserIds.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">{enrolUserIds.length} selected</p>
          )}
        </div>
      )}

      {enrolResult && (
        <div className="bg-green-50 rounded-lg p-3 text-sm mb-4 text-green-700">
          ✓ {enrolResult.enrolled} enrolled, {enrolResult.skipped} skipped (already enrolled)
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button onClick={() => setShowEnrolModal(false)} className="px-4 py-2 text-sm text-gray-600">Close</button>
        <button
          disabled={enrolling || (enrolTab === 'individual' && enrolUserIds.length === 0)}
          onClick={async () => {
            setEnrolling(true);
            try {
              const result = await enrollFromOrg(cohortId!, {
                org_id: enrolOrg.id,
                node_id: enrolScope.nodeId ?? undefined,
                include_descendants: enrolScope.includeDesc,
                user_ids: enrolUserIds.length > 0 ? enrolUserIds : undefined,
              });
              setEnrolResult(result);
            } finally { setEnrolling(false); }
          }}
          className="px-4 py-2 text-sm bg-[#C8102E] text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {enrolling ? 'Enrolling…' : 'Enrol'}
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 2: Add `Plus` to lucide-react imports if not already present**

Check the existing imports line in `AdminCohortDetail.tsx` and add `Plus` if missing:
```typescript
import { ..., Plus } from 'lucide-react';
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/vrln/adizes-frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/AdminCohortDetail.tsx
git commit -m "feat: add linked orgs section and enrol-from-org modal to AdminCohortDetail"
```

---

## Task 10: Frontend — Routing + Navigation

**Files:**
- Modify: `src/components/layout/AdminSidebar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add Organizations to sidebar**

In `AdminSidebar.tsx`, find the nav items array/JSX (look for "Cohorts" or "Dashboard" link) and add Organizations between Dashboard and Cohorts:

```tsx
import { Building2 } from 'lucide-react';

// Add this nav item between Dashboard and Cohorts:
{ to: '/admin/organizations', icon: Building2, label: 'Organizations' }
```

Or if the sidebar uses inline JSX, add:
```tsx
<NavLink to="/admin/organizations"
  className={({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
    ${isActive ? 'bg-[#C8102E] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
  <Building2 className="h-5 w-5" />
  Organizations
</NavLink>
```

Place it between the Dashboard and Cohorts links.

- [ ] **Step 2: Add routes to `App.tsx`**

In `App.tsx`, find where the admin routes are defined (look for `AdminDashboard`, `AdminCohorts`, etc.) and add:

```tsx
import { AdminOrganizations } from './pages/AdminOrganizations';
import { AdminOrgDetail } from './pages/AdminOrgDetail';

// Inside the admin route group:
<Route path="/admin/organizations" element={<AdminOrganizations />} />
<Route path="/admin/organizations/:orgId" element={<AdminOrgDetail />} />
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/vrln/adizes-frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Start dev server and manually verify**

```bash
npm run dev
```

Navigate to http://localhost:3000, log in as admin, verify:
- "Organizations" appears in sidebar between Dashboard and Cohorts
- `/admin/organizations` loads the list page
- Create a new org — verify it appears in the table
- Click the org — verify the tree+detail panel loads with the root node selected
- Add a sub-node — verify it appears in the left tree
- Add an employee — verify they appear in the employees table with status "Pending"
- Navigate to a Cohort → verify "Linked Organisations" section appears
- Link an org to the cohort → "Enrol from Organisation" button appears

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/AdminSidebar.tsx src/App.tsx
git commit -m "feat: wire up org routes and sidebar nav"
```

---

## Task 11: Deploy to Production

- [ ] **Step 1: Apply migration 007 to Supabase Cloud**

In Supabase dashboard → SQL Editor → run the full contents of `migrations/007_organizations.sql`.

Expected: no errors.

- [ ] **Step 2: Build and push backend to ECR**

```bash
cd /Users/vrln/adizes-backend
# Ensure all backend commits are pushed before baking into image
git push origin adizes-backend

AWS_ACCOUNT_ID=094492115510
AWS_REGION=ap-south-1
ECR_REPO=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/adizes-backend

aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

docker buildx build --platform linux/amd64 --provenance=false -t $ECR_REPO:latest .
docker push $ECR_REPO:latest
```

- [ ] **Step 3: Wait for App Runner to deploy**

```bash
for i in $(seq 1 12); do
  STATUS=$(aws apprunner describe-service \
    --service-arn arn:aws:apprunner:ap-south-1:094492115510:service/t3-adizes-backend-app/ee9fcffee2d2411db36184aba48b228d \
    --region ap-south-1 --query 'Service.Status' --output text)
  echo "$(date '+%H:%M:%S') — $STATUS"
  [ "$STATUS" = "RUNNING" ] && break
  sleep 30
done
```

Expected: `RUNNING` within ~5 minutes.

- [ ] **Step 4: Push frontend to Netlify**

```bash
cd /Users/vrln/adizes-frontend
git push origin adizes-frontend
```

Netlify auto-builds and deploys on push.

- [ ] **Step 5: Smoke-test production**

- Log in to `https://adizes-app.turiyaskills.co` as admin
- Verify Organizations link appears in sidebar
- Create a test org, add a node, add an employee — check for welcome email
- Link org to a cohort, run enrol from org

---

## Quick Reference

**Local dev commands:**
```bash
# Backend rebuild after any .py change
cd /Users/vrln/adizes-backend && docker compose up --build -d

# Run tests
docker exec adizes-backend python -m pytest tests/ -v

# Frontend dev server
cd /Users/vrln/adizes-frontend && npm run dev

# Re-apply migration 007 (after supabase restart)
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres \
  < migrations/007_organizations.sql
```

**Test credentials (local):**
- Admin: `admin@adizes.com` / `Admin@1234`
- User: `user@adizes.com` / `User@1234`
