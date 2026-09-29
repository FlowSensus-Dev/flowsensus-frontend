import axios from 'axios';
import type { ApplicationForecastResponse } from './types';

export interface PortalProfile {
  applicant_id: number;
  agency_id: number;
  applicant_code: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  email: string | null;
  contact_number: string | null;
  photo_url: string | null;
}

export interface PortalApplication {
  application_id: number;
  applicant_id: number;
  job_order_id: number | null;
  job_order_code: string | null;
  job_order_name: string | null;
  applied_role: string | null;
  employer_id: number | null;
  country_id: number | null;
  current_phase: number | null;
  application_status: string | null;
  current_department: string | null;
  is_stopped: boolean | null;
  stopped_at: string | null;
  stopped_phase: number | null;
  created_at: string | null;
  updated_at: string | null;
  actual_deployment_at: string | null;
}

// Separate from the staff client: portal requests never use its dev-token fallback.
const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000',
});

export function portalGet<T>(path: string, token: string, signal: AbortSignal): Promise<T> {
  if (!token) return Promise.reject(new Error('Authenticated session required'));
  return client.get<T>(path, { signal, headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);
}

export const validId = (id: unknown): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0;

export function validateApplications(profile: PortalProfile, applications: PortalApplication[]) {
  if (!validId(profile.applicant_id) || !validId(profile.agency_id) || !Array.isArray(applications) ||
      applications.some(a => !validId(a.application_id) || a.applicant_id !== profile.applicant_id) ||
      new Set(applications.map(a => a.application_id)).size !== applications.length) {
    throw new Error('Invalid portal response');
  }
}

export function validateForecast(forecast: ApplicationForecastResponse, applicationId: number, profile: PortalProfile) {
  if (forecast.application_id !== applicationId || forecast.agency_id !== profile.agency_id ||
      (forecast.applicant_id != null && forecast.applicant_id !== profile.applicant_id) ||
      (forecast.record && (forecast.record.application_id !== applicationId || forecast.record.agency_id !== profile.agency_id ||
        (forecast.record.applicant_id != null && forecast.record.applicant_id !== profile.applicant_id)))) {
    throw new Error('Forecast identity mismatch');
  }
}

export async function loadPortal(token: string, signal: AbortSignal) {
  const [profile, applications] = await Promise.all([
    portalGet<PortalProfile>('/applicants/me', token, signal),
    portalGet<PortalApplication[]>('/applicants/me/applications', token, signal),
  ]);
  validateApplications(profile, applications);
  return { profile, applications };
}

export async function loadPortalForecast(applicationId: number, profile: PortalProfile, token: string, signal: AbortSignal) {
  if (!validId(applicationId)) throw new Error('Valid application identity required');
  const result = await portalGet<ApplicationForecastResponse>(`/forecasting/application/${applicationId}`, token, signal);
  validateForecast(result, applicationId, profile);
  return result;
}

export function portalError(error: unknown, forecast = false): string {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  if (status === 401) return 'Your session has expired. Sign out and sign in again.';
  if (status === 403) return forecast
    ? 'You do not have access to this application forecast.'
    : 'Applicant access is unavailable. Ask your agency to check your account link and access.';
  if (status === 404) return forecast ? 'This application forecast was not found.' : 'Applicant portal data was not found. Please contact your agency.';
  if (status === 409 && forecast) return 'A reliable forecast is not available for this application yet.';
  return forecast ? 'Unable to load the forecast. Please try again.' : 'Unable to load your profile and applications. Please try again.';
}

export function completedApplication(application: PortalApplication) {
  return Boolean(application.actual_deployment_at) || ['deployed', 'completed', 'contract completed', 'returned'].includes((application.application_status || '').trim().toLowerCase());
}
