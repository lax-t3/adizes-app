import { apiClient } from "./client";
import type { ResultResponse, CohortAssessmentHistory } from "@/types/api";

export async function getResult(resultId: string): Promise<ResultResponse> {
  const { data } = await apiClient.get<ResultResponse>(`/results/${resultId}`);
  return data;
}

export async function triggerGeneratePdf(resultId: string): Promise<{ status: string; pdf_url?: string }> {
  const { data } = await apiClient.post(`/results/${resultId}/generate-pdf`);
  return data;
}

export async function getMyAssessments(): Promise<CohortAssessmentHistory[]> {
  const { data } = await apiClient.get<CohortAssessmentHistory[]>("/auth/my-assessments");
  return data;
}
