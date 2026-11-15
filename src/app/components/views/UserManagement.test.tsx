import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, effects: [] as any[], get: vi.fn(), post: vi.fn(), put: vi.fn(), alert: vi.fn() }));
vi.mock('../../../lib/api', () => ({ api: { get: h.get, post: h.post, put: h.put } }));
vi.mock('../../../lib/supabase', () => ({ supabase: {
  channel: () => { const channel = { on: () => channel, subscribe: () => channel }; return channel; }, removeChannel: vi.fn(),
} }));
vi.mock('react', async (original) => ({ ...(await original() as any),
  useState: (initial: any) => {
    const index = h.cursor++;
    if (!(index in h.slots)) h.slots[index] = typeof initial === 'function' ? initial() : initial;
    return [h.slots[index], (value: any) => { h.slots[index] = typeof value === 'function' ? value(h.slots[index]) : value; }];
  },
  useRef: (initial: any) => { const index = h.cursor++; return h.slots[index] ?? (h.slots[index] = { current: initial }); },
  useMemo: (fn: any) => fn(), useEffect: (effect: any, deps: any[]) => {
    const index = h.cursor++; const previous = h.slots[index];
    if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
      const slot = { deps, cleanup: previous?.cleanup }; h.slots[index] = slot;
      h.effects.push(() => { previous?.cleanup?.(); slot.cleanup = effect(); });
    }
  },
}));
import UserManagement from './UserManagement';

function nodes(tree: any): any[] { return !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)]; }
const text = (tree: any): string => tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : [tree.props?.children].flat(Infinity).map(text).join(' ').replace(/\s+/g, ' ').trim();
const confirmed = () => ({ success: true, email_dispatched: true, email: 'confirmed@example.test', applicant_code: 'APP-TEST-9', name: 'Example Applicant' });

describe('PF17S1 applicant credential resend UI (mocked API only)', () => {
  const props: any = { currentUserName: 'Manager', addActivityLog: vi.fn(), applicants: [], updateApplicant: vi.fn() };
  const render = () => { h.cursor = 0; return UserManagement(props); };
  const button = (label: string) => nodes(render()).find((n) => n.type === 'button' && text(n) === label);
  beforeEach(async () => {
    vi.resetAllMocks(); h.slots = []; h.effects = []; h.cursor = 0; vi.stubGlobal('alert', h.alert);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    h.get.mockImplementation(async (url) => ({ data: url === '/users/applicants' ? [{ applicant_id: 9, id: '9', name: 'Example Applicant',
      email: 'old@example.test', applicant_code: 'APP-TEST-9', is_active: true, is_blocked: false, status: 'Active' }] : [] }));
    h.post.mockResolvedValue({ data: confirmed() });
    render(); h.effects.splice(0).forEach((effect) => effect());
    for (let i = 0; i < 12; i++) await Promise.resolve();
    nodes(render()).find((n) => n.type === 'button' && text(n).startsWith('Applicant Accounts')).props.onClick();
    nodes(render()).find((n) => n.type === 'button' && n.props.title === 'Resend Login Credentials Email').props.onClick();
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  it('confirms dispatch from response identity without any returned password or fabricated placeholder', async () => {
    expect(text(render())).not.toContain('New Secure Temp Pass'); expect(h.post).not.toHaveBeenCalled();
    await button('Send Credentials').props.onClick();
    expect(h.post).toHaveBeenCalledWith('/users/applicants/9/resend-email', {});
    expect(text(render())).toContain('Applicant Credentials Dispatched'); expect(text(render())).toContain('confirmed@example.test');
    expect(text(render())).toContain('temporary password is available only in the applicant’s email');
    expect(text(render())).not.toContain('successfully delivered'); expect(button('Copy')).toBeUndefined(); expect(h.alert).not.toHaveBeenCalled();
  });
  it('never renders plaintext even if an obsolete server unexpectedly includes it', async () => {
    h.post.mockResolvedValue({ data: { ...confirmed(), temp_pass: 'Do-not-display-this', password: 'Do-not-display-this' } });
    await button('Send Credentials').props.onClick(); expect(text(render())).not.toContain('Do-not-display-this');
  });
  it.each([{ success: false }, { email_dispatched: false }, { email_dispatched: 'true' }, { applicant_code: '' }])('rejects unconfirmed dispatch (%j)', async (extra) => {
    h.post.mockResolvedValue({ data: { ...confirmed(), ...extra } }); await button('Send Credentials').props.onClick();
    expect(text(render())).not.toContain('Applicant Credentials Dispatched'); expect(button('Send Credentials')).toBeDefined();
    expect(h.alert).toHaveBeenCalledWith(expect.stringContaining('not confirmed'));
  });
  it.each([403, 409, 503])('shows the backend failure (%s), retaining the resend dialog without inventing credentials', async (status) => {
    h.post.mockRejectedValue({ response: { status, data: { detail: 'Password changed, but credential email delivery failed; retry resend.' } } });
    await button('Send Credentials').props.onClick();
    expect(text(render())).not.toContain('Applicant Credentials Dispatched'); expect(button('Send Credentials')).toBeDefined();
    expect(h.alert).toHaveBeenCalledWith('Password changed, but credential email delivery failed; retry resend.');
    expect(h.post).toHaveBeenCalledOnce();
  });
  it('does not confirm dispatch after network failure', async () => {
    h.post.mockRejectedValue(new Error('Network Error')); await button('Send Credentials').props.onClick();
    expect(h.alert).toHaveBeenCalledWith('Network Error'); expect(text(render())).not.toContain('Applicant Credentials Dispatched');
  });
});

describe('Management official name corrections (mocked API only)', () => {
  const target = { user_id: 28, agency_id: 2, is_super_admin: false, full_name: 'Ordinary Staff',
    email: 'ordinary@example.test', department_name: 'Operations', role_names: ['Recruitment'], status: 'Active' };
  const self = { ...target, user_id: 27, full_name: 'Manager', role_names: ['Recruitment', 'Management'] };
  let actor: any;
  let rows: any[];
  let props: any;
  const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  const render = () => { h.cursor = 0; return UserManagement(props); };
  const load = async () => { render(); h.effects.splice(0).forEach((effect) => effect()); await flush(); return render(); };
  const button = (label: string) => nodes(render()).find((n) => n.type === 'button' && text(n) === label);
  const open = (name = target.full_name) => {
    const row = nodes(render()).find((n) => n.type === 'tr' && text(n).includes(name));
    nodes(row).find((n) => n.type === 'button' && n.props.title === 'Edit Roles').props.onClick();
  };
  const nameInput = () => nodes(render()).find((n) => n.type === 'input' && n.props.id === 'edit-staff-full-name');
  const changeName = (value: string) => nameInput().props.onChange({ target: { value } });
  beforeEach(() => {
    vi.resetAllMocks(); h.slots = []; h.effects = []; h.cursor = 0; vi.stubGlobal('alert', h.alert);
    actor = { ...self }; rows = [target, self];
    props = { currentUserName: 'Manager', addActivityLog: vi.fn(), globalStaff: rows, applicants: [], updateApplicant: vi.fn() };
    h.get.mockImplementation(async (url) => ({ data: url === '/users/me' ? actor : url === '/users' ? rows : [] }));
    h.put.mockImplementation(async (_url, payload) => ({ data: { ...target, full_name: payload.fullName || target.full_name } }));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('allows multi-role Management to correct another ordinary same-tenant staff name', async () => {
    await load(); open(); expect(nameInput().props.readOnly).toBe(false);
    changeName('  Corrected Official Name  '); await button('Save Changes').props.onClick();
    expect(h.put).toHaveBeenCalledExactlyOnceWith('/users/28', { fullName: 'Corrected Official Name' });
    expect(props.addActivityLog).toHaveBeenCalledOnce(); expect(text(render())).not.toContain('Edit Staff Account');
    expect(h.get.mock.calls.filter(([url]) => url === '/users')).toHaveLength(2);
  });
  it('keeps names read-only for Admin without Management, even in a Management department', async () => {
    actor = { ...self, role_names: ['Admin'], department_name: 'Executive Management' };
    await load(); open(); expect(nameInput().props.readOnly).toBe(true);
    changeName('Unpermitted'); await button('Save Changes').props.onClick();
    expect(h.put).not.toHaveBeenCalled(); expect(text(render())).toContain('Management permission');
  });
  it('identifies self by verified user ID, keeping own name read-only and save disabled', async () => {
    props.currentUserName = 'Different Display Name'; await load(); open('Manager');
    expect(nameInput().props.readOnly).toBe(true); expect(button('Save Changes').props.disabled).toBe(true);
    await button('Save Changes').props.onClick(); expect(h.put).not.toHaveBeenCalled();
  });
  it('does not confuse matching names or emails with self identity', async () => {
    actor = { ...self, full_name: target.full_name, email: target.email }; await load(); open();
    expect(nameInput().props.readOnly).toBe(false);
  });
  it('requires verified actor identity and an ordinary target within the same tenant', async () => {
    rows = [{ ...target, agency_id: 3 }]; props.globalStaff = rows; await load(); open();
    expect(nameInput().props.readOnly).toBe(true);
    changeName('Cross Tenant'); await button('Save Changes').props.onClick(); expect(h.put).not.toHaveBeenCalled();
  });
  it('leaves names read-only when /users/me fails', async () => {
    h.get.mockImplementation(async (url) => { if (url === '/users/me') throw new Error('offline'); return { data: url === '/users' ? rows : [] }; });
    await load(); open(); expect(nameInput().props.readOnly).toBe(true); expect(h.put).not.toHaveBeenCalled();
  });
  it('rejects a blank name before any update', async () => {
    await load(); open(); changeName('   '); await button('Save Changes').props.onClick();
    expect(h.put).not.toHaveBeenCalled(); expect(text(render())).toContain('must not be blank');
  });
  it('omits unchanged name and email while preserving role and department management', async () => {
    actor = { ...self, role_names: ['Admin'] }; await load(); open();
    const dept = nodes(render()).find((n) => n.type === 'input' && n.props.placeholder === 'e.g., Documentation Department');
    dept.props.onChange({ target: { value: 'Updated Department' } });
    nodes(render()).find((n) => n.type === 'button' && text(n).startsWith('Accounting')).props.onClick();
    await button('Save Changes').props.onClick();
    expect(h.put).toHaveBeenCalledExactlyOnceWith('/users/28', { roleNames: ['Recruitment', 'Accounting'], roleName: 'Recruitment, Accounting', department: 'Updated Department' });
    expect(h.put.mock.calls[0][1]).not.toHaveProperty('fullName'); expect(h.put.mock.calls[0][1]).not.toHaveProperty('email');
  });
  it('does not send a mutation for unchanged values or surrounding name whitespace', async () => {
    await load(); open(); changeName('  Ordinary Staff  '); await button('Save Changes').props.onClick();
    expect(h.put).not.toHaveBeenCalled(); expect(props.addActivityLog).not.toHaveBeenCalled();
  });
  it.each([403, 422, 503])('retains the dialog and reports server failure without success or refresh (%s)', async (status) => {
    await load(); open(); changeName('Corrected Name');
    const gets = h.get.mock.calls.length;
    h.put.mockRejectedValueOnce({ response: { status, data: { detail: `Server rejected update (${status})` } } });
    await button('Save Changes').props.onClick();
    expect(text(render())).toContain(`Server rejected update (${status})`); expect(nameInput()).toBeDefined();
    expect(props.addActivityLog).not.toHaveBeenCalled(); expect(h.get).toHaveBeenCalledTimes(gets); expect(h.put).toHaveBeenCalledOnce();
    if (status === 503) {
      expect(button('Save Changes').props.disabled).toBe(true); expect(text(render())).toContain('Synchronization may be incomplete');
      await button('Save Changes').props.onClick(); expect(h.put).toHaveBeenCalledOnce();
    }
  });
  it('renders FastAPI validation errors as readable text', async () => {
    await load(); open(); changeName('Corrected Name');
    h.put.mockRejectedValueOnce({ response: { status: 422, data: { detail: [{ loc: ['body', 'fullName'], msg: 'Official full name must not be blank' }] } } });
    await button('Save Changes').props.onClick(); expect(text(render())).toContain('Official full name must not be blank');
  });
  it('does not claim success or repeat a mutation after a network failure or unconfirmed response', async () => {
    await load(); open(); changeName('Corrected Name'); h.put.mockRejectedValueOnce(new Error('Network Error'));
    await button('Save Changes').props.onClick(); await button('Save Changes').props.onClick();
    expect(h.put).toHaveBeenCalledOnce(); expect(props.addActivityLog).not.toHaveBeenCalled(); expect(button('Save Changes').props.disabled).toBe(true);
    button('Cancel').props.onClick(); open(); changeName('Corrected Name'); h.put.mockResolvedValueOnce({ data: {} });
    await button('Save Changes').props.onClick(); expect(text(render())).toContain('could not be confirmed'); expect(props.addActivityLog).not.toHaveBeenCalled();
  });
  it('blocks duplicate submissions while saving', async () => {
    await load(); open(); changeName('Corrected Name'); let finish: any;
    h.put.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const pending = button('Save Changes').props.onClick(); await button('Saving...').props.onClick(); expect(h.put).toHaveBeenCalledOnce();
    finish({ data: { ...target, full_name: 'Corrected Name' } }); await pending;
  });
  it('filters platform identities from cached and fetched records without rendering their edit controls', async () => {
    const platform = { ...target, user_id: 99, full_name: 'Protected Platform Identity', is_super_admin: true };
    rows = [target, platform]; props.globalStaff = rows;
    expect(text(render())).not.toContain(platform.full_name); await load(); expect(text(render())).not.toContain(platform.full_name);
    expect(nodes(render()).filter((n) => n.type === 'button' && n.props.title === 'Edit Roles')).toHaveLength(1);
  });
  it('does not expose edit controls for an account whose ordinary classification is missing', async () => {
    rows = [{ ...target, is_super_admin: undefined }]; props.globalStaff = rows; await load();
    expect(text(render())).not.toContain(target.full_name);
    expect(nodes(render()).some((n) => n.type === 'button' && n.props.title === 'Edit Roles')).toBe(false);
  });
  it('does not rewrite an existing padded official name when only department changes', async () => {
    rows = [{ ...target, full_name: '  Ordinary Staff  ' }]; props.globalStaff = rows; await load(); open();
    nodes(render()).find((n) => n.type === 'input' && n.props.placeholder === 'e.g., Documentation Department').props.onChange({ target: { value: 'New Department' } });
    await button('Save Changes').props.onClick(); expect(h.put).toHaveBeenCalledExactlyOnceWith('/users/28', { department: 'New Department' });
  });
  it('preserves the existing staff status update payload', async () => {
    await load();
    const row = nodes(render()).find((n) => n.type === 'tr' && text(n).includes(target.full_name));
    await nodes(row).find((n) => n.type === 'button' && n.props.title === 'Deactivate Access').props.onClick();
    expect(h.put).toHaveBeenCalledExactlyOnceWith('/users/28', { status: 'Inactive' });
    expect(props.addActivityLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'Access Revoked' }));
  });
});
