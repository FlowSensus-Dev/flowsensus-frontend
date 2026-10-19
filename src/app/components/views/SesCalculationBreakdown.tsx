import React from 'react';

export interface SimulationCalculationBreakdown {
  previous_forecast_days: number;
  alpha: number;
  base_actual_days: number;
  actual_contribution_days: number;
  one_minus_alpha: number;
  prior_contribution_days: number;
  weighted_sum_days: number;
  normal_ses_forecast_days: number;
  penalty_adjustment_days: number;
  penalty_adjustment_source: 'exception_weight_preview' | 'raw_penalty';
  adjusted_forecast_days: number;
}

interface CalculationResponse {
  calculation_breakdown?: SimulationCalculationBreakdown | null;
  previous_stage_forecast: number;
  alpha_used: number;
  base_actual_days: number;
  new_stage_forecast: number;
  adjusted_stage_forecast_days: number;
  actual_penalty_days: number;
  exception_weight_updated: boolean;
  new_exception_weight: number | null;
}

// Keep the server's numeric precision; only pad exact short decimals for readability.
function days(value: number): string {
  return Number(value.toFixed(2)) === value ? value.toFixed(2) : String(value);
}

function usableBreakdown(data: CalculationResponse): SimulationCalculationBreakdown | null {
  const b = data.calculation_breakdown;
  if (!b) return null;
  const values = [b.previous_forecast_days, b.alpha, b.base_actual_days,
    b.actual_contribution_days, b.one_minus_alpha, b.prior_contribution_days,
    b.weighted_sum_days, b.normal_ses_forecast_days, b.penalty_adjustment_days, b.adjusted_forecast_days];
  if (!values.every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0) ||
    b.alpha <= 0 || b.alpha > 1 || b.one_minus_alpha > 1 ||
    b.previous_forecast_days !== data.previous_stage_forecast || b.alpha !== data.alpha_used ||
    b.base_actual_days !== data.base_actual_days || b.normal_ses_forecast_days !== data.new_stage_forecast ||
    b.adjusted_forecast_days !== data.adjusted_stage_forecast_days ||
    b.penalty_adjustment_source !== (data.exception_weight_updated ? 'exception_weight_preview' : 'raw_penalty') ||
    b.penalty_adjustment_days !== (data.exception_weight_updated ? data.new_exception_weight : data.actual_penalty_days)) return null;
  return b;
}

export default function SesCalculationBreakdown({ data, compact = false }: { data: CalculationResponse; compact?: boolean }) {
  const b = usableBreakdown(data);
  const equation = b ? (
    <div className="space-y-1">
      <p className="font-mono text-slate-800 break-words"
        aria-label="F_next = alpha × actual + (1 − alpha) × previous"
        title={`Weighted contributions: ${days(b.actual_contribution_days)} + ${days(b.prior_contribution_days)} = ${days(b.weighted_sum_days)} days`}>
        ({b.alpha} × {days(b.base_actual_days)}) + ({b.one_minus_alpha} × {days(b.previous_forecast_days)}) ≈ <strong className="text-sky-700">{days(b.normal_ses_forecast_days)} days</strong>
      </p>
      {!compact && <p className="text-[11px] text-slate-500">{b.one_minus_alpha} = 1 − {b.alpha} · Final SES rounded by the backend to four decimals.</p>}
      {data.actual_penalty_days > 0 && <p className="font-mono text-amber-900 break-words"
        title={b.penalty_adjustment_source === 'exception_weight_preview' ? 'Penalty uses the exception weight preview' : 'Penalty uses the entered penalty'}>
        Normal SES {days(b.normal_ses_forecast_days)} + Penalty {days(b.penalty_adjustment_days)} = <strong>Adjusted Forecast {days(b.adjusted_forecast_days)} days</strong>
      </p>}
    </div>
  ) : <p className="text-[11px] text-slate-500">Calculation details unavailable for this preview.</p>;

  if (compact) return equation;
  return <details open className="mt-2 text-xs">
    <summary className="cursor-pointer font-semibold text-slate-700">SES Calculation Breakdown</summary>
    <div className="mt-1">{equation}</div>
  </details>;
}
