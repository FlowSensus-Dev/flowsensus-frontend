import { useState } from 'react';
import {
  Plus, Search, User, Briefcase, Clock,
  ChevronRight, ChevronLeft, ArrowLeft, Flag, BadgeCheck, OctagonX,
  ArrowUpDown
} from 'lucide-react';
import { Skeleton, SkeletonAvatar, SkeletonBadge } from '../ui/skeleton';
import { ApplicantRecord, ActivityLog, ExpenseRecord } from '../../types';
import { ViewType } from '../AppShell';
import ApplicantProfile from './ApplicantProfile';

export type SortOption =
  | 'phase-asc'
  | 'phase-desc'
  | 'name-asc'
  | 'name-desc'
  | 'date-newest'
  | 'date-oldest';

interface ApplicantListProps {
  applicants?: ApplicantRecord[];
  isLoading?: boolean;
  onViewApplicant: (applicantId: string) => void;
  currentUserName: string;
  onNavigate?: (view: ViewType) => void;
  selectedApplicantId?: string | null;
  onClearSelection?: () => void;
  activityLogs?: ActivityLog[];
  expenses?: ExpenseRecord[];
  updateApplicant?: (applicantId: string, updates: Partial<ApplicantRecord>) => void;
  addActivityLog?: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  showToast?: (msg: string) => void;
  onEditApplicant?: () => void;
}

const PHASE_META: Record<number, { title: string; desc: string; color: string; bg: string; border: string }> = {
  0: { title: 'Process Stopped', desc: 'Application permanently halted by agency staff due to candidate withdrawal, failed requirements, or critical background flags.', color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  1: { title: 'Registration & Screening', desc: 'Collects personal details and required documents, General tests and job-order specific tests, and conducts the EQ interview. Applicants who pass advance to medical clearance; failing any test sets their status to Provisional.', color: '#0ea5e9', bg: '#f0f9ff', border: '#bae6fd' },
  2: { title: 'Medical Clearance', desc: 'Issues clinic referrals for pre-employment medical exams and validates Fit-to-Work results. Fit candidates proceed to profile encoding; unfit candidates are held under Provisional status.', color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' },
  3: { title: 'CV Encoding & Management Approval', desc: 'Encodes candidate qualifications into standard agency CV format, calculates job readiness, and secures management sign-off before employer submission.', color: '#ec4899', bg: '#fdf2f8', border: '#fbcfe8' },
  4: { title: 'Employer Endorsement', desc: 'Submits approved CVs to overseas employers, coordinates client interviews, and logs selection decisions and hiring confirmations.', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  5: { title: 'Final Deployment Processing', desc: 'Processes work visas, runs biometric document OCR checks, logs processing expenses, and books departure flights once all exit clearances are verified.', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
  6: { title: 'Deployed', desc: 'Monitors workers actively employed overseas through contract duration, successful completion, or contract termination.', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
};

export default function ApplicantList({
  applicants = [],
  isLoading = false,
  onViewApplicant,
  currentUserName,
  onNavigate,
  selectedApplicantId,
  onClearSelection,
  activityLogs = [],
  expenses = [],
  updateApplicant,
  addActivityLog,
  showToast,
  onEditApplicant,
}: ApplicantListProps) {
  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'stopped' | number>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('phase-asc');

  const uniqueStatuses = Array.from(new Set(applicants.map(a => a.status).filter(Boolean))).sort();
  const uniqueRoles = Array.from(new Set(applicants.map(a => a.role).filter(Boolean))).sort();

  const filtered = applicants.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      a.name.toLowerCase().includes(q) ||
      (a.applicantCode || '').toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q) ||
      (a.jobOrder || '').toLowerCase().includes(q);
    const matchPhase =
      phaseFilter === 'all' ? true :
        phaseFilter === 'stopped' ? a.status === 'Processing Stopped' :
          a.phase === phaseFilter && a.status !== 'Processing Stopped';
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    const matchRole = roleFilter === 'all' || (a.role || '').trim().toLowerCase() === roleFilter.trim().toLowerCase();
    return matchSearch && matchPhase && matchStatus && matchRole;
  });

  const getApplicantTimestamp = (a: ApplicantRecord): number => {
    if (a.createdAt) {
      const t = new Date(a.createdAt).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    if (a.lastUpdated) {
      const t = new Date(a.lastUpdated).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    const numId = parseInt(a.id, 10);
    if (!isNaN(numId) && numId > 0) return numId;
    const match = (a.applicantCode || '').match(/\d+/g);
    if (match) {
      const codeNum = parseInt(match.join(''), 10);
      if (!isNaN(codeNum) && codeNum > 0) return codeNum;
    }
    return 0;
  };

  const sorted = [...filtered].sort((a, b) => {
    // Stopped applicants are ALWAYS kept at the very end of the list across ALL sort modes
    const isStoppedA = a.status === 'Processing Stopped' || a.isStopped === true;
    const isStoppedB = b.status === 'Processing Stopped' || b.isStopped === true;

    if (isStoppedA && !isStoppedB) return 1;
    if (!isStoppedA && isStoppedB) return -1;

    switch (sortBy) {
      case 'phase-asc': {
        const phaseA = a.phase ?? 1;
        const phaseB = b.phase ?? 1;
        if (phaseA !== phaseB) return phaseA - phaseB;
        return a.name.localeCompare(b.name);
      }
      case 'phase-desc': {
        const phaseA = a.phase ?? 1;
        const phaseB = b.phase ?? 1;
        if (phaseA !== phaseB) return phaseB - phaseA;
        return a.name.localeCompare(b.name);
      }
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'date-newest': {
        const diff = getApplicantTimestamp(b) - getApplicantTimestamp(a);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      }
      case 'date-oldest': {
        const diff = getApplicantTimestamp(a) - getApplicantTimestamp(b);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      }
      default:
        return 0;
    }
  });

  const phaseCounts = [1, 2, 3, 4, 5, 6].map(p => ({
    phase: p,
    count: applicants.filter(a => a.phase === p && a.status !== 'Processing Stopped').length,
  }));
  const stoppedCount = applicants.filter(a => a.status === 'Processing Stopped').length;

  if (selectedApplicantId) {
    const currentIndex = sorted.findIndex((a) => String(a.id) === String(selectedApplicantId));
    const fallbackIndex = applicants.findIndex((a) => String(a.id) === String(selectedApplicantId));
    const currentList = currentIndex >= 0 ? sorted : applicants;
    const currentPos = currentIndex >= 0 ? currentIndex : fallbackIndex;
    const selectedApplicant = currentList[currentPos] || applicants.find((a) => String(a.id) === String(selectedApplicantId));

    if (!selectedApplicant) {
      return (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto my-12 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <User size={24} />
          </div>
          <h3 className="font-bold text-[#0F172A] text-base">Applicant Not Found</h3>
          <p className="text-slate-500 text-sm mt-1">This applicant record could not be found or was removed.</p>
          <button
            onClick={onClearSelection}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer"
          >
            <ArrowLeft size={14} /> Return to Applicant Pool
          </button>
        </div>
      );
    }

    const hasPrev = currentPos > 0;
    const hasNext = currentPos < currentList.length - 1;
    const applicantIndexText = `${currentPos + 1} of ${currentList.length}`;

    const handleNavigateApplicant = (direction: 'prev' | 'next') => {
      const nextIdx = direction === 'prev' ? currentPos - 1 : currentPos + 1;
      const target = currentList[nextIdx];
      if (target) {
        onViewApplicant(String(target.id));
      }
    };

    return (
      <div className="space-y-4">
        {/* Sleek Breadcrumb & Navigation Bar */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 px-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onClearSelection}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100/80 hover:bg-slate-200/80 hover:text-[#0EA5E9] border border-slate-200 transition-all group cursor-pointer shadow-2xs"
            >
              <ArrowLeft size={14} className="text-slate-500 group-hover:text-[#0EA5E9] group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Applicants</span>
            </button>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
              <span className="font-semibold text-slate-800 max-w-[200px] truncate">{selectedApplicant.name}</span>
              <span className="font-mono text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 font-medium">
                {selectedApplicant.applicantCode || selectedApplicant.id}
              </span>
              <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                Phase {selectedApplicant.phase}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${selectedApplicant.status === 'Provisional'
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : selectedApplicant.status === 'Processing Stopped'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}>
                {selectedApplicant.status}
              </span>
            </div>
          </div>

          {/* Quick Applicant Switcher */}
          {currentList.length > 1 && (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[11px] font-semibold text-slate-400 pr-1 hidden xs:inline">
                Applicant <strong className="text-slate-700">{currentPos + 1}</strong> of {currentList.length}
              </span>
              <div className="flex items-center bg-slate-100/90 border border-slate-200 rounded-xl p-0.5 shadow-2xs">
                <button
                  onClick={() => handleNavigateApplicant('prev')}
                  disabled={!hasPrev}
                  title="Previous applicant"
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-[#0F172A] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => handleNavigateApplicant('next')}
                  disabled={!hasNext}
                  title="Next applicant"
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-[#0F172A] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Applicant Profile */}
        <ApplicantProfile
          applicant={selectedApplicant}
          activityLogs={activityLogs.filter(log => String(log.applicantId) === String(selectedApplicant.id))}
          expenses={expenses.filter(exp => String(exp.applicantId) === String(selectedApplicant.id))}
          updateApplicant={updateApplicant!}
          currentUserName={currentUserName}
          addActivityLog={addActivityLog!}
          showToast={showToast!}
          onBack={onClearSelection}
          onNavigateApplicant={handleNavigateApplicant}
          hasPrev={hasPrev}
          hasNext={hasNext}
          applicantIndexText={applicantIndexText}
          onEdit={onEditApplicant}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header & Search */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full max-w-4xl">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] focus:border-[#0EA5E9] bg-white text-slate-800"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded text-sm px-3 py-2 text-slate-600 bg-white focus:outline-none min-w-[120px] max-w-[150px] truncate"
          >
            <option value="all">All Statuses</option>
            {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="border border-slate-300 rounded text-sm px-3 py-2 text-slate-600 bg-white focus:outline-none min-w-[120px] max-w-[150px] truncate"
          >
            <option value="all">All Roles</option>
            {uniqueRoles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          {/* Sort / View Order placed beside All Roles */}
          <div className="relative flex items-center">
            <ArrowUpDown size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortOption)}
              aria-label="Sort and view order"
              title="Sort and view order"
              className="border border-slate-300 rounded text-sm pl-8 pr-3 py-2 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] focus:border-[#0EA5E9] min-w-[150px] max-w-[190px] truncate cursor-pointer font-medium"
            >
              <optgroup label="Per Phase">
                <option value="phase-asc">Phase (1 → 6)</option>
                <option value="phase-desc">Phase (6 → 1)</option>
              </optgroup>
              <optgroup label="Alphabetical Order">
                <option value="name-asc">Name (A → Z)</option>
                <option value="name-desc">Name (Z → A)</option>
              </optgroup>
              <optgroup label="Date of Application">
                <option value="date-newest">Date Applied (Newest)</option>
                <option value="date-oldest">Date Applied (Oldest)</option>
              </optgroup>
            </select>
          </div>
        </div>
        <button
          onClick={() => onNavigate?.('registration')}
          className="flex items-center gap-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-5 py-2 rounded text-sm font-semibold transition-colors shadow-sm flex-shrink-0"
        >
          <Plus size={16} /> Add New Applicant
        </button>
      </div>

      <div className="text-[13px] font-bold text-slate-700 mt-4 border-b border-slate-200 pb-3">
        Total Applicants:{' '}
        {isLoading ? (
          <Skeleton className="inline-block h-3.5 w-6 align-middle" />
        ) : (
          <span className="text-[#0EA5E9] font-medium">{applicants.length}</span>
        )}{' '}
        <span className="mx-1 text-slate-300">|</span> Active Process:{' '}
        {isLoading ? (
          <Skeleton className="inline-block h-3.5 w-6 align-middle" />
        ) : (
          <span className="text-orange-500 font-medium">
            {applicants.filter(a => a.status !== 'Processing Stopped').length}
          </span>
        )}{' '}
        <span className="mx-1 text-slate-300">|</span> Completed Placements:{' '}
        {isLoading ? (
          <Skeleton className="inline-block h-3.5 w-6 align-middle" />
        ) : (
          <span className="text-emerald-500 font-medium">
            {applicants.filter(a => a.phase === 6).length}
          </span>
        )}
      </div>

      {/* Navigation */}
      <div className="flex flex-col gap-3 mt-4 mb-2">
        <div className="flex items-stretch w-full overflow-x-auto scrollbar-none bg-transparent">
          <button
            onClick={() => setPhaseFilter('all')}
            style={{ zIndex: 30, backgroundColor: phaseFilter === 'all' ? '#0F172A' : '#e2e8f0' }}
            className={`h-11 px-4 text-[12px] font-bold transition-all flex items-center justify-center rounded-l-md whitespace-nowrap flex-shrink-0 ${phaseFilter === 'all' ? 'text-white' : 'text-slate-700 hover:bg-[#cbd5e1]'
              } [clip-path:polygon(0_0,calc(100%-14px)_0,100%_50%,calc(100%-14px)_100%,0_100%,0_50%)]`}
          >
            All{' '}
            {isLoading ? (
              <span className="font-normal opacity-80 ml-1">(-)</span>
            ) : (
              <span className="font-normal opacity-80 ml-1">({applicants.length})</span>
            )}
          </button>

          {phaseCounts.map((p, idx) => {
            const meta = PHASE_META[p.phase] || PHASE_META[1];
            const isSelected = phaseFilter === p.phase;
            const zIndex = 29 - idx;

            return (
              <button
                key={p.phase}
                onClick={() => setPhaseFilter(p.phase)}
                style={{ zIndex, backgroundColor: isSelected ? meta.color : '#e2e8f0' }}
                className={`h-11 pl-7 pr-4 -ml-3 flex-1 min-w-fit text-[12px] font-bold transition-all flex items-center justify-center whitespace-nowrap ${isSelected ? 'text-white' : 'text-slate-700 hover:bg-[#cbd5e1]'
                  } [clip-path:polygon(0_0,calc(100%-14px)_0,100%_50%,calc(100%-14px)_100%,0_100%,14px_50%)]`}
              >
                Ph.{p.phase} {meta.title}{' '}
                {isLoading ? (
                  <span className="ml-1 opacity-80 font-normal">(-)</span>
                ) : (
                  <span className="ml-1 opacity-80 font-normal">({p.count})</span>
                )}
              </button>
            );
          })}

          {stoppedCount > 0 && (
            <button
              onClick={() => setPhaseFilter('stopped')}
              style={{ zIndex: 10, backgroundColor: phaseFilter === 'stopped' ? '#ef4444' : '#e2e8f0' }}
              className={`h-11 pl-7 pr-4 -ml-3 text-[12px] font-bold transition-all flex items-center justify-center rounded-r-md whitespace-nowrap flex-shrink-0 ${phaseFilter === 'stopped' ? 'text-white' : 'text-slate-700 hover:bg-[#cbd5e1]'
                } [clip-path:polygon(0_0,100%_0,100%_100%,0_100%,14px_50%)]`}
            >
              Process Stopped <span className="ml-1 opacity-80 font-normal">({stoppedCount})</span>
            </button>
          )}
        </div>

        {/* Description underneath navigation */}
        <div className="text-[13px] text-slate-600 font-medium px-1 italic">
          {phaseFilter === 'all' && "View and filter all active, placed, and stopped applicants across every stage of the agency pipeline."}
          {phaseFilter !== 'all' && phaseFilter !== 'stopped' && (PHASE_META[phaseFilter as number]?.desc)}
          {phaseFilter === 'stopped' && PHASE_META[0].desc}
        </div>
      </div>

      {/* Cards grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-start gap-4">
                <SkeletonAvatar className="w-14 h-14" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24 bg-slate-100" />
                  <Skeleton className="h-3 w-16 bg-slate-100" />
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <SkeletonBadge className="w-24" />
                <SkeletonBadge className="w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-20 text-center">
          <User size={32} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 font-medium text-sm">No applicants found</p>
          <button
            onClick={() => onNavigate?.('registration')}
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-[#0EA5E9] hover:underline font-medium"
          >
            <Plus size={14} /> Register first applicant
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sorted.map(a => {
            const phaseMeta = (a.status === 'Processing Stopped') ? PHASE_META[0] : (PHASE_META[a.phase] || PHASE_META[1]);
            const activeFlags = (a.employmentFlags || []).filter(f => !f.dismissed && !f.validated);
            const resolvedCount = (a.employmentFlags || []).filter(f => f.dismissed || f.validated).length;
            return (
              <button
                key={a.id}
                onClick={() => onViewApplicant(a.id)}
                className={`group flex flex-col text-left bg-white rounded-2xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden ${(a.status === 'Processing Stopped') ? 'border-red-200 hover:border-red-300 ring-1 ring-red-50' : 'border-slate-200 hover:border-[#0EA5E9]/40 hover:ring-2 hover:ring-[#0EA5E9]/10'
                  }`}
              >
                <div className="p-5 flex-1 w-full relative">
                  {/* Subtle Top-Right Indicator */}
                  <div className="absolute top-0 right-0 w-24 h-24 opacity-15 rounded-bl-full pointer-events-none transition-transform duration-300 group-hover:scale-110" style={{ background: `radial-gradient(circle at top right, ${phaseMeta.color} 0%, transparent 70%)` }} />

                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0 mt-1">
                      {(a.photoDataUrl || a.photo)
                        ? <img src={a.photoDataUrl || a.photo} alt="photo" className="w-14 h-14 rounded-full object-cover ring-4 ring-slate-50 shadow-sm border border-slate-200" />
                        : (
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center font-bold text-slate-500 text-lg ring-4 ring-slate-50 shadow-sm border border-slate-200">
                            {a.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                        )
                      }
                      {(a.status === 'Processing Stopped') && (
                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                          <OctagonX size={16} className="text-red-500" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 z-10">
                      <p className="font-extrabold text-[#0F172A] text-[15px] truncate pr-6 group-hover:text-[#0EA5E9] transition-colors">{a.name}</p>
                      <p className="text-xs font-bold text-[#0EA5E9] mt-0.5 truncate">{a.role}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{a.applicantCode || a.id}</span>
                      </div>
                    </div>

                    <div className="absolute right-4 top-6 opacity-0 group-hover:opacity-100 -translate-x-3 group-hover:translate-x-0 transition-all duration-300">
                      <ChevronRight size={20} className="text-[#0EA5E9]" />
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2 mt-4 z-10 relative">
                    <span className="text-[10px] px-2.5 py-1 rounded-md font-extrabold border shadow-sm" style={{ background: phaseMeta.bg, color: phaseMeta.color, borderColor: phaseMeta.border }}>
                      {(a.status === 'Processing Stopped') ? 'Process Stopped' : `Ph.${a.phase} - ${phaseMeta.title}`}
                    </span>

                    {/* Applicant Status Badge Beside Phase */}
                    {a.status && (
                      <span className={`text-[10px] px-2.5 py-1 rounded-md font-extrabold border shadow-sm flex items-center gap-1.5 ${a.status === 'Processing Stopped'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : a.status === 'Provisional'
                            ? 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-200/80'
                            : a.status.toLowerCase().includes('deployed') || a.status.toLowerCase().includes('completed') || a.status.toLowerCase().includes('cleared')
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : a.status.toLowerCase().includes('medical')
                                ? 'bg-pink-50 text-pink-700 border-pink-200'
                                : a.status.toLowerCase().includes('interview') || a.status.toLowerCase().includes('screening')
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-sky-50 text-sky-700 border-sky-200'
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.status === 'Processing Stopped'
                            ? 'bg-red-500'
                            : a.status === 'Provisional'
                              ? 'bg-amber-500 animate-pulse'
                              : a.status.toLowerCase().includes('deployed') || a.status.toLowerCase().includes('completed') || a.status.toLowerCase().includes('cleared')
                                ? 'bg-emerald-500'
                                : a.status.toLowerCase().includes('medical')
                                  ? 'bg-pink-500'
                                  : a.status.toLowerCase().includes('interview') || a.status.toLowerCase().includes('screening')
                                    ? 'bg-purple-500'
                                    : 'bg-[#0EA5E9]'
                          }`} />
                        <span className="opacity-70 font-semibold">Status:</span>
                        <span className="truncate">{a.status}</span>
                      </span>
                    )}

                    {activeFlags.length > 0 && (
                      <span className="text-[10px] px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700 font-extrabold flex items-center gap-1 shadow-sm">
                        <Flag size={10} /> {activeFlags.length} Flag{activeFlags.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {resolvedCount > 0 && activeFlags.length === 0 && (
                      <span className="text-[10px] px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold flex items-center gap-1 shadow-sm">
                        <BadgeCheck size={10} /> Cleared
                      </span>
                    )}
                  </div>

                  {/* Job order */}
                  {a.jobOrder && (
                    <div className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-sm">
                      <Briefcase size={10} className="text-[#0EA5E9]" /> {a.jobOrder}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="w-full bg-slate-50 px-5 py-3 border-t border-slate-100 flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center">
                      <User size={10} className="text-slate-600" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 truncate max-w-[100px]">{a.currentHandler}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 flex-shrink-0">
                    <Clock size={10} /> {a.lastUpdated?.slice(0, 10) || '—'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
