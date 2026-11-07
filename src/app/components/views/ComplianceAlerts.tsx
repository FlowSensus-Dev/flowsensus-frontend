import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  Calendar, 
  ShieldAlert, 
  CheckCircle, 
  RefreshCw, 
  XCircle, 
  Search, 
  Bell, 
  UserCheck, 
  FileText,
  FileCheck2,
  X,
  ShieldCheck,
  LayoutGrid,
  List,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { ApplicantRecord } from '../../types';
import { api } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import {
  sendCandidateNotification,
  isCandidateDocumentNotified,
} from '../../../lib/notificationService';

interface ComplianceAlertsProps {
  applicants?: ApplicantRecord[];
  showToast: (message: string) => void;
  onNavigate?: (view: string, applicantId?: string) => void;
}

type FilterTier = 'ALL' | 'EXPIRED' | 'CRITICAL_30' | 'WARNING_60' | 'BELOW_3_MONTHS';
type ViewMode = 'cards' | 'table';

function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      const dt = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

function getInitials(name?: string): string {
  if (!name) return 'AP';
  const clean = name.replace(/^(Engr\.|Dr\.|Mr\.|Ms\.|Mrs\.)\s+/i, '').trim();
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function getPolicyGuidance(level: string, ruleCategory: string, originalMessage?: string): string {
  if (level === 'EXPIRED') {
    return 'Immediate renewal required. Deployment clearance is blocked until valid document is submitted.';
  }
  if (level === 'CRITICAL_30' || level === 'BELOW_1_MONTH') {
    return 'Critical 30-day window. Urgent renewal or replacement required before endorsement or flight clearance.';
  }
  if (level === 'WARNING_60' || level === 'BELOW_2_MONTH_TRAVEL_BUFFER' || level === 'BELOW_2_MONTHS') {
    return 'Approaching the mandatory 60-day travel buffer required for airport immigration clearance.';
  }
  if (level === 'BELOW_3_MONTHS') {
    return 'Medical and supporting records require at least 3 months validity prior to employer endorsement.';
  }
  return originalMessage || 'Validity buffer below regulatory requirement.';
}

export default function ComplianceAlerts({ 
  applicants = [], 
  showToast,
  onNavigate 
}: ComplianceAlertsProps) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<FilterTier>('ALL');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [notifiedAlertIds, setNotifiedAlertIds] = useState<Record<string, boolean>>({});
  const [sendingAlertIds, setSendingAlertIds] = useState<Record<string, boolean>>({});

  const loadAlerts = async (triggerScan = false) => {
    setIsLoading(true);
    try {
      if (triggerScan) {
        await api.post('/documents/alerts/scan').catch(console.warn);
      } else {
        // Trigger non-blocking scan in background on initial load
        api.post('/documents/alerts/scan').catch(() => {});
      }
      
      const res = await api.get('/documents/alerts');
      const alertList: any[] = Array.isArray(res.data) 
        ? res.data 
        : (res.data?.alerts || []);
      
      setAlerts(alertList);

      if (res.data?.stats) {
        setStats(res.data.stats);
      } else {
        const total = alertList.length;
        const expired = alertList.filter((a: any) => {
          const lvl = a.alert_level || a.alert_type || '';
          return lvl === 'EXPIRED';
        }).length;
        const critical = alertList.filter((a: any) => {
          const lvl = a.alert_level || a.alert_type || '';
          return lvl === 'CRITICAL_30' || lvl === 'BELOW_1_MONTH';
        }).length;
        const warning = alertList.filter((a: any) => {
          const lvl = a.alert_level || a.alert_type || '';
          return lvl === 'WARNING_60' || lvl === 'BELOW_2_MONTHS' || lvl === 'BELOW_2_MONTH_TRAVEL_BUFFER' || lvl === 'BELOW_3_MONTHS';
        }).length;
        setStats({
          total_active_alerts: total,
          expired_count: expired,
          critical_count: critical,
          warning_count: warning,
        });
      }
    } catch (err: any) {
      showToast(`Failed to load alerts: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts(false);

    // Live Real-Time Subscription to document_alert table
    const channel = supabase
      .channel('realtime:compliance_alerts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'document_alert' },
        (payload: any) => {
          console.log('[ComplianceAlerts] Realtime alert update:', payload.eventType);
          loadAlerts(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDismiss = async (alertId: number) => {
    try {
      await api.post(`/documents/alerts/${alertId}/dismiss`);
      showToast('Compliance alert dismissed and marked resolved');
      loadAlerts(false);
    } catch (err: any) {
      showToast(`Failed to dismiss alert: ${err.message}`);
    }
  };

  const resolveAlertCandidate = (a: any) => {
    const resolvedId =
      a.applicant_id ||
      a.applicant_requirement?.applicant?.applicant_id ||
      a.applicant_requirement?.applicant_id;
    const rawCode =
      a.applicant_code ||
      a.applicant_requirement?.applicant?.applicant_code ||
      undefined;

    const matched = applicants.find((applicant) => {
      if (resolvedId != null && String(applicant.id) === String(resolvedId)) {
        return true;
      }
      if (
        rawCode &&
        applicant.applicantCode &&
        applicant.applicantCode.trim().toLowerCase() === String(rawCode).trim().toLowerCase()
      ) {
        return true;
      }
      return false;
    });

    const fallbackName =
      a.applicant_name ||
      (a.applicant_requirement?.applicant
        ? `${a.applicant_requirement.applicant.first_name || ''} ${a.applicant_requirement.applicant.last_name || ''}`.trim()
        : '') ||
      (resolvedId ? `Applicant #${resolvedId}` : 'Candidate');

    return {
      applicantId: matched?.id || (resolvedId != null ? String(resolvedId) : ''),
      name: matched?.name || fallbackName,
      applicantCode: matched?.applicantCode || rawCode || (resolvedId ? `APP-${resolvedId}` : ''),
      role: matched?.role || '',
      phase: matched?.phase,
      status: matched?.status || 'In Pipeline',
    };
  };

  const handleNotifyApplicant = async (
    alertKey: string,
    applicantId: string | number,
    applicantCode: string | undefined,
    applicantName: string,
    docName: string,
    daysRemaining?: number
  ) => {
    const alreadyNotified =
      Boolean(notifiedAlertIds[alertKey]) ||
      isCandidateDocumentNotified({
        applicantId,
        applicantCode,
        documentName: docName,
      });
    if (alreadyNotified || sendingAlertIds[alertKey]) return;
    setSendingAlertIds((prev) => ({ ...prev, [alertKey]: true }));
    try {
      await sendCandidateNotification({
        applicantId,
        applicantCode,
        applicantName,
        documentName: docName,
        daysRemaining,
      });
      setNotifiedAlertIds((prev) => ({ ...prev, [alertKey]: true }));
      showToast(`Compliance notice dispatched to ${applicantName} for ${docName}`);
    } catch (err: any) {
      showToast(err?.message || `Failed to notify ${applicantName}`);
    } finally {
      setSendingAlertIds((prev) => ({ ...prev, [alertKey]: false }));
    }
  };

  const renderStatusBadge = (level: string) => {
    switch (level) {
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            Expired
          </span>
        );
      case 'CRITICAL_30':
      case 'BELOW_1_MONTH':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Critical (≤ 30 Days)
          </span>
        );
      case 'WARNING_60':
      case 'BELOW_2_MONTH_TRAVEL_BUFFER':
      case 'BELOW_2_MONTHS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            60-Day Travel Buffer
          </span>
        );
      case 'BELOW_3_MONTHS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            3-Month Medical Buffer
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            {String(level).replace(/_/g, ' ')}
          </span>
        );
    }
  };

  // Filter and search logic
  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      const level = a.alert_level || a.alert_type || '';
      
      // Tier tab filter
      if (activeTab === 'EXPIRED' && level !== 'EXPIRED') return false;
      if (activeTab === 'CRITICAL_30' && level !== 'CRITICAL_30' && level !== 'BELOW_1_MONTH') return false;
      if (activeTab === 'WARNING_60' && !['WARNING_60', 'BELOW_2_MONTHS', 'BELOW_2_MONTH_TRAVEL_BUFFER'].includes(level)) return false;
      if (activeTab === 'BELOW_3_MONTHS' && level !== 'BELOW_3_MONTHS') return false;

      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const app = resolveAlertCandidate(a);
        const name = (a.applicant_name || app.name || '').toLowerCase();
        const code = (a.applicant_code || app.applicantCode || '').toLowerCase();
        const docName = (a.requirement_name || a.applicant_requirement?.requirement?.requirement_name || '').toLowerCase();
        const msg = (a.message || '').toLowerCase();

        return name.includes(q) || code.includes(q) || docName.includes(q) || msg.includes(q);
      }

      return true;
    });
  }, [alerts, activeTab, searchQuery, applicants]);

  const count60Days = useMemo(() => {
    return alerts.filter(a => ['WARNING_60', 'BELOW_2_MONTHS', 'BELOW_2_MONTH_TRAVEL_BUFFER'].includes(a.alert_level || a.alert_type)).length;
  }, [alerts]);

  const count3Months = useMemo(() => {
    return alerts.filter(a => (a.alert_level || a.alert_type) === 'BELOW_3_MONTHS').length;
  }, [alerts]);

  return (
    <div className="space-y-6 w-full pb-16 font-['Inter',sans-serif]">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-sm shrink-0">
            <ShieldCheck className="w-6 h-6 text-[#0EA5E9]" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              3-2-1 Compliance Watch
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Automated validity buffer tracking for active pipeline candidates (3-mo Medical, 2-mo Travel Buffer, 1-mo/Expiry Stop-Gate).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button 
            onClick={() => loadAlerts(true)} 
            disabled={isLoading} 
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-xs font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-50"
            title="Scan active pipeline for document expiration and buffer alerts"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#0EA5E9]' : 'text-slate-600'}`} />
            {isLoading ? 'Scanning Pipeline...' : 'Run 3-2-1 Scan'}
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Total Active */}
          <div 
            onClick={() => setActiveTab('ALL')}
            className={`cursor-pointer bg-white border rounded-xl p-4 transition-all hover:shadow-sm ${
              activeTab === 'ALL' 
                ? 'ring-2 ring-slate-900 border-transparent shadow-sm' 
                : 'border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Active</span>
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                <Bell className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-slate-900">{stats.total_active_alerts}</p>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">In pipeline documents</p>
          </div>

          {/* Expired Docs */}
          <div 
            onClick={() => setActiveTab('EXPIRED')}
            className={`cursor-pointer bg-white border rounded-xl p-4 transition-all hover:shadow-sm ${
              activeTab === 'EXPIRED' 
                ? 'ring-2 ring-rose-500 border-transparent shadow-sm' 
                : 'border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Expired Docs</span>
              <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                <XCircle className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-rose-600">{stats.expired_count}</p>
            <p className="text-[11px] text-rose-500/80 mt-1 font-medium">Immediate renewal required</p>
          </div>

          {/* ≤ 30 Days Critical */}
          <div 
            onClick={() => setActiveTab('CRITICAL_30')}
            className={`cursor-pointer bg-white border rounded-xl p-4 transition-all hover:shadow-sm ${
              activeTab === 'CRITICAL_30' 
                ? 'ring-2 ring-amber-500 border-transparent shadow-sm' 
                : 'border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">≤ 30 Days</span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-amber-600">{stats.critical_count}</p>
            <p className="text-[11px] text-amber-600/80 mt-1 font-medium">Critical deployment risk</p>
          </div>

          {/* 60-90 Days Buffer */}
          <div 
            onClick={() => setActiveTab('WARNING_60')}
            className={`cursor-pointer bg-white border rounded-xl p-4 transition-all hover:shadow-sm ${
              activeTab === 'WARNING_60' 
                ? 'ring-2 ring-sky-500 border-transparent shadow-sm' 
                : 'border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600">60-90 Days</span>
              <div className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-sky-600">{stats.warning_count}</p>
            <p className="text-[11px] text-sky-600/80 mt-1 font-medium">Buffer validity window</p>
          </div>
        </div>
      )}

      {/* Filter Tabs, Search Bar and View Switcher */}
      <div className="bg-white p-2.5 sm:p-3 border border-slate-200/80 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        {/* Tier Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            All Alerts ({alerts.length})
          </button>
          <button
            onClick={() => setActiveTab('EXPIRED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'EXPIRED'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Expired
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'EXPIRED' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'}`}>
              {stats?.expired_count || 0}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('CRITICAL_30')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'CRITICAL_30'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            30 Days Critical
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'CRITICAL_30' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
              {stats?.critical_count || 0}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('WARNING_60')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'WARNING_60'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            60 Days Warning
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'WARNING_60' ? 'bg-white/20 text-white' : 'bg-sky-100 text-sky-700'}`}>
              {count60Days}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('BELOW_3_MONTHS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'BELOW_3_MONTHS'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            3-Month Buffer
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'BELOW_3_MONTHS' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'}`}>
              {count3Months}
            </span>
          </button>
        </div>

        {/* Search and View Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="relative min-w-[220px] sm:min-w-[260px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search candidate, code, or document..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:bg-white transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Mode Toggle: Cards vs Compact Table */}
          <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-md text-xs transition-all ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Card View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md text-xs transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Compact Ledger View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredAlerts.length === 0 && !isLoading && (
        <div className="bg-white border border-slate-200/80 p-12 rounded-xl text-center flex flex-col items-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-3">
            <CheckCircle className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 text-base">All Pipeline Documents Up to Date</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md">
            {searchQuery 
              ? `No active compliance alerts matching "${searchQuery}". Try adjusting your search term.` 
              : 'No expired documents or near-expiry buffer warnings detected across active candidates in the pipeline.'}
          </p>
        </div>
      )}

      {/* VIEW MODE 1: CARDS VIEW (Handcrafted, Executive, No AI-cliché colored border stripes or squircle boxes) */}
      {viewMode === 'cards' && filteredAlerts.length > 0 && (
        <div className="space-y-3.5">
          {filteredAlerts.map((a: any) => {
            const alertLevel = a.alert_level || a.alert_type || 'ALERT';
            const app = resolveAlertCandidate(a);
            const docName = a.requirement_name || a.applicant_requirement?.requirement?.requirement_name || 'Pre-Deployment Document';
            const alertKey = String(a.alert_id || `${app.applicantId}-${docName}`);
            const isNotified =
              Boolean(notifiedAlertIds[alertKey]) ||
              isCandidateDocumentNotified({
                applicantId: app.applicantId,
                applicantCode: app.applicantCode,
                documentName: docName,
              });
            const ruleCat = a.rule_category || a.applicant_requirement?.requirement?.rule_category || 'REGULATORY';
            const expDate = a.expiration_date || a.applicant_requirement?.expiration_date;
            const daysRem = typeof a.days_remaining === 'number' ? a.days_remaining : undefined;
            const policyNote = getPolicyGuidance(alertLevel, ruleCat, a.message);
            const initials = getInitials(app.name);

            return (
              <div 
                key={a.alert_id} 
                className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-5 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all space-y-3.5"
              >
                {/* Top Section: Candidate Profile & Status Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-200 shrink-0">
                      {initials}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => onNavigate?.('ocr', String(app.applicantId || a.applicant_id))}
                          className="font-bold text-slate-900 text-sm hover:text-[#0EA5E9] transition-colors text-left flex items-center gap-1.5"
                          title="Open candidate in Document Validation"
                        >
                          {app.name || `Applicant #${app.applicantId || a.applicant_id}`}
                        </button>
                        {app.applicantCode && (
                          <span className="font-mono text-[11px] text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                            {app.applicantCode}
                          </span>
                        )}
                        {(app.phase || app.status) && (
                          <span className="text-xs text-slate-500 font-medium">
                            • {app.phase || app.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    {renderStatusBadge(alertLevel)}
                  </div>
                </div>

                {/* Middle Section: Document Details & Compliance Expiration */}
                <div className="bg-slate-50/70 border border-slate-200/60 rounded-lg p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="font-bold text-slate-900 text-sm">{docName}</span>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-slate-200">
                        {String(ruleCat).replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {policyNote}
                    </p>
                  </div>

                  {/* Expiry & Time Remaining */}
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0 text-xs">
                    {expDate && (
                      <div className="flex items-center gap-1.5 text-slate-600 bg-white px-2.5 py-1 rounded-md border border-slate-200">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Expiry: <strong className="font-semibold text-slate-900">{formatDisplayDate(expDate)}</strong></span>
                      </div>
                    )}

                    {daysRem !== undefined && (
                      <div>
                        {daysRem < 0 ? (
                          <span className="px-2.5 py-1 rounded-md text-[11px] font-bold text-rose-700 bg-rose-100/80 border border-rose-200">
                            {Math.abs(daysRem)} {Math.abs(daysRem) === 1 ? 'day' : 'days'} overdue
                          </span>
                        ) : daysRem === 0 ? (
                          <span className="px-2.5 py-1 rounded-md text-[11px] font-bold text-rose-700 bg-rose-100/80 border border-rose-200">
                            Expires today
                          </span>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                            daysRem <= 30
                              ? 'text-amber-800 bg-amber-100/80 border-amber-200'
                              : 'text-sky-800 bg-sky-100/80 border-sky-200'
                          }`}>
                            {daysRem} {daysRem === 1 ? 'day' : 'days'} remaining
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Section: Action Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-slate-400 hidden sm:inline">
                    Flowsensus Compliance Rule: 3-2-1 POEA Buffer Check
                  </span>

                  <div className="flex items-center gap-2 justify-end">
                    {onNavigate && (
                      <button 
                        onClick={() => onNavigate('ocr', String(app.applicantId || a.applicant_id))}
                        className="px-3.5 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-all active:scale-95"
                        title="Open Document Validation workspace for this candidate"
                      >
                        <FileCheck2 className="w-3.5 h-3.5" />
                        Validate Document
                      </button>
                    )}

                    <button 
                      onClick={() =>
                        handleNotifyApplicant(
                          alertKey,
                          app.applicantId || a.applicant_id,
                          app.applicantCode,
                          app.name || `Applicant #${app.applicantId || a.applicant_id}`,
                          docName,
                          daysRem
                        )
                      }
                      disabled={isNotified || Boolean(sendingAlertIds[alertKey])}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 shadow-xs active:scale-95 ${
                        isNotified
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 cursor-default'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                      title={isNotified ? 'Notification already sent' : 'Dispatch renewal notice to candidate portal'}
                    >
                      {isNotified ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          Notice Sent
                        </>
                      ) : sendingAlertIds[alertKey] ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Bell className="w-3.5 h-3.5 text-amber-500" />
                          Notify Candidate
                        </>
                      )}
                    </button>

                    <button 
                      onClick={() => handleDismiss(a.alert_id)}
                      title="Dismiss this alert"
                      className="px-2.5 py-2 text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 hover:border-rose-100 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 2: COMPACT LEDGER TABLE (Ideal for rapid agency auditing) */}
      {viewMode === 'table' && filteredAlerts.length > 0 && (
        <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Candidate</th>
                  <th className="py-3 px-4">Document & Category</th>
                  <th className="py-3 px-4">Expiration Date</th>
                  <th className="py-3 px-4">Compliance Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAlerts.map((a: any) => {
                  const alertLevel = a.alert_level || a.alert_type || 'ALERT';
                  const app = resolveAlertCandidate(a);
                  const docName = a.requirement_name || a.applicant_requirement?.requirement?.requirement_name || 'Document';
                  const alertKey = String(a.alert_id || `${app.applicantId}-${docName}`);
                  const isNotified =
                    Boolean(notifiedAlertIds[alertKey]) ||
                    isCandidateDocumentNotified({
                      applicantId: app.applicantId,
                      applicantCode: app.applicantCode,
                      documentName: docName,
                    });
                  const ruleCat = a.rule_category || a.applicant_requirement?.requirement?.rule_category || 'REGULATORY';
                  const expDate = a.expiration_date || a.applicant_requirement?.expiration_date;
                  const daysRem = typeof a.days_remaining === 'number' ? a.days_remaining : undefined;

                  return (
                    <tr key={a.alert_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-medium">
                        <button
                          onClick={() => onNavigate?.('ocr', String(app.applicantId || a.applicant_id))}
                          className="font-bold text-slate-900 hover:text-[#0EA5E9] block text-left"
                        >
                          {app.name}
                        </button>
                        <span className="font-mono text-[11px] text-slate-500">
                          {app.applicantCode}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block">{docName}</span>
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">
                          {String(ruleCat).replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-800 block">
                          {formatDisplayDate(expDate)}
                        </span>
                        {daysRem !== undefined && (
                          <span className={`text-[11px] font-bold ${daysRem < 0 ? 'text-rose-600' : daysRem <= 30 ? 'text-amber-600' : 'text-sky-600'}`}>
                            {daysRem < 0 ? `${Math.abs(daysRem)}d overdue` : daysRem === 0 ? 'Expires today' : `${daysRem}d remaining`}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderStatusBadge(alertLevel)}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {onNavigate && (
                            <button
                              onClick={() => onNavigate('ocr', String(app.applicantId || a.applicant_id))}
                              className="px-3 py-1.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white font-semibold text-xs rounded-lg shadow-xs transition-all flex items-center gap-1 active:scale-95"
                              title="Open Document Validation workspace"
                            >
                              <FileCheck2 className="w-3.5 h-3.5" />
                              Validate
                            </button>
                          )}
                          <button
                            onClick={() =>
                              handleNotifyApplicant(
                                alertKey,
                                app.applicantId || a.applicant_id,
                                app.applicantCode,
                                app.name || `Applicant #${app.applicantId || a.applicant_id}`,
                                docName,
                                daysRem
                              )
                            }
                            disabled={isNotified || Boolean(sendingAlertIds[alertKey])}
                            className={`px-2.5 py-1.5 border text-xs font-semibold rounded-lg transition-all ${
                              isNotified 
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                            title="Send notice to candidate"
                          >
                            <Bell className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDismiss(a.alert_id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Dismiss alert"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
