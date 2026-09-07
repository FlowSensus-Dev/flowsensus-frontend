import { Outlet, Link, useLocation } from "react-router-dom";
import {
  Search, Bell, LogOut, LayoutDashboard, Users, UserSquare,
  FileText, Settings, Briefcase, Globe, HeartPulse, FileScan, AlertTriangle, Layers, ShieldCheck, KanbanSquare, ScanText, BellRing,
  CheckSquare, TrendingUp, History, FileBarChart, FolderSearch
} from "lucide-react";
import Logo from "../components/Logo";
import { SIDEBAR_CONFIG } from "./sidebarConfig";

const ROLE_META = {
  manager: { base: "/manager", title: "Management Ops" },
  recruitment: { base: "/recruitment", title: "Recruitment Ops" },
  administration: { base: "/administration", title: "Admin Ops" },
  accounting: { base: "/accounting", title: "Accounting Ops" },
  "super-admin": { base: "/super-admin", title: "SuperAdmin Console" },
};

const ROUTE_VALID_LINKS = {
  "/manager": new Set([
    "/manager",
    "/manager/applicant-list",
    "/manager/cv-encoding",
    "/manager/endorsement-tracker",
    "/manager/document-ocr",
    "/manager/3-2-1-alerts",
    "/manager/employer-hub",
    "/manager/predictive-timeline",
    "/manager/deployment-history",
    "/manager/operational-reports",
    "/manager/user-management",
  ]),
  "/recruitment": new Set([
    "/recruitment",
    "/recruitment/applicant-list",
    "/recruitment/registration",
    "/recruitment/screening-panel",
    "/recruitment/applicant-profiling",
  ]),
  "/administration": new Set([
    "/administration",
    "/administration/applicant-list",
    "/administration/document-requirements",
    "/administration/evaluation-workflow",
    "/administration/job-orders",
    "/administration/employer-profiles",
    "/administration/fit-to-work",
    "/administration/document-ocr",
    "/administration/3-2-1-alerts",
  ]),
  "/accounting": new Set([
    "/accounting",
    "/accounting/applicant-list",
    "/accounting/expense-ledger",
  ]),
  "/super-admin": new Set([
    "/super-admin",
    "/super-admin/tenant-management",
    "/super-admin/agency-onboarding",
    "/super-admin/audit-ledger",
  ]),
};

const iconForLabel = (label) => {
  const normalized = label.toLowerCase();
  if (normalized.includes("dashboard")) return LayoutDashboard;
  if (normalized.includes("applicant list")) return Users;
  if (normalized.includes("document requirements")) return FileText;
  if (normalized.includes("evaluation")) return Settings;
  if (normalized.includes("job orders")) return Briefcase;
  if (normalized.includes("employer")) return Globe;
  if (normalized.includes("fit")) return HeartPulse;
  if (normalized.includes("ocr")) return FileScan;
  if (normalized.includes("alerts")) return AlertTriangle;
  return UserSquare;
};

export default function AppLayout() {
  const location = useLocation();
  const currentPath = location.pathname;

  const roleKey = Object.keys(ROLE_META).find((key) => currentPath.startsWith(`/${key}`));
  const roleMeta = roleKey ? ROLE_META[roleKey] : ROLE_META.administration;
  const ROLE_EMAILS = {
    recruitment: "recruitment@flowsensus.com",
    administration: "admin@flowsensus.com",
    accounting: "accounting@flowsensus.com",
    "super-admin": "superadmin@flowsensus.com",
  };
  const roleEmail = roleKey ? ROLE_EMAILS[roleKey] : ROLE_EMAILS.administration;
  const rawItems = SIDEBAR_CONFIG[roleMeta.base] || [];
  const allowedLinks = ROUTE_VALID_LINKS[roleMeta.base] || new Set();

  const navItems = rawItems.filter((item) => {
    if (!item?.to) return false;
    if (item.to.includes("/applicant-profile")) return false;
    return allowedLinks.has(item.to);
  });

  const isActive = (path, exact = false) => {
    if (exact) return currentPath === path;
    return currentPath === path || currentPath.startsWith(`${path}/`);
  };

  if (roleKey === "manager") return <ManagementLayout currentPath={currentPath} />;

  return (
    <div className="flex h-screen bg-slate-50 font-['Inter',sans-serif]">
      <aside className="w-64 bg-[#0B1628] flex flex-col h-full flex-shrink-0 shadow-xl z-20">
        <div className="h-16 flex items-center px-6 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#0EA5E9] flex items-center justify-center shadow-[0_0_12px_rgba(14,165,233,0.4)]">
              <Layers size={14} className="text-white" />
            </div>
            <span className="text-white font-black tracking-[0.06em] text-sm">
              FLOW<span className="text-[#0EA5E9]">SENSUS</span>
            </span>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-2">Active Session</div>
          <div className="flex items-center gap-2 text-[#0EA5E9]">
            <div className="w-2 h-2 rounded-full bg-[#0EA5E9] animate-pulse"></div>
            <span className="text-sm font-semibold">{roleMeta.title}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-7 custom-scrollbar">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = iconForLabel(item.label);
              const isRoot = item.to === roleMeta.base;
              const active = isActive(item.to, isRoot);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    active
                      ? "bg-[#0EA5E9]/10 text-[#0EA5E9] font-semibold border border-[#0EA5E9]/20"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0 z-10">
          <div className="relative w-[400px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search applicant ID or name (press Enter)..."
              className="w-full pl-10 pr-4 py-2 bg-slate-100/80 border border-transparent rounded-full text-sm focus:bg-white focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20 outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
              <div className="w-2 h-2 rounded-full bg-[#10B981]"></div>
              <span className="text-xs font-semibold text-emerald-700">{roleEmail}</span>
            </div>

            <button className="relative text-slate-400 hover:text-slate-600 transition-colors">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white text-[9px] font-bold text-white flex items-center justify-center">
                2
              </span>
            </button>

            <div className="w-px h-6 bg-slate-200"></div>

            <Link to="/login" className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Logout <LogOut size={16} />
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-50 relative">
          <div className="absolute inset-0 p-8">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}



const MANAGEMENT_ICONS = {
  LayoutDashboard, Users, FileText, KanbanSquare, ScanText, BellRing,
  CheckSquare, TrendingUp, History, FileBarChart, FolderSearch,
};

function ManagementLayout({ currentPath }) {
  const items = SIDEBAR_CONFIG['/manager'];
  const groups = [...new Set(items.map((item) => item.group))];

  return (
    <div className="w-full h-screen flex bg-[#F1F5F9]">
      <aside className="w-[260px] flex-shrink-0 flex flex-col bg-gradient-to-b from-[#0F172A] to-[#1E293B] overflow-y-auto shadow-2xl z-20 border-r border-slate-800">
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <Logo size="small" />
          <span className="font-extrabold text-white text-lg tracking-wider leading-none">FLOWSENSUS</span>
        </div>
        <div className="px-6 py-4 border-b border-white/5 bg-black/10">
          <p className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">Active Session</p>
          <p className="text-sm font-bold text-[#0EA5E9] mt-1 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Management Ops
          </p>
        </div>
        <nav aria-label="Management navigation" className="flex-1 p-4 space-y-1 text-sm font-medium">
          {groups.map((group) => (
            <div key={group} className={group ? 'mt-2' : 'space-y-1'}>
              {group && <p className="text-[10px] uppercase tracking-widest text-slate-500 font-extrabold pt-4 pb-2 px-3">{group}</p>}
              {items.filter((item) => item.group === group).map((item) => {
                const Icon = MANAGEMENT_ICONS[item.icon];
                const active = currentPath === item.to || (item.to !== '/manager' && item.to && currentPath.startsWith(`${item.to}/`));
                const className = `w-full text-left px-3 ${group ? 'py-2' : 'py-2.5'} rounded-lg flex items-center gap-3 transition-all ${
                  item.disabled ? 'text-[#94A3B8] border-l-4 border-transparent opacity-50 cursor-not-allowed' : active
                    ? 'bg-gradient-to-r from-[#0EA5E9]/15 to-transparent text-[#0EA5E9] border-l-4 border-[#0EA5E9] pl-[8px] font-semibold'
                    : 'text-[#94A3B8] border-l-4 border-transparent hover:text-white hover:bg-white/5 hover:border-[#334155] hover:pl-[8px]'
                }`;
                const content = <><Icon className="w-4 h-4" />{item.label}</>;
                return item.disabled
                  ? <button key={item.label} disabled title="CV review is not available yet" className={className}>{content}</button>
                  : <Link key={item.label} to={item.to} aria-current={active ? 'page' : undefined} className={className}>{content}</Link>;
              })}
            </div>
          ))}
        </nav>
      </aside>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between z-10 sticky top-0">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-4 top-2.5 text-slate-400" />
              <input type="text" disabled title="Applicant search is not available yet" placeholder="Search applicant ID or name..." className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-[#0EA5E9] outline-none transition-all placeholder:text-slate-500 font-medium disabled:cursor-not-allowed" />
            </div>
          </div>
          <div className="flex items-center gap-6 ml-4">
            <span className="hidden md:flex text-xs font-bold text-[#0F172A] bg-slate-100 px-3 py-1.5 rounded-full items-center gap-2 border border-slate-200">
              <ShieldCheck className="w-4 h-4" /> Management
            </span>
            <button disabled aria-label="Notifications unavailable" title="Notifications are not available yet" className="relative disabled:cursor-not-allowed">
              <Bell className="w-5 h-5 text-[#475569]" />
            </button>
            <div className="h-6 w-px bg-slate-200"></div>
            <Link to="/login" className="text-sm font-bold text-[#475569] hover:text-[#EF4444] transition-colors flex items-center gap-2">
              Logout <LogOut className="w-4 h-4" />
            </Link>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8 relative"><Outlet /></div>
      </main>
    </div>
  );
}
