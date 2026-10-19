import { isAxiosError } from 'axios';

export const SHARED_PORTAL = 'https://flowsensus.app';
const workspacePattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && !/[\x00-\x1f\x7f]/.test(value);

export interface OnboardingForm {
  agencyName: string;
  licenseNo: string;
  gmName: string;
  email: string;
  slug: string;
}

export function suggestWorkspaceCode(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 63).replace(/^-+|-+$/g, '');
}

export function provisioningPayload(form: OnboardingForm) {
  const payload = {
    agencyName: form.agencyName.trim(), poeaLicenseNo: form.licenseNo.trim(),
    workspaceUrl: form.slug.trim().toLowerCase(), workspaceStatus: 'ACTIVE',
    adminFullName: form.gmName.trim(), adminEmail: form.email.trim().toLowerCase(),
  };
  if (![payload.agencyName, payload.poeaLicenseNo, payload.adminFullName, payload.adminEmail, payload.workspaceUrl].every(text)) {
    throw new Error('Complete all required fields without control characters.');
  }
  if ([payload.agencyName, payload.poeaLicenseNo, payload.adminFullName].some((value) => value.length > 255)) {
    throw new Error('Agency name, license number, and initial Manager name must each be at most 255 characters.');
  }
  if (!workspacePattern.test(payload.workspaceUrl)) throw new Error('Use a Workspace Code of 1–63 lowercase letters, digits, or hyphens, starting and ending with a letter or digit.');
  const email = payload.adminEmail;
  const emailPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
  const [local, domain] = email.split('@');
  if (email.length > 254 || !emailPattern.test(email) || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..') || domain.split('.').some((label) => label.length > 63)) {
    throw new Error('Enter a valid Initial Manager email address.');
  }
  return payload;
}

export interface ProvisionedAgency {
  agencyName: string;
  workspaceCode: string;
  email: string;
  temporaryPassword: string;
  mustChangePassword: true;
}

export class UnconfirmedProvisioning extends Error {
  constructor(readonly reference?: string) { super('Provisioning response could not be confirmed.'); }
}

const recoveryReference = (detail: unknown): string | undefined => typeof detail === 'string' ? detail.match(/\bReference: ([a-f0-9]{32})\b/i)?.[1] : undefined;

export function recoveryHeader(headers: any): string | undefined {
  const value = typeof headers?.get === 'function' ? headers.get('x-provisioning-recovery-required') :
    headers?.['x-provisioning-recovery-required'] ?? headers?.['X-Provisioning-Recovery-Required'];
  return typeof value === 'string' ? value.trim().toLowerCase() : undefined;
}

export function confirmedProvisioning(response: { data: any; status: number; headers?: any }, payload: ReturnType<typeof provisioningPayload>): ProvisionedAgency {
  const { agency, admin } = response.data ?? {};
  if (![200, 201].includes(response.status) || recoveryHeader(response.headers) === 'true' ||
    !Number.isSafeInteger(agency?.agency_id) || agency.agency_id <= 0 ||
    !text(agency?.agency_name) || agency.status !== 'ACTIVE' ||
    typeof agency.workspace_code !== 'string' || !workspacePattern.test(agency.workspace_code) || agency.workspace_code !== payload.workspaceUrl ||
    !text(admin?.email) || admin.email.toLowerCase() !== payload.adminEmail ||
    !text(admin?.temporary_password) || admin.temporary_password.length < 8 || admin.temporary_password.length > 128 ||
    admin?.must_change_password !== true) throw new UnconfirmedProvisioning(recoveryReference(response.data?.detail));
  return { agencyName: agency.agency_name, workspaceCode: agency.workspace_code,
    email: admin.email, temporaryPassword: admin.temporary_password, mustChangePassword: true };
}

export interface ProvisioningIssue { message: string; uncertain: boolean; reference?: string }

export function provisioningFailure(error: unknown): ProvisioningIssue {
  const response = isAxiosError(error) ? error.response : undefined;
  const status = response?.status;
  const detail = typeof response?.data?.detail === 'string' ? response.data.detail : '';
  // Only the backend's generated opaque reference is shown; never render arbitrary server details.
  const reference = error instanceof UnconfirmedProvisioning ? error.reference : recoveryReference(detail);
  const header = recoveryHeader(response?.headers);
  const uncertain: ProvisioningIssue = { uncertain: true, reference,
    message: 'The provisioning result could not be confirmed. Verify agency/account records before retrying.' };
  if (header === 'true' || /records may remain|operator reconciliation is required/i.test(detail)) return uncertain;
  if (error instanceof UnconfirmedProvisioning) return uncertain;
  if (!status) {
    const timedOut = isAxiosError(error) && ['ECONNABORTED', 'ETIMEDOUT'].includes(error.code ?? '');
    return { ...uncertain, message: `${timedOut ? 'The request timed out. ' : 'The backend could not be reached or its response was lost. '}${uncertain.message}` };
  }
  if (status === 401) return { message: 'Your session has expired. Sign in again as an authorized Super Admin.', uncertain: false };
  if (status === 403) return { message: 'Only an authorized Super Admin can provision agencies.', uncertain: false };
  if (status === 409) return { message: 'Workspace Code, POEA/DMW license, or Initial Manager email conflicts with an existing record. Review existing agency/account records and correct the conflicting value.', uncertain: false, reference };
  if (status === 422) return { message: 'The backend rejected the onboarding details. Check required fields, the Workspace Code format, and Initial Manager email.', uncertain: false };
  if (status === 503 && /No provisioning writes were attempted\.|^Administrative account provisioning is unavailable\.$|^Exactly one existing Management role is required for provisioning\.$/.test(detail)) {
    return { message: 'Provisioning is unavailable before record creation. Ask the backend operator to check service availability and Management role configuration.', uncertain: false };
  }
  if (header === 'false' && /Provisioning failed; known created records were removed\./.test(detail)) {
    return { message: 'Provisioning failed. The backend reports that known created records were removed. Review the failure with the backend operator before another attempt.', uncertain: false, reference };
  }
  return uncertain;
}
