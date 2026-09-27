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
