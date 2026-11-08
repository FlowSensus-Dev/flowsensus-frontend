import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, effects: [] as any[] }));
vi.mock('react', async (original) => ({ ...(await original() as any),
  useState: (initial: any) => {
    const index = h.cursor++;
    if (!(index in h.slots)) h.slots[index] = initial;
    return [h.slots[index], (value: any) => { h.slots[index] = value; }];
  },
  useEffect: (effect: any, deps: any[]) => {
    const index = h.cursor++; const previous = h.slots[index];
    if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
      const slot = { deps, cleanup: previous?.cleanup }; h.slots[index] = slot;
      h.effects.push(() => { previous?.cleanup?.(); slot.cleanup = effect(); });
    }
  },
}));
import { AgencyAvatar, AgencyLogoPicker, AgencyThemeControl, EMPTY_LOGO } from './AgencyBrandingControls';

const nodes = (tree: any): any[] => !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
const text = (tree: any): string => tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : [tree.props?.children].flat(Infinity).map(text).join(' ').replace(/\s+/g, ' ').trim();
describe('agency branding controls', () => {
  beforeEach(() => { h.slots = []; h.effects = []; h.cursor = 0; });
  afterEach(() => { h.slots.forEach((slot) => slot?.cleanup?.()); vi.restoreAllMocks(); });
  it('renders a compact outlined selector with a native keyboard-accessible file input', () => {
    const tree = AgencyLogoPicker({ id: 'logo', selection: EMPTY_LOGO, onChange: vi.fn() });
    const input = nodes(tree).find((n) => n.type === 'input');
    expect(input.props).toMatchObject({ id: 'logo', type: 'file', accept: 'image/png,image/jpeg,image/webp', 'aria-describedby': 'logo-help logo-selection logo-error', 'aria-invalid': false });
    expect(input.props.hidden).not.toBe(true); expect(input.props.tabIndex).not.toBe(-1);
    expect(nodes(tree).some((n) => n.props?.className?.includes('rounded-lg border') && n.props.className.includes('focus-within:ring-2'))).toBe(true);
    expect(text(tree)).toContain('Choose image'); expect(text(tree)).toContain('Browse');
    expect(text(tree)).toContain('Optional. PNG, JPEG, or WEBP; maximum 2 MiB.');
    expect(nodes(tree).some((n) => n.type === 'button')).toBe(false);
  });
  it('selects, previews, replaces, and clears a logo while releasing object URLs', () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:preview-1').mockReturnValueOnce('blob:preview-2');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    let selection = EMPTY_LOGO;
    const render = () => { h.cursor = 0; return AgencyLogoPicker({ id: 'logo', selection, onChange: (value) => { selection = value; } }); };
    const input = () => nodes(render()).find((n) => n.type === 'input');
    expect(input().props.accept).toBe('image/png,image/jpeg,image/webp');
    expect(nodes(render()).find((n) => n.type === 'label').props.htmlFor).toBe('logo');
    const file = new File(['image'], 'logo.png', { type: 'image/png' });
    const target = { files: [file], value: 'logo.png' }; input().props.onChange({ target });
    expect(selection.file).toBe(file); expect(target.value).toBe('');
    expect(nodes(render()).find((n) => n.props?.id === 'logo-selection').props.children).toBe('logo.png');
    render(); h.effects.splice(0).forEach((effect) => effect());
    expect(nodes(render()).find((n) => n.type === 'img').props).toMatchObject({ src: 'blob:preview-1', alt: 'Selected agency logo preview' });
    expect(create).toHaveBeenCalledWith(file);
    input().props.onChange({ target: { files: [new File(['image'], 'new.webp', { type: 'image/webp' })], value: 'new.webp' } });
    render(); h.effects.splice(0).forEach((effect) => effect());
    expect(revoke).toHaveBeenCalledWith('blob:preview-1');
    nodes(render()).find((n) => n.type === 'button').props.onClick();
    render(); h.effects.splice(0).forEach((effect) => effect());
    expect(selection).toEqual(EMPTY_LOGO); expect(revoke).toHaveBeenCalledWith('blob:preview-2');
    expect(nodes(render()).some((n) => n.type === 'img')).toBe(false);
    expect(nodes(render()).find((n) => n.props?.id === 'logo-selection').props.children).toBe('Choose image');
  });
  it.each([
    [new File(['image'], 'bad.svg', { type: 'image/svg+xml' }), 'PNG, JPEG, or WEBP'],
    [new File([new Uint8Array(2097153)], 'big.png', { type: 'image/png' }), '2 MiB'],
  ])('shows accessible feedback for invalid file %s', (file, message) => {
    let selection = EMPTY_LOGO;
    const render = () => { h.cursor = 0; return AgencyLogoPicker({ id: 'logo', selection, onChange: (value) => { selection = value; } }); };
    nodes(render()).find((n) => n.type === 'input').props.onChange({ target: { files: [file], value: file.name } });
    expect(selection.file).toBeNull(); expect(selection.error).toContain(message);
    expect(nodes(render()).find((n) => n.type === 'input').props['aria-invalid']).toBe(true);
    expect(nodes(render()).some((n) => n.props?.role === 'alert')).toBe(true);
  });
  it('offers existing presets and normalizes picker colors', () => {
    const onChange = vi.fn(); const tree = AgencyThemeControl({ id: 'theme', value: '', onChange });
    const picker = nodes(tree).find((n) => n.type === 'input');
    expect(picker.props.value).toBe('#0EA5E9'); picker.props.onChange({ target: { value: '#aabbcc' } });
    expect(onChange).toHaveBeenLastCalledWith('#AABBCC');
    nodes(tree).find((n) => n.props?.['aria-label'] === 'Agency theme Emerald').props.onClick();
    expect(onChange).toHaveBeenLastCalledWith('#10B981');
  });
  it('falls back for absent or broken logos and tries a replacement URL', () => {
    let logoUrl: string | null = null;
    const render = () => { h.cursor = 0; return AgencyAvatar({ name: 'Example Agency', fallback: 'EX', logoUrl }); };
    expect(nodes(render()).some((n) => n.type === 'img')).toBe(false);
    expect(nodes(render()).find((n) => n.type === 'span').props.children).toBe('EX');
    logoUrl = 'https://storage.example.test/broken.png';
    nodes(render()).find((n) => n.type === 'img').props.onError();
    expect(nodes(render()).some((n) => n.type === 'img')).toBe(false);
    logoUrl = 'https://storage.example.test/replacement.png';
    expect(nodes(render()).find((n) => n.type === 'img').props.src).toBe(logoUrl);
  });
});
