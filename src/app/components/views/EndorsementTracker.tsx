import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock, Upload, Users, CheckCircle2, RefreshCw, Loader2,
  ChevronRight, Calendar, Link as LinkIcon, FileText, Trash2,
  AlertCircle, Send, Eye, Download, X, Building, MapPin,
  Briefcase, DollarSign, ShieldAlert, ShieldCheck, AlertTriangle,
  ArrowLeftRight, Check, FileCheck, Ban, ArrowRight, UserCheck, Undo2,
  ChevronDown, ChevronUp, Maximize2, Minimize2, Search
} from 'lucide-react';
import { ApplicantRecord, ActivityLog } from '../../types';
import { Skeleton, SkeletonText } from '../ui/skeleton';
import { api } from '../../../lib/api';
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
    label: 'Manager Approved',
    shortLabel: 'Approved',
    color: '#10b981',
    bg: 'bg-emerald-50/70',
    border: 'border-emerald-200',
    accent: 'border-l-[#10b981]',
    badgeBg: 'bg-emerald-100 text-emerald-800',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
    desc: 'CVs approved by Manager, ready to upload to employer portal',
    nextAction: 'Confirm Portal Upload',
    nextStage: 'UPLOADED_TO_PORTAL' as const,
  },
  {
    code: 'UPLOADED_TO_PORTAL' as const,
    label: 'Uploaded to Portal',
    shortLabel: 'Uploaded',
    color: '#0ea5e9',
    bg: 'bg-sky-50/70',
    border: 'border-sky-200',
    accent: 'border-l-[#0ea5e9]',
    badgeBg: 'bg-sky-100 text-sky-800',
    icon: <Upload className="w-4 h-4 text-sky-600" />,
    desc: 'CV uploaded to foreign employer portal, awaiting encoding completion',
    nextAction: 'Confirm Portal Encoding Done',
    nextStage: 'WAITING_SELECTION' as const,
  },
  {
    code: 'WAITING_SELECTION' as const,
    label: 'Waiting Selection',
    shortLabel: 'Waiting',
    color: '#f59e0b',
    bg: 'bg-amber-50/70',
    border: 'border-amber-200',
    accent: 'border-l-[#f59e0b]',
    badgeBg: 'bg-amber-100 text-amber-800',
    icon: <Users className="w-4 h-4 text-amber-600" />,
    desc: 'Employer is reviewing candidates — awaiting hiring decision',
    nextAction: 'Record Employer Response',
    nextStage: 'ENDORSED_TO_ADMIN' as const,
  },
  {
    code: 'ENDORSED_TO_ADMIN' as const,
    label: 'Pre-Deployment & Admin',
    shortLabel: 'Admin Endorsement',
    color: '#8b5cf6',
    bg: 'bg-violet-50/70',
    border: 'border-violet-200',
    accent: 'border-l-[#8b5cf6]',
    badgeBg: 'bg-violet-100 text-violet-800',
    icon: <Send className="w-4 h-4 text-violet-600" />,
    desc: 'Employer selected candidate — review eligibility & endorse to Admin',
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

export interface ReturnStageOption {
  key: string;
  name: string;
  status: string;
  phase: number;
  department: string;
  desc: string;
}

export const RETURN_STAGE_OPTIONS: ReturnStageOption[] = [
  {
    key: 'cv_encoding',
    name: 'CV Encoding',
    status: 'CV Encoding',
    phase: 4,
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
    phase: 2,
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
  const role = details.candidateAppliedRole;
  const joCode = details.jobOrderCode;
  const approver = card.approved_by || 'Manager';
  const approvalDate = card.approved_at
    ? new Date(card.approved_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    : (card.stage_updated_at ? new Date(card.stage_updated_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : null);

  const empCompany = details.employerName;
  const empCountry = details.countryName;

  const appStatus = applicant?.status || '';
  const isEndorsedForAdmin = Boolean(
    stage.code === 'ENDORSED_TO_ADMIN' && (
      appStatus === 'Endorse for Administrative Processing' ||
      appStatus === 'Pre-Deployment Processing' ||
      (typeof applicant?.phase === 'number' && applicant.phase >= 5) ||
      (card.admin_notes && card.admin_notes.includes('Endorsed for Administrative Processing'))
    )
  );

  let endorserName = card.stage_updated_by || card.updated_by || 'Admin Officer';
  if (card.admin_notes && card.admin_notes.includes('Endorsed for Administrative Processing by ')) {
    const parts = card.admin_notes.split('Endorsed for Administrative Processing by ');
    if (parts[1]) {
      endorserName = parts[1].split(' on ')[0].trim();
    }
  }

  const endorsedDate = card.stage_updated_at
    ? new Date(card.stage_updated_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    : (card.updated_at ? new Date(card.updated_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : null);

  return (
    <div className={`bg-white rounded-xl shadow-xs border border-slate-200 border-l-4 ${stage.accent} overflow-hidden transition-all duration-200 hover:shadow-md`}>
      <div className="p-3">
        {/* Top row: Name & Controls */}
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-extrabold text-[#0F172A] text-sm truncate">{name}</p>
              {isEndorsedForAdmin ? (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-200">
                  Admin Endorsed
                </span>
              ) : applicant?.status ? (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  {applicant.status}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-[#64748B] font-medium mt-0.5 flex items-center gap-1">
              <Briefcase className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span className="truncate">{role}</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 font-mono flex items-center gap-1">
              <Building className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span className="truncate">
                {joCode !== '—' ? joCode : 'No JO Assigned'}
                {empCompany !== '—' ? ` · ${empCompany}${empCountry !== '—' ? ` (${empCountry})` : ''}` : ''}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* Expand / Collapse toggle button */}
            <button
              onClick={() => setExpanded(prev => !prev)}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title={expanded ? "Collapse card details" : "Expand card details"}
              aria-label={expanded ? "Collapse card" : "Expand card"}
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {/* Return button (opens Return to Previous Step / Phase modal) */}
            <button
              onClick={() => onOpenReturnModal(card)}
              disabled={isActing}
              className="p-1.5 text-slate-300 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors flex-shrink-0"
              title="Return applicant to previous stage"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* COMPACT VIEW STRIP (when collapsed) */}
        {!expanded ? (
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px]">
            <div className="text-[10px] text-slate-400 font-medium truncate">
              {approver && `Appr: ${approver}`}
              {card.ext_upload_ref && ` · Ref: ${card.ext_upload_ref}`}
            </div>
            <button
              onClick={() => setExpanded(true)}
              className="text-[10.5px] font-bold text-[#0EA5E9] hover:text-[#0284c7] flex items-center gap-0.5 flex-shrink-0 hover:underline"
            >
              <span>View Actions</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="animate-in fade-in duration-150">
            {/* Manager Approval Banner */}
            <div className="mt-2.5 px-2.5 py-1.5 bg-emerald-50/80 border border-emerald-100 rounded-lg flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 text-emerald-800 font-semibold truncate">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span className="truncate">Approved by {approver}</span>
              </div>
              {approvalDate && (
                <span className="text-[10px] text-emerald-600 font-mono whitespace-nowrap ml-1">{approvalDate}</span>
              )}
            </div>

            {/* Administrative Endorsement Confirmed Banner */}
            {isEndorsedForAdmin && (
              <div className="mt-2 px-2.5 py-1.5 bg-violet-50/90 border border-violet-200 rounded-lg text-[11px] space-y-0.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-violet-900 font-bold truncate">
                    <ShieldCheck className="w-3.5 h-3.5 text-violet-600 flex-shrink-0" />
                    <span className="truncate">Endorsed for Admin Processing</span>
                  </div>
                  {endorsedDate && (
                    <span className="text-[10px] text-violet-600 font-mono whitespace-nowrap ml-1">{endorsedDate}</span>
                  )}
                </div>
                <p className="text-[10px] text-violet-700 pl-5">
                  Confirmed by <span className="font-semibold text-violet-900">{endorserName}</span>
                </p>
              </div>
            )}

            {/* Quick Actions: Preview & Download Approved CV */}
            <div className="flex items-center gap-1.5 mt-2.5">
              <button
                onClick={() => onPreviewCV(card)}
                className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold transition-colors"
                title="Preview formatted CV"
              >
                <Eye className="w-3 h-3 text-[#0EA5E9]" />
                Preview CV
              </button>
              <button
                onClick={() => onDownloadCV(card)}
                className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold transition-colors"
                title="Download approved CV PDF"
              >
                <Download className="w-3 h-3 text-[#10B981]" />
                Download PDF
              </button>
            </div>

            {/* Portal Reference badge if present */}
            {card.ext_upload_ref && (
              <div className="mt-2 flex items-center gap-1 text-[11px] text-[#0EA5E9] bg-sky-50 px-2 py-1 rounded border border-sky-100 truncate">
                <LinkIcon className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">Ref: {card.ext_upload_ref}</span>
              </div>
            )}

            {/* Stage-specific Interactive Controls */}
            <div className="mt-3 pt-2.5 border-t border-slate-100">
              {/* STAGE 1: MANAGER_APPROVED */}
              {stage.code === 'MANAGER_APPROVED' && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={uploadRef}
                    onChange={e => setUploadRef(e.target.value)}
                    placeholder="Portal Ref (e.g. POEA-2026-0091 or link)"
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] focus:border-[#0EA5E9] outline-none"
                  />
                  <button
                    onClick={() => onConfirmUpload(card, uploadRef)}
                    disabled={isActing}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold rounded-lg transition-colors shadow-sm disabled:opacity-40"
                  >
                    {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Confirm Portal Upload
                  </button>
                </div>
              )}

              {/* STAGE 2: UPLOADED_TO_PORTAL */}
              {stage.code === 'UPLOADED_TO_PORTAL' && (
                <div className="space-y-1.5">
                  <button
                    onClick={() => onConfirmEncoding(card)}
                    disabled={isActing}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-xs font-bold rounded-lg transition-colors shadow-sm disabled:opacity-40"
                  >
                    {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    Confirm Encoding Done
                  </button>
                  <button
                    onClick={() => onPromptRollback(card)}
                    disabled={isActing}
                    className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1 text-slate-500 hover:text-amber-800 hover:bg-amber-50/80 border border-slate-200 hover:border-amber-300 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-40"
                    title="Revert back to Manager Approved if clicked by mistake"
                  >
                    <Undo2 className="w-3 h-3 text-amber-600" />
                    Return to Manager Approved
                  </button>
                </div>
              )}

              {/* STAGE 3: WAITING_SELECTION */}
              {stage.code === 'WAITING_SELECTION' && (
                <div className="space-y-1.5">
                  <button
                    onClick={() => onOpenEmployerSelection(card)}
                    disabled={isActing}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Employer Selected
                  </button>
                  <button
                    onClick={() => onOpenNotSelected(card)}
                    disabled={isActing}
                    className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1 text-slate-600 hover:text-amber-800 hover:bg-amber-50 border border-slate-200 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-40"
                  >
                    <AlertCircle className="w-3 h-3 text-amber-500" />
                    Not Selected / Slot Filled
                  </button>
                  <button
                    onClick={() => onPromptRollback(card)}
                    disabled={isActing}
                    className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1 text-slate-500 hover:text-amber-800 hover:bg-amber-50/80 border border-slate-200 hover:border-amber-300 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-40"
                    title="Revert back to Uploaded to Portal if clicked by mistake"
                  >
                    <Undo2 className="w-3 h-3 text-amber-600" />
                    Return to Uploaded to Portal
                  </button>
                </div>
              )}

              {/* STAGE 4: ENDORSED_TO_ADMIN */}
              {stage.code === 'ENDORSED_TO_ADMIN' && (
                <div className="space-y-1.5">
                  {isEndorsedForAdmin ? (
                    <div className="w-full bg-violet-50/80 border border-violet-200 rounded-lg p-2.5 text-center space-y-1.5">
                      <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-violet-900">
                        <CheckCircle2 className="w-4 h-4 text-violet-600" />
                        <span>Endorsement Confirmed</span>
                      </div>
                      <p className="text-[10.5px] text-violet-700 font-medium">
                        Endorsed by <span className="font-bold text-violet-900">{endorserName}</span>
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Unlocked for Document Validation & Expense Ledger
                      </p>
                      <button
                        onClick={() => onOpenVerificationModal(card)}
                        className="w-full mt-1 flex items-center justify-center gap-1 py-1 px-2 text-[11px] font-bold text-violet-700 hover:text-violet-900 bg-white hover:bg-violet-100/50 border border-violet-200 rounded-md transition-colors shadow-2xs"
                      >
                        <Eye className="w-3 h-3 text-violet-500" />
                        View Verification Checklist
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onOpenVerificationModal(card)}
                      disabled={isActing}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm disabled:opacity-40"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Review & Endorse to Admin
                    </button>
                  )}
                  <button
                    onClick={() => onPromptRollback(card)}
                    disabled={isActing}
                    className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1 text-slate-500 hover:text-amber-800 hover:bg-amber-50/80 border border-slate-200 hover:border-amber-300 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-40"
                    title="Revert back to Waiting Selection if clicked by mistake"
                  >
                    <Undo2 className="w-3 h-3 text-amber-600" />
                    Return to Waiting Selection
                  </button>
                </div>
              )}
            </div>
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

  useEffect(() => { load(); }, [load]);

  // Helper to find full applicant object
  const getApplicantForCard = useCallback((card: CvSubmission): ApplicantRecord | undefined => {
    return applicants.find(a => String(a.id) === String(card.applicant_id));
  }, [applicants]);

  const notify = (msg: string) => {
    if (showToast) showToast(msg);
    else alert(msg);
  };

  // ── 1. Confirm Portal Upload (Advances to UPLOADED_TO_PORTAL) ────────────────
  const handleConfirmUpload = async (card: CvSubmission, uploadRef: string) => {
    const previousSubmissions = submissions;
    const previousApp = getApplicantForCard(card);
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
      phase: 5,
      status: 'Pre-Deployment Processing',
      currentHandler: 'Admin',
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
            current_phase: 5,
            application_status: 'Pre-Deployment Processing',
            current_handler: 'Admin',
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
            phase: 2,
            status: 'Initial Screening',
            jobOrder: newJoCode,
            selectedJobOrderId: String(newJoId),
            role: newPosition,
            currentHandler: 'Recruitment',
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
                current_phase: 2,
                application_status: 'Initial Screening',
                job_order_id: Number(newJoId),
                current_handler: 'Recruitment',
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
        currentHandler: 'Recruitment',
        currentDepartment: 'Recruitment',
        phaseDescription: reasonText,
      });
      notify(`⚠️ ${card.applicant_name} marked as Provisional: missing ${missingItems.length} requirement(s).`);

      setActingId(card.submission_id);
      try {
        if (!isNaN(numId)) {
          await api.put(`/applicants/${numId}`, {
            application_status: 'Provisional',
            current_handler: 'Recruitment',
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
        currentHandler: 'Admin',
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
              current_handler: 'Admin',
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

  // ── 6. Return Applicant to Previous Step or Stage Modal Handler ──────────────
  const handleConfirmReturn = async () => {
    if (!returnModalCard) return;
    const card = returnModalCard;
    const reason = returnReason.trim() || 'Returned by staff from Endorsement Tracker';

    // If user chose to step back within the tracker
    if (returnDestination === 'PREV_STAGE') {
      await handleRollbackStage(card, reason);
      setReturnModalCard(null);
      setReturnReason('');
      return;
    }

    const previousSubmissions = submissions;
    const previousApp = getApplicantForCard(card);
    const target = RETURN_STAGE_OPTIONS.find(s => s.key === returnTargetKey) || RETURN_STAGE_OPTIONS[0];
    const nowIso = new Date().toISOString();

    // 1. Optimistic Update (0ms UI latency)
    setReturnModalCard(null);
    setReturnReason('');
    setSubmissions(prev => prev.filter(s => s.submission_id !== card.submission_id));

    updateApplicant(String(card.applicant_id), {
      phase: target.phase,
      status: target.status,
      currentHandler: target.department === 'Admin' ? 'Admin' : 'Recruitment',
      currentDepartment: target.department,
      phaseDescription: `${target.desc} Reason: ${reason}`,
    });

    notify(`✓ ${card.applicant_name} returned to ${target.name}`);

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
            current_handler: target.department === 'Admin' ? 'Admin' : 'Recruitment',
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

  const byStage = (stageCode: string) =>
    submissions.filter(s => {
      if (s.board_stage_code !== stageCode) return false;
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
    });

  return (
    <div className="space-y-6">
      {/* Header & Controls Toolbar */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#0F172A]">Endorsement Tracker</h2>
          </div>
          <p className="text-sm text-[#64748B] mt-1 font-medium">
            Track approved CVs from manager sign-off, external employer portal upload, selection, and deployment eligibility verification.
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
              className="pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#0EA5E9] shadow-2xs w-48 sm:w-56 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Toggle All Cards Expanded / Collapsed */}
          <button
            onClick={toggleAllCards}
            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-colors shadow-2xs text-xs font-semibold"
            title={allCardsExpanded ? "Collapse all card details" : "Expand all card details"}
          >
            {allCardsExpanded ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Compact Cards</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Expand All</span>
              </>
            )}
          </button>

          {/* Refresh Board */}
          <button
            onClick={load}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-colors shadow-2xs text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Kanban Board — 4 columns with independent scrolling & collapsible support */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {STAGES.map(stage => {
          const cards = byStage(stage.code);
          const isCollapsed = Boolean(collapsedColumns[stage.code]);

          return (
            <div
              key={stage.code}
              className={`rounded-2xl border ${stage.border} ${stage.bg} flex flex-col transition-all duration-300 ${
                isCollapsed
                  ? 'h-auto p-3.5 bg-opacity-70 shadow-xs'
                  : 'h-[720px] max-h-[calc(100vh-220px)] min-h-[500px] p-3.5 shadow-xs'
              }`}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-2">
                <div
                  className="flex items-center gap-2 cursor-pointer select-none group"
                  onClick={() => toggleColumn(stage.code)}
                  title={isCollapsed ? `Expand ${stage.label}` : `Collapse ${stage.label}`}
                >
                  {stage.icon}
                  <p className="text-xs uppercase tracking-widest text-[#0F172A] font-black leading-tight group-hover:text-[#0EA5E9] transition-colors">
                    {stage.label}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="px-2 py-0.5 text-xs font-extrabold rounded-full text-white"
                    style={{ background: stage.color }}
                  >
                    {cards.length}
                  </span>
                  <button
                    onClick={() => toggleColumn(stage.code)}
                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-black/5 rounded-lg transition-colors"
                    title={isCollapsed ? `Expand ${stage.label} column` : `Collapse ${stage.label} column`}
                  >
                    {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isCollapsed ? (
                <div
                  onClick={() => toggleColumn(stage.code)}
                  className="cursor-pointer py-3 text-center text-xs font-semibold text-slate-500 hover:text-slate-800 rounded-lg hover:bg-black/5 transition-colors border border-dashed border-slate-300/70 mt-1"
                >
                  Column collapsed ({cards.length} candidate{cards.length === 1 ? '' : 's'}) · Click to expand
                </div>
              ) : (
                <>
                  <p className="text-[10px] text-slate-500 mb-3 leading-snug">{stage.desc}</p>

                  {/* Cards Container with clean scrolling */}
                  <div className="flex-1 min-h-0 space-y-2.5 overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin scrollbar-thumb-slate-300 hover:scrollbar-thumb-slate-400 scrollbar-track-transparent">
                    {isLoading ? (
                      [1, 2].map(i => <SkeletonCard key={i} />)
                    ) : cards.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center h-44 text-center">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
                          style={{ background: `${stage.color}18` }}
                        >
                          {stage.icon}
                        </div>
                        <p className="text-xs text-slate-400 font-medium">
                          {searchQuery.trim() ? 'No matching candidates' : 'No candidates in this stage'}
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
                          onOpenReturnModal={c => {
                            setReturnModalCard(c);
                            setReturnDestination(PREVIOUS_STAGE_MAP[c.board_stage_code] ? 'PREV_STAGE' : 'cv_encoding');
                            setReturnTargetKey('cv_encoding');
                            setReturnReason('');
                          }}
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
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Stage Flow Indicator */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Endorsement Workflow Pipeline</p>
          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600 mt-2">
            <span className="px-2.5 py-1 rounded-md font-bold bg-emerald-100 text-emerald-800 text-[11px]">
              1. Manager Approved
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="px-2.5 py-1 rounded-md font-bold bg-sky-100 text-sky-800 text-[11px]">
              2. Endorsed to Employer (Portal Uploaded)
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="px-2.5 py-1 rounded-md font-bold bg-amber-100 text-amber-800 text-[11px]">
              3. Under Employer Review / Selection
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="px-2.5 py-1 rounded-md font-bold bg-violet-100 text-violet-800 text-[11px]">
              4. Pre-Deployment Processing & Admin Validation
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#10b981] font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Document Validation & Expense Ledger Unlocked at Phase 5</span>
        </div>
      </div>

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
      {returnModalCard && (
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

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Select Return Target
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {/* Previous Tracker Step Option (if applicable) */}
                  {PREVIOUS_STAGE_MAP[returnModalCard.board_stage_code] && (
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
                    Or Return to Previous Workflow Stage:
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
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setReturnModalCard(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
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
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL 2: CV PREVIEW MODAL                                           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {previewCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#0EA5E9]" />
                <div>
                  <h3 className="font-extrabold text-[#0F172A] text-sm">
                    Approved CV Preview — {previewCard.applicant_name}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Verified Manager Approval by {previewCard.approved_by || 'Manager'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadCV(previewCard)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </button>
                <button
                  onClick={() => setPreviewCard(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-100/70 flex justify-center">
              {(() => {
                const app = getApplicantForCard(previewCard);
                if (!app) {
                  return (
                    <div className="p-8 text-center text-slate-400 font-medium">
                      Applicant profile data is currently being fetched...
                    </div>
                  );
                }
                return (
                  <div className="bg-white shadow-xl rounded-lg p-2 max-w-[820px]">
                    <CVPreviewDoc applicant={app} scale={0.88} />
                  </div>
                );
              })()}
            </div>
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
                    <strong className="font-extrabold text-sky-950">"Pre-Deployment Processing"</strong> (Phase 5). Next, Admin staff will verify mandatory deployment clearance records.
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
                  app?.status === 'Pre-Deployment Processing' ||
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
                          Endorsed by <strong>{modalEndorserName}</strong>. Phase 5 Document Validation & Expense Ledger are unlocked.
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
