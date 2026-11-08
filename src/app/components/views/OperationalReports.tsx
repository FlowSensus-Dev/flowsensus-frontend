import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileText, Loader2, Receipt, TrendingUp, Users } from 'lucide-react';
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
  metadata: ReportMetadata & { deployment_as_of: string };
  summary: { year: number; month: number; total_deployments: number };
  rows: DeploymentRow[];
  filters: { country_id: number | null; employer_id: number | null; position: string | null; search: string | null };
  pagination: { page: number; page_size: number; total: number; total_pages: number } | null;
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

interface ReportPdfContext {
  agency: { agency_id: number; agency_name: string } | null;
  staffDirectory?: unknown[];
}
type ReportPdfContextRef = { current: ReportPdfContext };

type ReportPeriod = { month: string; dateFrom?: string; dateTo?: string } | { dateFrom: string; dateTo: string };
interface SharedReportingPeriod { month: string; dateFrom: string; dateTo: string }

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
  tableRows: (report: T, context?: ReportPdfContext) => string[][];
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
  if (!isEnvelope(value, 'monthly_deployments') || !isObject(value)) return false;
  const raw = value as Record<string, unknown>;
  const meta = value.metadata as ReportMetadata & { deployment_as_of?: unknown };
  const pagination = raw.pagination;
  const filters = raw.filters;
  return value.metadata.scope === 'agency' && isTimestamp(value.metadata.generated_at) &&
    isObject(value.metadata) && isTimestamp(meta.deployment_as_of) &&
    Date.parse(meta.deployment_as_of) === Date.parse(value.metadata.generated_at) &&
    isObject(filters) && fieldsMatch(filters, ['country_id', 'employer_id'], isNullableId) &&
    fieldsMatch(filters, ['position', 'search'], isNullableText) &&
    fieldsMatch(value.summary, ['year', 'month', 'total_deployments'], isCount) &&
    typeof value.summary.year === 'number' && value.summary.year >= 1 && value.summary.year <= 9998 &&
    typeof value.summary.month === 'number' && value.summary.month >= 1 && value.summary.month <= 12 &&
    (pagination === null ? value.summary.total_deployments === value.rows.length :
      isObject(pagination) && isId(pagination.page) && isId(pagination.page_size) && pagination.page_size <= 100 &&
      isCount(pagination.total) && pagination.total === value.summary.total_deployments &&
      pagination.total_pages === Math.ceil(pagination.total / pagination.page_size) &&
      value.rows.length === Math.min(pagination.page_size, Math.max(0, pagination.total - (pagination.page - 1) * pagination.page_size))) &&
    new Set(value.rows.map((row) => isObject(row) ? row.application_id : null)).size === value.rows.length &&
    value.rows.every((row) => isObject(row) &&
      fieldsMatch(row, ['application_id', 'applicant_id'], isId) &&
      fieldsMatch(row, ['job_order_id', 'employer_id', 'country_id', 'current_stage_id'], isNullableId) &&
      (row.current_phase === null || isCount(row.current_phase)) &&
      fieldsMatch(row, ['applicant_name', 'applicant_code', 'job_order_code', 'employer_name',
        'country_name', 'position', 'status_code'], isNullableText) && isTimestamp(row.actual_deployment_at) &&
      row.status_code === 'Deployed' && row.current_phase === 6 &&
      Date.parse(row.actual_deployment_at) >= Date.parse(value.metadata.date_from ?? '') &&
      Date.parse(row.actual_deployment_at) < Date.parse(value.metadata.date_to_exclusive ?? '') &&
      Date.parse(row.actual_deployment_at) <= Date.parse(meta.deployment_as_of as string));
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
const auditActionLabels: Readonly<Record<string, string>> = Object.freeze({
  MEDICAL_CLEARANCE_APPROVED: 'Medical clearance approved',
  ENDORSED_TO_PROFILING: 'Endorsed to profiling',
  STAFF_ROLES_UPDATED: 'Staff roles updated',
  APPLICANT_STATUS_UPDATED: 'Applicant status updated',
});

function auditActionLabel(code: string): string {
  if (Object.prototype.hasOwnProperty.call(auditActionLabels, code)) return auditActionLabels[code];
  if (!/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(code)) return 'Other recorded action';
  const acronyms = ['CV', 'OCR', 'PDF', 'SES', 'PERT', 'ID'];
  return code.split('_').map((word, index) => acronyms.includes(word) ? word :
    index === 0 ? word[0] + word.slice(1).toLowerCase() : word.toLowerCase()).join(' ');
}

function staffRoles(row: StaffActivityRow): string {
  const values = row.roles.length ? row.roles : [row.actor_role || ''];
  const roles = new Map<string, string>();
  const knownRoles = ['Recruitment', 'Admin', 'Accounting', 'Management', 'Super Admin'];
  for (const value of values) {
    // Preserve the established compound role alias before splitting recorded lists.
    const parts = value.trim().toLowerCase() === 'finance & accounting' ? ['Accounting'] : value.split(/\s*(?:,|;|\|| & )\s*/);
    for (const part of parts) {
      const label = part.trim();
      if (label) roles.set(label.toLowerCase(), knownRoles.find((role) => role.toLowerCase() === label.toLowerCase()) || label);
    }
  }
  return [...roles.values()].join(', ') || 'Not provided';
}

// Standard PDF fonts cannot represent every Unicode/control character. Escape unknown
// code points rather than dropping them or producing unreadable glyphs.
function literalAuditCode(value: string): string {
  return Array.from(value).map((character) => {
    const code = character.codePointAt(0)!;
    return code >= 32 && code <= 126 ? character :
      code <= 0xffff ? `\\u${code.toString(16).padStart(4, '0')}` : `\\u{${code.toString(16)}}`;
  }).join('') || '""';
}

function financialRecorder(row: FinancialRecord, report: FinancialSummaryReport, context?: ReportPdfContext): string {
  const id = row.recorded_by;
  const identifier = id == null ? '' : `User ID: ${id}`;
  let name = row.recorded_by_name?.trim();
  const agencyId = row.agency_id ?? row.applicant?.agency_id ?? report.metadata.agency_id;
  if (!name && isId(id) && isId(agencyId) && agencyId === report.metadata.agency_id &&
      (!context?.agency || context.agency.agency_id === agencyId)) {
    const directory = Array.isArray(context?.staffDirectory) ? context.staffDirectory : [];
    const names = new Set(directory.flatMap((staff) => isObject(staff) &&
      staff.user_id === id && staff.agency_id === agencyId && staff.is_super_admin === false &&
      typeof staff.full_name === 'string' && staff.full_name.trim() ? [staff.full_name.trim()] : []));
    if (names.size === 1) name = [...names][0];
  }
  return name ? `${name}${identifier ? ` (${identifier})` : ''}` : identifier || 'Not provided';
}

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
  pdfSummary: (report) => [...financialSummaryLines(report), 'Recorded amounts only; no currency conversion or balance calculation.',
    'Recorder names use record data or current same-agency staff records where available; user IDs are retained.'],
  columns: financialColumns,
  tableRows: (report, context) => {
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
        case 'Recorded By': return financialRecorder(row, report, context);
        default: throw new Error('Unknown financial column');
      }
    }));
  },
};

const monthlyDefinition: ReportDefinition<MonthlyDeploymentReport> = {
  name: 'monthly_deployments', endpoint: '/reports/monthly-deployments',
  title: 'Monthly Deployment Report', description: 'Recorded deployed applications in the selected UTC period.',
  icon: FileText, dateField: 'job_application.actual_deployment_at', filename: 'monthly-deployments',
  emptyMessage: 'No recorded deployed applications match this period and filters.', validate: isMonthlyReport,
  summaryText: ({ summary }) => [`${displayCount(summary.total_deployments)} recorded deployments`],
  pdfSummary: ({ summary, metadata }) => [`Total Recorded Deployments: ${displayCount(summary.total_deployments)}`,
    'Applications recorded as Deployed in the selected period.',
    'Counts applications, not distinct applicants. Recorded state does not independently verify departure.',
    `Deployment cutoff: ${displayTimestamp(metadata.deployment_as_of)} UTC`],
  columns: ['Applicant', 'Applicant Code', 'Employer', 'Destination Country', 'Position', 'Recorded Deployment Date (UTC)', 'Status'],
  tableRows: ({ rows }) => rows.map((row) => [row.applicant_name, row.applicant_code, row.employer_name,
    row.country_name, row.position, displayTimestamp(row.actual_deployment_at), row.status_code]
    .map((value) => value?.trim() || 'Not available')),
};

const staffDefinition: ReportDefinition<StaffPerformanceReport> = {
  name: 'staff_performance', endpoint: '/reports/staff-performance',
  title: 'Staff Activity', description: 'Logged operational actions by staff during the selected period; no performance scores.',
  icon: Users, dateField: 'audit_log.occurred_at', filename: 'staff-activity',
  emptyMessage: 'No staff operational activity for this date range.', validate: isStaffReport,
  summaryText: ({ summary }) => [`${displayCount(summary.staff_actor_count)} staff actors • ${displayCount(summary.logged_operational_actions)} logged actions • ${displayCount(summary.unique_applicants_touched)} applicants touched`],
  pdfSummary: ({ summary }) => [`Staff Actors: ${displayCount(summary.staff_actor_count)} | Logged Operational Actions: ${displayCount(summary.logged_operational_actions)} | Unique Applicants Touched: ${displayCount(summary.unique_applicants_touched)}`,
    'Counts retained operational audit actions; no performance scores. Action and module breakdowns follow the staff summary.'],
  columns: ['Staff', 'Recorded Roles', 'Logged Actions', 'Applicants Touched', 'First Activity (UTC)', 'Last Activity (UTC)'],
  tableRows: ({ rows }) => rows.map((row) => [`${row.actor_name?.trim() || 'Name not provided'}\nUser ID: ${row.actor_user_id}`, staffRoles(row),
    displayCount(row.logged_operational_actions), displayCount(row.unique_applicants_touched),
    displayTimestamp(row.first_activity_at), displayTimestamp(row.last_activity_at)]),
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

function initialPeriod(): SharedReportingPeriod {
  const now = new Date();
  const month = `${String(now.getUTCFullYear()).padStart(4, '0')}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return { month, dateFrom: '', dateTo: '' };
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
    return { year, month, ...(period.dateFrom ? { dateFrom: period.dateFrom } : {}),
      ...(period.dateTo ? { dateTo: period.dateTo } : {}) };
  }
  return { dateFrom: period.dateFrom, dateTo: period.dateTo };
}

function matchesPeriod(report: ReportResponse, period: ReportPeriod, dateField: string): boolean {
  const start = new Date(`${'month' in period ? period.dateFrom || `${period.month}-01` : period.dateFrom}T00:00:00Z`);
  const end = new Date(`${'month' in period ? `${period.month}-01` : period.dateTo}T00:00:00Z`);
  if ('month' in period) {
    const [year, month] = period.month.split('-').map(Number);
    if (!isObject(report.summary) || report.summary.year !== year || report.summary.month !== month) return false;
    if (period.dateTo) {
      end.setTime(Date.parse(`${period.dateTo}T00:00:00Z`));
      end.setUTCDate(end.getUTCDate() + 1);
    } else end.setUTCMonth(end.getUTCMonth() + 1);
  } else end.setUTCDate(end.getUTCDate() + 1);
  return report.metadata.date_field === dateField && report.metadata.date_from !== null &&
    report.metadata.date_to_exclusive !== null && Date.parse(report.metadata.date_from) === start.getTime() &&
    Date.parse(report.metadata.date_to_exclusive) === end.getTime();
}

const periodLabel = (period: ReportPeriod) => 'month' in period ?
  `${period.month}${period.dateFrom || period.dateTo ? ` (inclusive ${period.dateFrom || `${period.month}-01`} to ${period.dateTo || 'month end'})` : ''}` :
  `${period.dateFrom} to ${period.dateTo}`;
const periodFilename = (period: ReportPeriod) => 'month' in period ? period.month : `${period.dateFrom}-to-${period.dateTo}`;

function pdfSafeText(value: string): string {
  return Array.from(value).map((character) => {
    const code = character.codePointAt(0)!;
    if (character === '\n' || (code >= 32 && code <= 126) || (code >= 160 && code <= 255)) return character;
    if (code >= 0x2010 && code <= 0x2015) return '-';
    return literalAuditCode(character);
  }).join('');
}

function wrapPdfText(doc: jsPDF, value: string, availableWidth: number): string[] {
  const lines = doc.splitTextToSize(pdfSafeText(value), availableWidth) as string[];
  // Explicitly bound even unbroken identifiers/escape sequences to the cell width.
  return lines.flatMap((line) => {
    if (doc.getTextWidth(line) <= availableWidth) return [line];
    const result: string[] = [];
    let chunk = '';
    let chunkWidth = 0;
    for (const character of line) {
      const characterWidth = doc.getTextWidth(character);
      if (chunk && chunkWidth + characterWidth > availableWidth) { result.push(chunk); chunk = ''; chunkWidth = 0; }
      chunk += character;
      chunkWidth += characterWidth;
    }
    return [...result, chunk];
  });
}

function downloadReport<T extends ReportResponse>(definition: ReportDefinition<T>, report: T, period: ReportPeriod,
  details: string[] = [], context?: ReportPdfContext) {
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = width - margin * 2;
  let y = 16;
  const ensureRoom = (space: number) => {
    if (y + space > height - 22) { doc.addPage(); y = 16; }
  };
  const write = (text: string, size = 9, bold = false, x = margin, availableWidth = contentWidth) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = wrapPdfText(doc, text, availableWidth);
    for (const line of lines) {
      ensureRoom(size * 0.45);
      doc.text(line, x, y);
      y += size * 0.45;
    }
    y += 2;
  };
  const leftWidth = contentWidth * 0.51;
  const rightX = margin + leftWidth + 10;
  const rightWidth = width - margin - rightX;
  doc.setTextColor(14, 165, 233);
  write('FLOWSENSUS', 13, true, margin, leftWidth);
  doc.setTextColor(15, 23, 42);
  write(definition.title, 17, true, margin, leftWidth);
  write(definition.description, 8.5, false, margin, leftWidth);
  const leftBottom = y;
  const headerPage = doc.getNumberOfPages();
  y = 16;
  const agency = context?.agency;
  const scope = report.metadata.scope === 'all_agencies' ? 'All agencies' :
    agency && (agency.agency_id === report.metadata.agency_id || report.metadata.scope === 'authenticated_agency') ?
      `${agency.agency_name} (Agency ${agency.agency_id})` :
      report.metadata.scope === 'authenticated_agency' ? 'Authenticated agency' : `Agency ${report.metadata.agency_id}`;
  write(`Scope: ${scope}`, 9.5, true, rightX, rightWidth);
  write(`Reporting Period: ${periodLabel(period)} (${report.metadata.timezone})`, 8.5, false, rightX, rightWidth);
  const generatedAt = report.metadata.generated_at ?? new Date().toISOString();
  write(`Generated: ${displayTimestamp(generatedAt)} UTC${report.metadata.generated_at ? '' : ' (download time)'}`, 8.5, false, rightX, rightWidth);
  y = Math.max(y, doc.getNumberOfPages() === headerPage ? leftBottom : 16) + 2;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(margin, y, width - margin, y);
  y += 6;
  write('Summary', 10, true);
  definition.pdfSummary(report).forEach((line, index) => write(line, index === 0 ? 9.5 : 8.5, index === 0));
  details.forEach((line) => write(line, 8.5));

  const drawTable = (title: string, columns: string[], rows: string[][], weights: number[]) => {
    ensureRoom(24);
    write(title, 10, true);
    const totalWeight = weights.reduce((total, weight) => total + weight, 0);
    const widths = weights.map((weight) => weight / totalWeight * contentWidth);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    autoTable(doc, {
      startY: y,
      head: [columns],
      body: rows.map((row) => row.map((cell, index) => wrapPdfText(doc, cell, widths[index] - 5).join('\n'))),
      tableWidth: contentWidth,
      columnStyles: Object.fromEntries(widths.map((cellWidth, index) => [index, { cellWidth }])),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], fontSize: 8, overflow: 'linebreak' },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.5, overflow: 'linebreak', valign: 'top' },
      margin: { top: margin, right: margin, bottom: 18, left: margin },
      showHead: 'everyPage', pageBreak: 'auto', rowPageBreak: 'auto',
    });
    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
    y += 6;
  };

  const allAgencies = report.metadata.scope === 'all_agencies';
  const columns = typeof definition.columns === 'function' ? definition.columns(report) : definition.columns;
  const rows = definition.tableRows(report, context);
  const weights = definition.name === 'monthly_deployments' ? [44, 30, 46, 28, 44, 45, 32] :
    definition.name === 'staff_performance' ? [55, 47, 32, 30, 52.5, 52.5] :
    columns.map((column) => column === 'Description' ? 60 : column === 'Recorded By' ? 48 : column === 'Applicant' ? 40 : 28);
  drawTable(definition.name === 'staff_performance' ? 'Staff activity summary' :
    definition.name === 'monthly_deployments' ? 'Recorded Deployed Applications' : 'Report details',
    allAgencies ? ['Agency', ...columns] : columns,
    allAgencies ? rows.map((row, index) => [String(report.rows[index].agency_id), ...row]) : rows,
    allAgencies ? [20, ...weights] : weights);

  if (definition.name === 'staff_performance' && isStaffReport(report)) {
    const staffReport = report as StaffPerformanceReport;
    ensureRoom(30);
    write('Action labels are for presentation. Recorded codes and counts are preserved; unsupported characters use Unicode escapes.', 8.5);
    const actor = (row: StaffActivityRow) => `${row.actor_name?.trim() || 'Name not provided'}\nUser ID: ${row.actor_user_id}`;
    const actions = staffReport.rows.flatMap((row) => Object.entries(row.actions).map(([code, count]) =>
      [actor(row), auditActionLabel(code), literalAuditCode(code), displayCount(count)]));
    if (actions.length) drawTable('Staff action breakdown', ['Staff', 'Action', 'Recorded action code', 'Count'], actions, [46, 60, 143, 20]);
    else write('No action breakdown was returned.', 8.5);
    const modules = staffReport.rows.flatMap((row) => Object.entries(row.modules).map(([module, count]) => [actor(row), literalAuditCode(module), displayCount(count)]));
    if (modules.length) drawTable('Staff module breakdown', ['Staff', 'Recorded module', 'Count'], modules, [55, 194, 20]);
    else write('No module breakdown was returned.', 8.5);
  }

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const footerY = height - 8;
    doc.line(margin, footerY - 4, width - margin, footerY - 4);
    doc.text('FlowSensus | All dates and times in UTC', margin, footerY);
    doc.text(`Page ${page} of ${totalPages}`, width - margin, footerY, { align: 'right' });
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

interface MonthlyFilters {
  search: string;
  position: string;
  countryId: string;
  employerId: string;
}

interface FilterOption { id: number; label: string; agencyId?: number }
interface ApplicantOption { id: number; name: string; code: string }
const reportInputClass = 'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] disabled:opacity-50';
const reportButtonClass = 'px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed';
const monthlyPageSize = 25;

function applicantOptions(value: unknown, agencyId: number): ApplicantOption[] {
  if (!Array.isArray(value) || !value.every((row) => isObject(row) && isId(row.applicant_id) &&
      row.agency_id === agencyId && fieldsMatch(row, ['first_name', 'middle_name', 'last_name', 'applicant_code'], optionalText))) {
    throw new Error('Invalid agency applicant directory');
  }
  const byId = new Map<number, ApplicantOption>();
  for (const row of value) {
    const code = row.applicant_code?.trim();
    if (!code || code.length > 100 || /[\u0000-\u001f\u007f]/.test(code)) continue;
    const name = [row.first_name, row.middle_name, row.last_name].filter((part) => part?.trim()).join(' ').trim() || 'Name not available';
    const previous = byId.get(row.applicant_id);
    if (previous && (previous.code !== code || previous.name !== name)) throw new Error('Conflicting applicant identity');
    byId.set(row.applicant_id, { id: row.applicant_id, name, code });
  }
  const codeCounts = new Map<string, number>();
  for (const row of byId.values()) codeCounts.set(row.code.toLowerCase(), (codeCounts.get(row.code.toLowerCase()) || 0) + 1);
  return [...byId.values()].filter((row) => codeCounts.get(row.code.toLowerCase()) === 1)
    .sort((left, right) => left.name.localeCompare(right.name) || left.code.localeCompare(right.code));
}

function monthBounds(month: string) {
  const end = new Date(`${month}-01T00:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);
  return { first: `${month}-01`, last: Number.isFinite(end.getTime()) ? end.toISOString().slice(0, 10) : '' };
}

function sharedPeriodError(period: SharedReportingPeriod): string | null {
  const invalidMonth = periodError(period);
  if (invalidMonth) return invalidMonth;
  const { first, last } = monthBounds(period.month);
  for (const date of [period.dateFrom, period.dateTo]) {
    if (date && (periodError({ dateFrom: date, dateTo: date }) || date < first || date > last)) {
      return 'Date narrowing must stay within the selected reporting month (UTC).';
    }
  }
  if (period.dateFrom && period.dateTo && period.dateFrom > period.dateTo) return 'From date must be on or before To date.';
  return null;
}

function sharedDateRange(period: SharedReportingPeriod): { dateFrom: string; dateTo: string } {
  const { first, last } = monthBounds(period.month);
  return { dateFrom: period.dateFrom || first, dateTo: period.dateTo || last };
}

function monthlyFilterError(filters: MonthlyFilters): string | null {
  if (filters.search.trim().length > 100 || filters.position.trim().length > 200 ||
      /[\u0000-\u001f\u007f]/.test(filters.search + filters.position)) return 'Use valid search (up to 100 characters) and position (up to 200 characters) without control characters.';
  if ([filters.countryId, filters.employerId].some((id) => id && !isId(Number(id)))) return 'Select a valid country or employer.';
  return null;
}

function monthlyParams(filters: MonthlyFilters, period: SharedReportingPeriod) {
  return { ...periodParams(period),
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.position ? { position: filters.position } : {}),
    ...(filters.countryId ? { countryId: Number(filters.countryId) } : {}),
    ...(filters.employerId ? { employerId: Number(filters.employerId) } : {}) };
}

function matchesMonthlyRequest(report: MonthlyDeploymentReport, filters: MonthlyFilters, period: SharedReportingPeriod, page?: number) {
  return matchesPeriod(report, period, monthlyDefinition.dateField) &&
    report.filters.country_id === (filters.countryId ? Number(filters.countryId) : null) &&
    report.filters.employer_id === (filters.employerId ? Number(filters.employerId) : null) &&
    report.filters.position === (filters.position || null) && report.filters.search === (filters.search || null) &&
    (page === undefined ? report.pagination === null :
      report.pagination?.page === page && report.pagination.page_size === monthlyPageSize);
}

function reportError(error: unknown, fallback: string) {
  return isObject(error) && isObject(error.response) && error.response.status === 403 ?
    'Access denied. Operational reports require verified Management access for your agency.' : fallback;
}

function MonthlyDeploymentCard({ period, visible, pdfContext }: { period: SharedReportingPeriod; visible: boolean; pdfContext: ReportPdfContextRef }) {
  const [draft, setDraft] = useState<MonthlyFilters>(() => ({
    search: '', position: '', countryId: '', employerId: '',
  }));
  const [query, setQuery] = useState(() => ({ filters: draft, page: 1, revision: 0 }));
  const { filters, page } = query;
  const key = JSON.stringify(query);
  const [state, setState] = useState<{ key: string; loading: boolean; error: string | null; data: MonthlyDeploymentReport | null }>(
    { key, loading: true, error: null, data: null });
  const [exportState, setExportState] = useState<{ loading: boolean; message: string | null; error: string | null }>({ loading: false, message: null, error: null });
  const [options, setOptions] = useState<{ countries: FilterOption[]; employers: FilterOption[]; notices: string[] }>(
    { countries: [], employers: [], notices: [] });
  const [reportAgencyId, setReportAgencyId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [chosenApplicant, setChosenApplicant] = useState<ApplicantOption | null>(null);
  const [picker, setPicker] = useState<{ loading: boolean; error: string | null; items: ApplicantOption[] | null }>({ loading: false, error: null, items: null });
  const pickerRequest = useRef<AbortController | null>(null);
  const pickerTrigger = useRef<HTMLButtonElement | null>(null);
  const requestSequence = useRef(0);
  const exportRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const sequence = ++requestSequence.current;
    setState({ key, loading: true, error: null, data: null });
    void (async () => {
      try {
        const { data } = await api.get<unknown>(monthlyDefinition.endpoint, {
          params: { ...monthlyParams(filters, period), page, pageSize: monthlyPageSize }, signal: controller.signal,
        });
        if (controller.signal.aborted || sequence !== requestSequence.current) return;
        if (!isMonthlyReport(data) || !matchesMonthlyRequest(data, filters, period, page)) throw new Error('Invalid response');
        setReportAgencyId(data.metadata.agency_id);
        setState({ key, loading: false, error: null, data });
      } catch (error) {
        if (!controller.signal.aborted && sequence === requestSequence.current) setState({ key, loading: false,
          error: reportError(error, 'Could not load the deployment report or validate its response. Try Refresh report.'), data: null });
      }
    })();
    return () => { controller.abort(); ++requestSequence.current; };
  }, [filters, page, query.revision, period]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const results = await Promise.allSettled([
        api.get<unknown>('/lookups/countries', { signal: controller.signal }),
        api.get<unknown>('/employers', { signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      const notices: string[] = [];
      const lists = results.map((result, index): FilterOption[] => {
        const name = index === 0 ? 'Country' : 'Employer';
        const data = result.status === 'fulfilled' ? result.value.data : null;
        if (!Array.isArray(data) || !data.every((item) => isObject(item) &&
          isId(item[index === 0 ? 'country_id' : 'employer_id']) &&
          typeof item[index === 0 ? 'country_name' : 'company_name'] === 'string' &&
          (item[index === 0 ? 'country_name' : 'company_name'] as string).trim() &&
          (index === 0 || isId(item.agency_id)))) {
          notices.push(`${name} filter options could not be loaded. Other filters remain available.`);
          return [];
        }
        return data.map((item) => ({ id: item[index === 0 ? 'country_id' : 'employer_id'],
          label: item[index === 0 ? 'country_name' : 'company_name'], ...(index === 1 ? { agencyId: item.agency_id } : {}) }))
          .sort((left, right) => left.label.localeCompare(right.label));
      });
      setOptions({ countries: lists[0], employers: lists[1], notices });
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => () => { exportRequest.current?.abort(); }, [key]);
  useEffect(() => () => { pickerRequest.current?.abort(); }, []);
  useEffect(() => { if (!visible) setPickerOpen(false); }, [visible]);

  const loadApplicants = async () => {
    if (!isId(reportAgencyId) || pickerRequest.current) return;
    const controller = new AbortController();
    pickerRequest.current = controller;
    setPicker({ loading: true, error: null, items: null });
    try {
      const { data } = await api.get<unknown>('/applicants', { signal: controller.signal });
      if (controller.signal.aborted) return;
      setPicker({ loading: false, error: null, items: applicantOptions(data, reportAgencyId) });
    } catch {
      if (!controller.signal.aborted) setPicker({ loading: false, error: 'Could not load applicant options. You can still type a name or code.', items: null });
    } finally {
      if (pickerRequest.current === controller) pickerRequest.current = null;
    }
  };
  const closePicker = () => { setPickerOpen(false); pickerTrigger.current?.focus({ preventScroll: true }); };
  const availableApplicants = (picker.items || []).filter((row) =>
    row.name.toLowerCase().includes(pickerQuery.trim().toLowerCase()) || row.code.toLowerCase().includes(pickerQuery.trim().toLowerCase()));

  const current = state.key === key ? state : { loading: true, error: null, data: null };
  const report = current.data;
  // Keep verified option context usable while replacing rows or recovering from a failed read.
  const employers = options.employers.filter((option) => option.agencyId === reportAgencyId);
  const invalid = monthlyFilterError(draft);
  const pending = JSON.stringify(draft) !== JSON.stringify(filters);
  const activeFilters = [
    ...(filters.search ? [`Applicant contains: ${filters.search}`] : []),
    ...(filters.position ? [`Position (exact): ${filters.position}`] : []),
    ...(filters.countryId ? [`Country: ${options.countries.find((option) => String(option.id) === filters.countryId)?.label || 'Selected country'}`] : []),
    ...(filters.employerId ? [`Employer: ${options.employers.find((option) => String(option.id) === filters.employerId)?.label || 'Selected employer'}`] : []),
  ];

  const exportPdf = async () => {
    if (exportRequest.current || current.loading || !report) return;
    const controller = new AbortController();
    exportRequest.current = controller;
    setExportState({ loading: true, message: null, error: null });
    try {
      // A complete, fresh response is required. Never export the current table page.
      const { data } = await api.get<unknown>(monthlyDefinition.endpoint, { params: monthlyParams(filters, period), signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!isMonthlyReport(data) || !matchesMonthlyRequest(data, filters, period)) throw new Error('Invalid complete response');
      if (!data.rows.length) {
        setExportState({ loading: false, message: 'No matching recorded deployments to export. No PDF was generated.', error: null });
        return;
      }
      downloadReport(monthlyDefinition, data, period, [
        `Applied filters: ${activeFilters.join(' | ') || 'None'}`,
      ], pdfContext.current);
      setExportState({ loading: false, message: `PDF generated with ${displayCount(data.summary.total_deployments)} recorded deployed applications.`, error: null });
    } catch (error) {
      if (!controller.signal.aborted) setExportState({ loading: false, message: null,
        error: reportError(error, 'Could not generate the PDF or validate its complete response. Please try Export PDF again.') });
    } finally {
      if (exportRequest.current === controller) exportRequest.current = null;
    }
  };

  // Keep the loaded page and filters when the user switches reports.
  if (!visible) return null;

  return (
    <section aria-labelledby="monthly_deployments-title" className="min-w-0 p-4 sm:p-6 space-y-5">
      <header className="flex flex-wrap justify-between items-start gap-4">
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-lg bg-sky-50"><FileText className="w-6 h-6 text-[#0EA5E9]" /></div>
          <div>
            <h3 id="monthly_deployments-title" className="font-bold text-[#0F172A]">Monthly Deployment Report</h3>
            <p className="text-sm text-slate-500">Inspect recorded deployed applications and export the filtered report.</p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" className={reportButtonClass} disabled={current.loading || exportState.loading}
            onClick={() => { setExportState({ loading: false, message: null, error: null }); setQuery({ ...query, revision: query.revision + 1 }); }}>Refresh report</button>
          <button type="button" onClick={() => void exportPdf()} disabled={current.loading || exportState.loading || !report}
            className="px-4 py-2 bg-[#0EA5E9] text-white text-sm font-bold rounded-lg hover:bg-[#0284C7] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {exportState.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exportState.loading ? 'Exporting PDF…' : 'Export PDF'}
          </button>
        </div>
      </header>

      <form aria-label="Monthly deployment filters" noValidate onSubmit={(event) => {
        event.preventDefault();
        if (invalid || exportRequest.current) return;
        const applied = { ...draft, search: draft.search.trim(), position: draft.position.trim() };
        setDraft(applied);
        setQuery({ filters: applied, page: 1, revision: query.revision + 1 });
        setExportState({ loading: false, message: null, error: null });
      }} className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="min-w-0">
            <div className="flex items-end gap-2">
              <label className="min-w-0 flex-1 text-xs font-bold text-slate-600">Applicant name or code
                <input type="search" maxLength={100} value={draft.search} placeholder="Contains name or code" className={`${reportInputClass} mt-1`}
                  onChange={(event) => { setDraft({ ...draft, search: event.target.value }); setChosenApplicant(null); }} />
              </label>
              <button ref={pickerTrigger} type="button" aria-expanded={pickerOpen} aria-controls="deployment-applicant-picker"
                disabled={!reportAgencyId || Boolean(current.error)} className={`${reportButtonClass} px-2 text-xs flex items-center gap-1`}
                onClick={() => { setPickerOpen(!pickerOpen); if (!pickerOpen && picker.items === null) void loadApplicants(); }}>
                Choose Applicant<ChevronDown aria-hidden="true" className="w-3 h-3 shrink-0" />
              </button>
            </div>
            {chosenApplicant && <div className="text-xs text-slate-600 mt-2">
              <p>{`Chosen: ${chosenApplicant.name} (${chosenApplicant.code})`}</p>
              <button type="button" className="text-sky-700 font-semibold underline mt-1" onClick={() => { setChosenApplicant(null); setDraft({ ...draft, search: '' }); }}>Clear applicant</button>
            </div>}
            {pickerOpen && <div id="deployment-applicant-picker" role="group" aria-label="Agency applicant picker" className="mt-2 bg-white border border-slate-200 rounded-lg p-3 space-y-2"
              onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); closePicker(); } }}>
              <label className="block text-xs font-semibold text-slate-600">Find applicant
                <input type="search" autoFocus value={pickerQuery} className={`${reportInputClass} mt-1`} placeholder="Filter available names or codes"
                  onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault(); }}
                  onChange={(event) => setPickerQuery(event.target.value)} />
              </label>
              <p className="text-xs text-slate-500">Available agency applicants with usable codes. Historical or unavailable applicants may be missing. Choosing fills a code search; results still use substring matching.</p>
              {picker.loading ? <p role="status" className="text-xs text-slate-500">Loading applicant options…</p> : picker.error ? <>
                <p role="alert" className="text-xs text-red-600">{picker.error}</p>
                <button type="button" className="text-xs text-sky-700 font-semibold" onClick={() => void loadApplicants()}>Retry applicant options</button>
              </> : <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                {availableApplicants.map((applicant) => <li key={applicant.id}>
                  <button type="button" aria-label={`Choose ${applicant.name} (${applicant.code})`} className="w-full text-left px-2 py-2 text-xs hover:bg-sky-50 focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
                    onClick={() => { setChosenApplicant(applicant); setDraft({ ...draft, search: applicant.code }); setPickerQuery(''); closePicker(); }}>
                    <span className="block font-semibold text-slate-800">{applicant.name}</span><span className="block text-slate-500">{applicant.code}</span>
                  </button>
                </li>)}
                {!availableApplicants.length && <li className="text-xs text-slate-500 py-2">No available applicants match. You can still type a name or code.</li>}
              </ul>}
              <button type="button" className="text-xs font-semibold text-sky-700" onClick={closePicker}>Close applicant picker</button>
            </div>}
          </div>
          <label className="text-xs font-bold text-slate-600">Position (exact match)
            <input type="text" maxLength={200} value={draft.position} placeholder="Full position name" className={`${reportInputClass} mt-1`}
              onChange={(event) => setDraft({ ...draft, position: event.target.value })} />
          </label>
          <label className="text-xs font-bold text-slate-600">Destination country
            <select value={draft.countryId} disabled={!options.countries.length} className={`${reportInputClass} mt-1`}
              onChange={(event) => setDraft({ ...draft, countryId: event.target.value })}>
              <option value="">All countries</option>
              {options.countries.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">Employer
            <select value={draft.employerId} disabled={!employers.length} className={`${reportInputClass} mt-1`}
              onChange={(event) => setDraft({ ...draft, employerId: event.target.value })}>
              <option value="">All employers</option>
              {employers.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <div className="flex items-end"><button type="submit" disabled={Boolean(invalid) || exportState.loading}
            className={`${reportButtonClass} bg-white w-full`}>Apply Filters</button></div>
        </div>
        <p className="text-xs text-slate-500">Applicant search contains the entered text; position matches the full position name. Both ignore case. All filters combine with the reporting period.</p>
        {options.notices.map((notice) => <p key={notice} className="text-xs text-slate-600">{notice}</p>)}
        {invalid ? <p role="alert" className="text-sm text-red-600">{invalid}</p> : pending &&
          <p className="text-xs font-semibold text-sky-700">Unapplied changes. Table and PDF use the applied filters below.</p>}
      </form>

      <div className="flex flex-wrap items-center gap-4">
        <div className="rounded-lg border border-slate-200 border-l-4 border-l-[#0EA5E9] p-4 min-w-56">
          <p className="text-xs font-bold tracking-wider text-slate-500">RECORDED DEPLOYMENTS</p>
          <p aria-label="Recorded deployment count" className="text-3xl font-extrabold text-[#0F172A] mt-1">{report ? displayCount(report.summary.total_deployments) : '—'}</p>
          <p className="text-xs text-slate-500 mt-1">Applications recorded as Deployed in the selected period.</p>
        </div>
        <div className="min-w-0 text-sm text-slate-600 space-y-1">
          <p className="font-semibold text-[#0F172A]">Applied period: {periodLabel(period)} UTC</p>
          <p className="break-words">Applied filters: {activeFilters.join(' · ') || 'None'}</p>
          <p className="text-xs">Counts applications, not distinct applicants. Recorded state does not independently verify departure.</p>
          {report && <p className="text-xs">Generated {displayTimestamp(report.metadata.generated_at!)} UTC. Records may change before a later export.</p>}
        </div>
      </div>

      <div aria-live="polite" aria-busy={current.loading}>
        {current.loading ? <p role="status" className="py-8 text-center text-sm text-slate-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading recorded deployments…</p> :
          current.error ? <p role="alert" className="py-6 text-sm text-red-600">{current.error}</p> : report && <>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-[1000px] w-full text-sm text-left">
                <caption className="sr-only">Recorded deployed applications, newest deployment first</caption>
                <thead className="bg-slate-50 text-xs text-slate-600"><tr>{(monthlyDefinition.columns as string[]).map((column) =>
                  <th key={column} scope="col" className="px-4 py-3 font-bold">{column}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">{monthlyDefinition.tableRows(report).map((cells, index) =>
                  <tr key={report.rows[index].application_id} className="hover:bg-slate-50">{cells.map((cell, column) =>
                    <td key={column} className="px-4 py-3 text-slate-700">{column === 6 ?
                      <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-semibold">{cell}</span> : cell}</td>)}</tr>)}</tbody>
              </table>
            </div>
            {report.rows.length === 0 && <div className="text-center py-8 text-slate-500">
              <p className="font-semibold text-slate-700">{report.pagination?.total === 0 ? 'No recorded deployments match your filters.' : 'No records on this page.'}</p>
              <p className="text-sm mt-1">{report.pagination?.total === 0 ? 'Adjust the month or filters and apply again.' : 'Use Previous or apply filters again to return to page 1.'}</p>
            </div>}
            <div className="flex flex-wrap justify-between items-center gap-3 pt-4 text-sm text-slate-600">
              <p>{displayCount(report.pagination!.total)} matching deployed applications · Page {report.pagination!.total_pages === 0 ? 0 : page} of {report.pagination!.total_pages} · {monthlyPageSize} per page</p>
              <nav aria-label="Deployment report pages" className="flex gap-2">
                <button type="button" className={reportButtonClass} disabled={page <= 1 || exportState.loading}
                  onClick={() => setQuery({ ...query, page: page - 1 })}>Previous</button>
                <button type="button" className={reportButtonClass} disabled={page >= report.pagination!.total_pages || exportState.loading}
                  onClick={() => setQuery({ ...query, page: page + 1 })}>Next</button>
              </nav>
            </div>
          </>}
      </div>
      <div aria-live="polite" aria-busy={exportState.loading}>
        {exportState.loading && <p role="status" className="text-sm text-slate-500">Fetching all matching deployments for PDF…</p>}
        {exportState.error && <p role="alert" className="text-sm text-red-600">{exportState.error}</p>}
        {exportState.message && <p role="status" className="text-sm text-slate-600">{exportState.message}</p>}
      </div>
    </section>
  );
}

function ReportCard<T extends ReportResponse>({ definition, period: sharedPeriod, visible, pdfContext }: {
  definition: ReportDefinition<T>; period: SharedReportingPeriod; visible: boolean; pdfContext: ReportPdfContextRef;
}) {
  const period = sharedDateRange(sharedPeriod);
  const key = JSON.stringify(period);
  const invalidPeriod = periodError(period);
  const [state, setState] = useState<ReportState<T>>({ periodKey: key, loading: true, generating: false, error: null, data: null });
  const requestSequence = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const exporting = useRef(false);

  const loadReport = useCallback(async (generatePdf = false) => {
    if (generatePdf && exporting.current) return;
    if (generatePdf) exporting.current = true;
    const period = sharedDateRange(sharedPeriod);
    activeRequest.current?.abort();
    const sequence = ++requestSequence.current;
    const controller = new AbortController();
    activeRequest.current = controller;
    const periodKey = JSON.stringify(period);
    const invalid = periodError(period);
    setState({ periodKey, loading: !invalid, generating: generatePdf && !invalid, error: invalid, data: null });
    if (invalid) { exporting.current = false; return; }
    const isCurrent = () => sequence === requestSequence.current && !controller.signal.aborted;
    let errorMessage = 'Could not load this report. Please try Export PDF again.';
    try {
      const data = definition.load ? await definition.load(period, controller.signal) :
        (await api.get<unknown>(definition.endpoint, { params: periodParams(period), signal: controller.signal })).data;
      if (!isCurrent()) return;
      if (!definition.validate(data) || !matchesPeriod(data, period, definition.dateField)) {
        throw new Error('Invalid report response');
      }
      if (generatePdf && data.rows.length > 0) {
        errorMessage = 'Could not generate the PDF. Please try Export PDF again.';
        downloadReport(definition, data, period, [], pdfContext.current);
      }
      if (isCurrent()) setState({ periodKey, loading: false, generating: false, error: null, data });
    } catch (error) {
      if (isCurrent()) setState({ periodKey, loading: false, generating: false, error: reportError(error, errorMessage), data: null });
    } finally {
      if (generatePdf) exporting.current = false;
    }
  }, [definition, sharedPeriod, pdfContext]);

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

  if (!visible) return null;

  return (
    <section aria-labelledby={`${definition.name}-title`} className="min-w-0 p-4 sm:p-6 flex flex-col gap-4">
      <header className="flex flex-wrap justify-between items-start gap-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-lg bg-[#0EA5E9]/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-6 h-6 text-[#0EA5E9]" />
          </div>
          <div>
            <h3 id={`${definition.name}-title`} className="font-bold text-[#0F172A] mb-1">{definition.title}</h3>
            <p className="text-sm text-[#64748B]">{definition.description}</p>
          </div>
        </div>
        <button type="button" onClick={() => void loadReport(true)} disabled={current.loading || current.generating || Boolean(invalidPeriod)}
          className="ml-auto px-4 py-2 bg-[#0EA5E9] text-white text-sm font-bold rounded-lg hover:bg-[#0284C7] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          {current.generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {current.generating ? 'Exporting PDF…' : 'Export PDF'}
        </button>
      </header>

      <p className="text-xs text-[#64748B]">Applied period: {periodLabel(period)} UTC (inclusive).</p>

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

    </section>
  );
}

export default function OperationalReports({ staffDirectory }: { staffDirectory?: unknown[] } = {}) {
  const pdfContext = useRef<ReportPdfContext>({ agency: null, staffDirectory });
  useEffect(() => { pdfContext.current.staffDirectory = staffDirectory; }, [staffDirectory]);
  useEffect(() => {
    const controller = new AbortController();
    void api.get<unknown>('/lookups/agency', { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted && isObject(data) && isId(data.agency_id) &&
          typeof data.agency_name === 'string' && data.agency_name.trim()) {
        pdfContext.current.agency = { agency_id: data.agency_id, agency_name: data.agency_name.trim() };
      }
    }).catch(() => { /* Keep report scope identifiers when trusted agency details are unavailable. */ });
    return () => controller.abort();
  }, []);
  const [draftPeriod, setDraftPeriod] = useState(initialPeriod);
  const [appliedPeriod, setAppliedPeriod] = useState(draftPeriod);
  const [activeReport, setActiveReport] = useState<ReportName>('monthly_deployments');
  const [visited, setVisited] = useState<Partial<Record<ReportName, boolean>>>({ monthly_deployments: true });
  const tabRefs = useRef<Partial<Record<ReportName, HTMLButtonElement | null>>>({});
  const periodKey = JSON.stringify(appliedPeriod);
  const invalidPeriod = sharedPeriodError(draftPeriod);
  const pending = JSON.stringify(draftPeriod) !== periodKey;
  const bounds = monthBounds(draftPeriod.month);
  const dates = sharedDateRange(appliedPeriod);
  const reports = [monthlyDefinition, staffDefinition, financialDefinition, workflowDefinition];
  const selectReport = (name: ReportName) => {
    setActiveReport(name);
    setVisited((previous) => previous[name] ? previous : { ...previous, [name]: true });
  };

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold tracking-tight text-[#0F172A]">Operational Reports</h2>
        <p className="text-sm text-[#64748B] mt-1 font-medium">Choose a reporting period, then select a report tab to inspect or download it.</p>
      </div>

      <section aria-labelledby="shared-period-title" className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 sm:p-6 space-y-3">
        <h3 id="shared-period-title" className="font-bold text-[#0F172A]">Reporting Period</h3>
        <p className="text-sm text-slate-500">Select the period to use across all operational reports.</p>
        <form aria-label="Reporting period" noValidate onSubmit={(event) => {
          event.preventDefault();
          if (invalidPeriod || !pending) return;
          setAppliedPeriod({ ...draftPeriod });
          // A new period invalidates every report and safely resets monthly filters/page.
          setVisited({ [activeReport]: true });
        }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <label className="text-xs font-bold text-slate-600">Reporting month (UTC)
            <input type="month" required min="0001-01" max="9998-12" value={draftPeriod.month} className={`${reportInputClass} mt-1`}
              onChange={(event) => setDraftPeriod({ month: event.target.value, dateFrom: '', dateTo: '' })} />
          </label>
          <label className="text-xs font-bold text-slate-600">Narrow from (UTC, optional)
            <input type="date" min={bounds.first} max={draftPeriod.dateTo || bounds.last} value={draftPeriod.dateFrom} className={`${reportInputClass} mt-1`}
              onChange={(event) => setDraftPeriod({ ...draftPeriod, dateFrom: event.target.value })} />
          </label>
          <label className="text-xs font-bold text-slate-600">Narrow to (UTC, optional)
            <input type="date" min={draftPeriod.dateFrom || bounds.first} max={bounds.last} value={draftPeriod.dateTo} className={`${reportInputClass} mt-1`}
              onChange={(event) => setDraftPeriod({ ...draftPeriod, dateTo: event.target.value })} />
          </label>
          <button type="submit" disabled={Boolean(invalidPeriod) || !pending} className={`${reportButtonClass} bg-sky-50 text-sky-700`}>Apply Period</button>
        </form>
        <p className="text-xs text-slate-500">One UTC month; narrowing dates are inclusive. Applying a new period resets Monthly Deployment filters and pagination.</p>
        <p className="text-sm font-semibold text-[#0F172A]">Applied: {dates.dateFrom} to {dates.dateTo} (inclusive, UTC)</p>
        <div aria-live="polite">
          {invalidPeriod ? <p role="alert" className="text-sm text-red-600">{invalidPeriod}</p> : pending &&
            <p className="text-xs font-semibold text-sky-700">Unapplied period changes. Reports and PDFs still use the applied period.</p>}
        </div>
      </section>

      <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="max-w-full overflow-x-auto border-b border-slate-200 bg-slate-50">
          <div role="tablist" aria-label="Operational report types" aria-orientation="horizontal" className="flex w-max min-w-full">
            {reports.map((report, index) => {
              const selected = activeReport === report.name;
              const Icon = report.icon;
              return <button key={report.name} id={`${report.name}-tab`} type="button" role="tab"
                ref={(element) => { tabRefs.current[report.name] = element; }}
                aria-label={report.name === 'monthly_deployments' ? 'Monthly Deployment' : report.name === 'workflow_efficiency' ? 'Workflow Efficiency' : report.title}
                aria-selected={selected} aria-controls={`${report.name}-details`} tabIndex={selected ? 0 : -1}
                onClick={() => selectReport(report.name)}
                onKeyDown={(event) => {
                  if (event.altKey || event.ctrlKey || event.metaKey) return;
                  const nextIndex = event.key === 'ArrowRight' ? (index + 1) % reports.length :
                    event.key === 'ArrowLeft' ? (index + reports.length - 1) % reports.length :
                    event.key === 'Home' ? 0 : event.key === 'End' ? reports.length - 1 : null;
                  if (nextIndex === null) return;
                  event.preventDefault();
                  const next = reports[nextIndex].name;
                  selectReport(next);
                  tabRefs.current[next]?.focus({ preventScroll: true });
                  tabRefs.current[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                }}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 sm:px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0EA5E9] ${selected ? 'border-[#0EA5E9] bg-white text-sky-700' : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
                <Icon aria-hidden="true" className="w-4 h-4 shrink-0" />
                {report.name === 'monthly_deployments' ? 'Monthly Deployment' : report.name === 'workflow_efficiency' ? 'Workflow Efficiency' : report.title}
              </button>;
            })}
          </div>
        </div>

        {/* Keep visited components mounted for this period; only the active details render. */}
        <div id="monthly_deployments-details" role="tabpanel" aria-labelledby="monthly_deployments-tab" tabIndex={0} hidden={activeReport !== 'monthly_deployments'} className="min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0EA5E9]">
          {visited.monthly_deployments && <MonthlyDeploymentCard key={periodKey} period={appliedPeriod} visible={activeReport === 'monthly_deployments'} pdfContext={pdfContext} />}
        </div>
        <div id="staff_performance-details" role="tabpanel" aria-labelledby="staff_performance-tab" tabIndex={0} hidden={activeReport !== 'staff_performance'} className="min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0EA5E9]">
          {visited.staff_performance && <ReportCard key={periodKey} definition={staffDefinition} period={appliedPeriod} visible={activeReport === 'staff_performance'} pdfContext={pdfContext} />}
        </div>
        <div id="financial_summary-details" role="tabpanel" aria-labelledby="financial_summary-tab" tabIndex={0} hidden={activeReport !== 'financial_summary'} className="min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0EA5E9]">
          {visited.financial_summary && <ReportCard key={periodKey} definition={financialDefinition} period={appliedPeriod} visible={activeReport === 'financial_summary'} pdfContext={pdfContext} />}
        </div>
        <div id="workflow_efficiency-details" role="tabpanel" aria-labelledby="workflow_efficiency-tab" tabIndex={0} hidden={activeReport !== 'workflow_efficiency'} className="min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0EA5E9]">
          {visited.workflow_efficiency && <ReportCard key={periodKey} definition={workflowDefinition} period={appliedPeriod} visible={activeReport === 'workflow_efficiency'} pdfContext={pdfContext} />}
        </div>
      </div>
    </div>
  );
}
