import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Clock, User, DollarSign, ShieldAlert, CheckCircle2, OctagonX,
  FileCheck, FileX, ChevronUp, MapPin, Phone, Mail, Globe,
  Briefcase, GraduationCap, Award, Languages,
  IdCard, BarChart3, MessageSquare, AlertTriangle, Flag,
  Clock3, TrendingDown, GitMerge, Zap, Calendar, BadgeCheck, X
} from 'lucide-react';
import { ApplicantRecord, ActivityLog, ExpenseRecord, EmploymentFlag, EmploymentFlagType } from '../../../app/types';

// ─── Flag engine types ────────────────────────────────────────────────────────
const FLAG_META: Record<EmploymentFlagType, { label: string; icon: React.ReactNode; color: string }> = {
  gap:                  { label: 'Employment Gap',       icon: <Clock3 size={14} />,       color: '#F59E0B' },
  short_stint:          { label: 'Short Tenure',         icon: <Zap size={14} />,           color: '#F97316' },
  red_flag_resignation: { label: 'Resignation Red Flag', icon: <ShieldAlert size={14} />,   color: '#EF4444' },
  overlap:              { label: 'Date Overlap',         icon: <GitMerge size={14} />,      color: '#8B5CF6' },
  demotion:             { label: 'Possible Demotion',    icon: <TrendingDown size={14} />,  color: '#EC4899' },
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
  { id: 'activity',    label: 'Activity',       icon: <Clock size={13} /> },
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
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ApplicantProfile({
  applicant,
  activityLogs = [],
  expenses = [],
  updateApplicant,
  currentUserName = 'Staff',
  addActivityLog,
  showToast,
}: ApplicantProfileProps) {
  const [activeSection, setActiveSection] = useState('overview');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [resolvingFlagId, setResolvingFlagId] = useState<string | null>(null);
  const [selectedQuickReason, setSelectedQuickReason] = useState('');
  const [customReason, setCustomReason] = useState('');

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

  const handleStopProcessing = () => {
    if (!stopReason.trim() || !applicant || !updateApplicant) return;
    updateApplicant(applicant.id, {
      isStopped: true, stoppedReason: stopReason, stoppedBy: currentUserName,
      stoppedAt: new Date().toISOString(), stoppedPhase: applicant.phase,
      status: 'Processing Stopped',
      phaseDescription: `Processing halted by ${currentUserName}: ${stopReason}`,
    });
    addActivityLog?.({ applicantId: applicant.id, action: 'Processing Stopped', performedBy: currentUserName, department: 'Recruitment', details: `Stopped at Phase ${applicant.phase}. Reason: ${stopReason}` });
    showToast?.('Processing stopped. Applicant record has been locked.');
    setShowStopModal(false);
    setStopReason('');
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
  const topRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  // IntersectionObserver to track active section
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    SECTIONS.forEach(({ id }) => {
      const el = sectionRefs.current[id];
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { threshold: 0.25 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, [applicant]);

  // Scroll listener for back-to-top — listens on scroll parent
  useEffect(() => {
    const el = topRef.current?.closest('[class*="overflow-y"]') as HTMLElement | null;
    if (!el) return;
    const onScroll = () => setShowBackToTop(el.scrollTop > 300);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = useCallback((id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(id);
  }, []);

  const scrollToTop = useCallback(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={topRef} className="max-w-4xl space-y-0 pb-20">

      {/* ── Profile Header card ──────────────────────────────────────────────── */}
      <div className="bg-[#0F172A] rounded-t-xl overflow-hidden">
        {/* Stopped Banner */}
        {applicant.isStopped && (
          <div className="bg-red-600 px-6 py-2.5 flex items-center gap-2 text-sm text-white">
            <OctagonX size={15} className="flex-shrink-0" />
            <span><strong>Processing Stopped at Phase {applicant.stoppedPhase}</strong> · {applicant.stoppedBy} · {applicant.stoppedAt ? new Date(applicant.stoppedAt).toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' }) : '—'}</span>
          </div>
        )}
        {!applicant.isStopped && hasFlagWarning && (
          <div className="bg-amber-500 px-6 py-2 flex items-center gap-2 text-sm text-white">
            <Flag size={14} className="flex-shrink-0" />
            <span><strong>{activeFlags.length} unresolved employment flag{activeFlags.length > 1 ? 's' : ''}</strong> — applicant cannot proceed to screening until resolved.</span>
          </div>
        )}
        <div className="px-6 py-5 flex items-start gap-5">
          {applicant.photoDataUrl
            ? <img src={applicant.photoDataUrl} alt="photo" className="w-20 h-24 object-cover rounded-xl border-2 border-white/20 flex-shrink-0" />
            : (
              <div className="w-20 h-24 rounded-xl bg-white/10 border-2 border-white/20 flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
                {applicant.name.split(' ').map(n => n[0]).join('').slice(0,2)}
              </div>
            )
          }
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white leading-tight">{applicant.name}</h2>
            <p className="text-[#0EA5E9] text-sm mt-0.5 font-medium">{applicant.role}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-white/60">
              <span className="flex items-center gap-1"><IdCard size={11} /> {applicant.id}</span>
              {applicant.email && <span className="flex items-center gap-1"><Mail size={11} /> {applicant.email}</span>}
              {applicant.contact && <span className="flex items-center gap-1"><Phone size={11} /> {applicant.contact}</span>}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-xs px-2.5 py-1 bg-[#0EA5E9]/20 text-[#0EA5E9] rounded-full border border-[#0EA5E9]/30 font-semibold">
                Phase {applicant.phase}: {applicant.status}
              </span>
              {applicant.jobOrder && (
                <span className="text-xs px-2.5 py-1 bg-white/10 text-white/70 rounded-full">{applicant.jobOrder}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right text-xs text-white/40">
              <p>Handler: {applicant.currentHandler}</p>
              <p className="mt-0.5">{applicant.currentDepartment}</p>
              <p className="mt-0.5 italic">{applicant.lastUpdated}</p>
            </div>
            {!applicant.isStopped && updateApplicant && (
              <button
                onClick={() => setShowStopModal(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-400/50 text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-all"
              >
                <OctagonX size={13} /> Stop Processing
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Sticky section nav ────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-30 bg-white border border-t-0 border-slate-200 rounded-b-xl shadow-sm">
        <div className="flex overflow-x-auto scrollbar-hide px-3 py-2 gap-1">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeSection === s.id
                  ? 'bg-[#0EA5E9] text-white'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-[#0F172A]'
              } ${s.id === 'employment' && hasFlagWarning ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
            >
              {s.icon} {s.label}
              {s.id === 'employment' && activeFlags.length > 0 && (
                <span className="ml-0.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center">{activeFlags.length}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Overview ──────────────────────────────────────────────────────────── */}
      <div ref={el => { sectionRefs.current['overview'] = el; }} id="overview" className="scroll-mt-4 pt-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <User size={16} className="text-[#0EA5E9]" />
          <h3 className="text-base font-bold text-[#0F172A] uppercase tracking-wider">Personal Overview</h3>
        </div>

        {/* Stopped notice */}
        {applicant.isStopped && (
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
              { label: 'Date of Birth',  val: applicant.dateOfBirth },
              { label: 'Age',            val: applicant.age ? `${applicant.age} years old` : undefined },
              { label: 'Gender',         val: applicant.sex },
              { label: 'Civil Status',   val: applicant.civilStatus },
              { label: 'Religion',       val: applicant.religion },
              { label: 'Citizenship',    val: applicant.citizenship },
              { label: 'Height',         val: applicant.height },
              { label: 'Weight',         val: applicant.weight },
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
        </div>
      </div>

      {/* ── Employment History ─────────────────────────────────────────────────── */}
      <div ref={el => { sectionRefs.current['employment'] = el; }} id="employment" className="scroll-mt-4 pt-8 space-y-4">
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

        {(applicant.employmentHistory || []).length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-10 text-center text-slate-400 text-sm">No employment history recorded</div>
        ) : (
          <div className="space-y-3">
            {(applicant.employmentHistory || []).map((rec, idx) => {
              const duration = rec.isPresent
                ? durationLabel(monthsBetween(rec.dateStarted, new Date().toISOString().slice(0, 10)))
                : (rec.dateStarted && rec.dateEnded ? durationLabel(monthsBetween(rec.dateStarted, rec.dateEnded)) : '');
              const recFlags = flags.filter(f => f.relatedJobIds.includes(rec.id));
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
                        <span className="flex items-center gap-1"><Calendar size={11} /> {rec.dateStarted} — {rec.isPresent ? 'Present' : rec.dateEnded}</span>
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
      </div>

      {/* ── Skills & Certifications ────────────────────────────────────────────── */}
      <div ref={el => { sectionRefs.current['skills'] = el; }} id="skills" className="scroll-mt-4 pt-8 space-y-5">
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
        {(applicant.certificateRecords || []).length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Certificates & Licenses</p>
            {(applicant.certificateRecords || []).map(row => (
              <div key={row.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[#0F172A] text-sm">{row.title}</p>
                      {row.proofDocumentUrl
                        ? <span className="flex items-center gap-1 text-xs text-[#10B981] bg-emerald-50 px-2 py-0.5 rounded-full"><FileCheck size={11} /> Proof uploaded</span>
                        : <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full"><FileX size={11} /> No proof</span>
                      }
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Issued by {row.issuedBy}</p>
                  </div>
                  <code className="text-xs text-[#0EA5E9] bg-blue-50 px-2 py-1 rounded flex-shrink-0">{row.serialNo || '—'}</code>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-2.5 text-xs text-slate-500">
                  <div><span className="text-slate-400">Hours: </span>{row.noOfHours || '—'}</div>
                  <div><span className="text-slate-400">Issued: </span>{row.competencyDateIssued || '—'}</div>
                  <div><span className="text-slate-400">Expires: </span>{row.expiryDate || 'No expiry'}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Trainings */}
        {(applicant.trainings || []).length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Trainings Attended</p>
            {(applicant.trainings || []).map(row => (
              <div key={row.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[#0F172A] text-sm">{row.trainingName}</p>
                      {row.proofDocumentUrl
                        ? <span className="flex items-center gap-1 text-xs text-[#10B981] bg-emerald-50 px-2 py-0.5 rounded-full"><FileCheck size={11} /> Proof uploaded</span>
                        : <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full"><FileX size={11} /> No proof</span>
                      }
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

        {(applicant.skills || []).length === 0 && (applicant.certificateRecords || []).length === 0 && (applicant.trainings || []).length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 py-10 text-center text-slate-400 text-sm">No skills or certificates recorded</div>
        )}
      </div>

      {/* ── Languages ─────────────────────────────────────────────────────────── */}
      <div ref={el => { sectionRefs.current['languages'] = el; }} id="languages" className="scroll-mt-4 pt-8 space-y-4">
        <div className="flex items-center gap-2">
          <Languages size={16} className="text-[#0EA5E9]" />
          <h3 className="text-base font-bold text-[#0F172A] uppercase tracking-wider">Language Proficiency</h3>
        </div>
        {(applicant.languageRecords || []).length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-10 text-center text-slate-400 text-sm">No language records</div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr] text-[10px] font-bold text-slate-400 uppercase tracking-wider px-5 py-2.5 bg-slate-50 border-b border-slate-100">
              <span>Language</span><span>Competency</span><span>Spoken</span><span>Written</span>
            </div>
            {(applicant.languageRecords || []).map((row, idx) => (
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
        )}
      </div>

      {/* ── Education ─────────────────────────────────────────────────────────── */}
      <div ref={el => { sectionRefs.current['education'] = el; }} id="education" className="scroll-mt-4 pt-8 space-y-4">
        <div className="flex items-center gap-2">
          <GraduationCap size={16} className="text-[#0EA5E9]" />
          <h3 className="text-base font-bold text-[#0F172A] uppercase tracking-wider">Educational Background</h3>
        </div>
        {(applicant.education || []).length === 0 ? (
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
      <div ref={el => { sectionRefs.current['ids'] = el; }} id="ids" className="scroll-mt-4 pt-8 space-y-4">
        <div className="flex items-center gap-2">
          <IdCard size={16} className="text-[#0EA5E9]" />
          <h3 className="text-base font-bold text-[#0F172A] uppercase tracking-wider">Identifications & Documents</h3>
        </div>
        {(applicant.identifications || []).length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-10 text-center text-slate-400 text-sm">No identification records</div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {(applicant.identifications || []).map((row, idx) => {
              const isExpired = row.expiryDate && new Date(row.expiryDate) < new Date();
              return (
                <div key={row.id} className={`flex items-center gap-4 px-5 py-3.5 ${idx > 0 ? 'border-t border-slate-100' : ''}`}>
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <IdCard size={14} className="text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-[#0F172A]">{row.type}</p>
                      {row.proofDocumentUrl
                        ? <span className="flex items-center gap-1 text-xs text-[#10B981]"><FileCheck size={11} /> Scan uploaded</span>
                        : <span className="flex items-center gap-1 text-xs text-amber-500"><FileX size={11} /> No scan</span>
                      }
                    </div>
                    <code className="text-xs text-[#0EA5E9]">{row.identificationNo || '—'}</code>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {row.expiryDate ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isExpired ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
                        {isExpired ? '⚠ Expired' : 'Exp: '}{row.expiryDate}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">No expiry</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Test Scores ───────────────────────────────────────────────────────── */}
      <div ref={el => { sectionRefs.current['scores'] = el; }} id="scores" className="scroll-mt-4 pt-8 space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-[#0EA5E9]" />
          <h3 className="text-base font-bold text-[#0F172A] uppercase tracking-wider">Test Scores</h3>
        </div>
        {hasFlagWarning && !applicant.isStopped && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-amber-700">
            <ShieldAlert size={16} className="flex-shrink-0" />
            <span><strong>{activeFlags.length}</strong> unresolved employment flag{activeFlags.length > 1 ? 's' : ''}. Screening is blocked until resolved.</span>
          </div>
        )}
        {applicant.testScores ? (
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            {[
              { label: 'English Proficiency', val: applicant.testScores.englishProficiency, pass: 60, color: '#0EA5E9' },
              { label: 'Trade / Skills Test',  val: applicant.testScores.tradeSkills,        pass: 70, color: '#F59E0B' },
              { label: 'IQ / Aptitude',        val: applicant.testScores.iqAptitude,         pass: 50, color: '#8B5CF6' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-4">
                <div className="w-36 flex-shrink-0">
                  <p className="text-xs font-semibold text-slate-500">{s.label}</p>
                  <span className={`text-xs font-bold ${s.val >= s.pass ? 'text-[#10B981]' : 'text-red-500'}`}>{s.val >= s.pass ? '✓ Pass' : '✗ Fail'}</span>
                </div>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${s.val}%`, background: s.color }} />
                </div>
                <span className="text-lg font-black w-16 text-right" style={{ color: s.color }}>{s.val}%</span>
              </div>
            ))}
            <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
              <span className="text-sm text-slate-500 font-medium">Personality / EQ</span>
              <span className={`text-sm font-bold ${applicant.testScores.personalityEQ === 'Suitable' ? 'text-[#10B981]' : applicant.testScores.personalityEQ === 'Not Suitable' ? 'text-red-500' : 'text-slate-400'}`}>
                {applicant.testScores.personalityEQ}
              </span>
            </div>
            {applicant.testScores.employerSpecific && (
              <div className="bg-blue-50 rounded-lg px-4 py-2.5 text-sm text-[#0F172A]">
                <span className="text-xs font-bold text-blue-500 uppercase">Employer-Specific: </span>
                {applicant.testScores.employerSpecific}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 py-10 text-center text-slate-400 text-sm">No test scores recorded yet</div>
        )}
      </div>

      {/* ── Financials ────────────────────────────────────────────────────────── */}
      <div ref={el => { sectionRefs.current['finances'] = el; }} id="finances" className="scroll-mt-4 pt-8 space-y-4">
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

      {/* ── Activity ──────────────────────────────────────────────────────────── */}
      <div ref={el => { sectionRefs.current['activity'] = el; }} id="activity" className="scroll-mt-4 pt-8 space-y-4 pb-8">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-[#0EA5E9]" />
          <h3 className="text-base font-bold text-[#0F172A] uppercase tracking-wider">Activity Log</h3>
        </div>
        {activityLogs.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-10 text-center text-slate-400 text-sm">No activity logs</div>
        ) : (
          <div className="relative pl-6">
            <div className="absolute left-[11px] top-3 bottom-3 w-px bg-slate-200" />
            <div className="space-y-4">
              {activityLogs.map(log => (
                <div key={log.id} className="relative">
                  <div className="absolute -left-6 top-2.5 w-3 h-3 rounded-full bg-[#0EA5E9] border-2 border-white" />
                  <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-xs font-bold text-[#0EA5E9] uppercase tracking-wide">{log.action}</p>
                        <p className="text-sm font-semibold text-[#0F172A] mt-0.5">{log.performedBy}</p>
                      </div>
                      <span className="text-xs text-slate-400 flex items-center gap-1 flex-shrink-0">
                        <Clock size={11} /> {new Date(log.timestamp).toLocaleString('en-PH')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{log.details}</p>
                  </div>
                </div>
              ))}
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
