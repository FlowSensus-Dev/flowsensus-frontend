import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Follow the existing hook/event harness; all requests are mocked, with no Auth or Supabase access.
const h = vi.hoisted(() => ({
  slots: [] as any[], cursor: 0, dirty: false, writes: 0,
  effects: [] as (() => void)[], layouts: [] as (() => void)[], get: vi.fn(),
}));
vi.mock('../../../lib/api', () => ({ api: { get: h.get } }));
vi.mock('react', async (original) => {
  const effect = (queue: (() => void)[], callback: any, deps: any[]) => {
    const index = h.cursor++; const previous = h.slots[index];
    if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
      const slot = { deps, cleanup: undefined as any }; h.slots[index] = slot;
      queue.push(() => { previous?.cleanup?.(); slot.cleanup = callback(); });
    }
  };
  return { ...(await original() as any),
    useState: (initial: any) => {
      const index = h.cursor++;
      if (!(index in h.slots)) h.slots[index] = typeof initial === 'function' ? initial() : initial;
      return [h.slots[index], (value: any) => {
        const next = typeof value === 'function' ? value(h.slots[index]) : value;
        if (!Object.is(next, h.slots[index])) { h.slots[index] = next; h.dirty = true; h.writes++; }
      }];
    },
    useRef: (initial: any) => { const index = h.cursor++; return h.slots[index] ?? (h.slots[index] = { current: initial }); },
    useMemo: (compute: any) => compute(),
    useEffect: (callback: any, deps: any[]) => effect(h.effects, callback, deps),
    useLayoutEffect: (callback: any, deps: any[]) => effect(h.layouts, callback, deps),
  };
});
import PredictiveForecast, { StageWhatIf } from './PredictiveForecast';
import ForecastingConfiguration from './ForecastingConfiguration';

const names = ['Registration & Screening', 'Medical Clearance', 'CV & Endorsement', 'Under Employer Review', 'Final Deployment'];
const labels = ['Registration & Screening', 'Medical Clearance', 'CV Encoding & Management Approval', 'Employer Endorsement', 'Final Deployment Processing'];
const pipeline = (extra: any = {}) => ({
  agency_id: 2, alpha_used: 0.3, total_pipeline_duration_days: 15, dynamic_exceptions: [],
  stages: names.map((stage_name, index) => ({ stage_name, workflow_stage_id: 101 + index, observation_count: 10,
    optimistic: 1, most_likely: 2, pessimistic: 3, pert_baseline: 2, current_forecast: 0.07, is_fallback: false })), ...extra,
});
const applicants = [
  { id: '1', applicationId: 11, name: 'First Candidate', role: 'Welder', jobOrder: 'JO-1' },
  { id: '2', applicationId: 21, name: 'Second Candidate', role: 'Carpenter', jobOrder: 'JO-2' },
  { id: '2', applicationId: 22, name: 'Second Candidate', role: 'Electrician', jobOrder: 'JO-3' },
];
function nodes(tree: any): any[] { return !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)]; }
const text = (tree: any): string => tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : [tree.props?.children].flat(Infinity).map(text).join(' ').replace(/\s+/g, ' ');
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function deferred() {
  let resolve!: (value: any) => void; let reject!: (error: any) => void;
  const promise = new Promise<any>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe('Predictive Timeline loading, refresh and display (mocked API)', () => {
  let props: any;
  let tree: any;
  let livePipeline: any;
  let liveApplicants: any[];
  const render = () => {
    for (let pass = 0; pass < 20; pass++) {
      h.dirty = false; h.cursor = 0; tree = PredictiveForecast(props);
      h.layouts.splice(0).forEach((effect) => effect());
      h.effects.splice(0).forEach((effect) => effect());
      if (!h.dirty) return tree;
    }
    throw new Error('Forecast did not settle');
  };
  const settle = async () => { for (let i = 0; i < 4; i++) { render(); await flush(); } return render(); };
  const unmount = () => { h.slots.forEach((slot) => slot?.cleanup?.()); };
  const refresh = () => nodes(render()).find((n) => n.type === 'button' && text(n).trim() === 'Refresh Live Forecast');
  const candidate = () => nodes(render()).find((n) => n.type === 'select' && ['1', '2'].includes(n.props.value));
  const application = () => nodes(render()).find((n) => n.type === 'select' && nodes(n).some((child) => child.type === 'option' && child.props.value === ''));
  const stageButton = (index: number) => nodes(render()).find((n) => n.props?.['aria-label']?.endsWith(`Forecast Details for ${labels[index]}`));
  const requests = (url: string) => h.get.mock.calls.filter(([path]) => path === url);
  beforeEach(() => {
    vi.resetAllMocks(); h.slots = []; h.effects = []; h.layouts = []; h.dirty = false; h.writes = 0;
    props = { applicantsLoaded: true, selectedApplicantId: '1', canEditAgencySettings: true };
    livePipeline = pipeline(); liveApplicants = applicants;
    h.get.mockImplementation(async (url) => {
      if (url === '/forecasting/pipeline') return { data: livePipeline };
      if (url === '/forecasting/applications') return { data: liveApplicants };
      if (/^\/forecasting\/application\/\d+$/.test(url)) return { data: {
        application_id: Number(url.split('/').pop()), current_stage: names[2], current_stage_index: 2, record: null, limitations: [],
      } };
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => { unmount(); vi.restoreAllMocks(); });

  it('shows loading until the lightweight list resolves even when parent applicants are loaded', async () => {
    const pending = deferred();
    h.get.mockImplementation((url) => url === '/forecasting/applications' ? pending.promise : Promise.resolve({ data: livePipeline }));
    render(); await flush(); render();
    expect(nodes(tree).some((n) => n.props?.['aria-label'] === 'Loading forecasting applications')).toBe(true);
    expect(text(tree)).not.toContain('No applicants are available');
    pending.resolve({ data: [] }); await settle();
    expect(text(tree)).toContain('No applicants are available to forecast.');
    expect(refresh().props.disabled).toBe(false);
    expect(nodes(tree).find((n) => n.type === ForecastingConfiguration).props.canEdit).toBe(true);
  });

  it('refreshes the pipeline on every visit despite an old login cache and ignores later cache prop changes', async () => {
    props.globalPipelineForecast = pipeline({ total_pipeline_duration_days: 99, alpha_used: 0.7 });
    await settle();
    expect(requests('/forecasting/pipeline')).toHaveLength(1);
    expect(text(tree)).toContain('15.0 days'); expect(text(tree)).not.toContain('99.0 days');
    props.globalPipelineForecast = pipeline({ total_pipeline_duration_days: 88 }); await settle();
    expect(requests('/forecasting/pipeline')).toHaveLength(1);
    expect(text(tree)).not.toContain('88.0 days');
    unmount(); h.slots = []; h.effects = []; h.layouts = [];
    livePipeline = pipeline({ total_pipeline_duration_days: 27, alpha_used: 0.4,
      stages: pipeline().stages.map((stage) => ({ ...stage, pert_baseline: 8, current_forecast: 0.77 })) });
    await settle();
    expect(requests('/forecasting/pipeline')).toHaveLength(2);
    expect(text(tree)).toContain('27.0 days'); expect(text(tree)).toContain('Agency SES Alpha: 0.4');
    expect(text(tree)).toContain('8.00 d'); expect(text(tree)).toContain('0.77 d');
    expect(h.get.mock.calls.some(([url]) => url.startsWith('/forecasting/penalties'))).toBe(false);
  });

  it('maps exactly five visible and accessible labels while passing raw stages to What-If and retaining raw preview keys', async () => {
    await settle();
    expect(nodes(tree).filter((n) => n.props?.['aria-label']?.startsWith('Expand Forecast Details for'))).toHaveLength(5);
    labels.forEach((label, index) => { expect(stageButton(index)).toBeDefined(); expect(text(tree)).toContain(label); });
    expect(text(tree)).toContain(`Current Stage: ${labels[2]}`); expect(text(tree)).toContain(`Current Phase: ${labels[2]}`);
    expect(text(tree)).not.toContain('CV & Endorsement'); expect(text(tree)).not.toContain('Under Employer Review');
    stageButton(2).props.onClick(); render();
    let simulator = nodes(tree).find((n) => n.type === StageWhatIf);
    expect(simulator.props.stage.stage_name).toBe(names[2]); expect(simulator.props.exceptions).toBeUndefined();
    simulator.props.onSuccess({ liveBasis: simulator.props.liveBasis, data: { new_stage_forecast: 4, actual_penalty_days: 0 } }); render();
    simulator = nodes(tree).find((n) => n.type === StageWhatIf);
    expect(simulator.props.history).toHaveLength(1);
    expect(stageButton(2).props['aria-expanded']).toBe(true);
    expect(livePipeline.stages.map((stage: any) => stage.stage_name)).toEqual(names);
  });

  it('refreshes applications and the live forecast while preserving valid candidate and application selections', async () => {
    await settle(); candidate().props.onChange({ target: { value: '2' } }); await settle();
    expect(application().props.value).toBe('');
    application().props.onChange({ target: { value: '22' } }); await settle();
    liveApplicants = [...applicants, { id: '3', applicationId: 31, name: 'New Candidate' }];
    refresh().props.onClick(); await settle();
    expect(requests('/forecasting/applications')).toHaveLength(2); expect(requests('/forecasting/pipeline')).toHaveLength(2);
    expect(candidate().props.value).toBe('2'); expect(application().props.value).toBe(22);
    expect(text(tree)).toContain('New Candidate'); expect(requests('/forecasting/application/22')).toHaveLength(2);
    expect(h.get.mock.calls.some(([url]) => url.startsWith('/forecasting/penalties'))).toBe(false);
    liveApplicants = [applicants[0]]; refresh().props.onClick(); await settle();
    expect(candidate().props.value).toBe('1'); expect(text(tree)).toContain('Application # 11');
  });

  it('allows a truly empty list to refresh into available applicants', async () => {
    liveApplicants = []; await settle(); expect(text(tree)).toContain('No applicants are available');
    liveApplicants = applicants; refresh().props.onClick();
    expect(text(render())).not.toContain('No applicants are available');
    await settle(); expect(text(tree)).toContain('First Candidate');
  });

  it('ignores older pipeline and application-list responses after a newer refresh', async () => {
    const oldPipeline = deferred(); const oldApplicants = deferred();
    const implementation = h.get.getMockImplementation()!;
    h.get.mockImplementationOnce(() => oldPipeline.promise).mockImplementationOnce(() => oldApplicants.promise);
    render();
    // PERT/SES save callbacks can refresh while the mount request is still pending.
    oldApplicants.resolve({ data: applicants }); await settle();
    const configuration = nodes(tree).find((n) => n.type === ForecastingConfiguration);
    livePipeline = pipeline({ total_pipeline_duration_days: 30 });
    await configuration.props.onAlphaSaved(); await settle();
    oldPipeline.resolve({ data: pipeline({ total_pipeline_duration_days: 99 }) }); await settle();
    expect(text(tree)).toContain('30.0 days'); expect(text(tree)).not.toContain('99.0 days');
    const slowList = deferred();
    h.get.mockImplementation((url) => url === '/forecasting/applications' ? slowList.promise : implementation(url));
    const savedRefresh = refresh().props.onClick; savedRefresh();
    h.get.mockImplementation(implementation); liveApplicants = [...applicants, { id: '3', applicationId: 31, name: 'Newest Candidate' }];
    savedRefresh(); await settle();
    slowList.resolve({ data: [] }); await settle();
    expect(text(tree)).toContain('Newest Candidate'); expect(text(tree)).not.toContain('No applicants are available');
  });

  it('ignores stale failures and does not clear the loading indicator for a newer pipeline request', async () => {
    const older = deferred(); h.get.mockImplementationOnce(() => older.promise); await settle();
    const newer = deferred(); const implementation = h.get.getMockImplementation()!;
    h.get.mockImplementation((url) => url === '/forecasting/pipeline' ? newer.promise : implementation(url));
    const pendingRefresh = nodes(tree).find((n) => n.type === ForecastingConfiguration).props.onAlphaSaved();
    older.reject(new Error('Old failure')); await settle();
    expect(text(tree)).toContain('Loading Backend Forecast'); expect(text(tree)).not.toContain('Old failure');
    newer.resolve({ data: livePipeline }); await pendingRefresh; await settle();
    expect(text(tree)).toContain('Backend Forecast Loaded');
  });

  it('invalidates in-flight pipeline and application-list requests on unmount', async () => {
    const pending = deferred(); h.get.mockReturnValue(pending.promise); render(); unmount();
    const writes = h.writes;
    pending.resolve({ data: [] }); await flush();
    expect(h.writes).toBe(writes);
  });

  it('shows list errors with retry and keeps existing applicants after a failed refresh', async () => {
    const implementation = h.get.getMockImplementation()!;
    h.get.mockImplementation((url) => url === '/forecasting/applications' ? Promise.reject(new Error('Network')) : implementation(url));
    await settle(); expect(text(tree)).toContain('Unable to load forecasting applications.');
    expect(text(tree)).not.toContain('No applicants are available');
    h.get.mockImplementation(implementation); refresh().props.onClick(); await settle();
    expect(text(tree)).toContain('First Candidate');
    h.get.mockImplementation((url) => url === '/forecasting/applications' ? Promise.reject(new Error('Network')) : implementation(url));
    refresh().props.onClick(); await settle();
    expect(text(tree)).toContain('First Candidate'); expect(text(tree)).toContain('Use Refresh Live Forecast to retry.');
  });

  it('retains cached display data on pipeline failure and propagates settings-refresh failure', async () => {
    props.globalPipelineForecast = pipeline({ total_pipeline_duration_days: 99 });
    const implementation = h.get.getMockImplementation()!;
    h.get.mockImplementation((url) => url === '/forecasting/pipeline' ? Promise.reject(new Error('Pipeline unavailable')) : implementation(url));
    await settle(); expect(text(tree)).toContain('99.0 days'); expect(text(tree)).toContain('may be stale');
    await expect(nodes(tree).find((n) => n.type === ForecastingConfiguration).props.onAlphaSaved()).rejects.toThrow('Forecast refresh failed');
    await settle(); expect(refresh().props.disabled).toBe(false);
  });
});
