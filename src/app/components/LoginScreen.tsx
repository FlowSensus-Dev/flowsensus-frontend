import React, { useState, FormEvent } from 'react';
import { UserRole, ApplicantRecord } from '../types';
import Logo from './Logo';
import { supabase } from '../../lib/supabase';
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
} from 'lucide-react';

type PortalType = 'staff' | 'applicant' | 'employer';

interface LoginScreenProps {
  onLogin: (
    role: UserRole,
    name?: string,
    applicantId?: string,
    isSuperAdmin?: boolean
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
      onLogin('Management', 'Superadmin (admin@findstaff.ph)', undefined, true);
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
          onLogin('Employer', user?.user_metadata?.full_name || trimmedUser, undefined, isSuper);
        } else if (portal === 'applicant') {
          onLogin('Applicant', user?.user_metadata?.full_name || trimmedUser, selectedApplicantId || undefined, isSuper);
        } else {
          const dynamicRole = (user?.user_metadata?.role || user?.app_metadata?.role || resolveStaffRole(trimmedUser)) as UserRole;
          const role = isSuper ? 'Management' : dynamicRole;
          const name = isSuper ? 'Superadmin (Findstaff PH)' : (user?.user_metadata?.full_name || resolveStaffName(trimmedUser));
          onLogin(role, name, undefined, isSuper);
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
      onLogin('Employer', trimmedUser || 'Employer Representative', undefined, false);
    } else if (portal === 'applicant') {
      onLogin('Applicant', trimmedUser || 'Applicant', selectedApplicantId || undefined, false);
    } else {
      const role = resolveStaffRole(trimmedUser);
      const name = resolveStaffName(trimmedUser);
      onLogin(role, name, undefined, false);
    }

    setLoading(false);
  };

  const handleBack = () => {
    setPortal(null);
    setUsername('');
    setPassword('');
    setSelectedApplicantId('');
    setErrorMessage('');
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
    </div>
  );
}
