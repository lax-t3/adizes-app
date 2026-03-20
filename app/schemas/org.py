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
