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
