import { Clock, UserPlus, FileCheck, AlertTriangle, CheckCircle, Eye } from 'lucide-react';

export default function RecruitmentDashboard({
  applicants = [],
  activity_logs = [],
  onViewApplicant = () => {},
  onNavigate = () => {},
}) {
  // Action Queues
  const pending_medical_validations = applicants.filter((a) => a.phase === 2 && a.status.includes('Medical'));
  const incomplete_screenings = applicants.filter((a) => a.phase === 1 && !a.test_scores);
  const ready_for_cv = applicants.filter((a) => a.phase === 3 && a.status.includes('CV'));
  const waiting_employer = applicants.filter((a) => a.phase === 4);

  // Recent Management Activity
  const management_activity = activity_logs
    .filter((log) => log.department === 'Management' && (log.action.includes('CV') || log.action.includes('Reject')))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header with Quick Action */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#0F172A]">Recruitment Operations</h2>
          <p className="text-sm text-[#64748B] mt-1 font-medium">Drive applicants from walk-in to employer endorsement</p>
        </div>
        <button
          onClick={() => onNavigate('registration')}
          className="px-6 py-3 bg-[#0EA5E9] text-white font-bold rounded-lg shadow-lg hover:bg-[#0284C7] flex items-center gap-2"
        >
          <UserPlus className="w-5 h-5" />
          Register New Applicant
        </button>
      </div>

      {/* Pipeline Counters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border-l-4 border-l-[#0EA5E9] shadow-sm">
          <p className="text-sm font-bold text-[#64748B] uppercase tracking-wider">Total Active</p>
          <p className="text-4xl font-black text-[#0F172A] mt-2">{applicants.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg border-l-4 border-l-[#10B981] shadow-sm">
          <p className="text-sm font-bold text-[#64748B] uppercase tracking-wider">Ready for CV</p>
          <p className="text-4xl font-black text-[#0F172A] mt-2">{ready_for_cv.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg border-l-4 border-l-[#F59E0B] shadow-sm">
          <p className="text-sm font-bold text-[#64748B] uppercase tracking-wider">Waiting Employer</p>
          <p className="text-4xl font-black text-[#0F172A] mt-2">{waiting_employer.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg border-l-4 border-l-[#8B5CF6] shadow-sm">
          <p className="text-sm font-bold text-[#64748B] uppercase tracking-wider">Pending Medical</p>
          <p className="text-4xl font-black text-[#0F172A] mt-2">{pending_medical_validations.length}</p>
        </div>
      </div>

      {/* Action Queue: Pending Medical Validations */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 bg-[#8B5CF6]/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[#8B5CF6]" />
            <h3 className="font-black text-[#0F172A] text-sm uppercase tracking-wider">
              Priority: Pending Medical Validations
            </h3>
          </div>
          <span className="px-3 py-1 bg-[#8B5CF6] text-white text-xs font-bold rounded-full">
            {pending_medical_validations.length} Waiting
          </span>
        </div>
        <div className="divide-y divide-slate-100">
          {pending_medical_validations.length === 0 ? (
            <div className="p-6 text-center text-[#64748B]">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">All caught up! No pending medical validations.</p>
            </div>
          ) : (
            pending_medical_validations.map((applicant) => (
              <div key={applicant.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
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
                    <p className="text-xs text-[#64748B]">{applicant.id} â€¢ Returned from clinic</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-xs text-[#64748B]">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {applicant.last_updated}
                  </div>
                  <button
                    onClick={() => onNavigate('screening')}
                    className="px-4 py-2 bg-[#8B5CF6] text-white text-xs font-bold rounded-lg hover:bg-[#7C3AED]"
                  >
                    Update Status
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Action Queue: Incomplete Screenings */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-black text-[#0F172A] text-sm uppercase tracking-wider">Incomplete Screenings</h3>
          <span className="text-xs font-bold text-[#64748B]">{incomplete_screenings.length} Pending</span>
        </div>
        <div className="divide-y divide-slate-100">
          {incomplete_screenings.length === 0 ? (
            <div className="p-6 text-center text-[#64748B]">
              <p className="text-sm font-medium">All applicants have completed screening.</p>
            </div>
          ) : (
            incomplete_screenings.map((applicant) => (
              <div key={applicant.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#F59E0B]/10 flex items-center justify-center font-bold text-[#F59E0B] text-sm">
                    {applicant.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .substring(0, 2)}
                  </div>
                  <div>
                    <p className="font-bold text-[#0F172A]">{applicant.name}</p>
                    <p className="text-xs text-[#64748B]">{applicant.id} â€¢ Needs exam scoring</p>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate('screening')}
                  className="px-4 py-2 bg-[#0EA5E9] text-white text-xs font-bold rounded-lg hover:bg-[#0284C7]"
                >
                  Complete Screening
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Management Activity Feed */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-[#0EA5E9]" />
          <h3 className="font-black text-[#0F172A] text-sm uppercase tracking-wider">Recent Management Activity</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {management_activity.length === 0 ? (
            <div className="p-6 text-center text-[#64748B]">
              <p className="text-sm font-medium">No recent management activity.</p>
            </div>
          ) : (
            management_activity.map((log) => (
              <div key={log.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      log.action.includes('Approved') || log.action.includes('Accept')
                        ? 'bg-[#10B981]/10 text-[#10B981]'
                        : 'bg-[#EF4444]/10 text-[#EF4444]'
                    }`}
                  >
                    {log.action.includes('Approved') || log.action.includes('Accept') ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-[#0F172A]">{log.action}</p>
                    <p className="text-sm text-[#64748B] mt-1">{log.details}</p>
                    <p className="text-xs text-[#64748B] mt-1">
                      {log.performed_by} â€¢ {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
