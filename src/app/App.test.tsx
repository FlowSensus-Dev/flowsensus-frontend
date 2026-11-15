import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, effects: [] as any[], path: '/app/forecast',
  get: vi.fn(), post: vi.fn(), getSession: vi.fn(), getUser: vi.fn(), signOut: vi.fn(), navigate: vi.fn(),
  authEvent: null as any, storageRead: vi.fn(), unsubscribe: vi.fn() }));
vi.mock('../lib/api', () => ({ api: { get: h.get, post: h.post } }));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: h.getSession, getUser: h.getUser, signOut: h.signOut,
  onAuthStateChange: (callback: any) => { h.authEvent = callback; return { data: { subscription: { unsubscribe: h.unsubscribe } } }; },
} } }));
vi.mock('./components/LoginScreen', () => ({ default: () => null }));
vi.mock('./components/AppShell', () => ({ default: () => null }));
vi.mock('./components/StaffOnboardingGate', () => ({ default: () => null }));
vi.mock('./components/ApplicantPortal', () => ({ default: () => null }));
vi.mock('./components/SuperAdminDashboard', () => ({ default: () => null }));
vi.mock('react-router', () => ({ useLocation: () => ({ pathname: h.path }), useNavigate: () => h.navigate }));
vi.mock('react', async (original) => ({ ...(await original() as any),
  useState: (initial: any) => {
    const index = h.cursor++;
    if (!(index in h.slots)) h.slots[index] = typeof initial === 'function' ? initial() : initial;
    return [h.slots[index], (value: any) => { h.slots[index] = typeof value === 'function' ? value(h.slots[index]) : value; }];
  },
  useRef: (initial: any) => { const index = h.cursor++; return h.slots[index] ?? (h.slots[index] = { current: initial }); },
  useEffect: (effect: any, deps: any[]) => {
    const index = h.cursor++; const previous = h.slots[index];
    if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
      const slot = { deps, cleanup: previous?.cleanup }; h.slots[index] = slot;
      h.effects.push(() => { if (h.slots[index] === slot) { previous?.cleanup?.(); slot.cleanup = effect(); } });
    }
  },
}));
import App from './App';
import AppShell from './components/AppShell';
import LoginScreen from './components/LoginScreen';
import StaffOnboardingGate from './components/StaffOnboardingGate';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import ApplicantPortal from './components/ApplicantPortal';

const platform = { id: 'platform-subject', email: 'operator@example.test', app_metadata: { is_super_admin: true }, user_metadata: { full_name: 'Platform Operator' } };
const staff = { id: 'staff-subject', email: 'manager@example.test', app_metadata: { is_super_admin: false }, user_metadata: { roles: ['Recruitment', 'Management'] } };
function nodes(tree: any): any[] { return !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)]; }
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

describe('PF17S3 App platform isolation (mocked Auth and API)', () => {
  const render = () => { h.cursor = 0; return App(); };
  const node = (type: any) => nodes(render()).find((n) => n.type === type);
  const settle = async () => {
    for (let i = 0; i < 4; i++) { render(); h.effects.splice(0).forEach((effect) => effect()); await flush(); }
  };
  beforeEach(() => {
    vi.resetAllMocks(); vi.useFakeTimers(); h.slots = []; h.effects = []; h.cursor = 0; h.path = '/app/forecast';
    h.navigate.mockImplementation((path) => { h.path = path; });
    h.getSession.mockResolvedValue({ data: { session: { user: platform } } });
    h.getUser.mockResolvedValue({ data: { user: platform }, error: null });
    h.get.mockResolvedValue({ data: [] }); h.post.mockResolvedValue({ data: { success: true } });
    h.signOut.mockResolvedValue({ error: null }); h.storageRead.mockReturnValue(null);
    vi.stubGlobal('sessionStorage', { getItem: h.storageRead, setItem: vi.fn(), removeItem: vi.fn() });
    vi.stubGlobal('window', { location: { get pathname() { return h.path; } }, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });
  afterEach(() => { h.slots.forEach((slot) => slot?.cleanup?.()); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it.each(['/app/forecast', '/app/users', '/app/onboarding/pert', '/register', '/super-admin'])('restores platform Auth to its console from %s without tenant requests or cache hydration', async (path) => {
    h.path = path; await settle();
    expect(node(SuperAdminDashboard)).toBeDefined(); expect(node(AppShell)).toBeUndefined(); expect(node(StaffOnboardingGate)).toBeUndefined();
    expect(h.path).toBe('/super-admin'); expect(h.get).not.toHaveBeenCalled(); expect(h.post).not.toHaveBeenCalled();
    expect(h.storageRead).not.toHaveBeenCalled(); expect(node(SuperAdminDashboard).props.onSwitchRole).toBeUndefined();
    h.path = '/app/applicants'; await settle(); expect(h.path).toBe('/super-admin'); expect(node(AppShell)).toBeUndefined();
  });
  it.each([undefined, false, 'true', 1])('does not grant platform access to the old email or user_metadata with app_metadata flag %s', async (flag) => {
    h.getSession.mockResolvedValue({ data: { session: { user: { ...staff, email: 'admin@findstaff.ph', app_metadata: { is_super_admin: flag },
      user_metadata: { ...staff.user_metadata, is_super_admin: true } } } } });
    await settle(); expect(node(SuperAdminDashboard)).toBeUndefined(); expect(node(AppShell)).toBeDefined();
    expect(node(StaffOnboardingGate).props.roles).toEqual(['Recruitment', 'Management']); expect(node(StaffOnboardingGate).props.bypass).toBeUndefined();
    expect(h.path).toBe('/app/forecast');
  });
  it('interactive completion uses fresh Auth identity even when a callback claims tenant roles', async () => {
    h.getSession.mockResolvedValue({ data: { session: null } }); await settle();
    await node(LoginScreen).props.onLogin('Management', 'Operator', undefined, false, ['Management']); await settle();
    expect(h.getUser).toHaveBeenCalledOnce(); expect(node(SuperAdminDashboard)).toBeDefined();
    expect(node(AppShell)).toBeUndefined(); expect(h.get).not.toHaveBeenCalled();
    expect(node(SuperAdminDashboard).props.currentUserName).toBe('Platform Operator');
    expect(node(SuperAdminDashboard).props.currentUserEmail).toBe('operator@example.test');
  });
  it('passes restored authenticated platform identity and updates it on token refresh', async () => {
    await settle();
    expect(node(SuperAdminDashboard).props).toMatchObject({ currentUserName: 'Platform Operator', currentUserEmail: 'operator@example.test' });
    h.authEvent('TOKEN_REFRESHED', { user: { ...platform, email: 'updated@example.test', user_metadata: { full_name: 'Updated Operator' } } });
    await settle();
    expect(node(SuperAdminDashboard).props).toMatchObject({ currentUserName: 'Updated Operator', currentUserEmail: 'updated@example.test' });
    expect(h.get).not.toHaveBeenCalled();
  });
  it('clears platform identity on logout without reusing email in a later session', async () => {
    await settle(); await node(SuperAdminDashboard).props.onLogout(); await settle();
    expect(h.signOut).toHaveBeenCalledOnce(); expect(node(SuperAdminDashboard)).toBeUndefined();
    h.authEvent('SIGNED_IN', { user: { ...platform, email: undefined, user_metadata: {} } }); await settle();
    expect(node(SuperAdminDashboard).props).toMatchObject({ currentUserName: 'Platform administrator', currentUserEmail: '' });
  });
  it('does not accept a callback privilege claim without the Auth flag, preserving tenant multi-role navigation', async () => {
    h.getSession.mockResolvedValue({ data: { session: null } }); h.getUser.mockResolvedValue({ data: { user: staff }, error: null }); await settle();
    await node(LoginScreen).props.onLogin('Recruitment', 'Manager', undefined, true, ['Recruitment', 'Management']); await settle();
    expect(node(SuperAdminDashboard)).toBeUndefined(); expect(node(AppShell).props.currentUserRoles).toEqual(['Recruitment', 'Management']);
    expect(node(StaffOnboardingGate).props.subject).toBe(staff.id);
  });
  it('keeps applicant login in its existing portal without tenant or platform requests', async () => {
    h.getSession.mockResolvedValue({ data: { session: null } });
    h.getUser.mockResolvedValue({ data: { user: { ...staff, user_metadata: { roles: ['Applicant'], applicant_id: 9 } } }, error: null }); await settle();
    await node(LoginScreen).props.onLogin('Applicant', 'Applicant', '9', false, ['Applicant']); await settle();
    expect(node(ApplicantPortal).props.applicantId).toBe('9'); expect(node(SuperAdminDashboard)).toBeUndefined();
    expect(node(AppShell)).toBeUndefined(); expect(h.get).not.toHaveBeenCalled();
  });
  it('does not grant console access when fresh login confirmation fails', async () => {
    h.getSession.mockResolvedValue({ data: { session: null } }); h.getUser.mockResolvedValue({ data: { user: null }, error: new Error('Expired') }); await settle();
    await expect(node(LoginScreen).props.onLogin('', 'Operator', undefined, true, [])).rejects.toThrow('could not be verified');
    await settle(); expect(node(SuperAdminDashboard)).toBeUndefined(); expect(node(AppShell)).toBeUndefined();
    expect(h.get).not.toHaveBeenCalled();
  });
  it('keeps restored platform password changes in the existing dialog', async () => {
    h.getSession.mockResolvedValue({ data: { session: { user: { ...platform, app_metadata: { is_super_admin: true, must_change_password: true } } } } });
    await settle(); expect(node(LoginScreen).props.requiredPasswordChange.isSuper).toBe(true);
    expect(node(SuperAdminDashboard)).toBeUndefined(); expect(node(AppShell)).toBeUndefined(); expect(h.get).not.toHaveBeenCalled();
  });
  it('rechecks platform identity on token refresh and stops tenant prefetches immediately', async () => {
    h.getSession.mockResolvedValue({ data: { session: { user: staff } } }); await settle(); h.get.mockClear();
    h.authEvent('TOKEN_REFRESHED', { user: { ...platform, id: staff.id } }); await settle(); await vi.advanceTimersByTimeAsync(0);
    expect(node(SuperAdminDashboard)).toBeDefined(); expect(node(AppShell)).toBeUndefined(); expect(h.get).not.toHaveBeenCalled();
  });
  it('drops platform access when Auth removes the flag or expires the session', async () => {
    await settle(); h.authEvent('TOKEN_REFRESHED', { user: { ...platform, app_metadata: { is_super_admin: false } } }); await settle();
    expect(node(SuperAdminDashboard)).toBeUndefined(); expect(node(AppShell)).toBeUndefined(); expect(node(LoginScreen)).toBeDefined();
    h.authEvent('SIGNED_OUT', null); await settle(); expect(node(SuperAdminDashboard)).toBeUndefined();
  });

  describe('Financial creation through AppShell (mocked authenticated API)', () => {
    const expense = { applicantId: '201', purpose: 'Document Processing', amount: 1250.50, currency: 'PESO',
      type: 'expense', referenceNo: 'REF-TEST-27', date: '2026-11-11', remarks: 'Synthetic transaction',
      status: 'approved', recordedBy: 'Display name only' };
    const businessPayload = { applicant_id: 201, payment_type: 'Document Processing', amount: 1250.50,
      currency: 'PHP', transaction_type: 'FEE', reference_no: 'REF-TEST-27', transacted_at: '2026-11-11' };
    const financialCalls = () => h.post.mock.calls.filter(([url]) => url === '/financial/records');
    beforeEach(() => {
      vi.setSystemTime(new Date('2026-11-11T00:00:00Z')); h.path = '/app/expenses';
      const accountant = { ...staff, app_metadata: { agency_id: 7, is_super_admin: false },
        user_metadata: { full_name: 'Verified Accountant', roles: ['Accounting'] } };
      h.getSession.mockResolvedValue({ data: { session: { user: accountant } } });
      h.getUser.mockResolvedValue({ data: { user: accountant }, error: null });
      h.get.mockImplementation(async (url) => ({ data: url === '/financial/records' ? [
        { financial_record_id: 41, applicant_id: 201, payment_type: 'Existing Fee', amount: 50,
          transacted_at: '2026-10-05', recorded_by: 1 },
      ] : [] }));
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => { vi.restoreAllMocks(); });

    it.each([
      ['expense', 'FEE'], ['placement_fee', 'PLACEMENT_FEE'], ['cash_advance', 'CASH_ADVANCE'], ['deduction', 'FEE'],
    ])('preserves %s business fields without sending recorder identity', async (type, transactionType) => {
      await settle(); const before = structuredClone(node(AppShell).props.expenses);
      h.post.mockResolvedValue({ data: { transaction_id: 910, recorded_by: 27 } });
      await node(AppShell).props.addExpense({ ...expense, type }); await settle();
      expect(financialCalls()).toEqual([['/financial/records', { ...businessPayload, transaction_type: transactionType }]]);
      expect(node(AppShell).props.expenses[0]).toMatchObject({ id: 'EXP-910', amount: 1250.50, currency: 'PESO', type });
      expect(node(AppShell).props.expenses.slice(1)).toEqual(before);
    });
    it('does not forward supplied recorder hints, applicant identity as recorder, Auth UUIDs or agency overrides', async () => {
      await settle(); h.post.mockResolvedValue({ data: { financial_record_id: 911, recorded_by: 27 } });
      await node(AppShell).props.addExpense({ ...expense, recorded_by: 1, recordedBy: 99,
        recorded_by_name: 'Unverified name', user_id: 99, auth_id: staff.id, agency_id: 99 });
      expect(financialCalls()).toEqual([['/financial/records', businessPayload]]);
      const payload = financialCalls()[0][1];
      for (const field of ['recorded_by', 'recordedBy', 'recorded_by_name', 'user_id', 'auth_id', 'agency_id']) expect(payload).not.toHaveProperty(field);
    });
    it('preserves required defaults and numeric amount conversion', async () => {
      await settle(); h.post.mockResolvedValue({ data: { financial_record_id: 912 } });
      await node(AppShell).props.addExpense({ ...expense, amount: '1250.50', purpose: '', referenceNo: '', date: undefined });
      expect(financialCalls()).toEqual([['/financial/records', { ...businessPayload, payment_type: 'Processing Fee',
        reference_no: null, transacted_at: '2026-11-11T00:00:00.000Z' }]]);
    });
    it.each(['financial_record_id', 'transaction_id'])('replaces the pending expense using the returned %s and caches the persisted record', async (idField) => {
      await settle(); let resolve!: (response: any) => void;
      h.post.mockReturnValue(new Promise((done) => { resolve = done; }));
      const submit = node(AppShell).props.addExpense(expense);
      expect(node(AppShell).props.expenses[0].id).toMatch(/^EXP-\d+-\d+$/);
      resolve({ data: { [idField]: 913, reference_no: 'SERVER-REF', recorded_by: 27 } });
      await submit; await settle();
      expect(node(AppShell).props.expenses[0]).toMatchObject({ id: 'EXP-913', referenceNo: 'SERVER-REF' });
      const cache = vi.mocked(sessionStorage.setItem).mock.calls.filter(([key]) => key === `fs_cache_expenses_${staff.id}`).at(-1)!;
      expect(JSON.parse(cache[1])[0]).toMatchObject({ id: 'EXP-913', referenceNo: 'SERVER-REF' });
      expect(financialCalls()[0][1]).not.toHaveProperty('recorded_by');
    });
    it.each(['', 'not-an-applicant', '0'])('rejects invalid applicant ID %j without a POST and restores existing expenses', async (applicantId) => {
      await settle(); const before = structuredClone(node(AppShell).props.expenses);
      await expect(node(AppShell).props.addExpense({ ...expense, applicantId })).rejects.toThrow('Invalid applicant ID');
      expect(financialCalls()).toHaveLength(0); expect(node(AppShell).props.expenses).toEqual(before);
    });
    it.each([400, 403, 409, 'network'])('rolls back a rejected %s creation and propagates the original error to the financial screen', async (status) => {
      await settle(); const before = structuredClone(node(AppShell).props.expenses);
      let reject!: (error: any) => void; h.post.mockReturnValue(new Promise((_done, fail) => { reject = fail; }));
      const error = status === 'network' ? new Error('Network unavailable') :
        Object.assign(new Error('Server rejected transaction'), { response: { status, data: { detail: 'Synthetic validation error' } } });
      const submit = node(AppShell).props.addExpense(expense); const rejection = expect(submit).rejects.toBe(error);
      expect(node(AppShell).props.expenses).toHaveLength(before.length + 1);
      reject(error); await rejection; await settle();
      expect(node(AppShell).props.expenses).toEqual(before); expect(financialCalls()).toEqual([['/financial/records', businessPayload]]);
      expect(console.warn).toHaveBeenCalledWith('Could not persist expense to backend:', error);
    });
  });
});
