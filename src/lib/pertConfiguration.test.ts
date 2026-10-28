import { describe, expect, it } from 'vitest';
import { createPertAttempt, expectedPertDays, pertDrafts, pertStageError, readPertAttempt, readPertConfiguration, validPertDuration, PertConfiguration } from './pertConfiguration';

const config = {
  agency_id: 7, revision: 1, setup_status: 'complete', initial_setup_required: false, can_manage: true,
  must_change_password: false, next_action: 'normal_operations', completed_at: null, completed_by: null,
  forecast_settings_present: true, initial_forecast_settings_required: false, ses_alpha: 0.3, issues: [],
  stages: [1, 2, 3, 4, 5].map((stage_order) => ({ stage_order, stage_name: `Stage ${stage_order}`, forecast_basis: 'pert',
    optimistic_days: 2, most_likely_days: 5, pessimistic_days: 14, pert_baseline_days: 6 })),
} as PertConfiguration;

describe('PF05 PERT validation and display rounding', () => {
  it.each(['', ' ', 'NaN', 'Infinity', '-1', '3650.0001', '1.00001', '1e2', '0x10', '1,2'])('rejects invalid duration %j', (value) => {
    expect(validPertDuration(value)).toBe(false);
  });
  it.each(['0', '.0001', '0.1234', '3650', ' 12.25 '])('accepts decimal duration %j', (value) => {
    expect(validPertDuration(value)).toBe(true);
  });
  it('calculates the formula and rounds positive half ties exactly like Decimal ROUND_HALF_UP', () => {
    expect(expectedPertDays(pertDrafts(config)[0])).toBe(6);
    expect(expectedPertDays({ stage_order: 1, optimistic_days: '0', most_likely_days: '0', pessimistic_days: '0.0003' })).toBe(0.0001);
    expect(expectedPertDays({ stage_order: 1, optimistic_days: '0.0001', most_likely_days: '0.0001', pessimistic_days: '0.0004' })).toBe(0.0002);
    expect(expectedPertDays({ stage_order: 1, optimistic_days: '3650', most_likely_days: '3650', pessimistic_days: '3650' })).toBe(3650);
    expect(expectedPertDays({ ...pertDrafts(config)[0], most_likely_days: '' })).toBeNull();
  });
  it('rejects ordering and requires exactly five distinct stage orders', () => {
    const drafts = pertDrafts(config);
    expect(pertStageError({ ...drafts[0], optimistic_days: '6' })).toContain('O ≤ M ≤ P');
    expect(pertStageError({ ...drafts[0], pessimistic_days: '4' })).toContain('O ≤ M ≤ P');
    expect(() => createPertAttempt(config, drafts.slice(1), '')).toThrow('five stages');
    expect(() => createPertAttempt(config, [drafts[0], ...drafts.slice(0, 4)], '')).toThrow('five stages');
  });
  it('never derives unknown inputs from stored baselines', () => {
    const legacy = { ...config, stages: config.stages.map((stage) => ({ ...stage, optimistic_days: null, most_likely_days: null, pessimistic_days: null })) };
    expect(pertDrafts(legacy).every((stage) => stage.optimistic_days === '' && stage.most_likely_days === '' && stage.pessimistic_days === '')).toBe(true);
    expect(() => createPertAttempt(legacy, pertDrafts(legacy), '')).toThrow('all three durations');
  });
  it('rejects incomplete/malformed GET responses and unsafe revisions instead of inventing stages', () => {
    for (const data of [null, {}, { ...config, stages: [] }, { ...config, stages: [null] }, { ...config, revision: 9007199254740992 },
      { ...config, stages: [...config.stages.slice(1), config.stages[1]] }]) {
      expect(() => readPertConfiguration(data)).toThrow('unavailable or incomplete');
    }
    expect(readPertConfiguration({ ...config, stages: [...config.stages].reverse() }).stages[0].stage_order).toBe(1);
  });
  it('requires initial alpha only when POST explicitly needs it, without rounding alpha', () => {
    const initial = { ...config, setup_status: 'required', revision: 0, initial_forecast_settings_required: true } as PertConfiguration;
    for (const alpha of ['', '0', '1.01', 'NaN', 'Infinity']) expect(() => createPertAttempt(initial, pertDrafts(config), alpha)).toThrow('initial SES alpha');
    expect(createPertAttempt(initial, pertDrafts(config), '0.99999').payload.initial_forecast_settings).toEqual({ ses_alpha: 0.99999 });
    expect(createPertAttempt(config, pertDrafts(config), '').payload).not.toHaveProperty('initial_forecast_settings');
  });
  it('recovers valid pending commands and blocks corrupt or incompatible persisted payloads', () => {
    const command = createPertAttempt(config, pertDrafts(config), '');
    expect(readPertAttempt(JSON.stringify(command))).toEqual(command);
    for (const payload of [{ ...command.payload, request_id: 'invalid' }, { ...command.payload, expected_revision: -1 },
      { ...command.payload, stages: [] }, { ...command.payload, initial_forecast_settings: { ses_alpha: 0.3 } },
      { ...command.payload, unexpected_property: true }]) {
      expect(() => readPertAttempt(JSON.stringify({ method: 'put', payload }))).toThrow('could not be recovered');
    }
    expect(() => readPertAttempt('null')).toThrow('could not be recovered');
    expect(() => createPertAttempt({ ...config, revision: Number.MAX_SAFE_INTEGER }, pertDrafts(config), '')).toThrow('safely updated');
  });
});
