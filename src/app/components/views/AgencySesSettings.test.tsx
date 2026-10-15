import { beforeEach, describe, expect, it, vi } from 'vitest';

// Exercise the component's event handlers and rendered state without a browser or live API.
const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, effects: [] as any[], get: vi.fn(), put: vi.fn() }));
vi.mock('../../../lib/api', () => ({ api: { get: h.get, put: h.put } }));
vi.mock('react', async (original) => {
  const actual: any = await original();
  return { ...actual,
    useState: (initial: any) => {
      const index = h.cursor++;
      if (!(index in h.slots)) h.slots[index] = initial;
      return [h.slots[index], (value: any) => { h.slots[index] = value; }];
    },
    useRef: (initial: any) => {
      const index = h.cursor++;
      return h.slots[index] ?? (h.slots[index] = { current: initial });
    },
    useEffect: (effect: any) => { if (!h.effects.length) h.effects.push(effect); },
  };
});
import AgencySesSettings, { validAlpha } from './AgencySesSettings';

function nodes(tree: any): any[] {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
}
const text = (tree: any): string => {
  if (tree == null || typeof tree === 'boolean') return '';
  if (typeof tree !== 'object') return String(tree);
  return [tree.props?.children].flat(Infinity).map(text).join(' ');
};
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('Agency SES settings (mocked API)', () => {
  let onSaved: ReturnType<typeof vi.fn>;
  const render = (canEdit = true) => { h.cursor = 0; return AgencySesSettings({ canEdit, onSaved }); };
  const button = (tree: any, label: string) => nodes(tree).find((n) => n.type === 'button' && text(n).trim() === label);
  const edit = () => { button(render(), 'Edit Alpha').props.onClick(); return render(); };
  const input = (value: string) => { nodes(render()).find((n) => n.type === 'input').props.onChange({ target: { value } }); };
  const save = () => nodes(render()).find((n) => n.type === 'form').props.onSubmit({ preventDefault() {} });

  beforeEach(async () => {
    h.slots = []; h.cursor = 0; h.effects = []; vi.clearAllMocks();
    onSaved = vi.fn().mockResolvedValue(undefined);
    h.get.mockResolvedValue({ data: { agency_id: 19, ses_alpha: 0.3 } });
    render(); h.effects[0](); await flush();
  });

  it('loads current alpha and initializes edit; Cancel restores saved value', () => {
    expect(h.get).toHaveBeenCalledWith('/forecasting/settings');
    expect(text(render())).toContain('0.3');
    expect(nodes(edit()).find((n) => n.type === 'input').props.value).toBe('0.3');
    input('0.7'); button(render(), 'Cancel').props.onClick();
    expect(nodes(edit()).find((n) => n.type === 'input').props.value).toBe('0.3');
    expect(h.put).not.toHaveBeenCalled();
  });

  it('accepts backend bounds and rejects empty, nonfinite, zero and out-of-range values', async () => {
    for (const value of ['', ' ', 'NaN', 'Infinity', '0', '-0.1', '1.01']) expect(validAlpha(value)).toBe(false);
    for (const value of ['0.0001', '0.3', '1']) expect(validAlpha(value)).toBe(true);
    edit(); input('0'); await save();
    expect(h.put).not.toHaveBeenCalled();
    expect(text(render())).toContain('greater than 0');
  });

  it('saves only alpha, disables controls in flight, and refreshes forecasts', async () => {
    let finish: any;
    h.put.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    edit(); input('1'); const pending = save();
    expect(nodes(render()).find((n) => n.type === 'input').props.disabled).toBe(true);
    expect(h.put).toHaveBeenCalledWith('/forecasting/settings', { ses_alpha: 1 });
    finish({ data: { agency_id: 19, ses_alpha: 1 } }); await pending;
    expect(onSaved).toHaveBeenCalledOnce();
    expect(text(render())).toContain('Forecast refresh completed');
  });

  it.each([401, 403, 422, 500, undefined])('retains saved alpha and draft on failure (%s)', async (status) => {
    h.put.mockRejectedValue(status ? { response: { status } } : new Error('Network'));
    edit(); input('0.6'); await save();
    expect(text(render())).toContain('0.3');
    expect(nodes(render()).find((n) => n.type === 'input').props.value).toBe('0.6');
    expect(nodes(render()).some((n) => n.props?.role === 'alert')).toBe(true);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('shows saved state separately from a failed forecast refresh', async () => {
    h.put.mockResolvedValue({ data: { ses_alpha: 0.6 } }); onSaved.mockRejectedValue(new Error());
    edit(); input('0.6'); await save();
    expect(text(render())).toContain('saved, but forecasts could not be refreshed');
    expect(text(render())).toContain('0.6');
  });

  it('keeps non-managers read-only, including when permission changes during editing', () => {
    expect(button(render(false), 'Edit Alpha')).toBeUndefined();
    edit();
    expect(nodes(render(false)).some((n) => n.type === 'form')).toBe(false);
  });

  it('handles load errors and allows reloading settings', async () => {
    h.get.mockRejectedValueOnce({ response: { status: 403 } });
    await button((await (async () => {
      h.put.mockRejectedValue({ response: { status: 500 } }); edit(); await save(); return render();
    })()), 'Reload Settings').props.onClick();
    await flush(); expect(text(render())).toContain('do not have permission');
    button(render(), 'Reload Settings').props.onClick(); await flush();
    expect(text(render())).toContain('0.3');
  });
});
