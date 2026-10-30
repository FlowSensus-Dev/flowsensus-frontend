import { useState, useMemo } from 'react';
import {
  Clock,
  FileCheck,
  TrendingUp,
  BarChart3,
  CheckCircle2,
  Users,
  Award,
  Calendar,
  ArrowRight,
  ShieldCheck,
  Send,
  Bell
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

interface ManagementDashboardProps {
  applicants: ApplicantRecord[];
  activityLogs: ActivityLog[];
  onViewApplicant: (applicantId: string) => void;
  onNavigate: (view: ViewType) => void;
  isLoading?: boolean;
}

const PHASE_LABELS: Record<number, string> = {
  1: 'Initial Screening & Tests',
  2: 'Medical Clearance',
  3: 'CV Encoding & Verification',
  4: 'Employer Endorsement',
  5: 'Visa & Departure Processing',
  6: 'Successfully Deployed',
};

export default function ManagementDashboard({
  applicants = [],
  onViewApplicant,
  onNavigate,
  isLoading = false,
}: ManagementDashboardProps) {
  const [remindedIds, setRemindedIds] = useState<Record<string, boolean>>({});

  // 1. Identify candidates needing follow-up (in same stage for > 5 days)
  const candidatesNeedingAttention = useMemo(() => {
    const now = Date.now();
    const thresholdMs = 5 * 24 * 60 * 60 * 1000; // 5 days

    return applicants.filter((a) => {
      if (a.isStopped || a.status === 'Deployed' || a.phase >= 5) return false;
      const lastUpdate = new Date(a.lastUpdated || 0).getTime();
      const isDelayed = !isNaN(lastUpdate) && (now - lastUpdate > thresholdMs);
      return isDelayed || a.phase <= 2;
    }).slice(0, 5);
  }, [applicants]);

  // 2. Candidate CVs & profiles awaiting manager sign-off (Phase 3 applicants)
  const pendingApprovals = useMemo(() => {
    return applicants.filter(
      (a) => !a.isStopped && a.phase === 3 && (a.status.toLowerCase().includes('cv') || a.status.toLowerCase().includes('pending') || a.status.toLowerCase().includes('review'))
    );
  }, [applicants]);

  // 3. Near-deployment candidates (Phase 5 - Visa, OEC, Flight Booking)
  const nearDeployment = useMemo(() => {
    return applicants.filter((a) => !a.isStopped && a.phase >= 5 && a.status !== 'Deployed');
  }, [applicants]);

  // 4. Agency performance metrics
  const totalActive = applicants.filter((a) => !a.isStopped && a.status !== 'Deployed').length;
  const deploymentReady = applicants.filter((a) => a.phase === 5 && !a.isStopped).length;
  const avgPhaseNumber = applicants.length > 0
    ? Math.round((applicants.reduce((sum, a) => sum + (a.phase || 1), 0) / applicants.length) * 10) / 10
    : 1.0;
  const avgPhaseName = PHASE_LABELS[Math.min(5, Math.max(1, Math.round(avgPhaseNumber)))] || 'In Progress';
  const conversionRate = totalActive > 0 ? Math.round((deploymentReady / totalActive) * 100) : 0;

  const handleSendReminder = (applicant: ApplicantRecord) => {
    setRemindedIds((prev) => ({ ...prev, [applicant.id]: true }));
  };

  return (
    <div className="space-y-6 w-full">
      {/* Clean Flowsensus-Aligned Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Management Overview</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Monitor candidate progress across all recruitment stages, approve prepared CVs, and track departure dates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('manager')}
            className="px-3.5 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <FileCheck className="w-4 h-4" />
            <span>CV & Employer Hub</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('reports')}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <BarChart3 className="w-4 h-4 text-slate-500" />
            <span>Operational Reports</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Active Candidates */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Active Candidates</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-[#0EA5E9] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-[#0F172A]">{totalActive}</p>
              <p className="text-xs text-slate-500 mt-0.5">Currently in recruitment pipeline</p>
            </div>
          )}
        </div>

        {/* Ready for Departure */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ready for Departure</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-emerald-600">{deploymentReady}</p>
              <p className="text-xs text-slate-500 mt-0.5">In Stage 5 visa & flight processing</p>
            </div>
          )}
        </div>

        {/* Average Stage */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Average Progress</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-bold text-[#0F172A]">Stage {Math.round(avgPhaseNumber)}</span>
                <span className="text-xs text-slate-400 font-medium">of 5</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{avgPhaseName}</p>
            </div>
          )}
        </div>

        {/* Placement Rate */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Placement Readiness</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-[#0F172A]">{conversionRate}%</p>
              <p className="text-xs text-slate-500 mt-0.5">Candidates reaching Stage 5</p>
            </div>
          )}
        </div>
      </div>

      {/* Action Items: Follow-ups & Pending Reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Candidates Needing Attention */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Candidates Needing Follow-up</h3>
                <p className="text-xs text-slate-500">More than 5 days without stage updates</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
              {candidatesNeedingAttention.length} Pending
            </span>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {candidatesNeedingAttention.length === 0 ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2 opacity-80" />
                <p className="text-sm font-semibold text-slate-700">All candidate files are moving along on schedule.</p>
                <p className="text-xs text-slate-400 mt-1">No candidates have been stuck in their current step.</p>
              </div>
            ) : (
              candidatesNeedingAttention.map((applicant) => {
                const isReminded = Boolean(remindedIds[applicant.id]);
                return (
                  <div key={applicant.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5 border border-slate-200">
                        {getInitials(applicant.name)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-800 text-sm">{applicant.name || 'Unnamed Candidate'}</p>
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            {applicant.applicantCode || applicant.id}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Currently in <strong>{PHASE_LABELS[applicant.phase] || `Stage ${applicant.phase}`}</strong>
                        </p>
                        <p className="text-[11px] text-amber-700 font-medium mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-500" />
                          <span>Assigned Handler: <strong>{applicant.currentHandler || 'Recruitment Team'}</strong></span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:self-center self-end flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => onViewApplicant(applicant.id)}
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        View Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendReminder(applicant)}
                        disabled={isReminded}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                          isReminded
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                            : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                        }`}
                      >
                        {isReminded ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Reminder Sent</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Notify Handler</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Approvals Awaiting Review */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-100 text-[#0EA5E9] flex items-center justify-center">
                <FileCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">CVs Waiting for Review</h3>
                <p className="text-xs text-slate-500">Verified candidate profiles ready to submit to employers</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 bg-sky-100 text-sky-800 text-xs font-semibold rounded-full">
              {pendingApprovals.length} Pending
            </span>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {pendingApprovals.length === 0 ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2 opacity-80" />
                <p className="text-sm font-semibold text-slate-700">All prepared files have been reviewed.</p>
                <p className="text-xs text-slate-400 mt-1">New candidate profiles submitted by your team will appear here.</p>
              </div>
            ) : (
              pendingApprovals.slice(0, 5).map((applicant) => (
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
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Updated: {applicant.lastUpdated ? new Date(applicant.lastUpdated).toLocaleDateString() : 'Recently'}
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
                      onClick={() => onNavigate('manager')}
                      className="px-3 py-1.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                    >
                      Review & Approve
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Estimated Departure Schedule */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Upcoming Candidate Departures</h3>
              <p className="text-xs text-slate-500">Projected flight dates for candidates in final processing</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('forecast')}
            className="text-xs font-bold text-[#0EA5E9] hover:text-[#0284C7] flex items-center gap-1 cursor-pointer self-start sm:self-center"
          >
            <span>Predictive Timeline</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Next 7 Days</span>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{nearDeployment.slice(0, 3).length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Candidates in final departure clearance</p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Next 8–14 Days</span>
              <p className="text-2xl font-bold text-[#0EA5E9] mt-1">{nearDeployment.slice(3, 7).length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Visas approved, awaiting ticket issue</p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Later This Month</span>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {Math.max(0, nearDeployment.length - 7)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Under embassy & consular review</p>
            </div>
          </div>

          {/* Near-Deployment Candidate List */}
          {nearDeployment.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Earliest Estimated Flights:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {nearDeployment.slice(0, 4).map((applicant, idx) => (
                  <div
                    key={applicant.id}
                    className="p-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                        {getInitials(applicant.name)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-xs">{applicant.name || 'Unnamed Candidate'}</p>
                        <p className="text-[11px] text-slate-500">{applicant.role || 'Worker'} • {applicant.applicantCode || applicant.id}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        ~{idx === 0 ? '3-5' : idx === 1 ? '5-7' : '7-10'} days
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">Est. Departure</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-500 text-xs">
              No candidates are currently scheduled for departure. Candidates reaching Stage 5 will appear here automatically.
            </div>
          )}
        </div>
      </div>

      {/* Helpful Operational Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('manager')}
          className="p-5 bg-white border border-slate-200 hover:border-[#0EA5E9] rounded-xl shadow-sm text-left transition-all cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-sky-50 text-[#0EA5E9] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <FileCheck className="w-5 h-5" />
          </div>
          <p className="font-bold text-slate-800 text-sm">CV & Employer Hub</p>
          <p className="text-xs text-slate-500 mt-1">Review candidate qualifications and track employer interview results.</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('reports')}
          className="p-5 bg-white border border-slate-200 hover:border-[#0EA5E9] rounded-xl shadow-sm text-left transition-all cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <BarChart3 className="w-5 h-5" />
          </div>
          <p className="font-bold text-slate-800 text-sm">Operational Reports</p>
          <p className="text-xs text-slate-500 mt-1">Check team velocity, stage turnaround times, and placement metrics.</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('history')}
          className="p-5 bg-white border border-slate-200 hover:border-[#0EA5E9] rounded-xl shadow-sm text-left transition-all cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <p className="font-bold text-slate-800 text-sm">Deployment & Audit Log</p>
          <p className="text-xs text-slate-500 mt-1">Review verified historical placements and chronological staff activity.</p>
        </button>
      </div>
    </div>
  );
}
