import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, effects: [] as any[], get: vi.fn(), post: vi.fn(), alert: vi.fn() }));
vi.mock('../../../lib/api', () => ({ api: { get: h.get, post: h.post } }));
vi.mock('../../../lib/supabase', () => ({ supabase: {
  channel: () => { const channel = { on: () => channel, subscribe: () => channel }; return channel; }, removeChannel: vi.fn(),
} }));
vi.mock('react', async (original) => ({ ...(await original() as any),
  useState: (initial: any) => {
    const index = h.cursor++;
    if (!(index in h.slots)) h.slots[index] = typeof initial === 'function' ? initial() : initial;
    return [h.slots[index], (value: any) => { h.slots[index] = typeof value === 'function' ? value(h.slots[index]) : value; }];
  },
  useMemo: (fn: any) => fn(), useEffect: (effect: any) => { h.effects.push(effect); },
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
