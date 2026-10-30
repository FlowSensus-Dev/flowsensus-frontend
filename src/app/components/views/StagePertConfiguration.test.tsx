import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

// Use the existing project's hook/event harness: no real API, Auth or Supabase imports.
const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, effect: null as any, get: vi.fn(), post: vi.fn(), put: vi.fn(), refreshOnboarding: null as (() => Promise<void>) | null }));
vi.mock('../../../lib/api', () => ({ api: { get: h.get, post: h.post, put: h.put } }));
vi.mock('react', async (original) => ({ ...(await original() as any),
  useState: (initial: any) => {
    const index = h.cursor++;
    if (!(index in h.slots)) h.slots[index] = initial;
    return [h.slots[index], (value: any) => { h.slots[index] = typeof value === 'function' ? value(h.slots[index]) : value; }];
  },
  useRef: (initial: any) => { const index = h.cursor++; return h.slots[index] ?? (h.slots[index] = { current: initial }); },
  useEffect: (effect: any) => { h.effect = effect; },
  useContext: () => h.refreshOnboarding,
}));
import StagePertConfiguration, { PertManagerGuide } from './StagePertConfiguration';
import ForecastingConfiguration from './ForecastingConfiguration';
import AgencySesSettings from './AgencySesSettings';
import DelayReasonManagement from './DelayReasonManagement';
import { pertAttemptKey } from '../../../lib/pertConfiguration';

const names = ['Registration & Screening', 'Medical Clearance', 'CV & Endorsement', 'Under Employer Review', 'Final Deployment'];
const base = (extra: any = {}) => ({
  agency_id: 7, revision: 3, setup_status: 'complete', initial_setup_required: false, can_manage: true, must_change_password: false,
  next_action: 'normal_operations', completed_at: '2026-10-28T12:00:00Z', completed_by: 17,
  forecast_settings_present: true, initial_forecast_settings_required: false, ses_alpha: 0.3, issues: [],
  stages: names.map((stage_name, index) => ({ stage_order: index + 1, stage_name, workflow_stage_id: index + 101,
    stage_key: `server-key-${index + 1}`, is_active: true, optimistic_days: 2, most_likely_days: 5, pessimistic_days: 14,
    pert_baseline_days: 6, calculated_pert_baseline_days: 6, observation_count: 4,
    current_ses_forecast_days: 7.25, effective_forecast_days: 7.25, forecast_basis: 'ses' })), ...extra,
});
const pf18Required = (extra: any = {}) => base({ setup_status: 'required', revision: 0, initial_setup_required: true,
  next_action: 'configure_pert', setup_deferred: false, deferred_at: null, deferred_by: null, workflow_setup_required: true, ...extra });
const deferred = () => ({ revision: 0, setup_status: 'deferred', setup_deferred: true, initial_setup_required: true,
  deferred_at: '2026-10-30T10:00:00Z', deferred_by: 17, workflow_setup_required: true,
  next_action: 'normal_operations', learning_state_modified: false });
function nodes(tree: any): any[] {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
}
const text = (tree: any): string => tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : [tree.props?.children].flat(Infinity).map(text).join(' ');
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

describe('Manager PERT configuration, mocked PF05 API', () => {
  let onSaved: ReturnType<typeof vi.fn>;
  let onDeferred: ReturnType<typeof vi.fn> | undefined;
  const render = (canEdit = true, onboarding = false) => { h.cursor = 0; return StagePertConfiguration({ canEdit, onSaved, onboarding, onDeferred }); };
  const button = (label: string) => nodes(render()).find((n) => n.type === 'button' && text(n).trim() === label);
  const field = (order = 1, name = 'optimistic_days') => nodes(render()).find((n) => n.type === 'input' && n.props.id === `pert-${order}-${name}`);
  const change = (value: string, order = 1, name = 'optimistic_days') => field(order, name).props.onChange({ target: { value } });
  const submit = () => nodes(render()).find((n) => n.type === 'form').props.onSubmit({ preventDefault() {} });
  const mount = async (data: any = base(), canEdit = true) => {
    h.slots = []; h.get.mockResolvedValue({ data }); render(canEdit); h.effect(); await flush();
  };
  const respond = (_url: string, payload: any, method: 'post' | 'put') => ({ data: {
    request_id: payload.request_id, agency_id: 7, operation: method === 'post' ? 'initial_setup' : 'update', revision: payload.expected_revision + 1,
    setup_status: 'complete', initial_setup_required: false, learning_state_modified: false, stages: base().stages,
  } });
  beforeEach(async () => {
    vi.clearAllMocks(); h.slots = []; h.cursor = 0;
    h.refreshOnboarding = null; onDeferred = undefined;
    const storage = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    onSaved = vi.fn().mockResolvedValue(undefined);
    h.put.mockImplementation(async (url, payload) => respond(url, payload, 'put'));
    h.post.mockImplementation(async (url, payload) => respond(url, payload, 'post'));
    await mount();
  });

  it('loads stored inputs and displays all five server catalog stages, formula, baseline and learned SES separately', () => {
    expect(h.get).toHaveBeenCalledWith('/forecasting/pert-configuration');
    expect(field().props.value).toBe('2');
    expect(field(5, 'pessimistic_days').props.value).toBe('14');
    for (const name of names) expect(text(render())).toContain(name);
    expect(text(render())).toContain('Expected PERT = (O + 4M + P) / 6');
    expect(text(render())).toContain('Current PERT Baseline:'); expect(text(render())).toContain('6 days');
    expect(text(render())).toContain('Learned SES Forecast:'); expect(text(render())).toContain('7.25 days');
    expect(nodes(render()).filter((n) => n.type === 'output')).toHaveLength(5);
    expect(h.post).not.toHaveBeenCalled(); expect(h.put).not.toHaveBeenCalled();
  });
  it('uses existing AppShell multi-role Management handling without changing page authorization', async () => {
    const shell = readFileSync(new URL('../AppShell.tsx', import.meta.url), 'utf8');
    expect(shell).toContain("canEditAgencySettings={userRolesList.includes('Management')}");
    expect(shell).toContain('hasAccessToView(currentView, userRolesList, isSuperAdmin, workflowPermissions)');
    for (const roles of [['Management'], ['Recruitment', 'Management']]) {
      await mount(base(), roles.includes('Management'));
      expect(button('Save PERT Configuration')).toBeDefined(); expect(field().props.disabled).toBe(false);
    }
    h.get.mockClear(); await mount(base(), false);
    expect(render(false)).toBeNull(); expect(h.get).not.toHaveBeenCalled();
    expect(h.put).not.toHaveBeenCalled(); expect(h.post).not.toHaveBeenCalled();
  });
  it('checks backend management and password state in addition to local visibility', async () => {
    for (const extra of [{ can_manage: false }, { must_change_password: true, next_action: 'change_password' }, { setup_status: 'inconsistent', issues: ['PARTIAL_PERT_INPUTS'] }]) {
      await mount(base(extra)); expect(field().props.disabled).toBe(true);
      expect(button('Save PERT Configuration')).toBeUndefined();
      await submit(); expect(h.put).not.toHaveBeenCalled();
    }
    expect(text(render())).toContain('reconciliation');
  });
  it('never fabricates legacy O/M/P, and permits voluntary initial confirmation without forcing onboarding', async () => {
    await mount(base({ setup_status: 'unconfirmed', revision: 0, stages: base().stages.map((stage) => ({ ...stage,
      optimistic_days: null, most_likely_days: null, pessimistic_days: null,
    })) }));
    expect(text(render())).toContain('Original PERT inputs are unavailable');
    expect(text(render())).toContain('6 days'); expect(text(render())).toContain('7.25 days');
    expect(field().props.value).toBe(''); expect(text(render())).toContain('voluntarily');
    await submit(); expect(h.post).not.toHaveBeenCalled();
    for (let stage = 1; stage <= 5; stage++) {
      change('2', stage); change('5', stage, 'most_likely_days'); change('14', stage, 'pessimistic_days');
    }
    await submit(); expect(h.post.mock.calls[0][1]).not.toHaveProperty('initial_forecast_settings');
    expect(h.post.mock.calls[0][1].expected_revision).toBe(0);
  });
  it('requires explicit initial submission and alpha when missing, then POSTs only the real schema', async () => {
    await mount(base({ setup_status: 'required', revision: 0, initial_setup_required: true, initial_forecast_settings_required: true,
      forecast_settings_present: false, ses_alpha: null, stages: names.map((stage_name, index) => ({ stage_order: index + 1, stage_name, forecast_basis: 'unavailable' })) }));
    expect(h.post).not.toHaveBeenCalled(); expect(field().props.value).toBe('');
    expect(button('Complete Initial PERT Setup')).toBeDefined();
    for (let stage = 1; stage <= 5; stage++) {
      change('2', stage); change('5', stage, 'most_likely_days'); change('14', stage, 'pessimistic_days');
    }
    await submit(); expect(h.post).not.toHaveBeenCalled(); expect(text(render())).toContain('initial SES alpha');
    nodes(render()).find((n) => n.type === 'input' && !n.props.id).props.onChange({ target: { value: '0.99999' } });
    await submit();
    const payload = h.post.mock.calls[0][1];
    expect(Object.keys(payload).sort()).toEqual(['expected_revision', 'initial_forecast_settings', 'request_id', 'stages']);
    expect(payload.initial_forecast_settings).toEqual({ ses_alpha: 0.99999 });
    expect(payload.request_id).toMatch(/^[a-f0-9-]{36}$/); expect(h.put).not.toHaveBeenCalled();
  });
  it('PUTs existing configuration without learned state, IDs, alpha or baseline and refreshes after confirmation', async () => {
    h.get.mockResolvedValue({ data: base({ revision: 4 }) });
    change('1.2345'); await submit();
    const payload = h.put.mock.calls[0][1];
    expect(payload.expected_revision).toBe(3);
    expect(payload.stages[0]).toEqual({ stage_order: 1, optimistic_days: 1.2345, most_likely_days: 5, pessimistic_days: 14 });
    expect(Object.keys(payload).sort()).toEqual(['expected_revision', 'request_id', 'stages']);
    expect(h.get).toHaveBeenCalledTimes(2); expect(onSaved).toHaveBeenCalledOnce();
    expect(text(render())).toContain('Forecast refresh completed'); expect(text(render())).toMatch(/revision:\s+4/);
  });
  it('blocks missing, unordered and invalid numeric form values before any writes', async () => {
    for (const value of ['', 'NaN', 'Infinity', '-1', '3650.1', '1.00001', '6']) {
      change(value); await submit(); expect(h.put).not.toHaveBeenCalled(); expect(field().props['aria-invalid']).toBe(true);
    }
    change('0.0001'); await submit(); expect(h.put).toHaveBeenCalledOnce();
  });
  it('handles backend 422 without pretending success and permits a corrected new attempt', async () => {
    h.put.mockRejectedValueOnce({ response: { status: 422, data: { detail: { code: 'PERT_INVALID_REQUEST', errors: [{ loc: ['body', 'stages', 0], type: 'value_error' }] } } } });
    await submit(); expect(text(render())).toContain('backend rejected'); expect(onSaved).not.toHaveBeenCalled();
    const oldId = h.put.mock.calls[0][1].request_id;
    change('1'); await submit(); expect(h.put.mock.calls[1][1].request_id).not.toBe(oldId);
  });
  it('blocks conflict resubmission until explicit reload; never overwrites another manager automatically', async () => {
    h.put.mockRejectedValueOnce({ response: { status: 409, data: { detail: { code: 'PERT_CONFIGURATION_CONFLICT' } } } });
    await submit(); expect(text(render())).toContain('initial setup may already be complete');
    expect(button('Save PERT Configuration').props.disabled).toBe(true);
    await submit(); expect(h.put).toHaveBeenCalledOnce(); expect(h.get).toHaveBeenCalledOnce();
    h.get.mockResolvedValueOnce({ data: base({ revision: 8 }) });
    await button('Reload configuration (discard draft)').props.onClick(); await flush();
    await submit(); expect(h.put.mock.calls[1][1].expected_revision).toBe(8);
  });
  it.each([undefined, 500, 503, 408])('retries uncertain saves with the identical method, payload and UUID (%s)', async (status) => {
    h.put.mockRejectedValueOnce(status ? { response: { status } } : new Error('Network Error'));
    await submit(); const original = structuredClone(h.put.mock.calls[0][1]);
    expect(text(render())).toContain('Save outcome unknown'); expect(onSaved).not.toHaveBeenCalled();
    expect(field().props.disabled).toBe(true);
    change('0'); await button('Reload configuration (keep pending save)').props.onClick(); await flush();
    expect(h.get).toHaveBeenCalledTimes(2);
    await submit(); expect(h.put.mock.calls[1][1]).toEqual(original); expect(h.post).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledOnce();
  });
  it('retries initial POST after uncertain completion even if backend setup is now complete', async () => {
    await mount(base({ setup_status: 'required', initial_setup_required: true, revision: 0 }));
    h.post.mockRejectedValueOnce(new Error('Network Error'));
    await submit(); const original = structuredClone(h.post.mock.calls[0][1]);
    h.get.mockResolvedValueOnce({ data: base({ revision: 1 }) });
    await submit(); expect(h.post.mock.calls[1][1]).toEqual(original); expect(h.put).not.toHaveBeenCalled();
    expect(button('Save PERT Configuration')).toBeDefined();
  });
  it('treats malformed success responses as uncertain and retains the original request', async () => {
    h.put.mockResolvedValueOnce({ data: { setup_status: 'complete' } });
    await submit(); expect(text(render())).toContain('Save outcome unknown'); expect(onSaved).not.toHaveBeenCalled();
    await submit(); expect(h.put.mock.calls[1][1]).toEqual(h.put.mock.calls[0][1]);
  });
  it.each([401, 403])('restricts editor after authorization errors (%s)', async (status) => {
    h.put.mockRejectedValueOnce({ response: { status } }); await submit();
    expect(field().props.disabled).toBe(true); expect(onSaved).not.toHaveBeenCalled();
    expect(text(render())).toContain(status === 401 ? 'session has expired' : 'not authorized');
  });
  it('explains required password changes from a fresh save rejection', async () => {
    h.put.mockRejectedValueOnce({ response: { status: 403, data: { detail: { code: 'PERT_PASSWORD_CHANGE_REQUIRED' } } } });
    await submit(); expect(text(render())).toContain('temporary password'); expect(field().props.disabled).toBe(true);
  });
  it('prevents duplicate in-flight saves and edits, and claims success only after confirmation', async () => {
    let finish: any; h.put.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const pending = submit(); expect(button('Saving…').props.disabled).toBe(true);
    expect(field().props.disabled).toBe(true); expect(text(render())).not.toContain('configuration saved');
    await submit(); expect(h.put).toHaveBeenCalledOnce();
    finish(respond('', h.put.mock.calls[0][1], 'put')); await pending;
    expect(text(render())).toContain('configuration saved');
  });
  it('distinguishes confirmed save from failed configuration or forecast refresh and blocks stale edits', async () => {
    h.get.mockRejectedValueOnce(new Error('Network Error')); onSaved.mockRejectedValueOnce(new Error('Refresh'));
    await submit(); expect(text(render())).toContain('save was confirmed'); expect(text(render())).toContain('Forecast refresh failed');
    expect(field().props.disabled).toBe(true); expect(button('Reload configuration (discard draft)').props.disabled).toBe(false);
    expect(button('Retry same save')).toBeUndefined();
  });
  it('shows loading, error and empty/malformed states with a reload path and no GET-side mutations', async () => {
    h.slots = []; h.get.mockReturnValueOnce(new Promise(() => {})); render(); h.effect();
    expect(text(render())).toContain('Loading PERT configuration'); expect(field()).toBeUndefined();
    for (const data of [null, {}, base({ stages: [] })]) {
      await mount(data); expect(text(render())).toContain('unavailable or incomplete'); expect(field()).toBeUndefined();
      expect(button('Reload configuration (discard draft)').props.disabled).toBe(false);
    }
    h.slots = []; h.get.mockRejectedValueOnce({ response: { status: 503 } }); render(); h.effect(); await flush();
    expect(text(render())).toContain('backend is unavailable');
    expect(h.put).not.toHaveBeenCalled(); expect(h.post).not.toHaveBeenCalled();
  });
  it('ignores stale reads and recovers from React StrictMode effect cleanup/replay', async () => {
    let finish: any; h.slots = []; h.get.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    render(); const effect = h.effect; const cleanup = effect(); cleanup();
    h.get.mockResolvedValueOnce({ data: base({ revision: 9 }) }); effect(); await flush();
    finish({ data: base({ revision: 2 }) }); await flush();
    expect(text(render())).toMatch(/revision:\s+9/); expect(field().props.disabled).toBe(false);
  });
  it('recovers the original command after reopening the editor, without changing operation or payload', async () => {
    await mount(base({ setup_status: 'required', revision: 0, initial_setup_required: true, initial_forecast_settings_required: true }));
    nodes(render()).find((n) => n.type === 'input' && !n.props.id).props.onChange({ target: { value: '0.3' } });
    h.post.mockRejectedValueOnce(new Error('Network Error')); await submit();
    const original = structuredClone(h.post.mock.calls[0][1]);
    await mount(base({ revision: 1 })); // GET sees completion, but the pending POST still needs its exact receipt.
    expect(button('Retry same save')).toBeDefined(); expect(field().props.disabled).toBe(true);
    expect(h.post).toHaveBeenCalledOnce(); expect(h.put).not.toHaveBeenCalled();
    await submit(); expect(h.post.mock.calls[1][1]).toEqual(original);
    expect(sessionStorage.getItem(pertAttemptKey(7))).toBeNull();
  });
  it('does not dispatch if pending storage is corrupt or cannot be written', async () => {
    sessionStorage.setItem(pertAttemptKey(7), 'broken'); await mount();
    expect(text(render())).toContain('pending PERT save could not be recovered');
    expect(field()).toBeUndefined(); expect(h.put).not.toHaveBeenCalled();
    sessionStorage.removeItem(pertAttemptKey(7)); await mount();
    vi.spyOn(sessionStorage, 'setItem').mockImplementationOnce(() => { throw new Error('Browser storage unavailable'); });
    await submit(); expect(text(render())).toContain('cannot retain a pending save'); expect(h.put).not.toHaveBeenCalled();
  });
  it('preserves SES Settings and Delay Reason Management while refreshing SES settings and forecasts after PERT saves', async () => {
    h.slots = [];
    const props = { canEdit: true, onAlphaSaved: onSaved, reasons: [], stages: [], loading: false, error: null, refresh: vi.fn() };
    const wrapper = () => { h.cursor = 0; return ForecastingConfiguration(props); };
    const tree = wrapper();
    const ses = nodes(tree).find((n) => n.type === AgencySesSettings);
    const delay = nodes(tree).find((n) => n.type === DelayReasonManagement);
    expect(ses.props.canEdit).toBe(true); expect(ses.props.onSaved).toBe(onSaved);
    expect(delay.props.refresh).toBe(props.refresh); expect(delay.props.reasons).toBe(props.reasons);
    const afterSave = nodes(tree).find((n) => n.type === StagePertConfiguration).props.onSaved;
    await afterSave(false);
    expect(onSaved).toHaveBeenCalledOnce();
    expect(nodes(wrapper()).find((n) => n.type === AgencySesSettings).key).toBe(ses.key);
    await afterSave(true);
    expect(nodes(wrapper()).find((n) => n.type === AgencySesSettings).key).not.toBe(ses.key);
  });
  it('retains an uncertain command through an expired session until access is restored and its receipt is confirmed', async () => {
    h.put.mockRejectedValueOnce(new Error('Network Error')); await submit();
    const original = structuredClone(h.put.mock.calls[0][1]);
    h.put.mockRejectedValueOnce({ response: { status: 401 } }); await submit();
    expect(text(render())).toContain('session has expired'); expect(text(render())).toContain('Save outcome unknown');
    expect(button('Retry same save').props.disabled).toBe(true);
    await button('Reload configuration (keep pending save)').props.onClick(); await flush();
    await submit(); expect(h.put.mock.calls[2][1]).toEqual(original);
    expect(sessionStorage.getItem(pertAttemptKey(7))).toBeNull();
  });
  it('isolates a different agency’s pending save and generates a fresh UUID for deliberate edits after confirmation', async () => {
    sessionStorage.setItem(pertAttemptKey(99), 'not this agency'); await mount();
    expect(button('Save PERT Configuration')).toBeDefined();
    h.get.mockResolvedValue({ data: base({ revision: 4 }) }); await submit();
    const first = h.put.mock.calls[0][1];
    change('1'); await submit();
    expect(h.put.mock.calls[1][1].request_id).not.toBe(first.request_id);
    expect(h.put.mock.calls[1][1].expected_revision).toBe(4);
    expect(sessionStorage.getItem(pertAttemptKey(99))).toBe('not this agency');
  });
  it('opens the reused editor for onboarding and keeps its guide with a clear status-refresh failure path', async () => {
    expect(render(true, true).props.open).toBe(true);
    onSaved.mockRejectedValueOnce(new Error('Onboarding read failed'));
    await nodes(render(true, true)).find((n) => n.type === 'form').props.onSubmit({ preventDefault() {} });
    expect(text(render(true, true))).toContain('Setup status could not be confirmed');
    expect(text(render(true, true))).toContain('Refresh setup status');
    expect(text(render(true, true))).not.toContain('Forecast refresh failed');
  });
  it('preserves the exact idempotent retry payload in onboarding mode and never calls completion on save failure', async () => {
    const saveOnboarding = () => nodes(render(true, true)).find((n) => n.type === 'form').props.onSubmit({ preventDefault() {} });
    h.put.mockRejectedValueOnce(new Error('Network Error')); await saveOnboarding();
    expect(onSaved).not.toHaveBeenCalled(); const original = structuredClone(h.put.mock.calls[0][1]);
    await saveOnboarding(); expect(h.put.mock.calls[1][1]).toEqual(original); expect(onSaved).toHaveBeenCalledOnce();
    expect(text(render(true, true))).toContain('Setup status refreshed');
  });
  it('explains each workflow stage and connects all day inputs to plain-language help', () => {
    const tree = render();
    for (const description of ['applicant registration, screening', 'medical checks', 'preparing the applicant’s CV', 'employer’s review', 'final paperwork']) {
      expect(text(tree)).toContain(description);
    }
    for (let order = 1; order <= 5; order++) {
      for (const name of ['optimistic_days', 'most_likely_days', 'pessimistic_days']) {
        const input = field(order, name);
        const helpId = `pert-${order}-${name}-help`;
        expect(input.props['aria-describedby']).toContain(helpId);
        expect(nodes(tree).find((n) => n.props?.id === helpId)).toBeDefined();
        expect(nodes(tree).find((n) => n.type === 'label' && n.props.htmlFor === input.props.id)?.props.children).toContain(' (days)');
      }
    }
    expect(text(tree)).toContain('The shortest realistic time');
    expect(text(tree)).toContain('The usual time your team normally needs');
    expect(text(tree)).toContain('A longer realistic time');
  });
  it('updates validation progress and previews without changing saved baselines or accepting invalid ordering', async () => {
    const content = () => text(render()).replace(/\s+/g, ' ');
    const preview = () => nodes(render()).find((n) => n.type === 'output');
    expect(content()).toContain('Valid stage estimates: 5 of 5');
    change('3'); expect(text(preview())).toBe('6.1667 days');
    expect(content()).toContain('Current PERT Baseline: 6 days'); expect(content()).toContain('Learned SES Forecast: 7.25 days');
    expect(content()).toContain('Preview only. Changing an input does not save it');
    expect(h.put).not.toHaveBeenCalled(); expect(h.post).not.toHaveBeenCalled();
    change('6'); expect(content()).toContain('Valid stage estimates: 4 of 5');
    expect(text(preview())).toContain('Enter valid O/M/P inputs');
    await submit(); expect(content()).toContain('Most Likely cannot be less than Optimistic');
    expect(field().props.value).toBe('6'); expect(h.put).not.toHaveBeenCalled();
  });
  it('keeps unknown historical inputs empty while showing that all five stages still need estimates', async () => {
    await mount(base({ setup_status: 'unconfirmed', revision: 0, stages: base().stages.map((stage) => ({ ...stage,
      optimistic_days: null, most_likely_days: null, pessimistic_days: null,
    })) }));
    expect(text(render()).replace(/\s+/g, ' ')).toContain('Valid stage estimates: 0 of 5');
    expect(text(render())).toContain('no suggested durations are filled in');
    expect(nodes(render()).filter((n) => n.type === 'input').every((n) => n.props.value === '')).toBe(true);
    expect(text(render())).toContain('Original PERT inputs are unavailable');
    expect(h.put).not.toHaveBeenCalled(); expect(h.post).not.toHaveBeenCalled();
  });
  it('distinguishes loaded configuration from unsaved edits and explains learned-state preservation', () => {
    expect(text(render())).toContain('Saved configuration loaded');
    expect(text(render())).toContain('designed to preserve learned SES values and observation counts');
    expect(text(render())).toContain('only after the backend confirms it');
    change('1'); expect(field().props.value).toBe('1');
    expect(text(render())).toContain('Typing changes or viewing a preview does not save them');
    expect(h.put).not.toHaveBeenCalled();
  });
  it('explains initial alpha in the editor without referring onboarding Managers to an absent guide below', async () => {
    await mount(base({ setup_status: 'required', revision: 0, initial_setup_required: true, initial_forecast_settings_required: true }));
    const help = nodes(render(true, true)).find((n) => n.props?.id === 'pert-alpha-help');
    expect(text(help)).toContain('higher values give newer observations more weight');
    expect(text(help)).toContain('review it later in Agency SES Settings');
    expect(text(help)).not.toContain('guide below');
  });
  it('keeps the expandable guide understandable without presenting illustrative values as suggestions', () => {
    const guide = PertManagerGuide();
    expect(guide.type).toBe('details');
    expect(text(guide)).toContain('shortest ≤ usual ≤ longer (O ≤ M ≤ P)');
    expect(text(guide)).toContain('Equal values are allowed');
    expect(text(guide)).toContain('for each stage separately');
    expect(text(guide)).toContain('For example only');
    expect(text(guide)).toContain('These example values are not entered into your configuration');
    expect(text(guide)).toContain('staff who handle each stage');
    expect(text(guide)).toContain('Observations are recorded actual durations');
  });
  it('offers Configure Later only for Management with authoritative PF18 eligibility and a cleared password requirement', async () => {
    onDeferred = vi.fn().mockResolvedValue(undefined);
    await mount(pf18Required()); expect(button('Configure Later')).toBeDefined();
    for (const data of [base({ setup_status: 'required', initial_setup_required: true }), pf18Required({ must_change_password: true, next_action: 'change_password' }),
      pf18Required({ can_manage: false }), base(), base({ setup_status: 'unconfirmed' })]) {
      await mount(data); expect(button('Configure Later')).toBeUndefined();
    }
    await mount(pf18Required(), false); expect(render(false)).toBeNull(); expect(h.post).not.toHaveBeenCalled();
  });
  it('defers with only expected_revision, without inventing or saving missing O/M/P values', async () => {
    onDeferred = vi.fn().mockResolvedValue(undefined);
    await mount(pf18Required({ stages: base().stages.map((stage) => ({ ...stage, optimistic_days: null, most_likely_days: null, pessimistic_days: null })) }));
    h.post.mockResolvedValueOnce({ data: deferred() });
    button('Configure Later').props.onClick(); await flush();
    expect(h.post).toHaveBeenCalledOnce(); expect(h.post).toHaveBeenCalledWith('/forecasting/pert-configuration/defer', { expected_revision: 0 });
    expect(h.put).not.toHaveBeenCalled(); expect(onSaved).not.toHaveBeenCalled(); expect(onDeferred).toHaveBeenCalledOnce();
    expect(field().props.value).toBe(''); expect(sessionStorage.getItem(pertAttemptKey(7))).toBeNull();
    expect(text(render())).not.toContain('PERT configuration saved.');
  });
  it('prevents duplicate defer submissions and concurrent PERT saves until the server responds', async () => {
    onDeferred = vi.fn().mockResolvedValue(undefined); await mount(pf18Required());
    let finish: any; h.post.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const click = button('Configure Later').props.onClick;
    click(); click(); await submit();
    expect(h.post).toHaveBeenCalledOnce(); expect(onDeferred).not.toHaveBeenCalled();
    expect(field().props.disabled).toBe(true); expect(button('Confirming Configure Later…').props.disabled).toBe(true);
    finish({ data: deferred() }); await flush(); expect(onDeferred).toHaveBeenCalledOnce();
  });
  it.each([401, 403, 409, 422, 503, 404, 405, undefined])('keeps setup incomplete and requires a status reload after defer failure (%s)', async (status) => {
    onDeferred = vi.fn().mockResolvedValue(undefined); await mount(pf18Required());
    const readsBeforeDefer = h.get.mock.calls.length;
    h.post.mockRejectedValueOnce(status ? { response: { status } } : new Error('Network Error'));
    button('Configure Later').props.onClick(); await flush();
    expect(onDeferred).not.toHaveBeenCalled(); expect(button('Configure Later').props.disabled).toBe(true);
    expect(nodes(render()).some((n) => n.props?.role === 'alert')).toBe(true);
    expect(h.get).toHaveBeenCalledTimes(readsBeforeDefer); expect(h.post).toHaveBeenCalledOnce(); expect(sessionStorage.getItem(pertAttemptKey(7))).toBeNull();
    expect(text(render())).not.toContain('PERT configuration saved.');
    if ([503, 404, 405].includes(status as number)) expect(text(render())).toContain('may not be deployed');
    if (status === 403) expect(text(render())).toContain('required password change first');
    if (status === 409) expect(text(render())).toContain('Agency setup changed');
    await button('Reload configuration (discard draft)').props.onClick(); await flush();
    expect(button('Configure Later').props.disabled).toBe(false); expect(h.post).toHaveBeenCalledOnce();
  });
  it('does not accept a malformed deferral success or a failed authoritative refresh as permission to navigate', async () => {
    onDeferred = vi.fn().mockResolvedValue(undefined); await mount(pf18Required());
    h.post.mockResolvedValueOnce({ data: { ...deferred(), learning_state_modified: true } });
    button('Configure Later').props.onClick(); await flush(); expect(onDeferred).not.toHaveBeenCalled();
    await button('Reload configuration (discard draft)').props.onClick(); await flush();
    h.post.mockResolvedValueOnce({ data: deferred() }); onDeferred.mockRejectedValueOnce(new Error('GET unavailable'));
    button('Configure Later').props.onClick(); await flush();
    expect(text(render())).toContain('confirmed deferral, but current setup status could not be verified');
    expect(button('Configure Later').props.disabled).toBe(true);
  });
  it('does not defer while a PERT save outcome is uncertain, preserving its existing request identity', async () => {
    onDeferred = vi.fn().mockResolvedValue(undefined); await mount(pf18Required());
    h.post.mockRejectedValueOnce(new Error('Network Error')); await submit();
    expect(button('Configure Later').props.disabled).toBe(true);
    button('Configure Later').props.onClick(); await flush();
    expect(h.post).toHaveBeenCalledOnce(); expect(h.post.mock.calls[0][0]).toBe('/forecasting/pert-configuration');
    expect(onDeferred).not.toHaveBeenCalled();
  });
  it('completes a deferred configuration with the existing initial POST and preserves learned state in the payload', async () => {
    await mount(base({ ...deferred() }));
    expect(text(render())).toContain('deferred, not completed'); await submit();
    expect(h.post.mock.calls[0][0]).toBe('/forecasting/pert-configuration');
    expect(Object.keys(h.post.mock.calls[0][1]).sort()).toEqual(['expected_revision', 'request_id', 'stages']);
    expect(h.put).not.toHaveBeenCalled(); expect(onSaved).toHaveBeenCalledOnce();
  });
  it('notifies the outer deferred reminder as well as refreshing forecasts after a workspace PERT save', async () => {
    h.slots = []; h.refreshOnboarding = vi.fn().mockResolvedValue(undefined);
    h.cursor = 0;
    const tree = ForecastingConfiguration({ canEdit: true, onAlphaSaved: onSaved, reasons: [], stages: [], loading: false, error: null, refresh: vi.fn() });
    await nodes(tree).find((n) => n.type === StagePertConfiguration).props.onSaved(false);
    expect(onSaved).toHaveBeenCalledOnce(); expect(h.refreshOnboarding).toHaveBeenCalledOnce();
  });
});
