import { apiClient } from "./client";

export interface CoachingLeadInput {
  name: string;
  email: string;
  phone?: string;
  organization?: string;
  message?: string;
}

export interface CoachingLead {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  organization?: string | null;
  message?: string | null;
  source: string;
  actioned: boolean;
  actioned_at?: string | null;
  created_at: string;
}

/** Public — submit the "Schedule a Conversation" lead form (no auth). */
export async function submitCoachingLead(input: CoachingLeadInput): Promise<void> {
  await apiClient.post("/coaching/leads", input);
}

/** Admin — list leads, optionally filtered by search query. */
export async function listCoachingLeads(q = ""): Promise<CoachingLead[]> {
  const { data } = await apiClient.get<CoachingLead[]>("/admin/coaching-leads", {
    params: q ? { q } : {},
  });
  return data;
}

/** Admin — single lead detail. */
export async function getCoachingLead(id: string): Promise<CoachingLead> {
  const { data } = await apiClient.get<CoachingLead>(`/admin/coaching-leads/${id}`);
  return data;
}

/** Admin — mark a lead actioned / yet-to-action. */
export async function updateLeadActioned(id: string, actioned: boolean): Promise<void> {
  await apiClient.patch(`/admin/coaching-leads/${id}`, { actioned });
}

/** Admin — download all leads as an .xlsx (auth-aware blob download). */
export async function downloadCoachingLeadsExport(): Promise<void> {
  const res = await apiClient.get("/admin/coaching-leads/export", { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = "coaching_leads.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
