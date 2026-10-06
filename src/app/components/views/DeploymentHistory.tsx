import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
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
  Bot,
  UserCheck,
  Sparkles,
  Cpu,
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
  source?: string | null;
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
      actorType: (sp.get('auditActorType') || 'all') as 'all' | 'staff' | 'system',
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
  const [actorType, setActorType] = useState<'all' | 'staff' | 'system'>(initial.actorType);
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
    if (actorType !== 'all') sp.set('auditActorType', actorType); else sp.delete('auditActorType');
    if (selectedActor !== 'All') sp.set('auditActor', selectedActor); else sp.delete('auditActor');
    if (datePreset !== 'all') sp.set('auditDatePreset', datePreset); else sp.delete('auditDatePreset');
    if (dateFrom) sp.set('auditDateFrom', dateFrom); else sp.delete('auditDateFrom');
    if (dateTo) sp.set('auditDateTo', dateTo); else sp.delete('auditDateTo');
    if (sortBy !== 'occurred_at') sp.set('auditSortBy', sortBy); else sp.delete('auditSortBy');
    if (sortDir !== 'desc') sp.set('auditSortDir', sortDir); else sp.delete('auditSortDir');
    if (viewMode !== 'table') sp.set('auditViewMode', viewMode); else sp.delete('auditViewMode');

    window.history.replaceState({}, '', `${url.pathname}?${sp.toString()}`);
  }, [page, pageSize, search, selectedModule, selectedAction, actorType, selectedActor, datePreset, dateFrom, dateTo, sortBy, sortDir, viewMode]);

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
      if (actorType !== 'all') params.actorType = actorType;
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
        let filtered = activityLogs;
        if (actorType === 'staff') {
          filtered = filtered.filter(l => (l.performedBy || '').toUpperCase() !== 'SYSTEM');
        } else if (actorType === 'system') {
          filtered = filtered.filter(l => (l.performedBy || '').toUpperCase() === 'SYSTEM');
        }

        const fallbackItems: AuditItem[] = filtered.map((l) => ({
          audit_log_id: l.audit_log_id || parseInt(l.id.replace('LOG-', ''), 10) || 0,
          occurred_at: l.timestamp,
          actor_name: l.performedBy || 'Staff User',
          actor_role: (l.performedBy || '').toUpperCase() === 'SYSTEM' ? 'SYSTEM' : 'Staff',
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
  }, [page, pageSize, search, selectedModule, selectedAction, actorType, selectedActor, dateFrom, dateTo, sortBy, sortDir, facets.actors, syncUrlParams, activityLogs]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // ── Clear Filters ────────────────────────────────────────────────────────
  const handleClearFilters = () => {
    setSearch('');
    setSelectedModule('All');
    setSelectedAction('All');
    setSelectedActor('All');
    setActorType('all');
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
      if (actorType !== 'all') params.actorType = actorType;
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
      link.setAttribute('download', `Flowsensus_Deployment_History_${new Date().toISOString().slice(0, 10)}.csv`);
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

  // ── Helper: Is Actor System or Staff? ────────────────────────────────────
  const isSystemActor = (item: AuditItem) => {
    const role = (item.actor_role || '').toUpperCase();
    const name = (item.actor_name || '').toUpperCase();
    const src = (item.source || '').toUpperCase();
    return role === 'SYSTEM' || name === 'SYSTEM' || src === 'TRIGGER' || src === 'SYSTEM' || name.includes('TRIGGER') || name.includes('AUTOMATED');
  };

  // ── Applicant Name Resolution ────────────────────────────────────────────
  const applicantMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of applicants) {
      const displayName = a.name || `${a.firstName || ''} ${a.lastName || ''}`.trim();
      if (displayName) {
        if (a.id) map.set(String(a.id), displayName);
        if (a.applicationId) map.set(String(a.applicationId), displayName);
        if (a.applicantCode) map.set(String(a.applicantCode), displayName);
      }
    }
    return map;
  }, [applicants]);

  const resolveApplicant = useCallback((item: AuditItem): { name: string; code?: string; isResolved: boolean } | null => {
    // 1. Direct applicant_name from backend if available and not placeholder
    if (item.applicant_name && item.applicant_name.trim()) {
      const trimmed = item.applicant_name.trim();
      if (!trimmed.toLowerCase().startsWith('applicant #') && !trimmed.toLowerCase().startsWith('candidate #')) {
        return {
          name: trimmed,
          code: item.applicant_id ? `ID #${item.applicant_id}` : undefined,
          isResolved: true
        };
      }
    }

    // 2. Lookup in applicants map via applicant_id
    const targetId = item.applicant_id ? String(item.applicant_id) : (
      item.entity_type?.toLowerCase() === 'applicant' ? String(item.entity_id) : null
    );

    if (targetId && applicantMap.has(targetId)) {
      return {
        name: applicantMap.get(targetId)!,
        code: `ID #${targetId}`,
        isResolved: true
      };
    }

    // 3. Fallback to entity_label if it's a real person name
    if (item.entity_label && !item.entity_label.toLowerCase().startsWith('applicant #') && !item.entity_label.toLowerCase().startsWith('application #') && !item.entity_label.toLowerCase().startsWith('assessment #') && !item.entity_label.toLowerCase().startsWith('requirement #') && !item.entity_label.toLowerCase().startsWith('clinic #')) {
      return {
        name: item.entity_label.trim(),
        code: item.applicant_id ? `ID #${item.applicant_id}` : undefined,
        isResolved: true
      };
    }

    // 4. Default when applicant_id exists but name is unknown
    if (item.applicant_id) {
      return {
        name: `Candidate #${item.applicant_id}`,
        code: `ID #${item.applicant_id}`,
        isResolved: false
      };
    }

    return null;
  }, [applicantMap]);

  // ── Humanize Deployment History Narrative ────────────────────────────────
  const humanizeAuditText = useCallback((item: AuditItem, candidateName?: string): string => {
    let desc = item.description || '';
    const isSys = isSystemActor(item);

    // 1. Replace "Applicant #X" with the candidate's real name if known
    if (candidateName && !candidateName.toLowerCase().startsWith('candidate #') && !candidateName.toLowerCase().startsWith('applicant #')) {
      if (item.applicant_id) {
        const regex = new RegExp(`applicant\\s*#${item.applicant_id}`, 'gi');
        desc = desc.replace(regex, candidateName);
      }
    }

    // 2. Translate technical database column names to deployment milestones
    const COLUMN_MAP: Record<string, string> = {
      'application_status': 'deployment stage',
      'status_code': 'application status',
      'current_stage_id': 'pipeline stage',
      'current_phase': 'recruitment phase',
      'ocr_validation_status': 'document verification',
      'ocr_status': 'document verification',
      'fit_to_work_status': 'medical fit-to-work clearance',
      'medical_status': 'medical clinic evaluation',
      'visa_status': 'visa processing status',
      'flight_booking_status': 'departure flight schedule',
      'contract_signed_at': 'employment contract signing',
      'current_handler_user_id': 'assigned deployment officer',
      'is_active': 'candidate profile status',
      'test_scores': 'assessment scores',
    };

    for (const [col, friendly] of Object.entries(COLUMN_MAP)) {
      desc = desc.replace(new RegExp(`\\b${col}\\b`, 'gi'), friendly);
    }

    // 3. Clean up raw database status codes
    const VALUE_MAP: Record<string, string> = {
      'screening': 'Screening',
      'medical_cleared': 'Medical Clearance',
      'fit_to_work': 'Fit to Work',
      'lineup': 'Employer Lineup',
      'deployed': 'Deployed Overseas',
      'pending_verification': 'Pending Verification',
      'verified': 'Verified',
      'rejected': 'Rejected',
      'pool': 'Unassigned Candidate Pool',
    };

    for (const [val, friendly] of Object.entries(VALUE_MAP)) {
      desc = desc.replace(new RegExp(`\\b${val}\\b`, 'g'), friendly);
    }

    // 4. Polish technical diff notation
    desc = desc.replace(/\s*->\s*/g, ' → ');
    desc = desc.replace(/\s*:\s*None\s*→/g, ': (Initial) →');
    desc = desc.replace(/\s*:\s*null\s*→/g, ': (Initial) →');

    // 5. System prefix cleanup
    if (isSys) {
      desc = desc.replace(/^SYSTEM\s+/i, '');
      desc = desc.replace(/^SYSTEM\s*\(SYSTEM\)\s*/i, '');
      if (!desc.toLowerCase().startsWith('system automated') && !desc.toLowerCase().startsWith('automated')) {
        desc = `Automated update: ${desc}`;
      }
    }

    return desc;
  }, []);

  // ── Action Badge Styling ─────────────────────────────────────────────────
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
    if (m.includes('medic') || m.includes('clinic') || m.includes('fit')) return 'bg-purple-50 text-purple-700 border-purple-200';
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
    const staffEvents = items.filter(i => !isSystemActor(i)).length;
    const systemEvents = items.filter(i => isSystemActor(i)).length;

    return {
      total: totalCount,
      today: todayCount,
      staffEvents,
      systemEvents,
      actors: facets.actors.length || 1,
      modules: facets.modules.length || 1,
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
              Audit Log & Deployment History
            </h1>
            <span className="px-2.5 py-0.5 bg-sky-50 text-[#0EA5E9] text-xs font-bold rounded border border-sky-200 uppercase tracking-wider">
              Immutable Ledger
            </span>
          </div>
          <p className="text-sm text-[#64748B] mt-1 font-medium">
            Chronological audit trail of staff actions, automated system updates, and candidate deployment progress.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => fetchAuditLogs(true)}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-1.5 border border-slate-300 hover:border-slate-400 bg-white text-slate-700 px-3.5 py-2 rounded text-sm font-semibold transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            title="Refresh latest audit entries"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#0EA5E9]' : 'text-slate-500'}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
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

      {/* ── KPI Metric Summary Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {/* Card 1: Total Activities */}
        <div 
          onClick={() => { setActorType('all'); setPage(1); }}
          className={`bg-white p-4 sm:p-5 rounded-lg border-l-4 border-l-[#0F172A] shadow-sm relative overflow-hidden group cursor-pointer transition-all ${
            actorType === 'all' ? 'ring-2 ring-slate-400/50' : 'hover:shadow-md'
          }`}
          title="View all recorded activities"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs sm:text-sm font-bold text-[#64748B] uppercase tracking-wider">
              Total History
            </p>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[#0F172A] mt-2">
            {summaryMetrics.total.toLocaleString()}
          </p>
        </div>

        {/* Card 2: Staff Actions */}
        <div 
          onClick={() => { setActorType('staff'); setPage(1); }}
          className={`bg-white p-4 sm:p-5 rounded-lg border-l-4 border-l-[#0EA5E9] shadow-sm relative overflow-hidden group cursor-pointer transition-all ${
            actorType === 'staff' ? 'ring-2 ring-[#0EA5E9]/50' : 'hover:shadow-md'
          }`}
          title="Filter only Staff Actions"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs sm:text-sm font-bold text-[#0EA5E9] uppercase tracking-wider flex items-center gap-1.5">
              <span>Staff Actions</span>
            </p>
            <UserCheck className="w-4 h-4 text-[#0EA5E9]" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[#0284C7] mt-2">
            {actorType === 'staff' ? summaryMetrics.total.toLocaleString() : summaryMetrics.staffEvents.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Officers & Recruiters</p>
        </div>

        {/* Card 3: System Automated Events */}
        <div 
          onClick={() => { setActorType('system'); setPage(1); }}
          className={`bg-white p-4 sm:p-5 rounded-lg border-l-4 border-l-[#6366F1] shadow-sm relative overflow-hidden group cursor-pointer transition-all ${
            actorType === 'system' ? 'ring-2 ring-[#6366F1]/50' : 'hover:shadow-md'
          }`}
          title="Filter only System Automated Events"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs sm:text-sm font-bold text-[#6366F1] uppercase tracking-wider">
              System Events
            </p>
            <Bot className="w-4 h-4 text-[#6366F1]" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[#6366F1] mt-2">
            {actorType === 'system' ? summaryMetrics.total.toLocaleString() : summaryMetrics.systemEvents.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Triggers & OCR Automations</p>
        </div>

        {/* Card 4: Today's Events */}
        <div 
          onClick={() => handleDatePreset('today')}
          className={`bg-white p-4 sm:p-5 rounded-lg border-l-4 border-l-[#10B981] shadow-sm relative overflow-hidden group cursor-pointer transition-all ${
            datePreset === 'today' ? 'ring-2 ring-[#10B981]/50' : 'hover:shadow-md'
          }`}
          title="View only today's activities"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs sm:text-sm font-bold text-[#10B981] uppercase tracking-wider flex items-center gap-1.5">
              <span>Today's Events</span>
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            </p>
            <Clock className="w-4 h-4 text-[#10B981]" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[#10B981] mt-2">
            {summaryMetrics.today.toLocaleString()}
          </p>
        </div>
      </div>

      {/* ── Segmented Control: Staff vs System Separation ────────────────── */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center bg-slate-100 p-1 rounded-md border border-slate-200/80 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => { setActorType('all'); setPage(1); }}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
              actorType === 'all'
                ? 'bg-white text-[#0F172A] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>All Activities</span>
          </button>

          <button
            type="button"
            onClick={() => { setActorType('staff'); setPage(1); }}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
              actorType === 'staff'
                ? 'bg-white text-[#0284C7] shadow-xs ring-1 ring-sky-300'
                : 'text-slate-600 hover:text-[#0284C7]'
            }`}
          >
            <User className="w-3.5 h-3.5 text-[#0EA5E9]" />
            <span>👤 Staff Actions</span>
          </button>

          <button
            type="button"
            onClick={() => { setActorType('system'); setPage(1); }}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
              actorType === 'system'
                ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-indigo-300'
                : 'text-slate-600 hover:text-indigo-700'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-indigo-600" />
            <span>🤖 System Automated</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium px-2">
          {actorType === 'staff' && <span className="text-[#0284C7] font-bold">Showing actions logged by recruitment staff and administrators.</span>}
          {actorType === 'system' && <span className="text-indigo-700 font-bold">Showing automated background triggers, OCR, and scheduled updates.</span>}
          {actorType === 'all' && <span>Showing complete unified deployment history.</span>}
        </div>
      </div>

      {/* ── Dynamic Filter & Search Toolbar ──────────────────────────────── */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        {/* Top Row: Search Input + Module / Action / Staff Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Free-text Search */}
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search candidate name, staff, details..."
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] focus:border-[#0EA5E9] bg-white text-slate-800 placeholder-slate-400 transition-all"
            />
          </div>

          {/* Module Selector */}
          <div>
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
          <div>
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
          <div>
            <select
              value={selectedActor}
              onChange={(e) => { setSelectedActor(e.target.value); setPage(1); }}
              className="w-full border border-slate-300 rounded text-sm px-3 py-2 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] focus:border-[#0EA5E9] font-medium"
            >
              <option value="All">All Individual Actors</option>
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
          {/* Quick Date Presets */}
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
                type="button"
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
              type="button"
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
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h3 className="font-black text-[#0F172A] text-sm uppercase tracking-wider">
              {actorType === 'staff' ? 'Staff Deployment Activities' : actorType === 'system' ? 'Automated System Events' : 'All Activity Records'}
            </h3>
            <span className="px-2 py-0.5 bg-slate-200 text-slate-800 font-bold rounded text-xs">
              {totalCount.toLocaleString()} {totalCount === 1 ? 'Record' : 'Records'}
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-xs font-medium">
            {/* View Mode Switcher: Table vs Timeline */}
            <div className="flex items-center bg-slate-200/70 p-0.5 rounded border border-slate-300 h-7">
              <button
                type="button"
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
                type="button"
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
                type="button"
                onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 hover:text-[#0EA5E9] cursor-pointer shadow-2xs transition-colors"
                title="Toggle sort direction"
              >
                <span>{sortDir === 'desc' ? 'Newest' : 'Oldest'}</span>
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
              Retrieving deployment history...
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center space-y-3 px-4">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-[#0F172A]">No audit records found matching your filters.</p>
            <p className="text-xs text-slate-500">Try adjusting your filters or switching actor categories.</p>
            <button
              type="button"
              onClick={handleClearFilters}
              className="mt-2 inline-flex items-center gap-1 text-xs text-[#0EA5E9] hover:underline font-bold cursor-pointer"
            >
              Reset all filters to view all entries
            </button>
          </div>
        ) : viewMode === 'table' ? (
          /* ── 1. Dynamic Responsive Table with Inline Tap-to-Expand ─────── */
          <div className="w-full">
            {/* Desktop & Tablet Table (lg and above) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full w-full text-left border-collapse table-fixed">
                <colgroup>
                  <col style={{ width: '40px' }} />
                  <col style={{ width: '135px' }} />
                  <col style={{ width: '175px' }} />
                  <col style={{ width: '155px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '135px' }} />
                  <col style={{ width: 'auto' }} />
                  <col style={{ width: '90px' }} />
                </colgroup>
                <thead>
                  <tr className="bg-slate-50/90 text-[#0F172A] border-b border-slate-200">
                    <th className="py-3 px-2 text-center font-bold text-xs text-slate-400"></th>
                    <th className="py-3 px-3 font-black text-xs uppercase tracking-wider">Timestamp</th>
                    <th className="py-3 px-3 font-black text-xs uppercase tracking-wider">Actor & Type</th>
                    <th className="py-3 px-3 font-black text-xs uppercase tracking-wider">Candidate / Target</th>
                    <th className="py-3 px-3 font-black text-xs uppercase tracking-wider">Action</th>
                    <th className="py-3 px-3 font-black text-xs uppercase tracking-wider">Module</th>
                    <th className="py-3 px-3 font-black text-xs uppercase tracking-wider">Deployment Details</th>
                    <th className="py-3 px-3 font-black text-xs uppercase tracking-wider text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-xs">
                  {items.map((item) => {
                    const isSys = isSystemActor(item);
                    const candidate = resolveApplicant(item);
                    const humanNarrative = humanizeAuditText(item, candidate?.name);
                    const hasDiff = item.changes && Object.keys(item.changes).length > 0;
                    const isExpanded = !!expandedRows[item.audit_log_id];

                    return (
                      <Fragment key={item.audit_log_id}>
                        <tr
                          onClick={() => toggleRowExpanded(item.audit_log_id)}
                          className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                            isExpanded ? 'bg-sky-50/40' : ''
                          }`}
                        >
                          {/* Col 1: Toggle Arrow */}
                          <td className="py-3 px-2 text-center align-middle text-slate-400 group-hover:text-slate-600">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-[#0EA5E9] mx-auto" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400 mx-auto" />
                            )}
                          </td>

                          {/* Col 2: Timestamp */}
                          <td className="py-3 px-3 text-slate-600 align-top">
                            <div className="font-semibold text-slate-800">
                              {formatTimeDisplay(item.occurred_at)}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5" title={item.occurred_at}>
                              {new Date(item.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>

                          {/* Col 3: Actor & Role */}
                          <td className="py-3 px-3 align-top">
                            <div className="flex items-center gap-2">
                              {isSys ? (
                                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0 border border-indigo-200">
                                  <Bot className="w-3.5 h-3.5" />
                                </div>
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-[#0EA5E9] text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0 shadow-2xs">
                                  {getActorInitials(item.actor_name)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-bold text-[#0F172A] text-xs truncate max-w-[120px]">
                                  {isSys ? 'System Automation' : (item.actor_name || 'Staff User')}
                                </div>
                                <span className={`inline-block px-1.5 py-0.2 text-[9px] font-bold rounded border mt-0.5 ${
                                  isSys ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-sky-50 text-[#0284C7] border-sky-200'
                                }`}>
                                  {isSys ? '🤖 Automated' : `👤 ${item.actor_role || 'Staff'}`}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Col 4: Candidate / Target */}
                          <td className="py-3 px-3 align-top">
                            {candidate ? (
                              <div className="space-y-0.5">
                                <div className="font-bold text-slate-900 text-xs truncate max-w-[130px]" title={candidate.name}>
                                  {candidate.name}
                                </div>
                                {candidate.code && (
                                  <span className="text-[10px] font-medium text-[#0284C7] bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200 inline-block">
                                    {candidate.code}
                                  </span>
                                )}
                              </div>
                            ) : item.entity_label ? (
                              <span className="text-[11px] font-medium text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 inline-block truncate max-w-[130px]" title={item.entity_label}>
                                {item.entity_label}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">System Workflow</span>
                            )}
                          </td>

                          {/* Col 5: Action */}
                          <td className="py-3 px-3 align-top">
                            <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded border uppercase tracking-wider ${getActionBadge(item.action)}`}>
                              {item.action.replace(/_/g, ' ')}
                            </span>
                          </td>

                          {/* Col 6: Module */}
                          <td className="py-3 px-3 align-top">
                            <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded border ${getModuleBadge(item.module)}`}>
                              {item.module || 'Operations'}
                            </span>
                          </td>

                          {/* Col 7: Deployment Details */}
                          <td className="py-3 px-3 align-top">
                            <p className="text-xs text-slate-800 leading-relaxed font-normal break-words">
                              {humanNarrative}
                            </p>
                            {item.reason && (
                              <div className="mt-1 text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-flex items-center gap-1">
                                <span className="font-bold">Reason:</span> {item.reason}
                              </div>
                            )}
                          </td>

                          {/* Col 8: Expand Details Trigger */}
                          <td className="py-3 px-3 align-top text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowExpanded(item.audit_log_id);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0EA5E9] hover:text-[#0284C7] bg-sky-50 hover:bg-sky-100 px-2 py-1 rounded transition-colors border border-sky-200 cursor-pointer shadow-2xs"
                            >
                              <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </td>
                        </tr>

                        {/* Inline Accordion Detail View on Tap/Click */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 border-t border-slate-200">
                            <td colSpan={8} className="p-4 sm:p-5">
                              <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3 shadow-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-800 text-xs">Event Details & Metadata</span>
                                    <span className="text-[10px] text-slate-400 font-mono">Record #{item.audit_log_id}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono">
                                    {new Date(item.occurred_at).toLocaleString('en-PH')}
                                  </div>
                                </div>

                                {/* Full narrative sentence */}
                                <p className="text-xs text-slate-800 font-medium">
                                  {humanNarrative}
                                </p>

                                {/* Handler Handoff if present */}
                                {(item.prev_handler_name || item.new_handler_name) && (
                                  <div className="p-2.5 bg-sky-50/60 rounded border border-sky-100 text-xs flex items-center gap-2">
                                    <UserCheck className="w-4 h-4 text-[#0EA5E9] flex-shrink-0" />
                                    <span className="text-slate-600">Handler Reassignment:</span>
                                    <span className="font-bold text-slate-800">
                                      {item.prev_handler_name || 'Unassigned Pool'} → {item.new_handler_name || 'Unassigned Pool'}
                                    </span>
                                  </div>
                                )}

                                {/* Reason / Remarks callout */}
                                {item.reason && (
                                  <div className="p-2.5 bg-amber-50 rounded border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                      <span className="font-bold">Official Remarks / Justification:</span> {item.reason}
                                    </div>
                                  </div>
                                )}

                                {/* Granular Modifications (Old vs New Diff) */}
                                {hasDiff ? (
                                  <div className="space-y-1.5">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                      Field Modifications:
                                    </p>
                                    <div className="overflow-x-auto rounded border border-slate-200 bg-slate-50/50">
                                      <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase border-b border-slate-200">
                                          <tr>
                                            <th className="px-3 py-1.5">Attribute / Field</th>
                                            <th className="px-3 py-1.5 text-rose-700">Previous Value</th>
                                            <th className="px-3 py-1.5 text-emerald-700">Updated Value</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200/60 font-mono text-[11px]">
                                          {Object.entries(item.changes!).map(([field, diff]) => (
                                            <tr key={field} className="hover:bg-white">
                                              <td className="px-3 py-1.5 font-bold text-slate-800">
                                                {field.replace(/_/g, ' ')}
                                              </td>
                                              <td className="px-3 py-1.5 text-rose-600 bg-rose-50/30">
                                                {diff.old === null || diff.old === undefined ? <span className="text-slate-400 italic">None</span> : String(diff.old)}
                                              </td>
                                              <td className="px-3 py-1.5 text-emerald-600 bg-emerald-50/30 font-bold">
                                                {diff.new === null || diff.new === undefined ? <span className="text-slate-400 italic">None</span> : String(diff.new)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-slate-400 italic">No granular attribute diff stored for this event.</p>
                                )}

                                {/* Technical audit identifiers */}
                                <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-4 text-[10px] text-slate-400 font-mono">
                                  {item.ip_address && <span>IP: {item.ip_address}</span>}
                                  {item.request_id && <span className="truncate max-w-xs">Req: {item.request_id}</span>}
                                  <span>Module: {item.module}</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Tablet & Mobile Adaptive Cards View (Screen < 1024px) */}
            <div className="block lg:hidden divide-y divide-slate-100">
              {items.map((item) => {
                const isSys = isSystemActor(item);
                const candidate = resolveApplicant(item);
                const humanNarrative = humanizeAuditText(item, candidate?.name);
                const hasDiff = item.changes && Object.keys(item.changes).length > 0;
                const isExpanded = !!expandedRows[item.audit_log_id];

                return (
                  <div
                    key={item.audit_log_id}
                    onClick={() => toggleRowExpanded(item.audit_log_id)}
                    className={`p-4 transition-colors cursor-pointer ${
                      isExpanded ? 'bg-sky-50/30' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    {/* Header Row: Actor Badge + Time */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {isSys ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Bot className="w-3.5 h-3.5" />
                            <span>System Automated</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-sky-50 text-[#0284C7] border border-sky-200">
                            <User className="w-3 h-3" />
                            <span>{item.actor_name || 'Staff User'}</span>
                            <span className="text-slate-400 text-[10px]">({item.actor_role || 'Staff'})</span>
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimeDisplay(item.occurred_at)}</span>
                      </div>
                    </div>

                    {/* Candidate Name & Action */}
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      {candidate && (
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-[#0F172A] text-sm">
                            {candidate.name}
                          </span>
                          {candidate.code && (
                            <span className="text-[10px] font-bold text-[#0284C7] bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200">
                              {candidate.code}
                            </span>
                          )}
                        </div>
                      )}

                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded border uppercase tracking-wider ${getActionBadge(item.action)}`}>
                        {item.action.replace(/_/g, ' ')}
                      </span>

                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${getModuleBadge(item.module)}`}>
                        {item.module || 'Operations'}
                      </span>
                    </div>

                    {/* Humanized Narrative */}
                    <p className="text-xs text-slate-800 leading-relaxed font-normal mb-2">
                      {humanNarrative}
                    </p>

                    {/* Tap to Expand Bar */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                      <span className="text-[11px] font-bold text-[#0EA5E9] flex items-center gap-1">
                        {isExpanded ? 'Tap to collapse details' : 'Tap to expand changes & details'}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-[#0EA5E9]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>

                    {/* Expanded Accordion on Mobile */}
                    {isExpanded && (
                      <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200 space-y-2.5 text-xs">
                        {item.reason && (
                          <div className="p-2 bg-amber-50 rounded border border-amber-200 text-amber-900 text-xs">
                            <span className="font-bold">Remarks:</span> {item.reason}
                          </div>
                        )}

                        {(item.prev_handler_name || item.new_handler_name) && (
                          <div className="text-xs text-slate-600">
                            <strong>Handler:</strong> {item.prev_handler_name || 'Pool'} → <strong>{item.new_handler_name || 'Pool'}</strong>
                          </div>
                        )}

                        {hasDiff && (
                          <div className="space-y-1">
                            <p className="font-bold text-slate-500 text-[10px] uppercase">Modifications:</p>
                            <div className="divide-y divide-slate-100 font-mono text-[11px]">
                              {Object.entries(item.changes!).map(([field, diff]) => (
                                <div key={field} className="py-1">
                                  <div className="font-bold text-slate-700">{field.replace(/_/g, ' ')}:</div>
                                  <div className="flex items-center gap-1 mt-0.5 text-[10px]">
                                    <span className="text-rose-600 bg-rose-50 px-1 py-0.5 rounded">
                                      {diff.old === null ? 'None' : String(diff.old)}
                                    </span>
                                    <span>→</span>
                                    <span className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-bold">
                                      {diff.new === null ? 'None' : String(diff.new)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="pt-1 text-[10px] text-slate-400 font-mono">
                          Record #{item.audit_log_id} · {new Date(item.occurred_at).toLocaleString('en-PH')}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ── 2. Timeline Stream View ────────────────────────────────────── */
          <div className="divide-y divide-slate-100">
            {items.map((item) => {
              const isSys = isSystemActor(item);
              const candidate = resolveApplicant(item);
              const humanNarrative = humanizeAuditText(item, candidate?.name);
              const isExpanded = !!expandedRows[item.audit_log_id];
              const hasDiff = item.changes && Object.keys(item.changes).length > 0;
              const hasMetadata = item.reason || item.ip_address || item.request_id || (item.prev_handler_name && item.new_handler_name);

              return (
                <div key={item.audit_log_id} className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors">
                  <div className="flex items-start gap-3 sm:gap-4">
                    {/* Actor Avatar */}
                    {isSys ? (
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0 border border-indigo-200">
                        <Bot className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#0EA5E9] text-white flex items-center justify-center flex-shrink-0 font-bold text-xs shadow-2xs">
                        {getActorInitials(item.actor_name)}
                      </div>
                    )}

                    {/* Entry Details */}
                    <div className="flex-1 min-w-0">
                      {/* Top Row: Actor, Role, Module, Timestamp */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[#0F172A] text-sm">
                            {isSys ? 'System Automation' : (item.actor_name || 'Staff User')}
                          </span>
                          <span className={`px-2 py-0.2 text-[10px] font-bold rounded border ${
                            isSys ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {isSys ? '🤖 Automated' : `👤 ${item.actor_role || 'Staff'}`}
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

                      {/* Candidate Name & Action */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {candidate && (
                          <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            Candidate: {candidate.name} {candidate.code ? `(${candidate.code})` : ''}
                          </span>
                        )}

                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded border uppercase tracking-wider ${getActionBadge(item.action)}`}>
                          {item.action.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* Human-Readable Description */}
                      <p className="text-sm font-medium text-slate-800 leading-relaxed mb-1.5">
                        {humanNarrative}
                      </p>

                      {/* Reason / Remarks */}
                      {item.reason && (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 font-medium mb-2 flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Remarks:</span> {item.reason}
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
                                            <td className="px-3 py-1.5 font-bold text-slate-700">{field.replace(/_/g, ' ')}</td>
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
              type="button"
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
              type="button"
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
    </div>
  );
}
