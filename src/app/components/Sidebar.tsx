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
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
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
  workflowPermissions?: Record<string, UserRole[]>;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
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
  workflowPermissions,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const mainItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: 'All' },
    { id: 'applicants', label: 'Applicant List', icon: UsersIcon, roles: 'All' },
  ];

  const navGroups: NavGroup[] = [
    {
      title: 'Intake & Matching',
      roles: ['Recruitment', 'Admin', 'Management'],
      items: [
        { id: 'registration', label: 'Registration', icon: UserPlus, roles: ['Recruitment', 'Management'] },
        { id: 'screening', label: 'Screening Panel', icon: Microscope, roles: ['Recruitment', 'Management'] },
        { id: 'profiling', label: 'Applicant Profiling', icon: Sparkles, roles: ['Recruitment', 'Admin', 'Management'] },
      ],
    },
    {
      title: 'CV Review & Endorsement',
      roles: ['Recruitment', 'Management'],
      items: [
        { id: 'cv', label: 'CV Encoding', icon: FileText, roles: ['Recruitment', 'Management'] },
        { id: 'endorsement', label: 'Endorsement Tracker', icon: KanbanSquare, roles: ['Management'] },
      ],
    },
    {
      title: 'Agency Configuration',
      roles: ['Admin', 'Management'],
      items: [
        { id: 'requirements', label: 'Document Requirements', icon: ClipboardList, roles: ['Admin', 'Management'] },
        { id: 'joborders', label: 'Job Orders', icon: Briefcase, roles: ['Admin', 'Management'] },
        { id: 'employers', label: 'Employer Profiles', icon: Factory, roles: ['Admin', 'Management'] },
      ],
    },
    {
      title: 'Compliance & Visa',
      roles: ['Admin', 'Management'],
      items: [
        { id: 'fittowork', label: 'Fit-to-Work', icon: HeartPulse, roles: ['Admin', 'Management'] },
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
      roles: ['Accounting', 'Management'],
      items: [{ id: 'expense', label: 'Expense Ledger', icon: Receipt, roles: ['Accounting', 'Management'] }],
    },
    {
      title: 'Oversight Controls',
      roles: ['Management'],
      items: [
        { id: 'evaluation', label: 'Evaluation & Workflow', icon: SlidersHorizontal, roles: ['Management'] },
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

  const hasItemAccess = (item: NavItem): boolean => {
    if (isSuperAdmin) return true; // Super Admin has universal access
    if (userRolesList.includes('Management')) return true; // Management has universal access

    // Universal modules
    if (item.id === 'dashboard' || item.id === 'applicants') return true;

    // Excluded Management-only modules
    if (['evaluation', 'forecast', 'history', 'reports', 'users'].includes(item.id)) {
      return false; // Checked Management above
    }

    // Dynamic database workflow module permissions
    if (workflowPermissions && workflowPermissions[item.id]) {
      const allowedRoles = workflowPermissions[item.id];
      return allowedRoles.some((r) => userRolesList.includes(r));
    }

    // Default static role fallback
    if (item.roles === 'All') return true;
    return item.roles.some((r) => userRolesList.includes(r));
  };

  const rolesDisplayText = isSuperAdmin
    ? 'Super Admin Universal'
    : (userRolesList.filter((r) => r && r !== 'Applicant' && r !== 'Employer').join(' & ') || currentUserRole || 'Staff');

  return (
    <aside
      className={`${collapsed ? 'w-[72px]' : 'w-[260px]'
        } h-full flex-shrink-0 flex flex-col bg-gradient-to-b from-[#0F172A] to-[#1E293B] overflow-y-auto overflow-x-hidden shadow-2xl z-20 border-r border-slate-800 transition-all duration-300 ease-in-out`}
    >
      {/* Logo & Collapse Header */}
      <div className={`p-4 border-b border-white/10 flex items-center ${collapsed ? 'justify-center' : 'justify-between'} h-16 transition-all`}>
        {collapsed ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 hover:border-sky-500/40 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center group shadow-sm"
            title="Expand sidebar"
          >
            <ChevronRight className="w-5 h-5 text-sky-400 group-hover:translate-x-0.5 transition-transform" />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-3 min-w-0">
              <Logo size="small" />
              <span className="font-extrabold text-white text-lg tracking-wider leading-none truncate">
                FLOWSENSUS
              </span>
            </div>
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
                title="Collapse sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Active Session */}
      {collapsed ? (
        <div
          className="py-3 flex justify-center border-b border-white/5 bg-black/10"
          title={`Active Session: ${rolesDisplayText} Ops`}
        >
          <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
      ) : (
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
      )}

      {/* Navigation */}
      <nav className={`flex-1 ${collapsed ? 'p-2 space-y-1.5' : 'p-4 space-y-1'} text-sm font-medium`}>
        {/* Superadmin Dedicated Hub Module Access */}
        {isSuperAdmin && onSuperAdminDashboard && (
          collapsed ? (
            <div className="mb-2 pb-2 border-b border-white/10 flex justify-center">
              <button
                type="button"
                onClick={onSuperAdminDashboard}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:border-amber-400 hover:bg-amber-500/30 hover:text-white shadow-sm group cursor-pointer relative"
                title="Super Admin Console (Tenants & Overview)"
              >
                <Crown className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-amber-300 text-xs font-bold rounded-md shadow-xl border border-amber-500/30 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                  Super Admin Console
                </div>
              </button>
            </div>
          ) : (
            <div className="mb-4 pb-3 border-b border-white/10">
              <p className="text-[10px] uppercase tracking-widest text-amber-400 font-extrabold px-3 pb-2 flex items-center gap-1.5">
                <Crown size={12} className="text-amber-400" /> Platform Superadmin
              </p>
              <button
                type="button"
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
          )
        )}

        {/* Main Items */}
        {mainItems.map((item) => {
          const Icon = item.icon;
          if (!hasItemAccess(item)) return null;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
              className={
                collapsed
                  ? `w-10 h-10 mx-auto rounded-lg flex items-center justify-center transition-all cursor-pointer relative group my-1 ${currentView === item.id
                    ? 'bg-[#0EA5E9]/20 text-[#0EA5E9] border border-[#0EA5E9]/50 shadow-sm shadow-[#0EA5E9]/20'
                    : 'text-[#94A3B8] hover:text-white hover:bg-white/5 border border-transparent'
                  }`
                  : `w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-all cursor-pointer ${currentView === item.id
                    ? 'bg-gradient-to-r from-[#0EA5E9]/15 to-transparent text-[#0EA5E9] border-l-4 border-[#0EA5E9] pl-[8px] font-semibold'
                    : 'text-[#94A3B8] border-l-4 border-transparent hover:text-white hover:bg-white/5 hover:border-[#334155] hover:pl-[8px]'
                  }`
              }
              title={item.label}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
              {collapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs font-semibold rounded-md shadow-xl border border-slate-700 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}

        {/* Nav Groups */}
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => hasItemAccess(item));
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.title} className={collapsed ? 'mt-1' : 'mt-2'}>
              {collapsed ? (
                <div className="my-2 mx-auto w-7 border-t border-white/10" title={group.title} />
              ) : (
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-extrabold pt-4 pb-2 px-3 truncate">
                  {group.title}
                </p>
              )}
              {visibleItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onViewChange(item.id)}
                    className={
                      collapsed
                        ? `w-10 h-10 mx-auto rounded-lg flex items-center justify-center transition-all cursor-pointer relative group my-1 ${currentView === item.id
                          ? 'bg-[#0EA5E9]/20 text-[#0EA5E9] border border-[#0EA5E9]/50 shadow-sm shadow-[#0EA5E9]/20'
                          : 'text-[#94A3B8] hover:text-white hover:bg-white/5 border border-transparent'
                        }`
                        : `w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-all cursor-pointer ${currentView === item.id
                          ? 'bg-gradient-to-r from-[#0EA5E9]/15 to-transparent text-[#0EA5E9] border-l-4 border-[#0EA5E9] pl-[8px] font-semibold'
                          : 'text-[#94A3B8] border-l-4 border-transparent hover:text-white hover:bg-white/5 hover:border-[#334155] hover:pl-[8px]'
                        }`
                    }
                    title={item.label}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {collapsed && (
                      <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs font-semibold rounded-md shadow-xl border border-slate-700 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                        {item.label}
                      </div>
                    )}
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
