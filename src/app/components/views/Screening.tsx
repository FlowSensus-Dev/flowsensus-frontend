import { useState, useEffect, useRef, useMemo } from 'react';
import api from '../../../lib/api';
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
  RotateCcw
} from 'lucide-react';
import { WorkflowState, ActivityLog, ApplicantRecord } from '../../types';

interface ScreeningProps {
  workflow: WorkflowState;
  updateWorkflow: (updates: Partial<WorkflowState>) => void;
  showToast: (message: string) => void;
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  updateApplicant: (applicantId: string, updates: Partial<ApplicantRecord>) => void;
  selectedApplicantId?: string;
  applicants?: ApplicantRecord[];
}

// Standardized Passing Criteria
const ENGLISH_PASS_SCORE = 60;
const TRADE_PASS_SCORE = 70;
const IQ_PASS_SCORE = 50;

const PARTNER_CLINICS = [
  'Makati Medical Center — Health Services Clinic',
  "St. Luke's Medical Center — Global City PEME Dept",
  'Cardinal Santos Medical Center — Wellness Clinic',
  'Physicians Diagnostic Services Center (PDS)',
  'American Outpatient Clinic — Ermita, Manila'
];

export default function Screening({
  workflow,
  updateWorkflow,
  showToast,
  currentUserName,
  addActivityLog,
  updateApplicant,
  selectedApplicantId: initialApplicantId = '1',
  applicants = [],
}: ScreeningProps) {
  const [selectedApplicantId, setSelectedApplicantId] = useState(initialApplicantId);
  const [listView, setListView] = useState(true);

  // Modals state
  const [showStopModal, setShowStopModal] = useState(false);
  const [stopReason, setStopReason] = useState('');
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState(PARTNER_CLINICS[0]);
  const [isGeneratingReferral, setIsGeneratingReferral] = useState(false);
  const [showUpdateStatusModal, setShowUpdateStatusModal] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showReviewScoreModal, setShowReviewScoreModal] = useState(false);

  // Local scores state
  const [examScores, setExamScores] = useState<{
    englishProficiency: number | string;
    tradeSkills: number | string;
    iqAptitude: number | string;
    personalityEQ: 'Suitable' | 'Not Suitable' | 'Pending';
    employerSpecific: string;
  }>({
    englishProficiency: '',
    tradeSkills: '',
    iqAptitude: '',
    personalityEQ: 'Pending',
    employerSpecific: '',
  });

  // Score correction modal local state
  const [reviewFormScores, setReviewFormScores] = useState({
    englishProficiency: 0,
    tradeSkills: 0,
    iqAptitude: 0,
    personalityEQ: 'Suitable' as 'Suitable' | 'Not Suitable' | 'Pending',
    employerSpecific: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [generatedReferralIds, setGeneratedReferralIds] = useState<Set<string>>(new Set());

  // ── Find currently selected applicant ───────────────────────────────────────
  const selectedApplicant = applicants.find(a => String(a.id) === String(selectedApplicantId)) || applicants[0];
  const initializedForApplicantId = useRef<string | null>(null);

  // Synchronize exam scores whenever active applicant changes
  useEffect(() => {
    if (selectedApplicant?.id !== initializedForApplicantId.current) {
      if (selectedApplicant?.testScores) {
        setExamScores({
          englishProficiency: selectedApplicant.testScores.englishProficiency ?? '',
          tradeSkills: selectedApplicant.testScores.tradeSkills ?? '',
          iqAptitude: selectedApplicant.testScores.iqAptitude ?? '',
          personalityEQ: selectedApplicant.testScores.personalityEQ || 'Pending',
          employerSpecific: selectedApplicant.testScores.employerSpecific || '',
        });
      } else {
        setExamScores({
          englishProficiency: '',
          tradeSkills: '',
          iqAptitude: '',
          personalityEQ: 'Pending',
          employerSpecific: '',
        });
      }

      if (selectedApplicant?.medicalReferralGenerated) {
        setGeneratedReferralIds(prev => new Set([...prev, selectedApplicant.id]));
      }

      initializedForApplicantId.current = selectedApplicant?.id || null;
    }
  }, [selectedApplicant]);

  // ── Helpers to evaluate score passing ──────────────────────────────────────
  const englishVal = examScores.englishProficiency === '' ? 0 : Number(examScores.englishProficiency);
  const tradeVal = examScores.tradeSkills === '' ? 0 : Number(examScores.tradeSkills);
  const iqVal = examScores.iqAptitude === '' ? 0 : Number(examScores.iqAptitude);

  const englishPass = typeof examScores.englishProficiency === 'number' && examScores.englishProficiency >= ENGLISH_PASS_SCORE;
  const tradePass = typeof examScores.tradeSkills === 'number' && examScores.tradeSkills >= TRADE_PASS_SCORE;
  const iqPass = typeof examScores.iqAptitude === 'number' && examScores.iqAptitude >= IQ_PASS_SCORE;

  const phase1AllPassed = englishPass && tradePass && iqPass;
  const eqPass = examScores.personalityEQ === 'Suitable';
  const eqFail = examScores.personalityEQ === 'Not Suitable';
  const eqPending = examScores.personalityEQ === 'Pending' || !examScores.personalityEQ;

  const allScoresPassed = phase1AllPassed && eqPass;

  // Has medical referral been generated for selected applicant?
  const hasMedicalReferral = Boolean(
    selectedApplicant?.medicalReferralGenerated || (selectedApplicant && generatedReferralIds.has(selectedApplicant.id))
  );

  // ── Filter applicants active in the Screening module ───────────────────────
  // Once an applicant transitions to Medical Referral ('Medical Clearance') or beyond,
  // they no longer appear in ANY sub-phase of the Screening Panel.
  const screeningPool = useMemo(() => {
    return applicants.filter(a => {
      if (a.isStopped || a.status === 'Processing Stopped') return false;

      // Exclude applicants who progressed to Medical Referral / Fit-to-Work or beyond
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
      if (postScreeningStatuses.includes(a.status)) return false;

      // Only include candidates active in screening (Phase 1, Provisional, Pending Interview, Review Score)
      return true;
    });
  }, [applicants]);

  // Helper: check if an applicant in pool has passed Phase 1 (3 tests)
  const isApplicantPhase1Passed = (a: ApplicantRecord): boolean => {
    const ts = a.testScores;
    if (!ts) return false;
    const eng = typeof ts.englishProficiency === 'number' && ts.englishProficiency >= ENGLISH_PASS_SCORE;
    const trade = typeof ts.tradeSkills === 'number' && ts.tradeSkills >= TRADE_PASS_SCORE;
    const iq = typeof ts.iqAptitude === 'number' && ts.iqAptitude >= IQ_PASS_SCORE;
    return eng && trade && iq;
  };

  // Helper: check if applicant failed any Phase 1 test
  const isApplicantPhase1Failed = (a: ApplicantRecord): boolean => {
    const ts = a.testScores;
    if (!ts) return false;
    const hasAnyScore = typeof ts.englishProficiency === 'number' || typeof ts.tradeSkills === 'number' || typeof ts.iqAptitude === 'number';
    if (!hasAnyScore) return false;
    return !isApplicantPhase1Passed(a);
  };

  // ── 3 Sub-Phases Division ──────────────────────────────────────────────────
  // Phase 1 — Pending Screening:
  // Newly registered candidates or candidates who haven't passed the 3 tests yet.
  // Core Rule: Any applicant who failed 1 or more of the 3 tests gets status = "Provisional"
  // and stays in this phase (does not auto-advance, not removed from pipeline).
  const phase1Applicants = useMemo(() => {
    return screeningPool.filter(a => {
      // If status is Provisional from Phase 1 test failure:
      if (a.status === 'Provisional') {
        return !isApplicantPhase1Passed(a);
      }
      // If status is explicitly Review Score or Pending Interview, they are in phase 2 or 3
      if (a.status === 'Review Score for Medical Referral') return false;
      if (a.status === 'Pending Interview' && isApplicantPhase1Passed(a)) return false;

      // Otherwise, if they haven't passed Phase 1 tests, they stay in Phase 1
      return !isApplicantPhase1Passed(a) || a.status === 'Initial Screening' || a.status === 'Applicant Registration';
    });
  }, [screeningPool]);

  // Phase 2 — Pending Interview:
  // Applicant passed all 3 Phase 1 tests -> advances here for Personality/EQ Assessment.
  // If failed EQ -> status = "Provisional", stays here (or awaiting re-assessment).
  const phase2Applicants = useMemo(() => {
    return screeningPool.filter(a => {
      if (!isApplicantPhase1Passed(a)) return false;
      if (a.status === 'Review Score for Medical Referral') return false;
      const eq = a.testScores?.personalityEQ;
      // If EQ is 'Suitable' and status is not Provisional, they move to Phase 3
      if (eq === 'Suitable' && a.status !== 'Provisional') return false;
      return true;
    });
  }, [screeningPool]);

  // Phase 3 — Review Score for Medical Referral:
  // Reached ONLY once all tests + interview are passed (no fails, no unresolved Provisional status).
  const phase3Applicants = useMemo(() => {
    return screeningPool.filter(a => {
      if (!isApplicantPhase1Passed(a)) return false;
      const eq = a.testScores?.personalityEQ;
      if (eq !== 'Suitable') return false;
      if (a.status === 'Provisional') return false;
      return true;
    });
  }, [screeningPool]);

  // ── Score change handlers ──────────────────────────────────────────────────
  const handleScoreChange = (field: 'englishProficiency' | 'tradeSkills' | 'iqAptitude', val: string) => {
    if (val === '') {
      setExamScores(prev => ({ ...prev, [field]: '' }));
      return;
    }
    const parsed = parseInt(val, 10);
    if (isNaN(parsed)) return;

    if (parsed > 100) {
      showToast('Score cannot exceed 100');
      setExamScores(prev => ({ ...prev, [field]: 100 }));
      return;
    }
    if (parsed < 0) {
      showToast('Score cannot be negative');
      setExamScores(prev => ({ ...prev, [field]: 0 }));
      return;
    }

    setExamScores(prev => ({ ...prev, [field]: parsed }));
  };

  // ── Phase 1: Save & Evaluate 3 Tests ───────────────────────────────────────
  const handleEvaluatePhase1 = async () => {
    if (isSaving || !selectedApplicant) return;

    // Check if scores are inputted
    if (examScores.englishProficiency === '' || examScores.tradeSkills === '' || examScores.iqAptitude === '') {
      showToast('Please enter scores for all 3 standardized tests before evaluating.');
      return;
    }

    setIsSaving(true);
    try {
      const applicantId = selectedApplicant.id;
      const cleanScores = {
        englishProficiency: Number(examScores.englishProficiency) || 0,
        tradeSkills: Number(examScores.tradeSkills) || 0,
        iqAptitude: Number(examScores.iqAptitude) || 0,
        personalityEQ: examScores.personalityEQ,
        employerSpecific: examScores.employerSpecific || undefined,
      };

      const p1Passed =
        cleanScores.englishProficiency >= ENGLISH_PASS_SCORE &&
        cleanScores.tradeSkills >= TRADE_PASS_SCORE &&
        cleanScores.iqAptitude >= IQ_PASS_SCORE;

      let newStatus = selectedApplicant.status;
      let phaseDesc = selectedApplicant.phaseDescription;

      if (p1Passed) {
        // If EQ was already marked Suitable, advance directly to Review Score for Medical Referral
        if (cleanScores.personalityEQ === 'Suitable') {
          newStatus = 'Review Score for Medical Referral';
          phaseDesc = 'Passed all 3 standardized tests and Personality/EQ interview. Cleared for Phase 3: Review Score for Medical Referral.';
        } else {
          newStatus = 'Pending Interview';
          phaseDesc = 'Passed all 3 standardized tests (English, Trade, IQ). Cleared for Phase 2: Personality & EQ Assessment.';
        }
      } else {
        // Core Rule: If any 1 or more failed -> set Applicant Status = "Provisional".
        // Applicant stays in this phase (does not auto-advance).
        newStatus = 'Provisional';
        const failedSummary: string[] = [];
        if (cleanScores.englishProficiency < ENGLISH_PASS_SCORE) {
          failedSummary.push(`English: ${cleanScores.englishProficiency}% (pass is ≥${ENGLISH_PASS_SCORE}%)`);
        }
        if (cleanScores.tradeSkills < TRADE_PASS_SCORE) {
          failedSummary.push(`Trade Skills: ${cleanScores.tradeSkills}% (pass is ≥${TRADE_PASS_SCORE}%)`);
        }
        if (cleanScores.iqAptitude < IQ_PASS_SCORE) {
          failedSummary.push(`IQ/Aptitude: ${cleanScores.iqAptitude}% (pass is ≥${IQ_PASS_SCORE}%)`);
        }
        phaseDesc = `Provisional holding state — test score criteria unmet in: ${failedSummary.join(', ')}. Candidate remains active in pipeline.`;
      }

      // ── 1. IMMEDIATE OPTIMISTIC UPDATE ────────────────────────────────────
      // Instantly clear or set Provisional status in UI without waiting for network calls
      updateApplicant(applicantId, {
        status: newStatus,
        phaseDescription: phaseDesc,
        testScores: cleanScores,
        phase: 1,
      });

      addActivityLog({
        applicantId,
        action: p1Passed ? 'Phase 1 Passed — Advanced to Pending Interview' : 'Phase 1 Evaluated — Status Set to Provisional',
        performedBy: currentUserName,
        department: 'Recruitment',
        details: p1Passed
          ? `All 3 tests passed (English: ${cleanScores.englishProficiency}%, Trade: ${cleanScores.tradeSkills}%, IQ: ${cleanScores.iqAptitude}%). Applicant advanced to Phase 2 (Pending Interview).`
          : `Applicant placed in Provisional status due to unmet test score criteria. Candidate retained in pipeline.`,
      });

      if (p1Passed) {
        showToast('✓ All 3 tests passed! Applicant cleared.');
      } else {
        showToast('Scores saved. Applicant status set to "Provisional" (remains in pipeline).');
      }

      // ── 2. BACKGROUND API PERSISTENCE (PARALLEL) ──────────────────────────
      const numericId = parseInt(applicantId, 10);
      if (!isNaN(numericId)) {
        await Promise.all([
          api.post(`/examinations`, {
            applicantId: numericId,
            ...cleanScores
          }).catch(console.error),
          api.put(`/applicants/${numericId}`, {
            application_id: selectedApplicant.applicationId,
            application_status: newStatus,
            phase_description: phaseDesc,
            testScores: cleanScores
          }).catch(console.error)
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
      showToast('Cannot complete EQ evaluation until all 3 Phase 1 tests have been passed.');
      return;
    }

    setIsSaving(true);
    try {
      const applicantId = selectedApplicant.id;
      const cleanScores = {
        englishProficiency: Number(examScores.englishProficiency) || 0,
        tradeSkills: Number(examScores.tradeSkills) || 0,
        iqAptitude: Number(examScores.iqAptitude) || 0,
        personalityEQ: outcome,
        employerSpecific: examScores.employerSpecific || undefined,
      };

      setExamScores(prev => ({ ...prev, personalityEQ: outcome }));

      let newStatus = selectedApplicant.status;
      let phaseDesc = selectedApplicant.phaseDescription;

      if (outcome === 'Suitable') {
        // If passed -> advances to Phase 3 (Review Score for Medical Referral)
        newStatus = 'Review Score for Medical Referral';
        phaseDesc = 'Personality/EQ Assessment passed (Suitable). Ready for Phase 3: Review Score for Medical Referral.';
      } else if (outcome === 'Not Suitable') {
        // Core Rule: If failed -> set Applicant Status = "Provisional". Not removed from pipeline.
        newStatus = 'Provisional';
        phaseDesc = 'Provisional holding state — applicant evaluated as Not Suitable for the job order during Personality/EQ interview. Retained in pipeline.';
      } else {
        // Unselected / reset -> reverted back to Pending Interview
        newStatus = 'Pending Interview';
        phaseDesc = 'Passed all 3 standardized tests (English, Trade, IQ). Cleared for Phase 2: Personality & EQ Assessment.';
      }

      // ── 1. IMMEDIATE OPTIMISTIC UPDATE ────────────────────────────────────
      // Instantly wipe Provisional status or reset status in the UI without network lag
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

      // ── 2. BACKGROUND API PERSISTENCE (PARALLEL) ──────────────────────────
      const numericId = parseInt(applicantId, 10);
      if (!isNaN(numericId)) {
        await Promise.all([
          api.post(`/examinations`, {
            applicantId: numericId,
            ...cleanScores
          }).catch(console.error),
          api.put(`/applicants/${numericId}`, {
            application_id: selectedApplicant.applicationId,
            application_status: newStatus,
            phase_description: phaseDesc,
            testScores: cleanScores
          }).catch(console.error)
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
    setReviewFormScores({
      englishProficiency: Number(examScores.englishProficiency) || 0,
      tradeSkills: Number(examScores.tradeSkills) || 0,
      iqAptitude: Number(examScores.iqAptitude) || 0,
      personalityEQ: examScores.personalityEQ,
      employerSpecific: examScores.employerSpecific || '',
    });
    setShowReviewScoreModal(true);
  };

  const handleSaveScoreCorrection = async () => {
    if (!selectedApplicant) return;
    setIsSaving(true);
    try {
      const applicantId = selectedApplicant.id;
      const cleanScores = {
        englishProficiency: Number(reviewFormScores.englishProficiency) || 0,
        tradeSkills: Number(reviewFormScores.tradeSkills) || 0,
        iqAptitude: Number(reviewFormScores.iqAptitude) || 0,
        personalityEQ: reviewFormScores.personalityEQ,
        employerSpecific: reviewFormScores.employerSpecific || undefined,
      };

      setExamScores({
        englishProficiency: cleanScores.englishProficiency,
        tradeSkills: cleanScores.tradeSkills,
        iqAptitude: cleanScores.iqAptitude,
        personalityEQ: cleanScores.personalityEQ,
        employerSpecific: cleanScores.employerSpecific || '',
      });

      const p1Pass =
        cleanScores.englishProficiency >= ENGLISH_PASS_SCORE &&
        cleanScores.tradeSkills >= TRADE_PASS_SCORE &&
        cleanScores.iqAptitude >= IQ_PASS_SCORE;
      const eqPass = cleanScores.personalityEQ === 'Suitable';

      let newStatus = selectedApplicant.status;
      let phaseDesc = selectedApplicant.phaseDescription;

      if (p1Pass && eqPass) {
        newStatus = 'Review Score for Medical Referral';
        phaseDesc = 'Scores reviewed and updated. Cleared for Medical Referral generation.';
      } else if (p1Pass && !eqPass) {
        newStatus = cleanScores.personalityEQ === 'Not Suitable' ? 'Provisional' : 'Pending Interview';
        phaseDesc = cleanScores.personalityEQ === 'Not Suitable'
          ? 'Provisional holding state — Personality/EQ assessment is Not Suitable.'
          : 'Pending Personality/EQ Assessment interview.';
      } else {
        newStatus = 'Provisional';
        phaseDesc = 'Provisional holding state — score correction placed applicant below passing criteria in Phase 1.';
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
        action: 'Review Score Updated',
        performedBy: currentUserName,
        department: 'Recruitment',
        details: `Scores corrected: English ${cleanScores.englishProficiency}%, Trade ${cleanScores.tradeSkills}%, IQ ${cleanScores.iqAptitude}%, EQ: ${cleanScores.personalityEQ}. Resulting status: ${newStatus}.`,
      });

      setShowReviewScoreModal(false);
      if (newStatus === 'Provisional') {
        showToast('Scores corrected. Score fell below criteria; status set to Provisional (applicant remains in pipeline).');
      } else {
        showToast('✓ Scores successfully corrected and updated.');
      }

      // ── 2. BACKGROUND API PERSISTENCE (PARALLEL) ──────────────────────────
      const numericId = parseInt(applicantId, 10);
      if (!isNaN(numericId)) {
        await Promise.all([
          api.post(`/examinations`, {
            applicantId: numericId,
            ...cleanScores
          }).catch(console.error),
          api.put(`/applicants/${numericId}`, {
            application_id: selectedApplicant.applicationId,
            application_status: newStatus,
            phase_description: phaseDesc,
            testScores: cleanScores
          }).catch(console.error)
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
    setShowReferralModal(true);
  };

  const handlePrintReferralPdf = () => {
    if (!selectedApplicant) return;
    setIsGeneratingReferral(true);

    try {
      const applicantId = selectedApplicant.id;
      const refDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const refNo = `MR-${new Date().getFullYear()}-${String(applicantId).padStart(5, '0')}`;

      // Open print window with official Flowsensus Medical Referral document
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Medical Referral — ${selectedApplicant.name}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #0F172A; }
              .header { border-bottom: 3px solid #0EA5E9; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
              .title { font-size: 24px; font-weight: 800; color: #0F172A; text-transform: uppercase; margin: 0; }
              .subtitle { font-size: 13px; color: #64748B; margin: 4px 0 0 0; }
              .badge { background: #0EA5E9; color: white; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 12px; }
              .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; color: #64748B; letter-spacing: 0.5px; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px; }
              .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 14px; }
              .box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; }
              .label { font-size: 11px; text-transform: uppercase; color: #64748B; font-weight: 600; }
              .val { font-size: 15px; font-weight: 700; color: #0F172A; margin-top: 2px; }
              .scores-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
              .scores-table th { background: #F1F5F9; text-align: left; padding: 8px 12px; font-size: 12px; text-transform: uppercase; }
              .scores-table td { padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-weight: 600; }
              .signature-block { margin-top: 40px; display: flex; justify-content: space-between; }
              .sig-line { border-top: 1px solid #0F172A; width: 220px; text-align: center; padding-top: 6px; font-size: 12px; font-weight: 700; }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <h1 class="title">Flowsensus Universal Ops</h1>
                <p class="subtitle">Official Pre-Employment Medical Examination (PEME) Referral Order</p>
              </div>
              <div style="text-align: right;">
                <span class="badge">REFERRAL ORDER</span>
                <p style="font-size: 12px; color: #64748B; margin-top: 6px;">Ref No: <strong>${refNo}</strong></p>
                <p style="font-size: 12px; color: #64748B;">Date: ${refDate}</p>
              </div>
            </div>

            <div class="section-title">Referred Healthcare Partner Facility</div>
            <div class="box">
              <div class="label">Accredited Clinic Name</div>
              <div class="val">${selectedClinic}</div>
              <p style="font-size: 12px; color: #64748B; margin: 4px 0 0 0;">Pre-Employment Medical Examination (PEME) standard overseas work clearance package</p>
            </div>

            <div class="section-title">Applicant / Candidate Profile</div>
            <div class="grid">
              <div class="box">
                <div class="label">Full Name</div>
                <div class="val">${selectedApplicant.name}</div>
              </div>
              <div class="box">
                <div class="label">Applicant Code</div>
                <div class="val">${selectedApplicant.applicantCode || selectedApplicant.id}</div>
              </div>
              <div class="box">
                <div class="label">Applied Trade / Role</div>
                <div class="val">${selectedApplicant.role}</div>
              </div>
              <div class="box">
                <div class="label">Job Order Allocation</div>
                <div class="val">${selectedApplicant.jobOrder || 'Unassigned'}</div>
              </div>
            </div>

            <div class="section-title">Standardized Screening Results Summary (All Passed)</div>
            <table class="scores-table">
              <thead>
                <tr>
                  <th>Evaluation Exam</th>
                  <th>Minimum Passing</th>
                  <th>Score Recorded</th>
                  <th>Verdict</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1. English Proficiency Test</td>
                  <td>60%</td>
                  <td>${examScores.englishProficiency}%</td>
                  <td style="color: #10B981;">✓ PASSED</td>
                </tr>
                <tr>
                  <td>2. Trade / Skills Practical Test</td>
                  <td>70%</td>
                  <td>${examScores.tradeSkills}%</td>
                  <td style="color: #10B981;">✓ PASSED</td>
                </tr>
                <tr>
                  <td>3. IQ / Aptitude Assessment</td>
                  <td>50%</td>
                  <td>${examScores.iqAptitude}%</td>
                  <td style="color: #10B981;">✓ PASSED</td>
                </tr>
                <tr>
                  <td>4. Personality / EQ Suitability Interview</td>
                  <td>Suitable</td>
                  <td>${examScores.personalityEQ}</td>
                  <td style="color: #10B981;">✓ SUITABLE</td>
                </tr>
              </tbody>
            </table>

            <div class="signature-block">
              <div>
                <p style="font-size: 12px; color: #64748B; margin-bottom: 40px;">Candidate Signature & Conforme</p>
                <div class="sig-line">${selectedApplicant.name}</div>
              </div>
              <div>
                <p style="font-size: 12px; color: #64748B; margin-bottom: 40px;">Digital Recruiter Endorsement</p>
                <div class="sig-line">${currentUserName} (Recruitment Dept)</div>
              </div>
            </div>
            <script>
              window.onload = function() {
                window.print();
              };
            </script>
          </body>
          </html>
        `);
        printWindow.document.close();
      }

      // Record in local state that referral has been generated
      setGeneratedReferralIds(prev => new Set([...prev, applicantId]));

      // Update applicant record
      updateApplicant(applicantId, {
        medicalReferralGenerated: true,
        medicalReferralClinic: selectedClinic,
        medicalReferralDate: new Date().toISOString(),
      });

      addActivityLog({
        applicantId,
        action: 'Medical Referral PDF Generated',
        performedBy: currentUserName,
        department: 'Recruitment',
        details: `Generated official Medical Referral PDF to ${selectedClinic}. Digital signature of recruiter ${currentUserName} logged. Candidate is now eligible for status update to Medical Referral.`,
      });

      setShowReferralModal(false);
      showToast('✓ Medical Referral PDF generated successfully! Recruiter signature logged. You can now Update Applicant Status.');
    } catch (err) {
      console.error(err);
      showToast('Failed to generate Medical Referral PDF.');
    } finally {
      setIsGeneratingReferral(false);
    }
  };

  // ── Phase 3: Button 3 — UPDATE APPLICANT STATUS ────────────────────────────
  // Must trigger confirmation modal before executing transition — no silent moves!
  const handleOpenUpdateStatusConfirmation = () => {
    if (!hasMedicalReferral) {
      showToast('Please generate the Medical Referral PDF first before updating applicant status.');
      return;
    }
    setShowUpdateStatusModal(true);
  };

  const handleConfirmMoveToMedicalReferral = async () => {
    if (isUpdatingStatus || !selectedApplicant) return;
    setIsUpdatingStatus(true);
    try {
      const applicantId = selectedApplicant.id;
      const numericId = parseInt(applicantId, 10);

      const updates: Partial<ApplicantRecord> = {
        status: 'Medical Clearance',
        phase: 2,
        currentHandler: 'Maria Santos',
        currentDepartment: 'Admin',
        phaseDescription: `Medical referral issued to ${selectedApplicant.medicalReferralClinic || selectedClinic}. Awaiting examination clearance from clinic.`,
      };

      if (!isNaN(numericId)) {
        await api.put(`/applicants/${numericId}`, {
          application_id: selectedApplicant.applicationId,
          application_status: 'Medical Clearance',
          current_phase: 2,
          current_handler: 'Maria Santos',
          current_department: 'Admin',
          phase_description: updates.phaseDescription,
        }).catch(console.error);
      }

      // Update local state and workflow state
      updateApplicant(applicantId, updates);
      updateWorkflow({ screeningPassed: true });

      addActivityLog({
        applicantId,
        action: 'Screening Completed — Moved to Medical Referral',
        performedBy: currentUserName,
        department: 'Recruitment',
        details: `Applicant ${selectedApplicant.name} completed all screening phases with verified scores. Medical referral generated. Moved to Medical Referral phase (now active in Fit-to-Work module).`,
      });

      setShowUpdateStatusModal(false);
      showToast(`✓ ${selectedApplicant.name} moved to Medical Referral (now in Fit-to-Work module).`);

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

  const openApplicant = (id: string) => {
    setSelectedApplicantId(id);
    setListView(false);
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

        {/* ── SUB-PHASE 1: PENDING SCREENING ──────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                Phase 1 — Pending Screening
              </h3>
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                {phase1Applicants.length}
              </span>
            </div>
            <span className="text-xs text-slate-400">English (≥60%) • Trade Skills (≥70%) • IQ/Aptitude (≥50%)</span>
          </div>

          {phase1Applicants.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 py-8 text-center text-slate-400 text-sm">
              No applicants currently pending Phase 1 standardized testing
            </div>
          ) : (
            <div className="space-y-2">
              {phase1Applicants.map(a => {
                const activeFlags = (a.employmentFlags || []).filter(f => !f.dismissed && !f.validated);
                const isProvisional = a.status === 'Provisional';

                return (
                  <button
                    key={a.id}
                    onClick={() => openApplicant(a.id)}
                    disabled={activeFlags.length > 0}
                    className={`w-full text-left bg-white rounded-xl border px-5 py-4 flex items-center gap-4 transition-all cursor-pointer ${
                      activeFlags.length > 0
                        ? 'border-amber-200 opacity-60 cursor-not-allowed'
                        : isProvisional
                        ? 'border-amber-300 hover:border-amber-500 bg-amber-50/20 hover:shadow-sm'
                        : 'border-slate-200 hover:border-[#0EA5E9]/60 hover:shadow-sm'
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
                              Scores: Eng {a.testScores.englishProficiency ?? '-'}% | Trade {a.testScores.tradeSkills ?? '-'}% | IQ {a.testScores.iqAptitude ?? '-'}%
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock size={11} /> {a.lastUpdated ? a.lastUpdated.slice(0, 10) : 'Recent'}
                      </span>
                      {activeFlags.length === 0 && <ChevronRight size={16} className="text-slate-400" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── SUB-PHASE 2: PENDING INTERVIEW ──────────────────────────────── */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0EA5E9]"></span>
                Phase 2 — Pending Interview (Personality/EQ)
              </h3>
              <span className="text-xs bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full font-bold">
                {phase2Applicants.length}
              </span>
            </div>
            <span className="text-xs text-slate-400">Passed 3 Standardized Tests • Awaiting Suitability Interview</span>
          </div>

          {phase2Applicants.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 py-8 text-center text-slate-400 text-sm">
              No applicants currently pending Phase 2 personality/EQ assessment
            </div>
          ) : (
            <div className="space-y-2">
              {phase2Applicants.map(a => {
                const isProvisional = a.status === 'Provisional';
                return (
                  <button
                    key={a.id}
                    onClick={() => openApplicant(a.id)}
                    className="w-full text-left bg-white rounded-xl border border-slate-200 hover:border-[#0EA5E9]/60 hover:shadow-sm px-5 py-4 flex items-center gap-4 transition-all cursor-pointer"
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
                      <ChevronRight size={16} className="text-slate-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── SUB-PHASE 3: REVIEW SCORE FOR MEDICAL REFERRAL ──────────────── */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                Phase 3 — Review Score for Medical Referral
              </h3>
              <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                {phase3Applicants.length}
              </span>
            </div>
            <span className="text-xs text-slate-400">All Tests & Interview Passed • Ready for PDF & Status Dispatch</span>
          </div>

          {phase3Applicants.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 py-8 text-center text-slate-400 text-sm">
              No applicants currently waiting in Phase 3
            </div>
          ) : (
            <div className="space-y-2">
              {phase3Applicants.map(a => {
                const referralDone = a.medicalReferralGenerated || generatedReferralIds.has(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => openApplicant(a.id)}
                    className="w-full text-left bg-gradient-to-r from-emerald-50/40 to-white rounded-xl border border-emerald-200 hover:border-emerald-400 hover:shadow-sm px-5 py-4 flex items-center gap-4 transition-all cursor-pointer"
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
                        <span className="text-xs text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <CheckCircle2 size={11} /> 100% Passed
                        </span>
                        {referralDone && (
                          <span className="text-xs text-sky-800 bg-sky-100 border border-sky-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <FileCheck2 size={11} /> Referral Generated
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {a.role} {a.jobOrder ? `• ${a.jobOrder}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                        {referralDone ? 'Ready to Update Status →' : 'Review & Generate Referral →'}
                      </span>
                      <ChevronRight size={16} className="text-slate-400" />
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

  // ───────────────────────────────────────────────────────────────────────────
  // VIEW: APPLICANT SCORECARD & 3-PHASE EVALUATION WORKFLOW
  // ───────────────────────────────────────────────────────────────────────────
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

        {/* ── Workflow Progress Stepper ────────────────────────────────────── */}
        <div className="bg-slate-900/80 px-6 py-3 border-t border-slate-800 flex items-center justify-between text-xs">
          {/* Step 1 */}
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                phase1AllPassed
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
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                eqPass
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
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                hasMedicalReferral
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
          <p className="font-bold text-sm text-amber-950 mb-1">How This Works</p>
          <ul className="space-y-1 text-amber-800 leading-relaxed list-none">
            <li>✔ If the applicant <strong>passes all 3 tests</strong>, they move on to the Personality Interview (Phase 2).</li>
            <li>⚠ If they <strong>fail any test</strong>, their status is set to <strong>Provisional</strong> — they stay in the pipeline. You can re-score them later, or use <em>Stop Processing</em> to end their application.</li>
            <li>✔ Once <strong>all tests and the interview are passed</strong>, you can generate their Medical Referral and move them forward.</li>
          </ul>
        </div>
      </div>

      {/* ── SECTION 1: PHASE 1 — STANDARDIZED TEST SCORECARD ─────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-[#0EA5E9]" />
            <div>
              <h3 className="font-black text-[#0F172A] text-lg">Phase 1 — Standardized Test Scorecard</h3>
              <p className="text-xs text-slate-500 mt-0.5">Staff records scores for the 3 core qualification exams</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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

        <div className="space-y-6">
          {/* 1. English Proficiency Test */}
          <div className="bg-[#0EA5E9]/5 p-5 rounded-xl border-2 border-[#0EA5E9]/20">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold text-[#0F172A] text-sm">1. English Proficiency Test</p>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Communication ability (grammar, comprehension, oral interview) • Passing: ≥{ENGLISH_PASS_SCORE}%
                </p>
              </div>
              <span
                className={`px-3 py-1 text-xs font-bold rounded-full ${
                  englishPass ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                }`}
              >
                {englishPass ? '✓ Pass' : '✗ Below Pass'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={examScores.englishProficiency}
                onChange={(e) => handleScoreChange('englishProficiency', e.target.value)}
                max={100}
                min={0}
                placeholder="0"
                className="w-28 border-2 border-[#0EA5E9]/30 px-3 py-2 rounded-lg text-2xl font-black text-[#0EA5E9] focus:border-[#0EA5E9] outline-none text-center bg-white"
              />
              <span className="text-sm text-[#64748B] font-semibold">/ 100</span>
              <div className="flex-1 bg-slate-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${englishPass ? 'bg-[#10B981]' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, Math.max(0, englishVal))}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* 2. Trade/Skills Test - MOST CRITICAL */}
          <div className="bg-[#F59E0B]/5 p-5 rounded-xl border-2 border-[#F59E0B]/20">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold text-[#0F172A] text-sm flex items-center gap-2">
                  2. Trade / Skills Test
                  <span className="px-2 py-0.5 bg-[#F59E0B] text-white text-xs font-bold rounded">MOST CRITICAL</span>
                </p>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Practical job capability (hands-on demo, actual performance benchmark) • Passing: ≥{TRADE_PASS_SCORE}%
                </p>
              </div>
              <span
                className={`px-3 py-1 text-xs font-bold rounded-full ${
                  tradePass ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                }`}
              >
                {tradePass ? '✓ Pass' : '✗ Below Pass'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={examScores.tradeSkills}
                onChange={(e) => handleScoreChange('tradeSkills', e.target.value)}
                max={100}
                min={0}
                placeholder="0"
                className="w-28 border-2 border-[#F59E0B]/30 px-3 py-2 rounded-lg text-2xl font-black text-[#F59E0B] focus:border-[#F59E0B] outline-none text-center bg-white"
              />
              <span className="text-sm text-[#64748B] font-semibold">/ 100</span>
              <div className="flex-1 bg-slate-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${tradePass ? 'bg-[#10B981]' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, Math.max(0, tradeVal))}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* 3. IQ / Aptitude Test */}
          <div className="bg-[#8B5CF6]/5 p-5 rounded-xl border-2 border-[#8B5CF6]/20">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold text-[#0F172A] text-sm">3. IQ / Aptitude Test</p>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Learning ability, problem-solving, logical reasoning • Passing: ≥{IQ_PASS_SCORE}%
                </p>
              </div>
              <span
                className={`px-3 py-1 text-xs font-bold rounded-full ${
                  iqPass ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                }`}
              >
                {iqPass ? '✓ Pass' : '✗ Below Pass'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={examScores.iqAptitude}
                onChange={(e) => handleScoreChange('iqAptitude', e.target.value)}
                max={100}
                min={0}
                placeholder="0"
                className="w-28 border-2 border-[#8B5CF6]/30 px-3 py-2 rounded-lg text-2xl font-black text-[#8B5CF6] focus:border-[#8B5CF6] outline-none text-center bg-white"
              />
              <span className="text-sm text-[#64748B] font-semibold">/ 100</span>
              <div className="flex-1 bg-slate-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${iqPass ? 'bg-[#10B981]' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, Math.max(0, iqVal))}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Optional Employer-Specific Tests */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p className="font-bold text-[#0F172A] text-xs uppercase tracking-wide mb-1">
              Employer-Specific Tests / Skills Notes <span className="text-slate-400 font-normal">(Optional)</span>
            </p>
            <textarea
              value={examScores.employerSpecific}
              onChange={(e) => setExamScores(prev => ({ ...prev, employerSpecific: e.target.value }))}
              rows={2}
              placeholder="e.g. Passed welding test (4G SMAW); Certified culinary demo for domestic kitchen."
              className="w-full border border-slate-300 px-3 py-2 rounded-lg text-xs focus:border-[#0EA5E9] outline-none bg-white"
            ></textarea>
          </div>
        </div>

        {/* Phase 1 Evaluation Action Bar */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Phase 1 Verdict</p>
            <p className={`text-base font-extrabold ${phase1AllPassed ? 'text-emerald-600' : 'text-amber-600'}`}>
              {phase1AllPassed
                ? '✓ All 3 Tests Meet Passing Criteria'
                : '⚠️ Criteria Not Met — Saving Will Mark Applicant as Provisional'}
            </p>
          </div>

          <button
            onClick={handleEvaluatePhase1}
            disabled={isSaving}
            className="px-6 py-2.5 bg-[#0F172A] hover:bg-[#1E293B] disabled:opacity-50 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
            Save & Evaluate Phase 1 Scores
          </button>
        </div>
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
            className={`px-3 py-1 text-xs font-bold rounded-full ${
              eqPass
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
              The applicant must pass all 3 Standardized Tests (English ≥60%, Trade Skills ≥70%, IQ ≥50%) before proceeding to the Personality / EQ Assessment interview.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block">
                  Suitability Verdict for Job Order: {selectedApplicant?.jobOrder || 'Current Position'}
                </label>
                {(examScores.personalityEQ === 'Suitable' || examScores.personalityEQ === 'Not Suitable') && (
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
                  onClick={() => handleEvaluatePhase2(examScores.personalityEQ === 'Suitable' ? 'Pending' : 'Suitable')}
                  disabled={isSaving}
                  className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    examScores.personalityEQ === 'Suitable'
                      ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-emerald-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-emerald-900">✓ Suitable (Pass)</span>
                    {examScores.personalityEQ === 'Suitable' && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Candidate meets emotional, behavioral, and communication standards for overseas deployment. Advances to Phase 3.
                  </p>
                  {examScores.personalityEQ === 'Suitable' && (
                    <span className="inline-block mt-2 text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                      Click again to unselect
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleEvaluatePhase2(examScores.personalityEQ === 'Not Suitable' ? 'Pending' : 'Not Suitable')}
                  disabled={isSaving}
                  className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    examScores.personalityEQ === 'Not Suitable'
                      ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20'
                      : 'border-slate-200 hover:border-amber-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-amber-900">✗ Not Suitable → Provisional</span>
                    {examScores.personalityEQ === 'Not Suitable' && (
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Behavioral concerns or mismatch detected. Sets status to Provisional — candidate remains in pipeline. Staff may re-evaluate or stop processing.
                  </p>
                  {examScores.personalityEQ === 'Not Suitable' && (
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

      {/* ── SECTION 3: PHASE 3 — REVIEW SCORE FOR MEDICAL REFERRAL ─────────── */}
      <div
        className={`rounded-xl shadow-sm border p-8 space-y-6 ${
          allScoresPassed
            ? 'bg-gradient-to-br from-emerald-50/30 via-white to-sky-50/30 border-emerald-300 ring-2 ring-emerald-500/10'
            : 'bg-white border-slate-200 opacity-70'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2">
            <FileCheck2 className={`w-6 h-6 ${allScoresPassed ? 'text-emerald-600' : 'text-slate-400'}`} />
            <div>
              <h3 className="font-black text-[#0F172A] text-lg">
                Phase 3 — Review Score for Medical Referral
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Unlocked only when all 3 tests + EQ interview are passed (no fails, no unresolved Provisional status)
              </p>
            </div>
          </div>

          <span
            className={`px-3 py-1 text-xs font-bold rounded-full ${
              allScoresPassed
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
              The applicant only reaches this phase once all 3 standardized tests and the Personality/EQ suitability interview are passed.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Scorecard Summary Grid */}
            <div className="bg-white border border-emerald-200 rounded-xl p-5 shadow-xs">
              <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-3">
                Verified Evaluation Results (Cleared for Medical Referral)
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-400 font-semibold block uppercase">1. English</span>
                  <span className="text-base font-extrabold text-slate-800">{examScores.englishProficiency}%</span>
                  <span className="text-emerald-600 font-bold block mt-0.5">✓ Pass (≥60%)</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-400 font-semibold block uppercase">2. Trade Skills</span>
                  <span className="text-base font-extrabold text-slate-800">{examScores.tradeSkills}%</span>
                  <span className="text-emerald-600 font-bold block mt-0.5">✓ Pass (≥70%)</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-400 font-semibold block uppercase">3. IQ / Aptitude</span>
                  <span className="text-base font-extrabold text-slate-800">{examScores.iqAptitude}%</span>
                  <span className="text-emerald-600 font-bold block mt-0.5">✓ Pass (≥50%)</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-400 font-semibold block uppercase">4. Personality/EQ</span>
                  <span className="text-base font-extrabold text-emerald-700">{examScores.personalityEQ}</span>
                  <span className="text-emerald-600 font-bold block mt-0.5">✓ Suitable</span>
                </div>
              </div>
            </div>

            {/* Referral Status Notice */}
            {hasMedicalReferral ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-950">Medical Referral PDF Generated</span>
                    <p className="text-emerald-700 text-xs mt-0.5">
                      Assigned Clinic: <strong>{selectedApplicant?.medicalReferralClinic || selectedClinic}</strong> • Recruiter signature logged.
                    </p>
                  </div>
                </div>
                <span className="bg-emerald-200 text-emerald-900 px-2.5 py-1 rounded-md font-bold">
                  Status Update Unlocked
                </span>
              </div>
            ) : (
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-xs text-sky-900 flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-[#0EA5E9] flex-shrink-0" />
                <span>Click <strong>&ldquo;Generate Medical Referral&rdquo;</strong> to produce the official referral PDF and unlock status dispatch.</span>
              </div>
            )}

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
                {/* Button 2: GENERATE MEDICAL REFERRAL (Enabled: only when ALL scores passed) */}
                <button
                  type="button"
                  onClick={handleOpenReferralModal}
                  disabled={!allScoresPassed}
                  className="px-6 py-2.5 bg-[#0EA5E9] hover:bg-[#0284C7] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  {hasMedicalReferral ? 'Re-Generate Medical Referral' : 'Generate Medical Referral'}
                </button>

                {/* Button 3: UPDATE APPLICANT STATUS (Enabled: only after Generate Medical Referral clicked at least once) */}
                <button
                  type="button"
                  onClick={handleOpenUpdateStatusConfirmation}
                  disabled={!hasMedicalReferral}
                  title={!hasMedicalReferral ? 'Requires Medical Referral to be generated first' : 'Move applicant to Medical Referral'}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer ${
                    hasMedicalReferral
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
                  <strong>Notice:</strong> If any score is reduced below passing criteria (English &lt;60%, Trade &lt;70%, IQ &lt;50%, or EQ Not Suitable), the candidate will automatically be set to <em>Provisional</em> status and returned to the appropriate evaluation sub-phase.
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">English (≥60%)</label>
                  <input
                    type="number"
                    max={100}
                    min={0}
                    value={reviewFormScores.englishProficiency}
                    onChange={e =>
                      setReviewFormScores(prev => ({
                        ...prev,
                        englishProficiency: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0))
                      }))
                    }
                    className="w-full border-2 border-slate-200 px-3 py-2 rounded-lg font-bold text-slate-800 text-center"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Trade (≥70%)</label>
                  <input
                    type="number"
                    max={100}
                    min={0}
                    value={reviewFormScores.tradeSkills}
                    onChange={e =>
                      setReviewFormScores(prev => ({
                        ...prev,
                        tradeSkills: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0))
                      }))
                    }
                    className="w-full border-2 border-slate-200 px-3 py-2 rounded-lg font-bold text-slate-800 text-center"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">IQ (≥50%)</label>
                  <input
                    type="number"
                    max={100}
                    min={0}
                    value={reviewFormScores.iqAptitude}
                    onChange={e =>
                      setReviewFormScores(prev => ({
                        ...prev,
                        iqAptitude: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0))
                      }))
                    }
                    className="w-full border-2 border-slate-200 px-3 py-2 rounded-lg font-bold text-slate-800 text-center"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Personality / EQ Outcome</label>
                <select
                  value={reviewFormScores.personalityEQ}
                  onChange={e =>
                    setReviewFormScores(prev => ({
                      ...prev,
                      personalityEQ: e.target.value as any
                    }))
                  }
                  className="w-full border-2 border-slate-200 px-3 py-2 rounded-lg text-sm font-semibold bg-white"
                >
                  <option value="Suitable">✓ Suitable (Pass)</option>
                  <option value="Not Suitable">✗ Not Suitable (Provisional)</option>
                  <option value="Pending">⏱ Pending Assessment</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Employer-Specific Notes</label>
                <textarea
                  value={reviewFormScores.employerSpecific}
                  onChange={e => setReviewFormScores(prev => ({ ...prev, employerSpecific: e.target.value }))}
                  rows={2}
                  className="w-full border-2 border-slate-200 px-3 py-2 rounded-lg text-xs"
                />
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
                  className="w-full border-2 border-slate-200 px-3 py-2.5 rounded-xl text-xs font-semibold bg-white focus:border-[#0EA5E9] outline-none"
                >
                  {PARTNER_CLINICS.map(clinic => (
                    <option key={clinic} value={clinic}>
                      {clinic}
                    </option>
                  ))}
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
                  onClick={handlePrintReferralPdf}
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
                      <Printer className="w-4 h-4" />
                      Generate & Print PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────
          MODAL 4: CONFIRM MOVE TO MEDICAL REFERRAL (Button 3)
          "Must trigger a confirmation modal before the transition executes — no silent moves"
      ──────────────────────────────────────────────────────────────────────── */}
      {showUpdateStatusModal && (
        <div className="fixed inset-0 bg-[#0F172A]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-100">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-200">
              <UserCheck className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-extrabold text-[#0F172A] text-lg">
                Move Applicant to Medical Referral?
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Are you sure you want to move <strong>{selectedApplicant?.name}</strong> to the Medical Referral phase?
              </p>
            </div>

            <div className="my-5 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Candidate:</span>
                <span className="font-bold text-slate-800">{selectedApplicant?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Assigned Clinic:</span>
                <span className="font-semibold text-slate-800 truncate max-w-[200px]">
                  {selectedApplicant?.medicalReferralClinic || selectedClinic}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Next Destination:</span>
                <span className="font-bold text-emerald-700">Fit to Work Module (Admin Clearance)</span>
              </div>
              <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500">
                Notice: The applicant will be moved completely out of the Screening Panel and will appear in the Fit to Work module.
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
