import { useState, useMemo } from 'react';
import {
  UserPlus,
  FileCheck,
  CheckCircle2,
  Search,
  Stethoscope,
  ClipboardCheck,
  Users
} from 'lucide-react';
import { Skeleton } from '../../ui/skeleton';
import { ApplicantRecord, ActivityLog } from '../../../types';
import { ViewType } from '../../AppShell';

function getInitials(name?: string, fallback = 'AP'): string {
  if (!name || typeof name !== 'string') return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  return parts.map((n) => n[0]).join('').substring(0, 2).toUpperCase();
}

interface RecruitmentDashboardProps {
  applicants: ApplicantRecord[];
  activityLogs: ActivityLog[];
  onViewApplicant: (applicantId: string) => void;
  onNavigate: (view: ViewType) => void;
  isLoading?: boolean;
}

export default function RecruitmentDashboard({
  applicants = [],
  onViewApplicant,
  onNavigate,
  isLoading = false,
}: RecruitmentDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'screening' | 'medical' | 'cv' | 'endorsement'>('all');

  // Candidate queues
  const pendingMedical = useMemo(() => {
    return applicants.filter((a) => !a.isStopped && a.phase === 2);
  }, [applicants]);

  const pendingScreenings = useMemo(() => {
    return applicants.filter((a) => !a.isStopped && a.phase === 1);
  }, [applicants]);

  const readyForCV = useMemo(() => {
    return applicants.filter((a) => !a.isStopped && a.phase === 3);
  }, [applicants]);

  const waitingEmployer = useMemo(() => {
    return applicants.filter((a) => !a.isStopped && a.phase === 4);
  }, [applicants]);

  // Filtered candidate list based on search and selected phase filter
  const filteredCandidates = useMemo(() => {
    return applicants.filter((a) => {
      if (a.isStopped) return false;
      const name = (a.name || `${a.firstName || ''} ${a.lastName || ''}`).toLowerCase();
      const code = (a.applicantCode || a.id || '').toLowerCase();
      const role = (a.role || '').toLowerCase();
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch = !q || name.includes(q) || code.includes(q) || role.includes(q);

      if (!matchesSearch) return false;
      if (phaseFilter === 'screening') return a.phase === 1;
      if (phaseFilter === 'medical') return a.phase === 2;
      if (phaseFilter === 'cv') return a.phase === 3;
      if (phaseFilter === 'endorsement') return a.phase === 4;
      return true;
    });
  }, [applicants, searchTerm, phaseFilter]);

  return (
    <div className="space-y-6 w-full">
      {/* Clean Flowsensus-Aligned Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Recruitment & Intake</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Register applicants, record screening test scores, and track clinic medical clearances.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('registration')}
            className="px-3.5 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register New Candidate</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('screening')}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <ClipboardCheck className="w-4 h-4 text-slate-500" />
            <span>Screening Panel</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total in Sourcing</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-[#0EA5E9] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-[#0F172A]">{applicants.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">All registered candidate profiles</p>
            </div>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Awaiting Medical</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Stethoscope className="w-4 h-4" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-indigo-600">{pendingMedical.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Referred for Fit-to-Work clearance</p>
            </div>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ready for CV Prep</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-emerald-600">{readyForCV.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Cleared medical, awaiting CV encoding</p>
            </div>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Endorsed to Employers</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-[#0F172A]">{waitingEmployer.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Under employer review & interviews</p>
            </div>
          )}
        </div>
      </div>

      {/* Action Sections: Medical Follow-Ups & Pending Screenings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Medical Follow-Ups */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <Stethoscope className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Medical Results Follow-up</h3>
                <p className="text-xs text-slate-500">Candidates awaiting clinic Fit-to-Work confirmation</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('fittowork')}
              className="text-xs font-bold text-[#0EA5E9] hover:text-[#0284C7] cursor-pointer"
            >
              Fit-to-Work Panel →
            </button>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {pendingMedical.length === 0 ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2 opacity-80" />
                <p className="text-sm font-semibold text-slate-700">All medical results are updated.</p>
                <p className="text-xs text-slate-400 mt-1">No candidates are currently waiting for clinic clearance.</p>
              </div>
            ) : (
              pendingMedical.slice(0, 5).map((applicant) => (
                <div key={applicant.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {getInitials(applicant.name)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{applicant.name || 'Unnamed Candidate'}</p>
                      <p className="text-xs text-slate-500">
                        {applicant.applicantCode || applicant.id} • {applicant.role || 'Applicant'}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Clinic Referral: {applicant.lastUpdated || 'Pending clinic confirmation'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onViewApplicant(applicant.id)}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      View Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('fittowork')}
                      className="px-3 py-1.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                    >
                      Enter Result
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Initial Screenings & Exams */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-100 text-[#0EA5E9] flex items-center justify-center">
                <ClipboardCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Initial Screenings & Tests</h3>
                <p className="text-xs text-slate-500">New applicants needing test scores or interview ratings</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('screening')}
              className="text-xs font-bold text-[#0EA5E9] hover:text-[#0284C7] cursor-pointer"
            >
              Screening Panel →
            </button>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {pendingScreenings.length === 0 ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2 opacity-80" />
                <p className="text-sm font-semibold text-slate-700">All screenings are up to date.</p>
                <p className="text-xs text-slate-400 mt-1">Newly registered candidates will appear here for evaluation.</p>
              </div>
            ) : (
              pendingScreenings.slice(0, 5).map((applicant) => (
                <div key={applicant.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {getInitials(applicant.name)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{applicant.name || 'Unnamed Candidate'}</p>
                      <p className="text-xs text-slate-500">
                        {applicant.applicantCode || applicant.id} • {applicant.role || 'Applicant'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Status: {applicant.phaseDescription || 'Awaiting initial interview & test evaluation'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onViewApplicant(applicant.id)}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      View Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('screening')}
                      className="px-3 py-1.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                    >
                      Screen Candidate
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Candidate Pipeline Search & Quick Roster */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Candidate Sourcing Roster</h3>
            <p className="text-xs text-slate-500">Search and find candidates currently in recruitment stages</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search candidate name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] focus:border-[#0EA5E9] w-48 sm:w-60"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'all' as const, label: `All (${applicants.length})` },
                { key: 'screening' as const, label: `Screening (${pendingScreenings.length})` },
                { key: 'medical' as const, label: `Medical (${pendingMedical.length})` },
                { key: 'cv' as const, label: `CV Prep (${readyForCV.length})` },
              ].map((item) => {
                const isActive = phaseFilter === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setPhaseFilter(item.key)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                      isActive
                        ? 'bg-[#0F172A] text-white border-[#0F172A]'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {filteredCandidates.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No candidates found matching your filter criteria.
            </div>
          ) : (
            filteredCandidates.slice(0, 10).map((applicant) => (
              <div key={applicant.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {getInitials(applicant.name)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{applicant.name || 'Unnamed Candidate'}</p>
                    <p className="text-xs text-slate-500">
                      {applicant.role || 'Candidate'} • {applicant.applicantCode || applicant.id}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      Stage {applicant.phase}: {applicant.phaseDescription || 'In Progress'}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">Handler: {applicant.currentHandler || 'Recruitment Team'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onViewApplicant(applicant.id)}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    View Profile
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Helpful Recruitment Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('registration')}
          className="p-5 bg-white border border-slate-200 hover:border-[#0EA5E9] rounded-xl shadow-sm text-left transition-all cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-sky-50 text-[#0EA5E9] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <UserPlus className="w-5 h-5" />
          </div>
          <p className="font-bold text-slate-800 text-sm">Registration Wizard</p>
          <p className="text-xs text-slate-500 mt-1">Enroll walk-in applicants and upload initial documents.</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('screening')}
          className="p-5 bg-white border border-slate-200 hover:border-[#0EA5E9] rounded-xl shadow-sm text-left transition-all cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <p className="font-bold text-slate-800 text-sm">Screening Panel</p>
          <p className="text-xs text-slate-500 mt-1">Review interview ratings, background checks, and test results.</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('digital-exams')}
          className="p-5 bg-white border border-slate-200 hover:border-[#0EA5E9] rounded-xl shadow-sm text-left transition-all cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <p className="font-bold text-slate-800 text-sm">Digital Exam Hub</p>
          <p className="text-xs text-slate-500 mt-1">Manage skill tests, English evaluations, and exam answer keys.</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('cv')}
          className="p-5 bg-white border border-slate-200 hover:border-[#0EA5E9] rounded-xl shadow-sm text-left transition-all cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <FileCheck className="w-5 h-5" />
          </div>
          <p className="font-bold text-slate-800 text-sm">CV Preparation</p>
          <p className="text-xs text-slate-500 mt-1">Encode agency standard resumes for employer presentation.</p>
        </button>
      </div>
    </div>
  );
}
