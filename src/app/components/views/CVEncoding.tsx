import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Lock, Save, Send, Download, Loader2, FileText, Plus, Trash2, ChevronDown,
  ChevronUp, CheckCircle2, Clock, XCircle, AlertCircle, User, Briefcase,
  GraduationCap, Languages, Star, Edit3, RefreshCw, Undo2, Sparkles, RotateCcw
} from 'lucide-react';
import { WorkflowState, ActivityLog, ApplicantRecord } from '../../types';
import InlineApplicantSelector from '../InlineApplicantSelector';
import { Skeleton, SkeletonText, SkeletonAvatar } from '../ui/skeleton';
import { api } from '../../../lib/api';

interface CVEncodingProps {
  workflow: WorkflowState;
  showToast: (message: string) => void;
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  updateApplicant: (applicantId: string, updates: Partial<ApplicantRecord>) => void;
  selectedApplicantId?: string;
  applicants?: ApplicantRecord[];
  onNavigate?: (tab: string) => void;
}

interface CvRecord {
  cv_id: number;
  applicant_id: number;
  agency_id: number;
  job_order_id: number | null;
  status_code: 'DRAFT' | 'PENDING_APPROVAL' | 'REJECTED' | 'APPROVED';
  custom_fields: Record<string, any> | null;
  rejection_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface CustomField {
  key: string;
  value: string;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  DRAFT: {
    label: 'Draft',
    color: '#64748b',
    bg: '#f8fafc',
    icon: <Edit3 className="w-3.5 h-3.5" />,
  },
  PENDING_APPROVAL: {
    label: 'Pending Approval',
    color: '#f59e0b',
    bg: '#fffbeb',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  REJECTED: {
    label: 'Rejected',
    color: '#ef4444',
    bg: '#fef2f2',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
  APPROVED: {
    label: 'Approved',
    color: '#10b981',
    bg: '#ecfdf5',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || STATUS_META.DRAFT;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
      style={{ color: meta.color, background: meta.bg, borderColor: `${meta.color}33` }}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
}

function SectionCard({ title, icon, children, defaultOpen = true }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 text-[#0F172A] font-bold text-sm">
          {icon}
          {title}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

function SkeletonCVLoader() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <SkeletonText className="w-32 h-4" />
          <SkeletonText className="w-full h-3" />
          <SkeletonText className="w-3/4 h-3" />
        </div>
      ))}
    </div>
  );
}

export default function CVEncoding({
  workflow,
  showToast,
  currentUserName,
  addActivityLog,
  updateApplicant,
  selectedApplicantId: initialApplicantId = '',
  applicants = [],
  onNavigate,
}: CVEncodingProps) {
  const [selectedApplicantId, setSelectedApplicantId] = useState(initialApplicantId);
  const [cvRecord, setCvRecord] = useState<CvRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Return to Profiling modal state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnCategory, setReturnCategory] = useState('Trade Skills / Assessment Re-evaluation');
  const [returnNotes, setReturnNotes] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  // Custom fields state
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');

  // Summary override (stored in custom_fields.summary_override)
  const [summaryOverride, setSummaryOverride] = useState('');

  // ── Eligible candidates: Strictly those endorsed for CV Encoding or in Phase 3+ ──
  const eligibleApplicants = useMemo(() => {
    return applicants.filter(a => {
      if (a.isStopped || a.status === 'Processing Stopped') return false;
      const s = String(a.status || '').trim();
      const cvStatuses = [
        'CV Encoding',
        'Pending Manager Approval',
        'CV Approval',
        'CV Approved - Sending to Employer',
        'Under Employer Review',
        'Employer Review',
        'Waiting Selection',
        'Endorse for Administrative Processing',
        'Pre-Deployment Processing',
        'Ready for Deployment',
        'Deployed'
      ];
      if (cvStatuses.includes(s)) return true;
      if (typeof a.phase === 'number' && a.phase >= 3) {
        const nonCvStatuses = [
          'Applicant Registration',
          'Initial Screening',
          'Pending Interview',
          'Review Score for Medical Referral',
          'Medical Clearance',
          'Medical Referral',
          'Provisional'
        ];
        return !nonCvStatuses.includes(s);
      }
      return false;
    });
  }, [applicants]);

  // Keep selected applicant synced with eligible applicants pool
  useEffect(() => {
    if (eligibleApplicants.length > 0) {
      const match = eligibleApplicants.find(a => String(a.id) === String(selectedApplicantId));
      if (!match) {
        setSelectedApplicantId(String(eligibleApplicants[0].id));
      }
    } else if (applicants.length > 0 && selectedApplicantId) {
      const match = eligibleApplicants.find(a => String(a.id) === String(selectedApplicantId));
      if (!match) {
        setSelectedApplicantId('');
      }
    }
  }, [eligibleApplicants, selectedApplicantId, applicants.length]);

  const currentApplicant = eligibleApplicants.find(a => String(a.id) === String(selectedApplicantId))
    || applicants.find(a => String(a.id) === String(selectedApplicantId));

  // Check if module is accessible: phase >= 3 or appropriate status
  const isLocked = !workflow.medicalCleared && !(currentApplicant && (
    (typeof currentApplicant.phase === 'number' && currentApplicant.phase >= 3) ||
    ['CV Encoding', 'Pending Manager Approval', 'CV Approved - Sending to Employer',
      'Under Employer Review', 'Deployed'].includes(currentApplicant.status)
  ));

  const canSubmit = cvRecord && ['DRAFT', 'REJECTED'].includes(cvRecord.status_code) && !isLocked;
  const canSaveDraft = !isLocked && cvRecord?.status_code !== 'APPROVED';

  // ─── Load CV record whenever applicant changes ──────────────────────────────
  const loadCvRecord = useCallback(async (applicantId: string) => {
    if (!applicantId || applicantId === 'new') {
      setCvRecord(null);
      setCustomFields([]);
      setSummaryOverride('');
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.get(`/cv/applicant/${applicantId}`);
      const rec: CvRecord | null = res.data || null;
      setCvRecord(rec);
      if (rec?.custom_fields) {
        // Extract summary_override from custom_fields
        const { summary_override, ...rest } = rec.custom_fields;
        setSummaryOverride(summary_override || '');
        setCustomFields(
          Object.entries(rest).map(([key, value]) => ({ key, value: String(value) }))
        );
      } else {
        setCustomFields([]);
        setSummaryOverride('');
      }
    } catch {
      setCvRecord(null);
      setCustomFields([]);
      setSummaryOverride('');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCvRecord(selectedApplicantId);
  }, [selectedApplicantId, loadCvRecord]);

  // ─── Build custom_fields payload ─────────────────────────────────────────────
  const buildCustomFields = () => {
    const fields: Record<string, any> = {};
    if (summaryOverride.trim()) fields['summary_override'] = summaryOverride.trim();
    customFields.forEach(f => {
      if (f.key.trim()) fields[f.key.trim()] = f.value;
    });
    return Object.keys(fields).length > 0 ? fields : null;
  };

  // ─── Save draft ───────────────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (isSaving || !currentApplicant || isLocked) return;
    setIsSaving(true);
    try {
      const customFieldsPayload = buildCustomFields();
      if (cvRecord) {
        const res = await api.patch(`/cv/${cvRecord.cv_id}`, {
          statusCode: cvRecord.status_code === 'REJECTED' ? 'DRAFT' : cvRecord.status_code,
          customFields: customFieldsPayload,
        });
        setCvRecord(res.data);
      } else {
        const res = await api.post('/cv', {
          applicantId: Number(selectedApplicantId),
          statusCode: 'DRAFT',
          customFields: customFieldsPayload,
        });
        setCvRecord(res.data);
      }
      showToast('✓ CV draft saved');
    } catch (err: any) {
      showToast(`❌ Save failed: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Submit for approval ──────────────────────────────────────────────────────
  const handleSubmitForApproval = async () => {
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const customFieldsPayload = buildCustomFields();
      let rec = cvRecord;

      // Save latest changes first
      if (rec) {
        const saveRes = await api.patch(`/cv/${rec.cv_id}`, {
          statusCode: 'PENDING_APPROVAL',
          customFields: customFieldsPayload,
        });
        rec = saveRes.data;
      } else {
        const createRes = await api.post('/cv', {
          applicantId: Number(selectedApplicantId),
          statusCode: 'PENDING_APPROVAL',
          customFields: customFieldsPayload,
        });
        rec = createRes.data;
      }
      setCvRecord(rec);

      // Update applicant workflow status
      updateApplicant(selectedApplicantId, {
        status: 'Pending Manager Approval',
        currentHandler: 'Management',
        currentDepartment: 'Management',
        phaseDescription: 'CV submitted and awaiting management review',
      });

      // Synchronize with backend applicant table
      const numId = parseInt(selectedApplicantId, 10);
      if (!isNaN(numId) && currentApplicant) {
        await api.put(`/applicants/${numId}`, {
          application_id: currentApplicant.applicationId,
          application_status: 'Pending Manager Approval',
          current_phase: 3,
          current_handler: 'Management',
          current_department: 'Management',
          phase_description: 'CV submitted and awaiting management review',
          statusChangeReason: 'CV encoded and submitted for manager approval',
          statusChangeSource: 'CV_ENCODING',
          updated_at: new Date().toISOString(),
        }).catch(console.error);
      }

      addActivityLog({
        applicantId: selectedApplicantId,
        action: 'CV Submitted for Approval',
        performedBy: currentUserName,
        department: 'Recruitment',
        details: `CV (ID: ${rec!.cv_id}) submitted to management for review.`,
      });

      showToast('✓ CV submitted for manager approval');
    } catch (err: any) {
      showToast(`❌ Submission failed: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Return Candidate to Applicant Profiling ───────────────────────────────
  const handleConfirmReturnToProfiling = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentApplicant || isSubmittingReturn) return;

    if (!returnNotes.trim()) {
      showToast('Please state a reason for returning candidate to profiling.');
      return;
    }

    setIsSubmittingReturn(true);
    const applicantId = String(currentApplicant.id);
    const numericId = parseInt(applicantId, 10);
    const reasonText = `${returnCategory}: ${returnNotes.trim()}`;
    const nowIso = new Date().toISOString();

    try {
      // 1. Update applicant state locally
      updateApplicant(applicantId, {
        status: 'Applicant Profiling',
        phase: 2,
        currentHandler: 'Unassigned Pool',
        currentDepartment: 'Recruitment',
        phaseDescription: `Returned from CV Encoding to Profiling by ${currentUserName}. Note: ${reasonText}`,
      });

      // 2. Persist to Backend Supabase API
      if (!isNaN(numericId)) {
        await api.put(`/applicants/${numericId}`, {
          application_id: currentApplicant.applicationId,
          application_status: 'Applicant Profiling',
          current_phase: 2,
          current_handler: 'Unassigned Pool',
          current_department: 'Recruitment',
          phase_description: `Returned from CV Encoding to Profiling by ${currentUserName}. Note: ${reasonText}`,
          statusChangeReason: `Returned from CV Encoding: ${reasonText}`,
          statusChangeSource: 'CV_ENCODING',
          updated_at: nowIso,
        }).catch(console.error);
      }

      // 3. If CV record exists, update to DRAFT and record return reason in custom_fields
      if (cvRecord) {
        await api.patch(`/cv/${cvRecord.cv_id}`, {
          statusCode: 'DRAFT',
          customFields: {
            ...(cvRecord.custom_fields || {}),
            return_reason: reasonText,
            returned_at: nowIso,
            returned_by: currentUserName,
          },
        }).catch(console.error);
      }

      // 4. Add activity audit log
      addActivityLog({
        applicantId,
        action: 'Returned to Applicant Profiling',
        performedBy: currentUserName,
        department: 'Recruitment',
        details: `Candidate ${currentApplicant.name} returned from CV Encoding to Applicant Profiling by ${currentUserName}. Reason: ${reasonText}`,
      });

      showToast(`↩ ${currentApplicant.name} returned to Applicant Profiling.`);
      setShowReturnModal(false);
      setReturnNotes('');

      // Auto-select next candidate
      const remaining = eligibleApplicants.filter(a => String(a.id) !== applicantId);
      if (remaining.length > 0) {
        setSelectedApplicantId(String(remaining[0].id));
      } else {
        setSelectedApplicantId('');
      }
    } catch (err) {
      console.error('Failed to return candidate to profiling:', err);
      showToast('Error returning candidate to profiling.');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  // ─── Export to PDF (text-selectable via print) ────────────────────────────────
  const handleExportToPDF = async () => {
    if (!currentApplicant || isExporting) return;
    setIsExporting(true);
    try {
      const a = currentApplicant;

      // Build a rich HTML document that browser can print to PDF (text-selectable)
      const employmentRows = (a.employmentHistory || []).map(e =>
        `<tr>
          <td>${e.company}</td>
          <td>${e.position}</td>
          <td>${e.dateStarted} – ${e.isPresent ? 'Present' : e.dateEnded}</td>
          <td>${e.country}</td>
          <td>${e.reasonForLeaving || '—'}</td>
        </tr>`
      ).join('');

      const educationRows = (a.education || []).map(ed =>
        `<tr><td>${ed.level}</td><td>${ed.school}</td><td>${ed.course || '—'}</td><td>${ed.yearGraduated || '—'}</td></tr>`
      ).join('');

      const skillsList = (a.skills || []).map(s => `<li>${s}</li>`).join('');
      const langList = (a.languageRecords || []).map(l =>
        `<li>${l.language} — Spoken: ${l.spokenRating}/5, Written: ${l.writtenRating}/5</li>`
      ).join('');

      const customFieldsRows = cvRecord?.custom_fields
        ? Object.entries(cvRecord.custom_fields)
          .filter(([k]) => k !== 'summary_override')
          .map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${v}</td></tr>`).join('')
        : '';

      const summaryText = summaryOverride.trim()
        || (cvRecord?.custom_fields?.summary_override as string | undefined)
        || `Experienced ${a.role || 'professional'} seeking overseas employment opportunities.`;

      const photoHtml = a.photoUrl
        ? `<img src="${a.photoUrl}" alt="Applicant photo" style="width:100px;height:120px;object-fit:cover;border:2px solid #e2e8f0;border-radius:4px;" />`
        : `<div style="width:100px;height:120px;background:#f1f5f9;border:2px solid #e2e8f0;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#94a3b8;">No Photo</div>`;

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>CV – ${a.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Arial', sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.5; }
  .page { max-width: 800px; margin: 0 auto; padding: 32px 40px; }
  .header { display: flex; gap: 24px; align-items: flex-start; border-bottom: 3px solid #0ea5e9; padding-bottom: 16px; margin-bottom: 20px; }
  .header-info h1 { font-size: 22pt; font-weight: 800; color: #0f172a; }
  .header-info .role { font-size: 12pt; color: #0ea5e9; font-weight: 600; margin-top: 2px; }
  .header-info .meta { font-size: 9pt; color: #64748b; margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; }
  .section { margin-bottom: 18px; }
  .section h2 { font-size: 10pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #0ea5e9; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  th { background: #f8fafc; text-align: left; padding: 5px 8px; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; border-bottom: 1px solid #e2e8f0; }
  td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  ul { padding-left: 16px; }
  li { margin-bottom: 2px; }
  .summary { font-style: italic; color: #475569; }
  .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 9pt; color: #94a3b8; display: flex; justify-content: space-between; }
  .badge { display: inline-block; background: #0ea5e9; color: white; font-size: 9pt; padding: 2px 8px; border-radius: 9999px; margin: 2px; }
  .custom-table td:first-child { font-weight: 600; width: 35%; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    ${photoHtml}
    <div class="header-info">
      <h1>${a.name}</h1>
      <div class="role">${a.role || a.appliedRole || 'N/A'}</div>
      <div class="meta">
        <span>📧 ${a.email || 'N/A'}</span>
        <span>📱 ${a.contact || 'N/A'}</span>
        <span>🎂 ${a.dateOfBirth || 'N/A'}</span>
        <span>⚥ ${a.sex || 'N/A'} · ${a.civilStatus || 'N/A'}</span>
        <span>🏠 ${a.presentAddress || 'N/A'}</span>
        <span>🌏 ${a.citizenship || 'Filipino'}</span>
        <span>📏 ${a.heightCm ? a.heightCm + ' cm' : 'N/A'} · ⚖ ${a.weightKg ? a.weightKg + ' kg' : 'N/A'}</span>
        <span>🗒 Ref: ${a.applicantCode || a.id}</span>
      </div>
    </div>
  </div>

  ${summaryText ? `<div class="section"><h2>Professional Summary</h2><p class="summary">${summaryText}</p></div>` : ''}

  ${(a.skills || []).length > 0 ? `<div class="section"><h2>Key Skills</h2><div>${(a.skills || []).map(s => `<span class="badge">${s}</span>`).join('')}</div></div>` : ''}

  ${employmentRows ? `<div class="section"><h2>Employment History</h2><table><thead><tr><th>Company</th><th>Position</th><th>Period</th><th>Country</th><th>Reason for Leaving</th></tr></thead><tbody>${employmentRows}</tbody></table></div>` : ''}

  ${educationRows ? `<div class="section"><h2>Educational Background</h2><table><thead><tr><th>Level</th><th>School</th><th>Course</th><th>Year</th></tr></thead><tbody>${educationRows}</tbody></table></div>` : ''}

  ${langList ? `<div class="section"><h2>Language Proficiency</h2><ul>${langList}</ul></div>` : ''}

  ${customFieldsRows ? `<div class="section"><h2>Additional Information</h2><table class="custom-table">${customFieldsRows}</table></div>` : ''}

  <div class="footer">
    <span>Prepared by: <strong>${currentUserName}</strong></span>
    <span>Generated: ${new Date().toLocaleString('en-PH')}</span>
    <span>FlowSensus — Confidential</span>
  </div>
</div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;

      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      }

      addActivityLog({
        applicantId: selectedApplicantId,
        action: 'CV Exported to PDF',
        performedBy: currentUserName,
        department: 'Recruitment',
        details: `CV exported for ${a.name}`,
      });
      showToast('✓ CV opened in print dialog — choose "Save as PDF"');
    } finally {
      setIsExporting(false);
    }
  };

  // ─── Add / remove custom field ────────────────────────────────────────────────
  const handleAddCustomField = () => {
    if (!newFieldKey.trim()) return;
    setCustomFields(prev => [...prev, { key: newFieldKey.trim(), value: newFieldValue }]);
    setNewFieldKey('');
    setNewFieldValue('');
  };

  const handleRemoveCustomField = (idx: number) => {
    setCustomFields(prev => prev.filter((_, i) => i !== idx));
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 w-full">
      {/* ── Header ── */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#0F172A]">CV Encoding</h2>
          <p className="text-sm text-[#64748B] mt-1 font-medium">
            Format applicant CVs, add custom fields, and submit for manager approval.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {cvRecord && <StatusBadge status={cvRecord.status_code} />}
          {currentApplicant && (
            <button
              onClick={() => setShowReturnModal(true)}
              disabled={isLocked || isSubmittingReturn}
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Return candidate to Applicant Profiling stage"
            >
              <Undo2 className="w-3.5 h-3.5 text-amber-600" />
              Return to Profiling
            </button>
          )}
          <button
            onClick={handleExportToPDF}
            disabled={!currentApplicant || isExporting}
            className="px-4 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-sm font-bold rounded-lg shadow-md shadow-[#0EA5E9]/20 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export PDF
          </button>
        </div>
      </div>

      {/* ── Applicant Selector / Empty Queue State ── */}
      {eligibleApplicants.length > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Active CV Queue ({eligibleApplicants.length} candidate{eligibleApplicants.length !== 1 ? 's' : ''})
            </span>
            <span className="text-[11px] text-slate-400">
              Showing candidates endorsed from Profiling or at Phase 3+
            </span>
          </div>
          <InlineApplicantSelector
            applicants={eligibleApplicants}
            selectedApplicantId={selectedApplicantId}
            onSelectApplicant={(id) => { setSelectedApplicantId(id); }}
            allowNew={false}
          />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm max-w-xl mx-auto my-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-200 shadow-xs">
            <FileText className="w-7 h-7 text-amber-500" />
          </div>
          <h3 className="text-lg font-extrabold text-[#0F172A] mb-1.5">No Candidates in CV Encoding Queue</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-5 leading-relaxed">
            Candidates only appear here after completing Medical Clearance and being endorsed from the <strong>Applicant Profiling</strong> module.
          </p>
          {onNavigate && (
            <button
              onClick={() => onNavigate('profiling')}
              className="px-4 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs font-bold rounded-lg shadow-md shadow-[#0EA5E9]/20 inline-flex items-center gap-2 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Go to Smart Profiling
            </button>
          )}
        </div>
      )}

      {/* ── Locked overlay ── */}
      {isLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-center gap-3">
          <Lock className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div>
            <p className="font-bold text-amber-800 text-sm">Waiting for Medical Clearance</p>
            <p className="text-xs text-amber-600 mt-0.5">CV encoding is unlocked after the applicant passes Fit-to-Work.</p>
          </div>
        </div>
      )}

      {/* ── Rejection notice ── */}
      {cvRecord?.status_code === 'REJECTED' && cvRecord.rejection_reason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-700 text-sm">CV Rejected by Manager</p>
            <p className="text-sm text-red-600 mt-0.5">{cvRecord.rejection_reason}</p>
            <p className="text-xs text-red-400 mt-1">You may revise and resubmit.</p>
          </div>
        </div>
      )}

      {/* ── Main body ── */}
      {isLoading ? (
        <SkeletonCVLoader />
      ) : !currentApplicant ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-bold text-slate-500">Select an applicant to begin CV encoding</p>
        </div>
      ) : (
        <div className={`space-y-4 ${isLocked ? 'opacity-60 pointer-events-none select-none' : ''}`}>

          {/* ── Profile Preview (read-only pull from live data) ── */}
          <SectionCard title="Personal Information" icon={<User className="w-4 h-4 text-[#0EA5E9]" />}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
              {[
                ['Full Name', currentApplicant.name],
                ['Date of Birth', currentApplicant.dateOfBirth || '—'],
                ['Age', currentApplicant.age || '—'],
                ['Sex', currentApplicant.sex || '—'],
                ['Civil Status', currentApplicant.civilStatus || '—'],
                ['Citizenship', currentApplicant.citizenship || '—'],
                ['Height', currentApplicant.heightCm ? `${currentApplicant.heightCm} cm` : '—'],
                ['Weight', currentApplicant.weightKg ? `${currentApplicant.weightKg} kg` : '—'],
                ['Email', currentApplicant.email || '—'],
                ['Contact', currentApplicant.contact || '—'],
                ['Present Address', currentApplicant.presentAddress || '—'],
                ['Provincial Address', currentApplicant.provincialAddress || '—'],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-[10px] uppercase font-bold text-[#94a3b8] tracking-wide">{label}</p>
                  <p className="font-medium text-[#0F172A] truncate">{val}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-4 flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> Personal data is pulled live from the applicant profile and cannot be edited here.
            </p>
          </SectionCard>

          {/* ── Employment History ── */}
          <SectionCard title="Employment History" icon={<Briefcase className="w-4 h-4 text-[#0EA5E9]" />}>
            {(currentApplicant.employmentHistory || []).length === 0 ? (
              <p className="text-sm text-slate-400 italic">No employment records — add them in the Registration module.</p>
            ) : (
              <div className="space-y-3">
                {(currentApplicant.employmentHistory || []).map((e, idx) => (
                  <div key={idx} className="flex gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#0F172A] text-sm">{e.company}</p>
                      <p className="text-xs text-[#64748B] font-medium">{e.position}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {e.dateStarted} – {e.isPresent ? 'Present' : e.dateEnded} · {e.country}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* ── Education ── */}
          <SectionCard title="Educational Background" icon={<GraduationCap className="w-4 h-4 text-[#0EA5E9]" />} defaultOpen={false}>
            {(currentApplicant.education || []).length === 0 ? (
              <p className="text-sm text-slate-400 italic">No education records on file.</p>
            ) : (
              <div className="space-y-2">
                {(currentApplicant.education || []).map((ed, idx) => (
                  <div key={idx} className="flex gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm">
                    <div>
                      <p className="font-bold text-[#0F172A]">{ed.school}</p>
                      <p className="text-xs text-slate-500">{ed.level} — {ed.course || 'N/A'} · Graduated {ed.yearGraduated || 'N/A'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* ── Skills & Languages ── */}
          <SectionCard title="Skills & Languages" icon={<Star className="w-4 h-4 text-[#0EA5E9]" />} defaultOpen={false}>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-[#475569] uppercase tracking-wide mb-2">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {(currentApplicant.skills || []).length === 0 ? (
                    <span className="text-sm text-slate-400 italic">None on file</span>
                  ) : (
                    (currentApplicant.skills || []).map(s => (
                      <span key={s} className="px-2.5 py-1 bg-[#0EA5E9]/10 text-[#0EA5E9] text-xs font-bold rounded-full">
                        {s}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-[#475569] uppercase tracking-wide mb-2">Languages</p>
                <div className="space-y-1">
                  {(currentApplicant.languageRecords || []).length === 0 ? (
                    <span className="text-sm text-slate-400 italic">None on file</span>
                  ) : (
                    (currentApplicant.languageRecords || []).map((l, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span className="font-medium text-[#0F172A] w-28">{l.language}</span>
                        <span className="text-xs text-slate-500">Spoken {l.spokenRating}/5 · Written {l.writtenRating}/5</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ── Professional Summary (staff override) ── */}
          <SectionCard title="Professional Summary" icon={<FileText className="w-4 h-4 text-[#0EA5E9]" />}>
            <label className="text-xs font-bold text-[#475569] uppercase tracking-wide block mb-2">
              Summary Override <span className="text-slate-400 font-normal normal-case">(optional — leave blank to use auto-generated)</span>
            </label>
            <textarea
              rows={4}
              value={summaryOverride}
              onChange={e => setSummaryOverride(e.target.value)}
              disabled={cvRecord?.status_code === 'APPROVED'}
              placeholder={`Experienced ${currentApplicant.role || 'professional'} seeking overseas employment opportunities...`}
              className="w-full border-2 border-slate-200 px-4 py-2.5 rounded-lg text-sm focus:border-[#0EA5E9] outline-none resize-none disabled:bg-slate-50 disabled:text-slate-400 transition-colors"
            />
          </SectionCard>

          {/* ── Custom Fields ── */}
          <SectionCard title="Custom Fields (Staff-added)" icon={<Plus className="w-4 h-4 text-[#0EA5E9]" />} defaultOpen={false}>
            <p className="text-xs text-slate-500 mb-4">
              Add any employer-specific or agency-specific data not captured in the standard profile.
            </p>

            {customFields.map((field, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-center">
                <input
                  type="text"
                  value={field.key}
                  onChange={e => setCustomFields(prev => prev.map((f, i) => i === idx ? { ...f, key: e.target.value } : f))}
                  disabled={cvRecord?.status_code === 'APPROVED'}
                  placeholder="Field name"
                  className="w-1/3 border-2 border-slate-200 px-3 py-1.5 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
                />
                <input
                  type="text"
                  value={field.value}
                  onChange={e => setCustomFields(prev => prev.map((f, i) => i === idx ? { ...f, value: e.target.value } : f))}
                  disabled={cvRecord?.status_code === 'APPROVED'}
                  placeholder="Value"
                  className="flex-1 border-2 border-slate-200 px-3 py-1.5 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
                />
                <button
                  onClick={() => handleRemoveCustomField(idx)}
                  disabled={cvRecord?.status_code === 'APPROVED'}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            {cvRecord?.status_code !== 'APPROVED' && (
              <div className="flex gap-2 mt-3 items-center border-t border-slate-100 pt-3">
                <input
                  type="text"
                  value={newFieldKey}
                  onChange={e => setNewFieldKey(e.target.value)}
                  placeholder="New field name"
                  className="w-1/3 border-2 border-dashed border-slate-300 px-3 py-1.5 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
                />
                <input
                  type="text"
                  value={newFieldValue}
                  onChange={e => setNewFieldValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddCustomField(); }}
                  placeholder="Value"
                  className="flex-1 border-2 border-dashed border-slate-300 px-3 py-1.5 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
                />
                <button
                  onClick={handleAddCustomField}
                  disabled={!newFieldKey.trim()}
                  className="px-3 py-1.5 bg-[#0EA5E9]/10 text-[#0EA5E9] text-sm font-bold rounded-lg hover:bg-[#0EA5E9]/20 disabled:opacity-40 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </SectionCard>

          {/* ── Actions ── */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              {cvRecord && (
                <button
                  onClick={() => loadCvRecord(selectedApplicantId)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Refresh CV record"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
              {cvRecord && (
                <span className="text-xs text-slate-400">
                  CV #{cvRecord.cv_id} · Last updated: {new Date(cvRecord.updated_at).toLocaleDateString('en-PH')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowReturnModal(true)}
                disabled={isLocked || isSubmittingReturn}
                className="px-4 py-2.5 border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 text-sm font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Return candidate to Applicant Profiling"
              >
                <Undo2 className="w-4 h-4 text-amber-600" />
                Return to Profiling
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={!canSaveDraft || isSaving}
                className="px-5 py-2.5 border-2 border-slate-200 text-[#475569] text-sm font-bold rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-colors cursor-pointer"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Draft
              </button>
              <button
                onClick={handleSubmitForApproval}
                disabled={!canSubmit || isSubmitting}
                className="px-6 py-2.5 bg-[#0EA5E9] text-white text-sm font-bold rounded-lg hover:bg-[#0284C7] shadow-md shadow-[#0EA5E9]/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-colors cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {cvRecord?.status_code === 'REJECTED' ? 'Resubmit for Approval' : 'Submit for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Return to Profiling Modal ── */}
      {showReturnModal && currentApplicant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="px-6 py-4 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-amber-900">
                <Undo2 className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="font-extrabold text-base">Return Candidate to Profiling</h3>
                  <p className="text-xs text-amber-700">Reverts candidate phase back to Applicant Profiling</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Candidate Summary */}
            <div className="p-6 space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800 text-sm">{currentApplicant.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {currentApplicant.role || currentApplicant.appliedRole || 'Candidate'} · {currentApplicant.applicantCode || `#APP-${currentApplicant.id}`}
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full border border-amber-200">
                  Phase 3 → Phase 2
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Reason Category
                </label>
                <select
                  value={returnCategory}
                  onChange={e => setReturnCategory(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:border-[#0EA5E9] outline-none"
                >
                  <option value="Trade Skills / Assessment Re-evaluation">Trade Skills / Assessment Re-evaluation Required</option>
                  <option value="Job Order Qualifications Mismatch">Job Order Qualifications Mismatch</option>
                  <option value="Missing / Incomplete Certifications">Missing / Incomplete Certifications or Documents</option>
                  <option value="Candidate Requested Different Role / Country">Candidate Requested Different Role / Country</option>
                  <option value="Encoding Discrepancy / Other">Other Profile Inconsistency</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Detailed Findings & Guidance for Profiling Team <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={returnNotes}
                  onChange={e => setReturnNotes(e.target.value)}
                  placeholder="Explain why candidate is returning to profiling (e.g. Needs higher language score, reassignment to another job order)..."
                  className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-800 focus:border-[#0EA5E9] outline-none resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                disabled={isSubmittingReturn}
                className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmReturnToProfiling()}
                disabled={isSubmittingReturn || !returnNotes.trim()}
                className="px-4 py-2 text-sm font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-1.5 disabled:opacity-40 shadow-sm transition-colors cursor-pointer"
              >
                {isSubmittingReturn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                Confirm Return to Profiling
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
