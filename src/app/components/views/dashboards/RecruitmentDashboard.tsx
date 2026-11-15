import React, { useState, useMemo } from 'react';
import {
  UserPlus,
  FileCheck,
  CheckCircle2,
  Search,
  Stethoscope,
  ClipboardCheck,
  Users,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  ArrowUpRight,
  Briefcase,
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  UserCheck,
  Lock,
  Eye
} from 'lucide-react';
import { Skeleton } from '../../ui/skeleton';
import { ApplicantRecord, ActivityLog, UserRole } from '../../../types';
import { ViewType } from '../../AppShell';
import { hasAccessToView } from '../../../../lib/accessControl';

function getInitials(name?: string, fallback = 'AP'): string {
  if (!name || typeof name !== 'string') return fallback;
  const clean = name.replace(/^(Engr\.|Dr\.|Mr\.|Ms\.|Mrs\.)\s+/i, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return clean.substring(0, 2).toUpperCase();
}

function getDaysWaiting(dateStr?: string): { days: number; label: string; isOverdue: boolean } {
  if (!dateStr) return { days: 0, label: 'Recent', isOverdue: false };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { days: 0, label: 'Recent', isOverdue: false };
    const diffMs = Date.now() - d.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days <= 0) return { days: 0, label: 'Today', isOverdue: false };
    if (days === 1) return { days: 1, label: '1 day pending', isOverdue: false };
    return { days, label: `${days}d pending`, isOverdue: days >= 3 };
  } catch {
    return { days: 0, label: 'Recent', isOverdue: false };
  }
}

interface RecruitmentDashboardProps {
  applicants: ApplicantRecord[];
  activityLogs?: ActivityLog[];
  onViewApplicant: (applicantId: string) => void;
  onNavigate: (view: ViewType) => void;
  isLoading?: boolean;
  userRoles?: UserRole[];
  workflowPermissions?: Record<string, UserRole[]>;
  isSuperAdmin?: boolean;
  showToast?: (message: string) => void;
  hideHeader?: boolean;
}

export default function RecruitmentDashboard({
  applicants = [],
  activityLogs = [],
  onViewApplicant,
  onNavigate,
  isLoading = false,
  userRoles = ['Recruitment'],
  workflowPermissions,
  isSuperAdmin = false,
  showToast,
  hideHeader = false,
}: RecruitmentDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'screening' | 'medical' | 'cv' | 'endorsement'>('all');
  const [showAllMedical, setShowAllMedical] = useState(false);
  const [showAllScreening, setShowAllScreening] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Authoritative permission helper for this session
  const canAccess = (view: ViewType): boolean => {
    return hasAccessToView(view, userRoles, isSuperAdmin, workflowPermissions);
  };

  const handleSafeNavigate = (view: ViewType, moduleName = 'this') => {
    if (!canAccess(view)) {
      showToast?.(`Access Restricted: Your assigned role does not have permission to access the ${moduleName} module.`);
      return;
    }
    onNavigate(view);
  };

  // Pipeline Queues
  const activeApplicants = useMemo(() => {
    return applicants.filter((a) => !a.isStopped);
  }, [applicants]);

  const pendingScreenings = useMemo(() => {
    return activeApplicants.filter((a) => a.phase === 1);
  }, [activeApplicants]);

  const pendingMedical = useMemo(() => {
    return activeApplicants.filter((a) => a.phase === 2);
  }, [activeApplicants]);

  const readyForCV = useMemo(() => {
    return activeApplicants.filter((a) => a.phase === 3);
  }, [activeApplicants]);

  const waitingEmployer = useMemo(() => {
    return activeApplicants.filter((a) => a.phase === 4);
  }, [activeApplicants]);

  // Filtered candidate list based on search and selected phase filter
  const filteredCandidates = useMemo(() => {
    return activeApplicants.filter((a) => {
      const name = (a.name || `${a.firstName || ''} ${a.lastName || ''}`).toLowerCase();
      const code = (a.applicantCode || a.id || '').toLowerCase();
      const role = (a.role || '').toLowerCase();
      const jo = (a.jobOrder || '').toLowerCase();
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch = !q || name.includes(q) || code.includes(q) || role.includes(q) || jo.includes(q);

      if (!matchesSearch) return false;
      if (phaseFilter === 'screening') return a.phase === 1;
      if (phaseFilter === 'medical') return a.phase === 2;
      if (phaseFilter === 'cv') return a.phase === 3;
      if (phaseFilter === 'endorsement') return a.phase === 4;
      return true;
    });
  }, [activeApplicants, searchTerm, phaseFilter]);

  // Reset page when filter changes
  const handleFilterChange = (newFilter: 'all' | 'screening' | 'medical' | 'cv' | 'endorsement') => {
    setPhaseFilter(newFilter);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  // Pagination calculation
  const totalPages = Math.ceil(filteredCandidates.length / pageSize) || 1;
  const paginatedCandidates = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCandidates.slice(start, start + pageSize);
  }, [filteredCandidates, currentPage]);

  // Contextual stage action with graceful fallback to Profile View if module is restricted
  const getStageAction = (applicant: ApplicantRecord) => {
    let targetView: ViewType = 'applicants';
    let label = 'View Profile';
    let color = 'text-slate-700 bg-white hover:bg-slate-50 border-slate-200';

    if (applicant.phase === 1) {
      targetView = 'screening';
      label = 'Screen';
      color = 'text-sky-700 bg-sky-50 hover:bg-sky-100 border-sky-200';
    } else if (applicant.phase === 2) {
      targetView = 'fittowork';
      label = 'Enter Medical';
      color = 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200';
    } else if (applicant.phase === 3) {
      targetView = 'cv';
      label = 'Prepare CV';
      color = 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200';
    } else if (applicant.phase === 4) {
      targetView = 'endorsement';
      label = 'Endorse';
      color = 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200';
    }

    // Check if current user has permission to access the target module
    const hasPermission = canAccess(targetView);

    return {
      label: hasPermission ? label : 'View File',
      hasPermission,
      targetView,
      color: hasPermission ? color : 'text-slate-600 bg-slate-50 hover:bg-slate-100 border-slate-200',
    };
  };

  const displayedMedical = showAllMedical ? pendingMedical : pendingMedical.slice(0, 5);
  const displayedScreening = showAllScreening ? pendingScreenings : pendingScreenings.slice(0, 5);

  const canAccessMedical = canAccess('fittowork');
  const canAccessScreening = canAccess('screening');
  const canAccessRegistration = canAccess('registration');
  const canAccessCV = canAccess('cv');
  const canAccessExams = canAccess('digital-exams');

  return (
    <div className="space-y-6 w-full font-['Inter',sans-serif]">
      {/* Unified Flowsensus Dashboard Header */}
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
              Recruitment & Candidate Sourcing
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              New candidate intake, screening evaluations, and clinic medical clearances.
            </p>
          </div>

          {/* Header Action Buttons (Permission-Aware) */}
          <div className="flex flex-wrap items-center gap-2.5">
            {canAccessRegistration && (
              <button
                type="button"
                onClick={() => onNavigate('registration')}
                className="px-3.5 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <UserPlus className="w-4 h-4" />
                <span>Register Candidate</span>
              </button>
            )}
            {canAccessScreening && (
              <button
                type="button"
                onClick={() => onNavigate('screening')}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <ClipboardCheck className="w-4 h-4 text-slate-500" />
                <span>Screening Panel</span>
              </button>
            )}
            {canAccessMedical && (
              <button
                type="button"
                onClick={() => onNavigate('fittowork')}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <Stethoscope className="w-4 h-4 text-indigo-500" />
                <span>Fit-to-Work</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Embedded Action Toolbar when rendered in Multi-Role Dashboard */}
      {hideHeader && (canAccessRegistration || canAccessScreening || canAccessMedical) && (
        <div className="flex items-center justify-end gap-2.5 pb-1">
          {canAccessRegistration && (
            <button
              type="button"
              onClick={() => onNavigate('registration')}
              className="px-3.5 py-1.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Register Candidate</span>
            </button>
          )}
          {canAccessScreening && (
            <button
              type="button"
              onClick={() => onNavigate('screening')}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <ClipboardCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>Screening Panel</span>
            </button>
          )}
          {canAccessMedical && (
            <button
              type="button"
              onClick={() => onNavigate('fittowork')}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <Stethoscope className="w-3.5 h-3.5 text-indigo-500" />
              <span>Fit-to-Work</span>
            </button>
          )}
        </div>
      )}

      {/* 2. Interactive Pipeline Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total Active Sourcing */}
        <div
          onClick={() => handleFilterChange('all')}
          className={`cursor-pointer bg-white p-4 sm:p-5 rounded-xl border transition-all hover:shadow-sm ${
            phaseFilter === 'all'
              ? 'ring-2 ring-slate-900 border-transparent shadow-sm'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Sourcing</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div>
              <p className="text-2xl sm:text-3xl font-black text-slate-900">{activeApplicants.length}</p>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">All active intake profiles</p>
            </div>
          )}
        </div>

        {/* Card 2: Awaiting Medical (Phase 2) */}
        <div
          onClick={() => handleFilterChange('medical')}
          className={`cursor-pointer bg-white p-4 sm:p-5 rounded-xl border transition-all hover:shadow-sm ${
            phaseFilter === 'medical'
              ? 'ring-2 ring-indigo-500 border-transparent shadow-sm'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Awaiting Medical</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Stethoscope className="w-4 h-4" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div>
              <p className="text-2xl sm:text-3xl font-black text-indigo-600">{pendingMedical.length}</p>
              <p className="text-[11px] text-indigo-600/80 mt-1 font-medium">Phase 2 clinic referrals</p>
            </div>
          )}
        </div>

        {/* Card 3: Ready for CV Prep (Phase 3) */}
        <div
          onClick={() => handleFilterChange('cv')}
          className={`cursor-pointer bg-white p-4 sm:p-5 rounded-xl border transition-all hover:shadow-sm ${
            phaseFilter === 'cv'
              ? 'ring-2 ring-emerald-500 border-transparent shadow-sm'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Ready for CV</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div>
              <p className="text-2xl sm:text-3xl font-black text-emerald-600">{readyForCV.length}</p>
              <p className="text-[11px] text-emerald-600/80 mt-1 font-medium">Fit-to-work cleared</p>
            </div>
          )}
        </div>

        {/* Card 4: Under Employer Review (Phase 4) */}
        <div
          onClick={() => handleFilterChange('endorsement')}
          className={`cursor-pointer bg-white p-4 sm:p-5 rounded-xl border transition-all hover:shadow-sm ${
            phaseFilter === 'endorsement'
              ? 'ring-2 ring-amber-500 border-transparent shadow-sm'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Under Review</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div>
              <p className="text-2xl sm:text-3xl font-black text-amber-600">{waitingEmployer.length}</p>
              <p className="text-[11px] text-amber-600/80 mt-1 font-medium">Endorsed to foreign principals</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Priority Work Queues: Medical Results & Initial Screenings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Queue 1: Medical Follow-Ups */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <Stethoscope className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">Medical Results Follow-up</h3>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                    {pendingMedical.length}
                  </span>
                </div>
                <p className="text-xs text-slate-500">Candidates awaiting clinic Fit-to-Work confirmation</p>
              </div>
            </div>

            {/* Header Link with Permission Guard */}
            {canAccessMedical ? (
              <button
                type="button"
                onClick={() => onNavigate('fittowork')}
                className="text-xs font-semibold text-[#0EA5E9] hover:text-[#0284C7] flex items-center gap-1 cursor-pointer"
              >
                Fit-to-Work Panel <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                <Lock className="w-3 h-3 text-slate-400" />
                Clinic Admin Managed
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {pendingMedical.length === 0 ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-800">All medical results updated</p>
                <p className="text-xs text-slate-400 mt-0.5">No candidates currently waiting for clinic clearance.</p>
              </div>
            ) : (
              displayedMedical.map((applicant) => {
                const wait = getDaysWaiting(applicant.lastUpdated || applicant.createdAt);
                return (
                  <div key={applicant.id} className="p-3.5 sm:p-4 hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-200 shrink-0">
                        {getInitials(applicant.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => onViewApplicant(applicant.id)}
                            className="font-bold text-slate-900 text-sm hover:text-[#0EA5E9] transition-colors truncate text-left"
                          >
                            {applicant.name || 'Unnamed Candidate'}
                          </button>
                          {applicant.jobOrder && (
                            <span className="font-mono text-[10px] text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.2 rounded shrink-0">
                              {applicant.jobOrder}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {applicant.applicantCode || applicant.id} • {applicant.role || 'Applicant'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-semibold px-2 py-0.2 rounded-full border ${
                            wait.isOverdue
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}>
                            {wait.label}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Handler: {applicant.currentHandler || 'Unassigned'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onViewApplicant(applicant.id)}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        Profile
                      </button>
                      {/* If user has access to Fit-to-Work, show 'Enter Result'; otherwise fallback gracefully to 'View File' */}
                      {canAccessMedical ? (
                        <button
                          type="button"
                          onClick={() => onNavigate('fittowork')}
                          className="px-3 py-1.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer active:scale-95"
                        >
                          Enter Result
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onViewApplicant(applicant.id)}
                          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          title="Medical results are managed by clinic administrators"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                          View Status
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {pendingMedical.length > 5 && (
            <div className="p-2.5 border-t border-slate-100 bg-slate-50/40 text-center">
              <button
                type="button"
                onClick={() => setShowAllMedical(!showAllMedical)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer"
              >
                {showAllMedical ? (
                  <>Show Less <ChevronUp className="w-3.5 h-3.5" /></>
                ) : (
                  <>Show All {pendingMedical.length} Medical Clearances <ChevronDown className="w-3.5 h-3.5" /></>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Queue 2: Initial Screenings & Tests */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 text-[#0EA5E9] flex items-center justify-center shrink-0">
                <ClipboardCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">Initial Screenings & Tests</h3>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700">
                    {pendingScreenings.length}
                  </span>
                </div>
                <p className="text-xs text-slate-500">Applicants awaiting test ratings or initial interviews</p>
              </div>
            </div>

            {canAccessScreening ? (
              <button
                type="button"
                onClick={() => onNavigate('screening')}
                className="text-xs font-semibold text-[#0EA5E9] hover:text-[#0284C7] flex items-center gap-1 cursor-pointer"
              >
                Screening Panel <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                <Lock className="w-3 h-3 text-slate-400" />
                Screening Restricted
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {pendingScreenings.length === 0 ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-800">All screenings up to date</p>
                <p className="text-xs text-slate-400 mt-0.5">New registrants will appear here for evaluation.</p>
              </div>
            ) : (
              displayedScreening.map((applicant) => {
                const wait = getDaysWaiting(applicant.lastUpdated || applicant.createdAt);
                return (
                  <div key={applicant.id} className="p-3.5 sm:p-4 hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-200 shrink-0">
                        {getInitials(applicant.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => onViewApplicant(applicant.id)}
                            className="font-bold text-slate-900 text-sm hover:text-[#0EA5E9] transition-colors truncate text-left"
                          >
                            {applicant.name || 'Unnamed Candidate'}
                          </button>
                          {applicant.jobOrder && (
                            <span className="font-mono text-[10px] text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.2 rounded shrink-0">
                              {applicant.jobOrder}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {applicant.applicantCode || applicant.id} • {applicant.role || 'Applicant'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-semibold px-2 py-0.2 rounded-full border ${
                            wait.isOverdue
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-sky-50 text-sky-700 border-sky-200'
                          }`}>
                            {wait.label}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Handler: {applicant.currentHandler || 'Recruitment Team'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onViewApplicant(applicant.id)}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        Profile
                      </button>
                      {canAccessScreening ? (
                        <button
                          type="button"
                          onClick={() => onNavigate('screening')}
                          className="px-3 py-1.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer active:scale-95"
                        >
                          Screen
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onViewApplicant(applicant.id)}
                          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                          View File
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {pendingScreenings.length > 5 && (
            <div className="p-2.5 border-t border-slate-100 bg-slate-50/40 text-center">
              <button
                type="button"
                onClick={() => setShowAllScreening(!showAllScreening)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer"
              >
                {showAllScreening ? (
                  <>Show Less <ChevronUp className="w-3.5 h-3.5" /></>
                ) : (
                  <>Show All {pendingScreenings.length} Screenings <ChevronDown className="w-3.5 h-3.5" /></>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4. Candidate Sourcing Roster (Full-Feature Table with Search, Tabs & Pagination) */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden">
        {/* Table Controls Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Candidate Sourcing Roster</h3>
            <p className="text-xs text-slate-500">Live recruitment pipeline tracking from intake to endorsement</p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search name, code, role, or JO..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Phase Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {[
                { key: 'all' as const, label: 'All', count: activeApplicants.length },
                { key: 'screening' as const, label: 'Screening', count: pendingScreenings.length },
                { key: 'medical' as const, label: 'Medical', count: pendingMedical.length },
                { key: 'cv' as const, label: 'CV Prep', count: readyForCV.length },
                { key: 'endorsement' as const, label: 'Endorsement', count: waitingEmployer.length },
              ].map((item) => {
                const isActive = phaseFilter === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleFilterChange(item.key)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Candidate Profile</th>
                <th className="py-3 px-4">Applied Trade & Job Order</th>
                <th className="py-3 px-4">Current Stage</th>
                <th className="py-3 px-4">Assigned Handler</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedCandidates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                    {searchTerm 
                      ? `No candidates matching "${searchTerm}". Try a different search term or clear filters.`
                      : 'No candidates currently found in this stage.'}
                  </td>
                </tr>
              ) : (
                paginatedCandidates.map((applicant) => {
                  const stageAction = getStageAction(applicant);
                  return (
                    <tr key={applicant.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Candidate Name & Code */}
                      <td className="py-3.5 px-4 font-medium">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-200 shrink-0">
                            {getInitials(applicant.name)}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => onViewApplicant(applicant.id)}
                              className="font-bold text-slate-900 hover:text-[#0EA5E9] transition-colors block text-left"
                            >
                              {applicant.name || 'Unnamed Candidate'}
                            </button>
                            <span className="font-mono text-[11px] text-slate-500">
                              {applicant.applicantCode || applicant.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Trade & Job Order */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-800 block">
                          {applicant.role || 'Unspecified Role'}
                        </span>
                        {applicant.jobOrder ? (
                          <span className="font-mono text-[10px] text-slate-500 bg-slate-50 border border-slate-200/80 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                            {applicant.jobOrder}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Open Sourcing</span>
                        )}
                      </td>

                      {/* Current Stage */}
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            applicant.phase === 1 ? 'bg-sky-500' :
                            applicant.phase === 2 ? 'bg-indigo-500' :
                            applicant.phase === 3 ? 'bg-emerald-500' :
                            applicant.phase === 4 ? 'bg-amber-500' : 'bg-purple-500'
                          }`} />
                          <span>Phase {applicant.phase}: {applicant.phaseDescription || applicant.status || 'In Progress'}</span>
                        </div>
                      </td>

                      {/* Handler */}
                      <td className="py-3.5 px-4">
                        <span className="text-slate-700 font-medium block">
                          {applicant.currentHandler || 'Unassigned'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {applicant.currentDepartment || 'Recruitment'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onViewApplicant(applicant.id)}
                            className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (stageAction.hasPermission) {
                                onNavigate(stageAction.targetView);
                              } else {
                                onViewApplicant(applicant.id);
                              }
                            }}
                            className={`px-3 py-1.5 font-semibold text-xs rounded-lg border transition-all cursor-pointer ${stageAction.color}`}
                            title={stageAction.hasPermission ? `Navigate to ${stageAction.label}` : 'Open candidate profile (module restricted)'}
                          >
                            {stageAction.label}
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

        {/* Pagination Footer */}
        {filteredCandidates.length > 0 && (
          <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
            <span>
              Showing <strong className="font-semibold text-slate-700">{(currentPage - 1) * pageSize + 1}</strong> to{' '}
              <strong className="font-semibold text-slate-700">
                {Math.min(currentPage * pageSize, filteredCandidates.length)}
              </strong>{' '}
              of <strong className="font-semibold text-slate-700">{filteredCandidates.length}</strong> candidates
            </span>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 font-semibold"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <span className="px-2 font-semibold text-slate-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 font-semibold"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Helpful Recruitment Workflow Shortcuts with Policy Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Shortcut 1: Registration Wizard */}
        <div
          onClick={() => handleSafeNavigate('registration', 'Registration')}
          className={`p-4 sm:p-5 bg-white border rounded-xl text-left transition-all ${
            canAccessRegistration
              ? 'border-slate-200/90 hover:border-[#0EA5E9] hover:shadow-xs cursor-pointer group'
              : 'border-slate-200/60 opacity-70 cursor-not-allowed bg-slate-50/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-transform ${
              canAccessRegistration ? 'bg-sky-50 text-[#0EA5E9] group-hover:scale-105' : 'bg-slate-100 text-slate-400'
            }`}>
              <UserPlus className="w-5 h-5" />
            </div>
            {!canAccessRegistration && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200/70 text-slate-600">
                <Lock className="w-3 h-3" /> Restricted
              </span>
            )}
          </div>
          <p className="font-bold text-slate-900 text-sm">Registration Wizard</p>
          <p className="text-xs text-slate-500 mt-1">Enroll walk-in applicants and upload pre-qualification files.</p>
        </div>

        {/* Shortcut 2: Screening & Exams */}
        <div
          onClick={() => handleSafeNavigate('screening', 'Screening Panel')}
          className={`p-4 sm:p-5 bg-white border rounded-xl text-left transition-all ${
            canAccessScreening
              ? 'border-slate-200/90 hover:border-[#0EA5E9] hover:shadow-xs cursor-pointer group'
              : 'border-slate-200/60 opacity-70 cursor-not-allowed bg-slate-50/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-transform ${
              canAccessScreening ? 'bg-indigo-50 text-indigo-600 group-hover:scale-105' : 'bg-slate-100 text-slate-400'
            }`}>
              <ClipboardCheck className="w-5 h-5" />
            </div>
            {!canAccessScreening && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200/70 text-slate-600">
                <Lock className="w-3 h-3" /> Restricted
              </span>
            )}
          </div>
          <p className="font-bold text-slate-900 text-sm">Screening & Exams</p>
          <p className="text-xs text-slate-500 mt-1">Record interview evaluations, trade exams, and test scores.</p>
        </div>

        {/* Shortcut 3: Fit-to-Work Panel */}
        <div
          onClick={() => handleSafeNavigate('fittowork', 'Fit-to-Work')}
          className={`p-4 sm:p-5 bg-white border rounded-xl text-left transition-all ${
            canAccessMedical
              ? 'border-slate-200/90 hover:border-[#0EA5E9] hover:shadow-xs cursor-pointer group'
              : 'border-slate-200/60 opacity-70 cursor-not-allowed bg-slate-50/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-transform ${
              canAccessMedical ? 'bg-emerald-50 text-emerald-600 group-hover:scale-105' : 'bg-slate-100 text-slate-400'
            }`}>
              <Stethoscope className="w-5 h-5" />
            </div>
            {!canAccessMedical && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200/70 text-slate-600">
                <Lock className="w-3 h-3" /> Restricted
              </span>
            )}
          </div>
          <p className="font-bold text-slate-900 text-sm">Fit-to-Work Panel</p>
          <p className="text-xs text-slate-500 mt-1">Track clinic appointments, laboratory results, and medical fit flags.</p>
        </div>

        {/* Shortcut 4: CV Encoding & Prep */}
        <div
          onClick={() => handleSafeNavigate('cv', 'CV Encoding')}
          className={`p-4 sm:p-5 bg-white border rounded-xl text-left transition-all ${
            canAccessCV
              ? 'border-slate-200/90 hover:border-[#0EA5E9] hover:shadow-xs cursor-pointer group'
              : 'border-slate-200/60 opacity-70 cursor-not-allowed bg-slate-50/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-transform ${
              canAccessCV ? 'bg-amber-50 text-amber-600 group-hover:scale-105' : 'bg-slate-100 text-slate-400'
            }`}>
              <FileCheck className="w-5 h-5" />
            </div>
            {!canAccessCV && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200/70 text-slate-600">
                <Lock className="w-3 h-3" /> Restricted
              </span>
            )}
          </div>
          <p className="font-bold text-slate-900 text-sm">CV Encoding & Prep</p>
          <p className="text-xs text-slate-500 mt-1">Standardize candidate resumes for employer endorsement review.</p>
        </div>
      </div>
    </div>
  );
}
