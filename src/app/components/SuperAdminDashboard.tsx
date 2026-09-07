import { useState, useEffect } from 'react';
import {
  Building2, BarChart3, ScrollText, UserPlus, LogOut, Search, Shield,
  Users, CheckCircle2, AlertTriangle, Clock, ArrowRight, Layers,
  Check, RefreshCw, Crown, Briefcase, Settings, Receipt, User,
  Loader2,
} from 'lucide-react';
import { UserRole, ApplicantRecord, ActivityLog } from '../types';
import { api } from '../../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type AdminView = 'overview' | 'tenants' | 'onboarding' | 'audit';
type TenantStatus = 'active' | 'pending' | 'suspended';

interface Tenant {
  id: string; agencyName: string; licenseNo: string; gmName: string; email: string;
  workspaceUrl: string; status: TenantStatus; onboardedDate: string; lastActive: string;
  totalUsers: number; totalApplicants: number;
}

// Verified field names from GET /audit-logs AuditLogResponse schema
interface LiveAuditLog {
  audit_log_id: number | null;
  action: string;
  details: string;
  performed_by: string | null;
  department: string | null;
  created_at: string | null;
  applicant_id: number | string | null;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<TenantStatus, { label: string; color: string; bg: string }> = {
  active:    { label: 'Active',           color: '#10B981', bg: '#ECFDF5' },
  pending:   { label: 'Pending Approval', color: '#F59E0B', bg: '#FFFBEB' },
  suspended: { label: 'Suspended',        color: '#EF4444', bg: '#FEF2F2' },
};

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'agency-name';
}

function fmtTimestamp(raw: string | null): string {
  if (!raw) return '—';
  try {
    return new Date(raw).toLocaleString('en-PH', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return raw;
  }
}

function fmtTimeShort(raw: string | null): string {
  if (!raw) return '—';
  try {
    return new Date(raw).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return raw;
  }
}

// ─── Role-switch config ───────────────────────────────────────────────────────

interface RoleOption {
  role: UserRole;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const ROLE_OPTS: RoleOption[] = [
  { role: 'Management',  label: 'Management',      icon: Briefcase  },
  { role: 'Recruitment', label: 'Recruitment',      icon: Users      },
  { role: 'Admin',       label: 'Admin / Visa',     icon: Settings   },
  { role: 'Accounting',  label: 'Accounting',       icon: Receipt    },
  { role: 'Employer',    label: 'Employer Portal',  icon: Building2  },
  { role: 'Applicant',   label: 'Applicant Portal', icon: User       },
];

// ─── Props ───────────────────────────────────────────────────────────────────

interface SuperAdminDashboardProps {
  onLogout: () => void;
  onSwitchRole: (role: UserRole) => void;
  currentUserName?: string;
  // Verified live data passed from App.tsx state
  applicants: ApplicantRecord[];
  activityLogs: ActivityLog[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SuperAdminDashboard({
  onLogout,
  onSwitchRole,
  currentUserName,
  applicants,
  activityLogs,
}: SuperAdminDashboardProps) {
  const [view, setView] = useState<AdminView>('overview');

  // Tenant data — no list endpoint exists, stays empty
  const [tenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TenantStatus | 'all'>('all');

  // Staff users — fetched from verified GET /users
  const [staffCount, setStaffCount] = useState<number | null>(null);
  const [staffLoading, setStaffLoading] = useState(false);

  // Agency Onboarding form — UI only, no fake success state
  const [form, setForm] = useState({ agencyName: '', licenseNo: '', gmName: '', email: '', slug: '' });

  // Fetch staff count on mount via verified GET /users
  useEffect(() => {
    let cancelled = false;
    const fetchStaff = async () => {
      setStaffLoading(true);
      try {
        const res = await api.get('/users');
        if (!cancelled && res.data && Array.isArray(res.data)) {
          setStaffCount(res.data.length);
        }
      } catch {
        if (!cancelled) setStaffCount(null);
      } finally {
        if (!cancelled) setStaffLoading(false);
      }
    };
    fetchStaff();
    return () => { cancelled = true; };
  }, []);

  // Tenant metrics — all empty (no GET /agency-workspaces list endpoint)
  const tenantMetrics = {
    total:     '—',
    active:    '—',
    pending:   '—',
    suspended: '—',
  };

  const filtered = tenants.filter(t => {
    const q = search.toLowerCase();
    return (q === '' || t.agencyName.toLowerCase().includes(q) || t.licenseNo.toLowerCase().includes(q))
      && (statusFilter === 'all' || t.status === statusFilter);
  });

  // App retains backend snake_case values alongside operational display fields.
  // Local activity has no backend audit ID and is not claimed to be persisted.
  const liveAuditLogs: LiveAuditLog[] = activityLogs.map((log: ActivityLog & Partial<LiveAuditLog>) => ({
    audit_log_id:  log.audit_log_id ?? null,
    action:        log.action         ?? '—',
    details:       log.details        ?? '—',
    performed_by:  log.audit_log_id != null ? log.performed_by ?? null : log.performedBy || null,
    department:    log.department     ?? null,
    created_at:    log.audit_log_id != null ? log.created_at ?? null : log.timestamp || null,
    applicant_id:  log.audit_log_id != null ? log.applicant_id ?? null : log.applicantId || null,
  }));

  // Live current date/time
  const nowLabel = new Date().toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZoneName: 'short',
  });

  const NAV = [
    { key: 'overview'    as AdminView, label: 'Overview',          icon: <BarChart3  size={17} /> },
    { key: 'tenants'     as AdminView, label: 'Tenant Management', icon: <Building2  size={17} /> },
    { key: 'onboarding'  as AdminView, label: 'Agency Onboarding', icon: <UserPlus   size={17} /> },
    { key: 'audit'       as AdminView, label: 'Audit Ledger',      icon: <ScrollText size={17} /> },
  ];

  const TITLES: Record<AdminView, string> = {
    overview:   'Platform Overview',
    tenants:    'Tenant Management',
    onboarding: 'Agency Onboarding',
    audit:      'Super Admin Audit Ledger',
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-[#060F1C] font-['Inter',sans-serif] overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 bg-[#0B1628] border-r border-white/5 flex flex-col">
        {/* Logo + badge */}
        <div className="px-5 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#6366F1] flex items-center justify-center shadow">
              <Layers size={15} className="text-white" />
            </div>
            <span className="text-white font-black text-sm tracking-tight">
              Flow<span className="text-[#818CF8]">Sensus</span>
            </span>
          </div>
          <div className="inline-flex items-center gap-1.5 bg-[#6366F1]/20 border border-[#6366F1]/30 rounded-full px-2.5 py-1">
            <Shield size={10} className="text-[#818CF8]" />
            <span className="text-[#818CF8] text-[10px] font-bold tracking-widest uppercase">SuperAdmin Console</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(item => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                view === item.key
                  ? 'bg-[#6366F1] text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}

          {/* Divider before role-switch */}
          <div className="pt-4 pb-1">
            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold px-3 pb-2">
              Switch to Role
            </p>
            {ROLE_OPTS.map(r => {
              const Icon = r.icon;
              return (
                <button
                  key={r.role}
                  onClick={() => onSwitchRole(r.role)}
                  title={`Enter ${r.label} view`}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-white hover:bg-white/5 transition-all text-left"
                >
                  <Icon size={14} />
                  {r.label}
                  <ArrowRight size={11} className="ml-auto opacity-40" />
                </button>
              );
            })}
          </div>
        </nav>

        {/* User + sign out */}
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Crown size={13} className="text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate">Super Admin</p>
              <p className="text-slate-500 text-[10px] truncate">{currentUserName || 'admin@findstaff.ph'}</p>
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

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="h-14 bg-[#0B1628] border-b border-white/5 flex items-center justify-between px-6 flex-shrink-0">
          <div>
            <h1 className="text-white font-bold text-[15px]">{TITLES[view]}</h1>
            <p className="text-slate-500 text-[11px]">FlowSensus Platform · {nowLabel}</p>
          </div>
          <div className="flex items-center gap-2 bg-[#6366F1]/10 border border-[#6366F1]/20 rounded-full px-3 py-1.5">
            <Shield size={11} className="text-[#818CF8]" />
            <span className="text-[#818CF8] text-[11px] font-semibold">Platform Console</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">

          {/* ── Overview ──────────────────────────────────────────────── */}
          {view === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Tenant metrics — no list endpoint exists → 0 / unavailable */}
                {[
                  { label: 'Total Agencies',    value: tenantMetrics.total,    icon: <Building2    size={17} />, color: '#6366F1', sub: 'No agency list endpoint' },
                  { label: 'Active Workspaces', value: tenantMetrics.active,   icon: <CheckCircle2 size={17} />, color: '#10B981', sub: 'Unavailable' },
                  { label: 'Pending Approval',  value: tenantMetrics.pending,  icon: <Clock        size={17} />, color: '#F59E0B', sub: 'Unavailable' },
                  { label: 'Suspended',         value: tenantMetrics.suspended, icon: <AlertTriangle size={17} />, color: '#EF4444', sub: 'Unavailable' },
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

                {/* Staff Users — sourced from verified GET /users */}
                <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-slate-500 text-xs font-medium">Total Staff Users</p>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#8B5CF618', color: '#8B5CF6' }}>
                      <Users size={17} />
                    </div>
                  </div>
                  {staffLoading ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Loader2 size={18} className="text-slate-400 animate-spin" />
                      <span className="text-slate-400 text-sm">Loading…</span>
                    </div>
                  ) : (
                    <p className="text-3xl font-black text-[#0F172A]">
                      {staffCount !== null ? staffCount : '—'}
                    </p>
                  )}
                  <p className="text-slate-400 text-xs mt-1">
                    {staffCount !== null ? 'From verified GET /users' : 'Backend offline'}
                  </p>
                </div>

                {/* Total Applicants — from App.tsx applicants[] state (GET /applicants) */}
                <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-slate-500 text-xs font-medium">Total Applicants</p>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#0EA5E918', color: '#0EA5E9' }}>
                      <Users size={17} />
                    </div>
                  </div>
                  <p className="text-3xl font-black text-[#0F172A]">{applicants.length}</p>
                  <p className="text-slate-400 text-xs mt-1">Applicants currently loaded</p>
                </div>
              </div>

              {/* Workspace Status Breakdown — no list endpoint */}
              <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-[#0F172A] text-sm mb-4">Workspace Status Breakdown</h3>
                <p className="text-slate-400 text-sm text-center py-4">
                  No tenant data available — GET /agency-workspaces list endpoint not yet implemented
                </p>
              </div>

              {/* Recent System Activity — from activityLogs[] state (GET /audit-logs) */}
              <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-[#0F172A] text-sm">Recent System Activity</h3>
                  <button onClick={() => setView('audit')} className="text-[#6366F1] text-xs font-semibold hover:underline">
                    View full audit log →
                  </button>
                </div>
                {liveAuditLogs.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-4">No audit records available</p>
                ) : (
                  <div className="space-y-3">
                    {liveAuditLogs.slice(0, 5).map((log, i) => (
                      <div key={log.audit_log_id || i} className="flex items-center gap-3">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[#6366F1]" />
                        <span className="text-slate-600 text-sm flex-1 truncate">{log.action}</span>
                        {log.department && (
                          <span className="text-slate-400 text-xs flex-shrink-0 hidden sm:block">{log.department}</span>
                        )}
                        <span className="text-slate-400 text-xs flex-shrink-0 font-['JetBrains_Mono',monospace]">
                          {fmtTimeShort(log.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Tenant Management ────────────────────────────────────── */}
          {view === 'tenants' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search by agency name or license number…"
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all"
                  />
                </div>
                <select
                  value={statusFilter} onChange={e => setStatusFilter(e.target.value as TenantStatus | 'all')}
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
                        {['Agency', 'License No.', 'Workspace URL', 'Status', 'Onboarded', 'Last Active'].map(h => (
                          <th key={h} className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-sm">
                            No records found — GET /agency-workspaces list endpoint not yet implemented
                          </td>
                        </tr>
                      ) : filtered.map(t => {
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

          {/* ── Agency Onboarding ────────────────────────────────────── */}
          {view === 'onboarding' && (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Onboarding form — UI only, no backend POST connected tonight */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-bold text-[#0F172A] text-base mb-1">Provision New Tenant Workspace</h3>
                <p className="text-slate-500 text-xs mb-1">Creates a new agency workspace on the FlowSensus platform.</p>
                <p className="text-amber-600 text-xs font-semibold mb-5">⚠ Backend provisioning not connected in this build. Form fields only.</p>
                <form onSubmit={e => e.preventDefault()} className="space-y-4">
                  {[
                    { key: 'agencyName', label: 'Agency Name',            placeholder: 'Registered agency name' },
                    { key: 'licenseNo',  label: 'POEA / DMW License No.', placeholder: 'POEA-000-LB-MMYYYY-R' },
                    { key: 'gmName',     label: "General Manager's Name", placeholder: 'Full name of authorized GM' },
                    { key: 'email',      label: 'Corporate Email',         placeholder: 'gm@youragency.ph' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">
                        {f.label} <span className="text-red-400 normal-case">*</span>
                      </label>
                      <input
                        type={f.key === 'email' ? 'email' : 'text'}
                        value={(form as Record<string, string>)[f.key]}
                        onChange={e => setForm(p => ({
                          ...p,
                          [f.key]: e.target.value,
                          ...(f.key === 'agencyName' ? { slug: toSlug(e.target.value) } : {}),
                        }))}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all"
                        placeholder={f.placeholder}
                      />
                    </div>
                  ))}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">
                      Workspace URL
                    </label>
                    <div className="flex rounded-lg border border-slate-200 overflow-hidden focus-within:border-[#6366F1] focus-within:ring-2 focus-within:ring-[#6366F1]/20 transition-all">
                      <input
                        type="text" value={form.slug}
                        onChange={e => setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                        className="flex-1 px-3.5 py-2.5 text-sm focus:outline-none font-['JetBrains_Mono',monospace] bg-white"
                        placeholder="agency-name"
                      />
                      <span className="bg-slate-50 border-l border-slate-200 px-3.5 py-2.5 text-slate-400 text-xs font-['JetBrains_Mono',monospace] flex items-center whitespace-nowrap">.flowsensus.com</span>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled
                    className="w-full bg-slate-200 text-slate-400 font-semibold py-3 rounded-xl cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    Provision Workspace (Backend not connected) <ArrowRight size={16} />
                  </button>
                </form>
              </div>

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
                      { step: '04', text: 'Tenant appears in Tenant Management as Active' },
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

          {/* ── Audit Ledger ─────────────────────────────────────────── */}
          {view === 'audit' && (
            <div className="space-y-4">
              <div className="flex gap-3 items-center">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-500 font-medium whitespace-nowrap">
                  <RefreshCw size={13} /> Read-Only · {liveAuditLogs.length} records
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-slate-100">
                        {/* Only columns that map to verified AuditLogResponse fields */}
                        {['Log ID', 'Timestamp', 'Action', 'Performed By', 'Department', 'Applicant ID'].map(h => (
                          <th key={h} className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {liveAuditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-sm">
                            No audit records available
                          </td>
                        </tr>
                      ) : liveAuditLogs.map((log, i) => (
                        <tr key={log.audit_log_id || i} className="hover:bg-[#F8FAFC] transition-colors">
                          <td className="px-5 py-3.5">
                            <span className="font-['JetBrains_Mono',monospace] text-xs text-[#6366F1]">
                              {log.audit_log_id ?? '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className="font-['JetBrains_Mono',monospace] text-xs text-slate-500">
                              {fmtTimestamp(log.created_at)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className="text-sm font-medium text-[#0F172A]">{log.action}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-xs text-slate-600">{log.performed_by || '—'}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-xs text-slate-500">{log.department || '—'}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="font-['JetBrains_Mono',monospace] text-xs text-slate-400">
                              {log.applicant_id != null && log.applicant_id !== '' ? `#${log.applicant_id}` : '—'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-slate-100 bg-[#F8FAFC] flex items-center justify-between text-xs text-slate-400">
                  <span>{liveAuditLogs.length} entries · Recent System Activity</span>
                  <span>Includes local activity; persistence not confirmed</span>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
