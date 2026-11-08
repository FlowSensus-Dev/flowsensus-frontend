import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';

const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, effects: [] as any[], post: vi.fn(), get: vi.fn(), patch: vi.fn() }));
vi.mock('../../lib/api', () => ({ api: { post: h.post, get: h.get, patch: h.patch } }));
vi.mock('react', async (original) => ({ ...(await original() as any),
  useState: (initial: any) => {
    const index = h.cursor++;
    if (!(index in h.slots)) h.slots[index] = typeof initial === 'function' ? initial() : initial;
    return [h.slots[index], (value: any) => { h.slots[index] = typeof value === 'function' ? value(h.slots[index]) : value; }];
  },
  useRef: (initial: any) => { const index = h.cursor++; return h.slots[index] ?? (h.slots[index] = { current: initial }); },
  useEffect: (effect: any) => { h.effects.push(effect); },
}));
import SuperAdminDashboard from './SuperAdminDashboard';
import SuperAdminBar from './SuperAdminBar';
import { AgencyAvatar, AgencyLogoPicker, AgencyThemeControl } from './AgencyBrandingControls';

function nodes(tree: any): any[] {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
}
function text(tree: any): string {
  if (tree == null || typeof tree === 'boolean') return '';
  if (typeof tree !== 'object') return String(tree);
  return [tree.props?.children].flat(Infinity).map(text).join(' ').replace(/\s+/g, ' ').trim();
}

const mockPassword = 'Mock-Only-Password-123!';
const success = () => ({ status: 200, headers: new AxiosHeaders({ 'cache-control': 'no-store' }), data: {
  agency: { agency_id: 83, agency_name: 'Returned Agency Name', workspace_code: 'agency2test', status: 'ACTIVE' },
  admin: { email: 'manager@example.test', temporary_password: mockPassword, must_change_password: true },
} });
const reject = (status?: number, detail?: any, headers?: any, code?: string) => new AxiosError('Confidential backend detail', code, undefined, undefined,
  status ? { status, statusText: '', data: { detail }, headers: new AxiosHeaders(headers), config: {} as any } : undefined);

describe('Super Admin onboarding (mocked API only)', () => {
  let props: any;
  let copy: ReturnType<typeof vi.fn>;
  let storage: ReturnType<typeof vi.fn>;
  const render = () => { h.cursor = 0; return SuperAdminDashboard(props); };
  const button = (label: string) => nodes(render()).find((n) => n.type === 'button' && text(n) === label);
  const field = (id: string) => nodes(render()).find((n) => n.props?.id === `onboarding-${id}`);
  const change = (id: string, value: string) => field(id).props.onChange({ target: { value } });
  const submit = () => nodes(render()).find((n) => n.type === 'form').props.onSubmit({ preventDefault() {} });
  const submitButton = () => nodes(render()).find((n) => n.type === 'button' && n.props.type === 'submit');
  const fill = () => {
    change('agency-name', 'Example Agency'); change('license', 'DEMO-LICENSE');
    change('license-expiry', '2099-12-31');
    change('manager-name', 'Example Manager'); change('manager-email', 'manager@example.test');
    change('workspace-code', 'agency2test');
  };

  beforeEach(() => {
    h.slots = []; h.cursor = 0; h.effects = []; vi.resetAllMocks(); vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T16:30:00Z'));
    props = { currentUserName: 'Authorized Operator', currentUserEmail: 'operator@example.test', onLogout: vi.fn() };
    copy = vi.fn().mockResolvedValue(undefined); storage = vi.fn();
    vi.stubGlobal('navigator', { clipboard: { writeText: copy } });
    vi.stubGlobal('localStorage', { setItem: storage }); vi.stubGlobal('sessionStorage', { setItem: storage });
    h.post.mockResolvedValue(success());
    button('Agency Onboarding').props.onClick();
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('uses Manager terminology and accurate provisioning claims', () => {
    const content = text(render());
    expect(content).toContain('Initial Manager / Authorized Representative'); expect(content).toContain('Initial Manager Email');
    expect(content).toContain('Workspace Code'); expect(content).toContain('Pending verification');
    expect(content).not.toMatch(/Corporate Admin Email|Assigned Workspace Domain|tenancy schemas|tenant administrator identity|\.flowsensus\.com/);
    expect(content).toContain('Business registration, Manager identity, authority, and inbox ownership are not verified here.');
    expect(content).not.toMatch(/Pre-Provisioning Checklist|What Happens on Provision|A temporary password is generated/);
    expect(h.post).not.toHaveBeenCalled();
  });
  it('suggests codes only until explicit manual editing, including a manually cleared code', () => {
    change('agency-name', 'First Agency'); expect(field('workspace-code').props.value).toBe('first-agency');
    change('agency-name', 'Second Agency'); expect(field('workspace-code').props.value).toBe('second-agency');
    change('workspace-code', 'CUSTOM-CODE'); change('agency-name', 'Another Name');
    expect(field('workspace-code').props.value).toBe('custom-code');
    change('workspace-code', ''); change('agency-name', 'Yet Another Name'); expect(field('workspace-code').props.value).toBe('');
  });
  it('uses one full-width card with responsive agency, management, and branding groups', () => {
    const tree = render(); const card = nodes(tree).find((n) => n.type === 'div' && n.props.className?.startsWith('w-full bg-white rounded-2xl'));
    expect(card).toBeDefined(); expect(nodes(card).filter((n) => n.type === 'form')).toHaveLength(1);
    expect(text(card)).not.toMatch(/Pre-Provisioning Checklist|What Happens on Provision|Secure credential handoff is required/);
    const groups = nodes(card).filter((n) => n.type === 'section');
    expect(groups.map((n) => n.props['aria-labelledby'])).toEqual(['onboarding-agency-heading', 'onboarding-management-heading', 'onboarding-branding-heading']);
    for (const group of groups.slice(0, 2)) expect(nodes(group).some((n) => n.props?.className?.includes('grid-cols-1 md:grid-cols-2 xl:grid-cols-3'))).toBe(true);
    expect(nodes(groups[2]).some((n) => n.props?.className?.includes('grid-cols-1 md:grid-cols-2'))).toBe(true);
    expect(nodes(tree).some((n) => n.props?.className?.includes('lg:col-span-7'))).toBe(false);
  });
  it('starts with neutral incomplete fields and updates honest format feedback live', () => {
    const status = (key: string) => nodes(render()).find((n) => n.props?.id === `onboarding-status-${key}`);
    expect(text(status('agencyName'))).toContain('Incomplete'); expect(field('agency-name').props['aria-invalid']).toBe(false);
    expect(nodes(render()).some((n) => n.props?.role === 'alert')).toBe(false);
    expect(text(status('logo'))).toBe('Optional · No logo selected.');
    change('manager-email', 'invalid'); expect(text(status('email'))).toContain('Invalid'); expect(field('manager-email').props['aria-invalid']).toBe(true);
    fill(); expect(text(status('email'))).toContain('Valid format'); expect(text(status('email'))).toContain('Inbox ownership not verified');
    expect(text(status('agencyName'))).toContain('Business identity not verified');
    expect(text(render())).toContain('Required input checks complete'); expect(text(render())).toContain('Pending verification');
    expect(text(render())).not.toMatch(/identity and onboarding authority validated|active, unexpired POEA|email is correct and accessible/);
    expect(h.post).not.toHaveBeenCalled();
  });
  it('keeps sidebar navigation accessible in expanded and collapsed states without storage writes', () => {
    const sidebar = () => nodes(render()).find((n) => n.type === 'aside');
    const toggle = () => nodes(render()).find((n) => n.props?.['aria-controls'] === 'super-admin-navigation');
    expect(sidebar().props.className).toContain('w-64'); expect(toggle().props['aria-expanded']).toBe(true);
    toggle().props.onClick(); expect(sidebar().props.className).toContain('w-[72px]'); expect(toggle().props['aria-expanded']).toBe(false);
    expect(toggle().props['aria-label']).toBe('Expand Super Admin sidebar');
    for (const label of ['Overview', 'Tenant Management', 'Audit Ledger', 'Agency Onboarding']) {
      button(label).props.onClick(); expect(button(label).props).toMatchObject({ title: label, 'aria-label': label, 'aria-current': 'page' });
    }
    toggle().props.onClick(); expect(sidebar().props.className).toContain('w-64');
    expect(storage).not.toHaveBeenCalled(); expect(button('Switch to Role')).toBeUndefined();
  });
  it('starts collapsed on narrow screens and allows expansion', () => {
    vi.stubGlobal('window', { matchMedia: vi.fn().mockReturnValue({ matches: true }) });
    h.slots = []; h.cursor = 0; h.effects = [];
    expect(nodes(render()).find((n) => n.type === 'aside').props.className).toContain('w-[72px]');
    const toggle = nodes(render()).find((n) => n.props?.['aria-controls'] === 'super-admin-navigation');
    toggle.props.onClick(); expect(nodes(render()).find((n) => n.type === 'aside').props.className).toContain('w-64');
  });
  it.each(['Authorized Operator', 'operator@example.test'])('shows the platform role and authenticated email exactly once when display name is %s', (name) => {
    props.currentUserName = name;
    const header = nodes(render()).find((n) => n.type === 'header'); const sidebar = nodes(render()).find((n) => n.type === 'aside');
    expect(text(header)).toContain('Super Admin'); expect(text(header).split('operator@example.test')).toHaveLength(2);
    expect(text(header)).not.toContain('Authorized Operator');
    expect(text(header)).not.toMatch(/superadmin2@|Live Operational|9\+/);
    expect(text(sidebar)).not.toMatch(/Authorized Operator|operator@example.test|Sign Out/);
    nodes(header).find((n) => n.type === 'button' && n.props['aria-label'] === 'Sign Out').props.onClick();
    expect(props.onLogout).toHaveBeenCalledOnce();
    expect(nodes(header).some((n) => /notification|profile|role switch/i.test(n.props?.['aria-label'] ?? ''))).toBe(false);
  });
  it('shows license input completion without implying a checked official license format', () => {
    change('license', 'test');
    const status = nodes(render()).find((n) => n.props?.id === 'onboarding-status-licenseNo');
    expect(text(status)).toBe('Input complete · License authenticity not verified; backend checks uniqueness.');
    expect(text(status)).not.toContain('Valid format');
  });
  it('submits the shared snake_case contract with a bare code and preserves duplicate-click locking', async () => {
    let resolve: any;
    h.post.mockReturnValue(new Promise((done) => { resolve = done; }));
    fill();
    const handler = nodes(render()).find((n) => n.type === 'form').props.onSubmit;
    const pending = handler({ preventDefault() {} }); await submit();
    expect(h.post).toHaveBeenCalledOnce(); expect(submitButton().props.disabled).toBe(true);
    expect(h.post).toHaveBeenCalledWith('/agency-workspaces/provision', {
      agency_name: 'Example Agency', poea_license_no: 'DEMO-LICENSE', workspace_code: 'agency2test',
      gm_name: 'Example Manager', gm_email: 'manager@example.test', license_expiry_date: '2099-12-31',
      theme_color: '#0EA5E9', temporary_password: expect.stringMatching(/^Fs1![A-Za-z0-9_-]{24}$/),
    });
    resolve(success()); await pending;
    await handler({ preventDefault() {} });
    expect(h.post).toHaveBeenCalledOnce();
    expect(submitButton().props.disabled).toBe(true);
  });
  it('shows confirmed response fields and supports explicit credential handoff without persistence', async () => {
    fill(); expect(text(render())).not.toContain(mockPassword); await submit();
    expect(text(render())).toContain('Returned Agency Name'); expect(text(render())).toContain('agency2test');
    expect(text(render())).toContain(mockPassword); expect(text(render())).toContain('No email has been sent');
    expect(text(render())).toContain('password-change prompt at first sign-in');
    const portal = nodes(render()).find((n) => n.type === 'a' && n.props.href === 'https://flowsensus.app');
    expect(portal).toBeDefined(); expect(portal.props.href).not.toContain('?');
    expect(copy).not.toHaveBeenCalled(); await button('Copy Temporary Password').props.onClick();
    expect(copy).toHaveBeenCalledWith(mockPassword); expect(storage).not.toHaveBeenCalled();
    button('Tenant Management').props.onClick(); expect(text(render())).not.toContain(mockPassword);
    button('Agency Onboarding').props.onClick(); button('Provision another agency').props.onClick();
    expect(text(render())).not.toContain(mockPassword);
    change('agency-name', 'New Agency'); expect(field('workspace-code').props.value).toBe('new-agency');
  });
  it('validates a pasted hostname and required fields before submitting', async () => {
    await submit(); expect(h.post).not.toHaveBeenCalled();
    fill(); change('workspace-code', 'agency2test.flowsensus.com'); await submit();
    expect(text(render())).toContain('1–63 lowercase'); expect(h.post).not.toHaveBeenCalled();
  });
  const logoPicker = (id = 'onboarding-logo') => nodes(render()).find((n) => n.type === AgencyLogoPicker && n.props.id === id);
  const themeControl = (id = 'onboarding-theme-color') => nodes(render()).find((n) => n.type === AgencyThemeControl && n.props.id === id);
  const selectLogo = (id = 'onboarding-logo') => logoPicker(id).props.onChange({ file: new File(['image'], 'logo.png', { type: 'image/png' }), error: null });
  const logoResponse = () => ({ status: 200, data: { agency_id: 83, logo_url: 'https://storage.example.test/agency/83/logo.png' } });

  it('renders required expiry and optional branding controls without a manual prefix input', () => {
    expect(field('license-expiry').props).toMatchObject({ required: true, type: 'date', min: '2026-11-09' });
    expect(text(render())).toContain('POEA / DMW License Expiry Date *');
    expect(logoPicker().props.selection.file).toBeNull();
    expect(themeControl().props.value).toBe('#0EA5E9');
    expect(nodes(render()).some((n) => n.type === 'input' && /prefix/i.test(n.props.id ?? ''))).toBe(false);
  });
  it.each([
    ['', 'Select a POEA'], ['2026-02-30', 'YYYY-MM-DD'], ['2026-11-07', 'later than today'], ['2026-11-08', 'later than today'],
  ])('blocks expiry %s before any request and retains the draft', async (value, message) => {
    fill(); change('license-expiry', value); await submit();
    expect(h.post).not.toHaveBeenCalled(); expect(text(render())).toContain(message);
    expect(field('agency-name').props.value).toBe('Example Agency');
  });
  it('submits a future Manila date unchanged and normalizes a custom theme', async () => {
    fill(); change('license-expiry', '2026-11-09'); themeControl().props.onChange('#aabbcc'); await submit();
    expect(h.post.mock.calls[0][1]).toMatchObject({ license_expiry_date: '2026-11-09', theme_color: '#AABBCC' });
    expect(h.post).toHaveBeenCalledOnce(); expect(text(render())).toContain(mockPassword);
    expect(text(render())).not.toContain('logo upload confirmed');
  });
  it('blocks invalid logo and theme drafts without issuing requests', async () => {
    fill(); logoPicker().props.onChange({ file: null, error: 'Choose a PNG, JPEG, or WEBP image.' }); await submit();
    expect(h.post).not.toHaveBeenCalled(); expect(text(render())).toContain('Choose a PNG');
    logoPicker().props.onChange({ file: null, error: null }); themeControl().props.onChange('red'); await submit();
    expect(h.post).not.toHaveBeenCalled(); expect(text(render())).toContain('six-digit');
  });
  it('uploads a selected logo only after provisioning and preserves credentials during upload', async () => {
    let resolveUpload: any;
    h.post.mockResolvedValueOnce(success()).mockImplementationOnce(() => new Promise((resolve) => { resolveUpload = resolve; }));
    fill(); selectLogo(); const pending = submit();
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(h.post).toHaveBeenCalledTimes(2);
    expect(h.post.mock.calls[1][0]).toBe('/agency-workspaces/83/logo');
    expect(h.post.mock.calls[1][1]).toBeInstanceOf(FormData);
    expect(h.post.mock.calls[1][1].get('file').name).toBe('logo.png');
    expect(h.post.mock.calls[1][2]).toEqual({ headers: { 'Content-Type': undefined } });
    expect(text(render())).toContain(mockPassword); expect(text(render())).toContain('Uploading agency logo');
    expect(button('Provision another agency').props.disabled).toBe(true);
    button('Provision another agency').props.onClick(); await submit();
    expect(h.post).toHaveBeenCalledTimes(2); expect(text(render())).toContain(mockPassword);
    resolveUpload(logoResponse()); await pending;
    expect(text(render())).toContain('Agency logo upload confirmed.'); expect(text(render())).toContain(mockPassword);
    expect(text(render())).not.toContain('logo upload failed');
    await submit(); expect(h.post).toHaveBeenCalledTimes(2);
  });
  it.each(['network', 'http', 'unconfirmed'])('retains successful provisioning and handoff after %s logo failure without replay', async (mode) => {
    h.post.mockResolvedValueOnce(success());
    if (mode === 'network') h.post.mockRejectedValueOnce(reject(undefined, undefined, undefined, 'ERR_NETWORK'));
    if (mode === 'http') h.post.mockRejectedValueOnce(reject(422, 'Confidential upload detail'));
    if (mode === 'unconfirmed') h.post.mockResolvedValueOnce({ status: 202, data: { agency_id: 83 } });
    fill(); selectLogo(); await submit();
    expect(text(render())).toContain('Agency and Initial Manager Created'); expect(text(render())).toContain(mockPassword);
    expect(text(render())).toContain('Agency created successfully, but logo upload failed. You can retry it in Tenant Management.');
    expect(text(render())).not.toContain('Verify agency/account records'); expect(text(render())).not.toContain('Confidential');
    expect(nodes(render()).some((n) => n.type === 'input' && n.props.type === 'checkbox')).toBe(false);
    await button('Copy Temporary Password').props.onClick(); expect(copy).toHaveBeenCalledWith(mockPassword);
    await submit(); await vi.runAllTimersAsync(); expect(h.post).toHaveBeenCalledTimes(2);
    expect(h.post.mock.calls.filter(([url]) => url === '/agency-workspaces/provision')).toHaveLength(1);
    button('Tenant Management').props.onClick(); button('Agency Onboarding').props.onClick();
    expect(text(render())).toContain(mockPassword); expect(storage).not.toHaveBeenCalled();
  });
  it('never uploads a logo for failed or uncertain provisioning', async () => {
    h.post.mockRejectedValueOnce(reject(409, 'Conflict')); fill(); selectLogo(); await submit();
    expect(h.post).toHaveBeenCalledOnce(); expect(text(render())).not.toContain(mockPassword);
  });
  it.each([401, 403, 409, 422])('handles HTTP %s while retaining the draft and withholding credentials', async (status) => {
    h.post.mockRejectedValue(reject(status, 'Confidential backend stack trace'));
    fill(); await submit(); expect(h.post).toHaveBeenCalledOnce();
    expect(field('workspace-code').props.value).toBe('agency2test'); expect(text(render())).not.toContain(mockPassword);
    expect(text(render())).not.toContain('Confidential');
    expect(nodes(render()).some((n) => n.props?.role === 'alert')).toBe(true);
    if (status === 409) expect(text(render())).toContain('conflicts with an existing record');
    if (status === 422) expect(text(render())).toContain('backend rejected');
    expect(submitButton().props.disabled).toBe(false);
  });
  it.each(['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'])('requires verification after %s and never resubmits automatically', async (code) => {
    h.post.mockRejectedValue(reject(undefined, undefined, undefined, code)); fill(); await submit();
    await submit(); await vi.runAllTimersAsync();
    expect(h.post).toHaveBeenCalledOnce(); expect(submitButton().props.disabled).toBe(true);
    expect(text(render())).toContain('Verify agency/account records before retrying');
    const check = nodes(render()).find((n) => n.type === 'input' && n.props.type === 'checkbox');
    check.props.onChange({ target: { checked: true } });
    expect(submitButton().props.disabled).toBe(false); expect(h.post).toHaveBeenCalledOnce();
  });
  it('shows the safe recovery reference and prioritizes recovery over HTTP conflict', async () => {
    const reference = '1234567890abcdef1234567890abcdef';
    h.post.mockRejectedValue(reject(409, `Records may remain. Reference: ${reference}`, { 'X-Provisioning-Recovery-Required': 'true' }));
    fill(); await submit(); expect(text(render())).toContain(`Recovery reference: ${reference}`);
    expect(submitButton().props.disabled).toBe(true); expect(text(render())).not.toContain('Initial Manager Created');
  });
  it('does not expose credentials from malformed or recovery-required success responses', async () => {
    const r: any = success(); delete r.data.agency.workspace_code;
    h.post.mockResolvedValueOnce(r); fill(); await submit();
    expect(text(render())).toContain('could not be confirmed'); expect(text(render())).not.toContain(mockPassword);
    await submit(); expect(h.post).toHaveBeenCalledOnce();
    nodes(render()).find((n) => n.type === 'input' && n.props.type === 'checkbox').props.onChange({ target: { checked: true } });
    const recovery = success(); recovery.headers.set('X-Provisioning-Recovery-Required', 'true');
    h.post.mockResolvedValueOnce(recovery); await submit();
    expect(text(render())).not.toContain(mockPassword); expect(submitButton().props.disabled).toBe(true);
  });
  it('preserves platform navigation and logout without operational role switching', () => {
    for (const label of ['Overview', 'Tenant Management', 'Audit Ledger', 'Agency Onboarding']) {
      button(label).props.onClick(); expect(button(label)).toBeDefined();
      expect(h.post).not.toHaveBeenCalled();
    }
    expect(button('Management')).toBeUndefined(); expect(button('Switch to Role')).toBeUndefined();
    expect(text(render())).not.toContain('Tenant Portal');
    const logout = nodes(render()).find((n) => n.type === 'button' && n.props.onClick === props.onLogout);
    expect(logout).toBeDefined(); logout.props.onClick(); expect(props.onLogout).toHaveBeenCalledOnce();
  });
  it('requests only authorized platform reads on mount and displays confirmed audit fields', async () => {
    h.get.mockImplementation(async (url) => ({ data: url === '/audit-logs' ? [{ audit_log_id: 91, action: 'AGENCY_CREATED',
      description: 'Example agency provisioned', occurred_at: '2026-10-30T10:00:00Z', module: 'Platform' }] : [] }));
    h.effects.slice(0, 3).forEach((effect) => effect());
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(h.get.mock.calls.map(([url]) => url)).toEqual(['/audit-logs', '/agency-workspaces', '/agency-workspaces/statistics']);
    expect(h.get).not.toHaveBeenCalledWith('/users');
    button('Overview').props.onClick(); expect(text(render())).toContain('Example agency provisioned');
    expect(text(render())).toContain('Platform totals unavailable');
  });
  it('reports unavailable activity without claiming no events or fetching tenant data', async () => {
    h.get.mockRejectedValue(new Error('Unavailable')); h.effects[0]();
    for (let i = 0; i < 8; i++) await Promise.resolve();
    button('Overview').props.onClick(); expect(text(render())).toContain('Recent platform activity is unavailable');
    expect(text(render())).not.toContain('No activity records logged yet');
    expect(h.get).toHaveBeenCalledTimes(1);
  });
  const statisticsOutput = (label: string) => nodes(render()).find((n) => n.type === 'output' && n.props['aria-label'] === `${label} count`);
  const runStatistics = async () => { h.effects[2](); for (let i = 0; i < 8; i++) await Promise.resolve(); button('Overview').props.onClick(); };
  it('loads confirmed safe aggregate counts without requesting operational lists', async () => {
    button('Overview').props.onClick(); expect(text(render())).toContain('Loading platform statistics');
    expect(statisticsOutput('Total Staff Users')).toBeUndefined();
    h.get.mockResolvedValueOnce({ status: 200, data: { total_staff_users: 12, total_applicants: 84 } }); await runStatistics();
    expect(statisticsOutput('Total Staff Users').props.children).toBe(12); expect(statisticsOutput('Total Applicants').props.children).toBe(84);
    expect(text(render())).toContain('Active tenant staff across agencies'); expect(text(render())).toContain('Registered applicants across agencies');
    expect(h.get.mock.calls.map(([url]) => url)).toEqual(['/agency-workspaces/statistics']);
  });
  it('displays zero only when confirmed by a valid aggregate response', async () => {
    h.get.mockResolvedValueOnce({ status: 200, data: { total_staff_users: 0, total_applicants: 0 } }); await runStatistics();
    expect(statisticsOutput('Total Staff Users').props.children).toBe(0); expect(statisticsOutput('Total Applicants').props.children).toBe(0);
  });
  it.each([
    null, {}, [], { total_staff_users: -1, total_applicants: 84 }, { total_staff_users: 1.5, total_applicants: 84 },
    { total_staff_users: '12', total_applicants: 84 }, { total_staff_users: 12, total_applicants: null },
    { total_staff_users: 12, total_applicants: Number.MAX_SAFE_INTEGER + 1 }, { total_staff_users: NaN, total_applicants: 84 },
  ])('displays unavailable counts for invalid response %s', async (data) => {
    h.get.mockResolvedValueOnce({ status: 200, data }); await runStatistics();
    expect(statisticsOutput('Total Staff Users').props.children).toBe('—'); expect(statisticsOutput('Total Applicants').props.children).toBe('—');
    expect(text(render())).toContain('Platform totals unavailable');
  });
  it.each([403, 404, 500])('keeps platform counts unavailable after HTTP %s without PII fallback', async (status) => {
    h.get.mockRejectedValueOnce(reject(status, 'Confidential internals')); await runStatistics();
    expect(statisticsOutput('Total Staff Users').props.children).toBe('—'); expect(statisticsOutput('Total Applicants').props.children).toBe('—');
    expect(text(render())).not.toContain('Confidential'); expect(h.get).toHaveBeenCalledOnce();
  });
  it('refreshes statistics with agency data, clears stale counts, and ignores obsolete responses', async () => {
    let resolveOld: any;
    h.get.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }));
    const cleanup = h.effects[2](); cleanup();
    h.get.mockResolvedValueOnce({ status: 200, data: { total_staff_users: 21, total_applicants: 95 } }); await runStatistics();
    resolveOld({ status: 200, data: { total_staff_users: 999, total_applicants: 999 } }); await Promise.resolve();
    expect(statisticsOutput('Total Staff Users').props.children).toBe(21);
    const refresh = nodes(render()).find((n) => n.props?.title === 'Refresh workspace status'); refresh.props.onClick();
    const statisticsEffect = h.effects.at(-1); h.get.mockRejectedValueOnce(new Error('Network interruption'));
    statisticsEffect();
    expect(nodes(render()).some((n) => n.props?.['aria-label'] === 'Platform staff statistics' && n.props['aria-busy'])).toBe(true);
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(statisticsOutput('Total Staff Users').props.children).toBe('—');
  });
  it('keeps the legacy platform bar free of operational controls and hardcoded identity', () => {
    const onConsole = vi.fn(); const tree = SuperAdminBar({ currentUserName: 'Verified Operator', onLogout: props.onLogout, onSuperAdminDashboard: onConsole });
    expect(text(tree)).toContain('Verified Operator'); expect(text(tree)).not.toMatch(/Switch Role|Findstaff|admin@|Agency #1/);
    const buttons = nodes(tree).filter((n) => n.type === 'button'); expect(buttons).toHaveLength(2);
    buttons[0].props.onClick(); expect(onConsole).toHaveBeenCalledOnce();
  });

  const tenant = (status: any) => ({ agency_id: 83, agency_name: 'Example Agency', poea_license_no: 'DEMO-LICENSE',
    agency_prefix: 'EX', workspace_code: 'example-agency', status, created_at: null });
  const loadTenants = async (rows: any[]) => {
    h.get.mockResolvedValue({ data: rows });
    h.patch.mockImplementation(async (url, body) => ({ data: { ...rows.find((r) => url.endsWith(`/${r.agency_id}`)), ...body } }));
    h.effects[1]();
    await Promise.resolve(); await Promise.resolve();
    button('Tenant Management').props.onClick();
  };
  const editField = (id: string) => nodes(render()).find((n) => n.props?.id === `tenant-edit-${id}`);
  const editChange = (id: string, value: string) => editField(id).props.onChange({ target: { value } });
  const quickStatus = () => nodes(render()).find((n) => n.type === 'select' && n.props.title === 'Change agency status');
  const editableOptions = (select: any) => nodes(select).filter((n) => n.type === 'option' && !n.props.disabled).map((n) => n.props.value);
  const openTenant = () => nodes(render()).find((n) => n.type === 'button' && n.props.title === 'Edit agency details').props.onClick();

  it('flags known duplicate license/workspace values without claiming server-verified uniqueness', async () => {
    await loadTenants([{ ...tenant('ACTIVE'), poea_license_no: 'DEMO-LICENSE', workspace_code: 'agency2test' }]);
    button('Agency Onboarding').props.onClick(); fill();
    expect(text(render())).toContain('License number matches a loaded agency'); expect(text(render())).toContain('Workspace Code matches a loaded agency');
    await submit(); expect(h.post).not.toHaveBeenCalled();
  });

  it('keeps legacy tenants visible with neutral expiry and null branding fallbacks', async () => {
    await loadTenants([{ ...tenant('ACTIVE'), logo_url: null, theme_color: null, license_expiry_date: null }]);
    expect(text(render())).toContain('Example Agency'); expect(text(render())).toContain('Not recorded');
    expect(text(render())).not.toContain('Expired');
    expect(nodes(render()).find((n) => n.type === AgencyAvatar).props).toMatchObject({ logoUrl: null, name: 'Example Agency', fallback: 'EX' });
    openTenant(); editChange('name', 'Renamed Agency'); await submit();
    expect(h.patch.mock.calls[0][1]).toEqual({ agency_name: 'Renamed Agency' });
  });
  it('displays expiry and color without automatically suspending expired agencies', async () => {
    await loadTenants([{ ...tenant('ACTIVE'), license_expiry_date: '2026-11-07', theme_color: '#AABBCC' }]);
    expect(text(render())).toContain('2026-11-07'); expect(text(render())).toContain('Expired');
    expect(quickStatus().props.value).toBe('ACTIVE'); expect(h.patch).not.toHaveBeenCalled();
    expect(nodes(render()).some((n) => n.props?.['aria-label'] === 'Agency Theme Color: #AABBCC')).toBe(true);
  });
  it('saves expiry and normalized theme only when edited, never a generic logo URL', async () => {
    await loadTenants([tenant('ACTIVE')]); openTenant();
    editChange('license-expiry', '2099-12-31'); themeControl('tenant-edit-theme-color').props.onChange('#aabbcc'); await submit();
    expect(h.patch).toHaveBeenCalledWith('/agency-workspaces/83', { license_expiry_date: '2099-12-31', theme_color: '#AABBCC' });
    expect(h.patch.mock.calls[0][1]).not.toHaveProperty('logo_url');
    expect(text(render())).toContain('updated successfully');
  });
  it('does not claim a successful edit when an older backend silently ignores branding fields', async () => {
    await loadTenants([tenant('ACTIVE')]); openTenant(); editChange('license-expiry', '2099-12-31');
    h.patch.mockResolvedValueOnce({ data: tenant('ACTIVE') }); await submit();
    expect(text(render())).toContain('could not be confirmed'); expect(text(render())).not.toContain('updated successfully');
    expect(editField('license-expiry').props.value).toBe('2099-12-31');
  });
  it('replaces a tenant logo through the dedicated endpoint without PATCH or provisioning', async () => {
    await loadTenants([tenant('ACTIVE')]); openTenant(); selectLogo('tenant-edit-logo');
    h.post.mockResolvedValueOnce(logoResponse()); await submit();
    expect(h.patch).not.toHaveBeenCalled(); expect(h.post).toHaveBeenCalledOnce();
    expect(h.post.mock.calls[0][0]).toBe('/agency-workspaces/83/logo');
    expect(nodes(render()).find((n) => n.type === AgencyAvatar).props.logoUrl).toBe(logoResponse().data.logo_url);
  });
  it('preserves saved profile edits after logo failure and supports inspection and explicit upload retry', async () => {
    await loadTenants([tenant('ACTIVE')]); openTenant(); editChange('name', 'Renamed Agency'); selectLogo('tenant-edit-logo');
    h.post.mockRejectedValueOnce(reject(undefined, undefined, undefined, 'ERR_NETWORK')); await submit();
    expect(h.patch).toHaveBeenCalledOnce(); expect(text(render())).toContain('Agency details saved.');
    expect(editField('name').props.value).toBe('Renamed Agency'); expect(logoPicker('tenant-edit-logo').props.selection.file).toBeTruthy();
    h.get.mockResolvedValueOnce({ data: [{ ...tenant('ACTIVE'), agency_name: 'Renamed Agency', logo_url: 'https://storage.example.test/old.png' }] });
    await button('Refresh saved agency').props.onClick();
    expect(logoPicker('tenant-edit-logo').props.currentLogoUrl).toBe('https://storage.example.test/old.png');
    h.post.mockResolvedValueOnce(logoResponse()); await submit();
    expect(h.patch).toHaveBeenCalledOnce(); expect(h.post).toHaveBeenCalledTimes(2);
    expect(h.post.mock.calls.every(([url]) => url === '/agency-workspaces/83/logo')).toBe(true);
  });

  it('offers only supported status choices, correctly displays CLOSED, and never writes on load', async () => {
    await loadTenants([tenant('CLOSED')]);
    expect(button('Enter Workspace')).toBeUndefined();
    expect(quickStatus().props.value).toBe('CLOSED');
    expect(editableOptions(quickStatus())).toEqual(['ACTIVE', 'SUSPENDED', 'CLOSED']);
    expect(text(render())).not.toContain('Pending Approval');
    openTenant(); expect(editField('status').props.value).toBe('CLOSED');
    expect(editableOptions(editField('status'))).toEqual(['ACTIVE', 'SUSPENDED', 'CLOSED']);
    expect(h.patch).not.toHaveBeenCalled(); expect(h.post).not.toHaveBeenCalled();
  });
  it.each(['CLOSED', 'SUSPENDED', 'ACTIVE'])('keeps %s unchanged when saving only a profile field', async (status) => {
    await loadTenants([tenant(status)]); openTenant(); editChange('name', 'Renamed Agency'); await submit();
    expect(h.patch).toHaveBeenCalledWith('/agency-workspaces/83', { agency_name: 'Renamed Agency' });
    expect(h.patch.mock.calls[0][1]).not.toHaveProperty('status'); expect(h.patch.mock.calls[0][1]).not.toHaveProperty('workspace_status');
    expect(h.patch.mock.calls[0][1]).not.toHaveProperty('workspaceStatus'); expect(quickStatus().props.value).toBe(status);
  });
  it.each(['LEGACY_REVIEW', null, 'Pending Approval'])('preserves unknown raw status %s and saves profile edits without status', async (status) => {
    await loadTenants([tenant(status)]); expect(quickStatus().props.value).toBe('');
    openTenant(); expect(editField('status').props.value).toBe('');
    expect(text(render())).toContain(status || 'Status unavailable');
    editChange('license', 'NEW-LICENSE');
    h.patch.mockResolvedValueOnce({ data: { ...tenant(status), status: status ?? '', poea_license_no: 'NEW-LICENSE' } });
    await submit(); expect(h.patch).toHaveBeenCalledWith('/agency-workspaces/83', { poea_license_no: 'NEW-LICENSE' });
    expect(quickStatus().props.value).toBe('');
  });
  it.each([['CLOSED', 'ACTIVE'], ['ACTIVE', 'SUSPENDED'], ['SUSPENDED', 'CLOSED']])('submits deliberate %s -> %s transitions alongside profile edits', async (from, to) => {
    await loadTenants([tenant(from)]); openTenant(); editChange('status', to); editChange('name', 'Renamed Agency'); await submit();
    expect(h.patch).toHaveBeenCalledWith('/agency-workspaces/83', { agency_name: 'Renamed Agency', workspace_status: to, status: to });
    expect(quickStatus().props.value).toBe(to);
  });
  it('omits status when the user reverts the selection and skips a completely unchanged save', async () => {
    await loadTenants([tenant('CLOSED')]); openTenant(); await submit(); expect(h.patch).not.toHaveBeenCalled();
    openTenant(); editChange('status', 'ACTIVE'); editChange('status', 'CLOSED'); editChange('name', 'Renamed Agency'); await submit();
    expect(h.patch.mock.calls[0][1]).toEqual({ agency_name: 'Renamed Agency' });
  });
  it('resets deliberate-status tracking on cancel and requires explicit selection for an unknown status', async () => {
    await loadTenants([tenant('LEGACY')]); openTenant(); editChange('status', 'ACTIVE'); button('Cancel').props.onClick();
    openTenant(); expect(editField('status').props.value).toBe(''); editChange('name', 'Renamed Agency'); await submit();
    expect(h.patch.mock.calls[0][1]).toEqual({ agency_name: 'Renamed Agency' });
    openTenant(); editChange('status', 'ACTIVE'); await submit();
    expect(h.patch.mock.calls[1][1]).toEqual({ workspace_status: 'ACTIVE', status: 'ACTIVE' });
  });
  it('keeps supported profile fields editable and submits bare workspace aliases without status', async () => {
    await loadTenants([tenant('SUSPENDED')]); openTenant();
    expect(text(render())).toContain('Workspace Code'); expect(text(render())).not.toContain('.flowsensus.com');
    editChange('license', 'NEW-LICENSE'); editChange('prefix', 'TEST'); editChange('workspace', 'new-code'); await submit();
    expect(h.patch.mock.calls[0][1]).toEqual({ poea_license_no: 'NEW-LICENSE', agency_prefix: 'TEST', workspace_url: 'new-code', workspace_code: 'new-code' });
  });
  it('sends compatible quick-status aliases and ignores unchanged or unsupported selections', async () => {
    await loadTenants([tenant('ACTIVE')]);
    await quickStatus().props.onChange({ target: { value: 'ACTIVE' } }); expect(h.patch).not.toHaveBeenCalled();
    await quickStatus().props.onChange({ target: { value: 'Pending Approval' } }); expect(h.patch).not.toHaveBeenCalled();
    await quickStatus().props.onChange({ target: { value: 'CLOSED' } });
    expect(h.patch).toHaveBeenCalledWith('/agency-workspaces/83', { workspace_status: 'CLOSED', status: 'CLOSED' });
    expect(quickStatus().props.value).toBe('CLOSED');
  });
  it.each([403, 409, 422, 500, undefined])('retains status and shows safe errors after failed quick update (%s)', async (status) => {
    await loadTenants([tenant('CLOSED')]); h.patch.mockRejectedValueOnce(reject(status, 'Database internals: do-not-display'));
    await quickStatus().props.onChange({ target: { value: 'ACTIVE' } });
    expect(quickStatus().props.value).toBe('CLOSED'); expect(quickStatus().props.disabled).toBe(false);
    expect(text(render())).not.toContain('Agency status updated'); expect(text(render())).not.toContain('Database internals');
    expect(nodes(render()).some((n) => n.props?.role === 'alert')).toBe(true);
    if (status === 403) expect(text(render())).toContain('verified platform Super Admin');
    if (status === 422) expect(text(render())).toContain('Active, Suspended, or Closed');
  });
  it('preserves the modal draft and previous status when mixed updates are forbidden', async () => {
    await loadTenants([tenant('CLOSED')]); openTenant(); editChange('status', 'ACTIVE'); editChange('name', 'Renamed Agency');
    h.patch.mockRejectedValueOnce(reject(403, 'Private internals')); await submit();
    expect(editField('name').props.value).toBe('Renamed Agency'); expect(editField('status').props.value).toBe('ACTIVE');
    expect(quickStatus().props.value).toBe('CLOSED'); expect(text(render())).not.toContain('updated successfully');
    expect(text(render())).not.toContain('Private internals');
  });
  it('does not claim success for an unconfirmed or mismatched backend response', async () => {
    await loadTenants([tenant('CLOSED')]); h.patch.mockResolvedValueOnce({ data: tenant('CLOSED') });
    await quickStatus().props.onChange({ target: { value: 'ACTIVE' } });
    expect(quickStatus().props.value).toBe('CLOSED'); expect(text(render())).toContain('could not be confirmed');
    expect(text(render())).not.toContain('Agency status updated');
  });
  it('prevents overlapping quick updates and duplicate modal submissions', async () => {
    await loadTenants([tenant('CLOSED')]); let resolve: any;
    h.patch.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const pending = quickStatus().props.onChange({ target: { value: 'ACTIVE' } });
    await quickStatus().props.onChange({ target: { value: 'SUSPENDED' } }); expect(h.patch).toHaveBeenCalledOnce();
    expect(quickStatus().props.disabled).toBe(true); resolve({ data: tenant('ACTIVE') }); await pending;
    openTenant(); editChange('name', 'Renamed Agency');
    h.patch.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const pendingEdit = submit(); await submit(); expect(h.patch).toHaveBeenCalledTimes(2);
    resolve({ data: { ...tenant('ACTIVE'), agency_name: 'Renamed Agency' } }); await pendingEdit;
  });
});
