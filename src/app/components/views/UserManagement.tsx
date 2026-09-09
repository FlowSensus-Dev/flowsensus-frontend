import { useState, useEffect } from 'react';
import { UserPlus, Edit2, Trash2, ShieldOff, ShieldCheck, X, Key, Copy, Check, Mail, Eye, EyeOff, Sparkles, Loader2 } from 'lucide-react';
import { ActivityLog, UserRole } from '../../types';
import { api } from '../../../lib/api';

interface StaffAccount {
  id: string;
  name: string;
  email: string;
  department: string;
  role: UserRole;
  roles: UserRole[];
  status: 'Active' | 'Inactive';
  createdDate: string;
}

interface UserManagementProps {
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
}

const DEPT_ROLE_MAP: Record<string, { role: UserRole; dept: string; deptId: number }> = {
  Recruitment: { role: 'Recruitment', dept: 'Recruitment', deptId: 2 },
  Admin: { role: 'Admin', dept: 'Admin', deptId: 3 },
  Accounting: { role: 'Accounting', dept: 'Accounting', deptId: 4 },
  Management: { role: 'Management', dept: 'Management', deptId: 1 },
  SuperAdmin: { role: 'Management', dept: 'Executive', deptId: 1 },
};

const SYSTEM_ROLES_CATALOG: { id: UserRole; label: string; desc: string; badgeColor: string; activeColor: string }[] = [
  { id: 'Recruitment', label: 'Recruitment', desc: 'Screening & Profiling', badgeColor: 'bg-sky-50 text-sky-700 border-sky-200', activeColor: 'border-sky-400 bg-sky-50 text-sky-900' },
  { id: 'Admin', label: 'Admin', desc: 'Agency Setup & Visas', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200', activeColor: 'border-purple-400 bg-purple-50 text-purple-900' },
  { id: 'Accounting', label: 'Accounting', desc: 'Ledger & Expenses', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200', activeColor: 'border-emerald-400 bg-emerald-50 text-emerald-900' },
  { id: 'Management', label: 'Management', desc: 'Analytics & Hub', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200', activeColor: 'border-amber-400 bg-amber-50 text-amber-900' },
];

export default function UserManagement({ currentUserName, addActivityLog }: UserManagementProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffAccount | null>(null);
  const [editRoles, setEditRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [staff, setStaff] = useState<StaffAccount[]>([]);

  // ── Fetch Live Staff from Supabase on Mount ──────────────────────────────
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        setLoading(true);
        const res = await api.get('/users');
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const liveStaff: StaffAccount[] = res.data.map((u: any) => {
            const rawRoles: UserRole[] = (u.role_names && Array.isArray(u.role_names) && u.role_names.length > 0)
              ? u.role_names
              : (u.role_name ? u.role_name.split(',').map((r: string) => r.trim() as UserRole) : ['Recruitment']);
            const primaryRole = rawRoles[0] || 'Recruitment';
            const mapped = DEPT_ROLE_MAP[primaryRole] || { role: 'Recruitment' as UserRole, dept: 'Recruitment', deptId: 2 };
            return {
              id: String(u.user_id),
              name: u.full_name || 'Staff Member',
              email: u.email,
              department: u.department_name || u.department || (u.department_id === 1 ? 'Management' : u.department_id === 2 ? 'Recruitment' : u.department_id === 3 ? 'Admin' : u.department_id === 4 ? 'Accounting' : mapped.dept),
              role: primaryRole,
              roles: rawRoles,
              status: u.status === 'Inactive' ? 'Inactive' : 'Active',
              createdDate: u.created_at ? u.created_at.split('T')[0] : '2026-01-15',
            };
          });
          setStaff(liveStaff);
        }
      } catch (err) {
        console.warn('Could not fetch live users from Supabase, falling back to local state:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStaff();
  }, []);

  const generateTempPassword = () => {
    const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowers = 'abcdefghjkmnpqrstuvwxyz';
    const numbers = '23456789';
    const specials = '!@#$%&*';
    const all = uppers + lowers + numbers + specials;
    const pick = (s: string) => s.charAt(Math.floor(Math.random() * s.length));
    const chars = [pick(uppers), pick(lowers), pick(numbers), pick(specials)];
    for (let i = 0; i < 8; i++) {
      chars.push(pick(all));
    }
    return chars.sort(() => Math.random() - 0.5).join('');
  };

  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    department: '',
    role: 'Recruitment' as UserRole,
    roles: ['Recruitment'] as UserRole[],
    password: generateTempPassword(),
    requirePasswordChange: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    email: string;
    role: string;
    department: string;
    tempPass: string;
    emailDispatched?: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleAddStaff = async () => {
    if (!newStaff.name || !newStaff.email || isSubmitting) return;
    setIsSubmitting(true);

    const chosenRoles = newStaff.roles && newStaff.roles.length > 0 ? newStaff.roles : [newStaff.role];
    const primaryRole = chosenRoles[0] || 'Recruitment';
    const deptInfo = DEPT_ROLE_MAP[primaryRole] || { deptId: 2 };
    const finalPassword = newStaff.password.trim() || generateTempPassword();
    const customDept = newStaff.department.trim() || deptInfo.dept;
    let emailDispatched = false;

    try {
      const res = await api.post('/users', {
        fullName: newStaff.name,
        email: newStaff.email,
        roleNames: chosenRoles,
        roleName: chosenRoles.join(', '),
        department: customDept,
        departmentId: deptInfo.deptId,
        password: finalPassword,
        requirePasswordChange: newStaff.requirePasswordChange,
      });

      if (res.data) {
        emailDispatched = Boolean(res.data.emailDispatched ?? res.data.email_dispatched);
      }

      const createdStaff: StaffAccount = {
        id: String(res.data?.userId || res.data?.user_id || Date.now()),
        name: newStaff.name,
        email: newStaff.email,
        department: res.data?.department || res.data?.department_name || customDept,
        role: primaryRole,
        roles: chosenRoles,
        status: 'Active',
        createdDate: new Date().toISOString().split('T')[0],
      };
      setStaff([createdStaff, ...staff]);

      addActivityLog({
        applicantId: '',
        action: 'New Staff Provisioned',
        performedBy: currentUserName,
        department: primaryRole,
        details: `Staff account provisioned for ${newStaff.name} (${newStaff.email}) with roles: ${chosenRoles.join(', ')}`,
      });

      setCreatedCredentials({
        name: newStaff.name,
        email: newStaff.email,
        role: chosenRoles.join(' & '),
        department: newStaff.department || deptInfo.dept,
        tempPass: finalPassword,
        emailDispatched: emailDispatched,
      });
      setShowCredentialsModal(true);
      setShowAddModal(false);
      setNewStaff({
        name: '',
        email: '',
        department: '',
        role: 'Recruitment',
        roles: ['Recruitment'],
        password: generateTempPassword(),
        requirePasswordChange: true,
      });
    } catch (err: any) {
      console.error('Failed to add staff:', err);
      const errMsg = err?.response?.data?.detail || err.message || 'Failed to create staff account. Please check backend connectivity.';
      alert(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleEditStaff = async () => {
    if (!selectedStaff || isEditing) return;
    setIsEditing(true);

    const numId = parseInt(selectedStaff.id, 10);
    const chosenRoles = editRoles && editRoles.length > 0 ? editRoles : [selectedStaff.role];
    const primaryRole = chosenRoles[0] || 'Recruitment';
    const deptInfo = DEPT_ROLE_MAP[primaryRole] || { deptId: 2 };

    try {
      let savedDept = (selectedStaff.department || '').trim() || deptInfo.dept;
      if (!isNaN(numId)) {
        const res = await api.put(`/users/${numId}`, {
          roleNames: chosenRoles,
          roleName: chosenRoles.join(', '),
          departmentId: deptInfo.deptId,
          department: savedDept,
        });
        if (res.data?.department || res.data?.department_name) {
          savedDept = res.data.department || res.data.department_name;
        }
      }

      setStaff(
        staff.map((s) =>
          s.id === selectedStaff.id
            ? { ...s, role: primaryRole, roles: chosenRoles, department: savedDept }
            : s
        )
      );

      addActivityLog({
        applicantId: '',
        action: 'Staff Roles Updated',
        performedBy: currentUserName,
        department: 'Management',
        details: `Staff roles updated: ${selectedStaff.name} - Roles: ${chosenRoles.join(', ')}`,
      });

      setShowEditModal(false);
      setSelectedStaff(null);
    } catch (err) {
      console.warn('Backend update user failed:', err);
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteStaff = async () => {
    if (!selectedStaff || isDeleting) return;
    setIsDeleting(true);

    const numId = parseInt(selectedStaff.id, 10);
    try {
      if (!isNaN(numId)) {
        await api.delete(`/users/${numId}`);
      }

      setStaff(staff.filter((s) => s.id !== selectedStaff.id));

      addActivityLog({
        applicantId: '',
        action: 'Staff Account Deleted',
        performedBy: currentUserName,
        department: 'Management',
        details: `Staff account deleted: ${selectedStaff.name} (${selectedStaff.id})`,
      });

      setShowDeleteModal(false);
      setSelectedStaff(null);
    } catch (err) {
      console.warn('Backend delete user failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleAccess = async (staffMember: StaffAccount) => {
    const newStatus = staffMember.status === 'Active' ? 'Inactive' : 'Active';

    const numId = parseInt(staffMember.id, 10);
    if (!isNaN(numId)) {
      try {
        await api.put(`/users/${numId}`, { status: newStatus });
      } catch (err) {
        console.warn('Backend status toggle failed, toggling locally:', err);
      }
    }

    setStaff(staff.map((s) => (s.id === staffMember.id ? { ...s, status: newStatus } : s)));

    addActivityLog({
      applicantId: '',
      action: newStatus === 'Active' ? 'Access Restored' : 'Access Revoked',
      performedBy: currentUserName,
      department: 'Management',
      details: `Access ${newStatus === 'Active' ? 'restored for' : 'revoked from'} ${staffMember.name}`,
    });
  };


  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">User Management & Access Control</h2>
          <p className="text-sm text-[#64748B] mt-1 font-medium">
            Manage staff accounts, roles, and system permissions (RBAC)
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-5 py-2.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-sm font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-[#0EA5E9]/20"
        >
          <UserPlus className="w-4 h-4" /> Add New Staff
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b-2 border-slate-200">
            <tr>
              <th className="px-6 py-4 font-black text-[#0F172A] text-xs uppercase tracking-wider">Employee</th>
              <th className="px-6 py-4 font-black text-[#0F172A] text-xs uppercase tracking-wider">Email</th>
              <th className="px-6 py-4 font-black text-[#0F172A] text-xs uppercase tracking-wider">Department</th>
              <th className="px-6 py-4 font-black text-[#0F172A] text-xs uppercase tracking-wider">System Role</th>
              <th className="px-6 py-4 font-black text-[#0F172A] text-xs uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 font-black text-[#0F172A] text-xs uppercase tracking-wider text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {staff.map((staffMember) => (
              <tr
                key={staffMember.id}
                className={`hover:bg-slate-50 transition-colors ${
                  staffMember.status === 'Inactive' ? 'bg-slate-50/50 opacity-60' : ''
                }`}
              >
                <td className="px-6 py-4 flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full ${
                      staffMember.status === 'Active'
                        ? 'bg-[#0EA5E9] text-white'
                        : 'bg-slate-200 text-slate-400'
                    } flex items-center justify-center font-bold text-xs`}
                  >
                    {getInitials(staffMember.name)}
                  </div>
                  <span className={staffMember.status === 'Inactive' ? 'text-slate-400' : ''}>
                    {staffMember.name}
                  </span>
                </td>
                <td className={`px-6 py-4 ${staffMember.status === 'Inactive' ? 'text-slate-400' : 'text-[#64748B]'}`}>
                  {staffMember.email}
                </td>
                <td className={`px-6 py-4 ${staffMember.status === 'Inactive' ? 'text-slate-400' : 'text-[#64748B]'}`}>
                  {staffMember.department}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {(staffMember.roles && staffMember.roles.length > 0 ? staffMember.roles : [staffMember.role]).map((r, idx) => {
                      const colors: Record<string, string> = {
                        Admin: 'bg-purple-50 text-purple-700 border-purple-200',
                        Recruitment: 'bg-sky-50 text-sky-700 border-sky-200',
                        Accounting: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                        Management: 'bg-amber-50 text-amber-700 border-amber-200',
                      };
                      return (
                        <span
                          key={idx}
                          className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                            staffMember.status === 'Inactive'
                              ? 'bg-slate-100 text-slate-400 border-slate-200'
                              : colors[r] || 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {r}
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-3 py-1 text-[10px] font-black uppercase rounded-full border ${
                      staffMember.status === 'Active'
                        ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20'
                        : 'bg-slate-200 text-slate-500 border-slate-300'
                    }`}
                  >
                    {staffMember.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setSelectedStaff(staffMember);
                        setEditRoles(staffMember.roles && staffMember.roles.length > 0 ? staffMember.roles : [staffMember.role]);
                        setShowEditModal(true);
                      }}
                      className="p-2 hover:bg-blue-50 rounded-lg transition-colors group cursor-pointer"
                      title="Edit Roles"
                    >
                      <Edit2 className="w-4 h-4 text-[#64748B] group-hover:text-[#0EA5E9]" />
                    </button>
                    <button
                      onClick={() => handleToggleAccess(staffMember)}
                      className="p-2 hover:bg-amber-50 rounded-lg transition-colors group"
                      title={staffMember.status === 'Active' ? 'Revoke Access' : 'Restore Access'}
                    >
                      {staffMember.status === 'Active' ? (
                        <ShieldOff className="w-4 h-4 text-[#64748B] group-hover:text-[#F59E0B]" />
                      ) : (
                        <ShieldCheck className="w-4 h-4 text-[#64748B] group-hover:text-[#10B981]" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedStaff(staffMember);
                        setShowDeleteModal(true);
                      }}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
                      title="Delete Account"
                    >
                      <Trash2 className="w-4 h-4 text-[#64748B] group-hover:text-[#EF4444]" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#0F172A]/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6 border-b-2 border-slate-100 pb-4">
              <h3 className="font-extrabold text-[#0F172A] text-lg">Add New Staff Member</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-[#0F172A]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#475569] block mb-1.5 uppercase tracking-wide">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  className="w-full border-2 border-slate-200 px-3 py-2.5 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
                  placeholder="e.g., John Doe"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#475569] block mb-1.5 uppercase tracking-wide">
                  Email Address
                </label>
                <input
                  type="email"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  className="w-full border-2 border-slate-200 px-3 py-2.5 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
                  placeholder="john.doe@flowsensus.com"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#475569] block mb-1.5 uppercase tracking-wide">
                  Department
                </label>
                <input
                  type="text"
                  list="dept-options"
                  value={newStaff.department}
                  onChange={(e) => setNewStaff({ ...newStaff, department: e.target.value })}
                  className="w-full border-2 border-slate-200 px-3 py-2.5 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
                  placeholder="e.g., Documentation Department, Recruitment..."
                />
                <datalist id="dept-options">
                  <option value="Recruitment" />
                  <option value="Admin & Processing" />
                  <option value="Documentation Department" />
                  <option value="Finance & Accounting" />
                  <option value="Executive Management" />
                </datalist>
              </div>
              <div>
                <label className="text-xs font-bold text-[#475569] block mb-1.5 uppercase tracking-wide">
                  System Roles <span className="text-slate-400 font-normal lowercase">(select one or more)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SYSTEM_ROLES_CATALOG.map((r) => {
                    const isChecked = (newStaff.roles || []).includes(r.id);
                    return (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => {
                          const current = newStaff.roles || [newStaff.role];
                          let next: UserRole[];
                          if (current.includes(r.id)) {
                            next = current.filter((x) => x !== r.id);
                            if (next.length === 0) next = [r.id]; // keep at least 1
                          } else {
                            next = [...current, r.id];
                          }
                          setNewStaff({ ...newStaff, roles: next, role: next[0] });
                        }}
                        className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col ${
                          isChecked
                            ? r.activeColor + ' shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs">{r.label}</span>
                          <span
                            className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${
                              isChecked ? 'bg-[#0EA5E9] text-white' : 'border border-slate-300 bg-slate-50 text-transparent'
                            }`}
                          >
                            ✓
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-0.5">{r.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#475569] uppercase tracking-wide flex items-center gap-1.5">
                    <Key size={13} className="text-[#0EA5E9]" /> Temporary Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewStaff(s => ({ ...s, password: generateTempPassword() }))}
                    className="text-[11px] font-bold text-[#0EA5E9] hover:text-[#0284C7] flex items-center gap-1"
                  >
                    <Sparkles size={11} /> Auto-Generate
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newStaff.password}
                    onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                    className="w-full border-2 border-slate-200 pl-3 pr-10 py-2.5 rounded-lg text-sm font-mono focus:border-[#0EA5E9] outline-none"
                    placeholder="Enter or generate temporary password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  The employee will use this temporary password to log in and will be prompted to change it.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newStaff.requirePasswordChange}
                    onChange={(e) => setNewStaff({ ...newStaff, requirePasswordChange: e.target.checked })}
                    className="mt-0.5 rounded text-[#0EA5E9] focus:ring-[#0EA5E9]"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-800">Require Password Change on First Login</p>
                    <p className="text-[11px] text-slate-500">Employee must set a new private password before accessing recruitment records.</p>
                  </div>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-3 bg-white border-2 border-slate-200 rounded-lg text-sm font-bold text-[#475569] hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddStaff}
                  disabled={!newStaff.name || !newStaff.email || isSubmitting}
                  className="flex-1 px-4 py-3 bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded-lg text-sm font-bold shadow-lg shadow-[#0EA5E9]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Creating Staff...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      <span>Add Staff</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Credentials Confirmation & Email Dispatch Modal */}
      {showCredentialsModal && createdCredentials && (
        <div className="fixed inset-0 bg-[#0F172A]/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-lg mx-4">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Key size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#0F172A] text-base">Account Provisioned Successfully</h3>
                  <p className="text-xs text-slate-500">Credentials are ready to send to the employee</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowCredentialsModal(false);
                  setCreatedCredentials(null);
                }}
                className="text-slate-400 hover:text-[#0F172A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Employee Name:</span>
                  <span className="font-bold text-slate-900">{createdCredentials.name}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Work Email:</span>
                  <span className="font-bold text-slate-900">{createdCredentials.email}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Assigned Role:</span>
                  <span className="font-bold text-[#0EA5E9] bg-sky-50 px-2 py-0.5 rounded border border-sky-200">{createdCredentials.role}</span>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Temporary Password</p>
                      <p className="text-base font-mono font-black text-slate-900 tracking-wider mt-0.5">{createdCredentials.tempPass}</p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(createdCredentials.tempPass);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 shadow-sm"
                    >
                      {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              {createdCredentials.emailDispatched ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-900">
                    <p className="font-bold">Automated Agency Invitation Dispatched</p>
                    <p className="text-emerald-700 mt-0.5 leading-relaxed">
                      An official onboarding email was dispatched automatically from the agency workspace to <strong className="text-emerald-950">{createdCredentials.email}</strong>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-3.5 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-sky-900">
                    <p className="font-bold">Staff Account Active & Ready</p>
                    <p className="text-sky-700 mt-0.5 leading-relaxed">
                      Credentials are securely provisioned. You can copy the login details or full onboarding invitation below to forward to the employee.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(createdCredentials.tempPass);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copied ? 'Password Copied!' : 'Copy Password'}</span>
                </button>

                <button
                  onClick={() => {
                    const onboardingMsg = `Hello ${createdCredentials.name},\n\nYour FlowSensus staff account has been created on behalf of ${createdCredentials.department} Department.\n\nLogin Portal: ${window.location.origin}\nWork Email: ${createdCredentials.email}\nTemporary Password: ${createdCredentials.tempPass}\nRole: ${createdCredentials.role}\n\nPlease sign in and set your new private password upon your first session.\n\nBest regards,\nAgency Management`;
                    navigator.clipboard.writeText(onboardingMsg);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2500);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded-lg text-xs font-bold shadow-md shadow-sky-500/20 transition-colors"
                >
                  <Mail size={14} />
                  <span>Copy Full Invite</span>
                </button>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium pt-1">
                <ShieldCheck size={13} className="text-slate-400 flex-shrink-0" />
                <span>Multi-tenant data boundary enforced. Personal email accounts are never accessed.</span>
              </div>

              <button
                onClick={() => {
                  setShowCredentialsModal(false);
                  setCreatedCredentials(null);
                }}
                className="w-full py-2 text-center text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
              >
                Close & Return to Staff List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {showEditModal && selectedStaff && (
        <div className="fixed inset-0 bg-[#0F172A]/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6 border-b-2 border-slate-100 pb-4">
              <h3 className="font-extrabold text-[#0F172A] text-lg">Edit Staff Role</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedStaff(null);
                }}
                className="text-slate-400 hover:text-[#0F172A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#475569] block mb-1.5 uppercase tracking-wide">
                  Staff Member
                </label>
                <input
                  type="text"
                  value={selectedStaff.name}
                  readOnly
                  className="w-full border-2 border-slate-200 px-3 py-2.5 rounded-lg text-sm bg-slate-50 font-bold text-[#0F172A]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#475569] block mb-1.5 uppercase tracking-wide">
                  Department
                </label>
                <input
                  type="text"
                  list="dept-options"
                  value={selectedStaff.department}
                  onChange={(e) => setSelectedStaff({ ...selectedStaff, department: e.target.value })}
                  className="w-full border-2 border-slate-200 px-3 py-2.5 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
                  placeholder="e.g., Documentation Department"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#475569] block mb-1.5 uppercase tracking-wide">
                  System Roles <span className="text-slate-400 font-normal lowercase">(select one or more)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SYSTEM_ROLES_CATALOG.map((r) => {
                    const isChecked = (editRoles || []).includes(r.id);
                    return (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => {
                          const current = editRoles || [selectedStaff.role];
                          let next: UserRole[];
                          if (current.includes(r.id)) {
                            next = current.filter((x) => x !== r.id);
                            if (next.length === 0) next = [r.id]; // keep at least 1
                          } else {
                            next = [...current, r.id];
                          }
                          setEditRoles(next);
                          setSelectedStaff({ ...selectedStaff, roles: next, role: next[0] });
                        }}
                        className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col ${
                          isChecked
                            ? r.activeColor + ' shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs">{r.label}</span>
                          <span
                            className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${
                              isChecked ? 'bg-[#0EA5E9] text-white' : 'border border-slate-300 bg-slate-50 text-transparent'
                            }`}
                          >
                            ✓
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-0.5">{r.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedStaff(null);
                  }}
                  className="flex-1 px-4 py-3 bg-white border-2 border-slate-200 rounded-lg text-sm font-bold text-[#475569] hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditStaff}
                  disabled={isEditing}
                  className="flex-1 px-4 py-3 bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded-lg text-sm font-bold shadow-lg shadow-[#0EA5E9]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isEditing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedStaff && (
        <div className="fixed inset-0 bg-[#0F172A]/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6 border-b-2 border-slate-100 pb-4">
              <h3 className="font-extrabold text-[#0F172A] text-lg">Delete Staff Account</h3>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedStaff(null);
                }}
                className="text-slate-400 hover:text-[#0F172A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
                <p className="text-sm font-bold">⚠️ Warning: This action cannot be undone!</p>
                <p className="text-sm mt-2">
                  You are about to permanently delete the account for <strong>{selectedStaff.name}</strong>. All
                  associated permissions and access will be revoked immediately.
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedStaff(null);
                  }}
                  className="flex-1 px-4 py-3 bg-white border-2 border-slate-200 rounded-lg text-sm font-bold text-[#475569] hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteStaff}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-lg text-sm font-bold shadow-lg shadow-[#EF4444]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Deleting Account...</span>
                    </>
                  ) : (
                    <span>Delete Account</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
