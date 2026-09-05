/**
 * Supabase Database Schemas & Types
 * Exact 1:1 mapping with tables in Supabase:
 * - agency_workspace
 * - applicant
 * - examination
 */

// ─── agency_workspace Table ──────────────────────────────────────────────────
export interface AgencyWorkspace {
  agency_id: number;
  agency_name: string;
  poea_license_no?: string | null;
  workspace_url?: string | null;
  workspace_status?: 'Pending Approval' | 'Active' | 'Suspended' | string;
  created_at?: string;
}

export type AgencyWorkspaceCreate = {
  agency_name: string;
  poea_license_no?: string | null;
  workspace_url?: string | null;
  workspace_status?: string;
};

export type AgencyWorkspaceUpdate = Partial<AgencyWorkspaceCreate>;

// ─── applicant Table ──────────────────────────────────────────────────────────
export interface Applicant {
  applicant_id: number;
  agency_id: number;
  first_name: string;
  last_name: string;
  birth_date?: string | null;
  application_status?: 'Pending' | 'Screening' | 'Profiling' | 'Endorsed' | 'Deployed' | string;
  passport_number?: string | null;
  country_id?: number | null;
  employer_id?: number | null;
  is_deleted?: boolean;
}

export type ApplicantCreate = {
  first_name: string;
  last_name: string;
  birth_date?: string | null;
  application_status?: string;
  passport_number?: string | null;
  country_id?: number | null;
  employer_id?: number | null;
  password_hash?: string | null;
};

export type ApplicantUpdate = Partial<ApplicantCreate>;

// ─── examination Table ────────────────────────────────────────────────────────
export interface Examination {
  exam_id: number;
  applicant_id: number;
  iq_score?: number | null;
  eq_score?: number | null;
  skills_score?: number | null;
  interview_score?: number | null;
  overall_score?: number | null;
  exam_date?: string | null;
}

export type ExaminationCreate = {
  applicant_id: number;
  iq_score?: number | null;
  eq_score?: number | null;
  skills_score?: number | null;
  interview_score?: number | null;
  overall_score?: number | null;
  exam_date?: string | null;
};

export type ExaminationUpdate = Partial<Omit<ExaminationCreate, 'applicant_id'>>;
