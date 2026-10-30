import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../../../lib/api';
import {
  PertAttempt, PertConfiguration, PertDraft, PertField, confirmedPertSave, createPertAttempt,
  canDeferPert, confirmedPertDeferral, isPertDeferred, expectedPertDays, pertAttemptKey, pertDrafts, pertError, pertDeferralError, pertFields, pertStageError, readPertAttempt, readPertConfiguration,
} from '../../../lib/pertConfiguration';

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60';
const buttonClass = 'rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50';
const fieldLabels: Record<PertField, string> = { optimistic_days: 'O — Optimistic', most_likely_days: 'M — Most Likely', pessimistic_days: 'P — Pessimistic' };
const fieldHelp: Record<PertField, string> = {
  optimistic_days: 'The shortest realistic time when work goes smoothly.',
  most_likely_days: 'The usual time your team normally needs.',
  pessimistic_days: 'A longer realistic time when difficulties or delays occur.',
};
// Explanations follow the existing five-stage catalog; they do not define workflow transitions.
const stageHelp: Record<number, string> = {
  1: 'Think about applicant registration, screening and initial checks.',
  2: 'Think about medical checks and obtaining medical clearance.',
  3: 'Think about preparing the applicant’s CV and endorsing it for employer consideration.',
  4: 'Think about the employer’s review and selection process.',
  5: 'Think about final paperwork and preparations for deployment.',
};
const duration = (value: number | null | undefined) => value == null ? 'Unavailable' : `${value} days`;

export function PertManagerGuide() {
  return <details className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-xs text-slate-600">
    <summary className="cursor-pointer font-bold text-sky-800">PERT guide for Managers</summary>
    <div className="mt-3 space-y-2 leading-relaxed">
      <p>PERT means Program Evaluation and Review Technique. It uses three realistic duration estimates to plan how long each recruitment stage may take.</p>
      <p><strong>Optimistic (O):</strong> The shortest realistic time when work goes smoothly. <strong>Most Likely (M):</strong> The usual time your team normally needs. <strong>Pessimistic (P):</strong> A longer realistic time when difficulties or delays occur. Use days, including part-days, for each stage separately.</p>
      <p>Keep the estimates in order: <strong>shortest ≤ usual ≤ longer (O ≤ M ≤ P)</strong>. The usual time cannot be shorter than the optimistic time, and the pessimistic time cannot be shorter than the usual time. Equal values are allowed if that reflects your agency’s experience.</p>
      <p><strong>Expected duration = (O + 4M + P) / 6.</strong> The normal estimate gets more weight. For example only: O = 2, M = 5 and P = 14 gives (2 + 4 × 5 + 14) / 6 = <strong>6 days</strong>. These example values are not entered into your configuration.</p>
      <p>Check with the staff who handle each stage and review available agency records. Estimate how long the work realistically takes, rather than setting a target or guessing an extreme delay. Do not enter the whole recruitment timeline into every stage.</p>
      <p>The PERT Baseline is the starting estimate, also called the cold-start estimate, used before a stage has real observations. Observations are recorded actual durations. After observations arrive, Simple Exponential Smoothing (SES) learns from them and the Learned SES Forecast takes over.</p>
      <p>Changing PERT updates the baseline. It does not erase learned SES forecasts, observation counts or history. Stages with learning continue to use their learned forecasts.</p>
    </div>
  </details>;
}

export default function StagePertConfiguration({ canEdit = false, onSaved, onboarding = false, onDeferred }: { canEdit?: boolean; onSaved: (refreshSesSettings?: boolean) => Promise<void>; onboarding?: boolean; onDeferred?: () => Promise<void> }) {
  const [config, setConfig] = useState<PertConfiguration | null>(null);
  const [drafts, setDrafts] = useState<PertDraft[]>([]);
  const [alpha, setAlpha] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deferring, setDeferring] = useState(false);
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
  const disabled = !permitted || loading || saving || deferring || blocked || uncertain;
  const validStageCount = drafts.filter((stage) => !pertStageError(stage)).length;
  const change = (order: number, field: PertField, value: string) => {
    if (disabled || attempt.current) return;
    setDrafts(drafts.map((stage) => stage.stage_order === order ? { ...stage, [field]: value } : stage));
    setError(null); setSuccess(null);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!permitted || !config || busy.current || loading || blocked || deferring) return;
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

  const defer = async () => {
    if (!permitted || !config || !onDeferred || !canDeferPert(config) || disabled || busy.current || attempt.current) return;
    busy.current = true; setDeferring(true); setError(null); setSuccess(null);
    let confirmed = false;
    try {
      const { data } = await api.post('/forecasting/pert-configuration/defer', { expected_revision: config.revision });
      if (!confirmedPertDeferral(data, config.revision)) throw new Error('Unconfirmed deferral response');
      confirmed = true;
      if (!mounted.current) return;
      setBlocked(true);
      // The gate rechecks fresh Auth and GET state before granting permitted navigation.
      await onDeferred();
    } catch (err) {
      if (mounted.current) {
        setBlocked(true);
        setError(confirmed ? 'The backend confirmed deferral, but current setup status could not be verified. Refresh setup status to continue.' : pertDeferralError(err));
      }
    } finally {
      busy.current = false;
      if (mounted.current) setDeferring(false);
    }
  };

  if (!canEdit) return null;
  return <details open={onboarding || undefined} className="border-t border-slate-200 pt-4">
    <summary className="cursor-pointer font-bold text-slate-900 text-sm">PERT Configuration</summary>
    <div className="mt-3 space-y-4 text-xs text-slate-600">
      <p>For each recruitment stage, enter three estimates in days: the shortest realistic time, the usual time and a longer time when delays occur. Part-days are allowed. Estimate the time for that stage only.</p>
      <PertManagerGuide />
      {loading && <p role="status" className="flex items-center gap-2"><RefreshCw size={12} className="animate-spin" />Loading PERT configuration…</p>}
      {config && <>
        <p>Configuration revision: <strong>{config.revision}</strong></p>
        {config.setup_status === 'complete' && <div className="rounded-lg bg-slate-50 p-3 space-y-2">
          <p className="font-semibold text-slate-800">Saved configuration loaded</p>
          <p>An authorized Manager can review the stored estimates against the team’s experience and edit them below. Saving updates the PERT baselines for all five stages; it is designed to preserve learned SES values and observation counts.</p>
          <p>Typing changes or viewing a preview does not save them. FlowSensus reports a successful save only after the backend confirms it, then reloads the saved configuration.</p>
        </div>}
        {config.setup_status === 'required' && <p className="rounded-lg bg-amber-50 p-3 text-amber-800">Initial PERT setup is required. Complete all five stages and explicitly submit to finish setup.</p>}
        {isPertDeferred(config) && <p className="rounded-lg bg-sky-50 p-3 text-sky-900">Initial PERT setup is deferred, not completed. Confirm all five stages to enable normal application workflow status/phase progression.</p>}
        {config.setup_status === 'unconfirmed' && <p className="rounded-lg bg-slate-50 p-3">This agency’s PERT setup is unconfirmed. You can voluntarily configure and confirm inputs here; this does not require onboarding or redirect your agency.</p>}
        {(!config.can_manage || config.next_action === 'contact_manager') && <p role="alert">Only authorized Management users can edit PERT. Contact your agency Manager.</p>}
        {(config.must_change_password || config.next_action === 'change_password') && <p role="alert">Change your required temporary password before configuring PERT, then reload configuration.</p>}
        {(config.setup_status === 'inconsistent' || config.next_action === 'reconciliation_required' || config.issues.length > 0) && <div role="alert" className="rounded-lg bg-amber-50 p-3 text-amber-800">
          <p>Agency configuration needs reconciliation. Contact support before editing; reload after it is resolved.</p>
          {config.issues.length > 0 && <p className="break-words">Reported issues: {config.issues.join(', ')}</p>}
        </div>}
        {onDeferred && canDeferPert(config) && permitted && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
          <p id="pert-defer-help">Need more time to gather estimates? Configure Later lets you open permitted areas such as navigation and your profile. Application workflow status/phase progression remains unavailable until all five stages are configured. Unsubmitted estimates are not saved by this action.</p>
          <button type="button" disabled={disabled || !!attempt.current} aria-describedby="pert-defer-help" onClick={() => void defer()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50">{deferring ? 'Confirming Configure Later…' : 'Configure Later'}</button>
        </div>}
        <form onSubmit={save} noValidate className="space-y-4">
          <div id="pert-duration-help" className="space-y-2">
            <p>Enter all three estimates for each of the five stages. Use 0–3650 days, up to four decimal places, with shortest ≤ usual ≤ longer (O ≤ M ≤ P). Equal values are allowed.</p>
            <p>Most Likely cannot be shorter than Optimistic. Pessimistic cannot be shorter than Most Likely. Check with your team if you are unsure; no suggested durations are filled in for you.</p>
            <p>Expected PERT = (O + 4M + P) / 6, rounded to four decimal places. The preview gives more weight to the usual time; the saved baseline is confirmed by the backend.</p>
          </div>
          <p role="status" className="font-semibold text-slate-700">Valid stage estimates: {validStageCount} of 5. Review all five stages before submitting.</p>
          {config.stages.map((stage) => {
            const draft = drafts.find((item) => item.stage_order === stage.stage_order)!;
            const validation = showValidation ? pertStageError(draft) : null;
            const expected = expectedPertDays(draft);
            return <fieldset key={stage.stage_order} disabled={disabled} className="min-w-0 rounded-xl border border-slate-200 p-4 space-y-3">
              <legend className="px-1 font-bold text-sm text-slate-800">{stage.stage_order}. {stage.stage_name}</legend>
              <p>{stageHelp[stage.stage_order]}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <p>Current PERT Baseline: <strong>{duration(stage.pert_baseline_days)}</strong></p>
                <p>Learned SES Forecast: <strong>{stage.observation_count == null ? 'Unavailable' : stage.observation_count > 0 ? duration(stage.current_ses_forecast_days) : 'No observations yet'}</strong></p>
                <p>Observations: {stage.observation_count ?? 'Unavailable'}</p>
                <p>Effective forecast: {duration(stage.effective_forecast_days)} ({stage.forecast_basis})</p>
              </div>
              {pertFields.some((field) => stage[field] == null) && <p className="text-amber-800">Original PERT inputs are unavailable. The current baseline does not reveal historical O/M/P values. Enter new estimates explicitly; no inputs have been inferred.</p>}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {pertFields.map((field) => <div key={field} className="min-w-0">
                  <label htmlFor={`pert-${stage.stage_order}-${field}`}>{fieldLabels[field]} (days)</label>
                  <input id={`pert-${stage.stage_order}-${field}`} type="text" inputMode="decimal" required value={draft[field]} disabled={disabled}
                    aria-invalid={!!validation} aria-describedby={`pert-${stage.stage_order}-${field}-help pert-duration-help${validation ? ` pert-stage-${stage.stage_order}-error` : ''}`}
                    onChange={(event) => change(stage.stage_order, field, event.target.value)} className={inputClass} />
                  <span id={`pert-${stage.stage_order}-${field}-help`} className="mt-1 block text-slate-500">{fieldHelp[field]}</span>
                </div>)}
              </div>
              <p>Expected PERT Baseline from these inputs: <output className="font-mono font-bold text-sky-700">{expected === null ? 'Enter valid O/M/P inputs' : `${expected} days`}</output></p>
              <p className="text-slate-500">Preview only. Changing an input does not save it or change the current PERT Baseline shown above.</p>
              {validation && <p id={`pert-stage-${stage.stage_order}-error`} className="text-rose-700">{validation}</p>}
            </fieldset>;
          })}
          {config.setup_status !== 'complete' && config.initial_forecast_settings_required && <label className="block max-w-sm">Initial agency SES alpha (0 &lt; alpha ≤ 1)
            <input type="text" inputMode="decimal" required value={alpha} disabled={disabled} aria-describedby="pert-alpha-help" className={inputClass}
              onChange={(event) => { if (!disabled && !attempt.current) { setAlpha(event.target.value); setError(null); } }} />
            <span id="pert-alpha-help" className="mt-1 block">No SES settings exist yet. Alpha controls how strongly new actual durations influence future learning; higher values give newer observations more weight. Choose a value greater than 0 and at most 1. You can review it later in Agency SES Settings.</span>
          </label>}
          {permitted && <button type="submit" disabled={loading || saving || deferring || blocked} className={buttonClass}>
            {saving ? 'Saving…' : uncertain ? 'Retry same save' : config.setup_status === 'complete' ? 'Save PERT Configuration' : config.setup_status === 'unconfirmed' ? 'Confirm PERT Configuration' : 'Complete Initial PERT Setup'}
          </button>}
        </form>
      </>}
      {error && <p role="alert" className="text-rose-700">{error}</p>}
      {uncertain && <p role="status" className="text-amber-800">Save outcome unknown. Retry the same save before making further changes. This tab retains the original request across reloads; reloading configuration will not discard it.</p>}
      {success && <p role="status" className="text-emerald-700">{success}</p>}
      <button type="button" disabled={loading || saving || deferring} onClick={() => void reload()} className="font-semibold text-sky-700 underline disabled:opacity-50">{uncertain ? 'Reload configuration (keep pending save)' : 'Reload configuration (discard draft)'}</button>
    </div>
  </details>;
}
