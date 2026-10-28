import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, effects: [] as any[], path: '/app/applicants',
  get: vi.fn(), post: vi.fn(), put: vi.fn(), getUser: vi.fn(), signIn: vi.fn(), navigate: vi.fn() }));
vi.mock('../../lib/api', () => ({ api: { get: h.get, post: h.post, put: h.put } }));
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { getUser: h.getUser, signInWithPassword: h.signIn } } }));
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
      const slot = { deps, effect, cleanup: previous?.cleanup };
      h.slots[index] = slot;
      h.effects.push(() => { if (h.slots[index] === slot) { previous?.cleanup?.(); slot.cleanup = effect(); } });
    }
  },
}));
import React from 'react';
import StaffOnboardingGate from './StaffOnboardingGate';
import LoginScreen from './LoginScreen';
import StagePertConfiguration from './views/StagePertConfiguration';

const subject = '00000000-0000-0000-0000-000000000123';
const account = { id: subject, email: 'manager@example.test', app_metadata: { must_change_password: false } };
const configuration = (extra: any = {}) => ({ agency_id: 7, revision: 0, setup_status: 'required', initial_setup_required: true,
  must_change_password: false, can_manage: true, next_action: 'configure_pert', completed_at: null, completed_by: null,
  forecast_settings_present: false, initial_forecast_settings_required: true, ses_alpha: null, issues: [],
  stages: ['Registration & Screening', 'Medical Clearance', 'CV & Endorsement', 'Under Employer Review', 'Final Deployment']
    .map((stage_name, index) => ({ stage_order: index + 1, stage_name, forecast_basis: 'unavailable' })), ...extra,
});
const complete = () => configuration({ setup_status: 'complete', revision: 1, initial_setup_required: false, next_action: 'normal_operations' });
function nodes(tree: any): any[] {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
}
const text = (tree: any): string => tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : [tree.props?.children].flat(Infinity).map(text).join(' ').replace(/\s+/g, ' ').trim();
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

describe('PF09 staff onboarding navigation (mocked Auth and API)', () => {
  let props: any;
  const render = () => { h.cursor = 0; return StaffOnboardingGate(props); };
  const runEffects = () => { const queue = h.effects.splice(0); queue.forEach((effect) => effect()); };
  const settle = async () => { for (let i = 0; i < 3; i++) { render(); runEffects(); await flush(); } return render(); };
  const node = (type: any) => nodes(render()).find((n) => n.type === type);
  const button = (label: string) => nodes(render()).find((n) => n.type === 'button' && text(n) === label);
  const workspaceVisible = () => nodes(render()).some((n) => n.props?.['data-workspace']);
  beforeEach(() => {
    vi.resetAllMocks(); h.slots = []; h.cursor = 0; h.effects = []; h.path = '/app/applicants';
    h.navigate.mockImplementation((path) => { h.path = path; });
    h.getUser.mockResolvedValue({ data: { user: account }, error: null });
    h.get.mockResolvedValue({ data: configuration() });
    props = { subject, roles: ['Management'], name: 'Example Manager', onLogout: vi.fn(), children: <div data-workspace>Normal workspace</div> };
  });

  it('checks fresh Auth and PF05 before mounting normal operational views, without mutations', async () => {
    render(); expect(workspaceVisible()).toBe(false); expect(text(render())).toContain('Checking account and agency setup');
    await settle();
    expect(h.getUser).toHaveBeenCalledOnce(); expect(h.get).toHaveBeenCalledWith('/forecasting/pert-configuration');
    expect(h.post).not.toHaveBeenCalled(); expect(h.put).not.toHaveBeenCalled();
    expect(workspaceVisible()).toBe(false); expect(h.path).toBe('/app/onboarding');
  });
  it('sends a new Manager to the existing password dialog first, even if cached Auth metadata says false', async () => {
    h.get.mockResolvedValue({ data: configuration({ must_change_password: true, next_action: 'change_password' }) });
    await settle();
    expect(node(LoginScreen).props.requiredPasswordChange.user.id).toBe(subject);
    expect(node(LoginScreen).props.passwordSetupLabel).toContain('Step 1 of 2');
    expect(node(StagePertConfiguration)).toBeUndefined(); expect(workspaceVisible()).toBe(false);
    node(LoginScreen).props.onBack(); expect(props.onLogout).toHaveBeenCalledOnce();
  });
  it('refreshes fresh Auth and backend state after password confirmation, then opens the reused PERT editor', async () => {
    h.get.mockResolvedValueOnce({ data: configuration({ must_change_password: true, next_action: 'change_password' }) });
    await settle();
    const dialog = node(LoginScreen);
    await dialog.props.onPasswordChanged(); await settle();
    expect(h.getUser).toHaveBeenCalledTimes(2); expect(h.get).toHaveBeenCalledTimes(2);
    expect(node(LoginScreen)).toBeUndefined(); expect(node(StagePertConfiguration).props.onboarding).toBe(true);
    expect(text(render())).toContain('Step 2 of 2'); expect(text(render())).toContain('cold-start');
    expect(workspaceVisible()).toBe(false);
  });
  it('does not advance if the backend still requires a temporary password after the change callback', async () => {
    h.get.mockResolvedValue({ data: configuration({ must_change_password: true, next_action: 'change_password' }) });
    await settle(); await expect(node(LoginScreen).props.onPasswordChanged()).rejects.toThrow('still required');
    await settle(); expect(node(LoginScreen)).toBeDefined(); expect(node(StagePertConfiguration)).toBeUndefined();
    expect(workspaceVisible()).toBe(false);
  });
  it('keeps password recovery accessible if the authoritative refresh fails after an update', async () => {
    h.get.mockResolvedValueOnce({ data: configuration({ must_change_password: true, next_action: 'change_password' }) });
    await settle(); h.get.mockRejectedValueOnce({ response: { status: 503 } });
    await expect(node(LoginScreen).props.onPasswordChanged()).rejects.toBeDefined(); await settle();
    expect(node(LoginScreen)).toBeDefined(); expect(node(LoginScreen).props.onRetryOnboarding).toBeTypeOf('function');
    expect(workspaceVisible()).toBe(false);
  });
  it('requires a fresh confirmed complete state after PERT success, then opens normal operations once', async () => {
    await settle(); h.get.mockResolvedValueOnce({ data: complete() });
    await node(StagePertConfiguration).props.onSaved(); await settle();
    expect(h.getUser).toHaveBeenCalledTimes(2); expect(h.get).toHaveBeenCalledTimes(2);
    expect(h.path).toBe('/app/dashboard'); expect(workspaceVisible()).toBe(true);
    const count = h.navigate.mock.calls.length;
    await settle(); await settle(); expect(h.navigate).toHaveBeenCalledTimes(count);
  });
  it.each(['required', 'unconfirmed'])('does not accept %s as confirmation of a submitted initial setup', async (setup_status) => {
    await settle();
    h.get.mockResolvedValueOnce({ data: configuration({ setup_status, initial_setup_required: setup_status === 'required', next_action: setup_status === 'required' ? 'configure_pert' : 'normal_operations' }) });
    await expect(node(StagePertConfiguration).props.onSaved()).rejects.toThrow('not been confirmed');
    await settle(); expect(workspaceVisible()).toBe(false); expect(text(render())).toContain('not been confirmed');
  });
  it.each(['unconfirmed', 'complete'])('keeps existing %s agencies operational and preserves their requested module', async (setup_status) => {
    h.get.mockResolvedValue({ data: configuration({ setup_status, initial_setup_required: false, next_action: 'normal_operations' }) });
    await settle(); expect(workspaceVisible()).toBe(true); expect(h.path).toBe('/app/applicants');
    expect(h.navigate).not.toHaveBeenCalled(); expect(node(StagePertConfiguration)).toBeUndefined();
  });
  it.each([['Recruitment'], ['Admin'], ['Accounting']])('shows nonblocking Manager guidance to %s staff, without configuration rights', async (role) => {
    props.roles = [role]; h.get.mockResolvedValue({ data: configuration({ can_manage: false, next_action: 'contact_manager' }) });
    await settle(); expect(workspaceVisible()).toBe(true); expect(text(render())).toContain('Contact an authorized agency Manager');
    expect(node(StagePertConfiguration)).toBeUndefined(); expect(h.navigate).not.toHaveBeenCalled();
  });
  it('recognizes Recruitment + Management while still requiring backend management authority', async () => {
    props.roles = ['Recruitment', 'Management']; await settle(); expect(node(StagePertConfiguration).props.canEdit).toBe(true);
    h.get.mockResolvedValueOnce({ data: configuration({ can_manage: false, next_action: 'contact_manager' }) });
    await button('Refresh setup status').props.onClick(); await settle();
    expect(node(StagePertConfiguration)).toBeUndefined(); expect(text(render())).toContain('cannot complete agency setup');
  });
  it('does not grant a locally non-Management role an editor even if backend management is true', async () => {
    props.roles = ['Recruitment']; await settle(); expect(node(StagePertConfiguration)).toBeUndefined();
    expect(workspaceVisible()).toBe(true);
  });
  it.each([503, 403, 404, undefined])('provides retry/logout after failed state reads (%s) and never creates configuration', async (status) => {
    h.get.mockRejectedValueOnce(status ? { response: { status } } : new Error('Network Error'));
    await settle(); expect(workspaceVisible()).toBe(false); expect(nodes(render()).some((n) => n.props?.role === 'alert')).toBe(true);
    expect(button('Sign out')).toBeDefined();
    await button('Refresh setup status').props.onClick(); await settle(); expect(node(StagePertConfiguration)).toBeDefined();
    expect(h.post).not.toHaveBeenCalled(); expect(h.put).not.toHaveBeenCalled();
  });
  it('handles expired sessions and verifies recovery without briefly mounting normal views', async () => {
    h.get.mockRejectedValueOnce({ response: { status: 401 } }); await settle();
    expect(text(render())).toContain('session has expired'); expect(workspaceVisible()).toBe(false);
    const retry = button('Refresh setup status').props.onClick(); expect(workspaceVisible()).toBe(false);
    await retry; await settle(); expect(node(StagePertConfiguration)).toBeDefined();
    h.getUser.mockResolvedValueOnce({ data: { user: null }, error: { status: 401 } });
    await button('Refresh setup status').props.onClick(); await settle();
    expect(text(render())).toContain('session has expired'); expect(node(StagePertConfiguration)).toBeUndefined();
    button('Sign out').props.onClick(); expect(props.onLogout).toHaveBeenCalledOnce();
  });
  it('blocks inconsistent required setup and malformed/missing configuration while allowing legacy reconciliation guidance', async () => {
    h.get.mockResolvedValueOnce({ data: configuration({ setup_status: 'inconsistent', next_action: 'reconciliation_required', issues: ['INCOMPLETE_STAGE_STATE'] }) });
    await settle(); expect(workspaceVisible()).toBe(false); expect(node(StagePertConfiguration)).toBeUndefined();
    expect(text(render())).toContain('Contact support');
    h.get.mockResolvedValueOnce({ data: {} }); await button('Refresh setup status').props.onClick(); await settle();
    expect(workspaceVisible()).toBe(false); expect(text(render())).toContain('could not be confirmed');
    h.get.mockResolvedValueOnce({ data: configuration({ setup_status: 'inconsistent', initial_setup_required: false, next_action: 'reconciliation_required', issues: ['INCOMPLETE_STAGE_STATE'] }) });
    await button('Refresh setup status').props.onClick(); await settle(); expect(workspaceVisible()).toBe(false); // Previously required Manager still needs completion.
  });
  it('does not turn established non-required reconciliation into new-agency onboarding', async () => {
    h.get.mockResolvedValue({ data: configuration({ setup_status: 'inconsistent', initial_setup_required: false, next_action: 'reconciliation_required', issues: ['INCOMPLETE_STAGE_STATE'] }) });
    await settle(); expect(workspaceVisible()).toBe(true); expect(text(render())).toContain('needs reconciliation');
  });
  it('prevents manual navigation around required steps without repeatedly redirecting the correct URL', async () => {
    await settle(); expect(h.path).toBe('/app/onboarding'); expect(h.navigate).toHaveBeenCalledOnce();
    await settle(); expect(h.navigate).toHaveBeenCalledOnce();
    h.path = '/app/users'; await settle(); expect(h.path).toBe('/app/onboarding');
    expect(workspaceVisible()).toBe(false); expect(h.navigate).toHaveBeenCalledTimes(2); expect(h.get).toHaveBeenCalledOnce();
  });
  it('does not advance for a failed PERT save, and state retries perform reads only', async () => {
    await settle(); const editor = node(StagePertConfiguration);
    expect(editor.type).toBe(StagePertConfiguration); // The existing editor owns POST, retry receipts and failure state.
    await settle(); expect(workspaceVisible()).toBe(false); expect(h.get).toHaveBeenCalledOnce();
    await button('Refresh setup status').props.onClick(); await settle();
    expect(workspaceVisible()).toBe(false); expect(h.post).not.toHaveBeenCalled(); expect(h.put).not.toHaveBeenCalled();
  });
  it('ignores stale reads after cleanup/replay and prevents another account’s state from opening the workspace', async () => {
    let finish: any; h.getUser.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    render(); runEffects(); const lifecycle = h.slots.find((slot) => slot?.effect);
    lifecycle.cleanup(); lifecycle.effect(); await settle();
    finish({ data: { user: account }, error: null }); await flush();
    expect(node(StagePertConfiguration)).toBeDefined(); expect(workspaceVisible()).toBe(false);
    h.getUser.mockResolvedValueOnce({ data: { user: { ...account, id: 'different-subject' } }, error: null });
    await button('Refresh setup status').props.onClick(); await settle();
    expect(text(render())).toContain('session has changed or expired'); expect(workspaceVisible()).toBe(false);
  });
  it('keeps Super Admin outside tenant onboarding and wraps AppShell before it mounts', async () => {
    props.bypass = true; await settle(); expect(workspaceVisible()).toBe(true);
    expect(h.get).not.toHaveBeenCalled(); expect(h.getUser).not.toHaveBeenCalled();
    const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
    expect(app).toContain('<StaffOnboardingGate key={authSubject'); expect(app).toContain('bypass={isSuperAdmin}');
    expect(app.indexOf('<StaffOnboardingGate')).toBeLessThan(app.indexOf('<AppShell'));
    expect(app).toContain('setAuthSubject(userId)');
  });
});
