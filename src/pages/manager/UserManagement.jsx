import { UserPlus } from 'lucide-react';

export default function UserManagement() {
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
          disabled
          title="Staff account creation is not available yet"
          className="px-5 py-2.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-sm font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-[#0EA5E9]/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400">
                No staff accounts found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
