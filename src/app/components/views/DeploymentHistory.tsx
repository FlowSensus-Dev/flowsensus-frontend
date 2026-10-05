import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  User,
  FileText,
  Search,
  Filter,
  Download,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Shield,
  Layers,
  ArrowUpDown,
  Calendar,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Activity,
  History,
  Check,
  Building2,
  Briefcase,
  Users,
  Table,
  LayoutList,
  RefreshCw,
  Eye,
  Info,
} from 'lucide-react';
import { ActivityLog, ApplicantRecord } from '../../types';
import { api } from '../../../lib/api';

interface DeploymentHistoryProps {
  activityLogs?: ActivityLog[];
  applicants?: ApplicantRecord[];
}

interface AuditItem {
  audit_log_id: number;
  id?: number;
  agency_id?: number;
  occurred_at: string;
  actor_user_id?: number | null;
  actor_name: string;
  actor_role: string;
  action: string;
  module: string;
  entity_type?: string;
  entity_id?: string;
  entity_label?: string;
  changes?: Record<string, { old: any; new: any }> | null;
  description: string;
  reason?: string | null;
  ip_address?: string | null;
  request_id?: string | null;
  applicant_id?: number | null;
  applicant_name?: string | null;
  prev_handler_name?: string | null;
  new_handler_name?: string | null;
}

interface Facets {
  modules: string[];
  actions: string[];
  actors: Array<{ actor_user_id: number | null; actor_name: string; actor_role: string }>;
}

export default function DeploymentHistory({ activityLogs = [], applicants = [] }: DeploymentHistoryProps) {
  // ── URL Query Param State Initialization ─────────────────────────────────
  const getInitialParams = () => {
    const sp = new URLSearchParams(window.location.search);
    return {
      page: parseInt(sp.get('auditPage') || '1', 10),
      pageSize: parseInt(sp.get('auditPageSize') || '50', 10),
      search: sp.get('auditSearch') || '',
      module: sp.get('auditModule') || 'All',
      action: sp.get('auditAction') || 'All',
      datePreset: sp.get('auditDatePreset') || 'all',
      dateFrom: sp.get('auditDateFrom') || '',
      dateTo: sp.get('auditDateTo') || '',
      actor: sp.get('auditActor') || 'All',
      sortBy: sp.get('auditSortBy') || 'occurred_at',
      sortDir: sp.get('auditSortDir') || 'desc',
      viewMode: (sp.get('auditViewMode') || 'table') as 'table' | 'stream',
    };
  };

  const initial = useMemo(getInitialParams, []);

  // ── State ────────────────────────────────────────────────────────────────
  const [page, setPage] = useState<number>(initial.page);
  const [pageSize, setPageSize] = useState<number>(initial.pageSize);
  const [search, setSearch] = useState<string>(initial.search);
  const [selectedModule, setSelectedModule] = useState<string>(initial.module);
  const [selectedAction, setSelectedAction] = useState<string>(initial.action);
  const [selectedActor, setSelectedActor] = useState<string>(initial.actor);
  const [datePreset, setDatePreset] = useState<string>(initial.datePreset);
  const [dateFrom, setDateFrom] = useState<string>(initial.dateFrom);
  const [dateTo, setDateTo] = useState<string>(initial.dateTo);
  const [sortBy, setSortBy] = useState<string>(initial.sortBy);
  const [sortDir, setSortDir] = useState<string>(initial.sortDir);
  const [viewMode, setViewMode] = useState<'table' | 'stream'>(initial.viewMode);

  const [items, setItems] = useState<AuditItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [selectedDiffItem, setSelectedDiffItem] = useState<AuditItem | null>(null);

  const [facets, setFacets] = useState<Facets>({
    modules: [],
    actions: [],
    actors: [],
  });

  // ── Sync URL Query Parameters ────────────────────────────────────────────
  const syncUrlParams = useCallback(() => {
    const url = new URL(window.location.href);
    const sp = url.searchParams;

    if (page > 1) sp.set('auditPage', String(page)); else sp.delete('auditPage');
    if (pageSize !== 50) sp.set('auditPageSize', String(pageSize)); else sp.delete('auditPageSize');
    if (search.trim()) sp.set('auditSearch', search.trim()); else sp.delete('auditSearch');
    if (selectedModule !== 'All') sp.set('auditModule', selectedModule); else sp.delete('auditModule');
    if (selectedAction !== 'All') sp.set('auditAction', selectedAction); else sp.delete('auditAction');
    if (selectedActor !== 'All') sp.set('auditActor', selectedActor); else sp.delete('auditActor');
    if (datePreset !== 'all') sp.set('auditDatePreset', datePreset); else sp.delete('auditDatePreset');
    if (dateFrom) sp.set('auditDateFrom', dateFrom); else sp.delete('auditDateFrom');
    if (dateTo) sp.set('auditDateTo', dateTo); else sp.delete('auditDateTo');
    if (sortBy !== 'occurred_at') sp.set('auditSortBy', sortBy); else sp.delete('auditSortBy');
    if (sortDir !== 'desc') sp.set('auditSortDir', sortDir); else sp.delete('auditSortDir');
    if (viewMode !== 'table') sp.set('auditViewMode', viewMode); else sp.delete('auditViewMode');

    window.history.replaceState({}, '', `${url.pathname}?${sp.toString()}`);
  }, [page, pageSize, search, selectedModule, selectedAction, selectedActor, datePreset, dateFrom, dateTo, sortBy, sortDir, viewMode]);

  // ── Load Facets on Mount ─────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    api.get('/audit-logs/facets')
      .then((res) => {
        if (isMounted && res.data) {
          setFacets({
            modules: res.data.modules || [],
            actions: res.data.actions || [],
            actors: res.data.actors || [],
          });
        }
      })
      .catch((err) => {
        console.warn('Could not load audit facets:', err);
      });
    return () => { isMounted = false; };
  }, []);

  // ── Date Preset Handler ──────────────────────────────────────────────────
  const handleDatePreset = (preset: string) => {
    setDatePreset(preset);
    setPage(1);
    const now = new Date();

    if (preset === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      setDateFrom(todayStart.toISOString());
      setDateTo(now.toISOString());
    } else if (preset === '7days') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setDateFrom(past.toISOString());
      setDateTo(now.toISOString());
    } else if (preset === '30days') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setDateFrom(past.toISOString());
      setDateTo(now.toISOString());
    } else if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    }
  };

  // ── Fetch Audit Logs ─────────────────────────────────────────────────────
  const fetchAuditLogs = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    syncUrlParams();

    try {
      const params: Record<string, any> = {
        page,
        pageSize,
        sortBy,
        sortDir,
      };

      if (search.trim()) params.search = search.trim();
      if (selectedModule !== 'All') params.module = selectedModule;
      if (selectedAction !== 'All') params.action = selectedAction;
      if (selectedActor !== 'All') {
        const actorObj = facets.actors.find(a => a.actor_name === selectedActor);
        if (actorObj && actorObj.actor_user_id) {
          params.actorUserId = actorObj.actor_user_id;
        } else {
          params.search = selectedActor;
        }
      }
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const res = await api.get('/audit-logs', { params });

      if (res.data) {
        if (res.data.items && typeof res.data.total === 'number') {
          setItems(res.data.items);
          setTotalCount(res.data.total);
          setTotalPages(res.data.total_pages || 1);
        } else if (Array.isArray(res.data)) {
          setItems(res.data);
          setTotalCount(res.data.length);
          setTotalPages(1);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch paginated audit logs, falling back to local props:', err);
      if (activityLogs && activityLogs.length > 0) {
        const fallbackItems: AuditItem[] = activityLogs.map((l) => ({
          audit_log_id: l.audit_log_id || parseInt(l.id.replace('LOG-', ''), 10) || 0,
          occurred_at: l.timestamp,
          actor_name: l.performedBy || 'Staff User',
          actor_role: 'Staff',
          action: l.action,
          module: l.department || 'Operations',
          entity_label: l.applicantId ? `Applicant #${l.applicantId}` : undefined,
          description: l.details || '',
          applicant_id: l.applicantId ? parseInt(l.applicantId, 10) : null,
        }));
        setItems(fallbackItems.slice((page - 1) * pageSize, page * pageSize));
        setTotalCount(fallbackItems.length);
        setTotalPages(Math.ceil(fallbackItems.length / pageSize) || 1);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, pageSize, search, selectedModule, selectedAction, selectedActor, dateFrom, dateTo, sortBy, sortDir, facets.actors, syncUrlParams, activityLogs]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // ── Clear Filters ────────────────────────────────────────────────────────
  const handleClearFilters = () => {
    setSearch('');
    setSelectedModule('All');
    setSelectedAction('All');
    setSelectedActor('All');
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
    setSortBy('occurred_at');
    setSortDir('desc');
    setPage(1);
  };

  // ── CSV Export ───────────────────────────────────────────────────────────
  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const params: Record<string, any> = {
        sortBy,
        sortDir,
      };
      if (search.trim()) params.search = search.trim();
      if (selectedModule !== 'All') params.module = selectedModule;
      if (selectedAction !== 'All') params.action = selectedAction;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const response = await api.get('/audit-logs/export', {
        params,
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Flowsensus_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV Export failed:', err);
      alert('Could not generate CSV export. Please check network connection.');
    } finally {
      setIsExporting(false);
    }
  };

  const toggleRowExpanded = (id: number) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Action Badge Styling (Exact Flowsensus System Tokens) ────────────────
  const getActionBadge = (action: string) => {
    const act = (action || '').toUpperCase();
    if (act.includes('CLAIM') || act.includes('VERIF') || act.includes('APPROV') || act.includes('REGISTER') || act.includes('PASS')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (act.includes('POOL') || act.includes('RELEASE') || act.includes('RETURN') || act.includes('REASSIGN') || act.includes('FLAG') || act.includes('LOGOUT') || act.includes('PROVISIONAL')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (act.includes('DELETE') || act.includes('REMOVE') || act.includes('REJECT') || act.includes('PURGE') || act.includes('STOP') || act.includes('FAIL')) {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    if (act.includes('LOGIN') || act.includes('ROLE_SWITCH') || act.includes('SCORE') || act.includes('USER')) {
      return 'bg-sky-50 text-[#0284C7] border-sky-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getModuleBadge = (moduleName: string) => {
    const m = (moduleName || '').toLowerCase();
    if (m.includes('screen') || m.includes('regist')) return 'bg-sky-50 text-[#0284C7] border-sky-200';
    if (m.includes('medic') || m.includes('clinic')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (m.includes('cv') || m.includes('profile')) return 'bg-pink-50 text-pink-700 border-pink-200';
    if (m.includes('employ') || m.includes('endorse')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (m.includes('deploy') || m.includes('visa')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (m.includes('manage') || m.includes('admin')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  // ── Summary KPI Metrics ──────────────────────────────────────────────────
  const summaryMetrics = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayCount = items.filter(i => (i.occurred_at || '').slice(0, 10) === todayStr).length;
    const uniqueActors = new Set(items.map(i => i.actor_name).filter(Boolean)).size;
    const uniqueModules = new Set(items.map(i => i.module).filter(Boolean)).size;

    return {
      total: totalCount,
      today: todayCount,
      actors: Math.max(uniqueActors, facets.actors.length),
      modules: Math.max(uniqueModules, facets.modules.length),
    };
  }, [items, totalCount, facets]);

  // Formats relative or localized time
  const formatTimeDisplay = (isoStr: string) => {
    if (!isoStr) return '—';
    const date = new Date(isoStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActorInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="w-full max-w-full space-y-6 pb-12 transition-all duration-300">
      {/* ── Page Header (Flowsensus Consistent Style) ────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A]">
              Audit Log
            </h1>
            <span className="px-2.5 py-0.5 bg-sky-50 text-[#0EA5E9] text-xs font-bold rounded border border-sky-200 uppercase tracking-wider">
              Immutable Ledger
            </span>
          </div>
          <p className="text-sm text-[#64748B] mt-1 font-medium">
            Tamper-evident, chronological audit trail of all staff activities, applicant state transitions, and system events.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            onClick={() => fetchAuditLogs(true)}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-1.5 border border-slate-300 hover:border-slate-400 bg-white text-slate-700 px-3.5 py-2 rounded text-sm font-semibold transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            title="Refresh latest audit entries"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#0EA5E9]' : 'text-slate-500'}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={isExporting || totalCount === 0}
            className="flex items-center gap-2 border border-slate-300 hover:border-slate-400 bg-white text-slate-700 px-3.5 py-2 rounded text-sm font-semibold transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            title="Download audit records as CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* ── KPI Metric Summary Cards (Signature Flowsensus Card Layout) ───── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Card 1: Total Activities */}
        <div className="bg-white p-5 sm:p-6 rounded-lg border-l-4 border-l-[#0F172A] shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#0F172A]/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="flex items-center justify-between">
            <p className="text-xs sm:text-sm font-bold text-[#64748B] uppercase tracking-wider">
              Total Recorded Logs
            </p>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-3xl sm:text-4xl font-black text-[#0F172A] mt-2">
            {summaryMetrics.total.toLocaleString()}
          </p>
        </div>

        {/* Card 2: Today's Events (Highlighted) */}
        <div 
          onClick={() => handleDatePreset('today')}
          className={`bg-white p-5 sm:p-6 rounded-lg border-l-4 border-l-[#10B981] shadow-sm relative overflow-hidden group cursor-pointer transition-all ${
            datePreset === 'today' ? 'ring-2 ring-[#10B981]/50' : 'hover:shadow-md'
          }`}
          title="Click to view only today's activities"
        >
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#10B981]/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="flex items-center justify-between">
            <p className="text-xs sm:text-sm font-bold text-[#10B981] uppercase tracking-wider flex items-center gap-1.5">
              <span>Today's Activities</span>
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            </p>
            <Clock className="w-4 h-4 text-[#10B981]" />
          </div>
          <p className="text-3xl sm:text-4xl font-black text-[#10B981] mt-2">
            {summaryMetrics.today.toLocaleString()}
          </p>
        </div>

        {/* Card 3: Contributing Actors */}
        <div className="bg-white p-5 sm:p-6 rounded-lg border-l-4 border-l-[#0EA5E9] shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#0EA5E9]/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="flex items-center justify-between">
            <p className="text-xs sm:text-sm font-bold text-[#64748B] uppercase tracking-wider">
              Contributing Staff
            </p>
            <Users className="w-4 h-4 text-[#0EA5E9]" />
          </div>
          <p className="text-3xl sm:text-4xl font-black text-[#0F172A] mt-2">
            {summaryMetrics.actors}
          </p>
        </div>

        {/* Card 4: Modules Monitored */}
        <div className="bg-white p-5 sm:p-6 rounded-lg border-l-4 border-l-[#6366F1] shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#6366F1]/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="flex items-center justify-between">
            <p className="text-xs sm:text-sm font-bold text-[#64748B] uppercase tracking-wider">
              Modules Monitored
            </p>
            <Layers className="w-4 h-4 text-[#6366F1]" />
          </div>
          <p className="text-3xl sm:text-4xl font-black text-[#0F172A] mt-2">
            {summaryMetrics.modules}
          </p>
        </div>
      </div>

      {/* ── Dynamic Filter & Search Toolbar (Flowsensus Signature Controls) ─ */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        {/* Top Row: Search Input + Module / Action / Staff Dropdowns */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Free-text Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by description, applicant name, or staff member..."
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] focus:border-[#0EA5E9] bg-white text-slate-800 placeholder-slate-400 transition-all"
            />
          </div>

          {/* Module Selector */}
          <div className="min-w-[140px] flex-shrink-0">
            <select
              value={selectedModule}
              onChange={(e) => { setSelectedModule(e.target.value); setPage(1); }}
              className="w-full border border-slate-300 rounded text-sm px-3 py-2 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] focus:border-[#0EA5E9] font-medium"
            >
              <option value="All">All Modules</option>
              {facets.modules.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Action Selector */}
          <div className="min-w-[140px] flex-shrink-0">
            <select
              value={selectedAction}
              onChange={(e) => { setSelectedAction(e.target.value); setPage(1); }}
              className="w-full border border-slate-300 rounded text-sm px-3 py-2 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] focus:border-[#0EA5E9] font-medium"
            >
              <option value="All">All Actions</option>
              {facets.actions.map((a) => (
                <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          {/* Actor Selector */}
          <div className="min-w-[140px] flex-shrink-0">
            <select
              value={selectedActor}
              onChange={(e) => { setSelectedActor(e.target.value); setPage(1); }}
              className="w-full border border-slate-300 rounded text-sm px-3 py-2 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] focus:border-[#0EA5E9] font-medium"
            >
              <option value="All">All Staff</option>
              {facets.actors.map((act) => (
                <option key={act.actor_name} value={act.actor_name}>
                  {act.actor_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bottom Row: Date Presets & Custom Picker & Reset Controls */}
        <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs">
          {/* Quick Date Presets (Flowsensus Pill Navigation Style) */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px] mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Presets:
            </span>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: `Today (${summaryMetrics.today})` },
              { id: '7days', label: 'Last 7 Days' },
              { id: '30days', label: 'Last 30 Days' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handleDatePreset(p.id)}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                  datePreset === p.id
                    ? 'bg-[#0F172A] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range & Reset Button */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded border border-slate-200">
              <span className="text-slate-500 font-semibold text-[11px]">Range:</span>
              <input
                type="date"
                value={dateFrom ? dateFrom.slice(0, 10) : ''}
                onChange={(e) => {
                  setDatePreset('custom');
                  setDateFrom(e.target.value ? new Date(e.target.value).toISOString() : '');
                  setPage(1);
                }}
                className="bg-white border border-slate-300 rounded px-2 py-0.5 text-slate-700 text-xs focus:outline-none focus:border-[#0EA5E9]"
              />
              <span className="text-slate-400">–</span>
              <input
                type="date"
                value={dateTo ? dateTo.slice(0, 10) : ''}
                onChange={(e) => {
                  setDatePreset('custom');
                  setDateTo(e.target.value ? new Date(e.target.value).toISOString() : '');
                  setPage(1);
                }}
                className="bg-white border border-slate-300 rounded px-2 py-0.5 text-slate-700 text-xs focus:outline-none focus:border-[#0EA5E9]"
              />
            </div>

            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 rounded transition-colors cursor-pointer border border-slate-200"
              title="Reset all active filters"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Data View Container (Dynamic Sizing & Layout) ───────────── */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {/* Table / Stream Subheader Bar */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h3 className="font-black text-[#0F172A] text-sm uppercase tracking-wider">
              Audit Activities
            </h3>
            <span className="px-2 py-0.5 bg-slate-200 text-slate-800 font-bold rounded text-xs">
              {totalCount.toLocaleString()} {totalCount === 1 ? 'Record' : 'Records'}
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-xs font-medium">
            {/* View Mode Switcher: Table vs Stream */}
            <div className="flex items-center bg-slate-200/70 p-0.5 rounded border border-slate-300 h-7">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 h-full px-2.5 rounded text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-[#0F172A] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Switch to Table Grid View"
              >
                <Table className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
              <button
                onClick={() => setViewMode('stream')}
                className={`flex items-center gap-1.5 h-full px-2.5 rounded text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'stream'
                    ? 'bg-white text-[#0F172A] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Switch to Activity Timeline Stream View"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Timeline</span>
              </button>
            </div>

            {/* Sort Toggle */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Sort:</span>
              <button
                onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 hover:text-[#0EA5E9] cursor-pointer shadow-2xs transition-colors"
                title="Toggle sort direction"
              >
                <span>{sortDir === 'desc' ? 'Newest First' : 'Oldest First'}</span>
                <ArrowUpDown className="w-3 h-3 text-slate-400" />
              </button>
            </div>

            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Show:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }}
                className="h-7 px-2 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer shadow-2xs"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Loading State */}
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <div className="inline-block w-8 h-8 border-3 border-[#0EA5E9] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Retrieving authoritative audit records...
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center space-y-3 px-4">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-[#0F172A]">No audit records found matching your filters.</p>
            <p className="text-xs text-slate-500">Try adjusting your search criteria or resetting filters.</p>
            <button
              onClick={handleClearFilters}
              className="mt-2 inline-flex items-center gap-1 text-xs text-[#0EA5E9] hover:underline font-bold cursor-pointer"
            >
              Reset all filters to view all entries
            </button>
          </div>
        ) : viewMode === 'table' ? (
          /* ── 1. Flowsensus Tabular Data-Grid (Dynamic Sizing across Screens) ─ */
          <div className="overflow-x-auto min-w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/90 text-[#0F172A] border-b border-slate-200">
                  <th className="px-5 py-3.5 font-black text-xs uppercase tracking-wider whitespace-nowrap w-[170px]">
                    Timestamp
                  </th>
                  <th className="px-5 py-3.5 font-black text-xs uppercase tracking-wider whitespace-nowrap w-[180px]">
                    Actor & Role
                  </th>
                  <th className="px-5 py-3.5 font-black text-xs uppercase tracking-wider whitespace-nowrap w-[130px]">
                    Action
                  </th>
                  <th className="px-5 py-3.5 font-black text-xs uppercase tracking-wider whitespace-nowrap w-[140px]">
                    Target / Entity
                  </th>
                  <th className="px-5 py-3.5 font-black text-xs uppercase tracking-wider whitespace-nowrap w-[120px]">
                    Module
                  </th>
                  <th className="px-5 py-3.5 font-black text-xs uppercase tracking-wider">
                    Description & Remarks
                  </th>
                  <th className="px-5 py-3.5 font-black text-xs uppercase tracking-wider text-right w-[110px]">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-xs">
                {items.map((item) => {
                  const hasDiff = item.changes && Object.keys(item.changes).length > 0;
                  const isExpanded = !!expandedRows[item.audit_log_id];

                  return (
                    <tr
                      key={item.audit_log_id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* 1. Timestamp */}
                      <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap align-top">
                        <div className="font-semibold text-slate-800">
                          {formatTimeDisplay(item.occurred_at)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5" title={item.occurred_at}>
                          {new Date(item.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </td>

                      {/* 2. Actor & Role */}
                      <td className="px-5 py-3.5 align-top whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[#0EA5E9] text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0 shadow-2xs">
                            {getActorInitials(item.actor_name)}
                          </div>
                          <div>
                            <div className="font-bold text-[#0F172A] text-xs">
                              {item.actor_name || 'Staff User'}
                            </div>
                            <span className="inline-block px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded border border-slate-200 mt-0.5">
                              {item.actor_role || 'Staff'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 3. Action */}
                      <td className="px-5 py-3.5 align-top whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded border uppercase tracking-wider ${getActionBadge(item.action)}`}>
                          {item.action.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* 4. Target / Applicant */}
                      <td className="px-5 py-3.5 align-top whitespace-nowrap">
                        {item.applicant_id ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-[#0284C7] bg-sky-50 px-2 py-0.5 rounded border border-sky-200 text-[11px] inline-block">
                              Applicant #{item.applicant_id}
                            </span>
                            {item.applicant_name && (
                              <div className="text-[11px] text-slate-600 truncate max-w-[130px]">
                                {item.applicant_name}
                              </div>
                            )}
                          </div>
                        ) : item.entity_label ? (
                          <span className="text-[11px] font-medium text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 inline-block">
                            {item.entity_label}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">System</span>
                        )}
                      </td>

                      {/* 5. Module */}
                      <td className="px-5 py-3.5 align-top whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded border ${getModuleBadge(item.module)}`}>
                          {item.module || 'General'}
                        </span>
                      </td>

                      {/* 6. Description & Remarks */}
                      <td className="px-5 py-3.5 align-top">
                        <p className="text-xs text-slate-800 leading-relaxed font-normal">
                          {item.description}
                        </p>
                        {item.reason && (
                          <div className="mt-1 text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-flex items-center gap-1">
                            <span className="font-bold">Reason:</span> {item.reason}
                          </div>
                        )}
                        {(item.prev_handler_name || item.new_handler_name) && (
                          <div className="mt-1 text-[10px] text-slate-500 font-medium">
                            Handler: {item.prev_handler_name || 'Pool'} → <strong className="text-slate-800">{item.new_handler_name || 'Pool'}</strong>
                          </div>
                        )}
                      </td>

                      {/* 7. Changes Details */}
                      <td className="px-5 py-3.5 align-top text-right whitespace-nowrap">
                        {hasDiff ? (
                          <button
                            type="button"
                            onClick={() => setSelectedDiffItem(item)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0EA5E9] hover:text-[#0284C7] bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded transition-colors border border-sky-200 cursor-pointer shadow-2xs"
                            title="Inspect field-level modifications"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Diff ({Object.keys(item.changes!).length})</span>
                          </button>
                        ) : (
                          <span className="text-slate-300 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ── 2. Flowsensus Timeline Stream View (Responsive Feed Layout) ── */
          <div className="divide-y divide-slate-100">
            {items.map((item) => {
              const isExpanded = !!expandedRows[item.audit_log_id];
              const hasDiff = item.changes && Object.keys(item.changes).length > 0;
              const hasMetadata = item.reason || item.ip_address || item.request_id || (item.prev_handler_name && item.new_handler_name);

              return (
                <div key={item.audit_log_id} className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors">
                  <div className="flex items-start gap-3 sm:gap-4">
                    {/* Actor Avatar */}
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#0EA5E9] text-white flex items-center justify-center flex-shrink-0 font-bold text-xs shadow-2xs">
                      {getActorInitials(item.actor_name)}
                    </div>

                    {/* Entry Details */}
                    <div className="flex-1 min-w-0">
                      {/* Top Row: Actor, Role, Module, Timestamp */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[#0F172A] text-sm">
                            {item.actor_name || 'Staff User'}
                          </span>
                          <span className="px-2 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded border border-slate-200">
                            {item.actor_role || 'Staff'}
                          </span>
                          <span className="text-slate-300 text-xs hidden sm:inline">•</span>
                          <span className={`text-[10px] font-bold px-2 py-0.2 rounded border ${getModuleBadge(item.module)}`}>
                            {item.module || 'Operations'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{new Date(item.occurred_at).toLocaleString('en-PH')}</span>
                        </div>
                      </div>

                      {/* Action & Entity Badges */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded border uppercase tracking-wider ${getActionBadge(item.action)}`}>
                          {item.action.replace(/_/g, ' ')}
                        </span>

                        {item.entity_label && (
                          <span className="text-[11px] font-semibold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                            <FileText className="w-3 h-3 text-slate-400" />
                            {item.entity_label}
                          </span>
                        )}

                        {item.applicant_id && (
                          <span className="text-[11px] font-bold text-[#0284C7] bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                            Applicant #{item.applicant_id}
                          </span>
                        )}
                      </div>

                      {/* Human-Readable Description Sentence */}
                      <p className="text-sm font-medium text-slate-800 leading-relaxed mb-1.5">
                        {item.description}
                      </p>

                      {/* Reason / Remarks */}
                      {item.reason && (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 font-medium mb-2 flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Reason / Remarks:</span> {item.reason}
                          </div>
                        </div>
                      )}

                      {/* Expandable Accordion for Diff & Context */}
                      {(hasDiff || hasMetadata) && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => toggleRowExpanded(item.audit_log_id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0EA5E9] hover:text-[#0284C7] bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded transition-colors cursor-pointer border border-sky-200"
                          >
                            <span>{isExpanded ? 'Hide Changes' : 'View Changes (Before / After)'}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>

                          {isExpanded && (
                            <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded space-y-3 text-xs">
                              {/* Changes Diff Table */}
                              {hasDiff && (
                                <div>
                                  <p className="font-bold text-slate-600 mb-1.5 uppercase tracking-wider text-[10px]">
                                    Field-Level Modifications:
                                  </p>
                                  <div className="overflow-x-auto rounded border border-slate-200 bg-white">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-slate-50 text-slate-600 font-bold text-[10px] uppercase border-b border-slate-200">
                                        <tr>
                                          <th className="px-3 py-2">Field</th>
                                          <th className="px-3 py-2 text-rose-700">Before</th>
                                          <th className="px-3 py-2 text-emerald-700">After</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                                        {Object.entries(item.changes!).map(([field, diff]) => (
                                          <tr key={field} className="hover:bg-slate-50">
                                            <td className="px-3 py-1.5 font-bold text-slate-700">{field}</td>
                                            <td className="px-3 py-1.5 text-rose-600 bg-rose-50/20">
                                              {diff.old === null || diff.old === undefined ? <span className="text-slate-400 italic">null</span> : String(diff.old)}
                                            </td>
                                            <td className="px-3 py-1.5 text-emerald-600 bg-emerald-50/20 font-bold">
                                              {diff.new === null || diff.new === undefined ? <span className="text-slate-400 italic">null</span> : String(diff.new)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* Handler Handoff Information */}
                              {(item.prev_handler_name || item.new_handler_name) && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="font-semibold text-slate-600">Handler:</span>
                                  <span className="text-slate-500">
                                    {(item.prev_handler_name === 'Unassigned Pool' ? 'Unassigned' : item.prev_handler_name) || 'Unassigned'} → <strong className="text-slate-900">{(item.new_handler_name === 'Unassigned Pool' ? 'Unassigned' : item.new_handler_name) || 'Unassigned'}</strong>
                                  </span>
                                </div>
                              )}

                              {/* Technical Metadata */}
                              <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-4 text-[11px] text-slate-400 font-mono">
                                <span>Record: #{item.audit_log_id}</span>
                                {item.ip_address && <span>IP: {item.ip_address}</span>}
                                {item.request_id && <span className="truncate max-w-xs">Req: {item.request_id}</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Dynamic Pagination Bar (Flowsensus Consistent Layout) ─────────── */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-600 font-medium">
          <div>
            Showing <strong className="text-[#0F172A]">{totalCount === 0 ? 0 : (page - 1) * pageSize + 1}</strong> to{' '}
            <strong className="text-[#0F172A]">{Math.min(page * pageSize, totalCount)}</strong> of{' '}
            <strong className="text-[#0F172A]">{totalCount.toLocaleString()}</strong> entries
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="flex items-center gap-1 px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs font-semibold text-slate-700"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            <span className="px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-800 font-bold shadow-2xs">
              {page} / {Math.max(1, totalPages)}
            </span>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="flex items-center gap-1 px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs font-semibold text-slate-700"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Field Modification Diff Modal (When Viewing from Table) ────────── */}
      {selectedDiffItem && (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded border uppercase ${getActionBadge(selectedDiffItem.action)}`}>
                    {selectedDiffItem.action.replace(/_/g, ' ')}
                  </span>
                  <h3 className="font-bold text-[#0F172A] text-base">Field-Level Modifications</h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Audit Record #{selectedDiffItem.audit_log_id} · Logged by {selectedDiffItem.actor_name} ({selectedDiffItem.actor_role})
                </p>
              </div>
              <button
                onClick={() => setSelectedDiffItem(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg cursor-pointer px-2"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-700 font-medium">
              {selectedDiffItem.description}
            </p>

            {selectedDiffItem.changes && Object.keys(selectedDiffItem.changes).length > 0 ? (
              <div className="overflow-x-auto rounded border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold text-[11px] uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-2">Field</th>
                      <th className="px-3.5 py-2 text-rose-700">Before</th>
                      <th className="px-3.5 py-2 text-emerald-700">After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {Object.entries(selectedDiffItem.changes).map(([field, diff]) => (
                      <tr key={field} className="hover:bg-slate-50">
                        <td className="px-3.5 py-2 font-bold text-slate-800">{field}</td>
                        <td className="px-3.5 py-2 text-rose-600 bg-rose-50/20">
                          {diff.old === null || diff.old === undefined ? <span className="text-slate-400 italic">null</span> : String(diff.old)}
                        </td>
                        <td className="px-3.5 py-2 text-emerald-600 bg-emerald-50/20 font-bold">
                          {diff.new === null || diff.new === undefined ? <span className="text-slate-400 italic">null</span> : String(diff.new)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 text-center text-slate-500 text-xs rounded border border-slate-200">
                No granular field diff recorded for this event.
              </div>
            )}

            {selectedDiffItem.reason && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 font-medium">
                <span className="font-bold">Remarks:</span> {selectedDiffItem.reason}
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedDiffItem(null)}
                className="bg-[#0F172A] hover:bg-slate-800 text-white px-4 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
