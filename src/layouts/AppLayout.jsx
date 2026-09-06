import { Outlet, Link, useLocation } from "react-router-dom";
import {
  Search, Bell, LogOut, LayoutDashboard, Users, UserSquare,
  FileText, Settings, Briefcase, Globe, HeartPulse, FileScan, AlertTriangle, Layers
} from "lucide-react";

export default function AppLayout() {
  const location = useLocation();
  const currentPath = location.pathname;

  // Helper to dynamically highlight active sidebar links
  const isActive = (path) => currentPath === path || currentPath.startsWith(path + '/');

  return (
    <div className="flex h-screen bg-slate-50 font-['Inter',sans-serif]">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#0B1628] flex flex-col h-full flex-shrink-0 shadow-xl z-20">
        
        {/* Logo Area */}
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

        {/* Active Session Badge */}
        <div className="px-6 py-5">
          <div className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-2">Active Session</div>
          <div className="flex items-center gap-2 text-[#0EA5E9]">
            <div className="w-2 h-2 rounded-full bg-[#0EA5E9] animate-pulse"></div>
            <span className="text-sm font-semibold">Admin Ops</span>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-7 custom-scrollbar">
          
          {/* General Group */}
          <div className="space-y-1">
            <Link to="/administration" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${currentPath === '/administration' ? 'bg-[#0EA5E9]/10 text-[#0EA5E9] font-semibold border border-[#0EA5E9]/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <LayoutDashboard size={18} />
              Dashboard
            </Link>
            <Link to="/administration/applicant-list" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${isActive('/administration/applicant-list') ? 'bg-[#0EA5E9]/10 text-[#0EA5E9] font-semibold border border-[#0EA5E9]/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <Users size={18} />
              Applicant List
            </Link>
            <Link to="/administration/applicant-profile" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${isActive('/administration/applicant-profile') ? 'bg-[#0EA5E9]/10 text-[#0EA5E9] font-semibold border border-[#0EA5E9]/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <UserSquare size={18} />
              Applicant Profile
            </Link>
          </div>

          {/* Agency Config Group */}
          <div>
            <div className="px-3 text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-3">Agency Configuration</div>
            <div className="space-y-1">
              <Link to="/administration/document-requirements" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${isActive('/administration/document-requirements') ? 'bg-[#0EA5E9]/10 text-[#0EA5E9] font-semibold border border-[#0EA5E9]/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                <FileText size={18} />
                Document Requirements
              </Link>
              <Link to="/administration/evaluation-workflow" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${isActive('/administration/evaluation-workflow') ? 'bg-[#0EA5E9]/10 text-[#0EA5E9] font-semibold border border-[#0EA5E9]/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                <Settings size={18} />
                Evaluation & Workflow
              </Link>
              <Link to="/administration/job-orders" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${isActive('/administration/job-orders') ? 'bg-[#0EA5E9]/10 text-[#0EA5E9] font-semibold border border-[#0EA5E9]/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                <Briefcase size={18} />
                Job Orders
              </Link>
              <Link to="/administration/employer-profiles" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${isActive('/administration/employer-profiles') ? 'bg-[#0EA5E9]/10 text-[#0EA5E9] font-semibold border border-[#0EA5E9]/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                <Globe size={18} />
                Employer Profiles
              </Link>
            </div>
          </div>

          {/* Compliance & Visa Group */}
          <div>
            <div className="px-3 text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-3">Compliance & Visa</div>
            <div className="space-y-1">
              <Link to="/administration/fit-to-work" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${isActive('/administration/fit-to-work') ? 'bg-[#0EA5E9]/10 text-[#0EA5E9] font-semibold border border-[#0EA5E9]/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                <HeartPulse size={18} />
                Fit-to-Work
              </Link>
            </div>
          </div>

          {/* Document Processing Group */}
          <div>
            <div className="px-3 text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-3">Document Processing</div>
            <div className="space-y-1">
              <Link to="/administration/document-ocr" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${isActive('/administration/document-ocr') ? 'bg-[#0EA5E9]/10 text-[#0EA5E9] font-semibold border border-[#0EA5E9]/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                <FileScan size={18} />
                Document OCR
              </Link>
              <Link to="/administration/3-2-1-alerts" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${isActive('/administration/3-2-1-alerts') ? 'bg-[#0EA5E9]/10 text-[#0EA5E9] font-semibold border border-[#0EA5E9]/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                <AlertTriangle size={18} />
                3-2-1 Alerts
              </Link>
            </div>
          </div>

        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* TOP HEADER */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0 z-10">
          
          {/* Search Bar */}
          <div className="relative w-[400px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search applicant ID or name (press Enter)..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-100/80 border border-transparent rounded-full text-sm focus:bg-white focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20 outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
              <div className="w-2 h-2 rounded-full bg-[#10B981]"></div>
              <span className="text-xs font-semibold text-emerald-700">admin@flowsensus.com</span>
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

        {/* PAGE CONTENT (Dynamic Outlet) */}
        <div className="flex-1 overflow-y-auto bg-slate-50 relative">
          <div className="absolute inset-0 p-8">
            <Outlet />
          </div>
        </div>

      </main>
    </div>
  );
}