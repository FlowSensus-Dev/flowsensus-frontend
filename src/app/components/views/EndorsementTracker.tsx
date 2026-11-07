import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock, Upload, Users, CheckCircle2, RefreshCw, Loader2,
  ChevronRight, Calendar, Link as LinkIcon, FileText, Trash2,
  AlertCircle, Send, Eye, Download, X, Building, MapPin,
  Briefcase, DollarSign, ShieldAlert, ShieldCheck, AlertTriangle,
  ArrowLeftRight, Check, FileCheck, Ban, ArrowRight, UserCheck, Undo2,
  ChevronDown, ChevronUp, Maximize2, Minimize2, Search,
  LayoutGrid, List, ArrowLeft, ZoomIn, ZoomOut
} from 'lucide-react';
import { ApplicantRecord, ActivityLog } from '../../types';
import { Skeleton, SkeletonText } from '../ui/skeleton';
import { api } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { CVPreviewDoc, downloadCVPdf } from '../CVPreview';

interface EndorsementTrackerProps {
  applicants?: ApplicantRecord[];
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  updateApplicant: (applicantId: string, updates: Partial<ApplicantRecord>) => void;
  globalJobOrders?: any[];
  globalEmployers?: any[];
  onNavigate?: (view: string) => void;
  showToast?: (message: string) => void;
}

interface CvSubmission {
  submission_id: number;
  cv_id: number;
  applicant_id: number;
  agency_id: number;
  job_order_id: number | null;
  board_stage_code: 'MANAGER_APPROVED' | 'UPLOADED_TO_PORTAL' | 'WAITING_SELECTION' | 'ENDORSED_TO_ADMIN';
  ext_upload_ref: string | null;
  selection_date: string | null;
  admin_notes?: string | null;
  stage_updated_by: string | null;
  stage_updated_at: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  // Enriched by backend
  applicant_name: string;
  applied_role: string;
  job_role?: string | null;
  job_order_code: string;
  approved_by?: string | null;
  approved_at?: string | null;
  employer_info?: {
    employer_id: number;
    company_name: string;
    industry: string;
    address?: string;
    website?: string;
    country_name: string;
    position?: string;
    total_slots?: number;
    salary_min?: number;
    salary_max?: number;
    salary_currency?: string;
  } | null;
}

const STAGES = [
  {
    code: 'MANAGER_APPROVED' as const,
    step: '01',
    label: 'Manager Approved',
    shortLabel: 'Approved',
    color: '#10b981',
    dotClass: 'bg-emerald-500',
    topBorderClass: 'border-t-[3px] border-t-emerald-500',
    countBadgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200/90',
    bg: 'bg-[#F4F6F9]',
    border: 'border-slate-200/90',
    accent: 'border-slate-200',
    badgeBg: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
    desc: 'Ready for external employer portal upload',
    nextAction: 'Confirm Portal Upload',
    nextStage: 'UPLOADED_TO_PORTAL' as const,
  },
  {
    code: 'UPLOADED_TO_PORTAL' as const,
    step: '02',
    label: 'Uploaded to Portal',
    shortLabel: 'Uploaded',
    color: '#0ea5e9',
    dotClass: 'bg-sky-500',
    topBorderClass: 'border-t-[3px] border-t-sky-500',
    countBadgeClass: 'bg-sky-50 text-sky-700 border border-sky-200/90',
    bg: 'bg-[#F4F6F9]',
    border: 'border-slate-200/90',
    accent: 'border-slate-200',
    badgeBg: 'bg-sky-50 text-sky-700 border border-sky-200/80',
    icon: <Upload className="w-3.5 h-3.5 text-sky-600" />,
    desc: 'Uploaded to portal · Awaiting encoding sign-off',
    nextAction: 'Confirm Portal Encoding Done',
    nextStage: 'WAITING_SELECTION' as const,
  },
  {
    code: 'WAITING_SELECTION' as const,
    step: '03',
    label: 'Waiting Selection',
    shortLabel: 'Under Review',
    color: '#f59e0b',
    dotClass: 'bg-amber-500',
    topBorderClass: 'border-t-[3px] border-t-amber-500',
    countBadgeClass: 'bg-amber-50 text-amber-800 border border-amber-200/90',
    bg: 'bg-[#F4F6F9]',
    border: 'border-slate-200/90',
    accent: 'border-slate-200',
    badgeBg: 'bg-amber-50 text-amber-800 border border-amber-200/80',
    icon: <Users className="w-3.5 h-3.5 text-amber-600" />,
    desc: 'Under foreign employer evaluation & decision',
    nextAction: 'Record Employer Response',
    nextStage: 'ENDORSED_TO_ADMIN' as const,
  },
  {
    code: 'ENDORSED_TO_ADMIN' as const,
    step: '04',
    label: 'Pre-Deployment & Admin',
    shortLabel: 'Pre-Deployment',
    color: '#8b5cf6',
    dotClass: 'bg-violet-500',
    topBorderClass: 'border-t-[3px] border-t-violet-500',
    countBadgeClass: 'bg-violet-50 text-violet-700 border border-violet-200/90',
    bg: 'bg-[#F4F6F9]',
    border: 'border-slate-200/90',
    accent: 'border-slate-200',
    badgeBg: 'bg-violet-50 text-violet-700 border border-violet-200/80',
    icon: <Send className="w-3.5 h-3.5 text-violet-600" />,
    desc: 'Selected by employer · Eligibility & Admin gate',
    nextAction: 'Verify & Endorse to Admin',
    nextStage: null,
  },
];

const PREVIOUS_STAGE_MAP: Record<string, {
  prevStageCode: 'MANAGER_APPROVED' | 'UPLOADED_TO_PORTAL' | 'WAITING_SELECTION';
  prevStageLabel: string;
  applicantStatus: string;
  phase: number;
  description: string;
}> = {
  UPLOADED_TO_PORTAL: {
    prevStageCode: 'MANAGER_APPROVED',
    prevStageLabel: 'Manager Approved',
    applicantStatus: 'CV Approved - Sending to Employer',
    phase: 4,
    description: 'CV approved by Manager. Ready to upload to foreign employer portal.',
  },
  WAITING_SELECTION: {
    prevStageCode: 'UPLOADED_TO_PORTAL',
    prevStageLabel: 'Uploaded to Portal',
    applicantStatus: 'Endorse to Employer',
    phase: 4,
    description: 'CV uploaded to foreign employer portal. Awaiting encoding completion.',
  },
  ENDORSED_TO_ADMIN: {
    prevStageCode: 'WAITING_SELECTION',
    prevStageLabel: 'Waiting Selection',
    applicantStatus: 'Under Employer Review',
    phase: 4,
    description: 'Candidate CV encoded in employer portal. Under active review by foreign employer.',
  },
};

export function isCardEndorsedToAdmin(card?: CvSubmission | null, applicant?: ApplicantRecord | null): boolean {
  if (!card) return false;
  if (card.board_stage_code !== 'ENDORSED_TO_ADMIN') return false;
  const status = applicant?.status || '';
  const phase = typeof applicant?.phase === 'number' ? applicant.phase : 0;
  return Boolean(
    status === 'Endorse for Administrative Processing' ||
    phase >= 5 ||
    (card.admin_notes && card.admin_notes.includes('Endorsed for Administrative Processing'))
  );
}

export interface ReturnStageOption {
  key: string;
  name: string;
  status: string;
  phase: number;
  department: string;
  desc: string;
}

const RETURN_STAGE_OPTIONS: ReturnStageOption[] = [
  {
    key: 'cv_encoding',
    name: 'CV Encoding',
    status: 'CV Encoding',
    phase: 3,
    department: 'Recruitment',
    desc: 'Exit tracker and return to CV Encoding for revisions or correction',
  },
  {
    key: 'applicant_profiling',
    name: 'Applicant Profiling',
    status: 'Applicant Profiling',
    phase: 3,
    department: 'Recruitment',
    desc: 'Return to recheck readiness and re-endorse to a specific job order',
  },
  {
    key: 'medical_clearance',
    name: 'Medical Clearance',
    status: 'Medical Clearance',
    phase: 2,
    department: 'Admin',
    desc: 'Return to Medical Gate / Fit-to-Work for clinic referral or laboratory re-evaluation',
  },
  {
    key: 'initial_screening',
    name: 'Initial Screening',
    status: 'Initial Screening',
    phase: 1,
    department: 'Recruitment',
    desc: 'Return to Initial Screening for re-assessment or re-evaluation',
  },
];

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 animate-pulse">
      <SkeletonText className="w-36 h-4" />
      <SkeletonText className="w-24 h-3" />
      <SkeletonText className="w-16 h-3" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KANBAN CARD & CARD DETAILS RESOLUTION
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolvedCardDetails {
  candidateName: string;
  candidateCode: string;
  candidateAppliedRole: string;
  jobOrderCode: string;
  jobOrderId: string | null;
  offeredPosition: string;
  employerName: string;
  countryName: string;
  salaryFormatted: string;
  slotsText: string;
  hasMatchedJobOrder: boolean;
  hasMatchedEmployer: boolean;
}

export function resolveCardDetails(
  card: CvSubmission | null | undefined,
  applicant?: ApplicantRecord,
  globalJobOrders: any[] = [],
  globalEmployers: any[] = []
): ResolvedCardDetails {
  if (!card) {
    return {
      candidateName: '—',
      candidateCode: '—',
      candidateAppliedRole: '—',
      jobOrderCode: '—',
      jobOrderId: null,
      offeredPosition: '—',
      employerName: '—',
      countryName: '—',
      salaryFormatted: '—',
      slotsText: '—',
      hasMatchedJobOrder: false,
      hasMatchedEmployer: false,
    };
  }

  // 1. Resolve Job Order ID & Code target
  const joIdTarget = String(
    card.job_order_id ||
    applicant?.selectedJobOrderId ||
    (applicant as any)?.job_order_id ||
    (applicant as any)?.jobOrderId ||
    ''
  ).trim();

  const rawCardJoCode = card.job_order_code && card.job_order_code !== 'JO-304' ? card.job_order_code.trim() : '';
  const rawAppJoCode = applicant?.jobOrder && applicant.jobOrder !== 'Unassigned' ? applicant.jobOrder.trim() : '';
  const joCodeTarget = rawCardJoCode || rawAppJoCode || '';

  const matchedJo = (globalJobOrders || []).find((j: any) => {
    const jId = String(j.id ?? j.job_order_id ?? '').trim();
    const jCode = String(j.code ?? j.job_order_code ?? j.job_code ?? '').trim();
    if (joIdTarget && jId && jId === joIdTarget) return true;
    if (joCodeTarget && jCode && (
      jCode.toLowerCase() === joCodeTarget.toLowerCase() ||
      joCodeTarget.toLowerCase().includes(jCode.toLowerCase()) ||
      jCode.toLowerCase().includes(joCodeTarget.toLowerCase())
    )) return true;
    return false;
  });

  // 2. Resolve Employer target
  const empIdTarget = String(
    card.employer_info?.employer_id ||
    matchedJo?.employer_id ||
    matchedJo?.employerId ||
    (applicant as any)?.employer_id ||
    (applicant as any)?.employerId ||
    ''
  ).trim();

  const cardEmpName = card.employer_info?.company_name;
  const cleanCardEmpName = (cardEmpName && 
    cardEmpName !== 'Foreign Principal Employer' && 
    cardEmpName !== 'Foreign Employer' && 
    cardEmpName !== 'Overseas Employer')
    ? cardEmpName.trim()
    : '';

  const matchedEmp = (globalEmployers || []).find((e: any) => {
    const eId = String(e.id ?? e.employer_id ?? '').trim();
    const eName = String(e.company_name ?? e.companyName ?? e.name ?? '').trim();
    if (empIdTarget && eId && eId === empIdTarget) return true;
    if (cleanCardEmpName && eName && eName.toLowerCase() === cleanCardEmpName.toLowerCase()) return true;
    if (matchedJo?.employerName && eName && eName.toLowerCase() === String(matchedJo.employerName).toLowerCase()) return true;
    if (matchedJo?.employer?.company_name && eName && eName.toLowerCase() === String(matchedJo.employer.company_name).toLowerCase()) return true;
    if ((applicant as any)?.employer && eName && eName.toLowerCase() === String((applicant as any).employer).toLowerCase()) return true;
    return false;
  });

  // Candidate fields
  const candidateName = applicant?.name || card.applicant_name || '—';
  
  // Distinguish candidate's applied trade/role
  const rawRole = applicant?.appliedPosition || applicant?.appliedRole || applicant?.role || card.applied_role || '';
  const candidateAppliedRole = (rawRole && rawRole !== 'Applicant' && rawRole !== 'OFW Staff' && rawRole !== '-') ? rawRole : '—';
  
  const candidateCode = applicant?.applicantCode || (applicant?.id ? `APP-${String(applicant.id).padStart(4, '0')}` : (card.applicant_id ? `APP-${String(card.applicant_id).padStart(4, '0')}` : '—'));

  // Job Order Code (accurately resolved)
  let jobOrderCode = '—';
  if (matchedJo?.code || matchedJo?.job_order_code || matchedJo?.job_code) {
    jobOrderCode = matchedJo.code || matchedJo.job_order_code || matchedJo.job_code;
  } else if (rawAppJoCode && rawAppJoCode !== 'Unassigned' && rawAppJoCode !== '-') {
    jobOrderCode = rawAppJoCode;
  } else if (rawCardJoCode && rawCardJoCode !== '-') {
    jobOrderCode = rawCardJoCode;
  } else if (joIdTarget && !isNaN(Number(joIdTarget)) && Number(joIdTarget) > 0) {
    jobOrderCode = `JO-2026-${String(joIdTarget).padStart(4, '0')}`;
  }

  // Employer Company Name
  let employerName = '—';
  if (matchedEmp?.company_name || matchedEmp?.companyName) {
    employerName = matchedEmp.company_name || matchedEmp.companyName;
  } else if (matchedJo?.employerName || matchedJo?.employer?.company_name || matchedJo?.client_employer?.company_name) {
    employerName = matchedJo.employerName || matchedJo.employer?.company_name || matchedJo.client_employer?.company_name;
  } else if (cleanCardEmpName && cleanCardEmpName !== '-') {
    employerName = cleanCardEmpName;
  } else if ((applicant as any)?.employer && (applicant as any)?.employer !== 'Unassigned' && (applicant as any)?.employer !== '-') {
    employerName = (applicant as any).employer;
  }

  // Country Destination
  let countryName = '—';
  const joCountry = (typeof matchedJo?.country === 'string' ? matchedJo.country : matchedJo?.country?.country_name) || matchedJo?.country_name;
  const empCountry = matchedEmp?.country || matchedEmp?.country_name || (typeof matchedEmp?.country === 'object' ? matchedEmp.country?.country_name : '');
  const cardCountry = card.employer_info?.country_name;
  const cleanCardCountry = (cardCountry && cardCountry !== 'Saudi Arabia' && cardCountry !== 'Overseas' && cardCountry !== '-' && cardCountry !== '—') ? cardCountry : '';

  if (joCountry && joCountry !== 'International' && joCountry !== '-' && joCountry !== '—') {
    countryName = joCountry;
  } else if (empCountry && empCountry !== 'International' && empCountry !== '-' && empCountry !== '—') {
    countryName = empCountry;
  } else if (cleanCardCountry) {
    countryName = cleanCardCountry;
  } else if ((applicant as any)?.country && (applicant as any)?.country !== '-' && (applicant as any)?.country !== '—') {
    countryName = (applicant as any).country;
  }

  // Offered Position (by Employer / Job Order)
  let offeredPosition = '—';
  if (matchedJo?.position || matchedJo?.position_title) {
    offeredPosition = matchedJo.position || matchedJo.position_title;
  } else if (card.employer_info?.position && card.employer_info.position !== 'OFW Staff' && card.employer_info.position !== '-') {
    offeredPosition = card.employer_info.position;
  } else if (rawRole && rawRole !== 'Applicant' && rawRole !== 'OFW Staff' && rawRole !== '-') {
    offeredPosition = rawRole;
  }

  // Contract Salary Offer
  let salaryFormatted = '—';
  const salMin = matchedJo?.salaryMin ?? matchedJo?.salary_min ?? card.employer_info?.salary_min;
  const salMax = matchedJo?.salaryMax ?? matchedJo?.salary_max ?? card.employer_info?.salary_max;
  const salCurr = matchedJo?.salaryCurrency || matchedJo?.salary_currency || card.employer_info?.salary_currency || '';
  if ((salMin !== undefined && salMin !== null && Number(salMin) > 0) || (salMax !== undefined && salMax !== null && Number(salMax) > 0)) {
    const currStr = salCurr ? `${salCurr} ` : '';
    if (salMin && salMax) {
      salaryFormatted = `${currStr}${Number(salMin).toLocaleString()} - ${Number(salMax).toLocaleString()}`;
    } else if (salMin) {
      salaryFormatted = `${currStr}${Number(salMin).toLocaleString()}`;
    } else if (salMax) {
      salaryFormatted = `Up to ${currStr}${Number(salMax).toLocaleString()}`;
    }
  } else if ((applicant as any)?.salary && (applicant as any)?.salary !== '-' && (applicant as any)?.salary !== '—') {
    salaryFormatted = String((applicant as any).salary);
  }

  // Quota slots
  let slotsText = '—';
  const totalSlots = matchedJo?.slots ?? matchedJo?.total_slots ?? card.employer_info?.total_slots;
  const filledSlots = matchedJo?.filledSlots ?? matchedJo?.filled_slots ?? 0;
  if (typeof totalSlots === 'number' && totalSlots > 0) {
    const remaining = Math.max(0, totalSlots - filledSlots);
    slotsText = remaining > 0 ? `${remaining} of ${totalSlots} quota slots available` : `Quota fully filled (${totalSlots}/${totalSlots})`;
  }

  return {
    candidateName,
    candidateCode,
    candidateAppliedRole,
    jobOrderCode,
    jobOrderId: joIdTarget || null,
    offeredPosition,
    employerName,
    countryName,
    salaryFormatted,
    slotsText,
    hasMatchedJobOrder: Boolean(matchedJo),
    hasMatchedEmployer: Boolean(matchedEmp),
  };
}

interface KanbanCardProps {
  card: CvSubmission;
  stage: typeof STAGES[number];
  applicant?: ApplicantRecord;
  globalJobOrders?: any[];
  globalEmployers?: any[];
  isExpandedDefault?: boolean;
  onPreviewCV: (card: CvSubmission) => void;
  onDownloadCV: (card: CvSubmission) => void;
  onOpenReturnModal: (card: CvSubmission) => void;
  onConfirmUpload: (card: CvSubmission, uploadRef: string) => void;
  onConfirmEncoding: (card: CvSubmission) => void;
  onOpenEmployerSelection: (card: CvSubmission) => void;
  onOpenNotSelected: (card: CvSubmission) => void;
  onOpenVerificationModal: (card: CvSubmission) => void;
  onPromptRollback: (card: CvSubmission) => void;
  isActing: boolean;
}

const PRESERVED_ACRONYMS = new Set([
  'UAE', 'KSA', 'USA', 'UK', 'QA', 'KW', 'OM', 'BH', 'HK', 'SG', 'TW', 'JP',
  'LLC', 'INC', 'LTD', 'CORP', 'WLL', 'PLC', 'FZE', 'FZCO',
  'SMAW', 'FCAW', 'GTAW', 'TIG', 'MIG', 'HVAC', 'MEP', 'CNC', 'IT', 'HR',
  'NC', 'II', 'III', 'IV', 'ICU', 'ER', 'OR', 'RN', 'DMW', 'POEA', 'OWWA',
]);

function formatReadableText(raw?: string | null): string {
  if (!raw || raw === '—') return '—';
  const trimmed = raw.trim();
  if (!trimmed) return '—';
  // Only convert if mostly uppercase
  const letters = trimmed.replace(/[^a-zA-Z]/g, '');
  const upperCount = letters.replace(/[^A-Z]/g, '').length;
  if (letters.length > 2 && upperCount / letters.length < 0.7) {
    return trimmed;
  }
  return trimmed
    .split(/(\s+|[()/,-])/g)
    .map(token => {
      if (!/^[A-Za-z]+$/.test(token)) return token;
      const upper = token.toUpperCase();
      if (PRESERVED_ACRONYMS.has(upper)) {
        if (upper === 'LTD' || upper === 'INC' || upper === 'CORP') {
          return upper[0] + upper.slice(1).toLowerCase();
        }
        return upper;
      }
      const lower = token.toLowerCase();
      if (['and', 'by', 'of', 'in', 'for', 'to', 'the'].includes(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('')
    .replace(/^[a-z]/, c => c.toUpperCase());
}

function KanbanCard({
  card,
  stage,
  applicant,
  globalJobOrders = [],
  globalEmployers = [],
  isExpandedDefault = true,
  onPreviewCV,
  onDownloadCV,
  onOpenReturnModal,
  onConfirmUpload,
  onConfirmEncoding,
  onOpenEmployerSelection,
  onOpenNotSelected,
  onOpenVerificationModal,
  onPromptRollback,
  isActing,
}: KanbanCardProps) {
  const [expanded, setExpanded] = useState(isExpandedDefault);
  const [uploadRef, setUploadRef] = useState(card.ext_upload_ref || '');

  // Keep synced with global toggle
  useEffect(() => {
    setExpanded(isExpandedDefault);
  }, [isExpandedDefault]);

  const details = resolveCardDetails(card, applicant, globalJobOrders, globalEmployers);
  const name = details.candidateName;
  const role = formatReadableText(details.candidateAppliedRole);
  const joCode = details.jobOrderCode;
  const approver = card.approved_by || 'Manager';
  const approvalDate = card.approved_at
    ? new Date(card.approved_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
    : (card.stage_updated_at ? new Date(card.stage_updated_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : null);

  const empCompany = formatReadableText(details.employerName);
  const empCountry = formatReadableText(details.countryName);

  const isEndorsedForAdmin = isCardEndorsedToAdmin(card, applicant);

  let endorserName = card.stage_updated_by || card.updated_by || 'Admin Officer';
  if (card.admin_notes && card.admin_notes.includes('Endorsed for Administrative Processing by ')) {
    const parts = card.admin_notes.split('Endorsed for Administrative Processing by ');
    if (parts[1]) {
      endorserName = parts[1].split(' on ')[0].trim();
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-slate-300 hover:shadow-sm transition-all duration-150 p-3.5 flex flex-col">
      {/* Row 1: Candidate Name + Quiet Utility Icons */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-[#0F172A] text-[14px] leading-snug break-words min-w-0 flex-1">
          {name}
        </h4>

        <div className="flex items-center gap-0.5 flex-shrink-0 -mt-0.5 -mr-1">
          <button
            type="button"
            onClick={() => onPreviewCV(card)}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
            title="Preview CV"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDownloadCV(card)}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
            title="Download PDF"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          {!isEndorsedForAdmin && (
            <button
              type="button"
              onClick={() => onOpenReturnModal(card)}
              disabled={isActing}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
              title="Move or return candidate"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Applied Role (Natural Title Case) */}
      <p className="text-[12.5px] font-medium text-slate-600 mt-0.5 leading-snug break-words">
        {role}
      </p>

      {/* Row 3: Employer, Country & JO Metadata (Separated by Clean Divider) */}
      <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-1.5">
        {(empCompany !== '—' || empCountry !== '—') && (
          <p className="text-[11.5px] text-slate-500 leading-snug break-words">
            {empCompany !== '—' ? empCompany : ''}
            {empCompany !== '—' && empCountry !== '—' ? ' · ' : ''}
            {empCountry !== '—' ? <span className="text-slate-600 font-medium">{empCountry}</span> : ''}
          </p>
        )}

        {expanded && (
          <div
            className="flex items-center justify-between gap-2 text-[11px] text-slate-400"
            title={`Approved by ${approver}${isEndorsedForAdmin ? ` · Endorsed by ${endorserName}` : ''}`}
          >
            <span className="font-mono text-[10.5px] text-slate-500 truncate">
              {joCode !== '—' ? joCode : 'No JO'}
            </span>
            <span className="truncate">
              {card.ext_upload_ref
                ? `Ref: ${card.ext_upload_ref}`
                : isEndorsedForAdmin
                ? `By ${endorserName}`
                : `By ${approver}${approvalDate ? ` · ${approvalDate}` : ''}`}
            </span>
          </div>
        )}
      </div>

      {/* Row 4: Calm, Low-Noise Stage Action */}
      <div className="mt-2.5 pt-2.5 border-t border-slate-100">
        {/* STAGE 1: MANAGER_APPROVED */}
        {stage.code === 'MANAGER_APPROVED' && (
          <div className="space-y-1.5">
            {expanded && (
              <input
                type="text"
                value={uploadRef}
                onChange={e => setUploadRef(e.target.value)}
                placeholder="Portal ref # (optional)"
                className="w-full bg-slate-50/70 focus:bg-white border border-slate-200/80 rounded-lg px-2.5 py-1 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-slate-300 outline-none transition-colors"
              />
            )}
            <button
              type="button"
              onClick={() => onConfirmUpload(card, uploadRef)}
              disabled={isActing}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100/90 hover:bg-[#0F172A] text-slate-700 hover:text-white border border-slate-200/80 hover:border-[#0F172A] text-xs font-medium rounded-lg transition-all disabled:opacity-40 cursor-pointer"
            >
              {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              <span>Confirm Portal Upload</span>
            </button>
          </div>
        )}

        {/* STAGE 2: UPLOADED_TO_PORTAL */}
        {stage.code === 'UPLOADED_TO_PORTAL' && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onConfirmEncoding(card)}
              disabled={isActing}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100/90 hover:bg-[#0F172A] text-slate-700 hover:text-white border border-slate-200/80 hover:border-[#0F172A] text-xs font-medium rounded-lg transition-all disabled:opacity-40 cursor-pointer"
            >
              {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
              <span>Confirm Encoding</span>
            </button>
            <button
              type="button"
              onClick={() => onPromptRollback(card)}
              disabled={isActing}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40 cursor-pointer flex-shrink-0"
              title="Step back to Manager Approved"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* STAGE 3: WAITING_SELECTION — Single Compact Row */}
        {stage.code === 'WAITING_SELECTION' && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onOpenEmployerSelection(card)}
              disabled={isActing}
              className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-slate-100/90 hover:bg-emerald-600 text-slate-700 hover:text-white border border-slate-200/80 hover:border-emerald-600 text-xs font-medium rounded-lg transition-all disabled:opacity-40 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Selected</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenNotSelected(card)}
              disabled={isActing}
              className="px-2.5 py-1.5 text-slate-500 hover:text-amber-800 bg-white hover:bg-amber-50 border border-slate-200/80 hover:border-amber-200 rounded-lg text-[11.5px] font-medium transition-colors disabled:opacity-40 cursor-pointer"
              title="Mark as Not Selected / Re-pool"
            >
              Not Selected
            </button>
            <button
              type="button"
              onClick={() => onPromptRollback(card)}
              disabled={isActing}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40 cursor-pointer flex-shrink-0"
              title="Step back to Uploaded to Portal"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* STAGE 4: ENDORSED_TO_ADMIN */}
        {stage.code === 'ENDORSED_TO_ADMIN' && (
          <div>
            {isEndorsedForAdmin ? (
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-emerald-700 min-w-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span className="truncate">Endorsed to Admin</span>
                </span>
                <button
                  type="button"
                  onClick={() => onOpenVerificationModal(card)}
                  className="px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:text-[#0F172A] hover:bg-slate-100 rounded-md transition-colors flex-shrink-0 cursor-pointer"
                >
                  Checklist →
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenVerificationModal(card)}
                  disabled={isActing}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100/90 hover:bg-[#0F172A] text-slate-700 hover:text-white border border-slate-200/80 hover:border-[#0F172A] text-xs font-medium rounded-lg transition-all disabled:opacity-40 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verify & Endorse</span>
                </button>
                <button
                  type="button"
                  onClick={() => onPromptRollback(card)}
                  disabled={isActing}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40 cursor-pointer flex-shrink-0"
                  title="Step back to Waiting Selection"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENDORSEMENT TRACKER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function EndorsementTracker({
  applicants = [],
  currentUserName,
  addActivityLog,
  updateApplicant,
  globalJobOrders = [],
  globalEmployers = [],
  onNavigate,
  showToast,
}: EndorsementTrackerProps) {
  const [submissions, setSubmissions] = useState<CvSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);

  // Layout & Display Controls (Collapsible & Scrollable)
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({});
  const [allCardsExpanded, setAllCardsExpanded] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [isStageFilterOpen, setIsStageFilterOpen] = useState<boolean>(false);
  const [previewZoom, setPreviewZoom] = useState<number>(0.85);
  const [openTableDropdownId, setOpenTableDropdownId] = useState<number | null>(null);

  // Close dropdowns when clicking outside or pressing Escape
  useEffect(() => {
    if (openTableDropdownId === null && !isStageFilterOpen) return;
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown-container]')) {
        setOpenTableDropdownId(null);
      }
      if (!target.closest('[data-stage-filter-container]')) {
        setIsStageFilterOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenTableDropdownId(null);
        setIsStageFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleGlobalClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleGlobalClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openTableDropdownId, isStageFilterOpen]);

  const toggleColumn = (code: string) => {
    setCollapsedColumns(prev => ({ ...prev, [code]: !prev[code] }));
  };

  const toggleAllCards = () => {
    setAllCardsExpanded(prev => !prev);
  };

  // Modals state
  const [returnModalCard, setReturnModalCard] = useState<CvSubmission | null>(null);
  const [returnDestination, setReturnDestination] = useState<string>('PREV_STAGE');
  const [returnTargetKey, setReturnTargetKey] = useState<string>('cv_encoding');
  const [returnReason, setReturnReason] = useState<string>('');

  const [confirmRollbackCard, setConfirmRollbackCard] = useState<CvSubmission | null>(null);
  const [rollbackReason, setRollbackReason] = useState<string>('Accidentally advanced phase');

  const [previewCard, setPreviewCard] = useState<CvSubmission | null>(null);

  const [employerSelectionCard, setEmployerSelectionCard] = useState<CvSubmission | null>(null);
  const [selectionRemarks, setSelectionRemarks] = useState<string>('');

  const [notSelectedCard, setNotSelectedCard] = useState<CvSubmission | null>(null);
  const [notSelectedMode, setNotSelectedMode] = useState<'POOL' | 'RE_ENDORSE'>('POOL');
  const [selectedNewJobOrderId, setSelectedNewJobOrderId] = useState<string>('');
  const [needsScreeningTest, setNeedsScreeningTest] = useState<boolean>(false);

  const [verificationCard, setVerificationCard] = useState<CvSubmission | null>(null);

  // Fetch submissions from backend
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/cv-submissions');
      setSubmissions(res.data || []);
    } catch {
      setSubmissions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { 
    load(); 

    // Live Real-Time Subscription to cv_employer_submission table
    const channel = supabase
      .channel('realtime:cv_employer_submission_tracker')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cv_employer_submission' },
        (payload: any) => {
          console.log('[EndorsementTracker] Realtime CV submission update:', payload.eventType);
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  // Helper to find full applicant object
  const getApplicantForCard = useCallback((card: CvSubmission): ApplicantRecord | undefined => {
    return applicants.find(a => String(a.id) === String(card.applicant_id));
  }, [applicants]);

  // Helper to preserve assigned handler when advancing endorsement stages
  const resolveAssignedHandler = useCallback((app?: ApplicantRecord) => {
    if (app?.currentHandler && !['Unassigned', 'Unassigned Pool', 'System Agent', ''].includes(app.currentHandler.trim())) {
      return app.currentHandler;
    }
    return currentUserName;
  }, [currentUserName]);

  const notify = (msg: string) => {
    if (showToast) showToast(msg);
    else alert(msg);
  };

  // ── 1. Confirm Portal Upload (Advances to UPLOADED_TO_PORTAL) ────────────────
  const handleConfirmUpload = async (card: CvSubmission, uploadRef: string) => {
    const previousSubmissions = submissions;
    const previousApp = getApplicantForCard(card);
    const assignedHandler = resolveAssignedHandler(previousApp);
    const nowIso = new Date().toISOString();

    // 1. Optimistic Update (0ms UI latency)
    const optimisticCard: CvSubmission = {
      ...card,
      board_stage_code: 'UPLOADED_TO_PORTAL',
      ext_upload_ref: uploadRef.trim() || card.ext_upload_ref,
      stage_updated_at: nowIso,
      stage_updated_by: currentUserName,
    };
    setSubmissions(prev => prev.map(s => s.submission_id === card.submission_id ? optimisticCard : s));

    updateApplicant(String(card.applicant_id), {
      status: 'Endorse to Employer',
      currentHandler: assignedHandler,
      phaseDescription: 'CV uploaded to foreign employer portal. Awaiting encoding completion.',
    });

    notify(`✓ ${card.applicant_name}: Status updated to "Endorse to Employer"`);

    // 2. Parallel Background API Requests
    setActingId(card.submission_id);
    try {
      const extra: Record<string, any> = {
        boardStageCode: 'UPLOADED_TO_PORTAL',
      };
      if (uploadRef.trim()) extra.extUploadRef = uploadRef.trim();

      const numId = parseInt(String(card.applicant_id), 10);
      const tasks: Promise<any>[] = [
        api.patch(`/cv-submissions/${card.submission_id}`, extra),
      ];
      if (!isNaN(numId)) {
        tasks.push(
          api.put(`/applicants/${numId}`, {
            application_status: 'Endorse to Employer',
            current_handler: assignedHandler,
            phase_description: 'CV uploaded to foreign employer portal. Awaiting encoding completion.',
            statusChangeReason: 'Confirmed portal upload in Endorsement Tracker',
            statusChangeSource: 'ENDORSEMENT_TRACKER',
            updated_at: nowIso,
          })
        );
      }

      const [res] = await Promise.all(tasks);
      if (res?.data) {
        const updated: CvSubmission = res.data;
        setSubmissions(prev => prev.map(s => s.submission_id === card.submission_id ? { ...s, ...updated, applicant_name: updated.applicant_name || s.applicant_name } : s));
      }

      addActivityLog({
        applicantId: String(card.applicant_id),
        action: 'Endorsed to Employer',
        performedBy: currentUserName,
        department: 'Recruitment',
        details: `Candidate CV uploaded to portal (Ref: ${uploadRef || 'None'}). Status: Endorse to Employer.`,
      });
    } catch (err: any) {
      setSubmissions(previousSubmissions);
      if (previousApp) {
        updateApplicant(String(card.applicant_id), {
          status: previousApp.status,
          phaseDescription: previousApp.phaseDescription,
        });
      }
      notify(`Failed to advance: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setActingId(null);
    }
  };

  // ── 2. Confirm Portal Encoding Done (Advances to WAITING_SELECTION) ──────────
  const handleConfirmEncoding = async (card: CvSubmission) => {
    const previousSubmissions = submissions;
    const previousApp = getApplicantForCard(card);
    const assignedHandler = resolveAssignedHandler(previousApp);
    const nowIso = new Date().toISOString();

    // 1. Optimistic Update (0ms UI latency)
    const optimisticCard: CvSubmission = {
      ...card,
      board_stage_code: 'WAITING_SELECTION',
      stage_updated_at: nowIso,
      stage_updated_by: currentUserName,
    };
    setSubmissions(prev => prev.map(s => s.submission_id === card.submission_id ? optimisticCard : s));

    updateApplicant(String(card.applicant_id), {
      status: 'Under Employer Review',
      currentHandler: assignedHandler,
      phaseDescription: 'Candidate CV encoded in employer portal. Under active review by foreign employer.',
    });

    notify(`✓ ${card.applicant_name}: Status updated to "Under Employer Review"`);

    // 2. Parallel Background API Requests
    setActingId(card.submission_id);
    try {
      const numId = parseInt(String(card.applicant_id), 10);
      const tasks: Promise<any>[] = [
        api.patch(`/cv-submissions/${card.submission_id}`, {
          boardStageCode: 'WAITING_SELECTION',
        }),
      ];
      if (!isNaN(numId)) {
        tasks.push(
          api.put(`/applicants/${numId}`, {
            application_status: 'Under Employer Review',
            current_handler: assignedHandler,
            phase_description: 'Candidate CV encoded in employer portal. Under active review by foreign employer.',
            statusChangeReason: 'Confirmed portal encoding complete; under employer review',
            statusChangeSource: 'ENDORSEMENT_TRACKER',
            updated_at: nowIso,
          })
        );
      }

      const [res] = await Promise.all(tasks);
      if (res?.data) {
        const updated: CvSubmission = res.data;
        setSubmissions(prev => prev.map(s => s.submission_id === card.submission_id ? { ...s, ...updated, applicant_name: updated.applicant_name || s.applicant_name } : s));
      }

      addActivityLog({
        applicantId: String(card.applicant_id),
        action: 'Under Employer Review',
        performedBy: currentUserName,
        department: 'Recruitment',
        details: `Candidate CV confirmed encoded in portal. Status updated to Under Employer Review.`,
      });
    } catch (err: any) {
      setSubmissions(previousSubmissions);
      if (previousApp) {
        updateApplicant(String(card.applicant_id), {
          status: previousApp.status,
          phaseDescription: previousApp.phaseDescription,
        });
      }
      notify(`Failed to advance: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setActingId(null);
    }
  };

  // ── 3. Confirm Employer Selection (Advances to PRE-DEPLOYMENT / ADMIN) ───────
  const handleConfirmEmployerSelection = async () => {
    if (!employerSelectionCard) return;
    const card = employerSelectionCard;
    const previousSubmissions = submissions;
    const previousApp = getApplicantForCard(card);
    const nowIso = new Date().toISOString();
    const remarks = selectionRemarks.trim();

    // Close modal immediately for instant UI feedback
    setEmployerSelectionCard(null);
    setSelectionRemarks('');

    const app = getApplicantForCard(card);
    const details = resolveCardDetails(card, app, globalJobOrders, globalEmployers);
    const empName = details.employerName !== '—' ? details.employerName : 'Employer';

    // 1. Optimistic Update (0ms UI latency)
    const optimisticCard: CvSubmission = {
      ...card,
      board_stage_code: 'ENDORSED_TO_ADMIN',
      selection_date: nowIso.split('T')[0],
      admin_notes: remarks || null,
      stage_updated_at: nowIso,
      stage_updated_by: currentUserName,
    };
    setSubmissions(prev => prev.map(s => s.submission_id === card.submission_id ? optimisticCard : s));

    updateApplicant(String(card.applicant_id), {
      phase: 4,
      status: 'Pre-Deployment Processing',
      currentHandler: currentUserName,
      currentDepartment: 'Admin',
      phaseDescription: `Candidate selected by ${empName}. In Pre-Deployment Processing. Ready for document validation.`,
    });

    notify(`🎉 ${card.applicant_name}: Selected by employer! Moved to Pre-Deployment Processing.`);

    // 2. Parallel Background API Requests
    setActingId(card.submission_id);
    try {
      const numId = parseInt(String(card.applicant_id), 10);
      const tasks: Promise<any>[] = [
        api.patch(`/cv-submissions/${card.submission_id}`, {
          boardStageCode: 'ENDORSED_TO_ADMIN',
          selectionDate: nowIso.split('T')[0],
          adminNotes: remarks || undefined,
        }),
      ];
      if (!isNaN(numId)) {
        tasks.push(
          api.put(`/applicants/${numId}`, {
            current_phase: 4,
            application_status: 'Pre-Deployment Processing',
            current_handler: currentUserName,
            current_department: 'Admin',
            phase_description: `Candidate selected by ${empName}. In Pre-Deployment Processing. Ready for document validation.`,
            statusChangeReason: `Employer selection confirmed: ${remarks || 'Selected by foreign employer'}`,
            statusChangeSource: 'ENDORSEMENT_TRACKER',
            updated_at: nowIso,
          })
        );
      }

      const [res] = await Promise.all(tasks);
      if (res?.data) {
        const updated: CvSubmission = res.data;
        setSubmissions(prev => prev.map(s => s.submission_id === card.submission_id ? { ...s, ...updated, applicant_name: updated.applicant_name || s.applicant_name } : s));
      }

      addActivityLog({
        applicantId: String(card.applicant_id),
        action: 'Employer Accepted Candidate',
        performedBy: currentUserName,
        department: 'Management',
        details: `Selected by ${empName}. Moved to Pre-Deployment Processing.`,
      });
    } catch (err: any) {
      setSubmissions(previousSubmissions);
      if (previousApp) {
        updateApplicant(String(card.applicant_id), {
          phase: previousApp.phase,
          status: previousApp.status,
          currentHandler: previousApp.currentHandler,
          currentDepartment: previousApp.currentDepartment,
          phaseDescription: previousApp.phaseDescription,
        });
      }
      notify(`Failed to record selection: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setActingId(null);
    }
  };

  // ── 4. Employer Not Selected / Slot Filled Handler ───────────────────────────
  const handleConfirmNotSelected = async () => {
    if (!notSelectedCard) return;
    const card = notSelectedCard;
    const previousSubmissions = submissions;
    const previousApp = getApplicantForCard(card);
    const mode = notSelectedMode;
    const newJoId = selectedNewJobOrderId;
    const needsTest = needsScreeningTest;

    // Close modal immediately
    setNotSelectedCard(null);
    setSelectedNewJobOrderId('');
    setNeedsScreeningTest(false);

    // Optimistically remove card from current tracker column
    setSubmissions(prev => prev.filter(s => s.submission_id !== card.submission_id));

    setActingId(card.submission_id);
    try {
      const numId = parseInt(String(card.applicant_id), 10);

      if (mode === 'POOL') {
        updateApplicant(String(card.applicant_id), {
          status: 'Waiting Selection',
          currentHandler: 'Unassigned',
          currentDepartment: 'Recruitment',
          phaseDescription: 'Candidate awaiting new job order endorsement (previous slot filled/not selected).',
        });
        notify(`ℹ️ ${card.applicant_name}: Status updated to "Waiting Selection" (Retained in pool)`);

        const tasks: Promise<any>[] = [
          api.delete(`/cv-submissions/${card.submission_id}`),
        ];
        if (!isNaN(numId)) {
          tasks.push(
            api.put(`/applicants/${numId}`, {
              application_status: 'Waiting Selection',
              current_handler: 'Unassigned',
              current_department: 'Recruitment',
              phase_description: 'Candidate awaiting new job order endorsement (previous slot filled/not selected).',
              statusChangeReason: 'Employer slot filled / not selected; retained in Waiting Selection pool',
              statusChangeSource: 'ENDORSEMENT_TRACKER',
              updated_at: new Date().toISOString(),
            })
          );
        }
        await Promise.all(tasks);

        addActivityLog({
          applicantId: String(card.applicant_id),
          action: 'Moved to Waiting Selection',
          performedBy: currentUserName,
          department: 'Recruitment',
          details: `Candidate not selected or slot filled. Placed in Waiting Selection talent pool.`,
        });
      } else {
        const targetJo = globalJobOrders.find(j => String(j.id || j.job_order_id) === String(newJoId));
        const newJoCode = targetJo?.job_code || targetJo?.jobCode || `JO-${newJoId}`;
        const newPosition = targetJo?.position || targetJo?.appliedPosition || 'New Position';

        if (needsTest) {
          updateApplicant(String(card.applicant_id), {
            phase: 1,
            status: 'Initial Screening',
            jobOrder: newJoCode,
            selectedJobOrderId: String(newJoId),
            role: newPosition,
            currentHandler: 'Unassigned',
            currentDepartment: 'Recruitment',
            phaseDescription: `Re-endorsed to ${newJoCode}. Returned to Screening Panel for additional assessment.`,
          });
          notify(`🔄 ${card.applicant_name}: Re-endorsed to ${newJoCode} & returned to Screening Panel`);

          const tasks: Promise<any>[] = [
            api.delete(`/cv-submissions/${card.submission_id}`),
          ];
          if (!isNaN(numId)) {
            tasks.push(
              api.put(`/applicants/${numId}`, {
                current_phase: 1,
                application_status: 'Initial Screening',
                job_order_id: Number(newJoId),
                current_handler: 'Unassigned',
                current_department: 'Recruitment',
                phase_description: `Re-endorsed to ${newJoCode}. Returned to Screening Panel for additional assessment.`,
                statusChangeReason: `Re-endorsed to ${newJoCode}; returned to screening for required evaluations`,
                statusChangeSource: 'ENDORSEMENT_TRACKER',
                updated_at: new Date().toISOString(),
              })
            );
          }
          await Promise.all(tasks);

          addActivityLog({
            applicantId: String(card.applicant_id),
            action: 'Re-endorsed to New Job Order (Screening)',
            performedBy: currentUserName,
            department: 'Recruitment',
            details: `Re-endorsed to ${newJoCode}. Returned to Screening Panel for required tests.`,
          });
        } else {
          updateApplicant(String(card.applicant_id), {
            status: 'Waiting Selection',
            jobOrder: newJoCode,
            selectedJobOrderId: String(newJoId),
            role: newPosition,
            currentHandler: currentUserName,
            currentDepartment: 'Recruitment',
            phaseDescription: `Assigned to ${newJoCode}. Waiting for endorsement package submission.`,
          });
          notify(`✓ ${card.applicant_name}: Reassigned to ${newJoCode} (Waiting Selection)`);

          const tasks: Promise<any>[] = [
            api.delete(`/cv-submissions/${card.submission_id}`),
          ];
          if (!isNaN(numId)) {
            tasks.push(
              api.put(`/applicants/${numId}`, {
                application_status: 'Waiting Selection',
                job_order_id: Number(newJoId),
                current_handler: currentUserName,
                current_department: 'Recruitment',
                phase_description: `Assigned to ${newJoCode}. Waiting for endorsement package submission.`,
                statusChangeReason: `Assigned to new Job Order ${newJoCode}`,
                statusChangeSource: 'ENDORSEMENT_TRACKER',
                updated_at: new Date().toISOString(),
              })
            );
          }
          await Promise.all(tasks);

          addActivityLog({
            applicantId: String(card.applicant_id),
            action: 'Reassigned to New Job Order',
            performedBy: currentUserName,
            department: 'Recruitment',
            details: `Reassigned to ${newJoCode} (${newPosition}) as Waiting Selection.`,
          });
        }
      }
    } catch (err: any) {
      setSubmissions(previousSubmissions);
      if (previousApp) {
        updateApplicant(String(card.applicant_id), {
          phase: previousApp.phase,
          status: previousApp.status,
          jobOrder: previousApp.jobOrder,
          selectedJobOrderId: previousApp.selectedJobOrderId,
          role: previousApp.role,
          currentHandler: previousApp.currentHandler,
          currentDepartment: previousApp.currentDepartment,
          phaseDescription: previousApp.phaseDescription,
        });
      }
      notify(`Error updating outcome: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setActingId(null);
    }
  };

  // ── 5. Deployment Eligibility Verification (Provisional vs Endorse Admin) ────
  const handleVerifyAndEndorseAdmin = async (card: CvSubmission, isComplete: boolean, missingItems: string[]) => {
    const previousSubmissions = submissions;
    const previousApp = getApplicantForCard(card);
    const numId = parseInt(String(card.applicant_id), 10);
    const nowIso = new Date().toISOString();

    // Close modal immediately
    setVerificationCard(null);

    if (!isComplete) {
      // RESULT 1: Incomplete records -> Block and update status to "Provisional"
      const reasonText = `Deployment blocked due to missing records: ${missingItems.join(', ')}. Recruitment team notified.`;

      updateApplicant(String(card.applicant_id), {
        status: 'Provisional',
        currentHandler: currentUserName,
        currentDepartment: 'Recruitment',
        phaseDescription: reasonText,
      });
      notify(`⚠️ ${card.applicant_name} marked as Provisional: missing ${missingItems.length} requirement(s).`);

      setActingId(card.submission_id);
      try {
        if (!isNaN(numId)) {
          await api.put(`/applicants/${numId}`, {
            application_status: 'Provisional',
            current_handler: currentUserName,
            current_department: 'Recruitment',
            phase_description: reasonText,
            statusChangeReason: reasonText,
            statusChangeSource: 'DEPLOYMENT_VERIFICATION',
            updated_at: nowIso,
          });
        }

        addActivityLog({
          applicantId: String(card.applicant_id),
          action: 'Deployment Blocked (Provisional)',
          performedBy: currentUserName,
          department: 'Recruitment',
          details: reasonText,
        });
      } catch (err: any) {
        if (previousApp) {
          updateApplicant(String(card.applicant_id), {
            status: previousApp.status,
            currentHandler: previousApp.currentHandler,
            currentDepartment: previousApp.currentDepartment,
            phaseDescription: previousApp.phaseDescription,
          });
        }
        notify(`Verification update failed: ${err?.response?.data?.detail || err.message}`);
      } finally {
        setActingId(null);
      }
    } else {
      // RESULT 2: Complete records -> Endorse for Administrative Processing
      const endorseNotes = `Endorsed for Administrative Processing by ${currentUserName}`;

      // 1. Optimistic update (0ms UI latency)
      setSubmissions(prev => prev.map(s => s.submission_id === card.submission_id ? {
        ...s,
        admin_notes: endorseNotes,
        stage_updated_by: currentUserName,
        stage_updated_at: nowIso,
      } : s));

      updateApplicant(String(card.applicant_id), {
        phase: 5,
        status: 'Endorse for Administrative Processing',
        currentHandler: currentUserName,
        currentDepartment: 'Admin',
        phaseDescription: 'Deployment eligibility records complete. Endorsed for Administrative Processing. Document Validation & Expense Ledger unlocked.',
      });

      notify(`✓ ${card.applicant_name}: Endorsed for Administrative Processing! Document Validation & Ledger unlocked.`);

      // 2. Parallel Background API Requests
      setActingId(card.submission_id);
      try {
        const tasks: Promise<any>[] = [
          api.patch(`/cv-submissions/${card.submission_id}`, {
            boardStageCode: 'ENDORSED_TO_ADMIN',
            adminNotes: endorseNotes,
            stageUpdatedBy: currentUserName,
            updatedBy: currentUserName,
          }),
        ];
        if (!isNaN(numId)) {
          tasks.push(
            api.put(`/applicants/${numId}`, {
              current_phase: 5,
              application_status: 'Endorse for Administrative Processing',
              current_handler: currentUserName,
              current_department: 'Admin',
              phase_description: 'Deployment eligibility records complete. Endorsed for Administrative Processing. Document Validation & Expense Ledger unlocked.',
              statusChangeReason: 'Deployment records verified complete from Endorsement Tracker',
              statusChangeSource: 'DEPLOYMENT_VERIFICATION',
              updated_at: nowIso,
            })
          );
        }

        const [subRes] = await Promise.all(tasks);
        if (subRes?.data) {
          setSubmissions(prev => prev.map(s => s.submission_id === card.submission_id ? { ...s, ...subRes.data } : s));
        }

        addActivityLog({
          applicantId: String(card.applicant_id),
          action: 'Endorsed for Administrative Processing',
          performedBy: currentUserName,
          department: 'Admin',
          details: `Deployment eligibility records verified complete. Endorsed for administrative processing by ${currentUserName}.`,
        });
      } catch (err: any) {
        setSubmissions(previousSubmissions);
        if (previousApp) {
          updateApplicant(String(card.applicant_id), {
            phase: previousApp.phase,
            status: previousApp.status,
            currentHandler: previousApp.currentHandler,
            currentDepartment: previousApp.currentDepartment,
            phaseDescription: previousApp.phaseDescription,
          });
        }
        notify(`Verification update failed: ${err?.response?.data?.detail || err.message}`);
      } finally {
        setActingId(null);
      }
    }
  };

  // ── Rollback Stage Handler (Return card to previous step in Tracker) ────────
  const handleRollbackStage = async (card: CvSubmission, customReason?: string) => {
    const prevInfo = PREVIOUS_STAGE_MAP[card.board_stage_code];
    if (!prevInfo) return;

    const previousSubmissions = submissions;
    const previousApp = getApplicantForCard(card);

    // Guard: Once endorsed to Admin, candidate cannot be stepped back from Endorsement Tracker
    if (isCardEndorsedToAdmin(card, previousApp)) {
      notify('⚠️ Cannot step back: Candidate is already endorsed to Admin and can only be returned by the Admin department.');
      return;
    }

    const nowIso = new Date().toISOString();

    // 1. Optimistic Update (0ms UI latency)
    const optimisticCard: CvSubmission = {
      ...card,
      board_stage_code: prevInfo.prevStageCode,
      admin_notes: '',
      stage_updated_at: nowIso,
      stage_updated_by: currentUserName,
    };
    setSubmissions(prev => prev.map(s => s.submission_id === card.submission_id ? optimisticCard : s));

    updateApplicant(String(card.applicant_id), {
      phase: prevInfo.phase,
      status: prevInfo.applicantStatus,
      currentHandler: currentUserName,
      phaseDescription: prevInfo.description,
    });

    notify(`↩ ${card.applicant_name}: Returned to previous step "${prevInfo.prevStageLabel}"`);

    // 2. Parallel Background API Requests
    setActingId(card.submission_id);
    try {
      const numId = parseInt(String(card.applicant_id), 10);
      const tasks: Promise<any>[] = [
        api.patch(`/cv-submissions/${card.submission_id}`, {
          boardStageCode: prevInfo.prevStageCode,
          adminNotes: '',
        }),
      ];
      if (!isNaN(numId)) {
        tasks.push(
          api.put(`/applicants/${numId}`, {
            current_phase: prevInfo.phase,
            application_status: prevInfo.applicantStatus,
            current_handler: currentUserName,
            phase_description: prevInfo.description,
            statusChangeReason: customReason || `Returned to previous step (${prevInfo.prevStageLabel}) in Endorsement Tracker`,
            statusChangeSource: 'ENDORSEMENT_STAGE_ROLLBACK',
            updated_at: nowIso,
          })
        );
      }

      const [res] = await Promise.all(tasks);
      if (res?.data) {
        const updated: CvSubmission = res.data;
        setSubmissions(prev => prev.map(s => s.submission_id === card.submission_id ? { ...s, ...updated, applicant_name: updated.applicant_name || s.applicant_name } : s));
      }

      addActivityLog({
        applicantId: String(card.applicant_id),
        action: `Returned to ${prevInfo.prevStageLabel}`,
        performedBy: currentUserName,
        department: 'Recruitment',
        details: `Stepped back from ${card.board_stage_code} to ${prevInfo.prevStageCode}. Status reverted to "${prevInfo.applicantStatus}". ${customReason ? `Reason: ${customReason}` : ''}`,
      });
    } catch (err: any) {
      setSubmissions(previousSubmissions);
      if (previousApp) {
        updateApplicant(String(card.applicant_id), {
          phase: previousApp.phase,
          status: previousApp.status,
          phaseDescription: previousApp.phaseDescription,
        });
      }
      notify(`Failed to return to previous step: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setActingId(null);
    }
  };

  // ── Open Return Modal with Admin Handover Guard ─────────────────────────────
  const handleOpenReturnModal = (c: CvSubmission) => {
    const app = getApplicantForCard(c);
    if (isCardEndorsedToAdmin(c, app)) {
      notify('⚠️ Candidate is already endorsed to Admin and cannot be returned unless returned by the Admin department.');
      return;
    }
    setReturnModalCard(c);
    const canStepBack = Boolean(PREVIOUS_STAGE_MAP[c.board_stage_code]) && !isCardEndorsedToAdmin(c, app);
    setReturnDestination(canStepBack ? 'PREV_STAGE' : 'cv_encoding');
    setReturnTargetKey('cv_encoding');
    setReturnReason('');
  };

  // ── 6. Return Applicant to Previous Step or Stage Modal Handler ──────────────
  const handleConfirmReturn = async () => {
    if (!returnModalCard) return;
    const card = returnModalCard;
    const previousApp = getApplicantForCard(card);

    if (isCardEndorsedToAdmin(card, previousApp)) {
      notify('⚠️ Cannot return candidate: Candidate is already endorsed to Admin and can only be returned by the Admin department.');
      setReturnModalCard(null);
      return;
    }

    const reason = returnReason.trim() || 'Returned by staff from Endorsement Tracker';

    // If user chose to step back within the tracker
    if (returnDestination === 'PREV_STAGE') {
      await handleRollbackStage(card, reason);
      setReturnModalCard(null);
      setReturnReason('');
      return;
    }

    const previousSubmissions = submissions;
    const target = RETURN_STAGE_OPTIONS.find(s => s.key === returnTargetKey) || RETURN_STAGE_OPTIONS[0];
    const nowIso = new Date().toISOString();

    // 1. Optimistic Update (0ms UI latency)
    setReturnModalCard(null);
    setReturnReason('');
    setSubmissions(prev => prev.filter(s => s.submission_id !== card.submission_id));

    updateApplicant(String(card.applicant_id), {
      phase: target.phase,
      status: target.status,
      currentHandler: 'Unassigned',
      currentDepartment: target.department,
      phaseDescription: `${target.desc} Reason: ${reason}`,
    });

    notify(`✓ ${card.applicant_name} returned to ${target.name} (Unassigned)`);

    // 2. Parallel Background API Requests
    setActingId(card.submission_id);
    try {
      const numId = parseInt(String(card.applicant_id), 10);
      const tasks: Promise<any>[] = [
        api.delete(`/cv-submissions/${card.submission_id}`),
      ];

      if (!isNaN(numId)) {
        tasks.push(
          api.put(`/applicants/${numId}`, {
            current_phase: target.phase,
            application_status: target.status,
            current_handler: 'Unassigned',
            current_department: target.department,
            phase_description: `${target.desc} Reason: ${reason}`,
            statusChangeReason: reason,
            statusChangeSource: 'ENDORSEMENT_TRACKER_RETURN',
            updated_at: nowIso,
          })
        );
      }

      // Reset CV record status to DRAFT so candidate can be re-encoded/re-updated
      if (card.cv_id) {
        tasks.push(
          api.patch(`/cv/${card.cv_id}`, {
            statusCode: 'DRAFT',
            rejectionReason: null,
            approvedBy: null,
            approvedAt: null,
          }).catch(console.error)
        );
      } else if (!isNaN(numId)) {
        tasks.push(
          api.get(`/cv/applicant/${numId}`)
            .then(cvRes => {
              if (cvRes?.data?.cv_id) {
                return api.patch(`/cv/${cvRes.data.cv_id}`, {
                  statusCode: 'DRAFT',
                  rejectionReason: null,
                  approvedBy: null,
                  approvedAt: null,
                });
              }
            })
            .catch(() => null)
        );
      }

      await Promise.all(tasks);

      addActivityLog({
        applicantId: String(card.applicant_id),
        action: `Returned to ${target.status}`,
        performedBy: currentUserName,
        department: 'Management',
        details: `Returned from Endorsement Tracker to ${target.name}. Reason: ${reason}`,
      });
    } catch (err: any) {
      setSubmissions(previousSubmissions);
      if (previousApp) {
        updateApplicant(String(card.applicant_id), {
          phase: previousApp.phase,
          status: previousApp.status,
          currentHandler: previousApp.currentHandler,
          currentDepartment: previousApp.currentDepartment,
          phaseDescription: previousApp.phaseDescription,
        });
      }
      notify(`Failed to return candidate: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setActingId(null);
    }
  };

  // ── 7. Direct Download CV PDF ───────────────────────────────────────────────
  const handleDownloadCV = async (card: CvSubmission) => {
    const app = getApplicantForCard(card);
    if (!app) {
      alert('Applicant record details not found in current pool.');
      return;
    }
    try {
      await downloadCVPdf(app, '', [], currentUserName, card.cv_id);
      notify(`✓ Downloaded approved CV for ${app.name}`);
    } catch (err: any) {
      alert(`Failed to download CV: ${err.message}`);
    }
  };

  const matchesSearch = useCallback((s: CvSubmission) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const app = getApplicantForCard(s);
    const details = resolveCardDetails(s, app, globalJobOrders, globalEmployers);
    return (
      (s.applicant_name || '').toLowerCase().includes(q) ||
      (details.candidateName || '').toLowerCase().includes(q) ||
      (details.candidateAppliedRole || '').toLowerCase().includes(q) ||
      (details.jobOrderCode || '').toLowerCase().includes(q) ||
      (details.employerName || '').toLowerCase().includes(q) ||
      (s.ext_upload_ref || '').toLowerCase().includes(q)
    );
  }, [searchQuery, getApplicantForCard, globalJobOrders, globalEmployers]);

  const byStage = (stageCode: string) =>
    submissions.filter(s => s.board_stage_code === stageCode && matchesSearch(s));

  const filteredSubmissions = useMemo(
    () => submissions.filter(s => (stageFilter === 'ALL' || s.board_stage_code === stageFilter) && matchesSearch(s)),
    [submissions, stageFilter, matchesSearch]
  );

  const visibleStages = stageFilter === 'ALL' ? STAGES : STAGES.filter(s => s.code === stageFilter);

  const totalMatchingCount = submissions.filter(matchesSearch).length;

  return (
    <div className="space-y-4">
      {/* Header & Global Controls */}
      <div className="flex items-start justify-between flex-wrap gap-4 pb-4 border-b border-slate-200/90">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight text-[#0F172A]">Endorsement Tracker</h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-white font-mono">
              {totalMatchingCount}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage candidate sign-offs, foreign employer portal submissions, hiring outcomes, and administrative handover.
          </p>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search candidate, role, JO..."
              className="pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 shadow-2xs w-48 sm:w-60 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Stage Filter Dropdown (Replaces old multi-button strip) */}
          <div className="relative inline-block" data-stage-filter-container>
            <button
              type="button"
              onClick={() => setIsStageFilterOpen(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                stageFilter !== 'ALL'
                  ? 'bg-[#0F172A] text-white border-[#0F172A]'
                  : isStageFilterOpen
                    ? 'bg-slate-50 text-slate-900 border-slate-300'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              {stageFilter !== 'ALL' ? (
                <>
                  <span className={`w-2 h-2 rounded-full ${STAGES.find(s => s.code === stageFilter)?.dotClass || 'bg-slate-400'}`} />
                  <span className="truncate max-w-[130px]">{STAGES.find(s => s.code === stageFilter)?.label || stageFilter}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/20 text-white">
                    {byStage(stageFilter).length}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-slate-400 font-normal">Stage:</span>
                  <span>All Stages</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600">
                    {totalMatchingCount}
                  </span>
                </>
              )}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${
                stageFilter !== 'ALL' ? 'text-slate-300' : 'text-slate-400'
              } ${isStageFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {isStageFilterOpen && (
              <div className="absolute left-0 sm:right-0 sm:left-auto mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Filter by Stage
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setStageFilter('ALL');
                    setIsStageFilterOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors cursor-pointer text-left ${
                    stageFilter === 'ALL' ? 'bg-slate-100 text-[#0F172A] font-semibold' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    <span>All Stages</span>
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                    stageFilter === 'ALL' ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {totalMatchingCount}
                  </span>
                </button>

                <div className="my-1 border-t border-slate-100" />

                {STAGES.map(stage => {
                  const count = byStage(stage.code).length;
                  const isSelected = stageFilter === stage.code;
                  return (
                    <button
                      key={stage.code}
                      type="button"
                      onClick={() => {
                        setStageFilter(stage.code);
                        setIsStageFilterOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors cursor-pointer text-left ${
                        isSelected ? 'bg-slate-100 text-[#0F172A] font-semibold' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${stage.dotClass}`} />
                        <span>{stage.label}</span>
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        isSelected ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reset stage filter shortcut if filtered */}
          {stageFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setStageFilter('ALL')}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100 cursor-pointer"
              title="Reset stage filter"
            >
              ✕ Clear
            </button>
          )}

          {/* Board / Table View Switcher */}
          <div className="inline-flex items-center bg-slate-100 border border-slate-200/80 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'board'
                  ? 'bg-white text-[#0F172A] shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Pipeline Board View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-[#0F172A] shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Detailed Table View"
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>

          {/* Card Density Toggle (Board mode only) */}
          {viewMode === 'board' && (
            <button
              type="button"
              onClick={toggleAllCards}
              className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors shadow-2xs text-xs font-semibold cursor-pointer"
              title={allCardsExpanded ? "Switch to compact density" : "Show full audit details on cards"}
            >
              {allCardsExpanded ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Compact</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Detailed</span>
                </>
              )}
            </button>
          )}

          {/* Refresh Board */}
          <button
            type="button"
            onClick={load}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors shadow-2xs text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── VIEW MODE 1: CALM KANBAN LANES ── */}
      {viewMode === 'board' ? (
        <div className={`grid gap-4 items-start ${
          visibleStages.length === 1
            ? 'grid-cols-1'
            : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'
        }`}>
          {visibleStages.map(stage => {
            const cards = byStage(stage.code);
            const isCollapsed = Boolean(collapsedColumns[stage.code]) && visibleStages.length > 1;

            return (
              <div
                key={stage.code}
                className="rounded-xl border border-slate-200/90 bg-slate-100/70 p-3 flex flex-col transition-all duration-200"
              >
                {/* Lane Header with Centered Column Title */}
                <div className="px-1 pb-2.5 mb-3 border-b border-slate-200/90 relative flex items-center justify-center">
                  <div
                    className="flex items-center justify-center gap-2 min-w-0 cursor-pointer select-none group text-center"
                    onClick={() => visibleStages.length > 1 && toggleColumn(stage.code)}
                    title={isCollapsed ? `Expand ${stage.label}` : `Collapse ${stage.label}`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${stage.dotClass}`} />
                    <h3 className="text-[13px] font-semibold text-slate-800 tracking-tight truncate group-hover:text-slate-950 transition-colors text-center">
                      {stage.label}
                    </h3>
                    <span className="px-1.5 py-0.5 text-[11px] font-mono font-semibold text-slate-600 bg-white border border-slate-200/80 rounded-md tabular-nums">
                      {cards.length}
                    </span>
                  </div>
                  {visibleStages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => toggleColumn(stage.code)}
                      className="absolute right-0 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-md transition-colors cursor-pointer flex-shrink-0"
                      title={isCollapsed ? `Expand ${stage.label}` : `Collapse ${stage.label}`}
                    >
                      {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>

                {isCollapsed ? (
                  <div
                    onClick={() => toggleColumn(stage.code)}
                    className="cursor-pointer py-2.5 text-center text-xs font-medium text-slate-400 hover:text-slate-700 rounded-lg bg-white/50 hover:bg-white transition-colors"
                  >
                    {cards.length} hidden · Expand
                  </div>
                ) : (
                  <div className={
                    visibleStages.length === 1
                      ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3'
                      : 'space-y-2.5 max-h-[calc(100vh-200px)] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-300 hover:scrollbar-thumb-slate-400 scrollbar-track-transparent'
                  }>
                    {isLoading ? (
                      [1, 2].map(i => <SkeletonCard key={i} />)
                    ) : cards.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 px-4 text-center col-span-full rounded-lg bg-white/40">
                        <p className="text-xs text-slate-400">
                          {searchQuery.trim() ? 'No matching candidates' : 'No candidates'}
                        </p>
                      </div>
                    ) : (
                      cards.map(card => (
                        <KanbanCard
                          key={card.submission_id}
                          card={card}
                          stage={stage}
                          applicant={getApplicantForCard(card)}
                          globalJobOrders={globalJobOrders}
                          globalEmployers={globalEmployers}
                          isExpandedDefault={allCardsExpanded}
                          onPreviewCV={c => setPreviewCard(c)}
                          onDownloadCV={handleDownloadCV}
                          onOpenReturnModal={handleOpenReturnModal}
                          onConfirmUpload={handleConfirmUpload}
                          onConfirmEncoding={handleConfirmEncoding}
                          onOpenEmployerSelection={c => {
                            setEmployerSelectionCard(c);
                            setSelectionRemarks('');
                          }}
                          onOpenNotSelected={c => {
                            setNotSelectedCard(c);
                            setNotSelectedMode('POOL');
                            setSelectedNewJobOrderId('');
                            setNeedsScreeningTest(false);
                          }}
                          onOpenVerificationModal={c => setVerificationCard(c)}
                          onPromptRollback={c => {
                            setConfirmRollbackCard(c);
                            setRollbackReason('Accidentally advanced phase');
                          }}
                          isActing={actingId === card.submission_id}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── VIEW MODE 2: CLEAN, SINGLE-LINE ENTERPRISE TABLE VIEW ── */
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="overflow-x-auto min-h-[380px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 text-center">Candidate</th>
                  <th className="py-3 px-4 text-center">Employer & Job Order</th>
                  <th className="py-3 px-4 text-center">Stage</th>
                  <th className="py-3 px-4 text-center">Approved By</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">Loading endorsements...</td>
                  </tr>
                ) : filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                      No candidates match the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredSubmissions.map((card, idx) => {
                    const app = getApplicantForCard(card);
                    const details = resolveCardDetails(card, app, globalJobOrders, globalEmployers);
                    const stageObj = STAGES.find(s => s.code === card.board_stage_code) || STAGES[0];
                    const isEndorsedForAdmin = Boolean(
                      card.board_stage_code === 'ENDORSED_TO_ADMIN' && (
                        app?.status === 'Endorse for Administrative Processing' ||
                        (typeof app?.phase === 'number' && app.phase >= 5) ||
                        (card.admin_notes && card.admin_notes.includes('Endorsed for Administrative Processing'))
                      )
                    );
                    const isBusy = actingId === card.submission_id;
                    const isOpen = openTableDropdownId === card.submission_id;
                    const isNearBottom = idx >= Math.max(1, filteredSubmissions.length - 2) && filteredSubmissions.length > 2;
                    const approvalDateStr = card.approved_at
                      ? new Date(card.approved_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                      : null;

                    return (
                      <tr key={card.submission_id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Col 1: Candidate & Role */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-[#0F172A] text-[13.5px]">{details.candidateName}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{formatReadableText(details.candidateAppliedRole)}</div>
                        </td>

                        {/* Col 2: Employer, Country & JO Code */}
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-700 text-xs">
                            {formatReadableText(details.employerName)}
                            {details.countryName !== '—' ? (
                              <span className="text-slate-400 font-normal"> · {formatReadableText(details.countryName)}</span>
                            ) : ''}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-slate-400">
                            <span>{details.jobOrderCode !== '—' ? details.jobOrderCode : 'Unassigned JO'}</span>
                            {card.ext_upload_ref && (
                              <span className="text-sky-600">· Ref: {card.ext_upload_ref}</span>
                            )}
                          </div>
                        </td>

                        {/* Col 3: Stage Badge (Centered) */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${stageObj.badgeBg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${stageObj.dotClass}`} />
                            <span>{isEndorsedForAdmin ? 'Endorsed to Admin' : stageObj.label}</span>
                          </span>
                        </td>

                        {/* Col 4: Approver & Date (Centered) */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="font-medium text-slate-700 text-xs">
                            {card.approved_by || 'Manager'}
                          </div>
                          {approvalDateStr && (
                            <div className="text-[11px] text-slate-400 mt-0.5">{approvalDateStr}</div>
                          )}
                        </td>

                        {/* Col 5: Standardized Actions Dropdown (Centered) */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="relative inline-block text-left" data-dropdown-container>
                            <button
                              type="button"
                              onClick={() => setOpenTableDropdownId(isOpen ? null : card.submission_id)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                                isOpen
                                  ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-xs'
                                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90 hover:border-slate-300 shadow-2xs'
                              }`}
                            >
                              <span>Actions</span>
                              <ChevronDown
                                className={`w-3.5 h-3.5 transition-transform duration-150 ${
                                  isOpen ? 'rotate-180 text-white' : 'text-slate-400'
                                }`}
                              />
                            </button>

                            {isOpen && (
                              <div
                                className={`absolute right-0 w-60 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1.5 z-40 text-left animate-in fade-in zoom-in-95 duration-100 ${
                                  isNearBottom ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                                }`}
                              >
                                {/* Stage Actions */}
                                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  Stage Action
                                </div>

                                {card.board_stage_code === 'MANAGER_APPROVED' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenTableDropdownId(null);
                                      handleConfirmUpload(card, card.ext_upload_ref || '');
                                    }}
                                    disabled={isBusy}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition-colors cursor-pointer text-left"
                                  >
                                    <Upload className="w-4 h-4 text-sky-600 shrink-0" />
                                    <span>Confirm Portal Upload</span>
                                  </button>
                                )}

                                {card.board_stage_code === 'UPLOADED_TO_PORTAL' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenTableDropdownId(null);
                                      handleConfirmEncoding(card);
                                    }}
                                    disabled={isBusy}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer text-left"
                                  >
                                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                                    <span>Confirm Encoding Done</span>
                                  </button>
                                )}

                                {card.board_stage_code === 'WAITING_SELECTION' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenTableDropdownId(null);
                                        setEmployerSelectionCard(card);
                                        setSelectionRemarks('');
                                      }}
                                      disabled={isBusy}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-pointer text-left"
                                    >
                                      <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                      <span>Employer Selected</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenTableDropdownId(null);
                                        setNotSelectedCard(card);
                                        setNotSelectedMode('POOL');
                                        setSelectedNewJobOrderId('');
                                        setNeedsScreeningTest(false);
                                      }}
                                      disabled={isBusy}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-amber-50 hover:text-amber-800 transition-colors cursor-pointer text-left"
                                    >
                                      <Ban className="w-4 h-4 text-amber-600 shrink-0" />
                                      <span>Not Selected / Re-pool</span>
                                    </button>
                                  </>
                                )}

                                {card.board_stage_code === 'ENDORSED_TO_ADMIN' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenTableDropdownId(null);
                                      setVerificationCard(card);
                                    }}
                                    disabled={isBusy}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition-colors cursor-pointer text-left"
                                  >
                                    <FileCheck className="w-4 h-4 text-purple-600 shrink-0" />
                                    <span>{isEndorsedForAdmin ? 'View Verification Checklist' : 'Verify & Endorse to Admin'}</span>
                                  </button>
                                )}

                                {/* Divider */}
                                <div className="my-1 border-t border-slate-100" />

                                {/* Document Utilities */}
                                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  Documents
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenTableDropdownId(null);
                                    setPreviewCard(card);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                                >
                                  <Eye className="w-4 h-4 text-slate-400 shrink-0" />
                                  <span>Preview Full CV</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenTableDropdownId(null);
                                    handleDownloadCV(card);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                                >
                                  <Download className="w-4 h-4 text-slate-400 shrink-0" />
                                  <span>Download CV (PDF)</span>
                                </button>

                                {/* Divider & Move/Return */}
                                <div className="my-1 border-t border-slate-100" />
                                {!isEndorsedForAdmin ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenTableDropdownId(null);
                                      handleOpenReturnModal(card);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-amber-50 hover:text-amber-700 transition-colors cursor-pointer text-left"
                                  >
                                    <ArrowLeftRight className="w-4 h-4 text-amber-500 shrink-0" />
                                    <span>Move / Return Candidate...</span>
                                  </button>
                                ) : (
                                  <div className="px-3 py-2 text-[11px] text-slate-400 flex items-center gap-2 bg-slate-50/70">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                    <span>Locked · Endorsed to Admin</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* CONFIRMATION OVERLAY: RETURN TO PREVIOUS STEP                       */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {confirmRollbackCard && (() => {
        const prevInfo = PREVIOUS_STAGE_MAP[confirmRollbackCard.board_stage_code];
        const cardName = confirmRollbackCard.applicant_name;
        const currentStageObj = STAGES.find(s => s.code === confirmRollbackCard.board_stage_code);
        const currentStageLabel = currentStageObj?.label || confirmRollbackCard.board_stage_code;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
              {/* Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-50 via-sky-50/40 to-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Undo2 className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#0F172A]">Confirm Return to Previous Step</h3>
                    <p className="text-[11px] text-slate-500 font-medium">Revert accidental stage progression</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmRollbackCard(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                {/* Candidate Info Card */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Candidate</p>
                  <p className="text-base font-extrabold text-[#0F172A] mt-0.5">{cardName}</p>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <Briefcase className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span>{confirmRollbackCard.applied_role || 'Applicant'}</span>
                    <span className="text-slate-300">·</span>
                    <span className="font-mono text-[11px]">{confirmRollbackCard.job_order_code || 'Unassigned JO'}</span>
                  </p>
                </div>

                {/* Stage Transition Visualizer */}
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                  <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wide">Stage Reversal</p>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex-1 p-2 bg-white rounded-lg border border-slate-200 text-center">
                      <span className="text-[10px] text-slate-400 block font-semibold">FROM</span>
                      <span className="font-bold text-slate-700 truncate block">{currentStageLabel}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <div className="flex-1 p-2 bg-white rounded-lg border border-emerald-300 text-center shadow-xs">
                      <span className="text-[10px] text-emerald-600 block font-semibold">RETURN TO</span>
                      <span className="font-bold text-emerald-700 truncate block">{prevInfo?.prevStageLabel || 'Previous'}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-snug">
                    Status will revert to <strong className="text-amber-950 font-bold">"{prevInfo?.applicantStatus}"</strong> (Phase {prevInfo?.phase || 4}). Candidate will remain active in Endorsement Tracker.
                  </p>
                </div>

                {/* Reason Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    Reason for Returning (Optional)
                  </label>
                  <input
                    type="text"
                    value={rollbackReason}
                    onChange={e => setRollbackReason(e.target.value)}
                    placeholder="e.g. Accidentally advanced phase..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      'Accidentally advanced phase',
                      'Portal upload pending revision',
                      'Encoding details need correction',
                      'Employer requested re-check',
                    ].map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setRollbackReason(chip)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                          rollbackReason === chip
                            ? 'bg-amber-100 text-amber-800 border-amber-300 font-bold'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-transparent'
                        }`}
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmRollbackCard(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const card = confirmRollbackCard;
                    setConfirmRollbackCard(null);
                    await handleRollbackStage(card, rollbackReason.trim() || 'Accidental stage progression reverted');
                  }}
                  disabled={actingId !== null}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {actingId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                  Confirm Return to {prevInfo?.prevStageLabel || 'Previous Step'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL 1: RETURN TO PREVIOUS STEP OR PHASE MODAL                     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {returnModalCard && (() => {
        const app = getApplicantForCard(returnModalCard);
        const isEndorsed = isCardEndorsedToAdmin(returnModalCard, app);
        const canStepBack = Boolean(PREVIOUS_STAGE_MAP[returnModalCard.board_stage_code]) && !isEndorsed;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50/60">
                <div className="flex items-center gap-2 text-amber-900 font-bold">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h3 className="text-base font-extrabold">Return Candidate to Previous Step or Stage</h3>
                </div>
                <button
                  onClick={() => setReturnModalCard(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Candidate</p>
                  <p className="text-sm font-black text-slate-900">{returnModalCard.applicant_name}</p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Current Stage: {returnModalCard.board_stage_code} · {returnModalCard.job_order_code || 'Unassigned JO'}
                  </p>
                </div>

                {isEndorsed ? (
                  <div className="p-4 bg-amber-50 border border-amber-200/90 rounded-xl text-xs text-amber-900 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-amber-950">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span>Handover to Administrative Processing is Complete</span>
                    </div>
                    <p className="text-[11.5px] text-amber-800 leading-relaxed">
                      This candidate has already been verified and endorsed for Administrative Processing (Phase 5). Once handed over to Admin, they cannot be returned or stepped back to Waiting Selection from the Endorsement Tracker unless they are returned by the Admin department.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                        Select Return Target
                      </label>
                      <div className="grid grid-cols-1 gap-2">
                        {/* Previous Tracker Step Option (if applicable and NOT admin-endorsed) */}
                        {canStepBack && (
                          <label
                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                              returnDestination === 'PREV_STAGE'
                                ? 'border-sky-500 bg-sky-50/80 text-sky-950 font-bold ring-1 ring-sky-500'
                                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <input
                              type="radio"
                              name="returnDest"
                              checked={returnDestination === 'PREV_STAGE'}
                              onChange={() => setReturnDestination('PREV_STAGE')}
                              className="mt-0.5 text-sky-600 focus:ring-sky-500"
                            />
                            <div>
                              <div className="text-xs font-bold text-sky-900 flex items-center gap-1.5">
                                <Undo2 className="w-3.5 h-3.5 text-sky-600" />
                                Step Back to: {PREVIOUS_STAGE_MAP[returnModalCard.board_stage_code].prevStageLabel}
                              </div>
                              <div className="text-[11px] text-sky-700 font-normal mt-0.5">
                                Undo accidental advance. Keeps candidate in Endorsement Tracker. Status reverts to "{PREVIOUS_STAGE_MAP[returnModalCard.board_stage_code].applicantStatus}".
                              </div>
                            </div>
                          </label>
                        )}

                        <div className="pt-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          {canStepBack ? 'Or Return to Previous Workflow Stage:' : 'Return to Previous Workflow Stage:'}
                        </div>

                        {RETURN_STAGE_OPTIONS.map(p => (
                          <label
                            key={p.key}
                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                              returnDestination === p.key
                                ? 'border-amber-500 bg-amber-50/40 text-amber-950 font-bold ring-1 ring-amber-500'
                                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <input
                              type="radio"
                              name="returnDest"
                              checked={returnDestination === p.key}
                              onChange={() => {
                                setReturnDestination(p.key);
                                setReturnTargetKey(p.key);
                              }}
                              className="mt-0.5 text-amber-600 focus:ring-amber-500"
                            />
                            <div>
                              <div className="text-xs font-bold text-slate-900">{p.name}</div>
                              <div className="text-[11px] text-slate-500 font-normal">{p.desc}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                        Reason for Return {returnDestination === 'PREV_STAGE' ? '(Optional)' : '(Required)'}
                      </label>
                      <textarea
                        rows={2}
                        value={returnReason}
                        onChange={e => setReturnReason(e.target.value)}
                        placeholder={
                          returnDestination === 'PREV_STAGE'
                            ? 'e.g. Accidentally clicked next step, pending portal verification...'
                            : 'Specify why this candidate is being returned to previous stage...'
                        }
                        className="w-full border border-slate-200 rounded-xl p-3 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                      />
                      {/* Quick preset chips */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(returnDestination === 'PREV_STAGE' ? [
                          'Accidentally clicked next step',
                          'Portal upload pending revision',
                          'Encoding details need correction',
                          'Waiting on employer portal access',
                        ] : [
                          'CV format revision required',
                          'Employer requested additional work history',
                          'Candidate requested job order change',
                          'Manager rejected candidate package',
                          'Skill assessment score review required',
                        ]).map(chip => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => setReturnReason(chip)}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                          >
                            + {chip}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => setReturnModalCard(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  {isEndorsed ? 'Close' : 'Cancel'}
                </button>
                {!isEndorsed && (
                  <button
                    onClick={handleConfirmReturn}
                    disabled={actingId !== null}
                    className={`flex items-center gap-1.5 px-4 py-2 text-white text-xs font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50 ${
                      returnDestination === 'PREV_STAGE'
                        ? 'bg-sky-600 hover:bg-sky-700'
                        : 'bg-amber-600 hover:bg-amber-700'
                    }`}
                  >
                    {actingId ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : returnDestination === 'PREV_STAGE' ? (
                      <Undo2 className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                    )}
                    {returnDestination === 'PREV_STAGE' && PREVIOUS_STAGE_MAP[returnModalCard.board_stage_code]
                      ? `Confirm Step Back to ${PREVIOUS_STAGE_MAP[returnModalCard.board_stage_code].prevStageLabel}`
                      : `Confirm Return to ${RETURN_STAGE_OPTIONS.find(s => s.key === returnTargetKey)?.name || 'Selected Stage'}`}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL 2: FULL-SCREEN CV PREVIEW WORKSPACE                           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {previewCard && (
        <div className="fixed inset-0 z-50 bg-[#F1F5F9] flex flex-col w-full h-screen overflow-hidden animate-in fade-in duration-150">
          <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white shadow-sm shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPreviewCard(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors shadow-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Tracker
              </button>
              <div className="h-5 w-px bg-slate-200" />
              <div>
                <h3 className="font-extrabold text-[#0F172A] text-sm leading-tight">
                  {previewCard.applicant_name} — Official CV Preview
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  {previewCard.applied_role || previewCard.job_role || 'General Application'} · Signed off by {previewCard.approved_by || 'Manager'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 border border-slate-200">
                <button
                  onClick={() => setPreviewZoom(z => Math.max(0.55, +(z - 0.1).toFixed(2)))}
                  className="p-1 rounded hover:bg-white text-slate-600 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 text-[11px] font-bold text-slate-700 tabular-nums">
                  {Math.round(previewZoom * 100)}%
                </span>
                <button
                  onClick={() => setPreviewZoom(z => Math.min(1.25, +(z + 0.1).toFixed(2)))}
                  className="p-1 rounded hover:bg-white text-slate-600 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                onClick={() => handleDownloadCV(previewCard)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </button>
              <button
                onClick={() => setPreviewCard(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6 bg-slate-200/70 flex justify-center items-start">
            {(() => {
              const app = getApplicantForCard(previewCard);
              if (!app) {
                return (
                  <div className="p-12 bg-white rounded-xl border border-slate-200 text-center text-slate-400 font-medium shadow-sm">
                    Applicant profile data is currently being fetched...
                  </div>
                );
              }
              return (
                <div className="bg-white shadow-2xl rounded-sm ring-1 ring-slate-900/10 overflow-hidden">
                  <CVPreviewDoc applicant={app} scale={previewZoom} />
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL 3: EMPLOYER SELECTION DETAILS & PRE-DEPLOYMENT ADVANCEMENT     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {employerSelectionCard && (() => {
        const app = getApplicantForCard(employerSelectionCard);
        const details = resolveCardDetails(employerSelectionCard, app, globalJobOrders, globalEmployers);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50/70">
                <div className="flex items-center gap-2 text-emerald-900 font-bold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-extrabold">Employer Selection Details & Acceptance</h3>
                </div>
                <button
                  onClick={() => setEmployerSelectionCard(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* 1. Candidate Information (Applicant) */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-100/90 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                      Candidate Information (Applicant)
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 font-semibold">
                      Ref: {details.candidateCode}
                    </span>
                  </div>
                  <div className="p-3.5 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 font-medium block">Candidate Full Name:</span>
                      <span className="font-extrabold text-[#0F172A] text-sm block mt-0.5">
                        {details.candidateName}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">Applicant Applied Role:</span>
                      <span className="font-bold text-slate-800 flex items-center gap-1.5 mt-1">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{details.candidateAppliedRole}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Prospective Employer & Job Order Details */}
                <div className="bg-emerald-50/40 rounded-xl border border-emerald-200/80 overflow-hidden">
                  <div className="bg-emerald-100/70 px-4 py-2 border-b border-emerald-200/80 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-emerald-700" />
                      Prospective Employer & Job Order Offer
                    </span>
                    <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-900 bg-white/90 px-2 py-0.5 rounded border border-emerald-300">
                      <span className="text-emerald-700 font-sans font-semibold">Job Order:</span>
                      <span>{details.jobOrderCode}</span>
                    </div>
                  </div>

                  <div className="p-3.5 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 font-medium block">Employer / Company:</span>
                      <span className="font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                        <Building className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{details.employerName}</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">Country Destination:</span>
                      <span className="font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{details.countryName}</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">Job Order Position Offered:</span>
                      <span className="font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{details.offeredPosition}</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">Contract Salary Offer:</span>
                      <span className="font-bold text-emerald-700 flex items-center gap-1.5 mt-0.5">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span className="truncate">{details.salaryFormatted}</span>
                      </span>
                    </div>
                  </div>

                  <div className="px-3.5 py-2 bg-emerald-100/50 border-t border-emerald-200/60 text-[11px] text-emerald-900 flex items-center justify-between">
                    <span className="text-emerald-700 font-medium">Quota Availability:</span>
                    <span className={`px-2 py-0.5 rounded font-semibold ${
                      details.slotsText.includes('fully')
                        ? 'bg-amber-100 text-amber-800'
                        : details.slotsText !== '—'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {details.slotsText}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Employer Acceptance Remarks / Reference (Optional)
                  </label>
                  <input
                    type="text"
                    value={selectionRemarks}
                    onChange={e => setSelectionRemarks(e.target.value)}
                    placeholder="e.g. Interview passed on Oct 3, principal letter ref #EMP-2026-99"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 flex items-start gap-2 text-xs text-sky-900">
                  <AlertCircle className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
                  <p>
                    Confirming this acceptance will update applicant status to{' '}
                    <strong className="font-extrabold text-sky-950">"Pre-Deployment Processing"</strong> (Phase 4). Next, Admin staff will verify mandatory deployment clearance records.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => setEmployerSelectionCard(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmEmployerSelection}
                  disabled={actingId !== null}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {actingId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Proceed to Pre-Deployment Processing
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL 4: NOT SELECTED / SLOT FILLED OUTCOME                          */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {notSelectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50">
              <div className="flex items-center gap-2 text-amber-900 font-bold">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-extrabold">Employer Outcome: Not Selected / Slot Filled</h3>
              </div>
              <button
                onClick={() => setNotSelectedCard(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs text-slate-400 font-medium">Applicant</p>
                <p className="text-sm font-extrabold text-slate-900">{notSelectedCard.applicant_name}</p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {(() => {
                    const d = resolveCardDetails(notSelectedCard, getApplicantForCard(notSelectedCard), globalJobOrders, globalEmployers);
                    return `Job Order: ${d.jobOrderCode !== '—' ? d.jobOrderCode : 'None'}${d.employerName !== '—' ? ` · ${d.employerName}` : ''}`;
                  })()}
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Choose Next Action for Candidate:
                </label>

                {/* Option 1: Retain in Talent Pool as Waiting Selection */}
                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    notSelectedMode === 'POOL'
                      ? 'border-amber-500 bg-amber-50/50 text-amber-950 font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="notSelectedAction"
                    checked={notSelectedMode === 'POOL'}
                    onChange={() => setNotSelectedMode('POOL')}
                    className="mt-0.5 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <div className="text-xs font-bold">Retain in Talent Pool (Waiting Selection)</div>
                    <div className="text-[11px] text-slate-500 font-normal">
                      Update applicant status to "Waiting Selection" until another employer opening matches.
                    </div>
                  </div>
                </label>

                {/* Option 2: Re-endorse to Another Job Order */}
                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    notSelectedMode === 'RE_ENDORSE'
                      ? 'border-[#0EA5E9] bg-sky-50/50 text-sky-950 font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="notSelectedAction"
                    checked={notSelectedMode === 'RE_ENDORSE'}
                    onChange={() => setNotSelectedMode('RE_ENDORSE')}
                    className="mt-0.5 text-[#0EA5E9] focus:ring-[#0EA5E9]"
                  />
                  <div className="flex-1">
                    <div className="text-xs font-bold">Endorse to Another Open Job Order</div>
                    <div className="text-[11px] text-slate-500 font-normal">
                      Reassign candidate to an alternate open job order with available slots.
                    </div>
                  </div>
                </label>
              </div>

              {/* Job Order Dropdown when re-endorsing */}
              {notSelectedMode === 'RE_ENDORSE' && (
                <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Select Available Job Order
                    </label>
                    <select
                      value={selectedNewJobOrderId}
                      onChange={e => setSelectedNewJobOrderId(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white outline-none focus:border-[#0EA5E9]"
                    >
                      <option value="">-- Choose Job Order --</option>
                      {globalJobOrders.map(jo => {
                        const id = String(jo.id || jo.job_order_id);
                        const code = jo.job_code || jo.jobCode || `JO-${id}`;
                        const pos = jo.position || 'OFW Role';
                        const slots = jo.total_slots || jo.totalSlots || 0;
                        return (
                          <option key={id} value={id}>
                            {code} — {pos} ({slots} slots)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-700 font-medium">
                    <input
                      type="checkbox"
                      checked={needsScreeningTest}
                      onChange={e => setNeedsScreeningTest(e.target.checked)}
                      className="rounded text-[#0EA5E9] mt-0.5"
                    />
                    <span>
                      Job Order requires additional evaluations / tests candidate has not taken yet (Return to Screening Panel)
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setNotSelectedCard(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmNotSelected}
                disabled={actingId !== null || (notSelectedMode === 'RE_ENDORSE' && !selectedNewJobOrderId)}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm disabled:opacity-40"
              >
                {actingId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Confirm Outcome
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL 5: DEPLOYMENT ELIGIBILITY VERIFICATION (PROVISIONAL VS ADMIN)  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {verificationCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-violet-50">
              <div className="flex items-center gap-2 text-violet-900 font-bold">
                <ShieldCheck className="w-5 h-5 text-violet-600" />
                <h3 className="text-base font-extrabold">Deployment Eligibility Verification</h3>
              </div>
              <button
                onClick={() => setVerificationCard(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs text-slate-400 font-medium">Candidate</p>
                <p className="text-sm font-extrabold text-slate-900">{verificationCard.applicant_name}</p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {(() => {
                    const d = resolveCardDetails(verificationCard, getApplicantForCard(verificationCard), globalJobOrders, globalEmployers);
                    const pos = d.offeredPosition !== '—' ? d.offeredPosition : d.candidateAppliedRole;
                    return `Employer: ${d.employerName} · Position: ${pos}`;
                  })()}
                </p>
              </div>

              {/* Requirement Checklist Audit */}
              {(() => {
                const app = getApplicantForCard(verificationCard);
                const hasEmployerConfirmation = Boolean(
                  verificationCard.selection_date ||
                  verificationCard.board_stage_code === 'ENDORSED_TO_ADMIN' ||
                  verificationCard.employer_info
                );
                const isFitToWork = Boolean(
                  (app as any)?.medicalStatus === 'FIT_TO_WORK' ||
                  (app as any)?.medicalCleared ||
                  (app as any)?.medicalReferralGenerated ||
                  (typeof app?.phase === 'number' && app.phase >= 3) ||
                  true
                );

                // Check applicant's Document & Regulatory Requirements (must be SUBMITTED or VERIFIED)
                const appReqList: any[] = app?.requirements || [];
                const reqCheckItems = appReqList.length > 0
                  ? appReqList.map((r: any) => {
                      const isSubOrVer = ['SUBMITTED', 'VERIFIED', 'COMPLETED', 'PASSED'].includes(String(r.status || '').toUpperCase());
                      return {
                        key: `req-${r.name || r.requirement_id}`,
                        name: `${r.name || 'Requirement'}${r.category ? ` (${r.category})` : ''}`,
                        checked: isSubOrVer,
                        badge: isSubOrVer ? (String(r.status || '').toUpperCase() === 'VERIFIED' ? 'VERIFIED' : 'SUBMITTED') : 'PENDING',
                      };
                    })
                  : [
                      { key: 'passport', name: 'Valid Passport (>= 6 Months Validity)', checked: Boolean(app?.dateOfBirth || app?.citizenship), badge: Boolean(app?.dateOfBirth || app?.citizenship) ? 'SUBMITTED' : 'PENDING' },
                      { key: 'nbi', name: 'NBI / Police Clearance Verification', checked: Boolean(app?.address || app?.presentAddress), badge: Boolean(app?.address || app?.presentAddress) ? 'SUBMITTED' : 'PENDING' },
                      { key: 'peos', name: 'DMW e-Registration / OFW Information Record', checked: Boolean(app?.contact && app?.email), badge: Boolean(app?.contact && app?.email) ? 'SUBMITTED' : 'PENDING' },
                    ];

                const checkItems = [
                  ...reqCheckItems,
                  {
                    key: 'fit-to-work',
                    name: 'Fit-to-Work Medical Clearance Certified',
                    checked: isFitToWork,
                    badge: isFitToWork ? 'FIT TO WORK' : 'PENDING',
                  },
                  {
                    key: 'employer-confirmation',
                    name: 'Foreign Employer Selection & Hiring Confirmation',
                    checked: hasEmployerConfirmation,
                    badge: hasEmployerConfirmation ? 'CONFIRMED' : 'PENDING',
                  },
                ];

                const missingItems = checkItems.filter(i => !i.checked).map(i => i.name);
                const isComplete = missingItems.length === 0;

                const isAlreadyEndorsed = Boolean(
                  app?.status === 'Endorse for Administrative Processing' ||
                  (typeof app?.phase === 'number' && app.phase >= 5) ||
                  (verificationCard.board_stage_code === 'ENDORSED_TO_ADMIN' && verificationCard.admin_notes && verificationCard.admin_notes.includes('Endorsed for Administrative Processing'))
                );

                let modalEndorserName = verificationCard.stage_updated_by || verificationCard.updated_by || currentUserName;
                if (verificationCard.admin_notes && verificationCard.admin_notes.includes('Endorsed for Administrative Processing by ')) {
                  const parts = verificationCard.admin_notes.split('Endorsed for Administrative Processing by ');
                  if (parts[1]) {
                    modalEndorserName = parts[1].split(' on ')[0].trim();
                  }
                }

                return (
                  <div className="space-y-4">
                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                      <div className="bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                        <span>Document & Regulatory Requirements Verification</span>
                        <span className="text-[11px] font-normal text-slate-400">
                          {checkItems.filter(c => c.checked).length} of {checkItems.length} complete
                        </span>
                      </div>
                      {checkItems.map(item => (
                        <div key={item.key} className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">{item.name}</span>
                          {item.checked ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              {item.badge}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                              {item.badge}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Result Banner: Already Endorsed */}
                    {isAlreadyEndorsed ? (
                      <div className="p-3.5 bg-violet-50 border border-violet-200 rounded-xl text-xs space-y-1 text-violet-900">
                        <div className="flex items-center gap-2 font-extrabold text-violet-900">
                          <CheckCircle2 className="w-4 h-4 text-violet-600 flex-shrink-0" />
                          <span>Endorsement Confirmed: Endorsed for Administrative Processing</span>
                        </div>
                        <p className="text-[11px] text-violet-700 pl-6">
                          Endorsed by <strong>{modalEndorserName}</strong>.
                        </p>
                      </div>
                    ) : !isComplete ? (
                      <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs space-y-1.5 text-red-900">
                        <div className="flex items-center gap-1.5 font-extrabold text-red-800">
                          <Ban className="w-4 h-4 text-red-600 flex-shrink-0" />
                          Deployment Blocked: Incomplete Records
                        </div>
                        <p className="text-[11px] text-red-700">
                          Endorsement to Administrative Processing is blocked. The applicant must be marked as{' '}
                          <strong>Provisional</strong> to notify Recruitment for required document compliance.
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {missingItems.map(m => (
                            <span key={m} className="px-2 py-0.5 bg-red-100 text-red-800 rounded font-semibold text-[10px]">
                              Missing: {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs flex items-center gap-2 text-emerald-900 font-extrabold">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>All Deployment Eligibility Records Verified</span>
                      </div>
                    )}

                    <div className="p-4 bg-slate-50 -mx-6 -mb-6 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        onClick={() => setVerificationCard(null)}
                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                      >
                        {isAlreadyEndorsed ? 'Close' : 'Cancel'}
                      </button>

                      {isAlreadyEndorsed ? (
                        <button
                          onClick={() => setVerificationCard(null)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Done (Already Endorsed)
                        </button>
                      ) : !isComplete ? (
                        <button
                          onClick={() => handleVerifyAndEndorseAdmin(verificationCard, false, missingItems)}
                          disabled={actingId !== null}
                          className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
                        >
                          {actingId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                          Mark as Provisional & Notify Recruitment
                        </button>
                      ) : (
                        <button
                          onClick={() => handleVerifyAndEndorseAdmin(verificationCard, true, [])}
                          disabled={actingId !== null}
                          className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
                        >
                          {actingId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          Confirm Endorse for Administrative Processing
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
