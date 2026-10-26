import { describe, it, expect } from 'vitest';
import {
  getMedicalTransition,
  filterProfilingCandidates,
  evaluatePhase1Scores,
  evaluatePhase2Interview,
  canGenerateMedicalReferral,
  moveToMedicalReferral,
  filterScreeningSubPhases
} from './workflowUtils';
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

  describe('Screening Module — 3-Phase Logic & Core Rule', () => {
    it('Core Rule: Failing score on any of the 3 tests sets status = Provisional, candidate stays in Phase 1', () => {
      // English fails (< 60)
      const res1 = evaluatePhase1Scores({ englishProficiency: 55, tradeSkills: 80, iqAptitude: 65 });
      expect(res1.passed).toBe(false);
      expect(res1.nextStatus).toBe('Provisional');

      // Trade Skills fails (< 70)
      const res2 = evaluatePhase1Scores({ englishProficiency: 75, tradeSkills: 68, iqAptitude: 65 });
      expect(res2.passed).toBe(false);
      expect(res2.nextStatus).toBe('Provisional');

      // IQ fails (< 50)
      const res3 = evaluatePhase1Scores({ englishProficiency: 75, tradeSkills: 85, iqAptitude: 48 });
      expect(res3.passed).toBe(false);
      expect(res3.nextStatus).toBe('Provisional');
    });

    it('Phase 1: Passing all 3 tests advances applicant to Phase 2 (Pending Interview)', () => {
      const res = evaluatePhase1Scores({ englishProficiency: 60, tradeSkills: 70, iqAptitude: 50 });
      expect(res.passed).toBe(true);
      expect(res.nextStatus).toBe('Pending Interview');
    });

    it('Phase 2: Suitability interview passing (Suitable) advances applicant to Phase 3', () => {
      const res = evaluatePhase2Interview('Suitable');
      expect(res.passed).toBe(true);
      expect(res.nextStatus).toBe('Review Score for Medical Referral');
    });

    it('Phase 2: Suitability interview failing (Not Suitable) sets status = Provisional and applicant remains in pipeline', () => {
      const res = evaluatePhase2Interview('Not Suitable');
      expect(res.passed).toBe(false);
      expect(res.nextStatus).toBe('Provisional');
    });

    it('Phase 3: Medical Referral generation is only enabled when ALL scores are passed', () => {
      // Missing EQ
      expect(canGenerateMedicalReferral({ englishProficiency: 80, tradeSkills: 85, iqAptitude: 70, personalityEQ: 'Pending' })).toBe(false);

      // Failing trade score
      expect(canGenerateMedicalReferral({ englishProficiency: 80, tradeSkills: 65, iqAptitude: 70, personalityEQ: 'Suitable' })).toBe(false);

      // All passed
      expect(canGenerateMedicalReferral({ englishProficiency: 80, tradeSkills: 75, iqAptitude: 70, personalityEQ: 'Suitable' })).toBe(true);
    });

    it('Phase 3: Moving applicant to Medical Referral removes them from all Screening sub-phases', () => {
      const readyApplicant: ApplicantRecord = {
        id: '10',
        name: 'Ready Candidate',
        role: 'Welder',
        jobOrder: 'JO-1',
        phase: 1,
        status: 'Review Score for Medical Referral',
        currentHandler: 'Recruitment Staff',
        currentDepartment: 'Recruitment',
        lastUpdated: '',
        phaseDescription: '',
        testScores: { englishProficiency: 80, tradeSkills: 85, iqAptitude: 75, personalityEQ: 'Suitable' }
      };

      // Before move: appears in Phase 3
      const before = filterScreeningSubPhases([readyApplicant]);
      expect(before.phase3.length).toBe(1);

      // After move to Medical Referral
      const transition = moveToMedicalReferral(readyApplicant, 'Makati Medical Center');
      expect(transition.status).toBe('Medical Clearance');
      expect(transition.phase).toBe(2);

      const movedApplicant = { ...readyApplicant, ...transition };
      const after = filterScreeningSubPhases([movedApplicant]);

      // No longer appears in ANY Screening Panel sub-phase!
      expect(after.pool.length).toBe(0);
      expect(after.phase1.length).toBe(0);
      expect(after.phase2.length).toBe(0);
      expect(after.phase3.length).toBe(0);
    });
  });
});
