import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { isAxiosError } from 'axios';
import {
  Building2, BarChart3, ScrollText, UserPlus, LogOut, Search, Shield,
  Users, CheckCircle2, AlertTriangle, Clock, ArrowRight,
  Check, RefreshCw, Crown, Briefcase, Settings, Receipt, User,
  Loader2, ExternalLink, Copy, CheckCheck, Sparkles, Activity,
  Edit2, X, Globe
} from 'lucide-react';
import { UserRole, ApplicantRecord, ActivityLog } from '../types';
import { api } from '../../lib/api';
import { Skeleton } from './ui/skeleton';
import DeploymentHistory from './views/DeploymentHistory';
import Logo from './Logo';

// ─── Types ───────────────────────────────────────────────────────────────────

type AdminView = 'overview' | 'tenants' | 'onboarding' | 'audit';

// Verified field names from GET /audit-logs AuditLogResponse schema
interface LiveAuditLog {
  audit_log_id: number | null;
  action: string;
  details: string | null;
  created_at: string | null;
  department?: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

function getStatusCfg(rawStatus: string | null | undefined) {
  const s = (rawStatus || '').toLowerCase().trim();
  if (s === 'active') {
    return {
      label: 'Active',
      color: '#10B981',
      bg: '#ECFDF5',
      border: '#A7F3D0',
      dot: '#10B981',
    };
  }
  if (s === 'pending approval' || s === 'pending_approval' || s.includes('pending')) {
    return {
      label: 'Pending Approval',
      color: '#D97706',
      bg: '#FFFBEB',
      border: '#FDE68A',
      dot: '#F59E0B',
    };
  }
  if (s === 'suspended') {
    return {
      label: 'Suspended',
      color: '#DC2626',
      bg: '#FEF2F2',
      border: '#FECACA',
      dot: '#EF4444',
    };
  }
  return {
    label: rawStatus || 'Active',
    color: '#10B981',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    dot: '#10B981',
  };
}

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
  { role: 'Management', label: 'Management', icon: Briefcase },
  { role: 'Recruitment', label: 'Recruitment', icon: Users },
  { role: 'Admin', label: 'Administrative', icon: Settings },
  { role: 'Accounting', label: 'Accounting', icon: Receipt },
  { role: 'Employer', label: 'Employer Portal', icon: Building2 },
  { role: 'Applicant', label: 'Applicant Accounts', icon: User },
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

  // Agency Workspace data fetched from GET /agency-workspaces
  const [agencies, setAgencies] = useState<any[]>([]);
  const [agenciesLoading, setAgenciesLoading] = useState(false);
  const [agenciesError, setAgenciesError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Agency management and editing state
  const [editingAgency, setEditingAgency] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    agency_name: '',
    poea_license_no: '',
    agency_prefix: '',
    workspace_url: '',
    workspace_status: 'Active',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleQuickStatusChange = async (agencyId: number, newStatus: string) => {
    setUpdatingStatusId(agencyId);
    try {
      await api.patch(`/agency-workspaces/${agencyId}`, {
        workspace_status: newStatus,
        status: newStatus.toUpperCase(),
      });
      setAgencies((prev) =>
        prev.map((a) =>
          a.agency_id === agencyId
            ? { ...a, workspace_status: newStatus, status: newStatus.toUpperCase() }
            : a
        )
      );
      setToastMessage(`Agency status updated to "${newStatus}"`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      alert(`Failed to update status: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const openEditModal = (agency: any) => {
    const rawStat = agency.workspace_status || agency.status || 'Active';
    let normalized = 'Active';
    const s = rawStat.toLowerCase();
    if (s.includes('pending')) normalized = 'Pending Approval';
    else if (s.includes('suspend')) normalized = 'Suspended';

    setEditingAgency(agency);
    setEditForm({
      agency_name: agency.agency_name || '',
      poea_license_no: agency.poea_license_no || '',
      agency_prefix: agency.agency_prefix || '',
      workspace_url: agency.workspace_url || agency.workspace_code || '',
      workspace_status: normalized,
    });
    setEditError(null);
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingAgency) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const res = await api.patch(`/agency-workspaces/${editingAgency.agency_id}`, {
        agency_name: editForm.agency_name.trim(),
        poea_license_no: editForm.poea_license_no.trim(),
        agency_prefix: editForm.agency_prefix.trim().toUpperCase() || undefined,
        workspace_url: editForm.workspace_url.trim(),
        workspace_code: editForm.workspace_url.trim(),
        workspace_status: editForm.workspace_status,
        status: editForm.workspace_status.toUpperCase(),
      });
      const updated = res.data;
      setAgencies((prev) =>
        prev.map((a) =>
          a.agency_id === editingAgency.agency_id
            ? { ...a, ...updated, ...editForm }
            : a
        )
      );
      setEditingAgency(null);
      setToastMessage(`Agency "${editForm.agency_name}" updated successfully`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      setEditError(err?.response?.data?.detail || err?.message || 'Failed to update agency');
    } finally {
      setEditLoading(false);
    }
  };

  // Staff users — fetched from verified GET /users
  const [staffCount, setStaffCount] = useState<number | null>(null);
  const [staffLoading, setStaffLoading] = useState(false);

  // Agency Onboarding form state
  const [form, setForm] = useState({ agencyName: '', licenseNo: '', gmName: '', email: '', slug: '' });
  const provisioningLock = useRef(false);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [agencyReload, setAgencyReload] = useState(0);
  const [provisionResult, setProvisionResult] = useState<{
    agencyName: string; workspaceUrl: string; email: string; temporaryPassword: string;
  } | null>(null);
  const [copyMessage, setCopyMessage] = useState('');
  const [hasCopied, setHasCopied] = useState(false);

  const handleProvision = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (provisioningLock.current || provisionResult) return;
    setProvisionError(null);
    const payload = {
      agencyName: form.agencyName.trim(),
      poeaLicenseNo: form.licenseNo.trim(),
      workspaceUrl: `${form.slug.trim()}.flowsensus.com`,
      workspaceStatus: 'Active',
      adminFullName: form.gmName.trim(),
      adminEmail: form.email.trim(),
    };
    if (!payload.agencyName || !payload.poeaLicenseNo || !payload.adminFullName || !payload.adminEmail || !form.slug.trim()) {
      setProvisionError('Please complete all required fields, including the workspace URL.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.adminEmail)) {
      setProvisionError('Please enter a valid corporate email address.');
      return;
    }
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(form.slug.trim())) {
      setProvisionError('Use a workspace slug of 1–63 letters, numbers, or hyphens, starting and ending with a letter or number.');
      return;
    }
    provisioningLock.current = true;
    setProvisioning(true);
    try {
      const { data } = await api.post('/agency-workspaces/provision', payload);
      setProvisionResult({
        agencyName: data.agency?.agency_name || payload.agencyName,
        workspaceUrl: data.agency?.workspace_url || payload.workspaceUrl,
        email: data.admin.email,
        temporaryPassword: data.admin.temporary_password,
      });
      setCopyMessage('');
      setHasCopied(false);
      setAgencyReload(value => value + 1);
    } catch (error: unknown) {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      const detail = isAxiosError(error) ? error.response?.data?.detail : undefined;
      // Render only short, plain backend messages; never response objects or traces.
      const safeDetail = typeof detail === 'string' && detail.length <= 300 &&
        !/[\r\n]|traceback|stack trace|\bat\s+\S+\s*\(|<[^>]+>/i.test(detail);
      setProvisionError(safeDetail ? detail : status === 403
        ? 'The current account is not a verified Super Admin.'
        : status === 400
          ? 'Unable to provision this workspace. Check the license number and Admin email for duplicates.'
          : status && status >= 500
            ? 'Workspace provisioning failed on the server. Please try again later.'
            : 'Unable to provision the workspace. Please check your connection and try again.');
    } finally {
      provisioningLock.current = false;
      setProvisioning(false);
    }
  };

  const copyTemporaryPassword = async () => {
    if (!provisionResult) return;
    try {
      await navigator.clipboard.writeText(provisionResult.temporaryPassword);
      setCopyMessage('Password copied to clipboard.');
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 3000);
    } catch {
      setCopyMessage('Unable to copy automatically. Please select and copy manually.');
    }
  };

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

  // Fetch agencies on mount and after successful provisioning.
  useEffect(() => {
    let cancelled = false;
    const fetchAgencies = async () => {
      setAgenciesLoading(true);
      setAgenciesError(null);
      try {
        const res = await api.get('/agency-workspaces');
        if (!cancelled && res.data && Array.isArray(res.data)) {
          setAgencies(res.data);
        }
      } catch (err: any) {
        if (!cancelled) setAgenciesError(err.message || 'Failed to fetch workspaces');
      } finally {
        if (!cancelled) setAgenciesLoading(false);
      }
    };
    fetchAgencies();
    return () => { cancelled = true; };
  }, [agencyReload]);

  // Tenant metrics
  const tenantMetrics = {
    total: agencies.length,
    active: agencies.filter(a => {
      const s = (a.workspace_status || a.status || '').toLowerCase().trim();
      return s === 'active';
    }).length,
    pending: agencies.filter(a => {
      const s = (a.workspace_status || a.status || '').toLowerCase().trim();
      return s.includes('pending');
    }).length,
    suspended: agencies.filter(a => {
      const s = (a.workspace_status || a.status || '').toLowerCase().trim();
      return s === 'suspended';
    }).length,
  };

  const filtered = agencies.filter(a => {
    const q = search.toLowerCase();
    const name = (a.agency_name || '').toLowerCase();
    const lic = (a.poea_license_no || '').toLowerCase();
    const code = (a.workspace_code || a.workspace_url || '').toLowerCase();
    const stat = (a.workspace_status || a.status || '').toLowerCase().trim();
    const matchesSearch = q === '' || name.includes(q) || lic.includes(q) || code.includes(q);
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && stat === 'active') ||
      (statusFilter === 'pending' && stat.includes('pending')) ||
      (statusFilter === 'suspended' && stat === 'suspended');
    return matchesSearch && matchesStatus;
  });

  // App retains backend snake_case values alongside operational display fields.
  const liveAuditLogs: LiveAuditLog[] = activityLogs.map((log: ActivityLog & Partial<LiveAuditLog>) => ({
    audit_log_id: log.audit_log_id ?? null,
    action: log.action ?? '—',
    details: log.details ?? '—',
    created_at: log.audit_log_id != null ? log.created_at ?? null : log.timestamp || null,
    department: log.department,
  }));

  // Live current date/time
  const nowLabel = new Date().toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZoneName: 'short',
  });

  const NAV = [
    { key: 'overview' as AdminView, label: 'Overview', icon: BarChart3 },
    { key: 'tenants' as AdminView, label: 'Tenant Management', icon: Building2 },
    { key: 'onboarding' as AdminView, label: 'Agency Onboarding', icon: UserPlus },
    { key: 'audit' as AdminView, label: 'Audit Ledger', icon: ScrollText },
  ];

  const TITLES: Record<AdminView, { title: string; subtitle: string }> = {
    overview: {
      title: 'Platform Overview',
      subtitle: 'Global multi-tenant system health, active agencies, and audit activity.',
    },
    tenants: {
      title: 'Tenant Management',
      subtitle: 'Directory of registered agency workspaces, license validations, and status controls.',
    },
    onboarding: {
      title: 'Agency Onboarding',
      subtitle: 'Provision new verified recruitment agency workspaces and issue administrator credentials.',
    },
    audit: {
      title: 'Super Admin Audit Ledger',
      subtitle: 'Comprehensive immutable system events, security operations, and multi-agency activity logs.',
    },
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-[#F1F5F9] font-['Inter',sans-serif] overflow-hidden">

      {/* ── Sidebar (Unified FlowSensus Dark Gradient) ────────────────────── */}
      <aside className="w-64 flex-shrink-0 bg-gradient-to-b from-[#0F172A] to-[#1E293B] border-r border-slate-800 flex flex-col z-20 shadow-xl">
        
        {/* FlowSensus Official Logo & Console Identity */}
        <div className="px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Logo size="small" />
            <div className="min-w-0">
              <span className="font-extrabold text-white text-base tracking-wider leading-none block truncate">
                FLOWSENSUS
              </span>
              <span className="text-[10px] text-sky-400 font-bold tracking-widest uppercase mt-1 block">
                GLOBAL PLATFORM
              </span>
            </div>
          </div>

          <div className="mt-3.5 inline-flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 rounded-full px-2.5 py-1">
            <Crown size={11} className="text-amber-400" />
            <span className="text-amber-300 text-[10px] font-black tracking-wider uppercase">
              Super Admin Console
            </span>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold px-3 pt-2 pb-1.5">
            Admin Modules
          </p>
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = view === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setView(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all text-left cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#0EA5E9]/20 to-transparent text-[#0EA5E9] border-l-4 border-[#0EA5E9] pl-[10px] shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border-l-4 border-transparent hover:border-slate-700 hover:pl-[10px]'
                }`}
              >
                <Icon size={17} className={isActive ? 'text-[#0EA5E9]' : 'text-slate-400'} />
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Switch to Role (Tenant Portal Emulation) */}
          <div className="pt-5 pb-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold px-3 pb-2 flex items-center justify-between">
              <span>Switch to Role</span>
              <span className="text-[9px] text-sky-400 font-normal">Tenant Portal</span>
            </p>
            <div className="space-y-0.5">
              {ROLE_OPTS.map((r) => {
                const Icon = r.icon;
                return (
                  <button
                    key={r.role}
                    type="button"
                    onClick={() => onSwitchRole(r.role)}
                    title={`Emulate ${r.label} view in tenant workspace`}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all text-left group cursor-pointer"
                  >
                    <Icon size={14} className="text-slate-500 group-hover:text-sky-400 transition-colors" />
                    <span className="truncate">{r.label}</span>
                    <ArrowRight size={12} className="ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 text-sky-400 transition-all flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* User Card + Sign Out */}
        <div className="p-3 border-t border-white/10 bg-black/15">
          <div className="flex items-center gap-2.5 px-2.5 py-2 mb-1.5 rounded-lg bg-white/5 border border-white/5">
            <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <Crown size={13} className="text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-xs font-bold truncate">Super Admin</p>
              <p className="text-slate-400 text-[10px] truncate">{currentUserName || 'admin@flowsensus.com'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Application Canvas (Unified Light Theme) ───────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#F1F5F9]">

        {/* Top Header */}
        <header className="h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 sm:px-8 flex items-center justify-between flex-shrink-0 z-10 shadow-xs">
          <div>
            <h1 className="text-lg sm:text-xl font-black text-[#0F172A] tracking-tight">
              {TITLES[view].title}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {TITLES[view].subtitle}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Operational</span>
            </div>

            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-300/80 text-amber-900 text-xs font-extrabold px-3 py-1.5 rounded-full shadow-xs">
              <Crown size={12} className="text-amber-600" />
              <span>Super Admin</span>
            </div>
          </div>
        </header>

        {/* Scrollable View Area */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8 w-full">
          <div className="w-full space-y-6">

            {/* ── View: Overview ────────────────────────────────────────── */}
            {view === 'overview' && (
              <div className="space-y-6">
                
                {/* Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  
                  {/* Total Agencies */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#0EA5E9]/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
                    <div className="flex items-center justify-between mb-3 relative z-10">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Agencies</p>
                      <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#0EA5E9] border border-sky-100 flex items-center justify-center font-bold">
                        <Building2 size={19} />
                      </div>
                    </div>
                    {agenciesLoading ? (
                      <Skeleton className="h-9 w-20 mt-1" />
                    ) : agenciesError ? (
                      <p className="text-2xl font-bold text-red-500 mt-1">—</p>
                    ) : (
                      <p className="text-3xl sm:text-4xl font-black text-[#0F172A] mt-1 tracking-tight">
                        {tenantMetrics.total}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-2 font-medium">
                      {agenciesError ? 'Failed to load workspaces' : 'Registered tenant workspaces'}
                    </p>
                  </div>

                  {/* Active Workspaces */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
                    <div className="flex items-center justify-between mb-3 relative z-10">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Workspaces</p>
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center font-bold">
                        <CheckCircle2 size={19} />
                      </div>
                    </div>
                    {agenciesLoading ? (
                      <Skeleton className="h-9 w-20 mt-1" />
                    ) : (
                      <p className="text-3xl sm:text-4xl font-black text-[#0F172A] mt-1 tracking-tight">
                        {tenantMetrics.active}
                      </p>
                    )}
                    <p className="text-xs text-emerald-600 mt-2 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Operational without restrictions
                    </p>
                  </div>

                  {/* Pending Approval */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-amber-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
                    <div className="flex items-center justify-between mb-3 relative z-10">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Approval</p>
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center font-bold">
                        <Clock size={19} />
                      </div>
                    </div>
                    {agenciesLoading ? (
                      <Skeleton className="h-9 w-20 mt-1" />
                    ) : (
                      <p className="text-3xl sm:text-4xl font-black text-[#0F172A] mt-1 tracking-tight">
                        {tenantMetrics.pending}
                      </p>
                    )}
                    <p className="text-xs text-amber-600 mt-2 font-semibold">
                      Awaiting compliance & license review
                    </p>
                  </div>

                  {/* Suspended */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-red-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
                    <div className="flex items-center justify-between mb-3 relative z-10">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Suspended Workspaces</p>
                      <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center font-bold">
                        <AlertTriangle size={19} />
                      </div>
                    </div>
                    {agenciesLoading ? (
                      <Skeleton className="h-9 w-20 mt-1" />
                    ) : (
                      <p className="text-3xl sm:text-4xl font-black text-[#0F172A] mt-1 tracking-tight">
                        {tenantMetrics.suspended}
                      </p>
                    )}
                    <p className="text-xs text-red-600 mt-2 font-semibold">
                      Tenant access temporarily locked
                    </p>
                  </div>

                  {/* Total Staff Users */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-indigo-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
                    <div className="flex items-center justify-between mb-3 relative z-10">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Staff Users</p>
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center font-bold">
                        <Users size={19} />
                      </div>
                    </div>
                    {staffLoading ? (
                      <Skeleton className="h-9 w-20 mt-1" />
                    ) : (
                      <p className="text-3xl sm:text-4xl font-black text-[#0F172A] mt-1 tracking-tight">
                        {staffCount !== null ? staffCount : '—'}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-2 font-medium">
                      {staffCount !== null ? 'Verified user accounts across agencies' : 'Backend offline'}
                    </p>
                  </div>

                  {/* Total Applicants */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#0284C7]/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
                    <div className="flex items-center justify-between mb-3 relative z-10">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Applicants</p>
                      <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#0284C7] border border-sky-100 flex items-center justify-center font-bold">
                        <User size={19} />
                      </div>
                    </div>
                    <p className="text-3xl sm:text-4xl font-black text-[#0F172A] mt-1 tracking-tight">
                      {applicants.length}
                    </p>
                    <p className="text-xs text-slate-400 mt-2 font-medium">
                      Overseas workers currently registered
                    </p>
                  </div>
                </div>

                {/* Workspace Status Overview Breakdown */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                    <div>
                      <h3 className="font-extrabold text-[#0F172A] text-base">Workspace Distribution</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Real-time health breakdown of tenant licenses</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAgencyReload(v => v + 1)}
                      className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                      title="Refresh workspace status"
                    >
                      <RefreshCw size={15} className={agenciesLoading ? 'animate-spin' : ''} />
                    </button>
                  </div>

                  {agenciesLoading ? (
                    <div className="grid grid-cols-3 gap-4 py-4">
                      <Skeleton className="h-16 w-full rounded-xl" />
                      <Skeleton className="h-16 w-full rounded-xl" />
                      <Skeleton className="h-16 w-full rounded-xl" />
                    </div>
                  ) : agenciesError ? (
                    <p className="text-red-500 text-sm text-center py-6">
                      Error loading workspace metrics: {agenciesError}
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-emerald-50/60 border border-emerald-200/70 rounded-xl p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black text-xl shadow-xs">
                          {tenantMetrics.active}
                        </div>
                        <div>
                          <p className="font-bold text-emerald-950 text-sm">Active & Verified</p>
                          <p className="text-emerald-700 text-xs">Standard operational capabilities</p>
                        </div>
                      </div>

                      <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-xl shadow-xs">
                          {tenantMetrics.pending}
                        </div>
                        <div>
                          <p className="font-bold text-amber-950 text-sm">Pending Verification</p>
                          <p className="text-amber-700 text-xs">Awaiting license documentation</p>
                        </div>
                      </div>

                      <div className="bg-red-50/60 border border-red-200/70 rounded-xl p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-red-500 text-white flex items-center justify-center font-black text-xl shadow-xs">
                          {tenantMetrics.suspended}
                        </div>
                        <div>
                          <p className="font-bold text-red-950 text-sm">Suspended Agencies</p>
                          <p className="text-red-700 text-xs">Login & API endpoints suspended</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Recent System Activity Preview */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                    <div>
                      <h3 className="font-extrabold text-[#0F172A] text-base">Recent Platform Activity</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Real-time event stream from across all modules</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setView('audit')}
                      className="text-[#0EA5E9] hover:text-[#0284C7] text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>View full audit log</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>

                  {liveAuditLogs.length === 0 ? (
                    <div className="py-8 text-center">
                      <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm font-medium">No activity records logged yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {liveAuditLogs.slice(0, 6).map((log, i) => (
                        <div key={log.audit_log_id || i} className="py-3 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-[#0EA5E9] flex-shrink-0" />
                            <span className="text-sm font-semibold text-slate-800 truncate">
                              {log.action}
                            </span>
                            {log.details && log.details !== '—' && (
                              <span className="text-xs text-slate-400 truncate hidden md:inline">
                                — {log.details}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            {log.department && (
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md hidden sm:inline">
                                {log.department}
                              </span>
                            )}
                            <span className="text-xs text-slate-400 font-mono">
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

            {/* ── View: Tenant Management ───────────────────────────────── */}
            {view === 'tenants' && (
              <div className="space-y-4">
                
                {/* Search & Filter Header */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by agency name, POEA license, or workspace code…"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-[#0F172A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9] transition-all shadow-xs"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9] transition-all shadow-xs cursor-pointer"
                  >
                    <option value="all">All Workspace Statuses</option>
                    <option value="active">Active Only</option>
                    <option value="pending">Pending Approval</option>
                    <option value="suspended">Suspended Only</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setAgencyReload(v => v + 1)}
                    disabled={agenciesLoading}
                    title="Refresh agency workspaces"
                    className="px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-semibold text-sm flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={15} className={agenciesLoading ? 'animate-spin text-[#0EA5E9]' : ''} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('onboarding')}
                    className="px-4 py-2.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <UserPlus size={15} />
                    <span>Provision Agency</span>
                  </button>
                </div>

                {/* Agencies Table Card */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200">
                          {['Agency Workspace', 'POEA / DMW License', 'Workspace Domain', 'Operational Status', 'Registered Date', 'Management Actions'].map((h) => (
                            <th key={h} className="text-left px-6 py-3.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {agenciesLoading ? (
                          [...Array(4)].map((_, i) => (
                            <tr key={i}>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <Skeleton className="h-8 w-8 rounded-lg" />
                                  <div className="space-y-1.5">
                                    <Skeleton className="h-4 w-36" />
                                    <Skeleton className="h-3 w-20" />
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4"><Skeleton className="h-4 w-28" /></td>
                              <td className="px-6 py-4"><Skeleton className="h-4 w-36" /></td>
                              <td className="px-6 py-4"><Skeleton className="h-6 w-24 rounded-full" /></td>
                              <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                              <td className="px-6 py-4"><Skeleton className="h-8 w-28 rounded-lg" /></td>
                            </tr>
                          ))
                        ) : agenciesError ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-red-500 text-sm">
                              {agenciesError}
                            </td>
                          </tr>
                        ) : agencies.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">
                              No agency workspaces created yet. Use the Onboarding tab to provision one.
                            </td>
                          </tr>
                        ) : filtered.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">
                              No agency workspaces match "{search}".
                            </td>
                          </tr>
                        ) : (
                          filtered.map((t) => {
                            const rawStatus = t.workspace_status || t.status || 'Active';
                            const cfg = getStatusCfg(rawStatus);
                            const urlDisplay = t.workspace_url
                              ? (t.workspace_url.includes('.') ? t.workspace_url : `${t.workspace_url}.flowsensus.com`)
                              : (t.workspace_code ? `${t.workspace_code}.flowsensus.com` : '—');
                            const isUpdatingThis = updatingStatusId === t.agency_id;

                            return (
                              <tr key={t.agency_id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-300 flex items-center justify-center font-bold text-slate-700 flex-shrink-0 text-xs shadow-xs">
                                      {t.agency_prefix || (t.agency_name ? t.agency_name.slice(0, 2).toUpperCase() : 'AG')}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-[#0F172A] text-sm truncate">
                                        {t.agency_name || '—'}
                                      </p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-slate-400 text-[11px]">ID: #{t.agency_id}</span>
                                        {t.agency_prefix && (
                                          <span className="text-[10px] font-mono font-bold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200">
                                            {t.agency_prefix}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-1 rounded">
                                    {t.poea_license_no || '—'}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="font-mono text-xs text-[#0EA5E9] font-semibold flex items-center gap-1.5">
                                    <Globe size={13} className="text-slate-400 flex-shrink-0" />
                                    <span>{urlDisplay}</span>
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap"
                                      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
                                      {cfg.label}
                                    </span>
                                    {/* Quick Status Control */}
                                    <select
                                      disabled={isUpdatingThis}
                                      value={rawStatus.toLowerCase().includes('pending') ? 'Pending Approval' : (rawStatus.toLowerCase() === 'suspended' ? 'Suspended' : 'Active')}
                                      onChange={(e) => handleQuickStatusChange(t.agency_id, e.target.value)}
                                      title="Change agency status"
                                      className="text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1 hover:border-[#0EA5E9] focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] cursor-pointer disabled:opacity-50"
                                    >
                                      <option value="Active">Active</option>
                                      <option value="Pending Approval">Pending Approval</option>
                                      <option value="Suspended">Suspended</option>
                                    </select>
                                    {isUpdatingThis && <Loader2 size={13} className="animate-spin text-[#0EA5E9]" />}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-xs font-medium text-slate-500 whitespace-nowrap">
                                  {fmtTimestamp(t.created_at)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => openEditModal(t)}
                                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:text-[#0EA5E9] hover:border-sky-300 hover:bg-sky-50/50 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                                      title="Edit agency details"
                                    >
                                      <Edit2 size={13} />
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onSwitchRole('Management')}
                                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                                      title="Enter this agency workspace as Management"
                                    >
                                      <ExternalLink size={13} />
                                      <span>Enter Workspace</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer */}
                  <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>
                      Showing <strong>{filtered.length}</strong> of <strong>{agencies.length}</strong> registered agencies
                    </span>
                    <button
                      type="button"
                      onClick={() => setView('onboarding')}
                      className="text-[#0EA5E9] hover:text-[#0284C7] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <UserPlus size={14} /> Provision New Workspace
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── View: Agency Onboarding ──────────────────────────────── */}
            {view === 'onboarding' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Provision Form */}
                <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#0EA5E9] border border-sky-100 flex items-center justify-center font-bold">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-[#0F172A] text-lg">
                        Provision New Tenant Workspace
                      </h3>
                      <p className="text-slate-500 text-xs">
                        Registers the official recruitment workspace and generates admin credentials.
                      </p>
                    </div>
                  </div>

                  <div className="my-5 p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-xs text-[#0369A1] font-medium flex items-center gap-2.5">
                    <Sparkles size={16} className="text-[#0EA5E9] flex-shrink-0" />
                    <span>
                      A secure temporary administrator password will be created automatically upon submission.
                    </span>
                  </div>

                  {/* Provisioning Success Banner */}
                  {provisionResult && (
                    <div role="status" className="mb-6 rounded-2xl border border-emerald-300 bg-emerald-50/80 p-5 text-sm text-emerald-950 shadow-xs">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCheck className="w-5 h-5 text-emerald-600" />
                        <h4 className="font-black text-base text-emerald-900">
                          Workspace Provisioned Successfully!
                        </h4>
                      </div>
                      
                      <div className="bg-white rounded-xl border border-emerald-200 p-4 space-y-2.5 my-3 text-xs">
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-500 font-semibold">Agency Name</span>
                          <span className="font-bold text-[#0F172A]">{provisionResult.agencyName}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-500 font-semibold">Workspace Domain</span>
                          <span className="font-mono text-[#0EA5E9] font-bold">{provisionResult.workspaceUrl}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-500 font-semibold">Admin Account</span>
                          <span className="font-semibold text-slate-800">{provisionResult.email}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-slate-500 font-semibold">Temporary Password</span>
                          <code className="bg-slate-100 text-slate-900 px-2 py-1 rounded font-mono font-bold select-all border border-slate-200">
                            {provisionResult.temporaryPassword}
                          </code>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 mt-4">
                        <button
                          type="button"
                          onClick={copyTemporaryPassword}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                        >
                          {hasCopied ? <CheckCheck size={14} /> : <Copy size={14} />}
                          <span>{hasCopied ? 'Copied to Clipboard' : 'Copy Temporary Password'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setProvisionResult(null);
                            setCopyMessage('');
                            setProvisionError(null);
                            setForm({ agencyName: '', licenseNo: '', gmName: '', email: '', slug: '' });
                          }}
                          className="text-xs font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                        >
                          Provision another agency
                        </button>
                      </div>

                      {copyMessage && <p className="mt-2 text-xs text-emerald-800">{copyMessage}</p>}
                    </div>
                  )}

                  <form onSubmit={handleProvision} noValidate className="space-y-4">
                    <fieldset disabled={provisioning || !!provisionResult} className="space-y-4 disabled:opacity-60">
                      
                      {/* Agency Name */}
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1.5">
                          Agency Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={form.agencyName}
                          onChange={(e) => setForm(p => ({
                            ...p,
                            agencyName: e.target.value,
                            slug: toSlug(e.target.value),
                          }))}
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-[#0F172A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9] transition-all"
                          placeholder="e.g. FindStaff Placement Services Inc."
                        />
                      </div>

                      {/* POEA License No. */}
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1.5">
                          POEA / DMW License No. <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={form.licenseNo}
                          onChange={(e) => setForm(p => ({ ...p, licenseNo: e.target.value }))}
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-[#0F172A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9] font-mono transition-all"
                          placeholder="POEA-123-LB-040124-R"
                        />
                      </div>

                      {/* General Manager Name */}
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1.5">
                          General Manager / Authorized Representative <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={form.gmName}
                          onChange={(e) => setForm(p => ({ ...p, gmName: e.target.value }))}
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-[#0F172A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9] transition-all"
                          placeholder="Full legal name of GM"
                        />
                      </div>

                      {/* Corporate Email */}
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1.5">
                          Corporate Admin Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-[#0F172A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9] transition-all"
                          placeholder="gm@agency.com"
                        />
                      </div>

                      {/* Workspace URL Subdomain */}
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1.5">
                          Assigned Workspace Domain <span className="text-red-500">*</span>
                        </label>
                        <div className="flex rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#0EA5E9]/20 focus-within:border-[#0EA5E9] transition-all">
                          <input
                            required
                            type="text"
                            maxLength={63}
                            value={form.slug}
                            onChange={(e) => setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                            className="flex-1 px-4 py-2.5 text-sm focus:outline-none font-mono bg-white text-[#0F172A]"
                            placeholder="agency-name"
                          />
                          <span className="bg-slate-50 border-l border-slate-200 px-4 py-2.5 text-slate-500 text-xs font-mono flex items-center whitespace-nowrap">
                            .flowsensus.com
                          </span>
                        </div>
                      </div>
                    </fieldset>

                    {provisionError && (
                      <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 font-semibold">
                        {provisionError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={provisioning || !!provisionResult}
                      className="w-full bg-[#0EA5E9] hover:bg-[#0284C7] active:bg-[#0369A1] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl shadow-xs hover:shadow transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer text-sm"
                    >
                      {provisioning ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Provisioning Workspace Architecture...</span>
                        </>
                      ) : (
                        <>
                          <span>Provision Workspace</span>
                          <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Side Instructions & Architecture Checklist */}
                <div className="lg:col-span-5 space-y-5">
                  
                  {/* Verification Checklist Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
                    <h4 className="font-extrabold text-[#0F172A] text-sm mb-3">
                      Pre-Provisioning Checklist
                    </h4>
                    <ul className="space-y-3">
                      {[
                        'Agency holds an active, unexpired POEA / DMW recruitment license',
                        'Corporate business email belongs to the registered agency entity',
                        'General Manager legal identity and onboarding authority validated',
                        'No conflicting workspace exists under this license registration',
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
                          <Check size={15} className="text-[#0EA5E9] flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Architecture Process Card */}
                  <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white rounded-2xl p-6 border border-slate-800 shadow-md">
                    <p className="text-sky-400 text-[10px] font-black uppercase tracking-widest mb-3">
                      What Happens on Provision
                    </p>
                    <div className="space-y-3.5">
                      {[
                        { step: '01', title: 'Workspace Initialization', desc: 'Agency workspace record and tenancy schemas are created in the database.' },
                        { step: '02', title: 'Tenant Isolation', desc: 'Secure row-level and workspace boundaries are partitioned for the agency.' },
                        { step: '03', title: 'Admin Account Generation', desc: 'Tenant administrator identity is registered with temporary authentication.' },
                        { step: '04', title: 'System Access Ready', desc: 'Administrator signs in with temporary password and initializes staff onboarding.' },
                      ].map((s) => (
                        <div key={s.step} className="flex items-start gap-3">
                          <span className="font-mono text-sky-400 font-extrabold text-xs flex-shrink-0 mt-0.5">
                            {s.step}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-slate-100">{s.title}</p>
                            <p className="text-slate-400 text-[11px] leading-snug mt-0.5">{s.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── View: Audit Ledger ───────────────────────────────────── */}
            {view === 'audit' && (
              <div className="space-y-4">
                <DeploymentHistory activityLogs={activityLogs} applicants={applicants} />
              </div>
            )}

            {/* ── Edit Agency Modal ────────────────────────────────────── */}
            {editingAgency && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in duration-200">
                  <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
                    <div>
                      <h3 className="font-extrabold text-[#0F172A] text-base">
                        Edit Agency Workspace
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Update configuration for {editingAgency.agency_name} (ID: #{editingAgency.agency_id})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingAgency(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <form onSubmit={handleEditSubmit} className="p-6 space-y-4 text-left">
                    {editError && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
                        {editError}
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1">
                        Agency Business Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        value={editForm.agency_name}
                        onChange={(e) => setEditForm(p => ({ ...p, agency_name: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1">
                          POEA / DMW License <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={editForm.poea_license_no}
                          onChange={(e) => setEditForm(p => ({ ...p, poea_license_no: e.target.value }))}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1">
                          Agency Prefix (Code)
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={editForm.agency_prefix}
                          onChange={(e) => setEditForm(p => ({ ...p, agency_prefix: e.target.value.toUpperCase() }))}
                          placeholder="e.g. FPT"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold text-[#0F172A] uppercase focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1">
                        Workspace Subdomain Slug <span className="text-red-500">*</span>
                      </label>
                      <div className="flex rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#0EA5E9]/20 focus-within:border-[#0EA5E9]">
                        <input
                          required
                          type="text"
                          value={editForm.workspace_url}
                          onChange={(e) => setEditForm(p => ({ ...p, workspace_url: e.target.value }))}
                          className="flex-1 px-3.5 py-2 text-sm font-mono text-[#0F172A] focus:outline-none"
                        />
                        <span className="bg-slate-50 border-l border-slate-200 px-3 py-2 text-slate-500 text-xs font-mono flex items-center">
                          .flowsensus.com
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1">
                        Operational Status <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={editForm.workspace_status}
                        onChange={(e) => setEditForm(p => ({ ...p, workspace_status: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9] cursor-pointer"
                      >
                        <option value="Active">Active</option>
                        <option value="Pending Approval">Pending Approval</option>
                        <option value="Suspended">Suspended</option>
                      </select>
                    </div>

                    <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setEditingAgency(null)}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={editLoading}
                        className="px-5 py-2.5 rounded-xl bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs font-bold transition-colors shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {editLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        <span>Save Changes</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ── Toast Notification ───────────────────────────────────── */}
            {toastMessage && (
              <div className="fixed bottom-6 right-6 z-50 bg-[#0F172A] text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-200">
                <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
                <span>{toastMessage}</span>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}