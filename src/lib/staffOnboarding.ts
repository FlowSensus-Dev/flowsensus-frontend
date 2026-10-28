import { api } from './api';
import { supabase } from './supabase';
import { PertConfiguration, readPertConfiguration } from './pertConfiguration';

export type StaffOnboardingStep = 'password' | 'pert' | 'reconciliation' | 'manager_guidance' | 'forecast_warning' | 'workspace';
export interface PasswordChangeAccount {
  user: { id: string; email?: string };
  role: import('../app/types').UserRole;
  name: string;
  isSuper: boolean;
  roles?: import('../app/types').UserRole[];
  rememberMe?: boolean;
  applicantId?: string;
}

export function staffOnboardingStep(config: PertConfiguration, roles: string[]): StaffOnboardingStep {
  if (config.must_change_password || config.next_action === 'change_password') return 'password';
  const manager = roles.includes('Management') && config.can_manage;
  if (config.initial_setup_required || config.setup_status === 'required') {
    if (!manager) return 'manager_guidance';
    if (config.setup_status === 'required' && config.initial_setup_required && config.next_action === 'configure_pert' && !config.issues.length) return 'pert';
    return 'reconciliation';
  }
  if (config.setup_status === 'inconsistent' || config.next_action === 'reconciliation_required' || config.issues.length) return 'forecast_warning';
  // Legacy unconfirmed agencies are explicitly nonblocking, not new-agency onboarding.
  if (['unconfirmed', 'complete'].includes(config.setup_status) && config.next_action === 'normal_operations') return 'workspace';
  return 'reconciliation';
}

export class StaffOnboardingError extends Error {
  constructor(message: string, public expired = false) { super(message); }
}

export async function readStaffOnboarding(subject: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new StaffOnboardingError(error.status === 401
    ? 'Your session has expired. Sign out and sign in again to continue setup.'
    : 'Your account could not be verified. Retry, or sign out and sign in again.', error.status === 401);
  if (!data.user || data.user.id !== subject) throw new StaffOnboardingError('Your session has changed or expired. Sign out and sign in again.', true);
  const response = await api.get('/forecasting/pert-configuration');
  return { account: data.user, configuration: readPertConfiguration(response.data) };
}

export function staffOnboardingError(error: any): { message: string; expired: boolean } {
  if (error instanceof StaffOnboardingError) return { message: error.message, expired: error.expired };
  const status = error.response?.status;
  if (status === 401) return { message: 'Your session has expired. Sign out and sign in again to continue setup.', expired: true };
  if (status === 403) return { message: 'Agency access could not be verified. Retry after your access is restored, or contact your agency Manager.', expired: false };
  return { message: 'Agency setup status could not be confirmed. The service may be unavailable or configuration may be missing. Retry; contact support if this continues.', expired: false };
}

// Staff branch of the existing password dialog. PF06 owns the password + server flag update.
// Never clear client metadata first or treat a failed backend confirmation as success.
export async function changeRequiredStaffPassword(account: PasswordChangeAccount['user'], password: string) {
  if (!account.email) throw new Error('Your account email is unavailable. Sign out and sign in again before changing your password.');
  let response;
  try { response = await api.post('/users/change-password', { new_password: password }); }
  catch (error: any) {
    if (error.response?.status === 401) throw new Error('Your session has expired. Sign out and sign in again before retrying.');
    if (error.response?.status === 403) throw new Error('Your account is not authorized to change this staff password. Contact your agency Manager.');
    if ([400, 422].includes(error.response?.status)) throw new Error('The backend rejected the password. Check the password policy and try again.');
    throw new Error('Password change could not be confirmed. Stay here and refresh setup status, or sign out and sign in with your new password if it was already applied.');
  }
  if (response.data?.success !== true || response.data?.must_change_password !== false) {
    throw new Error('Password change was not confirmed by the backend. Refresh setup status before continuing.');
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email: account.email, password });
  if (error || data.user?.id !== account.id) {
    throw new Error('Password update was confirmed, but session recovery failed. Sign out and sign in with your new password before continuing.');
  }
  // The caller must now refresh fresh Auth and PF05 state; this response alone never opens the workspace.
}
