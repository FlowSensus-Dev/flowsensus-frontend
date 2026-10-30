import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  slots: [] as any[],
  cursor: 0,
  navigate: vi.fn(),
  location: { pathname: '/app/dashboard' },
  apiGet: vi.fn().mockResolvedValue({ data: [] }),
  apiPost: vi.fn().mockResolvedValue({ data: {} }),
}));

vi.mock('react-router', () => ({
  useNavigate: () => h.navigate,
  useLocation: () => h.location,
}));

vi.mock('../../lib/api', () => ({
  api: {
    get: h.apiGet,
    post: h.apiPost,
  },
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

vi.mock('react', async (original) => {
  const actual: any = await original();
  return {
    ...actual,
    useState: (initial: any) => {
      const index = h.cursor++;
      if (!(index in h.slots)) {
        h.slots[index] = typeof initial === 'function' ? initial() : initial;
      }
      return [
        h.slots[index],
        (value: any) => {
          h.slots[index] = typeof value === 'function' ? value(h.slots[index]) : value;
        },
      ];
    },
    useRef: (initial: any) => {
      const index = h.cursor++;
      return h.slots[index] ?? (h.slots[index] = { current: initial });
    },
    useEffect: () => {},
  };
});

import AppShell from './AppShell';
import RecruitmentDashboard from './views/dashboards/RecruitmentDashboard';

function nodes(tree: any): any[] {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
}

function text(tree: any): string {
  if (tree == null || typeof tree === 'boolean') return '';
  if (typeof tree !== 'object') return String(tree);
  return [tree.props?.children].flat(Infinity).map(text).join(' ').replace(/\s+/g, ' ').trim();
}

describe('AppShell Multi-Role Dashboard Rendering', () => {
  let defaultProps: any;

  beforeEach(() => {
    h.slots = [];
    h.cursor = 0;
    vi.clearAllMocks();
    const mockStorage: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mockStorage[k] || null,
      setItem: (k: string, v: string) => { mockStorage[k] = v; },
      removeItem: (k: string) => { delete mockStorage[k]; },
    });
    h.location.pathname = '/app/dashboard';

    defaultProps = {
      currentUserRole: 'Admin',
      currentUserRoles: ['Admin', 'Accounting', 'Management', 'Recruitment'],
      currentUserName: 'Jane Doe',
      workflow: { screeningPassed: false, medicalCleared: false, cvApproved: false, employerAccepted: false },
      updateWorkflow: vi.fn(),
      applicants: [
        {
          id: 'APP-101',
          name: 'Maria Santos',
          applicantCode: 'APP-101',
          role: 'Registered Nurse',
          phase: 1,
          status: 'Active',
          currentHandler: 'Recruitment Team',
          currentDepartment: 'Recruitment',
          lastUpdated: new Date().toISOString(),
          phaseDescription: 'Initial Screening',
        },
      ],
      applicantsLoaded: true,
      updateApplicant: vi.fn(),
      addApplicant: vi.fn(),
      activityLogs: [],
      addActivityLog: vi.fn(),
      expenses: [],
      expensesLoaded: true,
      addExpense: vi.fn(),
      onLogout: vi.fn(),
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const render = (props = defaultProps) => {
    h.cursor = 0;
    return AppShell(props);
  };

  it('renders all 4 role dashboards when user has Admin, Accounting, Management, Recruitment roles', () => {
    const tree = render();
    const renderedText = text(tree);

    // Header bar indicates multi-role dashboards
    expect(renderedText).toContain('Your Role Dashboards');
    expect(renderedText).toContain('You have 4 active roles');

    // Tab buttons for all 4 roles exist
    const buttons = nodes(tree).filter((n) => n.type === 'button');
    const buttonTexts = buttons.map(text);
    expect(buttonTexts.some((t) => t.includes('All Dashboards'))).toBe(true);
    expect(buttonTexts.some((t) => t.includes('Management'))).toBe(true);
    expect(buttonTexts.some((t) => t.includes('Recruitment'))).toBe(true);
    expect(buttonTexts.some((t) => t.includes('Admin'))).toBe(true);
    expect(buttonTexts.some((t) => t.includes('Accounting'))).toBe(true);

    // In 'all' mode (default), sections for all 4 dashboards appear
    expect(renderedText).toContain('Management & Operations');
    expect(renderedText).toContain('Recruitment & Candidate Sourcing');
    expect(renderedText).toContain('Administration & Visa Coordination');
    expect(renderedText).toContain('Finance & Candidate Ledgers');
  });

  it('handles lowercase role names (admin, accounting, management, recruitment) cleanly', () => {
    const lowercaseProps = {
      ...defaultProps,
      currentUserRole: 'admin',
      currentUserRoles: ['admin', 'accounting', 'management', 'recruitment'],
    };

    const tree = render(lowercaseProps);
    const renderedText = text(tree);

    expect(renderedText).toContain('Management & Operations');
    expect(renderedText).toContain('Recruitment & Candidate Sourcing');
    expect(renderedText).toContain('Administration & Visa Coordination');
    expect(renderedText).toContain('Finance & Candidate Ledgers');
  });

  it('allows clicking a role tab to focus only on that role dashboard', () => {
    // Initial render in 'all' mode
    let tree = render();

    // Find the Accounting tab button and click it
    const accountingTabBtn = nodes(tree).find(
      (n) => n.type === 'button' && n.props?.role === 'tab' && text(n).includes('Accounting')
    );
    expect(accountingTabBtn).toBeDefined();

    // Trigger onClick
    accountingTabBtn.props.onClick();

    // Re-render
    tree = render();
    const renderedText = text(tree);

    expect(renderedText).toContain('Viewing focused Finance & Candidate Ledgers');
    expect(renderedText).toContain('Finance & Candidate Ledgers');

    // Click "Show All Dashboards" to return
    const showAllBtn = nodes(tree).find(
      (n) => n.type === 'button' && text(n).includes('Show All Dashboards')
    );
    expect(showAllBtn).toBeDefined();
    showAllBtn.props.onClick();

    tree = render();
    const allText = text(tree);
    expect(allText).toContain('Management & Operations');
    expect(allText).toContain('Recruitment & Candidate Sourcing');
    expect(allText).toContain('Administration & Visa Coordination');
    expect(allText).toContain('Finance & Candidate Ledgers');
  });

  it('renders single dashboard directly with no tab bar when user only has 1 role', () => {
    const singleRoleProps = {
      ...defaultProps,
      currentUserRole: 'Recruitment',
      currentUserRoles: ['Recruitment'],
    };

    const tree = render(singleRoleProps);
    const mainContent = nodes(tree).find((n) => n.props?.className?.includes('pt-6'));
    const dashboardElement = mainContent?.props?.children;

    // Directly returns the RecruitmentDashboard component
    expect(dashboardElement?.type).toBe(RecruitmentDashboard);

    // Shows no multi-role tab bar
    const renderedText = text(tree);
    expect(renderedText).not.toContain('All Dashboards');
    expect(renderedText).not.toContain('Role Dashboards');
  });
});
