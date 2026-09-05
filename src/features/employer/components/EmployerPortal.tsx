import React, { useState } from 'react';
import {
  LogOut, Star, Clock, CheckCircle2, BarChart3, Send,
  ChevronRight, Building2, Globe, Layers, TrendingUp,
  MessageSquare, Zap, ThumbsUp, Users, MapPin, Mail,
  BadgeCheck, AlertCircle, Activity, Award, ArrowLeft,
  Shield, Briefcase, Calendar, Phone, FileText,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type EmployeeStatus = 'active' | 'completed' | 'left_early' | 'pending_eval';
type PortalView = 'dashboard' | 'evaluations' | 'eval-form';

interface EvaluationRecord {
  overallRating: number;
  dateEvaluated: string;
  rehireRecommended: boolean;
  performanceLabel: string;
  criteria: { work_performance: number; communication: number; adaptability: number; attitude: number };
  comments?: string;
}

interface DeployedEmployee {
  id: string;
  name: string;
  initials: string;
  role: string;
  department: string;
  dateStarted: string;
  dateEnded: string;
  contractDuration: string;
  status: EmployeeStatus;
  contractNo: string;
  evaluation?: EvaluationRecord;
}

// ─── Dummy data ───────────────────────────────────────────────────────────────

const EMPLOYER = {
  name: 'Al Noor Hospital Group',
  initials: 'ANH',
  industry: 'Healthcare / Inpatient Care',
  location: 'Abu Dhabi, United Arab Emirates',
  address: 'Khalifa Street, Al Markaziyah, Abu Dhabi, UAE',
  phone: '+971 2 626 5265',
  email: 'hr@alnoorhospital.ae',
  website: 'www.alnoorhospital.ae',
  accreditationNo: 'POEA-EMP-2019-UAE-0042',
  accreditationExpiry: 'December 31, 2027',
  accreditationStatus: 'Active',
  contactPerson: 'Mrs. Fatima Al-Rashidi',
  contactTitle: 'Head of Nursing & Deployment',
  memberSince: '2019',
  totalDeployedLifetime: 47,
  agencyName: 'FlowSensus Placement Agency',
  agencyCode: 'FSA-DMW-2018-PH-0812',
  agencyContact: 'Ms. Sarah Cruz',
  agencyEmail: 'recruitment@flowsensus.com',
  agencyPhone: '+63 2 8123 4567',
  agencyAddress: 'Unit 4B, Pacific Star Bldg., Makati City, Philippines',
};

const EMPLOYEES: DeployedEmployee[] = [
  // ── Currently active ──────────────────────────────────────────────────────
  {
    id: 'EMP-024', name: 'Diana A. Palma', initials: 'DP',
    role: 'Senior Caregiver', department: 'Geriatric Ward',
    dateStarted: 'March 1, 2025', dateEnded: '', contractDuration: '2 Years',
    status: 'active', contractNo: 'OEC-2025-PH-01141',
  },
  {
    id: 'EMP-025', name: 'Mark L. Tolentino', initials: 'MT',
    role: 'Medical Aide', department: 'Emergency Unit',
    dateStarted: 'April 15, 2025', dateEnded: '', contractDuration: '2 Years',
    status: 'active', contractNo: 'OEC-2025-PH-01209',
  },
  {
    id: 'EMP-026', name: 'Rosario G. dela Cruz', initials: 'RD',
    role: 'Registered Nurse', department: 'ICU / Critical Care',
    dateStarted: 'June 1, 2025', dateEnded: '', contractDuration: '2 Years',
    status: 'active', contractNo: 'OEC-2025-PH-01378',
  },

  // ── Pending evaluation (contract ended, no eval yet) ──────────────────────
  {
    id: 'EMP-021', name: 'Grace P. Villanueva', initials: 'GV',
    role: 'Senior Caregiver / Patient Care Assistant', department: 'Geriatric Ward',
    dateStarted: 'January 15, 2024', dateEnded: 'January 14, 2026',
    contractDuration: '2 Years', status: 'pending_eval', contractNo: 'OEC-2024-PH-00892',
  },
  {
    id: 'EMP-022', name: 'Luz F. Bautista', initials: 'LB',
    role: 'Ward Assistant', department: 'General Medicine',
    dateStarted: 'February 10, 2024', dateEnded: 'February 9, 2026',
    contractDuration: '2 Years', status: 'pending_eval', contractNo: 'OEC-2024-PH-00941',
  },
  {
    id: 'EMP-023', name: 'Benjamin R. Macaraig', initials: 'BM',
    role: 'Physical Therapist', department: 'Rehabilitation',
    dateStarted: 'March 5, 2024', dateEnded: 'October 12, 2025',
    contractDuration: '2 Years (left early)', status: 'left_early', contractNo: 'OEC-2024-PH-01005',
  },

  // ── Evaluated ─────────────────────────────────────────────────────────────
  {
    id: 'EMP-015', name: 'Maria C. Santos', initials: 'MS',
    role: 'Senior Nurse', department: 'ICU / Critical Care',
    dateStarted: 'June 1, 2022', dateEnded: 'May 31, 2024',
    contractDuration: '2 Years', status: 'completed', contractNo: 'OEC-2022-PH-00551',
    evaluation: {
      overallRating: 5, dateEvaluated: 'June 15, 2024',
      rehireRecommended: true, performanceLabel: 'Outstanding',
      criteria: { work_performance: 5, communication: 5, adaptability: 5, attitude: 5 },
      comments: 'Exceptional performance throughout the contract. Led night-shift ICU with zero critical incidents.',
    },
  },
  {
    id: 'EMP-016', name: 'Jose T. Reyes', initials: 'JR',
    role: 'Medical Aide', department: 'Orthopedics',
    dateStarted: 'January 5, 2023', dateEnded: 'January 4, 2025',
    contractDuration: '2 Years', status: 'completed', contractNo: 'OEC-2023-PH-00678',
    evaluation: {
      overallRating: 4, dateEvaluated: 'January 20, 2025',
      rehireRecommended: true, performanceLabel: 'Exceeds Expectations',
      criteria: { work_performance: 4, communication: 4, adaptability: 5, attitude: 4 },
      comments: 'Consistently reliable and showed great initiative with patient care routines.',
    },
  },
  {
    id: 'EMP-017', name: 'Ana L. Torres', initials: 'AT',
    role: 'Caregiver', department: 'Pediatric Ward',
    dateStarted: 'March 10, 2022', dateEnded: 'March 9, 2024',
    contractDuration: '2 Years', status: 'completed', contractNo: 'OEC-2022-PH-00489',
    evaluation: {
      overallRating: 5, dateEvaluated: 'March 22, 2024',
      rehireRecommended: true, performanceLabel: 'Outstanding',
      criteria: { work_performance: 5, communication: 5, adaptability: 4, attitude: 5 },
      comments: 'Beloved by patients and families alike. Highly compassionate and professional.',
    },
  },
  {
    id: 'EMP-018', name: 'Carlo B. Mendoza', initials: 'CM',
    role: 'Hospital Aide', department: 'General Surgery',
    dateStarted: 'September 1, 2022', dateEnded: 'August 31, 2024',
    contractDuration: '2 Years', status: 'completed', contractNo: 'OEC-2022-PH-00602',
    evaluation: {
      overallRating: 3, dateEvaluated: 'September 12, 2024',
      rehireRecommended: false, performanceLabel: 'Meets Expectations',
      criteria: { work_performance: 3, communication: 3, adaptability: 3, attitude: 4 },
      comments: 'Satisfactory performance. Some attendance issues in the second year of contract.',
    },
  },
  {
    id: 'EMP-019', name: 'Elena M. Cruz', initials: 'EC',
    role: 'Senior Nurse', department: 'Maternity & OB',
    dateStarted: 'July 15, 2023', dateEnded: 'July 14, 2025',
    contractDuration: '2 Years', status: 'completed', contractNo: 'OEC-2023-PH-00811',
    evaluation: {
      overallRating: 4, dateEvaluated: 'July 28, 2025',
      rehireRecommended: true, performanceLabel: 'Exceeds Expectations',
      criteria: { work_performance: 4, communication: 5, adaptability: 4, attitude: 4 },
      comments: 'Strong team lead and mentor for newer staff. Excellent patient communication.',
    },
  },
  {
    id: 'EMP-020', name: 'Roberto V. Santos', initials: 'RS',
    role: 'Medical Technologist', department: 'Clinical Laboratory',
    dateStarted: 'February 1, 2023', dateEnded: 'August 15, 2024',
    contractDuration: '2 Years (left early)', status: 'left_early', contractNo: 'OEC-2023-PH-00701',
    evaluation: {
      overallRating: 2, dateEvaluated: 'September 5, 2024',
      rehireRecommended: false, performanceLabel: 'Needs Improvement',
      criteria: { work_performance: 2, communication: 2, adaptability: 3, attitude: 2 },
      comments: 'Left contract 18 months early citing personal reasons. Performance was below expectations in the final months.',
    },
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<EmployeeStatus, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  active:       { label: 'Currently Deployed', color: '#059669', bg: '#F0FDF4', border: '#BBF7D0', icon: <Activity size={11} /> },
  completed:    { label: 'Contract Completed', color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE', icon: <CheckCircle2 size={11} /> },
  left_early:   { label: 'Left Early',         color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', icon: <AlertCircle size={11} /> },
  pending_eval: { label: 'Awaiting Evaluation',color: '#B45309', bg: '#FEF3C7', border: '#FDE68A', icon: <Clock size={11} /> },
};

const OVERALL_LABELS = ['', 'Unsatisfactory', 'Needs Improvement', 'Meets Expectations', 'Exceeds Expectations', 'Outstanding'];
const PERFORMANCE_CRITERIA = [
  { key: 'work_performance', label: 'Work Performance',  icon: TrendingUp    },
  { key: 'communication',    label: 'Communication',     icon: MessageSquare },
  { key: 'adaptability',     label: 'Adaptability',      icon: Zap           },
  { key: 'attitude',         label: 'Attitude',          icon: ThumbsUp      },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: EmployeeStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border"
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
    >
      {cfg.icon} {cfg.label}
    </span>
  );
}

function StarRow({ value, max = 5, size = 13 }: { value: number; max?: number; size?: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={i < value ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}
        />
      ))}
    </span>
  );
}

function StarInput({ value, onChange, size = 30 }: { value: number; onChange: (v: number) => void; size?: number }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} type="button" onClick={() => onChange(s)}
          onMouseEnter={() => setHovered(s)} onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-110 active:scale-95 outline-none">
          <Star size={size}
            className={`transition-colors duration-150 ${(hovered || value) >= s ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}`} />
        </button>
      ))}
    </div>
  );
}

function SliderInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const labels = ['—', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
  const pct = (value / 5) * 100;
  return (
    <div className="flex items-center gap-3 flex-1">
      <input type="range" min={0} max={5} step={1} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 appearance-none rounded-full outline-none cursor-pointer"
        style={{ background: `linear-gradient(to right, #1D4ED8 ${pct}%, #E2E8F0 ${pct}%)` }} />
      <span className={`w-28 text-xs font-bold text-right ${value === 0 ? 'text-slate-300' : 'text-[#1D4ED8]'}`}>
        {labels[value]}
      </span>
    </div>
  );
}

// ─── Date helper ─────────────────────────────────────────────────────────────

function fmt(d: string): string {
  if (!d) return 'Present';
  const months: Record<string, string> = {
    January: 'Jan', February: 'Feb', March: 'Mar', April: 'Apr',
    May: 'May', June: 'Jun', July: 'Jul', August: 'Aug',
    September: 'Sep', October: 'Oct', November: 'Nov', December: 'Dec',
  };
  for (const [full, abbr] of Object.entries(months)) {
    if (d.startsWith(full)) return `${abbr} ${d.match(/\d{4}/)?.[0] ?? ''}`;
  }
  return d;
}

// ─── Employee card ────────────────────────────────────────────────────────────

function EmployeeCard({
  emp,
  onEvaluate,
}: {
  emp: DeployedEmployee;
  onEvaluate?: (emp: DeployedEmployee) => void;
}) {
  const cfg = STATUS_CONFIG[emp.status];
  const canEval = !emp.evaluation && onEvaluate &&
    (emp.status === 'pending_eval' || emp.status === 'left_early');

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col">
      {/* Status colour band */}
      <div className="h-1 flex-shrink-0" style={{ background: cfg.color }} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Avatar + name */}
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-black flex-shrink-0 ring-2 ring-white shadow"
            style={{ background: cfg.color }}
          >
            {emp.initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-[#0C1A2E] text-sm leading-snug truncate">{emp.name}</p>
            <p className="text-xs text-[#64748B] truncate leading-snug">{emp.role}</p>
          </div>
        </div>

        {/* Department chip + date range */}
        <div className="flex flex-col gap-1.5">
          <span className="self-start bg-slate-100 text-[#475569] text-[10px] font-semibold px-2 py-0.5 rounded-md">
            {emp.department}
          </span>
          <p className="text-[11px] text-[#94A3B8] flex items-center gap-1">
            <Calendar size={10} className="flex-shrink-0" />
            {fmt(emp.dateStarted)} – {emp.dateEnded ? fmt(emp.dateEnded) : 'Present'}
          </p>
        </div>

        {/* Divider + status row */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
          <StatusBadge status={emp.status} />
          {emp.evaluation && <StarRow value={emp.evaluation.overallRating} size={13} />}
          {canEval && (
            <button
              onClick={() => onEvaluate!(emp)}
              className="text-[10px] font-bold text-[#1D4ED8] bg-[#EFF6FF] border border-[#BFDBFE] px-2.5 py-1 rounded-lg hover:bg-[#DBEAFE] transition-colors"
            >
              Evaluate →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard view ───────────────────────────────────────────────────────────

function DashboardView() {
  const counts = {
    active:    EMPLOYEES.filter((e) => e.status === 'active').length,
    completed: EMPLOYEES.filter((e) => e.status === 'completed').length,
    leftEarly: EMPLOYEES.filter((e) => e.status === 'left_early').length,
    pending:   EMPLOYEES.filter((e) => e.status === 'pending_eval').length,
    evaluated: EMPLOYEES.filter((e) => e.evaluation).length,
  };

  return (
    <div className="space-y-6">
      {/* ── Employer profile card ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#0C1A2E] to-[#1A3050] px-6 py-5 flex items-center gap-5">
          <div className="w-16 h-16 rounded-xl bg-[#1D4ED8] flex items-center justify-center text-white text-xl font-black flex-shrink-0 ring-2 ring-white/15 select-none">
            {EMPLOYER.initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-black text-xl leading-tight">{EMPLOYER.name}</h2>
            <p className="text-[#93C5FD] text-sm mt-0.5">{EMPLOYER.industry}</p>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className="flex items-center gap-1 text-[#64748B] text-xs">
                <MapPin size={11} /> {EMPLOYER.location}
              </span>
              <span className="flex items-center gap-1 text-[#64748B] text-xs">
                <Building2 size={11} /> Since {EMPLOYER.memberSince}
              </span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <span className="bg-[#10B981]/20 text-[#10B981] text-[10px] font-bold px-3 py-1 rounded border border-[#10B981]/25 uppercase tracking-wide">
              Accredited
            </span>
            <p className="text-[#475569] text-[10px] mt-1.5">Expires {EMPLOYER.accreditationExpiry}</p>
          </div>
        </div>

        {/* Profile details grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y divide-slate-100 border-t border-slate-100">
          {[
            { label: 'Contact Person', value: EMPLOYER.contactPerson, sub: EMPLOYER.contactTitle, icon: Users },
            { label: 'Email',           value: EMPLOYER.email,         sub: EMPLOYER.phone,          icon: Mail  },
            { label: 'Accreditation',   value: EMPLOYER.accreditationNo, sub: 'POEA Certified',      icon: Shield },
            { label: 'Address',         value: 'Al Markaziyah, Abu Dhabi', sub: 'UAE',               icon: MapPin },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="px-4 py-3.5">
                <p className="text-[10px] text-[#64748B] uppercase font-bold tracking-wide mb-1 flex items-center gap-1">
                  <Icon size={9} /> {item.label}
                </p>
                <p className="text-xs text-[#0F172A] font-semibold leading-snug">{item.value}</p>
                <p className="text-[10px] text-[#94A3B8]">{item.sub}</p>
              </div>
            );
          })}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-5 divide-x divide-slate-100 border-t border-slate-100 bg-[#FAFAFA]">
          {[
            { label: 'Lifetime Deployed', value: EMPLOYER.totalDeployedLifetime, color: '#0C1A2E' },
            { label: 'Currently Active',  value: counts.active,                  color: '#059669' },
            { label: 'Evaluated',         value: counts.evaluated,               color: '#1D4ED8' },
            { label: 'Pending Eval.',     value: counts.pending,                 color: '#D97706' },
            { label: 'Left Early',        value: counts.leftEarly,               color: '#EF4444' },
          ].map((s) => (
            <div key={s.label} className="px-4 py-3 text-center">
              <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] text-[#64748B] font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Agency partnership card ───────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Briefcase size={15} className="text-[#1D4ED8]" />
          <h3 className="font-bold text-[#0C1A2E] text-sm">Current Hiring Agency</h3>
          <span className="ml-auto bg-[#EFF6FF] text-[#1D4ED8] text-[10px] font-bold px-2.5 py-1 rounded-full border border-[#BFDBFE]">
            Active Partnership
          </span>
        </div>

        <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-[#F8FAFC] to-[#EFF6FF] rounded-xl border border-[#BFDBFE]">
          <div className="w-12 h-12 rounded-xl bg-[#0EA5E9] flex items-center justify-center flex-shrink-0">
            <Layers size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[#0C1A2E]">{EMPLOYER.agencyName}</p>
            <p className="text-xs text-[#64748B] font-mono mt-0.5">{EMPLOYER.agencyCode}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              <span className="text-xs text-[#475569] flex items-center gap-1">
                <Users size={10} /> {EMPLOYER.agencyContact}
              </span>
              <span className="text-xs text-[#475569] flex items-center gap-1">
                <Mail size={10} /> {EMPLOYER.agencyEmail}
              </span>
              <span className="text-xs text-[#475569] flex items-center gap-1">
                <Phone size={10} /> {EMPLOYER.agencyPhone}
              </span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] text-[#64748B] uppercase font-bold tracking-wide mb-1">Reviews linked to</p>
            <p className="text-xs text-[#1D4ED8] font-semibold">{EMPLOYER.agencyName}</p>
            <p className="text-[10px] text-[#94A3B8] mt-0.5">All evaluations are submitted<br />through this agency's system</p>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg">
          <AlertCircle size={13} className="text-[#D97706] mt-0.5 flex-shrink-0" />
          <p className="text-xs text-[#92400E]">
            <strong>{counts.pending} employee evaluation{counts.pending !== 1 ? 's' : ''}</strong> are pending submission.
            Complete them in the <strong>Evaluations</strong> tab to keep records current with {EMPLOYER.agencyName}.
          </p>
        </div>
      </div>

      {/* ── All employees grid ───────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-[#1D4ED8]" />
            <h3 className="font-bold text-[#0C1A2E] text-sm">All Deployed Employees</h3>
            <span className="bg-slate-100 text-[#64748B] text-[10px] font-bold px-2 py-0.5 rounded-full">
              {EMPLOYEES.length} total
            </span>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            {Object.entries(STATUS_CONFIG).map(([k, cfg]) => {
              const count = EMPLOYEES.filter((e) => e.status === k).length;
              if (!count) return null;
              return (
                <span key={k} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border"
                  style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
                  {cfg.icon} {count} {cfg.label}
                </span>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {EMPLOYEES.map((emp) => (
            <EmployeeCard key={emp.id} emp={emp} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Evaluations view ─────────────────────────────────────────────────────────

function EvaluationsView({ onEvaluate }: { onEvaluate: (emp: DeployedEmployee) => void }) {
  const pending   = EMPLOYEES.filter((e) => (e.status === 'pending_eval') || (e.status === 'left_early' && !e.evaluation));
  const evaluated = EMPLOYEES.filter((e) => !!e.evaluation);
  const active    = EMPLOYEES.filter((e) => e.status === 'active');

  return (
    <div className="space-y-6">
      {/* ── Stats header ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Awaiting Evaluation', value: pending.length,   color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', icon: Clock },
          { label: 'Evaluated',           value: evaluated.length, color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE', icon: BadgeCheck },
          { label: 'Currently Deployed',  value: active.length,    color: '#059669', bg: '#F0FDF4', border: '#BBF7D0', icon: Activity },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border shadow-sm px-5 py-4 flex items-center gap-4"
              style={{ borderColor: s.border }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: s.bg }}>
                <Icon size={18} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs text-[#64748B] font-medium">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Awaiting evaluation ───────────────────────────────────────── */}
      {pending.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <h3 className="font-bold text-[#0C1A2E] text-sm">Awaiting Evaluation</h3>
            <span className="bg-[#FFFBEB] text-[#D97706] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#FDE68A]">
              {pending.length} pending
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pending.map((emp) => (
              <div key={emp.id} className="bg-white rounded-2xl border-2 border-amber-200 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col">
                <div className="h-1 bg-amber-400 flex-shrink-0" />
                <div className="p-4 flex flex-col gap-3 flex-1">
                  {/* Avatar + name */}
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-amber-500 flex items-center justify-center text-white text-sm font-black flex-shrink-0 ring-2 ring-white shadow">
                      {emp.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[#0C1A2E] text-sm leading-snug truncate">{emp.name}</p>
                      <p className="text-xs text-[#64748B] truncate">{emp.role}</p>
                    </div>
                  </div>
                  {/* Department + date */}
                  <div className="flex flex-col gap-1.5">
                    <span className="self-start bg-slate-100 text-[#475569] text-[10px] font-semibold px-2 py-0.5 rounded-md">
                      {emp.department}
                    </span>
                    <p className="text-[11px] text-[#94A3B8] flex items-center gap-1">
                      <Calendar size={10} className="flex-shrink-0" />
                      {fmt(emp.dateStarted)} – {fmt(emp.dateEnded)}
                    </p>
                  </div>
                  {/* Action row */}
                  <div className="mt-auto flex items-center justify-between pt-2.5 border-t border-amber-100">
                    <StatusBadge status={emp.status} />
                    <button
                      onClick={() => onEvaluate(emp)}
                      className="text-xs font-bold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                    >
                      Submit Eval →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Evaluated employees ───────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BadgeCheck size={15} className="text-[#1D4ED8]" />
          <h3 className="font-bold text-[#0C1A2E] text-sm">Evaluated</h3>
          <span className="bg-[#EFF6FF] text-[#1D4ED8] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#BFDBFE]">
            {evaluated.length} records
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {evaluated.map((emp) => {
            const ev = emp.evaluation!;
            const rColor = ev.overallRating >= 4 ? '#1D4ED8' : ev.overallRating === 3 ? '#D97706' : '#EF4444';
            return (
              <div key={emp.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="h-1 flex-shrink-0" style={{ background: rColor }} />
                <div className="p-4 flex flex-col gap-3 flex-1">

                  {/* Avatar + name + status */}
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-black flex-shrink-0 ring-2 ring-white shadow"
                      style={{ background: rColor }}>
                      {emp.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#0C1A2E] text-sm leading-snug truncate">{emp.name}</p>
                      <p className="text-xs text-[#64748B] truncate">{emp.role}</p>
                    </div>
                    <StatusBadge status={emp.status} />
                  </div>

                  {/* Rating block */}
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2.5">
                    <div>
                      <p className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-wide mb-1">Overall</p>
                      <StarRow value={ev.overallRating} size={15} />
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black leading-none" style={{ color: rColor }}>
                        {ev.overallRating}.0
                      </p>
                      <p className="text-[10px] font-bold mt-0.5" style={{ color: rColor }}>
                        {ev.performanceLabel}
                      </p>
                    </div>
                  </div>

                  {/* Criteria 2 × 2 */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {PERFORMANCE_CRITERIA.map((c) => (
                      <div key={c.key} className="flex items-center justify-between gap-1">
                        <span className="text-[10px] text-[#94A3B8] truncate">{c.label.split(' ')[0]}</span>
                        <StarRow value={ev.criteria[c.key as keyof typeof ev.criteria]} size={10} />
                      </div>
                    ))}
                  </div>

                  {/* Footer: rehire + date */}
                  <div className="mt-auto flex items-center justify-between pt-2.5 border-t border-slate-100">
                    <span className={`text-xs font-bold flex items-center gap-1 ${ev.rehireRecommended ? 'text-[#059669]' : 'text-[#EF4444]'}`}>
                      {ev.rehireRecommended
                        ? <><CheckCircle2 size={11} /> Rehire Recommended</>
                        : <><AlertCircle   size={11} /> Not Recommended</>
                      }
                    </span>
                    <span className="text-[10px] text-[#94A3B8]">{fmt(ev.dateEvaluated)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Currently deployed (not yet evaluatable) ─────────────────── */}
      {active.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Activity size={15} className="text-[#059669]" />
            <h3 className="font-bold text-[#0C1A2E] text-sm">Currently Deployed</h3>
            <span className="bg-[#F0FDF4] text-[#059669] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#BBF7D0]">
              {active.length} active
            </span>
            <span className="text-[10px] text-[#94A3B8] ml-1">Evaluation available after contract ends</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {active.map((emp) => (
              <div key={emp.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col opacity-80">
                <div className="h-1 bg-[#10B981] flex-shrink-0" />
                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-[#059669] flex items-center justify-center text-white text-sm font-black flex-shrink-0 ring-2 ring-white shadow">
                      {emp.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[#0C1A2E] text-sm leading-snug truncate">{emp.name}</p>
                      <p className="text-xs text-[#64748B] truncate">{emp.role}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="self-start bg-slate-100 text-[#475569] text-[10px] font-semibold px-2 py-0.5 rounded-md">
                      {emp.department}
                    </span>
                    <p className="text-[11px] text-[#94A3B8] flex items-center gap-1">
                      <Calendar size={10} className="flex-shrink-0" />
                      Since {fmt(emp.dateStarted)} · {emp.contractDuration}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-2.5 border-t border-slate-100">
                    <StatusBadge status={emp.status} />
                    <span className="text-[10px] text-[#94A3B8]">Eval. after contract</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Evaluation form view ─────────────────────────────────────────────────────

function EvalFormView({
  emp,
  onBack,
}: {
  emp: DeployedEmployee;
  onBack: () => void;
}) {
  const [overallRating, setOverallRating]     = useState(0);
  const [criteriaRatings, setCriteriaRatings] = useState<Record<string, number>>({});
  const [comments, setComments]               = useState('');
  const [rehire, setRehire]                   = useState<boolean | null>(null);
  const [submitted, setSubmitted]             = useState(false);

  const setCriterion = (key: string, val: number) =>
    setCriteriaRatings((prev) => ({ ...prev, [key]: val }));

  return (
    <div className="space-y-5">
      {/* Back button + breadcrumb */}
      <button onClick={onBack}
        className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#1D4ED8] transition-colors">
        <ArrowLeft size={15} /> Back to Evaluations
      </button>

      {/* Employee summary card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#0C1A2E] to-[#1E3A5F] px-5 py-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#1D4ED8] flex items-center justify-center text-white text-xl font-black flex-shrink-0 ring-2 ring-white/15 select-none">
            {emp.initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-base leading-tight">{emp.name}</h2>
            <p className="text-[#93C5FD] text-sm">{emp.role}</p>
            <p className="text-[#475569] text-xs mt-0.5">{emp.department} · {emp.id}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <StatusBadge status={emp.status} />
            <p className="text-[#475569] text-[10px] mt-1.5 font-mono">{emp.contractNo}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-100">
          {[
            { label: 'Date Started', value: emp.dateStarted },
            { label: 'Date Ended',   value: emp.dateEnded || 'Ongoing' },
            { label: 'Duration',     value: emp.contractDuration },
          ].map((item) => (
            <div key={item.label} className="px-4 py-3">
              <p className="text-[10px] text-[#64748B] uppercase font-bold tracking-wide mb-0.5">{item.label}</p>
              <p className="text-xs text-[#0F172A] font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        {!submitted ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 size={17} className="text-[#1D4ED8]" />
              <h3 className="font-bold text-[#0C1A2E]">Performance Evaluation</h3>
            </div>
            <p className="text-sm text-[#64748B] mb-6">
              This evaluation is part of the worker's permanent record and will be shared with {EMPLOYER.agencyName}.
            </p>

            {/* Overall */}
            <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-5 mb-6">
              <p className="text-[10px] font-bold text-[#1D4ED8] uppercase tracking-wider mb-1">Overall Performance Rating</p>
              <p className="text-sm text-[#0C1A2E] font-medium mb-4">
                How would you rate {emp.name.split(' ')[0]}'s overall performance throughout the contract period?
              </p>
              <StarInput value={overallRating} onChange={setOverallRating} size={38} />
              {overallRating > 0 && (
                <p className="text-base font-black text-[#1D4ED8] mt-3">{OVERALL_LABELS[overallRating]}</p>
              )}
            </div>

            {/* Criteria sliders */}
            <div className="mb-6">
              <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-4">Specific Performance Criteria</p>
              <div className="space-y-3">
                {PERFORMANCE_CRITERIA.map((crit) => {
                  const Icon = crit.icon;
                  return (
                    <div key={crit.key} className="grid grid-cols-[auto_1fr] gap-4 items-center px-4 py-4 rounded-lg bg-[#F8FAFC] border border-slate-100 hover:border-[#BFDBFE] transition-colors">
                      <div className="flex items-center gap-3 w-40">
                        <div className="w-7 h-7 rounded-md bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center flex-shrink-0">
                          <Icon size={13} className="text-[#1D4ED8]" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#0F172A] leading-tight">{crit.label}</p>
                        </div>
                      </div>
                      <SliderInput value={criteriaRatings[crit.key] || 0} onChange={(val) => setCriterion(crit.key, val)} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rehire */}
            <div className="mb-6">
              <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-3">Rehire Recommendation</p>
              <div className="flex gap-3">
                {[
                  { v: true,  label: 'Recommend for Rehire', color: '#10B981', bg: '#F0FDF4', border: '#BBF7D0' },
                  { v: false, label: 'Do Not Recommend',     color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
                ].map((opt) => (
                  <button key={String(opt.v)} type="button" onClick={() => setRehire(opt.v)}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition-all"
                    style={rehire === opt.v
                      ? { borderColor: opt.color, color: opt.color, background: opt.bg }
                      : { borderColor: '#E2E8F0', color: '#94A3B8', background: 'white' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Comments */}
            <div className="mb-6">
              <label className="text-sm font-bold text-[#0C1A2E] block mb-2">
                Detailed Comments <span className="text-[#94A3B8] font-normal">(Optional)</span>
              </label>
              <textarea value={comments} onChange={(e) => setComments(e.target.value.slice(0, 1000))}
                placeholder="Provide specific observations on performance, conduct, notable contributions, or any incidents worth documenting for the official record."
                rows={5}
                className="w-full rounded-lg border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15 resize-none transition-colors" />
              <p className="text-xs text-[#94A3B8] mt-1.5 text-right">{comments.length} / 1,000</p>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <p className="text-xs text-[#94A3B8]">
                {overallRating === 0 ? 'Overall rating is required to submit' : 'Evaluation ready to submit'}
              </p>
              <button onClick={() => overallRating > 0 && setSubmitted(true)} disabled={overallRating === 0}
                className="bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold py-3 px-8 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20">
                <Send size={14} /> Submit Evaluation
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-10">
            <div className="w-14 h-14 rounded-full bg-[#1D4ED8]/10 border-2 border-[#1D4ED8]/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} className="text-[#1D4ED8]" />
            </div>
            <h3 className="font-bold text-[#0C1A2E] text-lg mb-2">Evaluation Submitted</h3>
            <p className="text-sm text-[#64748B] max-w-sm mx-auto">
              The evaluation for <strong>{emp.name}</strong> has been recorded and forwarded to {EMPLOYER.agencyName}.
            </p>
            <div className="mt-5 p-4 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl text-left max-w-xs mx-auto">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Overall Rating</span>
                  <span className="font-bold text-amber-500">{'★'.repeat(overallRating)}{'☆'.repeat(5 - overallRating)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Performance</span>
                  <span className="font-bold text-[#0C1A2E] text-xs">{OVERALL_LABELS[overallRating]}</span>
                </div>
                {rehire !== null && (
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Rehire</span>
                    <span className={`font-bold text-xs ${rehire ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {rehire ? 'Recommended' : 'Not Recommended'}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <button onClick={onBack}
              className="mt-5 text-sm text-[#1D4ED8] hover:underline flex items-center gap-1.5 mx-auto">
              <ArrowLeft size={13} /> Return to Evaluations
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface EmployerPortalProps {
  onLogout: () => void;
}

export default function EmployerPortal({ onLogout }: EmployerPortalProps) {
  const [view, setView]                       = useState<PortalView>('dashboard');
  const [evalTarget, setEvalTarget]           = useState<DeployedEmployee | null>(null);

  const handleEvaluate = (emp: DeployedEmployee) => {
    setEvalTarget(emp);
    setView('eval-form');
  };

  const handleBackFromForm = () => {
    setView('evaluations');
    setEvalTarget(null);
  };

  const pendingCount = EMPLOYEES.filter(
    (e) => e.status === 'pending_eval' || (e.status === 'left_early' && !e.evaluation)
  ).length;

  const NAV: { key: PortalView; label: string; icon: React.ReactNode }[] = [
    { key: 'dashboard',   label: 'Dashboard',   icon: <Globe size={14} />  },
    { key: 'evaluations', label: 'Evaluations', icon: <BarChart3 size={14} /> },
  ];

  return (
    <div className="w-full min-h-screen bg-[#EEF2F7]">

      {/* ── Corporate header ──────────────────────────────────────────────────── */}
      <header className="bg-[#0C1A2E] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#1D4ED8] flex items-center justify-center">
              <Layers size={15} className="text-white" />
            </div>
            <div className="leading-none">
              <p className="text-white font-bold text-sm tracking-tight">
                Flow<span className="text-[#60A5FA]">Sensus</span>
              </p>
              <p className="text-[#475569] text-[10px] uppercase tracking-wider">Employer Portal</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 ml-3 bg-[#132338] border border-[#1E3A5F] px-3 py-1.5 rounded-md">
            <Building2 size={12} className="text-[#3B82F6]" />
            <span className="text-[#94A3B8] text-xs">{EMPLOYER.name}</span>
            <span className="text-[#334155] mx-1">·</span>
            <Globe size={11} className="text-[#475569]" />
            <span className="text-[#475569] text-xs">{EMPLOYER.location}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:block text-right">
            <p className="text-white text-xs font-medium">{EMPLOYER.contactPerson}</p>
            <p className="text-[#64748B] text-[10px]">{EMPLOYER.contactTitle}</p>
          </div>
          <button onClick={onLogout}
            className="text-sm text-[#64748B] hover:text-white flex items-center gap-1.5 transition-colors">
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </header>

      {/* ── Tab navigation bar ────────────────────────────────────────────────── */}
      {view !== 'eval-form' && (
        <div className="bg-[#0F2035] border-b border-[#1A3050] px-6">
          <div className="max-w-5xl mx-auto flex items-center gap-1">
            {NAV.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setView(tab.key)}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-semibold border-b-2 transition-all relative ${
                  view === tab.key
                    ? 'text-white border-[#3B82F6]'
                    : 'text-[#64748B] border-transparent hover:text-[#94A3B8] hover:border-[#334155]'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.key === 'evaluations' && pendingCount > 0 && (
                  <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
            {view === 'eval-form' && evalTarget && (
              <div className="flex items-center gap-1.5 px-4 py-3.5 text-sm text-[#64748B]">
                <ChevronRight size={13} />
                <span className="text-[#93C5FD]">Evaluating: {evalTarget.name}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Breadcrumb (eval form only) ────────────────────────────────────────── */}
      {view === 'eval-form' && (
        <div className="bg-[#0F2035] border-b border-[#1A3050] px-6 py-2.5">
          <div className="max-w-5xl mx-auto flex items-center gap-1.5 text-xs text-[#475569]">
            <button onClick={() => setView('dashboard')} className="hover:text-[#94A3B8]">Dashboard</button>
            <ChevronRight size={11} />
            <button onClick={handleBackFromForm} className="hover:text-[#94A3B8]">Evaluations</button>
            <ChevronRight size={11} />
            <span className="text-[#93C5FD]">Submit — {evalTarget?.name}</span>
          </div>
        </div>
      )}

      {/* ── Main content ──────────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {view === 'dashboard'   && <DashboardView />}
        {view === 'evaluations' && <EvaluationsView onEvaluate={handleEvaluate} />}
        {view === 'eval-form'   && evalTarget && (
          <EvalFormView emp={evalTarget} onBack={handleBackFromForm} />
        )}
      </main>
    </div>
  );
}
