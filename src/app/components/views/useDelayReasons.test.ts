import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, effect: null as any, get: vi.fn() }));
vi.mock('../../../lib/api', () => ({ api: { get: h.get } }));
vi.mock('react', () => ({
  useState: (initial: any) => {
    const index = h.cursor++; if (!(index in h.slots)) h.slots[index] = initial;
    return [h.slots[index], (value: any) => { h.slots[index] = value; }];
  },
  useRef: (initial: any) => { const index = h.cursor++; return h.slots[index] ?? (h.slots[index] = { current: initial }); },
  useCallback: (callback: any) => callback,
  useEffect: (effect: any) => { h.effect = effect; },
}));
import useDelayReasons from './useDelayReasons';

describe('shared delay data loading and refresh', () => {
  const render = () => { h.cursor = 0; return useDelayReasons(); };
  const row = { exception_type_id: 7, reason_name: 'Delay', workflow_stage_id: null, stage_name: null,
    seed_penalty_days: 3, current_weight_days: 3, observation_count: 0 };
  beforeEach(() => { h.slots = []; h.cursor = 0; vi.clearAllMocks(); });
  it('refreshes shared management/simulator data after save', async () => {
    h.get.mockResolvedValue({ data: [] }); await render().refresh(); expect(render().reasons).toEqual([]);
    h.get.mockImplementation(async (url) => ({ data: url.endsWith('/stages') ? [] : [row] }));
    expect(await render().refresh()).toBe(true);
    expect(render().reasons).toEqual([row]); expect(render().error).toBeNull();
  });
  it('clears stale category options after authorization or endpoint errors while retaining valid stages', async () => {
    h.get.mockImplementation(async (url) => ({ data: url.endsWith('/stages') ? [] : [row] })); await render().refresh();
    h.get.mockImplementation(async (url) => { if (url.endsWith('/stages')) return { data: [] }; throw { response: { status: 403 } }; });
    expect(await render().refresh()).toBe(false); expect(render().reasons).toEqual([]);
    expect(render().error).toContain('read-only');
    h.get.mockRejectedValue({ response: { status: 404 } }); await render().refresh();
    expect(render().error).toContain('unavailable on this backend');
  });
  it('ignores stale requests and responses after unmount', async () => {
    let resolve: any;
    const blocked = new Promise((done) => { resolve = done; });
    h.get.mockReturnValue(blocked);
    const pending = render().refresh();
    h.get.mockResolvedValue({ data: [] }); await render().refresh();
    resolve({ data: [row] }); await pending; expect(render().reasons).toEqual([]);
    const cleanup = h.effect(); cleanup();
    await Promise.resolve(); await Promise.resolve();
    expect(render().reasons).toEqual([]);
  });
});
