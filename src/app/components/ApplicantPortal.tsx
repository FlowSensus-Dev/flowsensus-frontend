import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { ApplicationForecastResponse } from '../types';
import { completedApplication, portalError, loadPortal, loadPortalForecast } from '../portal';
import type { PortalApplication, PortalProfile } from '../portal';

const card = 'rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4';
const button = 'rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50';
const date = (value?: string | null) => {
  if (!value) return 'Not available';
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? 'Not available' : parsed.toLocaleDateString();
};

function Notice({ message, retry }: { message: string; retry?: () => void }) {
  return <div role="alert" className="space-y-3 rounded-lg bg-amber-50 p-4 text-amber-950">
    <p>{message}</p>{retry && <button className={button} onClick={retry}>Retry</button>}
  </div>;
}

function Forecast({ application, profile, token }: { application: PortalApplication; profile: PortalProfile; token: string }) {
  const [result, setResult] = useState<ApplicationForecastResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const terminal = completedApplication(application);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setError('');
    if (terminal || application.is_stopped) { setLoading(false); return () => controller.abort(); }
    setLoading(true);
    loadPortalForecast(application.application_id, profile, token, controller.signal)
      .then(data => {
        if (!controller.signal.aborted) setResult(data);
      }).catch(err => { if (!controller.signal.aborted) setError(portalError(err, true)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [application.application_id, application.is_stopped, terminal, profile, token, attempt]);

  const deployed = terminal || result?.current_stage?.toLowerCase() === 'deployed';
  return <section className={card} aria-label="Application forecast">
    <h2 className="text-lg font-bold">Deployment forecast</h2>
    {application.is_stopped ? <p>Processing is stopped. An active deployment estimate is not shown.</p>
      : deployed ? <p>{application.application_status || 'Deployed'}{application.actual_deployment_at ? ` · Deployment recorded ${date(application.actual_deployment_at)}` : ''}. No upcoming deployment estimate is needed.</p>
      : loading ? <p role="status">Loading application forecast…</p>
      : error ? <Notice message={error} retry={() => setAttempt(a => a + 1)} />
      : <>
        <p className="text-2xl font-bold text-sky-800">{result?.record?.estimated_deployment_date ? date(result.record.estimated_deployment_date) : 'ETA unavailable'}</p>
        <p className="text-sm text-slate-600">This is an estimate, not a guaranteed deployment date.</p>
        {result?.current_stage && <p>Current stage: {result.current_stage}</p>}
        {result?.record && <>
          <p>Estimated remaining time: {result.record.estimated_remaining_days} days</p>
          <p>Forecast generated: {date(result.record.generated_at)}</p>
          {result.record.confidence_lower_date && result.record.confidence_upper_date && <p>Estimated date range: {date(result.record.confidence_lower_date)} – {date(result.record.confidence_upper_date)}</p>}
        </>}
        {!result?.record && <p>There is not enough reliable workflow data to show an estimate yet.</p>}
        <button className={button} onClick={() => setAttempt(a => a + 1)}>Refresh forecast</button>
      </>}
    {!!result?.limitations?.length && <div><h3 className="font-semibold">Forecast limitations</h3><ul className="list-disc pl-5">{result.limitations.map((text, i) => <li key={i}>{text}</li>)}</ul></div>}
  </section>;
}

function PortalData({ token }: { token: string }) {
  const [data, setData] = useState<{ profile: PortalProfile; applications: PortalApplication[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null); setSelectedId(null);
    loadPortal(token, controller.signal).then(({ profile, applications }) => {
      if (controller.signal.aborted) return;
      setData({ profile, applications });
      setSelectedId(applications.length === 1 ? applications[0].application_id : null);
    }).catch(err => { if (!controller.signal.aborted) setError(portalError(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, attempt]);

  if (loading) return <p role="status">Loading your profile and applications…</p>;
  if (error) return <Notice message={error} retry={() => setAttempt(a => a + 1)} />;
  if (!data) return null;
  const { profile, applications } = data;
  const selected = applications.find(a => a.application_id === selectedId);
  return <>
    <section className={card}>
      <h1 className="text-2xl font-bold">{[profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ') || 'Your profile'}</h1>
      {profile.applicant_code && <p>{profile.applicant_code}</p>}
      <dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-slate-500">Email</dt><dd className="break-words">{profile.email || 'Not provided'}</dd></div><div><dt className="text-slate-500">Contact number</dt><dd>{profile.contact_number || 'Not provided'}</dd></div></dl>
    </section>
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Your applications</h2><button className={button} onClick={() => setAttempt(a => a + 1)}>Refresh applications</button></div>
      {!applications.length ? <p>No applications yet. Your agency will provide updates here when an application is available.</p> : <>
        {applications.length > 1 && <div><label htmlFor="portal-application" className="block font-semibold mb-2">Select an application</label><select id="portal-application" className="w-full rounded-lg border border-slate-300 p-3" value={selectedId ?? ''} onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Choose an application</option>{applications.map(a => <option key={a.application_id} value={a.application_id}>Application #{a.application_id} · {a.applied_role || a.job_order_name || 'Position not provided'}{a.job_order_code ? ` · ${a.job_order_code}` : ''}</option>)}
        </select></div>}
        {!selected && <p>Select an application to see its status and forecast.</p>}
        {selected && <div className="space-y-3">
          <h3 className="font-semibold">Application #{selected.application_id} · {selected.applied_role || 'Position not provided'}</h3>
          <p>{selected.job_order_name || 'Job order name not provided'}{selected.job_order_code ? ` · ${selected.job_order_code}` : ''}</p>
          <p>Status: <strong>{selected.application_status || 'Not available'}</strong></p>
          <p>Workflow phase: {selected.current_phase ?? 'Not available'} · Department: {selected.current_department || 'Not available'}</p>
          <p>Last updated: {date(selected.updated_at)}</p>
          {selected.is_stopped && <Notice message={`Processing stopped${selected.stopped_phase != null ? ` at phase ${selected.stopped_phase}` : ''}${selected.stopped_at ? ` on ${date(selected.stopped_at)}` : ''}. Contact your agency for next steps.`} />}
        </div>}
      </>}
    </section>
    {selected && <Forecast key={selected.application_id} application={selected} profile={profile} token={token} />}
  </>;
}

export default function ApplicantPortal({ onLogout }: { onLogout: () => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let eventReceived = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      eventReceived = true;
      if (active) { setSession(next); setReady(true); }
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (active && !eventReceived) { setSession(error ? null : data.session); setReady(true); }
    }).catch(() => { if (active && !eventReceived) { setSession(null); setReady(true); } });
    return () => { active = false; subscription.unsubscribe(); };
  }, [attempt]);
  // Remount on account, tenant or credential changes: no prior account's data survives.
  const sessionKey = session ? `${session.user.id}:${session.user.app_metadata?.agency_id}:${session.access_token}` : '';
  return <div className="h-full overflow-y-auto bg-slate-100 text-slate-900">
    <header className="flex items-center justify-between gap-4 border-b bg-white px-6 py-4"><span className="font-bold">FlowSensus · Applicant Portal</span><button className={button} onClick={() => { setSession(null); onLogout(); }}>Sign out</button></header>
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      {!ready ? <p role="status">Checking your session…</p> : !session ? <Notice message="Sign in with your authenticated Applicant account to view your applications." retry={() => setAttempt(a => a + 1)} /> : <PortalData key={sessionKey} token={session.access_token} />}
    </main>
  </div>;
}
