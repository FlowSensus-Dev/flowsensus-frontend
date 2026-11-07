import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, effects: [] as any[], get: vi.fn() }));
vi.mock('../../lib/api', () => ({ api: { get: h.get } }));
vi.mock('react', async (original) => ({ ...(await original() as any),
  useState: (initial: any) => {
    const index = h.cursor++;
    if (!(index in h.slots)) h.slots[index] = initial;
    return [h.slots[index], (value: any) => { h.slots[index] = value; }];
  },
  useEffect: (effect: any) => { h.effects.push(effect); },
}));
import TenantSidebarBrand from './TenantSidebarBrand';
import Sidebar from './Sidebar';
import { AgencyAvatar } from './AgencyBrandingControls';

const nodes = (tree: any): any[] => !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
const content = (tree: any): string => tree == null ? '' : typeof tree !== 'object' ? String(tree) : [tree.props?.children].flat(Infinity).map(content).join(' ');
describe('tenant sidebar branding (mocked API)', () => {
  const render = () => { h.cursor = 0; return TenantSidebarBrand(); };
  beforeEach(() => { h.slots = []; h.effects = []; h.cursor = 0; vi.resetAllMocks(); });
  it('loads tenant branding with the authenticated lookup and retains accessible name and logo fallback', async () => {
    h.get.mockResolvedValueOnce({ data: { agency_name: 'Example Agency', logo_url: 'https://storage.example.test/logo.png' } });
    expect(content(render())).toContain('FLOWSENSUS'); h.effects[0]();
    await Promise.resolve(); await Promise.resolve();
    expect(h.get).toHaveBeenCalledWith('/lookups/agency'); expect(content(render())).toContain('Example Agency');
    expect(nodes(render()).find((n) => n.type === AgencyAvatar).props).toMatchObject({ name: 'Example Agency', logoUrl: 'https://storage.example.test/logo.png' });
  });
  it('keeps FlowSensus fallback on lookup failure and ignores responses after unmount', async () => {
    h.get.mockRejectedValueOnce(new Error('unavailable')); render(); h.effects[0]();
    await Promise.resolve(); await Promise.resolve(); expect(content(render())).toContain('FLOWSENSUS');
    let resolve: any; h.get.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    h.effects[0]()(); resolve({ data: { agency_name: 'Stale agency' } });
    await Promise.resolve(); expect(content(render())).not.toContain('Stale agency');
  });
  it('mounts tenant branding only for tenant navigation and keeps Super Admin global', () => {
    const props: any = { currentUserRole: 'Management', currentView: 'dashboard', onViewChange: vi.fn() };
    expect(nodes(Sidebar(props)).some((n) => n.type === TenantSidebarBrand)).toBe(true);
    const globalSidebar = Sidebar({ ...props, isSuperAdmin: true });
    expect(nodes(globalSidebar).some((n) => n.type === TenantSidebarBrand)).toBe(false);
    expect(content(globalSidebar)).toContain('FLOWSENSUS'); expect(h.get).not.toHaveBeenCalled();
  });
});
