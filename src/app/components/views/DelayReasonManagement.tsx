import React, { useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../../../lib/api';
import { DelayReason, DelayStage, delayReasonError, delayReasonPayload } from '../../../lib/forecastPenalties';

export interface DelayReasonManagementProps {
  reasons: DelayReason[];
  stages: DelayStage[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<boolean>;
  canEdit: boolean;
}

export default function DelayReasonManagement({ reasons, stages, loading, error, refresh, canEdit }: DelayReasonManagementProps) {
  const [form, setForm] = useState<{ id: number | null; reason: string; days: string; stage: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const busy = useRef(false);
  const editable = canEdit && !denied;
  const observed = form?.id != null && reasons.some((row) => row.exception_type_id === form.id && row.observation_count > 0);
  const start = (row?: DelayReason) => {
    if (!editable || loading || saving || (row && row.observation_count !== 0)) return;
    setForm({ id: row?.exception_type_id ?? null, reason: row?.reason_name ?? '', days: row ? String(row.seed_penalty_days) : '', stage: row?.workflow_stage_id == null ? '' : String(row.workflow_stage_id) });
    setSaveError(null); setSuccess(null);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form || !editable || observed || loading || busy.current) return;
    setSaveError(null); setSuccess(null);
    let payload;
    try { payload = delayReasonPayload(form.reason, form.days, form.stage, stages); }
    catch (err: any) { setSaveError(err.message); return; }
    busy.current = true; setSaving(true);
    try {
      if (form.id === null) await api.post('/forecasting/penalties', payload);
      else await api.put(`/forecasting/penalties/${form.id}`, payload);
    } catch (err: any) {
      setSaveError(delayReasonError(err));
      if (err.response?.status === 403) setDenied(true);
      if (err.response?.status === 409) {
        try { await refresh(); } catch { /* Keep the failed save and draft visible. */ }
      }
      busy.current = false; setSaving(false);
      return;
    }
    setForm(null);
    setSuccess('Delay reason saved.');
    try {
      if (!await refresh()) setSuccess('Delay reason saved, but the list could not be fully refreshed. Reload before using configured delays.');
    } catch { setSuccess('Delay reason saved, but the list could not be refreshed. Reload before using configured delays.'); }
    finally { busy.current = false; setSaving(false); }
  };
  const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50';
  return <div className="space-y-3 text-xs">
    <div className="flex flex-wrap justify-between items-center gap-2">
      <p className="text-slate-500">Configure initial delay estimates. Observation counts describe stored history; this interface does not enable live SES learning.</p>
      <div className="flex gap-3 shrink-0">
        <button type="button" disabled={loading || saving} onClick={() => void refresh()} className="font-semibold text-sky-700 disabled:opacity-50">Reload</button>
        {editable && <button type="button" disabled={loading || saving || !!error} onClick={() => start()} className="rounded-lg bg-sky-600 px-3 py-2 font-bold text-white hover:bg-sky-700 disabled:opacity-50">+ Add Delay Reason</button>}
      </div>
    </div>
    {loading && <p role="status" className="flex items-center gap-2 text-slate-500"><RefreshCw size={12} className="animate-spin" />Loading delay reasons…</p>}
    {error && <p role="alert" className="text-rose-700">{error}</p>}
    {saveError && <p role="alert" className="text-rose-700">{saveError}</p>}
    {success && <p role="status" className="text-emerald-700">{success}</p>}
    {form && <form onSubmit={save} noValidate className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
      <p className="font-semibold text-slate-800">{form.id === null ? 'Add Delay Reason' : 'Edit Delay Reason'}</p>
      <fieldset disabled={saving || loading || !editable || observed} className="grid sm:grid-cols-3 gap-3">
        <label>Delay Reason<input id="delay-reason-name" value={form.reason} required className={`${inputClass} mt-1`} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>
        <label>Applicable Stage<select id="delay-reason-stage" value={form.stage} className={`${inputClass} mt-1`} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
          <option value="">All Stages</option>
          {form.stage && !stages.some((stage) => String(stage.workflow_stage_id) === form.stage) && <option value={form.stage} disabled>Stage unavailable — select an active stage</option>}
          {stages.map((stage) => <option key={stage.workflow_stage_id} value={stage.workflow_stage_id}>{stage.stage_name}</option>)}
        </select></label>
        <label>Initial Estimated Delay (Days)<input id="delay-reason-days" type="number" min="0" max="365" step="any" required value={form.days} className={`${inputClass} mt-1`} onChange={(e) => setForm({ ...form, days: e.target.value })} /></label>
      </fieldset>
      {observed && <p className="text-slate-500">Read-only: this reason now has resolution observations. Its learned estimate cannot be overwritten.</p>}
      <div className="flex items-center gap-3">
        {editable && !observed && <button type="submit" disabled={saving || loading || !!error} className="rounded-lg bg-sky-600 px-3 py-2 font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save Delay Reason'}</button>}
        <button type="button" disabled={saving} onClick={() => { setForm(null); setSaveError(null); }} className="font-semibold text-slate-600 disabled:opacity-50">Cancel</button>
      </div>
    </form>}
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-left"><thead className="bg-slate-50 text-slate-500"><tr>
        {['Delay Reason', 'Applicable Stage', 'Initial Estimated Delay', 'Current Estimated Delay', 'Resolution Observations', 'Actions'].map((label) => <th key={label} className="px-3 py-2 font-semibold">{label}</th>)}
      </tr></thead><tbody className="divide-y divide-slate-100">
        {reasons.map((row) => <tr key={row.exception_type_id}>
          <td className="px-3 py-3 font-semibold text-slate-800">{row.reason_name}</td>
          <td className="px-3 py-3">{row.workflow_stage_id === null ? 'All Stages' : row.stage_name ?? 'Stage unavailable'}</td>
          <td className="px-3 py-3 font-mono">{row.seed_penalty_days} days</td>
          <td className="px-3 py-3"><span className="font-mono">{row.current_weight_days} days</span><span className="block text-[11px] text-slate-500">{row.observation_count === 0 ? 'Initial Estimate' : 'Stored learned estimate'}</span></td>
          <td className="px-3 py-3 font-mono">{row.observation_count}</td>
          <td className="px-3 py-3">{editable && row.observation_count === 0 ? <button type="button" disabled={loading || saving || !!error} onClick={() => start(row)} className="font-semibold text-sky-700 disabled:opacity-50">Edit</button> : <span className="text-slate-500">{row.observation_count > 0 ? 'Read-only · Has observations' : 'Read-only'}</span>}</td>
        </tr>)}
        {!reasons.length && !loading && <tr><td colSpan={6} className="px-3 py-5 text-center text-slate-500">{error ? 'Delay reasons unavailable. Reload to try again.' : 'No delay reasons configured.'}</td></tr>}
      </tbody></table>
    </div>
  </div>;
}
