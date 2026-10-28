import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, post: vi.fn(), get: vi.fn(), signIn: vi.fn(), updateUser: vi.fn(), signOut: vi.fn() }));
vi.mock('../../lib/api', () => ({ api: { get: h.get, post: h.post } }));
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { signInWithPassword: h.signIn, updateUser: h.updateUser, signOut: h.signOut } } }));
vi.mock('react', async (original) => ({ ...(await original() as any),
  useState: (initial: any) => {
    const index = h.cursor++;
    if (!(index in h.slots)) h.slots[index] = initial;
    return [h.slots[index], (value: any) => { h.slots[index] = typeof value === 'function' ? value(h.slots[index]) : value; }];
  },
  useRef: (initial: any) => { const index = h.cursor++; return h.slots[index] ?? (h.slots[index] = { current: initial }); },
}));
import LoginScreen from './LoginScreen';

const account = { id: '00000000-0000-0000-0000-000000000123', email: 'manager@example.test' };
const mockPassword = 'Mock-Only-Password-123!';
function nodes(tree: any): any[] {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
}
const text = (tree: any): string => tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : [tree.props?.children].flat(Infinity).map(text).join(' ').replace(/\s+/g, ' ').trim();

describe('existing password dialog, PF09 staff confirmation (mocked only)', () => {
  let props: any;
  const render = () => { h.cursor = 0; return LoginScreen(props); };
  const button = (label: string) => nodes(render()).find((n) => n.type === 'button' && text(n) === label);
  const input = (placeholder: string, value: string) => nodes(render()).find((n) => n.type === 'input' && n.props.placeholder === placeholder).props.onChange({ target: { value } });
  const submit = () => nodes(render()).find((n) => n.type === 'form').props.onSubmit({ preventDefault() {} });
  const fill = () => { input('Enter your new private password', mockPassword); input('Re-type your new private password', mockPassword); };
  beforeEach(() => {
    vi.resetAllMocks(); h.slots = []; h.cursor = 0;
    h.post.mockResolvedValue({ data: { success: true, must_change_password: false } });
    h.signIn.mockResolvedValue({ data: { user: account }, error: null });
    h.updateUser.mockResolvedValue({ error: null }); h.signOut.mockResolvedValue({});
    props = { onLogin: vi.fn(), onBack: vi.fn(), onPasswordChanged: vi.fn().mockResolvedValue(undefined), onRetryOnboarding: vi.fn().mockResolvedValue(undefined),
      passwordSetupLabel: 'First-login setup · Step 1 of 2',
      requiredPasswordChange: { user: account, role: 'Management', roles: ['Management'], name: 'Example Manager', isSuper: false } };
  });
  it('reuses the existing password policy and dialog with recovery controls, without showing another login form', () => {
    expect(text(render())).toContain('Set Your Private Password'); expect(text(render())).toContain('Step 1 of 2');
    expect(nodes(render()).filter((n) => n.type === 'form')).toHaveLength(1);
    expect(button('Refresh setup status')).toBeDefined(); button('Sign out').props.onClick(); expect(props.onBack).toHaveBeenCalledOnce();
  });
  it('requires backend PF06 confirmation, recovers the session, then requests authoritative onboarding refresh', async () => {
    fill(); await submit();
    expect(h.post).toHaveBeenCalledWith('/users/change-password', { new_password: mockPassword });
    expect(h.updateUser).not.toHaveBeenCalled();
    expect(h.signIn).toHaveBeenCalledWith({ email: account.email, password: mockPassword });
    expect(h.post.mock.invocationCallOrder[0]).toBeLessThan(h.signIn.mock.invocationCallOrder[0]);
    expect(h.signIn.mock.invocationCallOrder[0]).toBeLessThan(props.onPasswordChanged.mock.invocationCallOrder[0]);
    expect(props.onPasswordChanged).toHaveBeenCalledOnce(); expect(props.onLogin).not.toHaveBeenCalled();
    expect(h.post.mock.calls.every(([url]) => !url.includes('pert-configuration'))).toBe(true);
  });
  it.each([503, 401, 403, 422, undefined])('stays in password change after backend failure (%s)', async (status) => {
    fill(); h.post.mockRejectedValueOnce(status ? { response: { status } } : new Error('Network Error'));
    await submit(); expect(props.onPasswordChanged).not.toHaveBeenCalled(); expect(props.onLogin).not.toHaveBeenCalled();
    expect(h.signIn).not.toHaveBeenCalled(); expect(h.updateUser).not.toHaveBeenCalled();
    expect(text(render())).toContain('Set Your Private Password'); expect(nodes(render()).some((n) => n.props?.role === 'alert')).toBe(true);
  });
  it('rejects unconfirmed success and failed session recovery instead of assuming local metadata is sufficient', async () => {
    fill(); h.post.mockResolvedValueOnce({ data: { success: true } }); await submit();
    expect(text(render())).toContain('not confirmed by the backend'); expect(h.signIn).not.toHaveBeenCalled();
    h.signIn.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Invalid credentials' } }); await submit();
    expect(text(render())).toContain('session recovery failed'); expect(props.onPasswordChanged).not.toHaveBeenCalled();
  });
  it('remains in the existing dialog if authoritative refresh fails or the password requirement remains', async () => {
    fill(); props.onPasswordChanged.mockRejectedValueOnce(new Error('Password still required by backend'));
    await submit(); expect(text(render())).toContain('Password still required by backend'); expect(props.onLogin).not.toHaveBeenCalled();
    const calls = h.post.mock.calls.length; await button('Refresh setup status').props.onClick();
    expect(props.onRetryOnboarding).toHaveBeenCalledOnce(); expect(h.post).toHaveBeenCalledTimes(calls);
  });
  it('prevents invalid inputs and duplicate password requests while keeping sign out accessible', async () => {
    input('Enter your new private password', 'weak'); input('Re-type your new private password', 'weak');
    await submit(); expect(h.post).not.toHaveBeenCalled(); fill();
    let finish: any; h.post.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const pending = submit(); await submit(); expect(h.post).toHaveBeenCalledOnce();
    expect(nodes(render()).find((n) => n.type === 'input' && n.props.placeholder === 'Enter your new private password').props.disabled).toBe(true);
    expect(button('Sign out')).toBeDefined();
    finish({ data: { success: true, must_change_password: false } }); await pending;
  });
  it.each([true, false])('delegates tenant staff to the authoritative gate regardless of cached password flag (%s)', async (flag) => {
    props = { onLogin: vi.fn() };
    h.signIn.mockResolvedValue({ data: { user: { ...account, app_metadata: { must_change_password: !flag },
      user_metadata: { must_change_password: flag, roles: ['Recruitment', 'Management'] } } }, error: null });
    nodes(render()).find((n) => n.type === 'button' && text(n).startsWith('Agency Staff')).props.onClick();
    input('Enter your email address', account.email); input('Enter your password', mockPassword); await submit();
    expect(props.onLogin).toHaveBeenCalledWith('Recruitment', account.email, undefined, false, ['Recruitment', 'Management'], false);
    expect(text(render())).not.toContain('Set Your Private Password');
  });
  it('preserves the existing applicant temporary-password prompt', async () => {
    props = { onLogin: vi.fn() };
    h.get.mockResolvedValue({ data: { applicant_id: 9, email: 'applicant@example.test', is_active: true } });
    h.signIn.mockResolvedValue({ data: { user: { ...account, user_metadata: { role: 'Applicant', must_change_password: true } } }, error: null });
    nodes(render()).find((n) => n.type === 'button' && text(n).startsWith('Applicant')).props.onClick();
    input('e.g. APP-2026-FPT-00028', 'APP-2026-MOCK-00009'); input('Enter your password', mockPassword); await submit();
    expect(text(render())).toContain('Set Your Private Password'); expect(props.onLogin).not.toHaveBeenCalled();
  });
  it('preserves the existing Super Admin password prompt', async () => {
    props = { onLogin: vi.fn() };
    h.signIn.mockResolvedValue({ data: { user: { ...account, app_metadata: { is_super_admin: true, must_change_password: true },
      user_metadata: { roles: ['Management'] } } }, error: null });
    nodes(render()).find((n) => n.type === 'button' && text(n).startsWith('Agency Staff')).props.onClick();
    input('Enter your email address', account.email); input('Enter your password', mockPassword); await submit();
    expect(text(render())).toContain('Set Your Private Password'); expect(props.onLogin).not.toHaveBeenCalled();
  });
});
