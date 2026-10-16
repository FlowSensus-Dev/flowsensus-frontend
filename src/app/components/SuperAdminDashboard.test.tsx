import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';

const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, effects: [] as any[], post: vi.fn(), get: vi.fn(), patch: vi.fn() }));
vi.mock('../../lib/api', () => ({ api: { post: h.post, get: h.get, patch: h.patch } }));
vi.mock('react', async (original) => ({ ...(await original() as any),
  useState: (initial: any) => {
    const index = h.cursor++;
    if (!(index in h.slots)) h.slots[index] = initial;
    return [h.slots[index], (value: any) => { h.slots[index] = typeof value === 'function' ? value(h.slots[index]) : value; }];
  },
  useRef: (initial: any) => { const index = h.cursor++; return h.slots[index] ?? (h.slots[index] = { current: initial }); },
  useEffect: (effect: any) => { h.effects.push(effect); },
}));
import SuperAdminDashboard from './SuperAdminDashboard';

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
    change('manager-name', 'Example Manager'); change('manager-email', 'manager@example.test');
    change('workspace-code', 'agency2test');
  };

  beforeEach(() => {
    h.slots = []; h.cursor = 0; h.effects = []; vi.clearAllMocks(); vi.useFakeTimers();
    props = { currentUserName: 'Authorized Operator', applicants: [], activityLogs: [], onLogout: vi.fn(), onSwitchRole: vi.fn() };
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
    expect(content).toContain('Workspace Code'); expect(content).toContain('no onboarding email is sent');
    expect(content).not.toMatch(/Corporate Admin Email|Assigned Workspace Domain|tenancy schemas|tenant administrator identity|\.flowsensus\.com/);
    expect(content).toContain('Management membership');
    expect(h.post).not.toHaveBeenCalled();
  });
  it('suggests codes only until explicit manual editing, including a manually cleared code', () => {
    change('agency-name', 'First Agency'); expect(field('workspace-code').props.value).toBe('first-agency');
    change('agency-name', 'Second Agency'); expect(field('workspace-code').props.value).toBe('second-agency');
    change('workspace-code', 'CUSTOM-CODE'); change('agency-name', 'Another Name');
    expect(field('workspace-code').props.value).toBe('custom-code');
    change('workspace-code', ''); change('agency-name', 'Yet Another Name'); expect(field('workspace-code').props.value).toBe('');
  });
  it('submits only the compatible camelCase fields with a bare code and preserves duplicate-click locking', async () => {
    let resolve: any;
    h.post.mockReturnValue(new Promise((done) => { resolve = done; }));
    fill();
    const handler = nodes(render()).find((n) => n.type === 'form').props.onSubmit;
    const pending = handler({ preventDefault() {} }); await submit();
    expect(h.post).toHaveBeenCalledOnce(); expect(submitButton().props.disabled).toBe(true);
    expect(h.post).toHaveBeenCalledWith('/agency-workspaces/provision', {
      agencyName: 'Example Agency', poeaLicenseNo: 'DEMO-LICENSE', workspaceUrl: 'agency2test', workspaceStatus: 'ACTIVE',
      adminFullName: 'Example Manager', adminEmail: 'manager@example.test',
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
  it('preserves Overview, Tenant Management, Audit Ledger, role switching and logout navigation', () => {
    for (const label of ['Overview', 'Tenant Management', 'Audit Ledger', 'Agency Onboarding']) {
      button(label).props.onClick(); expect(button(label)).toBeDefined();
      expect(h.post).not.toHaveBeenCalled();
    }
    button('Management').props.onClick(); expect(props.onSwitchRole).toHaveBeenCalledWith('Management');
    const logout = nodes(render()).find((n) => n.type === 'button' && n.props.onClick === props.onLogout);
    expect(logout).toBeDefined(); logout.props.onClick(); expect(props.onLogout).toHaveBeenCalledOnce();
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

  it('offers only supported status choices, correctly displays CLOSED, and never writes on load', async () => {
    await loadTenants([tenant('CLOSED')]);
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
