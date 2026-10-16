import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import SesCalculationBreakdown from './SesCalculationBreakdown';

export const response = (prior = 0.07, normal = 0.949, penalty = 0, learned: number | null = null) => ({
  applicant_id: '19', workflow_stage: 'Trade Test', alpha_used: 0.3, base_actual_days: 3,
  actual_penalty_days: penalty, adjusted_stage_forecast_days: normal + (learned ?? penalty),
  total_actual_days: 3 + penalty, previous_stage_forecast: prior, new_stage_forecast: normal,
  exception_weight_updated: learned !== null, previous_weight_days: learned !== null ? 2 : null,
  new_exception_weight: learned, applicant_advanced: true, new_stage_index: 1,
  total_pipeline_eta: null, math_explanation: '',
  calculation_breakdown: {
    previous_forecast_days: prior, alpha: 0.3, base_actual_days: 3,
    actual_contribution_days: 0.9, one_minus_alpha: 0.7, prior_contribution_days: 0.049,
    weighted_sum_days: 0.949, normal_ses_forecast_days: normal,
    penalty_adjustment_days: learned ?? penalty,
    penalty_adjustment_source: learned !== null ? 'exception_weight_preview' as const : 'raw_penalty' as const,
    adjusted_forecast_days: normal + (learned ?? penalty),
  },
});

describe('compact SES equation', () => {
  it('shows the formula, returned terms, complement, and canonical final result in an expandable block', () => {
    const html = renderToStaticMarkup(<SesCalculationBreakdown data={response()} />);
    expect(html).toContain('<details open=""');
    expect(html).toContain('SES Calculation Breakdown');
    expect(html).toContain('F_next = alpha × actual + (1 − alpha) × previous');
    expect(html).toContain('(0.3 × 3.00) + (0.7 × 0.07) ≈');
    expect(html).toContain('0.949 days');
    expect(html).toContain('0.7 = 1 − 0.3');
    expect(html).toContain('Weighted contributions: 0.90 + 0.049 = 0.949 days');
    expect(html).not.toContain('Adjusted Forecast');
  });

  it('preserves precise operands and uses backend rounding rather than the screen-rounded prior', () => {
    const data = response(0.06666666666666667, 0.9467);
    Object.assign(data.calculation_breakdown, { actual_contribution_days: 0.8999999999999999,
      prior_contribution_days: 0.04666666666666666, weighted_sum_days: 0.9466666666666665 });
    const html = renderToStaticMarkup(<SesCalculationBreakdown data={data} />);
    expect(html).toContain('(0.7 × 0.06666666666666667)');
    expect(html).toContain('0.9467 days');
    expect(html).not.toContain('0.95 days');
  });

  it.each([null, 1.5])('adds penalty separately using the backend adjustment (%s)', (learned) => {
    const html = renderToStaticMarkup(<SesCalculationBreakdown data={response(0.07, 0.949, 3, learned)} />);
    expect(html).toContain('(0.3 × 3.00) + (0.7 × 0.07)');
    expect(html).toContain(`Normal SES 0.949 + Penalty ${learned === null ? '3.00' : '1.50'} =`);
    expect(html).toContain(`Adjusted Forecast ${learned === null ? '3.949' : '2.449'} days`);
    expect(html).toContain(learned === null ? 'entered penalty' : 'exception weight preview');
  });

  it.each(['missing', 'null', 'partial', 'nonfinite', 'mismatched'])('degrades safely for %s details', (kind) => {
    const data: any = response();
    if (kind === 'missing') delete data.calculation_breakdown;
    if (kind === 'null') data.calculation_breakdown = null;
    if (kind === 'partial') data.calculation_breakdown = { alpha: 0.3 };
    if (kind === 'nonfinite') data.calculation_breakdown.weighted_sum_days = NaN;
    if (kind === 'mismatched') data.calculation_breakdown.normal_ses_forecast_days = 17;
    const html = renderToStaticMarkup(<SesCalculationBreakdown data={data} />);
    expect(html).toContain('Calculation details unavailable for this preview.');
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
  });
});
