import { useEffect, useRef, useState } from 'react';
import type { ApplicantRecord, ApplicationForecastResponse } from '../types';
import { clearSimulation, generateSimulation, simulationError, getApplicationForecast, getPipelineForecast } from '../defenseSimulation';
import DefenseSimulationBadge from './DefenseSimulationBadge';

const input = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const button = 'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50';

export function SimulationResult({ result, pipeline }: { result: ApplicationForecastResponse; pipeline: any }) {
  if (!pipeline || !result.current_stage || !result.stage_breakdown) {
    return (
      <section aria-label="Returned forecast" className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold">Returned forecast — Application #{result.application_id}</h2>
        <DefenseSimulationBadge isSimulation={result.is_simulation} />
        {result.is_simulation !== true && <p className="text-sm text-amber-900">The backend did not mark this response as a simulation.</p>}
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Current stage</dt><dd>{result.current_stage ?? 'Not available'}</dd></div>
          <div><dt className="text-slate-500">Elapsed days in current stage</dt><dd>{result.days_spent_in_current_stage ?? 'Not available'}</dd></div>
          <div><dt className="text-slate-500">Estimated remaining time</dt><dd>{result.record ? `${result.record.estimated_remaining_days} days` : 'Not available'}</dd></div>
          <div><dt className="text-slate-500">Estimated deployment date</dt><dd>{result.record?.estimated_deployment_date ?? 'Not available'}</dd></div>
        </dl>
        {!!result.limitations?.length && <div><h3 className="text-sm font-semibold">Forecast limitations</h3><ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">{result.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
      </section>
    );
  }

  const currentStageName = result.current_stage;
  const elapsedDays = result.days_spent_in_current_stage || 0;

  const currentStagePipeline = pipeline.stages.find((s: any) => s.stage_name === currentStageName);
  const currentSES = currentStagePipeline ? currentStagePipeline.current_forecast : 0;

  const remainingCurrent = Math.max(currentSES - elapsedDays, 0);

  const stagesInOrder = pipeline.stages.map((s: any) => s.stage_name);
  const currentIndex = stagesInOrder.indexOf(currentStageName);
  const downstreamStages = currentIndex >= 0 ? pipeline.stages.slice(currentIndex + 1) : [];

  const downstreamTotal = downstreamStages.reduce((sum: number, stage: any) => sum + stage.current_forecast, 0);

  const isOverdue = elapsedDays > currentSES;
  const overdueBuffer = isOverdue ? 7.0 : 0;

  const backendTotal = remainingCurrent + downstreamTotal;
  const matchBackend = Math.abs(backendTotal - (result.record?.estimated_remaining_days || 0)) < 0.1;

  return (
    <section aria-label="Returned forecast" className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-xl">Returned forecast — Application #{result.application_id}</h2>
      <DefenseSimulationBadge isSimulation={result.is_simulation} />
      {result.is_simulation !== true && <p className="text-sm text-amber-900">The backend did not mark this response as a simulation.</p>}

      <div className="mt-6 border-t pt-4">
        <h2 className="text-lg font-bold text-slate-800 mb-4">How this forecast was calculated</h2>
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm space-y-4">
          <div className="flex items-center gap-2 mb-2 font-mono text-xs text-slate-500">
            PERT Baseline → SES Current Stage Forecast → Elapsed-Time Adjustment → Downstream Stage Forecasts → Remaining Deployment ETA
          </div>

          <div>
            <div className="font-semibold text-slate-700">Current stage: {currentStageName}</div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="bg-white p-2 border rounded">Current stage forecast:<br/><span className="font-mono">{currentSES.toFixed(2)} d</span></div>
              <div className="bg-white p-2 border rounded text-amber-700">Elapsed days:<br/><span className="font-mono">{elapsedDays.toFixed(2)} d</span></div>
            </div>
            <div className="mt-2 p-2 bg-sky-50 border border-sky-100 rounded text-sky-900 font-medium">
              Remaining current-stage forecast:
              <br/><span className="font-mono">max({currentSES.toFixed(2)} - {elapsedDays.toFixed(2)}, 0) = {remainingCurrent.toFixed(2)} d</span>
            </div>
            {isOverdue && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 font-semibold text-amber-900">
                  <span className="bg-amber-200 text-amber-800 text-xs px-2 py-0.5 rounded uppercase tracking-wide">Manager-Review Buffer</span>
                  <span className="font-mono text-sm">+7.00 d</span>
                </div>
                <p className="mt-2 text-xs text-amber-800">
                  Because the simulated elapsed time exceeds the learned SES forecast for the current stage, the remaining time is clamped to zero.
                  To account for this overdue status, an additional <strong>+7.0 day manager-review escalation buffer</strong> is automatically added.
                  The simulator does not automatically advance the workflow phase, as it intentionally does not mutate the applicant's real workflow state.
                </p>
              </div>
            )}
          </div>

          {downstreamStages.length > 0 && (
            <div className="mt-4">
              <div className="font-semibold text-slate-700 mb-2">Downstream Stages (SES)</div>
              <ul className="space-y-1">
                {downstreamStages.map((stage: any) => (
                  <li key={stage.stage_name} className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="text-slate-600">{stage.stage_name}</span>
                    <span className="font-mono">{stage.current_forecast.toFixed(2)} d</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 p-3 bg-slate-800 text-white rounded-lg flex flex-col md:flex-row justify-between items-center gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400">Backend Forecast Remaining</div>
              <div className="font-mono break-words">
                {remainingCurrent.toFixed(2)}
                {downstreamStages.length > 0 && ' + '}
                {downstreamStages.map((s:any) => s.current_forecast.toFixed(2)).join(' + ')}
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-400">
              = {backendTotal.toFixed(2)} d
            </div>
          </div>

          {isOverdue && (
            <div className="mt-2 space-y-2">
              <div className="p-3 bg-amber-900/40 text-amber-100 rounded-lg flex flex-col md:flex-row justify-between items-center gap-3 border border-amber-800/50">
                <div>
                  <div className="text-xs uppercase tracking-wider text-amber-400 font-bold">Overdue Escalation Buffer</div>
                  <div className="text-xs text-amber-200/70 mt-1">
                    The +7.0 day escalation buffer is a defense/demo visualization of potential manager-review delay. It is not persisted to the application forecast and does not replace the backend-authoritative ETA.
                  </div>
                </div>
                <div className="text-xl font-bold text-amber-400 whitespace-nowrap">
                  +7.00 d
                </div>
              </div>
              <div className="p-3 bg-slate-900 text-slate-300 rounded-lg flex flex-col md:flex-row justify-between items-center gap-3 border border-slate-700">
                <div className="text-xs uppercase tracking-wider font-bold">Illustrative Buffered Projection</div>
                <div className="text-xl font-bold text-white">
                  = {(backendTotal + overdueBuffer).toFixed(2)} d
                </div>
              </div>
            </div>
          )}

          {!matchBackend && result.record && (
            <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
              Note: The visual breakdown total ({visualTotal.toFixed(2)}) differs from the backend total ({result.record.estimated_remaining_days.toFixed(2)}). The backend result is authoritative.
            </div>
          )}
        </div>
      </div>

      <dl className="grid gap-4 text-sm sm:grid-cols-2 mt-6">
        <div className="bg-slate-50 p-3 rounded border"><dt className="text-xs font-bold text-slate-500 uppercase">Estimated remaining time</dt><dd className="text-lg font-bold text-slate-900">{result.record ? `${result.record.estimated_remaining_days.toFixed(2)} days` : 'Not available'}</dd></div>
        <div className="bg-slate-50 p-3 rounded border"><dt className="text-xs font-bold text-slate-500 uppercase">Estimated deployment date</dt><dd className="text-lg font-bold text-slate-900">{result.record?.estimated_deployment_date ?? 'Not available'}</dd></div>
      </dl>

      {!!result.limitations?.length && <div className="mt-4"><h3 className="text-sm font-semibold text-amber-800">Forecast limitations</h3><ul className="list-disc space-y-1 pl-5 text-sm text-amber-700">{result.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
    </section>
  );
}

export default function ForecastingDefenseSimulator({ applicants }: { applicants: ApplicantRecord[] }) {
  const [applicationId, setApplicationId] = useState('');
  const [elapsed, setElapsed] = useState('');
  const [result, setResult] = useState<ApplicationForecastResponse | null>(null);

  const [basisApp, setBasisApp] = useState<ApplicationForecastResponse | null>(null);
  const [basisPipeline, setBasisPipeline] = useState<any | null>(null);
  const [loadingBasis, setLoadingBasis] = useState(false);

  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const applications = [...new Map(applicants.filter(a => Number.isSafeInteger(a.applicationId) && a.applicationId! > 0).map(a => [a.applicationId!, a])).values()];
  const id = Number(applicationId);
  const validId = Number.isSafeInteger(id) && id > 0;
  const validElapsed = elapsed.trim() !== '' && Number.isFinite(Number(elapsed)) && Number(elapsed) >= 0 && Number(elapsed) <= 36500;

  useEffect(() => {
    if (validId) {
      setLoadingBasis(true);
      Promise.all([
        getApplicationForecast(id).catch(() => null),
        getPipelineForecast().catch(() => null)
      ]).then(([appRes, pipeRes]) => {
        setBasisApp(appRes);
        setBasisPipeline(pipeRes);
        setLoadingBasis(false);
      });
    } else {
      setBasisApp(null);
      setBasisPipeline(null);
    }
  }, [id, validId]);

  function select(value: string) {
    setApplicationId(value); setResult(null); setError(''); setMessage('');
  }

  async function run(clear: boolean) {
    if (lock.current || !validId || (!clear && !validElapsed)) return;
    lock.current = true; setBusy(true); setError(''); setMessage(''); setResult(null);
    try {
      if (clear) {
        await clearSimulation(id);
        setMessage(`Simulation cleared for Application #${id}. Refresh the Applicant forecast to see the normal backend result.`);
      } else {
        setResult(await generateSimulation(id, Number(elapsed)));
        setMessage(`Request completed for Application #${id}. Refresh the Applicant forecast in the separate browser session.`);
      }
    } catch (err) { setError(simulationError(err)); }
    finally { lock.current = false; setBusy(false); }
  }

  const renderBasis = () => {
    if (loadingBasis) return <div className="text-sm text-slate-500 p-4">Loading forecast basis...</div>;
    if (!basisApp || !basisPipeline) return null;
    if (!basisApp.current_stage) return null;

    const currentStageName = basisApp.current_stage;
    const stagesInOrder = basisPipeline.stages.map((s: any) => s.stage_name);
    const currentIndex = stagesInOrder.indexOf(currentStageName);
    const relevantStages = currentIndex >= 0 ? basisPipeline.stages.slice(currentIndex) : [];

    const pertTotal = relevantStages.reduce((sum: number, s: any) => sum + s.pert_baseline, 0);
    const sesTotal = relevantStages.reduce((sum: number, s: any) => sum + s.current_forecast, 0);
    const alpha = basisApp?.record?.ses_alpha_used ?? basisPipeline.alpha_used;

    return (
      <div className="mt-6 space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Forecast Basis — PERT + SES</h2>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl text-sm">
            <h3 className="font-bold text-indigo-900 mb-1">PERT Expected Time:</h3>
            <div className="font-mono bg-white px-2 py-1 rounded border inline-block mb-2 text-indigo-800">TE = (O + 4M + P) / 6</div>
            <p className="text-indigo-800 text-xs">PERT provides the initial expected duration for a stage using optimistic, most-likely, and pessimistic estimates.</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-sm">
            <h3 className="font-bold text-emerald-900 mb-1">SES Learning:</h3>
            <div className="font-mono bg-white px-2 py-1 rounded border inline-block mb-2 text-emerald-800">F_(t+1) = α · A_t + (1 - α) · F_t</div>
            <p className="text-emerald-800 text-xs">SES updates the stage forecast when completed actual turnaround observations are available. (α ≈ {alpha})</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
              <tr>
                <th className="p-3">Stage</th>
                <th className="p-3 text-right">PERT</th>
                <th className="p-3 text-right">SES</th>
                <th className="p-3 text-center">Observations</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {relevantStages.map((stage: any) => (
                <tr key={stage.stage_name} className={stage.stage_name === currentStageName ? "bg-sky-50/30" : ""}>
                  <td className="p-3 font-medium text-slate-800">
                    {stage.stage_name}
                    {stage.stage_name === currentStageName && <span className="ml-2 text-[10px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded uppercase font-bold tracking-wider">Current</span>}
                  </td>
                  <td className="p-3 text-right font-mono text-slate-600">{stage.pert_baseline.toFixed(2)} d</td>
                  <td className="p-3 text-right font-mono font-bold text-slate-800">{stage.current_forecast.toFixed(2)} d</td>
                  <td className="p-3 text-center text-slate-600">{stage.observation_count}</td>
                  <td className="p-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${stage.is_fallback ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                      {stage.is_fallback ? 'Prior Baseline' : 'Historical Empirical'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-800 text-white p-4 rounded-xl">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Forecast from start of current stage</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-slate-300 text-xs">PERT path from current stage start:</div>
              <div className="font-mono text-sm mt-1">{relevantStages.map((s:any) => s.pert_baseline.toFixed(2)).join(' + ')}</div>
              <div className="text-xl font-bold text-amber-400 mt-1">{pertTotal.toFixed(2)} days</div>
            </div>
            <div>
              <div className="text-slate-300 text-xs">SES path from current stage start:</div>
              <div className="font-mono text-sm mt-1">{relevantStages.map((s:any) => s.current_forecast.toFixed(2)).join(' + ')}</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">{sesTotal.toFixed(2)} days</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return <div className="mx-auto max-w-4xl space-y-6 pb-12">
    <div><h2 className="text-2xl font-bold text-slate-900">Forecasting Defense Simulator</h2><p className="mt-2 text-sm text-amber-900">Temporary defense/demo tool. Overrides forecast elapsed days only; application status and workflow history stay unchanged.</p></div>

    <form onSubmit={event => { event.preventDefault(); void run(false); }} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
        <label className="block text-sm font-semibold">Existing application
          <select className={input} value={applications.some(a => String(a.applicationId) === applicationId) ? applicationId : ''} onChange={event => select(event.target.value)}>
            <option value="">Select a loaded application or enter its ID below</option>
            {applications.map(a => <option key={a.applicationId} value={a.applicationId}>#{a.applicationId} — {a.name} — {a.role}</option>)}
          </select>
        </label>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold">Application ID
              <input className={input} type="number" min="1" step="1" required value={applicationId} onChange={event => select(event.target.value)} />
            </label>
            <p className="text-xs text-slate-500 mt-1">Use the real application ID.</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-indigo-900">Defense Simulation — Elapsed Days Override
              <input className={`${input} border-indigo-300 bg-indigo-50/30 focus:ring-indigo-500 focus:border-indigo-500`} type="number" min="0" max="36500" step="any" required value={elapsed} onChange={event => setElapsed(event.target.value)} />
            </label>
            <p className="text-xs text-slate-500 mt-1">Allowed range: 0–36500 days.</p>
          </div>
        </div>

        {renderBasis()}

        <div className="flex flex-wrap gap-3 pt-4 border-t">
          <button className={button} disabled={!validId || !validElapsed} type="submit">Generate Simulation</button>
          <button className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50" disabled={!validId} type="button" onClick={() => void run(true)}>Clear Simulation</button>
        </div>
      </fieldset>
      {busy && <p role="status" className="text-sm font-medium text-sky-700 animate-pulse">Updating simulation...</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800 border border-red-100">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-900 border border-emerald-100">{message}</p>}
    </form>

    {result && <SimulationResult result={result} pipeline={basisPipeline} />}
  </div>;
}
