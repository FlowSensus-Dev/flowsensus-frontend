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
  Download,
  Building2,
  ChevronDown,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { ApplicantRecord, ActivityLog, WorkflowState } from '../../types';
import { api } from '../../../lib/api';
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
    return jobOrders.find((j) => String(j.realId) === String(selectedJobOrderId)) || jobOrders[0] || null;
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
    return applicants.filter((a) => {
      if (a.isStopped || a.status === 'Processing Stopped') return false;
      if (pipelineScope === 'profiling') {
        return isApplicantInProfiling(a);
      }
      if (pipelineScope === 'assigned') {
        const assignedJoId = (a as any).job_order_id || (a as any).assignedJobOrderId;
        return String(assignedJoId) === String(selectedJobOrderId);
      }
      // 'all': Active applicants in the agency pool eligible for cross-order evaluation
      return true;
    });
  }, [applicants, pipelineScope, selectedJobOrderId]);

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
    if (!currentJobOrder || eligibleCandidates.length === 0) return [];

    const jobPos = (currentJobOrder.position || '').trim();
    const jobCountry = (currentJobOrder.country || '').trim();
    const minYears = Number(currentJobOrder.minExperience || 1);

    const targetClusterInfo = findClusterForText(jobPos, dynamicClusters);
    const targetClusterId = targetClusterInfo?.id;
    const targetClusterData = targetClusterInfo?.data;

    // Cross-job-order requirements: Identify evaluation templates specifically required for this active Job Order
    const joRealId = String(currentJobOrder.id).trim();
    const joCode = String(currentJobOrder.code || '').trim().toLowerCase();
    const joPosLower = jobPos.toLowerCase();

    const currentJobOrderSpecificTemplates = activeJobEvaluationTemplates.filter((t: any) => {
      const app = t.applicable_job_orders || t.applicableJobOrders;
      if (!Array.isArray(app) || app.length === 0) return false;
      return app.some((target: any) => {
        const s = String(target).trim().toLowerCase();
        return s === joRealId || s === `jo-${joRealId}` || s === joCode || joCode.includes(s) || s === joPosLower || joPosLower.includes(s);
      });
    });

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

      // Three-tier analytical classification per UC-03 Option 2 (80% / 60%)
      let classification: 'Recommended' | 'For Further Review' | 'Not Recommended';
      const failureReasons: string[] = [];

      if (clearanceStatus === 'failed') {
        // Candidate failed one or more recorded examination gates
        classification = 'Not Recommended';
        failedExamDescriptions.forEach((d) => failureReasons.push(`Failed assessment requirement: ${d}`));
      } else if (clearanceStatus === 'pending_job_specific') {
        // High Job-Fit credentials are preserved! Candidate is placed in 'For Further Review'
        // pending administration of this employer's custom job-order test.
        classification = 'For Further Review';
        failureReasons.push(
          `Job-Order Specific Exam pending: Candidate must complete "${pendingJobSpecificTestNames.join(', ')}" mandated for ${jobPos} before final endorsement.`
        );
      } else if (clearanceStatus === 'pending_general') {
        // Candidate qualifications qualify for review, but general examination assessments are pending
        classification = 'For Further Review';
        failureReasons.push('Assessment examination clearance pending (candidate has not yet completed evaluation testing)');
      } else if (readinessScore >= 80) {
        classification = 'Recommended';
      } else if (readinessScore >= 60) {
        classification = 'For Further Review';
      } else {
        classification = 'Not Recommended';
      }

      if (readinessScore < 60 && !failureReasons.some((r) => r.includes('Readiness score'))) {
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

  // Handler: Generate and download official Candidate Profiling Evaluation Report as PDF
  // CRITICAL CONSTRAINT: Uses the dynamic agency name and POEA license from Supabase with ZERO FlowSensus branding
  const handleDownloadProfilingPDF = (candidate: RankedCandidate) => {
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const agencyName = (agencyProfile?.agency_name || 'LICENSED OVERSEAS RECRUITMENT AGENCY').toUpperCase();
      const poeaLicense = agencyProfile?.poea_license_no
        ? `POEA/DMW License: ${agencyProfile.poea_license_no}`
        : 'POEA / DMW Accredited Overseas Placement Agency';
      const applicant = candidate.applicant;
      const appName = applicant.name || `${(applicant as any).first_name || ''} ${(applicant as any).last_name || ''}`.trim() || 'Candidate';
      const appCode = applicant.applicantCode || (applicant.id ? `APP-${String(applicant.id).padStart(5, '0')}` : 'N/A');
      const targetPos = currentJobOrder?.position || 'Target Position';
      const targetJoId = currentJobOrder?.id || 'N/A';
      const targetEmployer = currentJobOrder?.employer || 'Foreign Principal Partner';
      const targetCountry = currentJobOrder?.country || 'International';

      const pageWidth = 210;
      const margin = 14;
      const contentWidth = pageWidth - (margin * 2);
      let y = 14;

      const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > 275) {
          doc.addPage();
          y = 15;
          renderHeaderBar(true);
        }
      };

      const renderHeaderBar = (isContinuation = false) => {
        // Top Banner with Agency Brand (NO FlowSensus)
        doc.setFillColor(30, 58, 75); // Professional Navy/Teal #1E3A4B
        doc.rect(margin, y, contentWidth, isContinuation ? 10 : 20, 'F');

        doc.setTextColor(255, 255, 255);
        if (isContinuation) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.text(`${agencyName} — Candidate Profiling Evaluation (Continued)`, margin + 4, y + 6.5);
          y += 14;
        } else {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.text(agencyName, margin + 5, y + 8);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(203, 213, 225); // Slate 300
          doc.text(poeaLicense, margin + 5, y + 13);
          doc.text('Official Evaluation Document • Confidential', pageWidth - margin - 5, y + 13, { align: 'right' });
          y += 24;
        }
      };

      renderHeaderBar(false);

      // Document Title
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('CANDIDATE PROFILING & JOB-FIT EVALUATION REPORT', margin, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      const evalDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      doc.text(`Evaluation Date: ${evalDate} | Evaluated By: ${currentUserName || 'Evaluating Officer'}`, margin, y + 4.5);
      y += 9;

      // Section: Candidate & Target Job Order Summary Box
      checkPageBreak(38);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, contentWidth, 34, 2, 2, 'FD');

      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('CANDIDATE IDENTIFICATION', margin + 4, y + 5);
      doc.text('TARGET FOREIGN JOB ORDER', margin + (contentWidth / 2) + 4, y + 5);

      // Left Column: Candidate Info
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(appName, margin + 4, y + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Applicant Code: ${appCode}`, margin + 4, y + 14.5);
      doc.text(`Applied Role: ${applicant.appliedRole || (applicant as any).applied_role || (applicant as any).position || 'General Applicant'}`, margin + 4, y + 19);
      doc.text(`Verified Experience: ${candidate.totalExperienceYears} Year(s)${candidate.isFirstTimeApplicant ? ' (First-Time Track)' : ''}`, margin + 4, y + 23.5);
      doc.text(`Certifications on File: ${candidate.certificationsCount} Credential(s)`, margin + 4, y + 28);

      // Right Column: Target Job Order Info
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`${targetPos} (${targetJoId})`, margin + (contentWidth / 2) + 4, y + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Foreign Principal: ${targetEmployer}`, margin + (contentWidth / 2) + 4, y + 14.5);
      doc.text(`Destination Country: ${targetCountry}`, margin + (contentWidth / 2) + 4, y + 19);
      doc.text(`Required Experience: ${currentJobOrder?.minExperience || 1} Year(s)`, margin + (contentWidth / 2) + 4, y + 23.5);
      doc.text(`Pipeline Status: ${applicant.status || 'Active'}`, margin + (contentWidth / 2) + 4, y + 28);

      y += 38;

      // Section: Overall Readiness & Classification Scorecard
      checkPageBreak(24);
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('READINESS SCORE', margin + 6, y + 5.5);
      doc.text('ANALYTICAL CLASSIFICATION', margin + 55, y + 5.5);
      doc.text('STATUTORY CLEARANCE (DMW/POEA)', margin + 115, y + 5.5);

      // Readiness Score Value
      doc.setFontSize(14);
      doc.setTextColor(30, 58, 75);
      doc.text(`${candidate.readinessScore}%`, margin + 6, y + 14);

      // Classification Badge
      doc.setFontSize(10);
      if (candidate.classification === 'Recommended') {
        doc.setTextColor(16, 185, 129); // Emerald
        doc.text('RECOMMENDED', margin + 55, y + 13.5);
      } else if (candidate.classification === 'For Further Review') {
        doc.setTextColor(217, 119, 6); // Amber
        doc.text('FOR FURTHER REVIEW', margin + 55, y + 13.5);
      } else {
        doc.setTextColor(239, 68, 68); // Red
        doc.text('NOT RECOMMENDED', margin + 55, y + 13.5);
      }

      // Compliance
      doc.setFontSize(9);
      if (candidate.compliancePassed) {
        doc.setTextColor(16, 185, 129);
        doc.text('PASSED (All Clear)', margin + 115, y + 13.5);
      } else {
        doc.setTextColor(239, 68, 68);
        doc.text('ACTION REQUIRED', margin + 115, y + 13.5);
      }

      y += 24;

      const pdfMismatch = getJobOrderMismatchInfo(candidate.applicant, currentJobOrder);
      if (pdfMismatch) {
        checkPageBreak(14);
        doc.setFillColor(254, 243, 199);
        doc.setDrawColor(245, 158, 11);
        doc.roundedRect(margin, y, contentWidth, 10, 1, 1, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(146, 64, 14);
        doc.text('JOB ORDER PREFERENCE NOTICE:', margin + 3, y + 4);
        doc.setFont('helvetica', 'normal');
        doc.text(
          doc.splitTextToSize(
            `Applicant applied for ${pdfMismatch.chosenJobOrder || pdfMismatch.chosenRole || 'different order'} (not this Job Order). Recommended via allied qualifications.`,
            contentWidth - 65
          ),
          margin + 58,
          y + 4
        );
        y += 13;
      }

      // Section: 5-Category Granular Scoring Breakdown
      checkPageBreak(75);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('JOB-ORDER READINESS BREAKDOWN (5 CRITICAL PILLARS)', margin, y);
      y += 5;

      const categories = [
        {
          num: '1',
          name: 'Role & Trade Match',
          score: candidate.categoryScores.roleMatch,
          max: 30,
          expl: getCategoryCandidateExplanation('roleMatch', candidate, currentJobOrder),
        },
        {
          num: '2',
          name: 'Required Certifications',
          score: candidate.categoryScores.certifications,
          max: 25,
          expl: getCategoryCandidateExplanation('certifications', candidate, currentJobOrder),
        },
        {
          num: '3',
          name: candidate.isFirstTimeApplicant ? 'Institutional TVET / Education Foundation' : 'Work Experience Duration',
          score: candidate.categoryScores.experience,
          max: 20,
          expl: getCategoryCandidateExplanation('experience', candidate, currentJobOrder),
        },
        {
          num: '4',
          name: 'Trade Skills & Competencies',
          score: candidate.categoryScores.skills,
          max: 15,
          expl: getCategoryCandidateExplanation('skills', candidate, currentJobOrder),
        },
        {
          num: '5',
          name: 'Overseas Deployment Readiness',
          score: candidate.categoryScores.overseas,
          max: 10,
          expl: getCategoryCandidateExplanation('overseas', candidate, currentJobOrder),
        },
      ];

      categories.forEach((cat) => {
        const textLines = doc.splitTextToSize(cat.expl, contentWidth - 42);
        const itemHeight = Math.max(12, 6 + (textLines.length * 3.5));
        checkPageBreak(itemHeight + 2);

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, y, contentWidth, itemHeight, 1, 1, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text(`${cat.num}. ${cat.name}`, margin + 3, y + 4.5);

        // Score
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 58, 75);
        doc.text(`${cat.score} / ${cat.max} pts`, pageWidth - margin - 3, y + 4.5, { align: 'right' });

        // Explanation text
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(textLines, margin + 3, y + 8.5);

        y += itemHeight + 2;
      });

      y += 2;

      // Section: Examination & Assessment Gates
      checkPageBreak(30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('EXAMINATION & CLEARANCE GATES', margin, y);
      y += 5;

      const dynamicGates = (candidate.activeTestResults && candidate.activeTestResults.length > 0)
        ? candidate.activeTestResults.map((t) => ({
            label: t.name,
            val: t.scoringType === 'pass_fail' ? (t.passed ? 'PASSED' : 'FAILED') : `${t.score ?? 0}%`,
            req: t.scoringType === 'pass_fail' ? 'Req: Pass' : `Req: >= ${t.passingScore}%`,
          }))
        : [
            { label: 'Trade Skills Test', val: `${candidate.techScore}%`, req: `Req: >= ${dynamicGateDefinitions.skillsTpl.passingScore}%` },
            { label: 'IQ / Aptitude Test', val: `${candidate.iqScore}%`, req: `Req: >= ${dynamicGateDefinitions.iqTpl.passingScore}%` },
            { label: 'Interview / Language', val: `${candidate.interviewScore}%`, req: `Req: >= ${dynamicGateDefinitions.langTpl.passingScore}%` },
            { label: 'Personality / EQ Gate', val: candidate.eqStatus, req: dynamicGateDefinitions.eqTpl.scoringType === 'pass_fail' ? 'Req: Suitable' : `Req: >= ${dynamicGateDefinitions.eqTpl.passingScore}%` },
          ];

      const gateCols = Math.min(4, Math.max(1, dynamicGates.length));
      const colW = contentWidth / gateCols;
      const numRows = Math.ceil(dynamicGates.length / 4);
      const boxHeight = numRows * 16;
      checkPageBreak(boxHeight + 8);

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, contentWidth, boxHeight, 1.5, 1.5, 'FD');

      dynamicGates.forEach((g, idx) => {
        const row = Math.floor(idx / 4);
        const col = idx % 4;
        const xPos = margin + (col * colW) + 3;
        const rowY = y + (row * 16);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        const truncatedLabel = g.label.length > 20 ? `${g.label.slice(0, 18)}...` : g.label;
        doc.text(truncatedLabel, xPos, rowY + 4.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(g.val, xPos, rowY + 9.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text(g.req, xPos, rowY + 13.5);
      });

      y += boxHeight + 4;

      // Section: Statutory Documents Audit
      checkPageBreak(25);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('STATUTORY REGULATORY CLEARANCES (DMW / POEA)', margin, y);
      y += 5;

      const statDocs = [
        { name: 'Passport Validity', status: candidate.passportStatus.status, valid: candidate.passportStatus.valid },
        { name: 'NBI Clearance', status: candidate.nbiStatus.status, valid: candidate.nbiStatus.valid },
        { name: 'Medical Clearance', status: candidate.medicalStatus.status, valid: candidate.medicalStatus.valid },
      ];

      statDocs.forEach((sd) => {
        checkPageBreak(7);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text(`• ${sd.name}:`, margin + 2, y + 3.5);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(sd.valid ? 22 : 220, sd.valid ? 101 : 38, sd.valid ? 52 : 38);
        doc.text(sd.status, margin + 45, y + 3.5);
        y += 5;
      });

      // Section: Strengths & Identified Gaps
      if (candidate.strengths.length > 0 || candidate.gaps.length > 0) {
        y += 2;
        checkPageBreak(30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text('EVALUATION FINDINGS (STRENGTHS & GAPS)', margin, y);
        y += 5;

        if (candidate.strengths.length > 0) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(16, 185, 129);
          doc.text('Candidate Strengths:', margin + 2, y + 3.5);
          y += 5;

          candidate.strengths.forEach((str) => {
            const lines = doc.splitTextToSize(`✓ ${str}`, contentWidth - 8);
            checkPageBreak(lines.length * 4 + 1);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(51, 65, 85);
            doc.text(lines, margin + 4, y + 3);
            y += (lines.length * 3.5) + 1.5;
          });
        }

        if (candidate.gaps.length > 0) {
          y += 2;
          checkPageBreak(15);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(217, 119, 6);
          doc.text('Identified Gaps & Action Items:', margin + 2, y + 3.5);
          y += 5;

          candidate.gaps.forEach((gap) => {
            const lines = doc.splitTextToSize(`! ${gap}`, contentWidth - 8);
            checkPageBreak(lines.length * 4 + 1);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text(lines, margin + 4, y + 3);
            y += (lines.length * 3.5) + 1.5;
          });
        }
      }

      // Official Certification & Signatures Box
      y += 4;
      checkPageBreak(28);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, y, contentWidth, 24, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(
        'I hereby certify that this candidate profiling report reflects verified credentials, skills assessments, and statutory compliance status pursuant to DMW and agency standards.',
        margin + 4,
        y + 4.5
      );

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('Evaluated & Certified By:', margin + 4, y + 12);
      doc.text('Endorsing Licensed Agency:', margin + (contentWidth / 2) + 4, y + 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(`${currentUserName || 'Recruitment Officer'}`, margin + 4, y + 17);
      doc.text(`${agencyName} (${agencyProfile?.poea_license_no || 'POEA Registered'})`, margin + (contentWidth / 2) + 4, y + 17);

      // Running page numbers & footer on every page
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, 285, pageWidth - margin, 285);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Official Evaluation Document • Issued by ${agencyName} • Strictly Confidential`,
          margin,
          289
        );
        doc.text(
          `Page ${i} of ${totalPages}`,
          pageWidth - margin,
          289,
          { align: 'right' }
        );
      }

      // Download file with clean name (strictly NO FlowSensus name)
      const sanitizedCandidate = appName.replace(/[^a-zA-Z0-9]/g, '_');
      const sanitizedAgency = agencyName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${sanitizedCandidate}_Profiling_Evaluation_${sanitizedAgency}.pdf`;

      doc.save(filename);
      showToast(`✓ Evaluation report downloaded: ${filename}`);
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
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black inline-flex items-center justify-center">
                  2
                </span>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">
                  Step 2: Ranked Candidate Shortlist for {currentJobOrder?.position || 'Job Order'} #{currentJobOrder?.id || ''}
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

              {/* Pipeline Scope Filter & Dynamic DB Clusters Indicator */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setPipelineScope('profiling')}
                    className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      pipelineScope === 'profiling'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Applicant Profiling Stage ({applicants.filter((a) => !a.isStopped && isApplicantInProfiling(a)).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPipelineScope('all')}
                    className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      pipelineScope === 'all'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Active Pool ({applicants.filter((a) => !a.isStopped && a.status !== 'Processing Stopped').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPipelineScope('assigned')}
                    className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      pipelineScope === 'assigned'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Assigned to Job Order
                  </button>
                </div>

                {Object.keys(dynamicClusters).length > 0 && (
                  <span className="text-[11px] text-slate-600 font-medium bg-slate-50 border border-slate-200 px-2 py-1 rounded-md flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>{Object.keys(dynamicClusters).length} Recognized Trade Families</span>
                  </span>
                )}
              </div>

              {/* Allied Trade Recognition Active Tag & Informative Description */}
              {isSynthesizingCluster ? (
                <div className="mt-3 p-3 bg-teal-50/60 rounded-xl border border-teal-200/60 flex items-center gap-2 text-xs text-teal-800">
                  <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                  <span>Matching allied job titles and skills for {currentJobOrder?.position || 'this position'}...</span>
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

                      {/* 7. Assessment Summary (Dynamic Baseline & Toggleable Taken Exams) */}
                      <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const isExpanded = expandedExamApplicantIds.has(candidate.applicant.id);
                          return (
                            <div className="space-y-2 min-w-[240px]">
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
                                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                exam.passed
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

                          {/* Endorse Button: Strictly available ONLY for candidates in the 'Applicant Profiling' stage */}
                          {isApplicantInProfiling(candidate.applicant) && candidate.classification !== 'Not Recommended' && (
                            <button
                              onClick={() => handleEndorseCandidate(candidate)}
                              disabled={!candidate.compliancePassed || candidate.expiredDocs.length > 0}
                              className="px-3.5 py-1.5 bg-[#10B981] hover:bg-[#059669] text-white font-bold text-xs rounded-lg transition-colors shadow-sm cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={
                                !candidate.compliancePassed || candidate.expiredDocs.length > 0
                                  ? 'Endorsement blocked: Candidate has expired document(s)'
                                  : 'Endorse candidate directly to CV Encoding'
                              }
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Endorse</span>
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
                    {!activeModalCandidate.hasRecordedAssessments && 'Candidate background qualifies, but examination assessments are pending.'}
                    {activeModalCandidate.hasRecordedAssessments && !activeModalCandidate.allGatesPass && 'Exam clearance blocked: candidate failed one or more mandatory examination gates.'}
                    {activeModalCandidate.hasRecordedAssessments && activeModalCandidate.allGatesPass && activeModalCandidate.classification === 'Recommended' && 'Exceeds 80% readiness threshold and passed all examination checks.'}
                    {activeModalCandidate.hasRecordedAssessments && activeModalCandidate.allGatesPass && activeModalCandidate.classification === 'For Further Review' && 'Meets 60%-79% readiness threshold for recruiter review.'}
                    {activeModalCandidate.hasRecordedAssessments && activeModalCandidate.allGatesPass && activeModalCandidate.classification === 'Not Recommended' && 'Below 60% readiness threshold for this position.'}
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
                        className={`p-2.5 rounded-lg border transition-all ${
                          isPending
                            ? 'bg-amber-50/60 border-amber-200'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-slate-700 font-medium truncate max-w-[140px]" title={t.name}>{t.name}</p>
                          {t.isJobSpecific && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                              isPending
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
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                t.passed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
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

            {/* Modal Actions: Open Full Profile, Download PDF, Close, and Endorse to CV Encoding */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const applicant = activeModalCandidate.applicant;
                    setActiveModalCandidate(null);
                    handleOpenProfileOverlay(applicant);
                  }}
                  className="px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="View full candidate profile in overlay"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-600" />
                  <span>Open Full Profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadProfilingPDF(activeModalCandidate)}
                  disabled={isGeneratingPdf}
                  className="px-3.5 py-2 border border-[#20637A] text-[#20637A] hover:bg-teal-50/50 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                  title="Download official candidate profiling evaluation report (PDF)"
                >
                  {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  <span>Download Evaluation Report (PDF)</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveModalCandidate(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>

                {!isApplicantInProfiling(activeModalCandidate.applicant) ? (
                  <div
                    className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 border border-slate-300 px-3.5 py-2 rounded-lg font-medium shadow-2xs"
                    title={`Candidate current stage is '${activeModalCandidate.applicant.status || 'Active Pool'}'. The Endorse button is available only when the applicant is in the 'Applicant Profiling' stage.`}
                  >
                    <Info className="w-3.5 h-3.5 text-slate-500" />
                    <span>Endorsement Available Only in Profiling Stage ({activeModalCandidate.applicant.status || 'Active Pool'})</span>
                  </div>
                ) : activeModalCandidate.classification === 'Not Recommended' ? (
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
