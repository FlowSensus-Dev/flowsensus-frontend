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
} from 'lucide-react';
import Logo from './Logo';

export default function Sidebar({ current_user_role, current_view, on_view_change }) {
  const main_items = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: 'All' },
    { id: 'applicants', label: 'Applicant List', icon: UsersIcon, roles: 'All' },
    { id: 'applicant', label: 'Applicant Profile', icon: FolderSearch, roles: 'All' },
  ];

  const nav_groups = [
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
        { id: 'users', label: 'User Mgmt', icon: Users, roles: ['Management'] },
      ],
    },
  ];

  const has_access = (roles) => {
    if (roles === 'All') return true;
    return roles.includes(current_user_role);
  };

  return (
    <aside className="w-[260px] flex-shrink-0 flex flex-col bg-gradient-to-b from-[#0F172A] to-[#1E293B] overflow-y-auto shadow-2xl z-20 border-r border-slate-800">
      <div className="p-6 flex items-center gap-3 border-b border-white/10">
        <Logo size="small" />
        <span className="font-extrabold text-white text-lg tracking-wider leading-none">FLOWSENSUS</span>
      </div>

      <div className="px-6 py-4 border-b border-white/5 bg-black/10">
        <p className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">Active Session</p>
        <p className="text-sm font-bold text-[#0EA5E9] mt-1 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> {current_user_role} Ops
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-1 text-sm font-medium">
        {main_items.map((item) => {
          const Icon = item.icon;
          if (!has_access(item.roles)) return null;
          return (
            <button
              key={item.id}
              onClick={() => on_view_change(item.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-all ${
                current_view === item.id
                  ? 'bg-gradient-to-r from-[#0EA5E9]/15 to-transparent text-[#0EA5E9] border-l-4 border-[#0EA5E9] pl-[8px] font-semibold'
                  : 'text-[#94A3B8] border-l-4 border-transparent hover:text-white hover:bg-white/5 hover:border-[#334155] hover:pl-[8px]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}

        {nav_groups.map((group) => {
          if (!has_access(group.roles)) return null;
          return (
            <div key={group.title} className="mt-2">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-extrabold pt-4 pb-2 px-3">
                {group.title}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon;
                if (!has_access(item.roles)) return null;
                return (
                  <button
                    key={item.id}
                    onClick={() => on_view_change(item.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-all ${
                      current_view === item.id
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
