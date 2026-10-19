import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, post: vi.fn(), put: vi.fn() }));
vi.mock('../../../lib/api', () => ({ api: { post: h.post, put: h.put } }));
vi.mock('react', async (original) => {
  const actual: any = await original();
  return { ...actual,
    useState: (initial: any) => {
      const index = h.cursor++;
      if (!(index in h.slots)) h.slots[index] = initial;
      return [h.slots[index], (value: any) => { h.slots[index] = value; }];
    },
    useRef: (initial: any) => { const index = h.cursor++; return h.slots[index] ?? (h.slots[index] = { current: initial }); },
  };
});
import DelayReasonManagement, { DelayReasonManagementProps } from './DelayReasonManagement';

function nodes(tree: any): any[] {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
}
function text(tree: any): string {
  if (tree == null || typeof tree === 'boolean') return '';
  if (typeof tree !== 'object') return String(tree);
  return [tree.props?.children].flat(Infinity).map(text).join(' ');
}

describe('persistent Delay Reason Management (mocked API)', () => {
  let props: DelayReasonManagementProps;
  const row = { exception_type_id: 23, reason_name: 'Document Delay', workflow_stage_id: 97,
    stage_name: 'Medical', seed_penalty_days: 3, current_weight_days: 3, observation_count: 0 };
  const render = () => { h.cursor = 0; return DelayReasonManagement(props); };
  const button = (label: string) => nodes(render()).find((n) => n.type === 'button' && text(n).trim() === label);
  const change = (id: string, value: string) => nodes(render()).find((n) => n.props?.id === id).props.onChange({ target: { value } });
  const submit = () => nodes(render()).find((n) => n.type === 'form').props.onSubmit({ preventDefault() {} });
  const fill = () => { change('delay-reason-name', ' Document Delay '); change('delay-reason-days', '3'); change('delay-reason-stage', '97'); };
  beforeEach(() => {
    h.slots = []; h.cursor = 0; vi.clearAllMocks();
    h.post.mockResolvedValue({ data: row }); h.put.mockResolvedValue({ data: row });
    props = { reasons: [], stages: [{ workflow_stage_id: 97, stage_order: 2, stage_name: 'Medical' }],
      loading: false, error: null, refresh: vi.fn().mockResolvedValue(true), canEdit: true };
  });
  it('always shows the table and empty state, with no delete or disable action', () => {
    expect(text(render())).toContain('No delay reasons configured.');
    expect(text(render())).toContain('Resolution Observations');
    expect(text(render())).not.toMatch(/Delete|Disable/);
  });
  it('creates using the agreed payload then refreshes the shared list and closes the form', async () => {
    button('+ Add Delay Reason').props.onClick(); fill(); await submit();
    expect(h.post).toHaveBeenCalledWith('/forecasting/penalties', { reason_name: 'Document Delay', initial_delay_days: 3, workflow_stage_id: 97 });
    expect(props.refresh).toHaveBeenCalledOnce();
    expect(nodes(render()).some((n) => n.type === 'form')).toBe(false);
    expect(text(render())).toContain('Delay reason saved.');
    button('+ Add Delay Reason').props.onClick();
    expect(nodes(render()).find((n) => n.props?.id === 'delay-reason-name').props.value).toBe('');
  });
  it('edits a zero-observation row without sending learned state or tenant identity', async () => {
    props.reasons = [row]; expect(text(render())).toContain('Initial Estimate');
    button('Edit').props.onClick(); change('delay-reason-days', '4'); await submit();
    expect(h.put).toHaveBeenCalledWith('/forecasting/penalties/23', { reason_name: 'Document Delay', initial_delay_days: 4, workflow_stage_id: 97 });
    expect(h.post).not.toHaveBeenCalled();
  });
  it('protects learned rows and handles observations arriving during edit', async () => {
    props.reasons = [row]; button('Edit').props.onClick();
    props.reasons = [{ ...row, current_weight_days: 4.2, observation_count: 2 }];
    expect(button('Edit')).toBeUndefined(); expect(button('Save Delay Reason')).toBeUndefined();
    expect(text(render())).toContain('4.2'); expect(text(render())).toContain('Read-only');
    await submit(); expect(h.put).not.toHaveBeenCalled();
  });
  it('gates writes for non-managers, including role loss during editing', async () => {
    props.reasons = [row]; button('Edit').props.onClick(); props.canEdit = false;
    expect(button('Edit')).toBeUndefined(); expect(button('+ Add Delay Reason')).toBeUndefined();
    await submit(); expect(h.put).not.toHaveBeenCalled();
  });
  it('rejects invalid inputs without requests and preserves the form', async () => {
    button('+ Add Delay Reason').props.onClick(); await submit(); expect(text(render())).toContain('meaningful');
    fill(); change('delay-reason-days', '0'); await submit(); expect(text(render())).toContain('greater than zero');
    change('delay-reason-days', '3'); change('delay-reason-stage', '2'); await submit(); expect(text(render())).toContain('active agency stage');
    expect(h.post).not.toHaveBeenCalled();
  });
  it.each([401, 403, 409, 422, 503, undefined])('preserves input and reports failed save (%s)', async (status) => {
    h.post.mockRejectedValue(status ? { response: { status } } : new Error('Network'));
    button('+ Add Delay Reason').props.onClick(); fill(); await submit();
    expect(nodes(render()).find((n) => n.props?.id === 'delay-reason-name').props.value).toBe(' Document Delay ');
    expect(text(render())).not.toContain('Delay reason saved');
    expect(nodes(render()).some((n) => n.props?.role === 'alert')).toBe(true);
    if (status === 403) expect(button('Save Delay Reason')).toBeUndefined();
    if (status === 409) expect(props.refresh).toHaveBeenCalledOnce();
  });
  it('distinguishes a successful write from a failed reload', async () => {
    (props.refresh as any).mockResolvedValue(false);
    button('+ Add Delay Reason').props.onClick(); fill(); await submit();
    expect(text(render())).toContain('saved, but the list could not be fully refreshed');
  });
  it('prevents double saves and supports cancel', async () => {
    let resolve: any; h.post.mockReturnValue(new Promise((done) => { resolve = done; }));
    button('+ Add Delay Reason').props.onClick(); fill(); const pending = submit(); await submit();
    expect(h.post).toHaveBeenCalledOnce(); expect(button('Cancel').props.disabled).toBe(true);
    resolve({ data: row }); await pending;
    button('+ Add Delay Reason').props.onClick(); fill(); button('Cancel').props.onClick();
    expect(nodes(render()).some((n) => n.type === 'form')).toBe(false);
  });
});
