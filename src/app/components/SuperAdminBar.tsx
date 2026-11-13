import React from 'react';
import { Crown, LogOut } from 'lucide-react';

interface SuperAdminBarProps {
  currentUserName: string;
  onLogout: () => void;
  onSuperAdminDashboard?: () => void;
}

/** Platform navigation only. This bar never changes the signed-in user's tenant role. */
export default function SuperAdminBar({ currentUserName, onLogout, onSuperAdminDashboard }: SuperAdminBarProps) {
  return <header className="sticky top-0 z-50 bg-[#0B1120] border-b border-amber-500/30 text-white shadow-xl">
    <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black px-2.5 py-1 rounded-md text-xs uppercase tracking-wide">
          <Crown size={14} /><span>Superadmin</span>
        </div>
        <span className="text-xs font-semibold text-slate-200">{currentUserName || 'Platform administrator'}</span>
        <span className="text-xs text-slate-400">Platform administration</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onSuperAdminDashboard && <button type="button" onClick={onSuperAdminDashboard}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold text-amber-300 hover:bg-amber-500/20 border border-amber-500/30">
          <Crown size={13} /><span>Super Admin Console</span>
        </button>}
        <button type="button" onClick={onLogout}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-red-500/20">
          <LogOut size={13} className="text-red-400" /><span>Sign Out</span>
        </button>
      </div>
    </div>
  </header>;
}
