import { useState, useEffect } from 'react';
import {
  Building2, BarChart3, ScrollText, UserPlus, LogOut, Search, Shield,
  Users, CheckCircle2, AlertTriangle, Clock, ArrowRight, Layers,
  Check, RefreshCw, Crown, Briefcase, Settings, Receipt, User,
  Loader2, Copy, ExternalLink, Power, CheckCircle, AlertCircle
} from 'lucide-react';
import { UserRole, ApplicantRecord, ActivityLog } from '../types';
import { api } from '../../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type AdminView = 'overview' | 'tenants' | 'onboarding' | 'audit';
type TenantStatus = 'active' | 'pending' | 'suspended';

interface Tenant {
  id: string;
  agencyName: string;
  licenseNo: string;
  gmName: string;
  email: string;
  workspaceUrl: string;
  status: TenantStatus;
  onboardedDate: string;
  lastActive: string;
  totalUsers: number;
  totalApplicants: number;
}

interface LiveAuditLog {
  audit_log_id: number | null;
  action: string;
  details: string;
  performed_by: string | null;
  department: string | null;
  created_at: string | null;
  applicant_id: number | string | null;
  applicant_code?: string | null;
}

interface PlatformMetrics {
  totalAgencies: number;
  activeWorkspaces: number;
  pendingWorkspaces: number;
  suspendedWorkspaces: number;
  totalStaff: number;
  totalApplicants: number;
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

  // Live Tenants & Metrics state
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TenantStatus | 'all'>('all');

  // Status updating state: agencyId -> boolean
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Persistent Audit logs from backend
  const [dbAuditLogs, setDbAuditLogs] = useState<LiveAuditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Agency Onboarding form state
  const [form, setForm] = useState({
    agencyName: '',
    licenseNo: '',
    gmName: '',
    email: '',
    slug: ''
  });
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [provisionSuccess, setProvisionSuccess] = useState<{
    agencyName: string;
    licenseNo: string;
    workspaceUrl: string;
    gmName: string;
    email: string;
    temporaryPassword: string;
  } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // ── Fetch Tenants & Platform Metrics from Backend ──────────────────────────
  const fetchPlatformData = async () => {
    setTenantsLoading(true);
    try {
      const [metricsRes, agenciesRes] = await Promise.all([
        api.get('/agency-workspaces/metrics').catch(err => {
          console.warn('Could not fetch metrics:', err);
          return null;
        }),
        api.get('/agency-workspaces').catch(err => {
          console.warn('Could not fetch agency workspaces:', err);
          return null;
        }),
      ]);

      if (metricsRes?.data) {
        setMetrics({
          totalAgencies: metricsRes.data.total_agencies ?? metricsRes.data.totalAgencies ?? 0,
          activeWorkspaces: metricsRes.data.active_workspaces ?? metricsRes.data.activeWorkspaces ?? 0,
          pendingWorkspaces: metricsRes.data.pending_workspaces ?? metricsRes.data.pendingWorkspaces ?? 0,
          suspendedWorkspaces: metricsRes.data.suspended_workspaces ?? metricsRes.data.suspendedWorkspaces ?? 0,
          totalStaff: metricsRes.data.total_staff ?? metricsRes.data.totalStaff ?? 0,
          totalApplicants: metricsRes.data.total_applicants ?? metricsRes.data.totalApplicants ?? 0,
        });
      }

      if (agenciesRes?.data && Array.isArray(agenciesRes.data)) {
        const mapped: Tenant[] = agenciesRes.data.map((a: any) => {
          const rawStatus = (a.workspace_status || a.workspaceStatus || 'Active').toLowerCase();
          let status: TenantStatus = 'active';
          if (rawStatus.includes('pending')) status = 'pending';
          else if (rawStatus.includes('suspend')) status = 'suspended';

          return {
            id: String(a.agency_id ?? a.agencyId ?? ''),
            agencyName: a.agency_name || a.agencyName || 'Registered Agency',
            licenseNo: a.poea_license_no || a.poeaLicenseNo || '—',
            gmName: a.gm_name || a.gmName || 'General Manager',
            email: a.email || '—',
            workspaceUrl: a.workspace_url || a.workspaceUrl || '—',
            status,
            onboardedDate: fmtTimestamp(a.created_at || a.createdAt),
            lastActive: a.last_active || a.lastActive || (status === 'active' ? 'Active Today' : 'Pending Verification'),
            totalUsers: a.total_users ?? a.totalUsers ?? 0,
            totalApplicants: a.total_applicants ?? a.totalApplicants ?? 0,
          };
        });
        setTenants(mapped);
      }
    } catch (err) {
      console.error('Error loading platform data:', err);
    } finally {
      setTenantsLoading(false);
    }
  };

  // ── Fetch Audit Logs from Backend ──────────────────────────────────────────
  const fetchAuditLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await api.get('/audit-logs');
      if (res?.data && Array.isArray(res.data)) {
        setDbAuditLogs(res.data);
      }
    } catch (err) {
      console.warn('Could not fetch live audit logs from backend:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlatformData();
    fetchAuditLogs();
  }, []);

  // ── Handle Workspace Status Updates ─────────────────────────────────────────
  const handleUpdateStatus = async (agencyId: string, newStatus: 'Active' | 'Pending Approval' | 'Suspended') => {
    setUpdatingStatusId(agencyId);
    try {
      await api.patch(`/agency-workspaces/${agencyId}/status`, {
        workspaceStatus: newStatus,
      });
      await fetchPlatformData();
      await fetchAuditLogs();
    } catch (err: any) {
      console.error('Failed to update workspace status:', err);
      alert(err.response?.data?.detail || 'Failed to update workspace status.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // ── Handle Agency Workspace Provisioning ───────────────────────────────────
  const handleProvisionWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setProvisionError(null);

    if (!form.agencyName.trim() || !form.licenseNo.trim() || !form.gmName.trim() || !form.email.trim()) {
      setProvisionError('Please fill in all required fields.');
      return;
    }

    const targetSlug = form.slug.trim() || toSlug(form.agencyName);
    const workspaceUrl = `${targetSlug}.flowsensus.com`;

    setIsProvisioning(true);
    try {
      const payload = {
        agencyName: form.agencyName.trim(),
        poeaLicenseNo: form.licenseNo.trim(),
        gmName: form.gmName.trim(),
        email: form.email.trim(),
        workspaceUrl,
      };

      const res = await api.post('/agency-workspaces/provision', payload);
      if (res.data?.success) {
        setProvisionSuccess({
          agencyName: form.agencyName.trim(),
          licenseNo: form.licenseNo.trim(),
          workspaceUrl,
          gmName: form.gmName.trim(),
          email: form.email.trim(),
          temporaryPassword: res.data.gm?.temporary_password || '[Temporary Password]',
        });

        // Reset form fields
        setForm({ agencyName: '', licenseNo: '', gmName: '', email: '', slug: '' });

        // Refresh platform tenant list and ledger
        await fetchPlatformData();
        await fetchAuditLogs();
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to provision workspace.';
      setProvisionError(msg);
    } finally {
      setIsProvisioning(false);
    }
  };

  // Filtered tenants for search & status
  const filteredTenants = tenants.filter(t => {
    const q = search.toLowerCase();
    const matchesSearch =
      q === '' ||
      t.agencyName.toLowerCase().includes(q) ||
      t.licenseNo.toLowerCase().includes(q) ||
      t.gmName.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Effective metrics
  const totalAgenciesCount = metrics?.totalAgencies ?? tenants.length;
  const activeWorkspacesCount = metrics?.activeWorkspaces ?? tenants.filter(t => t.status === 'active').length;
  const pendingWorkspacesCount = metrics?.pendingWorkspaces ?? tenants.filter(t => t.status === 'pending').length;
  const suspendedWorkspacesCount = metrics?.suspendedWorkspaces ?? tenants.filter(t => t.status === 'suspended').length;
  const totalStaffCount = metrics?.totalStaff ?? 7;
  const totalApplicantsCount = metrics?.totalApplicants ?? applicants.length;

  // Combine database logs with local activityLogs if needed
  const effectiveAuditLogs: LiveAuditLog[] = dbAuditLogs.length > 0
    ? dbAuditLogs
    : activityLogs.map((log: ActivityLog & Partial<LiveAuditLog>) => ({
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
              {item.key === 'tenants' && pendingWorkspacesCount > 0 && (
                <span className="ml-auto bg-amber-500/20 text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-amber-500/30">
                  {pendingWorkspacesCount}
                </span>
              )}
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => { fetchPlatformData(); fetchAuditLogs(); }}
              disabled={tenantsLoading || logsLoading}
              title="Refresh platform data"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg transition-all"
            >
              <RefreshCw size={12} className={tenantsLoading || logsLoading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <div className="flex items-center gap-2 bg-[#6366F1]/10 border border-[#6366F1]/20 rounded-full px-3 py-1.5">
              <Shield size={11} className="text-[#818CF8]" />
              <span className="text-[#818CF8] text-[11px] font-semibold">Platform Console</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">

          {/* ── Overview ──────────────────────────────────────────────── */}
          {view === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. Total Agencies */}
                <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-slate-500 text-xs font-medium">Total Agencies</p>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#6366F1]/10 text-[#6366F1]">
                      <Building2 size={17} />
                    </div>
                  </div>
                  <p className="text-3xl font-black text-[#0F172A]">{totalAgenciesCount}</p>
                  <p className="text-slate-400 text-xs mt-1">Live registered tenant accounts</p>
                </div>

                {/* 2. Active Workspaces */}
                <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-slate-500 text-xs font-medium">Active Workspaces</p>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#10B981]/10 text-[#10B981]">
                      <CheckCircle2 size={17} />
                    </div>
                  </div>
                  <p className="text-3xl font-black text-[#0F172A]">{activeWorkspacesCount}</p>
                  <p className="text-emerald-600 text-xs mt-1 font-medium">Operational & provisioned</p>
                </div>

                {/* 3. Pending Approval */}
                <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-slate-500 text-xs font-medium">Pending Approval</p>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#F59E0B]/10 text-[#F59E0B]">
                      <Clock size={17} />
                    </div>
                  </div>
                  <p className="text-3xl font-black text-[#0F172A]">{pendingWorkspacesCount}</p>
                  <p className="text-amber-600 text-xs mt-1 font-medium">Awaiting superadmin sign-off</p>
                </div>

                {/* 4. Suspended */}
                <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-slate-500 text-xs font-medium">Suspended</p>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#EF4444]/10 text-[#EF4444]">
                      <AlertTriangle size={17} />
                    </div>
                  </div>
                  <p className="text-3xl font-black text-[#0F172A]">{suspendedWorkspacesCount}</p>
                  <p className="text-slate-400 text-xs mt-1">Inactive or policy flagged</p>
                </div>

                {/* 5. Total Staff Users */}
                <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-slate-500 text-xs font-medium">Total Staff Users</p>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#8B5CF6]/10 text-[#8B5CF6]">
                      <Users size={17} />
                    </div>
                  </div>
                  <p className="text-3xl font-black text-[#0F172A]">{totalStaffCount}</p>
                  <p className="text-slate-400 text-xs mt-1">Across all registered agencies</p>
                </div>

                {/* 6. Total Applicants */}
                <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-slate-500 text-xs font-medium">Total Applicants</p>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#0EA5E9]/10 text-[#0EA5E9]">
                      <Users size={17} />
                    </div>
                  </div>
                  <p className="text-3xl font-black text-[#0F172A]">{totalApplicantsCount}</p>
                  <p className="text-slate-400 text-xs mt-1">Candidate records loaded</p>
                </div>
              </div>

              {/* ── Workspace Status Breakdown (Visual Bar & Distribution) ── */}
              <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-[#0F172A] text-sm">Workspace Status Breakdown</h3>
                    <p className="text-slate-400 text-xs">Distribution of all tenant environments on FlowSensus</p>
                  </div>
                  <button
                    onClick={() => setView('tenants')}
                    className="text-[#6366F1] text-xs font-semibold hover:underline flex items-center gap-1"
                  >
                    View directory <ArrowRight size={13} />
                  </button>
                </div>

                {totalAgenciesCount === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-6">
                    No tenant workspaces registered on platform yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {/* Visual Segmented Progress Bar */}
                    <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex gap-0.5 p-0.5">
                      {activeWorkspacesCount > 0 && (
                        <div
                          style={{ width: `${(activeWorkspacesCount / totalAgenciesCount) * 100}%` }}
                          className="bg-[#10B981] h-full rounded-full transition-all duration-500"
                          title={`Active: ${activeWorkspacesCount}`}
                        />
                      )}
                      {pendingWorkspacesCount > 0 && (
                        <div
                          style={{ width: `${(pendingWorkspacesCount / totalAgenciesCount) * 100}%` }}
                          className="bg-[#F59E0B] h-full rounded-full transition-all duration-500"
                          title={`Pending: ${pendingWorkspacesCount}`}
                        />
                      )}
                      {suspendedWorkspacesCount > 0 && (
                        <div
                          style={{ width: `${(suspendedWorkspacesCount / totalAgenciesCount) * 100}%` }}
                          className="bg-[#EF4444] h-full rounded-full transition-all duration-500"
                          title={`Suspended: ${suspendedWorkspacesCount}`}
                        />
                      )}
                    </div>

                    {/* Breakdown Metric Indicators */}
                    <div className="grid grid-cols-3 gap-3 pt-1">
                      <div className="flex items-center gap-2.5 p-3 rounded-lg bg-[#ECFDF5] border border-[#10B981]/20">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {activeWorkspacesCount} Active
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {totalAgenciesCount > 0 ? Math.round((activeWorkspacesCount / totalAgenciesCount) * 100) : 0}% of network
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 p-3 rounded-lg bg-[#FFFBEB] border border-[#F59E0B]/20">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {pendingWorkspacesCount} Pending
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {totalAgenciesCount > 0 ? Math.round((pendingWorkspacesCount / totalAgenciesCount) * 100) : 0}% awaiting approval
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 p-3 rounded-lg bg-[#FEF2F2] border border-[#EF4444]/20">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {suspendedWorkspacesCount} Suspended
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {totalAgenciesCount > 0 ? Math.round((suspendedWorkspacesCount / totalAgenciesCount) * 100) : 0}% restricted
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Recent System Activity (Real Backend Ledger) ── */}
              <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-[#0F172A] text-sm">Recent System Activity</h3>
                    <p className="text-slate-400 text-xs">Administrative and platform audit trail</p>
                  </div>
                  <button onClick={() => setView('audit')} className="text-[#6366F1] text-xs font-semibold hover:underline">
                    View full audit log →
                  </button>
                </div>
                {effectiveAuditLogs.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-4">No audit records available</p>
                ) : (
                  <div className="space-y-3">
                    {effectiveAuditLogs.slice(0, 6).map((log, i) => (
                      <div key={log.audit_log_id || i} className="flex items-center gap-3 py-1.5 border-b border-slate-50 last:border-0">
                        <span className="w-2 h-2 rounded-full flex-shrink-0 bg-[#6366F1]" />
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-800 text-sm font-medium truncate">{log.action}</p>
                          <p className="text-slate-500 text-xs truncate">{log.details}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-slate-600 text-xs block font-medium">
                            {log.performed_by || 'System'}
                          </span>
                          <span className="text-slate-400 text-[11px] font-['JetBrains_Mono',monospace]">
                            {fmtTimeShort(log.created_at)}
                          </span>
                        </div>
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
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
                  <div className="relative flex-1">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text" value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Search by agency name, GM, or license number…"
                      className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all"
                    />
                  </div>
                  <select
                    value={statusFilter} onChange={e => setStatusFilter(e.target.value as TenantStatus | 'all')}
                    className="px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6366F1] transition-all"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active ({activeWorkspacesCount})</option>
                    <option value="pending">Pending Approval ({pendingWorkspacesCount})</option>
                    <option value="suspended">Suspended ({suspendedWorkspacesCount})</option>
                  </select>
                </div>

                <button
                  onClick={() => setView('onboarding')}
                  className="bg-[#6366F1] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#5558E6] transition-all flex items-center gap-2 whitespace-nowrap shadow-sm"
                >
                  <UserPlus size={15} /> Provision New Tenant
                </button>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-slate-100">
                        {['Agency & General Manager', 'License No.', 'Workspace URL', 'Status', 'Onboarded', 'Actions'].map(h => (
                          <th key={h} className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {tenantsLoading ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                            <Loader2 size={24} className="animate-spin mx-auto text-[#6366F1] mb-2" />
                            <p className="text-sm font-medium">Loading live tenant workspaces…</p>
                          </td>
                        </tr>
                      ) : filteredTenants.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-12 text-center text-slate-400 text-sm">
                            No records found matching your filters.
                          </td>
                        </tr>
                      ) : filteredTenants.map(t => {
                        const cfg = STATUS_CFG[t.status];
                        const isUpdating = updatingStatusId === t.id;

                        return (
                          <tr key={t.id} className="hover:bg-[#F8FAFC] transition-colors">
                            <td className="px-5 py-3.5 max-w-[240px]">
                              <p className="font-semibold text-[#0F172A] text-sm truncate">{t.agencyName}</p>
                              <p className="text-slate-500 text-xs mt-0.5">GM: <span className="font-medium text-slate-700">{t.gmName}</span> ({t.email})</p>
                              <p className="text-slate-400 text-[11px] mt-0.5">
                                Workspace #{t.id} · <span className="text-[#6366F1] font-semibold">{t.totalUsers} staff</span> · {t.totalApplicants} applicants
                              </p>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="font-['JetBrains_Mono',monospace] text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded whitespace-nowrap">
                                {t.licenseNo}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <a
                                href={`https://${t.workspaceUrl}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-['JetBrains_Mono',monospace] text-xs text-[#6366F1] hover:underline flex items-center gap-1 whitespace-nowrap"
                              >
                                {t.workspaceUrl} <ExternalLink size={11} className="opacity-50" />
                              </a>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap" style={{ color: cfg.color, background: cfg.bg }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">{t.onboardedDate}</td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              {/* Status Action Controls */}
                              {isUpdating ? (
                                <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                                  <Loader2 size={13} className="animate-spin" /> Saving…
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  {t.status === 'pending' && (
                                    <button
                                      onClick={() => handleUpdateStatus(t.id, 'Active')}
                                      className="px-2.5 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 rounded-md text-xs font-semibold flex items-center gap-1 transition-all"
                                      title="Approve tenant workspace"
                                    >
                                      <CheckCircle size={12} /> Approve
                                    </button>
                                  )}

                                  {t.status === 'active' && (
                                    <button
                                      onClick={() => handleUpdateStatus(t.id, 'Suspended')}
                                      className="px-2.5 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-md text-xs font-semibold flex items-center gap-1 transition-all"
                                      title="Suspend workspace operations"
                                    >
                                      <Power size={12} /> Suspend
                                    </button>
                                  )}

                                  {t.status === 'suspended' && (
                                    <button
                                      onClick={() => handleUpdateStatus(t.id, 'Active')}
                                      className="px-2.5 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 rounded-md text-xs font-semibold flex items-center gap-1 transition-all"
                                      title="Reactivate tenant workspace"
                                    >
                                      <CheckCircle size={12} /> Reactivate
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-slate-100 bg-[#F8FAFC] text-xs text-slate-400">
                  Showing {filteredTenants.length} of {tenants.length} tenants
                </div>
              </div>
            </div>
          )}

          {/* ── Agency Onboarding ────────────────────────────────────── */}
          {view === 'onboarding' && (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Onboarding form */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center">
                    <UserPlus size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#0F172A] text-base">Provision New Tenant Workspace</h3>
                    <p className="text-slate-500 text-xs">Instantly provisions an isolated database workspace and creates the GM credentials.</p>
                  </div>
                </div>

                {/* Provisioning Error Alert */}
                {provisionError && (
                  <div className="my-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs">
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Provisioning Error</p>
                      <p className="mt-0.5">{provisionError}</p>
                    </div>
                  </div>
                )}

                {/* Provisioning Success Modal / Card */}
                {provisionSuccess ? (
                  <div className="my-4 p-5 bg-[#ECFDF5] border border-[#10B981]/30 rounded-xl space-y-4">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                      <CheckCircle2 size={18} className="text-emerald-600" />
                      Workspace Successfully Provisioned!
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-emerald-200/60 space-y-2.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Agency Name:</span>
                        <span className="font-bold text-slate-800">{provisionSuccess.agencyName}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">License Number:</span>
                        <span className="font-['JetBrains_Mono',monospace] font-semibold text-slate-700">{provisionSuccess.licenseNo}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Workspace URL:</span>
                        <span className="font-['JetBrains_Mono',monospace] font-semibold text-[#6366F1]">{provisionSuccess.workspaceUrl}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">General Manager:</span>
                        <span className="font-medium text-slate-800">{provisionSuccess.gmName}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Corporate Email:</span>
                        <span className="font-['JetBrains_Mono',monospace] text-slate-800">{provisionSuccess.email}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <span className="text-slate-500 block">Initial Temporary Password:</span>
                          <span className="font-['JetBrains_Mono',monospace] font-bold text-emerald-700 text-sm">
                            {provisionSuccess.temporaryPassword}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(provisionSuccess.temporaryPassword);
                            setCopiedPassword(true);
                            setTimeout(() => setCopiedPassword(false), 2000);
                          }}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold text-xs flex items-center gap-1.5 transition-all"
                        >
                          {copiedPassword ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                          {copiedPassword ? 'Copied!' : 'Copy Password'}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setProvisionSuccess(null);
                          setView('tenants');
                        }}
                        className="flex-1 bg-[#6366F1] hover:bg-[#5558E6] text-white py-2.5 rounded-lg font-semibold text-xs text-center transition-all"
                      >
                        View in Tenant Directory →
                      </button>
                      <button
                        type="button"
                        onClick={() => setProvisionSuccess(null)}
                        className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg font-semibold text-xs transition-all"
                      >
                        Provision Another
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleProvisionWorkspace} className="space-y-4 mt-5">
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
                          required
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
                      disabled={isProvisioning}
                      className="w-full bg-[#6366F1] hover:bg-[#5558E6] text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50"
                    >
                      {isProvisioning ? (
                        <>
                          <Loader2 size={16} className="animate-spin" /> Provisioning Workspace…
                        </>
                      ) : (
                        <>
                          Provision Workspace <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </form>
                )}
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
                      { step: '01', text: 'Workspace ID generated and standard agency departments seeded' },
                      { step: '02', text: 'Subdomain registered and tenant routing configured' },
                      { step: '03', text: 'GM account created in Supabase Auth with Management role' },
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
              <div className="flex gap-3 items-center justify-between">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 font-medium whitespace-nowrap">
                  <RefreshCw size={13} className={logsLoading ? 'animate-spin' : ''} /> Persistent Database Ledger · {effectiveAuditLogs.length} records
                </div>
                <button
                  onClick={fetchAuditLogs}
                  disabled={logsLoading}
                  className="px-3 py-2 bg-[#6366F1]/10 text-[#6366F1] hover:bg-[#6366F1]/20 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <RefreshCw size={12} className={logsLoading ? 'animate-spin' : ''} /> Refresh Logs
                </button>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-slate-100">
                        {['Log ID', 'Timestamp', 'Action', 'Performed By', 'Details', 'Applicant Code'].map(h => (
                          <th key={h} className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {logsLoading ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                            <Loader2 size={24} className="animate-spin mx-auto text-[#6366F1] mb-2" />
                            <p className="text-sm font-medium">Loading ledger records…</p>
                          </td>
                        </tr>
                      ) : effectiveAuditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-sm">
                            No audit records available
                          </td>
                        </tr>
                      ) : effectiveAuditLogs.map((log, i) => {
                        const rawAppId = log.applicant_id != null ? String(log.applicant_id) : '';
                        const matchedApp = applicants.find(a => String(a.id) === rawAppId || a.applicantCode === rawAppId);
                        const displayCode = log.applicant_code || matchedApp?.applicantCode || (rawAppId ? (rawAppId.startsWith('APP-') ? rawAppId : `#${rawAppId}`) : '—');

                        return (
                          <tr key={log.audit_log_id || i} className="hover:bg-[#F8FAFC] transition-colors">
                            <td className="px-5 py-3.5">
                              <span className="font-['JetBrains_Mono',monospace] text-xs text-[#6366F1]">
                                {log.audit_log_id ? `#${log.audit_log_id}` : '—'}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <span className="font-['JetBrains_Mono',monospace] text-xs text-slate-500">
                                {fmtTimestamp(log.created_at)}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <span className="text-sm font-semibold text-[#0F172A]">{log.action}</span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="text-xs font-medium text-slate-700">{log.performed_by || 'System'}</span>
                            </td>
                            <td className="px-5 py-3.5 max-w-[300px]">
                              <span className="text-xs text-slate-600 block truncate" title={log.details}>
                                {log.details || '—'}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="font-['JetBrains_Mono',monospace] text-xs text-[#6366F1] font-semibold whitespace-nowrap">
                                {displayCode}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-slate-100 bg-[#F8FAFC] flex items-center justify-between text-xs text-slate-400">
                  <span>{effectiveAuditLogs.length} entries · Live Audit Trail</span>
                  <span>Persisted in PostgreSQL database</span>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
