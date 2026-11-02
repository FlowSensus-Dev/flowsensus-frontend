import { useState, useMemo } from 'react';
import {
  Plane,
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
  Bell,
  AlertTriangle,
  Loader2,
  Filter
} from 'lucide-react';
import { Skeleton } from '../../ui/skeleton';
import { ApplicantRecord, ActivityLog } from '../../../types';
import { ViewType } from '../../AppShell';
import {
  sendHandlerReminderNotification,
  isUnassignedHandlerName,
  getResponsibleTeamForPhase,
} from '../../../../lib/notificationService';

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
  currentUserName?: string;
  showToast?: (message: string) => void;
  addActivityLog?: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  hideHeader?: boolean;
}

const PHASE_LABELS: Record<number, string> = {
  1: 'Initial Screening & Tests',
  2: 'Medical Clearance',
  3: 'CV Encoding & Verification',
  4: 'Employer Endorsement',
  5: 'Visa & Departure Processing',
  6: 'Successfully Deployed',
};

function parseDateToMs(dateStr?: string | null): number {
  if (!dateStr) return NaN;
  const direct = new Date(dateStr).getTime();
  if (!isNaN(direct)) return direct;
  const cleanStr = String(dateStr).split(',')[0].trim();
  const parts = cleanStr.split('/');
  if (parts.length === 3) {
    const [m, d, y] = parts;
    const parsed = new Date(Number(y), Number(m) - 1, Number(d)).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  return NaN;
}

export interface CandidateActivityItem {
  applicant: ApplicantRecord;
  isUnassigned: boolean;
  days: number;
  hours: number;
  timeInStatusLabel: string;
  thresholdDays: number;
  isOverdue: boolean;
  severity: 'critical' | 'warning' | 'caution' | 'normal';
  responsibleTeam: { department: string; label: string };
  reason: string;
}

export type DelayedCandidateItem = CandidateActivityItem;

export default function ManagementDashboard({
  applicants = [],
  onViewApplicant,
  onNavigate,
  isLoading = false,
  currentUserName = 'Management',
  showToast,
  addActivityLog,
  hideHeader = false,
}: ManagementDashboardProps) {
  const [remindedIds, setRemindedIds] = useState<Record<string, boolean>>({});
  const [sendingIds, setSendingIds] = useState<Record<string, boolean>>({});
  const [followUpFilter, setFollowUpFilter] = useState<'all' | 'needs-action' | 'unassigned' | 'assigned'>('all');

  // 1. Live Candidate Activity & Follow-up Tracking:
  // - Tracks all active candidates in the pipeline (Phases 1-5, not stopped, not deployed)
  // - Displays real-time duration in current status & handler assignment so the dashboard is always informative
  // - Warns when candidates exceed policy thresholds:
  //     • Unassigned waiting >= 5 days for a handler claim
  //     • Assigned handler idle >= 3 days without updates/processing
  const candidatePipeline = useMemo<CandidateActivityItem[]>(() => {
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;
    const oneDayMs = 24 * oneHourMs;
    const list: CandidateActivityItem[] = [];

    applicants.forEach((a) => {
      // Exclude stopped candidates, deployed candidates, or Phase 6
      if (a.isStopped || a.status === 'Deployed' || a.phase >= 6) return;

      const updateTime = parseDateToMs(a.lastUpdated) || parseDateToMs(a.createdAt) || now;
      const elapsedMs = Math.max(0, now - updateTime);
      const days = Math.floor(elapsedMs / oneDayMs);
      const hours = Math.floor(elapsedMs / oneHourMs);

      let timeInStatusLabel = '';
      if (days === 0) {
        if (hours < 1) {
          const minutes = Math.floor(elapsedMs / (60 * 1000));
          timeInStatusLabel = minutes <= 1 ? 'Just now (< 1m)' : `${minutes}m in status`;
        } else {
          timeInStatusLabel = `Today (${hours}h in status)`;
        }
      } else if (days === 1) {
        timeInStatusLabel = '1 day in status';
      } else {
        timeInStatusLabel = `${days} days in status`;
      }

      const isUnassigned = !a.currentHandlerUserId && isUnassignedHandlerName(a.currentHandler);
      const responsibleTeam = getResponsibleTeamForPhase(a.phase, a.currentDepartment);

      // Business Rules:
      // - Unassigned: 5 days threshold
      // - Assigned to a handler: 3 days threshold of inactivity
      const thresholdDays = isUnassigned ? 5 : 3;
      const isOverdue = days >= thresholdDays;

      let severity: 'critical' | 'warning' | 'caution' | 'normal' = 'normal';
      if (isOverdue) {
        if (days >= 7) severity = 'critical';
        else if (days >= 5) severity = 'warning';
        else severity = 'caution';
      }

      const reason = isOverdue
        ? isUnassigned
          ? `Unassigned for ${days} days • Needs ${responsibleTeam.label} to claim (Threshold: 5d)`
          : `Assigned to ${a.currentHandler} • Idle for ${days} days without updates (Threshold: 3d)`
        : isUnassigned
        ? `Unassigned for ${timeInStatusLabel} • Awaiting claim by ${responsibleTeam.label}`
        : `Handled by ${a.currentHandler} • ${timeInStatusLabel}`;

      list.push({
        applicant: a,
        isUnassigned,
        days,
        hours,
        timeInStatusLabel,
        thresholdDays,
        isOverdue,
        severity,
        responsibleTeam,
        reason,
      });
    });

    // Smart Sort:
    // 1. Overdue files float to the top (highest days overdue first)
    // 2. Active files on schedule sorted by longest time in status descending
    list.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      if (a.isOverdue && b.isOverdue) {
        return b.days - a.days;
      }
      return b.days !== a.days ? b.days - a.days : b.hours - a.hours;
    });

    return list;
  }, [applicants]);

  const candidatesNeedingAttention = useMemo(
    () => candidatePipeline.filter((c) => c.isOverdue),
    [candidatePipeline]
  );

  const overdueCount = candidatesNeedingAttention.length;

  const unassignedCount = useMemo(
    () => candidatePipeline.filter((c) => c.isUnassigned).length,
    [candidatePipeline]
  );

  const assignedCount = useMemo(
    () => candidatePipeline.filter((c) => !c.isUnassigned).length,
    [candidatePipeline]
  );

  const handlerIdleCount = useMemo(
    () => candidatesNeedingAttention.filter((c) => !c.isUnassigned).length,
    [candidatesNeedingAttention]
  );

  const filteredCandidates = useMemo(() => {
    if (followUpFilter === 'needs-action') {
      return candidatePipeline.filter((c) => c.isOverdue);
    }
    if (followUpFilter === 'unassigned') {
      return candidatePipeline.filter((c) => c.isUnassigned);
    }
    if (followUpFilter === 'assigned') {
      return candidatePipeline.filter((c) => !c.isUnassigned);
    }
    return candidatePipeline;
  }, [candidatePipeline, followUpFilter]);

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

  const departureItems = useMemo(() => {
    const nowMs = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    return nearDeployment.map((applicant) => {
      let targetTimestamp: number | null = null;
      let isConfirmedDate = false;

      const rawActual = applicant.actualDeploymentDate || (applicant as any).actual_deployment_at;
      if (rawActual) {
        const parsed = new Date(rawActual).getTime();
        if (!isNaN(parsed)) {
          targetTimestamp = parsed;
          isConfirmedDate = true;
        }
      }

      if (!targetTimestamp && applicant.predictedDeploymentDate) {
        const parsed = new Date(applicant.predictedDeploymentDate).getTime();
        if (!isNaN(parsed)) {
          targetTimestamp = parsed;
        }
      }

      // Default estimate based on status or recent update in Phase 5
      if (!targetTimestamp) {
        const updateTime = parseDateToMs(applicant.lastUpdated) || parseDateToMs(applicant.createdAt) || nowMs;
        // Typical Phase 5 final clearance is ~18 days
        targetTimestamp = updateTime + (18 * oneDayMs);
      }

      const diffMs = targetTimestamp - nowMs;
      const daysRemaining = Math.max(0, Math.ceil(diffMs / oneDayMs));

      let timeframe: 'next-7' | 'next-14' | 'later' = 'later';
      if (daysRemaining <= 7) {
        timeframe = 'next-7';
      } else if (daysRemaining <= 14) {
        timeframe = 'next-14';
      } else {
        timeframe = 'later';
      }

      let timeframeLabel = '';
      if (daysRemaining === 0) {
        timeframeLabel = 'Today';
      } else if (daysRemaining === 1) {
        timeframeLabel = 'Tomorrow';
      } else {
        timeframeLabel = `in ${daysRemaining} days`;
      }

      const formattedDate = targetTimestamp
        ? new Date(targetTimestamp).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : 'TBD';

      return {
        applicant,
        targetDate: formattedDate,
        daysRemaining,
        timeframe,
        timeframeLabel,
        isConfirmedDate,
        destination: applicant.jobOrder || 'Overseas Placement',
        milestone: applicant.status || 'Final Departure Clearance',
      };
    }).sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [nearDeployment]);

  const next7DaysCount = useMemo(
    () => departureItems.filter((item) => item.timeframe === 'next-7').length,
    [departureItems]
  );

  const next14DaysCount = useMemo(
    () => departureItems.filter((item) => item.timeframe === 'next-14').length,
    [departureItems]
  );

  const laterCount = useMemo(
    () => departureItems.filter((item) => item.timeframe === 'later').length,
    [departureItems]
  );

  // 4. Agency performance metrics
  const totalActive = applicants.filter((a) => !a.isStopped && a.status !== 'Deployed').length;
  const deploymentReady = applicants.filter((a) => a.phase === 5 && !a.isStopped).length;
  const avgPhaseNumber = applicants.length > 0
    ? Math.round((applicants.reduce((sum, a) => sum + (a.phase || 1), 0) / applicants.length) * 10) / 10
    : 1.0;
  const avgPhaseName = PHASE_LABELS[Math.min(5, Math.max(1, Math.round(avgPhaseNumber)))] || 'In Progress';
  const conversionRate = totalActive > 0 ? Math.round((deploymentReady / totalActive) * 100) : 0;

  const handleSendReminder = async (item: CandidateActivityItem) => {
    const { applicant, isUnassigned, responsibleTeam, days, isOverdue, timeInStatusLabel } = item;
    if (remindedIds[applicant.id] || sendingIds[applicant.id]) return;
    setSendingIds((prev) => ({ ...prev, [applicant.id]: true }));

    const recipientLabel = isUnassigned
      ? responsibleTeam.label
      : (applicant.currentHandler || responsibleTeam.label);
    const stageLabel = PHASE_LABELS[applicant.phase] || `Stage ${applicant.phase}`;

    try {
      await sendHandlerReminderNotification({
        applicantId: applicant.id,
        applicantName: applicant.name || 'Candidate',
        applicantCode: applicant.applicantCode,
        handlerName: applicant.currentHandler,
        handlerUserId: applicant.currentHandlerUserId,
        phase: applicant.phase,
        department: applicant.currentDepartment,
        stageLabel,
        senderName: currentUserName,
      });
      setRemindedIds((prev) => ({ ...prev, [applicant.id]: true }));
      if (addActivityLog) {
        addActivityLog({
          applicantId: String(applicant.id),
          action: isUnassigned
            ? (isOverdue ? 'Team Claim & Follow-Up Sent' : 'Team Assignment Follow-Up Sent')
            : (isOverdue ? 'Handler Delay Follow-Up Sent' : 'Handler Check-In Follow-Up Sent'),
          performedBy: currentUserName,
          department: 'Management',
          details: isUnassigned
            ? `Notified ${responsibleTeam.label} to claim unassigned candidate ${applicant.name} (${stageLabel}, waiting ${timeInStatusLabel})`
            : `Sent follow-up reminder to ${recipientLabel} for ${applicant.name} (${stageLabel}, ${timeInStatusLabel})`,
        });
      }
      if (showToast) {
        if (isUnassigned) {
          showToast(
            `${applicant.name} (${timeInStatusLabel}) — claim notification dispatched to ${responsibleTeam.label}.`
          );
        } else {
          showToast(`Follow-up reminder sent to ${recipientLabel} for ${applicant.name} (${timeInStatusLabel}).`);
        }
      }
    } finally {
      setSendingIds((prev) => ({ ...prev, [applicant.id]: false }));
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Unified Flowsensus Dashboard Header */}
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
              Management & Operations
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              Candidate pipeline overview, pending reviews, and departure schedules.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('manager')}
              className="px-3.5 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <FileCheck className="w-4 h-4" />
              <span>CV & Employer Hub</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <BarChart3 className="w-4 h-4 text-slate-500" />
              <span>Operational Reports</span>
            </button>
          </div>
        </div>
      )}

      {/* Embedded Action Toolbar when rendered in Multi-Role Dashboard */}
      {hideHeader && (
        <div className="flex items-center justify-end gap-2.5 pb-1">
          <button
            type="button"
            onClick={() => onNavigate('manager')}
            className="px-3.5 py-1.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>CV & Employer Hub</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('reports')}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
            <span>Operational Reports</span>
          </button>
        </div>
      )}

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
        {/* Candidates Needing Follow-up */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          {/* Card Header (Matched 1:1 with CVs Waiting for Review) */}
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-sm truncate">Candidates Needing Follow-up</h3>
                <p className="text-xs text-slate-500 truncate">Candidate pipeline status tracking and handler alerts</p>
              </div>
            </div>

            <span
              className={`px-2.5 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ${
                overdueCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {overdueCount > 0 ? `${overdueCount} Overdue` : 'All On Schedule'}
            </span>
          </div>

          {/* Clean Sub-header Filter Tabs */}
          {candidatePipeline.length > 0 && (
            <div className="px-4 py-2.5 border-b border-slate-100 bg-white flex items-center gap-1.5 overflow-x-auto text-xs">
              <button
                type="button"
                onClick={() => setFollowUpFilter('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  followUpFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                All ({candidatePipeline.length})
              </button>
              <button
                type="button"
                onClick={() => setFollowUpFilter('needs-action')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  followUpFilter === 'needs-action'
                    ? 'bg-rose-100 text-rose-800 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Overdue</span>
                {overdueCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-200 text-rose-900">
                    {overdueCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setFollowUpFilter('unassigned')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  followUpFilter === 'unassigned'
                    ? 'bg-amber-100 text-amber-900 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Unassigned</span>
                {unassignedCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
                    {unassignedCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setFollowUpFilter('assigned')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  followUpFilter === 'assigned'
                    ? 'bg-sky-100 text-sky-800 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Assigned</span>
                <span className="text-[10px] text-slate-400">({assignedCount})</span>
              </button>
            </div>
          )}

          {/* List of Candidates */}
          <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[520px]">
            {filteredCandidates.length === 0 ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full min-h-[220px]">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2 opacity-80" />
                <p className="text-sm font-semibold text-slate-700">
                  {candidatePipeline.length === 0
                    ? 'No active candidates in the pipeline'
                    : followUpFilter === 'needs-action'
                    ? 'All candidate files are moving along on schedule'
                    : followUpFilter === 'unassigned'
                    ? 'All active candidates have assigned handlers'
                    : 'No candidates match the selected filter'}
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  {candidatePipeline.length === 0
                    ? 'Newly registered candidate files will appear here.'
                    : followUpFilter === 'needs-action'
                    ? `No candidates are delayed beyond policy limits. All ${candidatePipeline.length} active candidates are on schedule.`
                    : followUpFilter === 'unassigned'
                    ? 'Every active file is currently assigned to a handler.'
                    : 'Switch filters or view all candidates above.'}
                </p>
                {candidatePipeline.length > 0 && followUpFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setFollowUpFilter('all')}
                    className="mt-3 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    View All Active Candidates ({candidatePipeline.length})
                  </button>
                )}
              </div>
            ) : (
              filteredCandidates.map((item) => {
                const { applicant, isUnassigned, days, isOverdue, timeInStatusLabel, responsibleTeam } = item;
                const isReminded = Boolean(remindedIds[applicant.id]);
                const isSending = Boolean(sendingIds[applicant.id]);

                return (
                  <div
                    key={applicant.id}
                    className={`p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 ${
                      isOverdue ? 'bg-amber-50/25' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative flex-shrink-0">
                        {(applicant.photoDataUrl || (applicant as any).photo) ? (
                          <img
                            src={applicant.photoDataUrl || (applicant as any).photo}
                            alt={applicant.name}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {getInitials(applicant.name)}
                          </div>
                        )}
                        {isOverdue && (
                          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-slate-800 text-sm truncate">{applicant.name || 'Unnamed Candidate'}</p>
                          <span className="text-[10px] text-slate-400 font-mono">{applicant.applicantCode || applicant.id}</span>
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {PHASE_LABELS[applicant.phase] || `Stage ${applicant.phase}`}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {applicant.role || 'Candidate'} • {applicant.status}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                          <span className={`font-semibold ${isOverdue ? 'text-rose-700' : 'text-slate-600'}`}>
                            {isOverdue ? `${days}d in status` : timeInStatusLabel}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span>
                            {isUnassigned ? (
                              <span className="text-amber-700 font-medium">Unassigned ({responsibleTeam.label})</span>
                            ) : (
                              <span>Handler: <strong className="font-medium text-slate-700">{applicant.currentHandler}</strong></span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => onViewApplicant(applicant.id)}
                        className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        View Profile
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSendReminder(item)}
                        disabled={isReminded || isSending}
                        title={
                          isUnassigned
                            ? `Send claim alert to ${responsibleTeam.label} for ${applicant.name}`
                            : `Send follow-up reminder to ${applicant.currentHandler || responsibleTeam.label}`
                        }
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs ${
                          isReminded
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                            : isOverdue
                            ? isUnassigned
                              ? 'bg-rose-600 hover:bg-rose-700 text-white'
                              : 'bg-amber-600 hover:bg-amber-700 text-white'
                            : 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-700'
                        }`}
                      >
                        {isSending ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Sending…</span>
                          </>
                        ) : isReminded ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Notified</span>
                          </>
                        ) : isOverdue ? (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>{isUnassigned ? 'Notify Team' : 'Notify Handler'}</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5 text-slate-400" />
                            <span>Ping</span>
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
        {/* Card Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <Plane className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-800 text-sm truncate">Upcoming Candidate Departures</h3>
              <p className="text-xs text-slate-500 truncate">Projected flight dates & milestone readiness for candidates in Phase 5</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('forecast')}
            className="text-xs font-semibold text-[#0EA5E9] hover:text-[#0284C7] flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-center"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Predictive Timeline</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Real Dynamic Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Next 7 Days */}
            <div className="p-4 rounded-xl bg-emerald-50/40 border border-emerald-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Next 7 Days</span>
                <p className="text-2xl font-extrabold text-emerald-700 mt-1">{next7DaysCount}</p>
                <p className="text-xs text-slate-500 mt-0.5">Final departure & ticket clearance</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                <Plane className="w-5 h-5" />
              </div>
            </div>

            {/* Next 8-14 Days */}
            <div className="p-4 rounded-xl bg-sky-50/40 border border-sky-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider">Next 8–14 Days</span>
                <p className="text-2xl font-extrabold text-[#0284C7] mt-1">{next14DaysCount}</p>
                <p className="text-xs text-slate-500 mt-0.5">Visas issued & ticket booking</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
            </div>

            {/* Later This Month */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Later This Month</span>
                <p className="text-2xl font-extrabold text-slate-800 mt-1">{laterCount}</p>
                <p className="text-xs text-slate-500 mt-0.5">OEC & consular processing</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-200/80 text-slate-600 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Near-Deployment Candidate List */}
          {departureItems.length > 0 ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Scheduled Candidate Departures
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {departureItems.length} {departureItems.length === 1 ? 'Candidate' : 'Candidates'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('ocr')}
                  className="text-xs font-semibold text-slate-600 hover:text-[#0EA5E9] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Verify Documents & Flight Tickets</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                {departureItems.map((item) => {
                  const { applicant, targetDate, daysRemaining, timeframeLabel, isConfirmedDate, destination, milestone } = item;
                  return (
                    <div
                      key={applicant.id}
                      className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                    >
                      {/* Left: Candidate Info & Job Details */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="relative flex-shrink-0">
                          {(applicant.photoDataUrl || (applicant as any).photo) ? (
                            <img
                              src={applicant.photoDataUrl || (applicant as any).photo}
                              alt={applicant.name}
                              className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-2xs"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-100 shadow-2xs">
                              {getInitials(applicant.name)}
                            </div>
                          )}
                          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-600 border-2 border-white flex items-center justify-center text-[8px] text-white font-black shadow-2xs">
                            ✈
                          </span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p
                              onClick={() => onViewApplicant(applicant.id)}
                              className="font-bold text-slate-900 text-sm truncate hover:text-[#0EA5E9] cursor-pointer transition-colors"
                            >
                              {applicant.name || 'Unnamed Candidate'}
                            </p>
                            <span className="text-[10px] font-mono text-slate-400">
                              {applicant.applicantCode || applicant.id}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {destination}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 flex-wrap">
                            <span className="font-medium text-slate-700">{applicant.role || 'Worker'}</span>
                            <span className="text-slate-300">•</span>
                            <span>Milestone: <strong className="font-semibold text-slate-700">{milestone}</strong></span>
                            <span className="text-slate-300">•</span>
                            <span>Handler: <span className="text-slate-700 font-medium">{applicant.currentHandler || 'Unassigned'}</span></span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Flight / Target Date Badge & Action Buttons */}
                      <div className="flex items-center gap-3 sm:self-center self-end flex-shrink-0 flex-wrap md:flex-nowrap">
                        <div className="text-right">
                          <div className="flex items-center gap-1.5 justify-end">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${
                                isConfirmedDate
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-sky-50 text-sky-800 border-sky-200'
                              }`}
                            >
                              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{targetDate}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/80 font-extrabold">
                                {timeframeLabel}
                              </span>
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 text-right font-medium">
                            {isConfirmedDate ? 'Confirmed Flight Schedule' : 'Estimated Target Date'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onViewApplicant(applicant.id)}
                            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-2xs"
                          >
                            View Profile
                          </button>
                          <button
                            type="button"
                            onClick={() => onNavigate('ocr')}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                            <span>Verify Flight</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-1.5 opacity-80" />
              <p className="text-sm font-semibold text-slate-700">No candidates currently scheduled for departure</p>
              <p className="text-xs text-slate-400 mt-0.5">Candidates reaching Stage 5 (Visa & Departure Processing) will appear here automatically.</p>
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
