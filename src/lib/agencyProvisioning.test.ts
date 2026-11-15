import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { confirmedProvisioning, evaluateOnboardingReadiness, provisioningFailure, provisioningPayload, recoveryHeader, suggestWorkspaceCode } from './agencyProvisioning';

const form = { agencyName: 'Example Agency', licenseNo: 'DEMO-LICENSE', licenseExpiryDate: '2099-12-31', gmName: 'Example Manager', email: 'manager@example.test', slug: 'agency2test' };
const response = () => ({ status: 200, headers: new AxiosHeaders({ 'cache-control': 'no-store' }),
  data: { agency: { agency_id: 83, agency_name: 'Example Agency', workspace_code: 'agency2test', status: 'ACTIVE' },
    admin: { email: 'manager@example.test', temporary_password: 'Mock-Only-Password-123!', must_change_password: true } } });
const failure = (status?: number, detail?: any, header?: string, code?: string) => new AxiosError('Do not display confidential internals', code, undefined, undefined,
  status ? { status, data: { detail }, headers: new AxiosHeaders(header ? { 'x-provisioning-recovery-required': header } : {}), statusText: '', config: {} as any } : undefined);

describe('honest onboarding readiness', () => {
  const now = new Date('2026-11-07T16:30:00Z');
  it('starts neutrally incomplete, accepts optional branding, and never generates passwords', () => {
    const random = vi.spyOn(crypto, 'getRandomValues');
    try {
      const result = evaluateOnboardingReadiness({ agencyName: '', licenseNo: '', licenseExpiryDate: '', gmName: '', email: '', slug: '' }, { now });
      expect(result).toMatchObject({ ready: false, incomplete: 6, invalid: 0 });
      expect(result.fields.logo).toEqual({ status: 'Optional', message: 'No logo selected.' });
      expect(result.fields.themeColor.status).toBe('Valid format');
      expect(random).not.toHaveBeenCalled();
    } finally { random.mockRestore(); }
  });
  it('reports format validity separately from unverified external facts', () => {
    const result = evaluateOnboardingReadiness(form, { now });
    expect(result).toMatchObject({ ready: true, incomplete: 0, invalid: 0 });
    expect(result.fields.agencyName.status).toBe('Valid format');
    expect(result.fields.agencyName.message).toContain('Business identity not verified');
    expect(result.fields.email.message).toContain('Inbox ownership not verified');
    expect(result.fields.gmName.message).toContain('Identity and authority not verified');
    expect(result.fields.licenseNo).toMatchObject({ status: 'Input complete', message: expect.stringContaining('License authenticity not verified') });
    expect(result.fields.slug.message).toContain('Backend checks uniqueness');
    expect(result.verification.status).toBe('Pending verification');
    expect(Object.values(result.fields).some((field) => field.status === 'Confirmed')).toBe(false);
  });
  it('keeps an omitted logo optional with exactly six required fields and no readiness penalty', () => {
    const result = evaluateOnboardingReadiness(form, { now });
    expect(result).toMatchObject({ ready: true, incomplete: 0, invalid: 0 });
    expect(result.fields.logo).toEqual({ status: 'Optional', message: 'No logo selected.' });
    expect(evaluateOnboardingReadiness({ ...form, gmName: '' }, { now })).toMatchObject({ ready: false, incomplete: 1, invalid: 0 });
    expect(() => provisioningPayload(form)).not.toThrow();
  });
  it.each(['test', 'POEA-026-LB-042026-R', 'Historical License / 123'])('describes accepted license input %s without claiming official format validity', (licenseNo) => {
    expect(evaluateOnboardingReadiness({ ...form, licenseNo }, { now }).fields.licenseNo).toEqual({ status: 'Input complete', message: 'License authenticity not verified; backend checks uniqueness.' });
    expect(provisioningPayload({ ...form, licenseNo }).poea_license_no).toBe(licenseNo);
  });
  it.each([
    ['agencyName', 'X'.repeat(256)], ['licenseNo', 'Bad\nLicense'], ['gmName', 'Bad\nName'],
    ['email', 'bad..email@example.test'], ['slug', 'bad-domain.test'], ['licenseExpiryDate', '2020-01-01'], ['themeColor', '#fff'],
  ])('shares submit-time validation for %s', (key, value) => {
    const draft = { ...form, [key]: value };
    expect(evaluateOnboardingReadiness(draft, { now }).fields[key as keyof typeof draft].status).toBe('Invalid');
    expect(() => provisioningPayload(draft)).toThrow();
  });
  it('detects duplicates only in loaded records, including legacy workspace aliases', () => {
    const result = evaluateOnboardingReadiness(form, { now, agencies: [{ poea_license_no: ' demo-license ', workspace_url: 'agency2test.flowsensus.com' }] });
    expect(result.ready).toBe(false); expect(result.invalid).toBe(2);
    expect(result.fields.licenseNo.message).toContain('matches a loaded agency');
    expect(result.fields.slug.message).toContain('matches a loaded agency');
    expect(evaluateOnboardingReadiness(form, { now }).fields.slug.status).toBe('Valid format');
  });
  it('uses Manila date semantics and distinguishes selected logos from persisted uploads', () => {
    expect(evaluateOnboardingReadiness({ ...form, licenseExpiryDate: '2026-11-09' }, { now }).fields.licenseExpiryDate.status).toBe('Valid format');
    const result = evaluateOnboardingReadiness(form, { now, logo: new File(['image'], 'logo.png', { type: 'image/png' }) });
    expect(result.fields.logo).toMatchObject({ status: 'Valid format', message: 'Selected locally; upload pending.' });
    expect(evaluateOnboardingReadiness(form, { now, logoError: 'Invalid image' }).fields.logo.status).toBe('Invalid');
    expect(evaluateOnboardingReadiness(form, { now, logo: new File(['svg'], 'logo.svg', { type: 'image/svg+xml' }) }).ready).toBe(false);
  });
});

describe('agency provisioning contract (no live requests)', () => {
  it('suggests valid bare workspace codes at the backend length boundary', () => {
    expect(suggestWorkspaceCode(' Example Agency, Inc. ')).toBe('example-agency-inc');
    expect(suggestWorkspaceCode('A'.repeat(62) + ' !suffix')).toBe('a'.repeat(62));
    expect(suggestWorkspaceCode('A'.repeat(70))).toHaveLength(63);
    expect(suggestWorkspaceCode('')).toBe('');
  });
  it('uses the shared snake_case contract without logo, prefix, status, or role overrides', () => {
    expect(provisioningPayload({ ...form, slug: ' AGENCY2TEST ', email: ' MANAGER@example.test ' })).toEqual({
      agency_name: 'Example Agency', poea_license_no: 'DEMO-LICENSE', workspace_code: 'agency2test',
      gm_name: 'Example Manager', gm_email: 'manager@example.test', license_expiry_date: '2099-12-31',
      theme_color: '#0EA5E9', temporary_password: expect.stringMatching(/^Fs1![A-Za-z0-9_-]{24}$/),
    });
  });
  it.each(['agency2test', 'a', 'a--2', 'a'.repeat(63)])('accepts workspace code %s', (slug) => {
    expect(provisioningPayload({ ...form, slug }).workspace_code).toBe(slug);
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
      agencyId: 83, workspace: response().data.agency,
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
  it('accepts the shared workspace response and retains returned branding and generated prefix', () => {
    const r = response();
    const workspace = { ...r.data.agency, license_expiry_date: '2099-12-31', agency_prefix: 'DB', logo_url: null, theme_color: '#0EA5E9' };
    expect(confirmedProvisioning({ ...r, data: { workspace, admin: r.data.admin } }, provisioningPayload(form))).toMatchObject({ agencyId: 83, workspace });
  });
  it('parses email_dispatched status when returned by the backend', () => {
    const r = response();
    (r.data.admin as any).email_dispatched = true;
    expect(confirmedProvisioning(r, provisioningPayload(form)).emailDispatched).toBe(true);

    const r2 = response();
    (r2.data.admin as any).email_dispatched = false;
    expect(confirmedProvisioning(r2, provisioningPayload(form)).emailDispatched).toBe(false);
  });
  it('creates a fresh strong password only for a valid payload and normalizes custom colors', () => {
    const a = provisioningPayload({ ...form, themeColor: '#aabbcc' });
    const b = provisioningPayload(form);
    expect(a.temporary_password).not.toBe(b.temporary_password);
    expect(a.theme_color).toBe('#AABBCC');
    expect(() => provisioningPayload({ ...form, themeColor: '#fff' })).toThrow('six-digit');
    expect(() => provisioningPayload({ ...form, licenseExpiryDate: '' })).toThrow('Select a');
  });
  it('shows safe field-specific license and theme validation feedback without echoing inputs', () => {
    const error = failure(422, [{ loc: ['body', 'license_expiry_date'], msg: 'secret input', input: 'do-not-display' }]);
    expect(provisioningFailure(error)).toMatchObject({ uncertain: false, message: expect.stringContaining('later than today in Asia/Manila') });
    expect(provisioningFailure(error).message).not.toContain('do-not-display');
    expect(provisioningFailure(failure(422, 'Invalid theme_color: confidential')).message).toContain('six-digit');
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
