import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Clock, User, DollarSign, ShieldAlert, CheckCircle2, OctagonX,
  FileCheck, FileX, ChevronUp, MapPin, Phone, Mail, Globe,
  Briefcase, GraduationCap, Award, Languages,
  IdCard, BarChart3, MessageSquare, AlertTriangle, Flag,
  Clock3, TrendingDown, GitMerge, Zap, Calendar, BadgeCheck, X,
  ArrowLeft, ChevronLeft, ChevronRight, Edit2,
  HeartHandshake, Share2, ExternalLink, Users, Check, Trash2, Loader2
} from 'lucide-react';
import { api } from '../../../lib/api';
import { mapApplicantFromApi } from '../../../lib/applicantMapper';
import { ApplicantRecord, ActivityLog, ExpenseRecord, EmploymentFlag, EmploymentFlagType, EvaluationTest, LanguageRecord } from '../../types';

// ─── Flag engine types ────────────────────────────────────────────────────────
const FLAG_META: Record<EmploymentFlagType, { label: string; icon: React.ReactNode; color: string }> = {
  gap:                  { label: 'Employment Gap',       icon: <Clock3 size={14} />,       color: '#F59E0B' },
  short_stint:          { label: 'Short Tenure',         icon: <Zap size={14} />,           color: '#F97316' },
  red_flag_resignation: { label: 'Resignation Red Flag', icon: <ShieldAlert size={14} />,   color: '#EF4444' },
  overlap:              { label: 'Date Overlap',         icon: <GitMerge size={14} />,      color: '#8B5CF6' },
  demotion:             { label: 'Possible Demotion',    icon: <TrendingDown size={14} />,  color: '#EC4899' },
};

const PHASE_TITLES: Record<number, string> = {
  0: 'Process Stopped',
  1: 'Registration & Screening',
  2: 'Medical Clearance',
  3: 'CV Encoding & Management Approval',
  4: 'Employer Endorsement',
  5: 'Final Deployment Processing',
  6: 'Deployed',
};

const QUICK_REASONS = [
  "Applicant provided satisfactory verbal explanation",
  "Supporting documents provided and verified",
  "Short stint was OJT / probationary period",
  "Employment gap explained — family or personal emergency",
  "Employment gap explained — continued education or training",
  "Employment gap explained — illness or medical treatment",
  "Termination was end-of-contract, not disciplinary action",
  "Overlap was part-time / freelance work (verified)",
  "Employer reference confirmed the circumstances",
  "Demotion was voluntary — career shift or personal choice",
  "Other (see details below)",
];

// ─── Section config ───────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'overview',    label: 'Overview',       icon: <User size={13} /> },
  { id: 'employment',  label: 'Employment',     icon: <Briefcase size={13} /> },
  { id: 'skills',      label: 'Skills & Certs', icon: <Award size={13} /> },
  { id: 'languages',   label: 'Languages',      icon: <Languages size={13} /> },
  { id: 'education',   label: 'Education',      icon: <GraduationCap size={13} /> },
  { id: 'ids',         label: 'IDs & Docs',     icon: <IdCard size={13} /> },
  { id: 'scores',      label: 'Test Scores',    icon: <BarChart3 size={13} /> },
  { id: 'finances',    label: 'Financials',     icon: <DollarSign size={13} /> },
  { id: 'activity',    label: 'Activity History', icon: <Clock size={13} /> },
];

function monthsBetween(a: string, b: string) {
  const da = new Date(a), db = new Date(b);
  return Math.max(0, (db.getFullYear() - da.getFullYear()) * 12 + db.getMonth() - da.getMonth());
}

function durationLabel(months: number) {
  if (months < 1) return '< 1 mo';
  if (months < 12) return `${months} mo`;
  const y = Math.floor(months / 12), m = months % 12;
  return m > 0 ? `${y} yr ${m} mo` : `${y} yr`;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface ApplicantProfileProps {
  applicant?: ApplicantRecord;
  activityLogs?: ActivityLog[];
  expenses?: ExpenseRecord[];
  updateApplicant?: (id: string, updates: Partial<ApplicantRecord>) => void;
  currentUserName?: string;
  addActivityLog?: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  showToast?: (msg: string) => void;
  onBack?: () => void;
  onNavigateApplicant?: (direction: 'prev' | 'next') => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  applicantIndexText?: string;
  onEdit?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ApplicantProfile({
  applicant: applicantProp,
  activityLogs = [],
  expenses = [],
  updateApplicant,
  currentUserName = 'Staff',
  addActivityLog,
  showToast,
  onBack,
  onNavigateApplicant,
  hasPrev,
  hasNext,
  applicantIndexText,
  onEdit,
}: ApplicantProfileProps) {
  const [activeSection, setActiveSection] = useState('overview');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [resolvingFlagId, setResolvingFlagId] = useState<string | null>(null);
  const [selectedQuickReason, setSelectedQuickReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [evaluationTemplates, setEvaluationTemplates] = useState<EvaluationTest[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichedData, setEnrichedData] = useState<ApplicantRecord | null>(null);

  useEffect(() => {
    if (!applicantProp?.id) return;
    setEnrichedData(null);
    setIsEnriching(true);
    api.get(`/applicants/${applicantProp.id}`)
      .then(res => {
        if (res.data) {
          const mapped = mapApplicantFromApi(res.data);
          setEnrichedData(mapped);
          updateApplicant?.(applicantProp.id, mapped);
        }
      })
      .catch(err => {
        console.warn('Failed to fetch full applicant details:', err);
      })
      .finally(() => {
        setIsEnriching(false);
      });
  }, [applicantProp?.id]);

  const applicant = enrichedData
    ? { ...applicantProp, ...enrichedData }
    : applicantProp;

  // ── Per-Applicant Activity History Timeline ─────────────────────────────
  const [applicantTimeline, setApplicantTimeline] = useState<any[]>([]);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);

  useEffect(() => {
    if (!applicantProp?.id) return;
    setIsTimelineLoading(true);
    api.get(`/audit-logs/applicant/${applicantProp.id}`)
      .then(res => {
        if (res.data && Array.isArray(res.data)) {
          setApplicantTimeline(res.data);
        }
      })
      .catch(err => {
        console.warn('Failed to load applicant activity history:', err);
      })
      .finally(() => {
        setIsTimelineLoading(false);
      });
  }, [applicantProp?.id]);

  useEffect(() => {
    api.get('/evaluations/templates')
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const live: EvaluationTest[] = res.data.map((t: any) => ({
            id: String(t.test_template_id || t.id),
            name: t.name,
            type: (t.test_type || t.type || 'custom') as any,
            description: t.description || '',
            maxScore: Number(t.max_score ?? t.maxScore ?? 100),
            passingScore: Number(t.passing_score ?? t.passingScore ?? 60),
            weight: Number(t.weight_percentage ?? t.weight ?? 10),
            scoringGuide: t.scoring_guide || t.scoringGuide || '',
            isActive: Boolean(t.is_active ?? t.isActive ?? true),
            scoringType: (t.scoring_type || t.scoringType || 'numeric') as 'numeric' | 'pass_fail',
            applicableJobOrders: Array.isArray(t.applicable_job_orders)
              ? t.applicable_job_orders
              : (Array.isArray(t.applicableJobOrders) ? t.applicableJobOrders : []),
          }));
          setEvaluationTemplates(live.filter(t => t.isActive));
        }
      })
      .catch(() => {});
  }, []);

  // Stop Processing
  const [showStopModal, setShowStopModal] = useState(false);
  const [stopReason, setStopReason] = useState('');

  // Mark as Valid
  const [validatingFlagId, setValidatingFlagId] = useState<string | null>(null);
  const [validationQuickReason, setValidationQuickReason] = useState('');
  const [validationCustomReason, setValidationCustomReason] = useState('');

  const VALIDATION_REASONS = [
    "Called previous employer — they confirmed end-of-contract, not termination",
    "Applicant provided payslips or employment certificate as proof",
    "Called agency or recruitment firm that placed them in that role",
    "Background check via third-party verified the circumstances",
    "Government records (SSS, PhilHealth, HDMF) confirmed employment dates",
    "Employer reference checked and provided written statement",
    "Applicant submitted notarized affidavit of explanation",
    "Agency independently verified via phone interview with former HR",
    "Other (see details below)",
  ];

  const handleStopProcessing = async () => {
    if (!stopReason.trim() || !applicant || !updateApplicant) return;
    
    const updates = {
      isStopped: true, stoppedReason: stopReason, stoppedBy: currentUserName,
      stoppedAt: new Date().toISOString(), stoppedPhase: applicant.phase,
      status: 'Processing Stopped',
      phaseDescription: `Processing halted by ${currentUserName}: ${stopReason}`,
    };
    
    // Optimistic local update
    updateApplicant(applicant.id, updates);
    
    // Backend update
    try {
      await api.put(`/applicants/${applicant.id}`, updates);
    } catch (err) {
      console.error('Failed to save stop processing to backend:', err);
      showToast?.('Failed to save status to backend, but updated locally.');
    }

    addActivityLog?.({ applicantId: applicant.id, action: 'Processing Stopped', performedBy: currentUserName, department: 'Recruitment', details: `Stopped at Phase ${applicant.phase}. Reason: ${stopReason}` });
    showToast?.('Processing stopped. Applicant record has been locked.');
    setShowStopModal(false);
    setStopReason('');
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const handleDeleteApplicant = async () => {
    if (!applicant) return;
    setIsDeleting(true);
    try {
      await api.delete(`/applicants/${applicant.id}`);
      showToast?.('Applicant deleted successfully.');
      if (onBack) {
        onBack();
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      console.error('Failed to delete applicant:', err);
      showToast?.(err?.response?.data?.detail || 'Failed to delete applicant.');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const validateFlag = (flagId: string) => {
    if (!applicant || !updateApplicant) return;
    const final = validationQuickReason === 'Other (see details below)'
      ? validationCustomReason.trim()
      : validationQuickReason + (validationCustomReason.trim() ? ` — ${validationCustomReason.trim()}` : '');
    if (!final) return;
    const updated = (applicant.employmentFlags || []).map(f =>
      f.id === flagId ? { ...f, validated: true, validatedBy: currentUserName, validationReason: final, validatedAt: new Date().toISOString() } : f
    );
    updateApplicant(applicant.id, { employmentFlags: updated });
    addActivityLog?.({ applicantId: applicant.id, action: 'Employment Flag Validated', performedBy: currentUserName, department: 'Recruitment', details: `Flag validated with evidence: ${final}` });
    showToast?.('Flag marked as valid with evidence recorded.');
    setValidatingFlagId(null);
    setValidationQuickReason('');
    setValidationCustomReason('');
  };

  const isProgrammaticScroll = useRef(false);
  const scrollTimeout = useRef<number | null>(null);
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const topRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  // Auto-scroll the active tab button into view inside the horizontal nav bar
  useEffect(() => {
    const btn = tabButtonRefs.current[activeSection];
    if (btn) {
      btn.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }
  }, [activeSection]);

  // Robust, coordinated scroll listener for rock-solid active section tracking
  useEffect(() => {
    const container = topRef.current?.closest('[class*="overflow-y"]') as HTMLElement | null;
    if (!container) return;

    let ticking = false;

    const handleScroll = () => {
      setShowBackToTop(container.scrollTop > 350);

      if (isProgrammaticScroll.current) return;
      if (ticking) return;

      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (isProgrammaticScroll.current) return;

        // Check if user is scrolled near the bottom of the container
        const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
        if (isAtBottom) {
          setActiveSection(SECTIONS[SECTIONS.length - 1].id);
          return;
        }

        const containerRect = container.getBoundingClientRect();
        // Probe point below the sticky navigation bar (~90px below container top)
        const probeY = containerRect.top + 90;

        let currentActive = SECTIONS[0].id;
        for (let i = 0; i < SECTIONS.length; i++) {
          const s = SECTIONS[i];
          const el = sectionRefs.current[s.id];
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          if (rect.top <= probeY) {
            currentActive = s.id;
          } else {
            break;
          }
        }
        setActiveSection(currentActive);
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, []);

  const scrollTo = useCallback((id: string) => {
    const el = sectionRefs.current[id];
    if (!el) return;

    setActiveSection(id);
    isProgrammaticScroll.current = true;
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = window.setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 750);

    // Native scrollIntoView works perfectly when sections have scroll-mt utility classes
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const scrollToTop = useCallback(() => {
    const container = topRef.current?.closest('[class*="overflow-y"]') as HTMLElement | null;
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Flag resolution
  const openResolve = (flagId: string) => {
    if (resolvingFlagId === flagId) { setResolvingFlagId(null); return; }
    setResolvingFlagId(flagId);
    setSelectedQuickReason('');
    setCustomReason('');
  };

  const resolveFlag = (flagId: string) => {
    if (!applicant || !updateApplicant) return;
    const final = selectedQuickReason === 'Other (see details below)'
      ? customReason.trim()
      : selectedQuickReason + (customReason.trim() ? ` — ${customReason.trim()}` : '');
    if (!final) return;
    const updated = (applicant.employmentFlags || []).map(f =>
      f.id === flagId ? { ...f, dismissed: true, dismissedBy: currentUserName, dismissalReason: final, dismissedAt: new Date().toISOString() } : f
    );
    updateApplicant(applicant.id, { employmentFlags: updated });
    setResolvingFlagId(null);
    setSelectedQuickReason('');
    setCustomReason('');
  };

  if (!applicant) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
        <p className="text-slate-400 font-medium">No applicant selected</p>
      </div>
    );
  }

  const flags = applicant.employmentFlags || [];
  const activeFlags = flags.filter(f => !f.dismissed);
  const hasFlagWarning = activeFlags.length > 0;

  const getSectionBadge = (sectionId: string) => {
    switch (sectionId) {
      case 'employment':
        if (activeFlags.length > 0) {
          return (
            <span className="ml-1 px-1.5 py-0.2 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center gap-0.5 shadow-2xs">
              <AlertTriangle size={8} /> {activeFlags.length}
            </span>
          );
        }
        if (flags.length > 0 && flags.every(f => f.dismissed || f.validated)) {
          return (
            <span className="ml-1 w-3.5 h-3.5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[9px] shadow-2xs">
              ✓
            </span>
          );
        }
        if ((applicant?.employmentHistory || []).length > 0) {
          return (
            <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-medium ${activeSection === 'employment' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {applicant?.employmentHistory?.length}
            </span>
          );
        }
        return null;

      case 'skills': {
        const certCount = (applicant?.certificateRecords || []).length || (applicant?.certifications || []).length;
        const count = (applicant?.skills || []).length + certCount + (applicant?.trainings || []).length;
        if (count > 0) {
          return (
            <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-medium ${activeSection === 'skills' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {count}
            </span>
          );
        }
        return null;
      }

      case 'languages': {
        const langCount = (applicant?.languageRecords || []).length || ((applicant as any)?.languages || []).length;
        if (langCount > 0) {
          return (
            <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-medium ${activeSection === 'languages' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {langCount}
            </span>
          );
        }
        return null;
      }

      case 'education':
        if ((applicant?.education || []).length > 0) {
          return (
            <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-medium ${activeSection === 'education' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {applicant?.education?.length}
            </span>
          );
        }
        return null;

      case 'ids': {
        const totalDocs = (applicant?.identifications || []).length + (applicant?.requirements || []).length;
        if (totalDocs > 0) {
          const hasExpired = (applicant?.identifications || []).some(
            id => id.expiryDate && new Date(id.expiryDate) < new Date()
          ) || (applicant?.requirements || []).some(
            req => req.expiration_date && new Date(req.expiration_date) < new Date()
          );
          if (hasExpired) {
            return (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-bold shadow-2xs">
                Exp
              </span>
            );
          }
          return (
            <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-medium ${activeSection === 'ids' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {totalDocs}
            </span>
          );
        }
        return null;
      }

      case 'scores':
        if (applicant?.testScores) {
          let passed = false;
          if (applicant.testScores.allPassed !== undefined) {
            passed = Boolean(applicant.testScores.allPassed);
          } else if (applicant.testScores.tests && Object.keys(applicant.testScores.tests).length > 0) {
            passed = Object.values(applicant.testScores.tests).every((t: any) => Boolean(t.passed));
          } else if (evaluationTemplates.length > 0) {
            passed = evaluationTemplates.every(t => {
              const lower = t.name.toLowerCase();
              if (t.type === 'skills' || lower.includes('trade') || lower.includes('skill')) {
                return (applicant.testScores?.tradeSkills ?? 0) >= t.passingScore;
              }
              if (t.type === 'language' || lower.includes('english') || lower.includes('language')) {
                return ((applicant.testScores?.languageProficiency ?? applicant.testScores?.englishProficiency) ?? 0) >= t.passingScore;
              }
              if (t.type === 'iq' || lower.includes('iq') || lower.includes('aptitude')) {
                return (applicant.testScores?.iqAptitude ?? 0) >= t.passingScore;
              }
              return true;
            });
          } else {
            passed = ((applicant.testScores.englishProficiency ?? 0) >= 60) &&
                     ((applicant.testScores.tradeSkills ?? 0) >= 70) &&
                     ((applicant.testScores.iqAptitude ?? 0) >= 50);
          }
          return (
            <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${passed ? 'bg-emerald-500/20 text-emerald-600' : 'bg-red-500/20 text-red-500'}`}>
              {passed ? 'Pass' : 'Review'}
            </span>
          );
        }
        return null;

      case 'finances':
        if (expenses.length > 0) {
          return (
            <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeSection === 'finances' ? 'bg-[#0EA5E9]/30 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
              ₱{totalExpenses > 999 ? `${(totalExpenses / 1000).toFixed(0)}k` : totalExpenses}
            </span>
          );
        }
        return null;

      case 'activity':
        if (activityLogs.length > 0) {
          return (
            <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-medium ${activeSection === 'activity' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {activityLogs.length}
            </span>
          );
        }
        return null;

      default:
        return null;
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={topRef} className="w-full space-y-0 pb-20">

      {/* ── Profile Header card ──────────────────────────────────────────────── */}
      <div className="bg-[#0F172A] rounded-2xl overflow-hidden shadow-sm border border-slate-800">
        {/* Stopped Banner */}
        {(applicant.status === 'Processing Stopped') && (
          <div className="bg-red-600 px-6 py-2.5 flex items-center gap-2 text-sm text-white">
            <OctagonX size={15} className="flex-shrink-0" />
            <span><strong>Processing Stopped at Phase {applicant.stoppedPhase}</strong> · {applicant.stoppedBy} · {applicant.stoppedAt ? new Date(applicant.stoppedAt).toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' }) : '—'}</span>
          </div>
        )}
        {!(applicant.status === 'Processing Stopped') && hasFlagWarning && (
          <div className="bg-amber-500 px-6 py-2 flex items-center gap-2 text-sm text-white">
            <Flag size={14} className="flex-shrink-0" />
            <span><strong>{activeFlags.length} unresolved employment flag{activeFlags.length > 1 ? 's' : ''}</strong> — applicant cannot proceed to screening until resolved.</span>
          </div>
        )}
        <div className="px-6 py-5 flex items-start gap-5">
          {(applicant.photoDataUrl || applicant.photo)
            ? <img src={applicant.photoDataUrl || applicant.photo} alt="photo" className="w-20 h-24 object-cover rounded-xl border-2 border-white/20 flex-shrink-0" />
            : (
              <div className="w-20 h-24 rounded-xl bg-white/10 border-2 border-white/20 flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
                {(applicant.name || 'Applicant').split(' ').map(n => n ? n[0] : '').join('').slice(0,2)}
              </div>
            )
          }
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white leading-tight">{applicant.name}</h2>
              {onBack && (
                <button
                  onClick={onBack}
                  className="sm:hidden text-xs text-slate-300 hover:text-white flex items-center gap-1 border border-white/20 px-2 py-0.5 rounded-lg cursor-pointer bg-white/5"
                >
                  <ArrowLeft size={11} /> Back
                </button>
              )}
            </div>
            <p className="text-[#0EA5E9] text-sm mt-0.5 font-medium">{applicant.role}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-white/60">
              <span className="flex items-center gap-1"><IdCard size={11} /> {applicant.applicantCode || applicant.id}</span>
              {applicant.email && <span className="flex items-center gap-1"><Mail size={11} /> {applicant.email}</span>}
              {applicant.contact && <span className="flex items-center gap-1"><Phone size={11} /> {applicant.contact}</span>}
              {isEnriching && (
                <span className="flex items-center gap-1 text-[11px] text-sky-400 bg-sky-950/70 border border-sky-800/80 px-2 py-0.5 rounded-full animate-pulse ml-1">
                  <Loader2 size={10} className="animate-spin" /> Syncing full profile...
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {/* Phase Badge */}
              <span className="text-xs px-3 py-1 bg-sky-500/20 text-sky-300 rounded-full border border-sky-500/40 font-bold flex items-center gap-1.5">
                <span>Phase {applicant.phase} - {PHASE_TITLES[applicant.phase] || 'Registration & Screening'}</span>
              </span>

              {/* Status Badge */}
              <span className={`text-xs px-3 py-1 rounded-full border font-bold flex items-center gap-1.5 ${
                applicant.status === 'Provisional'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 ring-1 ring-amber-400/40'
                  : applicant.status === 'Processing Stopped'
                  ? 'bg-red-500/20 text-red-300 border-red-500/50'
                  : applicant.status.toLowerCase().includes('deployed') || applicant.status.toLowerCase().includes('completed')
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  applicant.status === 'Provisional'
                    ? 'bg-amber-400 animate-pulse'
                    : applicant.status === 'Processing Stopped'
                    ? 'bg-red-400'
                    : applicant.status.toLowerCase().includes('deployed') || applicant.status.toLowerCase().includes('completed')
                    ? 'bg-emerald-400'
                    : 'bg-indigo-400'
                }`} />
                <span className="text-white/60 font-medium">Status:</span>
                <span>{applicant.status}</span>
              </span>

              {applicant.jobOrder && applicant.jobOrder !== 'Unassigned' ? (
                <span className="text-xs px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30 font-semibold flex items-center gap-1.5">
                  <Briefcase size={11} /> {applicant.jobOrder}
                </span>
              ) : (
                <span className="text-xs px-2.5 py-1 bg-slate-700/50 text-slate-300 rounded-full border border-slate-600/40 font-medium flex items-center gap-1.5">
                  <Briefcase size={11} /> Unassigned
                </span>
              )}
            </div>
          </div>
          {/* Classification badges in header */}
          {applicant.applicantTypes && applicant.applicantTypes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {applicant.applicantTypes.map(code => {
                const meta: Record<string, { label: string; cls: string }> = {
                  FIRST_TIME_OFW:     { label: 'First-Time OFW',     cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
                  RETURNING_OFW:      { label: 'Returning OFW',      cls: 'bg-sky-500/20 text-sky-300 border-sky-500/30'             },
                  MUSLIM:             { label: 'Muslim',             cls: 'bg-violet-500/20 text-violet-300 border-violet-500/30'    },
                  INDIGENOUS_PEOPLES: { label: 'Indigenous Peoples', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30'      },
                };
                const m = meta[code] || { label: code, cls: 'bg-white/10 text-white/60 border-white/20' };
                return (
                  <span key={code} className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold flex items-center gap-1 ${m.cls}`}>
                    <Check size={9} />{m.label}
                    {code === 'INDIGENOUS_PEOPLES' && applicant.indigenousCommunity && ` (${applicant.indigenousCommunity})`}
                  </span>
                );
              })}
            </div>
          )}
          <div className="flex flex-col items-end gap-2">
            <div className="text-right text-xs text-white/40">
              <p>Handler: {applicant.currentHandler}</p>
              <p className="mt-0.5">{applicant.currentDepartment}</p>
              <p className="mt-0.5 italic">{applicant.lastUpdated}</p>
            </div>
            <div className="flex gap-2">
              {applicant.status === 'Processing Stopped' && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Trash2 size={13} /> {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
              {!(applicant.status === 'Processing Stopped') && updateApplicant && (
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
      </div>

      {/* ── Sticky section nav ────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-sm my-4 transition-all">
        <div className="flex items-center px-3 py-2 gap-2">
          <div className="flex-1 flex overflow-x-auto scrollbar-none items-center gap-1.5 py-0.5 px-0.5">
            {SECTIONS.map(s => {
              const isActive = activeSection === s.id;
              const badge = getSectionBadge(s.id);

              return (
                <button
                  key={s.id}
                  ref={el => { tabButtonRefs.current[s.id] = el; }}
                  onClick={() => scrollTo(s.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[#0F172A] text-white shadow-sm ring-1 ring-slate-900/10'
                      : 'text-slate-600 hover:text-[#0F172A] hover:bg-slate-100/80'
                  } ${s.id === 'employment' && hasFlagWarning ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
                >
                  <span className={isActive ? 'text-[#0EA5E9]' : 'text-slate-400'}>
                    {s.icon}
                  </span>
                  <span>{s.label}</span>
                  {badge}
                </button>
              );
            })}
          </div>

          {onEdit && (
            <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-slate-200 flex-shrink-0">
              <button 
                onClick={onEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-[#0EA5E9] hover:bg-slate-50 hover:border-slate-300 rounded-xl transition-all shadow-2xs text-xs font-semibold cursor-pointer"
              >
                <Edit2 size={13} />
                <span>Update Details</span>
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* ── Overview ──────────────────────────────────────────────────────────── */}
      <div ref={el => { sectionRefs.current['overview'] = el; }} id="overview" className="scroll-mt-24 pt-4 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <User size={16} className="text-[#0EA5E9]" />
          <h3 className="text-base font-bold text-[#0F172A] uppercase tracking-wider">Personal Overview</h3>
        </div>

        {/* Stopped notice */}
        {(applicant.status === 'Processing Stopped') && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <OctagonX size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-700">Processing Stopped at Phase {applicant.stoppedPhase}</p>
                <p className="text-xs text-red-600 mt-0.5">{applicant.stoppedReason}</p>
                <p className="text-xs text-red-400 mt-1">By {applicant.stoppedBy} · {applicant.stoppedAt ? new Date(applicant.stoppedAt).toLocaleString('en-PH') : '—'}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
            {[
              { label: 'Assigned Job Order', val: applicant.jobOrder && applicant.jobOrder !== 'Unassigned' ? applicant.jobOrder : 'Unassigned' },
              { label: 'Target Position',   val: applicant.role || '—' },
              { label: 'Date of Birth',  val: applicant.dateOfBirth },
              { label: 'Age',            val: applicant.age ? `${applicant.age} years old` : undefined },
              { label: 'Gender',         val: applicant.sex },
              { label: 'Civil Status',   val: applicant.civilStatus },
              { label: 'Religion',       val: applicant.religion },
              { label: 'Citizenship',    val: applicant.citizenship },
              { label: 'Height',         val: applicant.heightCm ? `${applicant.heightCm} cm` : undefined },
              { label: 'Weight',         val: applicant.weightKg ? `${applicant.weightKg} kg` : undefined },
              { label: 'Place of Birth', val: applicant.placeOfBirth },
              { label: 'Children',       val: applicant.noOfChildren !== undefined ? applicant.noOfChildren : 0 },
            ].map(f => (
              <div key={f.label}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{f.label}</p>
                <p className="text-sm font-medium text-[#0F172A]">{String(f.val || '—')}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 mt-4 pt-4 space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <MapPin size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
              <span className="text-[#0F172A]">{applicant.presentAddress || applicant.address || '—'}</span>
            </div>
            {applicant.provincialAddress && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin size={14} className="text-slate-300 mt-0.5 flex-shrink-0" />
                <span className="text-slate-500">{applicant.provincialAddress} <span className="text-xs text-slate-400">(provincial)</span></span>
              </div>
            )}
          </div>

          {/* Applicant Classification Badges */}
          {(applicant.applicantTypes && applicant.applicantTypes.length > 0) && (
            <div className="border-t border-slate-100 mt-4 pt-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Users size={11} /> Classification</p>
              <div className="flex flex-wrap gap-2">
                {applicant.applicantTypes.map(code => {
                  const meta: Record<string, { label: string; cls: string }> = {
                    FIRST_TIME_OFW:     { label: 'First-Time OFW',     cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
                    RETURNING_OFW:      { label: 'Returning OFW',      cls: 'bg-sky-100 text-sky-700 border-sky-200'             },
                    MUSLIM:             { label: 'Muslim',             cls: 'bg-violet-100 text-violet-700 border-violet-200'    },
                    INDIGENOUS_PEOPLES: { label: 'Indigenous Peoples', cls: 'bg-amber-100 text-amber-700 border-amber-200'      },
                  };
                  const m = meta[code] || { label: code, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
                  return (
                    <span key={code} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${m.cls}`}>
                      <Check size={10} />{m.label}
                    </span>
                  );
                })}
                {applicant.isIndigenous && applicant.indigenousCommunity && (
                  <span className="text-xs text-amber-600 font-medium ml-1">({applicant.indigenousCommunity})</span>
                )}
              </div>
            </div>
          )}

          {/* Emergency Contact */}
          {applicant.emergencyContactName && (
            <div className="border-t border-slate-100 mt-4 pt-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><HeartHandshake size={11} /> Emergency Contact</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="font-semibold text-[#0F172A]">{applicant.emergencyContactName}</span>
                {applicant.emergencyContactRelationship && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{applicant.emergencyContactRelationship}</span>}
                {applicant.emergencyContactNumber && (
                  <span className="flex items-center gap-1 text-slate-500"><Phone size={12} />{applicant.emergencyContactNumber}</span>
                )}
              </div>
            </div>
          )}

          {/* Social Media */}
          {(applicant.facebookUrl || applicant.whatsappNumber || applicant.linkedinUrl) && (
            <div className="border-t border-slate-100 mt-4 pt-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Share2 size={11} /> Social & Digital</p>
              <div className="flex flex-wrap gap-3">
                {applicant.facebookUrl && (
                  <a href={applicant.facebookUrl.startsWith('http') ? applicant.facebookUrl : `https://${applicant.facebookUrl}`} target="_blank" rel="noreferrer"
                     className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
                    <Globe size={13} /> Facebook <ExternalLink size={10} />
                  </a>
                )}
                {applicant.whatsappNumber && (
                  <a href={applicant.whatsappNumber.startsWith('http') ? applicant.whatsappNumber : `https://${applicant.whatsappNumber}`} target="_blank" rel="noreferrer"
                     className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-800 font-medium transition-colors">
                    <Phone size={13} /> WhatsApp <ExternalLink size={10} />
                  </a>
                )}
                {applicant.linkedinUrl && (
                  <a href={applicant.linkedinUrl.startsWith('http') ? applicant.linkedinUrl : `https://${applicant.linkedinUrl}`} target="_blank" rel="noreferrer"
                     className="flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-800 font-medium transition-colors">
                    <ExternalLink size={13} /> LinkedIn <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Employment History ─────────────────────────────────────────────────── */}
      <div ref={el => { sectionRefs.current['employment'] = el; }} id="employment" className="scroll-mt-24 pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase size={16} className="text-[#0EA5E9]" />
            <h3 className="text-base font-bold text-[#0F172A] uppercase tracking-wider">Employment History</h3>
            {flags.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500">
                {flags.filter(f => f.dismissed).length}/{flags.length} resolved
              </span>
            )}
          </div>
          {hasFlagWarning && (
            <span className="text-xs font-semibold text-amber-600 flex items-center gap-1">
              <AlertTriangle size={13} /> {activeFlags.length} flag{activeFlags.length > 1 ? 's' : ''} need resolution
            </span>
          )}
        </div>

        {/* Interview guidance banner when flags exist */}
        {hasFlagWarning && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
            <p className="font-semibold mb-1 flex items-center gap-1.5"><MessageSquare size={14} /> Interview Guidance</p>
            <ul className="text-xs space-y-1 list-disc ml-4">
              {activeFlags.map(f => {
                const meta = FLAG_META[f.type];
                return (
                  <li key={f.id}>
                    <strong>{meta.label}:</strong> {
                      f.type === 'gap' ? 'Ask: "What were you doing during this period? Can you provide any documentation?"' :
                      f.type === 'short_stint' ? 'Ask: "Why did you leave so quickly? Was it voluntary or were you let go?"' :
                      f.type === 'red_flag_resignation' ? 'Ask: "Can you walk me through the circumstances of leaving this role? We need full clarity before proceeding."' :
                      f.type === 'overlap' ? 'Ask: "Our records show overlapping dates here. Were you working two jobs simultaneously?"' :
                      'Ask: "We noticed a significant change in your job level here. Can you explain what happened?"'
                    }
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {isEnriching && (!applicant.employmentHistory || applicant.employmentHistory.length === 0) ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/4"></div>
            <div className="h-16 bg-slate-100 rounded-lg"></div>
            <div className="h-16 bg-slate-100 rounded-lg"></div>
          </div>
        ) : (applicant.employmentHistory || []).length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-10 text-center text-slate-400 text-sm">No employment history recorded</div>
        ) : (
          <div className="space-y-3">
            {(applicant.employmentHistory || []).map((rec, idx) => {
              const start = rec.dateStarted || (rec as any).startDate || '';
              const end = rec.dateEnded || (rec as any).endDate || '';
              const duration = rec.isPresent
                ? durationLabel(monthsBetween(start, new Date().toISOString().slice(0, 10)))
                : (start && end ? durationLabel(monthsBetween(start, end)) : '');
              const recFlags = flags.filter(f => (f.relatedJobIds || []).includes(rec.id));
              const hasActiveFlag = recFlags.some(f => !f.dismissed);

              return (
                <div key={rec.id} className={`bg-white rounded-xl border overflow-hidden transition-all ${hasActiveFlag ? 'border-amber-300' : 'border-slate-200'}`}>
                  <div className="flex items-start gap-4 p-4">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className="font-bold text-[#0F172A]">{rec.company}</p>
                          <p className="text-sm text-slate-600">{rec.position}</p>
                        </div>
                        {rec.isPresent && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">Current</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Globe size={11} /> {rec.country}</span>
                        <span className="flex items-center gap-1"><Calendar size={11} /> {start} — {rec.isPresent ? 'Present' : (end || '—')}</span>
                        {duration && <span className="font-semibold text-[#0F172A]">({duration})</span>}
                        {rec.reasonForLeaving && !rec.isPresent && (
                          <span className="text-slate-400">Left: {rec.reasonForLeaving}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Flags on this record */}
                  {recFlags.length > 0 && (
                    <div className="border-t border-slate-100 divide-y divide-slate-100">
                      {recFlags.map(flag => {
                        const meta = FLAG_META[flag.type];
                        const isOpen = resolvingFlagId === flag.id;
                        const isValidating = validatingFlagId === flag.id;
                        const resolveReady = selectedQuickReason && (selectedQuickReason !== 'Other (see details below)' || customReason.trim());
                        const validateReady = validationQuickReason && (validationQuickReason !== 'Other (see details below)' || validationCustomReason.trim());
                        return (
                          <div key={flag.id} className={`transition-all ${flag.validated ? 'bg-emerald-50/40' : flag.dismissed ? 'bg-slate-50/60' : isOpen || isValidating ? 'bg-[#0EA5E9]/3' : 'bg-amber-50/50'}`}>
                            {/* Flag row */}
                            <div className="flex items-start gap-3 px-4 py-3">
                              <div className="mt-0.5 flex-shrink-0" style={{ color: flag.validated ? '#10B981' : flag.dismissed ? '#94a3b8' : meta.color }}>
                                {flag.validated ? <BadgeCheck size={14} /> : meta.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: flag.validated ? '#d1fae5' : flag.dismissed ? '#f1f5f9' : meta.color + '18', color: flag.validated ? '#059669' : flag.dismissed ? '#94a3b8' : meta.color }}>{meta.label}</span>
                                  {!flag.dismissed && !flag.validated && (
                                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: flag.severity === 'critical' ? '#FEE2E2' : '#f1f5f9', color: flag.severity === 'critical' ? '#EF4444' : '#94a3b8' }}>
                                      {flag.severity === 'critical' ? 'CRITICAL' : 'WARNING'}
                                    </span>
                                  )}
                                  {flag.dismissed && !flag.validated && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 size={11} /> Resolved</span>}
                                  {flag.validated && <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1"><BadgeCheck size={11} /> Validated with Evidence</span>}
                                </div>
                                <p className="text-xs text-slate-600 mt-1">{flag.description}</p>
                                {flag.dismissed && flag.dismissalReason && (
                                  <p className="text-xs text-slate-400 mt-1 italic"><strong className="text-slate-500">{flag.dismissedBy}:</strong> {flag.dismissalReason}</p>
                                )}
                                {flag.validated && flag.validationReason && (
                                  <p className="text-xs text-emerald-600 mt-1 flex items-start gap-1"><BadgeCheck size={11} className="mt-0.5 flex-shrink-0" /><span><strong>{flag.validatedBy}:</strong> {flag.validationReason}</span></p>
                                )}
                              </div>
                              {/* Action buttons */}
                              {updateApplicant && !flag.validated && (
                                <div className="flex flex-col gap-1 flex-shrink-0">
                                  {!flag.dismissed && (
                                    <button
                                      onClick={() => { openResolve(flag.id); setValidatingFlagId(null); }}
                                      className={`text-xs px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-colors ${isOpen ? 'bg-[#0EA5E9] text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-[#0EA5E9] hover:text-[#0EA5E9]'}`}
                                    >
                                      <MessageSquare size={11} /> {isOpen ? 'Cancel' : 'Resolve'}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => { setValidatingFlagId(isValidating ? null : flag.id); setResolvingFlagId(null); setValidationQuickReason(''); setValidationCustomReason(''); }}
                                    className={`text-xs px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-colors ${isValidating ? 'bg-[#10B981] text-white' : 'bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}
                                  >
                                    <BadgeCheck size={11} /> {isValidating ? 'Cancel' : 'Mark as Valid'}
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Inline resolution */}
                            {isOpen && !flag.dismissed && updateApplicant && (
                              <div className="px-4 pb-4 pt-2 bg-white border-t border-[#0EA5E9]/20 space-y-3">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Select Resolution Reason</p>
                                <div className="flex flex-wrap gap-2">
                                  {QUICK_REASONS.map(r => (
                                    <button key={r} onClick={() => setSelectedQuickReason(r)} className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${selectedQuickReason === r ? 'bg-[#0EA5E9] text-white border-[#0EA5E9]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#0EA5E9] hover:text-[#0EA5E9]'}`}>{r}</button>
                                  ))}
                                </div>
                                {selectedQuickReason && (
                                  <textarea value={customReason} onChange={e => setCustomReason(e.target.value)} rows={2} placeholder={selectedQuickReason === 'Other (see details below)' ? 'Describe the resolution…' : 'Additional details (optional)…'} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/30 focus:border-[#0EA5E9] resize-none" />
                                )}
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => { setResolvingFlagId(null); setSelectedQuickReason(''); setCustomReason(''); }} className="px-3 py-1.5 text-xs font-medium text-slate-500">Cancel</button>
                                  <button onClick={() => resolveFlag(flag.id)} disabled={!resolveReady} className="flex items-center gap-1.5 px-4 py-1.5 bg-[#10B981] hover:bg-[#059669] disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"><CheckCircle2 size={13} /> Mark Resolved</button>
                                </div>
                              </div>
                            )}

                            {/* Inline validation (Mark as Valid with evidence) */}
                            {isValidating && !flag.validated && updateApplicant && (
                              <div className="px-4 pb-4 pt-2 bg-white border-t border-emerald-200 space-y-3">
                                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5"><BadgeCheck size={12} /> Mark as Valid — Provide Evidence</p>
                                <div className="flex flex-wrap gap-2">
                                  {VALIDATION_REASONS.map(r => (
                                    <button key={r} onClick={() => setValidationQuickReason(r)} className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${validationQuickReason === r ? 'bg-[#10B981] text-white border-[#10B981]' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400 hover:text-emerald-600'}`}>{r}</button>
                                  ))}
                                </div>
                                {validationQuickReason && (
                                  <textarea value={validationCustomReason} onChange={e => setValidationCustomReason(e.target.value)} rows={2} placeholder={validationQuickReason === 'Other (see details below)' ? 'Describe the evidence…' : 'Additional details (optional)…'} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 resize-none" />
                                )}
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => { setValidatingFlagId(null); setValidationQuickReason(''); setValidationCustomReason(''); }} className="px-3 py-1.5 text-xs font-medium text-slate-500">Cancel</button>
                                  <button onClick={() => validateFlag(flag.id)} disabled={!validateReady} className="flex items-center gap-1.5 px-4 py-1.5 bg-[#10B981] hover:bg-[#059669] disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"><BadgeCheck size={13} /> Confirm Valid</button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* General / Standalone Employment Flags (e.g. career gaps not tied to a single employer) */}
        {(() => {
          const standaloneFlags = flags.filter(f => (f.relatedJobIds || []).length === 0);
          if (standaloneFlags.length === 0) return null;
          return (
            <div className="bg-white rounded-xl border border-amber-300 overflow-hidden divide-y divide-slate-100">
              <div className="px-4 py-2.5 bg-amber-50/70 border-b border-amber-200/60 flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle size={13} className="text-amber-600" /> General Employment Flags ({standaloneFlags.length})
                </span>
              </div>
              {standaloneFlags.map(flag => {
                const meta = FLAG_META[flag.type] || { label: 'Notice', icon: <AlertTriangle size={14} />, color: '#F59E0B' };
                const isOpen = resolvingFlagId === flag.id;
                const isValidating = validatingFlagId === flag.id;
                const resolveReady = selectedQuickReason && (selectedQuickReason !== 'Other (see details below)' || customReason.trim());
                const validateReady = validationQuickReason && (validationQuickReason !== 'Other (see details below)' || validationCustomReason.trim());
                return (
                  <div key={flag.id} className={`transition-all ${flag.validated ? 'bg-emerald-50/40' : flag.dismissed ? 'bg-slate-50/60' : isOpen || isValidating ? 'bg-[#0EA5E9]/3' : 'bg-amber-50/50'}`}>
                    <div className="flex items-start gap-3 px-4 py-3">
                      <div className="mt-0.5 flex-shrink-0" style={{ color: flag.validated ? '#10B981' : flag.dismissed ? '#94a3b8' : meta.color }}>
                        {flag.validated ? <BadgeCheck size={14} /> : meta.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: flag.validated ? '#d1fae5' : flag.dismissed ? '#f1f5f9' : meta.color + '18', color: flag.validated ? '#059669' : flag.dismissed ? '#94a3b8' : meta.color }}>{meta.label}</span>
                          {!flag.dismissed && !flag.validated && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: flag.severity === 'critical' ? '#FEE2E2' : '#f1f5f9', color: flag.severity === 'critical' ? '#EF4444' : '#94a3b8' }}>
                              {flag.severity === 'critical' ? 'CRITICAL' : 'WARNING'}
                            </span>
                          )}
                          {flag.dismissed && !flag.validated && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 size={11} /> Resolved</span>}
                          {flag.validated && <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1"><BadgeCheck size={11} /> Validated with Evidence</span>}
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{flag.description}</p>
                        {(flag as any).startDate && (flag as any).endDate && (
                          <p className="text-xs text-slate-400 mt-0.5 font-mono">Period: {(flag as any).startDate} to {(flag as any).endDate}</p>
                        )}
                        {flag.dismissed && flag.dismissalReason && (
                          <p className="text-xs text-slate-400 mt-1 italic"><strong className="text-slate-500">{flag.dismissedBy}:</strong> {flag.dismissalReason}</p>
                        )}
                        {flag.validated && flag.validationReason && (
                          <p className="text-xs text-emerald-600 mt-1 flex items-start gap-1"><BadgeCheck size={11} className="mt-0.5 flex-shrink-0" /><span><strong>{flag.validatedBy}:</strong> {flag.validationReason}</span></p>
                        )}
                      </div>
                      {/* Action buttons */}
                      {updateApplicant && !flag.validated && (
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          {!flag.dismissed && (
                            <button
                              onClick={() => { openResolve(flag.id); setValidatingFlagId(null); }}
                              className={`text-xs px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-colors ${isOpen ? 'bg-[#0EA5E9] text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-[#0EA5E9] hover:text-[#0EA5E9]'}`}
                            >
                              <MessageSquare size={11} /> {isOpen ? 'Cancel' : 'Resolve'}
                            </button>
                          )}
                          <button
                            onClick={() => { setValidatingFlagId(isValidating ? null : flag.id); setResolvingFlagId(null); setValidationQuickReason(''); setValidationCustomReason(''); }}
                            className={`text-xs px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-colors ${isValidating ? 'bg-[#10B981] text-white' : 'bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}
                          >
                            <BadgeCheck size={11} /> {isValidating ? 'Cancel' : 'Mark as Valid'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Inline resolution */}
                    {isOpen && !flag.dismissed && updateApplicant && (
                      <div className="px-4 pb-4 pt-2 bg-white border-t border-[#0EA5E9]/20 space-y-3">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Select Resolution Reason</p>
                        <div className="flex flex-wrap gap-2">
                          {QUICK_REASONS.map(r => (
                            <button key={r} onClick={() => setSelectedQuickReason(r)} className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${selectedQuickReason === r ? 'bg-[#0EA5E9] text-white border-[#0EA5E9]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#0EA5E9] hover:text-[#0EA5E9]'}`}>{r}</button>
                          ))}
                        </div>
                        {selectedQuickReason && (
                          <textarea value={customReason} onChange={e => setCustomReason(e.target.value)} rows={2} placeholder={selectedQuickReason === 'Other (see details below)' ? 'Describe the resolution…' : 'Additional details (optional)…'} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/30 focus:border-[#0EA5E9] resize-none" />
                        )}
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setResolvingFlagId(null); setSelectedQuickReason(''); setCustomReason(''); }} className="px-3 py-1.5 text-xs font-medium text-slate-500">Cancel</button>
                          <button onClick={() => resolveFlag(flag.id)} disabled={!resolveReady} className="flex items-center gap-1.5 px-4 py-1.5 bg-[#10B981] hover:bg-[#059669] disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"><CheckCircle2 size={13} /> Mark Resolved</button>
                        </div>
                      </div>
                    )}

                    {/* Inline validation */}
                    {isValidating && !flag.validated && updateApplicant && (
                      <div className="px-4 pb-4 pt-2 bg-white border-t border-emerald-200 space-y-3">
                        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5"><BadgeCheck size={12} /> Mark as Valid — Provide Evidence</p>
                        <div className="flex flex-wrap gap-2">
                          {VALIDATION_REASONS.map(r => (
                            <button key={r} onClick={() => setValidationQuickReason(r)} className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${validationQuickReason === r ? 'bg-[#10B981] text-white border-[#10B981]' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400 hover:text-emerald-600'}`}>{r}</button>
                          ))}
                        </div>
                        {validationQuickReason && (
                          <textarea value={validationCustomReason} onChange={e => setValidationCustomReason(e.target.value)} rows={2} placeholder={validationQuickReason === 'Other (see details below)' ? 'Describe the evidence…' : 'Additional details (optional)…'} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 resize-none" />
                        )}
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setValidatingFlagId(null); setValidationQuickReason(''); setValidationCustomReason(''); }} className="px-3 py-1.5 text-xs font-medium text-slate-500">Cancel</button>
                          <button onClick={() => validateFlag(flag.id)} disabled={!validateReady} className="flex items-center gap-1.5 px-4 py-1.5 bg-[#10B981] hover:bg-[#059669] disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"><BadgeCheck size={13} /> Confirm Valid</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* ── Skills & Certifications ────────────────────────────────────────────── */}
      <div ref={el => { sectionRefs.current['skills'] = el; }} id="skills" className="scroll-mt-24 pt-6 space-y-5">
        <div className="flex items-center gap-2">
          <Award size={16} className="text-[#0EA5E9]" />
          <h3 className="text-base font-bold text-[#0F172A] uppercase tracking-wider">Skills & Certifications</h3>
        </div>

        {/* Skills */}
        {(applicant.skills || []).length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Core Skills</p>
            <div className="flex flex-wrap gap-2">
              {(applicant.skills || []).map(s => (
                <span key={s} className="text-sm px-3 py-1.5 bg-[#0EA5E9]/10 text-[#0284C7] rounded-full font-medium border border-[#0EA5E9]/20">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Certificates */}
        {(() => {
          const certs = (applicant.certificateRecords && applicant.certificateRecords.length > 0)
            ? applicant.certificateRecords
            : (Array.isArray(applicant.certifications) && applicant.certifications.length > 0)
              ? applicant.certifications.map((c: any, idx: number) => ({
                  id: `cert-fallback-${idx}`,
                  title: typeof c === 'string' ? c : (c.title || c.name || 'Certificate'),
                  issuedBy: typeof c === 'object' ? (c.issuedBy || c.issued_by || 'Accredited Issuer') : 'Accredited Issuer',
                  serialNo: typeof c === 'object' ? (c.serialNo || c.serial_no || '—') : '—',
                  noOfHours: typeof c === 'object' ? String(c.noOfHours || c.no_of_hours || '—') : '—',
                  competencyDateIssued: typeof c === 'object' ? (c.competencyDateIssued || c.issue_date || '—') : '—',
                  expiryDate: typeof c === 'object' ? (c.expiryDate || c.expiry_date || 'N/A') : 'N/A',
                  proofDocumentUrl: typeof c === 'object' ? (c.proofDocumentUrl || c.proof_url) : undefined
                }))
              : [];
          if (certs.length === 0) return null;
          return (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Certificates & Licenses ({certs.length})</p>
              {certs.map(row => (
                <div key={row.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[#0F172A] text-sm">{row.title}</p>
                        {row.proofDocumentUrl && (
                          <span className="flex items-center gap-1 text-xs text-[#10B981] bg-emerald-50 px-2 py-0.5 rounded-full"><FileCheck size={11} /> Proof uploaded</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">Issued by {row.issuedBy}</p>
                    </div>
                    <code className="text-xs text-[#0EA5E9] bg-blue-50 px-2 py-1 rounded flex-shrink-0">{row.serialNo || '—'}</code>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-2.5 text-xs text-slate-500">
                    <div><span className="text-slate-400">Hours: </span>{row.noOfHours || '—'}</div>
                    <div><span className="text-slate-400">Issued: </span>{row.competencyDateIssued || '—'}</div>
                    <div><span className="text-slate-400">Expires: </span>{row.expiryDate && row.expiryDate !== 'No expiry' ? row.expiryDate : 'N/A'}</div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Trainings */}
        {(applicant.trainings || []).length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Trainings Attended ({applicant.trainings?.length})</p>
            {(applicant.trainings || []).map(row => (
              <div key={row.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[#0F172A] text-sm">{row.trainingName}</p>
                      {row.proofDocumentUrl && (
                        <span className="flex items-center gap-1 text-xs text-[#10B981] bg-emerald-50 px-2 py-0.5 rounded-full"><FileCheck size={11} /> Proof uploaded</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Conducted by {row.conductedBy}</p>
                  </div>
                  <code className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded flex-shrink-0">{row.certNo || '—'}</code>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-2.5 text-xs text-slate-500">
                  <div><span className="text-slate-400">Duration: </span>{row.duration || '—'}</div>
                  <div><span className="text-slate-400">Hours: </span>{row.noOfHours || '—'}</div>
                  <div><span className="text-slate-400">Skills: </span>{row.skillsAcquired || '—'}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {isEnriching && (!applicant.skills || applicant.skills.length === 0) && (!applicant.certificateRecords || applicant.certificateRecords.length === 0) && (!applicant.certifications || applicant.certifications.length === 0) && (!applicant.trainings || applicant.trainings.length === 0) ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/4"></div>
            <div className="flex gap-2">
              <div className="h-8 bg-slate-100 rounded-lg w-24"></div>
              <div className="h-8 bg-slate-100 rounded-lg w-28"></div>
              <div className="h-8 bg-slate-100 rounded-lg w-20"></div>
            </div>
            <div className="h-20 bg-slate-100 rounded-lg"></div>
          </div>
        ) : (applicant.skills || []).length === 0 && (applicant.certificateRecords || []).length === 0 && (applicant.certifications || []).length === 0 && (applicant.trainings || []).length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-10 text-center text-slate-400 text-sm">No skills or certificates recorded</div>
        ) : null}
      </div>

      {/* ── Languages ─────────────────────────────────────────────────────────── */}
      <div ref={el => { sectionRefs.current['languages'] = el; }} id="languages" className="scroll-mt-24 pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Languages size={16} className="text-[#0EA5E9]" />
          <h3 className="text-base font-bold text-[#0F172A] uppercase tracking-wider">Language Proficiency</h3>
        </div>
        {(() => {
          const rawLangs = (applicant as any)?.languages;
          const langs: LanguageRecord[] = (applicant.languageRecords && applicant.languageRecords.length > 0)
            ? applicant.languageRecords
            : (Array.isArray(rawLangs) && rawLangs.length > 0)
              ? rawLangs.map((l: any, idx: number): LanguageRecord => {
                  const langName = typeof l === 'string' ? l : (l.language || l.language_name || 'English');
                  const comp = typeof l === 'object' ? (l.competency || l.fluency_level || 'Conversational') : 'Conversational';
                  return {
                    id: `lang-fallback-${idx}`,
                    language: langName,
                    competency: comp,
                    spokenRating: typeof l === 'object' && typeof l.spokenRating === 'number' ? l.spokenRating : 7,
                    writtenRating: typeof l === 'object' && typeof l.writtenRating === 'number' ? l.writtenRating : 7
                  };
                })
              : [];
          if (isEnriching && langs.length === 0) {
            return (
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                <div className="h-10 bg-slate-100 rounded-lg"></div>
                <div className="h-10 bg-slate-100 rounded-lg"></div>
              </div>
            );
          }
          if (langs.length === 0) {
            return <div className="bg-white rounded-xl border border-slate-200 py-10 text-center text-slate-400 text-sm">No language records</div>;
          }
          return (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_1fr_1fr] text-[10px] font-bold text-slate-400 uppercase tracking-wider px-5 py-2.5 bg-slate-50 border-b border-slate-100">
                <span>Language</span><span>Competency</span><span>Spoken</span><span>Written</span>
              </div>
              {langs.map((row: LanguageRecord, idx: number) => (
                <div key={row.id} className={`grid grid-cols-[1fr_1fr_1fr_1fr] items-center px-5 py-3.5 ${idx > 0 ? 'border-t border-slate-100' : ''}`}>
                  <span className="font-semibold text-sm text-[#0F172A]">{row.language}</span>
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full w-fit">{row.competency}</span>
                  <div className="flex items-center gap-2 pr-4">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-[#0EA5E9]" style={{ width: `${row.spokenRating * 10}%` }} /></div>
                    <span className="text-xs font-bold text-[#0EA5E9] w-8 text-right">{row.spokenRating}/10</span>
                  </div>
                  <div className="flex items-center gap-2 pr-4">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-[#8B5CF6]" style={{ width: `${row.writtenRating * 10}%` }} /></div>
                    <span className="text-xs font-bold text-[#8B5CF6] w-8 text-right">{row.writtenRating}/10</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* ── Education ─────────────────────────────────────────────────────────── */}
      <div ref={el => { sectionRefs.current['education'] = el; }} id="education" className="scroll-mt-24 pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <GraduationCap size={16} className="text-[#0EA5E9]" />
          <h3 className="text-base font-bold text-[#0F172A] uppercase tracking-wider">Educational Background</h3>
        </div>
        {isEnriching && (!applicant.education || applicant.education.length === 0) ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/4"></div>
            <div className="h-14 bg-slate-100 rounded-lg"></div>
          </div>
        ) : (applicant.education || []).length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-10 text-center text-slate-400 text-sm">No education records</div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {(applicant.education || []).map((row, idx) => (
              <div key={row.id} className={`flex items-start gap-4 px-5 py-4 ${idx > 0 ? 'border-t border-slate-100' : ''}`}>
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <GraduationCap size={14} className="text-slate-500" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#0F172A] text-sm">{row.school}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{row.course}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{row.level}</span>
                  <p className="text-xs text-slate-400 mt-1">{row.yearGraduated}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── IDs & Documents ────────────────────────────────────────────────────── */}
      <div ref={el => { sectionRefs.current['ids'] = el; }} id="ids" className="scroll-mt-24 pt-6 space-y-5">
        <div className="flex items-center gap-2">
          <IdCard size={16} className="text-[#0EA5E9]" />
          <h3 className="text-base font-bold text-[#0F172A] uppercase tracking-wider">Identifications & Documents</h3>
        </div>

        {/* Government Identifications */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Government Identifications ({applicant.identifications?.length || 0})</p>
          {isEnriching && (!applicant.identifications || applicant.identifications.length === 0) ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/4"></div>
              <div className="h-12 bg-slate-100 rounded-lg"></div>
              <div className="h-12 bg-slate-100 rounded-lg"></div>
            </div>
          ) : (applicant.identifications || []).length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 py-6 text-center text-slate-400 text-sm">No identification records</div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              {(applicant.identifications || []).map((row) => {
                const isExpired = row.expiryDate && new Date(row.expiryDate) < new Date();
                return (
                  <div key={row.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <IdCard size={14} className="text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-[#0F172A]">{row.type}</p>
                        {row.proofDocumentUrl && (
                          <span className="flex items-center gap-1 text-xs text-[#10B981]"><FileCheck size={11} /> Scan uploaded</span>
                        )}
                      </div>
                      <code className="text-xs text-[#0EA5E9] font-mono">{row.identificationNo || '—'}</code>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {row.expiryDate && row.expiryDate !== 'No expiry' && row.expiryDate !== 'N/A' ? (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isExpired ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
                          {isExpired ? '⚠ Expired: ' : 'Exp: '}{row.expiryDate}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">N/A</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Regulatory & Compliance Requirements from Supabase */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
            <FileCheck size={13} className="text-[#0EA5E9]" /> Regulatory &amp; Compliance Clearances ({applicant.requirements?.length || 0})
          </p>
          {(applicant.requirements || []).length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 py-6 text-center text-slate-400 text-sm">
              No regulatory or compliance clearance records
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              {(applicant.requirements || []).map((req, idx) => {
                const statusNormalized = (req.status || 'PENDING').toUpperCase();
                const isVerified = statusNormalized === 'VERIFIED';
                const isSubmitted = statusNormalized === 'SUBMITTED' || statusNormalized === 'UNDER_REVIEW';
                const hasValidExpiry = Boolean(req.expiration_date && req.expiration_date !== 'No expiry' && req.expiration_date !== 'N/A');
                const isExpired = Boolean(hasValidExpiry && req.expiration_date && new Date(req.expiration_date) < new Date());
                return (
                  <div key={req.applicant_req_id || `req-${idx}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isVerified ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                      <FileCheck size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-[#0F172A]">{req.name}</p>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                          {req.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        {req.issue_date && <span>Issued: {req.issue_date}</span>}
                        <span>
                          Expires:{' '}
                          {hasValidExpiry ? (
                            <span className={isExpired ? 'text-red-500 font-semibold' : ''}>
                              {req.expiration_date} {isExpired && '(Expired)'}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">N/A</span>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                        isVerified
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : isSubmitted
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {req.status || 'PENDING'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Test Scores ───────────────────────────────────────────────────────── */}
      <div ref={el => { sectionRefs.current['scores'] = el; }} id="scores" className="scroll-mt-24 pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-[#0EA5E9]" />
          <h3 className="text-base font-bold text-[#0F172A] uppercase tracking-wider">Test Scores</h3>
        </div>
        {hasFlagWarning && !(applicant.status === 'Processing Stopped') && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-amber-700">
            <ShieldAlert size={16} className="flex-shrink-0" />
            <span><strong>{activeFlags.length}</strong> unresolved employment flag{activeFlags.length > 1 ? 's' : ''}. Screening is blocked until resolved.</span>
          </div>
        )}
        {applicant.testScores ? (
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            {applicant.testScores.overallScore !== undefined && (
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Candidate Weighted Aggregate</span>
                  <p className="text-xs text-slate-400">Calculated from agency evaluation scoring weights</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-[#0EA5E9]">{applicant.testScores.overallScore}%</span>
                  <span className={`block text-[11px] font-bold ${applicant.testScores.allPassed ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {applicant.testScores.allPassed ? '✓ All Passing Marks Met' : '⚠️ Below Passing Benchmark'}
                  </span>
                </div>
              </div>
            )}

            {/* Dynamic test cards */}
            {(() => {
              const testItems: Array<{
                label: string;
                val: number | string | undefined;
                pass: number;
                max: number;
                weight?: number;
                color: string;
                passed?: boolean;
                scoringType: 'numeric' | 'pass_fail';
                statusText?: string;
              }> = [];
              const colors = ['#F59E0B', '#10B981', '#EC4899', '#8B5CF6', '#EF4444', '#0EA5E9', '#64748B'];

              if (applicant.testScores?.tests && Object.keys(applicant.testScores.tests).length > 0) {
                Object.values(applicant.testScores.tests).forEach((t: any, i) => {
                  const rawStatus = String(t.statusText || '').toLowerCase();
                  const isPF = t.scoringType === 'pass_fail' || rawStatus.includes('pass') || rawStatus.includes('fail') || t.type === 'medical' || String(t.name || '').toLowerCase().includes('medical');

                  let passVal = t.passed;
                  if (typeof passVal !== 'boolean') {
                    if (isPF) {
                      passVal = rawStatus.includes('pass') || rawStatus.includes('suit') || (typeof t.score === 'number' && t.score > 0);
                    } else if (typeof t.score === 'number') {
                      passVal = t.score >= (t.passingScore ?? 60);
                    }
                  } else if (!isPF && typeof t.score === 'number' && typeof t.passingScore === 'number') {
                    passVal = t.score >= t.passingScore;
                  }

                  testItems.push({
                    label: t.name,
                    val: t.score,
                    pass: t.passingScore ?? 60,
                    max: t.maxScore || 100,
                    weight: typeof t.weight === 'number' ? t.weight : (typeof t.weight_percentage === 'number' ? t.weight_percentage : undefined),
                    passed: passVal,
                    scoringType: isPF ? 'pass_fail' : 'numeric',
                    statusText: t.statusText,
                    color: colors[i % colors.length],
                  });
                });
              } else if (evaluationTemplates.length > 0) {
                evaluationTemplates.forEach((t, i) => {
                  const lower = t.name.toLowerCase();
                  let val: any = undefined;
                  const isPF = t.scoringType === 'pass_fail' || lower.includes('medical');
                  if (t.type === 'skills' || lower.includes('trade') || lower.includes('skill')) {
                    val = applicant.testScores?.tradeSkills;
                  } else if (t.type === 'language' || lower.includes('english') || lower.includes('language')) {
                    val = applicant.testScores?.languageProficiency ?? applicant.testScores?.englishProficiency;
                  } else if (t.type === 'iq' || lower.includes('iq') || lower.includes('aptitude')) {
                    val = applicant.testScores?.iqAptitude;
                  } else if (applicant.testScores && (applicant.testScores as any)[t.id] !== undefined) {
                    val = (applicant.testScores as any)[t.id];
                  }

                  let passVal: boolean | undefined = undefined;
                  if (typeof val === 'number') {
                    passVal = isPF ? val > 0 : val >= (t.passingScore ?? 60);
                  }

                  testItems.push({
                    label: t.name,
                    val,
                    pass: t.passingScore ?? 60,
                    max: t.maxScore || 100,
                    weight: t.weight ?? (t as any).weight_percentage,
                    passed: passVal,
                    scoringType: isPF ? 'pass_fail' : 'numeric',
                    color: colors[i % colors.length],
                  });
                });
              } else {
                testItems.push(
                  { label: 'English Proficiency', val: applicant.testScores?.englishProficiency, pass: 60, max: 100, color: '#0EA5E9', scoringType: 'numeric' },
                  { label: 'Trade / Skills Test', val: applicant.testScores?.tradeSkills, pass: 70, max: 100, color: '#F59E0B', scoringType: 'numeric' },
                  { label: 'IQ / Aptitude', val: applicant.testScores?.iqAptitude, pass: 50, max: 100, color: '#8B5CF6', scoringType: 'numeric' }
                );
              }

              return testItems.map(s => {
                const isPassFail = s.scoringType === 'pass_fail';
                const hasScore = typeof s.val === 'number' && !isNaN(s.val);
                
                let isPass = false;
                if (typeof s.passed === 'boolean') {
                  isPass = s.passed;
                } else if (isPassFail) {
                  isPass = hasScore ? (s.val as number) > 0 : Boolean(s.statusText?.toLowerCase().includes('pass'));
                } else if (hasScore) {
                  isPass = (s.val as number) >= s.pass;
                }

                const pct = isPassFail
                  ? (isPass ? 100 : (hasScore || s.passed !== undefined ? 0 : 0))
                  : (hasScore ? Math.min(100, Math.max(0, ((s.val as number) / (s.max || 100)) * 100)) : 0);

                const hasRecordedResult = hasScore || s.passed !== undefined || Boolean(s.statusText);

                return (
                  <div key={s.label} className="flex items-center gap-4">
                    <div className="w-52 flex-shrink-0">
                      <p className="text-xs font-semibold text-slate-700 truncate" title={s.label}>{s.label}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[11px] font-bold ${!hasRecordedResult ? 'text-slate-400' : isPass ? 'text-[#10B981]' : 'text-red-500'}`}>
                          {!hasRecordedResult ? 'Pending' : isPass ? '✓ Pass' : '✗ Fail'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {isPassFail ? `(Pass/Fail${s.weight ? ` • ${s.weight}% wt` : ''})` : `(≥${s.pass}%${s.weight ? ` • ${s.weight}% wt` : ''})`}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: isPass ? '#10B981' : (hasRecordedResult ? '#EF4444' : s.color) }} />
                    </div>
                    <span className="text-base font-black w-24 text-right" style={{ color: hasRecordedResult ? (isPass ? '#10B981' : '#EF4444') : '#94A3B8' }}>
                      {!hasRecordedResult ? '—' : isPassFail ? (isPass ? 'PASS' : 'FAIL') : `${s.val}%`}
                    </span>
                  </div>
                );
              });
            })()}

            {applicant.testScores.personalityEQ && (
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                <span className="text-sm text-slate-500 font-medium">Personality / EQ Interview</span>
                <span className={`text-sm font-bold ${applicant.testScores.personalityEQ === 'Suitable' ? 'text-[#10B981]' : applicant.testScores.personalityEQ === 'Not Suitable' ? 'text-red-500' : 'text-slate-400'}`}>
                  {applicant.testScores.personalityEQ}
                </span>
              </div>
            )}
            {applicant.testScores.employerSpecific && (
              <div className="bg-blue-50 rounded-lg px-4 py-2.5 text-sm text-[#0F172A]">
                <span className="text-xs font-bold text-blue-500 uppercase">Employer-Specific Notes: </span>
                {applicant.testScores.employerSpecific}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 py-10 text-center text-slate-400 text-sm">No test scores recorded yet</div>
        )}
      </div>

      {/* ── Financials ────────────────────────────────────────────────────────── */}
      <div ref={el => { sectionRefs.current['finances'] = el; }} id="finances" className="scroll-mt-24 pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-[#0EA5E9]" />
            <h3 className="text-base font-bold text-[#0F172A] uppercase tracking-wider">Financial Records</h3>
          </div>
          {expenses.length > 0 && (
            <span className="text-lg font-black text-[#0EA5E9]">₱{totalExpenses.toLocaleString()}</span>
          )}
        </div>
        {expenses.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-10 text-center text-slate-400 text-sm">No financial records</div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {expenses.map((exp, idx) => (
              <div key={exp.id} className={`flex items-center gap-4 px-5 py-3.5 ${idx > 0 ? 'border-t border-slate-100' : ''}`}>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <DollarSign size={14} className="text-[#10B981]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#0F172A]">{exp.type}</p>
                  <p className="text-xs text-slate-500">{exp.description} · {exp.recordedBy}</p>
                </div>
                <p className="text-base font-black text-[#0F172A] flex-shrink-0">₱{exp.amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Activity History ──────────────────────────────────────────────────── */}
      <div ref={el => { sectionRefs.current['activity'] = el; }} id="activity" className="scroll-mt-24 pt-6 space-y-4 pb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[#0EA5E9]" />
            <h3 className="text-base font-bold text-[#0F172A] uppercase tracking-wider">Activity History</h3>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
            {applicantTimeline.length > 0 ? `${applicantTimeline.length} Events` : `${activityLogs.length} Events`}
          </span>
        </div>

        {isTimelineLoading ? (
          <div className="bg-white rounded-xl border border-slate-200 py-8 text-center space-y-2">
            <Loader2 className="w-5 h-5 text-sky-500 animate-spin mx-auto" />
            <p className="text-xs font-semibold text-slate-500">Loading applicant audit timeline...</p>
          </div>
        ) : (applicantTimeline.length === 0 && activityLogs.length === 0) ? (
          <div className="bg-white rounded-xl border border-slate-200 py-10 text-center text-slate-400 text-sm">
            No activity history recorded for this applicant
          </div>
        ) : (
          <div className="relative pl-6">
            <div className="absolute left-[11px] top-3 bottom-3 w-px bg-slate-200" />
            <div className="space-y-4">
              {(applicantTimeline.length > 0 ? applicantTimeline : activityLogs.map(l => ({
                audit_log_id: l.audit_log_id || 0,
                occurred_at: l.timestamp,
                actor_name: l.performedBy || 'Staff User',
                actor_role: 'Staff',
                action: l.action,
                module: l.department || 'Operations',
                description: l.details || '',
              }))).map((log: any, idx: number) => {
                const act = (log.action || '').toUpperCase();
                const isClaim = act.includes('CLAIM') || act.includes('REASSIGN') || act.includes('POOL');
                const isStatus = act.includes('STATUS') || act.includes('APPROV') || act.includes('PASS');
                const isAlert = act.includes('RETURN') || act.includes('REJECT') || act.includes('FLAG');

                let badgeColor = 'bg-sky-50 text-sky-700 border-sky-200';
                if (isStatus || act.includes('VERIF')) badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                if (isClaim) badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
                if (isAlert) badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';

                return (
                  <div key={log.audit_log_id || idx} className="relative">
                    <div className="absolute -left-6 top-3 w-3 h-3 rounded-full bg-[#0EA5E9] border-2 border-white shadow-xs" />
                    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 hover:border-slate-300 transition-colors shadow-2xs">
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded border ${badgeColor}`}>
                            {log.action?.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs font-bold text-[#0F172A]">
                            {log.actor_name || log.performedBy || 'Staff User'}
                          </span>
                          {log.actor_role && (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {log.actor_role}
                            </span>
                          )}
                          {log.module && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              • {log.module}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 flex-shrink-0">
                          <Clock size={11} /> {new Date(log.occurred_at || log.timestamp).toLocaleString('en-PH')}
                        </span>
                      </div>

                      {/* Description Sentence */}
                      <p className="text-xs text-slate-700 leading-relaxed font-medium">
                        {log.description || log.details}
                      </p>

                      {/* Handler Handoff Line */}
                      {(log.prev_handler_name || log.new_handler_name) && (
                        <div className="p-2 bg-slate-50 border border-slate-200/80 rounded-lg text-xs flex items-center gap-2">
                          <span className="font-bold text-slate-600">Handler:</span>
                          <span className="text-slate-500">
                            {(log.prev_handler_name === 'Unassigned Pool' ? 'Unassigned' : log.prev_handler_name) || 'Unassigned'} → <strong className="text-slate-800">{(log.new_handler_name === 'Unassigned Pool' ? 'Unassigned' : log.new_handler_name) || 'Unassigned'}</strong>
                          </span>
                        </div>
                      )}

                      {/* Reason / Remarks if present */}
                      {log.reason && (
                        <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Reason / Remarks:</span> {log.reason}
                          </div>
                        </div>
                      )}

                      {/* Changes Diff if present */}
                      {log.changes && Object.keys(log.changes).length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Fields Changed:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                            {Object.entries(log.changes).map(([f, d]: [string, any]) => (
                              <div key={f} className="p-1.5 bg-slate-50 rounded border border-slate-200 flex items-center justify-between font-mono">
                                <span className="text-slate-600 font-semibold">{f}:</span>
                                <span className="text-slate-800">
                                  <span className="text-rose-600">{String(d?.old ?? 'null')}</span> → <span className="text-emerald-600 font-bold">{String(d?.new ?? 'null')}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Stop Processing Modal ─────────────────────────────────────────────── */}
      {showStopModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <OctagonX size={18} className="text-red-500" />
              </div>
              <div>
                <h2 className="font-bold text-[#0F172A]">Stop Processing</h2>
                <p className="text-xs text-slate-500 mt-0.5">Locks applicant at Phase {applicant?.phase}. Requires Management to reverse.</p>
              </div>
              <button onClick={() => { setShowStopModal(false); setStopReason(''); }} className="ml-auto text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-700 space-y-1">
                <p className="font-semibold text-sm mb-1">Typical reasons at this stage:</p>
                <p>• Employment history contains unresolvable red flags</p>
                <p>• Document fraud suspected</p>
                <p>• Applicant failed background verification</p>
                <p>• Applicant withdrew or became unreachable</p>
                <p>• Medical disqualification or safety concern</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Reason for Stopping *</label>
                <textarea
                  value={stopReason}
                  onChange={e => setStopReason(e.target.value)}
                  rows={4}
                  placeholder="Provide a detailed reason. This will be permanently recorded in the audit trail and visible to Management."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 rounded-b-2xl border-t border-slate-200">
              <button onClick={() => { setShowStopModal(false); setStopReason(''); }} className="px-4 py-2 text-sm font-medium text-slate-600">Cancel</button>
              <button
                onClick={handleStopProcessing}
                disabled={!stopReason.trim()}
                className="flex items-center gap-2 px-5 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <OctagonX size={15} /> Confirm Stop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ─────────────────────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <h2 className="font-bold text-[#0F172A]">Delete Applicant</h2>
                <p className="text-xs text-slate-500 mt-0.5">This action cannot be undone.</p>
              </div>
              <button onClick={() => setShowDeleteModal(false)} className="ml-auto text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-700 space-y-1">
                <p className="font-semibold text-sm mb-1">Warning:</p>
                <p>Are you sure you want to permanently delete the applicant <strong>{applicant?.name}</strong>?</p>
                <p className="mt-2">Note: The record and associated files are safely archived for regulatory compliance and audit trail purposes, but will no longer appear in active agency lists.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 rounded-b-2xl border-t border-slate-200">
              <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600">Cancel</button>
              <button
                onClick={handleDeleteApplicant}
                disabled={isDeleting}
                className="flex items-center gap-2 px-5 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {isDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Back to top ────────────────────────────────────────────────────────── */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-40 w-10 h-10 bg-[#0F172A] hover:bg-[#0EA5E9] text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
          title="Back to top"
        >
          <ChevronUp size={18} />
        </button>
      )}
    </div>
  );
}
