import { Eye, Clock, AlertTriangle } from 'lucide-react';
import { ApplicantRecord, ActivityLog, UserRole } from '../../types';

interface DashboardProps {
  applicants?: ApplicantRecord[];
  activityLogs?: ActivityLog[];
  currentUserRole: UserRole;
  onViewApplicant: (applicantId: string) => void;
}

export default function Dashboard({ applicants = [], activityLogs = [], currentUserRole, onViewApplicant }: DashboardProps) {
  const activeCount = applicants.length;
  const acceptedCount = applicants.filter((a) => a.phase >= 4).length;
  const pendingMedicalCount = applicants.filter((a) => a.phase === 2).length;
  const expiryAlerts = 2;

  // Check for delays (applicants not updated in 24 hours)
  const delayThreshold = 24 * 60 * 60 * 1000; // 24 hours in ms
  const delayedApplicants = applicants.filter((applicant) => {
    const lastUpdate = new Date(applicant.lastUpdated).getTime();
    const now = new Date().getTime();
    return now - lastUpdate > delayThreshold;
  });

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold tracking-tight text-[#0F172A]">Operational Overview</h2>
        <p className="text-sm text-[#64748B] mt-1 font-medium">Real-time metrics for current deployment pipeline.</p>
      </div>

      {/* Delay Alert for Management */}
      {currentUserRole === 'Management' && delayedApplicants.length > 0 && (
        <div className="bg-red-50 border-2 border-[#EF4444] rounded-lg p-5 flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-[#EF4444] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[#EF4444]">Delay Notification</p>
            <p className="text-sm text-[#0F172A] mt-1">
              {delayedApplicants.length} applicant{delayedApplicants.length > 1 ? 's have' : ' has'} not been updated
              in over 24 hours. Immediate action required.
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border-l-4 border-l-[#0EA5E9] shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#0EA5E9]/10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          <p className="text-sm font-bold text-[#64748B] uppercase tracking-wider">Active Pipeline</p>
          <p className="text-4xl font-black text-[#0F172A] mt-2">{activeCount}</p>
        </div>
        <div className="bg-white p-6 rounded-lg border-l-4 border-l-[#10B981] shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#10B981]/10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          <p className="text-sm font-bold text-[#64748B] uppercase tracking-wider">Accepted</p>
          <p className="text-4xl font-black text-[#0F172A] mt-2">{acceptedCount}</p>
        </div>
        <div className="bg-white p-6 rounded-lg border-l-4 border-l-[#F59E0B] shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#F59E0B]/10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          <p className="text-sm font-bold text-[#64748B] uppercase tracking-wider">Pending Medical</p>
          <p className="text-4xl font-black text-[#0F172A] mt-2">{pendingMedicalCount}</p>
        </div>
        <div className="bg-white p-6 rounded-lg border-l-4 border-l-[#EF4444] shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#EF4444]/10 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          <p className="text-sm font-bold text-[#64748B] uppercase tracking-wider">Expiry Alerts</p>
          <p className="text-4xl font-black text-[#0F172A] mt-2">{expiryAlerts}</p>
        </div>
      </div>

      {/* Active Applicants with Handler Info */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-black text-[#0F172A] text-sm uppercase tracking-wider">Recent Activity</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {applicants.slice(0, 5).map((applicant) => (
            <div
              key={applicant.id}
              className="px-6 py-4 hover:bg-slate-50 transition-colors flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0EA5E9]/10 flex items-center justify-center font-bold text-[#0EA5E9] text-sm">
                    {applicant.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .substring(0, 2)}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-[#0F172A]">{applicant.name}</p>
                    <p className="text-xs text-[#64748B]">
                      {applicant.id} • {applicant.role}
                    </p>
                  </div>
                </div>
                <div className="ml-13 mt-2 flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-[#64748B]">Phase:</span>{' '}
                    <span className="font-bold text-[#0F172A]">{applicant.phase}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B]">Handler:</span>{' '}
                    <span className="font-bold text-[#0EA5E9]">{applicant.currentHandler}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B]">Department:</span>{' '}
                    <span className="font-medium">{applicant.currentDepartment}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[#64748B]">
                    <Clock className="w-3 h-3" />
                    <span>{applicant.lastUpdated}</span>
                  </div>
                </div>
                <p className="ml-13 mt-1 text-xs text-[#64748B] italic">{applicant.phaseDescription}</p>
              </div>
              <button
                onClick={() => onViewApplicant(applicant.id)}
                className="ml-4 px-4 py-2 bg-[#0EA5E9] text-white text-xs font-bold rounded-lg hover:bg-[#0284C7] flex items-center gap-1"
              >
                <Eye className="w-3 h-3" />
                View
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity Log */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-black text-[#0F172A] text-sm uppercase tracking-wider">System Activity Log</h3>
        </div>
        <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
          {activityLogs.slice(0, 10).map((log) => (
            <div key={log.id} className="px-6 py-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#0F172A]">{log.performedBy}</span>
                  <span className="text-[#64748B]"> • {log.action}</span>
                </div>
                <span className="text-xs text-[#64748B]">{new Date(log.timestamp).toLocaleString()}</span>
              </div>
              <p className="text-xs text-[#64748B] mt-1">{log.details}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

