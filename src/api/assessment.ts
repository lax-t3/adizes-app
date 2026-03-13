import { apiClient } from "./client";
import type { QuestionsResponse, SubmitResponse } from "@/types/api";

export async function getQuestions(): Promise<QuestionsResponse> {
  const { data } = await apiClient.get<QuestionsResponse>("/assessment/questions");
  return data;
}

export async function submitAssessment(
  cohort_id: string,
  answers: Array<{ question_index: number; ranks: Record<string, number> }>
): Promise<SubmitResponse> {
  const { data } = await apiClient.post<SubmitResponse>("/assessment/submit", {
    cohort_id,
    answers,
  });
  return data;
}
