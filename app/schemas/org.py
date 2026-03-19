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
