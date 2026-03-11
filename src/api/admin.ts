import { apiClient } from "./client";
import type { CohortSummary, CohortDetailResponse } from "@/types/api";

export async function getStats() {
  const { data } = await apiClient.get("/admin/stats");
  return data as {
    total_cohorts: number;
    total_assessments: number;
    completed_assessments: number;
    completion_pct: number;
    recent_completions: { user_id: string; user_name: string; completed_at: string }[];
  };
}

export async function listCohorts(): Promise<CohortSummary[]> {
  const { data } = await apiClient.get<CohortSummary[]>("/admin/cohorts");
  return data;
}

export async function createCohort(name: string, description?: string): Promise<CohortSummary> {
  const { data } = await apiClient.post<CohortSummary>("/admin/cohorts", { name, description });
  return data;
}

export async function getCohort(cohortId: string): Promise<CohortDetailResponse> {
  const { data } = await apiClient.get<CohortDetailResponse>(`/admin/cohorts/${cohortId}`);
  return data;
}

export async function enrollUser(cohortId: string, email: string) {
  const { data } = await apiClient.post(`/admin/cohorts/${cohortId}/members`, { email });
  return data;
}

export async function removeMember(cohortId: string, userId: string) {
  await apiClient.delete(`/admin/cohorts/${cohortId}/members/${userId}`);
}

export async function inviteAdmin(name: string, email: string, password: string) {
  const { data } = await apiClient.post("/admin/users/invite", { name, email, password });
  return data;
}

export async function getRespondent(userId: string) {
  const { data } = await apiClient.get(`/admin/respondents/${userId}`);
  return data;
}

export async function exportCohortCsv(cohortId: string, cohortName: string): Promise<void> {
  const response = await apiClient.get(`/admin/export/${cohortId}`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${cohortName.replace(/\s+/g, "_")}_export.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
