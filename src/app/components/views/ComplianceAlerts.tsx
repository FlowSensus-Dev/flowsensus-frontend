import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Calendar, ShieldAlert, CheckCircle, RefreshCw, XCircle } from 'lucide-react';
import { ApplicantRecord } from '../../types';
import { api } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';

interface ComplianceAlertsProps {
  applicants?: ApplicantRecord[];
  showToast: (message: string) => void;
}

export default function ComplianceAlerts({ applicants = [], showToast }: ComplianceAlertsProps) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

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
      const alertList: any[] = Array.isArray(res.data) ? res.data : (res.data?.alerts || []);
      setAlerts(alertList);

      if (res.data?.stats) {
        setStats(res.data.stats);
      } else {
        const total = alertList.length;
        const expired = alertList.filter((a: any) => a.alert_level === 'EXPIRED').length;
        const critical = alertList.filter((a: any) => a.alert_level === 'CRITICAL_30').length;
        const warning = alertList.filter((a: any) => a.alert_level === 'WARNING_60').length;
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
      showToast('Alert dismissed');
      loadAlerts(false);
    } catch (err: any) {
      showToast(`Failed to dismiss alert: ${err.message}`);
    }
  };

  const renderIcon = (level: string) => {
    switch (level) {
      case 'EXPIRED': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'CRITICAL_30': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'WARNING_60': return <Clock className="w-5 h-5 text-amber-500" />;
      default: return <ShieldAlert className="w-5 h-5 text-slate-500" />;
    }
  };

  const renderBg = (level: string) => {
    switch (level) {
      case 'EXPIRED': return 'bg-red-50 border-red-200';
      case 'CRITICAL_30': return 'bg-orange-50 border-orange-200';
      case 'WARNING_60': return 'bg-amber-50 border-amber-200';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 w-full pb-12">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-8 h-8 text-amber-600" />
            3-2-1 Compliance Watch
          </h2>
          <p className="text-sm text-[#64748B] mt-1 font-medium">
            Automated expiration monitoring for pre-deployment documents.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => loadAlerts(true)} disabled={isLoading} className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-slate-50 text-sm font-bold">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white border rounded-xl p-4 text-center">
            <p className="text-3xl font-black text-slate-800">{stats.total_active_alerts}</p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Total Active</p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
            <p className="text-3xl font-black text-red-600">{stats.expired_count}</p>
            <p className="text-xs font-bold text-red-500 uppercase tracking-widest mt-1">Expired</p>
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-center">
            <p className="text-3xl font-black text-orange-600">{stats.critical_count}</p>
            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mt-1">30 Days</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
            <p className="text-3xl font-black text-amber-600">{stats.warning_count}</p>
            <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mt-1">60 Days</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {alerts.length === 0 && !isLoading && (
          <div className="bg-green-50 border border-green-200 text-green-800 p-8 rounded-xl text-center flex flex-col items-center">
            <CheckCircle className="w-12 h-12 mb-3 text-green-500" />
            <p className="font-bold text-lg">All Clear!</p>
            <p className="text-sm">No compliance alerts detected across active pipeline applicants.</p>
          </div>
        )}
        
        {alerts.map((a: any) => {
          const app = applicants.find(applicant => applicant.id === a.applicant_id) || { name: `Applicant #${a.applicant_id}` };
          
          return (
            <div key={a.alert_id} className={`border rounded-xl p-5 flex items-center justify-between shadow-sm ${renderBg(a.alert_level)}`}>
              <div className="flex gap-4 items-center">
                <div className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center">
                  {renderIcon(a.alert_level)}
                </div>
                <div>
                  <p className="font-bold text-[#0F172A] text-sm">
                    {a.applicant_requirement?.requirement?.requirement_name || 'Document'} • {app.name}
                  </p>
                  <p className={`text-xs font-bold mt-1 uppercase tracking-wider ${
                    a.alert_level === 'EXPIRED' ? 'text-red-600' : 'text-amber-600'
                  }`}>
                    {a.alert_level.replace('_', ' ')}: {a.message}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors">
                  Notify Applicant
                </button>
                <button 
                  onClick={() => handleDismiss(a.alert_id)}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors"
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
