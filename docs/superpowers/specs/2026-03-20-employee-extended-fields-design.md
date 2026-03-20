# Employee Extended Fields — Design Spec

**Date:** 2026-03-20
**Status:** Approved

## Problem

The current employee record holds only 4 fields (name, email, job title, employee ID). Admins need a richer HR profile per employee: name parts, gender, DOB, employment date, status, manager, language, and head-of-department flag. The employee table and bulk upload must reflect all fields, and admins need to be able to edit existing records and export the employee list to Excel.

---

## Scope

| Area | Change |
|------|--------|
| Backend | Migration 008: 9 new columns on `org_employees` |
| Backend | Updated schemas, add/list/bulk endpoints, new PATCH endpoint |
| Frontend | Two-tab Add Employee modal |
| Frontend | Expandable-row employee table |
| Frontend | Edit employee (pre-filled two-tab modal, PATCH) |
| Frontend | Export Excel button (SheetJS, client-side) |
| Frontend | Updated bulk upload CSV template (14 columns) |
| Frontend | Updated CSV help modal and Admin Help FAQ |

No changes to authentication flow, cohort logic, or org tree.

---

## Section 1: Data Model

### Migration 008 — `008_employee_extended_fields.sql`

Add 9 columns to `org_employees`:

```sql
ALTER TABLE org_employees
  ADD COLUMN last_name       text,
  ADD COLUMN middle_name     text,
  ADD COLUMN gender          text,
  ADD COLUMN default_language text NOT NULL DEFAULT 'English',
  ADD COLUMN manager_email   text,
  ADD COLUMN dob             date,
  ADD COLUMN emp_date        date,
  ADD COLUMN head_of_dept    boolean NOT NULL DEFAULT false,
  ADD COLUMN emp_status      text NOT NULL DEFAULT 'Active'
    CHECK (emp_status IN ('Active','Inactive','On Leave','Probation','Resigned'));
```

Existing rows gain `emp_status = 'Active'`, `default_language = 'English'`, `head_of_dept = false` via defaults. All other new columns are NULL for existing rows.

**Date storage:** ISO `YYYY-MM-DD`. The UI accepts and displays `DD/MM/YYYY`; conversion happens at the API layer (backend parses `DD/MM/YYYY` → `YYYY-MM-DD` on write, frontend formats `YYYY-MM-DD` → `DD/MM/YYYY` on display).

**Name field semantics:** The existing `name` field in `auth.users.user_metadata` is now semantically "first name". `last_name` and `middle_name` are separate columns in `org_employees`. First name and email are set at account creation and cannot be changed through the employee edit flow; corrections require direct Supabase admin intervention.

**`manager_email`** is stored as free text with no referential check — the referenced manager does not need to exist in the system. Referential validation is deferred to a future iteration.

**Migration note:** This migration must be applied to both `migrations/008_employee_extended_fields.sql` (plain SQL for Docker local dev) and a corresponding timestamped file in `supabase/migrations/` (e.g., `20260320000008_employee_extended_fields.sql`) for Supabase CLI compatibility.

---

## Section 2: Backend API

### 2a. Schemas (`app/schemas/org.py`)

**`AddEmployeeRequest`** — add 9 new fields:

```python
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
```

**`UpdateEmployeeRequest`** — new schema for PATCH (all optional; email and name are read-only — they belong to `auth.users`):

```python
class UpdateEmployeeRequest(BaseModel):
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    title: Optional[str] = None
    employee_id: Optional[str] = None
    emp_status: Optional[str] = None
    gender: Optional[str] = None
    default_language: Optional[str] = None
    manager_email: Optional[EmailStr] = None
    dob: Optional[str] = None       # DD/MM/YYYY
    emp_date: Optional[str] = None  # DD/MM/YYYY
    head_of_dept: Optional[bool] = None
```

**`OrgEmployeeSummary`** — add all 9 new fields (all Optional except `emp_status`):

```python
class OrgEmployeeSummary(BaseModel):
    id: str
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
    status: str                     # 'active' | 'pending' (auth activation)
    node_id: str
    joined_at: str
```

**`BulkEmployeeRow`** — add all 9 new fields:

```python
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

### 2b. Endpoint changes (`app/routers/admin.py`)

**`_add_employee_to_node`** — accept and pass all 9 new fields to the `INSERT`. Parse `dob` and `emp_date` from `DD/MM/YYYY` to `YYYY-MM-DD` if provided; raise `400` if format is invalid. Validate `emp_status` against the allowed set.

**`list_node_employees`** — read all new columns from `org_employees` rows and populate `OrgEmployeeSummary`.

**`bulk_upload_employees`** — parse 9 new columns from CSV headers. Parsing rules:
- `name`: required; blank → row error
- `emp_status`: blank → `'Active'`; invalid value → row error
- `head_of_dept`: `yes`/`true`/`1` (case-insensitive) → `True`; anything else → `False`
- `default_language`: blank → `'English'`
- `dob` / `emp_date`: must be `DD/MM/YYYY` if provided; invalid format → row error

**New endpoint — `PATCH /organizations/{org_id}/employees/{org_employee_id}`:**

```python
@router.patch("/organizations/{org_id}/employees/{org_employee_id}")
def update_employee(org_id: str, org_employee_id: str, body: UpdateEmployeeRequest,
                    admin: dict = Depends(require_admin)):
```

- Verifies `org_employees.id = org_employee_id` and `org_id` match (returns 404 if not)
- Builds update dict using `body.model_dump(exclude_none=True)` — only fields explicitly sent are updated
- To **clear** an optional string or date field, send `""` (empty string) — the backend maps `""` → `None` before the DB update. `emp_status` and `default_language` cannot be cleared (they have required defaults; empty string is treated as invalid and returns 422).
- Validates `emp_status` against the allowed set if provided
- Parses date fields from `DD/MM/YYYY` to `YYYY-MM-DD` if provided; `""` → `None` (clear)
- Returns updated `OrgEmployeeSummary`

---

## Section 3: Frontend — Types and API Client

### `src/types/api.ts`

Update `OrgEmployeeSummary` to include all 9 new fields matching the backend schema.

Add `UpdateEmployeeRequest` type (all fields optional).

### `src/api/organizations.ts`

Update `addEmployee(orgId, nodeId, body)` — `body` now includes all new fields.

Add `updateEmployee(orgId, orgEmployeeId, body: UpdateEmployeeRequest)`:
```typescript
export async function updateEmployee(orgId: string, orgEmployeeId: string, body: UpdateEmployeeRequest) {
  const { data } = await apiClient.patch(`/organizations/${orgId}/employees/${orgEmployeeId}`, body);
  return data;
}
```

---

## Section 4: Frontend — Add Employee Modal (Two-Tab)

All changes in `src/pages/AdminOrgDetail.tsx`.

### New state

```tsx
// Tab state
const [empTab, setEmpTab] = useState<'identity' | 'employment'>('identity');

// New identity fields
const [empLastName, setEmpLastName] = useState('');
const [empMiddleName, setEmpMiddleName] = useState('');
const [empGender, setEmpGender] = useState('');
const [empDob, setEmpDob] = useState('');
const [empLanguage, setEmpLanguage] = useState('English');

// New employment fields
const [empStatus, setEmpStatus] = useState('Active');
const [empManagerEmail, setEmpManagerEmail] = useState('');
const [empDate, setEmpDate] = useState('');
const [empHeadOfDept, setEmpHeadOfDept] = useState(false);
```

### Tab 1 — Identity

Fields (in order):
1. First Name `*` — full width
2. Middle Name / Last Name — side-by-side (`grid-cols-2`)
3. Email `*` — full width
4. Gender — full-width select, options: Male, Female, Non-Binary, Prefer not to say (blank = not specified)
5. DOB (DD/MM/YYYY) — full-width text input with placeholder `DD/MM/YYYY`; regex-validated on blur: `/^\d{2}\/\d{2}\/\d{4}$/`
6. Default Language — full-width select, options: English, Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Other

"Next →" button — disabled until First Name and Email are non-empty.

### Tab 2 — Employment

Fields (in order):
1. Emp Status `*` — full-width select (Active / Inactive / On Leave / Probation / Resigned), default Active
2. Job Title / Employee ID — side-by-side
3. Manager Email — full width
4. Employment Date (DD/MM/YYYY) — full-width text input with placeholder `DD/MM/YYYY`; same regex validation as DOB
5. Head of Department — toggle row: label + Yes/No segmented control

"← Back" button (left) + "Add Employee" button (right, `bg-[#C8102E]`).

### Edit mode

The same modal is reused for editing. Trigger: "Edit" button inside an expanded employee row.

Edit mode differences:
- Modal title changes to "Edit Employee"
- All fields pre-populated from the selected `OrgEmployeeSummary`
- Email and First Name fields are `readOnly` with `bg-gray-50 cursor-not-allowed` styling + "(read-only)" label hint
- "Add Employee" button replaced with "Save Changes"
- On submit calls `updateEmployee(orgId, emp.id, payload)` instead of `addEmployee`

A new state boolean `empEditMode` (and `empEditId` for the record ID) controls which path is taken on submit.

### Reset on close

All new fields reset to defaults on modal close/cancel: `empLastName('')`, `empMiddleName('')`, `empGender('')`, `empDob('')`, `empLanguage('English')`, `empStatus('Active')`, `empManagerEmail('')`, `empDate('')`, `empHeadOfDept(false)`, `empTab('identity')`, `empEditMode(false)`, `empEditId(null)`.

---

## Section 5: Frontend — Employee Table (Expandable Rows)

All changes in `src/pages/AdminOrgDetail.tsx`.

### New state

```tsx
const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);
```

Clicking a row toggles `expandedEmpId` to that employee's `id` (or back to `null` if already expanded — one row expanded at a time).

### Table columns (default view)

| Column | Notes |
|--------|-------|
| Name | `emp.name` (first name from auth) |
| Email | `emp.email` |
| Emp Status | Coloured badge: Active=green, Inactive=gray, On Leave=amber, Probation=blue, Resigned=red |
| Activation | Active/Pending badge (existing auth status) |
| `▼` / `▲` | Expand chevron, right-aligned |

### Expanded row detail grid

Rendered as a `<tr>` spanning all columns immediately after the row, visible only when `expandedEmpId === emp.id`. Layout: 3-column grid.

Fields shown: Last Name, Middle Name, Gender, DOB (formatted `DD/MM/YYYY`), Language, Job Title, Employee ID, Manager Email, Employment Date (formatted `DD/MM/YYYY`), Head of Dept (Yes/No).

**Action buttons inside expanded row:**
- **Edit** (`bg-[#1D3557] text-white`) — sets `empEditMode(true)`, `empEditId(emp.id)`, pre-fills all form state from `emp`, opens modal
- **Remove** (red ghost, existing behaviour)

---

## Section 6: Excel Export

### Library

Add `xlsx` (SheetJS) to frontend dependencies: `npm install xlsx`.

### Button placement

"Export Excel" button (`bg-[#1D3557] text-white`) placed in the employee controls row, to the left of the existing "Template" download button.

### Export logic

```typescript
import * as XLSX from 'xlsx';

// Build a lookup map from node ID → node name using the org tree already in memory
// (flattenTree is a helper that traverses currentOrg.tree recursively)
const nodeMap = Object.fromEntries(flattenTree(currentOrg.tree).map(n => [n.id, n.name]));

const exportToExcel = () => {
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
    'DOB': emp.dob ? formatDate(emp.dob) : '',       // YYYY-MM-DD → DD/MM/YYYY
    'Employment Date': emp.emp_date ? formatDate(emp.emp_date) : '',
    'Head of Dept': emp.head_of_dept ? 'Yes' : 'No',
    'Activation': emp.status === 'active' ? 'Active' : 'Pending',
    'Node': nodeMap[emp.node_id] ?? '',   // resolves actual node per employee row
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Employees');
  const nodeName = (selectedNode?.name ?? 'employees').replace(/\s+/g, '-').toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `employees-${nodeName}-${date}.xlsx`);
};
```

Scope: whatever `employees` state currently holds (already filtered by node + include_descendants toggle). No additional API call needed.

---

## Section 7: Bulk Upload Template + CSV Help Modal

### Updated `downloadTemplate()`

New CSV template header (14 columns):
```
name,last_name,middle_name,email,title,employee_id,emp_status,gender,default_language,manager_email,dob,emp_date,head_of_dept,node_path
```

Example row:
```
Jane Smith,Smith,Marie,jane@example.com,Manager,E001,Active,Female,English,manager@example.com,15/06/1985,01/03/2020,No,
```

### Updated CSV help modal

The column reference table in `showCsvHelp` modal is updated to list all 14 columns with descriptions. New rows added after `employee_id`:

| Column | Description | Required? |
|--------|-------------|-----------|
| `emp_status` | Active / Inactive / On Leave / Probation / Resigned | Optional (defaults to Active) |
| `gender` | Employee's gender | Optional |
| `default_language` | Display language | Optional (defaults to English) |
| `manager_email` | Manager's work email | Optional |
| `dob` | Date of birth (DD/MM/YYYY) | Optional |
| `emp_date` | Employment start date (DD/MM/YYYY) | Optional |
| `head_of_dept` | Yes or No | Optional (defaults to No) |
| `last_name` | Employee's last name | Optional |
| `middle_name` | Employee's middle name | Optional |

### Updated `AdminHelp.tsx`

The "Employee Activation & Password Reset" FAQ section already covers the invite flow. A new entry is added:

> **Q: What fields can I set when adding an employee?**
> A: Name (first), last name, middle name, email, job title, employee ID, employment status, gender, default language, manager's email, date of birth, employment start date, and head-of-department flag. Email and first name cannot be changed after creation (they are the account identity).

---

## Files Changed

| File | Change |
|------|--------|
| `adizes-backend/migrations/008_employee_extended_fields.sql` | New migration |
| `adizes-backend/app/schemas/org.py` | Add fields to `AddEmployeeRequest`, `OrgEmployeeSummary`, `BulkEmployeeRow`; add `UpdateEmployeeRequest` |
| `adizes-backend/app/routers/admin.py` | Update `_add_employee_to_node`, `list_node_employees`, `bulk_upload_employees`; add PATCH endpoint |
| `adizes-frontend/src/types/api.ts` | Update `OrgEmployeeSummary`, add `UpdateEmployeeRequest` |
| `adizes-frontend/src/api/organizations.ts` | Update `addEmployee`; add `updateEmployee` |
| `adizes-frontend/src/pages/AdminOrgDetail.tsx` | Two-tab modal; expandable table; edit mode; Export Excel button |
| `adizes-frontend/src/pages/AdminHelp.tsx` | Add FAQ entry for extended fields |
| `adizes-frontend/package.json` | Add `xlsx` dependency |
| `HIL_Adizes_India/CLAUDE.md` | Add migration 008 to quick-start section |

---

## What Is Not Changed

- Auth flow (invite/recovery email logic unchanged)
- Cohort enrolment logic
- Org tree structure
- The existing Bulk Upload file-picker modal
- The Org Structure help modal
