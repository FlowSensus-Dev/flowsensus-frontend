import { useEffect, useState } from 'react';
import { Briefcase, CalendarDays, CheckCircle2, Clock, Layers, LogOut, Mail, PauseCircle, Phone, RefreshCw, Sparkles } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { ApplicationForecastResponse } from '../types';
import { completedApplication, portalError, loadPortal, loadPortalForecast } from '../portal';
import type { PortalApplication, PortalProfile } from '../portal';

const card = 'min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5 sm:p-6';
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 disabled:opacity-50';
const label = 'text-xs font-semibold uppercase tracking-wide text-slate-500';
const date = (value?: string | null) => {
  if (!value) return 'Not available';
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? 'Not available' : parsed.toLocaleDateString();
};

function Notice({ message, retry }: { message: string; retry?: () => void }) {
  return <div role="alert" className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
    <p>{message}</p>{retry && <button className={button} onClick={retry}>Retry</button>}
  </div>;
}

function Loading({ message }: { message: string }) {
  return <div role="status" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
    <RefreshCw aria-hidden="true" size={18} className="shrink-0 text-sky-700 motion-safe:animate-spin" />{message}
  </div>;
}

function ProfileCard({ profile }: { profile: PortalProfile }) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const name = [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ') || 'Your profile';
  const initials = [profile.first_name, profile.last_name].filter(Boolean).map(part => part!.trim().charAt(0)).join('').toUpperCase() || 'AP';
  return <section aria-label="Your profile" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-col gap-5 bg-gradient-to-br from-slate-900 to-slate-800 p-6 sm:flex-row sm:items-center sm:p-8">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sky-600 text-2xl font-bold text-white ring-4 ring-white/15">
        {profile.photo_url && failedPhoto !== profile.photo_url
          ? <img src={profile.photo_url} alt={`${name} profile`} className="h-full w-full object-cover" onError={() => setFailedPhoto(profile.photo_url)} />
          : <span aria-label="Profile initials">{initials}</span>}
      </div>
      <div className="min-w-0 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-300">Applicant profile</p>
        <h1 className="break-words text-2xl font-bold text-white sm:text-3xl">{name}</h1>
        {profile.applicant_code && <p className="inline-block max-w-full break-words rounded-lg border border-white/15 bg-white/10 px-3 py-1 text-sm text-slate-200">{profile.applicant_code}</p>}
      </div>
    </div>
    <dl className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
      <div className="min-w-0 p-5 sm:p-6"><dt className={`${label} flex items-center gap-2`}><Mail aria-hidden="true" size={14} className="text-sky-700" />Email</dt><dd className="mt-2 break-words text-sm font-medium text-slate-900">{profile.email || 'Not provided'}</dd></div>
      <div className="min-w-0 p-5 sm:p-6"><dt className={`${label} flex items-center gap-2`}><Phone aria-hidden="true" size={14} className="text-sky-700" />Contact number</dt><dd className="mt-2 break-words text-sm font-medium text-slate-900">{profile.contact_number || 'Not provided'}</dd></div>
    </dl>
  </section>;
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
    <div className="flex items-center gap-3">
      <span className="rounded-xl bg-sky-50 p-2.5 text-sky-700"><Sparkles aria-hidden="true" size={20} /></span>
      <div><h2 className="text-lg font-bold">Deployment forecast</h2><p className="text-sm text-slate-500">Application #{application.application_id}</p></div>
    </div>
    {application.is_stopped ? <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
        <PauseCircle aria-hidden="true" size={22} className="shrink-0" /><div><h3 className="font-semibold">Processing is stopped</h3><p className="mt-1 text-sm leading-relaxed">An active deployment estimate is not shown. Contact your agency for next steps.</p></div>
      </div>
      : deployed ? <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-sky-50 p-5">
        <CheckCircle2 aria-hidden="true" size={24} className="shrink-0 text-emerald-700" />
        <div className="min-w-0"><h3 className="break-words font-bold text-emerald-900">{application.application_status || 'Deployed'}</h3><p className="mt-1 text-sm leading-relaxed text-slate-700">No upcoming deployment estimate is required.</p>{application.actual_deployment_at && <p className="mt-3 text-sm text-emerald-800">Deployment recorded {date(application.actual_deployment_at)}</p>}</div>
      </div>
      : loading ? <Loading message="Loading application forecast..." />
      : error ? <Notice message={error} retry={() => setAttempt(a => a + 1)} />
      : <>
        <div className="rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 to-slate-50 p-5 sm:p-6">
          <p className={`${label} flex items-center gap-2`}><CalendarDays aria-hidden="true" size={16} />Estimated deployment date</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-sky-900">{result?.record?.estimated_deployment_date ? date(result.record.estimated_deployment_date) : 'ETA unavailable'}</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">This is an estimate, not a guaranteed deployment date.</p>
        </div>
        <dl className="grid gap-5 sm:grid-cols-2">
          {result?.current_stage && <div className="min-w-0"><dt className={label}>Current stage</dt><dd className="mt-1 break-words font-semibold">{result.current_stage}</dd></div>}
          {result?.record && <>
            <div><dt className={label}>Estimated remaining time</dt><dd className="mt-1 flex items-center gap-2 font-semibold"><Clock aria-hidden="true" size={16} className="text-sky-700" />{result.record.estimated_remaining_days} days</dd></div>
            <div><dt className={label}>Forecast generated</dt><dd className="mt-1 font-medium">{date(result.record.generated_at)}</dd></div>
            {result.record.confidence_lower_date && result.record.confidence_upper_date && <div><dt className={label}>Estimated date range</dt><dd className="mt-1 font-medium">{date(result.record.confidence_lower_date)} to {date(result.record.confidence_upper_date)}</dd></div>}
          </>}
        </dl>
        {!result?.record && <p className="text-sm leading-relaxed text-slate-600">There is not enough reliable workflow data to show an estimate yet.</p>}
        <button className={button} onClick={() => setAttempt(a => a + 1)}><RefreshCw aria-hidden="true" size={15} />Refresh forecast</button>
      </>}
    {!!result?.limitations?.length && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed"><h3 className="font-semibold">Forecast limitations</h3><ul className="mt-2 list-disc space-y-1 break-words pl-5 text-slate-600">{result.limitations.map((text, i) => <li key={i}>{text}</li>)}</ul></div>}
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

  if (loading) return <Loading message="Loading your profile and applications..." />;
  if (error) return <Notice message={error} retry={() => setAttempt(a => a + 1)} />;
  if (!data) return null;
  const { profile, applications } = data;
  const selected = applications.find(a => a.application_id === selectedId);
  return <>
    <ProfileCard profile={profile} />
    <section className={card} aria-label="Your applications">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-sky-50 p-2.5 text-sky-700"><Briefcase aria-hidden="true" size={20} /></span><h2 className="text-lg font-bold">Your applications</h2></div>
        <button className={button} onClick={() => setAttempt(a => a + 1)}><RefreshCw aria-hidden="true" size={15} />Refresh applications</button>
      </div>
      {!applications.length ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6"><h3 className="font-semibold">No applications yet</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">Your agency will provide updates here when an application is available.</p></div> : <>
        {applications.length > 1 && <div><label htmlFor="portal-application" className="mb-2 block text-sm font-semibold">Select an application</label><select id="portal-application" className="min-h-11 w-full min-w-0 max-w-full rounded-xl border border-slate-300 bg-white p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600" value={selectedId ?? ''} onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Choose an application</option>{applications.map(a => <option key={a.application_id} value={a.application_id}>Application #{a.application_id} - {a.applied_role || a.job_order_name || 'Position not provided'}{a.job_order_code ? ` - ${a.job_order_code}` : ''}</option>)}
        </select></div>}
        {!selected && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Select an application to see its status and forecast.</p>}
        {selected && <div className="overflow-hidden rounded-xl border border-sky-100">
          <div className="flex flex-col items-start gap-4 bg-gradient-to-br from-sky-50 to-slate-50 p-5 sm:flex-row sm:justify-between">
            <div className="min-w-0"><p className={label}>Application #{selected.application_id}</p><h3 className="mt-2 break-words text-lg font-bold">{selected.applied_role || 'Position not provided'}</h3><p className="mt-1 break-words text-sm text-slate-600">{selected.job_order_name || 'Job order name not provided'}</p>{selected.job_order_code && <p className="mt-2 break-words font-mono text-xs text-sky-800">{selected.job_order_code}</p>}</div>
            <span className={`max-w-full rounded-full border px-3 py-1 text-xs font-semibold break-words ${selected.is_stopped ? 'border-amber-200 bg-amber-50 text-amber-900' : completedApplication(selected) ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-sky-200 bg-white text-sky-800'}`}>Status: {selected.application_status || 'Not available'}</span>
          </div>
          <dl className="grid gap-5 p-5 sm:grid-cols-3">
            <div><dt className={label}>Workflow phase</dt><dd className="mt-1 font-semibold">{selected.current_phase ?? 'Not available'}</dd></div>
            <div className="min-w-0"><dt className={label}>Department</dt><dd className="mt-1 break-words font-semibold">{selected.current_department || 'Not available'}</dd></div>
            <div><dt className={label}>Last updated</dt><dd className="mt-1 text-sm font-medium">{date(selected.updated_at)}</dd></div>
          </dl>
          {selected.is_stopped && <div className="px-5 pb-5"><Notice message={`Processing stopped${selected.stopped_phase != null ? ` at phase ${selected.stopped_phase}` : ''}${selected.stopped_at ? ` on ${date(selected.stopped_at)}` : ''}. Contact your agency for next steps.`} /></div>}
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
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white"><Layers aria-hidden="true" size={19} /></span>
          <div><p className="text-sm font-bold tracking-tight sm:text-base">Flow<span className="text-sky-600">Sensus</span></p><p className="text-xs text-slate-500">Applicant Portal</p></div>
        </div>
        <button className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600" onClick={() => { setSession(null); onLogout(); }}><LogOut aria-hidden="true" size={16} />Sign out</button>
      </div>
    </header>
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:py-8">
      {!ready ? <Loading message="Checking your session..." /> : !session ? <Notice message="Sign in with your authenticated Applicant account to view your applications." retry={() => setAttempt(a => a + 1)} /> : <PortalData key={sessionKey} token={session.access_token} />}
    </main>
  </div>;
}
