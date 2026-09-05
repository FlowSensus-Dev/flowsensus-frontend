import { Clock, User, FileText } from 'lucide-react';
import { ActivityLog, ApplicantRecord } from '../../../app/types';

interface DeploymentHistoryProps {
  activityLogs?: ActivityLog[];
  applicants?: ApplicantRecord[];
}

export default function DeploymentHistory({ activityLogs = [], applicants = [] }: DeploymentHistoryProps) {
  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold tracking-tight text-[#0F172A]">Deployment History</h2>
        <p className="text-sm text-[#64748B] mt-1 font-medium">
          Complete audit trail of all deployment activities and staff interactions
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 flex items-center gap-4">
        <select className="border-2 border-slate-200 px-3 py-2 rounded-lg text-sm focus:border-[#0EA5E9] outline-none">
          <option>All Departments</option>
          <option>Recruitment</option>
          <option>Admin</option>
          <option>Accounting</option>
          <option>Management</option>
        </select>
        <select className="border-2 border-slate-200 px-3 py-2 rounded-lg text-sm focus:border-[#0EA5E9] outline-none">
          <option>All Actions</option>
          <option>User Login</option>
          <option>Applicant Registration</option>
          <option>Screening</option>
          <option>CV Approval</option>
          <option>Employer Acceptance</option>
        </select>
        <input
          type="date"
          className="border-2 border-slate-200 px-3 py-2 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
        />
      </div>

      {/* Activity Timeline */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-black text-[#0F172A] text-sm uppercase tracking-wider">Activity Timeline</h3>
          <span className="text-xs font-bold text-[#64748B]">{activityLogs.length} Total Activities</span>
        </div>
        <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
          {activityLogs.map((log) => (
            <div key={log.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#0EA5E9]/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-[#0EA5E9]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#0F172A]">{log.performedBy}</span>
                      <span className="px-2 py-0.5 bg-[#0EA5E9]/10 text-[#0EA5E9] text-xs font-bold rounded">
                        {log.department}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-[#64748B]">
                      <Clock className="w-3 h-3" />
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <p className="text-sm font-bold text-[#0F172A] mb-1">{log.action}</p>
                  <p className="text-sm text-[#64748B]">{log.details}</p>
                  {log.applicantId && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-[#0EA5E9]">
                      <FileText className="w-3 h-3" />
                      Applicant: {log.applicantId}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
