import React, { useState, FormEvent } from 'react';
import { UserRole, ApplicantRecord } from '../../../app/types';
import Logo from '../../../components/layout/Logo';
import { Eye, EyeOff, Lock, Mail, Layers, User, Building2, ArrowLeft, ChevronRight } from 'lucide-react';

type PortalType = 'staff' | 'applicant' | 'employer';

interface LoginScreenProps {
  onLogin: (role: UserRole, name?: string, applicantId?: string) => void;
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

// Maps email/username to a staff role (used only when portal === 'staff')
function resolveStaffRole(username: string): UserRole {
  const l = username.toLowerCase();
  if (l.includes('recruit') || l.includes('sarah')) return 'Recruitment';
  if (l.includes('admin')   || l.includes('maria')) return 'Admin';
  if (l.includes('account') || l.includes('mark'))  return 'Accounting';
  if (l.includes('manage'))                          return 'Management';
  return 'Recruitment';
}

function resolveStaffName(username: string): string {
  const l = username.toLowerCase();
  if (l.includes('sarah'))  return 'Sarah Cruz';
  if (l.includes('maria'))  return 'Maria Santos';
  if (l.includes('mark'))   return 'Mark Tan';
  return username || 'Staff Member';
}

export default function LoginScreen({
  onLogin,
  applicants = [],
  tenantName,
}: LoginScreenProps) {
  const [portal,             setPortal]             = useState<PortalType | null>(null);
  const [username,           setUsername]           = useState('');
  const [password,           setPassword]           = useState('');
  const [showPassword,       setShowPassword]       = useState(false);
  const [rememberMe,         setRememberMe]         = useState(false);
  const [selectedApplicantId, setSelectedApplicantId] = useState('');

  const selectedPortal = PORTALS.find((p) => p.key === portal);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!portal) return;

    if (portal === 'employer') {
      onLogin('Employer', username || 'Employer Representative');
    } else if (portal === 'applicant') {
      onLogin('Applicant', username || 'Applicant', selectedApplicantId || undefined);
    } else {
      const role = resolveStaffRole(username);
      const name = resolveStaffName(username);
      onLogin(role, name);
    }
  };

  const handleBack = () => {
    setPortal(null);
    setUsername('');
    setPassword('');
    setSelectedApplicantId('');
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-[#0EA5E9] rounded-full blur-3xl opacity-10 animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#06B6D4] rounded-full blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '1.4s' }} />
      </div>

      <div className="w-full max-w-md mx-4 relative z-10">

        {/* ── Portal selector ──────────────────────────────────────────── */}
        {!portal && (
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-br from-[#0EA5E9] to-[#0284C7] px-8 pt-8 pb-6 text-center">
              <div className="flex justify-center mb-3">
                <Logo size="large" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-wide">FLOWSENSUS</h1>
              <p className="text-white/70 text-sm mt-1">Overseas Deployment Management</p>
            </div>

            {/* Portal cards */}
            <div className="p-6 space-y-3">
              <p className="text-xs font-bold text-[#64748B] uppercase tracking-widest text-center mb-4">
                Select your portal to continue
              </p>
              {PORTALS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPortal(p.key)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-slate-100 hover:border-transparent hover:shadow-lg transition-all group text-left"
                  style={{ ['--hover-border' as string]: p.accent }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = p.accent + '40')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '')}
                >
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.gradient} flex items-center justify-center text-white flex-shrink-0 shadow-md`}
                  >
                    {p.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#0F172A] text-sm">{p.title}</p>
                    <p className="text-xs text-[#64748B] mt-0.5 leading-snug">{p.subtitle}</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 text-center">
              <p className="text-xs text-[#64748B]">
                {tenantName
                  ? <><span className="font-bold">{tenantName}</span> · Powered by FlowSensus</>
                  : <span className="font-bold">FlowSensus</span>
                }
              </p>
            </div>
          </div>
        )}

        {/* ── Login form ───────────────────────────────────────────────── */}
        {portal && selectedPortal && (
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Portal header */}
            <div className={`bg-gradient-to-br ${selectedPortal.gradient} px-8 pt-6 pb-5`}>
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs mb-4 transition-colors"
              >
                <ArrowLeft size={13} /> All Portals
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
                  {selectedPortal.icon}
                </div>
                <div>
                  <h2 className="text-white font-black text-lg leading-tight">{selectedPortal.title} Portal</h2>
                  {tenantName && (
                    <p className="text-white/60 text-xs mt-0.5">{tenantName}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="px-8 py-6">
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Email */}
                <div>
                  <label className="text-sm font-bold text-[#0F172A] block mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3.5 text-[#94A3B8]" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-lg text-sm focus:border-transparent focus:ring-2 outline-none transition-all bg-[#F8FAFC]"
                      style={{ ['--tw-ring-color' as string]: selectedPortal.accent + '40' }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = selectedPortal.accent)}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '')}
                      placeholder="Enter your email address"
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
                      className="w-full pl-9 pr-11 py-3 border border-slate-200 rounded-lg text-sm outline-none transition-all bg-[#F8FAFC]"
                      onFocus={(e) => (e.currentTarget.style.borderColor = selectedPortal.accent)}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '')}
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3.5 text-[#94A3B8] hover:text-[#64748B] transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Applicant profile selector */}
                {portal === 'applicant' && applicants.length > 0 && (
                  <div>
                    <label className="text-sm font-bold text-[#0F172A] block mb-1.5">Select Your Profile</label>
                    <select
                      value={selectedApplicantId}
                      onChange={(e) => setSelectedApplicantId(e.target.value)}
                      className="w-full px-3 py-3 border border-slate-200 rounded-lg text-sm outline-none transition-all bg-[#F8FAFC]"
                      onFocus={(e) => (e.currentTarget.style.borderColor = selectedPortal.accent)}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '')}
                    >
                      <option value="">Select your applicant profile</option>
                      {applicants.map((app) => (
                        <option key={app.id} value={app.id}>
                          {app.name} — {app.id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Remember + forgot */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-[#64748B]">Remember me</span>
                  </label>
                  <button type="button" className="text-sm font-semibold hover:underline" style={{ color: selectedPortal.accent }}>
                    Forgot Password?
                  </button>
                </div>

                {/* Sign In button */}
                <button
                  type="submit"
                  className={`w-full py-3 bg-gradient-to-r ${selectedPortal.gradient} text-white font-bold rounded-lg hover:shadow-lg hover:scale-[1.01] transition-all mt-2`}
                >
                  Sign In to {selectedPortal.title} Portal
                </button>
              </form>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-8 py-3.5 border-t border-slate-100 text-center">
              <p className="text-xs text-[#94A3B8]">
                {tenantName
                  ? <><span className="font-medium text-[#64748B]">{tenantName}</span> · Powered by FlowSensus</>
                  : <span className="font-medium text-[#64748B]">FlowSensus</span>
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
