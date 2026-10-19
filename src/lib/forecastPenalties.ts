import { api } from './api';

export interface DelayReason {
  exception_type_id: number;
  reason_name: string;
  workflow_stage_id: number | null;
  stage_name: string | null;
  seed_penalty_days: number;
  current_weight_days: number;
  observation_count: number;
}

export interface DelayStage {
  workflow_stage_id: number;
  stage_order: number;
  stage_name: string;
}

const positiveId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const duration = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export async function loadDelayReasons(): Promise<DelayReason[]> {
  const { data } = await api.get('/forecasting/penalties');
  if (!Array.isArray(data) || !data.every((row) => row && positiveId(row.exception_type_id) &&
    typeof row.reason_name === 'string' && row.reason_name.trim() &&
    (row.workflow_stage_id === null || positiveId(row.workflow_stage_id)) &&
    (row.stage_name === null || typeof row.stage_name === 'string') &&
    duration(row.seed_penalty_days) && duration(row.current_weight_days) &&
    Number.isSafeInteger(row.observation_count) && row.observation_count >= 0) ||
    new Set(data.map((row) => row.exception_type_id)).size !== data.length) throw new Error('Invalid delay reason response.');
  return data;
}

export async function loadDelayStages(): Promise<DelayStage[]> {
  const { data } = await api.get('/forecasting/penalties/stages');
  if (!Array.isArray(data) || !data.every((row) => row && positiveId(row.workflow_stage_id) &&
    Number.isSafeInteger(row.stage_order) && row.stage_order >= 0 &&
    typeof row.stage_name === 'string' && row.stage_name.trim()) ||
    new Set(data.map((row) => row.workflow_stage_id)).size !== data.length) throw new Error('Invalid delay stage response.');
  return [...data].sort((a, b) => a.stage_order - b.stage_order);
}

export function applicableDelayReasons(rows: DelayReason[], stageId?: number): DelayReason[] {
  return rows.filter((row) => row.workflow_stage_id === null ||
    (positiveId(stageId) && row.workflow_stage_id === stageId));
}

export function delayReasonError(err: any): string {
  const status = err.response?.status;
  if (status === 401) return 'Your session has expired. Sign in again.';
  if (status === 403) return 'The backend denied this action. Delay reasons are read-only for your current permissions.';
  if (status === 404 || status === 405) return 'Delay reason management is unavailable on this backend. You can still use Custom What-if Delay.';
  const detail = err.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (status === 409) return 'This reason conflicts with an existing category or has observations and cannot be edited. Reload and review the category.';
  if (status === 422) return 'The backend rejected these values. Check the reason, stage, and positive initial delay.';
  if (!err.response) return 'Unable to confirm delay reasons. Check your connection and reload.';
  return 'Unable to load or save delay reasons. Please try again.';
}

export function delayReasonPayload(reason: string, days: string, stage: string, stages: DelayStage[]) {
  const normalized = reason.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (!/[\p{L}\p{N}]/u.test(normalized) || /\p{C}/u.test(normalized)) throw new Error('Enter a meaningful delay reason without control characters.');
  if (Array.from(normalized).length > 100) throw new Error('Use at most 100 characters for the delay reason.');
  if (!days.trim() || !Number.isFinite(Number(days)) || Number(days) <= 0 || Number(days) > 365) throw new Error('Enter a finite initial delay greater than zero and at most 365 days.');
  if (stage !== '' && !stages.some((item) => String(item.workflow_stage_id) === stage)) throw new Error('Select an active agency stage or All Stages.');
  return { reason_name: normalized, initial_delay_days: Number(days), workflow_stage_id: stage === '' ? null : Number(stage) };
}
