import { useState } from 'react';
import {
  Building2, BarChart3, ScrollText, UserPlus, LogOut, Search, Shield, Globe,
  Users, Activity, CheckCircle2, AlertTriangle, Clock, ArrowRight, Layers,
  Check, RefreshCw, Lock,
} from 'lucide-react';

const INITIAL_TENANTS = [
  { id: 'TNT-001', agencyName: 'Makati Global Placement Inc.', licenseNo: 'POEA-026-LB-042026-R', gmName: 'Atty. Ramon Villanueva', email: 'gm@makatiglobal.com', workspaceUrl: 'makatiglobal.flowsensus.com', status: 'active', onboardedDate: 'Jan 15, 2026', lastActive: '2 hours ago', totalUsers: 12, totalApplicants: 89 },
  { id: 'TNT-002', agencyName: 'Allied Manpower Services', licenseNo: 'POEA-031-LB-032025-R', gmName: 'Ms. Cynthia Aquino', email: 'caquino@alliedmanpower.ph', workspaceUrl: 'alliedmanpower.flowsensus.com', status: 'active', onboardedDate: 'Feb 3, 2026', lastActive: '1 day ago', totalUsers: 8, totalApplicants: 54 },
  { id: 'TNT-003', agencyName: 'Pacific OFW Recruitment Corp.', licenseNo: 'POEA-018-LB-112024-R', gmName: 'Mr. Jose dela Pena', email: 'jose.delapena@pacificofw.com', workspaceUrl: 'pacificofw.flowsensus.com', status: 'pending', onboardedDate: 'Aug 28, 2026', lastActive: 'Never', totalUsers: 0, totalApplicants: 0 },
  { id: 'TNT-004', agencyName: 'Maynila Overseas Corporation', licenseNo: 'POEA-009-LB-062023-R', gmName: 'Engr. Ricardo Santos', email: 'rsantos@maynilaoverseas.ph', workspaceUrl: 'maynilaoverseas.flowsensus.com', status: 'active', onboardedDate: 'Nov 20, 2025', lastActive: '3 hours ago', totalUsers: 21, totalApplicants: 167 },
  { id: 'TNT-005', agencyName: 'Sunrise Placement Agency', licenseNo: 'POEA-042-LB-082022-R', gmName: 'Mrs. Lourdes Reyes', email: 'lreyes@sunriseplacement.com', workspaceUrl: 'sunriseplacement.flowsensus.com', status: 'suspended', onboardedDate: 'Mar 8, 2025', lastActive: '14 days ago', totalUsers: 5, totalApplicants: 31 },
  { id: 'TNT-006', agencyName: 'Visayas Manpower Solutions', licenseNo: 'POEA-055-LB-012026-R', gmName: 'Mr. Bernardo Abaya', email: 'babaya@visayasmanpower.ph', workspaceUrl: 'visayasmanpower.flowsensus.com', status: 'pending', onboardedDate: 'Sep 1, 2026', lastActive: 'Never', totalUsers: 0, totalApplicants: 0 },
  { id: 'TNT-007', agencyName: 'Metro Global Hiring & Services', licenseNo: 'POEA-027-LB-052024-R', gmName: 'Dr. Ana Maria Corpuz', email: 'amcorpuz@metroglobal.com', workspaceUrl: 'metroglobal.flowsensus.com', status: 'active', onboardedDate: 'Jun 12, 2025', lastActive: '5 hours ago', totalUsers: 15, totalApplicants: 112 },
  { id: 'TNT-008', agencyName: 'Island Link Recruitment Partners', licenseNo: 'POEA-039-LB-092021-R', gmName: 'Mr. Frederico Lim', email: 'flim@islandlink.ph', workspaceUrl: 'islandlink.flowsensus.com', status: 'suspended', onboardedDate: 'May 5, 2024', lastActive: '32 days ago', totalUsers: 3, totalApplicants: 28 },
];

const AUDIT_LOG = [
  { id: 'AUD-0892', timestamp: '2026-09-04 08:42:11', action: 'Workspace Status Updated', performedBy: 'superadmin@flowsensus.com', target: 'TNT-005 — Sunrise Placement Agency', ipAddress: '203.177.x.x', status: 'warning' },
  { id: 'AUD-0891', timestamp: '2026-09-04 07:15:30', action: 'New Tenant Provisioned', performedBy: 'superadmin@flowsensus.com', target: 'TNT-006 — Visayas Manpower Solutions', ipAddress: '203.177.x.x', status: 'success' },
  { id: 'AUD-0890', timestamp: '2026-09-03 21:08:55', action: 'SuperAdmin Login', performedBy: 'superadmin@flowsensus.com', target: 'System Console', ipAddress: '203.177.x.x', status: 'success' },
  { id: 'AUD-0889', timestamp: '2026-09-03 14:22:01', action: 'Tenant Suspended', performedBy: 'superadmin@flowsensus.com', target: 'TNT-008 — Island Link Recruitment Partners', ipAddress: '203.177.x.x', status: 'warning' },
  { id: 'AUD-0888', timestamp: '2026-09-03 11:30:45', action: 'B2B Inquiry Submitted', performedBy: 'babaya@visayasmanpower.ph', target: 'Inquiry — Visayas Manpower Solutions', ipAddress: '120.28.x.x', status: 'success' },
  { id: 'AUD-0887', timestamp: '2026-09-02 16:55:12', action: 'New Tenant Provisioned', performedBy: 'superadmin@flowsensus.com', target: 'TNT-003 — Pacific OFW Recruitment Corp.', ipAddress: '203.177.x.x', status: 'success' },
  { id: 'AUD-0886', timestamp: '2026-09-02 10:11:08', action: 'Login Attempt Failed', performedBy: 'unknown@external.com', target: 'SuperAdmin Console', ipAddress: '91.108.x.x', status: 'error' },
  { id: 'AUD-0885', timestamp: '2026-09-01 09:00:00', action: 'Automated System Health Check', performedBy: 'System', target: 'All Tenant Workspaces', ipAddress: 'Internal', status: 'success' },
];

const STATUS_CFG = {
  active:    { label: 'Active',           color: '#10B981', bg: '#ECFDF5' },
  pending:   { label: 'Pending Approval', color: '#F59E0B', bg: '#FFFBEB' },
  suspended: { label: 'Suspended',        color: '#EF4444', bg: '#FEF2F2' },
};

const AUDIT_CFG = {
  success: { color: '#10B981', bg: '#ECFDF5', label: 'Success' },
  warning: { color: '#F59E0B', bg: '#FFFBEB', label: 'Warning' },
  error:   { color: '#EF4444', bg: '#FEF2F2', label: 'Failed'  },
};

function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'agency-name';
}

export default function SuperAdminDashboard({ onLogout }) {
  const [view, setView] = useState('overview');
  const [tenants, setTenants] = useState(INITIAL_TENANTS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState({ agencyName: '', licenseNo: '', gmName: '', email: '', slug: '' });
  const [formDone, setFormDone] = useState(false);

  const metrics = {
    total: tenants.length,
    active: tenants.filter(t => t.status === 'active').length,
    pending: tenants.filter(t => t.status === 'pending').length,
    suspended: tenants.filter(t => t.status === 'suspended').length,
    users: tenants.reduce((a, t) => a + t.totalUsers, 0),
    applicants: tenants.reduce((a, t) => a + t.totalApplicants, 0),
  };

  const filtered = tenants.filter(t => {
    const q = search.toLowerCase();
    return (q === '' || t.agencyName.toLowerCase().includes(q) || t.licenseNo.toLowerCase().includes(q))
      && (statusFilter === 'all' || t.status === statusFilter);
  });

  const NAV = [
    { key: 'overview', label: 'Overview', icon: <BarChart3 size={17} /> },
    { key: 'tenants', label: 'Tenant Management', icon: <Building2 size={17} /> },
    { key: 'onboarding', label: 'Agency Onboarding', icon: <UserPlus size={17} /> },
    { key: 'audit', label: 'Audit Ledger', icon: <ScrollText size={17} /> },
  ];

  const TITLES = {
    overview: 'Platform Overview', tenants: 'Tenant Management',
    onboarding: 'Agency Onboarding', audit: 'Super Admin Audit Ledger',
  };

  return (
    <div className="flex h-screen bg-[#060F1C] font-['Inter',sans-serif] overflow-hidden">

      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-[#0B1628] border-r border-white/5 flex flex-col">
        <div className="px-5 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#6366F1] flex items-center justify-center shadow">
              <Layers size={15} className="text-white" />
            </div>
            <span className="text-white font-black text-sm tracking-tight">Flow<span className="text-[#818CF8]">Sensus</span></span>
          </div>
          <div className="inline-flex items-center gap-1.5 bg-[#6366F1]/20 border border-[#6366F1]/30 rounded-full px-2.5 py-1">
            <Shield size={10} className="text-[#818CF8]" />
            <span className="text-[#818CF8] text-[10px] font-bold tracking-widest uppercase">SuperAdmin Console</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(item => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                view === item.key ? 'bg-[#6366F1] text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-[#6366F1]/30 flex items-center justify-center flex-shrink-0">
              <Shield size={13} className="text-[#818CF8]" />
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate">Super Admin</p>
              <p className="text-slate-500 text-[10px] truncate">superadmin@flowsensus.com</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-[#0B1628] border-b border-white/5 flex items-center justify-between px-6 flex-shrink-0">
          <div>
            <h1 className="text-white font-bold text-[15px]">{TITLES[view]}</h1>
            <p className="text-slate-500 text-[11px]">FlowSensus Platform · Sep 4, 2026 — 09:00 PHT</p>
          </div>
          <div className="flex items-center gap-2 bg-[#10B981]/10 border border-[#10B981]/20 rounded-full px-3 py-1.5">
            <Activity size={11} className="text-[#10B981]" />
            <span className="text-[#10B981] text-[11px] font-semibold">All Systems Operational · 99.7% uptime</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">

          {/* ── Overview ─────────────────────────────────────────── */}
          {view === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: 'Total Agencies',    value: metrics.total,      icon: <Building2 size={17} />,    color: '#6366F1', sub: 'Onboarded tenants' },
                  { label: 'Active Workspaces', value: metrics.active,     icon: <CheckCircle2 size={17} />, color: '#10B981', sub: 'Fully operational' },
                  { label: 'Pending Approval',  value: metrics.pending,    icon: <Clock size={17} />,        color: '#F59E0B', sub: 'Awaiting verification' },
                  { label: 'Suspended',         value: metrics.suspended,  icon: <AlertTriangle size={17} />,color: '#EF4444', sub: 'Access restricted' },
                  { label: 'Total Staff Users', value: metrics.users,      icon: <Users size={17} />,        color: '#8B5CF6', sub: 'Across all tenants' },
                  { label: 'Total Applicants',  value: metrics.applicants, icon: <Globe size={17} />,        color: '#0EA5E9', sub: 'System-wide profiles' },
                ].map(m => (
                  <div key={m.label} className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-slate-500 text-xs font-medium">{m.label}</p>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: m.color + '18', color: m.color }}>{m.icon}</div>
                    </div>
                    <p className="text-3xl font-black text-[#0F172A]">{m.value}</p>
                    <p className="text-slate-400 text-xs mt-1">{m.sub}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-[#0F172A] text-sm mb-4">Workspace Status Breakdown</h3>
                <div className="space-y-3">
                  {(['active', 'pending', 'suspended']).map(s => {
                    const cfg = STATUS_CFG[s];
                    const count = tenants.filter(t => t.status === s).length;
                    const pct = metrics.total > 0 ? (count / metrics.total) * 100 : 0;
                    return (
                      <div key={s} className="flex items-center gap-4">
                        <div className="w-32 flex-shrink-0 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                          <span className="text-xs text-slate-500 font-medium">{cfg.label}</span>
                        </div>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cfg.color }} />
                        </div>
                        <span className="text-sm font-bold text-[#0F172A] w-4 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-[#0F172A] text-sm">Recent System Activity</h3>
                  <button onClick={() => setView('audit')} className="text-[#6366F1] text-xs font-semibold hover:underline">View full audit log →</button>
                </div>
                <div className="space-y-3">
                  {AUDIT_LOG.slice(0, 5).map(e => {
                    const cfg = AUDIT_CFG[e.status];
                    return (
                      <div key={e.id} className="flex items-center gap-3">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                        <span className="text-slate-600 text-sm flex-1 truncate">{e.action}</span>
                        <span className="text-slate-400 text-xs flex-shrink-0 font-['JetBrains_Mono',monospace]">{e.timestamp.split(' ')[1]}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Tenant Management ─────────────────────────────── */}
          {view === 'tenants' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search by agency name or license number..."
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all"
                  />
                </div>
                <select
                  value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  className="px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6366F1] transition-all"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending Approval</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-slate-100">
                        {['Agency', 'License No.', 'Workspace URL', 'Status', 'Onboarded', 'Last Active', 'Update Status'].map(h => (
                          <th key={h} className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filtered.map(t => {
                        const cfg = STATUS_CFG[t.status];
                        return (
                          <tr key={t.id} className="hover:bg-[#F8FAFC] transition-colors">
                            <td className="px-5 py-3.5 max-w-[200px]">
                              <p className="font-semibold text-[#0F172A] text-sm truncate">{t.agencyName}</p>
                              <p className="text-slate-400 text-[11px] mt-0.5">{t.id} · {t.totalUsers} users · {t.totalApplicants} applicants</p>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="font-['JetBrains_Mono',monospace] text-xs text-slate-600 whitespace-nowrap">{t.licenseNo}</span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="font-['JetBrains_Mono',monospace] text-xs text-[#6366F1]">{t.workspaceUrl}</span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap" style={{ color: cfg.color, background: cfg.bg }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">{t.onboardedDate}</td>
                            <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">{t.lastActive}</td>
                            <td className="px-5 py-3.5">
                              <select
                                value={t.status}
                                onChange={e => setTenants(prev => prev.map(x => x.id === t.id ? { ...x, status: e.target.value} : x))}
                                className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-[#6366F1] bg-white cursor-pointer"
                              >
                                <option value="active">Set Active</option>
                                <option value="pending">Set Pending</option>
                                <option value="suspended">Set Suspended</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-slate-100 bg-[#F8FAFC] text-xs text-slate-400">
                  Showing {filtered.length} of {tenants.length} tenants
                </div>
              </div>
            </div>
          )}

          {/* ── Agency Onboarding ─────────────────────────────── */}
          {view === 'onboarding' && (
            <div className="grid lg:grid-cols-2 gap-6">
              {!formDone ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <h3 className="font-bold text-[#0F172A] text-base mb-1">Provision New Tenant Workspace</h3>
                  <p className="text-slate-500 text-xs mb-6">Creates a new agency workspace on the FlowSensus platform. Verify all details before provisioning.</p>
                  <form onSubmit={e => { e.preventDefault(); setFormDone(true); }} className="space-y-4">
                    {[
                      { key: 'agencyName', label: 'Agency Name', placeholder: 'Registered agency name' },
                      { key: 'licenseNo',  label: 'POEA / DMW License No.', placeholder: 'POEA-000-LB-MMYYYY-R' },
                      { key: 'gmName',     label: "General Manager's Name", placeholder: 'Full name of authorized GM' },
                      { key: 'email',      label: 'Corporate Email Address', placeholder: 'gm@youragency.ph' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">{f.label} <span className="text-red-400 normal-case">*</span></label>
                        <input
                          type={f.key === 'email' ? 'email' : 'text'}
                          value={(form)[f.key]}
                          onChange={e => setForm(p => ({
                            ...p,
                            [f.key]: e.target.value,
                            ...(f.key === 'agencyName' ? { slug: toSlug(e.target.value) } : {}),
                          }))}
                          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all"
                          placeholder={f.placeholder}
                          required
                        />
                      </div>
                    ))}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Workspace URL <span className="text-red-400 normal-case">*</span></label>
                      <div className="flex rounded-lg border border-slate-200 overflow-hidden focus-within:border-[#6366F1] focus-within:ring-2 focus-within:ring-[#6366F1]/20 transition-all">
                        <input
                          type="text" value={form.slug}
                          onChange={e => setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                          className="flex-1 px-3.5 py-2.5 text-sm focus:outline-none font-['JetBrains_Mono',monospace] bg-white"
                          placeholder="agency-name" required
                        />
                        <span className="bg-slate-50 border-l border-slate-200 px-3.5 py-2.5 text-slate-400 text-xs font-['JetBrains_Mono',monospace] flex items-center whitespace-nowrap">.flowsensus.com</span>
                      </div>
                      {form.slug && (
                        <p className="text-[#6366F1] text-xs mt-1.5 font-['JetBrains_Mono',monospace]">↳ {form.slug}.flowsensus.com</p>
                      )}
                    </div>
                    <button type="submit" className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                      Provision Workspace <ArrowRight size={16} />
                    </button>
                  </form>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col items-center justify-center text-center min-h-[400px]">
                  <div className="w-16 h-16 rounded-full bg-[#10B981]/10 flex items-center justify-center mb-4">
                    <CheckCircle2 size={32} className="text-[#10B981]" />
                  </div>
                  <h3 className="font-bold text-[#0F172A] text-lg mb-2">Workspace Provisioned</h3>
                  <p className="text-slate-500 text-sm mb-5 leading-relaxed max-w-xs">
                    The workspace for <strong className="text-[#0F172A]">{form.agencyName}</strong> has been created.
                    Credentials will be sent to <strong className="text-[#0F172A]">{form.email}</strong>.
                  </p>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-left w-full text-xs space-y-2 mb-5 font-['JetBrains_Mono',monospace]">
                    <div className="flex justify-between gap-4"><span className="text-slate-400">License:</span><span className="text-[#0F172A]">{form.licenseNo}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-slate-400">URL:</span><span className="text-[#6366F1]">{form.slug}.flowsensus.com</span></div>
                  </div>
                  <button onClick={() => { setForm({ agencyName: '', licenseNo: '', gmName: '', email: '', slug: '' }); setFormDone(false); }} className="text-sm text-[#6366F1] font-semibold hover:underline">
                    Provision another workspace →
                  </button>
                </div>
              )}

              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <h4 className="font-bold text-[#0F172A] text-sm mb-4">Before provisioning, verify:</h4>
                  <ul className="space-y-3">
                    {[
                      'Agency holds a valid, non-expired POEA/DMW license',
                      'B2B inquiry form has been submitted and reviewed',
                      "General Manager's identity and corporate email confirmed",
                      'No existing workspace exists for this license number',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                        <Check size={14} className="text-[#6366F1] flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-[#0B1628] rounded-xl p-5 border border-white/5">
                  <p className="text-[#818CF8] text-[10px] font-bold uppercase tracking-widest mb-3">What happens on provision</p>
                  <div className="space-y-3">
                    {[
                      { step: '01', text: 'Workspace ID generated and isolated database schema created' },
                      { step: '02', text: 'Subdomain registered and tenant routing configured' },
                      { step: '03', text: 'Admin account created and credentials emailed to GM' },
                      { step: '04', text: 'Tenant appears in Tenant Management' },
                    ].map(s => (
                      <div key={s.step} className="flex items-start gap-3">
                        <span className="font-['JetBrains_Mono',monospace] text-[#6366F1] font-bold text-xs flex-shrink-0 mt-px">{s.step}</span>
                        <p className="text-slate-400 text-xs leading-snug">{s.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Audit Ledger ──────────────────────────────────── */}
          {view === 'audit' && (
            <div className="space-y-4">
              <div className="flex gap-3 items-center">
                <div className="relative flex-1 max-w-sm">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Search audit log..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6366F1] transition-all" />
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-500 font-medium whitespace-nowrap">
                  <RefreshCw size={13} /> Read-Only
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-slate-100">
                        {['ID', 'Timestamp', 'Action', 'Performed By', 'Target', 'IP Address', 'Status'].map(h => (
                          <th key={h} className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {AUDIT_LOG.map(e => {
                        const cfg = AUDIT_CFG[e.status];
                        return (
                          <tr key={e.id} className="hover:bg-[#F8FAFC] transition-colors">
                            <td className="px-5 py-3.5"><span className="font-['JetBrains_Mono',monospace] text-xs text-[#6366F1]">{e.id}</span></td>
                            <td className="px-5 py-3.5 whitespace-nowrap"><span className="font-['JetBrains_Mono',monospace] text-xs text-slate-500">{e.timestamp}</span></td>
                            <td className="px-5 py-3.5 whitespace-nowrap"><span className="text-sm font-medium text-[#0F172A]">{e.action}</span></td>
                            <td className="px-5 py-3.5"><span className="text-xs text-slate-600">{e.performedBy}</span></td>
                            <td className="px-5 py-3.5 max-w-[180px]"><span className="text-xs text-slate-500 block truncate">{e.target}</span></td>
                            <td className="px-5 py-3.5"><span className="font-['JetBrains_Mono',monospace] text-xs text-slate-400">{e.ipAddress}</span></td>
                            <td className="px-5 py-3.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-slate-100 bg-[#F8FAFC] flex items-center justify-between text-xs text-slate-400">
                  <span>{AUDIT_LOG.length} entries — tamper-proof audit record</span>
                  <span className="flex items-center gap-1.5 text-[#6366F1] font-semibold"><Lock size={11} /> Immutable Log</span>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

