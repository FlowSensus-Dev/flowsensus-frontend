import { useState, useEffect, useRef, useMemo } from 'react';
import api from '../../../lib/api';
import { jsPDF } from 'jspdf';
import {
  Microscope,
  FileCheck2,
  ClipboardCheck,
  OctagonX,
  X,
  ArrowLeft,
  Briefcase,
  Flag,
  Clock,
  ChevronRight,
  Loader2,
  IdCard,
  Mail,
  Phone,
  AlertTriangle,
  CheckCircle2,
  FileEdit,
  Printer,
  ArrowRight,
  UserCheck,
  Check,
  AlertCircle,
  Building2,
  ShieldAlert,
  Info,
  Download,
  RotateCcw,
  Brain,
  Heart,
  Wrench,
  Languages,
  Stethoscope,
  Sliders,
  MessageSquare,
  Sparkles,
  Save,
  Search,
  Undo2,
  User,
  UserPlus,
  Users,
  Lock,
} from 'lucide-react';
import { WorkflowState, ActivityLog, ApplicantRecord, EvaluationTest, DynamicTestScore, TestScores } from '../../types';

interface ScreeningProps {
  workflow: WorkflowState;
  updateWorkflow: (updates: Partial<WorkflowState>) => void;
  showToast: (message: string) => void;
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  updateApplicant: (applicantId: string, updates: Partial<ApplicantRecord>) => void;
  selectedApplicantId?: string;
  applicants?: ApplicantRecord[];
  evaluationTemplates?: EvaluationTest[];
  onTemplatesUpdated?: () => void;
  globalJobOrders?: any[];
}

const TEST_TYPE_THEMES: Record<string, { label: string; bg: string; border: string; text: string; bar: string; icon: any }> = {
  skills: { label: 'Skills / Aptitude', bg: 'bg-[#F59E0B]/5', border: 'border-[#F59E0B]/20', text: 'text-[#F59E0B]', bar: 'bg-[#F59E0B]', icon: Wrench },
  language: { label: 'Language Proficiency', bg: 'bg-[#10B981]/5', border: 'border-[#10B981]/20', text: 'text-[#10B981]', bar: 'bg-[#10B981]', icon: Languages },
  eq: { label: 'EQ / Personality', bg: 'bg-[#EC4899]/5', border: 'border-[#EC4899]/20', text: 'text-[#EC4899]', bar: 'bg-[#EC4899]', icon: Heart },
  iq: { label: 'IQ / Aptitude', bg: 'bg-[#8B5CF6]/5', border: 'border-[#8B5CF6]/20', text: 'text-[#8B5CF6]', bar: 'bg-[#8B5CF6]', icon: Brain },
  medical: { label: 'Medical Review', bg: 'bg-[#EF4444]/5', border: 'border-[#EF4444]/20', text: 'text-[#EF4444]', bar: 'bg-[#EF4444]', icon: Stethoscope },
  interview: { label: 'Interview', bg: 'bg-[#0EA5E9]/5', border: 'border-[#0EA5E9]/20', text: 'text-[#0EA5E9]', bar: 'bg-[#0EA5E9]', icon: MessageSquare },
  custom: { label: 'Custom Assessment', bg: 'bg-[#64748B]/5', border: 'border-[#64748B]/20', text: 'text-[#64748B]', bar: 'bg-[#64748B]', icon: Sliders },
};

// Fallback Standardized Passing Criteria
const ENGLISH_PASS_SCORE = 60;
const TRADE_PASS_SCORE = 70;
const IQ_PASS_SCORE = 50;

// Helper to determine if an evaluation is required for the specific applicant based on Job Order
const isTestApplicableToApplicant = (
  test: EvaluationTest,
  applicant: ApplicantRecord | undefined,
  jobOrdersList?: any[]
): boolean => {
  if (!test.applicableJobOrders || test.applicableJobOrders.length === 0) {
    return true; // General evaluation, applies to all candidates
  }
  if (!applicant) return true;

  const appJobId = String(applicant.selectedJobOrderId || '').trim().toLowerCase();
  const appJobCode = String(applicant.jobOrder || '').trim().toLowerCase();
  const appRole = String(applicant.role || applicant.appliedPosition || applicant.appliedRole || '').trim().toLowerCase();

  return test.applicableJobOrders.some(target => {
    const t = String(target).trim().toLowerCase();
    if (!t) return false;
    if (appJobId && (t === appJobId || t === `jo-${appJobId}`)) return true;
    if (appJobCode && (t === appJobCode || appJobCode.includes(t) || t.includes(appJobCode))) return true;
    if (appRole && (t === appRole || appRole.includes(t) || t.includes(appRole))) return true;

    if (jobOrdersList && jobOrdersList.length > 0) {
      const matchedJo = jobOrdersList.find(jo =>
        String(jo.job_order_id || jo.id) === t ||
        String(jo.job_order_code || jo.job_code || '').toLowerCase() === t
      );
      if (matchedJo) {
        const joId = String(matchedJo.job_order_id || matchedJo.id || '').toLowerCase();
        const joCode = String(matchedJo.job_order_code || matchedJo.job_code || '').toLowerCase();
        const joPos = String(matchedJo.position_title || matchedJo.position || '').toLowerCase();
        if (appJobId === joId || appJobCode === joCode || appRole === joPos || appRole.includes(joPos)) return true;
      }
    }
    return false;
  });
};

export default function Screening({
  workflow,
  updateWorkflow,
  showToast,
  currentUserName,
  addActivityLog,
  updateApplicant,
  selectedApplicantId: initialApplicantId = '1',
  applicants = [],
  evaluationTemplates = [],
  onTemplatesUpdated,
  globalJobOrders,
}: ScreeningProps) {
  const [selectedApplicantId, setSelectedApplicantId] = useState(initialApplicantId);
  const [listView, setListView] = useState(true);

  const normalizeEvaluationTemplate = (t: any): EvaluationTest => {
    const rawScoring = t.scoringType || t.scoring_type;
    const isPF = rawScoring === 'pass_fail' || rawScoring === 'pass/fail' ||
      (t.scoringGuide && t.scoringGuide.toLowerCase().includes('pass/fail')) ||
      (t.scoring_guide && t.scoring_guide.toLowerCase().includes('pass/fail'));
    return {
      id: String(t.test_template_id || t.id),
      name: t.name,
      type: (t.test_type || t.type || 'custom') as EvaluationTest['type'],
      description: t.description || '',
      maxScore: Number(t.max_score ?? t.maxScore ?? 100),
      passingScore: Number(t.passing_score ?? t.passingScore ?? 60),
      weight: Number(t.weight_percentage ?? t.weight ?? 10),
      scoringGuide: t.scoring_guide || t.scoringGuide || '',
      isActive: Boolean(t.is_active ?? t.isActive ?? true),
      scoringType: (isPF ? 'pass_fail' : 'numeric') as 'numeric' | 'pass_fail',
      applicableJobOrders: Array.isArray(t.applicable_job_orders)
        ? t.applicable_job_orders
        : (Array.isArray(t.applicableJobOrders) ? t.applicableJobOrders : []),
    };
  };

  // Dynamic evaluation templates state (fetched from Supabase or passed as props)
  const [templates, setTemplates] = useState<EvaluationTest[]>(() =>
    (evaluationTemplates || []).map(normalizeEvaluationTemplate)
  );

  useEffect(() => {
    if (evaluationTemplates && evaluationTemplates.length > 0) {
      setTemplates(evaluationTemplates.map(normalizeEvaluationTemplate));
    }
  }, [evaluationTemplates]);

  useEffect(() => {
    if (!evaluationTemplates || evaluationTemplates.length === 0) {
      api.get('/evaluations/templates')
        .then(res => {
          if (res.data && Array.isArray(res.data) && res.data.length > 0) {
            setTemplates(res.data.map(normalizeEvaluationTemplate));
          }
        })
        .catch(err => console.warn('Could not fetch evaluation templates in Screening:', err));
    }
  }, []);

  // ── Find currently selected applicant ───────────────────────────────────────
  const selectedApplicant = applicants.find(a => String(a.id) === String(selectedApplicantId)) || applicants[0];
  const initializedForApplicantId = useRef<string | null>(null);

  const activeEvaluationTests: EvaluationTest[] = useMemo(() => {
    const active = templates.filter(t => t.isActive).map(t => {
      const stored = selectedApplicant?.testScores?.tests?.[t.id] || selectedApplicant?.testScores?.tests?.[t.name];
      const isPF = t.scoringType === 'pass_fail' ||
        (t as any).scoring_type === 'pass_fail' ||
        stored?.scoringType === 'pass_fail' ||
        (stored as any)?.scoring_type === 'pass_fail' ||
        t.scoringGuide?.toLowerCase().includes('pass/fail');
      return {
        ...t,
        scoringType: (isPF ? 'pass_fail' : (t.scoringType || 'numeric')) as 'numeric' | 'pass_fail'
      };
    });
    const applicable = active.filter(t => isTestApplicableToApplicant(t, selectedApplicant, globalJobOrders));
    if (applicable.length > 0) return applicable;
    return active;
  }, [templates, selectedApplicant, globalJobOrders]);

  // Modals state
  const [showStopModal, setShowStopModal] = useState(false);
  const [stopReason, setStopReason] = useState('');
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [partnerClinicsList, setPartnerClinicsList] = useState<any[]>([]);
  const [selectedClinic, setSelectedClinic] = useState<string>('');
  const [screeningQueueTab, setScreeningQueueTab] = useState<'ALL' | 'MY_QUEUE' | 'UNASSIGNED'>('ALL');
  const [isGeneratingReferral, setIsGeneratingReferral] = useState(false);
  const [showUpdateStatusModal, setShowUpdateStatusModal] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showReviewScoreModal, setShowReviewScoreModal] = useState(false);

  const [agencyProfile, setAgencyProfile] = useState<{
    agency_name?: string;
    poea_license_no?: string;
  } | null>(null);

  useEffect(() => {
    api.get<any[]>('/clinics')
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setPartnerClinicsList(res.data);
          // Do not auto-select a clinic; status update defaults to 'Pending' unless explicitly chosen
        }
      })
      .catch(err => console.warn('Could not load clinics in Screening:', err));

    api.get('/lookups/agency')
      .then(res => {
        if (res.data) setAgencyProfile(res.data);
      })
      .catch(err => console.warn('Could not load agency profile in Screening:', err));
  }, []);

  // Dynamic scores state: Score Obtained (raw), Total Score (items), and Pass/Fail verdict
  const [dynamicRawScores, setDynamicRawScores] = useState<Record<string, number | string>>({});
  const [dynamicTotalItems, setDynamicTotalItems] = useState<Record<string, number | string>>({});
  const [dynamicPassFail, setDynamicPassFail] = useState<Record<string, 'Pass' | 'Fail' | ''>>({});

  const [phase1Search, setPhase1Search] = useState('');
  const [phase2Search, setPhase2Search] = useState('');
  const [phase3Search, setPhase3Search] = useState('');

  const [employerSpecificNotes, setEmployerSpecificNotes] = useState('');
  const [personalityEQVerdict, setPersonalityEQVerdict] = useState<'Suitable' | 'Not Suitable' | 'Pending'>('Pending');

  // Score correction modal local state
  const [reviewDynamicRawScores, setReviewDynamicRawScores] = useState<Record<string, number | string>>({});
  const [reviewDynamicTotalItems, setReviewDynamicTotalItems] = useState<Record<string, number | string>>({});
  const [reviewDynamicPassFail, setReviewDynamicPassFail] = useState<Record<string, 'Pass' | 'Fail' | ''>>({});
  const [reviewEQVerdict, setReviewEQVerdict] = useState<'Suitable' | 'Not Suitable' | 'Pending'>('Pending');
  const [reviewEmployerNotes, setReviewEmployerNotes] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [generatedReferralIds, setGeneratedReferralIds] = useState<Set<string>>(new Set());

  // Synchronize dynamic scores whenever active applicant or active tests change
  useEffect(() => {
    if (selectedApplicant?.id !== initializedForApplicantId.current) {
      const initialRaw: Record<string, number | string> = {};
      const initialTotal: Record<string, number | string> = {};
      const initialPF: Record<string, 'Pass' | 'Fail' | ''> = {};
      const ts = selectedApplicant?.testScores;
      const testsObj = ts?.tests || {};

      activeEvaluationTests.forEach(test => {
        const stored = testsObj[test.id] || testsObj[test.name];
        if (stored) {
          if (test.scoringType === 'pass_fail' || stored.scoringType === 'pass_fail') {
            initialPF[test.id] = (stored.passed || stored.score >= 100 || stored.statusText === 'Passed') ? 'Pass' : (stored.score === 0 ? 'Fail' : '');
          } else {
            initialRaw[test.id] = stored.rawScore !== undefined ? stored.rawScore : stored.score;
            initialTotal[test.id] = stored.totalItems ?? stored.maxScore ?? test.maxScore ?? 100;
          }
          return;
        }

        // Fallbacks for legacy applicant profiles
        const lower = test.name.toLowerCase();
        if (test.scoringType === 'pass_fail') {
          if (test.type === 'eq' || lower.includes('psychological') || lower.includes('eq')) {
            initialPF[test.id] = ts?.personalityEQ === 'Suitable' ? 'Pass' : (ts?.personalityEQ === 'Not Suitable' ? 'Fail' : '');
          } else {
            initialPF[test.id] = '';
          }
        } else {
          let legacyVal: number | string = '';
          if (test.type === 'skills' || lower.includes('trade') || lower.includes('skill')) {
            legacyVal = ts?.tradeSkills ?? '';
          } else if (test.type === 'language' || lower.includes('english') || lower.includes('language')) {
            legacyVal = ts?.languageProficiency ?? ts?.englishProficiency ?? '';
          } else if (test.type === 'iq' || lower.includes('iq') || lower.includes('aptitude') || lower.includes('cognitive')) {
            legacyVal = ts?.iqAptitude ?? '';
          } else if (test.type === 'eq' || lower.includes('psychological') || lower.includes('eq')) {
            legacyVal = ts?.personalityEQ === 'Suitable' ? test.passingScore : (ts?.personalityEQ === 'Not Suitable' ? 50 : '');
          } else if (test.type === 'medical' || lower.includes('medical')) {
            legacyVal = (ts as any)?.medicalScore ?? (ts as any)?.medicalReviewScore ?? '';
          }
          initialRaw[test.id] = legacyVal;
          initialTotal[test.id] = test.maxScore || 100;
        }
      });

      setDynamicRawScores(initialRaw);
      setDynamicTotalItems(initialTotal);
      setDynamicPassFail(initialPF);
      setEmployerSpecificNotes(ts?.employerSpecific || '');
      setPersonalityEQVerdict(ts?.personalityEQ || 'Pending');

      if (selectedApplicant?.medicalReferralGenerated) {
        setGeneratedReferralIds(prev => new Set([...prev, selectedApplicant.id]));
      }

      initializedForApplicantId.current = selectedApplicant?.id || null;
    }
  }, [selectedApplicant, activeEvaluationTests]);

  // ── Calculation and evaluation engine for candidate scores ────────────────
  const getTestEvaluationResult = (
    test: EvaluationTest,
    rawScoresMap = dynamicRawScores,
    totalItemsMap = dynamicTotalItems,
    passFailMap = dynamicPassFail
  ) => {
    if (test.scoringType === 'pass_fail') {
      const verdict = passFailMap[test.id] || '';
      const isPass = verdict === 'Pass';
      const hasEntry = verdict === 'Pass' || verdict === 'Fail';
      return {
        score: isPass ? 100 : 0,
        rawScore: isPass ? 100 : 0,
        totalItems: 100,
        percentage: isPass ? 100 : (verdict === 'Fail' ? 0 : undefined),
        passed: isPass,
        hasEntry,
        verdict,
      };
    } else {
      const raw = rawScoresMap[test.id];
      const total = totalItemsMap[test.id] !== undefined && totalItemsMap[test.id] !== ''
        ? Number(totalItemsMap[test.id])
        : (test.maxScore || 100);
      const hasEntry = raw !== '' && raw !== undefined && !isNaN(Number(raw));
      const numRaw = hasEntry ? Number(raw) : 0;
      const numTotal = total > 0 ? total : 100;
      const pct = hasEntry
        ? Math.min(100, Math.max(0, Math.round((numRaw / numTotal) * 1000) / 10))
        : undefined;
      const isPass = pct !== undefined ? pct >= test.passingScore : false;
      return {
        score: pct ?? 0,
        rawScore: numRaw,
        totalItems: numTotal,
        percentage: pct,
        passed: isPass,
        hasEntry,
        verdict: isPass ? 'Pass' : 'Fail',
      };
    }
  };

  const isTestPassed = (test: EvaluationTest, rawMap = dynamicRawScores, totalMap = dynamicTotalItems, pfMap = dynamicPassFail): boolean => {
    return getTestEvaluationResult(test, rawMap, totalMap, pfMap).passed;
  };

  const phase1AllPassed = activeEvaluationTests.length > 0 && activeEvaluationTests.every(t => isTestPassed(t));
  const eqPass = personalityEQVerdict === 'Suitable';
  const eqFail = personalityEQVerdict === 'Not Suitable';
  const eqPending = personalityEQVerdict === 'Pending' || !personalityEQVerdict;

  const allScoresPassed = phase1AllPassed && eqPass;

  const totalActiveWeight = activeEvaluationTests.reduce((acc, t) => acc + (t.weight || 0), 0);
  const currentWeightedScore = Math.round(
    activeEvaluationTests.reduce((acc, t) => {
      const res = getTestEvaluationResult(t);
      const wt = t.weight || 0;
      return acc + (res.score * wt);
    }, 0) / (totalActiveWeight > 0 ? totalActiveWeight : 1)
  );

  const handleRawScoreChange = (testId: string, value: string) => {
    setDynamicRawScores(prev => ({ ...prev, [testId]: value }));
  };

  const handleTotalItemsChange = (testId: string, value: string) => {
    setDynamicTotalItems(prev => ({ ...prev, [testId]: value }));
  };

  const handleSetPassFail = (testId: string, verdict: 'Pass' | 'Fail') => {
    setDynamicPassFail(prev => ({
      ...prev,
      [testId]: prev[testId] === verdict ? '' : verdict,
    }));
  };

  // Has medical referral been generated for selected applicant?
  const hasMedicalReferral = Boolean(
    selectedApplicant?.medicalReferralGenerated || (selectedApplicant && generatedReferralIds.has(selectedApplicant.id))
  );

  // ── All active candidates in Screening (prior to turnover queue filter) ───
  const allActiveScreeningCandidates = useMemo(() => {
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
    return applicants.filter(a => !a.isStopped && a.status !== 'Processing Stopped' && !postScreeningStatuses.includes(a.status));
  }, [applicants]);

  // Live queue counts for Turnover Navigation Tabs
  const screeningQueueCounts = useMemo(() => {
    const myQueue = allActiveScreeningCandidates.filter(a => a.currentHandler?.trim().toLowerCase() === currentUserName.trim().toLowerCase()).length;
    const unassigned = allActiveScreeningCandidates.filter(a => !a.currentHandler || a.currentHandler === 'Unassigned' || a.currentHandler === 'Unassigned Pool' || a.currentHandler === 'System Agent').length;
    return {
      all: allActiveScreeningCandidates.length,
      myQueue,
      unassigned,
      pool: allActiveScreeningCandidates.length
    };
  }, [allActiveScreeningCandidates, currentUserName]);

  // ── Filter applicants active in the Screening module ───────────────────────
  const screeningPool = useMemo(() => {
    return allActiveScreeningCandidates.filter(a => {
      // Turnover Queue Filtering
      const isAssignedToMe = a.currentHandler?.trim().toLowerCase() === currentUserName.trim().toLowerCase();

      // In MY_QUEUE tab, only show candidates assigned to current user
      if (screeningQueueTab === 'MY_QUEUE' && !isAssignedToMe) return false;

      // In ALL and UNASSIGNED (Active Pool), keep all candidates in the pool,
      // so claimed candidates do NOT disappear, but are displayed with their handler
      // and locked/unclickable for other staff!
      return true;
    });
  }, [allActiveScreeningCandidates, screeningQueueTab, currentUserName]);

  // Helper: check if an applicant in pool has passed Phase 1
  const isApplicantPhase1Passed = (a: ApplicantRecord): boolean => {
    const ts = a.testScores;
    if (!ts) return false;
    if (ts.allPassed !== undefined) return Boolean(ts.allPassed);
    if (ts.tests && Object.keys(ts.tests).length > 0) {
      return Object.values(ts.tests).every((t: any) => Boolean(t.passed));
    }
    // Check against active evaluation templates
    if (activeEvaluationTests.length > 0) {
      return activeEvaluationTests.every(t => {
        const lower = t.name.toLowerCase();
        if (t.type === 'skills' || lower.includes('trade')) return (ts.tradeSkills ?? 0) >= t.passingScore;
        if (t.type === 'language' || lower.includes('english')) return ((ts.languageProficiency ?? ts.englishProficiency) ?? 0) >= t.passingScore;
        if (t.type === 'iq' || lower.includes('iq')) return (ts.iqAptitude ?? 0) >= t.passingScore;
        return true;
      });
    }
    return (
      (ts.englishProficiency ?? 0) >= ENGLISH_PASS_SCORE &&
      (ts.tradeSkills ?? 0) >= TRADE_PASS_SCORE &&
      (ts.iqAptitude ?? 0) >= IQ_PASS_SCORE
    );
  };

  // Helper: check if applicant failed any evaluation test
  const isApplicantPhase1Failed = (a: ApplicantRecord): boolean => {
    const ts = a.testScores;
    if (!ts) return false;
    const hasAnyScore =
      (ts.tests && Object.keys(ts.tests).length > 0) ||
      typeof ts.englishProficiency === 'number' ||
      typeof ts.tradeSkills === 'number' ||
      typeof ts.iqAptitude === 'number' ||
      typeof ts.overallScore === 'number';
    if (!hasAnyScore) return false;
    return !isApplicantPhase1Passed(a);
  };

  // ── 3 Sub-Phases Division ──────────────────────────────────────────────────
  // Phase 1 — Pending Screening:
  // Newly registered candidates or candidates who haven't passed all evaluations yet.
  // Any applicant who failed 1 or more evaluations gets status = "Provisional"
  // and stays in this phase (does not auto-advance, not removed from pipeline).
  const phase1Applicants = useMemo(() => {
    return screeningPool.filter(a => {
      // If candidate has not passed all Phase 1 evaluations, they MUST be in Phase 1
      if (!isApplicantPhase1Passed(a)) return true;

      // If they are still in initial intake statuses, keep in Phase 1
      if (a.status === 'Applicant Registration' || a.status === 'Initial Screening') return true;

      // Otherwise, they have passed Phase 1 and advance to Phase 2 or 3
      return false;
    });
  }, [screeningPool]);

  // Phase 2 — Pending Interview:
  // Applicant passed all Phase 1 evaluations -> advances here for Personality/EQ Assessment.
  // Stays here until interview is conducted and marked Suitable.
  const phase2Applicants = useMemo(() => {
    return screeningPool.filter(a => {
      // Must have passed Phase 1 evaluations
      if (!isApplicantPhase1Passed(a)) return false;
      if (a.status === 'Applicant Registration' || a.status === 'Initial Screening') return false;

      const eq = a.testScores?.personalityEQ;
      // If interview is marked 'Suitable' and status is not Provisional, advances to Phase 3
      if (eq === 'Suitable' && a.status !== 'Provisional') return false;

      return true;
    });
  }, [screeningPool]);

  // Phase 3 — Review Score for Medical Referral:
  // Reached ONLY once all evaluations + interview are passed (no fails, no unresolved Provisional status).
  const phase3Applicants = useMemo(() => {
    return screeningPool.filter(a => {
      if (!isApplicantPhase1Passed(a)) return false;
      if (a.status === 'Applicant Registration' || a.status === 'Initial Screening') return false;
      const eq = a.testScores?.personalityEQ;
      if (eq !== 'Suitable') return false;
      if (a.status === 'Provisional') return false;
      return true;
    });
  }, [screeningPool]);

  // Filtered applicants per sub-phase based on search inputs
  const filteredPhase1 = useMemo(() => {
    const q = phase1Search.trim().toLowerCase();
    if (!q) return phase1Applicants;
    return phase1Applicants.filter(a =>
      (a.name && a.name.toLowerCase().includes(q)) ||
      (a.applicantCode && a.applicantCode.toLowerCase().includes(q)) ||
      (a.id && String(a.id).toLowerCase().includes(q)) ||
      (a.role && a.role.toLowerCase().includes(q)) ||
      (a.jobOrder && a.jobOrder.toLowerCase().includes(q))
    );
  }, [phase1Applicants, phase1Search]);

  const filteredPhase2 = useMemo(() => {
    const q = phase2Search.trim().toLowerCase();
    if (!q) return phase2Applicants;
    return phase2Applicants.filter(a =>
      (a.name && a.name.toLowerCase().includes(q)) ||
      (a.applicantCode && a.applicantCode.toLowerCase().includes(q)) ||
      (a.id && String(a.id).toLowerCase().includes(q)) ||
      (a.role && a.role.toLowerCase().includes(q)) ||
      (a.jobOrder && a.jobOrder.toLowerCase().includes(q))
    );
  }, [phase2Applicants, phase2Search]);

  const filteredPhase3 = useMemo(() => {
    const q = phase3Search.trim().toLowerCase();
    if (!q) return phase3Applicants;
    return phase3Applicants.filter(a =>
      (a.name && a.name.toLowerCase().includes(q)) ||
      (a.applicantCode && a.applicantCode.toLowerCase().includes(q)) ||
      (a.id && String(a.id).toLowerCase().includes(q)) ||
      (a.role && a.role.toLowerCase().includes(q)) ||
      (a.jobOrder && a.jobOrder.toLowerCase().includes(q))
    );
  }, [phase3Applicants, phase3Search]);

  // ── Save Scores as Draft (Partial or In-Progress) ──────────────────────────
  const handleSaveDraftScores = async () => {
    if (isSaving || !selectedApplicant) return;
    setIsSaving(true);
    try {
      const applicantId = selectedApplicant.id;

      const testsRecord: Record<string, DynamicTestScore> = {};
      let enteredCount = 0;
      activeEvaluationTests.forEach(t => {
        const res = getTestEvaluationResult(t);
        if (res.hasEntry) enteredCount++;
        testsRecord[t.id] = {
          id: t.id,
          templateId: t.id,
          name: t.name,
          score: res.score,
          rawScore: res.rawScore,
          totalItems: res.totalItems,
          scoringType: t.scoringType || 'numeric',
          statusText: t.scoringType === 'pass_fail' ? (res.passed ? 'Passed' : 'Failed') : `${res.score}%`,
          maxScore: res.totalItems || t.maxScore || 100,
          passingScore: t.passingScore,
          weight: t.weight,
          passed: res.passed,
          type: t.type,
        };
      });

      const engScore = Number(Object.values(testsRecord).find(t => t.type === 'language' || t.name.toLowerCase().includes('english'))?.score ?? 0);
      const tradeScore = Number(Object.values(testsRecord).find(t => t.type === 'skills' || t.name.toLowerCase().includes('trade'))?.score ?? 0);
      const iqScore = Number(Object.values(testsRecord).find(t => t.type === 'iq' || t.name.toLowerCase().includes('iq'))?.score ?? 0);

      const currentEQ = personalityEQVerdict === 'Suitable' || personalityEQVerdict === 'Not Suitable' ? personalityEQVerdict : 'Pending';

      const cleanScores: TestScores = {
        tests: testsRecord,
        overallScore: currentWeightedScore,
        allPassed: false, // Draft is never marked as allPassed
        englishProficiency: engScore || undefined,
        tradeSkills: tradeScore || undefined,
        iqAptitude: iqScore || undefined,
        personalityEQ: currentEQ,
        employerSpecific: employerSpecificNotes || undefined,
      };

      const currentStatus = selectedApplicant.status === 'Provisional' ? 'Provisional' : (selectedApplicant.status || 'Initial Screening');
      const phaseDesc = `Draft evaluation scores saved (${enteredCount} of ${activeEvaluationTests.length} tests recorded). Candidate remains in Phase 1 pending test completion.`;

      updateApplicant(applicantId, {
        status: currentStatus,
        phaseDescription: phaseDesc,
        testScores: cleanScores,
        phase: 1,
      });

      addActivityLog({
        applicantId,
        action: 'Draft Evaluation Scores Saved',
        performedBy: currentUserName,
        department: 'Recruitment',
        details: `Saved ${enteredCount} of ${activeEvaluationTests.length} evaluation scores as draft. Candidate remains in Phase 1.`,
      });

      showToast(`✓ Saved ${enteredCount} of ${activeEvaluationTests.length} test scores as draft. Candidate remains in Phase 1.`);

      const numericId = parseInt(applicantId, 10);
      if (!isNaN(numericId)) {
        await Promise.all([
          api.post(`/examinations`, {
            applicantId: numericId,
            ...cleanScores,
          }).catch(console.error),
          api.put(`/applicants/${numericId}`, {
            application_id: selectedApplicant.applicationId,
            application_status: currentStatus,
            status_code: currentStatus,
            status: currentStatus,
            phase_description: phaseDesc,
            testScores: cleanScores,
          }).catch(console.error),
        ]);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to save draft scores. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Phase 1: Save & Complete Phase 1 Evaluations ─────────────────────────
  const handleEvaluatePhase1 = async () => {
    if (isSaving || !selectedApplicant) return;

    // Check if scores/verdicts are inputted for all active evaluations
    const missingTests = activeEvaluationTests.filter(t => !getTestEvaluationResult(t).hasEntry);
    if (missingTests.length > 0) {
      showToast(`Cannot complete Phase 1: ${missingTests.length} test(s) still pending. Use "Save Draft" to save partial progress.`);
      return;
    }

    setIsSaving(true);
    try {
      const applicantId = selectedApplicant.id;

      // Build structured dynamic tests record
      const testsRecord: Record<string, DynamicTestScore> = {};
      activeEvaluationTests.forEach(t => {
        const res = getTestEvaluationResult(t);
        testsRecord[t.id] = {
          id: t.id,
          templateId: t.id,
          name: t.name,
          score: res.score,
          rawScore: res.rawScore,
          totalItems: res.totalItems,
          scoringType: t.scoringType || 'numeric',
          statusText: t.scoringType === 'pass_fail' ? (res.passed ? 'Passed' : 'Failed') : `${res.score}%`,
          maxScore: res.totalItems || t.maxScore || 100,
          passingScore: t.passingScore,
          weight: t.weight,
          passed: res.passed,
          type: t.type,
        };
      });

      // Mapped legacy values for compatibility
      const engScore = Number(Object.values(testsRecord).find(t => t.type === 'language' || t.name.toLowerCase().includes('english'))?.score ?? 0);
      const tradeScore = Number(Object.values(testsRecord).find(t => t.type === 'skills' || t.name.toLowerCase().includes('trade'))?.score ?? 0);
      const iqScore = Number(Object.values(testsRecord).find(t => t.type === 'iq' || t.name.toLowerCase().includes('iq'))?.score ?? 0);

      const p1Passed = activeEvaluationTests.every(t => testsRecord[t.id]?.passed);

      // Phase 1 evaluates written & practical test scores.
      // Phase 2 interview remains Pending until conducted in Phase 2!
      const currentEQ = personalityEQVerdict === 'Suitable' || personalityEQVerdict === 'Not Suitable' ? personalityEQVerdict : 'Pending';

      const cleanScores: TestScores = {
        tests: testsRecord,
        overallScore: currentWeightedScore,
        allPassed: p1Passed,
        englishProficiency: engScore || undefined,
        tradeSkills: tradeScore || undefined,
        iqAptitude: iqScore || undefined,
        personalityEQ: currentEQ,
        employerSpecific: employerSpecificNotes || undefined,
      };

      setPersonalityEQVerdict(currentEQ);

      let newStatus = selectedApplicant.status;
      let phaseDesc = selectedApplicant.phaseDescription;

      if (p1Passed) {
        // ALWAYS advance to Phase 2: Pending Interview, NEVER skip directly to Phase 3!
        newStatus = 'Pending Interview';
        phaseDesc = `Passed all ${activeEvaluationTests.length} standardized tests. Cleared for Phase 2: Suitability & EQ Interview.`;
      } else {
        newStatus = 'Provisional';
        const failedSummary: string[] = [];
        activeEvaluationTests.forEach(t => {
          const rec = testsRecord[t.id];
          if (!rec?.passed) {
            if (t.scoringType === 'pass_fail') {
              failedSummary.push(`${t.name}: Failed clearance`);
            } else {
              failedSummary.push(`${t.name}: ${rec.score}% (${rec.rawScore}/${rec.totalItems}, pass is ≥${t.passingScore}%)`);
            }
          }
        });
        phaseDesc = `Provisional holding state — test score criteria unmet in: ${failedSummary.join(', ')}. Candidate remains active in pipeline.`;
      }

      // ── 1. IMMEDIATE OPTIMISTIC UPDATE ────────────────────────────────────
      updateApplicant(applicantId, {
        status: newStatus,
        phaseDescription: phaseDesc,
        testScores: cleanScores,
        phase: 1,
      });

      addActivityLog({
        applicantId,
        action: p1Passed ? 'Screening Phase 1 Passed — Cleared for Interview' : 'Phase 1 Evaluated — Status Set to Provisional',
        performedBy: currentUserName,
        department: 'Recruitment',
        details: p1Passed
          ? `All ${activeEvaluationTests.length} evaluations passed (Aggregate: ${currentWeightedScore}%). Candidate advanced to Phase 2: Pending Interview.`
          : `Applicant placed in Provisional status due to unmet evaluation criteria. Candidate retained in pipeline.`,
      });

      if (p1Passed) {
        showToast(`✓ All ${activeEvaluationTests.length} tests passed! Candidate advanced to Phase 2: Pending Interview.`);
      } else {
        showToast('Scores saved. Applicant status set to "Provisional" (remains in pipeline).');
      }

      // ── 2. BACKGROUND API PERSISTENCE (PARALLEL TO SUPABASE) ─────────────
      const numericId = parseInt(applicantId, 10);
      if (!isNaN(numericId)) {
        await Promise.all([
          api.post(`/examinations`, {
            applicantId: numericId,
            ...cleanScores,
          }).catch(console.error),
          api.put(`/applicants/${numericId}`, {
            application_id: selectedApplicant.applicationId,
            application_status: newStatus,
            status_code: newStatus,
            status: newStatus,
            phase_description: phaseDesc,
            testScores: cleanScores,
          }).catch(console.error),
        ]);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to save scores to server. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Phase 2: Evaluate Personality / EQ Assessment ──────────────────────────
  const handleEvaluatePhase2 = async (outcome: 'Suitable' | 'Not Suitable' | 'Pending') => {
    if (isSaving || !selectedApplicant) return;

    if (!phase1AllPassed) {
      showToast(`Cannot complete EQ evaluation until all ${activeEvaluationTests.length} Phase 1 tests have been passed.`);
      return;
    }

    setIsSaving(true);
    try {
      const applicantId = selectedApplicant.id;

      // Re-create cleanScores keeping all active test scores
      const testsRecord: Record<string, DynamicTestScore> = {};
      activeEvaluationTests.forEach(t => {
        const res = getTestEvaluationResult(t);
        let score = res.score;
        let isPass = res.passed;
        if (t.type === 'eq') {
          score = outcome === 'Suitable' ? Math.max(score, t.passingScore) : (outcome === 'Not Suitable' ? Math.min(score, t.passingScore - 10) : score);
          isPass = outcome === 'Suitable';
        }
        testsRecord[t.id] = {
          id: t.id,
          templateId: t.id,
          name: t.name,
          score,
          rawScore: res.rawScore,
          totalItems: res.totalItems,
          scoringType: t.scoringType || 'numeric',
          statusText: t.scoringType === 'pass_fail' ? (isPass ? 'Passed' : 'Failed') : `${score}%`,
          maxScore: t.maxScore || 100,
          passingScore: t.passingScore,
          weight: t.weight,
          passed: isPass,
          type: t.type,
        };
      });

      const engScore = Number(Object.values(testsRecord).find(t => t.type === 'language' || t.name.toLowerCase().includes('english'))?.score ?? 0);
      const tradeScore = Number(Object.values(testsRecord).find(t => t.type === 'skills' || t.name.toLowerCase().includes('trade'))?.score ?? 0);
      const iqScore = Number(Object.values(testsRecord).find(t => t.type === 'iq' || t.name.toLowerCase().includes('iq'))?.score ?? 0);

      const cleanScores: TestScores = {
        tests: testsRecord,
        overallScore: currentWeightedScore,
        allPassed: phase1AllPassed,
        englishProficiency: engScore || undefined,
        tradeSkills: tradeScore || undefined,
        iqAptitude: iqScore || undefined,
        personalityEQ: outcome,
        employerSpecific: employerSpecificNotes || undefined,
      };

      setPersonalityEQVerdict(outcome);

      let newStatus = selectedApplicant.status;
      let phaseDesc = selectedApplicant.phaseDescription;

      if (outcome === 'Suitable') {
        newStatus = 'Review Score for Medical Referral';
        phaseDesc = 'Personality/EQ Assessment passed (Suitable). Ready for Phase 3: Review Score for Medical Referral.';
      } else if (outcome === 'Not Suitable') {
        newStatus = 'Provisional';
        phaseDesc = 'Provisional holding state — applicant evaluated as Not Suitable for the job order during Personality/EQ interview. Retained in pipeline.';
      } else {
        newStatus = 'Pending Interview';
        phaseDesc = `Passed all ${activeEvaluationTests.length} evaluations. Cleared for Phase 2: Personality & EQ Assessment.`;
      }

      updateApplicant(applicantId, {
        status: newStatus,
        phaseDescription: phaseDesc,
        testScores: cleanScores,
        phase: 1,
      });

      addActivityLog({
        applicantId,
        action: outcome === 'Suitable'
          ? 'Phase 2 Passed — Cleared for Phase 3'
          : outcome === 'Not Suitable'
            ? 'Phase 2 Failed — Status Set to Provisional'
            : 'Interview Verdict Reset to Pending',
        performedBy: currentUserName,
        department: 'Recruitment',
        details: outcome === 'Suitable'
          ? `Applicant passed Personality/EQ Assessment as 'Suitable'. Advanced to Phase 3: Review Score for Medical Referral.`
          : outcome === 'Not Suitable'
            ? `Applicant evaluated as 'Not Suitable' in Personality/EQ interview. Status set to Provisional (applicant remains in pipeline).`
            : `Personality/EQ assessment unselected and reset. Status reverted to Pending Interview.`,
      });

      if (outcome === 'Suitable') {
        showToast('✓ Personality/EQ passed! Applicant advanced to Phase 3: Review Score for Medical Referral.');
      } else if (outcome === 'Not Suitable') {
        showToast('Applicant evaluated as Not Suitable. Status set to "Provisional" (remains in pipeline).');
      } else {
        showToast('Interview verdict unselected. Status reset to "Pending Interview".');
      }

      const numericId = parseInt(applicantId, 10);
      if (!isNaN(numericId)) {
        await Promise.all([
          api.post(`/examinations`, {
            applicantId: numericId,
            ...cleanScores,
          }).catch(console.error),
          api.put(`/applicants/${numericId}`, {
            application_id: selectedApplicant.applicationId,
            application_status: newStatus,
            status_code: newStatus,
            status: newStatus,
            phase_description: phaseDesc,
            testScores: cleanScores,
          }).catch(console.error),
        ]);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to save interview outcome. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Phase 3: Button 1 — REVIEW SCORE ───────────────────────────────────────
  const handleOpenReviewScoresModal = () => {
    const rawMap: Record<string, number | string> = {};
    const totalMap: Record<string, number | string> = {};
    const pfMap: Record<string, 'Pass' | 'Fail' | ''> = {};

    activeEvaluationTests.forEach(t => {
      rawMap[t.id] = dynamicRawScores[t.id] ?? '';
      totalMap[t.id] = dynamicTotalItems[t.id] ?? t.maxScore ?? 100;
      pfMap[t.id] = dynamicPassFail[t.id] ?? '';
    });

    setReviewDynamicRawScores(rawMap);
    setReviewDynamicTotalItems(totalMap);
    setReviewDynamicPassFail(pfMap);
    setReviewEQVerdict(personalityEQVerdict);
    setReviewEmployerNotes(employerSpecificNotes);
    setShowReviewScoreModal(true);
  };

  const handleSaveScoreCorrection = async () => {
    if (!selectedApplicant) return;
    setIsSaving(true);
    try {
      const applicantId = selectedApplicant.id;

      const testsRecord: Record<string, DynamicTestScore> = {};
      activeEvaluationTests.forEach(t => {
        const res = getTestEvaluationResult(t, reviewDynamicRawScores, reviewDynamicTotalItems, reviewDynamicPassFail);
        testsRecord[t.id] = {
          id: t.id,
          templateId: t.id,
          name: t.name,
          score: res.score,
          rawScore: res.rawScore,
          totalItems: res.totalItems,
          scoringType: t.scoringType || 'numeric',
          statusText: t.scoringType === 'pass_fail' ? (res.passed ? 'Passed' : 'Failed') : `${res.score}%`,
          maxScore: t.maxScore || 100,
          passingScore: t.passingScore,
          weight: t.weight,
          passed: res.passed,
          type: t.type,
        };
      });

      const p1Pass = activeEvaluationTests.every(t => testsRecord[t.id]?.passed);
      const eqPass = reviewEQVerdict === 'Suitable';

      const engScore = Number(Object.values(testsRecord).find(t => t.type === 'language' || t.name.toLowerCase().includes('english'))?.score ?? 0);
      const tradeScore = Number(Object.values(testsRecord).find(t => t.type === 'skills' || t.name.toLowerCase().includes('trade'))?.score ?? 0);
      const iqScore = Number(Object.values(testsRecord).find(t => t.type === 'iq' || t.name.toLowerCase().includes('iq'))?.score ?? 0);

      const correctedWeightedScore = Math.round(
        activeEvaluationTests.reduce((acc, t) => {
          const res = getTestEvaluationResult(t, reviewDynamicRawScores, reviewDynamicTotalItems, reviewDynamicPassFail);
          const wt = t.weight || 0;
          return acc + (res.score * wt);
        }, 0) / (totalActiveWeight > 0 ? totalActiveWeight : 1)
      );

      const cleanScores: TestScores = {
        tests: testsRecord,
        overallScore: correctedWeightedScore,
        allPassed: p1Pass,
        englishProficiency: engScore || undefined,
        tradeSkills: tradeScore || undefined,
        iqAptitude: iqScore || undefined,
        personalityEQ: reviewEQVerdict,
        employerSpecific: reviewEmployerNotes || undefined,
      };

      setDynamicRawScores(reviewDynamicRawScores);
      setDynamicTotalItems(reviewDynamicTotalItems);
      setDynamicPassFail(reviewDynamicPassFail);
      setPersonalityEQVerdict(reviewEQVerdict);
      setEmployerSpecificNotes(reviewEmployerNotes);

      let newStatus = selectedApplicant.status;
      let phaseDesc = selectedApplicant.phaseDescription;

      if (p1Pass && eqPass) {
        newStatus = 'Review Score for Medical Referral';
        phaseDesc = 'Scores reviewed and updated. Cleared for Medical Referral generation.';
      } else if (p1Pass && !eqPass) {
        newStatus = reviewEQVerdict === 'Not Suitable' ? 'Provisional' : 'Pending Interview';
        phaseDesc = reviewEQVerdict === 'Not Suitable'
          ? 'Provisional holding state — Personality/EQ assessment is Not Suitable.'
          : 'Pending Personality/EQ Assessment interview.';
      } else {
        newStatus = 'Provisional';
        phaseDesc = 'Provisional holding state — score correction placed applicant below passing criteria in Phase 1.';
      }

      updateApplicant(applicantId, {
        status: newStatus,
        phaseDescription: phaseDesc,
        testScores: cleanScores,
        phase: 1,
      });

      addActivityLog({
        applicantId,
        action: 'Review Score Updated',
        performedBy: currentUserName,
        department: 'Recruitment',
        details: `Scores corrected. Overall score: ${correctedWeightedScore}%. Resulting status: ${newStatus}.`,
      });

      setShowReviewScoreModal(false);
      if (newStatus === 'Provisional') {
        showToast('Scores corrected. Score fell below criteria; status set to Provisional (applicant remains in pipeline).');
      } else {
        showToast('✓ Scores successfully corrected and updated.');
      }

      const numericId = parseInt(applicantId, 10);
      if (!isNaN(numericId)) {
        await Promise.all([
          api.post(`/examinations`, {
            applicantId: numericId,
            ...cleanScores,
          }).catch(console.error),
          api.put(`/applicants/${numericId}`, {
            application_id: selectedApplicant.applicationId,
            application_status: newStatus,
            status_code: newStatus,
            status: newStatus,
            phase_description: phaseDesc,
            testScores: cleanScores,
          }).catch(console.error),
        ]);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to update scores. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Phase 3: Button 2 — GENERATE MEDICAL REFERRAL ──────────────────────────
  const handleOpenReferralModal = () => {
    if (!allScoresPassed) {
      showToast('Cannot generate Medical Referral until all test scores and interview are passed.');
      return;
    }
    if (!selectedClinic && partnerClinicsList.length > 0) {
      const names = partnerClinicsList.map((c: any) => c.clinicName || c.clinic_name);
      setSelectedClinic(names[0] || '');
    }
    setShowReferralModal(true);
  };

  const handleDownloadScreeningSummaryPdf = () => {
    if (!selectedApplicant) return;
    setIsGeneratingReferral(true);

    try {
      const applicantId = selectedApplicant.id;
      const refDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const refNo = `SCR-${new Date().getFullYear()}-${String(selectedApplicant.applicantCode || applicantId).padStart(5, '0')}`;

      // Clean ASCII text helper to prevent font glitches and eliminate Flowsensus branding
      const cleanPdfText = (str: string | null | undefined): string => {
        if (!str) return '';
        return String(str)
          .replace(/→/g, ': ')
          .replace(/←/g, '<-')
          .replace(/[✓✔]/g, '')
          .replace(/[•●▪]/g, '-')
          .replace(/[\u2018\u2019]/g, "'")
          .replace(/[\u201C\u201D]/g, '"')
          .replace(/[\u2013\u2014]/g, '-')
          .replace(/[\u00A0]/g, ' ')
          .replace(/flowsensus\s*/gi, '')
          .replace(/[^\x20-\x7E\r\n\t]/g, '');
      };

      const agencyName = cleanPdfText(agencyProfile?.agency_name || 'LICENSED OVERSEAS RECRUITMENT AGENCY').toUpperCase();
      const poeaLicense = agencyProfile?.poea_license_no
        ? `POEA/DMW License: ${cleanPdfText(agencyProfile.poea_license_no)}`
        : 'POEA / DMW Accredited Placement Agency';
      const evaluatorName = cleanPdfText(currentUserName || 'Evaluating Officer').replace(/flowsensus\s*/gi, '').trim() || 'Superadmin';

      // Initialize formal A4 portrait document (210mm x 297mm)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = 210;
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2); // 180mm

      let y = 16;

      // ── Header (Formal, Plain, Official Recruitment Agency Standard) ──
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(agencyName, margin, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text('OFFICIAL CANDIDATE SCREENING & EVALUATION REPORT', margin, y + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(`REF NO: ${refNo}`, 195, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.text(`DATE: ${refDate}`, 195, y + 4.5, { align: 'right' });

      y += 8;
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.5);
      doc.line(margin, y, 195, y);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.2);
      doc.line(margin, y + 0.8, 195, y + 0.8);

      y += 4.5;

      // ── Section I: Candidate Identification & Allocation ──
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 5.5, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, y, contentWidth, 5.5, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('I. CANDIDATE IDENTIFICATION & ALLOCATION', margin + 3, y + 3.8);

      y += 5.5;
      const gridH = 14;
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, y, contentWidth, gridH, 'S');
      doc.line(margin + 90, y, margin + 90, y + gridH);
      doc.line(margin, y + 7, 195, y + 7);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('FULL NAME:', margin + 3, y + 3);
      doc.text('APPLICANT CODE:', margin + 93, y + 3);
      doc.text('APPLIED TRADE / ROLE:', margin + 3, y + 10);
      doc.text('ASSIGNED JOB ORDER:', margin + 93, y + 10);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(String(selectedApplicant.name || 'N/A'), margin + 3, y + 5.8);
      doc.text(String(selectedApplicant.applicantCode || selectedApplicant.id || 'N/A'), margin + 93, y + 5.8);
      doc.text(String(selectedApplicant.role || 'Unspecified'), margin + 3, y + 12.8);
      doc.text(String(selectedApplicant.jobOrder || 'Unassigned / General Pool'), margin + 93, y + 12.8);

      y += gridH + 4.5;

      // ── Section II: Phase 1 Standardized Technical & Competency Evaluations ──
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 5.5, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, y, contentWidth, 5.5, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('II. PHASE 1 — STANDARDIZED COMPETENCY & TECHNICAL EVALUATIONS', margin + 3, y + 3.8);

      y += 5.5;
      const colW = [10, 65, 30, 25, 25, 25]; // sum = 180
      const tableHeaders = ['#', 'EVALUATION ASSESSMENT', 'CATEGORY', 'PASS MARK', 'SCORE', 'VERDICT'];
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, 5, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, y, contentWidth, 5, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);

      let curX = margin;
      doc.text(tableHeaders[0], curX + 2, y + 3.5); curX += colW[0];
      doc.text(tableHeaders[1], curX + 2, y + 3.5); curX += colW[1];
      doc.text(tableHeaders[2], curX + 2, y + 3.5); curX += colW[2];
      doc.text(tableHeaders[3], curX + 2, y + 3.5); curX += colW[3];
      doc.text(tableHeaders[4], curX + 2, y + 3.5); curX += colW[4];
      doc.text(tableHeaders[5], curX + 2, y + 3.5);

      y += 5;

      activeEvaluationTests.forEach((t, i) => {
        const res = getTestEvaluationResult(t);
        const passed = res.passed;
        const isPassFail = t.scoringType === 'pass_fail';
        const benchmark = isPassFail ? 'Pass' : `Min. ${t.passingScore}%`;
        const scoreDisplay = isPassFail
          ? (res.verdict === 'Pass' ? 'PASSED' : (res.verdict === 'Fail' ? 'FAILED' : 'PENDING'))
          : (res.hasEntry ? `${res.rawScore} / ${res.totalItems} (${res.score}%)` : 'PENDING');
        const verdictDisplay = passed ? 'PASSED' : (res.hasEntry ? 'FAILED' : 'PENDING');

        const catDisplay = t.type === 'skills'
          ? 'Trade / Skills'
          : t.type === 'language'
            ? 'Language Aptitude'
            : t.type === 'iq'
              ? 'Cognitive / IQ'
              : t.type === 'eq'
                ? 'EQ / Psychological'
                : t.type === 'medical'
                  ? 'Medical Review'
                  : 'General Test';

        const rowH = 6;
        if (i % 2 === 1) {
          doc.setFillColor(249, 250, 251);
          doc.rect(margin, y, contentWidth, rowH, 'F');
        }
        doc.setDrawColor(226, 232, 240);
        doc.rect(margin, y, contentWidth, rowH, 'S');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);

        let rx = margin;
        doc.text(String(i + 1), rx + 2, y + 4.2); rx += colW[0];
        doc.setFont('helvetica', 'bold');
        const truncatedName = t.name.length > 34 ? t.name.substring(0, 32) + '...' : t.name;
        doc.text(truncatedName, rx + 2, y + 4.2); rx += colW[1];
        doc.setFont('helvetica', 'normal');
        doc.text(catDisplay, rx + 2, y + 4.2); rx += colW[2];
        doc.text(benchmark, rx + 2, y + 4.2); rx += colW[3];
        doc.text(scoreDisplay, rx + 2, y + 4.2); rx += colW[4];
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(verdictDisplay, rx + 2, y + 4.2);
        y += rowH;
      });

      // Aggregate Summary Row
      y += 2;
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 7, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, y, contentWidth, 7, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(`CANDIDATE WEIGHTED AGGREGATE SCORE: ${currentWeightedScore}%`, margin + 4, y + 4.8);
      doc.text(`STATUS: ${phase1AllPassed ? 'PHASE 1 QUALIFIED' : 'PROVISIONAL'}`, 195 - 4, y + 4.8, { align: 'right' });
      y += 11;

      // ── Section III: Phase 2 Personality & EQ Interview ──
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 5.5, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, y, contentWidth, 5.5, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('III. PHASE 2 — PERSONALITY & BEHAVIORAL SUITABILITY INTERVIEW', margin + 3, y + 3.8);

      y += 5.5;
      const eqH = 17;
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, y, contentWidth, eqH, 'S');
      doc.line(margin + 90, y, margin + 90, y + 8.5);
      doc.line(margin, y + 8.5, 195, y + 8.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('INTERVIEW VERDICT:', margin + 3, y + 3);
      doc.text('EVALUATING OFFICER:', margin + 93, y + 3);
      doc.text('EVALUATION OBSERVATIONS & REMARKS:', margin + 3, y + 11.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      const verdictText = personalityEQVerdict === 'Suitable'
        ? 'SUITABLE — Recommended for Overseas Placement'
        : (personalityEQVerdict === 'Not Suitable' ? 'NOT SUITABLE (Provisional)' : 'PENDING ASSESSMENT');
      doc.text(verdictText, margin + 3, y + 6);
      doc.text(`${evaluatorName} (Screening Operations)`, margin + 93, y + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      const remarksText = 'Candidate demonstrates appropriate behavioral stability, professional aptitude, and readiness for deployment.';
      doc.text(remarksText, margin + 3, y + 14.5);

      y += eqH + 5;

      // ── Section IV: Official Endorsement & Conforme ──
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 5.5, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, y, contentWidth, 5.5, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('IV. OFFICIAL ENDORSEMENT & CONFORME', margin + 3, y + 3.8);

      y += 5.5;
      const sigH = 26;
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, y, contentWidth, sigH, 'S');
      doc.line(margin + 90, y, margin + 90, y + sigH);

      // Left signature (Candidate)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('CANDIDATE ACKNOWLEDGMENT & CONFORME:', margin + 45, y + 4.5, { align: 'center' });
      doc.line(margin + 8, y + 16, margin + 82, y + 16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(String(selectedApplicant.name), margin + 45, y + 19.5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('Candidate Signature over Printed Name / Date', margin + 45, y + 23, { align: 'center' });

      // Right signature (Agency / Officer)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('AUTHORIZED EVALUATING OFFICER / ENDORSING AGENCY:', margin + 135, y + 4.5, { align: 'center' });
      doc.line(margin + 98, y + 16, margin + 172, y + 16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(`${agencyName} / ${evaluatorName}`, margin + 135, y + 19.5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('Staff Evaluator Signature over Printed Name', margin + 135, y + 23, { align: 'center' });

      // ── Footer (Plain, Formal Standard) ──
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.line(margin, 285, 195, 285);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`CONFIDENTIAL • ${agencyName} • OFFICIAL SCREENING RECORD • A4 STANDARD • PAGE 1 OF 1`, 105, 288.5, { align: 'center' });

      // Save and trigger browser download
      const cleanAgencyFileName = agencyName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanCandidateFileName = (selectedApplicant.name || 'Candidate').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanFileName = `${cleanCandidateFileName}_Screening_Summary_${cleanAgencyFileName}.pdf`;
      doc.save(cleanFileName);

      setGeneratedReferralIds(prev => new Set([...prev, applicantId]));
      addActivityLog({
        applicantId,
        action: 'Downloaded Screening Summary PDF (A4)',
        performedBy: currentUserName,
        department: 'Recruitment',
        details: `Generated and downloaded formal A4 Candidate Screening & Evaluation Report for ${selectedApplicant.name}.`,
      });
      showToast(`✓ Downloaded formal Screening Summary PDF for ${selectedApplicant.name}`);
    } catch (err) {
      console.error(err);
      showToast('Failed to generate summary PDF.');
    } finally {
      setIsGeneratingReferral(false);
    }
  };

  // ── Phase 3: Button 3 — UPDATE APPLICANT STATUS ────────────────────────────
  const handleOpenUpdateStatusConfirmation = () => {
    if (!allScoresPassed) {
      showToast('Cannot update status: candidate must pass all evaluation tests and the suitability interview.');
      return;
    }
    // Default to empty (Pending) so no random clinic is auto-assigned
    setSelectedClinic('');
    setShowUpdateStatusModal(true);
  };

  const handleConfirmMoveToMedicalReferral = async () => {
    if (isUpdatingStatus || !selectedApplicant) return;
    setIsUpdatingStatus(true);
    try {
      const applicantId = selectedApplicant.id;
      const numericId = parseInt(applicantId, 10);
      const hasClinic = Boolean(selectedClinic && selectedClinic.trim() && selectedClinic !== 'PENDING' && selectedClinic !== 'Pending Clinic Assignment');

      // Only save Clinic Referral if a clinic was explicitly chosen
      if (hasClinic) {
        try {
          const matched = partnerClinicsList.find((c: any) => (c.clinicName || c.clinic_name) === selectedClinic);
          const cId = matched ? (matched.clinicId || matched.clinic_id) : null;
          if (cId) {
            await api.post('/clinic-referrals', {
              applicantId: numericId,
              clinicId: cId,
              referralDate: new Date().toISOString().split('T')[0],
              medicalStatus: 'PENDING',
              remarks: `Pre-employment medical referral issued to ${selectedClinic} by ${currentUserName}.`
            }).catch(console.error);
          }
        } catch (refErr) {
          console.warn('Could not record clinic referral:', refErr);
        }
      } else {
        // Ensure any previous or test clinic referral is removed so clinic reliably stays Pending
        if (!isNaN(numericId)) {
          await api.delete(`/clinic-referrals/${numericId}`).catch(() => {});
        }
      }

      const phaseDescription = hasClinic
        ? `Screening completed. Medical referral issued to ${selectedClinic}. Awaiting clinical clearance.`
        : 'Screening completed. Advanced to Medical Clearance. Clinic assignment pending.';

      const updates: Partial<ApplicantRecord> = {
        status: 'Medical Clearance',
        phase: 2,
        currentHandler: 'Unassigned',
        currentDepartment: 'Admin',
        medicalReferralClinic: hasClinic ? selectedClinic : 'Pending Clinic Assignment',
        medicalReferralDate: hasClinic ? new Date().toISOString().split('T')[0] : undefined,
        medicalReferralGenerated: hasClinic,
        phaseDescription,
      };

      if (!isNaN(numericId)) {
        await api.put(`/applicants/${numericId}`, {
          application_id: selectedApplicant.applicationId,
          application_status: 'Medical Clearance',
          current_phase: 2,
          current_handler: 'Unassigned',
          current_department: 'Admin',
          phase_description: updates.phaseDescription,
          test_scores: {
            ...(selectedApplicant.testScores || {}),
            personalityEQ: 'Suitable'
          },
          statusChangeReason: hasClinic
            ? `Screening completed. Medical referral issued to ${selectedClinic}`
            : 'Screening completed. Advanced to Medical Clearance (Clinic Pending)',
          statusChangeSource: 'STAFF_ACTION'
        });
      }

      // Update local state and workflow state
      updateApplicant(applicantId, updates);
      updateWorkflow({ screeningPassed: true });

      addActivityLog({
        applicantId,
        action: 'Screening Completed — Moved to Medical Clearance',
        performedBy: currentUserName,
        department: 'Recruitment',
        details: hasClinic
          ? `Applicant ${selectedApplicant.name} completed all screening phases with verified scores. Referral issued to ${selectedClinic}. Endorsed for Medical Clearance.`
          : `Applicant ${selectedApplicant.name} completed all screening phases with verified scores. Endorsed for Medical Clearance with clinic assignment pending.`,
      });

      setShowUpdateStatusModal(false);
      showToast(hasClinic
        ? `✓ ${selectedApplicant.name} moved to Medical Clearance (${selectedClinic}).`
        : `✓ ${selectedApplicant.name} moved to Medical Clearance (Clinic Pending).`
      );

      // Return to Screening overview; applicant will no longer appear in any screening sub-phase
      setListView(true);
    } catch (err) {
      console.error(err);
      showToast('Failed to update applicant status. Please try again.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // ── Stop Processing Handler ────────────────────────────────────────────────
  const handleStopProcessing = async () => {
    if (!stopReason.trim() || !selectedApplicant) return;
    const applicantId = selectedApplicant.id;

    updateApplicant(applicantId, {
      isStopped: true,
      stoppedReason: stopReason,
      stoppedBy: currentUserName,
      stoppedAt: new Date().toISOString(),
      stoppedPhase: 1,
      status: 'Processing Stopped',
      phaseDescription: `Processing terminated at Screening by ${currentUserName}: ${stopReason}`,
    });

    const numericId = parseInt(applicantId, 10);
    if (!isNaN(numericId)) {
      await api.put(`/applicants/${numericId}`, {
        application_id: selectedApplicant.applicationId,
        application_status: 'Processing Stopped',
        current_phase: 0,
        phase_description: `Processing terminated at Screening by ${currentUserName}: ${stopReason}`,
        statusChangeReason: `Processing Stopped: ${stopReason}`,
        statusChangeSource: 'STAFF_ACTION'
      }).catch(console.error);
    }

    addActivityLog({
      applicantId,
      action: 'Processing Stopped — Screening Phase',
      performedBy: currentUserName,
      department: 'Recruitment',
      details: `Applicant discontinued at Screening. Reason: ${stopReason}`,
    });

    showToast('Processing stopped at Screening. Applicant record locked.');
    setShowStopModal(false);
    setStopReason('');
    setListView(true);
  };

  const handleClaimApplicant = async (id: string) => {
    const target = applicants.find(a => String(a.id) === id);
    if (!target) return;
    const numericId = parseInt(id, 10);
    updateApplicant(id, {
      currentHandler: currentUserName,
      currentDepartment: 'Recruitment',
      phaseDescription: `Screening evaluation claimed by ${currentUserName}`
    });
    if (!isNaN(numericId)) {
      await api.put(`/applicants/${numericId}`, {
        application_id: target.applicationId,
        current_handler: currentUserName,
        current_department: 'Recruitment',
        phase_description: `Screening evaluation claimed by ${currentUserName}`
      }).catch(console.error);
    }
    addActivityLog({
      applicantId: id,
      action: 'Turnover: Claimed at Screening',
      performedBy: currentUserName,
      department: 'Recruitment',
      details: `${currentUserName} claimed evaluation of applicant ${target.name} from the unassigned screening queue pool.`
    });
    showToast(`✓ Applicant ${target.name} claimed into your queue.`);
  };

  const openApplicant = async (id: string) => {
    const target = applicants.find(a => String(a.id) === id);
    if (!target) return;

    const isAssignedToMe = target.currentHandler?.trim().toLowerCase() === currentUserName.trim().toLowerCase();
    const isUnassigned = !target.currentHandler || target.currentHandler === 'Unassigned' || target.currentHandler === 'Unassigned Pool' || target.currentHandler === 'System Agent';

    // Disallow opening if claimed and currently handled by another staff member
    if (!isAssignedToMe && !isUnassigned) {
      showToast(`Cannot access: Candidate is currently claimed and handled by ${target.currentHandler}.`);
      return;
    }

    setSelectedApplicantId(id);
    setListView(false);

    // Turnover: If applicant is unassigned in pool, auto-claim for this staff member
    if (isUnassigned) {
      await handleClaimApplicant(id);
    }
  };

  const handleReleaseApplicantFromScreening = async (id: string) => {
    const target = applicants.find(a => String(a.id) === id);
    const numericId = parseInt(id, 10);
    updateApplicant(id, {
      currentHandler: 'Unassigned',
      phaseDescription: `Returned to unassigned screening candidate pool by ${currentUserName}`
    });
    if (!isNaN(numericId)) {
      await api.put(`/applicants/${numericId}`, {
        application_id: target?.applicationId,
        current_handler: 'Unassigned',
        phase_description: `Returned to unassigned screening candidate pool by ${currentUserName}`
      }).catch(console.error);
    }
    addActivityLog({
      applicantId: id,
      action: 'Turnover: Released to Pool',
      performedBy: currentUserName,
      department: 'Recruitment',
      details: `${currentUserName} returned applicant ${target?.name || id} to the unassigned screening candidate pool for other staff to evaluate.`
    });
    showToast(`Applicant returned to unassigned candidate pool.`);
    setListView(true);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // VIEW: LIST OF APPLICANTS BY SCREENING SUB-PHASE
  // ───────────────────────────────────────────────────────────────────────────
  if (listView) {
    return (
      <div className="space-y-6 w-full animate-in fade-in duration-150">
        {/* Module Header */}
        <div>
          <h2 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
            <Microscope className="w-6 h-6 text-[#0EA5E9]" /> Screening Module
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Standardized evaluation testing, interview suitability assessment, and medical referral dispatch
          </p>
        </div>

        {/* Phase Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phase 1: Pending Screening</p>
              <h4 className="text-2xl font-black text-[#0F172A] mt-1">{phase1Applicants.length}</h4>
              <p className="text-xs text-slate-500 mt-0.5">Standardized 3 tests & provisional holding</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              1
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phase 2: Pending Interview</p>
              <h4 className="text-2xl font-black text-sky-600 mt-1">{phase2Applicants.length}</h4>
              <p className="text-xs text-slate-500 mt-0.5">Personality & EQ suitability evaluation</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#0EA5E9] flex items-center justify-center font-bold">
              2
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phase 3: Review & Referral</p>
              <h4 className="text-2xl font-black text-emerald-600 mt-1">{phase3Applicants.length}</h4>
              <p className="text-xs text-slate-500 mt-0.5">All passed — ready for referral & dispatch</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              3
            </div>
          </div>
        </div>

        {/* ── Turnover Queue Filter Navigation (Light Theme, Consistent System Design) ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setScreeningQueueTab('ALL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                screeningQueueTab === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs border border-slate-900'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>All Screening Candidates</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                screeningQueueTab === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {screeningQueueCounts.all}
              </span>
            </button>

            <button
              onClick={() => setScreeningQueueTab('MY_QUEUE')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                screeningQueueTab === 'MY_QUEUE'
                  ? 'bg-sky-600 text-white shadow-xs border border-sky-600'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>My Assigned Queue</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                screeningQueueTab === 'MY_QUEUE' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {screeningQueueCounts.myQueue}
              </span>
            </button>

            <button
              onClick={() => setScreeningQueueTab('UNASSIGNED')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                screeningQueueTab === 'UNASSIGNED'
                  ? 'bg-amber-600 text-white shadow-xs border border-amber-600'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Active Candidate Pool</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                screeningQueueTab === 'UNASSIGNED' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {screeningQueueCounts.pool}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active Recruiter: <strong className="text-slate-800 font-bold">{currentUserName}</strong></span>
          </div>
        </div>

        {/* ── SUB-PHASE 1: PENDING SCREENING ──────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                Phase 1 — Pending Screening
              </h3>
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                {phase1Search ? `${filteredPhase1.length} of ${phase1Applicants.length}` : phase1Applicants.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden xl:inline text-xs text-slate-400">English (≥60%) • Trade Skills (≥70%) • IQ/Aptitude (≥50%)</span>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={phase1Search}
                  onChange={e => setPhase1Search(e.target.value)}
                  placeholder="Search Phase 1 (name, code, role)..."
                  className="pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all w-56 sm:w-64 text-slate-700 shadow-2xs"
                />
                {phase1Search && (
                  <button
                    type="button"
                    onClick={() => setPhase1Search('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {phase1Applicants.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 py-8 text-center text-slate-400 text-sm">
              No applicants currently pending Phase 1 standardized testing
            </div>
          ) : filteredPhase1.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 py-6 text-center text-slate-400 text-sm">
              <p>No applicants match &quot;{phase1Search}&quot; in Phase 1</p>
              <button
                type="button"
                onClick={() => setPhase1Search('')}
                className="mt-2 text-xs text-[#0EA5E9] hover:underline font-semibold cursor-pointer"
              >
                Clear search filter
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
              {filteredPhase1.map(a => {
                const activeFlags = (a.employmentFlags || []).filter(f => !f.dismissed && !f.validated);
                const isProvisional = a.status === 'Provisional';
                const isAssignedToMe = a.currentHandler?.trim().toLowerCase() === currentUserName.trim().toLowerCase();
                const isUnassigned = !a.currentHandler || a.currentHandler === 'Unassigned' || a.currentHandler === 'Unassigned Pool' || a.currentHandler === 'System Agent';
                const isHandledByOther = !isUnassigned && !isAssignedToMe;
                const canOpen = !isHandledByOther && activeFlags.length === 0;

                return (
                  <button
                    key={a.id}
                    onClick={() => canOpen && openApplicant(a.id)}
                    disabled={!canOpen}
                    className={`w-full text-left rounded-xl border px-5 py-4 flex items-center gap-4 transition-all ${
                      isHandledByOther
                        ? 'bg-slate-50/70 border-slate-200 opacity-80 cursor-not-allowed'
                        : activeFlags.length > 0
                          ? 'bg-white border-amber-200 opacity-60 cursor-not-allowed'
                          : isAssignedToMe
                            ? 'bg-sky-50/20 border-sky-300 hover:border-sky-500 hover:shadow-sm cursor-pointer'
                            : isProvisional
                              ? 'bg-amber-50/20 border-amber-300 hover:border-amber-500 hover:shadow-sm cursor-pointer'
                              : 'bg-white border-slate-200 hover:border-[#0EA5E9]/60 hover:shadow-sm cursor-pointer'
                    }`}
                  >
                    {a.photoDataUrl || a.photo ? (
                      <img
                        src={a.photoDataUrl || a.photo}
                        alt="photo"
                        className="w-11 h-11 rounded-lg object-cover flex-shrink-0 border border-slate-200"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 flex-shrink-0">
                        {a.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[#0F172A]">{a.name}</span>
                        <span className="text-xs text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                          {a.applicantCode || a.id}
                        </span>

                        {/* Handler Badge */}
                        {isUnassigned ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                            <UserPlus className="w-3 h-3 text-amber-600" />
                            Unassigned
                          </span>
                        ) : isAssignedToMe ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-semibold border bg-sky-50 text-sky-700 border-sky-300">
                            <User className="w-3 h-3 text-sky-600" />
                            {a.currentHandler}
                            <span className="text-[10px] text-sky-600 font-bold">(You)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-semibold border bg-slate-100 text-slate-600 border-slate-200">
                            <User className="w-3 h-3 text-slate-400" />
                            Handled by {a.currentHandler}
                          </span>
                        )}

                        {isProvisional && (
                          <span className="text-xs bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <AlertTriangle size={11} /> Provisional
                          </span>
                        )}

                        {activeFlags.length > 0 && (
                          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                            <Flag size={10} /> {activeFlags.length} unresolved flag{activeFlags.length > 1 ? 's' : ''} — resolve first
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                        <span className="font-medium text-slate-700">{a.role}</span>
                        {a.jobOrder && a.jobOrder !== 'Unassigned' && (
                          <>
                            <span>•</span>
                            <span className="text-slate-500">{a.jobOrder}</span>
                          </>
                        )}
                        {a.testScores && (
                          <>
                            <span>•</span>
                            <span className="text-slate-400">
                              {a.testScores.overallScore !== undefined
                                ? `Score: ${a.testScores.overallScore}% aggregate`
                                : a.testScores.tests && Object.keys(a.testScores.tests).length > 0
                                  ? `Evaluations: ${Object.values(a.testScores.tests).filter((t: any) => t.passed).length}/${Object.keys(a.testScores.tests).length} passed`
                                  : `Scores: Eng ${a.testScores.englishProficiency ?? '-'}% | Trade ${a.testScores.tradeSkills ?? '-'}% | IQ ${a.testScores.iqAptitude ?? '-'}%`}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock size={11} /> {a.lastUpdated ? a.lastUpdated.slice(0, 10) : 'Recent'}
                      </span>
                      {isHandledByOther ? (
                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                          <Lock size={12} className="text-slate-400" /> Handled by {a.currentHandler}
                        </span>
                      ) : activeFlags.length > 0 ? (
                        <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                          <Flag size={11} /> Flagged
                        </span>
                      ) : isAssignedToMe ? (
                        <span className="text-xs text-sky-700 font-bold flex items-center gap-1">
                          Open <ChevronRight size={14} />
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-bold flex items-center gap-1">
                          <UserPlus size={12} /> Claim & Evaluate →
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── SUB-PHASE 2: PENDING INTERVIEW ──────────────────────────────── */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0EA5E9]"></span>
                Phase 2 — Pending Interview (Personality/EQ)
              </h3>
              <span className="text-xs bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full font-bold">
                {phase2Search ? `${filteredPhase2.length} of ${phase2Applicants.length}` : phase2Applicants.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden xl:inline text-xs text-slate-400">Passed Standardized Tests • Awaiting Suitability Interview</span>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={phase2Search}
                  onChange={e => setPhase2Search(e.target.value)}
                  placeholder="Search Phase 2 (name, code, role)..."
                  className="pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-all w-56 sm:w-64 text-slate-700 shadow-2xs"
                />
                {phase2Search && (
                  <button
                    type="button"
                    onClick={() => setPhase2Search('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {phase2Applicants.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 py-8 text-center text-slate-400 text-sm">
              No applicants currently pending Phase 2 personality/EQ assessment
            </div>
          ) : filteredPhase2.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 py-6 text-center text-slate-400 text-sm">
              <p>No applicants match &quot;{phase2Search}&quot; in Phase 2</p>
              <button
                type="button"
                onClick={() => setPhase2Search('')}
                className="mt-2 text-xs text-[#0EA5E9] hover:underline font-semibold cursor-pointer"
              >
                Clear search filter
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
              {filteredPhase2.map(a => {
                const isProvisional = a.status === 'Provisional';
                const isAssignedToMe = a.currentHandler?.trim().toLowerCase() === currentUserName.trim().toLowerCase();
                const isUnassigned = !a.currentHandler || a.currentHandler === 'Unassigned' || a.currentHandler === 'Unassigned Pool' || a.currentHandler === 'System Agent';
                const isHandledByOther = !isUnassigned && !isAssignedToMe;
                const canOpen = !isHandledByOther;

                return (
                  <button
                    key={a.id}
                    onClick={() => canOpen && openApplicant(a.id)}
                    disabled={!canOpen}
                    className={`w-full text-left rounded-xl border px-5 py-4 flex items-center gap-4 transition-all ${
                      isHandledByOther
                        ? 'bg-slate-50/70 border-slate-200 opacity-80 cursor-not-allowed'
                        : isAssignedToMe
                          ? 'bg-sky-50/20 border-sky-300 hover:border-sky-500 hover:shadow-sm cursor-pointer'
                          : isProvisional
                            ? 'bg-amber-50/20 border-amber-300 hover:border-amber-500 hover:shadow-sm cursor-pointer'
                            : 'bg-white border-slate-200 hover:border-[#0EA5E9]/60 hover:shadow-sm cursor-pointer'
                    }`}
                  >
                    {a.photoDataUrl || a.photo ? (
                      <img
                        src={a.photoDataUrl || a.photo}
                        alt="photo"
                        className="w-11 h-11 rounded-lg object-cover flex-shrink-0 border border-slate-200"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {a.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[#0F172A]">{a.name}</span>
                        <span className="text-xs text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                          {a.applicantCode || a.id}
                        </span>

                        {/* Handler Badge */}
                        {isUnassigned ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                            <UserPlus className="w-3 h-3 text-amber-600" />
                            Unassigned
                          </span>
                        ) : isAssignedToMe ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-semibold border bg-sky-50 text-sky-700 border-sky-300">
                            <User className="w-3 h-3 text-sky-600" />
                            {a.currentHandler}
                            <span className="text-[10px] text-sky-600 font-bold">(You)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-semibold border bg-slate-100 text-slate-600 border-slate-200">
                            <User className="w-3 h-3 text-slate-400" />
                            Handled by {a.currentHandler}
                          </span>
                        )}

                        <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                          ✓ Tests Passed
                        </span>
                        {isProvisional && (
                          <span className="text-xs bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <AlertTriangle size={11} /> Provisional
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {a.role} {a.jobOrder ? `• ${a.jobOrder}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs font-bold text-[#0EA5E9] bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100">
                        {a.testScores?.personalityEQ === 'Not Suitable' ? 'Provisional — Awaiting Decision' : 'Ready for EQ Interview'}
                      </span>
                      {isHandledByOther ? (
                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                          <Lock size={12} className="text-slate-400" /> Handled by {a.currentHandler}
                        </span>
                      ) : isAssignedToMe ? (
                        <span className="text-xs text-sky-700 font-bold flex items-center gap-1">
                          Open <ChevronRight size={14} />
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-bold flex items-center gap-1">
                          <UserPlus size={12} /> Claim & Interview →
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── SUB-PHASE 3: REVIEW AND FINALIZE SCORE ──────────────── */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                Phase 3 — Review and Finalize Score
              </h3>
              <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                {phase3Search ? `${filteredPhase3.length} of ${phase3Applicants.length}` : phase3Applicants.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden xl:inline text-xs text-slate-400">All Tests & Interview Passed • Ready to Finalize</span>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={phase3Search}
                  onChange={e => setPhase3Search(e.target.value)}
                  placeholder="Search Phase 3 (name, code, role)..."
                  className="pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all w-56 sm:w-64 text-slate-700 shadow-2xs"
                />
                {phase3Search && (
                  <button
                    type="button"
                    onClick={() => setPhase3Search('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {phase3Applicants.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 py-8 text-center text-slate-400 text-sm">
              No applicants currently waiting in Phase 3
            </div>
          ) : filteredPhase3.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 py-6 text-center text-slate-400 text-sm">
              <p>No applicants match &quot;{phase3Search}&quot; in Phase 3</p>
              <button
                type="button"
                onClick={() => setPhase3Search('')}
                className="mt-2 text-xs text-[#0EA5E9] hover:underline font-semibold cursor-pointer"
              >
                Clear search filter
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
              {filteredPhase3.map(a => {
                const referralDone = a.medicalReferralGenerated || generatedReferralIds.has(a.id);
                const isAssignedToMe = a.currentHandler?.trim().toLowerCase() === currentUserName.trim().toLowerCase();
                const isUnassigned = !a.currentHandler || a.currentHandler === 'Unassigned' || a.currentHandler === 'Unassigned Pool' || a.currentHandler === 'System Agent';
                const isHandledByOther = !isUnassigned && !isAssignedToMe;
                const canOpen = !isHandledByOther;

                return (
                  <button
                    key={a.id}
                    onClick={() => canOpen && openApplicant(a.id)}
                    disabled={!canOpen}
                    className={`w-full text-left rounded-xl border px-5 py-4 flex items-center gap-4 transition-all ${
                      isHandledByOther
                        ? 'bg-slate-50/70 border-slate-200 opacity-80 cursor-not-allowed'
                        : isAssignedToMe
                          ? 'bg-gradient-to-r from-emerald-50/60 to-white border-emerald-300 hover:border-emerald-500 hover:shadow-sm cursor-pointer'
                          : 'bg-gradient-to-r from-emerald-50/40 to-white border-emerald-200 hover:border-emerald-400 hover:shadow-sm cursor-pointer'
                    }`}
                  >
                    {a.photoDataUrl || a.photo ? (
                      <img
                        src={a.photoDataUrl || a.photo}
                        alt="photo"
                        className="w-11 h-11 rounded-lg object-cover flex-shrink-0 border border-emerald-200"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {a.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[#0F172A]">{a.name}</span>
                        <span className="text-xs text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                          {a.applicantCode || a.id}
                        </span>

                        {/* Handler Badge */}
                        {isUnassigned ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                            <UserPlus className="w-3 h-3 text-amber-600" />
                            Unassigned
                          </span>
                        ) : isAssignedToMe ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-semibold border bg-sky-50 text-sky-700 border-sky-300">
                            <User className="w-3 h-3 text-sky-600" />
                            {a.currentHandler}
                            <span className="text-[10px] text-sky-600 font-bold">(You)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-semibold border bg-slate-100 text-slate-600 border-slate-200">
                            <User className="w-3 h-3 text-slate-400" />
                            Handled by {a.currentHandler}
                          </span>
                        )}

                        <span className="text-xs text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <CheckCircle2 size={11} /> 100% Passed
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {a.role} {a.jobOrder ? `• ${a.jobOrder}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isHandledByOther ? (
                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                          <Lock size={12} className="text-slate-400" /> Handled by {a.currentHandler}
                        </span>
                      ) : isAssignedToMe ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                            Review & Finalize Score →
                          </span>
                          <ChevronRight size={16} className="text-slate-400" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                            <UserPlus size={12} /> Claim & Finalize →
                          </span>
                          <ChevronRight size={16} className="text-slate-400" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!selectedApplicant) {
    return (
      <div className="space-y-6 w-full animate-in fade-in duration-150">
        <button
          onClick={() => setListView(true)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0EA5E9] transition-colors font-medium cursor-pointer"
        >
          <ArrowLeft size={16} /> Back to Screening Overview
        </button>
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm max-w-lg mx-auto">
          <Microscope className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800">No Candidate Selected</h3>
          <p className="text-xs text-slate-500 mt-1">Please select an applicant from the screening candidate pool to evaluate.</p>
          <button
            onClick={() => setListView(true)}
            className="mt-4 px-4 py-2 bg-[#0EA5E9] text-white rounded-xl text-xs font-bold hover:bg-[#0284C7] transition-all cursor-pointer"
          >
            Go to Screening Candidate List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-150">
      {/* Back button */}
      <button
        onClick={() => setListView(true)}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0EA5E9] transition-colors font-medium cursor-pointer"
      >
        <ArrowLeft size={16} /> Back to Screening Overview
      </button>

      {/* ── Profile Header Card ──────────────────────────────────────────────── */}
      <div className="bg-[#0F172A] rounded-2xl overflow-hidden shadow-sm border border-slate-800">
        <div className="px-6 py-5 flex items-start gap-5">
          {selectedApplicant?.photoDataUrl || selectedApplicant?.photo ? (
            <img
              src={selectedApplicant.photoDataUrl || selectedApplicant.photo}
              alt="photo"
              className="w-20 h-24 object-cover rounded-xl border-2 border-white/20 flex-shrink-0"
            />
          ) : (
            <div className="w-20 h-24 rounded-xl bg-white/10 border-2 border-white/20 flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
              {selectedApplicant?.name ? selectedApplicant.name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'NA'}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white leading-tight">{selectedApplicant?.name}</h2>
            </div>
            <p className="text-[#0EA5E9] text-sm mt-0.5 font-medium">{selectedApplicant?.role}</p>

            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-white/60">
              <span className="flex items-center gap-1">
                <IdCard size={11} /> {selectedApplicant?.applicantCode || selectedApplicant?.id}
              </span>
              {selectedApplicant?.email && (
                <span className="flex items-center gap-1">
                  <Mail size={11} /> {selectedApplicant.email}
                </span>
              )}
              {selectedApplicant?.contact && (
                <span className="flex items-center gap-1">
                  <Phone size={11} /> {selectedApplicant.contact}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              {selectedApplicant?.status === 'Provisional' ? (
                <span className="text-xs px-2.5 py-1 bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/40 font-bold flex items-center gap-1">
                  <AlertTriangle size={12} /> Status: Provisional (In Pipeline)
                </span>
              ) : (
                <span className="text-xs px-2.5 py-1 bg-[#0EA5E9]/20 text-[#0EA5E9] rounded-full border border-[#0EA5E9]/30 font-semibold">
                  {selectedApplicant?.status || 'Initial Screening'}
                </span>
              )}

              {selectedApplicant?.jobOrder && selectedApplicant.jobOrder !== 'Unassigned' ? (
                <span className="text-xs px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30 font-semibold flex items-center gap-1.5">
                  <Briefcase size={11} /> {selectedApplicant.jobOrder}
                </span>
              ) : (
                <span className="text-xs px-2.5 py-1 bg-slate-700/50 text-slate-300 rounded-full border border-slate-600/40 font-medium flex items-center gap-1.5">
                  <Briefcase size={11} /> Unassigned Job Order
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="text-right text-xs text-white/40">
              <p>Handler: {selectedApplicant?.currentHandler || 'System'}</p>
              <p className="mt-0.5">{selectedApplicant?.currentDepartment || 'Recruitment'}</p>
              <p className="mt-0.5 italic">{selectedApplicant?.lastUpdated ? selectedApplicant.lastUpdated.slice(0, 10) : 'Active'}</p>
            </div>
            <div className="flex items-center gap-2">
              {selectedApplicant && (
                (() => {
                  const isAssignedToMe = selectedApplicant.currentHandler?.trim().toLowerCase() === currentUserName.trim().toLowerCase();
                  const isUnassigned = !selectedApplicant.currentHandler || selectedApplicant.currentHandler === 'Unassigned' || selectedApplicant.currentHandler === 'Unassigned Pool' || selectedApplicant.currentHandler === 'System Agent';
                  if (isUnassigned) {
                    return (
                      <button
                        onClick={() => handleClaimApplicant(selectedApplicant.id)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#0EA5E9]/20 border border-[#0EA5E9]/40 text-sky-300 hover:bg-[#0EA5E9]/30 hover:text-white transition-all cursor-pointer font-semibold"
                        title="Claim candidate into your active screening queue"
                      >
                        <UserPlus size={13} /> Claim Candidate
                      </button>
                    );
                  }
                  if (isAssignedToMe) {
                    return (
                      <button
                        onClick={() => handleReleaseApplicantFromScreening(selectedApplicant.id)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                        title="Release candidate back to the unassigned queue pool so other recruiters can evaluate them"
                      >
                        <Undo2 size={13} /> Return to Pool ↩
                      </button>
                    );
                  }
                  return (
                    <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-400 font-medium">
                      <Lock size={12} className="text-slate-400" /> Handled by {selectedApplicant.currentHandler}
                    </span>
                  );
                })()
              )}
              {!selectedApplicant?.isStopped && (
                <button
                  onClick={() => setShowStopModal(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-400/50 text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-all cursor-pointer"
                >
                  <OctagonX size={13} /> Stop Processing
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Workflow Progress Stepper ────────────────────────────────────── */}
        <div className="bg-slate-900/80 px-6 py-3 border-t border-slate-800 flex items-center justify-between text-xs">
          {/* Step 1 */}
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${phase1AllPassed
                  ? 'bg-emerald-500 text-white'
                  : selectedApplicant?.status === 'Provisional' && !phase1AllPassed
                    ? 'bg-amber-500 text-white'
                    : 'bg-[#0EA5E9] text-white'
                }`}
            >
              {phase1AllPassed ? '✓' : '1'}
            </div>
            <span className={phase1AllPassed ? 'text-emerald-400 font-bold' : 'text-slate-300 font-medium'}>
              Phase 1: Standardized Tests
            </span>
          </div>

          <div className="h-0.5 flex-1 max-w-[60px] bg-slate-700 mx-2"></div>

          {/* Step 2 */}
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${eqPass
                  ? 'bg-emerald-500 text-white'
                  : phase1AllPassed
                    ? 'bg-[#0EA5E9] text-white'
                    : 'bg-slate-800 text-slate-500'
                }`}
            >
              {eqPass ? '✓' : '2'}
            </div>
            <span
              className={
                eqPass
                  ? 'text-emerald-400 font-bold'
                  : phase1AllPassed
                    ? 'text-sky-300 font-medium'
                    : 'text-slate-500'
              }
            >
              Phase 2: Suitability Interview (EQ)
            </span>
          </div>

          <div className="h-0.5 flex-1 max-w-[60px] bg-slate-700 mx-2"></div>

          {/* Step 3 */}
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${hasMedicalReferral
                  ? 'bg-emerald-500 text-white'
                  : allScoresPassed
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-500'
                }`}
            >
              {hasMedicalReferral ? '✓' : '3'}
            </div>
            <span className={allScoresPassed ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
              Phase 3: Review & Medical Referral
            </span>
          </div>
        </div>
      </div>

      {/* ── CORE RULE NOTICE BANNER ────────────────────────────────────────── */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900">
          <p className="font-bold text-sm text-amber-950 mb-1.5">How This Works</p>
          <ul className="space-y-1.5 text-amber-800 leading-relaxed list-none">
            <li>✔ If the applicant <strong>passes all tests</strong>, they move on to the Personality Interview (Phase 2).</li>
            <li>⚠ If they <strong>fail any test</strong>, their status is set to <strong>Provisional</strong> — they stay in the pipeline. You can re-score them later, or use <em>Stop Processing</em> to end their application.</li>
            <li>✔ Once <strong>all tests and the interview are passed</strong>, you can review their score and generate their screening summary results and move them forward.</li>
          </ul>
        </div>
      </div>

      {/* ── SECTION 1: PHASE 1 — STANDARDIZED TEST SCORECARD ─────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-[#0EA5E9]" />
            <div>
              <h3 className="font-black text-[#0F172A] text-lg">Phase 1 — Standardized Test Scorecard</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Staff records scores for the {activeEvaluationTests.length} active qualification evaluations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Weighted Aggregate</span>
              <span className="text-base font-extrabold text-[#0EA5E9]">{currentWeightedScore}%</span>
            </div>
            {phase1AllPassed ? (
              <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full flex items-center gap-1">
                <CheckCircle2 size={13} /> Phase 1 Passed
              </span>
            ) : selectedApplicant?.status === 'Provisional' ? (
              <span className="text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full flex items-center gap-1">
                <AlertTriangle size={13} /> Status: Provisional
              </span>
            ) : (
              <span className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
                Pending Evaluation
              </span>
            )}
          </div>
        </div>

        <div className="space-y-5">
          {activeEvaluationTests.map((test, index) => {
            const theme = TEST_TYPE_THEMES[test.type] || TEST_TYPE_THEMES.custom;
            const Icon = theme.icon;
            const evalResult = getTestEvaluationResult(test);
            const isPass = evalResult.passed;
            const hasEntry = evalResult.hasEntry;
            const isPassFail = test.scoringType === 'pass_fail';
            const currentPF = dynamicPassFail[test.id] || '';
            const rawVal = dynamicRawScores[test.id] ?? '';
            const totalVal = dynamicTotalItems[test.id] ?? (test.maxScore || 100);
            const pctFilled = isPassFail
              ? (currentPF === 'Pass' ? 100 : (currentPF === 'Fail' ? 0 : 0))
              : Math.min(100, Math.max(0, evalResult.percentage ?? 0));
            const effWeight = totalActiveWeight > 0 ? Math.round((test.weight / totalActiveWeight) * 100) : test.weight;
            const isJobOrderSpecific = Boolean(test.applicableJobOrders && test.applicableJobOrders.length > 0);

            return (
              <div key={test.id} className={`${theme.bg} p-5 rounded-xl border-2 ${theme.border} transition-all`}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className={`p-2 rounded-lg bg-white shadow-xs ${theme.text}`}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-[#0F172A] text-sm">{index + 1}. {test.name}</p>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">
                          {theme.label}
                        </span>
                        <span className={`px-2 py-0.5 text-white text-[10px] font-extrabold rounded ${theme.bar}`}>
                          {test.weight}% Weight {totalActiveWeight !== 100 ? `(${effWeight}% eff.)` : ''}
                        </span>
                        {isJobOrderSpecific && (
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-extrabold rounded border border-indigo-200">
                            Job Order: {test.applicableJobOrders!.join(', ')}
                          </span>
                        )}
                        {isPassFail ? (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-extrabold rounded border border-purple-200">
                            Pass / Fail Clearance
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-sky-100 text-sky-800 text-[10px] font-extrabold rounded border border-sky-200">
                            Numeric Scoring
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#64748B] mt-0.5">
                        {test.description || 'Evaluation benchmark'} • {isPassFail ? (
                          <span className="text-purple-800 font-semibold">Grading: Pass or Fail Clearance</span>
                        ) : (
                          <>Passing benchmark: <strong className="text-slate-800">≥{test.passingScore}%</strong></>
                        )}
                        {isJobOrderSpecific && (
                          <span className="text-indigo-600 font-medium ml-1.5">
                            (Specific requirement for {test.applicableJobOrders!.join(', ')})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-3 py-1 text-xs font-bold rounded-full ${!hasEntry
                        ? 'bg-slate-100 text-slate-500'
                        : isPass
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                          : 'bg-red-100 text-red-600 border border-red-300'
                      }`}
                  >
                    {!hasEntry ? '⏱ Pending' : isPass ? (isPassFail ? '✓ Cleared' : '✓ Pass') : (isPassFail ? '✗ Failed' : '✗ Below Pass')}
                  </span>
                </div>

                {isPassFail ? (
                  /* Pass / Fail binary selector */
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-xs text-slate-600 font-bold uppercase tracking-wider">Evaluation Verdict:</span>
                    <button
                      type="button"
                      onClick={() => handleSetPassFail(test.id, 'Pass')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${currentPF === 'Pass'
                          ? 'bg-emerald-600 text-white shadow-emerald-600/25 ring-2 ring-emerald-500/30'
                          : 'bg-white border-2 border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-700'
                        }`}
                    >
                      <CheckCircle2 size={15} /> Passed
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetPassFail(test.id, 'Fail')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${currentPF === 'Fail'
                          ? 'bg-red-600 text-white shadow-red-600/25 ring-2 ring-red-500/30'
                          : 'bg-white border-2 border-slate-200 text-slate-600 hover:border-red-400 hover:text-red-700'
                        }`}
                    >
                      <AlertTriangle size={15} /> Failed
                    </button>
                    {currentPF && (
                      <span className={`text-xs font-bold ml-2 ${currentPF === 'Pass' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {currentPF === 'Pass' ? '✓ Satisfies Job Order Requirement' : '✗ Does Not Meet Clearance'}
                      </span>
                    )}
                  </div>
                ) : (
                  /* Numeric Scoring with Score Obtained & Total Score inputs */
                  <div className="pt-1">
                    <div className="flex items-end gap-4 flex-wrap">
                      {/* Score Obtained */}
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                          Score Obtained
                        </label>
                        <input
                          type="number"
                          value={rawVal}
                          onChange={(e) => handleRawScoreChange(test.id, e.target.value)}
                          min={0}
                          placeholder="0"
                          className={`w-28 border-2 px-3 py-2 rounded-lg text-xl font-black ${theme.text} ${theme.border} focus:border-[#0EA5E9] outline-none text-center bg-white shadow-xs`}
                        />
                      </div>

                      <span className="text-2xl text-slate-400 font-bold mb-2">/</span>

                      {/* Total Score */}
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                          Total Score
                        </label>
                        <input
                          type="number"
                          value={totalVal}
                          onChange={(e) => handleTotalItemsChange(test.id, e.target.value)}
                          min={1}
                          placeholder={String(test.maxScore || 100)}
                          className="w-24 border-2 border-slate-200 px-3 py-2 rounded-lg text-lg font-bold text-slate-700 focus:border-[#0EA5E9] outline-none text-center bg-white shadow-xs"
                        />
                        <span className="text-[9px] text-slate-400 block mt-0.5 text-center font-medium">Per candidate</span>
                      </div>

                      {/* Auto-Computed Rating Display */}
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                          Calculated Rating
                        </label>
                        <div className="flex items-center gap-2">
                          <div className={`px-3 py-2 rounded-lg border font-black text-base min-w-[76px] text-center ${evalResult.percentage === undefined
                              ? 'bg-slate-100 border-slate-200 text-slate-400'
                              : isPass
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs'
                                : 'bg-red-50 border-red-300 text-red-600 shadow-xs'
                            }`}>
                            {evalResult.percentage !== undefined ? `${evalResult.percentage}%` : '— %'}
                          </div>
                        </div>
                      </div>

                      {/* Visual progress bar */}
                      <div className="flex-1 min-w-[140px] mb-3">
                        <div className="flex justify-between text-[10px] text-slate-400 font-semibold mb-1">
                          <span>0%</span>
                          <span>Passing: {test.passingScore}%</span>
                          <span>100%</span>
                        </div>
                        <div className="bg-slate-200 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-3 rounded-full transition-all duration-300 ${isPass ? 'bg-[#10B981]' : (hasEntry ? 'bg-red-500' : 'bg-slate-300')
                              }`}
                            style={{ width: `${pctFilled}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Phase 1 Evaluation Action Bar */}
        {(() => {
          const enteredCount = activeEvaluationTests.filter(t => getTestEvaluationResult(t).hasEntry).length;
          const isAllEntered = enteredCount === activeEvaluationTests.length;
          const failedCount = activeEvaluationTests.filter(t => !isTestPassed(t)).length;

          return (
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Phase 1 Evaluation Status</p>
                <p className={`text-sm font-extrabold ${!isAllEntered ? 'text-sky-700' : phase1AllPassed ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {!isAllEntered
                    ? `⏱ ${enteredCount} of ${activeEvaluationTests.length} Evaluations Recorded (Draft mode available)`
                    : phase1AllPassed
                      ? `✓ All ${activeEvaluationTests.length} Tests Meet Passing Criteria — Ready for Phase 2 Interview`
                      : `⚠️ Criteria Not Met in ${failedCount} Test(s) — Saving will mark Applicant as Provisional`}
                </p>
                {!isAllEntered && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Save Draft stores partial scores and keeps the candidate in Phase 1 until all evaluations are scored.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleSaveDraftScores}
                  disabled={isSaving}
                  className="px-4 py-2.5 bg-white border-2 border-slate-300 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  title="Save partial test scores as draft without advancing candidate"
                >
                  <Save className="w-4 h-4 text-slate-500" />
                  Save Draft (Keep in Phase 1)
                </button>

                <button
                  type="button"
                  onClick={handleEvaluatePhase1}
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-[#0F172A] hover:bg-[#1E293B] disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                  Save & Complete Phase 1
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── SECTION 2: PHASE 2 — PENDING INTERVIEW (EQ ASSESSMENT) ───────────── */}
      <div className={`bg-white rounded-xl shadow-sm border p-8 space-y-6 ${!phase1AllPassed ? 'border-slate-200 opacity-75' : 'border-[#0EA5E9]/40'}`}>
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-[#0EA5E9]" />
            <div>
              <h3 className="font-black text-[#0F172A] text-lg">Phase 2 — Pending Interview (Personality / EQ)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluates applicant attitude, emotional stability, patience, and adaptability for job order suitability
              </p>
            </div>
          </div>

          <span
            className={`px-3 py-1 text-xs font-bold rounded-full ${eqPass
                ? 'bg-emerald-100 text-emerald-700'
                : eqFail
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-600'
              }`}
          >
            {eqPass ? '✓ Suitable (Pass)' : eqFail ? '✗ Not Suitable (Provisional)' : '⏱ Pending Interview'}
          </span>
        </div>

        {!phase1AllPassed ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center text-slate-500 text-sm">
            <AlertCircle className="w-6 h-6 text-slate-400 mx-auto mb-2" />
            <p className="font-bold text-slate-700">Phase 2 Interview is Locked</p>
            <p className="text-xs text-slate-500 mt-0.5 max-w-md mx-auto">
              The applicant must pass all {activeEvaluationTests.length} qualification evaluations before proceeding to the Personality / EQ Assessment interview.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block">
                  Suitability Verdict for Job Order: {selectedApplicant?.jobOrder || 'Current Position'}
                </label>
                {(personalityEQVerdict === 'Suitable' || personalityEQVerdict === 'Not Suitable') && (
                  <button
                    type="button"
                    onClick={() => handleEvaluatePhase2('Pending')}
                    disabled={isSaving}
                    className="text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg border border-slate-200 transition-all font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Interview not yet conducted or started: unselect decision and revert status back to Pending Interview"
                  >
                    <RotateCcw size={12} className="text-slate-500" />
                    <span>Unselect Decision (Reset to Pending)</span>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleEvaluatePhase2(personalityEQVerdict === 'Suitable' ? 'Pending' : 'Suitable')}
                  disabled={isSaving}
                  className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${personalityEQVerdict === 'Suitable'
                      ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-emerald-300 bg-white'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-emerald-900">✓ Suitable (Pass)</span>
                    {personalityEQVerdict === 'Suitable' && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Candidate meets emotional, behavioral, and communication standards for overseas deployment. Advances to Phase 3.
                  </p>
                  {personalityEQVerdict === 'Suitable' && (
                    <span className="inline-block mt-2 text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                      Click again to unselect
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleEvaluatePhase2(personalityEQVerdict === 'Not Suitable' ? 'Pending' : 'Not Suitable')}
                  disabled={isSaving}
                  className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${personalityEQVerdict === 'Not Suitable'
                      ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20'
                      : 'border-slate-200 hover:border-amber-300 bg-white'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-amber-900">✗ Not Suitable → Provisional</span>
                    {personalityEQVerdict === 'Not Suitable' && (
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Behavioral concerns or mismatch detected. Sets status to Provisional — candidate remains in pipeline. Staff may re-evaluate or stop processing.
                  </p>
                  {personalityEQVerdict === 'Not Suitable' && (
                    <span className="inline-block mt-2 text-[11px] font-semibold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded">
                      Click again to unselect
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── SECTION 3: PHASE 3 — REVIEW AND FINALIZE SCORE ─────────── */}
      <div
        className={`rounded-xl shadow-sm border p-8 space-y-6 ${allScoresPassed
            ? 'bg-gradient-to-br from-emerald-50/30 via-white to-sky-50/30 border-emerald-300 ring-2 ring-emerald-500/10'
            : 'bg-white border-slate-200 opacity-70'
          }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2">
            <FileCheck2 className={`w-6 h-6 ${allScoresPassed ? 'text-emerald-600' : 'text-slate-400'}`} />
            <div>
              <h3 className="font-black text-[#0F172A] text-lg">
                Phase 3 — Review and Finalize Score
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Unlocked once all {activeEvaluationTests.length} evaluations and suitability criteria are met (no fails, no unresolved Provisional status)
              </p>
            </div>
          </div>

          <span
            className={`px-3 py-1 text-xs font-bold rounded-full ${allScoresPassed
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-slate-100 text-slate-500'
              }`}
          >
            {allScoresPassed ? '✓ Phase 3 Active' : '🔒 Locked'}
          </span>
        </div>

        {!allScoresPassed ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center text-slate-500 text-sm">
            <AlertCircle className="w-6 h-6 text-slate-400 mx-auto mb-2" />
            <p className="font-bold text-slate-700">Phase 3 Locked</p>
            <p className="text-xs text-slate-500 mt-0.5 max-w-md mx-auto">
              The applicant reaches this phase once all {activeEvaluationTests.length} qualification evaluations and the Personality/EQ suitability interview are passed.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Scorecard Summary Grid */}
            <div className="bg-white border border-emerald-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                  Verified Evaluation Results (Cleared for Medical Referral)
                </p>
                <span className="text-xs font-extrabold text-[#0EA5E9] bg-sky-50 px-2.5 py-0.5 rounded border border-sky-200">
                  Overall Aggregate: {currentWeightedScore}%
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
                {activeEvaluationTests.map((t, idx) => {
                  const res = getTestEvaluationResult(t);
                  const passed = res.passed;
                  const isPassFail = t.scoringType === 'pass_fail';
                  return (
                    <div key={t.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-slate-400 font-semibold block uppercase truncate text-[11px]" title={t.name}>
                        {idx + 1}. {t.name}
                      </span>
                      <span className="text-base font-extrabold text-slate-800">
                        {isPassFail
                          ? (res.verdict === 'Pass' ? 'Passed' : res.verdict === 'Fail' ? 'Failed' : '—')
                          : (res.hasEntry ? `${res.rawScore} / ${res.totalItems}` : '—')}
                      </span>
                      {!isPassFail && res.percentage !== undefined && (
                        <span className="text-xs font-semibold text-slate-500 block">
                          ({res.percentage}%)
                        </span>
                      )}
                      <span className={`font-bold block mt-0.5 text-[11px] ${passed ? 'text-emerald-600' : 'text-red-500'}`}>
                        {passed
                          ? (isPassFail ? '✓ Cleared' : `✓ Pass (≥${t.passingScore}%)`)
                          : (isPassFail ? '✗ Failed' : `✗ Below (≥${t.passingScore}%)`)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Screening Clearance Status Notice */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between text-xs text-emerald-900">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <span className="font-bold text-emerald-950">Candidate Cleared Phase 1 Evaluations & Phase 2 Interview</span>
                  <p className="text-emerald-700 text-xs mt-0.5">
                    All {activeEvaluationTests.length} evaluations and suitability interview criteria met with <strong>{currentWeightedScore}%</strong> aggregate rating.
                  </p>
                </div>
              </div>
              <span className="bg-emerald-200 text-emerald-900 px-2.5 py-1 rounded-md font-bold">
                ✓ Clearance Complete
              </span>
            </div>

            {/* ── THE 3 REQUIRED PHASE 3 BUTTONS ────────────────────────────── */}
            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              {/* Button 1: REVIEW SCORE (Enabled: ALWAYS) */}
              <button
                type="button"
                onClick={handleOpenReviewScoresModal}
                className="px-5 py-2.5 border-2 border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <FileEdit className="w-4 h-4 text-slate-600" />
                Review Score
              </button>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Button 2: DOWNLOAD SCREENING SUMMARY PDF (A4) */}
                <button
                  type="button"
                  onClick={handleDownloadScreeningSummaryPdf}
                  disabled={!allScoresPassed}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                  title="Download official formal A4 candidate screening, evaluation scores, and interview summary report"
                >
                  <Download className="w-4 h-4" />
                  Download Summary PDF (A4)
                </button>

                {/* Button 3: UPDATE APPLICANT STATUS (Enabled immediately when evaluations and interview are passed) */}
                <button
                  type="button"
                  onClick={handleOpenUpdateStatusConfirmation}
                  disabled={!allScoresPassed}
                  title={!allScoresPassed ? 'Requires all evaluation tests and suitability interview to be passed' : 'Update status and advance candidate'}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer ${allScoresPassed
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                    }`}
                >
                  <ArrowRight className="w-4 h-4" />
                  Update Applicant Status
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────────────────
          MODAL 1: STOP PROCESSING
      ──────────────────────────────────────────────────────────────────────── */}
      {showStopModal && (
        <div className="fixed inset-0 bg-[#0F172A]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <OctagonX className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#0F172A]">Stop Processing This Applicant</h3>
                <p className="text-xs text-slate-500 mt-0.5">Locks the candidate profile and stops pipeline progression.</p>
              </div>
              <button
                onClick={() => {
                  setShowStopModal(false);
                  setStopReason('');
                }}
                className="ml-auto text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Reason for Stopping *
                </label>
                <textarea
                  value={stopReason}
                  onChange={e => setStopReason(e.target.value)}
                  rows={4}
                  placeholder="e.g. Applicant failed technical demonstration and refused re-testing. Not suitable for job order."
                  className="w-full border-2 border-slate-200 px-3 py-2 rounded-lg text-sm focus:border-red-400 outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 bg-slate-50 rounded-b-2xl border-t border-slate-200">
              <button
                onClick={() => {
                  setShowStopModal(false);
                  setStopReason('');
                }}
                className="flex-1 px-4 py-2.5 border-2 border-slate-200 text-slate-500 font-bold text-sm rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleStopProcessing}
                disabled={!stopReason.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-bold text-sm rounded-lg transition-colors cursor-pointer"
              >
                <OctagonX className="w-4 h-4" /> Confirm Stop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────
          MODAL 2: REVIEW SCORE MODAL (Button 1: REVIEW SCORE)
      ──────────────────────────────────────────────────────────────────────── */}
      {showReviewScoreModal && (
        <div className="fixed inset-0 bg-[#0F172A]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in duration-150">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-[#0EA5E9]" />
                <h3 className="font-extrabold text-[#0F172A] text-base">Review & Correct Recorded Scores</h3>
              </div>
              <button
                onClick={() => setShowReviewScoreModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Notice:</strong> If any score is reduced below passing criteria, the candidate will automatically be set to <em>Provisional</em> status and returned to the appropriate evaluation sub-phase.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-1">
                {activeEvaluationTests.map(t => {
                  const isPassFail = t.scoringType === 'pass_fail';
                  const res = getTestEvaluationResult(t, reviewDynamicRawScores, reviewDynamicTotalItems, reviewDynamicPassFail);
                  if (isPassFail) {
                    const curPf = reviewDynamicPassFail[t.id] || '';
                    return (
                      <div key={t.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <label className="text-xs font-bold text-slate-700 uppercase block mb-1 truncate" title={t.name}>
                          {t.name}
                        </label>
                        <span className="text-[10px] text-purple-700 font-semibold block mb-2">Pass / Fail Clearance</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setReviewDynamicPassFail(prev => ({ ...prev, [t.id]: prev[t.id] === 'Pass' ? '' : 'Pass' }))}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${curPf === 'Pass' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-300 text-slate-600 hover:border-emerald-400'
                              }`}
                          >
                            ✓ Passed
                          </button>
                          <button
                            type="button"
                            onClick={() => setReviewDynamicPassFail(prev => ({ ...prev, [t.id]: prev[t.id] === 'Fail' ? '' : 'Fail' }))}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${curPf === 'Fail' ? 'bg-red-600 text-white shadow-xs' : 'bg-white border border-slate-300 text-slate-600 hover:border-red-400'
                              }`}
                          >
                            ✗ Failed
                          </button>
                        </div>
                      </div>
                    );
                  }

                  const curRaw = reviewDynamicRawScores[t.id] ?? '';
                  const curTotal = reviewDynamicTotalItems[t.id] ?? t.maxScore ?? 100;
                  return (
                    <div key={t.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700 uppercase truncate" title={t.name}>
                          {t.name}
                        </label>
                        <span className="text-[10px] font-bold text-slate-500">
                          Pass: ≥{t.passingScore}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1">
                          <span className="text-[9px] text-slate-400 block uppercase font-bold">Score Obtained</span>
                          <input
                            type="number"
                            min={0}
                            value={curRaw}
                            onChange={e =>
                              setReviewDynamicRawScores(prev => ({
                                ...prev,
                                [t.id]: e.target.value
                              }))
                            }
                            className="w-full border-2 border-slate-200 px-2 py-1.5 rounded-lg font-bold text-slate-800 text-center text-sm bg-white"
                          />
                        </div>
                        <span className="text-slate-400 font-bold self-end mb-1">/</span>
                        <div className="w-20">
                          <span className="text-[9px] text-slate-400 block uppercase font-bold">Total Score</span>
                          <input
                            type="number"
                            min={1}
                            value={curTotal}
                            onChange={e =>
                              setReviewDynamicTotalItems(prev => ({
                                ...prev,
                                [t.id]: e.target.value
                              }))
                            }
                            className="w-full border-2 border-slate-200 px-2 py-1.5 rounded-lg font-bold text-slate-800 text-center text-sm bg-white"
                          />
                        </div>
                        <div className="w-16 text-right self-end mb-1">
                          <span className={`text-xs font-black ${res.passed ? 'text-emerald-600' : 'text-red-500'}`}>
                            {res.percentage !== undefined ? `${res.percentage}%` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Personality / EQ Outcome</label>
                <select
                  value={reviewEQVerdict}
                  onChange={e =>
                    setReviewEQVerdict(e.target.value as any)
                  }
                  className="w-full border-2 border-slate-200 px-3 py-2 rounded-lg text-sm font-semibold bg-white"
                >
                  <option value="Suitable">✓ Suitable (Pass)</option>
                  <option value="Not Suitable">✗ Not Suitable (Provisional)</option>
                  <option value="Pending">⏱ Pending Assessment</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowReviewScoreModal(false)}
                className="flex-1 px-4 py-2.5 border-2 border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveScoreCorrection}
                disabled={isSaving}
                className="flex-1 px-4 py-2.5 bg-[#0F172A] hover:bg-[#1E293B] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                Save Corrected Scores
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────
          MODAL 3: GENERATE MEDICAL REFERRAL (Button 2)
      ──────────────────────────────────────────────────────────────────────── */}
      {showReferralModal && (
        <div className="fixed inset-0 bg-[#0F172A]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg animate-in fade-in duration-150 border border-slate-100">
            <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-[#0F172A] flex items-center gap-2 text-base">
                <FileCheck2 className="w-5 h-5 text-[#0EA5E9]" />
                Generate Medical Referral PDF
              </h3>
              <button
                onClick={() => setShowReferralModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-emerald-900">
                <p className="font-bold flex items-center gap-1.5 text-emerald-950">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  All Pre-Requisites Passed
                </p>
                <p className="mt-1 text-emerald-800 leading-relaxed">
                  Candidate {selectedApplicant?.name} has satisfied all 3 standardized tests and suitability interview criteria.
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1.5 uppercase tracking-wide">
                  Select Accredited Partner Medical Clinic
                </label>
                <select
                  value={selectedClinic}
                  onChange={e => setSelectedClinic(e.target.value)}
                  className="w-full border-2 border-slate-200 px-3 py-2.5 rounded-xl text-xs font-semibold bg-white focus:border-[#0EA5E9] outline-none cursor-pointer"
                >
                  {partnerClinicsList.length > 0 ? (
                    partnerClinicsList.map((c: any) => {
                      const clinicName = c.clinicName || c.clinic_name;
                      const addr = c.address ? ` — ${c.address}` : '';
                      return (
                        <option key={c.clinicId || c.clinic_id || clinicName} value={clinicName}>
                          {clinicName}{addr}
                        </option>
                      );
                    })
                  ) : (
                    <option value="" disabled>
                      Loading accredited partner clinics from database...
                    </option>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block font-semibold">Recruiter Endorser</span>
                  <span className="font-extrabold text-slate-800 text-xs mt-0.5 block">{currentUserName}</span>
                  <span className="text-slate-400 text-[10px]">Digital Signature Logged</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block font-semibold">Examination Type</span>
                  <span className="font-extrabold text-slate-800 text-xs mt-0.5 block">Standard PEME Package</span>
                  <span className="text-slate-400 text-[10px]">DOH / POEA Compliant</span>
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowReferralModal(false)}
                  disabled={isGeneratingReferral}
                  className="flex-1 px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDownloadScreeningSummaryPdf}
                  disabled={isGeneratingReferral}
                  className="flex-1 px-4 py-2.5 bg-[#0EA5E9] hover:bg-[#0284C7] disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-[#0EA5E9]/20 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  {isGeneratingReferral ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Download Summary PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CONFIRM MOVE TO MEDICAL CLEARANCE */}
      {showUpdateStatusModal && (
        <div className="fixed inset-0 bg-[#0F172A]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-100">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-200">
              <UserCheck className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-extrabold text-[#0F172A] text-lg">
                Move to Medical Clearance?
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Are you sure you want to endorse <strong>{selectedApplicant?.name}</strong> for Medical Clearance?
              </p>
            </div>

            <div className="my-5 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Candidate:</span>
                <span className="font-bold text-slate-800">{selectedApplicant?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Next Step:</span>
                <span className="font-bold text-emerald-700">Medical Clearance</span>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <label className="font-bold text-slate-700 block mb-1 uppercase tracking-wide text-[10px]">
                  Accredited Medical Clinic (Optional)
                </label>
                <select
                  value={selectedClinic}
                  onChange={e => setSelectedClinic(e.target.value)}
                  className="w-full border-2 border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white focus:border-[#0EA5E9] outline-none cursor-pointer"
                >
                  <option value="">-- Pending (Assign later in Fit-to-Work) --</option>
                  {partnerClinicsList.map((c: any) => {
                    const clinicName = c.clinicName || c.clinic_name;
                    return (
                      <option key={c.clinicId || c.clinic_id || clinicName} value={clinicName}>
                        {clinicName}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Default: <strong>Pending</strong>. You can leave this unassigned so the Fit-to-Work team can assign a clinic.
                </p>
              </div>

              <div className="pt-1 text-[11px] text-slate-500">
                The applicant will be moved out of Screening and will proceed to the Medical Clearance phase.
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowUpdateStatusModal(false)}
                disabled={isUpdatingStatus}
                className="flex-1 px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmMoveToMedicalReferral}
                disabled={isUpdatingStatus}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer transition-colors"
              >
                {isUpdatingStatus ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Moving Candidate...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Yes, Move Candidate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
