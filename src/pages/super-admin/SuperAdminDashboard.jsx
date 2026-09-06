  import { Globe, Users, Activity, Clock, Layers, Check, ArrowRight } from 'lucide-react';

  const INITIAL_TENANTS = [
    { id: 'TNT-001', agencyName: 'Makati Global Placement Inc.', licenseNo: 'POEA-026-LB-042026-R', gmName: 'Atty. Ramon Villanueva', email: 'gm@makatiglobal.com', workspaceUrl:
    'makatiglobal.flowsensus.com', status: 'active', onboardedDate: 'Jan 15, 2026', lastActive: '2 hours ago', totalUsers: 12, totalApplicants: 89 },
    { id: 'TNT-002', agencyName: 'Allied Manpower Services', licenseNo: 'POEA-031-LB-032025-R', gmName: 'Ms. Cynthia Aquino', email: 'caquino@alliedmanpower.ph', workspaceUrl:
    'alliedmanpower.flowsensus.com', status: 'active', onboardedDate: 'Feb 3, 2026', lastActive: '1 day ago', totalUsers: 8, totalApplicants: 54 },
    { id: 'TNT-003', agencyName: 'Pacific OFW Recruitment Corp.', licenseNo: 'POEA-018-LB-112024-R', gmName: 'Mr. Jose dela Pena', email: 'jose.delapena@pacificofw.com', workspaceUrl:
    'pacificofw.flowsensus.com', status: 'pending', onboardedDate: 'Aug 28, 2026', lastActive: 'Never', totalUsers: 0, totalApplicants: 0 },
    { id: 'TNT-004', agencyName: 'Maynila Overseas Corporation', licenseNo: 'POEA-009-LB-062023-R', gmName: 'Engr. Ricardo Santos', email: 'rsantos@maynilaoverseas.ph', workspaceUrl:
    'maynilaoverseas.flowsensus.com', status: 'active', onboardedDate: 'Nov 20, 2025', lastActive: '3 hours ago', totalUsers: 21, totalApplicants: 167 },
    { id: 'TNT-005', agencyName: 'Sunrise Placement Agency', licenseNo: 'POEA-042-LB-082022-R', gmName: 'Mrs. Lourdes Reyes', email: 'lreyes@sunriseplacement.com', workspaceUrl:
    'sunriseplacement.flowsensus.com', status: 'suspended', onboardedDate: 'Mar 8, 2025', lastActive: '14 days ago', totalUsers: 5, totalApplicants: 31 },
    { id: 'TNT-006', agencyName: 'Visayas Manpower Solutions', licenseNo: 'POEA-055-LB-012026-R', gmName: 'Mr. Bernardo Abaya', email: 'babaya@visayasmanpower.ph', workspaceUrl:
    'visayasmanpower.flowsensus.com', status: 'pending', onboardedDate: 'Sep 1, 2026', lastActive: 'Never', totalUsers: 0, totalApplicants: 0 },
    { id: 'TNT-007', agencyName: 'Metro Global Hiring & Services', licenseNo: 'POEA-027-LB-052024-R', gmName: 'Dr. Ana Maria Corpuz', email: 'amcorpuz@metroglobal.com', workspaceUrl:
    'metroglobal.flowsensus.com', status: 'active', onboardedDate: 'Jun 12, 2025', lastActive: '5 hours ago', totalUsers: 15, totalApplicants: 112 },
    { id: 'TNT-008', agencyName: 'Island Link Recruitment Partners', licenseNo: 'POEA-039-LB-092021-R', gmName: 'Mr. Frederico Lim', email: 'flim@islandlink.ph', workspaceUrl:
    'islandlink.flowsensus.com', status: 'suspended', onboardedDate: 'May 5, 2024', lastActive: '32 days ago', totalUsers: 3, totalApplicants: 28 },
  ];

  const METRICS = [
    { title: 'Total Workspaces', value: 8, delta: '+2 this month', icon: Globe, color: '#6366F1' },
    { title: 'Active Users', value: 64, delta: '+7 today', icon: Users, color: '#0EA5E9' },
    { title: 'System Health', value: '99.92%', delta: 'All services operational', icon: Activity, color: '#10B981' },
    { title: 'Pending Approvals', value: 2, delta: 'Requires action', icon: Clock, color: '#F59E0B' },
  ];

  export default function SuperAdminDashboard() {
    return (
      <div className="w-full min-h-screen bg-[#0B1628]">
        <main className="p-6 lg:p-8 space-y-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">Platform Overview</h1>
            <p className="mt-1 text-sm text-slate-300">Monitor tenant workspaces, provisioning, and system-level activity.</p>
          </div>

          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {METRICS.map((metric) => {
              const Icon = metric.icon;
              return (
                <article key={metric.title} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{metric.title}</p>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${metric.color}1A` }}>
                      <Icon size={16} style={{ color: metric.color }} />
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-extrabold text-[#0F172A]">{metric.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{metric.delta}</p>
                </article>
              );
            })}
          </section>

          <section className="grid grid-cols-1 2xl:grid-cols-3 gap-5">
            <div className="2xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-bold text-[#0F172A] tracking-wide mb-2">Overview Snapshot</h2>
              <p className="text-xs text-slate-500">
                Use sidebar navigation for full pages: Tenant Management, Agency Onboarding, and Audit Ledger.
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Current registered workspaces: <span className="font-semibold text-slate-700">{INITIAL_TENANTS.length}</span>
              </p>
            </div>

            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h3 className="text-sm font-bold text-[#0F172A] mb-3">Quick Actions</h3>
                <div className="space-y-2.5">
                  {[{ label: 'Provision New Tenant', icon: Layers }, { label: 'Approve Pending Workspace', icon: Check }, { label: 'View Full Audit Trail', icon: ArrowRight }].map((a) =>
                  {
                    const Icon = a.icon;
                    return (
                      <div key={a.label} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span>{a.label}</span>
                        <Icon size={14} className="text-slate-400" />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }