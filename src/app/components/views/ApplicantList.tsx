import { useState } from 'react';
import {
  Plus, Search, User, Briefcase, Clock,
  ChevronRight, ChevronLeft, ArrowLeft, Flag, BadgeCheck, OctagonX
} from 'lucide-react';
import { ApplicantRecord, ActivityLog, ExpenseRecord } from '../../types';
import { ViewType } from '../AppShell';
import ApplicantProfile from './ApplicantProfile';

interface ApplicantListProps {
  applicants?: ApplicantRecord[];
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

const PHASE_META: Record<number, { color: string; bg: string }> = {
  0: { color: '#EF4444', bg: '#FEF2F2' },
  1: { color: '#64748B', bg: '#F1F5F9' },
  2: { color: '#F59E0B', bg: '#FFFBEB' },
  3: { color: '#0EA5E9', bg: '#EFF6FF' },
  4: { color: '#8B5CF6', bg: '#F5F3FF' },
  5: { color: '#10B981', bg: '#ECFDF5' },
  6: { color: '#10B981', bg: '#ECFDF5' },
};

export default function ApplicantList({
  applicants = [],
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
      phaseFilter === 'stopped' ? !!a.isStopped :
      a.phase === phaseFilter && !a.isStopped;
    return matchSearch && matchPhase;
  });

  const phaseCounts = [1,2,3,4,5,6].map(p => ({
    phase: p,
    count: applicants.filter(a => a.phase === p && !a.isStopped).length,
  }));
  const stoppedCount = applicants.filter(a => a.isStopped).length;

  if (selectedApplicantId) {
    const currentIndex = filtered.findIndex((a) => String(a.id) === String(selectedApplicantId));
    const fallbackIndex = applicants.findIndex((a) => String(a.id) === String(selectedApplicantId));
    const currentList = currentIndex >= 0 ? filtered : applicants;
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
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#0F172A]">All Applicants</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {applicants.length} total · {applicants.filter(a => !a.isStopped).length} active · {stoppedCount} stopped
          </p>
        </div>
        <button
          onClick={() => onNavigate?.('registration')}
          className="flex items-center gap-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-md shadow-[#0EA5E9]/20"
        >
          <Plus size={16} /> Add New Applicant
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, code, role, or job order…"
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] bg-white"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setPhaseFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${phaseFilter === 'all' ? 'bg-[#0F172A] text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'}`}
          >
            All ({applicants.length})
          </button>
          {phaseCounts.filter(p => p.count > 0).map(p => {
            const meta = PHASE_META[p.phase] || PHASE_META[1];
            return (
              <button
                key={p.phase}
                onClick={() => setPhaseFilter(p.phase)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${phaseFilter === p.phase ? 'text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'}`}
                style={phaseFilter === p.phase ? { background: meta.color } : {}}
              >
                Ph.{p.phase} ({p.count})
              </button>
            );
          })}
          {stoppedCount > 0 && (
            <button
              onClick={() => setPhaseFilter('stopped')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${phaseFilter === 'stopped' ? 'bg-red-500 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-red-200 hover:text-red-500'}`}
            >
              Stopped ({stoppedCount})
            </button>
          )}
        </div>
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
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
          {filtered.map(a => {
            const phaseMeta = a.isStopped ? PHASE_META[0] : (PHASE_META[a.phase] || PHASE_META[1]);
            const activeFlags = (a.employmentFlags || []).filter(f => !f.dismissed && !f.validated);
            const resolvedCount = (a.employmentFlags || []).filter(f => f.dismissed || f.validated).length;
            return (
              <button
                key={a.id}
                onClick={() => onViewApplicant(a.id)}
                className={`group flex flex-col text-left bg-white rounded-2xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden ${
                  a.isStopped ? 'border-red-200 hover:border-red-300 ring-1 ring-red-50' : 'border-slate-200 hover:border-[#0EA5E9]/40 hover:ring-2 hover:ring-[#0EA5E9]/10'
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
                      {a.isStopped && (
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
                  <div className="flex flex-wrap gap-2 mt-5 z-10 relative">
                    <span className="text-[10px] px-2.5 py-1 rounded-md font-extrabold border shadow-sm" style={{ background: phaseMeta.bg, color: phaseMeta.color, borderColor: `${phaseMeta.color}40` }}>
                      {a.isStopped ? 'Processing Stopped' : `Ph.${a.phase} · ${a.status}`}
                    </span>
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
