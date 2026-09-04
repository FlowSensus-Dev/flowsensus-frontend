import { useState } from 'react';
import { UserPlus, Edit2, Trash2, ShieldOff, ShieldCheck, X } from 'lucide-react';
import { ActivityLog, UserRole } from '../../types';

interface StaffAccount {
  id: string;
  name: string;
  email: string;
  department: string;
  role: UserRole;
  status: 'Active' | 'Inactive';
  createdDate: string;
}

interface UserManagementProps {
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
}

export default function UserManagement({ currentUserName, addActivityLog }: UserManagementProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffAccount | null>(null);

  const [staff, setStaff] = useState<StaffAccount[]>([
    {
      id: 'STAFF-001',
      name: 'Admin User',
      email: 'admin@flowsensus.com',
      department: 'Management',
      role: 'Management',
      status: 'Active',
      createdDate: '2026-01-15',
    },
    {
      id: 'STAFF-002',
      name: 'Sarah Cruz',
      email: 'recruit@flowsensus.com',
      department: 'Recruitment',
      role: 'Recruitment',
      status: 'Active',
      createdDate: '2026-02-10',
    },
    {
      id: 'STAFF-003',
      name: 'Maria Santos',
      email: 'admin@flowsensus.com',
      department: 'Admin',
      role: 'Admin',
      status: 'Active',
      createdDate: '2026-02-12',
    },
    {
      id: 'STAFF-004',
      name: 'Mark Tan',
      email: 'accounting@flowsensus.com',
      department: 'Accounting',
      role: 'Accounting',
      status: 'Inactive',
      createdDate: '2026-01-20',
    },
  ]);

  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    department: '',
    role: 'Recruitment' as UserRole,
  });

  const handleAddStaff = () => {
    const staffAccount: StaffAccount = {
      id: `STAFF-${String(staff.length + 1).padStart(3, '0')}`,
      name: newStaff.name,
      email: newStaff.email,
      department: newStaff.department,
      role: newStaff.role,
      status: 'Active',
      createdDate: new Date().toISOString().split('T')[0],
    };

    setStaff([...staff, staffAccount]);

    addActivityLog({
      applicantId: '',
      action: 'Staff Account Created',
      performedBy: currentUserName,
      department: 'Management',
      details: `New staff account created: ${staffAccount.name} (${staffAccount.role}) - ${staffAccount.email}`,
    });

    setNewStaff({ name: '', email: '', department: '', role: 'Recruitment' });
    setShowAddModal(false);
  };

  const handleEditStaff = () => {
    if (!selectedStaff) return;

    setStaff(
      staff.map((s) =>
        s.id === selectedStaff.id
          ? { ...s, role: selectedStaff.role, department: selectedStaff.department }
          : s
      )
    );

    addActivityLog({
      applicantId: '',
      action: 'Staff Role Updated',
      performedBy: currentUserName,
      department: 'Management',
      details: `Staff role updated: ${selectedStaff.name} - New Role: ${selectedStaff.role}`,
    });

    setShowEditModal(false);
    setSelectedStaff(null);
  };

  const handleDeleteStaff = () => {
    if (!selectedStaff) return;

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
  };

  const handleToggleAccess = (staffMember: StaffAccount) => {
    const newStatus = staffMember.status === 'Active' ? 'Inactive' : 'Active';

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
                <td className={`px-6 py-4 font-bold ${staffMember.status === 'Inactive' ? 'text-slate-400' : ''}`}>
                  {staffMember.role}
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
                        setShowEditModal(true);
                      }}
                      className="p-2 hover:bg-blue-50 rounded-lg transition-colors group"
                      title="Edit Role"
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
                  value={newStaff.department}
                  onChange={(e) => setNewStaff({ ...newStaff, department: e.target.value })}
                  className="w-full border-2 border-slate-200 px-3 py-2.5 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
                  placeholder="e.g., Recruitment"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#475569] block mb-1.5 uppercase tracking-wide">
                  System Role
                </label>
                <select
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as UserRole })}
                  className="w-full border-2 border-slate-200 px-3 py-2.5 rounded-lg text-sm font-bold focus:border-[#0EA5E9] outline-none"
                >
                  <option value="Recruitment">Recruitment</option>
                  <option value="Admin">Admin</option>
                  <option value="Accounting">Accounting</option>
                  <option value="Management">Management</option>
                </select>
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
                  disabled={!newStaff.name || !newStaff.email}
                  className="flex-1 px-4 py-3 bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded-lg text-sm font-bold shadow-lg shadow-[#0EA5E9]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Staff
                </button>
              </div>
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
                  value={selectedStaff.department}
                  onChange={(e) => setSelectedStaff({ ...selectedStaff, department: e.target.value })}
                  className="w-full border-2 border-slate-200 px-3 py-2.5 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#475569] block mb-1.5 uppercase tracking-wide">
                  System Role
                </label>
                <select
                  value={selectedStaff.role}
                  onChange={(e) => setSelectedStaff({ ...selectedStaff, role: e.target.value as UserRole })}
                  className="w-full border-2 border-slate-200 px-3 py-2.5 rounded-lg text-sm font-bold focus:border-[#0EA5E9] outline-none"
                >
                  <option value="Recruitment">Recruitment</option>
                  <option value="Admin">Admin</option>
                  <option value="Accounting">Accounting</option>
                  <option value="Management">Management</option>
                </select>
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
                  className="flex-1 px-4 py-3 bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded-lg text-sm font-bold shadow-lg shadow-[#0EA5E9]/20"
                >
                  Save Changes
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
                  className="flex-1 px-4 py-3 bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-lg text-sm font-bold shadow-lg shadow-[#EF4444]/20"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
