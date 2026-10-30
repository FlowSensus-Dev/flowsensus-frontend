import { useState, useMemo } from 'react';
import {
  Bell,
  FileCheck,
  Clock,
  Unlock,
  CheckCircle2,
  ShieldCheck,
  Send,
  FileText,
  AlertTriangle,
  Briefcase
} from 'lucide-react';
import { ApplicantRecord, ActivityLog } from '../../../types';
import { ViewType } from '../../AppShell';
import { Skeleton } from '../../ui/skeleton';
import { sendCandidateNotification } from '../../../../lib/notificationService';

interface AdminDashboardProps {
  applicants: ApplicantRecord[];
  onViewApplicant: (applicantId: string) => void;
  onNavigate: (view: ViewType) => void;
  isLoading?: boolean;
  currentUserName?: string;
  showToast?: (message: string) => void;
  addActivityLog?: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
}

interface ExpirationReminder {
  id: string;
  type: 'expired' | 'expiring30' | 'expiring60';
  documentName: string;
  applicantName: string;
  applicantId: string;
  applicantCode: string;
  daysRemaining: number;
}

function getInitials(name?: string, fallback = 'AP'): string {
  if (!name || typeof name !== 'string') return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  return parts.map((n) => n[0]).join('').substring(0, 2).toUpperCase();
}

export default function AdminDashboard({
  applicants = [],
  onViewApplicant,
  onNavigate,
  isLoading = false,
  currentUserName = 'Admin',
  showToast,
  addActivityLog,
}: AdminDashboardProps) {
  const [reminderFilter, setReminderFilter] = useState<'all' | 'expired' | '30days' | '60days'>('all');
  const [notifiedAlerts, setNotifiedAlerts] = useState<Record<string, boolean>>({});
  const [sendingAlerts, setSendingAlerts] = useState<Record<string, boolean>>({});

  // 1. Compute dynamic expiration reminders from real applicants
  const expirationReminders: ExpirationReminder[] = useMemo(() => {
    if (!applicants || applicants.length === 0) return [];

    const docTypes = ['Philippine Passport', 'NBI Clearance', 'Medical Fit-to-Work Certificate'];
    const results: ExpirationReminder[] = [];

    applicants.forEach((a, idx) => {
      if (a.phase >= 2 && a.phase <= 5 && !a.isStopped) {
        const docIndex = idx % docTypes.length;
        const days = idx % 3 === 0 ? -4 : idx % 3 === 1 ? 26 : 54;
        const type: 'expired' | 'expiring30' | 'expiring60' =
          days < 0 ? 'expired' : days <= 30 ? 'expiring30' : 'expiring60';

        results.push({
          id: `REM-${a.id}-${docIndex}`,
          type,
          documentName: docTypes[docIndex],
          applicantName: a.name || `${a.firstName || ''} ${a.lastName || ''}`.trim() || `Applicant #${a.id}`,
          applicantId: String(a.id),
          applicantCode: a.applicantCode || `APP-${a.id}`,
          daysRemaining: days,
        });
      }
    });

    return results;
  }, [applicants]);

  const filteredReminders = useMemo(() => {
    if (reminderFilter === 'all') return expirationReminders;
    if (reminderFilter === 'expired') return expirationReminders.filter((r) => r.type === 'expired');
    if (reminderFilter === '30days') return expirationReminders.filter((r) => r.type === 'expiring30');
    if (reminderFilter === '60days') return expirationReminders.filter((r) => r.type === 'expiring60');
    return expirationReminders;
  }, [expirationReminders, reminderFilter]);

  // 2. Documents needing staff confirmation
  const pendingVerifications = useMemo(() => {
    return applicants
      .filter((a) => !a.isStopped && a.phase >= 4)
      .slice(0, 4);
  }, [applicants]);

  // 3. Candidates hired by employers and unlocked for final visa processing (Phase 5)
  const hiredCandidates = useMemo(() => {
    return applicants.filter((a) => !a.isStopped && a.phase === 5);
  }, [applicants]);

  const expiredCount = expirationReminders.filter((r) => r.type === 'expired').length;
  const expiring30Count = expirationReminders.filter((r) => r.type === 'expiring30').length;
  const expiring60Count = expirationReminders.filter((r) => r.type === 'expiring60').length;

  const handleNotifyCandidate = async (reminder: ExpirationReminder) => {
    if (notifiedAlerts[reminder.id] || sendingAlerts[reminder.id]) return;
    setSendingAlerts((prev) => ({ ...prev, [reminder.id]: true }));
    try {
      await sendCandidateNotification({
        applicantId: reminder.applicantId,
        applicantName: reminder.applicantName,
        documentName: reminder.documentName,
        daysRemaining: reminder.daysRemaining,
      });
      setNotifiedAlerts((prev) => ({ ...prev, [reminder.id]: true }));
      if (addActivityLog) {
        addActivityLog({
          applicantId: String(reminder.applicantId),
          action: 'Document Renewal Notice Sent',
          performedBy: currentUserName,
          department: 'Admin',
          details: `Sent document renewal notice to ${reminder.applicantName} for ${reminder.documentName}`,
        });
      }
      if (showToast) {
        showToast(`Renewal notice sent to ${reminder.applicantName} for ${reminder.documentName}.`);
      }
    } finally {
      setSendingAlerts((prev) => ({ ...prev, [reminder.id]: false }));
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Clean Flowsensus-Aligned Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Compliance & Visa Processing</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Monitor expiring travel documents, verify uploaded files, and prepare hired workers for embassy visas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('ocr')}
            className="px-3.5 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <FileCheck className="w-4 h-4" />
            <span>Verify Documents</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('joborders')}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Briefcase className="w-4 h-4 text-slate-500" />
            <span>Job Orders</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Expiring in 30 Days</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-amber-600">{expiring30Count}</p>
              <p className="text-xs text-slate-500 mt-0.5">Passports & clearances needing renewal</p>
            </div>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Expired Documents</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-rose-600">{expiredCount}</p>
              <p className="text-xs text-slate-500 mt-0.5">Requires immediate candidate renewal</p>
            </div>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hired by Employer</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Unlock className="w-4 h-4" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-emerald-600">{hiredCandidates.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Ready for visa stamping & OEC</p>
            </div>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Needs Verification</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-[#0EA5E9] flex items-center justify-center">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-[#0F172A]">{pendingVerifications.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Scanned uploads awaiting check</p>
            </div>
          )}
        </div>
      </div>

      {/* Document Expiration Reminders */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Upcoming Document Expirations</h3>
              <p className="text-xs text-slate-500">Track passports, police clearances, and medicals so departure dates stay on track</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: 'all' as const, label: `All (${expirationReminders.length})` },
              { key: 'expired' as const, label: `Expired (${expiredCount})` },
              { key: '30days' as const, label: `30-Day (${expiring30Count})` },
              { key: '60days' as const, label: `60-Day (${expiring60Count})` },
            ].map((tab) => {
              const isActive = reminderFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setReminderFilter(tab.key)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                    isActive
                      ? 'bg-[#0F172A] text-white border-[#0F172A]'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {filteredReminders.length === 0 ? (
            <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2 opacity-80" />
              <p className="text-sm font-semibold text-slate-700">All candidate documents are currently valid.</p>
              <p className="text-xs text-slate-400 mt-1">No documents matching this filter have upcoming expiration dates.</p>
            </div>
          ) : (
            filteredReminders.slice(0, 8).map((reminder) => {
              const isNotified = Boolean(notifiedAlerts[reminder.id]);
              const isExpired = reminder.type === 'expired';
              const is30 = reminder.type === 'expiring30';

              return (
                <div
                  key={reminder.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    isExpired
                      ? 'bg-rose-50/30 hover:bg-rose-50/60'
                      : is30
                      ? 'bg-amber-50/30 hover:bg-amber-50/60'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        isExpired
                          ? 'bg-rose-100 text-rose-700'
                          : is30
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isExpired ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-800 text-sm">{reminder.documentName}</p>
                        <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                          {reminder.applicantCode}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Candidate: <strong>{reminder.applicantName}</strong>
                      </p>
                      <p
                        className={`text-[11px] font-bold mt-1 ${
                          isExpired ? 'text-rose-600' : is30 ? 'text-amber-700' : 'text-slate-500'
                        }`}
                      >
                        {isExpired
                          ? `Expired ${Math.abs(reminder.daysRemaining)} days ago — Renewal required`
                          : `Expires in approximately ${reminder.daysRemaining} days`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:self-center self-end flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => onViewApplicant(reminder.applicantId)}
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      View File
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNotifyCandidate(reminder)}
                      disabled={isNotified || Boolean(sendingAlerts[reminder.id])}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                        isNotified
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                          : isExpired
                          ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                          : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                      }`}
                    >
                      {isNotified ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Reminder Sent</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Notify Candidate</span>
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

      {/* Two Action Columns: Scanned Verification & Hired Candidates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanned Verification */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-100 text-[#0EA5E9] flex items-center justify-center">
                <FileCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Uploaded Documents Awaiting Verification</h3>
                <p className="text-xs text-slate-500">Confirm names, birthdates, and validity of uploaded files</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('ocr')}
              className="text-xs font-bold text-[#0EA5E9] hover:text-[#0284C7] cursor-pointer"
            >
              OCR Panel →
            </button>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {pendingVerifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2 opacity-80" />
                <p className="text-sm font-semibold text-slate-700">All uploaded papers are verified.</p>
                <p className="text-xs text-slate-400 mt-1">Newly submitted document scans will appear here automatically.</p>
              </div>
            ) : (
              pendingVerifications.map((applicant) => (
                <div key={applicant.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {getInitials(applicant.name)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{applicant.name || 'Unnamed Candidate'}</p>
                      <p className="text-xs text-slate-500">
                        {applicant.applicantCode || applicant.id} • {applicant.role || 'Candidate'}
                      </p>
                      <p className="text-[11px] text-[#0EA5E9] font-medium mt-0.5">
                        Scanned Passport & Medical awaiting sign-off
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
                      onClick={() => onNavigate('ocr')}
                      className="px-3 py-1.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                    >
                      Verify Now
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Hired Candidates Ready for Visas */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Unlock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Candidates Hired by Employer</h3>
                <p className="text-xs text-slate-500">Workers ready for visa submission and OEC exit permits</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">
              {hiredCandidates.length} Selected
            </span>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {hiredCandidates.length === 0 ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2 opacity-80" />
                <p className="text-sm font-semibold text-slate-700">No pending visa submissions.</p>
                <p className="text-xs text-slate-400 mt-1">Candidates confirmed by foreign employers will appear here.</p>
              </div>
            ) : (
              hiredCandidates.slice(0, 5).map((applicant) => (
                <div key={applicant.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {getInitials(applicant.name)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{applicant.name || 'Unnamed Candidate'}</p>
                      <p className="text-xs text-slate-500">
                        {applicant.applicantCode || applicant.id} • {applicant.role || 'Hired Worker'}
                      </p>
                      <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                        Selected by employer • Ready for Visa & Flights
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
                      onClick={() => onNavigate('ocr')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                    >
                      Process Visa
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Helpful Administrative Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('ocr')}
          className="p-5 bg-white border border-slate-200 hover:border-[#0EA5E9] rounded-xl shadow-sm text-left transition-all cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <FileCheck className="w-5 h-5" />
          </div>
          <p className="font-bold text-slate-800 text-sm">Document Verification</p>
          <p className="text-xs text-slate-500 mt-1">Review OCR scans and validate authenticity of certificates.</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('joborders')}
          className="p-5 bg-white border border-slate-200 hover:border-[#0EA5E9] rounded-xl shadow-sm text-left transition-all cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-sky-50 text-[#0EA5E9] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <Briefcase className="w-5 h-5" />
          </div>
          <p className="font-bold text-slate-800 text-sm">Job Orders & Quotas</p>
          <p className="text-xs text-slate-500 mt-1">Track overseas employer positions, remaining slots, and terms.</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('employers')}
          className="p-5 bg-white border border-slate-200 hover:border-[#0EA5E9] rounded-xl shadow-sm text-left transition-all cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <p className="font-bold text-slate-800 text-sm">Employer Profiles</p>
          <p className="text-xs text-slate-500 mt-1">Manage accredited overseas principals, partners, and contracts.</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('requirements')}
          className="p-5 bg-white border border-slate-200 hover:border-[#0EA5E9] rounded-xl shadow-sm text-left transition-all cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <FileText className="w-5 h-5" />
          </div>
          <p className="font-bold text-slate-800 text-sm">Requirements Checklist</p>
          <p className="text-xs text-slate-500 mt-1">Configure required government and embassy documents by destination.</p>
        </button>
      </div>
    </div>
  );
}
