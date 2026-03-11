import { apiClient } from "./client";
import type { QuestionsResponse, SubmitResponse } from "@/types/api";

export async function getQuestions(): Promise<QuestionsResponse> {
  const { data } = await apiClient.get<QuestionsResponse>("/assessment/questions");
  return data;
}

export async function submitAssessment(
  answers: Array<{ question_index: number; option_key: string }>
): Promise<SubmitResponse> {
  const { data } = await apiClient.post<SubmitResponse>("/assessment/submit", { answers });
  return data;
}
