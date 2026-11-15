import { useState, useEffect, useRef } from 'react';
import { User, Shield, Key, CheckCircle, Eye, EyeOff, Check, X, ShieldCheck, Loader2 } from 'lucide-react';
import { UserRole, ActivityLog, ViewType } from '../../types';
import { supabase } from '../../../lib/supabase';
import { api } from '../../../lib/api';
import { validatePassword } from '../../../lib/passwordPolicy';
import { hasAccessToView } from '../../../lib/accessControl';
import { knownStaffRoles, normalizeSystemRoles, StaffProfile } from '../../../lib/staffProfile';
import { changeRequiredStaffPassword } from '../../../lib/staffOnboarding';

const PROFILE_MODULES: { view: ViewType; label: string }[] = [
  { view: 'dashboard', label: 'Dashboard' }, { view: 'applicants', label: 'Applicants' },
  { view: 'registration', label: 'Applicant Registration' }, { view: 'screening', label: 'Screening Panel' },
  { view: 'digital-exams', label: 'Digital Exams' }, { view: 'profiling', label: 'Applicant Profiling' },
  { view: 'cv', label: 'CV Encoding' }, { view: 'endorsement', label: 'Endorsement Tracker' },
  { view: 'requirements', label: 'Document Requirements' }, { view: 'joborders', label: 'Job Orders' },
  { view: 'employers', label: 'Employer Profiles' }, { view: 'fittowork', label: 'Fit-to-Work' },
  { view: 'ocr', label: 'Document Validation' }, { view: 'alerts', label: '3-2-1 Alerts' },
  { view: 'expense', label: 'Expense Ledger' }, { view: 'accounting-settings', label: 'Accounting Settings' },
  { view: 'evaluation', label: 'Evaluation & Workflow' }, { view: 'manager', label: 'CV & Employer Hub' },
  { view: 'forecast', label: 'Predictive Timeline' }, { view: 'history', label: 'Audit Log' },
  { view: 'reports', label: 'Operational Reports' }, { view: 'users', label: 'User Management' },
  { view: 'profile', label: 'Staff Account Profile' },
];

interface UserProfileProps {
  currentUserName: string;
  currentUserRole: UserRole;
  currentUserRoles?: UserRole[];
  workflowPermissions?: Record<string, UserRole[]>;
  activityLogs?: ActivityLog[];
  showToast: (message: string) => void;
}

export default function UserProfile({
  currentUserName,
  currentUserRole,
  currentUserRoles,
  workflowPermissions,
  activityLogs = [],
  showToast,
}: UserProfileProps) {
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [profileAttempt, setProfileAttempt] = useState(0);
  const passwordBusy = useRef(false);

  useEffect(() => {
    let active = true;
    setProfile(null);
    setProfileLoading(true);
    setProfileError('');
    async function loadProfile() {
      try {
        const { data } = await api.get('/users/me');
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid profile response');
        if (active) setProfile(data);
      } catch {
        if (active) setProfileError('Your account profile could not be loaded. Please retry.');
      } finally {
        if (active) setProfileLoading(false);
      }
    }
    void loadProfile();
    return () => { active = false; };
  }, [currentUserName, profileAttempt]);

  // Session roles are a presentation fallback for older/unavailable responses
  // only. An authoritative empty array stays empty; these labels never authorize mutations.
  const rolesFromProfile = Array.isArray(profile?.role_names);
  const displayedRoles = normalizeSystemRoles(rolesFromProfile
    ? profile!.role_names
    : (currentUserRoles ?? [currentUserRole]));
  const accessRoles = knownStaffRoles(displayedRoles);
  const missingValue = profileLoading ? 'Loading...' : 'Not provided';
  const fullName = profile?.full_name || (profileLoading ? currentUserName : 'Not provided');
  const department = profile?.department_name || profile?.department || missingValue;
  const joinDate = profile?.created_at ? new Date(profile.created_at) : null;
  const roleBadges = () => displayedRoles.length ? displayedRoles.map((role) => (
    <span key={role} className={`px-3 py-1 rounded-full text-xs font-bold ${getRoleBadgeColor(role)}`}>{role}</span>
  )) : <span className="text-sm">No system roles assigned</span>;

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Get user's recent activity
  const userActivity = activityLogs
    .filter((log) => log.performedBy === currentUserName)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  // Calculate activity stats
  const totalActions = activityLogs.filter((log) => log.performedBy === currentUserName).length;
  const thisMonth = new Date().getMonth();
  const actionsThisMonth = activityLogs.filter(
    (log) => log.performedBy === currentUserName && new Date(log.timestamp).getMonth() === thisMonth
  ).length;

  const handleChangePassword = async () => {
    if (passwordBusy.current || !passwordData.currentPassword) return;
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast('❌ Passwords do not match. Please re-type your confirmation password.');
      return;
    }
    const val = validatePassword(passwordData.newPassword);
    if (!val.isValid) {
      showToast(`❌ ${val.errors[0]}`);
      return;
    }

    passwordBusy.current = true;
    setIsSavingPassword(true);
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user?.email) throw new Error('Your account could not be verified. Sign in again.');
      const verification = await supabase.auth.signInWithPassword({
        email: user.email, password: passwordData.currentPassword,
      });
      if (verification.error || verification.data.user?.id !== user.id) {
        throw new Error('Current password could not be verified. Please try again.');
      }
      // Reuse the existing backend-confirmed staff password flow and session recovery.
      await changeRequiredStaffPassword(user, passwordData.newPassword);

      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showToast('✓ Password updated successfully.');
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Failed to change password. Please try again.'}`);
    } finally {
      passwordBusy.current = false;
      setIsSavingPassword(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Recruitment':
        return 'bg-[#0EA5E9] text-white';
      case 'Admin':
        return 'bg-[#8B5CF6] text-white';
      case 'Accounting':
        return 'bg-[#10B981] text-white';
      case 'Management':
        return 'bg-[#F59E0B] text-white';
      default:
        return 'bg-slate-500 text-white';
    }
  };

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-extrabold tracking-tight text-[#0F172A] flex items-start gap-2">
          <User className="w-8 h-8 shrink-0" />
          Staff Account Profile
        </h2>
        <p className="text-sm text-[#64748B] mt-1 font-medium">Manage your account information and settings</p>
      </div>

      <section aria-label="Official account details" className="min-w-0 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-[#0EA5E9] to-[#8B5CF6] p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0">
            <div aria-hidden="true" className="w-16 h-16 shrink-0 rounded-full bg-white flex items-center justify-center font-black text-[#0EA5E9] text-2xl shadow-lg">
              {fullName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .substring(0, 2)}
            </div>
            <div className="min-w-0 [overflow-wrap:anywhere]">
              <h3 className="text-2xl font-black text-white">{fullName}</h3>
              <p className="text-sm text-white/80 font-medium mt-1">{department}</p>
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Profile system roles">
                {roleBadges()}
              </div>
            </div>
          </div>
        </div>

        {/* Read-only official details */}
        <div className="p-4 sm:p-6 space-y-4">
          {profileLoading && <p role="status" className="text-sm text-slate-500">Loading account profile...</p>}
          {profileError && (
            <div role="alert" className="text-sm text-rose-700">
              {profileError}
              <button type="button" onClick={() => setProfileAttempt((value) => value + 1)} className="ml-2 underline font-bold">Retry profile</button>
            </div>
          )}
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              ['Employee ID', profile?.user_id != null ? `EMP-2026-${String(profile.user_id).padStart(3, '0')}` : missingValue],
              ['Email Address', profile?.email || missingValue],
              ['Join Date', joinDate && !isNaN(joinDate.getTime())
                ? joinDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : missingValue],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-2">{label}</dt>
                <dd className="text-sm font-bold text-[#0F172A] [overflow-wrap:anywhere]">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-slate-500">Official account details are read-only on this page. Name corrections are handled through User Management.</p>
          {!rolesFromProfile && <p className="text-xs text-slate-500">System roles shown from this session while verified role information is unavailable.</p>}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 items-start gap-6 min-w-0">
        <section aria-labelledby="activity-overview-heading" className="min-w-0 bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
          <h3 id="activity-overview-heading" className="font-black text-[#0F172A] text-lg mb-4">Activity Overview</h3>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="min-w-0 bg-[#0EA5E9]/10 rounded-lg p-3 border border-[#0EA5E9]/30">
              <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Total Actions</p>
              <p className="text-2xl font-black text-[#0EA5E9]">{totalActions}</p>
              <p className="text-xs text-[#64748B] mt-1">All time</p>
            </div>
            <div className="min-w-0 bg-[#10B981]/10 rounded-lg p-3 border border-[#10B981]/30">
              <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">This Month</p>
              <p className="text-2xl font-black text-[#10B981]">{actionsThisMonth}</p>
              <p className="text-xs text-[#64748B] mt-1">
                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <h4 id="recent-activity-heading" className="font-bold text-[#0F172A] text-sm mb-3">Recent Activity</h4>
          {userActivity.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-[#64748B]">No recent activity</p>
            </div>
          ) : (
            <ol aria-labelledby="recent-activity-heading" className="space-y-3">
              {userActivity.map((log) => (
                <li key={log.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-[#0EA5E9]/10 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-4 h-4 text-[#0EA5E9]" />
                  </div>
                  <div className="flex-1 min-w-0 [overflow-wrap:anywhere]">
                    <p className="text-xs font-bold text-[#0F172A]">{log.action}</p>
                    <p className="text-xs text-[#64748B] mt-1">{log.details}</p>
                    <time dateTime={log.timestamp} className="block text-xs text-[#64748B] mt-1">
                      {new Date(log.timestamp).toLocaleString()}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="change-password-heading" className="min-w-0 bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-200">
            <Key className="w-5 h-5 text-[#F59E0B]" />
            <h3 id="change-password-heading" className="font-black text-[#0F172A] text-lg">Change Password</h3>
          </div>

          <div className="space-y-4">
            {/* Current Password */}
            <div>
              <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-2">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full pl-3 pr-10 py-2 border-2 border-slate-200 rounded-lg text-sm focus:border-[#0EA5E9] outline-none font-mono"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* New Password and Confirm Password */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-2">
                  New Password <span className="text-slate-400 font-normal lowercase">(8–12+ chars)</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full pl-3 pr-10 py-2 border-2 border-slate-200 rounded-lg text-sm focus:border-[#0EA5E9] outline-none font-mono"
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full pl-3 pr-10 py-2 border-2 border-slate-200 rounded-lg text-sm focus:border-[#0EA5E9] outline-none font-mono"
                    placeholder="Re-enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {passwordData.confirmPassword && (
                  <p className={`text-[11px] mt-1.5 flex items-center gap-1 font-medium ${
                    passwordData.newPassword === passwordData.confirmPassword ? 'text-emerald-600' : 'text-rose-500'
                  }`}>
                    {passwordData.newPassword === passwordData.confirmPassword ? (
                      <>
                        <Check size={12} /> Passwords match
                      </>
                    ) : (
                      <>
                        <X size={12} /> Passwords do not match
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Password Policy Requirements Card */}
            {(() => {
              const policy = validatePassword(passwordData.newPassword);
              const reqs = [
                { label: '8–12+ characters (8 min, 12+ recommended)', met: policy.checks.minLength },
                { label: 'Uppercase letter (A–Z)', met: policy.checks.hasUpper },
                { label: 'Lowercase letter (a–z)', met: policy.checks.hasLower },
                { label: 'Numeric digit (0–9)', met: policy.checks.hasNumber },
                { label: 'Special character (!@#$%...)', met: policy.checks.hasSpecial },
                { label: 'Avoid common weak passwords', met: policy.checks.notCommon },
              ];
              const metCount = reqs.filter(r => r.met).length;

              return (
                <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 space-y-1.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-[#F59E0B]" />
                      Password Policy Standards
                    </span>
                    <span className={policy.isValid ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                      {policy.isValid ? '✓ Standards Met' : `${metCount}/${reqs.length}`}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2 pt-1">
                    {reqs.map((req, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-1.5 min-w-0 text-[11px] transition-colors ${
                          req.met ? 'text-emerald-700 font-medium' : 'text-slate-500'
                        }`}
                      >
                        {req.met ? (
                          <Check size={12} className="text-emerald-500 flex-shrink-0" />
                        ) : (
                          <span className="w-2.5 h-2.5 rounded-full border border-slate-300 flex items-center justify-center flex-shrink-0">
                            <span className="w-1 h-1 rounded-full bg-slate-400" />
                          </span>
                        )}
                        <span className="min-w-0">{req.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <button
              onClick={handleChangePassword}
              disabled={
                isSavingPassword ||
                !passwordData.currentPassword ||
                !passwordData.newPassword ||
                !passwordData.confirmPassword
              }
              className="w-full px-6 py-3 bg-[#F59E0B] text-white text-sm font-bold rounded-lg hover:bg-[#D97706] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm"
            >
              {isSavingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating Password...
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  Change Password
                </>
              )}
            </button>
          </div>
        </section>
      </div>

      <section aria-labelledby="role-permissions-heading" className="min-w-0 bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
        <h3 id="role-permissions-heading" className="font-black text-[#0F172A] text-lg mb-3 flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#8B5CF6]" />
          Role Permissions
        </h3>
        <p className="text-xs text-slate-500 mb-4">Module access based on assigned system roles and current workflow settings.</p>
        {accessRoles.length > 0 ? (
          <ul aria-labelledby="role-permissions-heading" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-x-4 gap-y-3 text-sm">
            {PROFILE_MODULES.filter(({ view }) =>
              hasAccessToView(view, accessRoles, false, workflowPermissions)
            ).map(({ view, label }) => (
              <li key={view} className="flex items-start gap-2 min-w-0">
                <CheckCircle className="w-4 h-4 shrink-0 text-[#10B981]" />
                <span className="text-[#0F172A] min-w-0">{label}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-500">No recognized staff role permissions to display.</p>}
      </section>
    </div>
  );
}
