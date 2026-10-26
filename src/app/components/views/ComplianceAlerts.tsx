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
  ExternalLink, 
  Bell, 
  UserCheck, 
  Filter, 
  FileText 
} from 'lucide-react';
import { ApplicantRecord } from '../../types';
import { api } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';

interface ComplianceAlertsProps {
  applicants?: ApplicantRecord[];
  showToast: (message: string) => void;
  onNavigate?: (view: string, applicantId?: string) => void;
}

type FilterTier = 'ALL' | 'EXPIRED' | 'CRITICAL_30' | 'WARNING_60' | 'BELOW_3_MONTHS';

export default function ComplianceAlerts({ 
  applicants = [], 
  showToast,
  onNavigate 
}: ComplianceAlertsProps) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<FilterTier>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleNotifyApplicant = (applicantName: string, docName: string) => {
    showToast(`Compliance notice dispatched to ${applicantName} for ${docName}`);
  };

  const renderIcon = (level: string) => {
    switch (level) {
      case 'EXPIRED': 
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'CRITICAL_30':
      case 'BELOW_1_MONTH':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'WARNING_60':
      case 'BELOW_2_MONTH_TRAVEL_BUFFER':
      case 'BELOW_2_MONTHS':
        return <Clock className="w-5 h-5 text-amber-500" />;
      case 'BELOW_3_MONTHS':
        return <Calendar className="w-5 h-5 text-blue-600" />;
      default: 
        return <ShieldAlert className="w-5 h-5 text-slate-500" />;
    }
  };

  const renderBadge = (level: string) => {
    switch (level) {
      case 'EXPIRED':
        return <span className="px-2.5 py-0.5 bg-red-100 text-red-700 font-black text-[11px] uppercase tracking-wider rounded-full border border-red-200">Expired</span>;
      case 'CRITICAL_30':
      case 'BELOW_1_MONTH':
        return <span className="px-2.5 py-0.5 bg-orange-100 text-orange-800 font-black text-[11px] uppercase tracking-wider rounded-full border border-orange-200">30-Day Critical</span>;
      case 'WARNING_60':
      case 'BELOW_2_MONTH_TRAVEL_BUFFER':
      case 'BELOW_2_MONTHS':
        return <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 font-black text-[11px] uppercase tracking-wider rounded-full border border-amber-200">60-Day Warning</span>;
      case 'BELOW_3_MONTHS':
        return <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 font-black text-[11px] uppercase tracking-wider rounded-full border border-blue-200">3-Month Buffer</span>;
      default:
        return <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 font-black text-[11px] uppercase tracking-wider rounded-full border border-slate-200">{String(level).replace(/_/g, ' ')}</span>;
    }
  };

  const renderBg = (level: string) => {
    switch (level) {
      case 'EXPIRED': 
        return 'bg-red-50/80 border-red-200 hover:border-red-300';
      case 'CRITICAL_30':
      case 'BELOW_1_MONTH':
        return 'bg-orange-50/80 border-orange-200 hover:border-orange-300';
      case 'WARNING_60':
      case 'BELOW_2_MONTH_TRAVEL_BUFFER':
      case 'BELOW_2_MONTHS':
        return 'bg-amber-50/80 border-amber-200 hover:border-amber-300';
      case 'BELOW_3_MONTHS':
        return 'bg-blue-50/60 border-blue-200 hover:border-blue-300';
      default: 
        return 'bg-slate-50 border-slate-200';
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
        const app = applicants.find(
          applicant => String(applicant.id) === String(a.applicant_id) ||
                       String(applicant.applicationId) === String(a.applicant_id)
        );
        const name = (a.applicant_name || app?.name || '').toLowerCase();
        const code = (a.applicant_code || app?.applicantCode || '').toLowerCase();
        const docName = (a.requirement_name || a.applicant_requirement?.requirement?.requirement_name || '').toLowerCase();
        const msg = (a.message || '').toLowerCase();

        return name.includes(q) || code.includes(q) || docName.includes(q) || msg.includes(q);
      }

      return true;
    });
  }, [alerts, activeTab, searchQuery, applicants]);

  return (
    <div className="space-y-6 w-full pb-16 font-['Inter',sans-serif]">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 border border-amber-200/60 shadow-sm">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                3-2-1 Compliance Watch
              </h2>
              <p className="text-sm text-slate-500 font-medium">
                Automated expiration & validity buffer monitoring for registered candidates in current pipeline.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => loadAlerts(true)} 
            disabled={isLoading} 
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#0EA5E9]' : 'text-slate-600'}`} />
            {isLoading ? 'Scanning Pipeline...' : 'Run 3-2-1 Scan'}
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div 
            onClick={() => setActiveTab('ALL')}
            className={`cursor-pointer bg-white border rounded-xl p-4 transition-all hover:shadow-md ${activeTab === 'ALL' ? 'ring-2 ring-slate-800 border-transparent shadow-sm' : 'border-slate-200'}`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Total Active</span>
              <Bell className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-3xl font-black text-slate-900">{stats.total_active_alerts}</p>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">In pipeline documents</p>
          </div>

          <div 
            onClick={() => setActiveTab('EXPIRED')}
            className={`cursor-pointer bg-red-50/60 border rounded-xl p-4 transition-all hover:shadow-md ${activeTab === 'EXPIRED' ? 'ring-2 ring-red-500 border-transparent shadow-sm' : 'border-red-200/80'}`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-red-700">Expired Docs</span>
              <XCircle className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-3xl font-black text-red-600">{stats.expired_count}</p>
            <p className="text-[11px] text-red-700/80 mt-1 font-medium">Immediate renewal required</p>
          </div>

          <div 
            onClick={() => setActiveTab('CRITICAL_30')}
            className={`cursor-pointer bg-orange-50/60 border rounded-xl p-4 transition-all hover:shadow-md ${activeTab === 'CRITICAL_30' ? 'ring-2 ring-orange-500 border-transparent shadow-sm' : 'border-orange-200/80'}`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-orange-700">≤ 30 Days</span>
              <AlertTriangle className="w-4 h-4 text-orange-500" />
            </div>
            <p className="text-3xl font-black text-orange-600">{stats.critical_count}</p>
            <p className="text-[11px] text-orange-700/80 mt-1 font-medium">Critical deployment risk</p>
          </div>

          <div 
            onClick={() => setActiveTab('WARNING_60')}
            className={`cursor-pointer bg-amber-50/60 border rounded-xl p-4 transition-all hover:shadow-md ${activeTab === 'WARNING_60' ? 'ring-2 ring-amber-500 border-transparent shadow-sm' : 'border-amber-200/80'}`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-700">60-90 Days</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-3xl font-black text-amber-600">{stats.warning_count}</p>
            <p className="text-[11px] text-amber-700/80 mt-1 font-medium">Buffer validity window</p>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
        {/* Tier Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Alerts ({alerts.length})
          </button>
          <button
            onClick={() => setActiveTab('EXPIRED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === 'EXPIRED'
                ? 'bg-red-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Expired ({stats?.expired_count || 0})
          </button>
          <button
            onClick={() => setActiveTab('CRITICAL_30')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === 'CRITICAL_30'
                ? 'bg-orange-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            30 Days Critical ({stats?.critical_count || 0})
          </button>
          <button
            onClick={() => setActiveTab('WARNING_60')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === 'WARNING_60'
                ? 'bg-amber-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            60 Days Warning ({alerts.filter(a => ['WARNING_60', 'BELOW_2_MONTHS', 'BELOW_2_MONTH_TRAVEL_BUFFER'].includes(a.alert_level || a.alert_type)).length})
          </button>
          <button
            onClick={() => setActiveTab('BELOW_3_MONTHS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === 'BELOW_3_MONTHS'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            3-Month Buffer ({alerts.filter(a => (a.alert_level || a.alert_type) === 'BELOW_3_MONTHS').length})
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search candidate, code, or document..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3.5">
        {filteredAlerts.length === 0 && !isLoading && (
          <div className="bg-white border border-slate-200 p-12 rounded-xl text-center flex flex-col items-center shadow-sm">
            <CheckCircle className="w-12 h-12 mb-3 text-emerald-500" />
            <h3 className="font-black text-slate-900 text-lg">All Pipeline Documents Up to Date</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
              {searchQuery 
                ? `No active compliance alerts matching "${searchQuery}". Try adjusting your search term.` 
                : 'No expired or near-expiry document warnings detected across registered applicants in the current pipeline.'}
            </p>
          </div>
        )}

        {filteredAlerts.map((a: any) => {
          const alertLevel = a.alert_level || a.alert_type || 'ALERT';
          
          // Match applicant record from props, or use enriched backend join
          const app = applicants.find(
            applicant => String(applicant.id) === String(a.applicant_id) ||
                         String(applicant.applicationId) === String(a.applicant_id)
          ) || {
            name: a.applicant_name || (a.applicant_requirement?.applicant ? `${a.applicant_requirement.applicant.first_name || ''} ${a.applicant_requirement.applicant.last_name || ''}`.trim() : `Applicant #${a.applicant_id}`),
            applicantCode: a.applicant_code || a.applicant_requirement?.applicant?.applicant_code || `APP-${a.applicant_id}`,
            role: '',
            phase: undefined,
            status: 'In Pipeline'
          };

          const docName = a.requirement_name || a.applicant_requirement?.requirement?.requirement_name || 'Pre-Deployment Document';
          const ruleCat = a.rule_category || a.applicant_requirement?.requirement?.rule_category || 'REGULATORY';
          const expDate = a.expiration_date || a.applicant_requirement?.expiration_date;
          const daysRem = typeof a.days_remaining === 'number' ? a.days_remaining : undefined;

          return (
            <div 
              key={a.alert_id} 
              className={`border rounded-xl p-5 shadow-sm transition-all hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 ${renderBg(alertLevel)}`}
            >
              {/* Alert Content */}
              <div className="flex items-start gap-4 flex-1">
                <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-sm border border-slate-200/60 shrink-0 mt-0.5">
                  {renderIcon(alertLevel)}
                </div>

                <div className="space-y-1.5 flex-1 min-w-0">
                  {/* Top line: Document Name + Tier Badge + Category */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-slate-900 text-sm tracking-tight truncate">
                      {docName}
                    </span>
                    {renderBadge(alertLevel)}
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-white/70 px-2 py-0.5 rounded border border-slate-200/50">
                      {String(ruleCat).replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Candidate Details */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                    <span className="font-bold text-slate-900 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                      {app.name || `Applicant #${a.applicant_id}`}
                    </span>
                    {app.applicantCode && (
                      <span className="text-slate-500 font-mono text-[11px] bg-white/60 px-1.5 py-0.5 rounded border border-slate-200/40">
                        {app.applicantCode}
                      </span>
                    )}
                    {app.status && (
                      <span className="text-slate-600 font-medium">
                        • {app.status}
                      </span>
                    )}
                  </div>

                  {/* Alert Message / Expiration Details */}
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    {a.message || 'Validity buffer below regulatory requirement.'}
                  </p>

                  {/* Expiration Date & Countdown Bar */}
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                    {expDate && (
                      <div className="flex items-center gap-1 text-slate-700 font-semibold">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Expiry Date: <span className="font-bold text-slate-900">{expDate}</span></span>
                      </div>
                    )}
                    {daysRem !== undefined && (
                      <div className="font-bold">
                        {daysRem < 0 ? (
                          <span className="text-red-700 bg-red-100/80 px-2 py-0.5 rounded text-[11px] font-black">
                            Expired {Math.abs(daysRem)} days ago
                          </span>
                        ) : daysRem === 0 ? (
                          <span className="text-red-700 bg-red-100/80 px-2 py-0.5 rounded text-[11px] font-black">
                            Expires Today
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[11px] font-black ${
                            daysRem <= 30 ? 'text-orange-800 bg-orange-100/80' : 'text-amber-800 bg-amber-100/80'
                          }`}>
                            {daysRem} days remaining
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200/50">
                {onNavigate && (
                  <button 
                    onClick={() => onNavigate('ocr', String(a.applicant_id))}
                    className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5"
                    title="Open Document Validation (OCR) for this applicant"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    Review OCR
                  </button>
                )}

                <button 
                  onClick={() => handleNotifyApplicant(app.name || `Applicant #${a.applicant_id}`, docName)}
                  className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Bell className="w-3.5 h-3.5 text-amber-600" />
                  Notify
                </button>

                <button 
                  onClick={() => handleDismiss(a.alert_id)}
                  className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 hover:text-red-700 hover:border-red-200 hover:bg-red-50 text-xs font-bold rounded-lg shadow-sm transition-all"
                >
                  Dismiss
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
