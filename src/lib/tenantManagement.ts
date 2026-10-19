export const TENANT_STATUSES = ['ACTIVE', 'SUSPENDED', 'CLOSED'] as const;
export type TenantStatus = typeof TENANT_STATUSES[number];

export function validTenantStatus(raw: unknown): TenantStatus | '' {
  const value = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  return TENANT_STATUSES.includes(value as TenantStatus) ? value as TenantStatus : '';
}

export function rawTenantStatus(agency: any): string {
  const raw = agency.status ?? agency.workspace_status;
  return typeof raw === 'string' ? raw : '';
}

export function tenantEditForm(agency: any) {
  return {
    agency_name: agency.agency_name || '',
    poea_license_no: agency.poea_license_no || '',
    agency_prefix: agency.agency_prefix || '',
    workspace_url: String(agency.workspace_code ?? agency.workspace_url ?? '').trim().toLowerCase().replace(/\.flowsensus\.com$/, ''),
    workspace_status: validTenantStatus(rawTenantStatus(agency)),
  };
}

export function tenantEditPayload(agency: any, form: ReturnType<typeof tenantEditForm>, statusEdited: boolean) {
  const initial = tenantEditForm(agency);
  const payload: Record<string, string> = {};
  for (const field of ['agency_name', 'poea_license_no'] as const) {
    const value = form[field].trim();
    if (value !== initial[field].trim()) {
      if (!value || /[\x00-\x1f\x7f]/.test(value)) throw new Error('Enter a valid agency name and license number.');
      payload[field] = value;
    }
  }
  const prefix = form.agency_prefix.trim().toUpperCase();
  if (prefix && prefix !== initial.agency_prefix.trim().toUpperCase()) payload.agency_prefix = prefix;
  const workspace = form.workspace_url.trim().toLowerCase();
  if (workspace !== initial.workspace_url) {
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(workspace)) throw new Error('Use a Workspace Code of 1–63 lowercase letters, digits, or hyphens, starting and ending with a letter or digit.');
    payload.workspace_url = workspace;
    payload.workspace_code = workspace;
  }
  if (statusEdited) {
    const status = validTenantStatus(form.workspace_status);
    if (!status) throw new Error('Select Active, Suspended, or Closed to deliberately change status.');
    if (status !== initial.workspace_status) {
      payload.workspace_status = status;
      payload.status = status;
    }
  }
  return payload;
}

class UnconfirmedTenantUpdate extends Error {}

export function confirmedTenantUpdate(data: any, agencyId: number, expectedStatus?: string) {
  if (!data || data.agency_id !== agencyId ||
    (typeof data.status !== 'string' && typeof data.workspace_status !== 'string') ||
    (expectedStatus && validTenantStatus(rawTenantStatus(data)) !== expectedStatus)) {
    throw new UnconfirmedTenantUpdate();
  }
  // Synchronize display aliases from the returned record, never from the requested status.
  const rawStatus = rawTenantStatus(data);
  return { ...data, status: rawStatus, workspace_status: rawStatus };
}

export function tenantUpdateError(error: any): string {
  if (error instanceof UnconfirmedTenantUpdate) return 'The agency update could not be confirmed. Refresh agency records before retrying.';
  switch (error?.response?.status) {
    case 401: return 'Your session has expired. Sign in again before updating the agency.';
    case 403: return 'The backend denied this agency update. Status changes require verified platform Super Admin privileges.';
    case 422: return 'The backend rejected the update. Status must be Active, Suspended, or Closed. Check any edited profile fields as well.';
    case 409: return 'An agency profile value conflicts with an existing record. Check the license number and Workspace Code.';
    case 404: return 'The agency could not be found. Refresh agency records.';
    default: return 'Unable to confirm the agency update. Check your connection and refresh agency records before retrying.';
  }
}
