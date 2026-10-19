import React, { useState, FormEvent } from 'react';
import { UserRole, ApplicantRecord } from '../types';
import Logo from './Logo';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  Layers,
  User,
  Building2,
  ArrowLeft,
  ChevronRight,
  Crown,
  Loader2,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Check,
  X,
  ShieldCheck,
} from 'lucide-react';
import { validatePassword } from '../../lib/passwordPolicy';

type PortalType = 'staff' | 'applicant';

interface LoginScreenProps {
  onLogin: (
    role: UserRole,
    name?: string,
    applicantId?: string,
    isSuperAdmin?: boolean,
    roles?: UserRole[],
    rememberMe?: boolean
  ) => void;
  applicants?: ApplicantRecord[];
  tenantName?: string;
  onBack?: () => void;
}

const PORTALS: {
  key: PortalType;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
  gradient: string;
}[] = [
    {
      key: 'staff',
      title: 'Agency Staff',
      subtitle: 'Recruitment, Administration, Accounting & Management',
      icon: <Layers size={22} />,
      accent: '#0EA5E9',
      gradient: 'from-[#0EA5E9] to-[#0284C7]',
    },
    {
      key: 'applicant',
      title: 'Applicant',
      subtitle: 'Track your deployment journey and submit post-contract reviews',
      icon: <User size={22} />,
      accent: '#10B981',
      gradient: 'from-[#10B981] to-[#059669]',
    },
  ];

// Maps email/username to a staff role (used when portal === 'staff')
function resolveStaffRole(username: string): UserRole {
  return 'Management'; // Agency owners/managers default to Management, not Admin (document processor)
}

function resolveStaffName(username: string): string {
  return username || 'Staff Member';
}

export default function LoginScreen({
  onLogin,
  applicants = [],
  tenantName,
  onBack,
}: LoginScreenProps) {
  const [portal, setPortal] = useState<PortalType | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [selectedApplicantId, setSelectedApplicantId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // First-time password change prompt state
  const [forcePasswordChangeUser, setForcePasswordChangeUser] = useState<{
    user: any;
    role: UserRole;
    name: string;
    isSuper: boolean;
    roles?: UserRole[];
    rememberMe?: boolean;
    applicantId?: string;
  } | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState('');

  const selectedPortal = PORTALS.find((p) => p.key === portal);


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!portal) return;

    setLoading(true);
    setErrorMessage('');

    const trimmedUser = username.trim();
    let targetEmail = trimmedUser;
    let resolvedApplicantData: any = null;

    // ── STEP 1: RESOLVE APPLICANT CODE → EMAIL (applicant portal only, code required) ──
    // Staff/employer logins skip this round trip; post-auth role checks still enforce portal isolation.
    if (portal === 'applicant') {
      if (trimmedUser.includes('@')) {
        setErrorMessage('Applicants must sign in with their Applicant Code (e.g. APP-2026-FPT-00028), not an email address.');
        setLoading(false);
        return;
      }
      try {
        const resolveRes = await api.get(`/auth/resolve-applicant?query=${encodeURIComponent(trimmedUser)}`);
        resolvedApplicantData = resolveRes.data;
      } catch {
        resolvedApplicantData = null;
      }
    }

    // ── STRICT PORTAL ISOLATION CHECK 1: APPLICANT ATTEMPTING TO SIGN IN TO STAFF PORTAL ──
    if (portal === 'staff' && resolvedApplicantData) {
      setErrorMessage(
        `Access Denied: The identifier '${trimmedUser}' belongs to an Overseas Applicant account. Applicants cannot log into the Agency Staff portal. Please switch to the 'Applicant' portal tab.`
      );
      setLoading(false);
      return;
    }

    // In Applicant portal: verify resolved applicant data or check valid format
    if (portal === 'applicant') {
      if (resolvedApplicantData) {
        if (resolvedApplicantData.is_blocked || !resolvedApplicantData.is_active) {
          const reason = resolvedApplicantData.blocked_reason
            ? ` Reason: ${resolvedApplicantData.blocked_reason}`
            : '';
          setErrorMessage(
            `Account Suspended: Your applicant portal access has been deactivated or blocked by your agency administrator.${reason} Please contact your agency handler for assistance.`
          );
          setLoading(false);
          return;
        }
        if (resolvedApplicantData.email) {
          targetEmail = resolvedApplicantData.email;
        }
      } else if (!trimmedUser.includes('@')) {
        setErrorMessage('No registered applicant found with this Applicant Code. Please verify your code or contact your agency handler.');
        setLoading(false);
        return;
      }
    }

    // In Staff portal: username must be an email
    if (portal === 'staff' && !targetEmail.includes('@')) {
      setErrorMessage('Please enter your valid agency staff email address (e.g., admin@flowsensus.com).');
      setLoading(false);
      return;
    }

    // ── STEP 2: AUTHENTICATE WITH SUPABASE ──
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: password,
      });

      if (error) {
        setErrorMessage(error.message || 'Invalid email or password. Please try again.');
        setLoading(false);
        return;
      }

      const user = data.user;
      const isSuper = Boolean(user?.app_metadata?.is_super_admin);
      const userRoleMeta = (user?.app_metadata?.role || user?.user_metadata?.role || '').toLowerCase();
      const userRolesMeta: string[] = (user?.app_metadata?.roles || user?.user_metadata?.roles || []).map((r: any) => String(r).toLowerCase());
      const isApplicantAccount =
        userRoleMeta === 'applicant' ||
        userRolesMeta.includes('applicant') ||
        Boolean(user?.app_metadata?.applicant_code) ||
        Boolean(user?.user_metadata?.applicant_code) ||
        Boolean(resolvedApplicantData);

      // ── STRICT PORTAL ISOLATION CHECK 2 (POST-AUTH) ──────────────────────────
      // 1. Applicant attempting to sign in to Agency Staff portal
      if (portal === 'staff' && isApplicantAccount) {
        await supabase.auth.signOut();
        setErrorMessage("Access Denied: This account is registered as an Overseas Applicant. Applicants cannot log into the Agency Staff portal. Please switch to the 'Applicant' portal.");
        setLoading(false);
        return;
      }

      // 2. Agency Staff attempting to sign in to Applicant portal
      if (portal === 'applicant' && !isApplicantAccount) {
        await supabase.auth.signOut();
        setErrorMessage("Access Denied: This account is an Agency Staff account. Staff members cannot log into the Applicant Portal. Please switch to the 'Agency Staff' portal.");
        setLoading(false);
        return;
      }

      // 3. Deactivated / Blocked Applicant Check
      if (portal === 'applicant') {
        const isBlocked = user?.app_metadata?.is_blocked || resolvedApplicantData?.is_blocked;
        const isActive = user?.app_metadata?.is_active ?? resolvedApplicantData?.is_active ?? true;
        if (isBlocked || !isActive) {
          await supabase.auth.signOut();
          setErrorMessage("Account Suspended: Your applicant portal access has been deactivated or blocked by your agency administrator. Please contact your agency handler for assistance.");
          setLoading(false);
          return;
        }
      }

      if (portal === 'applicant') {
        const applicantName = user?.user_metadata?.full_name || resolvedApplicantData?.full_name || trimmedUser;
        const applicantId = resolvedApplicantData?.applicant_id || user?.user_metadata?.applicant_id || user?.app_metadata?.applicant_id || selectedApplicantId;

        // Check if applicant is required to change password on first login or after credentials resend
        const isDefaultPass = password.trim() === 'Flowsensu$2026';
        const mustChange = Boolean(
          user?.user_metadata?.must_change_password ??
          user?.app_metadata?.must_change_password ??
          isDefaultPass
        );

        if (mustChange) {
          setForcePasswordChangeUser({
            user,
            role: 'Applicant',
            name: applicantName,
            isSuper: false,
            roles: ['Applicant'],
            rememberMe,
            applicantId: applicantId ? String(applicantId) : undefined,
          });
          setLoading(false);
          return;
        }

        onLogin('Applicant', applicantName, applicantId ? String(applicantId) : undefined, false, ['Applicant'], rememberMe);
      } else {
        // Parse all assigned roles from metadata
        let assignedRoles: UserRole[] = [];
        if (Array.isArray(user?.user_metadata?.roles) && user.user_metadata.roles.length > 0) {
          assignedRoles = user.user_metadata.roles;
        } else if (typeof user?.user_metadata?.role === 'string') {
          assignedRoles = user.user_metadata.role.split(',').map((r: string) => r.trim() as UserRole).filter(Boolean);
        } else if (Array.isArray(user?.app_metadata?.roles) && user.app_metadata.roles.length > 0) {
          assignedRoles = user.app_metadata.roles;
        }

        const dynamicRole = (assignedRoles[0] || user?.user_metadata?.role || user?.app_metadata?.role || resolveStaffRole(trimmedUser)) as UserRole;
        const role = isSuper ? 'Management' : dynamicRole;
        const name = user?.user_metadata?.full_name || resolveStaffName(trimmedUser);
        const roles = isSuper
          ? (['Management', 'Admin', 'Recruitment', 'Accounting'] as UserRole[])
          : (assignedRoles.length > 0 ? assignedRoles : [role]);

        // Check if user is required to change password on first login
        const mustChange = Boolean(
          user?.user_metadata?.must_change_password ??
          user?.app_metadata?.must_change_password
        );

        if (mustChange) {
          setForcePasswordChangeUser({ user, role, name, isSuper, roles, rememberMe });
          setLoading(false);
          return;
        }

        // Record login in app_user to update last_login_at and broadcast realtime update
        api.post('/users/record-login', {}).catch(e => console.warn('Could not record login timestamp:', e));

        onLogin(role, name, undefined, isSuper, roles, rememberMe);
      }
      return;
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMessage(err.message || 'Login failed. Please check your credentials.');
      setLoading(false);
      return;
    }
  };

  const handleForcePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!forcePasswordChangeUser) return;

    const val = validatePassword(newPasswordInput);
    if (!val.isValid) {
      setPasswordChangeError(val.errors[0] || 'Please fulfill all password policy requirements.');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordChangeError('Passwords do not match. Please verify your confirmation password.');
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordChangeError('');

    try {
      // 1. Update password in Supabase Auth and clear must_change_password flag
      const { error: authError } = await supabase.auth.updateUser({
        password: newPasswordInput,
        data: { must_change_password: false },
      });
      if (authError) throw authError;

      // 2. Synchronize password hash and clear must_change_password flag in server app_metadata
      try {
        if (forcePasswordChangeUser.role === 'Applicant') {
          await api.post('/applicants/me/change-password', {
            new_password: newPasswordInput,
          });
        } else {
          await api.post('/users/change-password', {
            new_password: newPasswordInput,
          });
        }
      } catch (backendErr) {
        console.warn('Backend password sync warning:', backendErr);
      }

      // 3. The password change invalidates the current session, so sign in again
      //    with the new password to obtain a fresh, valid token.
      const accountEmail = forcePasswordChangeUser.user?.email;
      if (accountEmail) {
        const { error: reAuthError } = await supabase.auth.signInWithPassword({
          email: accountEmail,
          password: newPasswordInput,
        });
        if (reAuthError) throw reAuthError;
      }

      // 4. Complete login into workspace or applicant portal
      const { role, name, isSuper, roles, rememberMe: userRememberMe, applicantId } = forcePasswordChangeUser;
      setForcePasswordChangeUser(null);
      onLogin(role, name, applicantId, isSuper, roles, userRememberMe);
    } catch (err: any) {
      setPasswordChangeError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleBack = () => {
    setPortal(null);
    setUsername('');
    setPassword('');
    setSelectedApplicantId('');
    setErrorMessage('');
    setForcePasswordChangeUser(null);
    setPasswordChangeError('');
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] relative overflow-hidden py-12 px-4">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-[#0EA5E9] rounded-full blur-3xl opacity-10 animate-pulse" />
        <div
          className="absolute bottom-20 right-20 w-96 h-96 bg-[#F59E0B] rounded-full blur-3xl opacity-10 animate-pulse"
          style={{ animationDelay: '1.4s' }}
        />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Top Right Close Button */}
        {onBack && (
          <button
            onClick={onBack}
            className="absolute -top-10 -right-2 sm:-right-8 text-white/50 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        )}

        {/* ── Portal selector ──────────────────────────────────────────── */}
        {!portal && (
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100">
            {/* Header */}
            <div className="bg-gradient-to-br from-[#0EA5E9] to-[#0284C7] px-8 pt-8 pb-6 text-center">
              <div className="flex justify-center mb-3">
                <Logo size="large" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-wide">FLOWSENSUS</h1>
              <p className="text-white/80 text-sm mt-1">Overseas Deployment Management</p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">


              {errorMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-lg text-xs flex items-start gap-2">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200" />
                <span className="flex-shrink mx-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Select a portal to sign in
                </span>
                <div className="flex-grow border-t border-slate-200" />
              </div>

              {/* Portal cards */}
              <div className="space-y-2.5">
                {PORTALS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => {
                      setErrorMessage('');
                      setPortal(p.key);
                    }}
                    className="w-full flex items-center gap-3.5 p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all group text-left bg-white"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg bg-gradient-to-br ${p.gradient} flex items-center justify-center text-white flex-shrink-0 shadow-sm`}
                    >
                      {p.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#0F172A] text-sm">{p.title}</p>
                      <p className="text-xs text-[#64748B] mt-0.5 leading-snug">{p.subtitle}</p>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-slate-300 group-hover:text-slate-600 flex-shrink-0 transition-colors"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-100 text-center">
              <p className="text-xs text-[#64748B]">
                {tenantName ? (
                  <>
                    <span className="font-bold">{tenantName}</span> · Powered by FLOWSENSUS
                  </>
                ) : (
                  <span className="font-bold">FLOWSENSUS Multi-Tenant Placement</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* ── Login form ───────────────────────────────────────────────── */}
        {portal && selectedPortal && (
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100">
            {/* Portal header */}
            <div className={`bg-gradient-to-br ${selectedPortal.gradient} px-8 pt-6 pb-5`}>
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1.5 text-white/80 hover:text-white text-xs mb-3 transition-colors"
              >
                <ArrowLeft size={13} /> Return to All Portals
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
                  {selectedPortal.icon}
                </div>
                <div>
                  <h2 className="text-white font-black text-lg leading-tight">
                    {selectedPortal.title} Portal
                  </h2>
                  {tenantName && (
                    <p className="text-white/70 text-xs mt-0.5">{tenantName}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="px-8 py-6">

              {errorMessage && (
                <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-lg text-xs flex items-start gap-2">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email / Username / Applicant Code */}
                <div>
                  <label className="text-sm font-bold text-[#0F172A] block mb-1.5">
                    {portal === 'applicant' ? 'Applicant Code' : 'Email / Username'}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3.5 text-[#94A3B8]" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-transparent focus:ring-2 outline-none transition-all bg-[#F8FAFC]"
                      style={{
                        ['--tw-ring-color' as string]: selectedPortal.accent + '40',
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = selectedPortal.accent)}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '')}
                      placeholder={
                        portal === 'applicant'
                          ? 'e.g. APP-2026-FPT-00028'
                          : 'Enter your email address'
                      }
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-bold text-[#0F172A]">Password</label>
                    {portal === 'applicant' && (
                      <span className="text-[11px] text-sky-700 font-medium bg-sky-50 px-2 py-0.5 rounded border border-sky-100">
                        Temporary password sent via email
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3.5 text-[#94A3B8]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-11 py-2.5 border border-slate-200 rounded-lg text-sm outline-none transition-all bg-[#F8FAFC]"
                      onFocus={(e) => (e.currentTarget.style.borderColor = selectedPortal.accent)}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '')}
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-[#94A3B8] hover:text-[#64748B] transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Remember me */}
                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded text-[#0EA5E9]"
                    />
                    <span>Remember me</span>
                  </label>
                  <span className="text-slate-400">Encrypted Enterprise Session</span>
                </div>

                {/* Sign In button */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-2.5 bg-gradient-to-r ${selectedPortal.gradient} text-white font-bold rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2 mt-2`}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <span>Sign In to {selectedPortal.title}</span>
                  )}
                </button>
              </form>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-8 py-3 border-t border-slate-100 text-center">
              <p className="text-xs text-[#94A3B8]">
                {tenantName ? (
                  <>
                    <span className="font-medium text-[#64748B]">{tenantName}</span> · Powered by
                    FlowSensus
                  </>
                ) : (
                  <span className="font-medium text-[#64748B]">FlowSensus Authentication</span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Force Change Password Modal (First Login) ────────────────── */}
      {forcePasswordChangeUser && (
        <div className="fixed inset-0 bg-[#0F172A]/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 border border-slate-100 relative">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-4 mx-auto shadow-sm">
              <Lock size={26} />
            </div>
            <h2 className="text-xl font-extrabold text-center text-[#0F172A]">Set Your Private Password</h2>
            <p className="text-xs text-slate-500 text-center mt-2 mb-6 leading-relaxed">
              {forcePasswordChangeUser.role === 'Applicant'
                ? 'Welcome! Your applicant portal account was initialized with a temporary password. Please set a new private password before accessing your applicant portal.'
                : 'Welcome to the team! Your account was initialized with a temporary password. Please set a new private password before entering the workspace.'}
            </p>

            {passwordChangeError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle size={15} className="flex-shrink-0" />
                <span>{passwordChangeError}</span>
              </div>
            )}

            <form onSubmit={handleForcePasswordSubmit} className="space-y-4">
              {/* New Password Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  New Password <span className="text-slate-400 font-normal lowercase">(8–12+ chars required)</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Enter your new private password"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Real-time Enterprise Password Requirements Checklist */}
              {(() => {
                const policy = validatePassword(newPasswordInput);
                const reqs = [
                  { label: '8–12+ characters (8 min, 12+ recommended)', met: policy.checks.minLength },
                  { label: 'At least one uppercase letter (A–Z)', met: policy.checks.hasUpper },
                  { label: 'At least one lowercase letter (a–z)', met: policy.checks.hasLower },
                  { label: 'At least one numeric digit (0–9)', met: policy.checks.hasNumber },
                  { label: 'At least one special character (!@#$%...)', met: policy.checks.hasSpecial },
                  { label: 'Avoid common weak passwords (e.g. 123456)', met: policy.checks.notCommon },
                ];
                const metCount = reqs.filter(r => r.met).length;

                return (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-[#0EA5E9]" />
                        Password Security Policy
                      </span>
                      <span className={policy.isValid ? 'text-emerald-600 font-bold' : 'text-slate-400 font-medium'}>
                        {policy.isValid ? '✓ Policy Met' : `${metCount}/${reqs.length} Met`}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 pt-0.5">
                      {reqs.map((req, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-2 transition-colors ${req.met ? 'text-emerald-700 font-medium' : 'text-slate-500'
                            }`}
                        >
                          {req.met ? (
                            <Check size={13} className="text-emerald-500 flex-shrink-0" />
                          ) : (
                            <span className="w-3 h-3 rounded-full border border-slate-300 flex items-center justify-center flex-shrink-0">
                              <span className="w-1 h-1 rounded-full bg-slate-400" />
                            </span>
                          )}
                          <span className="text-[11px]">{req.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Confirm Password Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    placeholder="Re-type your new private password"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {confirmPasswordInput && (
                  <p className={`text-[11px] mt-1.5 flex items-center gap-1.5 font-medium ${newPasswordInput === confirmPasswordInput ? 'text-emerald-600' : 'text-rose-500'
                    }`}>
                    {newPasswordInput === confirmPasswordInput ? (
                      <>
                        <Check size={13} />
                        Passwords match
                      </>
                    ) : (
                      <>
                        <X size={13} />
                        Passwords do not match
                      </>
                    )}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isUpdatingPassword}
                className="w-full py-3 bg-[#0EA5E9] hover:bg-[#0284C7] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold shadow-md shadow-[#0EA5E9]/20 flex items-center justify-center gap-2 transition-all mt-6 cursor-pointer"
              >
                {isUpdatingPassword ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    {forcePasswordChangeUser.role === 'Applicant'
                      ? 'Save Password & Enter Portal'
                      : 'Save Password & Enter Workspace'}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
