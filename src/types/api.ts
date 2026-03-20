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
export interface CohortAssessmentHistory {
  cohort_id: string;
  cohort_name: string;
  enrolled_at: string | null;
  status: "pending" | "in_progress" | "completed" | "expired";
  result_id: string | null;
  completed_at: string | null;
  dominant_style: string | null;
}

// Alias for backwards compatibility — remove once Dashboard.tsx is updated in Task 11
export type MyAssessmentItem = CohortAssessmentHistory;

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

// ── Organisation types ────────────────────────────────────────

export interface OrgNode {
  id: string;
  org_id: string;
  parent_id: string | null;
  is_root: boolean;
  path: string;
  name: string;
  node_type: string | null;
  display_order: number;
  employee_count: number;
  children: OrgNode[];
}

export interface OrgSummary {
  id: string;
  name: string;
  description: string | null;
  node_count: number;
  employee_count: number;
  created_at: string;
}

export interface OrgDetail {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  linked_cohort_count: number;
  tree: OrgNode[];  // single root element
}

export interface OrgEmployeeSummary {
  id: string;           // org_employees.id — use for PATCH/DELETE
  user_id: string;
  name: string;         // first name, from auth.users.user_metadata.name
  email: string;
  last_name: string | null;
  middle_name: string | null;
  title: string | null;
  employee_id: string | null;
  emp_status: string;   // 'Active' | 'Inactive' | 'On Leave' | 'Probation' | 'Resigned'
  gender: string | null;
  default_language: string;
  manager_email: string | null;
  dob: string | null;      // YYYY-MM-DD from API; format to DD/MM/YYYY in UI
  emp_date: string | null; // YYYY-MM-DD from API
  head_of_dept: boolean;
  status: 'active' | 'pending';   // auth activation state
  node_id: string;
  joined_at: string;
}

export interface UpdateEmployeeRequest {
  last_name?: string;
  middle_name?: string;
  title?: string;
  employee_id?: string;
  emp_status?: string;
  gender?: string;
  default_language?: string;
  manager_email?: string;
  dob?: string;      // DD/MM/YYYY or "" to clear
  emp_date?: string; // DD/MM/YYYY or "" to clear
  head_of_dept?: boolean;
}

export interface LinkedOrgSummary {
  org_id: string;
  name: string;
  employee_count: number;
  linked_at: string;
}

export interface BulkUploadResult {
  created: number;
  skipped: number;
  errors: { row: number; email: string; reason: string }[];
}

export interface EnrollFromOrgResult {
  enrolled: number;
  skipped: number;
}
