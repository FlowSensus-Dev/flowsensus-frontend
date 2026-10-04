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

  const [items, setItems] = useState<AuditItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

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

    window.history.replaceState({}, '', `${url.pathname}?${sp.toString()}`);
  }, [page, pageSize, search, selectedModule, selectedAction, selectedActor, datePreset, dateFrom, dateTo, sortBy, sortDir]);

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
  const fetchAuditLogs = useCallback(async () => {
    setIsLoading(true);
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
      link.setAttribute('download', `Audit_Log_Export_${new Date().toISOString().slice(0, 10)}.csv`);
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

  // ── Action Badge Styling (Exact Flowsensus Theme) ────────────────────────
  const getActionBadge = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('CLAIM') || act.includes('VERIF') || act.includes('APPROV') || act.includes('REGISTER')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (act.includes('POOL') || act.includes('RELEASE') || act.includes('RETURN') || act.includes('REASSIGN') || act.includes('FLAG') || act.includes('LOGOUT')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (act.includes('DELETE') || act.includes('REMOVE') || act.includes('REJECT') || act.includes('PURGE') || act.includes('STOP')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (act.includes('LOGIN') || act.includes('ROLE_SWITCH')) {
      return 'bg-sky-50 text-[#0284C7] border-sky-200';
    }
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

  return (
    <div className="w-full space-y-6 pb-12 transition-all duration-300">
      {/* ── Page Header (Flowsensus Consistent Style) ────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Audit Log</h1>
            <span className="px-2.5 py-0.5 bg-sky-50 text-[#0EA5E9] text-xs font-bold rounded-full border border-sky-200">
              Immutable Ledger
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Authoritative, tamper-evident audit trail of system events, staff interactions, and applicant handoffs
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={isExporting || totalCount === 0}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold shadow-xs hover:shadow transition-all cursor-pointer disabled:opacity-50"
            title="Download audit records as CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* ── KPI Metric Summary Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Recorded Activities', val: summaryMetrics.total.toLocaleString(), color: '#0F172A', icon: Activity },
          { label: "Today's Events", val: summaryMetrics.today.toLocaleString(), color: '#10B981', icon: Clock },
          { label: 'Contributing Staff', val: summaryMetrics.actors, color: '#0EA5E9', icon: Users },
          { label: 'Modules Monitored', val: summaryMetrics.modules, color: '#6366F1', icon: Layers },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-4 sm:px-5 py-3.5 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500 font-medium">{s.label}</span>
                <Icon className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold" style={{ color: s.color }}>
                {s.val}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Dynamic Filter & Search Toolbar ──────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
        {/* Top Controls: Search & Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 items-center">
          {/* Free-text Search */}
          <div className="relative sm:col-span-2 md:col-span-4">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search description, applicant, staff..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] bg-white transition-all text-slate-800"
            />
          </div>

          {/* Module Selector */}
          <div className="md:col-span-3">
            <select
              value={selectedModule}
              onChange={(e) => { setSelectedModule(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]"
            >
              <option value="All">All Modules</option>
              {facets.modules.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Action Selector */}
          <div className="md:col-span-3">
            <select
              value={selectedAction}
              onChange={(e) => { setSelectedAction(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]"
            >
              <option value="All">All Actions</option>
              {facets.actions.map((a) => (
                <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          {/* Actor Selector */}
          <div className="md:col-span-2">
            <select
              value={selectedActor}
              onChange={(e) => { setSelectedActor(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]"
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

        {/* Bottom Row: Date Presets & Custom Picker & Reset */}
        <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-500 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Presets:
            </span>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: '7days', label: 'Last 7 Days' },
              { id: '30days', label: 'Last 30 Days' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handleDatePreset(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  datePreset === p.id
                    ? 'bg-[#0F172A] text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Range:</span>
              <input
                type="date"
                value={dateFrom ? dateFrom.slice(0, 10) : ''}
                onChange={(e) => {
                  setDatePreset('custom');
                  setDateFrom(e.target.value ? new Date(e.target.value).toISOString() : '');
                  setPage(1);
                }}
                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-none focus:border-[#0EA5E9]"
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
                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-none focus:border-[#0EA5E9]"
              />
            </div>

            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-slate-200 ml-1"
              title="Reset all active filters"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Table Container (Fully Responsive & Dynamic Sizing) ──────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Subheader Bar */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-[#0F172A] uppercase tracking-wider text-[11px]">
              Audit Activities
            </h3>
            <span className="px-2 py-0.5 bg-slate-200/80 text-slate-800 font-bold rounded text-[11px]">
              {totalCount.toLocaleString()} {totalCount === 1 ? 'Record' : 'Records'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-600">
            <div className="flex items-center gap-1.5">
              <span>Sort:</span>
              <button
                onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                className="flex items-center gap-1 font-bold text-slate-800 hover:text-[#0EA5E9] bg-white px-2.5 py-1 rounded border border-slate-200 cursor-pointer shadow-2xs transition-colors"
              >
                <span>{sortDir === 'desc' ? 'Newest First' : 'Oldest First'}</span>
                <ArrowUpDown className="w-3 h-3 text-slate-400" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }}
                className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-semibold text-slate-700"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Dynamic Content Stream */}
        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <div className="inline-block w-7 h-7 border-3 border-[#0EA5E9] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-semibold text-slate-500">Retrieving tamper-evident audit records...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center space-y-3 px-4">
            <AlertCircle className="w-9 h-9 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No audit records match the selected criteria.</p>
            <button
              onClick={handleClearFilters}
              className="text-xs text-[#0EA5E9] hover:underline font-bold cursor-pointer"
            >
              Reset filters to view all entries
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => {
              const isExpanded = !!expandedRows[item.audit_log_id];
              const hasDiff = item.changes && Object.keys(item.changes).length > 0;
              const hasMetadata = item.reason || item.ip_address || item.request_id || (item.prev_handler_name && item.new_handler_name);

              return (
                <div key={item.audit_log_id} className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors">
                  <div className="flex items-start gap-3 sm:gap-4">
                    {/* Actor Avatar */}
                    <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 text-slate-700 font-black text-xs">
                      {item.actor_name ? item.actor_name.charAt(0).toUpperCase() : 'U'}
                    </div>

                    {/* Entry Details */}
                    <div className="flex-1 min-w-0">
                      {/* Top Row: Actor, Role, Module, Timestamp */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[#0F172A] text-sm">
                            {item.actor_name || 'Staff User'}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] font-semibold rounded border border-slate-200">
                            {item.actor_role || 'Staff'}
                          </span>
                          <span className="text-slate-300 text-xs hidden sm:inline">•</span>
                          <span className="text-xs font-semibold text-slate-500">
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
                        <span className={`px-2 py-0.5 text-[11px] font-bold rounded border ${getActionBadge(item.action)}`}>
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
                        <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-900 font-medium mb-2 flex items-start gap-2">
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
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0EA5E9] hover:text-[#0284C7] bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded transition-colors cursor-pointer border border-sky-100"
                          >
                            <span>{isExpanded ? 'Hide Changes' : 'View Changes (Before / After)'}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>

                          {isExpanded && (
                            <div className="mt-3 p-3.5 bg-slate-50/90 border border-slate-200 rounded-lg space-y-3 text-xs">
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
                                    {item.prev_handler_name || 'Unassigned Pool'} → <strong className="text-slate-900">{item.new_handler_name || 'Unassigned Pool'}</strong>
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

        {/* ── Dynamic Pagination Bar ───────────────────────────────────────── */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-600 font-medium">
          <div>
            Showing <strong className="text-slate-900">{totalCount === 0 ? 0 : (page - 1) * pageSize + 1}</strong> to{' '}
            <strong className="text-slate-900">{Math.min(page * pageSize, totalCount)}</strong> of{' '}
            <strong className="text-slate-900">{totalCount.toLocaleString()}</strong> entries
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs font-semibold"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            <span className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-bold shadow-2xs">
              {page} / {Math.max(1, totalPages)}
            </span>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs font-semibold"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
