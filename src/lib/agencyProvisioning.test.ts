import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import { confirmedProvisioning, provisioningFailure, provisioningPayload, recoveryHeader, suggestWorkspaceCode } from './agencyProvisioning';

const form = { agencyName: 'Example Agency', licenseNo: 'DEMO-LICENSE', gmName: 'Example Manager', email: 'manager@example.test', slug: 'agency2test' };
const response = () => ({ status: 200, headers: new AxiosHeaders({ 'cache-control': 'no-store' }),
  data: { agency: { agency_id: 83, agency_name: 'Example Agency', workspace_code: 'agency2test', status: 'ACTIVE' },
    admin: { email: 'manager@example.test', temporary_password: 'Mock-Only-Password-123!', must_change_password: true } } });
const failure = (status?: number, detail?: any, header?: string, code?: string) => new AxiosError('Do not display confidential internals', code, undefined, undefined,
  status ? { status, data: { detail }, headers: new AxiosHeaders(header ? { 'x-provisioning-recovery-required': header } : {}), statusText: '', config: {} as any } : undefined);

describe('agency provisioning contract (no live requests)', () => {
  it('suggests valid bare workspace codes at the backend length boundary', () => {
    expect(suggestWorkspaceCode(' Example Agency, Inc. ')).toBe('example-agency-inc');
    expect(suggestWorkspaceCode('A'.repeat(62) + ' !suffix')).toBe('a'.repeat(62));
    expect(suggestWorkspaceCode('A'.repeat(70))).toHaveLength(63);
    expect(suggestWorkspaceCode('')).toBe('');
  });
  it('keeps camelCase compatibility and submits no hostname, tenant ID, password, or role override', () => {
    expect(provisioningPayload({ ...form, slug: ' AGENCY2TEST ', email: ' MANAGER@example.test ' })).toEqual({
      agencyName: 'Example Agency', poeaLicenseNo: 'DEMO-LICENSE', workspaceUrl: 'agency2test', workspaceStatus: 'ACTIVE',
      adminFullName: 'Example Manager', adminEmail: 'manager@example.test',
    });
  });
  it.each(['agency2test', 'a', 'a--2', 'a'.repeat(63)])('accepts workspace code %s', (slug) => {
    expect(provisioningPayload({ ...form, slug }).workspaceUrl).toBe(slug);
  });
  it.each(['', '-agency', 'agency-', 'agency.test', 'agency_name', 'two words', 'a'.repeat(64)])('rejects invalid workspace code %s', (slug) => {
    expect(() => provisioningPayload({ ...form, slug })).toThrow();
  });
  it('validates required fields, control characters and Manager email', () => {
    expect(() => provisioningPayload({ ...form, gmName: '' })).toThrow('required');
    expect(() => provisioningPayload({ ...form, agencyName: 'Bad\nName' })).toThrow('control');
    expect(() => provisioningPayload({ ...form, email: 'bad..email@example.test' })).toThrow('Initial Manager email');
  });
  it('requires confirmed agency fields and credentials, including must-change-password', () => {
    expect(confirmedProvisioning(response(), provisioningPayload(form))).toEqual({
      agencyName: 'Example Agency', workspaceCode: 'agency2test', email: 'manager@example.test',
      temporaryPassword: 'Mock-Only-Password-123!', mustChangePassword: true,
    });
    for (const mutate of [
      (r: any) => { delete r.data.agency.workspace_code; },
      (r: any) => { r.data.agency.workspace_url = 'agency2test.flowsensus.com'; delete r.data.agency.workspace_code; },
      (r: any) => { r.data.agency.workspace_code = 'wrong-agency'; },
      (r: any) => { r.data.admin.email = 'someoneelse@example.test'; },
      (r: any) => { r.data.admin.must_change_password = false; },
      (r: any) => { delete r.data.admin.temporary_password; },
      (r: any) => { r.data.agency.agency_id = 0; },
      (r: any) => { r.status = 202; r.data = {}; },
      (r: any) => { r.status = 202; },
      (r: any) => { delete r.status; },
    ]) {
      const r = response(); mutate(r);
      expect(() => confirmedProvisioning(r, provisioningPayload(form))).toThrow();
    }
  });
  it.each([401, 403, 409, 422])('classifies expected HTTP %s without echoing raw details', (status) => {
    const issue = provisioningFailure(failure(status, 'Traceback: confidential backend internals'));
    expect(issue.uncertain).toBe(false); expect(issue.message).not.toContain('confidential');
    if (status === 409) expect(issue.message).toContain('conflicts');
    if (status === 422) expect(issue.message).toContain('backend rejected');
  });
  it.each(['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'])('treats timeout/network code %s as unconfirmed', (code) => {
    const issue = provisioningFailure(failure(undefined, undefined, undefined, code));
    expect(issue.uncertain).toBe(true); expect(issue.message).toContain('Verify agency/account records before retrying');
    if (code !== 'ERR_NETWORK') expect(issue.message).toContain('timed out');
  });
  it('handles recovery headers through AxiosHeaders or ordinary response headers', () => {
    expect(recoveryHeader(new AxiosHeaders({ 'X-Provisioning-Recovery-Required': 'true' }))).toBe('true');
    expect(recoveryHeader({ 'X-Provisioning-Recovery-Required': 'true' })).toBe('true');
    expect(provisioningFailure(failure(409, 'Conflict', 'true')).uncertain).toBe(true);
    const r = response(); r.headers.set('X-Provisioning-Recovery-Required', 'true');
    expect(() => confirmedProvisioning(r, provisioningPayload(form))).toThrow();
  });
  it('recognizes recovery details if CORS hides the header and displays only a validated reference', () => {
    const reference = '1234567890abcdef1234567890abcdef';
    const issue = provisioningFailure(failure(500, `Provisioning failed; records may remain. Operator reconciliation is required before retrying. Reference: ${reference}`));
    expect(issue.uncertain).toBe(true); expect(issue.reference).toBe(reference);
    expect(provisioningFailure(failure(500, 'Traceback\npassword: do-not-show Reference: not-a-safe-reference')).reference).toBeUndefined();
  });
  it('distinguishes explicit preflight failures and confirmed cleanup from unknown server failures', () => {
    expect(provisioningFailure(failure(503, 'Provisioning preflight is unavailable. No provisioning writes were attempted.')).uncertain).toBe(false);
    expect(provisioningFailure(failure(503, 'Administrative account provisioning is unavailable.')).uncertain).toBe(false);
    expect(provisioningFailure(failure(500, 'Provisioning failed; known created records were removed.', 'false')).uncertain).toBe(false);
    expect(provisioningFailure(failure(500, 'Unknown failure')).uncertain).toBe(true);
    expect(provisioningFailure(failure(503, 'Service unavailable')).uncertain).toBe(true);
  });
});
