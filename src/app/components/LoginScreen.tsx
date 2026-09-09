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

type PortalType = 'staff' | 'applicant' | 'employer';

interface LoginScreenProps {
  onLogin: (
    role: UserRole,
    name?: string,
    applicantId?: string,
    isSuperAdmin?: boolean,
    roles?: UserRole[]
  ) => void;
  applicants?: ApplicantRecord[];
  tenantName?: string;
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
  {
    key: 'employer',
    title: 'Employer',
    subtitle: 'Evaluate deployed workers and manage workforce records',
    icon: <Building2 size={22} />,
    accent: '#1D4ED8',
    gradient: 'from-[#1D4ED8] to-[#1E40AF]',
  },
];

// Maps email/username to a staff role (used when portal === 'staff')
function resolveStaffRole(username: string): UserRole {
  const l = username.toLowerCase();
  if (l.includes('recruit') || l.includes('sarah')) return 'Recruitment';
  if (l.includes('admin') || l.includes('maria')) return 'Admin';
  if (l.includes('account') || l.includes('mark')) return 'Accounting';
  if (l.includes('manage')) return 'Management';
  return 'Management';
}

function resolveStaffName(username: string): string {
  const l = username.toLowerCase();
  if (l.includes('admin@findstaff.ph')) return 'Superadmin (Findstaff PH)';
  if (l.includes('sarah') || l.includes('recruit')) return 'Sarah Cruz (Recruitment)';
  if (l.includes('maria')) return 'Maria Santos (Admin)';
  if (l.includes('mark') || l.includes('account')) return 'Mark Tan (Accounting)';
  if (l.includes('admin@flowsensus.com')) return 'Agency Admin';
  return username || 'Staff Member';
}

export default function LoginScreen({
  onLogin,
  applicants = [],
  tenantName,
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
  } | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState('');

  const selectedPortal = PORTALS.find((p) => p.key === portal);

  // 1-Click Superadmin Login
  const handleSuperadminQuickLogin = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'admin@findstaff.ph',
        password: 'AdminPassword2026!',
      });

      if (error) {
        throw error;
      }

      // Successfully authenticated via Supabase as Superadmin
      onLogin('Management', 'Superadmin (admin@findstaff.ph)', undefined, true, [
        'Management',
        'Admin',
        'Recruitment',
        'Accounting',
      ]);
    } catch (err: any) {
      console.error('Superadmin login error:', err);
      setErrorMessage(
        err.message || 'Authentication failed. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!portal) return;

    setLoading(true);
    setErrorMessage('');

    const trimmedUser = username.trim();

    // Check if authenticating via Supabase
    if (trimmedUser.includes('@')) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: trimmedUser,
          password: password,
        });

        if (error) {
          // If Supabase authentication fails, inform the user
          setErrorMessage(error.message);
          setLoading(false);
          return;
        }

        const user = data.user;
        const isSuper = Boolean(
          user?.email === 'admin@findstaff.ph' ||
            user?.app_metadata?.is_super_admin ||
            user?.user_metadata?.is_super_admin
        );

        if (portal === 'employer') {
          onLogin('Employer', user?.user_metadata?.full_name || trimmedUser, undefined, isSuper, ['Employer']);
        } else if (portal === 'applicant') {
          onLogin('Applicant', user?.user_metadata?.full_name || trimmedUser, selectedApplicantId || undefined, isSuper, ['Applicant']);
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
          const name = isSuper ? 'Superadmin (Findstaff PH)' : (user?.user_metadata?.full_name || resolveStaffName(trimmedUser));
          const roles = isSuper
            ? (['Management', 'Admin', 'Recruitment', 'Accounting'] as UserRole[])
            : (assignedRoles.length > 0 ? assignedRoles : [role]);

          // Check if user is required to change password on first login
          const mustChange = Boolean(
            user?.user_metadata?.must_change_password ??
            user?.app_metadata?.must_change_password
          );

          if (mustChange) {
            setForcePasswordChangeUser({ user, role, name, isSuper, roles });
            setLoading(false);
            return;
          }

          onLogin(role, name, undefined, isSuper, roles);
        }
        return;
      } catch (err: any) {
        console.error('Login error:', err);
        setErrorMessage(err.message || 'Login failed. Please try again.');
        setLoading(false);
        return;
      }
    }

    // Fallback for offline demo usernames (e.g. sarah, maria, mark)
    if (portal === 'employer') {
      onLogin('Employer', trimmedUser || 'Employer Representative', undefined, false, ['Employer']);
    } else if (portal === 'applicant') {
      onLogin('Applicant', trimmedUser || 'Applicant', selectedApplicantId || undefined, false, ['Applicant']);
    } else {
      const role = resolveStaffRole(trimmedUser);
      const name = resolveStaffName(trimmedUser);
      let demoRoles: UserRole[] = [role];
      if (trimmedUser.toLowerCase().includes('jose') || trimmedUser.toLowerCase() === 'admin@flowsensus.com') {
        demoRoles = ['Admin', 'Recruitment'];
      }
      onLogin(role, name, undefined, false, demoRoles);
    }

    setLoading(false);
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

      // 2. Synchronize password hash in backend USER table
      try {
        await api.post('/users/change-password', {
          new_password: newPasswordInput,
        });
      } catch (backendErr) {
        console.warn('Backend password sync warning:', backendErr);
      }

      // 3. Complete login into workspace
      const { role, name, isSuper, roles } = forcePasswordChangeUser;
      setForcePasswordChangeUser(null);
      onLogin(role, name, undefined, isSuper, roles);
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
              {/* 👑 Superadmin 1-Click Fast Track Card */}
              <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-slate-50 border-2 border-amber-400/60 rounded-xl p-4 shadow-sm relative overflow-hidden">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-md flex-shrink-0">
                    <Crown size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-amber-700 uppercase tracking-wider">
                        Master Access
                      </span>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                        Live Auth
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 text-sm">Superadmin Account</p>
                    <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                      Access all platform operational modules with verified enterprise role-based authorization.
                    </p>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleSuperadminQuickLogin}
                      className="mt-3 w-full py-2 px-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-lg shadow transition-all flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={14} className="animate-spin text-slate-950" />
                          <span>Authenticating...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} />
                          <span>1-Click Sign In as Superadmin</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-lg text-xs flex items-start gap-2">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200" />
                <span className="flex-shrink mx-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Or choose a portal
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
                    <span className="font-bold">{tenantName}</span> · Powered by FlowSensus
                  </>
                ) : (
                  <span className="font-bold">FlowSensus Multi-Tenant Placement</span>
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
                {/* Email / Username */}
                <div>
                  <label className="text-sm font-bold text-[#0F172A] block mb-1.5">
                    Email / Username
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
                      placeholder="admin@findstaff.ph"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="text-sm font-bold text-[#0F172A] block mb-1.5">Password</label>
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

                {/* Applicant profile selector */}
                {portal === 'applicant' && applicants.length > 0 && (
                  <div>
                    <label className="text-sm font-bold text-[#0F172A] block mb-1.5">
                      Select Your Profile
                    </label>
                    <select
                      value={selectedApplicantId}
                      onChange={(e) => setSelectedApplicantId(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none transition-all bg-[#F8FAFC]"
                      onFocus={(e) => (e.currentTarget.style.borderColor = selectedPortal.accent)}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '')}
                    >
                      <option value="">Select your applicant profile</option>
                      {applicants.map((app) => (
                        <option key={app.id} value={app.id}>
                          {app.name} — ID: {app.id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

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
              Welcome to the team! Your account was initialized with a temporary password. Please set a new private password before entering the workspace.
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
                          className={`flex items-center gap-2 transition-colors ${
                            req.met ? 'text-emerald-700 font-medium' : 'text-slate-500'
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
                  <p className={`text-[11px] mt-1.5 flex items-center gap-1.5 font-medium ${
                    newPasswordInput === confirmPasswordInput ? 'text-emerald-600' : 'text-rose-500'
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
                    Save Password & Enter Workspace
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
