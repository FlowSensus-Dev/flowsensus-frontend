import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../../../lib/api';
import {
  PertAttempt, PertConfiguration, PertDraft, PertField, confirmedPertSave, createPertAttempt,
  expectedPertDays, pertAttemptKey, pertDrafts, pertError, pertFields, pertStageError, readPertAttempt, readPertConfiguration,
} from '../../../lib/pertConfiguration';

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60';
const buttonClass = 'rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50';
const fieldLabels: Record<PertField, string> = { optimistic_days: 'O — Optimistic', most_likely_days: 'M — Most Likely', pessimistic_days: 'P — Pessimistic' };
const duration = (value: number | null | undefined) => value == null ? 'Unavailable' : `${value} days`;

export function PertManagerGuide() {
  return <details className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-xs text-slate-600">
    <summary className="cursor-pointer font-bold text-sky-800">PERT guide for Managers</summary>
    <div className="mt-3 space-y-2 leading-relaxed">
      <p>PERT means Program Evaluation and Review Technique. It uses three realistic duration estimates to plan how long each recruitment stage may take.</p>
      <p><strong>Optimistic (O):</strong> Time needed when work goes smoothly. <strong>Most Likely (M):</strong> Time needed under normal conditions. <strong>Pessimistic (P):</strong> Time needed when plausible difficulties occur. Use days, including part-days.</p>
      <p><strong>Expected duration = (O + 4M + P) / 6.</strong> The normal estimate gets more weight. For example only: O = 2, M = 5 and P = 14 gives (2 + 4 × 5 + 14) / 6 = <strong>6 days</strong>. These example values are not entered into your configuration.</p>
      <p>Use realistic agency experience, rather than targets or extreme guesses. Unrealistic inputs can make early forecasts misleading.</p>
      <p>The PERT Baseline is the cold-start estimate used before a stage has real observations. After observations arrive, Simple Exponential Smoothing (SES) learns from actual durations and the Learned SES Forecast takes over.</p>
      <p>Changing PERT updates the baseline. It does not erase learned SES forecasts, observation counts or history. Stages with learning continue to use their learned forecasts.</p>
    </div>
  </details>;
}

export default function StagePertConfiguration({ canEdit = false, onSaved, onboarding = false }: { canEdit?: boolean; onSaved: (refreshSesSettings?: boolean) => Promise<void>; onboarding?: boolean }) {
  const [config, setConfig] = useState<PertConfiguration | null>(null);
  const [drafts, setDrafts] = useState<PertDraft[]>([]);
  const [alpha, setAlpha] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const mounted = useRef(false);
  const busy = useRef(false);
  const loadId = useRef(0);
  // An unresolved command is immutable. Retrying must reuse its method, UUID and exact values.
  const attempt = useRef<PertAttempt | null>(null);
  const forgetAttempt = (agencyId: number) => {
    // A storage failure must not turn a confirmed backend outcome into a stuck form.
    // A leftover command can only replay the same backend receipt on reopening.
    try { sessionStorage.removeItem(pertAttemptKey(agencyId)); } catch { /* Keep the confirmed outcome. */ }
    attempt.current = null;
  };

  const read = async (id = ++loadId.current) => {
    const { data } = await api.get('/forecasting/pert-configuration');
    const value = readPertConfiguration(data);
    if (mounted.current && id === loadId.current) {
      // Recover before enabling editing. A GET never resolves or replaces an uncertain command.
      let stored: string | null;
      try { stored = sessionStorage.getItem(pertAttemptKey(value.agency_id)); }
      catch { throw new Error('This browser cannot retain a pending save. Enable storage for this site and reload before configuring PERT.'); }
      const pending = stored ? readPertAttempt(stored) : null;
      attempt.current = pending;
      setUncertain(!!pending);
      setConfig(value);
      setDrafts(pending ? pending.payload.stages.map((stage) => ({ stage_order: stage.stage_order,
        optimistic_days: String(stage.optimistic_days), most_likely_days: String(stage.most_likely_days), pessimistic_days: String(stage.pessimistic_days),
      })) : pertDrafts(value));
      setAlpha(pending?.payload.initial_forecast_settings ? String(pending.payload.initial_forecast_settings.ses_alpha) : '');
      setBlocked(false); setShowValidation(false);
    }
  };

  const reload = async () => {
    if (busy.current) return;
    const id = ++loadId.current;
    busy.current = true;
    setLoading(true); setError(null); setSuccess(null); setConfig(null);
    try { await read(id); }
    catch (err: any) { if (mounted.current && id === loadId.current) setError(err.response ? pertError(err) : err.message === 'Network Error' ? 'PERT configuration could not be loaded. Check your connection and reload.' : err.message); }
    finally { if (id === loadId.current) { busy.current = false; if (mounted.current) setLoading(false); } }
  };

  useEffect(() => {
    mounted.current = true;
    busy.current = false;
    if (canEdit) void reload();
    return () => { mounted.current = false; ++loadId.current; };
  }, [canEdit]);

  const permitted = canEdit && !!config?.can_manage && !config.must_change_password && config.next_action !== 'change_password' &&
    config.setup_status !== 'inconsistent' && config.next_action !== 'reconciliation_required' && !config.issues.length;
  const disabled = !permitted || loading || saving || blocked || uncertain;
  const change = (order: number, field: PertField, value: string) => {
    if (disabled || attempt.current) return;
    setDrafts(drafts.map((stage) => stage.stage_order === order ? { ...stage, [field]: value } : stage));
    setError(null); setSuccess(null);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!permitted || !config || busy.current || loading || blocked) return;
    setError(null); setSuccess(null); setShowValidation(true);
    if (!attempt.current) {
      try {
        const command = createPertAttempt(config, drafts, alpha);
        // Store before dispatch so reloads and interrupted requests cannot silently create a new UUID.
        try { sessionStorage.setItem(pertAttemptKey(config.agency_id), JSON.stringify(command)); }
        catch { throw new Error('This browser cannot retain a pending save. Enable storage for this site and reload before saving PERT.'); }
        attempt.current = command;
      }
      catch (err: any) { setError(err.message); return; }
    }
    const command = attempt.current;
    busy.current = true; setSaving(true);
    try {
      const { data } = await api[command.method]('/forecasting/pert-configuration', command.payload);
      if (!confirmedPertSave(data, command, config.agency_id)) throw new Error('Unconfirmed save response');
    } catch (err: any) {
      const status = err.response?.status;
      // Expired/revoked access cannot establish what happened to an earlier uncertain save.
      const unknown = !err.response || status >= 500 || status === 408 || (uncertain && (status === 401 || status === 403));
      if (!unknown) forgetAttempt(config.agency_id);
      if (mounted.current) {
        setUncertain(unknown);
        setBlocked(status === 401 || status === 403 || (!unknown && status !== 422));
        setError(`${pertError(err)}${unknown ? ' Retry the same save to confirm its outcome; inputs are locked to preserve the original request.' : ''}`);
      }
      busy.current = false; if (mounted.current) setSaving(false);
      return;
    }
    forgetAttempt(config.agency_id);
    if (!mounted.current) { busy.current = false; return; }
    setUncertain(false); setLoading(true); setBlocked(true);
    setSuccess(`PERT configuration saved. Learned SES is preserved. ${onboarding ? 'Checking setup status…' : 'Refreshing configuration and forecasts…'}`);
    const results = await Promise.allSettled([read(), onSaved(!!command.payload.initial_forecast_settings)]);
    if (mounted.current) {
      if (results[0].status === 'rejected') {
        setBlocked(true);
        setError('The save was confirmed, but configuration could not be refreshed. Reload configuration before editing again.');
      }
      setSuccess(`PERT configuration saved. Learned SES is preserved.${onboarding
        ? results[1].status === 'rejected' ? ' Setup status could not be confirmed. Use Refresh setup status to retry.' : ' Setup status refreshed.'
        : results[1].status === 'rejected' ? ' Forecast refresh failed; use Refresh Data to retry.' : ' Forecast refresh completed.'}`);
      setLoading(false); setSaving(false);
    }
    busy.current = false;
  };

  if (!canEdit) return null;
  return <details open={onboarding || undefined} className="border-t border-slate-200 pt-4">
    <summary className="cursor-pointer font-bold text-slate-900 text-sm">PERT Configuration</summary>
    <div className="mt-3 space-y-4 text-xs text-slate-600">
      <p>Set stage durations in days. PERT Baselines support early forecasts; learned SES values are preserved when you save.</p>
      <PertManagerGuide />
      {loading && <p role="status" className="flex items-center gap-2"><RefreshCw size={12} className="animate-spin" />Loading PERT configuration…</p>}
      {config && <>
        <p>Configuration revision: <strong>{config.revision}</strong></p>
        {config.setup_status === 'required' && <p className="rounded-lg bg-amber-50 p-3 text-amber-800">Initial PERT setup is required. Complete all five stages and explicitly submit to finish setup.</p>}
        {config.setup_status === 'unconfirmed' && <p className="rounded-lg bg-slate-50 p-3">This agency’s PERT setup is unconfirmed. You can voluntarily configure and confirm inputs here; this does not require onboarding or redirect your agency.</p>}
        {(!config.can_manage || config.next_action === 'contact_manager') && <p role="alert">Only authorized Management users can edit PERT. Contact your agency Manager.</p>}
        {(config.must_change_password || config.next_action === 'change_password') && <p role="alert">Change your required temporary password before configuring PERT, then reload configuration.</p>}
        {(config.setup_status === 'inconsistent' || config.next_action === 'reconciliation_required' || config.issues.length > 0) && <div role="alert" className="rounded-lg bg-amber-50 p-3 text-amber-800">
          <p>Agency configuration needs reconciliation. Contact support before editing; reload after it is resolved.</p>
          {config.issues.length > 0 && <p className="break-words">Reported issues: {config.issues.join(', ')}</p>}
        </div>}
        <form onSubmit={save} noValidate className="space-y-4">
          <p id="pert-duration-help">All O/M/P inputs are required: 0–3650 days, up to four decimal places, with O ≤ M ≤ P. Expected PERT = (O + 4M + P) / 6, rounded to four decimal places.</p>
          {config.stages.map((stage) => {
            const draft = drafts.find((item) => item.stage_order === stage.stage_order)!;
            const validation = showValidation ? pertStageError(draft) : null;
            const expected = expectedPertDays(draft);
            return <fieldset key={stage.stage_order} disabled={disabled} className="min-w-0 rounded-xl border border-slate-200 p-4 space-y-3">
              <legend className="px-1 font-bold text-sm text-slate-800">{stage.stage_order}. {stage.stage_name}</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <p>Current PERT Baseline: <strong>{duration(stage.pert_baseline_days)}</strong></p>
                <p>Learned SES Forecast: <strong>{stage.observation_count == null ? 'Unavailable' : stage.observation_count > 0 ? duration(stage.current_ses_forecast_days) : 'No observations yet'}</strong></p>
                <p>Observations: {stage.observation_count ?? 'Unavailable'}</p>
                <p>Effective forecast: {duration(stage.effective_forecast_days)} ({stage.forecast_basis})</p>
              </div>
              {pertFields.some((field) => stage[field] == null) && <p className="text-amber-800">Original PERT inputs are unavailable. The current baseline does not reveal historical O/M/P values. Enter new estimates explicitly; no inputs have been inferred.</p>}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {pertFields.map((field) => <label key={field} className="min-w-0" htmlFor={`pert-${stage.stage_order}-${field}`}>{fieldLabels[field]} (days)
                  <input id={`pert-${stage.stage_order}-${field}`} type="text" inputMode="decimal" required value={draft[field]} disabled={disabled}
                    aria-invalid={!!validation} aria-describedby={`pert-duration-help${validation ? ` pert-stage-${stage.stage_order}-error` : ''}`}
                    onChange={(event) => change(stage.stage_order, field, event.target.value)} className={inputClass} />
                </label>)}
              </div>
              <p>Expected PERT Baseline from these inputs: <output className="font-mono font-bold text-sky-700">{expected === null ? 'Enter valid O/M/P inputs' : `${expected} days`}</output></p>
              {validation && <p id={`pert-stage-${stage.stage_order}-error`} className="text-rose-700">{validation}</p>}
            </fieldset>;
          })}
          {config.setup_status !== 'complete' && config.initial_forecast_settings_required && <label className="block max-w-sm">Initial agency SES alpha (0 &lt; alpha ≤ 1)
            <input type="text" inputMode="decimal" required value={alpha} disabled={disabled} aria-describedby="pert-alpha-help" className={inputClass}
              onChange={(event) => { if (!disabled && !attempt.current) { setAlpha(event.target.value); setError(null); } }} />
            <span id="pert-alpha-help" className="mt-1 block">No SES settings exist yet. Choose the initial alpha; the Agency SES Settings guide below explains how alpha affects learning.</span>
          </label>}
          {permitted && <button type="submit" disabled={loading || saving || blocked} className={buttonClass}>
            {saving ? 'Saving…' : uncertain ? 'Retry same save' : config.setup_status === 'complete' ? 'Save PERT Configuration' : config.setup_status === 'unconfirmed' ? 'Confirm PERT Configuration' : 'Complete Initial PERT Setup'}
          </button>}
        </form>
      </>}
      {error && <p role="alert" className="text-rose-700">{error}</p>}
      {uncertain && <p role="status" className="text-amber-800">Save outcome unknown. Retry the same save before making further changes. This tab retains the original request across reloads; reloading configuration will not discard it.</p>}
      {success && <p role="status" className="text-emerald-700">{success}</p>}
      <button type="button" disabled={loading || saving} onClick={() => void reload()} className="font-semibold text-sky-700 underline disabled:opacity-50">{uncertain ? 'Reload configuration (keep pending save)' : 'Reload configuration (discard draft)'}</button>
    </div>
  </details>;
}
