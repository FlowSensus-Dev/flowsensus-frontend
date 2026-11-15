import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const h = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../lib/api', () => ({ api: { get: h.get } }));
import TenantSidebarBrand from './TenantSidebarBrand';
import Sidebar from './Sidebar';
import Logo from './Logo';

const nodes = (tree: any): any[] => !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
const content = (tree: any): string => tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : [tree.props?.children].flat(Infinity).map(content).join(' ');

describe('staff sidebar platform branding', () => {
  beforeEach(() => vi.resetAllMocks());
  it.each([false, true])('uses the canonical FlowSensus logo and application name with compact=%s', (compact) => {
    const tree = TenantSidebarBrand({ compact });
    expect(content(tree)).toContain('FLOWSENSUS');
    const logo = nodes(tree).find((n) => n.type === Logo); expect(logo.props.size).toBe('small');
    const img = Logo(logo.props); expect(img.type).toBe('img'); expect(img.props.alt).toBe('FlowSensus Logo');
    expect(img.props.width).toBe(32); expect(img.props.src).toContain('FLOWSENSUS_LOGO.png');
    expect(nodes(tree).find((n) => n.type === 'span').props.className.includes('sr-only')).toBe(compact);
    expect(h.get).not.toHaveBeenCalled();
  });
  it.each([false, true])('preserves multi-role navigation, session roles and toggles when collapsed=%s', (collapsed) => {
    const props: any = { currentUserRole: 'Recruitment', currentUserRoles: ['Recruitment', 'Management'],
      currentView: 'reports', onViewChange: vi.fn(), onToggleCollapse: vi.fn(), collapsed };
    const tree = Sidebar(props);
    const brand = nodes(tree).find((n) => n.type === TenantSidebarBrand); expect(brand).toBeDefined();
    expect(brand.props.compact ?? false).toBe(collapsed);
    expect(content(TenantSidebarBrand(brand.props))).toContain('FLOWSENSUS');
    if (collapsed) expect(nodes(tree).some((n) => n.props?.title === 'Active Session: Recruitment & Management Ops')).toBe(true);
    else expect(content(tree).replace(/\s+/g, ' ')).toContain('Recruitment & Management Ops');
    const report = nodes(tree).find((n) => n.type === 'button' && n.props.title === 'Operational Reports');
    expect(report).toBeDefined(); report.props.onClick(); expect(props.onViewChange).toHaveBeenCalledWith('reports');
    const toggle = nodes(tree).find((n) => n.type === 'button' && n.props.title === (collapsed ? 'Expand sidebar' : 'Collapse sidebar'));
    if (collapsed) expect(toggle.props['aria-label']).toBe('Expand sidebar');
    toggle.props.onClick(); expect(props.onToggleCollapse).toHaveBeenCalledOnce();
    expect(tree.props.className).toContain(collapsed ? 'w-[72px]' : 'w-[260px]');
    expect(h.get).not.toHaveBeenCalled();
  });
  it('keeps ordinary role restrictions intact', () => {
    const tree = Sidebar({ currentUserRole: 'Recruitment', currentView: 'dashboard', onViewChange: vi.fn() });
    expect(nodes(tree).some((n) => n.type === 'button' && n.props.title === 'Operational Reports')).toBe(false);
    expect(nodes(tree).some((n) => n.type === 'button' && n.props.title === 'Registration')).toBe(true);
  });
  it.each([false, true])('leaves the Super Admin global header unchanged when collapsed=%s', (collapsed) => {
    const tree = Sidebar({ currentUserRole: 'Management', currentView: 'dashboard', onViewChange: vi.fn(), isSuperAdmin: true, collapsed });
    expect(nodes(tree).some((n) => n.type === TenantSidebarBrand)).toBe(false);
    if (!collapsed) { expect(content(tree)).toContain('FLOWSENSUS'); expect(nodes(tree).some((n) => n.type === Logo)).toBe(true); }
    else expect(nodes(tree).find((n) => n.type === 'button' && n.props.title === 'Expand sidebar')).toBeDefined();
    expect(h.get).not.toHaveBeenCalled();
  });
  it('keeps authenticated tenant context and the loaded staff directory in AppShell', () => {
    const source = readFileSync(new URL('./AppShell.tsx', import.meta.url), 'utf8');
    expect(source).toContain('<OperationalReports staffDirectory={globalStaff} />');
    expect(source).toContain('currentUserRoles={currentUserRoles}');
    expect(source).toContain('collapsed={isSidebarCollapsed}');
    expect(source).toContain('onToggleCollapse={handleToggleSidebar}');
  });
});
