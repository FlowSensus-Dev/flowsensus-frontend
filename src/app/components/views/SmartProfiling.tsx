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
  Users,
  TrendingUp,
  ArrowLeft,
  Lock,
  ShieldAlert,
  Download,
  Building2,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { ApplicantRecord, ActivityLog, WorkflowState } from '../../types';
import { api } from '../../../lib/api';
import { Skeleton } from '../ui/skeleton';
import SearchableJobOrderSelector from '../SearchableJobOrderSelector';
import ApplicantProfile from './ApplicantProfile';
import {
  OccupationalClusterData,
  OCCUPATIONAL_CLUSTERS,
  normalizeTokens,
  findClusterForText,
  isApplicantInProfiling,
  getJobOrderMismatchInfo,
  TakenExamRecord,
  RankedCandidate,
  getCategoryCandidateExplanation,
} from '../../../lib/profilingUtils';

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
  evaluationTemplates?: any[];
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
  evaluationTemplates = [],
}: SmartProfilingProps) {
  const [jobOrders, setJobOrders] = useState<any[]>([]);
  const [selectedJobOrderId, setSelectedJobOrderId] = useState<string>('');
  const [isLoadingJobs, setIsLoadingJobs] = useState<boolean>(false);
  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const [activeModalCandidate, setActiveModalCandidate] = useState<RankedCandidate | null>(null);
  const [overlayApplicant, setOverlayApplicant] = useState<ApplicantRecord | null>(null);
  const [expandedCategoryHelp, setExpandedCategoryHelp] = useState<string | null>(null);
  const [agencyProfile, setAgencyProfile] = useState<{
    agency_id?: number;
    agency_name: string;
    poea_license_no?: string;
    workspace_code?: string;
    logo_url?: string;
    status?: string;
  } | null>(null);
  const [dynamicClusters, setDynamicClusters] = useState<Record<string, any>>({});
  const [pipelineScope, setPipelineScope] = useState<'profiling' | 'all' | 'assigned'>('profiling');
  const [expandedExamApplicantIds, setExpandedExamApplicantIds] = useState<Set<string>>(new Set());
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [activeJobCluster, setActiveJobCluster] = useState<OccupationalClusterData | null>(null);
  const [isSynthesizingCluster, setIsSynthesizingCluster] = useState<boolean>(false);

  // Return Candidate to Previous Phase State
  const [candidateToReturn, setCandidateToReturn] = useState<ApplicantRecord | null>(null);
  const [returnTargetStage, setReturnTargetStage] = useState<'medical' | 'screening'>('medical');
  const [returnCategory, setReturnCategory] = useState<string>('Medical / Fitness Clearance Issue');
  const [returnNotes, setReturnNotes] = useState<string>('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState<boolean>(false);

  const toggleExamExpanded = (appId: string) => {
    setExpandedExamApplicantIds((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) {
        next.delete(appId);
      } else {
        next.add(appId);
      }
      return next;
    });
  };

  // Keyboard shortcut listener to close overlays on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (candidateToReturn) {
          setCandidateToReturn(null);
        } else if (overlayApplicant) {
          setOverlayApplicant(null);
        } else if (activeModalCandidate) {
          setActiveModalCandidate(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [candidateToReturn, overlayApplicant, activeModalCandidate]);

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
            const empName = jo.employer_name || jo.client_employer?.company_name || 'Partner Principal';
            return {
              realId: jo.job_order_id,
              jobOrderId: jo.job_order_id,
              id: String(jo.job_order_id || code),
              code: code,
              position: jo.position || jo.position_title || 'General Position',
              country: jo.country || jo.client_employer?.country?.country_name || 'International',
              employer: empName,
              employerName: empName,
              employerId: jo.employer_id,
              totalSlots: total,
              filledSlots: filled,
              vacancies,
              available: vacancies,
              minExperience: Number(jo.min_experience_years ?? 1),
              certifications: Array.isArray(jo.certifications) ? jo.certifications : (jo.required_certifications || []),
              requirements: Array.isArray(jo.requirements) ? jo.requirements : (jo.required_skills || []),
              genderPreference: jo.gender_preference || jo.genderPreference,
              minAge: jo.min_age ?? jo.minAge,
              maxAge: jo.max_age ?? jo.maxAge,
            };
          });
          setJobOrders(liveOrders);

          // Do NOT auto-select: cluster only fires after explicit user selection
        }
      } catch (err) {
        console.warn('Could not fetch live job orders for smart profiling:', err);
      } finally {
        setIsLoadingJobs(false);
      }
    };
    fetchLiveJobOrders();
  }, [globalJobOrders]);

  // Fetch dynamic agency profile & trade clusters from Supabase database
  useEffect(() => {
    let isMounted = true;
    const fetchAgencyAndClusters = async () => {
      try {
        const [agencyRes, clustersRes] = await Promise.all([
          api.get('/lookups/agency').catch((err) => {
            console.warn('Failed to fetch agency lookup:', err);
            return null;
          }),
          api.get('/lookups/profiling-clusters').catch((err) => {
            console.warn('Failed to fetch profiling clusters lookup:', err);
            return null;
          }),
        ]);
        if (isMounted) {
          if (agencyRes?.data) {
            setAgencyProfile(agencyRes.data);
          }
          if (clustersRes?.data && Object.keys(clustersRes.data).length > 0) {
            setDynamicClusters(clustersRes.data);
          }
        }
      } catch (err) {
        console.warn('Error fetching dynamic profiling lookups:', err);
      }
    };
    fetchAgencyAndClusters();
    return () => { isMounted = false; };
  }, []);

  // Selected job order object
  const currentJobOrder = useMemo(() => {
    if (!selectedJobOrderId) return null; // No auto-fallback: user must explicitly select
    const strTarget = String(selectedJobOrderId).trim();
    return (
      jobOrders.find(
        (j) =>
          String(j.realId || '').trim() === strTarget ||
          String(j.id || '').trim() === strTarget ||
          String(j.code || '').trim() === strTarget ||
          (j.jobOrderId && String(j.jobOrderId).trim() === strTarget)
      ) || null
    );
  }, [jobOrders, selectedJobOrderId]);

  // Fetch or synthesize the AI Trade Cluster for the active job order via Gemini Flash
  useEffect(() => {
    if (!currentJobOrder?.position) return;
    let isMounted = true;
    const fetchJobCluster = async () => {
      setIsSynthesizingCluster(true);
      try {
        const res = await api.post('/lookups/ai-cluster', {
          job_order_id: currentJobOrder.realId,
          position: currentJobOrder.position,
          requirements: currentJobOrder.requirements || [],
          certifications: currentJobOrder.certifications || [],
          country: currentJobOrder.country,
        });
        if (isMounted && res.data) {
          setActiveJobCluster(res.data);
          const cid = res.data.cluster_id || 'active_job_cluster';
          setDynamicClusters((prev) => ({
            ...prev,
            [cid]: res.data,
          }));
        }
      } catch (err) {
        console.warn('Could not load AI cluster for job order:', err);
      } finally {
        if (isMounted) setIsSynthesizingCluster(false);
      }
    };
    fetchJobCluster();
    return () => { isMounted = false; };
  }, [currentJobOrder?.position, currentJobOrder?.country]);

  // ── Dynamic Evaluation Templates (Supabase Database + Job-Specific Filters) ──────────────
  const [localTemplates, setLocalTemplates] = useState<any[]>(evaluationTemplates || []);

  useEffect(() => {
    if (evaluationTemplates && evaluationTemplates.length > 0) {
      setLocalTemplates(evaluationTemplates);
    } else {
      let isMounted = true;
      api.get('/evaluations/templates')
        .then((res) => {
          if (isMounted && res.data && Array.isArray(res.data)) {
            setLocalTemplates(res.data);
          }
        })
        .catch((err) => console.warn('Could not fetch evaluation templates in SmartProfiling:', err));
      return () => { isMounted = false; };
    }
  }, [evaluationTemplates]);

  // Active evaluation templates for the current job order (job-specific overrides agency baseline)
  const activeJobEvaluationTemplates = useMemo(() => {
    const active = (localTemplates || []).filter((t: any) => Boolean(t.is_active ?? t.isActive ?? true));
    if (!currentJobOrder || active.length === 0) return active;

    const realIdStr = String(currentJobOrder.realId || '');
    const idStr = String(currentJobOrder.id || '').toLowerCase();
    const posStr = String(currentJobOrder.position || '').toLowerCase();

    const isMatch = (target: any) => {
      const t = String(target).trim().toLowerCase();
      if (!t) return false;
      if (realIdStr && (t === realIdStr || t === `jo-${realIdStr}`)) return true;
      if (idStr && (t === idStr || idStr.includes(t) || t.includes(idStr))) return true;
      if (posStr && (t === posStr || posStr.includes(t) || t.includes(posStr))) return true;
      return false;
    };

    // Separate job-specific templates from agency baseline templates
    const jobSpecific = active.filter((t: any) => {
      const app = t.applicable_job_orders || t.applicableJobOrders;
      return Array.isArray(app) && app.length > 0 && app.some(isMatch);
    });

    const baseline = active.filter((t: any) => {
      const app = t.applicable_job_orders || t.applicableJobOrders;
      return !Array.isArray(app) || app.length === 0;
    });

    // If job has specific templates for a type, job-specific takes precedence
    const jobSpecificTypes = new Set(jobSpecific.map((t: any) => (t.test_type || t.type || '').toLowerCase()));
    const effectiveBaseline = baseline.filter((t: any) => {
      const type = (t.test_type || t.type || '').toLowerCase();
      return !jobSpecificTypes.has(type);
    });

    return [...jobSpecific, ...effectiveBaseline];
  }, [localTemplates, currentJobOrder]);

  // Extract dynamic gate definitions and thresholds for scoring & modal display
  const dynamicGateDefinitions = useMemo(() => {
    // Skills template
    const skillsTpl = activeJobEvaluationTemplates.find(
      (t) => (t.test_type || t.type) === 'skills' || (t.name || '').toLowerCase().includes('skill') || (t.name || '').toLowerCase().includes('trade')
    );
    // Language / Interview template
    const langTpl = activeJobEvaluationTemplates.find(
      (t) => (t.test_type || t.type) === 'language' || (t.test_type || t.type) === 'interview' || (t.name || '').toLowerCase().includes('english') || (t.name || '').toLowerCase().includes('language')
    );
    // IQ template
    const iqTpl = activeJobEvaluationTemplates.find(
      (t) => (t.test_type || t.type) === 'iq' || (t.name || '').toLowerCase().includes('iq') || (t.name || '').toLowerCase().includes('aptitude')
    );
    // EQ template
    const eqTpl = activeJobEvaluationTemplates.find(
      (t) => (t.test_type || t.type) === 'eq' || (t.name || '').toLowerCase().includes('psychological') || (t.name || '').toLowerCase().includes('eq') || (t.name || '').toLowerCase().includes('personality')
    );

    const skillsApp = skillsTpl?.applicable_job_orders || skillsTpl?.applicableJobOrders;
    const langApp = langTpl?.applicable_job_orders || langTpl?.applicableJobOrders;
    const iqApp = iqTpl?.applicable_job_orders || iqTpl?.applicableJobOrders;
    const eqApp = eqTpl?.applicable_job_orders || eqTpl?.applicableJobOrders;

    return {
      skillsTpl: {
        id: String(skillsTpl?.test_template_id || skillsTpl?.id || 'trade-skills'),
        name: skillsTpl?.name || 'Trade & Technical Skills Assessment',
        passingScore: Number(skillsTpl?.passing_score ?? skillsTpl?.passingScore ?? 70),
        scoringType: (skillsTpl?.scoring_type || skillsTpl?.scoringType || 'numeric') as 'numeric' | 'pass_fail',
        isJobSpecific: Boolean(Array.isArray(skillsApp) && skillsApp.length > 0),
      },
      langTpl: {
        id: String(langTpl?.test_template_id || langTpl?.id || 'language-aptitude'),
        name: langTpl?.name || 'English & Language Aptitude',
        passingScore: Number(langTpl?.passing_score ?? langTpl?.passingScore ?? 60),
        scoringType: (langTpl?.scoring_type || langTpl?.scoringType || 'numeric') as 'numeric' | 'pass_fail',
        isJobSpecific: Boolean(Array.isArray(langApp) && langApp.length > 0),
      },
      iqTpl: {
        id: String(iqTpl?.test_template_id || iqTpl?.id || 'iq-aptitude'),
        name: iqTpl?.name || 'Cognitive & Aptitude Test (IQ)',
        passingScore: Number(iqTpl?.passing_score ?? iqTpl?.passingScore ?? 50),
        scoringType: (iqTpl?.scoring_type || iqTpl?.scoringType || 'numeric') as 'numeric' | 'pass_fail',
        isJobSpecific: Boolean(Array.isArray(iqApp) && iqApp.length > 0),
      },
      eqTpl: {
        id: String(eqTpl?.test_template_id || eqTpl?.id || 'eq-interview'),
        name: eqTpl?.name || 'Psychological & EQ Interview',
        passingScore: Number(eqTpl?.passing_score ?? eqTpl?.passingScore ?? 75),
        scoringType: (eqTpl?.scoring_type || eqTpl?.scoringType || 'pass_fail') as 'numeric' | 'pass_fail',
        isJobSpecific: Boolean(Array.isArray(eqApp) && eqApp.length > 0),
      },
      otherTemplates: activeJobEvaluationTemplates.filter(
        (t) => !([skillsTpl, langTpl, iqTpl, eqTpl].some((x) => x && (String(x.test_template_id || x.id) === String(t.test_template_id || t.id))))
      ),
    };
  }, [activeJobEvaluationTemplates]);



  // Filter pool: Configurable pipeline scope (Profiling Stage Only [Default], All Active Pool, Assigned to Job Order)
  const candidatePool = useMemo(() => {
    // As long as no job order is selected, no candidate is evaluated or displayed
    if (!currentJobOrder || !selectedJobOrderId) return [];

    return applicants.filter((a) => {
      if (a.isStopped || a.status === 'Processing Stopped') return false;

      if (pipelineScope === 'profiling') {
        // Only applicants who reached the Applicant Profiling stage (passed screening and cleared medical)
        return isApplicantInProfiling(a);
      }

      if (pipelineScope === 'assigned') {
        // Applicants assigned to this target Job Order
        const assignedJoId = String((a as any).job_order_id || (a as any).assignedJobOrderId || a.selectedJobOrderId || '').trim();
        const currentJoRealId = String(currentJobOrder?.realId ?? currentJobOrder?.job_order_id ?? '').trim();
        const currentJoCode = String(currentJobOrder?.id ?? currentJobOrder?.code ?? selectedJobOrderId ?? '').trim();
        return (
          (currentJoRealId && assignedJoId === currentJoRealId) ||
          (currentJoCode && assignedJoId === currentJoCode) ||
          (selectedJobOrderId && assignedJoId === String(selectedJobOrderId).trim())
        );
      }

      // 'all': All active candidates in the agency pool for smart readiness evaluation
      return true;
    });
  }, [applicants, pipelineScope, selectedJobOrderId, currentJobOrder]);

  // A2 Precondition check: candidates with complete assessments vs incomplete
  const { eligibleCandidates, incompleteCandidates } = useMemo(() => {
    const eligible: ApplicantRecord[] = [];
    const incomplete: ApplicantRecord[] = [];

    candidatePool.forEach((a) => {
      const hasScores = Boolean(a.testScores);
      const hasCompleteEvaluation = a.testScores?.allPassed !== undefined
        ? true
        : Boolean(a.testScores?.personalityEQ) &&
        a.testScores?.tradeSkills !== undefined &&
        a.testScores?.iqAptitude !== undefined;

      if (!hasScores || !hasCompleteEvaluation) {
        incomplete.push(a);
      }
      // Rank and evaluate all pool candidates so active candidates in the database appear
      eligible.push(a);
    });

    return { eligibleCandidates: eligible, incompleteCandidates: incomplete };
  }, [candidatePool]);

  // 2. Evaluate and Rank Candidates using Dynamic Job-Fit / Readiness Scoring Engine
  const rankedCandidates: RankedCandidate[] = useMemo(() => {
    if (!currentJobOrder || !selectedJobOrderId || eligibleCandidates.length === 0) return [];

    const jobPos = (currentJobOrder?.position || '').trim();
    const jobCountry = (currentJobOrder?.country || '').trim();
    const minYears = Number(currentJobOrder?.minExperience || 1);

    const targetClusterInfo = jobPos ? findClusterForText(jobPos, dynamicClusters) : null;
    const targetClusterId = targetClusterInfo?.id;
    const targetClusterData = targetClusterInfo?.data;

    // Cross-job-order requirements: Identify evaluation templates specifically required for this active Job Order
    const joRealId = String(currentJobOrder?.id || '').trim();
    const joCode = String(currentJobOrder?.code || '').trim().toLowerCase();
    const joPosLower = jobPos.toLowerCase();

    const currentJobOrderSpecificTemplates = currentJobOrder ? activeJobEvaluationTemplates.filter((t: any) => {
      const app = t.applicable_job_orders || t.applicableJobOrders;
      if (!Array.isArray(app) || app.length === 0) return false;
      return app.some((target: any) => {
        const s = String(target).trim().toLowerCase();
        return s === joRealId || s === `jo-${joRealId}` || s === joCode || joCode.includes(s) || s === joPosLower || joPosLower.includes(s);
      });
    }) : [];

    const evaluated: Omit<RankedCandidate, 'rank'>[] = eligibleCandidates.map((applicant) => {
      const rawScores = applicant.testScores || {};
      const { skillsTpl, langTpl, iqTpl, eqTpl } = dynamicGateDefinitions;

      // ── Gather all actual examinations recorded for this applicant ──────
      const takenExamsList: TakenExamRecord[] = [];
      const rawTests = rawScores.tests;

      if (rawTests && typeof rawTests === 'object' && Object.keys(rawTests).length > 0) {
        Object.entries(rawTests).forEach(([tKey, tData]: [string, any]) => {
          if (!tData) return;
          const testScore = typeof tData.score === 'number' ? tData.score : (typeof tData.rawScore === 'number' ? tData.rawScore : undefined);
          const passScore = Number(tData.passingScore ?? tData.passing_score ?? 60);
          const rawStatus = String(tData.statusText || '').toLowerCase();
          const isPassFail = tData.scoringType === 'pass_fail' || rawStatus.includes('pass') || rawStatus.includes('fail') || tData.type === 'medical' || String(tData.name || '').toLowerCase().includes('medical');

          let passed = false;
          if (isPassFail) {
            if (typeof tData.passed === 'boolean') {
              passed = tData.passed;
            } else if (rawStatus.includes('pass') || rawStatus.includes('suit') || rawStatus.includes('clear')) {
              passed = true;
            } else if (rawStatus.includes('fail') || rawStatus.includes('not suit')) {
              passed = false;
            } else if (typeof testScore === 'number') {
              passed = testScore > 0;
            } else {
              passed = true;
            }
          } else {
            // Numeric score: if score >= passingScore, candidate passed
            if (typeof testScore === 'number') {
              passed = testScore >= passScore;
            } else if (typeof tData.passed === 'boolean') {
              passed = tData.passed;
            } else {
              passed = true;
            }
          }

          const statusText = tData.statusText || (isPassFail ? (passed ? 'PASSED' : 'FAILED') : (testScore !== undefined ? `${testScore}%` : 'Recorded'));

          takenExamsList.push({
            id: String(tData.id || tData.templateId || tKey),
            name: tData.name || `Exam #${tKey}`,
            type: tData.type,
            scoringType: isPassFail ? 'pass_fail' : 'numeric',
            score: testScore,
            passingScore: passScore,
            maxScore: Number(tData.maxScore ?? tData.max_score ?? 100),
            passed,
            statusText,
            weight: typeof tData.weight === 'number' ? tData.weight : (typeof tData.weight_percentage === 'number' ? tData.weight_percentage : undefined),
            isJobSpecific: Boolean(tData.isJobSpecific),
          });
        });
      } else {
        // Fallback for applicants with top-level test score fields
        if (typeof rawScores.tradeSkills === 'number' && rawScores.tradeSkills > 0) {
          const pass = skillsTpl.scoringType === 'pass_fail'
            ? String(rawScores.tradeSkillsStatus || '').toLowerCase() === 'pass'
            : rawScores.tradeSkills >= skillsTpl.passingScore;
          takenExamsList.push({
            id: skillsTpl.id,
            name: skillsTpl.name,
            type: 'skills',
            scoringType: skillsTpl.scoringType,
            score: rawScores.tradeSkills,
            passingScore: skillsTpl.passingScore,
            maxScore: 100,
            passed: pass,
            statusText: skillsTpl.scoringType === 'pass_fail' ? (pass ? 'PASSED' : 'FAILED') : `${rawScores.tradeSkills}%`,
            weight: 30,
          });
        }
        const langVal = typeof rawScores.languageProficiency === 'number' ? rawScores.languageProficiency : (typeof rawScores.englishProficiency === 'number' ? rawScores.englishProficiency : 0);
        if (langVal > 0) {
          const pass = langTpl.scoringType === 'pass_fail'
            ? String(rawScores.languageStatus || '').toLowerCase() === 'pass'
            : langVal >= langTpl.passingScore;
          takenExamsList.push({
            id: langTpl.id,
            name: langTpl.name,
            type: 'language',
            scoringType: langTpl.scoringType,
            score: langVal,
            passingScore: langTpl.passingScore,
            maxScore: 100,
            passed: pass,
            statusText: langTpl.scoringType === 'pass_fail' ? (pass ? 'PASSED' : 'FAILED') : `${langVal}%`,
            weight: 20,
          });
        }
        if (typeof rawScores.iqAptitude === 'number' && rawScores.iqAptitude > 0) {
          const pass = iqTpl.scoringType === 'pass_fail'
            ? String(rawScores.iqStatus || '').toLowerCase() === 'pass'
            : rawScores.iqAptitude >= iqTpl.passingScore;
          takenExamsList.push({
            id: iqTpl.id,
            name: iqTpl.name,
            type: 'iq',
            scoringType: iqTpl.scoringType,
            score: rawScores.iqAptitude,
            passingScore: iqTpl.passingScore,
            maxScore: 100,
            passed: pass,
            statusText: iqTpl.scoringType === 'pass_fail' ? (pass ? 'PASSED' : 'FAILED') : `${rawScores.iqAptitude}%`,
            weight: 20,
          });
        }
        if (rawScores.personalityEQ && !['pending', 'unassessed', 'undefined', 'null'].includes(String(rawScores.personalityEQ).toLowerCase())) {
          const eqStr = String(rawScores.personalityEQ);
          const passed = ['suitable', 'pass', 'passed', 'clear', 'cleared', 'fit'].includes(eqStr.toLowerCase());
          takenExamsList.push({
            id: eqTpl.id,
            name: eqTpl.name,
            type: 'eq',
            scoringType: 'pass_fail',
            score: undefined,
            passingScore: eqTpl.passingScore,
            maxScore: 100,
            passed,
            statusText: eqStr,
            weight: 30,
          });
        }
      }

      // Check whether assessments are actually recorded
      const hasRecordedAssessments = takenExamsList.length > 0;
      const validNumericScores = takenExamsList
        .filter((e) => typeof e.score === 'number' && e.score > 0)
        .map((e) => e.score as number);

      const computedAvg = validNumericScores.length > 0
        ? Math.round((validNumericScores.reduce((a, b) => a + b, 0) / validNumericScores.length) * 10) / 10
        : 0;

      const assessmentScore = (rawScores.overallScore !== undefined && Number(rawScores.overallScore) > 0)
        ? Number(rawScores.overallScore)
        : computedAvg;

      // ── Cross-Job-Order Job-Specific Clearance Evaluation ───────────────
      // If the target job order requires specific employer tests (e.g. "Appendix test"),
      // check if this applicant has taken them.
      const pendingJobSpecificTestNames: string[] = [];
      currentJobOrderSpecificTemplates.forEach((jst: any) => {
        const jstId = String(jst.test_template_id || jst.id);
        const jstName = (jst.name || 'Job-Specific Test').trim();
        const candidateTookIt = takenExamsList.some((te) => {
          return te.id === jstId || te.name.toLowerCase() === jstName.toLowerCase() || te.name.toLowerCase().includes(jstName.toLowerCase());
        });
        if (!candidateTookIt) {
          pendingJobSpecificTestNames.push(jstName);
        }
      });

      // Check if candidate explicitly failed any exam they actually took
      let hasFailedAnyTakenExam = false;
      const failedExamDescriptions: string[] = [];
      takenExamsList.forEach((te) => {
        if (!te.passed) {
          hasFailedAnyTakenExam = true;
          failedExamDescriptions.push(`${te.name}: ${te.statusText}`);
        }
      });

      // Clearance Status
      let clearanceStatus: 'cleared' | 'pending_job_specific' | 'pending_general' | 'failed';
      if (hasFailedAnyTakenExam) {
        clearanceStatus = 'failed';
      } else if (pendingJobSpecificTestNames.length > 0) {
        clearanceStatus = 'pending_job_specific';
      } else if (takenExamsList.length === 0) {
        clearanceStatus = 'pending_general';
      } else {
        clearanceStatus = 'cleared';
      }

      const allGatesPass = clearanceStatus === 'cleared';

      // Find standard category exam references for legacy / quick view
      const techExam = takenExamsList.find((e) => e.type === 'skills' || e.name.toLowerCase().includes('skill') || e.name.toLowerCase().includes('trade'));
      const langExam = takenExamsList.find((e) => e.type === 'language' || e.name.toLowerCase().includes('language') || e.name.toLowerCase().includes('english') || e.name.toLowerCase().includes('interview'));
      const iqExam = takenExamsList.find((e) => e.type === 'iq' || e.name.toLowerCase().includes('iq') || e.name.toLowerCase().includes('aptitude') || e.name.toLowerCase().includes('cognitive'));
      const eqExam = takenExamsList.find((e) => e.type === 'eq' || e.name.toLowerCase().includes('eq') || e.name.toLowerCase().includes('personality') || e.name.toLowerCase().includes('psychological'));

      const techScore = techExam?.score ?? Number(rawScores.tradeSkills ?? 0);
      const interviewScore = langExam?.score ?? Number(rawScores.languageProficiency ?? rawScores.englishProficiency ?? 0);
      const iqScore = iqExam?.score ?? Number(rawScores.iqAptitude ?? 0);
      const eqStatus = eqExam?.statusText ?? String(rawScores.personalityEQ ?? 'Pending');

      const techPass = techExam ? techExam.passed : (techScore >= skillsTpl.passingScore);
      const interviewPass = langExam ? langExam.passed : (interviewScore >= langTpl.passingScore);
      const iqPass = iqExam ? iqExam.passed : (iqScore >= iqTpl.passingScore);
      const eqPass = eqExam ? eqExam.passed : (['suitable', 'pass', 'passed', 'clear', 'cleared', 'fit'].includes(eqStatus.toLowerCase()));

      // Active test results list (taken exams + any pending job-specific requirements)
      const activeTestResults = takenExamsList.map((te) => ({
        id: te.id,
        name: te.name,
        type: te.type || 'exam',
        scoringType: te.scoringType,
        score: te.score,
        passingScore: te.passingScore,
        maxScore: te.maxScore,
        passed: te.passed,
        statusText: te.statusText,
        isJobSpecific: te.isJobSpecific,
        isPendingMandate: false,
      }));

      // Append pending job-specific requirements to active results for transparency
      pendingJobSpecificTestNames.forEach((pName, pIdx) => {
        activeTestResults.push({
          id: `pending-job-${pIdx}`,
          name: pName,
          type: 'job_specific',
          scoringType: 'numeric',
          score: undefined,
          passingScore: 60,
          maxScore: 100,
          passed: false,
          statusText: 'Pending Test',
          isJobSpecific: true,
          isPendingMandate: true,
        });
      });

      const strengths: string[] = [];
      const gaps: string[] = [];

      const appRole = (applicant.appliedRole || (applicant as any).applied_role || (applicant as any).position || '').trim();
      const history = applicant.employmentHistory || applicant.workExperience || [];
      const appClusterInfo = findClusterForText(appRole, dynamicClusters);
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
      } else if (targetClusterId && historyPositions.some((hp) => findClusterForText(hp, dynamicClusters)?.id === targetClusterId)) {
        roleScore = 16;
        strengths.push(`Candidate prior employment history aligns with the ${targetClusterData?.name} cluster (16/30 pts credit)`);
      } else {
        roleScore = 0;
        const clusterNote = targetClusterData ? ` (${targetClusterData.name})` : '';
        gaps.push(`Role mismatch: candidate profile ('${appRole || 'Unspecified'}') does not match target position '${jobPos}'${clusterNote}`);
      }

      // ── 2. Required Certifications (Max: 25 pts) ────────────────────────
      const jobCertsRaw: string[] = Array.isArray(currentJobOrder?.certifications) ? currentJobOrder.certifications : [];
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
      if (targetClusterData && Array.isArray(targetClusterData.roles)) {
        targetClusterData.roles.forEach((r: string) => normalizeTokens(r).forEach((t: string) => targetKeywords.add(t)));
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
        } else if (
          targetClusterData &&
          Array.isArray(targetClusterData.skills) &&
          targetClusterData.skills.some((cs: string) => cs.includes(skLower) || skLower.includes(cs))
        ) {
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

      const appStatus = String(applicant.status || (applicant as any).applicant_status || '').trim().toLowerCase();
      const isMedicallyCleared = 
        appStatus === 'applicant profiling' || 
        appStatus.includes('cv') || 
        appStatus.includes('endorse') || 
        appStatus.includes('deploy') || 
        Boolean((applicant as any).medicalCleared);
      const isUnfitOrProvisional = appStatus === 'provisional' || (applicant as any).clearance_status === 'UNFIT_TO_WORK';

      const medicalStatus = {
        valid: isMedicallyCleared,
        status: isMedicallyCleared
          ? 'Verified Fit-to-Work'
          : (isUnfitOrProvisional ? 'Unfit-to-Work (Provisional)' : 'Clearance Pending (Clinic Evaluation In Progress)'),
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

      // ── 6. Employer Demographic Requirements (Gender & Age) ──────────────
      const joGenderPref = String(currentJobOrder?.genderPreference || currentJobOrder?.gender_preference || 'Any').trim();
      const candidateSex = String(applicant.sex || (applicant as any).gender || 'Male').trim();
      let hasGenderMismatch = false;
      let genderNotice = '';

      if (joGenderPref === 'Female' && candidateSex.toLowerCase() !== 'female') {
        hasGenderMismatch = true;
        genderNotice = `Employer specifies Female Only (Candidate is ${candidateSex})`;
        gaps.push(genderNotice);
      } else if (joGenderPref === 'Male' && candidateSex.toLowerCase() !== 'male') {
        hasGenderMismatch = true;
        genderNotice = `Employer specifies Male Only (Candidate is ${candidateSex})`;
        gaps.push(genderNotice);
      } else if (joGenderPref !== 'Any') {
        strengths.push(`Meets employer gender requirement (${joGenderPref} Only)`);
      }

      const joMinAge = typeof currentJobOrder?.minAge === 'number' ? currentJobOrder.minAge : (typeof currentJobOrder?.min_age === 'number' ? currentJobOrder.min_age : undefined);
      const joMaxAge = typeof currentJobOrder?.maxAge === 'number' ? currentJobOrder.maxAge : (typeof currentJobOrder?.max_age === 'number' ? currentJobOrder.max_age : undefined);
      const candidateAge = typeof applicant.age === 'number' && applicant.age > 0 ? applicant.age : undefined;
      let hasAgeMismatch = false;
      let ageNotice = '';

      if (candidateAge) {
        if (joMinAge && candidateAge < joMinAge) {
          hasAgeMismatch = true;
          ageNotice = `Candidate age (${candidateAge} yrs) is below employer minimum age requirement (${joMinAge} yrs)`;
          gaps.push(ageNotice);
        } else if (joMaxAge && candidateAge > joMaxAge) {
          hasAgeMismatch = true;
          ageNotice = `Candidate age (${candidateAge} yrs) exceeds employer maximum age preference (${joMaxAge} yrs)`;
          gaps.push(ageNotice);
        } else if (joMinAge || joMaxAge) {
          strengths.push(`Candidate age (${candidateAge} yrs) meets employer criteria (${joMinAge || 18}–${joMaxAge || 65} yrs)`);
        }
      }

      // Overall Readiness Score
      const readinessScore = Math.min(100, Math.max(0, Math.round(roleScore + certScore + expScore + skillScore + overseasScore)));

      // Three-tier analytical classification: ≥90% = Recommended, 75–89% = For Further Review, <75% = Not Recommended
      // Score thresholds ALWAYS take priority. Pending exam states only add warning notes.
      let classification: 'Recommended' | 'For Further Review' | 'Not Recommended';
      const failureReasons: string[] = [];

      // Step 1: Determine score-based classification first (always authoritative)
      if (readinessScore >= 90) {
        classification = 'Recommended';
      } else if (readinessScore >= 75) {
        classification = 'For Further Review';
      } else {
        classification = 'Not Recommended';
      }

      // Step 2: Hard overrides only for outright exam failures
      if (clearanceStatus === 'failed') {
        // Candidate failed one or more recorded examination gates — override to Not Recommended
        classification = 'Not Recommended';
        failedExamDescriptions.forEach((d) => failureReasons.push(`Failed assessment requirement: ${d}`));
      } else if (clearanceStatus === 'pending_job_specific') {
        // Pending job-specific exam: cap at 'For Further Review' max (can't be Recommended yet)
        if (classification === 'Recommended') classification = 'For Further Review';
        failureReasons.push(
          `Job-Order Specific Exam pending: Candidate must complete "${pendingJobSpecificTestNames.join(', ')}" mandated for ${jobPos} before final endorsement.`
        );
      } else if (clearanceStatus === 'pending_general') {
        // Pending general exam: note it but do NOT change score-based classification
        failureReasons.push('Assessment examination clearance pending (candidate has not yet completed evaluation testing)');
      }

      if (readinessScore < 75 && !failureReasons.some((r) => r.includes('Readiness score'))) {
        failureReasons.push(`Readiness score (${readinessScore}%) is below the 75% threshold for ${jobPos}`);
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
        clearanceStatus,
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
        hasRecordedAssessments,
        takenExams: takenExamsList,
        pendingJobSpecificTestNames,
        activeTestResults,
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
        genderCriteria: {
          required: joGenderPref,
          candidate: candidateSex,
          isMismatch: hasGenderMismatch,
          notice: genderNotice,
        },
        ageCriteria: {
          minAge: joMinAge,
          maxAge: joMaxAge,
          candidateAge,
          isMismatch: hasAgeMismatch,
          notice: ageNotice,
        },
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
  }, [eligibleCandidates, currentJobOrder, dynamicClusters, dynamicGateDefinitions]);

  // KPI Header Counts
  const totalEvaluated = rankedCandidates.length;
  const recommendedCount = rankedCandidates.filter((c) => c.classification === 'Recommended').length;
  const reviewCount = rankedCandidates.filter((c) => c.classification === 'For Further Review').length;
  const notRecommendedCount = rankedCandidates.filter((c) => c.classification === 'Not Recommended').length;

  // ── Scope filter counts for Applicant Profiling ───────────────────────────
  const profilingScopeCounts = useMemo(() => {
    const profiling = applicants.filter((a) => !a.isStopped && a.status !== 'Processing Stopped' && isApplicantInProfiling(a)).length;
    const all = applicants.filter((a) => !a.isStopped && a.status !== 'Processing Stopped').length;
    const assigned = currentJobOrder
      ? applicants.filter((a) => {
          if (a.isStopped || a.status === 'Processing Stopped') return false;
          const assignedJoId = String((a as any).job_order_id || (a as any).assignedJobOrderId || a.selectedJobOrderId || '').trim();
          const currentJoRealId = String(currentJobOrder.realId ?? currentJobOrder.job_order_id ?? '').trim();
          const currentJoCode = String(currentJobOrder.id ?? currentJobOrder.code ?? selectedJobOrderId ?? '').trim();
          return (
            (currentJoRealId && assignedJoId === currentJoRealId) ||
            (currentJoCode && assignedJoId === currentJoCode) ||
            (selectedJobOrderId && assignedJoId === String(selectedJobOrderId).trim())
          );
        }).length
      : 0;
    return { profiling, all, assigned };
  }, [applicants, currentJobOrder, selectedJobOrderId]);

  // Handler: Open Candidate Profile Overlay directly without leaving the screen
  const handleOpenProfileOverlay = (applicant: ApplicantRecord) => {
    setOverlayApplicant(applicant);
  };

  // Handler: Endorse / Forward candidate to CV Encoding (executed from inside Review Details modal)
  const handleEndorseCandidate = async (candidate: RankedCandidate) => {
    // Stage barrier: Endorsement is only allowed for candidates in the Profiling stage
    if (!isApplicantInProfiling(candidate.applicant)) {
      showToast(`⚠️ Endorsement Not Available: Candidate is in '${candidate.applicant.status || 'Active Pool'}' stage. Only applicants in 'Applicant Profiling' stage can be endorsed to CV Encoding.`);
      return;
    }

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
          phase: 3,
          phaseDescription: `Endorsed to ${currentJobOrder?.position || 'Job Order'} (#${currentJobOrder?.id || ''})`,
        });
      }

      try {
        await api.put(`/applicants/${candidate.applicant.id}`, {
          application_id: candidate.applicant.applicationId,
          application_status: 'CV Encoding',
          current_phase: 3,
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

  // Handler: Return candidate to previous phase (Medical Clearance or Initial Screening)
  const handleConfirmReturnCandidate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!candidateToReturn || isSubmittingReturn) return;

    if (!returnNotes.trim()) {
      showToast('Please state a reason for returning candidate to previous phase.');
      return;
    }

    setIsSubmittingReturn(true);
    const applicantId = String(candidateToReturn.id);
    const numericId = parseInt(applicantId, 10);
    const reasonText = `${returnCategory}: ${returnNotes.trim()}`;
    const nowIso = new Date().toISOString();

    const isReturningToMedical = returnTargetStage === 'medical';
    const targetStatus = isReturningToMedical ? 'Medical Clearance' : 'Initial Screening';
    const targetPhase = isReturningToMedical ? 2 : 1;
    const targetDepartment = isReturningToMedical ? 'Admin' : 'Recruitment';
    const targetHandler = 'Unassigned';
    const phaseDesc = isReturningToMedical
      ? `Returned from Profiling to Medical Clearance by ${currentUserName}. Note: ${reasonText}`
      : `Returned from Profiling to Initial Screening by ${currentUserName}. Note: ${reasonText}`;

    try {
      if (updateApplicant) {
        updateApplicant(applicantId, {
          status: targetStatus,
          phase: targetPhase,
          currentHandler: targetHandler,
          currentDepartment: targetDepartment,
          phaseDescription: phaseDesc,
        });
      }

      if (!isNaN(numericId)) {
        await api.put(`/applicants/${numericId}`, {
          application_id: candidateToReturn.applicationId,
          application_status: targetStatus,
          status_code: isReturningToMedical ? 'MED_PENDING' : 'SCREENING_PENDING',
          current_phase: targetPhase,
          current_handler: targetHandler,
          current_department: targetDepartment,
          phase_description: phaseDesc,
          statusChangeReason: `Returned from Applicant Profiling: ${reasonText}`,
          statusChangeSource: 'PROFILING',
          updated_at: nowIso,
        }).catch(console.error);
      }

      if (addActivityLog) {
        addActivityLog({
          applicantId,
          action: `Returned to ${targetStatus}`,
          performedBy: currentUserName,
          department: 'Recruitment',
          details: `Candidate ${candidateToReturn.name} returned from Applicant Profiling to ${targetStatus} (${targetDepartment}) by ${currentUserName}. Reason: ${reasonText}`,
        });
      }

      showToast(`✓ ${candidateToReturn.name} returned to ${targetStatus}.`);
      setCandidateToReturn(null);
      setReturnNotes('');
      if (activeModalCandidate && String(activeModalCandidate.applicant.id) === applicantId) {
        setActiveModalCandidate(null);
      }
    } catch (err) {
      console.error('Failed to return candidate:', err);
      showToast('Failed to return candidate. Please try again.');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  // Handler: Generate and download official Candidate Profiling Evaluation Report as PDF
  // CRITICAL CONSTRAINTS:
  // - 0.5-inch margins (12.7mm)
  // - Primary content font size 11 (matching CV body standard)
  // - Text alignment and dynamic line heights to prevent collision/overlap
  // - Dynamic agency name and POEA license with ZERO FlowSensus branding
  // Handler: Generate and download official Candidate Profiling Evaluation Report as PDF
  // Structured and designed in exact accordance with the Screening summary evaluation PDF:
  // - Formal 15mm margins (A4 portrait 210x297mm)
  // - Clean agency header with double horizontal dividing rules and Ref No / Date
  // - Structured tabular section headers (slate-100 fill, slate-300 borders)
  // - Formally partitioned metadata grid (I. Candidate Identification & Job Order Allocation)
  // - Structured tabular 5-Pillar breakdown with alternating row backgrounds and aggregate summary bar
  // - Two-compartment Examination Gates and Statutory Regulatory Audit
  // - Strengths and Gap remediation findings box
  // - Dual-compartment Official Endorsement & Conforme signatures
  // - Clean centered running footers
  const handleDownloadProfilingPDF = (candidate: RankedCandidate) => {
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Pure ASCII / WinAnsi text sanitizer to prevent jsPDF Helvetica character tracking / spacing glitches
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
        : 'POEA / DMW Accredited Overseas Placement Agency';
      const applicant = candidate.applicant;
      const rawAppName = applicant.name || `${(applicant as any).first_name || ''} ${(applicant as any).last_name || ''}`.trim() || 'Candidate';
      const appName = cleanPdfText(rawAppName);
      const appCode = cleanPdfText(applicant.applicantCode || (applicant.id ? `APP-${String(applicant.id).padStart(5, '0')}` : 'N/A'));
      const targetPos = cleanPdfText(currentJobOrder?.position || 'Target Position');
      const targetJoId = cleanPdfText(currentJobOrder?.id || 'N/A');
      const targetEmployer = cleanPdfText(currentJobOrder?.employer || 'Foreign Principal Partner');
      const targetCountry = cleanPdfText(currentJobOrder?.country || 'International');

      const rawEvaluator = currentUserName || 'Evaluating Officer';
      const evaluatorName = cleanPdfText(rawEvaluator).replace(/flowsensus\s*/gi, '').trim() || 'Superadmin';

      const refDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const cleanCodeDigits = appCode.replace(/[^a-zA-Z0-9]/g, '');
      const refNo = `PRF-${new Date().getFullYear()}-${cleanCodeDigits.slice(-5) || '00001'}`;

      const pageWidth = 210;
      const margin = 15; // Formal standard 15mm (identical to Screening.tsx)
      const contentWidth = pageWidth - (margin * 2); // 180mm
      let y = 16;

      const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > 275) {
          doc.addPage();
          y = 16;
          // Clean Continuation Header matching Screening style
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(15, 23, 42);
          doc.text(`${agencyName} - CANDIDATE PROFILING & JOB-FIT REPORT (CONTINUED)`, margin, y);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          doc.text(`APPLICANT: ${appName} (${appCode}) | REF: ${refNo}`, 195, y, { align: 'right' });

          y += 3;
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.3);
          doc.line(margin, y, 195, y);
          y += 6;
        }
      };

      // ── Header (Formal, Plain, Official Recruitment Agency Standard - Matching Screening.tsx) ──
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(agencyName, margin, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text('OFFICIAL CANDIDATE PROFILING & JOB-FIT EVALUATION REPORT', margin, y + 4.5);

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

      // ── Section I: Candidate Identification & Target Job Order Allocation ──
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 5.5, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, y, contentWidth, 5.5, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('I. CANDIDATE IDENTIFICATION & TARGET JOB ORDER ALLOCATION', margin + 3, y + 3.8);

      y += 5.5;
      const gridH = 26; // 4 rows x 6.5mm = 26mm
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, y, contentWidth, gridH, 'S');
      doc.line(margin + 90, y, margin + 90, y + gridH); // Center divider

      // 3 horizontal dividers
      doc.line(margin, y + 6.5, 195, y + 6.5);
      doc.line(margin, y + 13, 195, y + 13);
      doc.line(margin, y + 19.5, 195, y + 19.5);

      // Row 1
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('FULL CANDIDATE NAME:', margin + 3, y + 2.6);
      doc.text('TARGET FOREIGN JOB ORDER:', margin + 93, y + 2.6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(appName, margin + 3, y + 5.5);
      doc.text(`${targetPos} (${targetJoId})`, margin + 93, y + 5.5);

      // Row 2
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('APPLICANT CODE:', margin + 3, y + 9.1);
      doc.text('FOREIGN PRINCIPAL / EMPLOYER:', margin + 93, y + 9.1);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(appCode, margin + 3, y + 12);
      doc.text(targetEmployer, margin + 93, y + 12);

      // Row 3
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('APPLIED TRADE ROLE:', margin + 3, y + 15.6);
      doc.text('DESTINATION COUNTRY & VACANCIES:', margin + 93, y + 15.6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      const appliedRoleStr = cleanPdfText(applicant.appliedRole || (applicant as any).applied_role || (applicant as any).position || 'General Candidate');
      doc.text(appliedRoleStr, margin + 3, y + 18.5);
      doc.text(`${targetCountry} (${currentJobOrder?.vacancies ?? 'Open'} Open Slots)`, margin + 93, y + 18.5);

      // Row 4
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('VERIFIED EXPERIENCE & CERTS:', margin + 3, y + 22.1);
      doc.text('TARGET EXPERIENCE REQUIRED:', margin + 93, y + 22.1);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`${candidate.totalExperienceYears} Year(s) | ${candidate.certificationsCount} Credential(s)${candidate.isFirstTimeApplicant ? ' (First-Time)' : ''}`, margin + 3, y + 25);
      doc.text(`${currentJobOrder?.minExperience || 1} Year(s) Minimum Requirement`, margin + 93, y + 25);

      y += gridH + 4.5;

      // ── Optional Preference Notice ──
      const pdfMismatch = getJobOrderMismatchInfo(candidate.applicant, currentJobOrder);
      if (pdfMismatch) {
        const mismatchMsg = cleanPdfText(`Applicant originally applied for ${pdfMismatch.chosenJobOrder || pdfMismatch.chosenRole || 'a different job order'}. Evaluated against this position via allied trade cluster qualifications.`);
        const wrappedNotice = doc.splitTextToSize(mismatchMsg, contentWidth - 48);
        const noticeH = Math.max(8, 4 + (wrappedNotice.length * 3.6));
        checkPageBreak(noticeH + 4);

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.rect(margin, y, contentWidth, noticeH, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(15, 23, 42);
        doc.text('JOB ORDER PREFERENCE NOTICE:', margin + 3, y + 3.2);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(51, 65, 85);
        doc.text(wrappedNotice, margin + 46, y + 3.2, { lineHeightFactor: 1.15 });

        y += noticeH + 4;
      }

      // ── Section II: Phase 1 Standardized Competency & 5-Pillar Job-Fit Evaluation ──
      checkPageBreak(45);
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 5.5, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, y, contentWidth, 5.5, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('II. JOB-ORDER READINESS BREAKDOWN (5 CRITICAL PILLARS)', margin + 3, y + 3.8);

      y += 5.5;

      // Table Headers matching Screening.tsx layout - optimized 5-column layout without Rating (sum = 180mm)
      const colW = [8, 48, 94, 15, 15];
      const tableHeaders = ['#', 'CRITICAL READINESS PILLAR', 'CRITERIA & VERIFICATION FINDINGS', 'WEIGHT', 'SCORE'];

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
      doc.text(tableHeaders[4], curX + 2, y + 3.5);

      y += 5;

      const categories = [
        {
          num: '1',
          name: 'Role & Trade Match',
          score: candidate.categoryScores.roleMatch,
          max: 30,
          expl: getCategoryCandidateExplanation('roleMatch', candidate, currentJobOrder),
          passed: candidate.categoryScores.roleMatch >= 16,
        },
        {
          num: '2',
          name: 'Required Certifications',
          score: candidate.categoryScores.certifications,
          max: 25,
          expl: getCategoryCandidateExplanation('certifications', candidate, currentJobOrder),
          passed: candidate.categoryScores.certifications > 0 || (!currentJobOrder?.certifications || currentJobOrder.certifications.length === 0),
        },
        {
          num: '3',
          name: candidate.isFirstTimeApplicant ? 'Institutional TVET / Foundation' : 'Work Experience Duration',
          score: candidate.categoryScores.experience,
          max: 20,
          expl: getCategoryCandidateExplanation('experience', candidate, currentJobOrder),
          passed: candidate.categoryScores.experience >= 15,
        },
        {
          num: '4',
          name: 'Trade Skills & Competencies',
          score: candidate.categoryScores.skills,
          max: 15,
          expl: getCategoryCandidateExplanation('skills', candidate, currentJobOrder),
          passed: candidate.categoryScores.skills > 0,
        },
        {
          num: '5',
          name: 'Overseas Deployment Readiness',
          score: candidate.categoryScores.overseas,
          max: 10,
          expl: getCategoryCandidateExplanation('overseas', candidate, currentJobOrder),
          passed: candidate.categoryScores.overseas >= 3,
        },
      ];

      categories.forEach((cat, idx) => {
        const cleanedExpl = cleanPdfText(cat.expl);
        const textLines = doc.splitTextToSize(cleanedExpl, colW[2] - 4);
        const rowH = Math.max(7.5, 3.8 + (textLines.length * 3.5));
        checkPageBreak(rowH);

        if (idx % 2 === 1) {
          doc.setFillColor(249, 250, 251);
          doc.rect(margin, y, contentWidth, rowH, 'F');
        }
        doc.setDrawColor(226, 232, 240);
        doc.rect(margin, y, contentWidth, rowH, 'S');

        let rx = margin;
        // Col 0: #
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);
        doc.text(cat.num, rx + 2, y + 4.2);
        rx += colW[0];

        // Col 1: Pillar Name
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(cat.name, rx + 2, y + 4.2);
        rx += colW[1];

        // Col 2: Findings & Explanation (Multi-line)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(51, 65, 85);
        doc.text(textLines, rx + 2, y + 3.8, { lineHeightFactor: 1.15 });
        rx += colW[2];

        // Col 3: Weight
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(51, 65, 85);
        doc.text(`${cat.max} pts`, rx + 2, y + 4.2);
        rx += colW[3];

        // Col 4: Score
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`${cat.score} pts`, rx + 2, y + 4.2);

        y += rowH;
      });

      // Aggregate Summary Row matching Screening.tsx (Non-overlapping layout)
      y += 2;
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 7, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, y, contentWidth, 7, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);

      const classText = candidate.classification === 'Recommended'
        ? 'RECOMMENDED'
        : (candidate.classification === 'For Further Review' ? 'FOR FURTHER REVIEW' : 'NOT RECOMMENDED');
      doc.text(`JOB-FIT READINESS SCORE: ${candidate.readinessScore}% (${classText})`, margin + 4, y + 4.8);

      const statutorySummaryText = candidate.compliancePassed ? 'STATUTORY: PASSED (ALL CLEAR)' : 'STATUTORY: ACTION REQUIRED';
      doc.text(statutorySummaryText, 195 - 4, y + 4.8, { align: 'right' });
      y += 11;

      // ── Section III: Examination Clearance Gates & Statutory Clearances ──
      checkPageBreak(38);
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 5.5, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, y, contentWidth, 5.5, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('III. EXAMINATION ASSESSMENT GATES & STATUTORY REGULATORY AUDIT', margin + 3, y + 3.8);

      y += 5.5;

      const dynamicGates = (candidate.activeTestResults && candidate.activeTestResults.length > 0)
        ? candidate.activeTestResults.map((t) => ({
          label: cleanPdfText(t.name),
          val: t.scoringType === 'pass_fail' ? (t.passed ? 'PASSED' : 'FAILED') : `${t.score ?? 0}%`,
          req: t.scoringType === 'pass_fail' ? 'Req: Pass' : `Min. ${t.passingScore}%`,
          passed: t.passed,
        }))
        : [
          { label: 'Trade Skills Test', val: `${candidate.techScore}%`, req: `Min. ${dynamicGateDefinitions.skillsTpl.passingScore}%`, passed: candidate.techScore >= dynamicGateDefinitions.skillsTpl.passingScore },
          { label: 'IQ / Aptitude Test', val: `${candidate.iqScore}%`, req: `Min. ${dynamicGateDefinitions.iqTpl.passingScore}%`, passed: candidate.iqScore >= dynamicGateDefinitions.iqTpl.passingScore },
          { label: 'Interview / Language', val: `${candidate.interviewScore}%`, req: `Min. ${dynamicGateDefinitions.langTpl.passingScore}%`, passed: candidate.interviewScore >= dynamicGateDefinitions.langTpl.passingScore },
          { label: 'Personality / EQ Gate', val: candidate.eqStatus, req: dynamicGateDefinitions.eqTpl.scoringType === 'pass_fail' ? 'Req: Suitable' : `Min. ${dynamicGateDefinitions.eqTpl.passingScore}%`, passed: candidate.eqStatus === 'Suitable' },
        ];

      const statDocs = [
        { name: 'Passport Validity', status: candidate.passportStatus.status, valid: candidate.passportStatus.valid },
        { name: 'NBI Clearance', status: candidate.nbiStatus.status, valid: candidate.nbiStatus.valid },
        { name: 'Medical Clearance', status: candidate.medicalStatus.status, valid: candidate.medicalStatus.valid },
      ];

      // Side-by-Side 2 Compartment Layout (90mm left, 90mm right)
      const auditBoxH = Math.max(26, 4 + (Math.max(dynamicGates.length, statDocs.length + 1) * 4.8));
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, y, contentWidth, auditBoxH, 'S');
      doc.line(margin + 90, y, margin + 90, y + auditBoxH);

      // Left Column: Examination Gates (Un-truncated gate names, right-aligned scores)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('EXAMINATION ASSESSMENT GATES (5 DYNAMIC GATES):', margin + 3, y + 3.2);

      let gateY = y + 7.2;
      dynamicGates.forEach((g) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(51, 65, 85);
        const truncGate = g.label.length > 36 ? `${g.label.slice(0, 34)}...` : g.label;
        doc.text(`- ${truncGate}:`, margin + 3, gateY);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(g.val, margin + 62, gateY, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`(${g.req})`, margin + 87, gateY, { align: 'right' });
        gateY += 4.5;
      });

      // Right Column: Statutory Regulatory Clearances (Monochrome, right-aligned to prevent border overflow)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('STATUTORY REGULATORY CLEARANCES (DMW / POEA):', margin + 93, y + 3.2);

      let docY = y + 7.2;
      statDocs.forEach((sd) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(51, 65, 85);
        doc.text(`- ${cleanPdfText(sd.name)}:`, margin + 93, docY);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42); // Pure Black!
        const cleanStat = cleanPdfText(sd.status)
          .replace(/\s*-\s*\d+\s*days?\s*left/i, '')
          .replace(/\s*-\s*\d+\s*days?\s*remaining/i, '');
        const truncStat = cleanStat.length > 32 ? `${cleanStat.slice(0, 30)}...` : cleanStat;
        doc.text(truncStat, 195 - 4, docY, { align: 'right' });
        docY += 5.2;
      });

      // Overall Statutory Status line in right compartment (Right-aligned, never cross border)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('COMPLIANCE CLEARANCE:', margin + 93, docY + 1.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42); // Pure Black!
      const compStatus = candidate.compliancePassed
        ? 'VERIFIED CLEAR (Ready for Processing)'
        : 'DOCUMENTS RENEWAL REQUIRED';
      doc.text(compStatus, 195 - 4, docY + 1.5, { align: 'right' });

      y += auditBoxH + 4.5;

      // ── Section IV: Evaluation Findings (Strengths & Identified Gaps - Monochrome) ──
      if (candidate.strengths.length > 0 || candidate.gaps.length > 0) {
        checkPageBreak(30);
        doc.setFillColor(241, 245, 249);
        doc.rect(margin, y, contentWidth, 5.5, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.rect(margin, y, contentWidth, 5.5, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text('IV. EVALUATION FINDINGS & TRADE GAP ANALYSIS', margin + 3, y + 3.8);

        y += 5.5;

        // Calculate height for findings box
        let totalFindingsLines = 0;
        candidate.strengths.forEach((s) => {
          totalFindingsLines += doc.splitTextToSize(`- ${cleanPdfText(s)}`, contentWidth - 8).length;
        });
        candidate.gaps.forEach((g) => {
          totalFindingsLines += doc.splitTextToSize(`! ${cleanPdfText(g)}`, contentWidth - 8).length;
        });

        const findingsBoxH = Math.max(22, 6 + (totalFindingsLines * 3.8) + (candidate.strengths.length > 0 && candidate.gaps.length > 0 ? 5 : 0));
        checkPageBreak(findingsBoxH);

        doc.setFillColor(255, 255, 255);
        doc.rect(margin, y, contentWidth, findingsBoxH, 'S');

        let fy = y + 4;
        if (candidate.strengths.length > 0) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(15, 23, 42); // Pure Black!
          doc.text('CANDIDATE STRENGTHS & ASSETS:', margin + 3, fy);
          fy += 3.8;

          candidate.strengths.forEach((str) => {
            const cleanStr = cleanPdfText(str);
            const lines = doc.splitTextToSize(`- ${cleanStr}`, contentWidth - 8);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(51, 65, 85);
            doc.text(lines, margin + 4, fy, { lineHeightFactor: 1.15 });
            fy += (lines.length * 3.6);
          });
        }

        if (candidate.gaps.length > 0) {
          if (candidate.strengths.length > 0) fy += 1.5;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(15, 23, 42); // Pure Black!
          doc.text('IDENTIFIED DEFICIENCIES & ACTION ITEMS:', margin + 3, fy);
          fy += 3.8;

          candidate.gaps.forEach((gap) => {
            const cleanGap = cleanPdfText(gap);
            const lines = doc.splitTextToSize(`! ${cleanGap}`, contentWidth - 8);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(51, 65, 85);
            doc.text(lines, margin + 4, fy, { lineHeightFactor: 1.15 });
            fy += (lines.length * 3.6);
          });
        }

        y += findingsBoxH + 4.5;
      }

      // ── Section V: Official Endorsement & Conforme (Agency / Evaluator Signature) ──
      checkPageBreak(34);
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 5.5, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, y, contentWidth, 5.5, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('V. OFFICIAL ENDORSEMENT & CONFORME', margin + 3, y + 3.8);

      y += 5.5;
      const sigH = 26;
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, y, contentWidth, sigH, 'S');
      doc.line(margin + 90, y, margin + 90, y + sigH);

      // Left signature (Candidate Conforme)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('CANDIDATE ACKNOWLEDGMENT & CONFORME:', margin + 45, y + 4.5, { align: 'center' });
      doc.line(margin + 8, y + 16, margin + 82, y + 16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(appName, margin + 45, y + 19.5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('Candidate Signature over Printed Name / Date', margin + 45, y + 23, { align: 'center' });

      // Right signature (Authorized Evaluating Officer / Agency: Agency Name / Evaluator)
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

      // ── Running Footers matching Screening.tsx ──
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.line(margin, 285, 195, 285);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `CONFIDENTIAL • ${agencyName} • OFFICIAL PROFILING & JOB-FIT REPORT • A4 STANDARD • PAGE ${i} OF ${totalPages}`,
          105,
          288.5,
          { align: 'center' }
        );
      }

      // Download file with clean name (strictly NO FlowSensus name)
      const sanitizedCandidate = appName.replace(/[^a-zA-Z0-9]/g, '_');
      const sanitizedAgency = agencyName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${sanitizedCandidate}_Profiling_Evaluation_${sanitizedAgency}.pdf`;

      doc.save(filename);
      showToast(`Evaluation report downloaded: ${filename}`);
    } catch (pdfErr) {
      console.error('PDF generation error:', pdfErr);
      showToast('Failed to generate PDF evaluation report. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
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
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 md:p-6 transition-all overflow-visible">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black inline-flex items-center justify-center">
            1
          </span>
          Step 1: Select Active Foreign Job Order to Fill
        </h3>

        <SearchableJobOrderSelector
          jobOrders={jobOrders}
          selectedJobOrderId={selectedJobOrderId}
          onSelectJobOrder={(id, jo) => {
            setSelectedJobOrderId(String(jo?.realId || jo?.id || id));
          }}
          isLoading={isLoadingJobs}
        />
      </div>

      {/* Step 2: Ranked Candidate Shortlist */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all">
        {/* Section Header with KPI Summary & Info Tooltip */}
        <div className="p-5 md:p-6 border-b border-slate-200 space-y-3">
          {/* Title Row + Audit Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black inline-flex items-center justify-center">
                2
              </span>
              <h3 className="text-sm font-black text-slate-900 tracking-tight">
                {currentJobOrder
                  ? <>Step 2: Ranked Candidate Shortlist for {currentJobOrder.position} #{currentJobOrder.id}</>
                  : <span className="text-slate-400 font-semibold">Step 2: Select a job order above to view ranked candidates</span>
                }
              </h3>
              {agencyProfile?.agency_name && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200/80">
                  <Building2 className="w-3 h-3 text-teal-600" />
                  <span>{agencyProfile.agency_name}</span>
                  {agencyProfile.poea_license_no && (
                    <span className="text-teal-600/80 font-normal">({agencyProfile.poea_license_no})</span>
                  )}
                </span>
              )}
            </div>

            {/* Audit Info button positioned neatly on the right */}
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onClick={() => setShowTooltip(!showTooltip)}
                className="text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-2xs"
                title="Assessment calculation details"
              >
                <Info className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-xs text-slate-700 font-bold">Audit Info</span>
              </button>

              {showTooltip && (
                <div className="absolute right-0 top-9 z-30 w-72 p-3 bg-slate-900 text-white text-xs rounded-xl shadow-xl border border-slate-700 animate-in fade-in zoom-in-95 duration-150">
                  <p className="font-semibold text-slate-100 leading-snug">
                    *Readiness scores calculated dynamically based on target job order requirements and verified candidate profiles.
                  </p>
                  <p className="text-slate-300 mt-1.5 text-[11px]">
                    Classification: Recommended (≥90%), For Further Review (75%–89%), Not Recommended (&lt;75%).
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

          {/* KPI Header Bar & Scope Filters Row (Consistent System Design) */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pt-3 border-t border-slate-100">
            {/* KPI Stats */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Total Evaluated:</span>
                <strong className="text-slate-900 font-black">{totalEvaluated}</strong>
              </span>
              <span className="bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200 shadow-xs flex items-center gap-1.5">
                <span className="text-emerald-700 font-medium">Recommended:</span>
                <strong className="font-black text-emerald-950">{recommendedCount}</strong>
              </span>
              <span className="bg-amber-50 text-amber-800 px-3 py-1.5 rounded-lg border border-amber-200 shadow-xs flex items-center gap-1.5">
                <span className="text-amber-700 font-medium">For Review:</span>
                <strong className="font-black text-amber-950">{reviewCount}</strong>
              </span>
              <span className="bg-rose-50 text-rose-800 px-3 py-1.5 rounded-lg border border-rose-200 shadow-xs flex items-center gap-1.5">
                <span className="text-rose-700 font-medium">Not Recommended:</span>
                <strong className="font-black text-rose-950">{notRecommendedCount}</strong>
              </span>
            </div>

            {/* Candidate Pool Dropdown Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="pipeline-pool-select" className="text-xs font-bold text-slate-600 flex items-center gap-1.5 whitespace-nowrap">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span>Candidate Pool:</span>
              </label>

              <div className="relative">
                <select
                  id="pipeline-pool-select"
                  value={pipelineScope}
                  onChange={(e) => setPipelineScope(e.target.value as any)}
                  className="appearance-none pl-3.5 pr-8 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#20637A]/30 focus:border-[#20637A] cursor-pointer transition-all"
                >
                  <option value="profiling">
                    Ready in Profiling ({profilingScopeCounts.profiling})
                  </option>
                  <option value="all">
                    All Agency Pool ({profilingScopeCounts.all})
                  </option>
                  {currentJobOrder && (
                    <option value="assigned">
                      Assigned to Job Order ({profilingScopeCounts.assigned})
                    </option>
                  )}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Helper Banner when no job order is selected */}
          {!currentJobOrder && (
            <div className="mt-3 p-3 bg-sky-50/70 border border-sky-200 rounded-xl text-xs text-sky-950 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <Info className="w-4 h-4 text-sky-600 flex-shrink-0" />
                <p className="text-[11px] text-sky-900 leading-snug">
                  <strong>Select a Job Order above</strong> to evaluate and rank candidate job-fit against position requirements and credentials.
                </p>
              </div>
            </div>
          )}

          {/* Allied Trade Recognition Active Tag & Informative Description */}
          {isSynthesizingCluster ? (
            <div className="mt-3 p-3 bg-teal-50/60 rounded-xl border border-teal-200/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1">
                <Skeleton className="h-5 w-28 rounded-full bg-teal-200/60" />
                <Skeleton className="h-4 w-44 bg-teal-200/40" />
              </div>
              <Skeleton className="h-5 w-36 rounded-md bg-teal-200/60 flex-shrink-0" />
            </div>
          ) : activeJobCluster ? (
            <div className="mt-3 p-3 bg-gradient-to-r from-teal-50/90 via-sky-50/70 to-indigo-50/60 rounded-xl border border-teal-200/80 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#20637A] text-white shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Allied Trade Group</span>
                  </span>
                  <span className="font-extrabold text-slate-800 text-xs sm:text-sm">
                    {activeJobCluster.name}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-teal-800 bg-white/80 px-2 py-0.5 rounded-md border border-teal-200">
                  ⚡ Cross-Trade Recognition Active
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                {activeJobCluster.description}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-teal-200/50 text-[11px] text-slate-500">
                <span className="font-bold text-slate-700">Related Positions Accepted:</span>
                {(activeJobCluster.roles || []).slice(0, 6).map((r: string, idx: number) => (
                  <span key={idx} className="bg-white/90 px-2 py-0.5 rounded text-slate-700 border border-slate-200/80 font-medium">
                    {r}
                  </span>
                ))}
                {(activeJobCluster.roles || []).length > 6 && (
                  <span className="text-slate-400 font-semibold">+{(activeJobCluster.roles || []).length - 6} more</span>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Ranked Candidate Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[1100px] table-fixed">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-3 text-center align-middle w-[5%] min-w-[50px]">Rank</th>
                <th className="py-3.5 px-4 text-left align-middle w-[25%] min-w-[220px]">Applicant & ID</th>
                <th className="py-3.5 px-3 text-center align-middle w-[10%] min-w-[100px]">Readiness Score (%)</th>
                <th className="py-3.5 px-3 text-center align-middle w-[12%] min-w-[120px]">Classification</th>
                <th className="py-3.5 px-3 text-center align-middle w-[10%] min-w-[95px]">Total Experience</th>
                <th className="py-3.5 px-3 text-center align-middle w-[10%] min-w-[95px]">Key Certifications</th>
                <th className="py-3.5 px-3 text-center align-middle w-[14%] min-w-[140px]">Assessment Summary</th>
                <th className="py-3.5 px-3 text-center align-middle w-[14%] min-w-[140px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {!currentJobOrder ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500 font-medium">
                    <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center mx-auto mb-3 text-sky-600 shadow-2xs">
                      <Briefcase className="w-6 h-6" />
                    </div>
                    <p className="text-slate-900 font-black text-base mb-1">
                      No Foreign Job Order Selected
                    </p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                      Select an active foreign job order in Step 1 above to analyze candidate readiness, evaluation match scores, and trade family compatibility.
                    </p>
                  </td>
                </tr>
              ) : rankedCandidates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-medium">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-800 font-bold text-sm mb-1">
                      {pipelineScope === 'profiling'
                        ? "No candidates currently in 'Applicant Profiling' status for this job order."
                        : "No candidates found in the active pool for this job order."}
                    </p>
                    {pipelineScope === 'profiling' && applicants.length > 0 && (
                      <div className="text-slate-500 text-xs mt-1.5 max-w-md mx-auto">
                        <p>Found {applicants.length} active applicant(s) in other stages (e.g. Applicant Registration).</p>
                        <button
                          type="button"
                          onClick={() => setPipelineScope('all')}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#20637A] hover:bg-[#184F62] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
                        >
                          <span>Switch to All Active Pool ({applicants.length})</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
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

                  const mismatchInfo = getJobOrderMismatchInfo(candidate.applicant, currentJobOrder);

                  return (
                    <tr
                      key={candidate.applicant.id}
                      onClick={() => setActiveModalCandidate(candidate)}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                    >
                      {/* 1. Rank */}
                      <td className="py-4 px-3 text-center align-middle font-black text-slate-900 text-sm">
                        #{candidate.rank}
                      </td>

                      {/* 2. Applicant & ID */}
                      <td className="py-4 px-4 align-middle">
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
                              {!isApplicantInProfiling(candidate.applicant) && (
                                <span
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-300"
                                  title={`Current Pipeline Stage: ${candidate.applicant.status || 'Active Pool'} (Not yet in Profiling stage)`}
                                >
                                  {candidate.applicant.status || 'Active Pool'}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-slate-500 tracking-tight">
                              {applicantCode}
                            </p>
                            {mismatchInfo && (
                              <div
                                className="mt-1 flex items-start gap-1 px-1.5 py-0.5 rounded bg-amber-50/90 border border-amber-200/90 text-[10px] text-amber-900 leading-tight"
                                title="Notice: Candidate applied for a different job order or role upon registration. Recommended based on compatible background credentials, but not their original selection."
                              >
                                <AlertCircle className="w-3 h-3 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold text-amber-800">Job Order Mismatch:</span>{' '}
                                  <span>
                                    Applied for <strong>{mismatchInfo.chosenJobOrder || mismatchInfo.chosenRole || 'Different Order'}</strong> (not this Job Order). Recommended via allied qualifications, but applicant did not pick this order.
                                  </span>
                                </div>
                              </div>
                            )}
                            {candidate.genderCriteria?.isMismatch && (
                              <div
                                className="mt-1 flex items-start gap-1 px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-[10px] text-rose-900 leading-tight"
                                title={`Employer requires ${candidate.genderCriteria.required} Only.`}
                              >
                                <AlertCircle className="w-3 h-3 text-rose-600 flex-shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold text-rose-800">Gender Criteria:</span>{' '}
                                  <span>Requires <strong>{candidate.genderCriteria.required} Only</strong> (Applicant is {candidate.genderCriteria.candidate || 'unspecified'}).</span>
                                </div>
                              </div>
                            )}
                            {candidate.ageCriteria?.isMismatch && (
                              <div
                                className="mt-1 flex items-start gap-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10px] text-amber-900 leading-tight"
                                title={`Employer requires age between ${candidate.ageCriteria.minAge ?? 'any'} and ${candidate.ageCriteria.maxAge ?? 'any'} years old.`}
                              >
                                <AlertCircle className="w-3 h-3 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold text-amber-800">Age Range Discrepancy:</span>{' '}
                                  <span>
                                    Applicant is <strong>{candidate.ageCriteria.candidateAge ? `${candidate.ageCriteria.candidateAge} yrs` : 'age unknown'}</strong> (Requires {candidate.ageCriteria.minAge ?? '—'}&ndash;{candidate.ageCriteria.maxAge ?? '—'} yrs).
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 3. Readiness Score (%) */}
                      <td className="py-4 px-3 text-center align-middle">
                        <div className="inline-flex flex-col items-center">
                          <span className="font-black text-base text-slate-900 font-mono">
                            {candidate.readinessScore}%
                          </span>
                        </div>
                      </td>

                      {/* 4. Classification Badge (Option 2: 80% / 60%) */}
                      <td className="py-4 px-3 text-center align-middle">
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
                      <td className="py-4 px-3 text-center align-middle font-semibold text-slate-700">
                        {candidate.isFirstTimeApplicant ? (
                          <span className="text-[11px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            First-Time
                          </span>
                        ) : (
                          `${candidate.totalExperienceYears} yrs`
                        )}
                      </td>

                      {/* 6. Key Certifications */}
                      <td className="py-4 px-3 text-center align-middle font-semibold text-slate-700">
                        {candidate.certificationsCount === 0
                          ? 'None'
                          : candidate.certificationsCount === 1
                            ? '1 Cert'
                            : `${candidate.certificationsCount} Certs`}
                      </td>

                      {/* 7. Assessment Summary (Dynamic Baseline & Toggleable Taken Exams) */}
                      <td className="py-4 px-3 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const isExpanded = expandedExamApplicantIds.has(candidate.applicant.id);
                          return (
                            <div className="space-y-1.5 max-w-[240px] mx-auto text-left">
                              {/* General Assessment Baseline / Overview Card */}
                              <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-slate-50/80 border border-slate-200">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    Overall Exam Baseline
                                  </span>
                                  {candidate.hasRecordedAssessments ? (
                                    <span className="text-xs font-black text-slate-900 font-mono">
                                      {candidate.assessmentScore}% Avg
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                      Pending
                                    </span>
                                  )}
                                </div>

                                {/* Clearance Status Badge */}
                                <div>
                                  {candidate.clearanceStatus === 'cleared' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                                      <span>Fully Cleared ({candidate.takenExams.length} Passed)</span>
                                    </span>
                                  )}
                                  {candidate.clearanceStatus === 'pending_job_specific' && (
                                    <span
                                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
                                      title={`Pending mandated test: ${candidate.pendingJobSpecificTestNames.join(', ')}`}
                                    >
                                      <Clock className="w-3 h-3 text-amber-600" />
                                      <span>Job Exam Pending: {candidate.pendingJobSpecificTestNames[0]}</span>
                                    </span>
                                  )}
                                  {candidate.clearanceStatus === 'pending_general' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                      <Clock className="w-3 h-3 text-slate-500" />
                                      <span>Assessments Pending</span>
                                    </span>
                                  )}
                                  {candidate.clearanceStatus === 'failed' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                                      <AlertCircle className="w-3 h-3 text-red-600" />
                                      <span>Clearance Failed</span>
                                    </span>
                                  )}
                                </div>

                                {/* Interactive Toggle Button to View All Taken Exams */}
                                <button
                                  type="button"
                                  onClick={() => toggleExamExpanded(candidate.applicant.id)}
                                  className="w-full mt-0.5 flex items-center justify-between text-[10px] font-bold text-[#20637A] hover:text-[#184F62] bg-white hover:bg-sky-50/50 border border-sky-200/60 rounded px-2 py-1 transition-all cursor-pointer shadow-2xs"
                                >
                                  <span>
                                    {isExpanded
                                      ? 'Hide Taken Exams'
                                      : `View All Taken Exams (${candidate.takenExams.length})`}
                                  </span>
                                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                              </div>

                              {/* Expanded Taken Exams List */}
                              {isExpanded && (
                                <div className="p-2.5 bg-white rounded-lg border border-teal-200/80 shadow-xs space-y-2 animate-in fade-in duration-150">
                                  <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                                      All Taken Examinations ({candidate.takenExams.length})
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-medium">Recorded Scores</span>
                                  </div>

                                  {candidate.takenExams.length === 0 ? (
                                    <p className="text-[11px] text-slate-500 py-1 text-center italic">
                                      No examination records found for this applicant yet.
                                    </p>
                                  ) : (
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                      {candidate.takenExams.map((exam) => (
                                        <div
                                          key={exam.id}
                                          className="p-1.5 rounded bg-slate-50 border border-slate-150 text-[10px] space-y-0.5"
                                        >
                                          <div className="flex items-center justify-between gap-1">
                                            <span className="font-bold text-slate-800 truncate max-w-[140px]" title={exam.name}>
                                              {exam.name}
                                            </span>
                                            <span
                                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${exam.passed
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : 'bg-red-100 text-red-800'
                                                }`}
                                            >
                                              {exam.passed ? (
                                                <CheckCircle className="w-2.5 h-2.5 text-emerald-700" />
                                              ) : (
                                                <AlertCircle className="w-2.5 h-2.5 text-red-600" />
                                              )}
                                              <span>{exam.scoringType === 'pass_fail' ? (exam.passed ? 'PASS' : 'FAIL') : `${exam.score ?? 0}%`}</span>
                                            </span>
                                          </div>
                                          <div className="flex items-center justify-between text-[9px] text-slate-400">
                                            <span>
                                              Baseline: {exam.scoringType === 'pass_fail' ? 'Pass/Fail' : `≥ ${exam.passingScore}%`}
                                            </span>
                                            {typeof exam.weight === 'number' && exam.weight > 0 && (
                                              <span className="text-teal-700 font-medium">Weight: {exam.weight}%</span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Pending Job Specific Requirements Notice */}
                                  {candidate.pendingJobSpecificTestNames.length > 0 && (
                                    <div className="p-2 bg-amber-50/90 rounded border border-amber-200 text-[10px] text-amber-900 space-y-1">
                                      <p className="font-bold flex items-center gap-1 text-amber-800">
                                        <AlertCircle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                        <span>Mandated for this Job Order:</span>
                                      </p>
                                      <ul className="list-disc list-inside space-y-0.5 text-[9px] text-amber-800">
                                        {candidate.pendingJobSpecificTestNames.map((name, i) => (
                                          <li key={i}>
                                            <strong>{name}</strong> (Not yet taken by candidate)
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* 8. Row Actions: View Profile (Overlay), Review Details (Modal), & Endorse (Only for Profiling stage) */}
                      <td className="py-4 px-3 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-center justify-center gap-1.5 w-full">
                          <button
                            onClick={() => handleOpenProfileOverlay(candidate.applicant)}
                            className="w-[124px] py-1.5 px-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs rounded-lg transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
                            title="Open candidate profile in full overlay"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            <span className="whitespace-nowrap">View Profile</span>
                          </button>

                          <button
                            onClick={() => setActiveModalCandidate(candidate)}
                            className="w-[124px] py-1.5 px-2 bg-[#20637A] hover:bg-[#184F62] text-white font-bold text-xs rounded-lg transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                            title="Inspect readiness breakdown and review for CV encoding"
                          >
                            <FileText className="w-3.5 h-3.5 text-white/90 flex-shrink-0" />
                            <span className="whitespace-nowrap">Review Details</span>
                          </button>

                          {/* Endorse Button: Strictly available ONLY for candidates in the 'Applicant Profiling' stage */}
                          {isApplicantInProfiling(candidate.applicant) && candidate.classification !== 'Not Recommended' && (
                            <button
                              onClick={() => handleEndorseCandidate(candidate)}
                              disabled={!candidate.compliancePassed || candidate.expiredDocs.length > 0}
                              className="w-[124px] py-1.5 px-2 bg-[#10B981] hover:bg-[#059669] text-white font-bold text-xs rounded-lg transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={
                                !candidate.compliancePassed || candidate.expiredDocs.length > 0
                                  ? 'Endorsement blocked: Candidate has expired document(s)'
                                  : 'Endorse candidate directly to CV Encoding'
                              }
                            >
                              <Send className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="whitespace-nowrap">Endorse</span>
                            </button>
                          )}

                          {/* Return Phase Button: Strictly available for candidates in the 'Applicant Profiling' stage */}
                          {isApplicantInProfiling(candidate.applicant) && (
                            <button
                              onClick={() => {
                                setCandidateToReturn(candidate.applicant);
                              }}
                              className="w-[124px] py-1.5 px-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs rounded-lg transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
                              title="Return candidate to Medical Clearance (Phase 2) or Initial Screening (Phase 1)"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                              <span className="whitespace-nowrap">Return Phase</span>
                            </button>
                          )}
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
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full p-6 overflow-hidden animate-in zoom-in-95 duration-150"
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadProfilingPDF(activeModalCandidate)}
                  disabled={isGeneratingPdf}
                  className="px-3 py-1.5 bg-[#20637A] hover:bg-[#184F62] text-white font-bold text-xs rounded-lg transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  title="Download official candidate profiling evaluation report (PDF)"
                >
                  {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  <span>Export PDF</span>
                </button>
                <button
                  onClick={() => setActiveModalCandidate(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="py-4 space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              {/* Job Order Preference Mismatch Notice Banner */}
              {(() => {
                const modalMismatch = getJobOrderMismatchInfo(activeModalCandidate.applicant, currentJobOrder);
                if (!modalMismatch) return null;
                return (
                  <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5 shadow-2xs">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                        <span>Notice: Job Order Preference Mismatch (Candidate Picked Different Role)</span>
                      </p>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        This applicant originally applied for <strong>{modalMismatch.chosenJobOrder || modalMismatch.chosenRole || 'a different job order/position'}</strong>, rather than <strong>{currentJobOrder?.position} (#{currentJobOrder?.id})</strong>. Even though the candidate has a strong readiness score ({activeModalCandidate.readinessScore}%) based on their qualifications and related trade experience, note that this candidate did not select this specific job order when they registered. Please verify with the candidate if they are willing to be considered for this employer and position.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Active Pool Candidate Pre-Profiling Notice */}
              {!isApplicantInProfiling(activeModalCandidate.applicant) && (
                <div className="p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 flex items-start gap-2.5 shadow-2xs">
                  <Info className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900 text-xs">
                      Active Pool Candidate — Pre-Profiling Stage ({activeModalCandidate.applicant.status || 'Active Pool'})
                    </p>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      This candidate is currently in the <strong>'{activeModalCandidate.applicant.status || 'Active Pool'}'</strong> pipeline. You can review their readiness evaluation, examination records, and document compliance; however, official endorsement to CV Encoding is restricted until the applicant advances to the <strong>Applicant Profiling</strong> stage.
                    </p>
                  </div>
                </div>
              )}

              {/* Employer Demographic Requirement Mismatch Banner */}
              {(activeModalCandidate.genderCriteria?.isMismatch || activeModalCandidate.ageCriteria?.isMismatch) && (
                <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-950 flex items-start gap-2.5 shadow-2xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-rose-900 text-xs">
                      Employer Demographic Requirement Notice
                    </p>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-rose-800">
                      {activeModalCandidate.genderCriteria?.isMismatch && (
                        <li>
                          <strong>Gender Requirement:</strong> Employer specifically requires{' '}
                          <strong>{activeModalCandidate.genderCriteria.required} Only</strong>. The candidate is recorded as{' '}
                          <strong>{activeModalCandidate.genderCriteria.candidate || 'Unspecified'}</strong>.
                        </li>
                      )}
                      {activeModalCandidate.ageCriteria?.isMismatch && (
                        <li>
                          <strong>Age Range Requirement:</strong> Employer requested ages{' '}
                          <strong>
                            {activeModalCandidate.ageCriteria.minAge ? `${activeModalCandidate.ageCriteria.minAge}` : 'Any'} to{' '}
                            {activeModalCandidate.ageCriteria.maxAge ? `${activeModalCandidate.ageCriteria.maxAge} yrs` : 'Any'}
                          </strong>
                          . The candidate is currently{' '}
                          <strong>
                            {activeModalCandidate.ageCriteria.candidateAge
                              ? `${activeModalCandidate.ageCriteria.candidateAge} years old`
                              : 'age unrecorded'}
                          </strong>
                          .
                        </li>
                      )}
                    </ul>
                    <p className="text-[10px] text-rose-700 italic">
                      Please confirm with the hiring principal / employer if an exception can be granted before endorsing this applicant.
                    </p>
                  </div>
                </div>
              )}

              {/* Job-Order Readiness Score Card */}
              <div className="p-4 rounded-xl border bg-slate-50/70 border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Job-Order Readiness Score</span>
                  <span className="font-mono font-black text-2xl text-slate-900">{activeModalCandidate.readinessScore}%</span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${activeModalCandidate.classification === 'Recommended'
                      ? 'bg-[#10B981] text-white'
                      : activeModalCandidate.classification === 'For Further Review'
                        ? 'bg-[#F59E0B] text-slate-950'
                        : 'bg-[#EF4444] text-white'
                      }`}
                  >
                    {activeModalCandidate.classification}
                  </span>
                  <span className="text-xs text-slate-500">
                    {!activeModalCandidate.hasRecordedAssessments && 'Candidate background qualifies, but examination assessments are pending.'}
                    {activeModalCandidate.hasRecordedAssessments && !activeModalCandidate.allGatesPass && 'Exam clearance blocked: candidate failed one or more mandatory examination gates.'}
                    {activeModalCandidate.hasRecordedAssessments && activeModalCandidate.allGatesPass && activeModalCandidate.classification === 'Recommended' && 'Exceeds 90% readiness threshold and passed all examination checks.'}
                    {activeModalCandidate.hasRecordedAssessments && activeModalCandidate.allGatesPass && activeModalCandidate.classification === 'For Further Review' && 'Meets 75%-89% readiness threshold for recruiter review.'}
                    {activeModalCandidate.hasRecordedAssessments && activeModalCandidate.allGatesPass && activeModalCandidate.classification === 'Not Recommended' && 'Below 75% readiness threshold for this position.'}
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
                          className={`p-1 rounded-full transition-colors cursor-pointer ${expandedCategoryHelp === 'roleMatch'
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
                          className={`p-1 rounded-full transition-colors cursor-pointer ${expandedCategoryHelp === 'certifications'
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
                          className={`p-1 rounded-full transition-colors cursor-pointer ${expandedCategoryHelp === 'experience'
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
                          className={`p-1 rounded-full transition-colors cursor-pointer ${expandedCategoryHelp === 'skills'
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
                          className={`p-1 rounded-full transition-colors cursor-pointer ${expandedCategoryHelp === 'overseas'
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

              {/* Dynamic Examination Clearance Gates */}
              <div className="p-4 rounded-xl border bg-slate-50/70 border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Examination Assessment Gates ({activeModalCandidate.activeTestResults?.length || 0} Dynamic Gates)
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Configured via Agency Evaluation Standards
                  </span>
                </div>

                {/* Job-Specific Pending Warning Banner */}
                {activeModalCandidate.pendingJobSpecificTestNames.length > 0 && (() => {
                  const mismatch = getJobOrderMismatchInfo(activeModalCandidate.applicant, currentJobOrder);
                  return (
                    <div className="mb-3.5 p-3.5 bg-amber-50/90 border border-amber-300 rounded-xl text-xs text-amber-900 shadow-2xs">
                      <div className="flex items-start gap-2.5">
                        <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="space-y-1.5 w-full">
                          <p className="font-bold text-amber-950 text-xs">
                            Mandatory Job-Order Specific Examination Required
                          </p>
                          <p className="text-[11px] text-amber-800 leading-relaxed">
                            {mismatch ? (
                              <>
                                This candidate originally applied for <strong>{mismatch.chosenJobOrder || mismatch.chosenRole || 'a different role'}</strong>, so they have not yet taken the employer-specific examination mandated specifically for <strong>{currentJobOrder?.position || 'this Job Order'}</strong> (#{currentJobOrder?.id || ''}).
                              </>
                            ) : (
                              <>
                                This job order mandates employer-specific testing that this candidate has not yet taken.
                              </>
                            )}
                          </p>
                          <div className="p-2 bg-white/90 rounded-lg border border-amber-200">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800 mb-0.5">Required Test(s):</p>
                            <ul className="list-disc list-inside space-y-0.5 text-[11px] font-bold text-slate-800">
                              {activeModalCandidate.pendingJobSpecificTestNames.map((name, i) => (
                                <li key={i}>{name}</li>
                              ))}
                            </ul>
                          </div>
                          <p className="text-[10px] text-amber-700 italic">
                            Candidate background qualifies ({activeModalCandidate.readinessScore}% readiness), but final deployment endorsement requires administering and passing the required test(s) listed above.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {activeModalCandidate.activeTestResults?.map((t) => {
                    const isPending = Boolean(t.isPendingMandate || (t.score === undefined && t.isJobSpecific));
                    return (
                      <div
                        key={t.id}
                        className={`p-2.5 rounded-lg border transition-all ${isPending
                          ? 'bg-amber-50/60 border-amber-200'
                          : 'bg-white border-slate-200'
                          }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-slate-700 font-medium truncate max-w-[140px]" title={t.name}>{t.name}</p>
                          {t.isJobSpecific && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${isPending
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}>
                              Job-Specific
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          {isPending ? (
                            <>
                              <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                Pending Exam
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                Required for Role
                              </span>
                            </>
                          ) : (
                            <>
                              <p className="font-bold text-slate-900 text-sm">
                                {t.scoringType === 'pass_fail' ? (t.passed ? 'PASSED' : 'FAILED') : `${t.score ?? 0}%`}
                              </p>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.passed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                                }`}>
                                {t.scoringType === 'pass_fail' ? 'Req: Pass' : `Req ≥ ${t.passingScore}%`}
                              </span>
                            </>
                          )}
                        </div>
                        {isPending && (
                          <p className="text-[9px] text-amber-700 mt-1 italic leading-tight">
                            Not yet taken. Candidate needs to take this test for this position.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Statutory Compliance Layer */}
              <div className="p-4 rounded-xl border bg-slate-50/70 border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Statutory Compliance Layer (DMW/POEA)</span>
                  <span
                    className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${activeModalCandidate.compliancePassed
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
                      className={`text-[11px] font-mono font-bold ${activeModalCandidate.medicalStatus.valid ? 'text-emerald-700' : 'text-red-600'
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
                      className={`text-[11px] font-mono font-bold ${activeModalCandidate.passportStatus.valid ? 'text-emerald-700' : 'text-red-600'
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
                      className={`text-[11px] font-mono font-bold ${activeModalCandidate.nbiStatus.valid ? 'text-emerald-700' : 'text-red-600'
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

            {/* Modal Actions Footer: Clean, unified-height (h-9) responsive layout */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Left Group: Dismiss & Return Candidate to Previous Phase */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModalCandidate(null)}
                  className="h-9 px-4 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs flex items-center justify-center"
                >
                  Close
                </button>

                {isApplicantInProfiling(activeModalCandidate.applicant) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCandidateToReturn(activeModalCandidate.applicant);
                    }}
                    className="h-9 px-3.5 border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Return candidate to Medical Clearance or Initial Screening"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                    <span>Return Candidate</span>
                  </button>
                )}
              </div>

              {/* Right Group: Profile Overlay and Informative Action / Status Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const applicant = activeModalCandidate.applicant;
                    setActiveModalCandidate(null);
                    handleOpenProfileOverlay(applicant);
                  }}
                  className="h-9 px-3.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
                  title="View full candidate profile in overlay"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-600" />
                  <span>Open Full Profile</span>
                </button>

                {!isApplicantInProfiling(activeModalCandidate.applicant) ? (
                  <div
                    className="h-9 px-3.5 flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 border border-slate-300 rounded-lg font-medium shadow-2xs whitespace-nowrap"
                    title={`Candidate current stage is '${activeModalCandidate.applicant.status || 'Active Pool'}'. The Endorse button is available only when the applicant is in the 'Applicant Profiling' stage.`}
                  >
                    <Info className="w-3.5 h-3.5 text-slate-500" />
                    <span>Stage: {activeModalCandidate.applicant.status || 'Active Pool'}</span>
                  </div>
                ) : activeModalCandidate.classification === 'Not Recommended' ? (
                  <div
                    className="h-9 px-3.5 flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg font-bold shadow-2xs whitespace-nowrap"
                    title="Candidate readiness score is below recommendation threshold. Address identified gaps or update qualifications before endorsing."
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                    <span>Not Ready for CV Encoding ({activeModalCandidate.readinessScore}% Match)</span>
                  </div>
                ) : !activeModalCandidate.compliancePassed || activeModalCandidate.expiredDocs.length > 0 ? (
                  <button
                    type="button"
                    disabled
                    className="h-9 px-3.5 bg-slate-100 border border-slate-300 text-slate-500 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-not-allowed shadow-2xs whitespace-nowrap"
                    title={`Endorsement Blocked: Candidate has expired document(s) (${activeModalCandidate.expiredDocs.map((d) => d.name).join(', ') || 'Statutory clearance issue'}). Renewal required.`}
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>Endorsement Blocked (Expired Docs)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleEndorseCandidate(activeModalCandidate)}
                    className="h-9 px-4 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
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

      {/* Return Candidate to Previous Phase Modal Dialog */}
      {candidateToReturn && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => !isSubmittingReturn && setCandidateToReturn(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-base">
                    Return Candidate to Previous Stage
                  </h4>
                  <p className="text-xs text-slate-500">
                    {candidateToReturn.name} ({candidateToReturn.applicantCode || `#APP-${candidateToReturn.id}`})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isSubmittingReturn && setCandidateToReturn(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReturnCandidate} className="py-4 space-y-4">
              {/* Target Stage Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Select Target Stage to Return To <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                      returnTargetStage === 'medical'
                        ? 'border-sky-500 bg-sky-50/60 text-sky-950 ring-1 ring-sky-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <input
                        type="radio"
                        name="returnTarget"
                        checked={returnTargetStage === 'medical'}
                        onChange={() => {
                          setReturnTargetStage('medical');
                          setReturnCategory('Medical / Fitness Clearance Issue');
                        }}
                        className="text-sky-600 focus:ring-sky-500"
                      />
                      <span>Fit-to-Work (Medical Clearance)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug pl-5">
                      Return to Medical Admin for clinic follow-up, repeat lab test, or fitness re-clearance.
                    </p>
                  </label>

                  <label
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                      returnTargetStage === 'screening'
                        ? 'border-sky-500 bg-sky-50/60 text-sky-950 ring-1 ring-sky-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <input
                        type="radio"
                        name="returnTarget"
                        checked={returnTargetStage === 'screening'}
                        onChange={() => {
                          setReturnTargetStage('screening');
                          setReturnCategory('Trade Qualification / Skill Discrepancy');
                        }}
                        className="text-sky-600 focus:ring-sky-500"
                      />
                      <span>Initial Screening</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug pl-5">
                      Return to Screening Panel for interview re-assessment, trade qualification, or credential update.
                    </p>
                  </label>
                </div>
              </div>

              {/* Return Category */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Return Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={returnCategory}
                  onChange={(e) => setReturnCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#20637A]/30 focus:border-[#20637A]"
                >
                  {returnTargetStage === 'medical' ? (
                    <>
                      <option value="Medical / Fitness Clearance Issue">Medical / Fitness Clearance Issue</option>
                      <option value="Clinic Laboratory Re-test Required">Clinic Laboratory Re-test Required</option>
                      <option value="Expired Medical Certificate">Expired Medical Certificate</option>
                      <option value="Candidate Reported Medical Condition">Candidate Reported Medical Condition</option>
                      <option value="Other Medical Requirement">Other Medical Requirement</option>
                    </>
                  ) : (
                    <>
                      <option value="Trade Qualification / Skill Discrepancy">Trade Qualification / Skill Discrepancy</option>
                      <option value="Missing Mandatory Credential / License">Missing Mandatory Credential / License</option>
                      <option value="Interview Score Re-evaluation">Interview Score Re-evaluation</option>
                      <option value="Candidate Application Retraction / Change Role">Candidate Application Retraction / Change Role</option>
                      <option value="Document Discrepancy / Inconsistency">Document Discrepancy / Inconsistency</option>
                      <option value="Other Screening Note">Other Screening Note</option>
                    </>
                  )}
                </select>
              </div>

              {/* Detailed Reason Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Return Instructions & Remarks <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="State specific instructions for the receiving department/handler..."
                  rows={3}
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#20637A]/30 focus:border-[#20637A]"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => !isSubmittingReturn && setCandidateToReturn(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReturn || !returnNotes.trim()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingReturn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  <span>Confirm Return to {returnTargetStage === 'medical' ? 'Medical Clearance' : 'Initial Screening'}</span>
                </button>
              </div>
            </form>
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
