import { describe, expect, it } from 'vitest';
import { TENANT_STATUSES, confirmedTenantUpdate, rawTenantStatus, tenantEditForm, tenantEditPayload, validTenantStatus } from './tenantManagement';

const agency = (status: any) => ({ agency_id: 83, agency_name: 'Example Agency', poea_license_no: 'DEMO-LICENSE',
  agency_prefix: 'EX', workspace_code: 'example-agency', status });

describe('tenant update safety', () => {
  it('recognizes only the three supported statuses without inferring a default', () => {
    expect(TENANT_STATUSES).toEqual(['ACTIVE', 'SUSPENDED', 'CLOSED']);
    for (const value of TENANT_STATUSES) expect(validTenantStatus(` ${value.toLowerCase()} `)).toBe(value);
    for (const value of ['Pending Approval', 'inactive', 'closing', '', null, undefined]) expect(validTenantStatus(value)).toBe('');
    expect(rawTenantStatus({ status: 'CLOSED', workspace_status: 'Active' })).toBe('CLOSED');
  });
  it.each(['ACTIVE', 'SUSPENDED', 'CLOSED', 'LEGACY', null])('omits all status fields from a profile edit of %s', (status) => {
    const row = agency(status); const form = tenantEditForm(row); form.agency_name = 'Renamed Agency';
    expect(tenantEditPayload(row, form, false)).toEqual({ agency_name: 'Renamed Agency' });
    expect(tenantEditPayload(row, tenantEditForm(row), false)).toEqual({});
  });
  it('requires deliberate status editing, preserves mixed updates, and omits reverted changes', () => {
    const row = agency('CLOSED'); const form = { ...tenantEditForm(row), workspace_status: 'ACTIVE' as const, agency_name: 'Renamed Agency' };
    expect(tenantEditPayload(row, form, false)).toEqual({ agency_name: 'Renamed Agency' });
    expect(tenantEditPayload(row, form, true)).toEqual({ agency_name: 'Renamed Agency', workspace_status: 'ACTIVE', status: 'ACTIVE' });
    expect(tenantEditPayload(row, tenantEditForm(row), true)).toEqual({});
    expect(() => tenantEditPayload(agency('LEGACY'), tenantEditForm(agency('LEGACY')), true)).toThrow('deliberately');
  });
  it('normalizes legacy workspace display without writing it on an unrelated edit', () => {
    const row = { ...agency('CLOSED'), workspace_code: undefined, workspace_url: 'example-agency.flowsensus.com' };
    const form = tenantEditForm(row); expect(form.workspace_url).toBe('example-agency');
    expect(tenantEditPayload(row, { ...form, poea_license_no: 'NEW-LICENSE' }, false)).toEqual({ poea_license_no: 'NEW-LICENSE' });
    expect(tenantEditPayload(row, { ...form, workspace_url: 'new-code' }, false)).toEqual({ workspace_url: 'new-code', workspace_code: 'new-code' });
    expect(() => tenantEditPayload(row, { ...form, workspace_url: 'new-code.flowsensus.com' }, false)).toThrow('Workspace Code');
  });
  it('uses confirmed response status and rejects mismatched or unconfirmed responses', () => {
    expect(confirmedTenantUpdate({ agency_id: 83, workspace_status: 'CLOSED' }, 83, 'CLOSED')).toEqual({ agency_id: 83, workspace_status: 'CLOSED', status: 'CLOSED' });
    for (const data of [null, {}, { agency_id: 99, status: 'CLOSED' }, { agency_id: 83 }, { agency_id: 83, status: 'ACTIVE' }]) {
      expect(() => confirmedTenantUpdate(data, 83, 'CLOSED')).toThrow();
    }
  });
  it('preserves null or expired legacy expiry and color on unrelated edits', () => {
    for (const expiry of [null, '2020-01-01']) {
      const row = { ...agency('ACTIVE'), license_expiry_date: expiry, theme_color: null, logo_url: null };
      expect(tenantEditPayload(row, { ...tenantEditForm(row), agency_name: 'Renamed' }, false)).toEqual({ agency_name: 'Renamed' });
    }
  });
  it('validates deliberate expiry and theme edits while excluding logo_url', () => {
    const row = agency('ACTIVE');
    const draft = { ...tenantEditForm(row), license_expiry_date: '2099-12-31', theme_color: '#aabbcc', logo_url: 'https://untrusted.test/logo' };
    expect(tenantEditPayload(row, draft, false)).toEqual({ license_expiry_date: '2099-12-31', theme_color: '#AABBCC' });
    expect(() => tenantEditPayload(row, { ...draft, license_expiry_date: '2020-01-01' }, false)).toThrow('later than today');
    expect(() => tenantEditPayload(row, { ...draft, theme_color: 'red' }, false)).toThrow('six-digit');
    expect(() => confirmedTenantUpdate(row, 83, undefined, { license_expiry_date: '2099-12-31' })).toThrow();
    expect(() => confirmedTenantUpdate({ ...row, theme_color: '#112233' }, 83, undefined, { theme_color: '#AABBCC' })).toThrow();
  });
});
