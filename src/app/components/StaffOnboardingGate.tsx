import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Loader2, LogOut } from 'lucide-react';
import { UserRole } from '../types';
import { canDeferPert, isPertDeferred, PertConfiguration } from '../../lib/pertConfiguration';
import { readStaffOnboarding, staffOnboardingError, staffOnboardingStep, StaffOnboardingError } from '../../lib/staffOnboarding';
import LoginScreen from './LoginScreen';
import StagePertConfiguration from './views/StagePertConfiguration';
import { PertOnboardingContext } from './PertOnboardingContext';

const onboardingPath = '/app/onboarding';
const finishPertPath = '/app/onboarding/pert';

/** Tenant staff only. This controls frontend navigation, not server operational authorization. */
export default function StaffOnboardingGate({ subject, roles, name, onLogout, bypass = false, children }: {
  subject: string | null; roles: UserRole[]; name: string; onLogout: () => void; bypass?: boolean; children: React.ReactNode;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [config, setConfig] = useState<PertConfiguration | null>(null);
  const [account, setAccount] = useState<{ id: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const mounted = useRef(false);
  const request = useRef(0);
  const completionRequired = useRef(false);

  const refresh = async (expected: 'complete' | 'deferred' | null = null, keepWorkspace = false) => {
    if (!subject || bypass) return null;
    const id = ++request.current;
    if (!keepWorkspace) setLoading(true);
    setError(null);
    try {
      const result = await readStaffOnboarding(subject);
      if (!mounted.current || id !== request.current) return null;
      const value = result.configuration;
      const passwordPending = value.must_change_password || value.next_action === 'change_password';
      const complete = value.setup_status === 'complete' && !value.initial_setup_required && !passwordPending && value.next_action === 'normal_operations' && !value.issues.length;
      const deferred = isPertDeferred(value) && !passwordPending && value.next_action === 'normal_operations' && !value.issues.length;
      if (value.initial_setup_required && value.can_manage && roles.includes('Management')) completionRequired.current = true;
      if (expected === 'deferred' && !deferred && !complete) throw new StaffOnboardingError('Deferral has not been confirmed by current setup state. Refresh setup status before continuing.');
      if ((expected === 'complete' && !complete) || (completionRequired.current && !passwordPending && !value.initial_setup_required && !complete && !deferred)) {
        throw new StaffOnboardingError('Initial PERT completion has not been confirmed. Refresh setup status; contact support if it remains unconfirmed.');
      }
      if (complete) completionRequired.current = false;
      setAccount(result.account); setConfig(value); setExpired(false);
      return value;
    } catch (err) {
      if (mounted.current && id === request.current) {
        const failure = staffOnboardingError(err);
        setError(failure.message); setExpired(failure.expired);
      }
      throw err;
    } finally {
      if (mounted.current && id === request.current) setLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    if (!bypass && subject) void refresh().catch(() => {});
    else if (!bypass) { setLoading(false); setExpired(true); setError('Your session has expired. Sign out and sign in again to continue setup.'); }
    return () => { mounted.current = false; ++request.current; };
  }, [subject, bypass]);

  const step = config && account?.id === subject ? staffOnboardingStep(config, roles) : null;
  const editingDeferred = step === 'deferred' && location.pathname === finishPertPath && roles.includes('Management') && !!config?.can_manage;
  const requiredPath = step === 'password' || step === 'pert' || step === 'reconciliation';
  const workspace = step === 'workspace' || step === 'deferred' || step === 'manager_guidance' || step === 'forecast_warning';
  useEffect(() => {
    if (bypass || !config || loading || expired || error) return;
    if (requiredPath && location.pathname !== onboardingPath) navigate(onboardingPath, { replace: true });
    else if (workspace && (location.pathname === onboardingPath || (location.pathname === finishPertPath && !editingDeferred))) navigate('/app/dashboard', { replace: true });
  }, [bypass, config, loading, expired, error, requiredPath, workspace, editingDeferred, location.pathname, navigate]);

  if (bypass) return <>{children}</>;

  // Keep the existing password dialog mounted while its confirmed update is being checked.
  if (step === 'password' && account && !expired) return <LoginScreen
    requiredPasswordChange={{ user: account, role: roles[0] || '', roles, name, isSuper: false }}
    passwordSetupLabel={config?.initial_setup_required && config.can_manage && roles.includes('Management') ? 'First-login setup · Step 1 of 2' : 'Account setup · Password required'}
    onLogin={() => {}}
    onPasswordChanged={async () => {
      const value = await refresh();
      if (value && (value.must_change_password || value.next_action === 'change_password')) throw new Error('Your temporary password is still required by the backend. Stay here and retry or refresh setup status.');
    }}
    onRetryOnboarding={async () => { await refresh(); }} onBack={onLogout} />;

  if (workspace && !loading && !expired && !error && location.pathname !== onboardingPath && location.pathname !== finishPertPath) return <>
    {step === 'deferred' && <div role="status" className="border-b border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900 flex flex-wrap items-center justify-between gap-3">
      <p>PERT setup is deferred. The five-stage estimates are not yet confirmed. Navigation and profile access remain available, but application workflow status/phase progression remains unavailable until an authorized Manager completes all five stages. Completing PERT setup enables the normal backend workflow.</p>
      <div className="flex flex-wrap gap-3">
        {roles.includes('Management') && config?.can_manage && <button type="button" onClick={() => navigate(finishPertPath)} className="font-bold underline">Finish PERT setup</button>}
        <button type="button" disabled={loading} onClick={() => void refresh().catch(() => {})} className="font-semibold underline disabled:opacity-50">Refresh setup status</button>
      </div>
    </div>}
    {(step === 'manager_guidance' || step === 'forecast_warning') && <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-3">
      <p>{step === 'manager_guidance' ? 'Initial agency PERT setup is pending. Contact an authorized agency Manager to configure the five stages; your staff account cannot complete agency setup.' : 'Agency forecasting configuration needs reconciliation. Contact your Manager or support. Other workspace navigation remains available.'}</p>
      {config?.workflow_setup_required && <p>Application workflow status/phase progression is unavailable until initial PERT setup is completed.</p>}
      <button type="button" disabled={loading} onClick={() => void refresh().catch(() => {})} className="font-bold underline disabled:opacity-50">Refresh setup status</button>
    </div>}
    <PertOnboardingContext.Provider value={step === 'deferred' ? async () => { await refresh('complete', true); } : null}>{children}</PertOnboardingContext.Provider>
  </>;

  // Unknown status and workspace redirects must not present setup requirements.
  // The existing checks still finish before operational views can mount.
  if (loading || (workspace && !expired && !error && !editingDeferred)) return <div className="flex h-full items-center justify-center bg-slate-50 p-6">
    <p role="status" className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" aria-hidden="true" />Loading your workspace…</p>
  </div>;

  return <div className="h-full overflow-y-auto bg-slate-50">
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-sky-700">{step === 'pert' ? 'First-login setup · Step 2 of 2' : requiredPath || editingDeferred ? 'Agency account setup' : 'Workspace access'}</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{editingDeferred ? 'Finish your agency’s PERT setup' : step === 'pert' ? 'Configure your agency’s PERT baseline' : requiredPath ? 'Confirm your agency setup' : 'Workspace access could not be confirmed'}</h1>
        </div>
        <button type="button" onClick={onLogout} className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-rose-600">Sign out <LogOut size={16} /></button>
      </div>
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {step === 'reconciliation' && !error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p>Your agency configuration needs reconciliation before required setup can continue. Contact support, then refresh setup status. No configuration has been created automatically.</p>
        {config?.issues.length ? <p className="mt-2 break-words">Reported issues: {config.issues.join(', ')}</p> : null}
      </div>}
      {(step === 'pert' || editingDeferred) && !error && <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <p className="mb-4 text-sm leading-relaxed text-slate-600">Your password requirement has been cleared. Enter three time estimates in days for each of the five recruitment stages: the shortest realistic time, the usual time and a longer time when delays occur. These establish your agency’s starting forecast, or cold-start baseline. The PERT guide below explains how actual durations later support SES learning.</p>
        {(editingDeferred || (config && canDeferPert(config))) && <p className="mb-4 text-xs text-sky-900">Permitted areas remain accessible after confirmed deferral. Application workflow status/phase progression remains unavailable until you complete all five PERT stages.</p>}
        <p className="mb-4 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">{editingDeferred
          ? 'Check with the staff handling each stage and review available agency records before submitting. You can return to permitted workspace areas while gathering estimates; application workflow progression stays restricted. Estimates you have not submitted are not saved.'
          : 'Not sure about an estimate yet? Check with the staff handling that stage and review available agency records before submitting. You can sign out and return when ready; required setup will still apply. Estimates you have not submitted are not saved.'}</p>
        <StagePertConfiguration canEdit={roles.includes('Management') && !!config?.can_manage} onboarding onSaved={async () => { await refresh('complete'); }}
          onDeferred={step === 'pert' && config && canDeferPert(config) ? async () => { await refresh('deferred'); } : undefined} />
        {editingDeferred && <button type="button" onClick={() => navigate('/app/dashboard')} className="mt-4 text-xs font-bold text-sky-700 underline">Return to workspace</button>}
      </div>}
      <button type="button" disabled={loading} onClick={() => void refresh().catch(() => {})} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50">Refresh setup status</button>
    </main>
  </div>;
}
