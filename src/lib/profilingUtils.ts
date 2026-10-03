import { ApplicantRecord } from '../app/types';

// ── Occupational Trade Cluster Definition & Contract ──────────────────────────
export interface OccupationalClusterData {
  cluster_id?: string;
  name: string;
  roles: string[];
  certifications: string[];
  skills: string[];
  description?: string;
  ai_powered?: boolean;
  engine?: string;
}

// Dynamic cluster store fallback
export const OCCUPATIONAL_CLUSTERS: Record<string, OccupationalClusterData> = {};

export function normalizeTokens(text: string): Set<string> {
  if (!text || typeof text !== 'string') return new Set();
  const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const stopwords = new Set([
    'and', 'or', 'the', 'a', 'an', 'of', 'for', 'in', 'to', 'with', 'at', 'by', 'on',
    'level', 'senior', 'junior', 'lead', 'staff', 'registered', 'licensed', 'certified',
    'years', 'year', 'experience', 'required', 'preferred', 'must', 'have', 'works',
    'corp', 'inc', 'co', 'ltd', 'llc', 'center', 'hospital', 'services'
  ]);
  const tokens = cleaned.split(/\s+/).filter(t => t.length > 1 && !stopwords.has(t));
  return new Set(tokens);
}

export function findClusterForText(text: string, clustersMap?: Record<string, any>): { id: string; data: any } | null {
  if (!text) return null;
  const activeClusters = (clustersMap && Object.keys(clustersMap).length > 0) ? clustersMap : OCCUPATIONAL_CLUSTERS;
  const textLower = text.toLowerCase();
  const tokens = normalizeTokens(text);
  for (const [clusterId, clusterData] of Object.entries(activeClusters)) {
    if (textLower.includes(clusterId) || textLower.includes((clusterData.name || '').toLowerCase())) {
      return { id: clusterId, data: clusterData };
    }
    for (const role of (clusterData.roles || [])) {
      if (textLower.includes(role.toLowerCase())) return { id: clusterId, data: clusterData };
      const roleTokens = normalizeTokens(role);
      let match = false;
      for (const t of tokens) {
        if (roleTokens.has(t)) { match = true; break; }
      }
      if (match) return { id: clusterId, data: clusterData };
    }
    for (const sk of (clusterData.skills || [])) {
      if (textLower.includes(sk.toLowerCase())) return { id: clusterId, data: clusterData };
    }
  }
  return null;
}

// ── Applicant Profiling Stage Detection Helper ──────────────────────────────────
// Checks if applicant is currently in the 'Applicant Profiling' stage (after passing screening and medical clearance)
export function isApplicantInProfiling(applicant: ApplicantRecord): boolean {
  if (!applicant) return false;
  const s = String(
    applicant.status ||
    (applicant as any).applicant_status ||
    (applicant as any).status_code ||
    (applicant as any).application_status ||
    ''
  ).trim().toLowerCase();
  if (s === 'medical clearance' || s === 'medical referral' || s === 'provisional' || s === 'initial screening' || s === 'applicant registration') {
    return false;
  }
  return s === 'applicant profiling' || s === 'profiling';
}

// ── Job Order Preference Mismatch Detection ────────────────────────────────────
// Detects if candidate applied for a different job order or role than the currently selected job order
export function getJobOrderMismatchInfo(applicant: ApplicantRecord, currentJobOrder: any): {
  isMismatch: boolean;
  chosenRole?: string;
  chosenJobOrder?: string;
  noticeText: string;
} | null {
  if (!currentJobOrder || !applicant) return null;

  const currentJoRealId = String(currentJobOrder.realId ?? currentJobOrder.job_order_id ?? '').trim();
  const currentJoCode = String(currentJobOrder.id ?? currentJobOrder.code ?? currentJobOrder.job_code ?? '').trim().toLowerCase();
  const currentJoPos = String(currentJobOrder.position ?? currentJobOrder.position_title ?? '').trim().toLowerCase();

  const appJoId = String((applicant as any).job_order_id || (applicant as any).jobOrderId || applicant.selectedJobOrderId || '').trim();
  const appJoCode = String(applicant.jobOrder || '').trim();
  const appRole = String(applicant.appliedPosition || applicant.appliedRole || applicant.role || '').trim();

  const hasAppJoId = Boolean(appJoId && !['undefined', 'null', '0', ''].includes(appJoId));
  const hasAppJoCode = Boolean(appJoCode && !['unassigned', 'undefined', 'null', ''].includes(appJoCode.toLowerCase()));

  // 1. Direct match check: Did candidate directly pick this job order?
  const matchesRealId = Boolean(hasAppJoId && currentJoRealId && appJoId === currentJoRealId);
  const matchesJoCode = Boolean(
    hasAppJoCode &&
    currentJoCode &&
    (appJoCode.toLowerCase() === currentJoCode ||
     appJoCode.toLowerCase().replace(/[^a-z0-9]/g, '') === currentJoCode.replace(/[^a-z0-9]/g, ''))
  );
  const matchesJobPosition = Boolean(
    hasAppJoCode &&
    currentJoPos &&
    (appJoCode.toLowerCase().includes(currentJoPos) || currentJoPos.includes(appJoCode.toLowerCase()))
  );
  const matchesRoleAndNotDifferentJo = Boolean(
    !hasAppJoId &&
    !hasAppJoCode &&
    appRole &&
    currentJoPos &&
    (appRole.toLowerCase().includes(currentJoPos) || currentJoPos.includes(appRole.toLowerCase()))
  );

  // If candidate is specifically tied to this exact job order, there is no mismatch
  if (matchesRealId || matchesJoCode || matchesJobPosition || matchesRoleAndNotDifferentJo) {
    return null;
  }

  // 2. Candidate applied for a different job order, role, or entered the general pool
  let chosenJoDisplay = '';
  if (hasAppJoCode && appJoCode.toLowerCase() !== 'unassigned') {
    chosenJoDisplay = appJoCode;
  } else if (hasAppJoId) {
    chosenJoDisplay = `Job Order #${appJoId}`;
  }

  let pickSummary = '';
  if (chosenJoDisplay && appRole && !chosenJoDisplay.toLowerCase().includes(appRole.toLowerCase())) {
    pickSummary = `${chosenJoDisplay} (${appRole})`;
  } else if (chosenJoDisplay) {
    pickSummary = chosenJoDisplay;
  } else if (appRole) {
    pickSummary = `"${appRole}"`;
  } else {
    pickSummary = 'General Talent Pool';
  }

  return {
    isMismatch: true,
    chosenRole: appRole || undefined,
    chosenJobOrder: chosenJoDisplay || undefined,
    noticeText: `Candidate applied for ${pickSummary}, which differs from this Job Order (${currentJobOrder.position || 'Current Order'}). Recommended based on compatible qualifications, but not the applicant's original selection.`,
  };
}

export interface TakenExamRecord {
  id: string;
  name: string;
  type?: string;
  scoringType: 'numeric' | 'pass_fail';
  score?: number;
  passingScore: number;
  maxScore: number;
  passed: boolean;
  statusText: string;
  weight?: number;
  isJobSpecific?: boolean;
}

export interface RankedCandidate {
  applicant: ApplicantRecord;
  rank: number;
  readinessScore: number;
  matchScore: number;
  assessmentScore: number;
  classification: 'Recommended' | 'For Further Review' | 'Not Recommended';
  clearanceStatus: 'cleared' | 'pending_job_specific' | 'pending_general' | 'failed';
  totalExperienceYears: number;
  certificationsCount: number;
  techScore: number;
  iqScore: number;
  interviewScore: number;
  eqStatus: string;
  eqPass: boolean;
  techPass: boolean;
  iqPass: boolean;
  interviewPass: boolean;
  allGatesPass: boolean;
  hasRecordedAssessments: boolean;
  takenExams: TakenExamRecord[];
  pendingJobSpecificTestNames: string[];
  activeTestResults: Array<{
    id: string;
    name: string;
    type: string;
    scoringType: 'numeric' | 'pass_fail';
    score?: number;
    passingScore: number;
    maxScore: number;
    passed: boolean;
    statusText: string;
    isJobSpecific?: boolean;
    isPendingMandate?: boolean;
  }>;
  compliancePassed: boolean;
  complianceReasons: string[];
  failureReasons: string[];
  categoryScores: {
    roleMatch: number;
    certifications: number;
    experience: number;
    skills: number;
    overseas: number;
  };
  strengths: string[];
  gaps: string[];
  isFirstTimeApplicant: boolean;
  passportStatus: { valid: boolean; status: string; expiry?: string; daysRemaining?: number };
  nbiStatus: { valid: boolean; status: string; expiry?: string; daysRemaining?: number };
  medicalStatus: { valid: boolean; status: string; expiry?: string };
  expiredDocs: Array<{ name: string; expiry: string; type: string }>;
  genderCriteria?: { required: string; candidate: string; isMismatch: boolean; notice?: string };
  ageCriteria?: { minAge?: number; maxAge?: number; candidateAge?: number; isMismatch: boolean; notice?: string };
}

export function getCategoryCandidateExplanation(categoryKey: string, candidate: RankedCandidate, jobOrder: any): string {
  const jobPos = (jobOrder?.position || '').trim();
  const jobCountry = (jobOrder?.country || '').trim();
  const minYears = Number(jobOrder?.minExperience || 1);
  const appRole = candidate.applicant.appliedRole || (candidate.applicant as any).applied_role || (candidate.applicant as any).position || 'Unspecified';

  switch (categoryKey) {
    case 'roleMatch': {
      const score = candidate.categoryScores.roleMatch;
      if (score === 30) {
        return `Candidate applied role '${appRole}' directly matches target position '${jobPos}' : Full 30 / 30 pts awarded.`;
      } else if (score === 25) {
        return `Candidate applied as '${appRole}', but prior work history directly matches target position '${jobPos}' : 25 / 30 pts awarded.`;
      } else if (score === 20) {
        return `Candidate applied role '${appRole}' aligns with '${jobPos}' within the same occupational cluster family : 20 / 30 pts allied transfer credit awarded.`;
      } else if (score === 16) {
        return `Candidate prior work history aligns with the occupational cluster family for '${jobPos}' : 16 / 30 pts allied work credit awarded.`;
      } else {
        return `Candidate profile role '${appRole}' is unrelated to target position '${jobPos}' (different trade cluster) : 0 / 30 pts.`;
      }
    }
    case 'certifications': {
      const score = candidate.categoryScores.certifications;
      const jobCerts = Array.isArray(jobOrder?.certifications) ? jobOrder.certifications : [];
      if (jobCerts.length === 0) {
        return `Job order has no mandatory certifications specified : Full 25 / 25 pts baseline awarded.`;
      }
      if (score === 25) {
        return `Candidate holds all required certifications for ${jobPos} (${jobCerts.join(', ')}) : Full 25 / 25 pts awarded.`;
      } else if (score > 0) {
        return `Candidate holds partial or allied trade credentials, earning ${score} / 25 pts (allied transfer credentials receive 70% credit).`;
      } else {
        return `Candidate missing required certifications: ${jobCerts.join(', ')} : 0 / 25 pts.`;
      }
    }
    case 'experience': {
      const score = candidate.categoryScores.experience;
      if (candidate.isFirstTimeApplicant) {
        if (score >= 20) {
          return `First-time applicant: Verified completion of certified institutional TVET / tertiary education in aligned trade : Full 20 / 20 pts awarded.`;
        } else if (score >= 15) {
          return `First-time applicant: Secondary educational foundation verified in aligned trade : 15 / 20 pts awarded.`;
        } else {
          return `First-time applicant: Educational preparation is in an unrelated field ('${appRole}') : 5 / 20 pts general educational credit.`;
        }
      } else {
        const years = candidate.totalExperienceYears;
        if (candidate.categoryScores.roleMatch > 0) {
          if (years >= minYears + 2) {
            return `Candidate total experience (${years} yrs) exceeds job requirement (${minYears} yrs) by 2+ years : Full 20 / 20 pts awarded.`;
          } else if (years >= minYears) {
            return `Candidate total experience (${years} yrs) meets the required ${minYears} years : 15 / 20 pts awarded.`;
          } else {
            return `Candidate total experience (${years} yr${years > 1 ? 's' : ''}) is below required ${minYears} years : Pro-rated ${score} / 20 pts awarded.`;
          }
        } else {
          return `Candidate's ${years} years experience is in an unrelated field ('${appRole}') rather than '${jobPos}' (req: ${minYears} yrs) : Max 5 / 20 pts non-aligned experience credit awarded.`;
        }
      }
    }
    case 'skills': {
      const score = candidate.categoryScores.skills;
      if (score === 15) {
        return `Candidate profile possesses 2 or more core trade competencies required for '${jobPos}' : Full 15 / 15 pts awarded.`;
      } else if (score === 10) {
        return `Candidate profile matched 1 core trade competency for '${jobPos}' : 10 / 15 pts awarded.`;
      } else {
        return `No matching trade competencies found in candidate skills for '${jobPos}' : 0 / 15 pts.`;
      }
    }
    case 'overseas': {
      const score = candidate.categoryScores.overseas;
      if (score === 10) {
        return `Candidate has verified prior overseas employment in target destination (${jobCountry}) : Full 10 / 10 pts awarded.`;
      } else if (score === 7) {
        return candidate.isFirstTimeApplicant
          ? `First-time applicant neutral overseas baseline (clean record, eligible for deployment) : 7 / 10 pts awarded.`
          : `Candidate has prior international / overseas employment experience outside ${jobCountry} : 7 / 10 pts awarded.`;
      } else if (score === 3) {
        return `Candidate has domestic (Philippine local) experience only; no overseas experience in target destination (${jobCountry}) : 3 / 10 pts.`;
      } else {
        return `No prior employment history recorded : 0 / 10 pts.`;
      }
    }
    default:
      return '';
  }
}
