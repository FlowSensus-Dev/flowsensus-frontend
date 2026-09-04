import { useState } from 'react';
import {
  Plus, Search, User, Briefcase, Clock,
  ChevronRight, Flag, BadgeCheck, OctagonX
} from 'lucide-react';
import { ApplicantRecord } from '../../types';
import { ViewType } from '../AppShell';

interface ApplicantListProps {
  applicants?: ApplicantRecord[];
  onViewApplicant: (applicantId: string) => void;
  currentUserName: string;
  onNavigate?: (view: ViewType) => void;
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
}: ApplicantListProps) {
  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'stopped' | number>('all');

  const filtered = applicants.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      a.name.toLowerCase().includes(q) ||
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

  return (
    <div className="space-y-6 max-w-6xl">
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
            placeholder="Search by name, ID, role, or job order…"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(a => {
            const phaseMeta = a.isStopped ? PHASE_META[0] : (PHASE_META[a.phase] || PHASE_META[1]);
            const activeFlags = (a.employmentFlags || []).filter(f => !f.dismissed && !f.validated);
            const resolvedCount = (a.employmentFlags || []).filter(f => f.dismissed || f.validated).length;
            return (
              <button
                key={a.id}
                onClick={() => onViewApplicant(a.id)}
                className={`group text-left bg-white rounded-xl border transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 overflow-hidden ${
                  a.isStopped ? 'border-red-200 hover:border-red-300' : 'border-slate-200 hover:border-[#0EA5E9]/50'
                }`}
              >
                {/* Phase color stripe */}
                <div className="h-1 w-full" style={{ background: phaseMeta.color }} />

                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    {a.photoDataUrl
                      ? <img src={a.photoDataUrl} alt="photo" className="w-12 h-14 rounded-lg object-cover flex-shrink-0 border border-slate-100" />
                      : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-sm flex-shrink-0">
                          {a.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                      )
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-bold text-[#0F172A] text-sm leading-tight">{a.name}</p>
                        {a.isStopped && <OctagonX size={13} className="text-red-400 flex-shrink-0 mt-0.5" />}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{a.role}</p>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">{a.id}</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-[#0EA5E9] transition-colors flex-shrink-0 mt-1" />
                  </div>

                  {/* Status badge + flags */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: phaseMeta.bg, color: phaseMeta.color }}>
                      {a.isStopped ? 'Processing Stopped' : `Ph.${a.phase} · ${a.status}`}
                    </span>
                    {activeFlags.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-semibold flex items-center gap-1">
                        <Flag size={9} /> {activeFlags.length} open flag{activeFlags.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {resolvedCount > 0 && activeFlags.length === 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-semibold flex items-center gap-1">
                        <BadgeCheck size={9} /> Flags cleared
                      </span>
                    )}
                  </div>

                  {/* Job order */}
                  {a.jobOrder && (
                    <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1 truncate">
                      <Briefcase size={10} className="flex-shrink-0" /> {a.jobOrder}
                    </p>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                      <User size={9} /> {a.currentHandler}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 flex-shrink-0">
                      <Clock size={9} /> {a.lastUpdated?.slice(0, 10) || '—'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
