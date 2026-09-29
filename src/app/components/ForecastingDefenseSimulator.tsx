import { useRef, useState } from 'react';
import type { ApplicantRecord, ApplicationForecastResponse } from '../types';
import { clearSimulation, generateSimulation, simulationError } from '../defenseSimulation';
import DefenseSimulationBadge from './DefenseSimulationBadge';

const input = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const button = 'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50';

export function SimulationResult({ result }: { result: ApplicationForecastResponse }) {
  return <section aria-label="Returned forecast" className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
  </section>;
}

export default function ForecastingDefenseSimulator({ applicants }: { applicants: ApplicantRecord[] }) {
  const [applicationId, setApplicationId] = useState('');
  const [elapsed, setElapsed] = useState('');
  const [result, setResult] = useState<ApplicationForecastResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const applications = [...new Map(applicants.filter(a => Number.isSafeInteger(a.applicationId) && a.applicationId! > 0).map(a => [a.applicationId!, a])).values()];
  const id = Number(applicationId);
  const validId = Number.isSafeInteger(id) && id > 0;
  const validElapsed = elapsed.trim() !== '' && Number.isFinite(Number(elapsed)) && Number(elapsed) >= 0 && Number(elapsed) <= 36500;
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
  return <div className="mx-auto max-w-3xl space-y-5">
    <div><h2 className="text-xl font-bold text-slate-900">Forecasting Defense Simulator</h2><p className="mt-2 text-sm text-amber-900">Temporary defense/demo tool. Overrides forecast elapsed days only; application status and workflow history stay unchanged.</p></div>
    <form onSubmit={event => { event.preventDefault(); void run(false); }} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
        <label className="block text-sm font-semibold">Existing application
          <select className={input} value={applications.some(a => String(a.applicationId) === applicationId) ? applicationId : ''} onChange={event => select(event.target.value)}>
            <option value="">Select a loaded application or enter its ID below</option>
            {applications.map(a => <option key={a.applicationId} value={a.applicationId}>#{a.applicationId} — {a.name} — {a.role}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold">Application ID
          <input className={input} type="number" min="1" step="1" required value={applicationId} onChange={event => select(event.target.value)} />
        </label>
        <p className="text-xs text-slate-500">Use the real application ID, not the applicant ID. The list uses existing internal applicant records and may be incomplete.</p>
        <label className="block text-sm font-semibold">Defense Simulation — Elapsed Days Override
          <input className={input} type="number" min="0" max="36500" step="any" required value={elapsed} onChange={event => setElapsed(event.target.value)} />
        </label>
        <p className="text-xs text-slate-500">Allowed range: 0–36500 days.</p>
        <div className="flex flex-wrap gap-3">
          <button className={button} disabled={!validId || !validElapsed} type="submit">Generate Simulation</button>
          <button className={button} disabled={!validId} type="button" onClick={() => void run(true)}>Clear Simulation</button>
        </div>
      </fieldset>
      {busy && <p role="status" className="text-sm">Updating simulation...</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
    </form>
    {result && <SimulationResult result={result} />}
  </div>;
}
