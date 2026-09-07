import { AlertTriangle, Clock, FileCheck, TrendingUp, BarChart3, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ManagerDashboard({ applicants = [], onViewApplicant }) {
  const navigate = useNavigate();
  const viewApplicant = (id) => {
    if (!id) return;
    if (onViewApplicant) onViewApplicant(id);
    else navigate(`/manager/applicant-profile/${encodeURIComponent(id)}`);
  };
  const pending_approvals = applicants.filter((a) => a.phase === 3 && a.status === 'Pending Manager Approval');

  // Calculate performance metrics
  const total_active = applicants?.length;
  const avg_phase = total_active > 0 ? (applicants.reduce((sum, a) => sum + a.phase, 0) / total_active).toFixed(1) : '0.0';
  const deployment_ready = applicants?.filter((a) => a.phase === 5)?.length;
  const conversion_rate = total_active > 0 ? ((deployment_ready / total_active) * 100).toFixed(0) : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold tracking-tight text-[#0F172A]">Management Command Center</h2>
        <p className="text-sm text-[#64748B] mt-1 font-medium">
          Executive oversight, approvals, and strategic performance monitoring
        </p>
      </div>

      {/* Escalation & SLA Breach Alerts (Highest Priority) */}
      <div className="bg-white rounded-lg shadow-lg border-2 border-[#EF4444]/30">
        <div className="px-6 py-4 border-b border-slate-200 bg-[#EF4444]/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-[#EF4444]" />
            <h3 className="font-black text-[#0F172A] text-lg">Escalation & SLA Breach Alerts</h3>
          </div>
          <span className="px-3 py-1 bg-slate-100 text-[#64748B] text-xs font-bold rounded-full">
            Not available
          </span>
        </div>
        <div className="p-6 text-center text-[#64748B]">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium">SLA assessment is not available.</p>
        </div>
      </div>

      {/* Agency Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border-l-4 border-l-[#0EA5E9] shadow-sm">
          <p className="text-sm font-bold text-[#64748B] uppercase tracking-wider">Total Active Pipeline</p>
          <p className="text-4xl font-black text-[#0F172A] mt-2">{total_active}</p>
          <p className="text-xs text-[#64748B] mt-1">Applicants in system</p>
        </div>
        <div className="bg-white p-6 rounded-lg border-l-4 border-l-[#10B981] shadow-sm">
          <p className="text-sm font-bold text-[#64748B] uppercase tracking-wider">Deployment Ready</p>
          <p className="text-4xl font-black text-[#0F172A] mt-2">{deployment_ready}</p>
          <p className="text-xs text-[#64748B] mt-1">Phase 5 applicants</p>
        </div>
        <div className="bg-white p-6 rounded-lg border-l-4 border-l-[#8B5CF6] shadow-sm">
          <p className="text-sm font-bold text-[#64748B] uppercase tracking-wider">Avg. Pipeline Phase</p>
          <p className="text-4xl font-black text-[#0F172A] mt-2">{avg_phase}</p>
          <p className="text-xs text-[#64748B] mt-1">Pipeline velocity</p>
        </div>
        <div className="bg-white p-6 rounded-lg border-l-4 border-l-[#F59E0B] shadow-sm">
          <p className="text-sm font-bold text-[#64748B] uppercase tracking-wider">Conversion Rate</p>
          <p className="text-4xl font-black text-[#0F172A] mt-2">{conversion_rate}%</p>
          <p className="text-xs text-[#64748B] mt-1">Intake → Deployment</p>
        </div>
      </div>

      {/* Manager Approval Inbox */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 bg-[#0EA5E9]/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-[#0EA5E9]" />
            <h3 className="font-black text-[#0F172A] text-sm uppercase tracking-wider">Manager Approval Inbox</h3>
          </div>
          <span className="px-3 py-1 bg-[#0EA5E9] text-white text-xs font-bold rounded-full">
            {pending_approvals?.length} Pending
          </span>
        </div>
        <div className="divide-y divide-slate-100">
          {pending_approvals?.length === 0 ? (
            <div className="p-6 text-center text-[#64748B]">
              <p className="text-sm font-medium">No CVs awaiting approval.</p>
            </div>
          ) : (
            pending_approvals?.map((applicant) => (
              <div
                key={applicant.id}
                className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#0EA5E9]/10 flex items-center justify-center font-bold text-[#0EA5E9] text-sm">
                    {applicant.name
                      .split(' ')
                      ?.map((n) => n[0])
                      .join('')
                      .substring(0, 2)}
                  </div>
                  <div>
                    <p className="font-bold text-[#0F172A]">{applicant.name}</p>
                    <p className="text-xs text-[#64748B]">
                      {applicant.id} • {applicant.role} • CV awaiting quality control
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-xs text-[#64748B]">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {applicant.lastUpdated}
                  </div>
                  {applicant.id && (
                    <button onClick={() => viewApplicant(applicant.id)} className="px-4 py-2 bg-white border-2 border-slate-200 text-[#0F172A] text-xs font-bold rounded-lg hover:bg-slate-50">
                      View Details
                    </button>
                  )}
                  <button
                    disabled
          title="CV review is not available yet"
                    className="px-4 py-2 bg-[#0EA5E9] text-white text-xs font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Review CV
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Predictive Timeline Overview (7-14 Day Forecast) */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 bg-[#F59E0B]/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#F59E0B]" />
            <h3 className="font-black text-[#0F172A] text-sm uppercase tracking-wider">
              Predictive Timeline Overview (7-14 Day Forecast)
            </h3>
          </div>
          <button
            onClick={() => navigate('/manager/predictive-timeline')}
            className="text-xs font-bold text-[#0EA5E9] hover:underline"
          >
            View Full Timeline →
          </button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Near-Deployment Applicants */}
            <div className="bg-emerald-50/50 rounded-lg p-4 border border-emerald-200">
              <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">7-Day Window</p>
              <p className="text-2xl font-black text-[#10B981]">—</p>
              <p className="text-xs text-[#64748B] mt-1">Not available</p>
            </div>

            {/* Mid-Range Forecast */}
            <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-200">
              <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">8-14 Day Window</p>
              <p className="text-2xl font-black text-[#0EA5E9]">—</p>
              <p className="text-xs text-[#64748B] mt-1">Not available</p>
            </div>

            {/* Algorithm Confidence */}
            <div className="bg-purple-50/50 rounded-lg p-4 border border-purple-200">
              <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Algorithm Confidence</p>
              <p className="text-2xl font-black text-[#8B5CF6]">—</p>
              <p className="text-xs text-[#64748B] mt-1">Not available</p>
            </div>
          </div>

          {/* Quick List of Near-Deployment Applicants */}
          <div className="mt-6">
            <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3">Next Expected Departures:</p>
            <div className="space-y-2">
              <p className="text-sm text-[#64748B]">Departure forecasts are not available.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('/manager/operational-reports')}
          className="p-4 bg-white border-2 border-slate-200 rounded-lg hover:border-[#0EA5E9] hover:bg-slate-50 transition-all text-left"
        >
          <BarChart3 className="w-6 h-6 text-[#0EA5E9] mb-2" />
          <p className="font-bold text-[#0F172A] text-sm">Operational Reports</p>
          <p className="text-xs text-[#64748B] mt-1">Department analytics & insights</p>
        </button>
        <button
          onClick={() => navigate('/manager/deployment-history')}
          className="p-4 bg-white border-2 border-slate-200 rounded-lg hover:border-[#10B981] hover:bg-slate-50 transition-all text-left"
        >
          <CheckCircle className="w-6 h-6 text-[#10B981] mb-2" />
          <p className="font-bold text-[#0F172A] text-sm">Deployment History</p>
          <p className="text-xs text-[#64748B] mt-1">Completed deployments archive</p>
        </button>
        <button
          disabled
          title="CV review is not available yet"
          className="p-4 bg-white border-2 border-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-left"
        >
          <FileCheck className="w-6 h-6 text-[#F59E0B] mb-2" />
          <p className="font-bold text-[#0F172A] text-sm">CV & Employer Hub</p>
          <p className="text-xs text-[#64748B] mt-1">Approve CVs & record acceptances</p>
        </button>
      </div>
    </div>
  );
}

