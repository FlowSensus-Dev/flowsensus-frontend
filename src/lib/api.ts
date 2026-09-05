import axios, { InternalAxiosRequestConfig, AxiosResponse } from "axios";
import { supabase } from "./supabase";
import type {
  AgencyWorkspace,
  AgencyWorkspaceCreate,
  AgencyWorkspaceUpdate,
  Applicant,
  ApplicantCreate,
  ApplicantUpdate,
  Examination,
  ExaminationCreate,
  ExaminationUpdate,
} from "../types/database";
import type {
  OCRStatusResponse,
  OCRRawExtractResponse,
  OCRVerificationResponse,
} from "../types/ocr";

const fallbackApiUrl = "https://flowsensus-backend.onrender.com";

// ─── Key Mapping Overrides for Supabase Tables ───────────────────────────────
const CAMEL_TO_SNAKE_OVERRIDES: Record<string, string> = {
  dateOfBirth: "birth_date",
  licenseNo: "poea_license_no",
  poeaLicenseNo: "poea_license_no",
  agencyName: "agency_name",
  workspaceUrl: "workspace_url",
  workspaceStatus: "workspace_status",
  applicationStatus: "application_status",
  passportNumber: "passport_number",
  countryId: "country_id",
  employerId: "employer_id",
  applicantId: "applicant_id",
  agencyId: "agency_id",
  examId: "exam_id",
  examDate: "exam_date",
  iqScore: "iq_score",
  eqScore: "eq_score",
  skillsScore: "skills_score",
  interviewScore: "interview_score",
  overallScore: "overall_score",
  iqAptitude: "iq_score",
  personalityEQ: "eq_score",
  tradeSkills: "skills_score",
  englishProficiency: "interview_score",
};

const SNAKE_TO_CAMEL_OVERRIDES: Record<string, string[]> = {
  birth_date: ["birthDate", "dateOfBirth"],
  poea_license_no: ["poeaLicenseNo", "licenseNo"],
  agency_name: ["agencyName"],
  workspace_url: ["workspaceUrl"],
  workspace_status: ["workspaceStatus"],
  application_status: ["applicationStatus", "status"],
  passport_number: ["passportNumber"],
  country_id: ["countryId"],
  employer_id: ["employerId"],
  applicant_id: ["applicantId", "id"],
  agency_id: ["agencyId"],
  exam_id: ["examId"],
  exam_date: ["examDate"],
  iq_score: ["iqScore", "iqAptitude"],
  eq_score: ["eqScore", "personalityEQ"],
  skills_score: ["skillsScore", "tradeSkills"],
  interview_score: ["interviewScore", "englishProficiency"],
  overall_score: ["overallScore"],
};

export function toSnakeCase(key: string): string {
  if (CAMEL_TO_SNAKE_OVERRIDES[key]) {
    return CAMEL_TO_SNAKE_OVERRIDES[key];
  }
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function toCamelCase(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Recursively transforms an object's keys to snake_case for sending to the backend.
 */
export function keysToSnake(data: unknown): unknown {
  if (data === null || data === undefined || typeof data !== "object") {
    return data;
  }
  if (data instanceof FormData || data instanceof Blob || data instanceof Date) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => keysToSnake(item));
  }
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    result[toSnakeCase(k)] = keysToSnake(v);
  }
  return result;
}

/**
 * Recursively transforms incoming backend response data to camelCase,
 * while ALSO retaining the original snake_case keys so both conventions work!
 */
export function keysToCamel(data: unknown): unknown {
  if (data === null || data === undefined || typeof data !== "object") {
    return data;
  }
  if (data instanceof Blob || data instanceof Date) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => keysToCamel(item));
  }
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    const transformedValue = keysToCamel(v);
    // Keep original key (e.g. first_name, applicant_id)
    result[k] = transformedValue;
    // Add standard camelCase key (e.g. firstName, applicantId)
    const camel = toCamelCase(k);
    result[camel] = transformedValue;
    // Add known alias overrides (e.g. dateOfBirth, licenseNo)
    if (SNAKE_TO_CAMEL_OVERRIDES[k]) {
      for (const alias of SNAKE_TO_CAMEL_OVERRIDES[k]) {
        result[alias] = transformedValue;
      }
    }
  }
  return result;
}

// ─── Axios Instance ──────────────────────────────────────────────────────────
export const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || fallbackApiUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

// 🚀 Request Interceptor: Attach Supabase JWT + Auto-Convert Body to snake_case
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // 1. Attach Supabase token
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (!error && session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      }
    } catch (err) {
      console.error("Error attaching Supabase token:", err);
    }

    // 2. Auto-convert request payload to snake_case for Supabase/FastAPI
    if (config.data && !(config.data instanceof FormData)) {
      config.data = keysToSnake(config.data);
    }
    if (config.params) {
      config.params = keysToSnake(config.params);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// 🚀 Response Interceptor: Auto-Convert Body to camelCase (and preserve snake_case)
api.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data) {
      response.data = keysToCamel(response.data);
    }
    return response;
  },
  (error) => Promise.reject(error)
);

// ─── Typed API Service Methods (Direct Supabase Table Endpoints) ─────────────
export const apiService = {
  // Applicants (Supabase: applicant table)
  applicants: {
    list: () => api.get<Applicant[]>("/applicants"),
    get: (applicantId: number | string) => api.get<Applicant>(`/applicants/${applicantId}`),
    create: (data: ApplicantCreate) => api.post<Applicant>("/applicants", data),
    update: (applicantId: number | string, data: ApplicantUpdate) =>
      api.patch<Applicant>(`/applicants/${applicantId}`, data),
    delete: (applicantId: number | string) => api.delete(`/applicants/${applicantId}`),
  },

  // Agency Workspace (Supabase: agency_workspace table)
  agencyWorkspaces: {
    get: (agencyId: number | string) => api.get<AgencyWorkspace>(`/agency-workspaces/${agencyId}`),
    create: (data: AgencyWorkspaceCreate) => api.post<AgencyWorkspace>("/agency-workspaces", data),
    update: (agencyId: number | string, data: AgencyWorkspaceUpdate) =>
      api.patch<AgencyWorkspace>(`/agency-workspaces/${agencyId}`, data),
  },

  // Examinations (Supabase: examination table)
  examinations: {
    get: (examId: number | string) => api.get<Examination>(`/examinations/${examId}`),
    create: (data: ExaminationCreate) => api.post<Examination>("/examinations", data),
    listByApplicant: (applicantId: number | string) =>
      api.get<Examination[]>(`/examinations/applicant/${applicantId}`),
    update: (examId: number | string, data: ExaminationUpdate) =>
      api.patch<Examination>(`/examinations/${examId}`, data),
    delete: (examId: number | string) => api.delete(`/examinations/${examId}`),
  },

  // OCR & Document Verification
  ocr: {
    checkStatus: () => api.get<OCRStatusResponse>("/ocr/status"),
    extract: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.post<OCRRawExtractResponse>("/ocr/extract", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    verify: (applicantId: number | string, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.post<OCRVerificationResponse>(`/ocr/verify/${applicantId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
  },
};

export default api;
