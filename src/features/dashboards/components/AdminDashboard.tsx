import { AlertTriangle, Bell, FileCheck, Clock, Unlock } from 'lucide-react';
import { ApplicantRecord } from '../../../app/types';

interface AdminDashboardProps {
  applicants: ApplicantRecord[];
  onViewApplicant: (applicantId: string) => void;
  onNavigate: (view: string) => void;
}

export default function AdminDashboard({ applicants, onViewApplicant, onNavigate }: AdminDashboardProps) {
  // Action Queues
  const expiredDocs = 2; // Mock data for demo
  const expiringIn30 = applicants.filter((a) => a.phase >= 3).length; // Mock
  const expiringIn60 = applicants.filter((a) => a.phase >= 2).length; // Mock
  const pendingOCR = applicants.filter((a) => a.phase === 5 && a.status.includes('Final')).slice(0, 3);
  const newlyUnlocked = applicants.filter((a) => a.phase === 5);

  const alerts = [
    {
      type: 'expired',
      doc: 'TESDA Certificate',
      applicant: 'Juan Dela Cruz',
      applicantId: 'APP-2026-089',
      daysAgo: 3,
    },
    {
      type: 'expiring30',
      doc: 'Medical Clearance',
      applicant: 'Ana Reyes',
      applicantId: 'APP-2026-051',
      daysLeft: 28,
    },
    {
      type: 'expiring60',
      doc: 'NBI Clearance',
      applicant: 'Pedro Garcia',
      applicantId: 'APP-2026-112',
      daysLeft: 58,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold tracking-tight text-[#0F172A]">Administrative Compliance Center</h2>
        <p className="text-sm text-[#64748B] mt-1 font-medium">
          Pre-deployment compliance and 3-2-1 expiration monitoring
        </p>
      </div>

      {/* 3-2-1 Alert Center */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 bg-[#EF4444]/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-6 h-6 text-[#EF4444]" />
            <h3 className="font-black text-[#0F172A] text-lg">3-2-1 Alert Center</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-[#EF4444] text-white text-xs font-bold rounded-full">{expiredDocs} Expired</span>
            <span className="px-3 py-1 bg-[#F59E0B] text-white text-xs font-bold rounded-full">{expiringIn30} 30-Day</span>
            <span className="px-3 py-1 bg-yellow-500 text-white text-xs font-bold rounded-full">{expiringIn60} 60-Day</span>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={`p-5 flex items-center justify-between ${
                alert.type === 'expired'
                  ? 'bg-red-50/80'
                  : alert.type === 'expiring30'
                  ? 'bg-amber-50/80'
                  : 'bg-yellow-50/50'
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    alert.type === 'expired'
                      ? 'bg-[#EF4444]/10'
                      : alert.type === 'expiring30'
                      ? 'bg-[#F59E0B]/10'
                      : 'bg-yellow-500/10'
                  }`}
                >
                  {alert.type === 'expired' ? (
                    <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
                  ) : (
                    <Clock className="w-5 h-5 text-[#F59E0B]" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-[#0F172A] text-sm">
                    {alert.doc} • {alert.applicant}
                  </p>
                  <p
                    className={`text-xs font-bold mt-1 uppercase tracking-wider ${
                      alert.type === 'expired'
                        ? 'text-[#EF4444]'
                        : alert.type === 'expiring30'
                        ? 'text-[#F59E0B]'
                        : 'text-yellow-600'
                    }`}
                  >
                    {alert.type === 'expired' ? `Expired ${alert.daysAgo} days ago` : `Expires in ${alert.daysLeft} days`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onViewApplicant(alert.applicantId)}
                  className="px-4 py-2 bg-white border-2 border-slate-200 text-[#0F172A] text-xs font-bold rounded-lg hover:bg-slate-50"
                >
                  View Profile
                </button>
                <button
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                    alert.type === 'expired'
                      ? 'bg-white border-2 border-[#EF4444] text-[#EF4444] hover:bg-[#EF4444] hover:text-white'
                      : 'bg-white border-2 border-[#F59E0B] text-[#F59E0B] hover:bg-[#F59E0B] hover:text-white'
                  }`}
                >
                  Notify Applicant
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Queue: Pending OCR */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 bg-[#8B5CF6]/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-[#8B5CF6]" />
            <h3 className="font-black text-[#0F172A] text-sm uppercase tracking-wider">Pending OCR Verification</h3>
          </div>
          <span className="px-3 py-1 bg-[#8B5CF6] text-white text-xs font-bold rounded-full">
            {pendingOCR.length} Flagged
          </span>
        </div>
        <div className="divide-y divide-slate-100">
          {pendingOCR.length === 0 ? (
            <div className="p-6 text-center text-[#64748B]">
              <p className="text-sm font-medium">No documents flagged for manual review.</p>
            </div>
          ) : (
            pendingOCR.map((applicant) => (
              <div
                key={applicant.id}
                className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center font-bold text-[#8B5CF6] text-sm">
                    {applicant.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .substring(0, 2)}
                  </div>
                  <div>
                    <p className="font-bold text-[#0F172A]">{applicant.name}</p>
                    <p className="text-xs text-[#64748B]">{applicant.id} • Data mismatch detected</p>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate('ocr')}
                  className="px-4 py-2 bg-[#8B5CF6] text-white text-xs font-bold rounded-lg hover:bg-[#7C3AED]"
                >
                  Review Document
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Newly Unlocked Applicants (Phase 5) */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 bg-[#10B981]/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Unlock className="w-5 h-5 text-[#10B981]" />
            <h3 className="font-black text-[#0F172A] text-sm uppercase tracking-wider">
              Newly Unlocked (Employer Accepted)
            </h3>
          </div>
          <span className="text-xs font-bold text-[#64748B]">{newlyUnlocked.length} Ready</span>
        </div>
        <div className="divide-y divide-slate-100">
          {newlyUnlocked.length === 0 ? (
            <div className="p-6 text-center text-[#64748B]">
              <p className="text-sm font-medium">No newly unlocked applicants yet.</p>
            </div>
          ) : (
            newlyUnlocked.map((applicant) => (
              <div
                key={applicant.id}
                className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#10B981]/10 flex items-center justify-center font-bold text-[#10B981] text-sm">
                    {applicant.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .substring(0, 2)}
                  </div>
                  <div>
                    <p className="font-bold text-[#0F172A]">{applicant.name}</p>
                    <p className="text-xs text-[#64748B]">{applicant.id} • Ready for visa processing</p>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate('ocr')}
                  className="px-4 py-2 bg-[#10B981] text-white text-xs font-bold rounded-lg hover:bg-[#059669]"
                >
                  Begin Processing
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
