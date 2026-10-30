// PF05 contract: stage_order is the write identity. IDs and keys come only from GET.
export interface PertStage {
  stage_order: number;
  stage_name: string;
  workflow_stage_id?: number | null;
  stage_key?: string | null;
  is_active?: boolean | null;
  optimistic_days?: number | null;
  most_likely_days?: number | null;
  pessimistic_days?: number | null;
  pert_baseline_days?: number | null;
  calculated_pert_baseline_days?: number | null;
  observation_count?: number | null;
  current_ses_forecast_days?: number | null;
  effective_forecast_days?: number | null;
  forecast_basis: 'pert' | 'ses' | 'unavailable';
}

export interface PertConfiguration {
  agency_id: number;
  revision: number;
  setup_status: 'required' | 'deferred' | 'unconfirmed' | 'complete' | 'inconsistent';
  initial_setup_required: boolean;
  // Optional only for compatibility with the pre-PF18 backend. Absence never grants deferral.
  setup_deferred?: boolean;
  deferred_at?: string | null;
  deferred_by?: number | null;
  workflow_setup_required?: boolean;
  can_manage: boolean;
  must_change_password: boolean;
  next_action: 'change_password' | 'configure_pert' | 'contact_manager' | 'normal_operations' | 'reconciliation_required';
  completed_at: string | null;
  completed_by: number | null;
  forecast_settings_present: boolean;
  initial_forecast_settings_required: boolean;
  ses_alpha: number | null;
  stages: PertStage[];
  issues: string[];
}

export const pertFields = ['optimistic_days', 'most_likely_days', 'pessimistic_days'] as const;
export type PertField = typeof pertFields[number];
export type PertDraft = { stage_order: number } & Record<PertField, string>;
export interface PertSavePayload {
  request_id: string;
  expected_revision: number;
  stages: ({ stage_order: number } & Record<PertField, number>)[];
  initial_forecast_settings?: { ses_alpha: number };
}
export interface PertAttempt {
  method: 'post' | 'put';
  payload: PertSavePayload;
}

const days = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const validOrders = (stages: { stage_order: number }[]) => stages.length === 5 &&
  [1, 2, 3, 4, 5].every((order) => stages.filter((stage) => stage.stage_order === order).length === 1);
const validDeferralTime = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
const validDeferralActor = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

export function isPertDeferred(config: PertConfiguration): boolean {
  return config.setup_status === 'deferred' && config.setup_deferred === true && config.initial_setup_required === true &&
    config.workflow_setup_required === true && validDeferralTime(config.deferred_at) && validDeferralActor(config.deferred_by);
}

export function canDeferPert(config: PertConfiguration): boolean {
  return config.setup_status === 'required' && config.initial_setup_required && config.can_manage &&
    !config.must_change_password && config.next_action === 'configure_pert' && !config.issues.length &&
    config.setup_deferred === false && config.workflow_setup_required === true &&
    config.deferred_at === null && config.deferred_by === null;
}

export function confirmedPertDeferral(data: any, revision: number): boolean {
  return !!data && data.revision === revision && data.next_action === 'normal_operations' &&
    data.learning_state_modified === false && isPertDeferred(data);
}

export function pertDeferralError(error: any): string {
  const status = error.response?.status;
  if (status === 401) return 'Your session has expired. Sign in again, then refresh setup status. Setup has not been marked complete.';
  if (status === 403) return 'Configure Later was denied. An authorized Manager must finish the required password change first. Refresh setup status before trying again.';
  if (status === 409) return 'Agency setup changed or could not be deferred. Refresh setup status and review it before trying again.';
  if (status === 422) return 'The backend rejected this deferral request. Refresh setup status before trying again.';
  if (status === 404 || status === 405 || status === 503) return 'Configure Later is unavailable or its outcome could not be confirmed. The backend feature or database migration may not be deployed. Setup remains incomplete; refresh setup status to check.';
  return 'Configure Later could not be confirmed. Check your connection and refresh setup status before retrying. No local deferral has been applied.';
}

export function readPertConfiguration(data: any): PertConfiguration {
  if (!data || !Number.isSafeInteger(data.agency_id) || data.agency_id <= 0 ||
      !Number.isSafeInteger(data.revision) || data.revision < 0 ||
      !['required', 'deferred', 'unconfirmed', 'complete', 'inconsistent'].includes(data.setup_status) ||
      (data.setup_deferred !== undefined && typeof data.setup_deferred !== 'boolean') ||
      (data.workflow_setup_required !== undefined && typeof data.workflow_setup_required !== 'boolean') ||
      (data.deferred_at != null && !validDeferralTime(data.deferred_at)) ||
      (data.deferred_by != null && !validDeferralActor(data.deferred_by)) ||
      (data.setup_status === 'deferred' && !isPertDeferred(data)) ||
      (data.setup_deferred === true && data.setup_status !== 'deferred' && data.setup_status !== 'inconsistent') ||
      (data.setup_status === 'complete' && data.workflow_setup_required === true) ||
      !['change_password', 'configure_pert', 'contact_manager', 'normal_operations', 'reconciliation_required'].includes(data.next_action) ||
      ['can_manage', 'must_change_password', 'initial_setup_required', 'forecast_settings_present', 'initial_forecast_settings_required']
        .some((key) => typeof data[key] !== 'boolean') ||
      !Array.isArray(data.issues) || data.issues.some((issue: unknown) => typeof issue !== 'string') ||
      !Array.isArray(data.stages) || data.stages.some((stage: any) => !stage || typeof stage.stage_name !== 'string' || !stage.stage_name.trim()) ||
      !validOrders(data.stages) || data.stages.some((stage: any) =>
        [...pertFields, 'pert_baseline_days', 'calculated_pert_baseline_days', 'current_ses_forecast_days', 'effective_forecast_days']
          .some((field) => stage[field] != null && !days(stage[field])))) {
    throw new Error('PERT configuration is unavailable or incomplete. Reload configuration; contact support if this continues.');
  }
  return { ...data, stages: [...data.stages].sort((a, b) => a.stage_order - b.stage_order) };
}

export function pertDrafts(config: PertConfiguration): PertDraft[] {
  return config.stages.map((stage) => ({ stage_order: stage.stage_order,
    optimistic_days: stage.optimistic_days == null ? '' : String(stage.optimistic_days),
    most_likely_days: stage.most_likely_days == null ? '' : String(stage.most_likely_days),
    pessimistic_days: stage.pessimistic_days == null ? '' : String(stage.pessimistic_days),
  }));
}

export function validPertDuration(value: string): boolean {
  return /^(?:\d+(?:\.\d{0,4})?|\.\d{1,4})$/.test(value.trim()) &&
    Number.isFinite(Number(value)) && Number(value) <= 3650;
}

export function pertStageError(stage: PertDraft): string | null {
  if (pertFields.some((key) => !validPertDuration(stage[key]))) {
    return 'Enter all three durations as decimal days from 0 to 3650, with at most four decimal places.';
  }
  if (Number(stage.optimistic_days) > Number(stage.most_likely_days) || Number(stage.most_likely_days) > Number(stage.pessimistic_days)) {
    return 'Use shortest ≤ usual ≤ longer (O ≤ M ≤ P). Most Likely cannot be less than Optimistic, and Pessimistic cannot be less than Most Likely. Equal values are allowed.';
  }
  return null;
}

export function expectedPertDays(stage: PertDraft): number | null {
  if (pertStageError(stage)) return null;
  // Integer ten-thousandths avoid binary floating point ties. Match Decimal ROUND_HALF_UP.
  const units = (value: string) => {
    const [whole, fraction = ''] = value.trim().split('.');
    return Number(whole || 0) * 10000 + Number(fraction.padEnd(4, '0'));
  };
  return Math.floor((units(stage.optimistic_days) + 4 * units(stage.most_likely_days) + units(stage.pessimistic_days) + 3) / 6) / 10000;
}

export function createPertAttempt(config: PertConfiguration, drafts: PertDraft[], alpha: string): PertAttempt {
  if (config.revision >= Number.MAX_SAFE_INTEGER) throw new Error('Configuration revision cannot be safely updated in this browser. Contact support.');
  if (!validOrders(drafts)) throw new Error('Configure each of the five stages exactly once.');
  for (const stage of drafts) {
    const error = pertStageError(stage);
    if (error) throw new Error(`Stage ${stage.stage_order}: ${error}`);
  }
  const method = config.setup_status === 'complete' ? 'put' : 'post';
  const payload: PertSavePayload = {
    request_id: crypto.randomUUID(), expected_revision: config.revision,
    stages: drafts.map((stage) => ({ stage_order: stage.stage_order,
      optimistic_days: Number(stage.optimistic_days), most_likely_days: Number(stage.most_likely_days), pessimistic_days: Number(stage.pessimistic_days),
    })),
  };
  if (method === 'post' && config.initial_forecast_settings_required) {
    if (alpha.trim() === '' || !Number.isFinite(Number(alpha)) || Number(alpha) <= 0 || Number(alpha) > 1) {
      throw new Error('Enter an initial SES alpha greater than 0 and at most 1.');
    }
    payload.initial_forecast_settings = { ses_alpha: Number(alpha) };
  }
  return { method, payload };
}

// Persist only this tab's unresolved command, never credentials or a fabricated tenant/actor.
// An exact retry remains subject to the backend's fresh authorization and receipt checks.
export const pertAttemptKey = (agencyId: number) => `flowsensus:pert-pending:${agencyId}`;

export function readPertAttempt(serialized: string): PertAttempt {
  const invalid = () => new Error('The pending PERT save could not be recovered. Contact support before submitting another configuration.');
  let attempt: PertAttempt;
  try { attempt = JSON.parse(serialized); } catch { throw invalid(); }
  const payload = attempt?.payload;
  if (!['post', 'put'].includes(attempt?.method) || !payload ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.request_id) ||
      !Number.isSafeInteger(payload.expected_revision) || payload.expected_revision < 0 ||
      Object.keys(payload).some((key) => !['request_id', 'expected_revision', 'stages', 'initial_forecast_settings'].includes(key)) ||
      !Array.isArray(payload.stages) || payload.stages.some((stage) => !stage) || !validOrders(payload.stages) ||
      payload.stages.some((stage) => Object.keys(stage).length !== 4 || pertFields.some((field) => typeof stage[field] !== 'number') ||
        pertStageError({ stage_order: stage.stage_order, optimistic_days: String(stage.optimistic_days), most_likely_days: String(stage.most_likely_days), pessimistic_days: String(stage.pessimistic_days) })) ||
      (payload.initial_forecast_settings !== undefined && (attempt.method !== 'post' || !payload.initial_forecast_settings ||
        Object.keys(payload.initial_forecast_settings).length !== 1 || typeof payload.initial_forecast_settings.ses_alpha !== 'number' ||
        !Number.isFinite(payload.initial_forecast_settings.ses_alpha) || payload.initial_forecast_settings.ses_alpha <= 0 || payload.initial_forecast_settings.ses_alpha > 1))) {
    throw invalid();
  }
  return attempt;
}

export function confirmedPertSave(data: any, attempt: PertAttempt, agencyId: number): boolean {
  return data?.request_id === attempt.payload.request_id && data.agency_id === agencyId &&
    data.operation === (attempt.method === 'post' ? 'initial_setup' : 'update') &&
    data.revision === attempt.payload.expected_revision + 1 && data.setup_status === 'complete' &&
    data.initial_setup_required === false && data.learning_state_modified === false &&
    data.setup_deferred !== true && data.workflow_setup_required !== true &&
    Array.isArray(data.stages) && data.stages.every((stage: any) => stage && pertFields.every((key) => days(stage[key])) && days(stage.pert_baseline_days)) && validOrders(data.stages);
}

export function pertError(error: any): string {
  const status = error.response?.status;
  const code = error.response?.data?.detail?.code;
  if (code === 'PERT_PASSWORD_CHANGE_REQUIRED') return 'Change your required temporary password before saving PERT configuration, then reload configuration.';
  if (status === 401) return 'Your session has expired. Sign in again, then reload configuration.';
  if (status === 403) return 'You are not authorized to manage PERT configuration. Reload after your access is restored.';
  if (status === 409) return 'Configuration changed, initial setup may already be complete, or agency data needs reconciliation. Reload configuration and review it before saving again. Your changes have not been automatically resubmitted.';
  if (status === 422) return 'The backend rejected the configuration. Check all five stages, O ≤ M ≤ P, duration limits and initial SES alpha, then submit again.';
  if (!error.response || status >= 500 || status === 408) return 'The backend is unavailable or the save outcome could not be confirmed.';
  return 'Unable to save PERT configuration. Reload configuration before trying again.';
}
