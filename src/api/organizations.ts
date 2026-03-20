import { apiClient } from './client';
import type {
  OrgSummary, OrgDetail, OrgEmployeeSummary, UpdateEmployeeRequest,
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
