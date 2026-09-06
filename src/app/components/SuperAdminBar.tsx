import React from 'react';
import { UserRole } from '../types';
import {
  Crown,
  Briefcase,
  Users,
  Settings,
  Receipt,
  Building2,
  User,
  LogOut,
  Activity,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';

interface SuperAdminBarProps {
  currentUserRole: UserRole;
  currentUserName: string;
  onSwitchRole: (role: UserRole) => void;
  onLogout: () => void;
  backendOnline?: boolean;
}

interface RoleOption {
  role: UserRole;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description: string;
  badgeColor: string;
}

const ROLES: RoleOption[] = [
  {
    role: 'Management',
    label: 'Management',
    icon: Briefcase,
    description: 'Executive dashboard, timeline forecast, endorsements & audit controls',
    badgeColor: 'bg-amber-500 text-slate-900',
  },
  {
    role: 'Recruitment',
    label: 'Recruitment',
    icon: Users,
    description: 'Applicant registration, initial screening & smart profiling',
    badgeColor: 'bg-sky-500 text-white',
  },
  {
    role: 'Admin',
    label: 'Admin / Visa',
    icon: Settings,
    description: 'Fit-to-work, agency requirements, job orders & document OCR',
    badgeColor: 'bg-purple-500 text-white',
  },
  {
    role: 'Accounting',
    label: 'Accounting',
    icon: Receipt,
    description: 'Deployment expenses, fee ledgers & financial reports',
    badgeColor: 'bg-emerald-500 text-white',
  },
  {
    role: 'Employer',
    label: 'Employer Portal',
    icon: Building2,
    description: 'Foreign principal portal for worker evaluation & approvals',
    badgeColor: 'bg-blue-600 text-white',
  },
  {
    role: 'Applicant',
    label: 'Applicant Portal',
    icon: User,
    description: 'Overseas worker portal for deployment milestone tracking',
    badgeColor: 'bg-teal-500 text-white',
  },
];

export default function SuperAdminBar({
  currentUserRole,
  currentUserName,
  onSwitchRole,
  onLogout,
  backendOnline = true,
}: SuperAdminBarProps) {
  return (
    <header className="sticky top-0 z-50 bg-[#0B1120] border-b border-amber-500/30 text-white shadow-xl">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Superadmin Identity */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black px-2.5 py-1 rounded-md text-xs shadow-sm uppercase tracking-wide">
            <Crown size={14} className="text-slate-950" />
            <span>Superadmin</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs">
            <span className="font-semibold text-slate-200">
              admin@findstaff.ph
            </span>
            <span className="hidden sm:inline text-slate-600">•</span>
            <span className="text-slate-400">
              Agency #1 (Findstaff PH)
            </span>
          </div>

          {/* Backend Ping */}
          <div className="hidden md:flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-0.5 rounded-full text-[11px]">
            <span
              className={`w-2 h-2 rounded-full ${
                backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
            />
            <span className="text-slate-300 font-mono text-[10px]">
              API: localhost:8000
            </span>
          </div>
        </div>

        {/* Center: Role Switcher Buttons */}
        <div className="flex items-center flex-wrap gap-1.5 bg-slate-900/90 border border-slate-800/80 p-1 rounded-lg">
          <span className="text-[10px] uppercase font-bold text-slate-400 px-2 flex items-center gap-1">
            <Activity size={11} className="text-amber-400" />
            Switch Role:
          </span>

          {ROLES.map((r) => {
            const Icon = r.icon;
            const isActive = currentUserRole === r.role;

            return (
              <button
                key={r.role}
                onClick={() => onSwitchRole(r.role)}
                title={r.description}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-amber-400 text-slate-950 shadow-sm ring-1 ring-amber-300'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon size={13} />
                <span>{r.label}</span>
                {isActive && <CheckCircle2 size={12} className="ml-0.5" />}
              </button>
            );
          })}
        </div>

        {/* Right: Sign Out */}
        <div className="flex items-center gap-2">
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-red-500/20 hover:border-red-500/40 border border-transparent transition-all"
            title="Sign out of Superadmin session"
          >
            <LogOut size={13} className="text-red-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
