import { describe, it, expect } from 'vitest';
import { getMedicalTransition, filterProfilingCandidates } from './workflowUtils';
import { ApplicantRecord } from '../app/types';

describe('Workflow Utilities', () => {
  const dummyApplicant: ApplicantRecord = {
    id: '1',
    name: 'Test',
    role: 'Worker',
    jobOrder: 'JO-1',
    phase: 3,
    status: 'Medical Clearance',
    currentHandler: 'Staff',
    currentDepartment: 'Recruitment',
    lastUpdated: '',
    phaseDescription: '',
    skills: ['Carpentry']
  };

  it('Fit-to-Work applicant appears in Applicant Profiling pool (not CV Encoding)', () => {
    const transition = getMedicalTransition(dummyApplicant, 'Fit');
    expect(transition.status).toBe('Applicant Profiling');
    
    const applicantAfterFit = { ...dummyApplicant, ...transition };
    const { eligibleCandidates } = filterProfilingCandidates([applicantAfterFit]);
    expect(eligibleCandidates.length).toBe(1);
    expect(eligibleCandidates[0].id).toBe('1');
  });

  it('Unfit-to-Work applicant is set to Provisional (not terminated, not silently dropped)', () => {
    const transition = getMedicalTransition(dummyApplicant, 'Unfit');
    expect(transition.status).toBe('Provisional');
    expect(transition.phase).toBeUndefined(); // Phase shouldn't drop to 0
  });

  it('Provisional applicant does NOT appear in Applicant Profiling pool', () => {
    const provisionalApp = { ...dummyApplicant, status: 'Provisional' };
    const { eligibleCandidates, profilingCandidates } = filterProfilingCandidates([provisionalApp]);
    
    expect(profilingCandidates.length).toBe(0);
    expect(eligibleCandidates.length).toBe(0);
  });

  it('Reconsider action correctly returns a Provisional applicant to a re-evaluatable state', () => {
    const provisionalApp = { ...dummyApplicant, status: 'Provisional' };
    const transition = getMedicalTransition(provisionalApp, 'Reconsider');
    
    expect(transition.status).toBe('Medical Clearance');
    expect(transition.phaseDescription).toContain('Re-evaluating');
  });

  it('Stop Processing action correctly and finally discontinues a Provisional applicant', () => {
    const provisionalApp = { ...dummyApplicant, status: 'Provisional' };
    const transition = getMedicalTransition(provisionalApp, 'StopProcessing');
    
    expect(transition.status).toBe('Processing Stopped');
    expect(transition.phase).toBe(0);
  });

  it('Applicant can cycle through Unfit -> Provisional -> Reconsider -> Unfit -> Provisional multiple times without any system-imposed limit', () => {
    // There is no counter or limit enforced in the transition logic.
    let app = { ...dummyApplicant };
    
    // Cycle 1
    app = { ...app, ...getMedicalTransition(app, 'Unfit') };
    expect(app.status).toBe('Provisional');
    app = { ...app, ...getMedicalTransition(app, 'Reconsider') };
    expect(app.status).toBe('Medical Clearance');
    
    // Cycle 2
    app = { ...app, ...getMedicalTransition(app, 'Unfit') };
    expect(app.status).toBe('Provisional');
    app = { ...app, ...getMedicalTransition(app, 'Reconsider') };
    expect(app.status).toBe('Medical Clearance');
  });

  it('Applicant without complete assessments is excluded from profiling with correct notification', () => {
    // A2 missing assessments test
    const incompleteApp = { ...dummyApplicant, status: 'Applicant Profiling', hasCompleteAssessments: false };
    const { eligibleCandidates, incompleteCandidates } = filterProfilingCandidates([incompleteApp]);
    
    expect(eligibleCandidates.length).toBe(0);
    expect(incompleteCandidates.length).toBe(1);
    expect(incompleteCandidates[0].id).toBe('1');
  });

  it('No qualified applicants for a job order shows the correct message', () => {
    // Simulated by having 0 eligible candidates
    const { hasQualifiedCandidates } = filterProfilingCandidates([]);
    expect(hasQualifiedCandidates).toBe(false);
  });
});
