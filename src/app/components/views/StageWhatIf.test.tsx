import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const h = vi.hoisted(() => ({ slots: {} as Record<string, any[]>, stage: '', cursor: 0, post: vi.fn() }));
vi.mock('../../../lib/api', () => ({ api: { post: h.post } }));
vi.mock('react', async (original) => {
  const actual: any = await original();
  return { ...actual,
    useState: (initial: any) => {
      const slots = h.slots[h.stage]; const index = h.cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (value: any) => { slots[index] = value; }];
    },
    useRef: (initial: any) => {
      const slots = h.slots[h.stage]; const index = h.cursor++;
      return slots[index] ?? (slots[index] = { current: initial });
    },
    useLayoutEffect: () => {},
  };
});
import { StageWhatIf } from './PredictiveForecast';

function nodes(tree: any): any[] {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
}

describe('existing stage simulation with equation details (mocked API)', () => {
  let histories: Record<string, any[]>;
  const render = (stage = 'Trade Test') => {
    h.stage = stage; h.cursor = 0; h.slots[stage] ??= [];
    return StageWhatIf({ stage: { stage_name: stage, observation_count: 2, optimistic: 0, most_likely: 1,
      pessimistic: 2, pert_baseline: 1, current_forecast: 0.07, is_fallback: false },
    applicantId: '19', alpha: 0.3, inputId: stage, history: histories[stage] ?? [], liveBasis: stage,
    exceptions: [], onSuccess: (value) => { histories[stage] = [...(histories[stage] ?? []), value]; },
    onReset: () => { histories[stage] = []; } });
  };
  const input = (stage: string, id: string, value: any, prop = 'value') => {
    nodes(render(stage)).find((n) => n.props?.id === `${stage}-${id}`).props.onChange({ target: { [prop]: value } });
  };
  const run = (stage = 'Trade Test') => nodes(render(stage)).find((n) => n.type === 'form').props.onSubmit({ preventDefault() {} });
  const html = (stage = 'Trade Test') => renderToStaticMarkup(render(stage));

  beforeEach(() => {
    h.slots = {}; histories = {}; vi.clearAllMocks();
    h.post.mockImplementation(async (_url, p) => {
      const actual = p.alpha * p.days_passed;
      const complement = 1 - p.alpha;
      const prior = complement * p.prior_forecast_days;
      const normal = Number((actual + prior).toFixed(4));
      return { data: { applicant_id: p.applicant_id, workflow_stage: p.workflow_stage, alpha_used: p.alpha,
        previous_stage_forecast: p.prior_forecast_days, base_actual_days: p.days_passed,
        new_stage_forecast: normal, actual_penalty_days: p.actual_penalty,
        adjusted_stage_forecast_days: normal + p.actual_penalty, exception_weight_updated: false,
        previous_weight_days: null, new_exception_weight: null,
        calculation_breakdown: { previous_forecast_days: p.prior_forecast_days, alpha: p.alpha,
          base_actual_days: p.days_passed, actual_contribution_days: actual, one_minus_alpha: complement,
          prior_contribution_days: prior, weighted_sum_days: actual + prior, normal_ses_forecast_days: normal,
          penalty_adjustment_days: p.actual_penalty, penalty_adjustment_source: 'raw_penalty',
          adjusted_forecast_days: normal + p.actual_penalty } } };
    });
  });

  it('keeps independent chains, each equation, normal priors after penalty, and reset behavior', async () => {
    const stage = 'Trade Test';
    input(stage, 'base', '3');
    nodes(render()).find((n) => n.props?.type === 'checkbox').props.onChange({ target: { checked: true } });
    input(stage, 'reason', 'Weather'); input(stage, 'penalty', '2'); await run();
    expect(html()).toContain('(0.3 × 3.00) + (0.7 × 0.07)');
    expect(html()).toContain('Normal SES 0.949 + Penalty 2.00');
    input(stage, 'base', '4'); await run();
    expect(h.post.mock.calls[1][1].prior_forecast_days).toBe(0.949);
    expect(html()).toContain('(0.3 × 4.00) + (0.7 × 0.949)');
    expect(html()).toContain('(0.3 × 3.00) + (0.7 × 0.07)');
    expect(histories[stage]).toHaveLength(2);
    input('Medical', 'base', '1'); await run('Medical');
    expect(h.post.mock.calls[2][1].prior_forecast_days).toBe(0.07);
    expect(histories.Medical).toHaveLength(1);
    nodes(render()).find((n) => n.type === 'button' && n.props.children === 'Reset Preview Chain').props.onClick();
    expect(histories[stage]).toHaveLength(0);
    expect(html()).not.toContain('SES Calculation Breakdown');
    expect(histories.Medical).toHaveLength(1);
    await run();
    expect(h.post.mock.calls[3][1].prior_forecast_days).toBe(0.07);
  });

  it('retains preview and chaining with an older backend response', async () => {
    const implementation = h.post.getMockImplementation()!;
    h.post.mockImplementation(async (...args) => {
      const result = await implementation(...args);
      delete result.data.calculation_breakdown; return result;
    });
    input('Trade Test', 'base', '3'); await run();
    expect(html()).toContain('Calculation details unavailable for this preview.');
    expect(html()).toContain('Normal What-if SES');
    expect(html()).toContain('Temporary preview');
    expect(html()).not.toContain('NaN');
    await run(); expect(h.post.mock.calls[1][1].prior_forecast_days).toBe(0.949);
  });

  it('preserves input validation, request payload, and simulation errors', async () => {
    await run(); expect(h.post).not.toHaveBeenCalled();
    expect(html()).toContain('Enter a valid base duration');
    input('Trade Test', 'base', '3');
    h.post.mockRejectedValueOnce({ response: { data: { detail: 'Preview unavailable' } } });
    await run(); expect(html()).toContain('Preview unavailable');
    expect(h.post).toHaveBeenCalledWith('/forecasting/simulate-step', expect.objectContaining({
      applicant_id: '19', workflow_stage: 'Trade Test', days_passed: 3, prior_forecast_days: 0.07,
      alpha: 0.3, actual_penalty: 0, reason: 'Normal Process', advance_stage: true,
    }));
    expect(histories['Trade Test']).toBeUndefined();
  });
});
