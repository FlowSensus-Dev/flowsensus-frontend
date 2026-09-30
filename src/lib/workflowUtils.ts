import { ApplicantRecord } from '../app/types';

export function getMedicalTransition(applicant: ApplicantRecord, action: 'Fit' | 'Unfit' | 'Reconsider' | 'StopProcessing'): Partial<ApplicantRecord> {
  switch (action) {
    case 'Fit':
      return {
        phase: 3,
        status: 'Applicant Profiling',
        phaseDescription: 'Medical clearance approved, ready for matching and profiling',
      };
    case 'Unfit':
      return {
        status: 'Provisional',
        phaseDescription: 'Medical outcome Unfit-to-Work. Provisional holding state.',
      };
    case 'Reconsider':
      return {
        status: 'Medical Clearance',
        phaseDescription: 'Re-evaluating medical referral outcome',
      };
    case 'StopProcessing':
      return {
        phase: 0,
        status: 'Processing Stopped',
        phaseDescription: 'Processing terminated due to Unfit-to-Work medical outcome.',
      };
    default:
      return {};
  }
}

export function filterProfilingCandidates(applicants: ApplicantRecord[]) {
  // Candidate must have passed Medical (status Applicant Profiling or CV Encoding)
  const profilingCandidates = applicants.filter(
    a => a.status === 'Applicant Profiling' || a.status === 'CV Encoding'
  );

  // A2 precondition check - uses backend-provided boolean from Examination repository
  const incompleteCandidates = profilingCandidates.filter(a => a.hasCompleteAssessments === false);
  const eligibleCandidates = profilingCandidates.filter(a => a.hasCompleteAssessments !== false);

  return {
    profilingCandidates,
    incompleteCandidates,
    eligibleCandidates,
    hasQualifiedCandidates: eligibleCandidates.length > 0
  };
}

export const ENGLISH_PASS_SCORE = 60;
export const TRADE_PASS_SCORE = 70;
export const IQ_PASS_SCORE = 50;

export function evaluatePhase1Scores(scores: { englishProficiency?: number; tradeSkills?: number; iqAptitude?: number; allPassed?: boolean; tests?: Record<string, any> }) {
  let passed = false;
  if (scores.allPassed !== undefined) {
    passed = Boolean(scores.allPassed);
  } else if (scores.tests && Object.keys(scores.tests).length > 0) {
    passed = Object.values(scores.tests).every((t: any) => Boolean(t.passed));
  } else {
    passed =
      (scores.englishProficiency ?? 0) >= ENGLISH_PASS_SCORE &&
      (scores.tradeSkills ?? 0) >= TRADE_PASS_SCORE &&
      (scores.iqAptitude ?? 0) >= IQ_PASS_SCORE;
  }

  return {
    passed,
    nextStatus: passed ? ('Pending Interview' as const) : ('Provisional' as const),
    phaseDescription: passed
      ? 'Passed all qualification evaluations. Cleared for Phase 2: Personality & EQ Assessment.'
      : 'Provisional holding state — test score criteria unmet. Candidate remains active in pipeline for re-testing.',
  };
}

export function evaluatePhase2Interview(outcome: 'Suitable' | 'Not Suitable') {
  const passed = outcome === 'Suitable';
  return {
    passed,
    nextStatus: passed ? ('Review Score for Medical Referral' as const) : ('Provisional' as const),
    phaseDescription: passed
      ? 'Personality/EQ Assessment passed (Suitable). Ready for Phase 3: Review Score for Medical Referral.'
      : 'Provisional holding state — applicant evaluated as Not Suitable for the job order during Personality/EQ interview. Retained in pipeline.',
  };
}

export function canGenerateMedicalReferral(scores?: { englishProficiency?: number; tradeSkills?: number; iqAptitude?: number; personalityEQ?: string; allPassed?: boolean; tests?: Record<string, any> } | null) {
  if (!scores) return false;
  const isEqSuitable = scores.personalityEQ === 'Suitable';
  if (scores.allPassed !== undefined) {
    return Boolean(scores.allPassed) && isEqSuitable;
  }
  if (scores.tests && Object.keys(scores.tests).length > 0) {
    const allPassed = Object.values(scores.tests).every((t: any) => Boolean(t.passed));
    return allPassed && isEqSuitable;
  }
  return (
    (scores.englishProficiency ?? 0) >= ENGLISH_PASS_SCORE &&
    (scores.tradeSkills ?? 0) >= TRADE_PASS_SCORE &&
    (scores.iqAptitude ?? 0) >= IQ_PASS_SCORE &&
    isEqSuitable
  );
}

export function moveToMedicalReferral(applicant: ApplicantRecord, clinic: string): Partial<ApplicantRecord> {
  return {
    status: 'Medical Clearance',
    phase: 2,
    currentHandler: 'Maria Santos',
    currentDepartment: 'Admin',
    phaseDescription: `Medical referral issued to ${clinic}. Awaiting examination clearance from clinic.`,
  };
}

export function filterScreeningSubPhases(applicants: ApplicantRecord[]) {
  const postScreeningStatuses = [
    'Medical Clearance',
    'Medical Referral',
    'Applicant Profiling',
    'CV Encoding',
    'CV Approval',
    'Endorse to Employer',
    'Under Employer Review',
    'Waiting Selection',
    'Endorse for Administrative Processing',
    'Pre-Deployment Processing',
    'Ready for Deployment',
    'Deployed',
    'Contract Completed',
    'Contract Terminated'
  ];

  const pool = applicants.filter(a => !a.isStopped && a.status !== 'Processing Stopped' && !postScreeningStatuses.includes(a.status));

  const isPhase1Passed = (a: ApplicantRecord) => {
    const ts = a.testScores;
    if (!ts) return false;
    if (ts.allPassed !== undefined) return Boolean(ts.allPassed);
    if (ts.tests && Object.keys(ts.tests).length > 0) {
      return Object.values(ts.tests).every((t: any) => Boolean(t.passed));
    }
    return (
      (ts.englishProficiency ?? 0) >= ENGLISH_PASS_SCORE &&
      (ts.tradeSkills ?? 0) >= TRADE_PASS_SCORE &&
      (ts.iqAptitude ?? 0) >= IQ_PASS_SCORE
    );
  };

  const phase1 = pool.filter(a => {
    if (a.status === 'Provisional') return !isPhase1Passed(a);
    if (a.status === 'Review Score for Medical Referral') return false;
    if (a.status === 'Pending Interview' && isPhase1Passed(a)) return false;
    return !isPhase1Passed(a) || a.status === 'Initial Screening' || a.status === 'Applicant Registration';
  });

  const phase2 = pool.filter(a => {
    if (!isPhase1Passed(a)) return false;
    if (a.status === 'Review Score for Medical Referral') return false;
    return a.testScores?.personalityEQ !== 'Suitable' || a.status === 'Provisional';
  });

  const phase3 = pool.filter(a => {
    if (!isPhase1Passed(a)) return false;
    return a.testScores?.personalityEQ === 'Suitable' && a.status !== 'Provisional';
  });

  return { pool, phase1, phase2, phase3 };
}
