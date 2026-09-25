import {
  Waves,
  ShieldCheck,
  LayoutDashboard,
  FolderSearch,
  Users as UsersIcon,
  UserPlus,
  Microscope,
  Sparkles,
  FileText,
  KanbanSquare,
  HeartPulse,
  ScanText,
  BellRing,
  Receipt,
  CheckSquare,
  Building2,
  TrendingUp,
  Users,
  History,
  FileBarChart,
  ClipboardList,
  SlidersHorizontal,
  Briefcase,
  Factory,
  Crown,
  ArrowRight,
} from 'lucide-react';
import { UserRole } from '../types';
import { ViewType } from './AppShell';
import Logo from './Logo';

interface SidebarProps {
  currentUserRole: UserRole;
  currentUserRoles?: UserRole[];
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  isSuperAdmin?: boolean;
  onSuperAdminDashboard?: () => void;
}

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[] | 'All';
}

interface NavGroup {
  title: string;
  roles: UserRole[] | 'All';
  items: NavItem[];
}

export default function Sidebar({
  currentUserRole,
  currentUserRoles,
  currentView,
  onViewChange,
  isSuperAdmin,
  onSuperAdminDashboard,
}: SidebarProps) {
  const mainItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: 'All' },
    { id: 'applicants', label: 'Applicant List', icon: UsersIcon, roles: 'All' },
  ];

  const navGroups: NavGroup[] = [
    {
      title: 'Intake & Matching',
      roles: ['Recruitment'],
      items: [
        { id: 'registration', label: 'Registration', icon: UserPlus, roles: ['Recruitment'] },
        { id: 'screening', label: 'Screening Panel', icon: Microscope, roles: ['Recruitment'] },
        { id: 'profiling', label: 'Applicant Profiling', icon: Sparkles, roles: ['Recruitment'] },
      ],
    },
    {
      title: 'CV Review & Endorsement',
      roles: ['Management'],
      items: [
        { id: 'cv', label: 'CV Encoding', icon: FileText, roles: ['Management'] },
        { id: 'endorsement', label: 'Endorsement Tracker', icon: KanbanSquare, roles: ['Management'] },
      ],
    },
    {
      title: 'Agency Configuration',
      roles: ['Admin'],
      items: [
        { id: 'requirements', label: 'Document Requirements', icon: ClipboardList, roles: ['Admin'] },
        { id: 'evaluation', label: 'Evaluation & Workflow', icon: SlidersHorizontal, roles: ['Admin'] },
        { id: 'joborders', label: 'Job Orders', icon: Briefcase, roles: ['Admin'] },
        { id: 'employers', label: 'Employer Profiles', icon: Factory, roles: ['Admin'] },
      ],
    },
    {
      title: 'Compliance & Visa',
      roles: ['Admin'],
      items: [
        { id: 'fittowork', label: 'Fit-to-Work', icon: HeartPulse, roles: ['Admin'] },
      ],
    },
    {
      title: 'Document Processing',
      roles: ['Admin', 'Management'],
      items: [
        { id: 'ocr', label: 'Document OCR', icon: ScanText, roles: ['Admin', 'Management'] },
        { id: 'alerts', label: '3-2-1 Alerts', icon: BellRing, roles: ['Admin', 'Management'] },
      ],
    },
    {
      title: 'Financials',
      roles: ['Accounting'],
      items: [{ id: 'expense', label: 'Expense Ledger', icon: Receipt, roles: ['Accounting'] }],
    },
    {
      title: 'Oversight Controls',
      roles: ['Management'],
      items: [
        { id: 'manager', label: 'CV & Employer Hub', icon: CheckSquare, roles: ['Management'] },
        { id: 'forecast', label: 'Predictive Timeline', icon: TrendingUp, roles: ['Management'] },
        { id: 'history', label: 'Deployment History', icon: History, roles: ['Management'] },
        { id: 'reports', label: 'Operational Reports', icon: FileBarChart, roles: ['Management'] },
        { id: 'users', label: 'User Management', icon: Users, roles: ['Management'] },
      ],
    },
  ];

  const userRolesList: UserRole[] = (currentUserRoles && currentUserRoles.length > 0)
    ? currentUserRoles
    : [currentUserRole];

  const hasAccess = (roles: UserRole[] | 'All'): boolean => {
    if (isSuperAdmin) return true; // Super Admin has universal access to all agency modules
    if (roles === 'All') return true;
    return roles.some((r) => userRolesList.includes(r));
  };

  const rolesDisplayText = isSuperAdmin
    ? 'Super Admin Universal'
    : (userRolesList.filter((r) => r && r !== 'Applicant' && r !== 'Employer').join(' & ') || currentUserRole || 'Staff');

  return (
    <aside className="w-[260px] h-full flex-shrink-0 flex flex-col bg-gradient-to-b from-[#0F172A] to-[#1E293B] overflow-y-auto shadow-2xl z-20 border-r border-slate-800">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3 border-b border-white/10">
        <Logo size="small" />
        <span className="font-extrabold text-white text-lg tracking-wider leading-none">FLOWSENSUS</span>
      </div>

      {/* Active Session */}
      <div className="px-6 py-4 border-b border-white/5 bg-black/10">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">Active Session</p>
          {isSuperAdmin && (
            <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
              <Crown size={10} className="text-amber-400" /> SUPERADMIN
            </span>
          )}
        </div>
        <div className="text-sm font-bold text-[#0EA5E9] mt-1 flex items-center gap-2 flex-wrap">
          <ShieldCheck className="w-4 h-4 flex-shrink-0" />
          <span>{rolesDisplayText} Ops</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 text-sm font-medium">
        {/* Superadmin Dedicated Hub Module Access */}
        {isSuperAdmin && onSuperAdminDashboard && (
          <div className="mb-4 pb-3 border-b border-white/10">
            <p className="text-[10px] uppercase tracking-widest text-amber-400 font-extrabold px-3 pb-2 flex items-center gap-1.5">
              <Crown size={12} className="text-amber-400" /> Platform Superadmin
            </p>
            <button
              onClick={onSuperAdminDashboard}
              className="w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all bg-gradient-to-r from-amber-500/20 via-sky-500/10 to-transparent text-amber-300 border border-amber-500/40 hover:border-amber-400 hover:bg-amber-500/30 hover:text-white shadow-sm group cursor-pointer"
              title="Return to Superadmin Multi-Tenant Dashboard"
            >
              <Building2 className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-bold text-xs block text-white truncate">Super Admin Console</span>
                <span className="text-[10px] text-amber-300/90 block truncate">Tenants & Overview</span>
              </div>
              <ArrowRight size={14} className="text-amber-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
            </button>
          </div>
        )}
        {/* Main Items */}
        {mainItems.map((item) => {
          const Icon = item.icon;
          if (!hasAccess(item.roles)) return null;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-all ${
                currentView === item.id
                  ? 'bg-gradient-to-r from-[#0EA5E9]/15 to-transparent text-[#0EA5E9] border-l-4 border-[#0EA5E9] pl-[8px] font-semibold'
                  : 'text-[#94A3B8] border-l-4 border-transparent hover:text-white hover:bg-white/5 hover:border-[#334155] hover:pl-[8px]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}

        {/* Nav Groups */}
        {navGroups.map((group) => {
          if (!hasAccess(group.roles)) return null;
          return (
            <div key={group.title} className="mt-2">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-extrabold pt-4 pb-2 px-3">
                {group.title}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon;
                if (!hasAccess(item.roles)) return null;
                return (
                  <button
                    key={item.id}
                    onClick={() => onViewChange(item.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-all ${
                      currentView === item.id
                        ? 'bg-gradient-to-r from-[#0EA5E9]/15 to-transparent text-[#0EA5E9] border-l-4 border-[#0EA5E9] pl-[8px] font-semibold'
                        : 'text-[#94A3B8] border-l-4 border-transparent hover:text-white hover:bg-white/5 hover:border-[#334155] hover:pl-[8px]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
