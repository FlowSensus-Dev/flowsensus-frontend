import { useState } from 'react';
import { User, Mail, Phone, Shield, Calendar, Key, Save, Edit2, CheckCircle } from 'lucide-react';
import { UserRole, ActivityLog } from '../../../app/types';

interface UserProfileProps {
  currentUserName: string;
  currentUserRole: UserRole;
  activityLogs?: ActivityLog[];
  showToast: (message: string) => void;
}

export default function UserProfile({
  currentUserName,
  currentUserRole,
  activityLogs = [],
  showToast,
}: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: currentUserName,
    email: currentUserName.toLowerCase().replace(' ', '.') + '@flowsensus.com',
    phone: '+63 917 555 1234',
    department: currentUserRole === 'Recruitment' ? 'Recruitment' :
                 currentUserRole === 'Admin' ? 'Administration' :
                 currentUserRole === 'Accounting' ? 'Finance & Accounting' :
                 currentUserRole === 'Management' ? 'Management' : 'Applicant Services',
    employeeId: 'EMP-2026-' + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
    joinDate: '2024-06-15',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Get user's recent activity
  const userActivity = activityLogs
    .filter((log) => log.performedBy === currentUserName)
    .slice(0, 5);

  // Calculate activity stats
  const totalActions = activityLogs.filter((log) => log.performedBy === currentUserName).length;
  const thisMonth = new Date().getMonth();
  const actionsThisMonth = activityLogs.filter(
    (log) => log.performedBy === currentUserName && new Date(log.timestamp).getMonth() === thisMonth
  ).length;

  const handleSaveProfile = () => {
    setIsEditing(false);
    showToast('✓ Profile updated successfully');
  };

  const handleChangePassword = () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast('❌ Passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 8) {
      showToast('❌ Password must be at least 8 characters');
      return;
    }
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    showToast('✓ Password changed successfully');
  };

  const getRoleBadgeColor = (role: UserRole) => {
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
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-extrabold tracking-tight text-[#0F172A]">
          <User className="w-8 h-8 inline-block mr-2" />
          Staff Account Profile
        </h2>
        <p className="text-sm text-[#64748B] mt-1 font-medium">Manage your account information and settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Profile Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Card */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-[#0EA5E9] to-[#8B5CF6] p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center font-black text-[#0EA5E9] text-2xl shadow-lg">
                    {currentUserName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .substring(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">{currentUserName}</h3>
                    <p className="text-sm text-white/80 font-medium mt-1">{formData.department}</p>
                    <div className="mt-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${getRoleBadgeColor(currentUserRole)}`}>
                        {currentUserRole}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="px-4 py-2 bg-white text-[#0EA5E9] text-sm font-bold rounded-lg hover:bg-slate-50 flex items-center gap-2"
                >
                  {isEditing ? (
                    <>
                      <Save className="w-4 h-4" />
                      Save
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Profile Form */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-2">
                    Full Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
                    />
                  ) : (
                    <p className="text-sm font-bold text-[#0F172A]">{formData.fullName}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-2">
                    Employee ID
                  </label>
                  <p className="text-sm font-bold text-[#0F172A]">{formData.employeeId}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email Address
                  </label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
                    />
                  ) : (
                    <p className="text-sm font-bold text-[#0F172A]">{formData.email}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-2 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Phone Number
                  </label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
                    />
                  ) : (
                    <p className="text-sm font-bold text-[#0F172A]">{formData.phone}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Department
                  </label>
                  <p className="text-sm font-bold text-[#0F172A]">{formData.department}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Join Date
                  </label>
                  <p className="text-sm font-bold text-[#0F172A]">
                    {new Date(formData.joinDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              {isEditing && (
                <div className="pt-4 border-t border-slate-200">
                  <button
                    onClick={handleSaveProfile}
                    className="w-full px-6 py-3 bg-[#0EA5E9] text-white text-sm font-bold rounded-lg hover:bg-[#0284C7] flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save Changes
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Security Settings */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-200">
              <Key className="w-5 h-5 text-[#F59E0B]" />
              <h3 className="font-black text-[#0F172A] text-lg">Security Settings</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
                  placeholder="Enter current password"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
                    placeholder="Min. 8 characters"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
                    placeholder="Re-enter new password"
                  />
                </div>
              </div>

              <button
                onClick={handleChangePassword}
                disabled={!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                className="w-full px-6 py-3 bg-[#F59E0B] text-white text-sm font-bold rounded-lg hover:bg-[#D97706] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Key className="w-4 h-4" />
                Change Password
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Activity Stats & Recent Activity */}
        <div className="space-y-6">
          {/* Activity Stats */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="font-black text-[#0F172A] text-lg mb-4">Activity Statistics</h3>
            <div className="space-y-4">
              <div className="bg-[#0EA5E9]/10 rounded-lg p-4 border border-[#0EA5E9]/30">
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Total Actions</p>
                <p className="text-3xl font-black text-[#0EA5E9]">{totalActions}</p>
                <p className="text-xs text-[#64748B] mt-1">All time</p>
              </div>

              <div className="bg-[#10B981]/10 rounded-lg p-4 border border-[#10B981]/30">
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">This Month</p>
                <p className="text-3xl font-black text-[#10B981]">{actionsThisMonth}</p>
                <p className="text-xs text-[#64748B] mt-1">
                  {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              </div>

              <div className="bg-[#8B5CF6]/10 rounded-lg p-4 border border-[#8B5CF6]/30">
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1">Role</p>
                <p className="text-lg font-black text-[#8B5CF6]">{currentUserRole}</p>
                <p className="text-xs text-[#64748B] mt-1">Access Level</p>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="font-black text-[#0F172A] text-lg mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {userActivity.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-[#64748B]">No recent activity</p>
                </div>
              ) : (
                userActivity.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="w-8 h-8 rounded-full bg-[#0EA5E9]/10 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-[#0EA5E9]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#0F172A]">{log.action}</p>
                      <p className="text-xs text-[#64748B] mt-1 truncate">{log.details}</p>
                      <p className="text-xs text-[#64748B] mt-1">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Role Permissions */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="font-black text-[#0F172A] text-lg mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#8B5CF6]" />
              Role Permissions
            </h3>
            <div className="space-y-2 text-sm">
              {currentUserRole === 'Recruitment' && (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#10B981]" />
                    <span className="text-[#0F172A]">Applicant Registration</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#10B981]" />
                    <span className="text-[#0F172A]">Screening & Medical</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#10B981]" />
                    <span className="text-[#0F172A]">Applicant Profiling</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#10B981]" />
                    <span className="text-[#0F172A]">CV Encoding</span>
                  </div>
                </>
              )}
              {currentUserRole === 'Admin' && (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#10B981]" />
                    <span className="text-[#0F172A]">Document OCR</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#10B981]" />
                    <span className="text-[#0F172A]">Compliance Monitoring</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#10B981]" />
                    <span className="text-[#0F172A]">3-2-1 Alerts</span>
                  </div>
                </>
              )}
              {currentUserRole === 'Accounting' && (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#10B981]" />
                    <span className="text-[#0F172A]">Expense Ledger</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#10B981]" />
                    <span className="text-[#0F172A]">Financial Tracking</span>
                  </div>
                </>
              )}
              {currentUserRole === 'Management' && (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#10B981]" />
                    <span className="text-[#0F172A]">CV & Employer Hub</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#10B981]" />
                    <span className="text-[#0F172A]">Predictive Timeline</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#10B981]" />
                    <span className="text-[#0F172A]">Operational Reports</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#10B981]" />
                    <span className="text-[#0F172A]">All Modules (Read)</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
