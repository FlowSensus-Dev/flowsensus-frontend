import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
  ChevronRight,
  Eye,
  Info,
  Briefcase,
  Award,
  Layers,
  FileText,
  X,
  Loader2,
  Send,
  UserCheck,
  TrendingUp,
  ArrowLeft,
  Lock,
  ShieldAlert,
} from 'lucide-react';
import { ApplicantRecord, ActivityLog, WorkflowState } from '../../types';
import { api } from '../../../lib/api';
import ApplicantProfile from './ApplicantProfile';

// ── Occupational Clusters for Allied Trade Credit ──────────────────────────────
export const OCCUPATIONAL_CLUSTERS: Record<string, {
  name: string;
  roles: string[];
  certifications: string[];
  skills: string[];
}> = {
  healthcare: {
    name: 'Healthcare & Patient Care',
    roles: [
      'nurse', 'staff nurse', 'registered nurse', 'rn', 'head nurse', 'icu nurse',
      'caregiver', 'care worker', 'nursing aide', 'home health aide', 'patient care assistant',
      'healthcare assistant', 'midwife', 'physical therapist', 'medical assistant', 'care'
    ],
    certifications: [
      'prc nursing license', 'prc registered nurse', 'prc license', 'bls', 'acls', 'cpr',
      'first aid', 'tesda nc ii - caregiving', 'caregiving nc ii', 'healthcare services nc ii',
      'cna', 'certified nursing assistant'
    ],
    skills: [
      'patient assessment', 'vital signs', 'medication administration', 'iv cannulation',
      'wound care', 'caring', 'elderly care', 'childcare', 'patient hygiene', 'bedside care',
      'emergency response', 'infection control', 'patient advocacy', 'first aid'
    ]
  },
  metalwork_welding: {
    name: 'Metal Fabrication & Industrial Welding',
    roles: [
      'industrial welder', 'welder', 'fabricator', 'pipe welder', 'senior welder',
      'smaw welder', 'gmaw welder', 'fcaw welder', 'tig welder', 'mig welder',
      'fitter', 'pipefitter', 'structural fabricator', 'metal fabricator', 'boilermaker'
    ],
    certifications: [
      'tesda nc ii welding', 'tesda nc ii – smaw', 'tesda nc ii – gmaw', 'tesda nc i welding',
      'tesda nc iii welding', 'cswip 3.1', 'aws d1.1', 'asme welding certification', 'pipe welding certification'
    ],
    skills: [
      'smaw', 'gmaw', 'fcaw', 'tig', 'mig', 'welding', 'pipe welding', 'blueprint reading',
      'wps reading', 'angle grinding', 'fitting', 'ndt awareness', 'metal cutting', 'flame cutting', 'flux cored'
    ]
  },
  electrical_mep: {
    name: 'Electrical & Mechanical Trades (MEP)',
    roles: [
      'electrician', 'building electrician', 'industrial electrician', 'electrical technician',
      'lead electrician', 'lineman', 'wireman', 'maintenance electrician', 'plumber', 'pipe technician',
      'hvac technician', 'refrigeration technician'
    ],
    certifications: [
      'tesda nc ii – electrical', 'tesda nc ii – electrical installation & maintenance',
      'tesda nc ii – building wiring', 'master electrician', 'registered master electrician',
      'osha 10-hour', 'osha 30-hour'
    ],
    skills: [
      'building wiring', 'panel board installation', 'conduit bending', 'electrical troubleshooting',
      'circuit testing', 'preventive maintenance', 'blueprint reading', 'single-phase wiring', 'three-phase wiring'
    ]
  },
  civil_construction: {
    name: 'Civil Construction & Masonry',
    roles: [
      'mason', 'mason helper', 'construction worker', 'tile setter', 'plasterer',
      'bricklayer', 'scaffolder', 'carpenter', 'formwork carpenter', 'painter', 'civil laborer'
    ],
    certifications: [
      'tesda nc ii – masonry', 'tesda nc ii – tile setting', 'tesda nc ii – carpentry',
      'tesda nc ii – scaffolding', 'basic osh', 'dole oshc'
    ],
    skills: [
      'concrete block laying', 'plastering & rendering', 'tile setting', 'form work',
      'basic scaffolding', 'concrete pouring', 'mortar mixing', 'surface preparation'
    ]
  },
  domestic_hospitality: {
    name: 'Domestic Care & Hospitality Services',
    roles: [
      'domestic helper', 'housekeeper', 'maid', 'cleaner', 'care worker',
      'nanny', 'babysitter', 'cook', 'kitchen helper', 'laundry staff'
    ],
    certifications: [
      'tesda nc ii – household services', 'household services nc ii', 'food safety', 'basic first aid'
    ],
    skills: [
      'housekeeping', 'cooking', 'childcare', 'elderly care', 'laundry & ironing',
      'meal preparation', 'cleaning & sanitation', 'household management'
    ]
  },
  heavy_equipment_transport: {
    name: 'Heavy Equipment & Transport Operations',
    roles: [
      'heavy equipment operator', 'backhoe operator', 'excavator operator', 'crane operator',
      'forklift operator', 'truck driver', 'trailer driver', 'bus driver', 'delivery driver'
    ],
    certifications: [
      'tesda nc ii – heavy equipment operation', 'professional driver license', 'restriction 1,2,3,8'
    ],
    skills: [
      'heavy equipment maneuvering', 'pre-operational check', 'defensive driving',
      'cargo securing', 'hydraulic system basic check', 'excavation work'
    ]
  }
};

function normalizeTokens(text: string): Set<string> {
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

function findClusterForText(text: string): { id: string; data: typeof OCCUPATIONAL_CLUSTERS[string] } | null {
  if (!text) return null;
  const textLower = text.toLowerCase();
  const tokens = normalizeTokens(text);
  for (const [clusterId, clusterData] of Object.entries(OCCUPATIONAL_CLUSTERS)) {
    for (const role of clusterData.roles) {
      if (textLower.includes(role)) return { id: clusterId, data: clusterData };
      const roleTokens = normalizeTokens(role);
      let match = false;
      for (const t of tokens) {
        if (roleTokens.has(t)) { match = true; break; }
      }
      if (match) return { id: clusterId, data: clusterData };
    }
  }
  return null;
}

interface SmartProfilingProps {
  showToast: (message: string) => void;
  applicants?: ApplicantRecord[];
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  selectedApplicantId?: string;
  onSelectApplicant?: (applicantId: string) => void;
  onViewApplicant?: (applicantId: string) => void;
  updateApplicant?: (id: number | string, data: Partial<ApplicantRecord>) => void;
  workflow?: WorkflowState;
  globalJobOrders?: any[];
  onNavigate?: (tab: string) => void;
}

export interface RankedCandidate {
  applicant: ApplicantRecord;
  rank: number;
  readinessScore: number;
  matchScore: number;
  assessmentScore: number;
  classification: 'Recommended' | 'For Further Review' | 'Not Recommended';
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
}

function getCategoryCandidateExplanation(categoryKey: string, candidate: RankedCandidate, jobOrder: any): string {
  const jobPos = (jobOrder?.position || '').trim();
  const jobCountry = (jobOrder?.country || '').trim();
  const minYears = Number(jobOrder?.minExperience || 1);
  const appRole = candidate.applicant.appliedRole || (candidate.applicant as any).applied_role || (candidate.applicant as any).position || 'Unspecified';

  switch (categoryKey) {
    case 'roleMatch': {
      const score = candidate.categoryScores.roleMatch;
      if (score === 30) {
        return `Candidate applied role '${appRole}' directly matches target position '${jobPos}' → Full 30 / 30 pts awarded.`;
      } else if (score === 25) {
        return `Candidate applied as '${appRole}', but prior work history directly matches target position '${jobPos}' → 25 / 30 pts awarded.`;
      } else if (score === 20) {
        return `Candidate applied role '${appRole}' aligns with '${jobPos}' within the same occupational cluster family → 20 / 30 pts allied transfer credit awarded.`;
      } else if (score === 16) {
        return `Candidate prior work history aligns with the occupational cluster family for '${jobPos}' → 16 / 30 pts allied work credit awarded.`;
      } else {
        return `Candidate profile role '${appRole}' is unrelated to target position '${jobPos}' (different trade cluster) → 0 / 30 pts.`;
      }
    }
    case 'certifications': {
      const score = candidate.categoryScores.certifications;
      const jobCerts = Array.isArray(jobOrder?.certifications) ? jobOrder.certifications : [];
      if (jobCerts.length === 0) {
        return `Job order has no mandatory certifications specified → Full 25 / 25 pts baseline awarded.`;
      }
      if (score === 25) {
        return `Candidate holds all required certifications for ${jobPos} (${jobCerts.join(', ')}) → Full 25 / 25 pts awarded.`;
      } else if (score > 0) {
        return `Candidate holds partial or allied trade credentials, earning ${score} / 25 pts (allied transfer credentials receive 70% credit).`;
      } else {
        return `Candidate missing required certifications: ${jobCerts.join(', ')} → 0 / 25 pts.`;
      }
    }
    case 'experience': {
      const score = candidate.categoryScores.experience;
      if (candidate.isFirstTimeApplicant) {
        if (score >= 20) {
          return `First-time applicant track (UC-02): Verified completion of certified institutional TVET / tertiary education in aligned trade → Full 20 / 20 pts awarded.`;
        } else if (score >= 15) {
          return `First-time applicant track (UC-02): Secondary educational foundation verified in aligned trade → 15 / 20 pts awarded.`;
        } else {
          return `First-time applicant track (UC-02): Educational preparation is in an unrelated field ('${appRole}') → 5 / 20 pts general educational credit.`;
        }
      } else {
        const years = candidate.totalExperienceYears;
        if (candidate.categoryScores.roleMatch > 0) {
          if (years >= minYears + 2) {
            return `Candidate total experience (${years} yrs) exceeds job requirement (${minYears} yrs) by 2+ years → Full 20 / 20 pts awarded.`;
          } else if (years >= minYears) {
            return `Candidate total experience (${years} yrs) meets the required ${minYears} years → 15 / 20 pts awarded.`;
          } else {
            return `Candidate total experience (${years} yr${years > 1 ? 's' : ''}) is below required ${minYears} years → Pro-rated ${score} / 20 pts awarded.`;
          }
        } else {
          return `Candidate's ${years} years experience is in an unrelated field ('${appRole}') rather than '${jobPos}' (req: ${minYears} yrs) → Max 5 / 20 pts non-aligned experience credit awarded.`;
        }
      }
    }
    case 'skills': {
      const score = candidate.categoryScores.skills;
      if (score === 15) {
        return `Candidate profile possesses 2 or more core trade competencies required for '${jobPos}' → Full 15 / 15 pts awarded.`;
      } else if (score === 10) {
        return `Candidate profile matched 1 core trade competency for '${jobPos}' → 10 / 15 pts awarded.`;
      } else {
        return `No matching trade competencies found in candidate skills for '${jobPos}' → 0 / 15 pts.`;
      }
    }
    case 'overseas': {
      const score = candidate.categoryScores.overseas;
      if (score === 10) {
        return `Candidate has verified prior overseas employment in target destination (${jobCountry}) → Full 10 / 10 pts awarded.`;
      } else if (score === 7) {
        return candidate.isFirstTimeApplicant
          ? `First-time applicant neutral overseas baseline (clean record, eligible for deployment) → 7 / 10 pts awarded.`
          : `Candidate has prior international / overseas employment experience outside ${jobCountry} → 7 / 10 pts awarded.`;
      } else if (score === 3) {
        return `Candidate has domestic (Philippine local) experience only; no overseas experience in target destination (${jobCountry}) → 3 / 10 pts.`;
      } else {
        return `No prior employment history recorded → 0 / 10 pts.`;
      }
    }
    default:
      return '';
  }
}

export default function SmartProfiling({
  showToast,
  applicants = [],
  currentUserName,
  addActivityLog,
  selectedApplicantId,
  onSelectApplicant,
  onViewApplicant,
  updateApplicant,
  workflow,
  globalJobOrders,
  onNavigate,
}: SmartProfilingProps) {
  const [jobOrders, setJobOrders] = useState<any[]>([]);
  const [selectedJobOrderId, setSelectedJobOrderId] = useState<string>('');
  const [isLoadingJobs, setIsLoadingJobs] = useState<boolean>(false);
  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const [activeModalCandidate, setActiveModalCandidate] = useState<RankedCandidate | null>(null);
  const [overlayApplicant, setOverlayApplicant] = useState<ApplicantRecord | null>(null);
  const [expandedCategoryHelp, setExpandedCategoryHelp] = useState<string | null>(null);

  // Keyboard shortcut listener to close overlays on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (overlayApplicant) {
          setOverlayApplicant(null);
        } else if (activeModalCandidate) {
          setActiveModalCandidate(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [overlayApplicant, activeModalCandidate]);

  // 1. Fetch live job orders with vacancy counts
  useEffect(() => {
    const fetchLiveJobOrders = async () => {
      setIsLoadingJobs(true);
      try {
        const res = globalJobOrders ? { data: globalJobOrders } : await api.get('/job-orders');
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const liveOrders = res.data.map((jo: any) => {
            const total = Number(jo.total_slots ?? 0);
            const filled = Number(jo.filled_slots ?? 0);
            const vacancies = Math.max(0, total - filled);
            const code = jo.job_code || jo.job_order_code || (jo.job_order_id ? `JO-2026-${String(jo.job_order_id).padStart(4, '0')}` : 'JO-0000');
            return {
              realId: jo.job_order_id,
              id: code,
              position: jo.position || jo.position_title || 'General Position',
              country: jo.country || jo.client_employer?.country?.country_name || 'International',
              employer: jo.employer_name || jo.client_employer?.company_name || 'Partner Principal',
              employerId: jo.employer_id,
              totalSlots: total,
              filledSlots: filled,
              vacancies,
              minExperience: Number(jo.min_experience_years ?? 1),
              certifications: Array.isArray(jo.certifications) ? jo.certifications : (jo.required_certifications || []),
              requirements: Array.isArray(jo.requirements) ? jo.requirements : (jo.required_skills || []),
            };
          });
          setJobOrders(liveOrders);

          if (!selectedJobOrderId && liveOrders.length > 0) {
            const firstWithVacancies = liveOrders.find((j: any) => j.vacancies > 0) || liveOrders[0];
            setSelectedJobOrderId(String(firstWithVacancies.realId));
          }
        }
      } catch (err) {
        console.warn('Could not fetch live job orders for smart profiling:', err);
      } finally {
        setIsLoadingJobs(false);
      }
    };
    fetchLiveJobOrders();
  }, [globalJobOrders]);

  // Selected job order object
  const currentJobOrder = useMemo(() => {
    return jobOrders.find((j) => String(j.realId) === String(selectedJobOrderId)) || jobOrders[0] || null;
  }, [jobOrders, selectedJobOrderId]);

  // Filter pool: Applicants actively in 'Applicant Profiling' pipeline stage per UC-03
  const candidatePool = useMemo(() => {
    return applicants.filter((a) => {
      if (a.isStopped) return false;
      return a.status === 'Applicant Profiling';
    });
  }, [applicants]);

  // A2 Precondition check: candidates with complete assessments vs incomplete
  const { eligibleCandidates, incompleteCandidates } = useMemo(() => {
    const eligible: ApplicantRecord[] = [];
    const incomplete: ApplicantRecord[] = [];

    candidatePool.forEach((a) => {
      const hasScores = Boolean(a.testScores);
      const hasEq = Boolean(a.testScores?.personalityEQ);
      const hasSkills = a.testScores?.tradeSkills !== undefined && a.testScores?.tradeSkills !== null;
      const hasIq = a.testScores?.iqAptitude !== undefined && a.testScores?.iqAptitude !== null;

      if (a.hasCompleteAssessments === false || !hasScores || !hasEq || !hasSkills || !hasIq) {
        incomplete.push(a);
      } else {
        eligible.push(a);
      }
    });

    return { eligibleCandidates: eligible, incompleteCandidates: incomplete };
  }, [candidatePool]);

  // 2. Evaluate and Rank Candidates using Dynamic Job-Fit / Readiness Scoring Engine
  const rankedCandidates: RankedCandidate[] = useMemo(() => {
    if (!currentJobOrder || eligibleCandidates.length === 0) return [];

    const jobPos = (currentJobOrder.position || '').trim();
    const jobCountry = (currentJobOrder.country || '').trim();
    const minYears = Number(currentJobOrder.minExperience || 1);

    const targetClusterInfo = findClusterForText(jobPos);
    const targetClusterId = targetClusterInfo?.id;
    const targetClusterData = targetClusterInfo?.data;

    const evaluated: Omit<RankedCandidate, 'rank'>[] = eligibleCandidates.map((applicant) => {
      const techScore = Number(applicant.testScores?.tradeSkills ?? 0);
      const iqScore = Number(applicant.testScores?.iqAptitude ?? 0);
      const interviewScore = Number(
        applicant.testScores?.languageProficiency ??
        applicant.testScores?.englishProficiency ??
        (applicant as any).interview_score ??
        (applicant as any).language_proficiency ??
        0
      );
      const eqStatus = String(applicant.testScores?.personalityEQ ?? 'Missing');

      const validScores = [techScore, iqScore, interviewScore].filter((s) => s > 0);
      const assessmentScore = validScores.length > 0
        ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10) / 10
        : 0;

      // Core Examination Clearance Gates
      const techPass = techScore >= 70;
      const iqPass = iqScore >= 50;
      const interviewPass = interviewScore >= 60;
      const eqPass = eqStatus.trim().toLowerCase() === 'suitable';
      const allGatesPass = techPass && iqPass && interviewPass && eqPass;

      const strengths: string[] = [];
      const gaps: string[] = [];

      const appRole = (applicant.appliedRole || (applicant as any).applied_role || (applicant as any).position || '').trim();
      const history = applicant.employmentHistory || applicant.workExperience || [];
      const appClusterInfo = findClusterForText(appRole);
      const appClusterId = appClusterInfo?.id;

      // ── 1. Role / Position Match (Max: 30 pts) ──────────────────────────
      const targetTokens = normalizeTokens(jobPos);
      const appRoleTokens = normalizeTokens(appRole);

      const historyPositions: string[] = [];
      history.forEach((h: any) => {
        if (h.position || h.title) historyPositions.push(String(h.position || h.title));
      });
      const historyTokens = new Set<string>();
      historyPositions.forEach((hp) => {
        normalizeTokens(hp).forEach((t) => historyTokens.add(t));
      });

      let roleScore = 0;

      let hasTargetInRole = false;
      for (const t of targetTokens) {
        if (appRoleTokens.has(t)) { hasTargetInRole = true; break; }
      }

      let hasTargetInHistory = false;
      for (const t of targetTokens) {
        if (historyTokens.has(t)) { hasTargetInHistory = true; break; }
      }

      if (!jobPos) {
        roleScore = 30;
      } else if (hasTargetInRole) {
        roleScore = 30;
        strengths.push(`Target position '${jobPos}' directly matches candidate applied role '${appRole}'`);
      } else if (hasTargetInHistory) {
        roleScore = 25;
        strengths.push(`Prior work history directly matches target position '${jobPos}'`);
      } else if (targetClusterId && appClusterId && targetClusterId === appClusterId) {
        roleScore = 20; // Related Trade Cluster credit
        strengths.push(`Allied trade background: '${appRole}' aligns with '${jobPos}' in the ${targetClusterData?.name} cluster (20/30 pts credit)`);
      } else if (targetClusterId && historyPositions.some((hp) => findClusterForText(hp)?.id === targetClusterId)) {
        roleScore = 16;
        strengths.push(`Candidate prior employment history aligns with the ${targetClusterData?.name} cluster (16/30 pts credit)`);
      } else {
        roleScore = 0;
        const clusterNote = targetClusterData ? ` (${targetClusterData.name})` : '';
        gaps.push(`Role mismatch: candidate profile ('${appRole || 'Unspecified'}') does not match target position '${jobPos}'${clusterNote}`);
      }

      // ── 2. Required Certifications (Max: 25 pts) ────────────────────────
      const jobCertsRaw: string[] = Array.isArray(currentJobOrder.certifications) ? currentJobOrder.certifications : [];
      const appCertsRaw: string[] = Array.isArray(applicant.certifications)
        ? applicant.certifications.map((c: any) => (typeof c === 'string' ? c : c.name || c.title || ''))
        : (applicant.certificateRecords || []).map((c: any) => c.title || '');

      const appCertsLower = appCertsRaw.map((c) => c.toLowerCase());
      let certScore = 0;

      if (jobCertsRaw.length === 0) {
        certScore = 25;
        strengths.push('No mandatory certifications required for this position');
      } else {
        let totalCertPts = 0;
        const ptsPerCert = 25.0 / jobCertsRaw.length;

        for (const jc of jobCertsRaw) {
          const jcLower = jc.toLowerCase();
          const jcTokens = normalizeTokens(jc);
          let isDirectMatch = false;
          let isAlliedMatch = false;
          let matchedCertName = '';

          for (const ac of appCertsLower) {
            if (jcLower.includes(ac) || ac.includes(jcLower)) {
              isDirectMatch = true;
              matchedCertName = ac;
              break;
            }
            const acTokens = normalizeTokens(ac);
            const credentialMeta = new Set(['tesda', 'nc', 'ii', 'i', 'iii', 'iv', 'nc1', 'nc2', 'nc3', 'nc4', 'certificate', 'certification', 'license']);
            const jcTrade = new Set([...jcTokens].filter(t => !credentialMeta.has(t)));
            const acTrade = new Set([...acTokens].filter(t => !credentialMeta.has(t)));
            let tradeMatch = false;
            jcTrade.forEach((t) => { if (acTrade.has(t)) tradeMatch = true; });
            if (!tradeMatch && ((acTrade.has('smaw') || acTrade.has('gmaw')) && jcTrade.has('welding'))) {
              tradeMatch = true;
            }
            if (tradeMatch) {
              isDirectMatch = true;
              matchedCertName = ac;
              break;
            }
          }

          if (!isDirectMatch && targetClusterData) {
            for (const ac of appCertsLower) {
              for (const cc of targetClusterData.certifications) {
                if (cc.includes(ac) || ac.includes(cc)) {
                  isAlliedMatch = true;
                  matchedCertName = ac;
                  break;
                }
              }
              if (isAlliedMatch) break;
            }
          }

          if (isDirectMatch) {
            totalCertPts += ptsPerCert;
            strengths.push(`Holds required certification: ${jc}`);
          } else if (isAlliedMatch) {
            totalCertPts += ptsPerCert * 0.7; // 70% allied transfer credit
            strengths.push(`Holds allied credential in ${targetClusterData?.name}: ${matchedCertName} (70% transfer credit)`);
          } else {
            gaps.push(`Missing required certification: ${jc}`);
          }
        }
        certScore = Math.min(25, Math.round(totalCertPts * 10) / 10);
      }

      // ── 3. Experience / Education Foundation (Max: 20 pts) ──────────────
      const isFirstTimeApplicant = history.length === 0;
      let expScore = 0;
      let totalExperienceYears = 0;

      if (isFirstTimeApplicant) {
        // First-Time Applicant track per UC-02
        const education = applicant.education || [];
        const hasCollegeOrTvet = education.some((edu: any) => {
          const lvl = (edu.level || '').toLowerCase();
          const deg = (edu.degree || '').toLowerCase();
          return lvl.includes('college') || lvl.includes('vocational') || lvl.includes('tvet') || deg.includes('bachelor') || deg.includes('nc ii');
        }) || appCertsRaw.length > 0;

        if (roleScore > 0) {
          if (hasCollegeOrTvet) {
            expScore = 20.0;
            strengths.push('First-time applicant — no prior work experience (not a disqualifying factor); completed certified institutional TVET / tertiary education');
          } else {
            expScore = 15.0;
            strengths.push('First-time applicant — no prior work experience (not a disqualifying factor); secondary educational foundation verified');
          }
        } else {
          expScore = 5.0;
          gaps.push(`First-time applicant's educational preparation is in an unrelated field ('${appRole || 'Unspecified'}'); position requires vocational alignment in '${jobPos}'`);
        }
      } else {
        for (const item of history) {
          const rec = item as any;
          const startYear = parseInt((rec.startDate || rec.dateStarted || '').slice(0, 4), 10);
          const endYear = !rec.endDate || rec.endDate.toLowerCase() === 'present' || rec.isPresent
            ? new Date().getFullYear()
            : parseInt((rec.endDate || rec.dateEnded || '').slice(0, 4), 10);
          if (!isNaN(startYear) && !isNaN(endYear) && endYear >= startYear) {
            totalExperienceYears += Math.max(1, endYear - startYear);
          } else {
            totalExperienceYears += 1;
          }
        }

        if (roleScore > 0) {
          if (totalExperienceYears >= minYears + 2) {
            expScore = 20.0;
            strengths.push(`Total experience of ${totalExperienceYears} years exceeds required ${minYears} years`);
          } else if (totalExperienceYears >= minYears) {
            expScore = 15.0;
            strengths.push(`Total experience of ${totalExperienceYears} years meets required ${minYears} years`);
          } else if (totalExperienceYears > 0) {
            expScore = Math.round((totalExperienceYears / Math.max(1, minYears)) * 10);
            gaps.push(`Experience duration gap: has ${totalExperienceYears} year(s), job order requires ${minYears} years`);
          } else {
            expScore = 0;
            gaps.push(`No recorded employment history; job order requires ${minYears} years`);
          }
        } else {
          expScore = Math.min(5, Math.round((totalExperienceYears / Math.max(1, minYears)) * 5));
          gaps.push(`Candidate's ${totalExperienceYears} years experience is in an unrelated field ('${appRole || 'Unspecified'}'); position requires ${minYears} years in '${jobPos}'`);
        }
      }

      // ── 4. Skills & Requirements Overlap (Max: 15 pts) ───────────────────
      const appSkills: string[] = Array.isArray(applicant.skills) ? applicant.skills : [];
      const targetKeywords = new Set<string>();
      targetTokens.forEach((t) => targetKeywords.add(t));
      if (targetClusterData) {
        targetClusterData.roles.forEach((r) => normalizeTokens(r).forEach((t) => targetKeywords.add(t)));
      }

      const matchedSkills: string[] = [];
      appSkills.forEach((sk) => {
        const skLower = sk.toLowerCase();
        const skTokens = normalizeTokens(sk);
        let match = false;
        for (const t of skTokens) {
          if (targetKeywords.has(t)) { match = true; break; }
        }
        if (match) {
          matchedSkills.push(sk);
        } else if (targetClusterData && targetClusterData.skills.some((cs) => cs.includes(skLower) || skLower.includes(cs))) {
          matchedSkills.push(sk);
        }
      });

      let skillScore = 0;
      if (matchedSkills.length >= 2) {
        skillScore = 15.0;
        strengths.push(`Matched core trade competencies: ${matchedSkills.slice(0, 3).join(', ')}`);
      } else if (matchedSkills.length === 1) {
        skillScore = 10.0;
        strengths.push(`Matched core trade competency: ${matchedSkills[0]}`);
      } else {
        skillScore = 0;
        if (jobPos) gaps.push(`No matching trade skills found for '${jobPos}'`);
      }

      // ── 5. Overseas / Destination Readiness (Max: 10 pts) ──────────────
      let overseasScore = 0;
      if (isFirstTimeApplicant) {
        overseasScore = 7.0;
        strengths.push('First-time applicant — pristine deployment record (eligible for overseas placement)');
      } else {
        let hasDestExp = false;
        let hasOverseasExp = false;

        history.forEach((h: any) => {
          const c = (h.country || '').trim().toLowerCase();
          const isOv = Boolean(h.isOverseas || (c && !['philippines', 'ph', 'local'].includes(c)));
          if (jobCountry && c === jobCountry.toLowerCase()) {
            hasDestExp = true;
            hasOverseasExp = true;
          } else if (isOv) {
            hasOverseasExp = true;
          }
        });

        if (hasDestExp) {
          overseasScore = 10.0;
          strengths.push(`Prior overseas employment experience in target destination (${jobCountry})`);
        } else if (hasOverseasExp) {
          overseasScore = 7.0;
          strengths.push('Prior overseas employment experience');
        } else if (history.length > 0) {
          overseasScore = 3.0;
          if (jobCountry) gaps.push(`Local experience only; no overseas experience in target destination (${jobCountry})`);
        } else {
          overseasScore = 0;
        }
      }

      // ── 6. Document & Certification Expiration Audit ───────────────────
      const now = new Date();
      const expiredDocs: Array<{ name: string; expiry: string; type: string }> = [];

      let passportStatus = {
        valid: true,
        status: 'Verified (>= 60 days)',
        expiry: undefined as string | undefined,
        daysRemaining: undefined as number | undefined,
      };

      let nbiStatus = {
        valid: true,
        status: 'Verified (>= 30 days)',
        expiry: undefined as string | undefined,
        daysRemaining: undefined as number | undefined,
      };

      const medicalStatus = {
        valid: true,
        status: 'Verified Fit-to-Work',
        expiry: undefined as string | undefined,
      };

      const identifications = (applicant as any).identifications || [];
      if (Array.isArray(identifications)) {
        identifications.forEach((doc: any) => {
          const docType = (doc.type || doc.idType || 'Document').trim();
          const docTypeLower = docType.toLowerCase();
          const expiryStr = (doc.expiry || doc.expiryDate || doc.expiration_date || '').trim();

          if (expiryStr) {
            const expDate = new Date(expiryStr);
            if (!isNaN(expDate.getTime())) {
              const daysRemaining = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const formattedExp = expiryStr.slice(0, 10);

              if (daysRemaining < 0) {
                // Document is expired!
                gaps.push(`Expired document: ${docType} expired on ${formattedExp} (renewal required for DMW/POEA compliance)`);
                expiredDocs.push({ name: docType, expiry: formattedExp, type: docType });

                if (docTypeLower.includes('passport')) {
                  passportStatus = { valid: false, status: `Expired on ${formattedExp} (Renewal required)`, expiry: formattedExp, daysRemaining };
                } else if (docTypeLower.includes('nbi')) {
                  nbiStatus = { valid: false, status: `Expired on ${formattedExp} (Renewal required)`, expiry: formattedExp, daysRemaining };
                } else if (docTypeLower.includes('medical')) {
                  medicalStatus.valid = false;
                  medicalStatus.status = `Expired on ${formattedExp} (Re-clearance required)`;
                }
              } else if (docTypeLower.includes('passport')) {
                if (daysRemaining < 60) {
                  gaps.push(`Passport validity warning: Passport expires in ${daysRemaining} days on ${formattedExp} (DMW requires >= 60 days)`);
                  passportStatus = { valid: false, status: `Expires soon in ${daysRemaining} days (< 60 days)`, expiry: formattedExp, daysRemaining };
                } else {
                  passportStatus = { valid: true, status: `Verified (expires ${formattedExp} • ${daysRemaining}d remaining)`, expiry: formattedExp, daysRemaining };
                }
              } else if (docTypeLower.includes('nbi')) {
                if (daysRemaining < 30) {
                  gaps.push(`NBI clearance warning: NBI clearance expires in ${daysRemaining} days on ${formattedExp} (minimum 30 days required)`);
                  nbiStatus = { valid: false, status: `Expires soon in ${daysRemaining} days (< 30 days)`, expiry: formattedExp, daysRemaining };
                } else {
                  nbiStatus = { valid: true, status: `Verified (expires ${formattedExp} • ${daysRemaining}d remaining)`, expiry: formattedExp, daysRemaining };
                }
              }
            }
          }
        });
      }

      // Check certificateRecords
      const certificateRecords = applicant.certificateRecords || [];
      if (Array.isArray(certificateRecords)) {
        certificateRecords.forEach((cert: any) => {
          if (cert.expiryDate) {
            const expDate = new Date(cert.expiryDate);
            if (!isNaN(expDate.getTime()) && expDate < now) {
              const formattedExp = cert.expiryDate.slice(0, 10);
              gaps.push(`Expired certification: ${cert.title} expired on ${formattedExp}`);
              expiredDocs.push({ name: cert.title, expiry: formattedExp, type: 'Certification' });
            }
          }
        });
      }

      // Overall Readiness Score
      const readinessScore = Math.min(100, Math.max(0, Math.round(roleScore + certScore + expScore + skillScore + overseasScore)));

      // Three-tier analytical classification per UC-03 Option 2 (80% / 60%)
      let classification: 'Recommended' | 'For Further Review' | 'Not Recommended';
      if (allGatesPass && readinessScore >= 80) {
        classification = 'Recommended';
      } else if (allGatesPass && readinessScore >= 60) {
        classification = 'For Further Review';
      } else {
        classification = 'Not Recommended';
      }

      // Diagnostic failure reasons
      const failureReasons: string[] = [];
      if (!eqPass) {
        failureReasons.push(`EQ Assessment is '${eqStatus}' (baseline requires 'Suitable')`);
      }
      if (!techPass) {
        failureReasons.push(`Technical Skills test score: ${techScore}% (requires >= 70%)`);
      }
      if (!iqPass) {
        failureReasons.push(`IQ / Aptitude test score: ${iqScore}% (requires >= 50%)`);
      }
      if (!interviewPass) {
        failureReasons.push(`Interview / Language score: ${interviewScore}% (requires >= 60%)`);
      }
      if (allGatesPass && readinessScore < 60) {
        failureReasons.push(`Readiness score (${readinessScore}%) is below the 60% threshold for ${jobPos}`);
      }

      const compliancePassed = passportStatus.valid && nbiStatus.valid && medicalStatus.valid;
      const complianceReasons = [];
      if (!passportStatus.valid) complianceReasons.push(`Passport: ${passportStatus.status}`);
      if (!nbiStatus.valid) complianceReasons.push(`NBI Clearance: ${nbiStatus.status}`);
      if (!medicalStatus.valid) complianceReasons.push(`Medical: ${medicalStatus.status}`);

      return {
        applicant,
        readinessScore,
        matchScore: readinessScore,
        assessmentScore,
        classification,
        totalExperienceYears,
        certificationsCount: appCertsRaw.length,
        techScore,
        iqScore,
        interviewScore,
        eqStatus,
        eqPass,
        techPass,
        iqPass,
        interviewPass,
        allGatesPass,
        compliancePassed,
        complianceReasons,
        failureReasons,
        categoryScores: {
          roleMatch: roleScore,
          certifications: certScore,
          experience: expScore,
          skills: skillScore,
          overseas: overseasScore,
        },
        strengths,
        gaps,
        isFirstTimeApplicant,
        passportStatus,
        nbiStatus,
        medicalStatus,
        expiredDocs,
      };
    });

    // Sorting: Tier (Recommended > Review > Not Recommended) -> Readiness Score desc -> Experience desc
    const tierWeight = {
      Recommended: 0,
      'For Further Review': 1,
      'Not Recommended': 2,
    };

    evaluated.sort((a, b) => {
      const tierDiff = tierWeight[a.classification] - tierWeight[b.classification];
      if (tierDiff !== 0) return tierDiff;
      if (b.readinessScore !== a.readinessScore) return b.readinessScore - a.readinessScore;
      return b.totalExperienceYears - a.totalExperienceYears;
    });

    return evaluated.map((cand, index) => ({
      ...cand,
      rank: index + 1,
    }));
  }, [eligibleCandidates, currentJobOrder]);

  // KPI Header Counts
  const totalEvaluated = rankedCandidates.length;
  const recommendedCount = rankedCandidates.filter((c) => c.classification === 'Recommended').length;
  const reviewCount = rankedCandidates.filter((c) => c.classification === 'For Further Review').length;
  const notRecommendedCount = rankedCandidates.filter((c) => c.classification === 'Not Recommended').length;

  // Handler: Open Candidate Profile Overlay directly without leaving the screen
  const handleOpenProfileOverlay = (applicant: ApplicantRecord) => {
    setOverlayApplicant(applicant);
  };

  // Handler: Endorse / Forward candidate to CV Encoding (executed from inside Review Details modal)
  const handleEndorseCandidate = async (candidate: RankedCandidate) => {
    // Hard barrier: Candidate cannot be endorsed if they have expired or invalid documents
    if (!candidate.compliancePassed || candidate.expiredDocs.length > 0) {
      const expiredNames = candidate.expiredDocs.map((d) => d.name).join(', ') || 'Statutory Clearance';
      showToast(`⚠️ Endorsement Blocked: Candidate has expired document(s) (${expiredNames}). Renewal required before endorsement.`);
      return;
    }

    try {
      if (updateApplicant) {
        updateApplicant(candidate.applicant.id, {
          status: 'CV Encoding',
          phase: 4,
          phaseDescription: `Endorsed to ${currentJobOrder?.position || 'Job Order'} (#${currentJobOrder?.id || ''})`,
        });
      }

      try {
        await api.put(`/applicants/${candidate.applicant.id}`, {
          application_status: 'CV Encoding',
        });
      } catch (apiErr) {
        console.warn('Backend update failed (continuing with local state):', apiErr);
      }

      addActivityLog({
        applicantId: String(candidate.applicant.id),
        action: 'Endorsed for CV Encoding',
        performedBy: currentUserName,
        department: 'Recruitment',
        details: `Candidate endorsed to Job Order: ${currentJobOrder?.position} (#${currentJobOrder?.id}). Readiness Score: ${candidate.readinessScore}%, Classification: ${candidate.classification}.`,
      });

      showToast(`✓ ${candidate.applicant.name} endorsed to ${currentJobOrder?.position}. Forwarded to CV Encoding.`);
      setActiveModalCandidate(null);
    } catch (err) {
      showToast('Failed to endorse candidate. Please try again.');
    }
  };

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Page Title & Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 shadow-sm">
              <Sparkles className="w-5 h-5 text-[#F59E0B]" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-[#0F172A] flex items-center gap-2">
                Smart Applicant Recommendations
              </h2>
              <p className="text-xs font-medium text-[#64748B] mt-0.5">
                Advanced readiness analytics cross-evaluating candidate qualifications against active foreign job orders.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Step 1: Select Active Foreign Job Order to Fill */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 md:p-6 transition-all">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black inline-flex items-center justify-center">
            1
          </span>
          Step 1: Select Active Foreign Job Order to Fill
        </h3>

        <div className="relative">
          <select
            value={selectedJobOrderId}
            onChange={(e) => setSelectedJobOrderId(e.target.value)}
            disabled={isLoadingJobs}
            className="w-full border-2 border-slate-200 hover:border-slate-300 focus:border-[#20637A] bg-white px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-900 outline-none transition-all shadow-sm disabled:opacity-50 cursor-pointer appearance-none pr-10"
          >
            {isLoadingJobs ? (
              <option value="">Loading job orders...</option>
            ) : jobOrders.length === 0 ? (
              <option value="">No active foreign job orders found</option>
            ) : (
              jobOrders.map((jo) => (
                <option key={jo.realId} value={jo.realId}>
                  {jo.position} - {jo.country} - #{jo.id} (Available Vacancies: {jo.vacancies})
                </option>
              ))
            )}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
            <ChevronRight className="w-4 h-4 rotate-90" />
          </div>
        </div>
      </div>

      {/* Step 2: Ranked Candidate Shortlist */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all">
        {/* Section Header with KPI Summary & Info Tooltip */}
        <div className="p-5 md:p-6 border-b border-slate-200">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black inline-flex items-center justify-center">
                  2
                </span>
                Step 2: Ranked Candidate Shortlist for {currentJobOrder?.position || 'Job Order'} #{currentJobOrder?.id || ''}
              </h3>

              {/* KPI Header Bar */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-600 mt-2">
                <span>
                  Total Applicants Evaluated: <strong className="text-slate-900 font-extrabold">{totalEvaluated}</strong>
                </span>
                <span className="text-slate-300 font-light">|</span>
                <span className="text-emerald-700">
                  Recommended: <strong className="font-extrabold">{recommendedCount}</strong>
                </span>
                <span className="text-slate-300 font-light">|</span>
                <span className="text-amber-700">
                  For Further Review: <strong className="font-extrabold">{reviewCount}</strong>
                </span>
                <span className="text-slate-300 font-light">|</span>
                <span className="text-red-700">
                  Not Recommended: <strong className="font-extrabold">{notRecommendedCount}</strong>
                </span>
              </div>
            </div>

            {/* Info Tooltip (A2 diagnostic transparency) */}
            <div className="relative self-start lg:self-center">
              <button
                type="button"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onClick={() => setShowTooltip(!showTooltip)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                title="Assessment calculation details"
              >
                <Info className="w-4 h-4" />
                <span className="text-[11px] text-slate-500 font-semibold hidden sm:inline">Audit Info</span>
              </button>

              {showTooltip && (
                <div className="absolute right-0 top-8 z-30 w-72 p-3 bg-slate-900 text-white text-xs rounded-xl shadow-xl border border-slate-700 animate-in fade-in zoom-in-95 duration-150">
                  <p className="font-semibold text-slate-100 leading-snug">
                    *Readiness scores calculated dynamically based on target job order requirements and verified candidate profiles.
                  </p>
                  {incompleteCandidates.length > 0 && (
                    <p className="text-amber-400 mt-1.5 text-[11px]">
                      {incompleteCandidates.length} profile(s) excluded due to incomplete assessment scores or pending evaluation.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Ranked Candidate Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4 text-center w-14">Rank</th>
                <th className="py-3 px-4 min-w-[200px]">Applicant & ID</th>
                <th className="py-3 px-4 text-center min-w-[130px]">Readiness Score (%)</th>
                <th className="py-3 px-4 text-center min-w-[140px]">Classification</th>
                <th className="py-3 px-4 text-center min-w-[120px]">Total Experience</th>
                <th className="py-3 px-4 text-center min-w-[120px]">Key Certifications</th>
                <th className="py-3 px-4 min-w-[240px]">Assessment Summary</th>
                <th className="py-3 px-4 text-right min-w-[220px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {rankedCandidates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-medium">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No candidates found in the profiling pipeline for this job order.
                  </td>
                </tr>
              ) : (
                rankedCandidates.map((candidate) => {
                  const applicantCode =
                    candidate.applicant.applicantCode ||
                    (candidate.applicant.id ? `#APP-2026-FP-${String(candidate.applicant.id).padStart(5, '0')}` : '#APP-00000');

                  const initials = candidate.applicant.name
                    ? candidate.applicant.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                    : 'AP';

                  return (
                    <tr
                      key={candidate.applicant.id}
                      onClick={() => setActiveModalCandidate(candidate)}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                    >
                      {/* 1. Rank */}
                      <td className="py-4 px-4 text-center font-black text-slate-900 text-sm">
                        #{candidate.rank}
                      </td>

                      {/* 2. Applicant & ID */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-200 border border-slate-300 overflow-hidden flex items-center justify-center flex-shrink-0 text-slate-700 font-bold text-xs shadow-inner">
                            {candidate.applicant.photoDataUrl || candidate.applicant.photo ? (
                              <img
                                src={candidate.applicant.photoDataUrl || candidate.applicant.photo}
                                alt={candidate.applicant.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>{initials}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-slate-900 text-sm truncate">
                                {candidate.applicant.name}
                              </p>
                              {candidate.expiredDocs.length > 0 && (
                                <span
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300"
                                  title={`Expired Document: ${candidate.expiredDocs.map((d) => d.name).join(', ')} (Renewal required)`}
                                >
                                  <AlertCircle className="w-2.5 h-2.5 text-amber-600" />
                                  <span>Expired Doc</span>
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-slate-500 tracking-tight">
                              {applicantCode}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* 3. Readiness Score (%) */}
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="font-black text-base text-slate-900 font-mono">
                            {candidate.readinessScore}%
                          </span>
                        </div>
                      </td>

                      {/* 4. Classification Badge (Option 2: 80% / 60%) */}
                      <td className="py-4 px-4 text-center">
                        {candidate.classification === 'Recommended' && (
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold bg-[#10B981] text-white shadow-sm">
                            Recommended
                          </span>
                        )}
                        {candidate.classification === 'For Further Review' && (
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold bg-[#F59E0B] text-slate-950 shadow-sm">
                            For Further Review
                          </span>
                        )}
                        {candidate.classification === 'Not Recommended' && (
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold bg-[#EF4444] text-white shadow-sm">
                            Not Recommended
                          </span>
                        )}
                      </td>

                      {/* 5. Total Experience */}
                      <td className="py-4 px-4 text-center font-semibold text-slate-700">
                        {candidate.isFirstTimeApplicant ? (
                          <span className="text-[11px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            First-Time
                          </span>
                        ) : (
                          `${candidate.totalExperienceYears} yrs`
                        )}
                      </td>

                      {/* 6. Key Certifications */}
                      <td className="py-4 px-4 text-center font-semibold text-slate-700">
                        {candidate.certificationsCount === 0
                          ? 'None'
                          : candidate.certificationsCount === 1
                          ? '1 Cert'
                          : `${candidate.certificationsCount} Certs`}
                      </td>

                      {/* 7. Assessment Summary (Technical, Language, IQ, and EQ) */}
                      <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-1.5 min-w-[230px]">
                          {/* Technical Bar */}
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase w-16 flex-shrink-0">
                              Technical
                            </span>
                            <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  candidate.techPass ? 'bg-[#20637A]' : 'bg-red-400'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, candidate.techScore))}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono font-bold text-slate-700 w-8 text-right">
                              {candidate.techScore}%
                            </span>
                          </div>

                          {/* Language Proficiency Bar */}
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase w-16 flex-shrink-0">
                              Language
                            </span>
                            <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  candidate.interviewPass ? 'bg-[#0EA5E9]' : 'bg-red-400'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, candidate.interviewScore))}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono font-bold text-slate-700 w-8 text-right">
                              {candidate.interviewScore}%
                            </span>
                          </div>

                          {/* IQ Bar */}
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase w-16 flex-shrink-0">
                              IQ
                            </span>
                            <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  candidate.iqPass ? 'bg-amber-500' : 'bg-red-400'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, candidate.iqScore))}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono font-bold text-slate-700 w-8 text-right">
                              {candidate.iqScore}%
                            </span>
                          </div>

                          {/* EQ Status */}
                          <div className="flex items-center gap-2 pt-0.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase w-16 flex-shrink-0">
                              EQ
                            </span>
                            {candidate.eqPass ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <span>Suitable</span>
                                <CheckCircle className="w-3 h-3 text-emerald-600 inline" />
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                <span>{candidate.eqStatus}</span>
                                <Clock className="w-3 h-3 text-amber-500 inline" />
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 8. Row Actions: View Profile (Overlay) & Review Details (Modal) */}
                      <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenProfileOverlay(candidate.applicant)}
                            className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs rounded-lg transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                            title="Open candidate profile in full overlay"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            <span>View Profile</span>
                          </button>

                          <button
                            onClick={() => setActiveModalCandidate(candidate)}
                            className="px-3.5 py-1.5 bg-[#20637A] hover:bg-[#184F62] text-white font-bold text-xs rounded-lg transition-colors shadow-sm cursor-pointer flex items-center gap-1"
                            title="Inspect readiness breakdown and review for CV encoding"
                          >
                            <FileText className="w-3.5 h-3.5 text-white/90" />
                            <span>Review Details</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination */}
        <div className="p-4 bg-slate-50/50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-semibold">
          <span>Showing {rankedCandidates.length} candidate recommendation(s)</span>
          <div className="flex items-center gap-1">
            <button className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40" disabled>
              &lt;
            </button>
            <span className="px-2.5 py-1 rounded bg-[#20637A] text-white font-bold">1</span>
            <button className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40" disabled>
              Next &gt;
            </button>
          </div>
        </div>
      </div>

      {/* Review Details & Readiness Breakdown Modal */}
      {activeModalCandidate && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setActiveModalCandidate(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700">
                  {activeModalCandidate.applicant.name
                    ? activeModalCandidate.applicant.name.slice(0, 2).toUpperCase()
                    : 'AP'}
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-base">
                    {activeModalCandidate.applicant.name}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {activeModalCandidate.applicant.applicantCode || `#APP-${activeModalCandidate.applicant.id}`} | Rank #{activeModalCandidate.rank}
                    {' • '}
                    <span className="text-[#20637A] font-semibold">
                      Evaluating for: {currentJobOrder?.position || 'Job Order'}
                    </span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModalCandidate(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="py-4 space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              {/* Job-Order Readiness Score Card */}
              <div className="p-4 rounded-xl border bg-slate-50/70 border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Job-Order Readiness Score</span>
                  <span className="font-mono font-black text-2xl text-slate-900">{activeModalCandidate.readinessScore}%</span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      activeModalCandidate.classification === 'Recommended'
                        ? 'bg-[#10B981] text-white'
                        : activeModalCandidate.classification === 'For Further Review'
                        ? 'bg-[#F59E0B] text-slate-950'
                        : 'bg-[#EF4444] text-white'
                    }`}
                  >
                    {activeModalCandidate.classification}
                  </span>
                  <span className="text-xs text-slate-500">
                    {activeModalCandidate.classification === 'Recommended' && 'Exceeds 80% readiness threshold and passed all examination checks.'}
                    {activeModalCandidate.classification === 'For Further Review' && 'Meets 60%-79% readiness threshold for recruiter review.'}
                    {activeModalCandidate.classification === 'Not Recommended' && 'Below 60% threshold or failed core assessment gate.'}
                  </span>
                </div>

                {/* 5-Category Granular Readiness Breakdown */}
                <div className="pt-3 border-t border-slate-200/70 space-y-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 block">
                    Readiness Category Breakdown:
                  </span>

                  {/* 1. Role Match */}
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden text-xs transition-all">
                    <div className="p-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-700">1. Role & Trade Match</span>
                        <button
                          type="button"
                          onClick={() => setExpandedCategoryHelp(expandedCategoryHelp === 'roleMatch' ? null : 'roleMatch')}
                          className={`p-1 rounded-full transition-colors cursor-pointer ${
                            expandedCategoryHelp === 'roleMatch'
                              ? 'bg-[#20637A] text-white shadow-2xs'
                              : 'text-slate-400 hover:text-[#20637A] hover:bg-slate-100'
                          }`}
                          title="Click to view scoring criteria and how this candidate arrived at this score"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-[#20637A] h-full rounded-full"
                            style={{ width: `${(activeModalCandidate.categoryScores.roleMatch / 30) * 100}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-slate-900 w-16 text-right">
                          {activeModalCandidate.categoryScores.roleMatch} / 30 pts
                        </span>
                      </div>
                    </div>

                    {expandedCategoryHelp === 'roleMatch' && (
                      <div className="px-3.5 pb-3 pt-1 border-t border-slate-100 bg-slate-50/80 text-[11px] space-y-2 animate-in fade-in duration-150">
                        <div>
                          <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Scoring Criteria (Max 30 pts):</p>
                          <ul className="text-slate-600 list-disc list-inside mt-0.5 space-y-0.5">
                            <li><strong className="text-slate-800">30 pts:</strong> Direct Applied Role match (applied position exactly matches job order)</li>
                            <li><strong className="text-slate-800">25 pts:</strong> Work History match (held this exact position in previous employment)</li>
                            <li><strong className="text-slate-800">20 pts:</strong> Allied Trade Cluster match in applied role (transfer credit in same trade family)</li>
                            <li><strong className="text-slate-800">16 pts:</strong> Allied Trade Cluster match in past employment history</li>
                            <li><strong className="text-slate-800">0 pts:</strong> Unrelated trade or unspecified background</li>
                          </ul>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                          <p className="font-bold text-[#20637A] text-[10px] uppercase tracking-wider">Candidate Score Breakdown:</p>
                          <p className="text-slate-700 mt-0.5 leading-relaxed">
                            {getCategoryCandidateExplanation('roleMatch', activeModalCandidate, currentJobOrder)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Certifications */}
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden text-xs transition-all">
                    <div className="p-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-700">2. Required Certifications</span>
                        <button
                          type="button"
                          onClick={() => setExpandedCategoryHelp(expandedCategoryHelp === 'certifications' ? null : 'certifications')}
                          className={`p-1 rounded-full transition-colors cursor-pointer ${
                            expandedCategoryHelp === 'certifications'
                              ? 'bg-[#20637A] text-white shadow-2xs'
                              : 'text-slate-400 hover:text-[#20637A] hover:bg-slate-100'
                          }`}
                          title="Click to view scoring criteria and how this candidate arrived at this score"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-[#20637A] h-full rounded-full"
                            style={{ width: `${(activeModalCandidate.categoryScores.certifications / 25) * 100}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-slate-900 w-16 text-right">
                          {activeModalCandidate.categoryScores.certifications} / 25 pts
                        </span>
                      </div>
                    </div>

                    {expandedCategoryHelp === 'certifications' && (
                      <div className="px-3.5 pb-3 pt-1 border-t border-slate-100 bg-slate-50/80 text-[11px] space-y-2 animate-in fade-in duration-150">
                        <div>
                          <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Scoring Criteria (Max 25 pts):</p>
                          <ul className="text-slate-600 list-disc list-inside mt-0.5 space-y-0.5">
                            <li><strong className="text-slate-800">25 pts:</strong> Holds all required certifications or no mandatory certs specified</li>
                            <li><strong className="text-slate-800">Pro-rated:</strong> (25 / N) points per required credential held</li>
                            <li><strong className="text-slate-800">Allied Transfer Credit:</strong> 70% credit value for allied credentials in same trade family</li>
                            <li><strong className="text-slate-800">0 pts:</strong> Missing required credentials without allied alternatives</li>
                          </ul>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                          <p className="font-bold text-[#20637A] text-[10px] uppercase tracking-wider">Candidate Score Breakdown:</p>
                          <p className="text-slate-700 mt-0.5 leading-relaxed">
                            {getCategoryCandidateExplanation('certifications', activeModalCandidate, currentJobOrder)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. Experience / Education Foundation */}
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden text-xs transition-all">
                    <div className="p-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-700">
                          3. {activeModalCandidate.isFirstTimeApplicant ? 'Institutional TVET / Education' : 'Work Experience Duration'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedCategoryHelp(expandedCategoryHelp === 'experience' ? null : 'experience')}
                          className={`p-1 rounded-full transition-colors cursor-pointer ${
                            expandedCategoryHelp === 'experience'
                              ? 'bg-[#20637A] text-white shadow-2xs'
                              : 'text-slate-400 hover:text-[#20637A] hover:bg-slate-100'
                          }`}
                          title="Click to view scoring criteria and how this candidate arrived at this score"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-[#20637A] h-full rounded-full"
                            style={{ width: `${(activeModalCandidate.categoryScores.experience / 20) * 100}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-slate-900 w-16 text-right">
                          {activeModalCandidate.categoryScores.experience} / 20 pts
                        </span>
                      </div>
                    </div>

                    {expandedCategoryHelp === 'experience' && (
                      <div className="px-3.5 pb-3 pt-1 border-t border-slate-100 bg-slate-50/80 text-[11px] space-y-2 animate-in fade-in duration-150">
                        <div>
                          <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Scoring Criteria (Max 20 pts):</p>
                          <ul className="text-slate-600 list-disc list-inside mt-0.5 space-y-0.5">
                            <li><strong className="text-slate-800">20 pts:</strong> Experience exceeds requirement by 2+ years (or aligned TVET/tertiary for first-time applicants)</li>
                            <li><strong className="text-slate-800">15 pts:</strong> Meets exact required years (or verified secondary foundation for first-time applicants)</li>
                            <li><strong className="text-slate-800">Partial:</strong> Pro-rated duration if related</li>
                            <li><strong className="text-slate-800">Max 5 pts:</strong> Non-aligned experience duration in unrelated trade</li>
                          </ul>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                          <p className="font-bold text-[#20637A] text-[10px] uppercase tracking-wider">Candidate Score Breakdown:</p>
                          <p className="text-slate-700 mt-0.5 leading-relaxed">
                            {getCategoryCandidateExplanation('experience', activeModalCandidate, currentJobOrder)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 4. Skills Overlap */}
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden text-xs transition-all">
                    <div className="p-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-700">4. Trade Skills & Competencies</span>
                        <button
                          type="button"
                          onClick={() => setExpandedCategoryHelp(expandedCategoryHelp === 'skills' ? null : 'skills')}
                          className={`p-1 rounded-full transition-colors cursor-pointer ${
                            expandedCategoryHelp === 'skills'
                              ? 'bg-[#20637A] text-white shadow-2xs'
                              : 'text-slate-400 hover:text-[#20637A] hover:bg-slate-100'
                          }`}
                          title="Click to view scoring criteria and how this candidate arrived at this score"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-[#20637A] h-full rounded-full"
                            style={{ width: `${(activeModalCandidate.categoryScores.skills / 15) * 100}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-slate-900 w-16 text-right">
                          {activeModalCandidate.categoryScores.skills} / 15 pts
                        </span>
                      </div>
                    </div>

                    {expandedCategoryHelp === 'skills' && (
                      <div className="px-3.5 pb-3 pt-1 border-t border-slate-100 bg-slate-50/80 text-[11px] space-y-2 animate-in fade-in duration-150">
                        <div>
                          <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Scoring Criteria (Max 15 pts):</p>
                          <ul className="text-slate-600 list-disc list-inside mt-0.5 space-y-0.5">
                            <li><strong className="text-slate-800">15 pts:</strong> Matched 2 or more core trade competencies or cluster skills</li>
                            <li><strong className="text-slate-800">10 pts:</strong> Matched 1 core trade competency</li>
                            <li><strong className="text-slate-800">0 pts:</strong> No matching trade competencies detected in profile skills</li>
                          </ul>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                          <p className="font-bold text-[#20637A] text-[10px] uppercase tracking-wider">Candidate Score Breakdown:</p>
                          <p className="text-slate-700 mt-0.5 leading-relaxed">
                            {getCategoryCandidateExplanation('skills', activeModalCandidate, currentJobOrder)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 5. Overseas Readiness */}
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden text-xs transition-all">
                    <div className="p-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-700">5. Overseas Deployment Readiness</span>
                        <button
                          type="button"
                          onClick={() => setExpandedCategoryHelp(expandedCategoryHelp === 'overseas' ? null : 'overseas')}
                          className={`p-1 rounded-full transition-colors cursor-pointer ${
                            expandedCategoryHelp === 'overseas'
                              ? 'bg-[#20637A] text-white shadow-2xs'
                              : 'text-slate-400 hover:text-[#20637A] hover:bg-slate-100'
                          }`}
                          title="Click to view scoring criteria and how this candidate arrived at this score"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-[#20637A] h-full rounded-full"
                            style={{ width: `${(activeModalCandidate.categoryScores.overseas / 10) * 100}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-slate-900 w-16 text-right">
                          {activeModalCandidate.categoryScores.overseas} / 10 pts
                        </span>
                      </div>
                    </div>

                    {expandedCategoryHelp === 'overseas' && (
                      <div className="px-3.5 pb-3 pt-1 border-t border-slate-100 bg-slate-50/80 text-[11px] space-y-2 animate-in fade-in duration-150">
                        <div>
                          <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Scoring Criteria (Max 10 pts):</p>
                          <ul className="text-slate-600 list-disc list-inside mt-0.5 space-y-0.5">
                            <li><strong className="text-slate-800">10 pts:</strong> Verified prior overseas experience in target destination country</li>
                            <li><strong className="text-slate-800">7 pts:</strong> Prior overseas experience in other countries (or first-time applicant neutral baseline)</li>
                            <li><strong className="text-slate-800">3 pts:</strong> Local / domestic Philippine employment experience only</li>
                            <li><strong className="text-slate-800">0 pts:</strong> No recorded work history</li>
                          </ul>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                          <p className="font-bold text-[#20637A] text-[10px] uppercase tracking-wider">Candidate Score Breakdown:</p>
                          <p className="text-slate-700 mt-0.5 leading-relaxed">
                            {getCategoryCandidateExplanation('overseas', activeModalCandidate, currentJobOrder)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Candidate Strengths */}
                {activeModalCandidate.strengths.length > 0 && (
                  <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">
                    <p className="font-bold mb-1.5 flex items-center gap-1.5 text-emerald-800">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      Candidate Strengths:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-[11px] text-emerald-800">
                      {activeModalCandidate.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Identified Gaps */}
                {activeModalCandidate.gaps.length > 0 && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                    <p className="font-bold mb-1.5 flex items-center gap-1.5 text-amber-800">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      Identified Gaps & Deficiencies:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800">
                      {activeModalCandidate.gaps.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Core Examination Clearance */}
              <div className="p-4 rounded-xl border bg-slate-50/70 border-slate-200">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Examination Assessment Gates
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <p className="text-slate-500 font-medium">Trade Skills (Req &gt;= 70%)</p>
                    <p className="font-bold text-slate-900 mt-0.5">{activeModalCandidate.techScore}%</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <p className="text-slate-500 font-medium">IQ / Aptitude (Req &gt;= 50%)</p>
                    <p className="font-bold text-slate-900 mt-0.5">{activeModalCandidate.iqScore}%</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <p className="text-slate-500 font-medium">Interview / Language (Req &gt;= 60%)</p>
                    <p className="font-bold text-slate-900 mt-0.5">{activeModalCandidate.interviewScore}%</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <p className="text-slate-500 font-medium">Personality / EQ Gate</p>
                    <p className="font-bold text-emerald-600 mt-0.5">{activeModalCandidate.eqStatus} ✓</p>
                  </div>
                </div>
              </div>

              {/* Statutory Compliance Layer */}
              <div className="p-4 rounded-xl border bg-slate-50/70 border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Statutory Compliance Layer (DMW/POEA)</span>
                  <span
                    className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                      activeModalCandidate.compliancePassed
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {activeModalCandidate.compliancePassed ? 'Statutory Documents Clear' : 'Action Required: Expired Document'}
                  </span>
                </div>

                <div className="space-y-2">
                  {/* Medical Clearance */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {activeModalCandidate.medicalStatus.valid ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      )}
                      <span className="font-semibold text-slate-800">Medical Fitness (Fit-to-Work)</span>
                    </div>
                    <span
                      className={`text-[11px] font-mono font-bold ${
                        activeModalCandidate.medicalStatus.valid ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {activeModalCandidate.medicalStatus.status}
                    </span>
                  </div>

                  {/* Passport Validity */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {activeModalCandidate.passportStatus.valid ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      )}
                      <span className="font-semibold text-slate-800">Passport Validity (&gt;= 60 days)</span>
                    </div>
                    <span
                      className={`text-[11px] font-mono font-bold ${
                        activeModalCandidate.passportStatus.valid ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {activeModalCandidate.passportStatus.status}
                    </span>
                  </div>

                  {/* NBI Clearance Validity */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {activeModalCandidate.nbiStatus.valid ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      )}
                      <span className="font-semibold text-slate-800">NBI Clearance Validity (&gt;= 30 days)</span>
                    </div>
                    <span
                      className={`text-[11px] font-mono font-bold ${
                        activeModalCandidate.nbiStatus.valid ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {activeModalCandidate.nbiStatus.status}
                    </span>
                  </div>
                </div>

                {/* Notice for expired documents */}
                {activeModalCandidate.expiredDocs.length > 0 && (
                  <div className="mt-3 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-900">Document Renewal Required:</span>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-snug">
                        {activeModalCandidate.expiredDocs.map((d) => `${d.name} (expired ${d.expiry})`).join(', ')}. Candidate must secure renewed clearances before final visa issuance and overseas deployment.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions: Open Full Profile, Close, and Endorse to CV Encoding */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => {
                  const applicant = activeModalCandidate.applicant;
                  setActiveModalCandidate(null);
                  handleOpenProfileOverlay(applicant);
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="View full candidate profile in overlay"
              >
                <Eye className="w-3.5 h-3.5 text-slate-600" />
                <span>Open Full Profile</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveModalCandidate(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>

                {activeModalCandidate.classification === 'Not Recommended' ? (
                  <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg font-semibold">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    <span>Not Ready for CV Encoding</span>
                  </div>
                ) : !activeModalCandidate.compliancePassed || activeModalCandidate.expiredDocs.length > 0 ? (
                  <button
                    disabled
                    className="px-4 py-2 bg-slate-100 border border-slate-300 text-slate-400 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-not-allowed shadow-2xs"
                    title={`Endorsement Blocked: Candidate has expired or invalid document(s) (${activeModalCandidate.expiredDocs.map((d) => d.name).join(', ') || 'Statutory clearance issue'}). Renewal required.`}
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Endorsement Blocked (Expired Documents)</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleEndorseCandidate(activeModalCandidate)}
                    className="px-4 py-2 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                    title="Endorse candidate and forward to CV Encoding"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Endorse Candidate to CV Encoding</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Profile Overlay Modal */}
      {overlayApplicant && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
          onClick={() => setOverlayApplicant(null)}
        >
          <div 
            className="bg-slate-50 rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Navigation Bar with Return / Close Button */}
            <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between flex-shrink-0 shadow-xs">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setOverlayApplicant(null)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-2xs border border-slate-200"
                  title="Return to Smart Recommendations"
                >
                  <ArrowLeft className="w-4 h-4 text-slate-700" />
                  <span>Back to Recommendations</span>
                </button>
                <div className="h-4 w-px bg-slate-200 hidden sm:block" />
                <span className="text-xs font-semibold text-slate-500 hidden sm:inline">
                  Viewing Profile •{' '}
                  <strong className="text-slate-800">{overlayApplicant.name}</strong> ({overlayApplicant.applicantCode || `#APP-${overlayApplicant.id}`})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOverlayApplicant(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Profile Content Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <ApplicantProfile
                applicant={overlayApplicant}
                onBack={() => setOverlayApplicant(null)}
                currentUserName={currentUserName}
                addActivityLog={addActivityLog}
                showToast={showToast}
                updateApplicant={updateApplicant ? (id, data) => updateApplicant(id, data) : undefined}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
