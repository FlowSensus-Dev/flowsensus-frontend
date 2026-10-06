import { useState, useEffect, useRef } from 'react';
import {
  LogOut, Briefcase, Clock, CheckCircle2, Globe, Building2,
  Award, Layers, ShieldCheck, FileCheck, Stethoscope, FileText,
  PlaneTakeoff, User, RefreshCw, Copy, Check, ChevronDown,
  ChevronUp, Milestone, AlertTriangle, Bell, X, Info, Calendar
} from 'lucide-react';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';

// ── Interfaces ───────────────────────────────────────────────────────────────

interface PortalProfile {
  applicant_id: number;
  agency_id: number;
  applicant_code: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  email: string;
  contact_number?: string | null;
  photo_url?: string | null;
  civil_status?: string | null;
  birth_date?: string | null;
  place_of_birth?: string | null;
  status_code?: string | null;
  is_active: boolean;
  is_blocked: boolean;
  blocked_reason?: string | null;
  agency_name?: string | null;
}

interface PortalApplication {
  application_id: number;
  applicant_id: number;
  job_order_id?: number | null;
  job_code?: string | null;
  position?: string | null;
  employer_name?: string | null;
  country_name?: string | null;
  current_phase: number;
  status_code?: string | null;
  match_score?: number | null;
  handler_name?: string | null;
  handler_email?: string | null;
  handler_phone?: string | null;
  stage_name?: string | null;
  actual_deployment_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  phase_end_dates?: Record<string, string | null>;
}

interface PortalDocument {
  applicant_req_id: number;
  requirement_name: string;
  category?: string | null;
  is_mandatory?: boolean | null;
  status: string;
  ocr_validation_status?: string | null;
  expiration_date?: string | null;
  uploaded_at?: string | null;
}

interface ApplicantPortalProps {
  onLogout: () => void;
  applicantId?: string;
  applicantName?: string;
}

// ── 5 Canonical Phases Configuration ─────────────────────────────────────────
// Note: Key milestones and expected deliverables removed per applicant view specs

const PHASES = [
  {
    phase: 1,
    title: 'Registration & Initial Screening',
    shortTitle: 'Screening',
    subtitle: 'Profile intake, identity authentication & qualifications check',
    icon: FileCheck,
    description: 'Initial document assessment and qualification rating against foreign principal requirements.',
  },
  {
    phase: 2,
    title: 'Medical Clearance',
    shortTitle: 'Medical',
    subtitle: 'Fit-to-Work certification',
    icon: Stethoscope,
    description: 'Complete diagnostic workup, laboratory tests, and physical examination to ensure medical readiness.',
  },
  {
    phase: 3,
    title: 'CV Encoding & Management Approval',
    shortTitle: 'CV Encoding & Approval',
    subtitle: 'Standardized international format encoding and agency manager sign-off',
    icon: FileText,
    description: 'Skills matrix and professional bio-data verified and approved by the agency operations team.',
  },
  {
    phase: 4,
    title: 'Employer Endorsement',
    shortTitle: 'Employer Review',
    subtitle: 'Principal submission, candidate selection & pre-deployment processing',
    icon: Building2,
    description: 'Candidate profile forwarded directly to the accredited overseas employer for final selection and pre-deployment processing.',
  },
  {
    phase: 5,
    title: 'Deployment',
    shortTitle: 'Deployment',
    subtitle: 'POEA/DMW clearance, work visa issuance, PDOS seminar, and flight departure',
    icon: PlaneTakeoff,
    description: 'Final administrative clearances, contract verification, visa stamping, and travel coordination.',
  },
];

export default function ApplicantPortal({ onLogout }: ApplicantPortalProps) {
  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [applications, setApplications] = useState<PortalApplication[]>([]);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(true);

  const notifRef = useRef<HTMLDivElement>(null);

  // Close notifications when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  // ── Fetch Live Portal Data ──────────────────────────────────────────────────
  const fetchPortalData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setErrorMsg(null);

      const [resProfile, resApps, resDocs] = await Promise.all([
        api.get('/applicants/me'),
        api.get('/applicants/me/applications'),
        api.get('/applicants/me/documents'),
      ]);

      if (resProfile.data) {
        setProfile(resProfile.data);
      }
      if (Array.isArray(resApps.data)) {
        setApplications(resApps.data);
      }
      if (Array.isArray(resDocs.data)) {
        setDocuments(resDocs.data);
      } else {
        setDocuments([]);
      }

      // Persist to session cache for instant future loads
      try {
        sessionStorage.setItem('fs_cache_applicant_portal', JSON.stringify({
          profile: resProfile.data,
          applications: Array.isArray(resApps.data) ? resApps.data : [],
          documents: Array.isArray(resDocs.data) ? resDocs.data : [],
        }));
      } catch (e) { }
    } catch (err: any) {
      console.error('Failed to load applicant portal data:', err);
      const detail = err?.response?.data?.detail;
      if (detail && typeof detail === 'string' && detail.includes('ACCOUNT_BLOCKED')) {
        setErrorMsg('Your account has been suspended or blocked by your agency administrator.');
      } else {
        setErrorMsg('Could not retrieve your live application status. Please try refreshing.');
      }
      setDocuments([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Instant SWR mount: hydrate from session storage immediately if available
  useEffect(() => {
    let hasCache = false;
    try {
      const cachedData = sessionStorage.getItem('fs_cache_applicant_portal');
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        if (parsed.profile) setProfile(parsed.profile);
        if (Array.isArray(parsed.applications) && parsed.applications.length > 0) setApplications(parsed.applications);
        if (Array.isArray(parsed.documents)) setDocuments(parsed.documents);
        setLoading(false);
        hasCache = true;
      }
    } catch (e) { }

    // Fetch fresh data in background (silent if already rendered from cache)
    fetchPortalData(hasCache);
  }, []);

  // Supabase Realtime synchronization: automatically update when agency changes status, phase, or documents
  useEffect(() => {
    if (!profile?.applicant_id) return;
    const applicantId = profile.applicant_id;

    let debounceTimer: any = null;
    const triggerDebouncedRefresh = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchPortalData(true);
      }, 500);
    };

    const channel = supabase
      .channel(`realtime:applicant_portal_${applicantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_application', filter: `applicant_id=eq.${applicantId}` },
        triggerDebouncedRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applicant', filter: `applicant_id=eq.${applicantId}` },
        triggerDebouncedRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applicant_requirement', filter: `applicant_id=eq.${applicantId}` },
        triggerDebouncedRefresh
      )
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [profile?.applicant_id]);

  const activeApp = applications[0] || null;
  const currentPhaseNumber = activeApp?.current_phase || 1;
  const currentProgressPercent = Math.min(100, Math.round((currentPhaseNumber / 5) * 100));

  // Default expanded phase is the active phase
  useEffect(() => {
    if (expandedPhase === null) {
      setExpandedPhase(currentPhaseNumber);
    }
  }, [currentPhaseNumber, expandedPhase]);

  const fullName = profile
    ? `${profile.first_name} ${profile.middle_name ? profile.middle_name + ' ' : ''}${profile.last_name}`
    : 'Applicant';

  const initials = profile
    ? `${profile.first_name[0] || ''}${profile.last_name[0] || ''}`.toUpperCase()
    : 'AP';

  const copyApplicantCode = () => {
    if (profile?.applicant_code) {
      navigator.clipboard.writeText(profile.applicant_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const verifiedDocsCount = documents.filter(
    (d) => d.status?.toUpperCase() === 'VERIFIED'
  ).length;

  const notificationsList: Array<{
    id: number;
    title: string;
    message: string;
    time: string;
    type: string;
  }> = [];

  if (activeApp) {
    notificationsList.push({
      id: 1,
      title: 'Current Stage Progress',
      message: `Phase ${currentPhaseNumber}: ${activeApp.status_code || profile?.status_code || 'In Active Evaluation'}. Your profile is active.`,
      time: 'Live status',
      type: 'info',
    });
  }

  if (documents.length > 0) {
    notificationsList.push({
      id: 2,
      title: 'Document Compliance Status',
      message: `${verifiedDocsCount} of ${documents.length} regulatory requirements have been verified by your agency.`,
      time: 'Document check',
      type: 'success',
    });
  }

  if (activeApp?.handler_name) {
    notificationsList.push({
      id: 3,
      title: 'Officer Assigned',
      message: `Case Handler: ${activeApp.handler_name} is processing your deployment file.`,
      time: 'Assignment',
      type: 'info',
    });
  }

  return (
    <div className="w-full min-h-screen bg-slate-100 text-[#0F172A] flex flex-col items-center justify-start py-3 sm:py-6 md:py-8 px-2 sm:px-4 md:px-6 antialiased selection:bg-[#0EA5E9]/20 overflow-x-hidden">
      {/* ── Single Master Portal Card ─────────────────────────────────────── */}
      <div className="w-full max-w-5xl bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-slate-200/90 overflow-hidden flex flex-col">
        {/* ── 1. Card Top Navigation & Header ─────────────────────────────── */}
        <header className="bg-white border-b border-slate-100 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Agency Title */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0EA5E9] to-[#0284C7] flex items-center justify-center shadow-sm shadow-[#0EA5E9]/25 flex-shrink-0">
              <Layers size={19} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-[#0F172A] text-sm sm:text-base tracking-tight">
                  Flow<span className="text-[#0EA5E9]">Sensus</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-50 text-[#0284C7] border border-sky-100 whitespace-nowrap">
                  Applicant Account
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate">
                {profile?.agency_name || 'Accredited Placement Agency'}
              </p>
            </div>
          </div>

          {/* Right Header Navigation & Actions */}
          <div className="flex items-center gap-2 flex-shrink-0 relative">
            {/* Notification Button */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => {
                  setShowNotifications((prev) => !prev);
                  if (!showNotifications) setHasUnreadNotifications(false);
                }}
                className={`relative p-2 rounded-xl transition-all cursor-pointer ${showNotifications
                  ? 'bg-sky-50 text-[#0EA5E9] border border-sky-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                  }`}
                title="Notifications"
                aria-label="View notifications"
              >
                <Bell size={16} />
                {hasUnreadNotifications && notificationsList.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-white">
                    {notificationsList.length}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-72 sm:w-84 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell size={14} className="text-[#0EA5E9]" />
                      <span className="text-xs font-bold text-slate-800">Application Notifications</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowNotifications(false)}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {notificationsList.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No notifications at this time
                      </div>
                    ) : (
                      notificationsList.map((notif) => (
                        <div key={notif.id} className="p-3.5 hover:bg-slate-50/80 transition-colors text-left">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <p className="text-xs font-bold text-slate-900">{notif.title}</p>
                            <span className="text-[10px] text-slate-400">{notif.time}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-snug">{notif.message}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-center">
                    <span className="text-[10px] font-medium text-slate-400">
                      Applicant Monitor View · Live agency updates
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => {
                setIsRefreshing(true);
                fetchPortalData(true);
              }}
              disabled={isRefreshing}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              title="Refresh application data"
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-[#0EA5E9]' : ''} />
            </button>

            {/* Sign Out Button */}
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl transition-all cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* ── Error Alert Banner (if applicable) ──────────────────────────── */}
        {errorMsg && (
          <div className="m-4 sm:m-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs sm:text-sm flex items-start gap-3">
            <AlertTriangle size={18} className="text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-rose-900">System Notice</p>
              <p className="mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* ── 2. Dossier Hero & Status Strip ───────────────────────────────── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white p-5 sm:p-7 md:p-8 border-b border-slate-800">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-[#0EA5E9]/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
            {/* Identity & Basic Tags */}
            <div className="flex items-start sm:items-center gap-3.5 sm:gap-5 min-w-0">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-[#0EA5E9] to-[#38BDF8] p-0.5 shadow-lg shadow-[#0EA5E9]/30 flex-shrink-0">
                {profile?.photo_url ? (
                  <img
                    src={profile.photo_url}
                    alt={fullName}
                    className="w-full h-full rounded-[14px] object-cover bg-slate-900"
                  />
                ) : (
                  <div className="w-full h-full rounded-[14px] bg-slate-900 flex items-center justify-center text-white text-lg sm:text-xl font-black">
                    {initials}
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white truncate">
                    {fullName}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                    {activeApp?.status_code || profile?.status_code || 'Registered'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-300 font-medium">
                  {/* Copyable Applicant Code */}
                  <button
                    type="button"
                    onClick={copyApplicantCode}
                    className="inline-flex items-center gap-1 font-mono text-[#38BDF8] bg-white/10 hover:bg-white/15 px-2 py-0.5 rounded-md transition-colors cursor-pointer group"
                    title="Click to copy Applicant Code"
                  >
                    <span>{profile?.applicant_code || 'N/A'}</span>
                    {copiedCode ? (
                      <Check size={11} className="text-emerald-400" />
                    ) : (
                      <Copy size={11} className="opacity-60 group-hover:opacity-100" />
                    )}
                  </button>

                  <span className="hidden sm:inline text-slate-600">·</span>
                  <span className="flex items-center gap-1 text-slate-200">
                    <Briefcase size={12} className="text-[#0EA5E9]" />
                    {activeApp?.position || 'No Active Job Order'}
                  </span>

                  <span className="hidden sm:inline text-slate-600">·</span>
                  <span className="flex items-center gap-1 text-slate-200">
                    <Globe size={12} className="text-[#0EA5E9]" />
                    {activeApp?.country_name || 'Destination Pending'}
                  </span>
                </div>
              </div>
            </div>

            {/* Overall Progress Widget */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/10 flex flex-col justify-between md:min-w-[260px] flex-shrink-0">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-2">
                <span className="text-[10px] sm:text-xs tracking-wider uppercase">RECRUITMENT PROGRESS</span>
                <span className="text-[#38BDF8] font-mono font-extrabold text-xs sm:text-sm">
                  {currentProgressPercent}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-slate-700/70 rounded-full overflow-hidden p-0.5 border border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-[#0EA5E9] via-[#38BDF8] to-emerald-400 rounded-full transition-all duration-700"
                  style={{ width: `${currentProgressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between mt-2.5 text-[10px] sm:text-[11px] text-slate-400 font-medium">
                <span>Phase {currentPhaseNumber} of 5</span>
                <span className="text-emerald-400 font-bold">
                  {PHASES[currentPhaseNumber - 1]?.shortTitle || 'In Progress'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. Single Card Inner Body ───────────────────────────────────── */}
        <div className="p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8">
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* ── SECTION: 5-Phase Recruitment Roadmap ─────────────────────────── */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-extrabold text-[#0F172A] text-base sm:text-lg tracking-tight flex items-center gap-2">
                  <Milestone size={18} className="text-[#0EA5E9]" />
                  <span>5-Phase Recruitment Roadmap</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official stage tracking from candidate intake to overseas departure
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0EA5E9] bg-sky-50 px-3 py-1 rounded-full border border-sky-200 self-start sm:self-auto">
                <span className="w-2 h-2 rounded-full bg-[#0EA5E9] animate-pulse" />
                Active in Phase {currentPhaseNumber}
              </span>
            </div>

            {/* Responsive Phase Step Selector (Zoom-friendly flex-wrap) */}
            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              {PHASES.map((p) => {
                const isCurrent = p.phase === currentPhaseNumber;
                const isCompleted = p.phase < currentPhaseNumber;
                return (
                  <button
                    key={p.phase}
                    type="button"
                    onClick={() => setExpandedPhase(p.phase)}
                    className={`flex-1 min-w-[70px] sm:min-w-0 py-2 px-1.5 rounded-xl border text-center transition-all cursor-pointer ${isCurrent
                      ? 'border-[#0EA5E9] bg-sky-50 text-[#0EA5E9] font-bold shadow-xs'
                      : isCompleted
                        ? 'border-emerald-200 bg-emerald-50/50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                      }`}
                  >
                    <div className="text-[11px] sm:text-xs font-black">Phase {p.phase}</div>
                    <div className="text-[9px] sm:text-[10px] truncate mt-0.5">{p.shortTitle}</div>
                  </button>
                );
              })}
            </div>

            {/* Detailed Phase Cards (With Current Status, No Deliverable) */}
            <div className="space-y-3 pt-1">
              {PHASES.map((p) => {
                const isCurrent = p.phase === currentPhaseNumber;
                const isCompleted = p.phase < currentPhaseNumber;
                const isExpanded = expandedPhase === p.phase || isCurrent;

                return (
                  <div
                    key={p.phase}
                    className={`rounded-2xl border transition-all overflow-hidden ${isCurrent
                      ? 'border-[#0EA5E9] bg-sky-50/30 ring-2 ring-[#0EA5E9]/20 shadow-sm'
                      : isCompleted
                        ? 'border-emerald-200 bg-emerald-50/15'
                        : 'border-slate-200 bg-white'
                      }`}
                  >
                    {/* Phase Header */}
                    <button
                      type="button"
                      onClick={() => setExpandedPhase(isExpanded ? null : p.phase)}
                      className="w-full p-3.5 sm:p-4 text-left flex items-start sm:items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 ${isCompleted
                            ? 'bg-emerald-600 text-white'
                            : isCurrent
                              ? 'bg-[#0EA5E9] text-white shadow-md shadow-[#0EA5E9]/25'
                              : 'bg-slate-100 text-slate-500'
                            }`}
                        >
                          {isCompleted ? <Check size={16} /> : <span>{p.phase}</span>}
                        </div>

                        <div className="min-w-0">
                          <h3
                            className={`text-xs sm:text-sm font-bold truncate ${isCurrent ? 'text-[#0EA5E9]' : isCompleted ? 'text-emerald-900' : 'text-slate-800'
                              }`}
                          >
                            Phase {p.phase}: {p.title}
                          </h3>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {p.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${isCurrent
                            ? 'bg-[#0EA5E9] text-white border-[#0EA5E9]'
                            : isCompleted
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                        >
                          {isCurrent ? '● Active' : isCompleted ? '✓ Completed' : 'Upcoming'}
                        </span>
                        <span className="text-slate-400">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </span>
                      </div>
                    </button>

                    {/* Phase Details (Shows Current Status, No Deliverable) */}
                    {isExpanded && (
                      <div className="px-3.5 pb-4 sm:px-4 pt-1 border-t border-slate-100 text-xs space-y-3 animate-in fade-in duration-150">
                        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-600">
                          <Calendar size={13} className="text-slate-400" />
                          <span className="font-semibold text-slate-500">
                            {isCompleted ? 'Phase ended:' : 'Phase end date:'}
                          </span>
                          <span className="font-bold text-slate-800">
                            {(() => {
                              const end = activeApp?.phase_end_dates?.[String(p.phase)];
                              return end
                                ? new Date(end).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                                : 'To be determined';
                            })()}
                          </span>
                        </div>

                        {/* Current Status Box (Replaces Key Milestone per User Requirement) */}
                        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                              Current Status
                            </span>
                            <span className="text-xs sm:text-sm font-bold text-slate-800">
                              {isCurrent
                                ? activeApp?.status_code || profile?.status_code || 'Active Evaluation'
                                : isCompleted
                                  ? 'Phase Completed & Verified'
                                  : 'Pending Completion of Preceding Phase'}
                            </span>
                          </div>

                          {isCurrent && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#0EA5E9] bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100 self-start sm:self-auto">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9] animate-pulse" />
                              Assigned Officer: {activeApp?.handler_name || 'Unassigned'}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* ── SECTION: Candidate Profile & Assigned Case Handler (Name Only) ─ */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* 1. Candidate Profile Summary */}
            <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <User size={15} />
                </div>
                <h3 className="font-extrabold text-[#0F172A] text-xs sm:text-sm tracking-tight">
                  Candidate Profile Summary
                </h3>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200/70">
                  <span className="text-slate-500 font-medium">Applicant Code:</span>
                  <span className="font-mono font-bold text-slate-900">{profile?.applicant_code || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/70">
                  <span className="text-slate-500 font-medium">Registered Email:</span>
                  <span className="font-medium text-slate-900 truncate max-w-[170px] sm:max-w-[200px]">
                    {profile?.email || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/70">
                  <span className="text-slate-500 font-medium">Contact Number:</span>
                  <span className="font-medium text-slate-900">{profile?.contact_number || 'None provided'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/70">
                  <span className="text-slate-500 font-medium">Civil Status:</span>
                  <span className="font-medium text-slate-900">{profile?.civil_status || 'Not specified'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/70">
                  <span className="text-slate-500 font-medium">Birth Date:</span>
                  <span className="font-medium text-slate-900">{profile?.birth_date || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500 font-medium">Birthplace / Origin:</span>
                  <span className="font-medium text-slate-900 truncate max-w-[170px] sm:max-w-[200px]">
                    {profile?.place_of_birth || 'Not specified'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Assigned Case Handler (Name & Role Only - Contacts Removed per User Request) */}
            <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-sky-50 text-[#0EA5E9] flex items-center justify-center">
                      <ShieldCheck size={15} />
                    </div>
                    <h3 className="font-extrabold text-[#0F172A] text-xs sm:text-sm tracking-tight">
                      Assigned Case Handler
                    </h3>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${activeApp?.handler_name ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-600 bg-slate-100 border-slate-200'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${activeApp?.handler_name ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                    {activeApp?.handler_name ? 'Designated' : 'Unassigned'}
                  </span>
                </div>

                <div className="mt-3.5 bg-white border border-slate-200 rounded-xl p-3.5 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#0EA5E9] to-[#0284C7] text-white flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0">
                    {(activeApp?.handler_name || 'Unassigned')
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Officer Name</p>
                    <p className="font-black text-slate-900 text-sm sm:text-base truncate">
                      {activeApp?.handler_name || 'Unassigned Officer'}
                    </p>
                    <p className="text-xs text-[#0EA5E9] font-medium truncate mt-0.5">
                      {activeApp?.handler_name ? (activeApp?.stage_name || 'Agency Processing Specialist') : 'No officer assigned yet'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {profile?.agency_name || 'Agency Operations Office'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Applicant View Notice */}
              <div className="p-3 bg-sky-50/70 border border-sky-100 rounded-xl text-xs text-sky-900 flex items-start gap-2">
                <Info size={14} className="text-[#0EA5E9] flex-shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed text-sky-800">
                  This is a read-only account view for applicants. Case assignments and regulatory submissions are coordinated directly through your agency office.
                </p>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* ── SECTION: Placement Record & Document Requirements ────────────── */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <section className="space-y-4">
            {/* Active Placement Record Card */}
            <div className="bg-gradient-to-br from-slate-50 to-[#F0F9FF] border border-sky-100 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sky-200/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Award size={15} />
                  </div>
                  <h3 className="font-extrabold text-[#0F172A] text-xs sm:text-sm tracking-tight">
                    Active Placement
                  </h3>
                </div>
                <span className="font-mono text-xs font-bold text-slate-500">
                  {activeApp?.job_code || 'N/A'}
                </span>
              </div>

              {activeApp ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <h4 className="text-base sm:text-lg font-black text-slate-900">
                        {activeApp.position || 'Position Unspecified'}
                      </h4>
                      <p className="text-xs text-[#0EA5E9] font-bold mt-0.5 flex items-center gap-1">
                        <Building2 size={13} />
                        {activeApp.employer_name || 'Principal Unassigned'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-sky-100 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Destination Country</span>
                      <span className="font-bold text-slate-800 flex items-center gap-1">
                        <Globe size={12} className="text-[#0EA5E9]" />
                        {activeApp.country_name || 'Destination Pending'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Current Stage</span>
                      <span className="font-semibold text-slate-800">
                        {activeApp.status_code || profile?.status_code || 'Pending'}
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Assigned Officer</span>
                      <span className="font-semibold text-slate-800 truncate block">
                        {activeApp.handler_name || 'Unassigned'}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-4 text-center text-xs text-slate-500">
                  No active job placement order currently associated with your account.
                </div>
              )}
            </div>

            {/* Regulatory Document Requirements (Aligned with Applicant Profile) */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                    <FileCheck size={15} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[#0F172A] text-xs sm:text-sm tracking-tight">
                      Regulatory Document Compliance
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Standard DMW & Foreign Principal Required Documents for this Candidate
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-500 font-semibold self-start sm:self-auto">
                  {documents.length > 0 ? `${verifiedDocsCount} of ${documents.length} Verified` : 'No Requirements'}
                </span>
              </div>

              {/* Document List aligned with applicant profile */}
              {documents.length === 0 ? (
                <div className="py-8 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center">
                  <FileText className="text-slate-300 mb-2" size={32} />
                  <p className="text-xs font-bold text-slate-700">No Regulatory Requirements Recorded</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm">
                    Your agency has not yet assigned specific regulatory document requirements to your profile.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {documents.map((doc) => {
                    const statusNormalized = doc.status?.toUpperCase() || 'PENDING';
                    const isVerified = statusNormalized === 'VERIFIED';
                    const isUnderReview = statusNormalized === 'SUBMITTED' || statusNormalized === 'UNDER_REVIEW';
                    const hasValidExpiry = doc.expiration_date && doc.expiration_date !== 'No expiry' && doc.expiration_date !== 'N/A';

                    return (
                      <div
                        key={doc.applicant_req_id}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-slate-800 truncate">{doc.requirement_name}</p>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 truncate">
                            <span>{doc.category || 'MANDATORY DOCUMENT'}</span>
                            <span>·</span>
                            <span>Expires: {hasValidExpiry ? doc.expiration_date : 'N/A'}</span>
                          </div>
                        </div>

                        <div className="flex-shrink-0">
                          {isVerified ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 size={11} /> Verified
                            </span>
                          ) : isUnderReview ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                              <Clock size={11} /> Under Review
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">
                              Pending
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Regulatory Notice for Applicants */}
              <p className="text-[10px] sm:text-[11px] text-slate-400 text-center pt-2 leading-relaxed">
                Applicant View: Document verifications and uploads are recorded and authenticated by your assigned agency case handler in accordance with DMW standards.
              </p>
            </div>
          </section>
        </div>

        {/* ── 4. Card Dossier Footer ───────────────────────────────────────── */}
        <footer className="border-t border-slate-200 bg-slate-50/80 py-4 px-4 sm:px-6 text-center text-[10px] sm:text-[11px] text-slate-400">
          <p>
            FlowSensus Candidate Placement Dossier · Read-Only Applicant View · Regulated by Philippine DMW & POEA
          </p>
        </footer>
      </div>
    </div>
  );
}
