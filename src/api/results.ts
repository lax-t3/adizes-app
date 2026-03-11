import { apiClient } from "./client";
import type { ResultResponse, MyAssessmentItem } from "@/types/api";

export async function getResult(resultId: string): Promise<ResultResponse> {
  const { data } = await apiClient.get<ResultResponse>(`/results/${resultId}`);
  return data;
}

export async function getMyAssessments(): Promise<MyAssessmentItem[]> {
  const { data } = await apiClient.get<MyAssessmentItem[]>("/auth/my-assessments");
  return data;
}

export async function downloadPdf(resultId: string, userName: string): Promise<void> {
  const response = await apiClient.get(`/results/${resultId}/pdf`, {
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `PAEI_Report_${userName.replace(/\s+/g, "_")}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
