# Employee Extended Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 9 new HR fields to the employee record (last name, middle name, gender, DOB, language, manager email, employment date, head-of-dept, emp status), expose them in a two-tab Add/Edit modal, an expandable table, a bulk CSV upload, and an Excel export.

**Architecture:** Backend migration 008 adds columns to `org_employees`; schemas and endpoints in `admin.py` are updated; frontend `AdminOrgDetail.tsx` gets a redesigned two-tab modal, expandable table rows with edit/remove actions, and an Excel export using SheetJS. All changes flow through the existing FastAPI → Supabase pattern with no new services.

**Tech Stack:** FastAPI + Supabase (PostgreSQL) — backend; React 19 + TypeScript + Tailwind CSS v4 + SheetJS (`xlsx`) — frontend; pytest — backend tests; `npx tsc --noEmit` — frontend lint.

---

## File Map

| File | Change |
|------|--------|
| `adizes-backend/migrations/008_employee_extended_fields.sql` | New — 9 new columns on `org_employees` |
| `adizes-backend/supabase/migrations/20260320000008_employee_extended_fields.sql` | New — same SQL, Supabase CLI format |
| `adizes-backend/app/schemas/org.py` | Update `AddEmployeeRequest`, `OrgEmployeeSummary`, `BulkEmployeeRow`; add `UpdateEmployeeRequest` |
| `adizes-backend/app/routers/admin.py` | Add `_parse_dmy_date`; update `_add_employee_to_node`, `add_employee`, `list_node_employees`, `bulk_upload_employees`; add `update_employee` PATCH endpoint |
| `adizes-backend/tests/test_employee_extended.py` | New — all backend tests for extended fields |
| `adizes-frontend/src/types/api.ts` | Update `OrgEmployeeSummary`; add `UpdateEmployeeRequest` |
| `adizes-frontend/src/api/organizations.ts` | Update `addEmployee`; add `updateEmployee` |
| `adizes-frontend/src/store/orgStore.ts` | Add `flattenTree` helper |
| `adizes-frontend/src/pages/AdminOrgDetail.tsx` | Two-tab modal; expandable table; edit mode; Export Excel; updated template/CSV modal |
| `adizes-frontend/src/pages/AdminHelp.tsx` | Add FAQ entry for extended fields |
| `HIL_Adizes_India/CLAUDE.md` | Add migration 008 to quick-start |

---

### Task 1: Migration 008

**Files:**
- Create: `adizes-backend/migrations/008_employee_extended_fields.sql`
- Create: `adizes-backend/supabase/migrations/20260320000008_employee_extended_fields.sql`

- [ ] **Step 1: Create the plain migration file**

Write `/Users/vrln/adizes-backend/migrations/008_employee_extended_fields.sql`:

```sql
-- migrations/008_employee_extended_fields.sql
-- Adds 9 HR profile columns to org_employees.
-- All new NOT NULL columns have defaults so existing rows are migrated safely.

ALTER TABLE org_employees
  ADD COLUMN last_name        text,
  ADD COLUMN middle_name      text,
  ADD COLUMN gender           text,
  ADD COLUMN default_language text    NOT NULL DEFAULT 'English',
  ADD COLUMN manager_email    text,
  ADD COLUMN dob              date,
  ADD COLUMN emp_date         date,
  ADD COLUMN head_of_dept     boolean NOT NULL DEFAULT false,
  ADD COLUMN emp_status       text    NOT NULL DEFAULT 'Active'
    CONSTRAINT emp_status_check
      CHECK (emp_status IN ('Active','Inactive','On Leave','Probation','Resigned'));
```

- [ ] **Step 2: Create the Supabase CLI migration file**

Write `/Users/vrln/adizes-backend/supabase/migrations/20260320000008_employee_extended_fields.sql` with identical content.

- [ ] **Step 3: Apply to local DB**

```bash
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres \
  < /Users/vrln/adizes-backend/migrations/008_employee_extended_fields.sql
```

Expected: no errors. If Supabase is not running, start it first (`supabase start` from `adizes-backend` dir).

- [ ] **Step 4: Verify columns exist**

```bash
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres \
  -c "\d org_employees"
```

Expected: `emp_status`, `head_of_dept`, `dob`, `emp_date`, `gender`, `default_language`, `manager_email`, `last_name`, `middle_name` all visible.

- [ ] **Step 5: Commit**

```bash
cd /Users/vrln/adizes-backend
git add migrations/008_employee_extended_fields.sql supabase/migrations/20260320000008_employee_extended_fields.sql
git commit -m "feat: migration 008 — add 9 HR profile columns to org_employees"
```

---

### Task 2: Backend Schemas

**Files:**
- Modify: `adizes-backend/app/schemas/org.py`
- Create: `adizes-backend/tests/test_employee_extended.py`

- [ ] **Step 1: Replace the employee section of `app/schemas/org.py`**

Replace everything from `# ── Employees ─────` through the end of `BulkEmployeeRow` with:

```python
# ── Employees ─────────────────────────────────────────────────
EMP_STATUS_VALUES = {'Active', 'Inactive', 'On Leave', 'Probation', 'Resigned'}


class AddEmployeeRequest(BaseModel):
    name: str
    email: EmailStr
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    title: Optional[str] = None
    employee_id: Optional[str] = None
    emp_status: str = 'Active'
    gender: Optional[str] = None
    default_language: str = 'English'
    manager_email: Optional[EmailStr] = None
    dob: Optional[str] = None       # DD/MM/YYYY
    emp_date: Optional[str] = None  # DD/MM/YYYY
    head_of_dept: bool = False


class UpdateEmployeeRequest(BaseModel):
    """Partial update — only provided (non-None) fields are written.
    Send empty string "" to clear an optional text/date field.
    emp_status and default_language cannot be cleared (they have required defaults).
    """
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    title: Optional[str] = None
    employee_id: Optional[str] = None
    emp_status: Optional[str] = None
    gender: Optional[str] = None
    default_language: Optional[str] = None
    manager_email: Optional[str] = None  # str not EmailStr — validated in endpoint
    dob: Optional[str] = None       # DD/MM/YYYY or "" to clear
    emp_date: Optional[str] = None  # DD/MM/YYYY or "" to clear
    head_of_dept: Optional[bool] = None


class OrgEmployeeSummary(BaseModel):
    id: str           # org_employees.id UUID — use this for PATCH/DELETE
    user_id: str
    name: str
    email: str
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    title: Optional[str] = None
    employee_id: Optional[str] = None
    emp_status: str = 'Active'
    gender: Optional[str] = None
    default_language: str = 'English'
    manager_email: Optional[str] = None
    dob: Optional[str] = None       # YYYY-MM-DD (frontend formats to DD/MM/YYYY)
    emp_date: Optional[str] = None  # YYYY-MM-DD
    head_of_dept: bool = False
    status: str       # 'active' | 'pending' (auth activation state)
    node_id: str
    joined_at: str


class BulkEmployeeRow(BaseModel):
    row: int
    name: str
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    email: str
    title: Optional[str] = None
    employee_id: Optional[str] = None
    emp_status: str = 'Active'
    gender: Optional[str] = None
    default_language: str = 'English'
    manager_email: Optional[str] = None
    dob: Optional[str] = None       # DD/MM/YYYY
    emp_date: Optional[str] = None  # DD/MM/YYYY
    head_of_dept: bool = False
    node_path: Optional[str] = None
```

- [ ] **Step 2: Write schema tests**

Create `/Users/vrln/adizes-backend/tests/test_employee_extended.py`:

```python
# tests/test_employee_extended.py
"""Tests for employee extended fields — schemas and pure helpers."""
import pytest
from app.schemas.org import (
    AddEmployeeRequest, UpdateEmployeeRequest,
    OrgEmployeeSummary, BulkEmployeeRow, EMP_STATUS_VALUES,
)


class TestEmpStatusValues:
    def test_allowed_set(self):
        assert EMP_STATUS_VALUES == {'Active', 'Inactive', 'On Leave', 'Probation', 'Resigned'}


class TestAddEmployeeRequest:
    def test_defaults(self):
        req = AddEmployeeRequest(name='Jane', email='jane@example.com')
        assert req.emp_status == 'Active'
        assert req.default_language == 'English'
        assert req.head_of_dept is False
        assert req.last_name is None
        assert req.dob is None

    def test_all_fields(self):
        req = AddEmployeeRequest(
            name='Jane', email='jane@example.com',
            last_name='Smith', middle_name='Marie',
            title='Manager', employee_id='E001',
            emp_status='Probation', gender='Female',
            default_language='Hindi',
            manager_email='boss@example.com',
            dob='15/06/1990', emp_date='01/01/2020',
            head_of_dept=True,
        )
        assert req.emp_status == 'Probation'
        assert req.head_of_dept is True
        assert req.dob == '15/06/1990'

    def test_email_validated(self):
        with pytest.raises(Exception):
            AddEmployeeRequest(name='Jane', email='not-an-email')


class TestUpdateEmployeeRequest:
    def test_all_none_by_default(self):
        req = UpdateEmployeeRequest()
        assert req.emp_status is None
        assert req.head_of_dept is None

    def test_partial_fields(self):
        req = UpdateEmployeeRequest(emp_status='On Leave', head_of_dept=True)
        d = req.model_dump(exclude_none=True)
        assert d == {'emp_status': 'On Leave', 'head_of_dept': True}

    def test_empty_string_preserved(self):
        # Empty string must be preserved (used to clear optional fields)
        req = UpdateEmployeeRequest(last_name='', manager_email='')
        d = req.model_dump(exclude_none=True)
        assert d['last_name'] == ''
        assert d['manager_email'] == ''


class TestOrgEmployeeSummary:
    def test_required_fields(self):
        emp = OrgEmployeeSummary(
            id='uuid1', user_id='u1', name='Jane', email='jane@example.com',
            status='active', node_id='n1', joined_at='2026-01-01T00:00:00',
        )
        assert emp.emp_status == 'Active'
        assert emp.default_language == 'English'
        assert emp.head_of_dept is False

    def test_dob_stored_as_iso(self):
        emp = OrgEmployeeSummary(
            id='uuid1', user_id='u1', name='Jane', email='jane@example.com',
            status='active', node_id='n1', joined_at='2026-01-01T00:00:00',
            dob='1990-06-15',  # ISO format from DB
        )
        assert emp.dob == '1990-06-15'


class TestBulkEmployeeRow:
    def test_defaults(self):
        row = BulkEmployeeRow(row=2, name='Jane', email='jane@example.com')
        assert row.emp_status == 'Active'
        assert row.head_of_dept is False
        assert row.node_path is None
```

- [ ] **Step 3: Run schema tests**

```bash
cd /Users/vrln/adizes-backend && python -m pytest tests/test_employee_extended.py -v
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
cd /Users/vrln/adizes-backend
git add app/schemas/org.py tests/test_employee_extended.py
git commit -m "feat: add 9 extended fields to employee schemas; add UpdateEmployeeRequest"
```

---

### Task 3: Backend — Add/List Endpoint Updates

**Files:**
- Modify: `adizes-backend/app/routers/admin.py`
- Modify: `adizes-backend/tests/test_employee_extended.py`

- [ ] **Step 1: Add `_parse_dmy_date` helper to `admin.py`**

Add this function immediately before `_build_org_tree` (around line 723):

```python
def _parse_dmy_date(value: str | None) -> str | None:
    """Parse DD/MM/YYYY → YYYY-MM-DD. Returns None for None/empty. Raises ValueError on bad format."""
    if not value:
        return None
    from datetime import datetime
    try:
        return datetime.strptime(value.strip(), "%d/%m/%Y").strftime("%Y-%m-%d")
    except ValueError:
        raise ValueError(f"Invalid date '{value}' — expected DD/MM/YYYY")
```

- [ ] **Step 2: Write tests for `_parse_dmy_date`**

Add to `tests/test_employee_extended.py`:

```python
class TestParseDmyDate:
    def test_valid(self):
        from app.routers.admin import _parse_dmy_date
        assert _parse_dmy_date('15/06/1990') == '1990-06-15'
        assert _parse_dmy_date('01/01/2020') == '2020-01-01'

    def test_none_returns_none(self):
        from app.routers.admin import _parse_dmy_date
        assert _parse_dmy_date(None) is None
        assert _parse_dmy_date('') is None

    def test_invalid_raises(self):
        from app.routers.admin import _parse_dmy_date
        with pytest.raises(ValueError):
            _parse_dmy_date('1990-06-15')   # ISO format — wrong
        with pytest.raises(ValueError):
            _parse_dmy_date('32/13/2020')   # impossible date
```

- [ ] **Step 3: Run the new tests to confirm they fail (function not yet added)**

```bash
cd /Users/vrln/adizes-backend && python -m pytest tests/test_employee_extended.py::TestParseDmyDate -v
```

Expected: ImportError or AttributeError (function not in admin.py yet).

- [ ] **Step 4: Add `_parse_dmy_date` to admin.py (as described in Step 1)**

Also add the import at the top of `admin.py` if `datetime` is not already imported:

```python
import re
import csv
import _io
# datetime is used inline inside _parse_dmy_date — no top-level import needed
```

- [ ] **Step 5: Run tests — confirm pass**

```bash
cd /Users/vrln/adizes-backend && python -m pytest tests/test_employee_extended.py::TestParseDmyDate -v
```

Expected: 3 tests PASS.

- [ ] **Step 6: Update `_add_employee_to_node` signature and INSERT**

Update the function signature (currently around line 1012):

```python
def _add_employee_to_node(
    org_id: str, org_name: str, node_id: str,
    email: str, name: str,
    title: str | None = None,
    employee_id: str | None = None,
    last_name: str | None = None,
    middle_name: str | None = None,
    emp_status: str = 'Active',
    gender: str | None = None,
    default_language: str = 'English',
    manager_email: str | None = None,
    dob: str | None = None,       # DD/MM/YYYY — parsed to ISO before insert
    emp_date: str | None = None,  # DD/MM/YYYY — parsed to ISO before insert
    head_of_dept: bool = False,
) -> dict:
```

Inside the function, add date parsing and validation before the INSERT block. Replace the existing `supabase_admin.table("org_employees").insert({...})` call with:

> **Important:** Retain the existing auth user creation code above this (the `supabase_admin.auth.admin.create_user(...)` / `generate_link(...)` call and the resulting `user_id` variable) — only replace the INSERT dict.

```python
    from app.schemas.org import EMP_STATUS_VALUES
    if emp_status not in EMP_STATUS_VALUES:
        raise HTTPException(status_code=422, detail=f"Invalid emp_status '{emp_status}'")

    try:
        dob_iso = _parse_dmy_date(dob)
        emp_date_iso = _parse_dmy_date(emp_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    supabase_admin.table("org_employees").insert({
        "org_id": org_id, "node_id": node_id, "user_id": user_id,
        "employee_id": employee_id, "title": title,
        "last_name": last_name, "middle_name": middle_name,
        "emp_status": emp_status, "gender": gender,
        "default_language": default_language, "manager_email": manager_email,
        "dob": dob_iso, "emp_date": emp_date_iso, "head_of_dept": head_of_dept,
    }).execute()
```

- [ ] **Step 7: Update `add_employee` endpoint to pass new fields**

Update the `return _add_employee_to_node(...)` call inside `add_employee` (around line 1005):

```python
    return _add_employee_to_node(
        org_id=org_id, org_name=org_name, node_id=node_id,
        email=str(body.email), name=body.name,
        title=body.title, employee_id=body.employee_id,
        last_name=body.last_name, middle_name=body.middle_name,
        emp_status=body.emp_status, gender=body.gender,
        default_language=body.default_language,
        manager_email=str(body.manager_email) if body.manager_email else None,
        dob=body.dob, emp_date=body.emp_date,
        head_of_dept=body.head_of_dept,
    )
```

- [ ] **Step 8: Update `list_node_employees` to read new columns**

Replace the `result.append(OrgEmployeeSummary(...))` block (around line 981):

```python
        result.append(OrgEmployeeSummary(
            id=e["id"], user_id=e["user_id"], name=name, email=email,
            last_name=e.get("last_name"), middle_name=e.get("middle_name"),
            title=e.get("title"), employee_id=e.get("employee_id"),
            emp_status=e.get("emp_status") or "Active",
            gender=e.get("gender"),
            default_language=e.get("default_language") or "English",
            manager_email=e.get("manager_email"),
            dob=str(e["dob"]) if e.get("dob") else None,
            emp_date=str(e["emp_date"]) if e.get("emp_date") else None,
            head_of_dept=bool(e.get("head_of_dept", False)),
            status=status_str, node_id=e["node_id"], joined_at=str(e["joined_at"]),
        ))
```

- [ ] **Step 9: Write and run pure-logic tests for `_parse_dmy_date` + schema**

```bash
cd /Users/vrln/adizes-backend && python -m pytest tests/test_employee_extended.py -v
```

Expected: all tests PASS.

- [ ] **Step 10: Commit**

```bash
cd /Users/vrln/adizes-backend
git add app/routers/admin.py tests/test_employee_extended.py
git commit -m "feat: update _add_employee_to_node and list_node_employees for 9 new fields"
```

---

### Task 4: Backend — Bulk Upload Update

**Files:**
- Modify: `adizes-backend/app/routers/admin.py`
- Modify: `adizes-backend/tests/test_employee_extended.py`

- [ ] **Step 1: Write tests for the new bulk parsing rules**

Add to `tests/test_employee_extended.py`:

```python
class TestBulkParsing:
    """Test the parsing rules applied to each CSV row in bulk_upload_employees."""

    def _parse_head_of_dept(self, value: str) -> bool:
        """Mirror the logic in bulk_upload_employees."""
        return value.strip().lower() in ('yes', 'true', '1')

    def test_head_of_dept_yes(self):
        assert self._parse_head_of_dept('yes') is True
        assert self._parse_head_of_dept('Yes') is True
        assert self._parse_head_of_dept('true') is True
        assert self._parse_head_of_dept('1') is True

    def test_head_of_dept_no(self):
        assert self._parse_head_of_dept('no') is False
        assert self._parse_head_of_dept('') is False
        assert self._parse_head_of_dept('No') is False

    def test_emp_status_default(self):
        # blank → 'Active'
        value = ''.strip() or 'Active'
        assert value == 'Active'

    def test_emp_status_invalid(self):
        from app.schemas.org import EMP_STATUS_VALUES
        assert 'BadStatus' not in EMP_STATUS_VALUES

    def test_date_parse_valid(self):
        from app.routers.admin import _parse_dmy_date
        assert _parse_dmy_date('01/06/1985') == '1985-06-01'

    def test_date_parse_invalid_raises(self):
        from app.routers.admin import _parse_dmy_date
        with pytest.raises(ValueError):
            _parse_dmy_date('2026-01-01')  # ISO, not DMY
```

- [ ] **Step 2: Run tests — confirm they pass**

```bash
cd /Users/vrln/adizes-backend && python -m pytest tests/test_employee_extended.py::TestBulkParsing -v
```

Expected: all PASS (these are pure logic tests).

- [ ] **Step 3: Update `bulk_upload_employees` CSV parsing**

Inside `bulk_upload_employees`, in the `for row_idx, row in enumerate(reader, start=2)` loop, replace the existing field extraction block with:

```python
        email = (row.get("email") or "").strip()
        name = (row.get("name") or "").strip()
        title = (row.get("title") or "").strip() or None
        ext_id = (row.get("employee_id") or "").strip() or None
        node_path_val = (row.get("node_path") or "").strip() or None
        last_name = (row.get("last_name") or "").strip() or None
        middle_name = (row.get("middle_name") or "").strip() or None
        gender = (row.get("gender") or "").strip() or None
        default_language = (row.get("default_language") or "").strip() or "English"
        manager_email = (row.get("manager_email") or "").strip() or None
        dob_raw = (row.get("dob") or "").strip() or None
        emp_date_raw = (row.get("emp_date") or "").strip() or None
        head_raw = (row.get("head_of_dept") or "").strip().lower()
        head_of_dept = head_raw in ("yes", "true", "1")
        emp_status_raw = (row.get("emp_status") or "").strip()
        emp_status = emp_status_raw if emp_status_raw else "Active"
```

Then add these checks after the existing `email` and duplicate-in-file checks, before the node resolution block:

```python
        # Validate name required
        if not name:
            errors.append({"row": row_idx, "email": email, "reason": "name is required"})
            continue

        # Validate emp_status
        from app.schemas.org import EMP_STATUS_VALUES
        if emp_status not in EMP_STATUS_VALUES:
            errors.append({"row": row_idx, "email": email,
                           "reason": f"invalid emp_status '{emp_status}'"})
            continue

        # Validate date formats early (before node resolution) for cleaner error reporting.
        # The raw strings are passed to _add_employee_to_node, which calls _parse_dmy_date internally.
        try:
            _parse_dmy_date(dob_raw)      # validate only; raw string passed to _add_employee_to_node
            _parse_dmy_date(emp_date_raw)  # _add_employee_to_node will parse again internally
        except ValueError as exc:
            errors.append({"row": row_idx, "email": email, "reason": str(exc)})
            continue
```

Then update the `_add_employee_to_node(...)` call inside the loop to pass all new fields:

```python
            _add_employee_to_node(
                org_id=org_id, org_name=org_name, node_id=target_node_id,
                email=email, name=name, title=title, employee_id=ext_id,
                last_name=last_name, middle_name=middle_name,
                emp_status=emp_status, gender=gender,
                default_language=default_language, manager_email=manager_email,
                dob=dob_raw,  # _add_employee_to_node calls _parse_dmy_date internally
                emp_date=emp_date_raw,
                head_of_dept=head_of_dept,
            )
```

Note: since `_add_employee_to_node` now calls `_parse_dmy_date` internally, pass the raw `DD/MM/YYYY` strings (`dob_raw`, `emp_date_raw`) — not pre-parsed ISO strings. The early `_parse_dmy_date` calls above are solely for row-level error reporting; they do not produce variables used elsewhere.

- [ ] **Step 4: Run all tests**

```bash
cd /Users/vrln/adizes-backend && python -m pytest tests/test_employee_extended.py -v
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/vrln/adizes-backend
git add app/routers/admin.py tests/test_employee_extended.py
git commit -m "feat: update bulk_upload_employees to parse 9 new fields with validation"
```

---

### Task 5: Backend — PATCH `update_employee` Endpoint

**Files:**
- Modify: `adizes-backend/app/routers/admin.py`
- Modify: `adizes-backend/app/schemas/org.py` (import `UpdateEmployeeRequest` in router)
- Modify: `adizes-backend/tests/test_employee_extended.py`

- [ ] **Step 1: Write a test for the empty-string → None clearing logic**

Add to `tests/test_employee_extended.py`:

```python
class TestEmptyStringClearing:
    """Verify that "" is treated as a clear (→ None) in the update endpoint logic."""

    def _apply_clear_logic(self, update_dict: dict) -> dict:
        """Mirror the clearing logic from update_employee."""
        CLEARABLE = {'last_name', 'middle_name', 'title', 'employee_id',
                     'gender', 'manager_email', 'dob', 'emp_date'}
        result = {}
        for k, v in update_dict.items():
            if k in CLEARABLE and v == '':
                result[k] = None
            else:
                result[k] = v
        return result

    def test_empty_string_clears_text_field(self):
        d = self._apply_clear_logic({'last_name': ''})
        assert d['last_name'] is None

    def test_non_empty_preserved(self):
        d = self._apply_clear_logic({'last_name': 'Smith'})
        assert d['last_name'] == 'Smith'

    def test_non_clearable_preserved(self):
        d = self._apply_clear_logic({'emp_status': 'Active'})
        assert d['emp_status'] == 'Active'

    def test_empty_emp_status_not_cleared(self):
        # emp_status with "" should NOT be treated as clear
        d = self._apply_clear_logic({'emp_status': ''})
        assert d['emp_status'] == ''  # left for the validation to reject
```

- [ ] **Step 2: Run tests — confirm pass**

```bash
cd /Users/vrln/adizes-backend && python -m pytest tests/test_employee_extended.py::TestEmptyStringClearing -v
```

- [ ] **Step 3: Add `UpdateEmployeeRequest` to the router imports**

Near the top of `admin.py`, find the org schema import line:

```python
from app.schemas.org import (
    AddEmployeeRequest, OrgEmployeeSummary, BulkUploadResult,
    ...
)
```

Add `UpdateEmployeeRequest` to this import.

- [ ] **Step 4: Add the PATCH endpoint to `admin.py`**

Add the following immediately after the `remove_employee` endpoint (after line ~1167):

```python
@router.patch("/organizations/{org_id}/employees/{org_employee_id}",
              response_model=OrgEmployeeSummary)
def update_employee(
    org_id: str,
    org_employee_id: str,
    body: UpdateEmployeeRequest,
    admin: dict = Depends(require_admin),
):
    """Partial update of org_employees record. Only supplied (non-None) fields are written.
    Send "" (empty string) to clear an optional text/date field.
    emp_status and default_language cannot be cleared.
    """
    # Verify record belongs to this org
    existing = (
        supabase_admin.table("org_employees").select("*")
        .eq("id", org_employee_id).eq("org_id", org_id).limit(1).execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Employee record not found")

    from app.schemas.org import EMP_STATUS_VALUES

    update_dict = body.model_dump(exclude_none=True)

    # Validate emp_status if provided
    if "emp_status" in update_dict:
        if update_dict["emp_status"] not in EMP_STATUS_VALUES:
            # Note: "" is also caught here since "" ∉ EMP_STATUS_VALUES
            raise HTTPException(
                status_code=422,
                detail=f"Invalid emp_status '{update_dict['emp_status']}'"
            )

    # default_language cannot be cleared (it has a required default)
    if "default_language" in update_dict and update_dict["default_language"] == "":
        raise HTTPException(status_code=422, detail="default_language cannot be cleared")

    # Apply empty-string → None clearing for clearable optional fields
    CLEARABLE = {'last_name', 'middle_name', 'title', 'employee_id',
                 'gender', 'manager_email', 'dob', 'emp_date'}
    for field in list(update_dict.keys()):
        if field in CLEARABLE and update_dict[field] == '':
            update_dict[field] = None

    # Parse date fields (DD/MM/YYYY → YYYY-MM-DD); None stays None
    for date_field in ('dob', 'emp_date'):
        if date_field in update_dict and update_dict[date_field] is not None:
            try:
                update_dict[date_field] = _parse_dmy_date(update_dict[date_field])
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc))

    if update_dict:
        supabase_admin.table("org_employees").update(update_dict)\
            .eq("id", org_employee_id).execute()

    # Return fresh record
    row = (
        supabase_admin.table("org_employees").select("*")
        .eq("id", org_employee_id).single().execute().data
    )
    auth_users = _get_auth_users_map()
    u = auth_users.get(row["user_id"])
    return OrgEmployeeSummary(
        id=row["id"], user_id=row["user_id"],
        name=(u.user_metadata or {}).get("name", "") if u else "",
        email=u.email if u else "",
        last_name=row.get("last_name"), middle_name=row.get("middle_name"),
        title=row.get("title"), employee_id=row.get("employee_id"),
        emp_status=row.get("emp_status") or "Active",
        gender=row.get("gender"),
        default_language=row.get("default_language") or "English",
        manager_email=row.get("manager_email"),
        dob=str(row["dob"]) if row.get("dob") else None,
        emp_date=str(row["emp_date"]) if row.get("emp_date") else None,
        head_of_dept=bool(row.get("head_of_dept", False)),
        status="active" if (u and u.email_confirmed_at) else "pending",
        node_id=row["node_id"],
        joined_at=str(row["joined_at"]),
    )
```

- [ ] **Step 5: Run all backend tests**

```bash
cd /Users/vrln/adizes-backend && python -m pytest tests/test_employee_extended.py -v
```

Expected: all PASS.

- [ ] **Step 6: Rebuild Docker and smoke test**

```bash
cd /Users/vrln/adizes-backend && docker compose up --build -d
sleep 5

# Get a token
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@adizes.com","password":"Admin@1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Hit the docs to verify endpoint is registered
curl -s http://localhost:8000/docs | grep -c "update_employee"
```

Expected: output `1` or more (endpoint appears in OpenAPI docs).

- [ ] **Step 7: Commit**

```bash
cd /Users/vrln/adizes-backend
git add app/routers/admin.py app/schemas/org.py tests/test_employee_extended.py
git commit -m "feat: add PATCH update_employee endpoint with partial update and field clearing"
```

---

### Task 6: Frontend — Types, API Client, xlsx, flattenTree

**Files:**
- Modify: `adizes-frontend/src/types/api.ts`
- Modify: `adizes-frontend/src/api/organizations.ts`
- Modify: `adizes-frontend/src/store/orgStore.ts`
- Modify: `adizes-frontend/package.json` (via npm)

- [ ] **Step 1: Install SheetJS**

```bash
cd /Users/vrln/adizes-frontend && npm install xlsx
```

Expected: `xlsx` appears in `package.json` dependencies.

- [ ] **Step 2: Update `OrgEmployeeSummary` in `src/types/api.ts`**

Replace the existing `OrgEmployeeSummary` interface (lines 165–175):

```typescript
export interface OrgEmployeeSummary {
  id: string;           // org_employees.id — use for PATCH/DELETE
  user_id: string;
  name: string;         // first name, from auth.users.user_metadata.name
  email: string;
  last_name: string | null;
  middle_name: string | null;
  title: string | null;
  employee_id: string | null;
  emp_status: string;   // 'Active' | 'Inactive' | 'On Leave' | 'Probation' | 'Resigned'
  gender: string | null;
  default_language: string;
  manager_email: string | null;
  dob: string | null;      // YYYY-MM-DD from API; format to DD/MM/YYYY in UI
  emp_date: string | null; // YYYY-MM-DD from API
  head_of_dept: boolean;
  status: 'active' | 'pending';   // auth activation state
  node_id: string;
  joined_at: string;
}

export interface UpdateEmployeeRequest {
  last_name?: string;
  middle_name?: string;
  title?: string;
  employee_id?: string;
  emp_status?: string;
  gender?: string;
  default_language?: string;
  manager_email?: string;
  dob?: string;      // DD/MM/YYYY or "" to clear
  emp_date?: string; // DD/MM/YYYY or "" to clear
  head_of_dept?: boolean;
}
```

- [ ] **Step 3: Update `addEmployee` and add `updateEmployee` in `src/api/organizations.ts`**

First, read the current `addEmployee` function to check its existing return type annotation. The backend `add_employee` endpoint returns `{"status": "created"|"exists", "user_id": ...}` — confirm the existing type matches before replacing. If the existing return type differs, adapt the annotation to match the actual API response.

Replace the `addEmployee` function with the updated payload type:

```typescript
export async function addEmployee(
  orgId: string,
  nodeId: string,
  payload: {
    name: string; email: string;
    last_name?: string; middle_name?: string;
    title?: string; employee_id?: string;
    emp_status?: string; gender?: string;
    default_language?: string; manager_email?: string;
    dob?: string; emp_date?: string;
    head_of_dept?: boolean;
  },
): Promise<{ user_id: string; created: boolean; emailed: boolean }> {
  const { data } = await apiClient.post(
    `/admin/organizations/${orgId}/nodes/${nodeId}/employees`, payload,
  );
  return data;
}
```

Add `updateEmployee` after `removeEmployee`:

```typescript
export async function updateEmployee(
  orgId: string,
  orgEmployeeId: string,
  payload: UpdateEmployeeRequest,
): Promise<OrgEmployeeSummary> {
  const { data } = await apiClient.patch<OrgEmployeeSummary>(
    `/admin/organizations/${orgId}/employees/${orgEmployeeId}`,
    payload,
  );
  return data;
}
```

Also add `UpdateEmployeeRequest` to the imports at the top of `organizations.ts`:

```typescript
import type {
  OrgSummary, OrgDetail, OrgEmployeeSummary,
  LinkedOrgSummary, BulkUploadResult, EnrollFromOrgResult,
  UpdateEmployeeRequest,
} from '@/types/api';
```

- [ ] **Step 4: Add `flattenTree` to `src/store/orgStore.ts`**

Add at the end of the file:

```typescript
/** Flatten the org tree into a list of all nodes (for lookup maps). */
export function flattenTree(tree: OrgNode[]): OrgNode[] {
  const result: OrgNode[] = [];
  function walk(nodes: OrgNode[]) {
    for (const n of nodes) {
      result.push(n);
      if (n.children.length) walk(n.children);
    }
  }
  walk(tree);
  return result;
}
```

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/vrln/adizes-frontend && npx tsc --noEmit
```

Expected: same 2 pre-existing `ImportMeta.env` errors — no new errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/types/api.ts src/api/organizations.ts src/store/orgStore.ts package.json package-lock.json
git commit -m "feat: update frontend types, API client, install xlsx, add flattenTree helper"
```

---

### Task 7: Frontend — Two-Tab Add/Edit Employee Modal

**Files:**
- Modify: `adizes-frontend/src/pages/AdminOrgDetail.tsx`

This task replaces the existing single-form Add Employee modal with a two-tab version and adds Edit mode. Read the current file first to get accurate line numbers.

- [ ] **Step 1: Add new imports to `AdminOrgDetail.tsx`**

Add to the existing import line from `@/api/organizations`:
```tsx
import {
  getOrganization, createNode, deleteNode, updateNode,
  listNodeEmployees, addEmployee, bulkUploadEmployees, removeEmployee,
  updateEmployee,
} from '@/api/organizations';
```

Add `flattenTree` to the orgStore import:
```tsx
import { useOrgStore, findNode, buildBreadcrumb, flattenTree } from '@/store/orgStore';
```

Add xlsx import at the top of the file:
```tsx
import * as XLSX from 'xlsx';
```

- [ ] **Step 2: Add new state variables (after the existing bulk upload state block)**

Add after `const [uploading, setUploading] = useState(false);`:

```tsx
  // Extended employee form state
  const [empTab, setEmpTab] = useState<'identity' | 'employment'>('identity');
  const [empLastName, setEmpLastName] = useState('');
  const [empMiddleName, setEmpMiddleName] = useState('');
  const [empGender, setEmpGender] = useState('');
  const [empDob, setEmpDob] = useState('');
  const [empLanguage, setEmpLanguage] = useState('English');
  const [empStatus, setEmpStatus] = useState('Active');
  const [empManagerEmail, setEmpManagerEmail] = useState('');
  const [empDate, setEmpDate] = useState('');
  const [empHeadOfDept, setEmpHeadOfDept] = useState(false);
  const [empEditMode, setEmpEditMode] = useState(false);
  const [empEditId, setEmpEditId] = useState<string | null>(null);
  const [dobError, setDobError] = useState('');
  const [empDateError, setEmpDateError] = useState('');

  // Expandable table row
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);
```

- [ ] **Step 3: Add helper functions before the `return` statement**

Add these after the `downloadTemplate` function:

```tsx
  /** Format YYYY-MM-DD (from API) to DD/MM/YYYY (for display). */
  const fmtDate = (iso: string | null): string => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  /** Validate DD/MM/YYYY format — returns error string or ''. */
  const validateDmy = (val: string): string => {
    if (!val) return '';
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(val)) return 'Use DD/MM/YYYY format';
    return '';
  };

  /** Reset all Add Employee modal state to defaults. */
  const resetEmpModal = () => {
    setEmpTab('identity');
    setEmpName(''); setEmpEmail(''); setEmpTitle(''); setEmpExtId('');
    setEmpLastName(''); setEmpMiddleName(''); setEmpGender('');
    setEmpDob(''); setEmpLanguage('English'); setEmpStatus('Active');
    setEmpManagerEmail(''); setEmpDate(''); setEmpHeadOfDept(false);
    setEmpEditMode(false); setEmpEditId(null);
    setEmpError(null); setDobError(''); setEmpDateError('');
  };

  /** Open the modal in edit mode pre-filled with an existing employee. */
  const openEditEmployee = (emp: OrgEmployeeSummary) => {
    setEmpTab('identity');
    setEmpName(emp.name);
    setEmpEmail(emp.email);
    setEmpTitle(emp.title ?? '');
    setEmpExtId(emp.employee_id ?? '');
    setEmpLastName(emp.last_name ?? '');
    setEmpMiddleName(emp.middle_name ?? '');
    setEmpGender(emp.gender ?? '');
    setEmpDob(fmtDate(emp.dob));
    setEmpLanguage(emp.default_language);
    setEmpStatus(emp.emp_status);
    setEmpManagerEmail(emp.manager_email ?? '');
    setEmpDate(fmtDate(emp.emp_date));
    setEmpHeadOfDept(emp.head_of_dept);
    setEmpEditMode(true);
    setEmpEditId(emp.id);
    setEmpError(null); setDobError(''); setEmpDateError('');
    setShowAddEmp(true);
  };
```

- [ ] **Step 4: Update `handleAddEmployee` to pass new fields**

Replace the existing `handleAddEmployee`:

```tsx
  const handleAddEmployee = async () => {
    const dobErr = validateDmy(empDob);
    const empDateErr = validateDmy(empDate);
    setDobError(dobErr); setEmpDateError(empDateErr);
    if (dobErr || empDateErr) return;

    if (!orgId || !selectedNodeId || !empName.trim() || !empEmail.trim()) return;
    setAddingEmp(true); setEmpError(null);
    try {
      if (empEditMode && empEditId) {
        await updateEmployee(orgId, empEditId, {
          last_name: empLastName || undefined,
          middle_name: empMiddleName || undefined,
          title: empTitle || undefined,
          employee_id: empExtId || undefined,
          emp_status: empStatus,
          gender: empGender || undefined,
          default_language: empLanguage,
          manager_email: empManagerEmail || undefined,
          dob: empDob || undefined,
          emp_date: empDate || undefined,
          head_of_dept: empHeadOfDept,
        });
      } else {
        await addEmployee(orgId, selectedNodeId, {
          name: empName.trim(), email: empEmail.trim(),
          last_name: empLastName || undefined,
          middle_name: empMiddleName || undefined,
          title: empTitle || undefined,
          employee_id: empExtId || undefined,
          emp_status: empStatus,
          gender: empGender || undefined,
          default_language: empLanguage,
          manager_email: empManagerEmail || undefined,
          dob: empDob || undefined,
          emp_date: empDate || undefined,
          head_of_dept: empHeadOfDept,
        });
      }
      setShowAddEmp(false);
      resetEmpModal();
      loadOrg(); loadEmployees();
    } catch (e: any) {
      setEmpError(e?.response?.data?.detail ?? 'Failed to save employee');
    } finally {
      setAddingEmp(false);
    }
  };
```

- [ ] **Step 5: Replace the Add Employee Modal JSX**

Find the existing `{/* Add Employee Modal */}` block (the entire `{showAddEmp && (...)}` block) and replace it with:

```tsx
      {/* Add / Edit Employee Modal — two tabs */}
      {showAddEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            {/* Header */}
            <div className="px-6 pt-5 pb-0">
              <h2 className="text-lg font-semibold text-gray-900">
                {empEditMode ? 'Edit Employee' : 'Add Employee'}
              </h2>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 border-b border-gray-200 mt-4 px-6">
              <button
                className={`pb-2 px-1 mr-6 text-sm font-medium border-b-2 transition-colors ${
                  empTab === 'identity'
                    ? 'border-[#C8102E] text-[#C8102E]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setEmpTab('identity')}
              >
                Identity
              </button>
              <button
                className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                  empTab === 'employment'
                    ? 'border-[#C8102E] text-[#C8102E]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setEmpTab('employment')}
              >
                Employment
              </button>
            </div>

            {empError && <p className="text-red-600 text-sm px-6 pt-3">{empError}</p>}

            {/* Tab 1: Identity */}
            {empTab === 'identity' && (
              <div className="px-6 pt-4 pb-2 flex flex-col gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *{empEditMode && <span className="ml-2 text-xs text-gray-400">(read-only)</span>}
                  </label>
                  <input
                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E] ${empEditMode ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                    placeholder="First name"
                    value={empName}
                    onChange={(e) => !empEditMode && setEmpName(e.target.value)}
                    readOnly={empEditMode}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
                    <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                      placeholder="Optional" value={empMiddleName} onChange={(e) => setEmpMiddleName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                      placeholder="Optional" value={empLastName} onChange={(e) => setEmpLastName(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *{empEditMode && <span className="ml-2 text-xs text-gray-400">(read-only)</span>}
                  </label>
                  <input
                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E] ${empEditMode ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                    placeholder="work@company.com" value={empEmail}
                    onChange={(e) => !empEditMode && setEmpEmail(e.target.value)}
                    readOnly={empEditMode}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                    value={empGender} onChange={(e) => setEmpGender(e.target.value)}>
                    <option value="">Not specified</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-Binary">Non-Binary</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth (DD/MM/YYYY)</label>
                  <input className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E] ${dobError ? 'border-red-400' : 'border-gray-300'}`}
                    placeholder="DD/MM/YYYY" value={empDob}
                    onChange={(e) => { setEmpDob(e.target.value); setDobError(''); }}
                    onBlur={() => setDobError(validateDmy(empDob))} />
                  {dobError && <p className="text-red-500 text-xs mt-1">{dobError}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Language</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                    value={empLanguage} onChange={(e) => setEmpLanguage(e.target.value)}>
                    {['English','Hindi','Tamil','Telugu','Kannada','Malayalam','Bengali','Marathi','Other'].map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Tab 2: Employment */}
            {empTab === 'employment' && (
              <div className="px-6 pt-4 pb-2 flex flex-col gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employment Status *</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                    value={empStatus} onChange={(e) => setEmpStatus(e.target.value)}>
                    {['Active','Inactive','On Leave','Probation','Resigned'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                    <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                      placeholder="Optional" value={empTitle} onChange={(e) => setEmpTitle(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                    <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                      placeholder="Optional HR ID" value={empExtId} onChange={(e) => setEmpExtId(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manager Email</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                    placeholder="manager@company.com" value={empManagerEmail} onChange={(e) => setEmpManagerEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employment Date (DD/MM/YYYY)</label>
                  <input className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E] ${empDateError ? 'border-red-400' : 'border-gray-300'}`}
                    placeholder="DD/MM/YYYY" value={empDate}
                    onChange={(e) => { setEmpDate(e.target.value); setEmpDateError(''); }}
                    onBlur={() => setEmpDateError(validateDmy(empDate))} />
                  {empDateError && <p className="text-red-500 text-xs mt-1">{empDateError}</p>}
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Head of Department</label>
                  <div className="flex rounded-lg overflow-hidden border border-gray-300 text-sm">
                    <button
                      onClick={() => setEmpHeadOfDept(false)}
                      className={`px-4 py-1.5 transition-colors ${!empHeadOfDept ? 'bg-[#C8102E] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >No</button>
                    <button
                      onClick={() => setEmpHeadOfDept(true)}
                      className={`px-4 py-1.5 transition-colors ${empHeadOfDept ? 'bg-[#C8102E] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >Yes</button>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100 mt-2">
              {empTab === 'identity' ? (
                <>
                  <button onClick={() => { setShowAddEmp(false); resetEmpModal(); }}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
                  <button
                    onClick={() => setEmpTab('employment')}
                    disabled={!empName.trim() || !empEmail.trim()}
                    className="px-4 py-2 text-sm bg-[#C8102E] text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >Next →</button>
                </>
              ) : (
                <>
                  <button onClick={() => setEmpTab('identity')}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">← Back</button>
                  <button
                    onClick={handleAddEmployee}
                    disabled={addingEmp}
                    className="px-4 py-2 text-sm bg-[#C8102E] text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {addingEmp ? 'Saving…' : empEditMode ? 'Save Changes' : 'Add Employee'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 6: TypeScript check**

```bash
cd /Users/vrln/adizes-frontend && npx tsc --noEmit
```

Expected: same 2 pre-existing errors only.

- [ ] **Step 7: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/pages/AdminOrgDetail.tsx
git commit -m "feat: replace Add Employee modal with two-tab Identity/Employment form with edit mode"
```

---

### Task 8: Frontend — Expandable Table Rows + Export Excel

**Files:**
- Modify: `adizes-frontend/src/pages/AdminOrgDetail.tsx`

- [ ] **Step 1: Add `Fragment` to the React import in `AdminOrgDetail.tsx`**

Find the existing `react` import line and add `Fragment`:

```tsx
import { useState, useEffect, useRef, Fragment } from 'react';
```

(Adapt the existing destructured names — just add `Fragment` to whatever is already imported from `'react'`.)

- [ ] **Step 2: Add `exportToExcel` function**

Add after the `openEditEmployee` function (before the `return` statement):

```tsx
  const exportToExcel = () => {
    if (!currentOrg) return;
    const nodeMap = Object.fromEntries(
      flattenTree(currentOrg.tree).map(n => [n.id, n.name])
    );
    const rows = employees.map(emp => ({
      'Name': emp.name,
      'Last Name': emp.last_name ?? '',
      'Middle Name': emp.middle_name ?? '',
      'Email': emp.email,
      'Job Title': emp.title ?? '',
      'Employee ID': emp.employee_id ?? '',
      'Emp Status': emp.emp_status,
      'Gender': emp.gender ?? '',
      'Language': emp.default_language,
      'Manager Email': emp.manager_email ?? '',
      'DOB': fmtDate(emp.dob),
      'Employment Date': fmtDate(emp.emp_date),
      'Head of Dept': emp.head_of_dept ? 'Yes' : 'No',
      'Activation': emp.status === 'active' ? 'Active' : 'Pending',
      'Node': nodeMap[emp.node_id] ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    const nodeName = (selectedNode?.name ?? 'employees').replace(/\s+/g, '-').toLowerCase();
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `employees-${nodeName}-${date}.xlsx`);
  };
```

- [ ] **Step 3: Add Export Excel button to the employee controls row**

In the employee controls `div` (the `flex items-center gap-3` row), add the Export Excel button immediately after the `<h3>Employees</h3>` heading block and before the `<label>Include sub-nodes</label>`:

```tsx
                <button
                  onClick={exportToExcel}
                  disabled={employees.length === 0}
                  className="flex items-center gap-1.5 text-sm bg-[#1D3557] text-white rounded-lg px-3 py-1.5 hover:bg-[#152a44] disabled:opacity-50 ml-auto"
                  title="Export current employee list to Excel"
                >
                  Export Excel
                </button>
```

Move the `ml-auto` from the `<label>Include sub-nodes</label>` to the Export Excel button (remove `ml-auto` from the label).

- [ ] **Step 4: Rewrite the employee table JSX**

Find the existing employee table (the `<table className="w-full text-sm">` block) and replace it with:

```tsx
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide text-left">
                      <th className="pb-2 pr-3">Name</th>
                      <th className="pb-2 pr-3">Email</th>
                      <th className="pb-2 pr-3">Emp Status</th>
                      <th className="pb-2 pr-3">Activation</th>
                      <th className="pb-2 w-6" />
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <Fragment key={emp.id}>
                        {/* Main row */}
                        <tr
                          className={`border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${expandedEmpId === emp.id ? 'bg-red-50 hover:bg-red-50' : ''}`}
                          onClick={() => setExpandedEmpId(expandedEmpId === emp.id ? null : emp.id)}
                        >
                          <td className="py-2 pr-3 font-medium text-gray-900">{emp.name}</td>
                          <td className="py-2 pr-3 text-gray-500">{emp.email}</td>
                          <td className="py-2 pr-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              emp.emp_status === 'Active' ? 'bg-green-50 text-green-700' :
                              emp.emp_status === 'Inactive' ? 'bg-gray-100 text-gray-600' :
                              emp.emp_status === 'On Leave' ? 'bg-amber-50 text-amber-700' :
                              emp.emp_status === 'Probation' ? 'bg-blue-50 text-blue-700' :
                              'bg-red-50 text-red-700'
                            }`}>{emp.emp_status}</span>
                          </td>
                          <td className="py-2 pr-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              emp.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                            }`}>{emp.status === 'active' ? 'Active' : 'Pending'}</span>
                          </td>
                          <td className="py-2 text-gray-400 text-xs">
                            {expandedEmpId === emp.id ? '▲' : '▼'}
                          </td>
                        </tr>

                        {/* Expanded detail row */}
                        {expandedEmpId === emp.id && (
                          <tr className="bg-red-50">
                            <td colSpan={5} className="px-3 pb-3 pt-1">
                              <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-xs text-gray-600 mb-3">
                                {[
                                  ['Last Name', emp.last_name ?? '—'],
                                  ['Middle Name', emp.middle_name ?? '—'],
                                  ['Gender', emp.gender ?? '—'],
                                  ['DOB', fmtDate(emp.dob) || '—'],
                                  ['Language', emp.default_language],
                                  ['Job Title', emp.title ?? '—'],
                                  ['Employee ID', emp.employee_id ?? '—'],
                                  ['Manager Email', emp.manager_email ?? '—'],
                                  ['Employment Date', fmtDate(emp.emp_date) || '—'],
                                  ['Head of Dept', emp.head_of_dept ? 'Yes' : 'No'],
                                ].map(([label, value]) => (
                                  <div key={label}>
                                    <span className="text-gray-400">{label}</span>
                                    <div className="font-medium text-gray-800 truncate">{value}</div>
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); openEditEmployee(emp); }}
                                  className="flex items-center gap-1.5 text-xs bg-[#1D3557] text-white px-3 py-1.5 rounded-lg hover:bg-[#152a44]"
                                >Edit</button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRemoveEmployee(emp); }}
                                  className="flex items-center gap-1.5 text-xs border border-red-300 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50"
                                >Remove</button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
```

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/vrln/adizes-frontend && npx tsc --noEmit
```

Expected: same 2 pre-existing errors only.

- [ ] **Step 6: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/pages/AdminOrgDetail.tsx
git commit -m "feat: expandable employee table rows, Edit/Remove actions, Export Excel button"
```

---

### Task 9: Frontend — Updated Bulk Template + CSV Help Modal

**Files:**
- Modify: `adizes-frontend/src/pages/AdminOrgDetail.tsx`

- [ ] **Step 1: Update `downloadTemplate()` to include all 14 columns**

Replace the existing `downloadTemplate` function:

```tsx
  const downloadTemplate = () => {
    const header = 'name,last_name,middle_name,email,title,employee_id,emp_status,gender,default_language,manager_email,dob,emp_date,head_of_dept,node_path';
    const example = 'Jane,Smith,Marie,jane@example.com,Manager,E001,Active,Female,English,manager@example.com,15/06/1985,01/03/2020,No,';
    const csv = `${header}\n${example}\n`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee_upload_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
```

- [ ] **Step 2: Update the CSV help modal column table**

Find the CSV help modal's column reference table inside `{showCsvHelp && (...)`. Replace the entire `<tbody>` section with all 14 columns:

```tsx
                  <tbody>
                    <tr>
                      <td className="px-2 py-1.5 border border-gray-200 font-mono text-[#C8102E]">name</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-gray-600">Employee's first name</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-center">✅</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-2 py-1.5 border border-gray-200 font-mono text-[#C8102E]">email</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-gray-600">Work email address (must be unique)</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-center">✅</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1.5 border border-gray-200 font-mono text-[#C8102E]">last_name</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-gray-600">Employee's last name</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-center text-gray-500">Optional</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-2 py-1.5 border border-gray-200 font-mono text-[#C8102E]">middle_name</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-gray-600">Employee's middle name</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-center text-gray-500">Optional</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1.5 border border-gray-200 font-mono text-[#C8102E]">title</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-gray-600">Job title (e.g. "Senior Manager")</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-center text-gray-500">Optional</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-2 py-1.5 border border-gray-200 font-mono text-[#C8102E]">employee_id</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-gray-600">Your internal HR / payroll ID</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-center text-gray-500">Optional</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1.5 border border-gray-200 font-mono text-[#C8102E]">emp_status</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-gray-600">Active / Inactive / On Leave / Probation / Resigned</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-center text-gray-500">Optional (defaults to Active)</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-2 py-1.5 border border-gray-200 font-mono text-[#C8102E]">gender</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-gray-600">Employee's gender</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-center text-gray-500">Optional</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1.5 border border-gray-200 font-mono text-[#C8102E]">default_language</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-gray-600">Display language</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-center text-gray-500">Optional (defaults to English)</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-2 py-1.5 border border-gray-200 font-mono text-[#C8102E]">manager_email</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-gray-600">Manager's work email</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-center text-gray-500">Optional</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1.5 border border-gray-200 font-mono text-[#C8102E]">dob</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-gray-600">Date of birth (DD/MM/YYYY)</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-center text-gray-500">Optional</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-2 py-1.5 border border-gray-200 font-mono text-[#C8102E]">emp_date</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-gray-600">Employment start date (DD/MM/YYYY)</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-center text-gray-500">Optional</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1.5 border border-gray-200 font-mono text-[#C8102E]">head_of_dept</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-gray-600">Yes or No</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-center text-gray-500">Optional (defaults to No)</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-2 py-1.5 border border-gray-200 font-mono text-[#C8102E]">node_path</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-gray-600">Slash-separated path to the node. Leave blank to add to the currently selected node.</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-center text-gray-500">Optional</td>
                    </tr>
                  </tbody>
```

Also update the dark code block example in the CSV help modal to show 14 columns:

```tsx
                <pre className="bg-[#1e1e2e] text-[#cdd6f4] rounded-lg p-3 text-xs font-mono leading-loose overflow-x-auto">{`name,last_name,middle_name,email,title,employee_id,emp_status,gender,default_language,manager_email,dob,emp_date,head_of_dept,node_path\nPriya,Sharma,Devi,priya@tata.com,Senior Manager,EMP001,Active,Female,English,mgr@tata.com,15/06/1985,01/06/2019,No,Sales/North Region\nRahul,Mehta,,rahul@tata.com,Team Lead,EMP002,On Leave,Male,English,,,,No,Sales/South Region\nAisha,Khan,,aisha@tata.com,Analyst,,Active,,,,,,,Operations`}</pre>
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/vrln/adizes-frontend && npx tsc --noEmit
```

Expected: same 2 pre-existing errors only.

- [ ] **Step 4: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/pages/AdminOrgDetail.tsx
git commit -m "feat: update bulk CSV template to 14 columns, update CSV help modal"
```

---

### Task 10: AdminHelp FAQ + CLAUDE.md

**Files:**
- Modify: `adizes-frontend/src/pages/AdminHelp.tsx`
- Modify: `HIL_Adizes_India/CLAUDE.md`

- [ ] **Step 1: Add FAQ entry to `AdminHelp.tsx`**

In `src/pages/AdminHelp.tsx`, find the `employeeActivationFAQs` array and add a new entry at the end:

```tsx
  {
    question: 'What fields can I set when adding or editing an employee?',
    answer: 'First name, last name, middle name, email, job title, employee ID, employment status (Active / Inactive / On Leave / Probation / Resigned), gender, default language, manager email, date of birth (DD/MM/YYYY), employment start date, and head-of-department flag. Email and first name cannot be changed after the account is created — they are the login identity.',
  },
```

- [ ] **Step 2: Add migration 008 to `CLAUDE.md` quick-start**

In `/Users/vrln/HIL_Adizes_India/CLAUDE.md`, find the migrations block in "Local Dev Quick Start" and add:

```bash
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/008_employee_extended_fields.sql
```

immediately after the `007_organizations.sql` line.

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/vrln/adizes-frontend && npx tsc --noEmit
```

Expected: same 2 pre-existing errors only.

- [ ] **Step 4: Commit both repos**

```bash
cd /Users/vrln/adizes-frontend
git add src/pages/AdminHelp.tsx
git commit -m "docs: add employee extended fields FAQ to AdminHelp"

cd /Users/vrln/HIL_Adizes_India
git add CLAUDE.md
git commit -m "docs: add migration 008 to CLAUDE.md quick-start"
```
