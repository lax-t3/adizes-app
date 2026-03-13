// ── Auth ──────────────────────────────────────────────────────────────────────
export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
  name: string;
  role: "user" | "admin";
}

// ── Assessment ────────────────────────────────────────────────────────────────
export interface Option {
  key: string;        // 'a' | 'b' | 'c' | 'd'
  text: string;
  paei_role: string;  // 'P' | 'A' | 'E' | 'I'
}

export interface Question {
  id: string;
  question_index: number;
  text: string;
  options: Option[];
}

export interface Section {
  name: string;    // 'is' | 'should' | 'want'
  label: string;   // 'Is' | 'Should' | 'Want'
  description: string;
  questions: Question[];
}

export interface QuestionsResponse {
  sections: Section[];
}

export interface SubmitResponse {
  result_id: string;
  message: string;
}

// ── Results ───────────────────────────────────────────────────────────────────
export interface ScoreSet {
  P: number;
  A: number;
  E: number;
  I: number;
}

export interface GapDetail {
  role: string;
  role_name: string;
  is_score: number;
  should_score: number;
  want_score: number;
  external_gap: number;
  internal_gap: number;
  external_severity: "aligned" | "watch" | "tension";
  internal_severity: "aligned" | "watch" | "tension";
  external_message: string;
  internal_message: string;
}

export interface Interpretation {
  dominant_roles: string[];
  style_label: string;
  style_tagline: string;
  strengths: string;
  blind_spots: string;
  working_with_others: string;
  combined_description: string | null;
  mismanagement_risks: string[];
}

export interface ResultResponse {
  result_id: string;
  user_name: string;
  completed_at: string;
  profile: { is: string; should: string; want: string };
  scaled_scores: { is: ScoreSet; should: ScoreSet; want: ScoreSet };
  gaps: GapDetail[];
  interpretation: Interpretation;
  pdf_url: string | null;
}

// ── My Assessments ────────────────────────────────────────────────────────────
export interface MyAssessmentItem {
  cohort_id: string;
  cohort_name: string;
  enrolled_at: string | null;
  status: "pending" | "completed" | "expired";
  result_id: string | null;
  completed_at: string | null;
  dominant_style: string | null;
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export interface CohortSummary {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  completed_count: number;
  completion_pct: number;
  created_at: string;
}

export interface RespondentSummary {
  user_id: string;
  name: string;
  email: string;
  status: "pending" | "in_progress" | "completed" | "expired";
  dominant_style: string | null;
  completed_at: string | null;
}

export interface TeamScores {
  average_scaled: { is: ScoreSet; should: ScoreSet; want: ScoreSet };
  style_distribution: { P: number; A: number; E: number; I: number };
}

export interface CohortDetailResponse {
  id: string;
  name: string;
  description: string | null;
  respondents: RespondentSummary[];
  team_scores: TeamScores | null;
}
