import { useState, useEffect, useRef } from 'react';
import {
  LogOut, Briefcase, Clock, CheckCircle2, Globe, Building2,
  Award, Layers, ShieldCheck, FileCheck, Stethoscope, FileText,
  PlaneTakeoff, User, RefreshCw, Copy, Check, ChevronDown,
  ChevronUp, Milestone, AlertTriangle, Bell, X, Info, Calendar,
  Compass, ChevronRight
} from 'lucide-react';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { ApplicationForecastResponse } from '../types';
import ExamPortal from './views/ExamPortal';

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
    title: 'Application & Screening',
    shortTitle: 'Screening',
    subtitle: 'Checking your basic qualifications, information, and initial test',
    icon: FileCheck,
    description: 'We review your background and basic details to match you with available jobs abroad.',
  },
  {
    phase: 2,
    title: 'Medical Examination',
    shortTitle: 'Medical',
    subtitle: 'Official clinic health checkup and Fit-to-Work certification',
    icon: Stethoscope,
    description: 'A routine medical exam at an accredited clinic to make sure you are healthy and ready to travel.',
  },
  {
    phase: 3,
    title: 'Resume & Agency Approval',
    shortTitle: 'Resume & Sign-Off',
    subtitle: 'Preparing your standardized international resume and agency sign-off',
    icon: FileText,
    description: 'Your resume is formatted and approved by the agency operations team for employer presentation.',
  },
  {
    phase: 4,
    title: 'Employer Matching & Selection',
    shortTitle: 'Employer Match',
    subtitle: 'Your profile is presented to the employer for contract offer and hiring',
    icon: Building2,
    description: 'Your profile is forwarded to the accredited overseas employer for final selection and job offer.',
  },
  {
    phase: 5,
    title: 'Work Visa & Departure',
    shortTitle: 'Flight & Departure',
    subtitle: 'POEA/DMW government clearance, work visa, pre-departure seminar, and flight booking',
    icon: PlaneTakeoff,
    description: 'Final government travel clearances, visa stamping, pre-departure orientation (PDOS), and ticket booking.',
  },
];

function formatDeploymentDate(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) || !Number.isFinite(Date.parse(value))) return null;
  const calendarDate = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== value.slice(0, 10)) return null;
  return calendarDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function formatCleanEmployerName(rawName?: string | null): string {
  if (!rawName) return 'Accredited Foreign Principal';
  const parts = rawName.split(/[\/\\]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return rawName.trim();
  // If the database has multiple repeated aliases separated by slash, return the primary clean name
  return parts[0];
}

function ApplicantDeploymentCard({ application, agencyId }: { application: PortalApplication | null; agencyId?: number }) {
  const applicationId = application?.application_id;
  const applicantId = application?.applicant_id;
  const confirmedDate = formatDeploymentDate(application?.actual_deployment_at);
  const validApplication = typeof applicationId === 'number' && Number.isSafeInteger(applicationId) && applicationId > 0;
  const basis = JSON.stringify([applicationId, applicantId, agencyId, application?.actual_deployment_at,
    application?.current_phase, application?.status_code, application?.updated_at]);
  const [forecast, setForecast] = useState<{ basis: string; loading: boolean; data: ApplicationForecastResponse | null } | null>(null);

  useEffect(() => {
    if (confirmedDate || !validApplication) {
      setForecast(null);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setForecast({ basis, loading: true, data: null });
    const loadForecast = async () => {
      try {
        const { data } = await api.get<ApplicationForecastResponse>(`/forecasting/application/${applicationId}`, { signal: controller.signal });
        if (cancelled) return;
        const matchesIdentity = (value: ApplicationForecastResponse | NonNullable<ApplicationForecastResponse['record']>) =>
          value.application_id === applicationId &&
          (agencyId == null || value.agency_id === agencyId) &&
          (value.applicant_id == null || value.applicant_id === applicantId);
        if (!data || !matchesIdentity(data) || (data.record && !matchesIdentity(data.record))) {
          throw new Error('Forecast response does not match this application.');
        }
        setForecast({ basis, loading: false, data });
      } catch {
        if (!cancelled) setForecast({ basis, loading: false, data: null });
      }
    };
    void loadForecast();
    return () => { cancelled = true; controller.abort(); };
  }, [application, basis, confirmedDate, validApplication, applicationId, applicantId, agencyId]);

  // Guard the render as well as the request: old application data never flashes during a change.
  const response = forecast?.basis === basis ? forecast.data : null;
  const loadingForecast = !confirmedDate && validApplication && (forecast?.basis !== basis || forecast.loading);
  const estimatedDate = formatDeploymentDate(response?.record?.estimated_deployment_date);
  const timingUnavailable = (Array.isArray(response?.limitations) ? response.limitations : []).some((limitation) =>
    /active-stage start timestamp is unavailable|remaining eta cannot be calculated/i.test(limitation));
  const remainingDays = response?.record?.estimated_remaining_days;
  const hasRemainingDays = typeof remainingDays === 'number' && Number.isFinite(remainingDays) && remainingDays >= 0;
  const hasEstimate = Boolean(response?.record && !timingUnavailable && (estimatedDate || hasRemainingDays));
  const pipelineRemainingDays = response?.pipeline_estimated_remaining_days;
  const hasPipelineEstimate = typeof pipelineRemainingDays === 'number' && Number.isFinite(pipelineRemainingDays) && pipelineRemainingDays >= 0;
  const phase = response?.current_stage || application?.stage_name ||
    PHASES.find((item) => item.phase === application?.current_phase)?.title || application?.status_code;

  return (
    <div className="bg-white border border-sky-100 rounded-2xl p-4 sm:p-5 space-y-3" aria-live="polite">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <div className="w-7 h-7 rounded-lg bg-sky-50 text-[#0EA5E9] flex items-center justify-center">
          <Calendar size={15} />
        </div>
        <h3 className="font-extrabold text-[#0F172A] text-xs sm:text-sm tracking-tight">
          {confirmedDate ? 'Confirmed Departure Date' : 'Estimated Departure Timeline'}
        </h3>
      </div>
      {confirmedDate ? (
        <div>
          <p className="text-xs font-semibold text-emerald-700">Official Travel / Departure Date</p>
          <p className="text-lg sm:text-xl font-black text-slate-900 mt-1">{confirmedDate}</p>
        </div>
      ) : loadingForecast ? (
        <p className="text-xs text-slate-500 flex items-center gap-2">
          <RefreshCw size={13} className="animate-spin" /> Calculating timeline...
        </p>
      ) : hasEstimate ? (
        <div>
          <p className="text-xs font-semibold text-sky-700">{estimatedDate ? 'Target Departure Window' : 'Estimated Time Remaining'}</p>
          <p className="text-lg sm:text-xl font-black text-slate-900 mt-1">{estimatedDate || `About ${remainingDays} days`}</p>
          {estimatedDate && hasRemainingDays && (
            <p className="text-xs text-slate-600 mt-1.5">Approximately {remainingDays} days until departure readiness.</p>
          )}
          <p className="text-[11px] text-slate-500 mt-2">
            This is an automated estimate while requirements are in progress. Your agency will confirm your official departure schedule.
          </p>
        </div>
      ) : hasPipelineEstimate ? (
        <div>
          <p className="text-xs font-semibold text-sky-700">Estimated Departure Readiness</p>
          <p className="text-lg sm:text-xl font-black text-slate-900 mt-1">~{Math.round(pipelineRemainingDays)} Days to Target Departure</p>
          <p className="text-[11px] text-slate-500 mt-2">
            Estimated based on standard processing times for your destination. Your agency officer will confirm exact travel dates once your requirements are complete.
          </p>
        </div>
      ) : (
        <div>
          <p className="text-sm font-bold text-slate-800">Timeline being prepared</p>
          <p className="text-xs text-slate-500 mt-1">
            {application
              ? 'Your estimated departure timeline will appear once your initial screening is recorded.'
              : 'Your estimated departure timeline will appear once your application is active.'}
          </p>
        </div>
      )}
      {phase && (
        <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-600">
          <span className="text-slate-400">Current Step:</span>
          <span className="font-semibold text-slate-800">{phase}</span>
        </div>
      )}
    </div>
  );
}

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
  const [activeTab, setActiveTab] = useState<'overview' | 'steps' | 'documents' | 'profile' | 'all'>('overview');

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

      const [resProfile, resApps, resDocs] = await Promise.allSettled([
        api.get('/applicants/me'),
        api.get('/applicants/me/applications'),
        api.get('/applicants/me/documents'),
      ]);

      if (resProfile.status === 'fulfilled' && resProfile.value.data) {
        setProfile(resProfile.value.data);
      } else if (resProfile.status === 'rejected') {
        throw resProfile.reason; // Required data, must fail
      }
      
      if (resApps.status === 'fulfilled' && Array.isArray(resApps.value.data)) {
        setApplications(resApps.value.data);
      }
      
      if (resDocs.status === 'fulfilled' && Array.isArray(resDocs.value.data)) {
        setDocuments(resDocs.value.data);
      } else {
        setDocuments([]);
      }

      // Persist to session cache for instant future loads
      try {
        sessionStorage.setItem('fs_cache_applicant_portal', JSON.stringify({
          profile: resProfile.status === 'fulfilled' ? resProfile.value.data : null,
          applications: resApps.status === 'fulfilled' && Array.isArray(resApps.value.data) ? resApps.value.data : [],
          documents: resDocs.status === 'fulfilled' && Array.isArray(resDocs.value.data) ? resDocs.value.data : [],
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

  const rawHandler = activeApp?.handler_name?.trim();
  const isHandlerAssigned = Boolean(rawHandler && !/unassigned/i.test(rawHandler));
  const handlerDisplayName = isHandlerAssigned ? rawHandler : null;

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

  if (isHandlerAssigned && handlerDisplayName) {
    notificationsList.push({
      id: 3,
      title: 'Officer Assigned',
      message: `Processing Officer: ${handlerDisplayName} is managing your application.`,
      time: 'Assignment',
      type: 'info',
    });
  }

  return (
    <div className="w-full min-h-screen bg-slate-100 text-[#0F172A] flex flex-col items-center justify-start py-2 sm:py-4 md:py-6 px-2 sm:px-4 md:px-6 lg:px-8 antialiased selection:bg-[#0EA5E9]/20 overflow-x-hidden">
      {/* ── Single Master Portal Card ─────────────────────────────────────── */}
      <div className="w-full max-w-7xl xl:max-w-[1440px] bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-slate-200/90 overflow-hidden flex flex-col">
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
                <span className="text-[11px] font-bold text-slate-300">Overall Progress</span>
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
                <span>Step {currentPhaseNumber} of 5</span>
                <span className="text-emerald-400 font-bold">
                  {PHASES[currentPhaseNumber - 1]?.shortTitle || 'In Progress'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. Tab Navigation Bar (Evenly Spread Across Full Width) ──── */}
        <div className="bg-slate-50/90 border-b border-slate-200 px-2 sm:px-6 md:px-8 py-2 sm:py-2.5">
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5 md:gap-3 w-full">
            {[
              { id: 'overview', label: 'Overview', icon: Compass },
              { id: 'steps', label: 'Application Steps', icon: Milestone },
              { id: 'documents', label: 'Required Documents', icon: FileCheck, count: documents.length > 0 ? `${verifiedDocsCount}/${documents.length}` : undefined },
              { id: 'profile', label: 'Profile', icon: User },
              { id: 'all', label: 'View All', icon: Layers },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  title={tab.label}
                  aria-label={tab.label}
                  className={`w-full inline-flex items-center justify-center gap-1.5 sm:gap-2 px-1 sm:px-3 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer relative text-center ${
                    isActive
                      ? 'bg-white text-[#0284C7] shadow-xs border border-slate-200/90 ring-1 ring-[#0EA5E9]/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Icon size={17} className={isActive ? 'text-[#0EA5E9]' : 'text-slate-500'} />
                  <span className="hidden sm:inline whitespace-nowrap">{tab.label}</span>
                  {tab.count && (
                    <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-sky-100 text-[#0284C7]' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 4. Card Inner Body (Rendered based on Active Tab) ─────────────── */}
        <div className="p-4 sm:p-6 md:p-8">
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: OVERVIEW & WHAT'S NEXT (Default, Calm, Uncluttered) ──────── */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                {/* Left: What to do now (Exam) + Timeline */}
                <div className="lg:col-span-7 xl:col-span-8 space-y-6">
                  {/* Digital Exam Section (Primary Action) */}
                  <section id="portal-exams-section" className="space-y-3">
                    <ExamPortal />
                  </section>

                  {/* Departure Timeline Card */}
                  <ApplicantDeploymentCard application={activeApp} agencyId={profile?.agency_id} />
                </div>

                {/* Right: Job Details + Coordinator */}
                <div className="lg:col-span-5 xl:col-span-4 space-y-6">
                  {/* Active Job Assignment Card */}
                  <div className="bg-gradient-to-br from-slate-50 to-[#F0F9FF] border border-sky-100 rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sky-200/60 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <Award size={15} />
                        </div>
                        <h3 className="font-extrabold text-[#0F172A] text-xs sm:text-sm tracking-tight">
                          Your Job Assignment
                        </h3>
                      </div>
                      <span className="font-mono text-xs font-semibold text-slate-500 bg-white/80 px-2 py-0.5 rounded-md border border-slate-200">
                        Ref: {activeApp?.job_code || 'Pending'}
                      </span>
                    </div>

                    {activeApp ? (
                      <>
                        <div>
                          <h4 className="text-base sm:text-lg font-black text-slate-900">
                            {activeApp.position || 'Position to be confirmed'}
                          </h4>
                          <p
                            className="text-xs text-sky-800 font-semibold mt-1 flex items-center gap-1.5"
                            title={activeApp.employer_name || undefined}
                          >
                            <Building2 size={14} className="text-[#0EA5E9] shrink-0" />
                            <span>{formatCleanEmployerName(activeApp.employer_name)}</span>
                          </p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2.5 pt-2 border-t border-sky-100 text-xs">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Destination</span>
                            <span className="font-bold text-slate-800 flex items-center gap-1">
                              <Globe size={12} className="text-[#0EA5E9]" />
                              {activeApp.country_name || 'Pending assignment'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Status</span>
                            <span className="font-semibold text-slate-800">
                              {activeApp.status_code || profile?.status_code || 'Screening'}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Assigned Coordinator</span>
                            <span className="font-semibold text-slate-800 truncate block">
                              {isHandlerAssigned ? handlerDisplayName : 'No staff currently assigned'}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="py-4 text-center text-xs text-slate-500">
                        Your agency is currently matching your profile with available job orders.
                      </div>
                    )}
                  </div>

                  {/* Assigned Application Processor */}
                  <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-center">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-sky-50 text-[#0EA5E9] flex items-center justify-center">
                          <ShieldCheck size={15} />
                        </div>
                        <h3 className="font-extrabold text-[#0F172A] text-xs sm:text-sm tracking-tight">
                          Application Processor
                        </h3>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${isHandlerAssigned ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-600 bg-slate-100 border-slate-200'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isHandlerAssigned ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        {isHandlerAssigned ? 'Assigned' : 'Unassigned'}
                      </span>
                    </div>

                    <div className="mt-3.5 bg-white border border-slate-200 rounded-xl p-3.5 flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0 ${isHandlerAssigned ? 'bg-gradient-to-tr from-[#0EA5E9] to-[#0284C7] text-white' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                        {isHandlerAssigned && handlerDisplayName ? (
                          handlerDisplayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                        ) : (
                          <User size={18} className="text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          {isHandlerAssigned ? 'Processing Officer' : 'Processing Status'}
                        </p>
                        <p className={`text-sm sm:text-base truncate ${isHandlerAssigned ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>
                          {isHandlerAssigned ? handlerDisplayName : 'No staff is currently processing your application'}
                        </p>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {profile?.agency_name || 'Agency Operations Office'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Helpful Quick Navigation Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('steps')}
                  className="p-4 rounded-2xl border border-slate-200 bg-white hover:bg-sky-50/50 hover:border-sky-300 transition-all text-left flex items-center justify-between group cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#0EA5E9] flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Milestone size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#0EA5E9] transition-colors">
                        View Application Steps
                      </h4>
                      <p className="text-xs text-slate-500">Currently in Step {currentPhaseNumber}: {PHASES[currentPhaseNumber - 1]?.shortTitle}</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-400 group-hover:text-[#0EA5E9] group-hover:translate-x-1 transition-all" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('documents')}
                  className="p-4 rounded-2xl border border-slate-200 bg-white hover:bg-purple-50/50 hover:border-purple-300 transition-all text-left flex items-center justify-between group cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <FileCheck size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                        Check Required Documents
                      </h4>
                      <p className="text-xs text-slate-500">{documents.length > 0 ? `${verifiedDocsCount} of ${documents.length} verified` : 'View document requirements'}</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: APPLICATION STEPS (Spacious, Clear Journey) ──────────────── */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'steps' || activeTab === 'all') && (
            <div className={activeTab === 'all' ? 'mt-8 pt-8 border-t border-slate-200' : 'space-y-4'}>
              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="font-extrabold text-[#0F172A] text-base sm:text-lg tracking-tight flex items-center gap-2">
                      <Milestone size={18} className="text-[#0EA5E9]" />
                      <span>Application Steps</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Track your application progress and upcoming milestones
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0EA5E9] bg-sky-50 px-3 py-1 rounded-full border border-sky-200 self-start sm:self-auto">
                    <span className="w-2 h-2 rounded-full bg-[#0EA5E9] animate-pulse" />
                    Currently in Step {currentPhaseNumber}
                  </span>
                </div>

                {/* Responsive Phase Step Selector */}
                <div className="flex flex-wrap sm:flex-nowrap gap-2">
                  {PHASES.map((p) => {
                    const isCurrent = p.phase === currentPhaseNumber;
                    const isCompleted = p.phase < currentPhaseNumber;
                    return (
                      <button
                        key={p.phase}
                        type="button"
                        onClick={() => setExpandedPhase(p.phase)}
                        className={`flex-1 min-w-[70px] sm:min-w-0 py-2.5 px-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                          isCurrent
                            ? 'border-[#0EA5E9] bg-sky-50 text-[#0EA5E9] font-bold shadow-xs'
                            : isCompleted
                            ? 'border-emerald-200 bg-emerald-50/50 text-emerald-800'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-[11px] sm:text-xs font-black">Step {p.phase}</div>
                        <div className="text-[9px] sm:text-[10px] truncate mt-0.5">{p.shortTitle}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Detailed Phase Cards */}
                <div className="space-y-3 pt-1">
                  {PHASES.map((p) => {
                    const isCurrent = p.phase === currentPhaseNumber;
                    const isCompleted = p.phase < currentPhaseNumber;
                    const isExpanded = expandedPhase === p.phase || isCurrent;

                    return (
                      <div
                        key={p.phase}
                        className={`rounded-2xl border transition-all overflow-hidden ${
                          isCurrent
                            ? 'border-[#0EA5E9] bg-sky-50/30 ring-2 ring-[#0EA5E9]/20 shadow-sm'
                            : isCompleted
                            ? 'border-emerald-200 bg-emerald-50/15'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedPhase(isExpanded ? null : p.phase)}
                          className="w-full p-3.5 sm:p-4 text-left flex items-start sm:items-center justify-between gap-3 cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 ${
                                isCompleted
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
                                className={`text-xs sm:text-sm font-bold truncate ${
                                  isCurrent ? 'text-[#0EA5E9]' : isCompleted ? 'text-emerald-900' : 'text-slate-800'
                                }`}
                              >
                                Step {p.phase}: {p.title}
                              </h3>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                {p.subtitle}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                isCurrent
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

                        {isExpanded && (
                          <div className="px-3.5 pb-4 sm:px-4 pt-1 border-t border-slate-100 text-xs space-y-3 animate-in fade-in duration-150">
                            <p className="text-[11px] text-slate-600 leading-relaxed pt-1">
                              {p.description}
                            </p>

                            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-600">
                              <Calendar size={13} className="text-slate-400" />
                              <span className="font-semibold text-slate-500">
                                {isCompleted ? 'Completed on:' : 'Target completion date:'}
                              </span>
                              <span className="font-bold text-slate-800">
                                {(() => {
                                  const end = activeApp?.phase_end_dates?.[String(p.phase)];
                                  return end
                                    ? new Date(end).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                                    : 'Will be confirmed by agency';
                                })()}
                              </span>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                                  Status for this Step
                                </span>
                                <span className="text-xs sm:text-sm font-bold text-slate-800">
                                  {isCurrent
                                    ? 'In Progress — Agency is currently reviewing your submissions'
                                    : isCompleted
                                    ? 'Step Completed & Verified'
                                    : 'Pending completion of the previous step'}
                                </span>
                              </div>

                              {isCurrent && (
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#0EA5E9] bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100 self-start sm:self-auto">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9] animate-pulse" />
                                  Officer: {activeApp?.handler_name || 'Designated by agency'}
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
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 3: REQUIRED DOCUMENTS CHECKLIST ─────────────────────────────── */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'documents' || activeTab === 'all') && (
            <div className={activeTab === 'all' ? 'mt-8 pt-8 border-t border-slate-200' : 'space-y-4'}>
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                      <FileCheck size={15} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-[#0F172A] text-xs sm:text-sm tracking-tight">
                        Required Documents Checklist
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Mandatory papers for POEA / DMW clearance and travel readiness
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 font-semibold self-start sm:self-auto">
                    {documents.length > 0 ? `${verifiedDocsCount} of ${documents.length} Verified` : 'No Requirements Recorded'}
                  </span>
                </div>

                {documents.length === 0 ? (
                  <div className="py-8 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center">
                    <FileText className="text-slate-300 mb-2" size={32} />
                    <p className="text-xs font-bold text-slate-700">No Document Requirements Assigned Yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm">
                      Your agency will list any required papers here (e.g. Passport, NBI Clearance, Medical) as your application progresses.
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
                              <span>{doc.category || 'MANDATORY REQUIREMENT'}</span>
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
                                <Clock size={11} /> In Review
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">
                                To Submit
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 4: YOUR PROFILE & AGENCY INFO ───────────────────────────────── */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {(activeTab === 'profile' || activeTab === 'all') && (
            <div className={activeTab === 'all' ? 'mt-8 pt-8 border-t border-slate-200' : 'space-y-6'}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Candidate Profile Summary */}
                <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <User size={15} />
                    </div>
                    <h3 className="font-extrabold text-[#0F172A] text-xs sm:text-sm tracking-tight">
                      Your Registered Information
                    </h3>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-200/70">
                      <span className="text-slate-500 font-medium">Application Reference:</span>
                      <span className="font-mono font-bold text-slate-900">{profile?.applicant_code || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/70">
                      <span className="text-slate-500 font-medium">Email Address:</span>
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
                      <span className="text-slate-500 font-medium">Home Province / Origin:</span>
                      <span className="font-medium text-slate-900 truncate max-w-[170px] sm:max-w-[200px]">
                        {profile?.place_of_birth || 'Not specified'}
                      </span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 text-center pt-1">
                    To update any personal details or contact numbers, please notify your agency coordinator.
                  </p>
                </div>

                {/* Application Processor */}
                <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-center">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-sky-50 text-[#0EA5E9] flex items-center justify-center">
                        <ShieldCheck size={15} />
                      </div>
                      <h3 className="font-extrabold text-[#0F172A] text-xs sm:text-sm tracking-tight">
                        Application Processor
                      </h3>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${isHandlerAssigned ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-600 bg-slate-100 border-slate-200'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isHandlerAssigned ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                      {isHandlerAssigned ? 'Assigned' : 'Unassigned'}
                    </span>
                  </div>

                  <div className="mt-3.5 bg-white border border-slate-200 rounded-xl p-3.5 flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0 ${isHandlerAssigned ? 'bg-gradient-to-tr from-[#0EA5E9] to-[#0284C7] text-white' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                      {isHandlerAssigned && handlerDisplayName ? (
                        handlerDisplayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                      ) : (
                        <User size={18} className="text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        {isHandlerAssigned ? 'Processing Officer' : 'Processing Status'}
                      </p>
                      <p className={`text-sm sm:text-base truncate ${isHandlerAssigned ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>
                        {isHandlerAssigned ? handlerDisplayName : 'No staff is currently processing your application'}
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {profile?.agency_name || 'Agency Operations Office'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── 4. Card Dossier Footer ───────────────────────────────────────── */}
        <footer className="border-t border-slate-200 bg-slate-50/80 py-4 px-4 sm:px-6 text-center text-xs font-semibold text-slate-500">
          <p>{profile?.agency_name || 'FlowSensus'}</p>
        </footer>
      </div>
    </div>
  );
}
