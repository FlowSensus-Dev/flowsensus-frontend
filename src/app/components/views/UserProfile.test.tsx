import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, effects: [] as any[],
  get: vi.fn(), post: vi.fn(), getUser: vi.fn(), signIn: vi.fn(), updateUser: vi.fn() }));
vi.mock('../../../lib/api', () => ({ api: { get: h.get, post: h.post } }));
vi.mock('../../../lib/supabase', () => ({ supabase: { auth: {
  getUser: h.getUser, signInWithPassword: h.signIn, updateUser: h.updateUser,
} } }));
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
      const slot = { deps, cleanup: previous?.cleanup };
      h.slots[index] = slot;
      h.effects.push(() => { previous?.cleanup?.(); slot.cleanup = effect(); });
    }
  },
}));
import UserProfile from './UserProfile';

function nodes(tree: any): any[] { return !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)]; }
const text = (tree: any): string => tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : [tree.props?.children].flat(Infinity).map(text).join(' ').replace(/\s+/g, ' ').trim();
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const roles = ['Recruitment', 'Admin', 'Accounting', 'Management'];
const profile = { user_id: 27, agency_id: 2, full_name: 'Verified Staff', email: 'verified@example.test',
  department_name: 'Executive Management', role_names: roles, phone_number: null, created_at: '2026-09-12T03:00:00Z' };
const account = { id: 'mock-auth-id', email: profile.email, created_at: profile.created_at };
const password = 'Mock-Only-Password-123!';
const allModules = [
  'Dashboard', 'Applicants', 'Applicant Registration', 'Screening Panel', 'Digital Exams',
  'Applicant Profiling', 'CV Encoding', 'Endorsement Tracker', 'Document Requirements',
  'Job Orders', 'Employer Profiles', 'Fit-to-Work', 'Document Validation', '3-2-1 Alerts',
  'Expense Ledger', 'Accounting Settings', 'Evaluation & Workflow', 'CV & Employer Hub',
  'Predictive Timeline', 'Audit Log', 'Operational Reports', 'User Management', 'Staff Account Profile',
];

describe('staff account profile (mocked API and Auth only)', () => {
  let props: any;
  const render = () => { h.cursor = 0; return UserProfile(props); };
  const effects = () => h.effects.splice(0).forEach((effect) => effect());
  const load = async () => { render(); effects(); await flush(); return render(); };
  const group = (label: string) => nodes(render()).find((n) => n.props?.['aria-label'] === label);
  const section = (id: string) => nodes(render()).find((n) => n.type === 'section' && n.props['aria-labelledby'] === id);
  const moduleLabels = () => nodes(section('role-permissions-heading')).filter((n) => n.type === 'li').map(text);
  const field = (label: string) => nodes(render()).find((n) => n.type === 'div' && n.props.children?.[0]?.type === 'dt' && text(n.props.children[0]) === label);
  const button = (label: string) => nodes(render()).find((n) => n.type === 'button' && text(n) === label);
  const input = (placeholder: string, value: string) => nodes(render()).find((n) => n.type === 'input' && n.props.placeholder === placeholder).props.onChange({ target: { value } });
  const fillPassword = () => { input('Enter current password', 'Mock-Current-123!'); input('Min. 8 characters', password); input('Re-enter new password', password); };
  beforeEach(() => {
    vi.resetAllMocks(); h.slots = []; h.effects = []; h.cursor = 0;
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-11T04:00:00Z'));
    h.get.mockResolvedValue({ data: profile });
    h.getUser.mockResolvedValue({ data: { user: account }, error: null });
    h.signIn.mockResolvedValue({ data: { user: account }, error: null });
    h.post.mockResolvedValue({ data: { success: true, must_change_password: false } });
    props = { currentUserName: 'Session Staff', currentUserRole: 'Recruitment', currentUserRoles: ['Recruitment'], showToast: vi.fn(), activityLogs: [] };
  });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('reads official identity from /users/me and displays the name, department and all four role badges once', async () => {
    await load();
    expect(h.get).toHaveBeenCalledExactlyOnceWith('/users/me'); expect(h.getUser).not.toHaveBeenCalled();
    expect(nodes(group('Profile system roles')).filter((n) => n.type === 'span').map(text)).toEqual(roles);
    for (const role of roles) {
      expect(nodes(render()).filter((n) => n.type === 'span' && text(n) === role)).toHaveLength(1);
    }
    expect(text(render()).split(profile.full_name)).toHaveLength(2);
    expect(text(render()).split(profile.department_name)).toHaveLength(2);
    expect(text(group('Official account details'))).toContain(profile.full_name);
    expect(text(field('Email Address'))).toContain(profile.email);
    expect(text(field('Employee ID'))).toContain('EMP-2026-027');
    expect(text(field('Join Date'))).toContain('September 12, 2026');
    expect(nodes(render()).filter((n) => n.type === 'dt').map(text)).toEqual(['Employee ID', 'Email Address', 'Join Date']);
    expect(field('Full Name')).toBeUndefined(); expect(field('Department')).toBeUndefined();
  });
  it('removes the phone field and value while keeping official details read-only with the neutral notice', async () => {
    h.get.mockResolvedValue({ data: { ...profile, phone_number: '+63 912 345 6789' } });
    await load();
    expect(field('Phone Number')).toBeUndefined(); expect(text(render())).not.toContain('Phone Number');
    expect(text(render())).not.toContain('+63 912 345 6789');
    expect(text(group('Official account details'))).toContain('Official account details are read-only on this page. Name corrections are handled through User Management.');
    expect(nodes(render()).filter((n) => n.type === 'input')).toHaveLength(3);
    expect(button('Edit')).toBeUndefined(); expect(button('Save')).toBeUndefined(); expect(button('Save Changes')).toBeUndefined();
    expect(props.showToast).not.toHaveBeenCalled();
    expect(nodes(section('change-password-heading')).filter((n) => n.type === 'h3').map(text)).toEqual(['Change Password']);
    expect(text(render())).not.toContain('Security Settings'); expect(h.post).not.toHaveBeenCalled();
  });
  it('does not invent employee identifiers, emails, dates or department for missing optional data', async () => {
    h.get.mockResolvedValue({ data: { full_name: 'Verified Staff', role_names: [] } }); await load();
    for (const label of ['Employee ID', 'Email Address', 'Join Date']) expect(text(field(label))).toContain('Not provided');
    expect(nodes(group('Official account details')).some((n) => n.type === 'p' && text(n) === 'Not provided')).toBe(true);
    expect(text(render())).not.toContain('@flowsensus.com');
  });
  it('retains the existing department fallback and safe invalid-date presentation', async () => {
    h.get.mockResolvedValue({ data: { ...profile, department_name: null, department: 'Operations', created_at: 'invalid-date' } });
    await load(); expect(text(group('Official account details'))).toContain('Operations');
    expect(text(field('Join Date'))).toContain('Not provided'); expect(text(render())).not.toContain('Invalid Date');
  });
  it('normalizes and deduplicates existing role aliases without treating department as permission', async () => {
    h.get.mockResolvedValue({ data: { ...profile, role_names: [' admin ', 'Admin', 'Finance & Accounting', 'accounting', 'Recruitment Officer', ''] } });
    await load(); expect(nodes(group('Profile system roles')).filter((n) => n.type === 'span').map(text)).toEqual(['Admin', 'Accounting', 'Recruitment']);
    expect(text(render())).not.toContain('Operational Reports'); expect(text(render())).not.toContain('All Modules (Read)');
  });
  it('keeps authoritative empty roles empty and unknown roles visible without invented entitlements', async () => {
    h.get.mockResolvedValue({ data: { ...profile, role_names: [] } }); await load();
    expect(text(group('Profile system roles'))).toContain('No system roles assigned'); expect(text(render())).not.toContain('Operational Reports');
    props.currentUserName = 'Next Staff'; h.get.mockResolvedValue({ data: { ...profile, role_names: ['Unknown Role'] } }); await load();
    expect(text(group('Profile system roles'))).toContain('Unknown Role'); expect(text(render())).toContain('No recognized staff role permissions');
  });
  it('labels session arrays as presentation fallback when the response lacks role_names', async () => {
    props.currentUserRoles = roles;
    h.get.mockResolvedValue({ data: { ...profile, role_names: undefined } }); await load();
    expect(text(group('Profile system roles'))).toContain('Management'); expect(text(render())).toContain('System roles shown from this session');
  });
  it('uses the same workflow access rules as navigation for its permission summary', async () => {
    h.get.mockResolvedValue({ data: { ...profile, role_names: ['Recruitment'] } });
    props.workflowPermissions = { ocr: ['Recruitment'], screening: ['Admin'] }; await load();
    expect(text(render())).toContain('Document Validation'); expect(text(render())).not.toContain('Screening Panel'); expect(text(render())).not.toContain('Operational Reports');
  });
  it.each([
    ['Recruitment', ['Dashboard', 'Applicants', 'Applicant Registration', 'Screening Panel', 'Digital Exams', 'Applicant Profiling', 'CV Encoding', 'Endorsement Tracker', 'Staff Account Profile']],
    ['Admin', ['Dashboard', 'Applicants', 'Digital Exams', 'Applicant Profiling', 'Endorsement Tracker', 'Document Requirements', 'Job Orders', 'Employer Profiles', 'Fit-to-Work', 'Document Validation', '3-2-1 Alerts', 'Staff Account Profile']],
    ['Accounting', ['Dashboard', 'Applicants', 'Expense Ledger', 'Accounting Settings', 'Staff Account Profile']],
    ['Management', allModules],
  ])('preserves the complete ordered informational module list for %s', async (role, expected) => {
    h.get.mockResolvedValue({ data: { ...profile, role_names: [role] } }); await load();
    expect(moduleLabels()).toEqual(expected);
    const permissions = section('role-permissions-heading');
    expect(text(permissions)).toContain('Module access based on assigned system roles and current workflow settings.');
    expect(nodes(permissions).filter((n) => ['a', 'button'].includes(n.type) || n.props?.onClick)).toHaveLength(0);
    expect(nodes(permissions).filter((n) => n.type === 'span' && roles.includes(text(n)))).toHaveLength(0);
    expect(nodes(group('Profile system roles')).filter((n) => n.type === 'span').map(text)).toEqual([role]);
  });
  it('combines multiple role permissions without duplicates or granting Management-only modules', async () => {
    h.get.mockResolvedValue({ data: { ...profile, role_names: ['Recruitment', 'Admin', 'Accounting'] } });
    props.workflowPermissions = { reports: ['Recruitment'], screening: ['Accounting'] }; await load();
    expect(moduleLabels()).toEqual(allModules.filter((label) => ![
      'Evaluation & Workflow', 'CV & Employer Hub', 'Predictive Timeline', 'Audit Log', 'Operational Reports', 'User Management',
    ].includes(label)));
    expect(new Set(moduleLabels()).size).toBe(moduleLabels().length);
  });
  it('shows loading and an actionable failure; retries without claiming success', async () => {
    h.get.mockRejectedValueOnce(new Error('offline'));
    expect(text(render())).toContain('Loading account profile'); effects(); await flush();
    expect(text(render())).toContain('could not be loaded'); expect(text(field('Join Date'))).toContain('Not provided');
    button('Retry profile').props.onClick(); await load(); expect(text(render())).not.toContain('could not be loaded'); expect(h.get).toHaveBeenCalledTimes(2);
    expect(props.showToast).not.toHaveBeenCalled();
  });
  it('ignores responses after unmount and stale responses after a profile reload', async () => {
    let finish: any; h.get.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    render(); effects(); const profileSlot = h.slots[0];
    h.slots.filter((slot) => slot?.cleanup).forEach((slot) => slot.cleanup());
    finish({ data: profile }); await flush(); expect(h.slots[0]).toBe(profileSlot);
    h.slots = []; h.effects = []; h.get.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    render(); effects(); props.currentUserName = 'New Staff'; await load();
    finish({ data: { ...profile, full_name: 'Stale Staff' } }); await flush();
    expect(text(group('Official account details'))).toContain('Verified Staff'); expect(text(render())).not.toContain('Stale Staff');
  });
  it('preserves real activity counts and recent events', async () => {
    props.activityLogs = [
      { id: '1', performedBy: 'Session Staff', timestamp: new Date().toISOString(), action: 'Existing Action', details: 'Existing details' },
      { id: '2', performedBy: 'Another Staff', timestamp: new Date().toISOString(), action: 'Other Action' },
    ]; await load();
    expect(text(render())).toContain('Existing Action'); expect(text(render())).not.toContain('Other Action');
    const stat = nodes(render()).find((n) => n.type === 'div' && n.props.children?.[0]?.type === 'p' && text(n.props.children[0]) === 'Total Actions');
    expect(text(stat)).toBe('Total Actions 1 All time');
  });
  it('shows only the latest five own events in timestamp order without changing logs or count semantics', async () => {
    const timestamps = [
      '2026-11-01T01:00:00Z', '2026-10-31T01:00:00Z', '2026-11-09T01:00:00Z',
      '2026-11-10T01:00:00Z', '2026-11-11T01:00:00Z', '2026-11-11T02:00:00Z',
      '2026-11-11T03:00:00Z', '2025-11-20T01:00:00Z',
    ];
    props.activityLogs = Object.freeze([
      ...timestamps.map((timestamp, i) => Object.freeze({ id: String(i), performedBy: 'Session Staff', timestamp, action: `Action ${i}`, details: `Genuine description ${i}` })),
      { id: 'other', performedBy: 'Another Staff', timestamp: '2026-11-11T04:00:00Z', action: 'Other Action' },
    ]);
    const original = [...props.activityLogs]; await load();
    const overview = section('activity-overview-heading');
    expect(nodes(overview).filter((n) => n.type === 'h3').map(text)).toEqual(['Activity Overview']);
    expect(nodes(overview).filter((n) => n.type === 'h4').map(text)).toEqual(['Recent Activity']);
    const stat = (label: string) => nodes(overview).find((n) => n.type === 'div' && n.props.children?.[0]?.type === 'p' && text(n.props.children[0]) === label);
    expect(text(stat('Total Actions'))).toBe('Total Actions 8 All time');
    // Preserve the existing month-number calculation, including a matching month in an older year.
    expect(text(stat('This Month'))).toBe('This Month 7 November 2026');
    const rows = nodes(overview).filter((n) => n.type === 'li');
    expect(rows).toHaveLength(5);
    expect(rows.map((row) => nodes(row).filter((n) => n.type === 'p').map(text))).toEqual(
      [6, 5, 4, 3, 2].map((i) => [`Action ${i}`, `Genuine description ${i}`])
    );
    expect(rows.map((row) => nodes(row).find((n) => n.type === 'time').props.dateTime)).toEqual([6, 5, 4, 3, 2].map((i) => timestamps[i]));
    expect(rows.map((row) => text(nodes(row).find((n) => n.type === 'time')))).toEqual([6, 5, 4, 3, 2].map((i) => new Date(timestamps[i]).toLocaleString()));
    expect(text(overview)).not.toContain('Other Action'); expect(props.activityLogs).toEqual(original);
    expect(nodes(overview).some((n) => /overflow-(?:y-)?(?:auto|scroll)/.test(n.props?.className ?? ''))).toBe(false);
    expect(nodes(overview).filter((n) => ['section', 'ol'].includes(n.type)).some((n) => /(?:max-)?h-\d/.test(n.props.className))).toBe(false);
  });
  it('keeps the activity empty state and updates the preview when shared logs arrive', async () => {
    await load(); expect(text(section('activity-overview-heading'))).toContain('No recent activity');
    props.activityLogs = [{ id: 'arrived', performedBy: 'Session Staff', timestamp: '2026-11-11T03:00:00Z', action: 'Loaded Action', details: 'Loaded details' }];
    expect(nodes(section('activity-overview-heading')).filter((n) => n.type === 'li')).toHaveLength(1);
    expect(text(section('activity-overview-heading'))).not.toContain('No recent activity');
  });
  it('retains available activity during profile loading, failure and retry', async () => {
    let finish: any; h.get.mockReturnValueOnce(new Promise((_, reject) => { finish = reject; }));
    props.activityLogs = [{ id: 'cached', performedBy: 'Session Staff', timestamp: '2026-11-11T03:00:00Z', action: 'Cached Action' }];
    render(); effects(); expect(text(render())).toContain('Loading account profile');
    expect(text(section('activity-overview-heading'))).toContain('Cached Action');
    finish(new Error('offline')); await flush(); expect(text(render())).toContain('could not be loaded');
    expect(text(section('activity-overview-heading'))).toContain('Cached Action');
    button('Retry profile').props.onClick(); await load();
    expect(text(render())).not.toContain('could not be loaded'); expect(text(section('activity-overview-heading'))).toContain('Cached Action');
  });
  it('places identity and permissions outside the naturally sized activity/password row', async () => {
    await load(); const tree = render();
    const children = tree.props.children.flat(Infinity).filter((n: any) => n && typeof n === 'object');
    expect(children).toHaveLength(4);
    expect(children[1].props['aria-label']).toBe('Official account details');
    expect(children[2].props.className).toContain('grid-cols-1 lg:grid-cols-2 items-start');
    expect(children[2].props.children.filter(Boolean).map((n: any) => n.props['aria-labelledby'])).toEqual(['activity-overview-heading', 'change-password-heading']);
    expect(children[3].props['aria-labelledby']).toBe('role-permissions-heading');
    expect(nodes(children[1]).find((n) => n.type === 'dl').props.className).toContain('md:grid-cols-3');
    expect(nodes(children[3]).find((n) => n.type === 'ul').props.className).toContain('grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4');
    expect(nodes(field('Email Address')).find((n) => n.type === 'dd').props.className).toContain('[overflow-wrap:anywhere]');
  });
  it('passes the complete role array and workflow settings through AppShell', () => {
    const source = readFileSync(new URL('../AppShell.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(/<UserProfile[\s\S]*?currentUserRoles=\{userRolesList\}[\s\S]*?workflowPermissions=\{workflowPermissions\}/);
  });
  it('preserves password policy, confirmation, visibility and current password verification', async () => {
    await load(); expect(button('Change Password').props.disabled).toBe(true);
    fillPassword(); input('Re-enter new password', 'mismatch'); await button('Change Password').props.onClick();
    expect(props.showToast).toHaveBeenLastCalledWith(expect.stringContaining('do not match')); expect(h.post).not.toHaveBeenCalled();
    input('Min. 8 characters', 'weak'); input('Re-enter new password', 'weak'); await button('Change Password').props.onClick(); expect(h.getUser).not.toHaveBeenCalled();
    fillPassword();
    for (const label of ['current', 'new', 'confirm']) {
      nodes(render()).find((n) => n.type === 'button' && n.props['aria-label'] === `Show ${label} password`).props.onClick();
      expect(nodes(render()).find((n) => n.type === 'button' && n.props['aria-label'] === `Hide ${label} password`)).toBeDefined();
    }
    h.signIn.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Invalid credentials' } });
    await button('Change Password').props.onClick();
    expect(h.signIn).toHaveBeenCalledWith({ email: account.email, password: 'Mock-Current-123!' });
    expect(h.post).not.toHaveBeenCalled(); expect(props.showToast).toHaveBeenLastCalledWith(expect.stringContaining('Current password could not be verified'));
  });
  it('confirms the backend password change and session recovery before showing success', async () => {
    await load(); fillPassword(); await button('Change Password').props.onClick();
    expect(h.post).toHaveBeenCalledExactlyOnceWith('/users/change-password', { new_password: password });
    expect(h.signIn).toHaveBeenLastCalledWith({ email: account.email, password }); expect(h.updateUser).not.toHaveBeenCalled();
    expect(props.showToast).toHaveBeenLastCalledWith(expect.stringContaining('Password updated successfully'));
    expect(nodes(render()).filter((n) => n.type === 'input').every((n) => n.props.value === '')).toBe(true);
  });
  it.each([403, 422, 503])('does not report password success when backend fails (%s)', async (status) => {
    await load(); fillPassword(); h.post.mockRejectedValueOnce({ response: { status } }); await button('Change Password').props.onClick();
    expect(props.showToast.mock.calls.some(([message]) => message.includes('updated successfully'))).toBe(false);
    expect(h.signIn).toHaveBeenCalledTimes(1); expect(h.updateUser).not.toHaveBeenCalled();
  });
  it('blocks duplicate password submissions while a request is pending', async () => {
    await load(); fillPassword(); let finish: any;
    h.post.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const pending = button('Change Password').props.onClick(); await flush();
    await button('Updating Password...').props.onClick(); expect(h.post).toHaveBeenCalledOnce();
    finish({ data: { success: true, must_change_password: false } }); await pending;
  });
  it('does not show success for an unconfirmed password response or failed session recovery', async () => {
    await load(); fillPassword(); h.post.mockResolvedValueOnce({ data: { success: true } });
    await button('Change Password').props.onClick();
    expect(props.showToast).toHaveBeenLastCalledWith(expect.stringContaining('not confirmed by the backend'));
    h.signIn.mockResolvedValueOnce({ data: { user: account }, error: null });
    h.signIn.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Recovery failed' } });
    await button('Change Password').props.onClick();
    expect(props.showToast).toHaveBeenLastCalledWith(expect.stringContaining('session recovery failed'));
    expect(props.showToast.mock.calls.some(([message]) => message.includes('updated successfully'))).toBe(false);
  });
});
