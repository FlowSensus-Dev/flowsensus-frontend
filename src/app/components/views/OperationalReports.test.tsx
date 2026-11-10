import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { hasAccessToView } from '../../../lib/accessControl';

// Match the repository's hook/event harness, with dependency tracking and cleanup.
// No API client, Auth, Supabase or real PDF download is loaded by these tests.
const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, effects: [] as any[],
  get: vi.fn(), save: vi.fn(), table: vi.fn(), pdfText: vi.fn(), pdfOptions: vi.fn(), setPage: vi.fn(), pages: 1 }));
vi.mock('../../../lib/api', () => ({ api: { get: h.get } }));
vi.mock('jspdf', () => ({ default: class {
  constructor(options: unknown) { h.pdfOptions(options); }
  internal = { pageSize: { getWidth: () => 297, getHeight: () => 210 } };
  setFont() {} setFontSize() {} setTextColor() {} setDrawColor() {} setLineWidth() {} line() {} addPage() { h.pages++; }
  setPage = h.setPage;
  getTextWidth(value: string) { return value.length * 1.2; }
  splitTextToSize(value: string) { return [value]; }
  text = h.pdfText;
  getNumberOfPages() { return h.pages; }
  save = h.save;
} }));
vi.mock('jspdf-autotable', () => ({ default: h.table }));
vi.mock('react', async (original) => ({ ...(await original() as any),
  useState: (initial: any) => {
    const slots = h.slots; const index = h.cursor++;
    if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], (value: any) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
  },
  useRef: (initial: any) => { const slots = h.slots; const index = h.cursor++; return slots[index] ?? (slots[index] = { current: initial }); },
  useCallback: (callback: any, deps: any[]) => {
    const index = h.cursor++; const previous = h.slots[index];
    if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) h.slots[index] = { deps, callback };
    return h.slots[index].callback;
  },
  useEffect: (effect: any, deps: any[]) => {
    const index = h.cursor++; const previous = h.slots[index];
    if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
      const slot = { deps, cleanup: previous?.cleanup }; h.slots[index] = slot;
      h.effects.push(() => { previous?.cleanup?.(); slot.cleanup = effect(); });
    }
  },
}));
import OperationalReports from './OperationalReports';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '../ui/popover';

function nodes(tree: any): any[] { return !tree || typeof tree !== 'object' || tree.props?.hidden ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)]; }
const text = (tree: any): string => tree == null || typeof tree === 'boolean' || tree.props?.hidden ? '' : typeof tree !== 'object' ? String(tree) :
  [tree.props?.children].flat(Infinity).map(text).join(' ').replace(/\s+/g, ' ').trim();
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const deferred = () => { let resolve!: (value: any) => void; let reject!: (value: any) => void;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };
const monthlyCalls = () => h.get.mock.calls.filter(([url]) => url === '/reports/monthly-deployments');
const lastParams = () => monthlyCalls().at(-1)![1].params;
const date = '2026-11-05T04:00:00Z';
const deployment = (id: number, extra = {}) => ({ agency_id: 7, application_id: id, applicant_id: id + 100,
  applicant_name: `Applicant ${id}`, applicant_code: `APP-${id}`, job_order_id: 9, job_order_code: 'JO-9',
  employer_id: 4, employer_name: 'Verified Employer', country_id: 2, country_name: 'Japan', position: 'Nurse',
  actual_deployment_at: date, status_code: 'Deployed', current_phase: 6, current_stage_id: 15, ...extra });
const fixtureBounds = (params: any = {}) => {
  const month = `${params.year || 2026}-${String(params.month || 11).padStart(2, '0')}`;
  const end = new Date(`${month}-01T00:00:00Z`); end.setUTCMonth(end.getUTCMonth() + 1);
  return { first: `${month}-01`, end: end.toISOString() };
};
const metadata = (name: string, params: any = {}, dateField = 'job_application.actual_deployment_at') => ({
  report: name, generated_at: '2026-11-07T08:00:00Z', scope: 'agency', agency_id: 7, timezone: 'UTC',
  date_from: `${params.dateFrom || fixtureBounds(params).first}T00:00:00Z`,
  date_to_exclusive: params.dateTo ? new Date(Date.parse(`${params.dateTo}T00:00:00Z`) + 86400000).toISOString() : fixtureBounds(params).end,
  date_field: dateField,
});
const monthly = (params: any = { page: 1, pageSize: 25 }, total = 27) => {
  if (Date.parse(`${params.dateFrom || fixtureBounds(params).first}T00:00:00Z`) > Date.parse('2026-11-07T08:00:00Z')) total = 0;
  const start = params.page ? (params.page - 1) * 25 : 0;
  const length = params.page ? Math.min(25, Math.max(0, total - start)) : total;
  return { metadata: { ...metadata('monthly_deployments', params), deployment_as_of: '2026-11-07T08:00:00Z' },
    summary: { year: params.year || 2026, month: params.month || 11, total_deployments: total },
    rows: Array.from({ length }, (_, index) => deployment(100 - start - index, {
      actual_deployment_at: params.year && (params.year !== 2026 || params.month !== 11) ? `${params.dateFrom || fixtureBounds(params).first}T04:00:00Z` : date,
    })),
    filters: { country_id: params.countryId ?? null, employer_id: params.employerId ?? null, position: params.position ?? null, search: params.search ?? null },
    pagination: params.page ? { page: params.page, page_size: params.pageSize, total, total_pages: Math.ceil(total / 25) } : null };
};
const durations = { completed_attempt_count: 1, base_duration_sample_count: 1, penalty_duration_sample_count: 0,
  total_duration_sample_count: 1, average_base_actual_days: 2, average_actual_penalty_days: null,
  average_total_actual_days: 2, min_total_actual_days: 2, max_total_actual_days: 2 };
const staff = (params: any) => ({ metadata: metadata('staff_performance', params, 'audit_log.occurred_at'),
  summary: { staff_actor_count: 1, logged_operational_actions: 3, unique_applicants_touched: 1 },
  rows: [{ agency_id: 7, actor_user_id: 21, actor_name: 'Verified Staff', actor_role: 'Management', roles: ['Management'],
    logged_operational_actions: 3, unique_applicants_touched: 1, first_activity_at: date, last_activity_at: date,
    modules: { Applicants: 3 } as Record<string, number>, actions: { Updated: 3 } as Record<string, number> }] });
const workflow = (params: any) => ({ metadata: metadata('workflow_efficiency', params, 'stage_attempt.completed_at'),
  summary: { ...durations, stage_count: 1 }, rows: [{ agency_id: 7, workflow_stage_id: 8, stage_name: 'Medical', stage_order: 2, ...durations }] });

const drivers: any[] = [];
function driver(props: any = {}) {
  const instances = new Map<string, any[]>(); const effects: any[] = [];
  const tabElements = new Map<string, { focus: ReturnType<typeof vi.fn>; scrollIntoView: ReturnType<typeof vi.fn> }>();
  const elements = new Map<string, any>();
  const render = () => {
    const seen = new Set<string>();
    const expand = (element: any, path: string): any => {
      if (!element || typeof element !== 'object') return element;
      if (Array.isArray(element)) return element.map((child, index) => expand(child, `${path}/${child?.key ?? index}`));
      if (typeof element.type === 'function' && ['OperationalReports', 'MonthlyDeploymentCard', 'ReportCard', 'ReportFilterCombobox'].includes(element.type.name)) {
        path = `${path}/${element.type.name}/${element.key ?? ''}`;
        seen.add(path);
        const slots = instances.get(path) || []; instances.set(path, slots);
        h.slots = slots; h.effects = effects; h.cursor = 0;
        return expand(element.type(element.props), `${path}/render`);
      }
      if (element.props?.role === 'tab' && typeof element.ref === 'function') {
        const id = element.props.id;
        if (!tabElements.has(id)) tabElements.set(id, { focus: vi.fn(), scrollIntoView: vi.fn() });
        element.ref(tabElements.get(id));
      }
      if (element.ref && typeof element.ref === 'object') {
        const id = element.props.id;
        if (!elements.has(id)) elements.set(id, { focus: vi.fn(), scrollIntoView: vi.fn(), contains: vi.fn() });
        element.ref.current = elements.get(id);
      }
      return { ...element, props: { ...element.props, children: expand(element.props?.children, `${path}/children`) } };
    };
    const tree = expand({ type: OperationalReports, props }, 'root');
    for (const [path, slots] of instances) if (!seen.has(path)) {
      slots.filter((slot) => slot?.cleanup).forEach((slot) => slot.cleanup()); instances.delete(path);
    }
    return tree;
  };
  const runEffects = () => effects.splice(0).forEach((effect) => effect());
  const settle = async () => { render(); runEffects(); await flush(); return render(); };
  const all = () => nodes(render());
  const button = (label: string) => all().find((n) => n.type === 'button' && (text(n) === label || n.props['aria-label'] === label));
  const input = (label: string) => {
    const wrapper = all().find((n) => n.type === 'label' && text(n).startsWith(label));
    if (wrapper?.props.htmlFor) return all().find((n) => n.type === 'input' && n.props.id === wrapper.props.htmlFor);
    return nodes(wrapper).find((n) => n.type === 'input' || n.type === 'select');
  };
  const expandFilters = () => { const toggle = button('Filters'); if (toggle && !toggle.props['aria-expanded']) toggle.props.onClick(); render(); };
  const openFilter = (label: string) => {
    expandFilters(); const id = input(label).props.id;
    all().find((n) => n.type === Popover && nodes(n).some((child) => child.type === 'input' && child.props.id === id)).props.onOpenChange(true);
    render();
  };
  const chooseFilter = (label: string, choice: string) => {
    openFilter(label); all().find((n) => n.props?.role === 'option' && n.props['aria-label'] === choice).props.onClick(); render();
  };
  const result = { render, settle, runEffects, all, button, input, expandFilters, openFilter, chooseFilter,
    element: (id: string) => elements.get(id),
    option: (label: string) => all().find((n) => n.props?.role === 'option' && n.props['aria-label'] === label),
    tabElement: (label: string) => tabElements.get(button(label).props.id)!,
    change: (label: string, value: string) => {
      if (['Applicant name or code', 'Position (exact match)', 'Destination country', 'Employer'].includes(label)) expandFilters();
      input(label).props.onChange({ target: { value } });
    },
    apply: async () => { expandFilters(); all().find((n) => n.type === 'form' && n.props['aria-label'] === 'Monthly deployment filters').props.onSubmit({ preventDefault() {} }); return settle(); },
    applyPeriod: async () => { all().find((n) => n.type === 'form' && n.props['aria-label'] === 'Reporting period').props.onSubmit({ preventDefault() {} }); return settle(); },
    select: async (label: string) => { button(label).props.onClick(); return settle(); },
    unmount: () => { instances.forEach((slots) => slots.filter((slot) => slot?.cleanup).forEach((slot) => slot.cleanup())); instances.clear(); },
  };
  drivers.push(result); return result;
}
const reportLabels: Record<string, string> = { monthly_deployments: 'Monthly Deployment', staff_performance: 'Staff Activity',
  financial_summary: 'Financial Summary', workflow_efficiency: 'Workflow Efficiency' };
const monthlyDriver = () => { const d = driver(); d.expandFilters(); return d; };
const reportDriver = (name: string) => { const d = driver(); d.button(reportLabels[name]).props.onClick(); return d; };

beforeEach(() => {
  vi.resetAllMocks(); h.pages = 1; vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-07T08:00:00Z'));
  h.get.mockImplementation(async (url, config = {}) => {
    const params = config.params || {};
    if (url === '/lookups/agency') return { data: { agency_id: 7, agency_name: 'Example Reporting Agency' } };
    if (url === '/applicants') return { data: [
      { applicant_id: 2101, agency_id: 7, first_name: 'Alice', middle_name: 'M.', last_name: 'Directory', applicant_code: 'AG7-2101' },
      { applicant_id: 2102, agency_id: 7, first_name: 'Bob', last_name: 'Directory', applicant_code: 'AG7-2102' },
    ] };
    if (url === '/job-orders') return { data: [
      { job_order_id: 9, agency_id: 7, position: 'Registered Nurse', position_title: 'Registered Nurse' },
      { job_order_id: 10, agency_id: 7, position: 'Welder' },
    ] };
    if (url === '/reports/monthly-deployments') return { data: monthly(params) };
    if (url === '/lookups/countries') return { data: [{ country_id: 2, country_name: 'Japan' }, { country_id: 63, country_name: 'Philippines' }] };
    if (url === '/employers') return { data: [{ employer_id: 4, agency_id: 7, company_name: 'Verified Employer' },
      { employer_id: 5, agency_id: 7, company_name: 'Pacific Staffing' },
      { employer_id: 8, agency_id: 99, company_name: 'Foreign Employer' }] };
    if (url === '/reports/staff-performance') return { data: staff(params) };
    if (url === '/reports/workflow-efficiency') return { data: workflow(params) };
    if (url === '/financial/records') return { data: [{ financial_record_id: 51, applicant_id: 201, agency_id: 7,
      amount: 12.35, currency: 'PHP', expense_date: '2026-11-05', applicant: { first_name: 'Financial', last_name: 'Applicant', agency_id: 7 } }] };
    throw new Error(`Unexpected mock request: ${url}`);
  });
});
afterEach(() => { drivers.splice(0).forEach((d) => d.unmount()); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Final report UX consistency', () => {
  it('uses concise Reporting Period labels while retaining UTC and explicit application', async () => {
    const d = driver(); await d.settle();
    expect(d.all().find((n) => n.props?.id === 'shared-period-title').props.children).toBe('Reporting Period');
    expect(text(d.render())).toContain('Select the period to use across all operational reports.');
    expect(text(d.render())).not.toContain('Shared Reporting Period');
    expect(text(d.render())).toContain('Applied: 2026-11-01 to 2026-11-30 (inclusive, UTC)');
    d.change('Narrow from', '2026-11-02'); await d.settle();
    expect(text(d.render())).toContain('Unapplied period changes'); expect(lastParams()).not.toHaveProperty('dateFrom');
    await d.applyPeriod(); expect(lastParams().dateFrom).toBe('2026-11-02');
  });
  it.each(Object.values(reportLabels))('places exactly one Export PDF action in the top-right header of %s', async (label) => {
    const d = driver(); await d.settle(); await d.select(label);
    const panel = d.all().find((n) => n.props?.role === 'tabpanel');
    const section = nodes(panel).find((n) => n.type === 'section');
    const header = nodes(panel).find((n) => n.type === 'header');
    expect(section.props.children[0]).toBe(header); expect(header.props.className).toContain('justify-between');
    const exports = nodes(panel).filter((n) => n.type === 'button' && text(n) === 'Export PDF');
    expect(exports).toHaveLength(1); expect(nodes(header)).toContain(exports[0]); expect(exports[0].props.disabled).toBe(false);
    expect(nodes(header).some((n) => n.props?.className?.includes('ml-auto'))).toBe(true);
    expect(text(panel)).not.toContain('Generate Report');
  });
  it.each(['staff_performance', 'financial_summary', 'workflow_efficiency'])('preserves export loading, duplicate-click protection and recovery for %s', async (name) => {
    const d = reportDriver(name); await d.settle(); const pending = deferred(); h.get.mockReturnValue(pending.promise);
    const calls = h.get.mock.calls.length; const click = d.button('Export PDF').props.onClick; click(); click();
    expect(h.get).toHaveBeenCalledTimes(calls + 1);
    expect(d.button('Exporting PDF…').props.disabled).toBe(true); expect(text(d.render())).toContain('Fetching fresh report for PDF');
    pending.reject(new Error('Export API failed')); await flush();
    expect(text(d.render())).toContain('Could not load this report'); expect(text(d.render())).toContain('Export PDF again');
    expect(d.button('Export PDF').props.disabled).toBe(false); expect(h.save).not.toHaveBeenCalled();
  });
  it.each(['staff_performance', 'financial_summary', 'workflow_efficiency'])('reports a %s PDF renderer failure truthfully', async (name) => {
    const d = reportDriver(name); await d.settle(); h.save.mockImplementation(() => { throw new Error('Download failed'); });
    d.button('Export PDF').props.onClick(); await flush();
    expect(text(d.render())).toContain('Could not generate the PDF'); expect(text(d.render())).not.toContain('PDF generated');
    expect(d.button('Export PDF').props.disabled).toBe(false);
  });
});

describe('Collapsible monthly filters', () => {
  it('starts collapsed with report results, refresh and export available', async () => {
    const d = driver(); await d.settle();
    expect(d.button('Filters').props['aria-expanded']).toBe(false);
    expect(d.input('Applicant name or code')).toBeUndefined(); expect(d.input('Position (exact match)')).toBeUndefined();
    expect(d.input('Destination country')).toBeUndefined(); expect(d.input('Employer')).toBeUndefined();
    expect(d.button('Apply Filters')).toBeUndefined(); expect(d.button('Browse agency applicants')).toBeUndefined();
    expect(d.button('Refresh report').props.disabled).toBe(false); expect(d.button('Export PDF').props.disabled).toBe(false);
    expect(text(d.render())).toContain('Applicant 100'); expect(text(d.render())).toContain('Applied filters: None');
    expect(h.get.mock.calls.some(([url]) => url === '/applicants')).toBe(false);
    d.button('Filters').props.onClick(); await d.settle();
    const form = d.all().find((n) => n.type === 'form' && n.props['aria-label'] === 'Monthly deployment filters');
    expect(form.props.id).toBe(d.button('Filters').props['aria-controls']); expect(d.button('Apply Filters')).toBeDefined();
    d.button('Filters').props.onClick(); await d.settle(); expect(d.button('Apply Filters')).toBeUndefined();
  });
  it('retains applied filters, pagination, pending drafts and results across collapse and expansion', async () => {
    const d = driver(); await d.settle();
    d.change('Applicant name or code', 'APP'); d.change('Position (exact match)', 'Nurse');
    d.chooseFilter('Destination country', 'Japan'); d.chooseFilter('Employer', 'Verified Employer'); await d.apply();
    d.button('Next').props.onClick(); await d.settle(); d.change('Applicant name or code', 'Pending draft');
    const reads = h.get.mock.calls.length;
    d.button('Filters').props.onClick(); await d.settle();
    const summary = d.all().find((n) => n.props['aria-label'] === 'Applied monthly filters');
    for (const label of ['Applicant contains: APP', 'Position (exact): Nurse', 'Country: Japan', 'Employer: Verified Employer']) expect(text(summary)).toContain(label);
    expect(text(summary)).not.toContain('Pending draft'); expect(text(d.render())).toContain('Page 2 of 2');
    expect(d.input('Applicant name or code')).toBeUndefined(); expect(h.get).toHaveBeenCalledTimes(reads);
    d.expandFilters(); await d.settle();
    expect(d.input('Applicant name or code').props.value).toBe('Pending draft');
    expect(d.input('Position (exact match)').props.value).toBe('Nurse');
    expect(d.input('Destination country').props.value).toBe('Japan'); expect(d.input('Employer').props.value).toBe('Verified Employer');
    expect(lastParams()).toMatchObject({ search: 'APP', position: 'Nurse', countryId: 2, employerId: 4, page: 2 });
  });
  it('exports the applied filters while collapsed, excluding pending edits and pagination', async () => {
    const d = driver(); await d.settle(); d.change('Applicant name or code', 'APP'); await d.apply();
    d.change('Applicant name or code', 'Unapplied'); d.button('Filters').props.onClick(); await d.settle();
    d.button('Export PDF').props.onClick(); await flush();
    expect(lastParams()).toEqual({ year: 2026, month: 11, search: 'APP' });
    expect(h.table.mock.calls[0][1].body).toHaveLength(27);
    const labels = h.pdfText.mock.calls.map(([value]) => value).join(' ');
    expect(labels).toContain('Example Reporting Agency'); expect(labels).toContain('Applicant contains: APP');
    expect(labels).not.toContain('Unapplied'); expect(d.button('Filters').props['aria-expanded']).toBe(false);
  });
});

describe('Unified agency applicant combobox (mocked authenticated GET only)', () => {
  const calls = () => h.get.mock.calls.filter(([url]) => url === '/applicants');
  const picker = (d: ReturnType<typeof driver>) => d.all().find((n) => n.props?.['aria-label'] === 'Agency applicant picker');
  const open = async (d: ReturnType<typeof driver>) => { d.expandFilters(); d.all().find((n) => n.type === Popover).props.onOpenChange(true); await d.settle(); };
  const key = async (d: ReturnType<typeof driver>, value: string, extra = {}) => {
    const preventDefault = vi.fn();
    d.input('Applicant name or code').props.onKeyDown({ key: value, preventDefault, nativeEvent: {}, ...extra });
    await d.settle(); await d.settle(); return preventDefault;
  };
  it('anchors the portalled list to the one combobox input with bounded viewport-aware sizing', async () => {
    const d = driver(); await d.settle(); await open(d);
    const root = d.all().find((n) => n.type === Popover);
    const trigger = d.all().find((n) => n.type === PopoverTrigger);
    const content = picker(d);
    expect(root.props.open).toBe(true); expect(trigger.props.asChild).toBe(true);
    expect(nodes(trigger).some((n) => n.type === 'button' && n.props['aria-label'] === 'Browse agency applicants')).toBe(true);
    expect(d.button('Browse agency applicants').props['aria-expanded']).toBe(true);
    const anchor = d.all().find((n) => n.type === PopoverAnchor);
    expect(nodes(anchor).some((n) => n.type === 'input' && n.props.role === 'combobox')).toBe(true);
    const input = d.input('Applicant name or code');
    expect(input.props).toMatchObject({ role: 'combobox', 'aria-expanded': true, 'aria-autocomplete': 'list', 'aria-haspopup': 'listbox' });
    expect(content.type).toBe(PopoverContent);
    expect(nodes(content).filter((n) => n.type === 'input')).toHaveLength(0);
    expect(d.all().filter((n) => n.type === 'input' && n.props.type === 'search')).toHaveLength(4);
    expect(d.button('Choose Applicant')).toBeUndefined();
    expect(content.props).toMatchObject({ align: 'start', side: 'bottom', sideOffset: 8, collisionPadding: 12,
      avoidCollisions: true, sticky: 'always', hideWhenDetached: true });
    expect(content.props.style).toEqual({ width: 'min(22rem, calc(100vw - 24px))',
      maxHeight: 'min(24rem, var(--radix-popover-content-available-height))' });
    expect(content.props.className).toContain('overflow-x-hidden');
    expect(content.props.className).toContain('overflow-y-auto');
    const list = nodes(content).find((n) => n.type === 'ul');
    expect(list.props.role).toBe('listbox'); expect(list.props.id).toBe(input.props['aria-controls']);
    expect(list.props.id).toBe(d.button('Browse agency applicants').props['aria-controls']);
    expect(list.props.className).toContain('max-h-48'); expect(list.props.className).toContain('overflow-y-auto');
    const primitive = readFileSync(new URL('../ui/popover.tsx', import.meta.url), 'utf8');
    expect(primitive).toContain('<PopoverPrimitive.Portal>');
    expect(primitive).toContain('<PopoverPrimitive.Content');
    // Radix owns Escape/outside dismissal and focus restoration. The controlled
    // callback must accept its close request without applying filters or reading again.
    const reads = h.get.mock.calls.length;
    root.props.onOpenChange(false); await d.settle();
    expect(picker(d)).toBeUndefined(); expect(d.button('Browse agency applicants').props['aria-expanded']).toBe(false);
    expect(h.get).toHaveBeenCalledTimes(reads); expect(lastParams()).not.toHaveProperty('search');
  });
  it('uses content-width breakpoints for one, two or five compact columns and an inset dropdown arrow', async () => {
    const d = driver(); await d.settle(); d.expandFilters();
    const form = d.all().find((n) => n.type === 'form' && n.props['aria-label'] === 'Monthly deployment filters');
    expect(form.props.className).toContain('@container');
    const grid = form.props.children[0];
    expect(grid.props.className).toContain('grid-cols-1'); expect(grid.props.className).toContain('@sm:grid-cols-2');
    expect(grid.props.className).toContain('@3xl:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto]');
    expect(grid.props.children).toHaveLength(5);
    expect(grid.props.children.slice(0, 4).every((n: any) => n.props.className.includes('min-w-0'))).toBe(true);
    expect(d.input('Applicant name or code').props.className).toContain('pr-10');
    expect(d.button('Browse agency applicants').props.className).toContain('absolute');
  });
  it('loads on demand from the established applicant endpoint, independently of report-page rows', async () => {
    const d = driver(); await d.settle(); expect(calls()).toHaveLength(0);
    d.expandFilters(); expect(d.button('Browse agency applicants').props.type).toBe('button'); await open(d);
    expect(calls()).toHaveLength(1); expect(calls()[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(calls()[0][1]).not.toHaveProperty('params');
    expect(text(picker(d))).toContain('Alice M. Directory'); expect(text(picker(d))).toContain('AG7-2101');
    expect(text(picker(d))).toContain('Bob Directory'); expect(text(picker(d))).toContain('AG7-2102');
    expect(text(picker(d))).not.toContain('Applicant 100');
    expect(text(picker(d))).toContain('Historical or unavailable applicants may be missing');
    expect(text(picker(d))).toContain('results still use substring matching');
  });
  it('fills the draft search with the chosen code without applying a filter or mutating data', async () => {
    const rows = Object.freeze([Object.freeze({ applicant_id: 2101, agency_id: 7, first_name: 'Alice', middle_name: 'M.', last_name: 'Directory', applicant_code: 'AG7-2101' })]);
    const fallback = h.get.getMockImplementation()!;
    h.get.mockImplementation((url, config) => url === '/applicants' ? Promise.resolve({ data: rows }) : fallback(url, config));
    const d = driver(); await d.settle(); await open(d); const reads = h.get.mock.calls.length;
    d.option('Choose Alice M. Directory (AG7-2101)').props.onClick(); await d.settle();
    expect(d.input('Applicant name or code').props.value).toBe('AG7-2101');
    expect(text(d.render())).toContain('Chosen: Alice M. Directory (AG7-2101)');
    expect(picker(d)).toBeUndefined(); expect(lastParams()).not.toHaveProperty('search');
    expect(h.get).toHaveBeenCalledTimes(reads); expect(h.save).not.toHaveBeenCalled();
    expect(rows[0].applicant_code).toBe('AG7-2101');
    await d.apply(); expect(lastParams().search).toBe('AG7-2101');
    d.button('Export PDF').props.onClick(); await flush();
    expect(lastParams().search).toBe('AG7-2101'); expect(lastParams()).not.toHaveProperty('page'); expect(lastParams()).not.toHaveProperty('pageSize');
    expect(h.table.mock.calls[0][1].body).toHaveLength(27);
  });
  it('preserves manual typing and never auto-selects another applicant from typed text', async () => {
    const d = driver(); await d.settle(); await open(d); d.option('Choose Alice M. Directory (AG7-2101)').props.onClick();
    d.change('Applicant name or code', 'AG7-2102'); await d.settle();
    expect(text(d.render())).not.toContain('Chosen:'); expect(d.button('Clear applicant')).toBeUndefined();
    expect(d.input('Applicant name or code').props.value).toBe('AG7-2102'); expect(lastParams()).not.toHaveProperty('search');
    await d.apply(); expect(lastParams().search).toBe('AG7-2102');
  });
  it('clears the chosen applicant as a draft change and keeps applied results until Apply Filters', async () => {
    const d = driver(); await d.settle(); await open(d); d.option('Choose Bob Directory (AG7-2102)').props.onClick(); await d.apply();
    const count = monthlyCalls().length; d.change('Applicant name or code', ''); await d.settle();
    expect(d.input('Applicant name or code').props.value).toBe(''); expect(text(d.render())).not.toContain('Chosen:');
    expect(monthlyCalls()).toHaveLength(count); expect(lastParams().search).toBe('AG7-2102');
    await d.apply(); expect(lastParams()).not.toHaveProperty('search');
  });
  it('filters cached picker options locally without changing report filters and reuses the directory', async () => {
    const d = driver(); await d.settle(); await open(d); const count = h.get.mock.calls.length;
    d.change('Applicant name or code', 'Bob'); await d.settle();
    expect(text(picker(d))).toContain('Bob Directory'); expect(text(picker(d))).not.toContain('Alice M. Directory');
    expect(d.input('Applicant name or code').props.value).toBe('Bob'); expect(h.get).toHaveBeenCalledTimes(count);
    expect(lastParams()).not.toHaveProperty('search');
    d.button('Close applicant picker').props.onClick(); await open(d); expect(calls()).toHaveLength(1);
    expect(text(picker(d))).toContain('Alice M. Directory');
    d.all().find((n) => n.type === Popover).props.onOpenChange(false); await d.settle(); expect(picker(d)).toBeUndefined();
  });
  it('searches applicant codes case-insensitively and exposes listbox options', async () => {
    const d = driver(); await d.settle(); await open(d);
    d.change('Applicant name or code', '  ag7-2102  '); await d.settle();
    expect(text(picker(d))).toContain('Bob Directory'); expect(text(picker(d))).not.toContain('Alice M. Directory');
    const choice = d.option('Choose Bob Directory (AG7-2102)');
    expect(choice.props.role).toBe('option'); expect(choice.props.tabIndex).toBeUndefined();
    choice.props.onClick(); await d.settle();
    expect(d.input('Applicant name or code').props.value).toBe('AG7-2102'); expect(picker(d)).toBeUndefined();
    expect(lastParams()).not.toHaveProperty('search');
  });
  it('does not submit report filters when Enter is pressed in the picker search', async () => {
    const d = driver(); await d.settle(); await open(d); const count = monthlyCalls().length;
    const preventDefault = await key(d, 'Enter');
    expect(preventDefault).toHaveBeenCalledOnce(); expect(monthlyCalls()).toHaveLength(count);
    expect(lastParams()).not.toHaveProperty('search');
  });
  it('navigates suggestions with arrow keys and selects with Enter without applying report filters', async () => {
    const d = driver(); await d.settle(); d.expandFilters();
    const reads = monthlyCalls().length;
    expect(await key(d, 'ArrowDown')).toHaveBeenCalledOnce();
    expect(d.input('Applicant name or code').props['aria-activedescendant']).toBe('deployment-applicant-option-2101');
    expect(d.element('deployment-applicant-option-2101').scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    await key(d, 'ArrowDown');
    expect(d.input('Applicant name or code').props['aria-activedescendant']).toBe('deployment-applicant-option-2102');
    await key(d, 'ArrowDown');
    expect(d.input('Applicant name or code').props['aria-activedescendant']).toBe('deployment-applicant-option-2101');
    await key(d, 'ArrowUp');
    expect(d.input('Applicant name or code').props['aria-activedescendant']).toBe('deployment-applicant-option-2102');
    const content = picker(d);
    expect(await key(d, 'Enter')).toHaveBeenCalledOnce(); expect(picker(d)).toBeUndefined();
    expect(d.input('Applicant name or code').props.value).toBe('AG7-2102'); expect(monthlyCalls()).toHaveLength(reads);
    const event = { preventDefault: vi.fn() }; content.props.onCloseAutoFocus(event);
    expect(event.preventDefault).toHaveBeenCalledOnce(); expect(d.element('deployment-applicant-search').focus).toHaveBeenCalledWith({ preventScroll: true });
  });
  it('supports Escape, resets active suggestions after editing, and leaves Tab navigation native', async () => {
    const d = driver(); await d.settle(); await open(d); await key(d, 'ArrowDown');
    d.change('Applicant name or code', 'No such applicant'); await d.settle();
    expect(d.input('Applicant name or code').props['aria-activedescendant']).toBeUndefined();
    expect(await key(d, 'Enter')).toHaveBeenCalledOnce(); expect(d.input('Applicant name or code').props.value).toBe('No such applicant');
    expect(await key(d, 'Escape')).toHaveBeenCalledOnce(); expect(picker(d)).toBeUndefined();
    expect(d.input('Applicant name or code').props['aria-expanded']).toBe(false);
    expect(d.input('Applicant name or code').props['aria-controls']).toBeUndefined();
    await open(d); const content = picker(d); d.element('deployment-applicant-search').focus.mockClear();
    expect(await key(d, 'Tab')).not.toHaveBeenCalled(); expect(picker(d)).toBeUndefined();
    content.props.onCloseAutoFocus({ preventDefault() {} }); expect(d.element('deployment-applicant-search').focus).not.toHaveBeenCalled();
    expect(lastParams()).not.toHaveProperty('search');
  });
  it('keeps focus in the input while typing and allows outside dismissal without stealing focus', async () => {
    const d = driver(); await d.settle(); await open(d); const content = picker(d);
    const focusEvent = { preventDefault: vi.fn() }; content.props.onOpenAutoFocus(focusEvent);
    expect(focusEvent.preventDefault).toHaveBeenCalledOnce(); expect(d.element('deployment-applicant-search').focus).toHaveBeenCalledWith({ preventScroll: true });
    const anchor = d.element('deployment-applicant-field'); anchor.contains.mockReturnValue(true);
    const inside = { target: {}, preventDefault: vi.fn() }; content.props.onInteractOutside(inside);
    expect(inside.preventDefault).toHaveBeenCalledOnce();
    anchor.contains.mockReturnValue(false); const outside = { target: {}, preventDefault: vi.fn() };
    content.props.onInteractOutside(outside); expect(outside.preventDefault).not.toHaveBeenCalled();
    d.all().find((n) => n.type === Popover).props.onOpenChange(false); await d.settle(); expect(picker(d)).toBeUndefined();
    d.element('deployment-applicant-search').focus.mockClear(); content.props.onCloseAutoFocus({ preventDefault() {} });
    expect(d.element('deployment-applicant-search').focus).not.toHaveBeenCalled();
  });
  it('closes suggestions on filter collapse, retaining the input value and focus on the toggle', async () => {
    const d = driver(); await d.settle(); d.change('Applicant name or code', 'Bob'); await d.settle(); const content = picker(d);
    d.element('deployment-applicant-search').focus.mockClear(); d.button('Filters').props.onClick(); await d.settle();
    expect(picker(d)).toBeUndefined(); content.props.onCloseAutoFocus({ preventDefault() {} });
    expect(d.element('deployment-applicant-search').focus).not.toHaveBeenCalled();
    d.expandFilters(); expect(d.input('Applicant name or code').props.value).toBe('Bob'); expect(picker(d)).toBeUndefined();
  });
  it.each([{ nativeEvent: { isComposing: true } }, { ctrlKey: true }, { altKey: true }, { metaKey: true }])('preserves IME and modified input shortcuts: %j', async (extra) => {
    const d = driver(); await d.settle(); d.expandFilters();
    expect(await key(d, 'ArrowDown', extra)).not.toHaveBeenCalled(); expect(picker(d)).toBeUndefined(); expect(calls()).toHaveLength(0);
  });
  it('shows loading, a truthful error and retry while manual report search remains usable', async () => {
    const d = driver(); await d.settle(); const pending = deferred(); const fallback = h.get.getMockImplementation()!;
    let first = true; h.get.mockImplementation((url, config) => {
      if (url === '/applicants' && first) { first = false; return pending.promise; } return fallback(url, config);
    });
    await open(d); expect(text(picker(d))).toContain('Loading applicant options');
    pending.reject(new Error('offline')); await flush(); expect(text(picker(d))).toContain('Could not load applicant options');
    d.change('Applicant name or code', 'Manual applicant'); await d.apply(); expect(lastParams().search).toBe('Manual applicant');
    d.change('Applicant name or code', ''); await d.settle();
    d.button('Retry applicant options').props.onClick(); await d.settle(); expect(text(picker(d))).toContain('Alice M. Directory');
  });
  it.each(['foreign agency', 'missing agency', 'invalid shape', 'conflicting identity', '403'])('rejects %s applicant options without exposing names', async (kind) => {
    const fallback = h.get.getMockImplementation()!;
    const row: any = { applicant_id: 2101, agency_id: kind === 'foreign agency' ? 99 : 7, first_name: 'Untrusted Applicant', last_name: 'Hidden', applicant_code: 'AG7-2101' };
    if (kind === 'missing agency') delete row.agency_id;
    const data = kind === 'invalid shape' ? { rows: [row] } : kind === 'conflicting identity' ? [row, { ...row, applicant_code: 'DIFFERENT' }] : [row];
    h.get.mockImplementation((url, config) => url === '/applicants' ? kind === '403' ? Promise.reject({ response: { status: 403 } }) : Promise.resolve({ data }) : fallback(url, config));
    const d = driver(); await d.settle(); await open(d);
    expect(text(picker(d))).toContain('Could not load applicant options'); expect(text(picker(d))).not.toContain('Untrusted Applicant');
    d.change('Applicant name or code', 'Manual'); await d.apply(); expect(lastParams().search).toBe('Manual');
  });
  it('omits missing, overlong and ambiguous codes while safely deduplicating identical applicant rows', async () => {
    const fallback = h.get.getMockImplementation()!;
    const row = (id: number, code: string | null) => ({ applicant_id: id, agency_id: 7, first_name: `Name ${id}`, applicant_code: code });
    const rows = [row(1, null), row(2, ' '), row(3, 'DUPLICATE'), row(4, 'duplicate'), row(5, 'x'.repeat(101)), row(6, 'UNIQUE'), row(6, 'UNIQUE')];
    h.get.mockImplementation((url, config) => url === '/applicants' ? Promise.resolve({ data: rows }) : fallback(url, config));
    const d = driver(); await d.settle(); await open(d);
    const choices = nodes(picker(d)).filter((n) => n.props?.role === 'option');
    expect(choices).toHaveLength(1); expect(choices[0].props['aria-label']).toBe('Choose Name 6 (UNIQUE)');
  });
  it('shows a useful empty picker without inventing applicants or a complete-directory claim', async () => {
    const fallback = h.get.getMockImplementation()!;
    h.get.mockImplementation((url, config) => url === '/applicants' ? Promise.resolve({ data: [] }) : fallback(url, config));
    const d = driver(); await d.settle(); await open(d);
    expect(text(picker(d))).toContain('No available applicants match'); expect(text(picker(d))).not.toContain('all applicants');
  });
  it('requires a verified report agency before loading the picker', async () => {
    const fallback = h.get.getMockImplementation()!;
    h.get.mockImplementation((url, config) => url === '/reports/monthly-deployments' ? Promise.reject({ response: { status: 403 } }) : fallback(url, config));
    const d = driver(); d.expandFilters(); expect(d.button('Browse agency applicants').props.disabled).toBe(true); await d.settle();
    expect(d.button('Browse agency applicants').props.disabled).toBe(true); expect(calls()).toHaveLength(0);
    expect(d.input('Applicant name or code').props.disabled).toBe(false);
    d.change('Applicant name or code', 'Manual'); await d.apply();
    expect(lastParams().search).toBe('Manual'); expect(calls()).toHaveLength(0);
  });
  it('cancels old picker reads when the applied period changes and ignores late responses', async () => {
    const d = driver(); await d.settle(); const pending = deferred(); const fallback = h.get.getMockImplementation()!;
    h.get.mockImplementation((url, config) => url === '/applicants' ? pending.promise : fallback(url, config));
    await open(d); d.change('Reporting month', '2026-10'); await d.applyPeriod();
    expect(calls()[0][1].signal.aborted).toBe(true);
    pending.resolve({ data: [{ applicant_id: 1, agency_id: 7, first_name: 'Stale Picker Applicant', applicant_code: 'OLD' }] }); await flush();
    expect(picker(d)).toBeUndefined(); expect(text(d.render())).not.toContain('Stale Picker Applicant');
    expect(d.button('Filters').props['aria-expanded']).toBe(false); d.expandFilters();
    expect(d.input('Applicant name or code').props.value).toBe('');
  });
});

describe('Position suggestions from authenticated agency Job Orders', () => {
  const calls = () => h.get.mock.calls.filter(([url]) => url === '/job-orders');
  const picker = (d: ReturnType<typeof driver>) => d.all().find((n) => n.props['aria-label'] === 'Position filter picker');
  it('loads only on demand and selects a complete position from partial case-insensitive suggestions without applying', async () => {
    const d = monthlyDriver(); await d.settle(); expect(calls()).toHaveLength(0);
    d.change('Position (exact match)', 'nUr'); await d.settle();
    expect(calls()).toHaveLength(1); expect(calls()[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(calls()[0][1]).not.toHaveProperty('params'); expect(monthlyCalls()).toHaveLength(1);
    expect(d.option('Registered Nurse')).toBeDefined(); expect(d.option('Welder')).toBeUndefined();
    expect(d.option('Nurse')).toBeUndefined(); // The paginated report contains Nurse; it is not the suggestion source.
    expect(text(picker(d))).toContain('Historical positions or orders outside the returned list may be missing');
    d.option('Registered Nurse').props.onClick(); await d.settle();
    expect(d.input('Position (exact match)').props.value).toBe('Registered Nurse'); expect(picker(d)).toBeUndefined();
    expect(lastParams()).not.toHaveProperty('position'); await d.apply(); expect(lastParams().position).toBe('Registered Nurse');
    d.openFilter('Position (exact match)'); await d.settle(); expect(d.option('Welder')).toBeDefined(); expect(calls()).toHaveLength(1);
    d.change('Position (exact match)', 'Historical Nurse_%'); await d.apply(); expect(lastParams().position).toBe('Historical Nurse_%');
    expect(calls()).toHaveLength(1); expect(d.button('Apply Filters').props.disabled).toBe(false);
  });
  it('deduplicates equivalent complete titles and supports the response alias without inventing unusable positions', async () => {
    const fallback = h.get.getMockImplementation()!;
    const data = [
      { job_order_id: 1, agency_id: 7, position: 'Registered Nurse' },
      { job_order_id: 2, agency_id: 7, position: ' registered nurse ' },
      { job_order_id: 3, agency_id: 7, position_title: 'Pipe Welder' },
      { job_order_id: 4, agency_id: 7, position: '  ' },
      { job_order_id: 5, agency_id: 7, position: 'x'.repeat(201) },
      { job_order_id: 6, agency_id: 7, position: 'Bad\nPosition' },
      { job_order_id: 7, agency_id: 7, position: 'Deleted position', deleted_at: date },
    ];
    const original = structuredClone(data);
    h.get.mockImplementation((url, config) => url === '/job-orders' ? Promise.resolve({ data }) : fallback(url, config));
    const d = monthlyDriver(); await d.settle(); d.openFilter('Position (exact match)'); await d.settle();
    const choices = nodes(picker(d)).filter((n) => n.props?.role === 'option');
    expect(choices.map((n) => n.props['aria-label'])).toEqual(['Pipe Welder', 'Registered Nurse']); expect(data).toEqual(original);
  });
  it('uses every returned Job Order without introducing an unsupported pagination contract or claiming completeness', async () => {
    const fallback = h.get.getMockImplementation()!;
    const data = Array.from({ length: 1007 }, (_, index) => ({ job_order_id: index + 1, agency_id: 7, position: `Position ${index + 1}` }));
    h.get.mockImplementation((url, config) => url === '/job-orders' ? Promise.resolve({ data }) : fallback(url, config));
    const d = monthlyDriver(); await d.settle(); d.openFilter('Position (exact match)'); await d.settle();
    expect(nodes(picker(d)).filter((n) => n.props?.role === 'option')).toHaveLength(1007);
    expect(d.option('Position 1007')).toBeDefined(); expect(calls()).toHaveLength(1); expect(calls()[0][1]).not.toHaveProperty('params');
    expect(text(picker(d))).not.toContain('all historical positions');
  });
  it.each(['foreign agency', 'missing agency', 'malformed envelope', 'invalid position', 'conflicting aliases', 'conflicting identity', '403'])('rejects %s Job Order data while retaining manual exact-match entry', async (kind) => {
    const fallback = h.get.getMockImplementation()!;
    const row: any = { job_order_id: 1, agency_id: kind === 'foreign agency' ? 99 : 7, position: 'Untrusted Position' };
    if (kind === 'missing agency') delete row.agency_id;
    if (kind === 'invalid position') row.position = 55;
    if (kind === 'conflicting aliases') row.position_title = 'Other Title';
    const data = kind === 'malformed envelope' ? { rows: [row], total: 1 } :
      kind === 'conflicting identity' ? [row, { ...row, position: 'Different Position' }] : [row];
    h.get.mockImplementation((url, config) => url === '/job-orders' ? kind === '403' ? Promise.reject({ response: { status: 403 } }) : Promise.resolve({ data }) : fallback(url, config));
    const d = monthlyDriver(); await d.settle(); d.openFilter('Position (exact match)'); await d.settle();
    expect(text(picker(d))).toContain('Could not load Job Order positions'); expect(text(picker(d))).not.toContain('Untrusted Position');
    expect(d.input('Position (exact match)').props.disabled).toBe(false);
    d.change('Position (exact match)', ' Manual Historical Position '); await d.apply();
    expect(lastParams().position).toBe('Manual Historical Position'); expect(calls()).toHaveLength(1);
  });
  it('shows truthful loading and empty states, with retry and manual position filtering still available', async () => {
    const pending = deferred(); const fallback = h.get.getMockImplementation()!;
    h.get.mockImplementation((url, config) => url === '/job-orders' ? pending.promise : fallback(url, config));
    const d = monthlyDriver(); await d.settle(); d.openFilter('Position (exact match)'); await d.settle();
    expect(text(picker(d))).toContain('Loading position options');
    d.change('Position (exact match)', 'Unavailable title'); await d.apply(); expect(lastParams().position).toBe('Unavailable title');
    expect(calls()).toHaveLength(1); pending.reject(new Error('Offline')); await flush();
    expect(text(picker(d))).toContain('Could not load Job Order positions');
    h.get.mockImplementation((url, config) => url === '/job-orders' ? Promise.resolve({ data: [] }) : fallback(url, config));
    d.button('Retry position options').props.onClick(); await d.settle(); expect(text(picker(d))).toContain('No available Job Order positions match');
    expect(d.button('Apply Filters').props.disabled).toBe(false); expect(calls()).toHaveLength(2);
  });
  it('cancels a pending position read when the applied period changes and ignores its late result', async () => {
    const pending = deferred(); const fallback = h.get.getMockImplementation()!;
    h.get.mockImplementation((url, config) => url === '/job-orders' ? pending.promise : fallback(url, config));
    const d = monthlyDriver(); await d.settle(); d.openFilter('Position (exact match)'); await d.settle();
    d.change('Reporting month', '2026-10'); await d.applyPeriod(); expect(calls()[0][1].signal.aborted).toBe(true);
    pending.resolve({ data: [{ job_order_id: 1, agency_id: 7, position: 'Stale Job Position' }] }); await flush();
    expect(picker(d)).toBeUndefined(); expect(text(d.render())).not.toContain('Stale Job Position');
    d.expandFilters(); expect(d.input('Position (exact match)').props.value).toBe('');
  });
  it('supports keyboard selection and opens only one of the four filter popovers', async () => {
    const d = monthlyDriver(); await d.settle(); d.openFilter('Employer'); await d.settle();
    d.change('Position (exact match)', 'weld'); await d.settle();
    expect(d.input('Position (exact match)').props).toMatchObject({ role: 'combobox', 'aria-autocomplete': 'list', 'aria-haspopup': 'listbox', 'aria-expanded': true });
    expect(d.input('Employer').props['aria-expanded']).toBe(false); expect(d.all().filter((n) => n.type === PopoverContent)).toHaveLength(1);
    const preventDefault = vi.fn(); d.input('Position (exact match)').props.onKeyDown({ key: 'ArrowDown', preventDefault }); await d.settle(); await d.settle();
    expect(d.input('Position (exact match)').props['aria-activedescendant']).toBe('deployment-position-option-10');
    d.input('Position (exact match)').props.onKeyDown({ key: 'Enter', preventDefault }); await d.settle();
    expect(d.input('Position (exact match)').props.value).toBe('Welder'); expect(picker(d)).toBeUndefined(); expect(monthlyCalls()).toHaveLength(1);
    await d.apply(); expect(lastParams().position).toBe('Welder');
  });
  it('requires a validated report agency before reading Job Orders, without disabling manual entry', async () => {
    const fallback = h.get.getMockImplementation()!;
    h.get.mockImplementation((url, config) => url === '/reports/monthly-deployments' ? Promise.reject({ response: { status: 403 } }) : fallback(url, config));
    const d = monthlyDriver(); await d.settle(); expect(d.button('Browse Job Order positions').props.disabled).toBe(true);
    d.change('Position (exact match)', 'Welder'); await d.apply(); expect(calls()).toHaveLength(0); expect(lastParams().position).toBe('Welder');
  });
});

describe('Searchable country and employer filters', () => {
  const fields = [
    { label: 'Destination country', term: 'pH', name: 'Philippines', id: 63, parameter: 'countryId', reset: 'All countries', prefix: 'deployment-country', picker: 'Country filter picker', excluded: 'Japan' },
    { label: 'Employer', term: 'sTaF', name: 'Pacific Staffing', id: 5, parameter: 'employerId', reset: 'All employers', prefix: 'deployment-employer', picker: 'Employer filter picker', excluded: 'Verified Employer' },
  ];
  const key = async (d: ReturnType<typeof driver>, label: string, value: string) => {
    const preventDefault = vi.fn(); d.input(label).props.onKeyDown({ key: value, preventDefault, nativeEvent: {} });
    await d.settle(); await d.settle(); return preventDefault;
  };
  it.each(fields)('filters $label by case-insensitive contained text, selecting readable names and sending only IDs on Apply', async (field) => {
    const d = monthlyDriver(); await d.settle(); const reads = h.get.mock.calls.length;
    d.change(field.label, field.term); await d.settle();
    expect(d.option(field.name)).toBeDefined(); expect(d.option(field.excluded)).toBeUndefined();
    expect(d.input(field.label).props.value).toBe(field.term); expect(d.input(field.label).props['aria-invalid']).toBe(true);
    expect(d.button('Apply Filters').props.disabled).toBe(true); expect(h.get).toHaveBeenCalledTimes(reads);
    d.option(field.name).props.onClick(); await d.settle();
    expect(d.input(field.label).props.value).toBe(field.name); expect(d.input(field.label).props['aria-invalid']).toBeUndefined();
    expect(d.button('Apply Filters').props.disabled).toBe(false); expect(h.get).toHaveBeenCalledTimes(reads);
    await d.apply(); expect(lastParams()[field.parameter]).toBe(field.id);
    expect(text(d.render())).toContain(`${field.parameter === 'countryId' ? 'Country' : 'Employer'}: ${field.name}`);
    expect(typeof lastParams()[field.parameter]).toBe('number');
    const input = d.input(field.label); d.openFilter(field.label); await d.settle();
    expect(d.option(field.excluded)).toBeDefined(); expect(d.input(field.label).props.value).toBe(input.props.value);
    expect(d.all().filter((n) => n.props?.role === 'option' && n.props['aria-selected'])).toHaveLength(1);
  });
  it.each(fields)('resets $label through its All option or by clearing the same input', async (field) => {
    const d = monthlyDriver(); await d.settle(); d.chooseFilter(field.label, field.name); await d.apply();
    let count = monthlyCalls().length;
    d.chooseFilter(field.label, field.reset); await d.settle();
    expect(d.input(field.label).props.value).toBe(''); expect(d.input(field.label).props.placeholder).toBe(field.reset);
    expect(monthlyCalls()).toHaveLength(count); expect(lastParams()[field.parameter]).toBe(field.id);
    await d.apply(); expect(lastParams()).not.toHaveProperty(field.parameter);
    d.chooseFilter(field.label, field.name); await d.apply(); count = monthlyCalls().length;
    d.change(field.label, ''); await d.settle(); expect(monthlyCalls()).toHaveLength(count);
    expect(d.button('Apply Filters').props.disabled).toBe(false);
    await d.apply(); expect(lastParams()).not.toHaveProperty(field.parameter);
  });
  it.each(fields.flatMap((field) => ['unmatched', 'numeric', 'full name'].map((kind) => ({ ...field, kind }))))('blocks unintended $label filtering for $kind text and preserves applied PDF filters', async (field) => {
    const d = monthlyDriver(); await d.settle(); d.chooseFilter(field.label, field.name); await d.apply();
    const count = monthlyCalls().length;
    const query = field.kind === 'numeric' ? String(field.id) : field.kind === 'full name' ? field.name : 'No such lookup value';
    d.change(field.label, query); await d.settle();
    expect(d.input(field.label).props['aria-invalid']).toBe(true);
    expect(d.input(field.label).props['aria-describedby']).toBe('monthly-filter-error');
    expect(d.button('Apply Filters').props.disabled).toBe(true);
    await d.apply(); expect(monthlyCalls()).toHaveLength(count); expect(lastParams()[field.parameter]).toBe(field.id);
    const summary = d.all().find((n) => n.props['aria-label'] === 'Applied monthly filters'); expect(text(summary)).toContain(field.name);
    d.button('Export PDF').props.onClick(); await flush();
    expect(lastParams()[field.parameter]).toBe(field.id); expect(lastParams()).not.toHaveProperty('page');
    expect(h.table.mock.calls[0][1].body).toHaveLength(27); expect(h.save).toHaveBeenCalledOnce();
    expect(h.pdfText.mock.calls[0][0]).toBe('Example Reporting Agency');
  });
  it.each(fields)('supports accessible floating $label options, keyboard selection, Escape and native Tab behavior', async (field) => {
    const d = monthlyDriver(); await d.settle(); d.change(field.label, field.term); await d.settle();
    const content = d.all().find((n) => n.props['aria-label'] === field.picker);
    const input = d.input(field.label);
    expect(input.props).toMatchObject({ role: 'combobox', 'aria-autocomplete': 'list', 'aria-haspopup': 'listbox', 'aria-expanded': true });
    expect(nodes(content).some((n) => n.props?.id === input.props['aria-controls'] && n.props.role === 'listbox')).toBe(true);
    expect(nodes(content).filter((n) => n.type === 'input')).toHaveLength(0);
    expect(content.type).toBe(PopoverContent); expect(content.props).toMatchObject({ align: 'start', avoidCollisions: true, collisionPadding: 12 });
    expect(content.props.style.maxHeight).toContain('--radix-popover-content-available-height');
    expect(nodes(content).find((n) => n.props?.role === 'listbox').props.className).toContain('overflow-y-auto');
    expect(await key(d, field.label, 'ArrowDown')).toHaveBeenCalledOnce();
    expect(d.input(field.label).props['aria-activedescendant']).toBe(`${field.prefix}-option-${field.id}`);
    expect(d.element(`${field.prefix}-option-${field.id}`).scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    expect(await key(d, field.label, 'Enter')).toHaveBeenCalledOnce(); expect(d.input(field.label).props.value).toBe(field.name);
    content.props.onCloseAutoFocus({ preventDefault() {} }); expect(d.element(`${field.prefix}-search`).focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(monthlyCalls()).toHaveLength(1);
    d.openFilter(field.label); await d.settle(); expect(await key(d, field.label, 'Escape')).toHaveBeenCalledOnce();
    expect(d.input(field.label).props['aria-expanded']).toBe(false);
    d.openFilter(field.label); await d.settle(); expect(await key(d, field.label, 'Tab')).not.toHaveBeenCalled();
    expect(d.input(field.label).props['aria-expanded']).toBe(false);
  });
  it('keeps only one dropdown open and prevents the previous picker from stealing the next input focus', async () => {
    const d = monthlyDriver(); await d.settle(); d.openFilter('Applicant name or code'); await d.settle();
    const applicant = d.all().find((n) => n.props['aria-label'] === 'Agency applicant picker');
    d.element('deployment-applicant-search').focus.mockClear();
    d.openFilter('Destination country'); await d.settle();
    expect(d.all().filter((n) => n.type === PopoverContent)).toHaveLength(1);
    expect(d.input('Applicant name or code').props['aria-expanded']).toBe(false);
    applicant.props.onCloseAutoFocus({ preventDefault() {} }); expect(d.element('deployment-applicant-search').focus).not.toHaveBeenCalled();
    const country = d.all().find((n) => n.props['aria-label'] === 'Country filter picker'); d.element('deployment-country-search').focus.mockClear();
    d.openFilter('Employer'); await d.settle(); expect(d.all().filter((n) => n.type === PopoverContent)).toHaveLength(1);
    country.props.onCloseAutoFocus({ preventDefault() {} }); expect(d.element('deployment-country-search').focus).not.toHaveBeenCalled();
    expect(d.input('Employer').props['aria-expanded']).toBe(true);
  });
  it('retains selected IDs and search text independently across collapse, then resets pagination only when applied', async () => {
    const d = monthlyDriver(); await d.settle();
    d.chooseFilter('Destination country', 'Japan'); d.chooseFilter('Employer', 'Verified Employer'); await d.apply();
    d.button('Next').props.onClick(); await d.settle();
    d.change('Destination country', 'pH'); d.change('Employer', 'sTaF'); await d.settle();
    const count = monthlyCalls().length; d.button('Filters').props.onClick(); await d.settle();
    expect(d.input('Destination country')).toBeUndefined(); expect(text(d.render())).toContain('Country: Japan');
    expect(text(d.render())).toContain('Employer: Verified Employer'); expect(text(d.render())).toContain('Page 2 of 2');
    d.expandFilters(); expect(d.input('Destination country').props.value).toBe('pH'); expect(d.input('Employer').props.value).toBe('sTaF');
    expect(d.button('Apply Filters').props.disabled).toBe(true); expect(monthlyCalls()).toHaveLength(count);
    const error = d.all().find((n) => n.props.id === 'monthly-filter-error');
    expect(text(error)).toContain('Choose a destination country'); expect(text(error)).toContain('Choose an employer');
    d.chooseFilter('Destination country', 'Philippines'); d.chooseFilter('Employer', 'Pacific Staffing'); await d.apply();
    expect(lastParams()).toMatchObject({ countryId: 63, employerId: 5, page: 1 });
    d.button('Export PDF').props.onClick(); await flush(); expect(lastParams()).toEqual({ year: 2026, month: 11, countryId: 63, employerId: 5 });
    const labels = h.pdfText.mock.calls.map(([value]) => value).join(' '); expect(labels).toContain('Country: Philippines'); expect(labels).toContain('Employer: Pacific Staffing');
  });
  it('uses only the established authenticated lookup reads, excluding foreign employers and preserving manual exact positions', async () => {
    const d = monthlyDriver(); await d.settle();
    for (const url of ['/lookups/countries', '/employers']) {
      const calls = h.get.mock.calls.filter(([path]) => path === url); expect(calls).toHaveLength(1);
      expect(calls[0][1].signal).toBeInstanceOf(AbortSignal); expect(calls[0][1]).not.toHaveProperty('params');
    }
    d.openFilter('Employer'); await d.settle(); expect(d.option('Foreign Employer')).toBeUndefined();
    d.change('Employer', 'Foreign Employer'); await d.settle(); expect(d.option('Foreign Employer')).toBeUndefined();
    expect(text(d.render())).toContain('No employers match'); expect(d.button('Apply Filters').props.disabled).toBe(true);
    d.change('Employer', ''); d.change('Position (exact match)', ' Registered Nurse '); await d.apply();
    expect(lastParams().position).toBe('Registered Nurse'); expect(lastParams()).not.toHaveProperty('employerId');
    expect(d.input('Position (exact match)').props.role).toBe('combobox'); expect(d.input('Position (exact match)').props.placeholder).toBe('Full position name');
    expect(h.get.mock.calls.every(([url]) => ['/lookups/agency', '/lookups/countries', '/employers', '/job-orders', '/reports/monthly-deployments'].includes(url))).toBe(true);
  });
  it.each([
    ['/lookups/countries', { rows: [{ country_id: 1, country_name: 'Invalid country' }] }, 'Destination country'],
    ['/lookups/countries', [{ country_id: '63', country_name: 'Invalid country' }], 'Destination country'],
    ['/employers', [{ employer_id: 5, company_name: 'Unscoped employer' }], 'Employer'],
    ['/employers', [{ employer_id: 5, agency_id: 99, company_name: 'Foreign employer only' }], 'Employer'],
  ])('excludes unauthorized or malformed options from %s', async (url, data, label) => {
    const fallback = h.get.getMockImplementation()!;
    h.get.mockImplementation((path, config) => path === url ? Promise.resolve({ data }) : fallback(path, config));
    const d = monthlyDriver(); await d.settle(); expect(d.input(label as string).props.disabled).toBe(true);
    expect(d.all().some((n) => n.props?.role === 'option')).toBe(false);
    await d.apply(); expect(lastParams()).not.toHaveProperty(label === 'Employer' ? 'employerId' : 'countryId');
  });
});

describe('Compact report tabs and shared UTC period', () => {
  it('places four compact tabs below the shared period and above one integrated report panel', async () => {
    const d = driver(); await d.settle();
    const tree = d.render(); const children = tree.props.children;
    const sharedIndex = children.findIndex((n: any) => n?.props?.['aria-labelledby'] === 'shared-period-title');
    const workspaceIndex = children.findIndex((n: any) => nodes(n).some((child) => child.props?.role === 'tablist'));
    expect(sharedIndex).toBeLessThan(workspaceIndex);
    const workspace = children[workspaceIndex];
    const visibleNodes = nodes(workspace);
    expect(visibleNodes.findIndex((n) => n.props?.role === 'tablist')).toBeLessThan(visibleNodes.findIndex((n) => n.props?.role === 'tabpanel'));
    const tabs = d.all().filter((n) => n.props?.role === 'tab'); expect(tabs.map(text)).toEqual(Object.values(reportLabels));
    expect(tabs.every((tab) => tab.props.className.includes('py-2.5') && !tab.props.className.includes('p-5'))).toBe(true);
    expect(d.all().some((n) => n.props?.['aria-label'] === 'Report overview')).toBe(false);
    expect(text(workspace)).not.toContain('View details'); expect(text(workspace)).not.toContain('Hide details');
    expect(d.all().filter((n) => n.props?.role === 'tabpanel')).toHaveLength(1);
    expect(d.button('Monthly Deployment').props['aria-selected']).toBe(true);
  });
  it('uses native tab buttons, one selected tab and matching accessible panels', async () => {
    const d = driver(); await d.settle();
    const tablist = d.all().find((n) => n.props?.role === 'tablist');
    expect(tablist.props['aria-label']).toBe('Operational report types'); expect(tablist.props['aria-orientation']).toBe('horizontal');
    for (const label of Object.values(reportLabels)) {
      const tab = d.button(label); expect(tab.type).toBe('button'); expect(tab.props.type).toBe('button');
      expect(tab.props.className).toContain('focus-visible:ring-2');
      expect(tab.props['aria-controls']).toBeTruthy(); expect(tab.props['aria-expanded']).toBeUndefined();
      await d.select(label);
      expect(d.button(label).props['aria-selected']).toBe(true);
      const tabs = d.all().filter((n) => n.props?.role === 'tab');
      expect(tabs.filter((n) => n.props['aria-selected'])).toHaveLength(1);
      expect(tabs.map((n) => n.props.tabIndex)).toEqual(tabs.map((n) => n.props['aria-selected'] ? 0 : -1));
      const panel = d.all().find((n) => n.props?.role === 'tabpanel');
      expect(panel.props.id).toBe(d.button(label).props['aria-controls']);
      expect(panel.props['aria-labelledby']).toBe(d.button(label).props.id); expect(panel.props.tabIndex).toBe(0);
      expect(panel.props.className).toContain('focus-visible:ring-inset');
      expect(d.button(label).props.className).toContain('border-[#0EA5E9]');
    }
  });
  it('keeps the active tab open and switches to only one visible detail panel', async () => {
    const d = driver(); await d.settle(); await d.select('Monthly Deployment');
    expect(d.all().filter((n) => n.props?.role === 'tabpanel')).toHaveLength(1);
    expect(d.all().filter((n) => n.type === 'table')).toHaveLength(1);
    await d.select('Staff Activity');
    expect(d.all().filter((n) => n.props?.role === 'tabpanel')).toHaveLength(1);
    expect(d.all().filter((n) => n.type === 'table')).toHaveLength(0);
    expect(d.button('Monthly Deployment').props['aria-selected']).toBe(false);
    expect(text(d.render())).toContain('3 logged actions');
    await d.select('Financial Summary'); expect(text(d.render())).toContain('PHP: 12.35');
    expect(text(d.render())).not.toContain('3 logged actions');
    await d.select('Workflow Efficiency'); expect(text(d.render())).toContain('2 days average total duration');
    expect(text(d.render())).not.toContain('PHP: 12.35');
  });
  it.each(Object.values(reportLabels))('keeps %s selected when it is clicked again without refetching', async (label) => {
    const d = driver(); await d.settle(); await d.select(label);
    const requests = h.get.mock.calls.length;
    await d.select(label);
    expect(d.button(label).props['aria-selected']).toBe(true);
    expect(d.all().filter((n) => n.props?.role === 'tabpanel')).toHaveLength(1);
    expect(h.get).toHaveBeenCalledTimes(requests);
    expect(text(d.render())).toContain('Applied: 2026-11-01 to 2026-11-30');
  });
  it.each([
    ['Monthly Deployment', 'ArrowRight', 'Staff Activity'], ['Monthly Deployment', 'ArrowLeft', 'Workflow Efficiency'],
    ['Workflow Efficiency', 'ArrowRight', 'Monthly Deployment'], ['Financial Summary', 'Home', 'Monthly Deployment'],
    ['Staff Activity', 'End', 'Workflow Efficiency'],
  ])('moves keyboard focus and selection from %s using %s to %s', async (start, key, target) => {
    const d = driver(); await d.settle(); await d.select(start);
    const preventDefault = vi.fn(); d.button(start).props.onKeyDown({ key, preventDefault }); await d.settle();
    expect(preventDefault).toHaveBeenCalledOnce(); expect(d.button(target).props['aria-selected']).toBe(true);
    expect(d.tabElement(target).focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(d.tabElement(target).scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
    expect(d.all().find((n) => n.props?.role === 'tabpanel').props['aria-labelledby']).toBe(d.button(target).props.id);
  });
  it.each(['Tab', 'ArrowUp', 'ArrowDown', 'Enter', ' '])('leaves native %s behavior available', async (key) => {
    const d = driver(); await d.settle(); const preventDefault = vi.fn();
    d.button('Monthly Deployment').props.onKeyDown({ key, preventDefault }); await d.settle();
    expect(preventDefault).not.toHaveBeenCalled(); expect(d.button('Monthly Deployment').props['aria-selected']).toBe(true);
  });
  it('keeps browser shortcuts available and confines mobile horizontal scrolling to the tab strip and table', async () => {
    const d = driver(); await d.settle(); const preventDefault = vi.fn();
    for (const modifier of ['ctrlKey', 'altKey', 'metaKey']) d.button('Monthly Deployment').props.onKeyDown({ key: 'ArrowRight', [modifier]: true, preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
    const tree = d.render(); expect(tree.props.className).toContain('min-w-0'); expect(tree.props.className).toContain('max-w-full');
    const strip = d.all().find((n) => n.props?.children?.props?.role === 'tablist');
    expect(strip.props.className).toContain('overflow-x-auto'); expect(strip.props.className).toContain('max-w-full');
    const tablist = d.all().find((n) => n.props?.role === 'tablist');
    expect(tablist.props.className).toContain('flex'); expect(tablist.props.className).not.toContain('flex-wrap');
    expect(d.all().filter((n) => n.props?.role === 'tab').every((n) => n.props.className.includes('shrink-0') && n.props.className.includes('whitespace-nowrap'))).toBe(true);
    expect(d.all().filter((n) => n.props?.className?.includes('overflow-x-auto'))).toHaveLength(2);
  });
  it('loads other reports only on first opening and reuses each report while toggling', async () => {
    const d = driver(); await d.settle();
    expect(h.get.mock.calls.some(([url]) => url === '/reports/staff-performance')).toBe(false);
    for (const label of Object.values(reportLabels)) {
      if (label !== 'Monthly Deployment') await d.select(label);
      const count = h.get.mock.calls.length;
      await d.select(label); await d.select(label);
      expect(h.get).toHaveBeenCalledTimes(count);
    }
  });
  it('retains the monthly applied filters, page and pending draft while opening another report', async () => {
    const d = driver(); await d.settle(); d.change('Applicant name or code', 'APP'); await d.apply();
    d.button('Next').props.onClick(); await d.settle(); d.change('Position (exact match)', 'Unapplied');
    const count = monthlyCalls().length; await d.select('Staff Activity'); await d.select('Monthly Deployment');
    expect(monthlyCalls()).toHaveLength(count); expect(text(d.render())).toContain('Page 2 of 2');
    expect(text(d.render())).toContain('Applicant contains: APP'); expect(d.input('Position (exact match)').props.value).toBe('Unapplied');
  });
  it('defaults to the complete current UTC calendar month, independently of local date getters', async () => {
    vi.setSystemTime(new Date('2026-10-31T23:30:00Z'));
    vi.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2030);
    vi.spyOn(Date.prototype, 'getMonth').mockReturnValue(10);
    const d = driver(); await d.settle();
    expect(d.input('Reporting month').props.value).toBe('2026-10');
    expect(lastParams()).toEqual({ year: 2026, month: 10, page: 1, pageSize: 25 });
    expect(text(d.render())).toContain('Applied: 2026-10-01 to 2026-10-31 (inclusive, UTC)');
  });
  it('keeps draft dates unapplied across tab switching and PDF export', async () => {
    const d = driver(); await d.settle(); const count = monthlyCalls().length;
    d.change('Reporting month', '2026-10'); d.change('Narrow from', '2026-10-04'); await d.settle();
    expect(monthlyCalls()).toHaveLength(count); expect(text(d.render())).toContain('Unapplied period changes');
    expect(text(d.render())).toContain('Applied: 2026-11-01 to 2026-11-30');
    await d.select('Staff Activity');
    expect(h.get.mock.calls.filter(([url]) => url === '/reports/staff-performance').at(-1)![1].params)
      .toEqual({ dateFrom: '2026-11-01', dateTo: '2026-11-30' });
    await d.select('Monthly Deployment'); d.button('Export PDF').props.onClick(); await flush();
    expect(lastParams()).toEqual({ year: 2026, month: 11 }); expect(text(d.render())).toContain('PDF generated with 27');
  });
  it('applies the same narrowed UTC dates to all reports, including financial filtering', async () => {
    const fallback = h.get.getMockImplementation()!;
    h.get.mockImplementation((url, config) => url === '/financial/records' ? Promise.resolve({ data: [
      { financial_record_id: 1, applicant_id: 1, agency_id: 7, amount: 4, currency: 'PHP', expense_date: '2026-11-01' },
      { financial_record_id: 2, applicant_id: 1, agency_id: 7, amount: 12.35, currency: 'PHP', expense_date: '2026-11-05' },
      { financial_record_id: 3, applicant_id: 1, agency_id: 7, amount: 8, currency: 'USD', expense_date: '2026-11-07' },
    ] }) : fallback(url, config));
    const d = driver(); await d.settle(); d.change('Narrow from', '2026-11-02'); d.change('Narrow to', '2026-11-06'); await d.applyPeriod();
    expect(lastParams()).toEqual({ year: 2026, month: 11, dateFrom: '2026-11-02', dateTo: '2026-11-06', page: 1, pageSize: 25 });
    for (const name of ['staff_performance', 'workflow_efficiency']) {
      await d.select(reportLabels[name]);
      const endpoint = name === 'staff_performance' ? '/reports/staff-performance' : '/reports/workflow-efficiency';
      expect(h.get.mock.calls.filter(([url]) => url === endpoint).at(-1)![1].params).toEqual({ dateFrom: '2026-11-02', dateTo: '2026-11-06' });
      expect(text(d.render())).toContain('Applied period: 2026-11-02 to 2026-11-06 UTC');
    }
    await d.select('Financial Summary'); expect(text(d.render())).toContain('Financial Records: 1');
    expect(text(d.render())).toContain('PHP: 12.35'); expect(text(d.render())).not.toContain('USD:');
    d.button('Export PDF').props.onClick(); await flush();
    expect(h.table.mock.calls[0][1].body).toHaveLength(1); expect(h.table.mock.calls[0][1].body[0][0]).toBe('2026-11-05');
    expect(h.pdfText.mock.calls.map(([value]) => value).join(' ')).toContain('2026-11-02 to 2026-11-06');
  });
  it.each(['Monthly Deployment', 'Staff Activity', 'Financial Summary', 'Workflow Efficiency'])('shows only one shared set of date controls with %s selected', async (label) => {
    const d = driver(); await d.settle(); if (label !== 'Monthly Deployment') await d.select(label);
    expect(d.all().filter((n) => n.type === 'input' && n.props.type === 'month')).toHaveLength(1);
    expect(d.all().filter((n) => n.type === 'input' && n.props.type === 'date')).toHaveLength(2);
    const region = d.all().find((n) => n.props?.role === 'tabpanel');
    expect(nodes(region).filter((n) => n.type === 'input' && ['month', 'date'].includes(n.props.type))).toHaveLength(0);
  });
  it.each(['', '0000-11', '9999-01', '2026-13'])('rejects invalid reporting month %s without disturbing applied results', async (value) => {
    const d = driver(); await d.settle(); const count = monthlyCalls().length; d.change('Reporting month', value);
    expect(d.button('Apply Period').props.disabled).toBe(true); await d.applyPeriod();
    expect(monthlyCalls()).toHaveLength(count); expect(text(d.render())).toContain('Select a valid reporting month');
    expect(text(d.render())).toContain('Applicant 100');
  });
  it.each([
    ['2025-12', '2025-12-01', '2025-12-31'], ['2026-01', '2026-01-01', '2026-01-31'],
    ['2024-02', '2024-02-01', '2024-02-29'], ['2025-02', '2025-02-01', '2025-02-28'],
    ['0001-01', '0001-01-01', '0001-01-31'], ['9998-12', '9998-12-01', '9998-12-31'],
  ])('handles UTC calendar boundaries for %s', async (month, first, last) => {
    const d = driver(); await d.settle(); d.change('Reporting month', month); await d.applyPeriod();
    expect(lastParams()).toMatchObject({ year: Number(month.slice(0, 4)), month: Number(month.slice(5)), page: 1 });
    expect(text(d.render())).toContain(`Applied: ${first} to ${last}`);
    await d.select('Staff Activity'); expect(h.get.mock.calls.filter(([url]) => url === '/reports/staff-performance').at(-1)![1].params)
      .toEqual({ dateFrom: first, dateTo: last });
    expect(text(d.render())).not.toContain('Could not load this report');
  });
  it('does not refetch for Apply Period when the applied period has not changed', async () => {
    const d = driver(); await d.settle(); const count = h.get.mock.calls.length;
    expect(d.button('Apply Period').props.disabled).toBe(true); await d.applyPeriod(); expect(h.get).toHaveBeenCalledTimes(count);
  });
  it('clears monthly filters and page on a new period, invalidating hidden report caches', async () => {
    const d = driver(); await d.settle(); d.change('Applicant name or code', 'APP'); await d.apply();
    d.button('Next').props.onClick(); await d.settle(); await d.select('Staff Activity'); await d.select('Monthly Deployment');
    const staffCount = h.get.mock.calls.filter(([url]) => url === '/reports/staff-performance').length;
    d.change('Reporting month', '2026-10'); await d.applyPeriod();
    expect(lastParams()).toEqual({ year: 2026, month: 10, page: 1, pageSize: 25 });
    expect(d.button('Filters').props['aria-expanded']).toBe(false); d.expandFilters();
    expect(d.input('Applicant name or code').props.value).toBe(''); expect(text(d.render())).toContain('Applied filters: None');
    expect(h.get.mock.calls.filter(([url]) => url === '/reports/staff-performance')).toHaveLength(staffCount);
    await d.select('Staff Activity'); expect(h.get.mock.calls.filter(([url]) => url === '/reports/staff-performance')).toHaveLength(staffCount + 1);
    expect(text(d.render())).toContain('2026-10-01 to 2026-10-31 UTC');
  });
  it('updates the active tab for a new period without fetching hidden report details', async () => {
    const d = driver(); await d.settle(); await d.select('Staff Activity'); const count = monthlyCalls().length;
    d.change('Reporting month', '2026-10'); await d.applyPeriod(); expect(monthlyCalls()).toHaveLength(count);
    expect(d.all().filter((n) => n.props?.role === 'tabpanel')).toHaveLength(1);
    expect(d.button('Staff Activity').props['aria-selected']).toBe(true);
    await d.select('Monthly Deployment'); expect(lastParams()).toMatchObject({ year: 2026, month: 10, page: 1 });
  });
  it('cancels and ignores a stale monthly request after the shared period changes', async () => {
    const pending = deferred(); const fallback = h.get.getMockImplementation()!; let first = true;
    h.get.mockImplementation((url, config) => {
      if (url === '/reports/monthly-deployments' && first) { first = false; return pending.promise; }
      return fallback(url, config);
    });
    const d = driver(); await d.settle(); d.change('Reporting month', '2026-10'); await d.applyPeriod();
    expect(monthlyCalls()[0][1].signal.aborted).toBe(true);
    const stale = monthly(); stale.rows[0].applicant_name = 'Old period applicant'; pending.resolve({ data: stale }); await flush();
    expect(text(d.render())).not.toContain('Old period applicant'); expect(text(d.render())).toContain('2026-10 UTC');
  });
  it('cancels a PDF for the old period and allows an export for the newly applied period', async () => {
    const d = driver(); await d.settle(); const pending = deferred(); const fallback = h.get.getMockImplementation()!;
    h.get.mockImplementation((url, config) => url === '/reports/monthly-deployments' && !config.params.page && config.params.month === 11 ? pending.promise : fallback(url, config));
    d.button('Export PDF').props.onClick(); d.change('Reporting month', '2026-10'); await d.applyPeriod();
    pending.resolve({ data: monthly({}) }); await flush(); expect(h.save).not.toHaveBeenCalled();
    d.button('Export PDF').props.onClick(); await flush(); expect(lastParams()).toEqual({ year: 2026, month: 10 });
    expect(h.save).toHaveBeenCalledWith('flowsensus-monthly-deployments-2026-10.pdf');
  });
  it.each(['staff_performance', 'workflow_efficiency', 'financial_summary'])('ignores an old %s read after the period changes', async (name) => {
    const endpoint = name === 'staff_performance' ? '/reports/staff-performance' : name === 'workflow_efficiency' ? '/reports/workflow-efficiency' : '/financial/records';
    const pending = deferred(); const fallback = h.get.getMockImplementation()!; let first = true;
    h.get.mockImplementation((url, config) => { if (url === endpoint && first) { first = false; return pending.promise; } return fallback(url, config); });
    const d = driver(); await d.settle(); await d.select(reportLabels[name]);
    d.change('Narrow from', '2026-11-02'); d.change('Narrow to', '2026-11-06'); await d.applyPeriod();
    const call = h.get.mock.calls.find(([url]) => url === endpoint); expect(call![1].signal.aborted).toBe(true);
    pending.reject(new Error('Old request failed')); await flush();
    expect(text(d.render())).not.toContain('Could not load this report'); expect(text(d.render())).toContain('2026-11-02 to 2026-11-06 UTC');
  });
  it('isolates report errors and preserves them without refetching on tab switching', async () => {
    const fallback = h.get.getMockImplementation()!;
    h.get.mockImplementation((url, config) => url === '/reports/staff-performance' ? Promise.reject({ response: { status: 403 } }) : fallback(url, config));
    const d = driver(); await d.settle(); await d.select('Staff Activity'); expect(text(d.render())).toContain('Access denied');
    await d.select('Monthly Deployment'); expect(text(d.render())).not.toContain('Access denied'); expect(text(d.render())).toContain('27 matching');
    await d.select('Staff Activity'); expect(text(d.render())).toContain('Access denied');
    expect(h.get.mock.calls.filter(([url]) => url === '/reports/staff-performance')).toHaveLength(1);
  });
});

describe('Operational Reports: monthly table and contract', () => {
  it('retains all four report types and honest Staff Activity wording', async () => {
    const d = driver(); await d.settle();
    const overview = d.all().find((n) => n.props?.role === 'tablist');
    expect(nodes(overview).filter((n) => n.type === 'button')).toHaveLength(4);
    for (const title of Object.values(reportLabels)) expect(d.button(title)).toBeDefined();
    expect(text(d.render())).not.toContain('Staff Performance Analysis');
    expect(text(d.render())).not.toContain('Confirmed');
    await d.select('Staff Activity'); expect(text(d.render())).toContain('no performance scores');
  });
  it('loads page 1 with 25 rows, summary total 27 and server order intact', async () => {
    const d = monthlyDriver(); await d.settle();
    expect(lastParams()).toEqual({ year: 2026, month: 11, page: 1, pageSize: 25 });
    expect(text(d.all().find((n) => n.props?.['aria-label'] === 'Recorded deployment count'))).toBe('27');
    expect(text(d.render())).toContain('27 matching deployed applications · Page 1 of 2 · 25 per page');
    const rows = d.all().filter((n) => n.type === 'tbody').flatMap((n) => nodes(n).filter((child) => child.type === 'tr'));
    expect(rows).toHaveLength(25); expect(text(rows[0])).toContain('Applicant 100'); expect(text(rows[24])).toContain('Applicant 76');
    expect(d.button('Previous').props.disabled).toBe(true); expect(d.button('Next').props.disabled).toBe(false);
  });
  it('renders every required column and a horizontally scrollable table', async () => {
    const d = monthlyDriver(); await d.settle();
    expect(d.all().filter((n) => n.type === 'th').map(text)).toEqual([
      'Applicant', 'Applicant Code', 'Employer', 'Destination Country', 'Position', 'Recorded Deployment Date (UTC)', 'Status',
    ]);
    expect(d.all().some((n) => n.props?.className?.includes('overflow-x-auto'))).toBe(true);
    expect(text(d.render())).toContain('05 Nov 2026, 04:00');
    expect(d.all().filter((n) => n.type === 'td').some((n) => text(n) === 'Deployed')).toBe(true);
  });
  it('shows honest placeholders for nullable applicant and placement context', async () => {
    const data = monthly({ page: 1, pageSize: 25 }, 1);
    data.rows[0] = deployment(100, { applicant_name: null, applicant_code: null, employer_id: null,
      employer_name: null, country_id: null, country_name: null, position: null, job_order_id: null, job_order_code: null, current_stage_id: null });
    h.get.mockResolvedValue({ data }); const d = monthlyDriver(); await d.settle();
    expect(d.all().filter((n) => n.type === 'td' && text(n) === 'Not available')).toHaveLength(5);
    expect(text(d.render())).not.toContain('International');
  });
  it('shows loading without a fabricated count or export action', () => {
    const d = monthlyDriver(); expect(text(d.render())).toContain('Loading recorded deployments');
    expect(text(d.all().find((n) => n.props?.['aria-label'] === 'Recorded deployment count'))).toBe('—');
    expect(d.button('Export PDF').props.disabled).toBe(true);
  });
  it('supports Next and Previous without loading a full report', async () => {
    const d = monthlyDriver(); await d.settle(); d.button('Next').props.onClick();
    expect(text(d.render())).not.toContain('Applicant 100'); await d.settle();
    expect(lastParams()).toMatchObject({ page: 2, pageSize: 25 });
    expect(text(d.render())).toContain('Page 2 of 2'); expect(d.button('Next').props.disabled).toBe(true);
    expect(d.all().filter((n) => n.type === 'td' && text(n).startsWith('Applicant '))).toHaveLength(2);
    d.button('Previous').props.onClick(); await d.settle(); expect(lastParams().page).toBe(1);
    expect(monthlyCalls().every(([, config]) => config.params.pageSize === 25)).toBe(true);
  });
  it('applies trimmed literal applicant substring search, not one request per keystroke', async () => {
    const d = monthlyDriver(); await d.settle(); const count = monthlyCalls().length;
    d.change('Applicant name or code', ' Ada_% '); await d.settle();
    expect(monthlyCalls()).toHaveLength(count); expect(text(d.render())).toContain('Unapplied changes');
    await d.apply(); expect(lastParams().search).toBe('Ada_%'); expect(text(d.render())).toContain('Applicant contains: Ada_%');
  });
  it('labels and forwards the exact full position string with no wildcard rewriting', async () => {
    const d = monthlyDriver(); await d.settle(); d.change('Position (exact match)', ' Registered Nurse '); await d.apply();
    expect(lastParams().position).toBe('Registered Nurse'); expect(text(d.render())).toContain('Position (exact): Registered Nurse');
    expect(text(d.render())).toContain('position matches the full position name');
  });
  it('uses existing named country/employer options, redacting foreign employers', async () => {
    const d = monthlyDriver(); await d.settle();
    d.openFilter('Destination country'); expect(text(d.render())).toContain('Japan');
    d.openFilter('Employer'); expect(text(d.render())).toContain('Verified Employer'); expect(text(d.render())).not.toContain('Foreign Employer');
    d.chooseFilter('Destination country', 'Japan'); d.chooseFilter('Employer', 'Verified Employer'); await d.apply();
    expect(lastParams()).toMatchObject({ countryId: 2, employerId: 4 });
    expect(text(d.render())).toContain('Country: Japan'); expect(text(d.render())).toContain('Employer: Verified Employer');
  });
  it('keeps other filters usable when optional lookup reads fail', async () => {
    const fallback = h.get.getMockImplementation()!;
    h.get.mockImplementation((url, config) => url === '/employers' || url === '/lookups/countries' ? Promise.reject(new Error('offline')) : fallback(url, config));
    const d = monthlyDriver(); await d.settle(); expect(text(d.render())).toContain('Country filter options could not be loaded');
    expect(d.input('Employer').props.disabled).toBe(true); expect(d.input('Destination country').props.disabled).toBe(true);
    d.change('Applicant name or code', 'Ada'); await d.apply(); expect(lastParams().search).toBe('Ada');
  });
  it('keeps tenant employer options usable during loading and after a failed filtered read', async () => {
    const d = monthlyDriver(); await d.settle(); const pending = deferred(); h.get.mockReturnValue(pending.promise);
    d.chooseFilter('Employer', 'Verified Employer'); await d.apply();
    expect(text(d.render())).toContain('Loading recorded deployments');
    expect(d.input('Employer').props.disabled).toBe(false); expect(d.input('Employer').props.value).toBe('Verified Employer');
    expect(text(d.render())).not.toContain('Applicant 100');
    pending.reject(new Error('offline')); await flush();
    expect(text(d.render())).toContain('Could not load the deployment report');
    d.change('Employer', ''); expect(d.input('Employer').props.value).toBe('');
  });
  it.each(['Narrow from', 'Narrow to'])('supports one optional UTC date bound: %s', async (label) => {
    const d = monthlyDriver(); await d.settle(); d.change(label, label === 'Narrow from' ? '2026-11-02' : '2026-11-06'); await d.applyPeriod();
    expect(lastParams()).toHaveProperty(label === 'Narrow from' ? 'dateFrom' : 'dateTo');
    expect(lastParams()).not.toHaveProperty(label === 'Narrow from' ? 'dateTo' : 'dateFrom');
    expect(text(d.render())).not.toContain('Could not load');
  });
  it('uses leap-year month bounds and sends a newly selected year/month', async () => {
    const d = monthlyDriver(); await d.settle(); d.change('Reporting month', '2024-02');
    expect(d.input('Narrow to').props.max).toBe('2024-02-29');
    d.change('Narrow to', '2024-02-29'); await d.applyPeriod(); expect(lastParams()).toMatchObject({ year: 2024, month: 2, dateTo: '2024-02-29', page: 1 });
    expect(text(d.render())).not.toContain('Could not load');
  });
  it('sends inclusive date narrowing verbatim in UTC inside the selected month', async () => {
    const d = monthlyDriver(); await d.settle();
    expect(d.input('Narrow from').props.min).toBe('2026-11-01'); expect(d.input('Narrow to').props.max).toBe('2026-11-30');
    d.change('Narrow from', '2026-11-02'); d.change('Narrow to', '2026-11-06'); await d.applyPeriod();
    expect(lastParams()).toMatchObject({ year: 2026, month: 11, dateFrom: '2026-11-02', dateTo: '2026-11-06' });
    expect(text(d.render())).toContain('inclusive 2026-11-02 to 2026-11-06');
    expect(text(d.render())).not.toContain('Could not load');
  });
  it.each(['2026-10-31', '2026-12-01', '2026-11-31'])('rejects out-of-month or invalid date %s without requesting it', async (value) => {
    const d = monthlyDriver(); await d.settle(); const count = monthlyCalls().length;
    d.change('Narrow from', value); expect(d.button('Apply Period').props.disabled).toBe(true); await d.applyPeriod();
    expect(monthlyCalls()).toHaveLength(count); expect(text(d.render())).toContain('must stay within');
  });
  it('rejects reversed dates and invalid months, and clears narrowing when month changes', async () => {
    const d = monthlyDriver(); await d.settle(); d.change('Narrow from', '2026-11-06'); d.change('Narrow to', '2026-11-02');
    expect(text(d.render())).toContain('From date must be on or before');
    d.change('Reporting month', '2026-12'); expect(d.input('Narrow from').props.value).toBe(''); expect(d.input('Narrow to').props.value).toBe('');
    d.change('Reporting month', ''); expect(d.button('Apply Period').props.disabled).toBe(true);
  });
  it.each(['Applicant name or code', 'Position (exact match)', 'Destination country', 'Employer', 'Narrow from', 'Narrow to', 'Reporting month'])
  ('resets page to 1 when applying changed %s', async (field) => {
    const d = monthlyDriver(); await d.settle(); d.button('Next').props.onClick(); await d.settle();
    const values: Record<string, string> = { 'Applicant name or code': 'Ada', 'Position (exact match)': 'Nurse',
      'Destination country': '2', Employer: '4', 'Narrow from': '2026-11-02', 'Narrow to': '2026-11-06', 'Reporting month': '2026-10' };
    if (field === 'Destination country') d.chooseFilter(field, 'Japan');
    else if (field === 'Employer') d.chooseFilter(field, 'Verified Employer');
    else d.change(field, values[field]);
    if (['Narrow from', 'Narrow to', 'Reporting month'].includes(field)) await d.applyPeriod(); else await d.apply();
    expect(lastParams().page).toBe(1);
  });
  it('shows zero matches as an empty report with disabled navigation', async () => {
    const fallback = h.get.getMockImplementation()!;
    h.get.mockImplementation((url, config) => url === '/reports/monthly-deployments' ? Promise.resolve({ data: monthly(config.params, 0) }) : fallback(url, config));
    const d = monthlyDriver(); await d.settle(); expect(text(d.render())).toContain('No recorded deployments match your filters');
    expect(text(d.render())).toContain('0 matching deployed applications · Page 0 of 0');
    expect(d.button('Previous').props.disabled).toBe(true); expect(d.button('Next').props.disabled).toBe(true);
  });
  it.each([new Error('offline'), { response: { status: 503 } }, { response: { status: 403 } }])('handles failed reads truthfully: %j', async (error) => {
    h.get.mockRejectedValue(error); const d = monthlyDriver(); await d.settle();
    expect(text(d.render())).toContain((error as any).response?.status === 403 ? 'Access denied' : 'Could not load the deployment report');
    expect(d.button('Export PDF').props.disabled).toBe(true); expect(h.save).not.toHaveBeenCalled();
    d.button('Refresh report').props.onClick(); await d.settle(); expect(monthlyCalls()).toHaveLength(2);
  });
  it.each([
    ['malformed envelope', (r: any) => { r.rows = null; }],
    ['summary/page mismatch', (r: any) => { r.summary.total_deployments = 25; }],
    ['missing pagination', (r: any) => { r.pagination = null; }],
    ['wrong page', (r: any) => { r.pagination.page = 2; }],
    ['wrong month', (r: any) => { r.summary.month = 10; }],
    ['wrong period', (r: any) => { r.metadata.date_from = '2026-10-01T00:00:00Z'; }],
    ['wrong filter echo', (r: any) => { r.filters.search = 'unexpected'; }],
    ['cross-agency row', (r: any) => { r.rows[0].agency_id = 99; }],
    ['platform scope', (r: any) => { r.metadata.scope = 'all_agencies'; r.metadata.agency_id = null; }],
    ['scheduled status', (r: any) => { r.rows[0].status_code = 'Ready for Deployment'; }],
    ['future deployment', (r: any) => { r.rows[0].actual_deployment_at = '2026-11-08T00:00:00Z'; }],
    ['duplicate application', (r: any) => { r.rows[1] = r.rows[0]; }],
    ['missing cutoff', (r: any) => { delete r.metadata.deployment_as_of; }],
  ])('rejects invalid response: %s', async (_label, mutate) => {
    const r = monthly(); mutate(r); h.get.mockResolvedValue({ data: r }); const d = monthlyDriver(); await d.settle();
    expect(text(d.render())).toContain('Could not load the deployment report or validate its response');
    expect(d.all().some((n) => n.type === 'table')).toBe(false); expect(h.save).not.toHaveBeenCalled();
  });
  it('ignores an older response after filters change and aborts on unmount', async () => {
    const old = deferred(); const fallback = h.get.getMockImplementation()!; let first = true;
    h.get.mockImplementation((url, config) => {
      if (url === '/reports/monthly-deployments' && first) { first = false; return old.promise; }
      return fallback(url, config);
    });
    const d = monthlyDriver(); await d.settle(); d.change('Applicant name or code', 'Current'); await d.apply();
    expect(monthlyCalls()[0][1].signal.aborted).toBe(true);
    const stale = monthly(); stale.rows[0].applicant_name = 'Stale Applicant'; old.resolve({ data: stale }); await flush();
    expect(text(d.render())).toContain('Applicant contains: Current'); expect(text(d.render())).not.toContain('Stale Applicant');
    d.unmount(); expect(monthlyCalls().at(-1)![1].signal.aborted).toBe(true);
  });
});

describe('Monthly PDF: complete applied dataset', () => {
  it('omits pagination, forwards all applied filters/dates, and exports every returned matching row', async () => {
    const d = monthlyDriver(); await d.settle();
    d.change('Narrow from', '2026-11-02'); d.change('Narrow to', '2026-11-06'); await d.applyPeriod();
    d.change('Applicant name or code', 'APP'); d.change('Position (exact match)', 'Nurse');
    d.chooseFilter('Destination country', 'Japan'); d.chooseFilter('Employer', 'Verified Employer'); await d.apply();
    d.button('Next').props.onClick(); await d.settle();
    const appliedParams = lastParams(); d.change('Applicant name or code', 'Not applied');
    d.button('Export PDF').props.onClick(); await flush();
    const { page: _page, pageSize: _size, ...expected } = appliedParams;
    expect(lastParams()).toEqual(expected); expect(lastParams()).not.toHaveProperty('page'); expect(lastParams()).not.toHaveProperty('pageSize');
    const table = h.table.mock.calls[0][1]; expect(table.body).toHaveLength(27);
    expect(table.body[0][0]).toBe('Applicant 100'); expect(table.body[26][0]).toBe('Applicant 74');
    expect(h.save).toHaveBeenCalledOnce(); expect(h.save).toHaveBeenCalledWith('flowsensus-monthly-deployments-2026-11.pdf');
    const labels = h.pdfText.mock.calls.map(([value]) => value).join(' ');
    for (const phrase of ['Monthly Deployment Report', 'Total Recorded Deployments: 27', 'Applicant contains: APP',
      'Position (exact): Nurse', 'Country: Japan', 'Employer: Verified Employer', 'inclusive 2026-11-02 to 2026-11-06', 'UTC']) expect(labels).toContain(phrase);
    expect(labels).not.toContain('Not applied'); expect(labels).not.toContain('Confirmed');
    expect(text(d.render())).toContain('PDF generated with 27');
  });
  it('blocks duplicate export clicks and shows export loading', async () => {
    const d = monthlyDriver(); await d.settle(); const pending = deferred(); h.get.mockReturnValue(pending.promise);
    const click = d.button('Export PDF').props.onClick; click(); click();
    expect(monthlyCalls()).toHaveLength(2); expect(d.button('Exporting PDF…').props.disabled).toBe(true);
    expect(text(d.render())).toContain('Fetching all matching deployments for PDF');
    pending.resolve({ data: monthly({}) }); await flush(); expect(h.save).toHaveBeenCalledOnce();
  });
  it('does not generate an empty PDF', async () => {
    const d = monthlyDriver(); await d.settle(); h.get.mockResolvedValue({ data: monthly({}, 0) });
    d.button('Export PDF').props.onClick(); await flush(); expect(text(d.render())).toContain('No PDF was generated');
    expect(h.table).not.toHaveBeenCalled(); expect(h.save).not.toHaveBeenCalled();
  });
  it.each(['API', '403', 'incomplete', 'wrong filters', 'PDF renderer', 'download'])('reports %s failure without claiming PDF success', async (kind) => {
    const d = monthlyDriver(); await d.settle();
    if (kind === 'API' || kind === '403') h.get.mockRejectedValue(kind === '403' ? { response: { status: 403 } } : new Error('offline'));
    else {
      const r = monthly({});
      if (kind === 'incomplete') r.rows.pop();
      if (kind === 'wrong filters') r.filters.position = 'Wrong';
      h.get.mockResolvedValue({ data: r });
      if (kind === 'PDF renderer') h.table.mockImplementation(() => { throw new Error('render failed'); });
      if (kind === 'download') h.save.mockImplementation(() => { throw new Error('download failed'); });
    }
    d.button('Export PDF').props.onClick(); await flush();
    expect(text(d.render())).toContain(kind === '403' ? 'Access denied' : 'Could not generate the PDF');
    expect(text(d.render())).not.toContain('PDF generated with'); expect(d.button('Export PDF').props.disabled).toBe(false);
    if (kind !== 'download') expect(h.save).not.toHaveBeenCalled();
  });
  it('rejects a paginated response on the complete export request', async () => {
    const d = monthlyDriver(); await d.settle(); h.get.mockResolvedValue({ data: monthly() });
    d.button('Export PDF').props.onClick(); await flush(); expect(text(d.render())).toContain('Could not generate the PDF');
    expect(h.save).not.toHaveBeenCalled();
  });
  it('cancels export on unmount and never downloads its late response', async () => {
    const d = monthlyDriver(); await d.settle(); const pending = deferred(); h.get.mockReturnValue(pending.promise);
    d.button('Export PDF').props.onClick(); d.unmount();
    expect(monthlyCalls().at(-1)![1].signal.aborted).toBe(true);
    pending.resolve({ data: monthly({}) }); await flush(); expect(h.save).not.toHaveBeenCalled();
  });
});

describe('PDF readability, trusted identity and complete breakdowns', () => {
  const pdfText = () => h.pdfText.mock.calls.map(([value]) => value).join(' ');
  const tableWith = (heading: string) => h.table.mock.calls.find(([, options]) => options.head[0].includes(heading))![1];
  const compact = (value: string) => value.replace(/\n/g, '');
  const mockedStaff = (report: any) => {
    const fallback = h.get.getMockImplementation()!;
    h.get.mockImplementation((url, config) => url === '/reports/staff-performance' ? Promise.resolve({ data: report }) : fallback(url, config));
  };
  it.each(Object.keys(reportLabels))('omits Scope and uses consistent truthful UTC generation formatting for %s', async (name) => {
    vi.setSystemTime(new Date('2026-11-10T11:26:00Z'));
    const d = reportDriver(name); await d.settle(); d.button('Export PDF').props.onClick(); await flush();
    const labels = h.pdfText.mock.calls.map(([value]) => value);
    expect(labels.filter((line) => line === 'Example Reporting Agency')).toHaveLength(1);
    expect(pdfText()).not.toContain('Scope:'); expect(pdfText()).not.toContain('(download time)');
    const generated = labels.filter((line) => line.startsWith('Generated:'));
    expect(generated).toEqual([name === 'financial_summary' ? 'Generated: 10 Nov 2026, 11:26 UTC' : 'Generated: 07 Nov 2026, 08:00 UTC']);
    expect(generated[0]).toMatch(/^Generated: \d{2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} UTC$/);
    expect(pdfText()).toContain('2026-11'); expect(h.save).toHaveBeenCalledOnce();
  });
  it('uses the left and right header columns with the matching authenticated agency name', async () => {
    const d = driver(); await d.settle(); d.button('Export PDF').props.onClick(); await flush();
    expect(pdfText()).not.toContain('Scope:');
    expect(pdfText()).not.toContain('FindStaff Test Agency');
    const brand = h.pdfText.mock.calls.find(([value]) => value === 'Example Reporting Agency')!;
    const period = h.pdfText.mock.calls.find(([value]) => value.startsWith('Reporting Period:'))!;
    const generated = h.pdfText.mock.calls.find(([value]) => value.startsWith('Generated:'))!;
    expect(brand[1]).toBe(14); expect(period[1]).toBeGreaterThan(150);
    expect(generated[1]).toBe(period[1]); expect(brand[2]).toBe(period[2]); expect(generated[2]).toBeGreaterThan(period[2]);
    expect(pdfText()).toContain('Total Recorded Deployments: 27');
    expect(h.table.mock.calls[0][1].body).toHaveLength(27);
  });
  it.each(Object.keys(reportLabels).flatMap((name) =>
    ['failure', 'missing name', 'blank name', 'invalid id', 'foreign agency', 'invalid name', 'control characters']
      .map((kind) => [name, kind])))('uses an accurate heading fallback for %s with %s', async (name, kind) => {
    const fallback = h.get.getMockImplementation()!;
    const agency: any = { agency_id: kind === 'foreign agency' ? 99 : kind === 'invalid id' ? '7' : 7,
      agency_name: kind === 'blank name' ? '  ' : 'Untrusted name' };
    if (kind === 'missing name') delete agency.agency_name;
    if (kind === 'invalid name') agency.agency_name = { name: 'Untrusted name' };
    if (kind === 'control characters') agency.agency_name = 'Untrusted name\nAnother heading';
    h.get.mockImplementation((url, config) => url === '/lookups/agency' ? kind === 'failure' ? Promise.reject(new Error('offline')) : Promise.resolve({ data: agency }) : fallback(url, config));
    const d = reportDriver(name); await d.settle(); d.button('Export PDF').props.onClick(); await flush();
    expect(h.pdfText.mock.calls[0][0]).toBe('Agency 7');
    expect(pdfText()).not.toContain('Scope:'); expect(pdfText()).not.toContain('Untrusted name');
    expect(h.save).toHaveBeenCalledOnce();
  });
  it.each(Object.keys(reportLabels))('uses distinct verified agency headings in %s while preserving its data', async (name) => {
    const first = reportDriver(name); await first.settle(); first.button('Export PDF').props.onClick(); await flush();
    const firstHeading = h.pdfText.mock.calls[0][0];
    expect(firstHeading).toBe('Example Reporting Agency');
    const originalTables = h.table.mock.calls.map(([, table]) => table);
    const originalLabels = h.pdfText.mock.calls.map(([value]) => value);
    first.unmount(); h.pdfText.mockClear(); h.table.mockClear(); h.save.mockClear();
    const fallback = h.get.getMockImplementation()!;
    h.get.mockImplementation(async (url, config) => {
      if (url === '/lookups/agency') return { data: { agency_id: 83, agency_name: 'Second Reporting Agency' } };
      const response = await fallback(url, config);
      const data = structuredClone(response.data);
      const reScope = (row: any) => ({ ...row, agency_id: 83,
        ...(row.applicant ? { applicant: { ...row.applicant, agency_id: 83 } } : {}) });
      if (data.metadata) { data.metadata.agency_id = 83; data.rows = data.rows.map(reScope); }
      return { data: url === '/financial/records' ? data.map(reScope) : data };
    });
    const second = reportDriver(name); await second.settle(); second.button('Export PDF').props.onClick(); await flush();
    expect(h.pdfText.mock.calls[0][0]).toBe('Second Reporting Agency');
    expect(h.pdfText.mock.calls[0][0]).not.toBe(firstHeading);
    expect(pdfText()).not.toContain('Scope:');
    expect(pdfText()).not.toContain('Example Reporting Agency'); expect(pdfText()).not.toContain('FLOWSENSUS');
    expect(h.table.mock.calls.map(([, table]) => table)).toEqual(originalTables);
    const metadataLines = (labels: string[]) => labels.filter((line) => line.startsWith('Reporting Period:') || line.startsWith('Generated:'));
    expect(metadataLines(h.pdfText.mock.calls.map(([value]) => value))).toEqual(metadataLines(originalLabels));
    expect(h.save).toHaveBeenCalledOnce();
  });
  it.each(['verified name', 'missing name', 'unavailable identity'])('uses authenticated financial scope safely with %s when records have no agency IDs', async (kind) => {
    const fallback = h.get.getMockImplementation()!;
    h.get.mockImplementation(async (url, config) => {
      if (url === '/lookups/agency') return { data: kind === 'unavailable identity' ? null :
        { agency_id: 7, ...(kind === 'verified name' ? { agency_name: 'Example Reporting Agency' } : {}) } };
      const response = await fallback(url, config);
      if (url === '/financial/records') return { data: response.data.map((row: any) => ({ ...row, agency_id: null, applicant: null })) };
      return response;
    });
    const d = reportDriver('financial_summary'); await d.settle(); d.button('Export PDF').props.onClick(); await flush();
    expect(h.pdfText.mock.calls[0][0]).toBe(kind === 'verified name' ? 'Example Reporting Agency' : kind === 'missing name' ? 'Agency 7' : 'Authenticated agency');
    expect(pdfText()).not.toContain('Agency null'); expect(pdfText()).toContain('Financial Records: 1');
    expect(pdfText()).not.toContain('(download time)'); expect(h.table.mock.calls[0][1].body).toHaveLength(1);
  });
  it('does not label an all-agencies report with the current tenant name', async () => {
    const report = staff({ dateFrom: '2026-11-01', dateTo: '2026-11-30' });
    Object.assign(report.metadata, { scope: 'all_agencies', agency_id: null }); mockedStaff(report);
    const d = reportDriver('staff_performance'); await d.settle(); d.button('Export PDF').props.onClick(); await flush();
    expect(h.pdfText.mock.calls[0][0]).toBe('All agencies'); expect(pdfText()).not.toContain('Scope:');
    expect(pdfText()).not.toContain('Example Reporting Agency'); expect(h.table.mock.calls[0][1].head[0][0]).toBe('Agency');
  });
  it('keeps report branding dynamic without hardcoded sample agencies', () => {
    const source = readFileSync(new URL('./OperationalReports.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/FindStaff|Agency 2/);
    expect(source).not.toContain("write('FLOWSENSUS'");
  });
  it('uses late trusted agency metadata without refetching the current report', async () => {
    const pending = deferred(); const fallback = h.get.getMockImplementation()!;
    h.get.mockImplementation((url, config) => url === '/lookups/agency' ? pending.promise : fallback(url, config));
    const d = driver(); await d.settle(); const count = monthlyCalls().length;
    pending.resolve({ data: { agency_id: 7, agency_name: 'Late Authorized Agency' } }); await flush(); await d.settle();
    expect(monthlyCalls()).toHaveLength(count); d.button('Export PDF').props.onClick(); await flush();
    expect(h.pdfText.mock.calls[0][0]).toBe('Late Authorized Agency');
  });
  it('renders known action labels and deduplicated roles without changing counts or source events', async () => {
    const report = staff({ dateFrom: '2026-11-01', dateTo: '2026-11-30' });
    report.summary.logged_operational_actions = 17;
    report.rows[0] = { ...report.rows[0], logged_operational_actions: 17,
      roles: ['Management', 'management', 'Admin, Admin', 'Finance & Accounting', 'Accounting'],
      actions: { MEDICAL_CLEARANCE_APPROVED: 2, ENDORSED_TO_PROFILING: 3, STAFF_ROLES_UPDATED: 5, APPLICANT_STATUS_UPDATED: 7 } };
    const original = structuredClone(report); mockedStaff(report);
    const d = reportDriver('staff_performance'); await d.settle(); d.button('Export PDF').props.onClick(); await flush();
    expect(pdfText()).toContain('Logged Operational Actions: 17');
    const summary = tableWith('Recorded Roles'); expect(summary.body[0][1]).toBe('Management, Admin, Accounting');
    expect(summary.body[0][2]).toBe('17');
    const actions = tableWith('Recorded action code');
    expect(actions.body.map((row: string[]) => row[1])).toEqual([
      'Medical clearance approved', 'Endorsed to profiling', 'Staff roles updated', 'Applicant status updated',
    ]);
    expect(actions.body.map((row: string[]) => Number(row[3]))).toEqual([2, 3, 5, 7]);
    expect(actions.body.map((row: string[]) => compact(row[2]))).toEqual(Object.keys(report.rows[0].actions));
    expect(report).toEqual(original); expect(h.save).toHaveBeenCalledOnce();
  });
  it('preserves unknown, malformed, prototype-like and long Unicode action identifiers safely', async () => {
    const report = staff({ dateFrom: '2026-11-01', dateTo: '2026-11-30' });
    const long = 'BAD::' + 'UNBROKEN_IDENTIFIER'.repeat(35) + '\u0000\u2014\u{1f9ea}';
    report.rows[0].actions = JSON.parse('{"__proto__":1,"UNRECOGNIZED_ACTION::??":4}');
    report.rows[0].actions[long] = 6; report.rows[0].actions[''] = 0;
    report.rows[0].logged_operational_actions = 11; report.summary.logged_operational_actions = 11;
    mockedStaff(report); const d = reportDriver('staff_performance'); await d.settle(); d.button('Export PDF').props.onClick(); await flush();
    const actions = tableWith('Recorded action code'); expect(actions.body).toHaveLength(4);
    expect(actions.body.map((row: string[]) => row[3])).toEqual(['1', '4', '6', '0']);
    expect(actions.body.map((row: string[]) => compact(row[2]))).toEqual([
      '__proto__', 'UNRECOGNIZED_ACTION::??', 'BAD::' + 'UNBROKEN_IDENTIFIER'.repeat(35) + '\\u0000\\u2014\\u{1f9ea}', '""',
    ]);
    expect(actions.body[2][2]).toContain('\n');
    for (const [, table] of h.table.mock.calls) {
      for (const row of table.body) row.forEach((cell: string, index: number) => {
        for (const line of cell.split('\n')) expect(line.length * 1.2).toBeLessThanOrEqual(table.columnStyles[index].cellWidth - 5 + 0.00001);
      });
    }
  });
  it('represents every staff actor, action and module, including historical platform-named actors', async () => {
    const report = staff({ dateFrom: '2026-11-01', dateTo: '2026-11-30' });
    report.rows.push({ ...report.rows[0], actor_user_id: 44, actor_name: 'Historical Super Admin', roles: ['Super Admin', 'Super Admin'],
      modules: { Legacy: 2, 'MODULE::NEW': 1 }, actions: { STAFF_ROLES_UPDATED: 2, 'Unmapped legacy action': 1 } });
    report.summary.staff_actor_count = 2; report.summary.logged_operational_actions = 6;
    mockedStaff(report); const d = reportDriver('staff_performance'); await d.settle(); d.button('Export PDF').props.onClick(); await flush();
    expect(tableWith('Recorded Roles').body).toHaveLength(2);
    expect(tableWith('Recorded Roles').body[1][1]).toBe('Super Admin');
    expect(tableWith('Recorded action code').body).toHaveLength(3);
    expect(tableWith('Recorded module').body).toHaveLength(3);
    expect(tableWith('Recorded action code').body.filter((row: string[]) => compact(row[0]).includes('Historical Super Admin'))).toHaveLength(2);
  });
  it('formats additional well-formed codes while keeping new codes and unknown role labels intact', async () => {
    const report = staff({ dateFrom: '2026-11-01', dateTo: '2026-11-30' });
    report.rows[0].roles = ['constructor', 'constructor', 'Recruitment, Recruitment'];
    report.rows[0].actions = { FUTURE_VALID_ACTION_CODE: 2, CV_UPDATED: 1 };
    mockedStaff(report); const d = reportDriver('staff_performance'); await d.settle();
    d.button('Export PDF').props.onClick(); await flush();
    expect(tableWith('Recorded Roles').body[0][1]).toBe('constructor, Recruitment');
    const actions = tableWith('Recorded action code');
    expect(actions.body.map((row: string[]) => row[1])).toEqual(['Future valid action code', 'CV updated']);
    expect(actions.body.map((row: string[]) => row[2])).toEqual(['FUTURE_VALID_ACTION_CODE', 'CV_UPDATED']);
    expect(actions.body.map((row: string[]) => row[3])).toEqual(['2', '1']);
  });
  it('configures full-width wrapped tables with repeated headings, splittable rows and numbered pages', async () => {
    const d = reportDriver('staff_performance'); await d.settle(); h.pages = 3;
    d.button('Export PDF').props.onClick(); await flush();
    expect(h.pdfOptions).toHaveBeenCalledWith({ orientation: 'landscape', format: 'a4' });
    expect(h.table).toHaveBeenCalledTimes(3);
    for (const [, table] of h.table.mock.calls) {
      expect(table.tableWidth).toBe(269); expect(table.styles.overflow).toBe('linebreak');
      expect(table.showHead).toBe('everyPage'); expect(table.pageBreak).toBe('auto'); expect(table.rowPageBreak).toBe('auto');
      expect(table.margin).toEqual({ top: 14, right: 14, bottom: 18, left: 14 });
      expect(Object.values(table.columnStyles).reduce((sum: number, value: any) => sum + value.cellWidth, 0)).toBeCloseTo(269);
    }
    for (let page = 1; page <= 3; page++) expect(pdfText()).toContain(`Page ${page} of 3`);
    expect(h.setPage.mock.calls.map(([page]) => page)).toEqual([1, 2, 3]);
  });
  it('uses only the supplied same-agency ordinary staff mapping for financial recorder names', async () => {
    const fallback = h.get.getMockImplementation()!;
    h.get.mockImplementation(async (url, config) => {
      const response = await fallback(url, config);
      return url === '/financial/records' ? { data: response.data.map((row: any) => ({ ...row, recorded_by: 21 })) } : response;
    });
    const d = driver({ staffDirectory: [{ user_id: 21, agency_id: 7, is_super_admin: false, full_name: 'Authorized Recorder' }] });
    await d.settle(); await d.select('Financial Summary'); d.button('Export PDF').props.onClick(); await flush();
    const table = tableWith('Recorded By'); const column = table.head[0].indexOf('Recorded By');
    expect(compact(table.body[0][column])).toBe('Authorized Recorder (User ID: 21)');
    expect(h.get.mock.calls.some(([url]) => url === '/users')).toBe(false);
  });
  it.each(['missing', 'foreign', 'platform', 'unclassified', 'ambiguous', 'malformed'])('retains recorder identifiers for %s staff mappings', async (kind) => {
    const fallback = h.get.getMockImplementation()!;
    h.get.mockImplementation(async (url, config) => {
      const response = await fallback(url, config);
      return url === '/financial/records' ? { data: response.data.map((row: any) => ({ ...row, recorded_by: 1 })) } : response;
    });
    const staff: any = { user_id: 1, agency_id: kind === 'foreign' ? 99 : 7,
      is_super_admin: kind === 'platform', full_name: 'Do Not Invent This Name' };
    if (kind === 'unclassified') delete staff.is_super_admin;
    const directory = kind === 'malformed' ? {} : kind === 'missing' ? [] : kind === 'ambiguous' ? [staff, { ...staff, full_name: 'Conflicting Name' }] : [staff];
    const d = driver({ staffDirectory: directory }); await d.settle(); await d.select('Financial Summary');
    d.button('Export PDF').props.onClick(); await flush();
    const table = tableWith('Recorded By'); expect(table.body[0][table.head[0].indexOf('Recorded By')]).toBe('User ID: 1');
    expect(table.body.flat().join(' ')).not.toContain('Do Not Invent This Name');
  });
  it('prefers an explicit recorder name from the report response while retaining its identifier', async () => {
    const fallback = h.get.getMockImplementation()!;
    h.get.mockImplementation(async (url, config) => {
      const response = await fallback(url, config);
      return url === '/financial/records' ? { data: response.data.map((row: any) => ({ ...row, recorded_by: 21, recorded_by_name: 'Name In Record' })) } : response;
    });
    const d = driver({ staffDirectory: [{ user_id: 21, agency_id: 7, is_super_admin: false, full_name: 'Current Directory Name' }] });
    await d.settle(); await d.select('Financial Summary'); d.button('Export PDF').props.onClick(); await flush();
    const table = tableWith('Recorded By'); expect(compact(table.body[0][table.head[0].indexOf('Recorded By')])).toBe('Name In Record (User ID: 21)');
  });
  it('never attributes financial User ID 1 to a platform actor merely because Staff Activity names that actor', async () => {
    const fallback = h.get.getMockImplementation()!;
    h.get.mockImplementation(async (url, config) => {
      const response = await fallback(url, config);
      if (url === '/financial/records') return { data: response.data.map((row: any) => ({ ...row, recorded_by: 1 })) };
      if (url === '/reports/staff-performance') response.data.rows[0] = { ...response.data.rows[0], actor_user_id: 1, actor_name: 'Dev Superadmin', roles: ['Super Admin'] };
      return response;
    });
    const d = driver({ staffDirectory: [{ user_id: 1, agency_id: 7, is_super_admin: true, full_name: 'Dev Superadmin' }] });
    await d.settle(); await d.select('Staff Activity'); d.button('Export PDF').props.onClick(); await flush();
    expect(tableWith('Recorded Roles').body[0][0]).toContain('Dev Superadmin');
    h.table.mockClear(); h.pdfText.mockClear(); h.save.mockClear();
    await d.select('Financial Summary'); d.button('Export PDF').props.onClick(); await flush();
    const table = tableWith('Recorded By'); expect(table.body[0][table.head[0].indexOf('Recorded By')]).toBe('User ID: 1');
    expect(table.body.flat().join(' ')).not.toContain('Dev Superadmin'); expect(pdfText()).toContain('Financial Records: 1');
    expect(pdfText()).toContain('PHP: 12.35'); expect(h.get.mock.calls.some(([url]) => url === '/users')).toBe(false);
  });
});

describe('Legacy reports and frontend authorization', () => {
  it.each([
    ['staff_performance', '/reports/staff-performance', 'staff-activity', 'Verified Staff'],
    ['financial_summary', '/financial/records', 'financial-summary', 'Financial Applicant'],
    ['workflow_efficiency', '/reports/workflow-efficiency', 'workflow-efficiency', 'Medical'],
  ])('preserves %s endpoint and PDF rows with the shared dates', async (name, endpoint, filename, expectedRow) => {
    const d = reportDriver(name); await d.settle();
    d.change('Narrow from', '2026-11-02'); d.change('Narrow to', '2026-11-06'); await d.applyPeriod();
    d.button('Export PDF').props.onClick(); await flush();
    const calls = h.get.mock.calls.filter(([url]) => url === endpoint); expect(calls.length).toBeGreaterThan(1);
    if (name === 'financial_summary') expect(calls.at(-1)![1]).not.toHaveProperty('params');
    else expect(calls.at(-1)![1].params).toEqual({ dateFrom: '2026-11-02', dateTo: '2026-11-06' });
    expect(h.table.mock.calls[0][1].body.flat().join(' ')).toContain(expectedRow);
    expect(h.save).toHaveBeenCalledWith(`flowsensus-${filename}-2026-11-02-to-2026-11-06.pdf`);
    if (name === 'staff_performance') {
      expect(h.pdfText.mock.calls.map(([value]) => value).join(' ')).toContain('Staff Activity');
      expect(h.pdfText.mock.calls.map(([value]) => value).join(' ')).not.toContain('Staff Performance');
    }
  });
  it('preserves the existing nonmonthly empty and validation states', async () => {
    const r = staff({ dateFrom: '2026-11-01', dateTo: '2026-11-30' });
    r.summary = { staff_actor_count: 0, logged_operational_actions: 0, unique_applicants_touched: 0 }; r.rows = [];
    h.get.mockResolvedValue({ data: r }); const d = reportDriver('staff_performance'); await d.settle();
    expect(text(d.render())).toContain('No staff operational activity'); d.button('Export PDF').props.onClick(); await flush();
    expect(h.save).not.toHaveBeenCalled(); d.change('Narrow from', '2026-11-10'); d.change('Narrow to', '2026-11-09'); await d.settle();
    expect(text(d.render())).toContain('From date must be on or before');
  });
  it('preserves Management-only access for single and multiple roles, denying platform and department-like roles', () => {
    expect(hasAccessToView('reports', ['Management'], false)).toBe(true);
    expect(hasAccessToView('reports', ['Recruitment', 'Management'], false)).toBe(true);
    for (const role of ['Recruitment', 'Accounting', 'Admin', 'Executive Management']) {
      expect(hasAccessToView('reports', [role as any], false, { reports: [role as any] })).toBe(false);
    }
    expect(hasAccessToView('reports', ['Management'], true)).toBe(false);
    const sidebar = readFileSync(new URL('../Sidebar.tsx', import.meta.url), 'utf8');
    const shell = readFileSync(new URL('../AppShell.tsx', import.meta.url), 'utf8');
    expect(sidebar).toMatch(/id: 'reports'.*roles: \['Management'\]/);
    expect(shell).toContain('hasAccessToView(currentView, userRolesList, isSuperAdmin, workflowPermissions)');
    expect(shell).toMatch(/case 'reports':\s*return <OperationalReports staffDirectory=\{globalStaff\} \/>/);
  });
});
