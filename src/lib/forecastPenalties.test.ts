import { beforeEach, describe, expect, it, vi } from 'vitest';
const get = vi.hoisted(() => vi.fn());
vi.mock('./api', () => ({ api: { get } }));
import { applicableDelayReasons, delayReasonPayload, loadDelayReasons, loadDelayStages } from './forecastPenalties';

const reason = (id: number, stage: number | null) => ({ exception_type_id: id, reason_name: `Reason ${id}`,
  workflow_stage_id: stage, stage_name: stage === null ? null : 'Same name', seed_penalty_days: 3, current_weight_days: 3, observation_count: 0 });

describe('agency delay API and stage IDs', () => {
  beforeEach(() => vi.clearAllMocks());
  it('uses authenticated endpoints without tenant overrides and accepts empty categories', async () => {
    get.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: [
      { workflow_stage_id: 97, stage_order: 2, stage_name: 'Medical' },
      { workflow_stage_id: 42, stage_order: 1, stage_name: 'Phase 1' },
    ] });
    expect(await loadDelayReasons()).toEqual([]);
    expect((await loadDelayStages()).map((row) => row.workflow_stage_id)).toEqual([42, 97]);
    expect(get.mock.calls).toEqual([['/forecasting/penalties'], ['/forecasting/penalties/stages']]);
  });
  it('filters only by ID, retains multiple same-stage reasons and agency-wide reasons', () => {
    const rows = [reason(1, 42), reason(2, 42), reason(3, 97), reason(4, null)];
    expect(applicableDelayReasons(rows, 42).map((row) => row.exception_type_id)).toEqual([1, 2, 4]);
    expect(applicableDelayReasons(rows, 97).map((row) => row.exception_type_id)).toEqual([3, 4]);
    for (const id of [undefined, 0, NaN]) expect(applicableDelayReasons(rows, id).map((row) => row.exception_type_id)).toEqual([4]);
  });
  it('validates meaningful reasons, positive duration, and real active stage IDs', () => {
    const stages = [{ workflow_stage_id: 97, stage_order: 2, stage_name: 'Medical' }];
    expect(delayReasonPayload(' Document Delay ', '3', '97', stages)).toEqual({ reason_name: 'Document Delay', initial_delay_days: 3, workflow_stage_id: 97 });
    expect(delayReasonPayload('Delay', '.001', '', stages).workflow_stage_id).toBeNull();
    for (const name of ['', ' ', '...']) expect(() => delayReasonPayload(name, '3', '', stages)).toThrow('meaningful');
    for (const days of ['', ' ', '0', '-1', 'Infinity', 'NaN', '365.001']) expect(() => delayReasonPayload('Delay', days, '', stages)).toThrow('greater than zero');
    expect(delayReasonPayload(' Ｄｅｌａｙ  reason ', '365', '', stages).reason_name).toBe('Delay reason');
    expect(() => delayReasonPayload('x'.repeat(101), '3', '', stages)).toThrow('100 characters');
    expect(() => delayReasonPayload('Hidden\u200bdelay', '3', '', stages)).toThrow('control characters');
    expect(() => delayReasonPayload('Delay', '3', '2', stages)).toThrow('active agency stage');
  });
  it('rejects malformed response data rather than offering unsafe options', async () => {
    get.mockResolvedValueOnce({ data: [reason(1, 42), reason(1, 97)] });
    await expect(loadDelayReasons()).rejects.toThrow('Invalid');
    get.mockResolvedValueOnce({ data: [{ workflow_stage_id: 0, stage_order: 1, stage_name: 'Bad ID' }] });
    await expect(loadDelayStages()).rejects.toThrow('Invalid');
  });
});
