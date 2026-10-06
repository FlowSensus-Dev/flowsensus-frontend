import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileText, Loader2, Receipt, TrendingUp, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { api } from '../../../lib/api';

type ReportName = 'monthly_deployments' | 'staff_performance' | 'financial_summary' | 'workflow_efficiency';

interface ReportMetadata {
  report: ReportName;
  generated_at?: string | null;
  scope: 'agency' | 'all_agencies' | 'authenticated_agency';
  agency_id: number | null;
  timezone: 'UTC';
  date_from: string | null;
  date_to_exclusive: string | null;
  date_field: string;
}

interface DeploymentRow {
  agency_id: number;
  application_id: number;
  applicant_id: number;
  applicant_name: string | null;
  applicant_code: string | null;
  job_order_id: number | null;
  job_order_code: string | null;
  employer_id: number | null;
  employer_name: string | null;
  country_id: number | null;
  country_name: string | null;
  position: string | null;
  actual_deployment_at: string;
  status_code: string | null;
  current_phase: number | null;
  current_stage_id: number | null;
}

interface MonthlyDeploymentReport {
  metadata: ReportMetadata;
  summary: { year: number; month: number; total_deployments: number };
  rows: DeploymentRow[];
}

interface StaffActivityRow {
  agency_id: number;
  actor_user_id: number;
  actor_name: string | null;
  actor_role: string | null;
  roles: string[];
  logged_operational_actions: number;
  unique_applicants_touched: number;
  first_activity_at: string;
  last_activity_at: string;
  modules: Record<string, number>;
  actions: Record<string, number>;
}

interface StaffPerformanceReport {
  metadata: ReportMetadata;
  summary: {
    staff_actor_count: number;
    logged_operational_actions: number;
    unique_applicants_touched: number;
  };
  rows: StaffActivityRow[];
}

interface DurationMetrics {
  completed_attempt_count: number;
  base_duration_sample_count: number;
  penalty_duration_sample_count: number;
  total_duration_sample_count: number;
  average_base_actual_days: number | null;
  average_actual_penalty_days: number | null;
  average_total_actual_days: number | null;
  min_total_actual_days: number | null;
  max_total_actual_days: number | null;
}

interface WorkflowStageRow extends DurationMetrics {
  agency_id: number;
  workflow_stage_id: number;
  stage_name: string | null;
  stage_order: number | null;
}

interface WorkflowEfficiencyReport {
  metadata: ReportMetadata;
  summary: DurationMetrics & { stage_count: number };
  rows: WorkflowStageRow[];
}

// Raw API fields are retained; no ExpenseRecord currency/type/name defaults are used.
interface FinancialRecord {
  financial_record_id: number;
  applicant_id: number;
  amount: number;
  agency_id?: number | null;
  expense_date?: string | null;
  created_at?: string | null;
  currency?: string | null;
  category?: string | null;
  description?: string | null;
  payment_type?: string | null;
  transaction_type?: string | null;
  recorded_by?: number | null;
  recorded_by_name?: string | null;
  applicant?: { first_name?: string | null; last_name?: string | null; agency_id?: number | null } | null;
}

interface DecimalAmount { coefficient: bigint; scale: number }

interface FinancialSummaryReport {
  metadata: ReportMetadata;
  summary: {
    record_count: number;
    currency_totals: { currency: string; amount: DecimalAmount }[];
    unspecified_currency_count: number;
    categories: string[];
    undated_record_count: number;
  };
  rows: (FinancialRecord & { report_date: string })[];
}

interface ReportResponse {
  metadata: ReportMetadata;
  summary: object;
  rows: { agency_id?: number | null }[];
}

type ReportPeriod = { month: string } | { dateFrom: string; dateTo: string };

interface ReportDefinition<T extends ReportResponse> {
  name: ReportName;
  endpoint: '/reports/monthly-deployments' | '/reports/staff-performance' | '/financial/records' | '/reports/workflow-efficiency';
  load?: (period: ReportPeriod, signal: AbortSignal) => Promise<T>;
  title: string;
  description: string;
  icon: LucideIcon;
  dateField: string;
  filename: string;
  emptyMessage: string;
  validate: (value: unknown) => value is T;
  summaryText: (report: T) => string[];
  pdfSummary: (report: T) => string[];
  columns: string[] | ((report: T) => string[]);
  tableRows: (report: T) => string[][];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isId = (value: unknown): value is number => isCount(value) && value > 0;
const isNullableId = (value: unknown) => value === null || isId(value);
const isNullableText = (value: unknown) => value === null || typeof value === 'string';
const isTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const isNullableTimestamp = (value: unknown) => value === null || isTimestamp(value);
const isNullableDuration = (value: unknown) =>
  value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
const fieldsMatch = (value: Record<string, unknown>, fields: string[], check: (field: unknown) => boolean) =>
  fields.every((field) => check(value[field]));
const isCountMap = (value: unknown) => isObject(value) && Object.values(value).every(isCount);

function isMetadata(value: unknown, name: ReportName): value is ReportMetadata {
  return isObject(value) && value.report === name && value.timezone === 'UTC' &&
    ((value.scope === 'agency' && isId(value.agency_id)) ||
      (value.scope === 'all_agencies' && value.agency_id === null)) &&
    (value.generated_at == null || isTimestamp(value.generated_at)) &&
    isNullableTimestamp(value.date_from) && isNullableTimestamp(value.date_to_exclusive) &&
    typeof value.date_field === 'string';
}

function isEnvelope(value: unknown, name: ReportName): value is {
  metadata: ReportMetadata; summary: Record<string, unknown>; rows: unknown[];
} {
  if (!isObject(value) || !isMetadata(value.metadata, name) ||
      !isObject(value.summary) || !Array.isArray(value.rows)) return false;
  const metadata = value.metadata;
  return value.rows.every((row) => isObject(row) && isId(row.agency_id) &&
    (metadata.scope === 'all_agencies' || row.agency_id === metadata.agency_id));
}

function isMonthlyReport(value: unknown): value is MonthlyDeploymentReport {
  return isEnvelope(value, 'monthly_deployments') &&
    fieldsMatch(value.summary, ['year', 'month', 'total_deployments'], isCount) &&
    typeof value.summary.year === 'number' && value.summary.year >= 1 && value.summary.year <= 9998 &&
    typeof value.summary.month === 'number' && value.summary.month >= 1 && value.summary.month <= 12 &&
    value.summary.total_deployments === value.rows.length &&
    value.rows.every((row) => isObject(row) &&
      fieldsMatch(row, ['application_id', 'applicant_id'], isId) &&
      fieldsMatch(row, ['job_order_id', 'employer_id', 'country_id', 'current_stage_id'], isNullableId) &&
      (row.current_phase === null || isCount(row.current_phase)) &&
      fieldsMatch(row, ['applicant_name', 'applicant_code', 'job_order_code', 'employer_name',
        'country_name', 'position', 'status_code'], isNullableText) && isTimestamp(row.actual_deployment_at));
}

function isStaffReport(value: unknown): value is StaffPerformanceReport {
  return isEnvelope(value, 'staff_performance') &&
    fieldsMatch(value.summary, ['staff_actor_count', 'logged_operational_actions', 'unique_applicants_touched'], isCount) &&
    value.summary.staff_actor_count === value.rows.length &&
    value.rows.every((row) => isObject(row) && isId(row.actor_user_id) &&
      fieldsMatch(row, ['actor_name', 'actor_role'], isNullableText) &&
      Array.isArray(row.roles) && row.roles.every((role) => typeof role === 'string') &&
      fieldsMatch(row, ['logged_operational_actions', 'unique_applicants_touched'], isCount) &&
      fieldsMatch(row, ['first_activity_at', 'last_activity_at'], isTimestamp) &&
      isCountMap(row.modules) && isCountMap(row.actions));
}

function isDurationMetrics(value: Record<string, unknown>): boolean {
  return fieldsMatch(value, ['completed_attempt_count', 'base_duration_sample_count',
    'penalty_duration_sample_count', 'total_duration_sample_count'], isCount) &&
    fieldsMatch(value, ['average_base_actual_days', 'average_actual_penalty_days',
      'average_total_actual_days', 'min_total_actual_days', 'max_total_actual_days'], isNullableDuration);
}

function isWorkflowReport(value: unknown): value is WorkflowEfficiencyReport {
  return isEnvelope(value, 'workflow_efficiency') && isCount(value.summary.stage_count) &&
    value.summary.stage_count === value.rows.length && isDurationMetrics(value.summary) &&
    value.rows.every((row) => isObject(row) && isId(row.workflow_stage_id) &&
      isNullableText(row.stage_name) && (row.stage_order === null || isCount(row.stage_order)) &&
      isDurationMetrics(row));
}

const displayText = (value: string | null) => value?.trim() || '—';
const displayDays = (value: number | null) => value === null ? '—' : value.toLocaleString('en-PH', { maximumFractionDigits: 2 });
const displayCount = (value: number) => value.toLocaleString('en-PH');
const displayTimestamp = (value: string, dateOnly = false) => new Date(value).toLocaleString('en-GB', {
  timeZone: 'UTC', year: 'numeric', month: 'short', day: '2-digit',
  ...(dateOnly ? {} : { hour: '2-digit', minute: '2-digit', hour12: false }),
});
const displayCountMap = (value: Record<string, number>) =>
  Object.entries(value).map(([label, count]) => `${label}: ${displayCount(count)}`).join('\n') || '—';

// Sum the returned decimal amounts without currency conversion or floating-point accumulation.
function decimalAmount(value: number): DecimalAmount {
  const [mantissa, exponent = '0'] = value.toString().split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  const scale = fraction.length - Number(exponent);
  const coefficient = BigInt(`${whole}${fraction}`);
  return scale < 0 ? { coefficient: coefficient * 10n ** BigInt(-scale), scale: 0 } : { coefficient, scale };
}

function addAmounts(left: DecimalAmount, right: DecimalAmount): DecimalAmount {
  const scale = Math.max(left.scale, right.scale);
  return { scale, coefficient: left.coefficient * 10n ** BigInt(scale - left.scale) +
    right.coefficient * 10n ** BigInt(scale - right.scale) };
}

function displayAmount(amount: DecimalAmount): string {
  const negative = amount.coefficient < 0n;
  const digits = (negative ? -amount.coefficient : amount.coefficient).toString().padStart(amount.scale + 1, '0');
  const whole = amount.scale ? digits.slice(0, -amount.scale) : digits;
  const fraction = amount.scale ? digits.slice(-amount.scale).replace(/0+$/, '') : '';
  return `${negative ? '-' : ''}${BigInt(whole).toLocaleString('en-PH')}.${fraction.padEnd(2, '0')}`;
}

const optionalText = (value: unknown) => value == null || typeof value === 'string';
const optionalId = (value: unknown) => value == null || isId(value);

function isFinancialRecord(value: unknown): value is FinancialRecord {
  if (!isObject(value) || !isId(value.financial_record_id) || !isId(value.applicant_id) ||
      typeof value.amount !== 'number' || !Number.isFinite(value.amount) ||
      !fieldsMatch(value, ['agency_id', 'recorded_by'], optionalId) ||
      !fieldsMatch(value, ['expense_date', 'created_at', 'currency', 'category', 'description',
        'payment_type', 'transaction_type', 'recorded_by_name'], optionalText)) return false;
  return value.applicant == null || (isObject(value.applicant) &&
    fieldsMatch(value.applicant, ['first_name', 'last_name'], optionalText) && optionalId(value.applicant.agency_id) &&
    (value.agency_id == null || value.applicant.agency_id == null || value.agency_id === value.applicant.agency_id));
}

function financialRecordDate(record: FinancialRecord): string | null {
  // Prefer the recorded financial date. Never replace an unusable date with today.
  const value = record.expense_date?.trim() || record.created_at?.trim();
  if (!value) return null;
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '0001-01-01' ||
      !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) ||
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return null;
  if (value === date) return date;
  return isTimestamp(value) ? new Date(value).toISOString().slice(0, 10) : null;
}

async function loadFinancialReport(period: ReportPeriod, signal: AbortSignal): Promise<FinancialSummaryReport> {
  if ('month' in period || periodError(period)) throw new Error('Invalid financial period');
  // This endpoint accepts applicantId only; date filtering is deliberately local.
  const { data } = await api.get<unknown>('/financial/records', { signal });
  if (!Array.isArray(data) || !data.every(isFinancialRecord)) throw new Error('Invalid financial records');
  const agencies = new Set(data.map((record) => record.agency_id ?? record.applicant?.agency_id).filter(isId));
  if (agencies.size > 1) throw new Error('Financial records span unexpected agencies');
  const agencyId = agencies.values().next().value ?? null;
  const rows: FinancialSummaryReport['rows'] = [];
  let undatedRecordCount = 0;
  for (const record of data) {
    const date = financialRecordDate(record);
    if (date === null) { undatedRecordCount++; continue; }
    if (date >= period.dateFrom && date <= period.dateTo) rows.push({ ...record, report_date: date });
  }
  rows.sort((left, right) => left.report_date.localeCompare(right.report_date) || left.financial_record_id - right.financial_record_id);
  const totals = new Map<string, DecimalAmount>();
  let unspecifiedCurrencyCount = 0;
  const categories = new Set<string>();
  for (const record of rows) {
    const currency = record.currency?.trim();
    if (currency) totals.set(currency, addAmounts(totals.get(currency) ?? { coefficient: 0n, scale: 0 }, decimalAmount(record.amount)));
    else unspecifiedCurrencyCount++;
    if (record.category?.trim()) categories.add(record.category.trim());
  }
  const end = new Date(`${period.dateTo}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    // The records API has no report metadata. Scope comes from returned agency IDs;
    // the PDF explicitly uses download time rather than claiming a backend timestamp.
    metadata: { report: 'financial_summary', generated_at: null, scope: agencyId === null ? 'authenticated_agency' : 'agency',
      agency_id: agencyId, timezone: 'UTC', date_from: `${period.dateFrom}T00:00:00Z`,
      date_to_exclusive: end.toISOString(), date_field: 'financial_record_date' },
    summary: { record_count: rows.length, currency_totals: Array.from(totals, ([currency, amount]) => ({ currency, amount })),
      unspecified_currency_count: unspecifiedCurrencyCount, categories: [...categories].sort(), undated_record_count: undatedRecordCount },
    rows,
  };
}

function isFinancialReport(value: unknown): value is FinancialSummaryReport {
  return isObject(value) && isObject(value.metadata) && value.metadata.report === 'financial_summary' &&
    value.metadata.timezone === 'UTC' &&
    ((value.metadata.scope === 'agency' && isId(value.metadata.agency_id)) ||
      (value.metadata.scope === 'authenticated_agency' && value.metadata.agency_id === null)) &&
    isObject(value.summary) && fieldsMatch(value.summary, ['record_count', 'unspecified_currency_count', 'undated_record_count'], isCount) &&
    Array.isArray(value.summary.categories) && value.summary.categories.every((category) => typeof category === 'string') &&
    Array.isArray(value.summary.currency_totals) && value.summary.currency_totals.every((total) =>
      isObject(total) && typeof total.currency === 'string' && isObject(total.amount) &&
      typeof total.amount.coefficient === 'bigint' && isCount(total.amount.scale)) &&
    Array.isArray(value.rows) && value.summary.record_count === value.rows.length &&
    value.rows.every((row) => isFinancialRecord(row) && isObject(row) && typeof row.report_date === 'string');
}

function financialSummaryLines({ summary }: FinancialSummaryReport): string[] {
  return [`Financial Records: ${displayCount(summary.record_count)}`,
    ...summary.currency_totals.map(({ currency, amount }) => `${currency}: ${displayAmount(amount)}`),
    ...(summary.categories.length ? [`Categories: ${summary.categories.join(', ')}`] : []),
    ...(summary.unspecified_currency_count ? [`Currency not provided: ${displayCount(summary.unspecified_currency_count)} records (excluded from currency totals).`] : []),
    ...(summary.undated_record_count ? [`${displayCount(summary.undated_record_count)} returned records omitted because no usable record date was provided.`] : [])];
}

function financialColumns(report: FinancialSummaryReport): string[] {
  return ['Date', 'Applicant', ...(report.rows.some((row) => row.category?.trim()) ? ['Category'] : []),
    ...(report.rows.some((row) => row.description?.trim()) ? ['Description'] : []),
    ...(report.rows.some((row) => row.payment_type?.trim()) ? ['Payment Type'] : []),
    ...(report.rows.some((row) => row.transaction_type?.trim()) ? ['Transaction Type'] : []),
    'Amount', 'Currency', ...(report.rows.some((row) => row.recorded_by_name?.trim() || row.recorded_by != null) ? ['Recorded By'] : [])];
}

const financialDefinition: ReportDefinition<FinancialSummaryReport> = {
  name: 'financial_summary', endpoint: '/financial/records', load: loadFinancialReport,
  title: 'Financial Summary', description: 'Financial records for the selected period, with recorded amounts grouped by currency.',
  icon: Receipt, dateField: 'financial_record_date', filename: 'financial-summary',
  emptyMessage: 'No dated financial records for this date range.', validate: isFinancialReport,
  summaryText: financialSummaryLines,
  pdfSummary: (report) => [...financialSummaryLines(report), 'Recorded amounts only; no currency conversion or balance calculation.'],
  columns: financialColumns,
  tableRows: (report) => {
    const columns = financialColumns(report);
    return report.rows.map((row) => columns.map((column) => {
      switch (column) {
        case 'Date': return row.report_date;
        case 'Applicant': return [row.applicant?.first_name, row.applicant?.last_name].filter(Boolean).join(' ').trim() || `Applicant ID: ${row.applicant_id}`;
        case 'Category': return displayText(row.category ?? null);
        case 'Description': return displayText(row.description ?? null);
        case 'Payment Type': return displayText(row.payment_type ?? null);
        case 'Transaction Type': return displayText(row.transaction_type ?? null);
        case 'Amount': return displayAmount(decimalAmount(row.amount));
        case 'Currency': return row.currency?.trim() || 'Not provided';
        case 'Recorded By': return row.recorded_by_name?.trim() || (row.recorded_by == null ? '—' : `User ID: ${row.recorded_by}`);
        default: throw new Error('Unknown financial column');
      }
    }));
  },
};

const monthlyDefinition: ReportDefinition<MonthlyDeploymentReport> = {
  name: 'monthly_deployments', endpoint: '/reports/monthly-deployments',
  title: 'Monthly Deployment Report', description: 'Confirmed deployments recorded during the selected month.',
  icon: FileText, dateField: 'job_application.actual_deployment_at', filename: 'monthly-deployments',
  emptyMessage: 'No confirmed deployments for this month.', validate: isMonthlyReport,
  summaryText: ({ summary }) => [`${displayCount(summary.total_deployments)} confirmed deployments`],
  pdfSummary: ({ summary }) => [`Total Confirmed Deployments: ${displayCount(summary.total_deployments)}`],
  columns: ['Applicant Code', 'Applicant Name', 'Position', 'Employer', 'Destination', 'Job Order', 'Actual Deployment Date', 'Status'],
  tableRows: ({ rows }) => rows.map((row) => [displayText(row.applicant_code), displayText(row.applicant_name),
    displayText(row.position), displayText(row.employer_name), displayText(row.country_name),
    displayText(row.job_order_code), displayTimestamp(row.actual_deployment_at, true), displayText(row.status_code)]),
};

const staffDefinition: ReportDefinition<StaffPerformanceReport> = {
  name: 'staff_performance', endpoint: '/reports/staff-performance',
  title: 'Staff Performance Analysis', description: 'Recorded operational activity by staff during the selected period.',
  icon: Users, dateField: 'audit_log.occurred_at', filename: 'staff-performance',
  emptyMessage: 'No staff operational activity for this date range.', validate: isStaffReport,
  summaryText: ({ summary }) => [`${displayCount(summary.staff_actor_count)} staff actors • ${displayCount(summary.logged_operational_actions)} logged actions • ${displayCount(summary.unique_applicants_touched)} applicants touched`],
  pdfSummary: ({ summary }) => [`Staff Actors: ${displayCount(summary.staff_actor_count)}`,
    `Logged Operational Actions: ${displayCount(summary.logged_operational_actions)}`,
    `Unique Applicants Touched: ${displayCount(summary.unique_applicants_touched)}`],
  columns: ['Staff Name', 'Role', 'Logged Operational Actions', 'Applicants Touched', 'First Activity', 'Last Activity', 'Modules', 'Actions'],
  tableRows: ({ rows }) => rows.map((row) => [displayText(row.actor_name),
    row.roles.length ? row.roles.join(', ') : displayText(row.actor_role),
    displayCount(row.logged_operational_actions), displayCount(row.unique_applicants_touched),
    displayTimestamp(row.first_activity_at), displayTimestamp(row.last_activity_at),
    displayCountMap(row.modules), displayCountMap(row.actions)]),
};

const workflowDefinition: ReportDefinition<WorkflowEfficiencyReport> = {
  name: 'workflow_efficiency', endpoint: '/reports/workflow-efficiency',
  title: 'Workflow Efficiency Report', description: 'Measured durations for workflow attempts completed during the selected period.',
  icon: TrendingUp, dateField: 'stage_attempt.completed_at', filename: 'workflow-efficiency',
  emptyMessage: 'No completed workflow attempts for this date range.', validate: isWorkflowReport,
  summaryText: ({ summary }) => [
    `${displayCount(summary.stage_count)} stages with completed attempts • ${displayCount(summary.completed_attempt_count)} completed attempts`,
    summary.average_total_actual_days === null ? 'No measured duration available' :
      `${displayDays(summary.average_total_actual_days)} days average total duration • ${displayCount(summary.total_duration_sample_count)} measured samples`,
  ],
  pdfSummary: ({ summary }) => [
    `Stages: ${displayCount(summary.stage_count)} | Completed Attempts: ${displayCount(summary.completed_attempt_count)}`,
    `Measured Samples - Base: ${displayCount(summary.base_duration_sample_count)} | Penalty: ${displayCount(summary.penalty_duration_sample_count)} | Total: ${displayCount(summary.total_duration_sample_count)}`,
    `Average Days - Base: ${displayDays(summary.average_base_actual_days)} | Penalty: ${displayDays(summary.average_actual_penalty_days)} | Total: ${displayDays(summary.average_total_actual_days)}`,
    `Total Days - Minimum: ${displayDays(summary.min_total_actual_days)} | Maximum: ${displayDays(summary.max_total_actual_days)}`,
    'Unavailable durations are shown as —; averages use measured samples only.',
  ],
  columns: ['Stage', 'Completed Attempts', 'Avg Base Days', 'Avg Penalty Days', 'Avg Total Days', 'Min Total Days', 'Max Total Days'],
  tableRows: ({ rows }) => rows.map((row) => [displayText(row.stage_name), displayCount(row.completed_attempt_count),
    displayDays(row.average_base_actual_days), displayDays(row.average_actual_penalty_days),
    displayDays(row.average_total_actual_days), displayDays(row.min_total_actual_days), displayDays(row.max_total_actual_days)]),
};

function initialPeriod(monthly: boolean): ReportPeriod {
  const now = new Date();
  const month = `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return monthly ? { month } : { dateFrom: `${month}-01`, dateTo: `${month}-${String(now.getDate()).padStart(2, '0')}` };
}

function periodError(period: ReportPeriod): string | null {
  if ('month' in period) {
    const [year, month] = period.month.split('-').map(Number);
    return /^\d{4}-\d{2}$/.test(period.month) && year >= 1 && year <= 9998 && month >= 1 && month <= 12
      ? null : 'Select a valid reporting month.';
  }
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '0001-01-01' &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!validDate(period.dateFrom) || !validDate(period.dateTo)) return 'Select valid From and To dates.';
  if (period.dateFrom > period.dateTo) return 'From date must be on or before To date.';
  if (period.dateTo >= '9999-12-31') return 'To date must be before 9999-12-31.';
  return null;
}

function periodParams(period: ReportPeriod): { year: number; month: number } | { dateFrom: string; dateTo: string } {
  if ('month' in period) {
    const [year, month] = period.month.split('-').map(Number);
    return { year, month };
  }
  return { dateFrom: period.dateFrom, dateTo: period.dateTo };
}

function matchesPeriod(report: ReportResponse, period: ReportPeriod, dateField: string): boolean {
  const start = new Date(`${'month' in period ? `${period.month}-01` : period.dateFrom}T00:00:00Z`);
  const end = new Date(`${'month' in period ? `${period.month}-01` : period.dateTo}T00:00:00Z`);
  if ('month' in period) {
    const [year, month] = period.month.split('-').map(Number);
    if (!isObject(report.summary) || report.summary.year !== year || report.summary.month !== month) return false;
    end.setUTCMonth(end.getUTCMonth() + 1);
  } else end.setUTCDate(end.getUTCDate() + 1);
  return report.metadata.date_field === dateField && report.metadata.date_from !== null &&
    report.metadata.date_to_exclusive !== null && Date.parse(report.metadata.date_from) === start.getTime() &&
    Date.parse(report.metadata.date_to_exclusive) === end.getTime();
}

const periodLabel = (period: ReportPeriod) => 'month' in period ? period.month : `${period.dateFrom} to ${period.dateTo}`;
const periodFilename = (period: ReportPeriod) => 'month' in period ? period.month : `${period.dateFrom}-to-${period.dateTo}`;

function downloadReport<T extends ReportResponse>(definition: ReportDefinition<T>, report: T, period: ReportPeriod) {
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  let y = 16;
  const write = (text: string, size = 10, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines: string[] = doc.splitTextToSize(text, width - 28);
    for (const line of lines) {
      if (y + size * 0.45 > doc.internal.pageSize.getHeight() - 25) {
        doc.addPage();
        y = 16;
      }
      doc.text(line, 14, y);
      y += size * 0.45;
    }
    y += 3;
  };
  doc.setTextColor(14, 165, 233);
  write('FlowSensus', 14, true);
  doc.setTextColor(15, 23, 42);
  write(definition.title, 18, true);
  write(`Reporting Period: ${periodLabel(period)} (${report.metadata.timezone})`);
  const generatedAt = report.metadata.generated_at ?? new Date().toISOString();
  write(`Generated: ${displayTimestamp(generatedAt)} UTC${report.metadata.generated_at ? '' : ' (download time)'}`);
  write(report.metadata.scope === 'all_agencies' ? 'Scope: All agencies' :
    report.metadata.scope === 'authenticated_agency' ? 'Scope: Authenticated agency' : `Scope: Agency ${report.metadata.agency_id}`);
  write('Summary', 11, true);
  definition.pdfSummary(report).forEach((line) => write(line));

  const allAgencies = report.metadata.scope === 'all_agencies';
  const columns = typeof definition.columns === 'function' ? definition.columns(report) : definition.columns;
  const rows = definition.tableRows(report);
  autoTable(doc, {
    startY: y + 2,
    head: [allAgencies ? ['Agency', ...columns] : columns],
    body: allAgencies ? rows.map((row, index) => [String(report.rows[index].agency_id), ...row]) : rows,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42] },
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    margin: { top: 14, right: 14, bottom: 18, left: 14 },
    showHead: 'everyPage',
  });

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const footerY = doc.internal.pageSize.getHeight() - 8;
    doc.text('FlowSensus | All dates and times in UTC', 14, footerY);
    doc.text(`Page ${page} of ${totalPages}`, width - 14, footerY, { align: 'right' });
  }
  doc.save(`flowsensus-${definition.filename}-${periodFilename(period)}.pdf`);
}

interface ReportState<T> {
  periodKey: string;
  loading: boolean;
  generating: boolean;
  error: string | null;
  data: T | null;
}

function ReportCard<T extends ReportResponse>({ definition }: { definition: ReportDefinition<T> }) {
  const [period, setPeriod] = useState<ReportPeriod>(() => initialPeriod(definition.name === 'monthly_deployments'));
  const key = JSON.stringify(period);
  const invalidPeriod = periodError(period);
  const [state, setState] = useState<ReportState<T>>({ periodKey: key, loading: true, generating: false, error: null, data: null });
  const requestSequence = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);

  const loadReport = useCallback(async (generatePdf = false) => {
    activeRequest.current?.abort();
    const sequence = ++requestSequence.current;
    const controller = new AbortController();
    activeRequest.current = controller;
    const periodKey = JSON.stringify(period);
    const invalid = periodError(period);
    setState({ periodKey, loading: !invalid, generating: generatePdf && !invalid, error: invalid, data: null });
    if (invalid) return;
    const isCurrent = () => sequence === requestSequence.current && !controller.signal.aborted;
    let errorMessage = 'Could not load this report. Please try Generate Report again.';
    try {
      const data = definition.load ? await definition.load(period, controller.signal) :
        (await api.get<unknown>(definition.endpoint, { params: periodParams(period), signal: controller.signal })).data;
      if (!isCurrent()) return;
      if (!definition.validate(data) || !matchesPeriod(data, period, definition.dateField)) {
        throw new Error('Invalid report response');
      }
      if (generatePdf && data.rows.length > 0) {
        errorMessage = 'Could not generate the PDF. Please try Generate Report again.';
        downloadReport(definition, data, period);
      }
      if (isCurrent()) setState({ periodKey, loading: false, generating: false, error: null, data });
    } catch {
      if (isCurrent()) setState({ periodKey, loading: false, generating: false, error: errorMessage, data: null });
    }
  }, [definition, period]);

  useEffect(() => {
    void loadReport();
    return () => {
      ++requestSequence.current;
      activeRequest.current?.abort();
    };
  }, [loadReport]);

  // Hide previous-period results immediately, before the fetching effect runs.
  const current = state.periodKey === key ? state : { loading: true, generating: false, error: null, data: null };
  const error = invalidPeriod ?? current.error;
  const Icon = definition.icon;
  const inputClass = 'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] disabled:opacity-50';

  return (
    <section aria-labelledby={`${definition.name}-title`} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg bg-[#0EA5E9]/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-6 h-6 text-[#0EA5E9]" />
        </div>
        <div>
          <h3 id={`${definition.name}-title`} className="font-bold text-[#0F172A] mb-1">{definition.title}</h3>
          <p className="text-sm text-[#64748B]">{definition.description}</p>
        </div>
      </div>

      {'month' in period ? (
        <label className="block text-xs font-bold text-[#64748B]">
          Reporting month
          <input type="month" required min="0001-01" max="9998-12" value={period.month} disabled={current.generating}
            onChange={(event) => setPeriod({ month: event.target.value })} className={`${inputClass} mt-1`} />
        </label>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-xs font-bold text-[#64748B]">
            From date
            <input type="date" required min="0001-01-01" max={period.dateTo || '9999-12-30'} value={period.dateFrom} disabled={current.generating}
              onChange={(event) => setPeriod({ ...period, dateFrom: event.target.value })} className={`${inputClass} mt-1`} />
          </label>
          <label className="block text-xs font-bold text-[#64748B]">
            To date
            <input type="date" required min={period.dateFrom || '0001-01-01'} max="9999-12-30" value={period.dateTo} disabled={current.generating}
              onChange={(event) => setPeriod({ ...period, dateTo: event.target.value })} className={`${inputClass} mt-1`} />
          </label>
        </div>
      )}
      <p className="text-xs text-[#64748B]">{'month' in period ? 'Reporting month uses UTC.' : 'Reporting dates use UTC. Both From and To dates are included.'}</p>

      <div aria-live="polite" aria-busy={current.loading || current.generating} className="text-sm min-h-12">
        {error ? <p role="alert" className="text-red-600">{error}</p> : current.loading ? (
          <p className="text-[#64748B] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />
            {current.generating ? 'Fetching fresh report for PDF…' : 'Loading report summary…'}
          </p>
        ) : current.data && (
          <>
            {definition.summaryText(current.data).map((line) => <p key={line} className="text-xs font-bold text-[#0EA5E9] mb-1">{line}</p>)}
            {current.data.rows.length === 0 && (
              <div className="mt-2 text-[#64748B]">
                <p className="font-medium">No data for selected period</p>
                <p className="text-xs mt-1">{definition.emptyMessage}</p>
              </div>
            )}
          </>
        )}
      </div>

      <button type="button" onClick={() => void loadReport(true)} disabled={current.generating || Boolean(invalidPeriod)}
        className="mt-auto self-start px-4 py-2 bg-[#0EA5E9] text-white text-sm font-bold rounded-lg hover:bg-[#0284C7] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
        {current.generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {current.generating ? 'Generating PDF…' : 'Generate Report'}
      </button>
    </section>
  );
}

export default function OperationalReports() {
  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold tracking-tight text-[#0F172A]">Operational Reports</h2>
        <p className="text-sm text-[#64748B] mt-1 font-medium">Generate and download operational reports for your selected period.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ReportCard definition={monthlyDefinition} />
        <ReportCard definition={staffDefinition} />
        <ReportCard definition={financialDefinition} />
        <ReportCard definition={workflowDefinition} />
      </div>
    </div>
  );
}
