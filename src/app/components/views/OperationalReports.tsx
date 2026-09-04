import { Download, FileText, TrendingUp, Users, DollarSign } from 'lucide-react';
import { ApplicantRecord, ActivityLog, ExpenseRecord } from '../../types';

interface OperationalReportsProps {
  applicants?: ApplicantRecord[];
  activityLogs?: ActivityLog[];
  expenses?: ExpenseRecord[];
}

export default function OperationalReports({ applicants = [], activityLogs = [], expenses = [] }: OperationalReportsProps) {
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const avgTimePerPhase = 5.2; // days - would be calculated from real data

  const reports = [
    {
      title: 'Monthly Deployment Report',
      description: 'Comprehensive overview of all deployment activities for the current month',
      icon: FileText,
      data: `${applicants.length} applicants processed`,
    },
    {
      title: 'Staff Performance Analysis',
      description: 'Individual staff productivity and handling time metrics',
      icon: Users,
      data: `${activityLogs.filter((log) => !log.action.includes('Login')).length} activities logged`,
    },
    {
      title: 'Financial Summary',
      description: 'Breakdown of deployment expenses by category and applicant',
      icon: DollarSign,
      data: `₱${totalExpenses.toLocaleString()} total expenses`,
    },
    {
      title: 'Workflow Efficiency Report',
      description: 'Average processing time per phase and bottleneck identification',
      icon: TrendingUp,
      data: `${avgTimePerPhase} days avg per phase`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold tracking-tight text-[#0F172A]">Operational Reports</h2>
        <p className="text-sm text-[#64748B] mt-1 font-medium">
          Generate and download comprehensive operational reports
        </p>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map((report, index) => {
          const Icon = report.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-[#0EA5E9]/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6 text-[#0EA5E9]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-[#0F172A] mb-1">{report.title}</h3>
                  <p className="text-sm text-[#64748B] mb-3">{report.description}</p>
                  <p className="text-xs font-bold text-[#0EA5E9] mb-4">{report.data}</p>
                  <button className="px-4 py-2 bg-[#0EA5E9] text-white text-sm font-bold rounded-lg hover:bg-[#0284C7] flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Generate Report
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="font-black text-[#0F172A] text-sm uppercase tracking-wider mb-4">Quick Statistics</h3>
        <div className="grid grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-[#64748B] font-bold uppercase mb-1">Total Applicants</p>
            <p className="text-3xl font-black text-[#0F172A]">{applicants.length}</p>
          </div>
          <div>
            <p className="text-xs text-[#64748B] font-bold uppercase mb-1">Activities Logged</p>
            <p className="text-3xl font-black text-[#0F172A]">{activityLogs.length}</p>
          </div>
          <div>
            <p className="text-xs text-[#64748B] font-bold uppercase mb-1">Total Expenses</p>
            <p className="text-3xl font-black text-[#0F172A]">₱{(totalExpenses / 1000).toFixed(0)}K</p>
          </div>
          <div>
            <p className="text-xs text-[#64748B] font-bold uppercase mb-1">Avg Processing Time</p>
            <p className="text-3xl font-black text-[#0F172A]">{avgTimePerPhase}d</p>
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="font-black text-[#0F172A] text-sm uppercase tracking-wider mb-4">Export All Data</h3>
        <div className="flex gap-4">
          <button className="px-6 py-3 bg-[#0F172A] text-white text-sm font-bold rounded-lg hover:bg-[#1E293B] flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export as PDF
          </button>
          <button className="px-6 py-3 bg-[#10B981] text-white text-sm font-bold rounded-lg hover:bg-[#059669] flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export as Excel
          </button>
          <button className="px-6 py-3 bg-white border-2 border-[#0EA5E9] text-[#0EA5E9] text-sm font-bold rounded-lg hover:bg-[#0EA5E9] hover:text-white transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export as CSV
          </button>
        </div>
      </div>
    </div>
  );
}
