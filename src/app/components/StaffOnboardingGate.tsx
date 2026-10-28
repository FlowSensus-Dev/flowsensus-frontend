import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Loader2, LogOut } from 'lucide-react';
import { UserRole } from '../types';
import { PertConfiguration } from '../../lib/pertConfiguration';
import { readStaffOnboarding, staffOnboardingError, staffOnboardingStep, StaffOnboardingError } from '../../lib/staffOnboarding';
import LoginScreen from './LoginScreen';
import StagePertConfiguration from './views/StagePertConfiguration';

const onboardingPath = '/app/onboarding';

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

  const refresh = async (afterPertSave = false) => {
    if (!subject || bypass) return null;
    const id = ++request.current;
    setLoading(true); setError(null);
    try {
      const result = await readStaffOnboarding(subject);
      if (!mounted.current || id !== request.current) return null;
      const value = result.configuration;
      const passwordPending = value.must_change_password || value.next_action === 'change_password';
      const complete = value.setup_status === 'complete' && !value.initial_setup_required && !passwordPending && value.next_action === 'normal_operations' && !value.issues.length;
      if (value.initial_setup_required && value.can_manage && roles.includes('Management')) completionRequired.current = true;
      if ((afterPertSave && !complete) || (completionRequired.current && !passwordPending && !value.initial_setup_required && !complete)) {
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
  const requiredPath = step === 'password' || step === 'pert' || step === 'reconciliation';
  const workspace = step === 'workspace' || step === 'manager_guidance' || step === 'forecast_warning';
  useEffect(() => {
    if (bypass || !config || loading || expired || error) return;
    if (requiredPath && location.pathname !== onboardingPath) navigate(onboardingPath, { replace: true });
    else if (workspace && location.pathname === onboardingPath) navigate('/app/dashboard', { replace: true });
  }, [bypass, config, loading, expired, error, requiredPath, workspace, location.pathname, navigate]);

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

  if (workspace && !loading && !expired && !error && location.pathname !== onboardingPath) return <>
    {step !== 'workspace' && <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-3">
      <p>{step === 'manager_guidance' ? 'Initial agency PERT setup is pending. Contact an authorized agency Manager to configure the five stages; your staff account cannot complete agency setup.' : 'Agency forecasting configuration needs reconciliation. Contact your Manager or support. Other workspace navigation remains available.'}</p>
      <button type="button" disabled={loading} onClick={() => void refresh().catch(() => {})} className="font-bold underline disabled:opacity-50">Refresh setup status</button>
    </div>}
    {children}
  </>;

  return <div className="h-full overflow-y-auto bg-slate-50">
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-sky-700">{step === 'pert' ? 'First-login setup · Step 2 of 2' : 'Agency account setup'}</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{step === 'pert' ? 'Configure your agency’s PERT baseline' : 'Confirm your agency setup'}</h1>
        </div>
        <button type="button" onClick={onLogout} className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-rose-600">Sign out <LogOut size={16} /></button>
      </div>
      {loading && <p role="status" className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />Checking account and agency setup…</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {step === 'reconciliation' && !error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p>Your agency configuration needs reconciliation before required setup can continue. Contact support, then refresh setup status. No configuration has been created automatically.</p>
        {config?.issues.length ? <p className="mt-2 break-words">Reported issues: {config.issues.join(', ')}</p> : null}
      </div>}
      {step === 'pert' && !error && <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <p className="mb-4 text-sm leading-relaxed text-slate-600">Your password requirement has been cleared. Before opening the workspace, enter optimistic, most likely and pessimistic durations for all five recruitment stages. Realistic estimates establish your agency’s cold-start forecasting baseline until actual observations support SES learning. Use the PERT guide below for help.</p>
        <StagePertConfiguration canEdit={roles.includes('Management') && !!config?.can_manage} onboarding onSaved={async () => { await refresh(true); }} />
      </div>}
      {workspace && !loading && !expired && !error && location.pathname === onboardingPath && <p role="status" className="text-sm text-slate-600">Setup status confirmed. Opening your workspace…</p>}
      <button type="button" disabled={loading} onClick={() => void refresh().catch(() => {})} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50">Refresh setup status</button>
    </main>
  </div>;
}
