import { describe, it, expect } from 'vitest';
import { mapApplicantFromApi } from './applicantMapper';

describe('mapApplicantFromApi deployment date reconciliation', () => {
  const baseApiApplicant = {
    applicant_id: 101,
    first_name: 'Juan',
    last_name: 'Dela Cruz',
    applied_position: 'Welder',
    application_id: '1001',
    current_phase: 5,
    application_status: 'Ready for Deployment',
    is_stopped: false,
  };

  it('marks candidate as Deployed (Phase 6) when actualDeploymentDate is in the past', () => {
    const pastDate = '2026-01-15';
    const mapped = mapApplicantFromApi({
      ...baseApiApplicant,
      actual_deployment_at: pastDate,
    });

    expect(mapped.phase).toBe(6);
    expect(mapped.status).toBe('Deployed');
    expect(mapped.actualDeploymentDate).toBe(pastDate);
  });

  it('marks candidate as Deployed (Phase 6) when actualDeploymentDate is today', () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const mapped = mapApplicantFromApi({
      ...baseApiApplicant,
      actual_deployment_at: todayStr,
    });

    expect(mapped.phase).toBe(6);
    expect(mapped.status).toBe('Deployed');
    expect(mapped.actualDeploymentDate).toBe(todayStr);
  });

  it('keeps candidate as Ready for Deployment (Phase 5) when deployment date is in the future', () => {
    const futureDate = '2099-12-31';
    const mapped = mapApplicantFromApi({
      ...baseApiApplicant,
      actual_deployment_at: futureDate,
    });

    expect(mapped.phase).toBe(5);
    expect(mapped.status).toBe('Ready for Deployment');
    expect(mapped.actualDeploymentDate).toBe(futureDate);
  });

  it('reverts candidate from Deployed back to Ready for Deployment (Phase 5) if rescheduled into the future', () => {
    const futureDate = '2099-11-20';
    const mapped = mapApplicantFromApi({
      ...baseApiApplicant,
      current_phase: 6,
      application_status: 'Deployed',
      actual_deployment_at: futureDate,
    });

    expect(mapped.phase).toBe(5);
    expect(mapped.status).toBe('Ready for Deployment');
    expect(mapped.actualDeploymentDate).toBe(futureDate);
  });

  it('does not force Deployed status if candidate is stopped', () => {
    const pastDate = '2026-01-01';
    const mapped = mapApplicantFromApi({
      ...baseApiApplicant,
      is_stopped: true,
      application_status: 'Processing Stopped',
      actual_deployment_at: pastDate,
    });

    expect(mapped.status).toBe('Processing Stopped');
  });

  it('keeps candidate in Ready for Deployment when deployment date is cancelled / cleared', () => {
    const mapped = mapApplicantFromApi({
      ...baseApiApplicant,
      actual_deployment_at: null,
      actualDeploymentDate: '',
    });

    expect(mapped.phase).toBe(5);
    expect(mapped.status).toBe('Ready for Deployment');
    expect(mapped.actualDeploymentDate).toBeUndefined();
  });
});

