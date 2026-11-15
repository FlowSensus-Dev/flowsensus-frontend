import { isAxiosError } from 'axios';
import { normalizeThemeColor, validateAgencyLogo, validateLicenseExpiry } from './agencyBranding';

export const SHARED_PORTAL = 'https://flowsensus.app';
const workspacePattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && !/[\x00-\x1f\x7f]/.test(value);

export interface OnboardingForm {
  agencyName: string;
  licenseNo: string;
  licenseExpiryDate: string;
  themeColor?: string;
  gmName: string;
  email: string;
  slug: string;
}

export function suggestWorkspaceCode(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 63).replace(/^-+|-+$/g, '');
}

export function generateTemporaryPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  return 'Fs1!' + Array.from(bytes, (byte) => alphabet[byte & 63]).join('');
}

function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!text(normalized)) throw new Error(`${label} is required, without control characters.`);
  if (normalized.length > 255) throw new Error(`${label} must be at most 255 characters.`);
  return normalized;
}

function workspaceCode(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!workspacePattern.test(normalized)) throw new Error('Use a Workspace Code of 1–63 lowercase letters, digits, or hyphens, starting and ending with a letter or digit.');
  return normalized;
}

function managerEmail(value: string): string {
  const email = value.trim().toLowerCase();
  const emailPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
  const [local, domain] = email.split('@');
  if (!text(email) || email.length > 254 || !emailPattern.test(email) || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..') || domain.split('.').some((label) => label.length > 63)) {
    throw new Error('Enter a valid Initial Manager email address.');
  }
  return email;
}

export function provisioningPayload(form: OnboardingForm) {
  return { agency_name: requiredText(form.agencyName, 'Agency Name'), poea_license_no: requiredText(form.licenseNo, 'POEA / DMW License Number'),
    gm_name: requiredText(form.gmName, 'Initial Manager name'), workspace_code: workspaceCode(form.slug), gm_email: managerEmail(form.email),
    license_expiry_date: validateLicenseExpiry(form.licenseExpiryDate),
    theme_color: normalizeThemeColor(form.themeColor), temporary_password: generateTemporaryPassword() };
}

export type ReadinessStatus = 'Optional' | 'Incomplete' | 'Invalid' | 'Input complete' | 'Valid format' | 'Pending verification' | 'Confirmed';
export interface ReadinessField { status: ReadinessStatus; message: string }
export type ReadinessKey = keyof OnboardingForm | 'logo';

// Format checks share submit validators, but never generate credentials or perform requests.
export function evaluateOnboardingReadiness(form: OnboardingForm, options: {
  agencies?: readonly any[]; logo?: File | null; logoError?: string | null; now?: Date;
} = {}) {
  const check = (value: string | undefined, validate: () => unknown, message: string, missing: string, optional = false): ReadinessField => {
    try {
      validate();
      return { status: 'Valid format', message };
    } catch (error) {
      return { status: !optional && !value?.trim() ? 'Incomplete' : 'Invalid', message: !value?.trim() && !optional ? missing : (error as Error).message };
    }
  };
  const fields: Record<ReadinessKey, ReadinessField> = {
    agencyName: check(form.agencyName, () => requiredText(form.agencyName, 'Agency Name'), 'Business identity not verified.', 'Agency Name is required.'),
    licenseNo: check(form.licenseNo, () => requiredText(form.licenseNo, 'POEA / DMW License Number'), 'License authenticity not verified; backend checks uniqueness.', 'POEA / DMW License Number is required.'),
    licenseExpiryDate: check(form.licenseExpiryDate, () => validateLicenseExpiry(form.licenseExpiryDate, options.now), 'Future date in Asia/Manila.', 'Select a POEA / DMW License Expiry Date.'),
    gmName: check(form.gmName, () => requiredText(form.gmName, 'Initial Manager name'), 'Identity and authority not verified.', 'Initial Manager name is required.'),
    email: check(form.email, () => managerEmail(form.email), 'Inbox ownership not verified; backend checks account uniqueness.', 'Initial Manager Email is required.'),
    slug: check(form.slug, () => workspaceCode(form.slug), 'Backend checks uniqueness on submission.', 'Workspace Code is required.'),
    themeColor: check(form.themeColor, () => normalizeThemeColor(form.themeColor), 'Six-digit hex color; default available.', '', true),
    logo: { status: 'Optional', message: 'No logo selected.' },
  };
  if (fields.licenseNo.status === 'Valid format') fields.licenseNo.status = 'Input complete';
  if (options.logoError) fields.logo = { status: 'Invalid', message: options.logoError };
  else if (options.logo) fields.logo = check(options.logo.name, () => validateAgencyLogo(options.logo!), 'Selected locally; upload pending.', '', true);
  const loaded = options.agencies ?? [];
  if (fields.licenseNo.status === 'Input complete' && loaded.some((a) => typeof a.poea_license_no === 'string' && a.poea_license_no.trim().toUpperCase() === form.licenseNo.trim().toUpperCase())) {
    fields.licenseNo = { status: 'Invalid', message: 'License number matches a loaded agency. Review Tenant Management before provisioning.' };
  }
  if (fields.slug.status === 'Valid format' && loaded.some((a) => String(a.workspace_code ?? a.workspace_url ?? '').trim().toLowerCase().replace(/\.flowsensus\.com$/, '') === form.slug.trim().toLowerCase())) {
    fields.slug = { status: 'Invalid', message: 'Workspace Code matches a loaded agency. Review Tenant Management before provisioning.' };
  }
  const required = (['agencyName', 'licenseNo', 'licenseExpiryDate', 'gmName', 'email', 'slug'] as const).map((key) => fields[key]);
  const invalid = Object.values(fields).filter((field) => field.status === 'Invalid').length;
  const incomplete = required.filter((field) => field.status === 'Incomplete').length;
  return { fields, invalid, incomplete, ready: invalid === 0 && incomplete === 0,
    verification: { status: 'Pending verification', message: 'Backend checks uniqueness on submission. Business registration, Manager identity, authority, and inbox ownership are not verified here.' } as ReadinessField };
}

export interface ProvisionedAgency {
  agencyId: number;
  workspace: Record<string, any>;
  agencyName: string;
  workspaceCode: string;
  email: string;
  temporaryPassword: string;
  mustChangePassword: true;
  emailDispatched?: boolean;
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
  const { admin } = response.data ?? {};
  // Support the existing local response alias as well as the shared workspace contract.
  const agency = response.data?.workspace ?? response.data?.agency;
  if (![200, 201].includes(response.status) || recoveryHeader(response.headers) === 'true' ||
    !Number.isSafeInteger(agency?.agency_id) || agency.agency_id <= 0 ||
    !text(agency?.agency_name) || agency.status !== 'ACTIVE' ||
    typeof agency.workspace_code !== 'string' || !workspacePattern.test(agency.workspace_code) || agency.workspace_code !== payload.workspace_code ||
    !text(admin?.email) || admin.email.toLowerCase() !== payload.gm_email ||
    !text(admin?.temporary_password) || admin.temporary_password.length < 8 || admin.temporary_password.length > 128 ||
    admin?.must_change_password !== true) throw new UnconfirmedProvisioning(recoveryReference(response.data?.detail));
  const result: ProvisionedAgency = { agencyId: agency.agency_id, workspace: agency, agencyName: agency.agency_name, workspaceCode: agency.workspace_code,
    email: admin.email, temporaryPassword: admin.temporary_password, mustChangePassword: true };
  if (admin?.email_dispatched !== undefined) {
    result.emailDispatched = Boolean(admin.email_dispatched);
  }
  return result;
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
  if (status === 422) {
    const fields = Array.isArray(response?.data?.detail) ? response.data.detail.flatMap((issue: any) => Array.isArray(issue?.loc) ? issue.loc : []) : [];
    const hint = fields.includes('license_expiry_date') || /license_expiry_date|license expiry/i.test(detail)
      ? 'Select a valid license expiry date later than today in Asia/Manila.'
      : fields.includes('theme_color') || /theme_color/i.test(detail)
        ? 'Use a six-digit hex Agency Theme Color.'
        : 'Check required fields, the license expiry date, Agency Theme Color, Workspace Code format, and Initial Manager email.';
    return { message: `The backend rejected the onboarding details. ${hint}`, uncertain: false };
  }
  if (status === 503 && /No provisioning writes were attempted\.|^Administrative account provisioning is unavailable\.$|^Exactly one existing Management role is required for provisioning\.$/.test(detail)) {
    return { message: 'Provisioning is unavailable before record creation. Ask the backend operator to check service availability and Management role configuration.', uncertain: false };
  }
  if (header === 'false' && /Provisioning failed; known created records were removed\./.test(detail)) {
    return { message: 'Provisioning failed. The backend reports that known created records were removed. Review the failure with the backend operator before another attempt.', uncertain: false, reference };
  }
  return uncertain;
}
