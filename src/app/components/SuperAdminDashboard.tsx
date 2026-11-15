import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import {
  Building2, BarChart3, ScrollText, UserPlus, LogOut, Search, Shield,
  Users, CheckCircle2, AlertTriangle, Clock, ArrowRight,
  Check, RefreshCw, Crown, User,
  Loader2, ExternalLink, Copy, CheckCheck, Activity,
  Edit2, X, Globe, ChevronLeft, ChevronRight
} from 'lucide-react';
import { api } from '../../lib/api';
import { Skeleton } from './ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import DeploymentHistory from './views/DeploymentHistory';
import Logo from './Logo';
import { SHARED_PORTAL, ProvisionedAgency, confirmedProvisioning, evaluateOnboardingReadiness, provisioningFailure, provisioningPayload, suggestWorkspaceCode } from '../../lib/agencyProvisioning';
import type { ReadinessKey } from '../../lib/agencyProvisioning';
import { TENANT_STATUSES, confirmedTenantUpdate, rawTenantStatus, tenantEditForm, tenantEditPayload, tenantUpdateError, validTenantStatus } from '../../lib/tenantManagement';
import { DEFAULT_AGENCY_THEME, isISODate, licenseExpiryStatus, minimumLicenseExpiry, normalizeThemeColor } from '../../lib/agencyBranding';
import { PROVISION_LOGO_WARNING, logoUploadError, uploadAgencyLogo } from '../../lib/agencyLogo';
import { AgencyAvatar, AgencyLogoPicker, AgencyThemeControl, EMPTY_LOGO } from './AgencyBrandingControls';
import type { LogoSelection } from './AgencyBrandingControls';

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
  const s = validTenantStatus(rawStatus);
  if (s === 'ACTIVE') {
    return {
      label: 'Active',
      color: '#10B981',
      bg: '#ECFDF5',
      border: '#A7F3D0',
      dot: '#10B981',
    };
  }
  if (s === 'CLOSED') {
    return {
      label: 'Closed',
      color: '#D97706',
      bg: '#FFFBEB',
      border: '#FDE68A',
      dot: '#F59E0B',
    };
  }
  if (s === 'SUSPENDED') {
    return {
      label: 'Suspended',
      color: '#DC2626',
      bg: '#FEF2F2',
      border: '#FECACA',
      dot: '#EF4444',
    };
  }
  return {
    label: rawStatus ? `Unsupported: ${rawStatus}` : 'Status unavailable',
    color: '#475569',
    bg: '#F8FAFC',
    border: '#CBD5E1',
    dot: '#64748B',
  };
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

// ─── Props ───────────────────────────────────────────────────────────────────

interface SuperAdminDashboardProps {
  onLogout: () => void;
  currentUserName?: string;
  currentUserEmail?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SuperAdminDashboard({
  onLogout,
  currentUserEmail,
}: SuperAdminDashboardProps) {
  const [view, setView] = useState<AdminView>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches);

  // Agency Workspace data fetched from GET /agency-workspaces
  const [agencies, setAgencies] = useState<any[]>([]);
  const [agenciesLoading, setAgenciesLoading] = useState(false);
  const [agenciesError, setAgenciesError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Agency management and editing state
  const [editingAgency, setEditingAgency] = useState<any | null>(null);
  const [editForm, setEditForm] = useState(tenantEditForm({}));
  const [editStatusChanged, setEditStatusChanged] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editLogo, setEditLogo] = useState<LogoSelection>(EMPTY_LOGO);
  const [editLogoWarning, setEditLogoWarning] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [tenantError, setTenantError] = useState<string | null>(null);
  const tenantUpdateLock = useRef(false);

  const handleQuickStatusChange = async (agencyId: number, newStatus: string) => {
    const agency = agencies.find((row) => row.agency_id === agencyId);
    const selectedStatus = validTenantStatus(newStatus);
    if (!agency || !selectedStatus || tenantUpdateLock.current || selectedStatus === validTenantStatus(rawTenantStatus(agency))) return;
    tenantUpdateLock.current = true;
    setTenantError(null);
    setToastMessage(null);
    setUpdatingStatusId(agencyId);
    try {
      const { data } = await api.patch(`/agency-workspaces/${agencyId}`, {
        workspace_status: selectedStatus,
        status: selectedStatus,
      });
      const updated = confirmedTenantUpdate(data, agencyId, selectedStatus);
      setAgencies((prev) =>
        prev.map((a) =>
          a.agency_id === agencyId
            ? { ...a, ...updated }
            : a
        )
      );
      setToastMessage(`Agency status updated to "${selectedStatus}"`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      setTenantError(tenantUpdateError(err));
    } finally {
      setUpdatingStatusId(null);
      tenantUpdateLock.current = false;
    }
  };

  const openEditModal = (agency: any) => {
    if (tenantUpdateLock.current) return;
    setEditingAgency(agency);
    setEditForm(tenantEditForm(agency));
    setEditStatusChanged(false);
    setEditError(null);
    setEditLogo(EMPTY_LOGO);
    setEditLogoWarning(null);
  };

  const refreshEditedLogo = async () => {
    if (!editingAgency || tenantUpdateLock.current) return;
    tenantUpdateLock.current = true;
    setEditLoading(true);
    try {
      const { data } = await api.get('/agency-workspaces');
      const row = Array.isArray(data) && data.find((a) => a.agency_id === editingAgency.agency_id);
      if (!row) throw new Error('Agency not returned');
      setAgencies(data);
      setEditingAgency((previous: any) => ({ ...previous, logo_url: row.logo_url }));
      setEditLogoWarning('Agency records refreshed. Inspect the saved logo below before choosing whether to upload again.');
    } catch {
      setEditLogoWarning('Agency records could not be refreshed. Check your connection before retrying the logo upload.');
    } finally {
      setEditLoading(false);
      tenantUpdateLock.current = false;
    }
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingAgency || tenantUpdateLock.current) return;
    if (editLogo.error) { setEditError(editLogo.error); return; }
    let payload;
    try { payload = tenantEditPayload(editingAgency, editForm, editStatusChanged); }
    catch (err) { setEditError((err as Error).message); return; }
    if (!Object.keys(payload).length && !editLogo.file) { setEditingAgency(null); return; }
    tenantUpdateLock.current = true;
    setEditLoading(true);
    setEditError(null);
    setToastMessage(null);
    setEditLogoWarning(null);
    try {
      let savedAgency = editingAgency;
      if (Object.keys(payload).length) {
        const res = await api.patch(`/agency-workspaces/${editingAgency.agency_id}`, payload);
        const updated = confirmedTenantUpdate(res.data, editingAgency.agency_id, payload.status, payload);
        savedAgency = { ...editingAgency, ...updated };
        setAgencies((prev) => prev.map((a) => a.agency_id === savedAgency.agency_id ? { ...a, ...updated } : a));
        // Confirmed profile edits are not replayed if the subsequent logo upload fails.
        setEditingAgency(savedAgency);
        setEditForm(tenantEditForm(savedAgency));
        setEditStatusChanged(false);
      }
      if (editLogo.file) {
        try {
          const logoUrl = await uploadAgencyLogo(savedAgency.agency_id, editLogo.file);
          setAgencies((prev) => prev.map((a) => a.agency_id === savedAgency.agency_id ? { ...a, logo_url: logoUrl } : a));
          setEditLogo(EMPTY_LOGO);
        } catch (error) {
          setEditLogoWarning(`${Object.keys(payload).length ? 'Agency details saved. ' : ''}${logoUploadError(error)}`);
          return;
        }
      }
      setEditingAgency(null);
      setToastMessage(`Agency "${editForm.agency_name}" updated successfully`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      setEditError(tenantUpdateError(err));
    } finally {
      setEditLoading(false);
      tenantUpdateLock.current = false;
    }
  };

  const [liveAuditLogs, setLiveAuditLogs] = useState<LiveAuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Agency Onboarding form state
  const [form, setForm] = useState({ agencyName: '', licenseNo: '', licenseExpiryDate: '', themeColor: DEFAULT_AGENCY_THEME, gmName: '', email: '', slug: '' });
  const [onboardingLogo, setOnboardingLogo] = useState<LogoSelection>(EMPTY_LOGO);
  const [provisionLogoWarning, setProvisionLogoWarning] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [provisionLogoUrl, setProvisionLogoUrl] = useState<string | null>(null);
  const workspaceCodeEdited = useRef(false);
  const provisioningLock = useRef(false);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [provisionReviewRequired, setProvisionReviewRequired] = useState(false);
  const [provisionUncertain, setProvisionUncertain] = useState(false);
  const [provisionReference, setProvisionReference] = useState<string | undefined>();
  const [agencyReload, setAgencyReload] = useState(0);
  const [provisionResult, setProvisionResult] = useState<ProvisionedAgency | null>(null);
  const [copyMessage, setCopyMessage] = useState('');
  const [hasCopied, setHasCopied] = useState(false);

  const readiness = evaluateOnboardingReadiness(form, { agencies: agencies.filter((a) => a.agency_id !== provisionResult?.agencyId), logo: onboardingLogo.file, logoError: onboardingLogo.error });
  const onboardingInputClass = 'w-full min-w-0 px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500';
  const fieldAccessibility = (key: ReadinessKey) => ({ 'aria-invalid': readiness.fields[key].status === 'Invalid', 'aria-describedby': `onboarding-status-${key}` });
  const fieldFeedback = (key: ReadinessKey) => {
    const field = key === 'logo' && provisionLogoUrl ? { status: 'Confirmed', message: 'Backend confirmed logo persistence.' }
      : key === 'logo' && provisionLogoWarning ? { status: 'Pending verification', message: 'Upload not confirmed. Retry in Tenant Management.' }
      : readiness.fields[key];
    return <p id={`onboarding-status-${key}`} className={`mt-1 text-xs ${field.status === 'Invalid' ? 'text-red-700' : 'text-slate-500'}`}>
      <span className="font-semibold">{field.status}</span> · {field.message}
    </p>;
  };

  const handleProvision = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (provisioningLock.current || provisionResult) return;
    setProvisionError(null);
    setProvisionReference(undefined);
    setProvisionUncertain(false);
    let payload;
    if (!readiness.ready) {
      const issue = Object.values(readiness.fields).find((field) => field.status === 'Invalid' || (field.status === 'Incomplete' && field !== readiness.fields.logo));
      setProvisionError(issue?.message || 'Complete the required onboarding fields.');
      return;
    }
    try { payload = provisioningPayload(form); }
    catch (error) { setProvisionError((error as Error).message); return; }
    provisioningLock.current = true;
    setProvisioning(true);
    setProvisionLogoWarning(null);
    setProvisionLogoUrl(null);
    let uncertain = false;
    let confirmed = false;
    try {
      const response = await api.post('/agency-workspaces/provision', payload);
      const result = confirmedProvisioning(response, payload);
      setProvisionResult(result);
      confirmed = true;
      setCopyMessage('');
      setHasCopied(false);
      setAgencies((prev) => [...prev.filter((row) => row.agency_id !== result.agencyId), result.workspace]);
      if (onboardingLogo.file) {
        setLogoUploading(true);
        // Provisioning is confirmed. Logo errors must never enter provisioning recovery.
        try {
          const logoUrl = await uploadAgencyLogo(result.agencyId, onboardingLogo.file);
          setProvisionLogoUrl(logoUrl);
          setAgencies((prev) => prev.map((a) => a.agency_id === result.agencyId ? { ...a, logo_url: logoUrl } : a));
        } catch {
          setProvisionLogoWarning(PROVISION_LOGO_WARNING);
        } finally { setLogoUploading(false); }
      }
      setAgencyReload(value => value + 1);
    } catch (error: unknown) {
      const issue = provisioningFailure(error);
      uncertain = issue.uncertain;
      setProvisionError(issue.message);
      setProvisionReference(issue.reference);
      setProvisionUncertain(issue.uncertain);
      setProvisionReviewRequired(issue.uncertain);
    } finally {
      provisioningLock.current = uncertain || confirmed;
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

  // Platform audit reads stay separate from tenant operational records and aggregate statistics.
  useEffect(() => {
    let cancelled = false;
    const fetchAudit = async () => {
      try {
        const res = await api.get('/audit-logs', { params: { limit: 6 } });
        const rows = Array.isArray(res.data) ? res.data : res.data?.items;
        if (!Array.isArray(rows)) throw new Error('Invalid audit response');
        if (!cancelled) setLiveAuditLogs(rows.map((row) => ({
          audit_log_id: row.audit_log_id, action: row.action, details: row.description ?? row.details ?? null,
          created_at: row.occurred_at ?? row.created_at ?? null, department: row.module ?? row.department,
        })));
      } catch {
        if (!cancelled) setAuditError('Recent platform activity is unavailable. Open Audit Ledger to retry.');
      } finally {
        if (!cancelled) setAuditLoading(false);
      }
    };
    fetchAudit();
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

  const [statistics, setStatistics] = useState<{ total_staff_users: number; total_applicants: number } | null>(null);
  const [statisticsLoading, setStatisticsLoading] = useState(true);
  const [statisticsError, setStatisticsError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const fetchStatistics = async () => {
      setStatisticsLoading(true);
      setStatistics(null);
      setStatisticsError(false);
      try {
        const { data, status } = await api.get('/agency-workspaces/statistics');
        if (status !== 200 || ![data?.total_staff_users, data?.total_applicants].every((count) => Number.isSafeInteger(count) && count >= 0)) {
          throw new Error('Invalid platform statistics');
        }
        if (!cancelled) setStatistics({ total_staff_users: data.total_staff_users, total_applicants: data.total_applicants });
      } catch {
        if (!cancelled) setStatisticsError(true);
      } finally {
        if (!cancelled) setStatisticsLoading(false);
      }
    };
    fetchStatistics();
    return () => { cancelled = true; };
  }, [agencyReload]);

  // Tenant metrics
  const tenantMetrics = {
    total: agencies.length,
    active: agencies.filter(a => {
      return validTenantStatus(rawTenantStatus(a)) === 'ACTIVE';
    }).length,
    closed: agencies.filter(a => {
      return validTenantStatus(rawTenantStatus(a)) === 'CLOSED';
    }).length,
    suspended: agencies.filter(a => {
      return validTenantStatus(rawTenantStatus(a)) === 'SUSPENDED';
    }).length,
  };

  const filtered = agencies.filter(a => {
    const q = search.toLowerCase();
    const name = (a.agency_name || '').toLowerCase();
    const lic = (a.poea_license_no || '').toLowerCase();
    const code = (a.workspace_code || a.workspace_url || '').toLowerCase();
    const stat = validTenantStatus(rawTenantStatus(a));
    const matchesSearch = q === '' || name.includes(q) || lic.includes(q) || code.includes(q);
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && stat === 'ACTIVE') ||
      (statusFilter === 'closed' && stat === 'CLOSED') ||
      (statusFilter === 'suspended' && stat === 'SUSPENDED');
    return matchesSearch && matchesStatus;
  });

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
      subtitle: 'Register agencies and create their initial Management accounts.',
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
      <aside aria-label="Super Admin sidebar" className={`${sidebarCollapsed ? 'w-[72px]' : 'w-64'} flex-shrink-0 bg-gradient-to-b from-[#0F172A] to-[#1E293B] border-r border-slate-800 flex flex-col z-20 shadow-xl transition-[width] duration-300 motion-reduce:transition-none`}>
        
        {/* FlowSensus Official Logo & Console Identity */}
        <div className={`${sidebarCollapsed ? 'px-3' : 'px-4'} py-4 border-b border-white/10`}>
          <div className="flex items-center justify-between gap-2">
            {!sidebarCollapsed && <div className="flex items-center gap-2 min-w-0">
            <Logo size="small" />
            <div className="min-w-0">
              <span className="font-extrabold text-white text-sm tracking-wide leading-none block truncate">
                FLOWSENSUS
              </span>
              <span className="text-[10px] text-sky-400 font-bold tracking-widest uppercase mt-1 block">
                GLOBAL PLATFORM
              </span>
            </div>
            </div>}
            <button type="button" aria-label={sidebarCollapsed ? 'Expand Super Admin sidebar' : 'Collapse Super Admin sidebar'}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!sidebarCollapsed} aria-controls="super-admin-navigation"
              onClick={() => setSidebarCollapsed((previous) => !previous)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-400">
              {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          {!sidebarCollapsed && <div className="mt-3 inline-flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 rounded-full px-2.5 py-1">
            <Crown size={11} className="text-amber-400" />
            <span className="text-amber-300 text-[10px] font-black tracking-wider uppercase">
              Super Admin Console
            </span>
          </div>}
        </div>

        {/* Primary Navigation */}
        <TooltipProvider delayDuration={150}>
        <nav id="super-admin-navigation" aria-label="Super Admin modules" className="flex-1 p-3 space-y-1 overflow-y-auto">
          {!sidebarCollapsed && <p className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold px-3 pt-2 pb-1.5">
            Admin Modules
          </p>}
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = view === item.key;
            const navButton = (
              <button
                key={item.key}
                type="button"
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                title={sidebarCollapsed ? item.label : undefined}
                onClick={() => setView(item.key)}
                className={`group relative w-full flex items-center gap-3 ${sidebarCollapsed ? 'justify-center px-0' : 'px-3'} py-2.5 rounded-lg text-sm font-semibold transition-colors text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400 ${
                  isActive
                    ? 'bg-[#0EA5E9]/20 text-sky-400 border-l-4 border-sky-400 shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border-l-4 border-transparent'
                }`}
              >
                <Icon size={17} className={isActive ? 'text-[#0EA5E9]' : 'text-slate-400'} />
                <span className={sidebarCollapsed ? 'sr-only' : ''}>{item.label}</span>
              </button>
            );
            return sidebarCollapsed ? <Tooltip key={item.key}>
              <TooltipTrigger asChild>{navButton}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip> : navButton;
          })}

        </nav>
        </TooltipProvider>

      </aside>

      {/* ── Main Application Canvas (Unified Light Theme) ───────────────── */}
      <div className="min-w-0 flex-1 flex flex-col overflow-hidden bg-[#F1F5F9]">

        {/* Top Header */}
        <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 flex-shrink-0 z-10 shadow-xs">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black text-[#0F172A] tracking-tight">
              {TITLES[view].title}
            </h1>
            <p className="hidden lg:block text-xs text-slate-500 font-medium">
              {TITLES[view].subtitle}
            </p>
          </div>

          <div aria-label="Super Admin account" className="ml-auto flex min-w-0 items-center gap-3">
            <Crown size={18} className="hidden sm:block shrink-0 text-amber-600" />
            <div className="min-w-0 text-right">
              <p className="text-xs font-bold text-slate-900">Super Admin</p>
              <p className="text-xs text-slate-500 break-all">{currentUserEmail || 'Email unavailable'}</p>
            </div>
            <button type="button" onClick={onLogout} aria-label="Sign Out" title="Sign Out"
              className="shrink-0 flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-sky-500">
              <LogOut size={15} /><span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Scrollable View Area */}
        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 w-full">
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

                  {/* Closed */}
                  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-amber-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
                    <div className="flex items-center justify-between mb-3 relative z-10">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Closed</p>
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center font-bold">
                        <Clock size={19} />
                      </div>
                    </div>
                    {agenciesLoading ? (
                      <Skeleton className="h-9 w-20 mt-1" />
                    ) : (
                      <p className="text-3xl sm:text-4xl font-black text-[#0F172A] mt-1 tracking-tight">
                        {tenantMetrics.closed}
                      </p>
                    )}
                    <p className="text-xs text-amber-600 mt-2 font-semibold">
                      Agencies marked Closed
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
                  <div aria-label="Platform staff statistics" aria-busy={statisticsLoading} className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-indigo-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
                    <div className="flex items-center justify-between mb-3 relative z-10">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Staff Users</p>
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center font-bold">
                        <Users size={19} />
                      </div>
                    </div>
                    {statisticsLoading ? <Skeleton className="h-9 w-20 mt-1" /> : <output aria-label="Total Staff Users count" className="block text-3xl sm:text-4xl font-black text-[#0F172A] mt-1 tracking-tight">{statistics?.total_staff_users ?? '—'}</output>}
                    <p className="text-xs text-slate-400 mt-2 font-medium">
                      Active tenant staff across agencies
                    </p>
                  </div>

                  {/* Total Applicants */}
                  <div aria-label="Platform applicant statistics" aria-busy={statisticsLoading} className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#0284C7]/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
                    <div className="flex items-center justify-between mb-3 relative z-10">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Applicants</p>
                      <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#0284C7] border border-sky-100 flex items-center justify-center font-bold">
                        <User size={19} />
                      </div>
                    </div>
                    {statisticsLoading ? <Skeleton className="h-9 w-20 mt-1" /> : <output aria-label="Total Applicants count" className="block text-3xl sm:text-4xl font-black text-[#0F172A] mt-1 tracking-tight">{statistics?.total_applicants ?? '—'}</output>}
                    <p className="text-xs text-slate-400 mt-2 font-medium">
                      Registered applicants across agencies
                    </p>
                  </div>
                </div>

                {/* Workspace Status Overview Breakdown */}
                {statisticsLoading && <p role="status" className="text-xs text-slate-500">Loading platform statistics…</p>}
                {statisticsError && <p role="status" className="text-xs text-amber-700">Platform totals unavailable. Refresh workspace status to retry.</p>}
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
                          {tenantMetrics.closed}
                        </div>
                        <div>
                          <p className="font-bold text-amber-950 text-sm">Closed Agencies</p>
                          <p className="text-amber-700 text-xs">Agency status recorded as Closed</p>
                        </div>
                      </div>

                      <div className="bg-red-50/60 border border-red-200/70 rounded-xl p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-red-500 text-white flex items-center justify-center font-black text-xl shadow-xs">
                          {tenantMetrics.suspended}
                        </div>
                        <div>
                          <p className="font-bold text-red-950 text-sm">Suspended Agencies</p>
                          <p className="text-red-700 text-xs">Agency status recorded as Suspended</p>
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

                  {auditLoading ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading platform activity…</p> : auditError ? <p role="alert" className="py-8 text-center text-sm text-amber-700">{auditError}</p> : liveAuditLogs.length === 0 ? (
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
                    <option value="closed">Closed Only</option>
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

                {tenantError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{tenantError}</p>}
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
                            const rawStatus = rawTenantStatus(t);
                            const cfg = getStatusCfg(rawStatus);
                            const urlDisplay = t.workspace_code ?? t.workspace_url ?? '—';
                            const isUpdatingThis = updatingStatusId === t.agency_id;

                            return (
                              <tr key={t.agency_id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <AgencyAvatar logoUrl={t.logo_url} name={t.agency_name || 'Agency'} fallback={t.agency_prefix} />
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
                                        {t.theme_color && /^#[0-9a-f]{6}$/i.test(t.theme_color) && <span title={`Agency Theme Color: ${normalizeThemeColor(t.theme_color)}`} aria-label={`Agency Theme Color: ${normalizeThemeColor(t.theme_color)}`} className="h-3 w-3 rounded-full border border-slate-300" style={{ backgroundColor: t.theme_color }} />}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-1 rounded">
                                    {t.poea_license_no || '—'}
                                  </span>
                                  <div className="mt-2 text-xs text-slate-500 whitespace-nowrap">Expiry: {isISODate(t.license_expiry_date) ? t.license_expiry_date : '—'}</div>
                                  <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${licenseExpiryStatus(t.license_expiry_date) === 'Expired' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {licenseExpiryStatus(t.license_expiry_date)}
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
                                      disabled={updatingStatusId !== null || editLoading}
                                      value={validTenantStatus(rawStatus)}
                                      onChange={(e) => handleQuickStatusChange(t.agency_id, e.target.value)}
                                      title="Change agency status"
                                      aria-label={`Change status for ${t.agency_name}`}
                                      className="text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1 hover:border-[#0EA5E9] focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] cursor-pointer disabled:opacity-50"
                                    >
                                      {!validTenantStatus(rawStatus) && <option value="" disabled>Unknown status — choose explicitly</option>}
                                      {TENANT_STATUSES.map((status) => <option key={status} value={status}>{status[0] + status.slice(1).toLowerCase()}</option>)}
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
                                      disabled={updatingStatusId !== null || editLoading}
                                    >
                                      <Edit2 size={13} />
                                      <span>Edit</span>
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
              <div className="w-full bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#0EA5E9] border border-sky-100 flex items-center justify-center font-bold">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-[#0F172A] text-lg">
                        Provision New Tenant Workspace
                      </h3>
                      <p className="text-slate-500 text-xs">
                        Registers an agency and creates its initial Management account.
                      </p>
                    </div>
                  </div>

                  {/* Provisioning Success Banner */}
                  {provisionResult && (
                    <div role="status" className="mb-6 rounded-2xl border border-emerald-300 bg-emerald-50/80 p-5 text-sm text-emerald-950 shadow-xs">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCheck className="w-5 h-5 text-emerald-600" />
                        <h4 className="font-black text-base text-emerald-900">
                          Agency and Initial Manager Created
                        </h4>
                      </div>
                      
                      <div className="bg-white rounded-xl border border-emerald-200 p-4 space-y-2.5 my-3 text-xs">
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-500 font-semibold">Agency Name</span>
                          <span className="font-bold text-[#0F172A]">{provisionResult.agencyName}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-500 font-semibold">Workspace Code</span>
                          <span className="font-mono text-[#0EA5E9] font-bold">{provisionResult.workspaceCode}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-2">
                          <span className="text-slate-500 font-semibold">Initial Manager Email</span>
                          <span className="font-semibold text-slate-800">{provisionResult.email}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-slate-500 font-semibold">Temporary Password</span>
                          <code className="bg-slate-100 text-slate-900 px-2 py-1 rounded font-mono font-bold select-all border border-slate-200">
                            {provisionResult.temporaryPassword}
                          </code>
                        </div>
                      </div>

                      {provisionResult.emailDispatched ? (
                        <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3 text-xs text-emerald-900 flex items-start gap-2">
                          <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                          <p>
                            An onboarding email with login credentials and initial workspace setup instructions has been sent to <strong>{provisionResult.email}</strong>.
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs">Securely share these login credentials with the initial Manager. No email has been sent.</p>
                      )}
                      <p className="mt-2 text-xs">Sign in through <a href={SHARED_PORTAL} target="_blank" rel="noreferrer" className="font-bold underline">{SHARED_PORTAL}</a>.</p>
                      {provisionResult.mustChangePassword && <p className="mt-2 text-xs font-semibold">The Manager must complete the password-change prompt at first sign-in.</p>}
                      {logoUploading && <p className="mt-2 text-xs">Uploading agency logo…</p>}
                      {provisionLogoUrl && <p className="mt-2 text-xs font-semibold">Agency logo upload confirmed.</p>}
                      {provisionLogoWarning && <p role="alert" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">{provisionLogoWarning}</p>}

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
                            if (provisioning) return;
                            setProvisionResult(null);
                            setCopyMessage('');
                            setProvisionError(null);
                            setProvisionReviewRequired(false);
                            setProvisionUncertain(false);
                            setProvisionReference(undefined);
                            workspaceCodeEdited.current = false;
                            provisioningLock.current = false;
                            setForm({ agencyName: '', licenseNo: '', licenseExpiryDate: '', themeColor: DEFAULT_AGENCY_THEME, gmName: '', email: '', slug: '' });
                            setOnboardingLogo(EMPTY_LOGO);
                            setProvisionLogoWarning(null);
                            setProvisionLogoUrl(null);
                          }}
                          disabled={provisioning}
                          className="text-xs font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                        >
                          Provision another agency
                        </button>
                      </div>

                      {copyMessage && <p className="mt-2 text-xs text-emerald-800">{copyMessage}</p>}
                    </div>
                  )}

                  <form onSubmit={handleProvision} noValidate className="space-y-4">
                    <fieldset disabled={provisioning || !!provisionResult || provisionReviewRequired} className="space-y-5 disabled:opacity-60">
                      <section aria-labelledby="onboarding-agency-heading">
                        <h4 id="onboarding-agency-heading" className="mb-3 text-sm font-bold text-slate-900">Agency and Accreditation</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                          <div className="min-w-0">
                            <label htmlFor="onboarding-agency-name" className="block mb-1.5 text-xs font-semibold text-slate-600">Agency Name *</label>
                            <input id="onboarding-agency-name" required type="text" maxLength={255} value={form.agencyName}
                              {...fieldAccessibility('agencyName')} className={onboardingInputClass}
                              onChange={(e) => setForm(p => ({ ...p, agencyName: e.target.value, slug: workspaceCodeEdited.current ? p.slug : suggestWorkspaceCode(e.target.value) }))}
                              placeholder="Agency business name" />
                            {fieldFeedback('agencyName')}
                          </div>
                          <div className="min-w-0">
                            <label htmlFor="onboarding-license" className="block mb-1.5 text-xs font-semibold text-slate-600">POEA / DMW License No. *</label>
                            <input id="onboarding-license" required type="text" maxLength={255} value={form.licenseNo}
                              {...fieldAccessibility('licenseNo')} className={onboardingInputClass}
                              onChange={(e) => setForm(p => ({ ...p, licenseNo: e.target.value }))} placeholder="POEA / DMW license number" />
                            {fieldFeedback('licenseNo')}
                          </div>
                          <div className="min-w-0">
                            <label htmlFor="onboarding-license-expiry" className="block mb-1.5 text-xs font-semibold text-slate-600">POEA / DMW License Expiry Date *</label>
                            <input id="onboarding-license-expiry" required type="date" value={form.licenseExpiryDate} min={minimumLicenseExpiry()}
                              {...fieldAccessibility('licenseExpiryDate')} className={onboardingInputClass}
                              onChange={(e) => setForm(p => ({ ...p, licenseExpiryDate: e.target.value }))} />
                            {fieldFeedback('licenseExpiryDate')}
                          </div>
                        </div>
                      </section>
                      <section aria-labelledby="onboarding-management-heading">
                        <h4 id="onboarding-management-heading" className="mb-3 text-sm font-bold text-slate-900">Initial Management and Workspace</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                          <div className="min-w-0">
                            <label htmlFor="onboarding-manager-name" className="block mb-1.5 text-xs font-semibold text-slate-600">Initial Manager / Authorized Representative *</label>
                            <input id="onboarding-manager-name" required type="text" maxLength={255} value={form.gmName}
                              {...fieldAccessibility('gmName')} className={onboardingInputClass}
                              onChange={(e) => setForm(p => ({ ...p, gmName: e.target.value }))} placeholder="Initial Manager's full name" />
                            {fieldFeedback('gmName')}
                          </div>
                          <div className="min-w-0">
                            <label htmlFor="onboarding-manager-email" className="block mb-1.5 text-xs font-semibold text-slate-600">Initial Manager Email *</label>
                            <input id="onboarding-manager-email" required type="email" maxLength={254} value={form.email}
                              {...fieldAccessibility('email')} className={onboardingInputClass}
                              onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} placeholder="manager@agency.com" />
                            {fieldFeedback('email')}
                          </div>
                          <div className="min-w-0">
                            <label htmlFor="onboarding-workspace-code" className="block mb-1.5 text-xs font-semibold text-slate-600">Workspace Code *</label>
                            <input id="onboarding-workspace-code" required type="text" maxLength={63} value={form.slug}
                              {...fieldAccessibility('slug')} className={onboardingInputClass}
                              onChange={(e) => { workspaceCodeEdited.current = true; setForm(p => ({ ...p, slug: e.target.value.toLowerCase() })); }}
                              placeholder="agency-code" />
                            {fieldFeedback('slug')}
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">Workspace Code identifies the agency within the shared application at {SHARED_PORTAL}; it does not provision a domain or separate subdomain.</p>
                      </section>
                      <section aria-labelledby="onboarding-branding-heading">
                        <h4 id="onboarding-branding-heading" className="mb-3 text-sm font-bold text-slate-900">Branding</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="min-w-0">
                            <AgencyLogoPicker id="onboarding-logo" selection={onboardingLogo} onChange={setOnboardingLogo} />
                            {fieldFeedback('logo')}
                          </div>
                          <div className="min-w-0">
                            <AgencyThemeControl id="onboarding-theme-color" value={form.themeColor} onChange={(themeColor) => setForm(p => ({ ...p, themeColor }))} />
                            {fieldFeedback('themeColor')}
                          </div>
                        </div>
                      </section>
                    </fieldset>
                    <div aria-label="Onboarding readiness" className="border-t border-slate-100 pt-3 text-xs text-slate-600">
                      <p role="status" aria-live="polite">
                        <strong>{provisionResult ? 'Confirmed' : readiness.ready ? 'Input complete' : readiness.invalid ? 'Invalid' : 'Incomplete'}</strong>
                        {' · '}{provisionResult ? `Agency #${provisionResult.agencyId} and initial Manager account created.` : readiness.ready ? 'Required input checks complete.' : `${readiness.incomplete} required fields incomplete; ${readiness.invalid} invalid.`}
                      </p>
                      {!provisionResult && <p className="mt-1"><span className="font-semibold">{readiness.verification.status}</span> · {readiness.verification.message}</p>}
                    </div>

                    {provisionError && (
                      <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 font-semibold">
                        {provisionError}
                        {provisionReference && <span className="block mt-2 font-mono">Recovery reference: {provisionReference}</span>}
                      </p>
                    )}

                    {provisionUncertain && <label className="flex items-start gap-2 text-xs text-slate-600">
                      <input type="checkbox" checked={!provisionReviewRequired} onChange={(event) => {
                        setProvisionReviewRequired(!event.target.checked);
                        provisioningLock.current = !event.target.checked;
                      }} />
                      I have verified agency and Manager account records and confirmed it is safe to submit again.
                    </label>}

                    <button
                      type="submit"
                      disabled={provisioning || !!provisionResult || provisionReviewRequired}
                      className="w-full sm:w-auto sm:ml-auto px-6 bg-[#0EA5E9] hover:bg-[#0284C7] active:bg-[#0369A1] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl shadow-xs hover:shadow transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer text-sm"
                    >
                      {provisioning ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Creating Agency and Initial Manager...</span>
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
            )}

            {/* ── View: Audit Ledger ───────────────────────────────────── */}
            {view === 'audit' && (
              <div className="space-y-4">
                <DeploymentHistory activityLogs={[]} applicants={[]} />
              </div>
            )}

            {/* ── Edit Agency Modal ────────────────────────────────────── */}
            {editingAgency && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
                <div role="dialog" aria-modal="true" aria-label="Edit Agency Workspace" className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in duration-200">
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
                      disabled={editLoading}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <form onSubmit={handleEditSubmit} noValidate className="p-6 space-y-4 text-left">
                    {editError && (
                      <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
                        {editError}
                      </div>
                    )}
                    {editLogoWarning && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                      <p>{editLogoWarning}</p>
                      <button type="button" onClick={refreshEditedLogo} disabled={editLoading} className="mt-2 font-bold underline">Refresh saved agency</button>
                    </div>}

                    <fieldset disabled={editLoading} className="space-y-4">
                    <div>
                      <label htmlFor="tenant-edit-name" className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1">
                        Agency Business Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        value={editForm.agency_name}
                        id="tenant-edit-name"
                        onChange={(e) => setEditForm(p => ({ ...p, agency_name: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="tenant-edit-license" className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1">
                          POEA / DMW License <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={editForm.poea_license_no}
                          id="tenant-edit-license"
                          onChange={(e) => setEditForm(p => ({ ...p, poea_license_no: e.target.value }))}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9]"
                        />
                      </div>
                      <div>
                        <label htmlFor="tenant-edit-prefix" className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1">
                          Agency Prefix (Code)
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={editForm.agency_prefix}
                          id="tenant-edit-prefix"
                          onChange={(e) => setEditForm(p => ({ ...p, agency_prefix: e.target.value.toUpperCase() }))}
                          placeholder="e.g. FPT"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold text-[#0F172A] uppercase focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9]"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="tenant-edit-license-expiry" className="block text-xs font-bold text-slate-600 mb-1.5">POEA / DMW License Expiry Date</label>
                      <input id="tenant-edit-license-expiry" type="date" value={editForm.license_expiry_date} min={minimumLicenseExpiry()}
                        onChange={(e) => setEditForm(p => ({ ...p, license_expiry_date: e.target.value }))}
                        aria-describedby="tenant-edit-expiry-help" className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900" />
                      <p id="tenant-edit-expiry-help" className="mt-1.5 text-xs text-slate-500">New dates must be later than today in Asia/Manila. Unchanged legacy dates are preserved. License status does not change workspace access automatically.</p>
                    </div>
                    <AgencyThemeControl id="tenant-edit-theme-color" value={editForm.theme_color} onChange={(theme_color) => setEditForm(p => ({ ...p, theme_color }))} />
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <AgencyAvatar logoUrl={editingAgency.logo_url} name={editingAgency.agency_name || 'Agency'} fallback={editingAgency.agency_prefix} />
                      <span>Saved agency logo</span>
                    </div>
                    <AgencyLogoPicker id="tenant-edit-logo" selection={editLogo} onChange={setEditLogo} currentLogoUrl={editingAgency.logo_url} />

                    <div>
                      <label htmlFor="tenant-edit-workspace" className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1">
                        Workspace Code <span className="text-red-500">*</span>
                      </label>
                      <div className="flex rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#0EA5E9]/20 focus-within:border-[#0EA5E9]">
                        <input
                          required
                          type="text"
                          value={editForm.workspace_url}
                          maxLength={63}
                          id="tenant-edit-workspace"
                          onChange={(e) => setEditForm(p => ({ ...p, workspace_url: e.target.value }))}
                          className="flex-1 px-3.5 py-2 text-sm font-mono text-[#0F172A] focus:outline-none"
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Unique agency identifier in the shared FlowSensus application.</p>
                    </div>

                    <div>
                      <label htmlFor="tenant-edit-status" className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1">
                        Operational Status <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={editForm.workspace_status}
                        id="tenant-edit-status"
                        onChange={(e) => {
                          setEditStatusChanged(true);
                          setEditForm(p => ({ ...p, workspace_status: validTenantStatus(e.target.value) }));
                        }}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9] cursor-pointer"
                      >
                        {!validTenantStatus(rawTenantStatus(editingAgency)) && <option value="" disabled>Unknown status — choose explicitly</option>}
                        {TENANT_STATUSES.map((status) => <option key={status} value={status}>{status[0] + status.slice(1).toLowerCase()}</option>)}
                      </select>
                      {!validTenantStatus(rawTenantStatus(editingAgency)) && <p className="mt-1 text-xs text-slate-600">Returned status: {rawTenantStatus(editingAgency) || 'Unavailable'}. Profile-only changes preserve this value.</p>}
                      <p className="mt-1 text-xs text-slate-500">Status is submitted only when you deliberately select a different value.</p>
                    </div>
                    </fieldset>

                    <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setEditingAgency(null)}
                        disabled={editLoading}
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
