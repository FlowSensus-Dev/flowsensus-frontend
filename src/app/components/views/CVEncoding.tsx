import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Lock, Save, Send, Download, Loader2, FileText, Plus, Trash2,
  CheckCircle2, Clock, XCircle, AlertCircle, Edit3, Undo2, Eye,
  ZoomIn, ZoomOut, X, UserPlus
} from 'lucide-react';
import { WorkflowState, ActivityLog, ApplicantRecord } from '../../types';
import InlineApplicantSelector from '../InlineApplicantSelector';
import { SkeletonText } from '../ui/skeleton';
import { api } from '../../../lib/api';
import { CVPreviewDoc, downloadCVPdf } from '../CVPreview';

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

// Statuses where the candidate has NOT yet reached CV Encoding (or was returned to an earlier stage)
export const PRE_CV_STATUSES = [
  'Applicant Registration',
  'Initial Screening',
  'Pending Interview',
  'Review Score for Medical Referral',
  'Medical Clearance',
  'Medical Referral',
  'Applicant Profiling',
  'Profiling',
  'Provisional',
  'Processing Stopped',
];

// Statuses where the candidate's CV was already approved and they have advanced past CV Encoding
// (Visible in CV Encoding for read-only viewing & A4 preview/export, but locked from editing/resubmitting)
export const POST_CV_STATUSES = [
  'CV Approved - Sending to Employer',
  'Endorse to Employer',
  'Under Employer Review',
  'Employer Review',
  'Waiting Selection',
  'Endorse for Administrative Processing',
  'Pre-Deployment Processing',
  'Document Validation',
  'Ready for Deployment',
  'Deployed',
  'Completed',
];

// Statuses actively in the CV Encoding / CV Review stage (editable unless already approved)
export const CV_ENCODING_STATUSES = [
  'CV Encoding',
  'Pending Manager Approval',
  'CV Approval',
];

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  DRAFT: {
    label: 'Draft CV',
    color: '#475569',
    bg: '#f8fafc',
    icon: <Edit3 className="w-3.5 h-3.5" />,
  },
  PENDING_APPROVAL: {
    label: 'Pending Approval',
    color: '#d97706',
    bg: '#fffbeb',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  REJECTED: {
    label: 'Needs Revision',
    color: '#dc2626',
    bg: '#fef2f2',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
  APPROVED: {
    label: 'CV Approved',
    color: '#059669',
    bg: '#ecfdf5',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || STATUS_META.DRAFT;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border"
      style={{ color: meta.color, background: meta.bg, borderColor: `${meta.color}30` }}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
}

function SkeletonCVLoader() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <SkeletonText className="w-40 h-5" />
        <SkeletonText className="w-full h-24" />
        <SkeletonText className="w-48 h-5" />
        <SkeletonText className="w-full h-12" />
      </div>
      <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <SkeletonText className="w-36 h-5" />
        <SkeletonText className="w-full h-40" />
      </div>
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

  // Preview overlay state
  const [showPreview, setShowPreview] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(0.75);

  // Return to Profiling modal state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnCategory, setReturnCategory] = useState('Trade Skills / Assessment Re-evaluation');
  const [returnNotes, setReturnNotes] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  // Custom fields state (editable ONLY while in CV Encoding & before approval)
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');

  // Summary override (stored in custom_fields.summary_override)
  const [summaryOverride, setSummaryOverride] = useState('');

  // Active tab for the compact read-only Profile Reference card
  const [mainTab, setMainTab] = useState<'details' | 'profile'>('details');

  // ── Eligible candidates ──
  // 1) Strictly EXCLUDES anyone in earlier phases or returned to Applicant Profiling / Medical / Screening
  // 2) INCLUDES candidates actively in CV Encoding AND candidates who have advanced past CV Encoding
  //    (so staff can still view & preview their CV, while editing/resubmitting is locked for advanced candidates)
  const eligibleApplicants = useMemo(() => {
    const list = applicants.filter(a => {
      if (a.isStopped || a.status === 'Processing Stopped') return false;
      const s = String(a.status || '').trim();
      // Never show candidates in Applicant Profiling, Medical Clearance, Screening, or Registration
      if (PRE_CV_STATUSES.includes(s)) return false;
      if (CV_ENCODING_STATUSES.includes(s) || POST_CV_STATUSES.includes(s)) return true;
      if (typeof a.phase === 'number' && a.phase >= 3) {
        return !PRE_CV_STATUSES.includes(s);
      }
      return false;
    });

    // Sort so candidates actively in CV Encoding appear first, followed by advanced/approved candidates
    return list.sort((a, b) => {
      const aActive = CV_ENCODING_STATUSES.includes(String(a.status || '').trim()) ? 0 : 1;
      const bActive = CV_ENCODING_STATUSES.includes(String(b.status || '').trim()) ? 0 : 1;
      return aActive - bActive;
    });
  }, [applicants]);

  const activeEncodingCount = useMemo(
    () => eligibleApplicants.filter(a => CV_ENCODING_STATUSES.includes(String(a.status || '').trim())).length,
    [eligibleApplicants]
  );

  // Sync selected applicant with initialApplicantId prop ONLY if that candidate is eligible
  useEffect(() => {
    if (initialApplicantId) {
      const isEligible = eligibleApplicants.some(a => String(a.id) === String(initialApplicantId));
      if (isEligible) {
        setSelectedApplicantId(initialApplicantId);
      }
    }
  }, [initialApplicantId, eligibleApplicants]);

  // Keep selected applicant synced: if current selection is empty or returned to Profiling, select first eligible
  useEffect(() => {
    if (selectedApplicantId) {
      const match = eligibleApplicants.find(a => String(a.id) === String(selectedApplicantId));
      if (!match) {
        setSelectedApplicantId(eligibleApplicants.length > 0 ? String(eligibleApplicants[0].id) : '');
      }
    } else if (eligibleApplicants.length > 0) {
      setSelectedApplicantId(String(eligibleApplicants[0].id));
    }
  }, [eligibleApplicants, selectedApplicantId]);

  // Strictly resolve currentApplicant from eligibleApplicants so returned candidates never linger here
  const currentApplicant = useMemo(
    () => eligibleApplicants.find(a => String(a.id) === String(selectedApplicantId)),
    [eligibleApplicants, selectedApplicantId]
  );

  // Effective custom fields including any pending entry typed into the "Add Field" inputs
  const effectiveCustomFields = useMemo(() => {
    const list = [...customFields];
    if (newFieldKey.trim()) {
      list.push({ key: newFieldKey.trim(), value: newFieldValue.trim() });
    }
    return list;
  }, [customFields, newFieldKey, newFieldValue]);

  // Check if there are unsaved edits to Summary or Custom Fields compared to cvRecord
  const hasUnsavedChanges = useMemo(() => {
    if (newFieldKey.trim() || newFieldValue.trim()) return true;
    const savedRaw = cvRecord?.custom_fields || {};
    const savedSummary = String(savedRaw.summary_override || '');
    if (summaryOverride.trim() !== savedSummary.trim()) return true;

    const savedEntries = Object.entries(savedRaw).filter(
      ([k]) => !['summary_override', 'return_reason', 'returned_at', 'returned_by'].includes(k)
    );
    const currentValid = customFields.filter(f => f.key.trim());
    if (savedEntries.length !== currentValid.length) return true;
    for (let i = 0; i < currentValid.length; i++) {
      const [sKey, sVal] = savedEntries[i];
      if (currentValid[i].key.trim() !== sKey || currentValid[i].value !== String(sVal ?? '')) {
        return true;
      }
    }
    return false;
  }, [cvRecord, summaryOverride, customFields, newFieldKey, newFieldValue]);

  // Determine whether CV has 2 pages
  const hasPage2 = useMemo(() => {
    if (!currentApplicant) return false;
    return Boolean(
      (currentApplicant.employmentHistory || []).length > 0 ||
      (currentApplicant.skills || []).length > 0 ||
      (currentApplicant.languageRecords || []).length > 0 ||
      (currentApplicant.certifications || []).length > 0 ||
      effectiveCustomFields.length > 0
    );
  }, [currentApplicant, effectiveCustomFields]);

  const currentStatus = String(currentApplicant?.status || '').trim();
  const isCandidateInCvStage = Boolean(currentApplicant && CV_ENCODING_STATUSES.includes(currentStatus));
  const isCvAlreadyApproved = cvRecord?.status_code === 'APPROVED';

  // A candidate who has already advanced past CV Encoding (e.g., Deployed, Endorse to Employer, Pre-Deployment)
  // OR whose CV is already APPROVED (and has not been returned to 'CV Encoding' status) is View & Preview Only
  const isReadOnlyAdvanced = Boolean(
    currentApplicant && (!isCandidateInCvStage || (isCvAlreadyApproved && currentStatus !== 'CV Encoding'))
  );

  // Check if module is locked due to medical clearance
  const isLocked = !workflow.medicalCleared && !(currentApplicant && (
    (typeof currentApplicant.phase === 'number' && currentApplicant.phase >= 3) ||
    CV_ENCODING_STATUSES.includes(currentStatus) ||
    POST_CV_STATUSES.includes(currentStatus)
  ));

  // Custom fields & summary are editable ONLY when the candidate is actively in CV Encoding (or returned to it) and NOT advanced/approved
  const isEditable = !isLocked && !isReadOnlyAdvanced;
  const canSaveDraft = isEditable;
  const canSubmit = isEditable && (
    !cvRecord ||
    cvRecord.status_code === 'DRAFT' ||
    cvRecord.status_code === 'REJECTED' ||
    (cvRecord.status_code === 'PENDING_APPROVAL' && hasUnsavedChanges) ||
    (currentStatus === 'CV Encoding' && cvRecord.status_code === 'APPROVED')
  );

  // Close overlay on Escape key
  useEffect(() => {
    if (!showPreview) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowPreview(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showPreview]);

  // ─── Turnover / Claim Applicant ─────────────────────────────────────────────
  const handleClaimApplicant = async (app: ApplicantRecord) => {
    const applicantId = String(app.id);
    const numericId = parseInt(applicantId, 10);
    const nowIso = new Date().toISOString();

    const updates: Partial<ApplicantRecord> = {
      currentHandler: currentUserName,
      currentDepartment: 'Recruitment',
      phaseDescription: `CV Encoding claimed by ${currentUserName}`
    };

    updateApplicant(applicantId, updates);

    if (!isNaN(numericId)) {
      await api.put(`/applicants/${numericId}`, {
        application_id: app.applicationId,
        current_handler: currentUserName,
        current_department: 'Recruitment',
        phase_description: updates.phaseDescription,
        statusChangeReason: `CV Encoding claimed by ${currentUserName}`,
        statusChangeSource: 'STAFF_ACTION',
        updated_at: nowIso
      }).catch(console.error);
    }

    addActivityLog({
      applicantId,
      action: 'Turnover: Claimed at CV Encoding',
      performedBy: currentUserName,
      department: 'Recruitment',
      details: `${currentUserName} claimed CV Encoding of applicant ${app.name} from the queue.`
    });

    showToast(`✓ ${app.name} assigned to you.`);
  };

  const handleReleaseApplicant = async (app: ApplicantRecord) => {
    const applicantId = String(app.id);
    const numericId = parseInt(applicantId, 10);
    const nowIso = new Date().toISOString();

    const updates: Partial<ApplicantRecord> = {
      currentHandler: 'Unassigned',
      phaseDescription: `Returned to unassigned CV Encoding queue by ${currentUserName}`
    };

    updateApplicant(applicantId, updates);

    if (!isNaN(numericId)) {
      await api.put(`/applicants/${numericId}`, {
        application_id: app.applicationId,
        current_handler: 'Unassigned',
        phase_description: updates.phaseDescription,
        statusChangeReason: `Returned to unassigned by ${currentUserName}`,
        statusChangeSource: 'STAFF_ACTION',
        updated_at: nowIso
      }).catch(console.error);
    }

    addActivityLog({
      applicantId,
      action: 'Turnover: Released to Pool',
      performedBy: currentUserName,
      department: 'Recruitment',
      details: `${currentUserName} returned applicant ${app.name} to the unassigned queue.`
    });

    showToast(`${app.name} returned to unassigned pool.`);
  };

  // ─── Apply custom_fields from a loaded/saved CvRecord into state ────────────
  const applyCvCustomFields = useCallback((rec: CvRecord | null) => {
    if (rec?.custom_fields && typeof rec.custom_fields === 'object') {
      const { summary_override, return_reason, returned_at, returned_by, ...rest } = rec.custom_fields;
      setSummaryOverride(summary_override || '');
      setCustomFields(
        Object.entries(rest).map(([key, value]) => ({ key, value: String(value ?? '') }))
      );
    } else {
      setCustomFields([]);
      setSummaryOverride('');
    }
    setNewFieldKey('');
    setNewFieldValue('');
  }, []);

  // ─── Load CV record whenever applicant changes ──────────────────────────────
  const loadCvRecord = useCallback(async (applicantId: string) => {
    if (!applicantId || applicantId === 'new') {
      setCvRecord(null);
      setCustomFields([]);
      setSummaryOverride('');
      setNewFieldKey('');
      setNewFieldValue('');
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.get(`/cv/applicant/${applicantId}`);
      const rec: CvRecord | null = res.data || null;
      setCvRecord(rec);
      applyCvCustomFields(rec);
    } catch {
      setCvRecord(null);
      setCustomFields([]);
      setSummaryOverride('');
    } finally {
      setIsLoading(false);
    }
  }, [applyCvCustomFields]);

  useEffect(() => {
    if (currentApplicant) {
      loadCvRecord(String(currentApplicant.id));
    } else {
      setCvRecord(null);
      setCustomFields([]);
      setSummaryOverride('');
    }
  }, [currentApplicant?.id, loadCvRecord]);

  // ─── Build custom_fields payload ─────────────────────────────────────────────
  const buildCustomFields = () => {
    const fields: Record<string, any> = {};
    if (summaryOverride.trim()) fields['summary_override'] = summaryOverride.trim();
    effectiveCustomFields.forEach(f => {
      if (f.key.trim()) fields[f.key.trim()] = f.value;
    });
    return fields;
  };

  const resolveEffectiveJobOrderId = () => {
    const raw = currentApplicant?.selectedJobOrderId && !isNaN(Number(currentApplicant.selectedJobOrderId))
      ? Number(currentApplicant.selectedJobOrderId)
      : (currentApplicant as any)?.job_order_id || (currentApplicant as any)?.jobOrderId;
    const num = Number(raw);
    return !isNaN(num) && num > 0 ? num : undefined;
  };

  // ─── Save draft / Save changes ──────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (!canSaveDraft || isSaving || !currentApplicant || isLocked || isReadOnlyAdvanced) return;
    setIsSaving(true);
    try {
      const customFieldsPayload = buildCustomFields();
      const effectiveJobOrderId = resolveEffectiveJobOrderId();

      if (newFieldKey.trim()) {
        setCustomFields(effectiveCustomFields);
        setNewFieldKey('');
        setNewFieldValue('');
      }

      if (cvRecord) {
        const nextStatus = cvRecord.status_code === 'REJECTED' || (currentStatus === 'CV Encoding' && cvRecord.status_code === 'APPROVED')
          ? 'DRAFT'
          : cvRecord.status_code;

        const res = await api.patch(`/cv/${cvRecord.cv_id}`, {
          statusCode: nextStatus,
          customFields: customFieldsPayload,
          jobOrderId: effectiveJobOrderId,
        });
        setCvRecord(res.data);
        applyCvCustomFields(res.data);
      } else {
        const res = await api.post('/cv', {
          applicantId: Number(currentApplicant.id),
          jobOrderId: effectiveJobOrderId,
          statusCode: 'DRAFT',
          customFields: customFieldsPayload,
        });
        setCvRecord(res.data);
        applyCvCustomFields(res.data);
      }

      addActivityLog({
        applicantId: String(currentApplicant.id),
        action: cvRecord ? 'CV Custom Fields Updated' : 'CV Draft Saved',
        performedBy: currentUserName,
        department: 'Recruitment',
        details: `CV saved for ${currentApplicant.name}.`,
      });

      showToast(cvRecord ? '✓ CV changes saved' : '✓ CV draft saved');
    } catch (err: any) {
      showToast(`❌ Save failed: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Submit / Resubmit for approval ─────────────────────────────────────────
  const handleSubmitForApproval = async () => {
    if (!canSubmit || isSubmitting || !currentApplicant || isLocked || isReadOnlyAdvanced) return;
    setIsSubmitting(true);
    try {
      const customFieldsPayload = buildCustomFields();
      const effectiveJobOrderId = resolveEffectiveJobOrderId();
      let rec = cvRecord;

      if (newFieldKey.trim()) {
        setCustomFields(effectiveCustomFields);
        setNewFieldKey('');
        setNewFieldValue('');
      }

      if (rec) {
        // If candidate was returned to 'CV Encoding' with a previously APPROVED CV, reset to DRAFT first
        if (rec.status_code === 'APPROVED' && currentStatus === 'CV Encoding') {
          await api.patch(`/cv/${rec.cv_id}`, {
            statusCode: 'DRAFT',
            customFields: customFieldsPayload,
            jobOrderId: effectiveJobOrderId,
          });
        }
        const saveRes = await api.patch(`/cv/${rec.cv_id}`, {
          statusCode: 'PENDING_APPROVAL',
          customFields: customFieldsPayload,
          jobOrderId: effectiveJobOrderId,
        });
        rec = saveRes.data;
      } else {
        const createRes = await api.post('/cv', {
          applicantId: Number(currentApplicant.id),
          jobOrderId: effectiveJobOrderId,
          statusCode: 'PENDING_APPROVAL',
          customFields: customFieldsPayload,
        });
        rec = createRes.data;
      }
      setCvRecord(rec);
      applyCvCustomFields(rec);

      const appIdStr = String(currentApplicant.id);
      updateApplicant(appIdStr, {
        status: 'Pending Manager Approval',
        currentHandler: currentUserName,
        currentDepartment: 'Management',
        phaseDescription: 'CV submitted and awaiting management review',
      });

      const numId = parseInt(appIdStr, 10);
      if (!isNaN(numId)) {
        await api.put(`/applicants/${numId}`, {
          application_id: currentApplicant.applicationId,
          application_status: 'Pending Manager Approval',
          current_phase: 3,
          current_handler: currentUserName,
          current_department: 'Management',
          phase_description: 'CV submitted and awaiting management review',
          statusChangeReason: 'CV encoded and submitted for manager approval',
          statusChangeSource: 'CV_ENCODING',
          updated_at: new Date().toISOString(),
        }).catch(console.error);
      }

      addActivityLog({
        applicantId: appIdStr,
        action: cvRecord ? 'CV Updated & Resubmitted for Approval' : 'CV Submitted for Approval',
        performedBy: currentUserName,
        department: 'Recruitment',
        details: `CV (ID: ${rec!.cv_id}) submitted to management for review.`,
      });

      showToast(cvRecord ? '✓ Updated CV submitted for manager approval' : '✓ CV submitted for manager approval');
    } catch (err: any) {
      showToast(`❌ Submission failed: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Return Candidate to Applicant Profiling ───────────────────────────────
  const handleConfirmReturnToProfiling = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentApplicant || isSubmittingReturn || isReadOnlyAdvanced) return;

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
      // Determine next eligible candidate BEFORE removing this one from the queue
      const remaining = eligibleApplicants.filter(a => String(a.id) !== applicantId);
      const nextId = remaining.length > 0 ? String(remaining[0].id) : '';

      // 1. Update applicant state locally (this removes them from eligibleApplicants immediately)
      updateApplicant(applicantId, {
        status: 'Applicant Profiling',
        phase: 3,
        currentHandler: 'Unassigned',
        currentDepartment: 'Recruitment',
        phaseDescription: `Returned from CV Encoding to Profiling by ${currentUserName}. Note: ${reasonText}`,
      });

      setSelectedApplicantId(nextId);
      setShowReturnModal(false);
      setReturnNotes('');

      // 2. Persist to Backend Supabase API
      if (!isNaN(numericId)) {
        await api.put(`/applicants/${numericId}`, {
          application_id: currentApplicant.applicationId,
          application_status: 'Applicant Profiling',
          current_phase: 3,
          current_handler: 'Unassigned',
          current_department: 'Recruitment',
          phase_description: `Returned from CV Encoding to Profiling by ${currentUserName}. Note: ${reasonText}`,
          statusChangeReason: `Returned from CV Encoding: ${reasonText}`,
          statusChangeSource: 'CV_ENCODING',
          updated_at: nowIso,
        }).catch(console.error);
      }

      // 3. If CV record exists, reset status to DRAFT
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
    } catch (err) {
      console.error('Failed to return candidate to profiling:', err);
      showToast('Error returning candidate to profiling.');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  // ─── Export to PDF (direct download via jsPDF) ────────────────────────────────
  const handleExportToPDF = async () => {
    if (!currentApplicant || isExporting) return;
    setIsExporting(true);
    try {
      await downloadCVPdf(
        currentApplicant,
        summaryOverride,
        effectiveCustomFields,
        currentUserName,
        cvRecord?.cv_id,
      );
      addActivityLog({
        applicantId: String(currentApplicant.id),
        action: 'CV Exported to PDF',
        performedBy: currentUserName,
        department: 'Recruitment',
        details: `CV exported for ${currentApplicant.name}`,
      });
      showToast(`✓ CV-${currentApplicant.name}.pdf downloaded`);
    } catch (err) {
      console.error('PDF export failed:', err);
      showToast('Error exporting CV to PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // ─── Add / update / remove custom field ──────────────────────────────────────
  const handleAddCustomField = () => {
    if (!newFieldKey.trim() || !isEditable) return;
    setCustomFields(prev => [...prev, { key: newFieldKey.trim(), value: newFieldValue.trim() }]);
    setNewFieldKey('');
    setNewFieldValue('');
  };

  const handleUpdateCustomField = (idx: number, patch: Partial<CustomField>) => {
    if (!isEditable) return;
    setCustomFields(prev => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const handleRemoveCustomField = (idx: number) => {
    if (!isEditable) return;
    setCustomFields(prev => prev.filter((_, i) => i !== idx));
  };

  const profileRows: [string, any][] = currentApplicant ? [
    ['Full name', currentApplicant.name],
    ['Applied position', currentApplicant.role || currentApplicant.appliedRole],
    ['Date of birth', currentApplicant.dateOfBirth],
    ['Age / Sex', `${currentApplicant.age ? `${currentApplicant.age} yrs` : '—'} · ${currentApplicant.sex || '—'}`],
    ['Civil status', currentApplicant.civilStatus],
    ['Children', currentApplicant.noOfChildren !== undefined && currentApplicant.noOfChildren !== null ? String(currentApplicant.noOfChildren) : '0'],
    ['Religion', currentApplicant.religion],
    ['Citizenship', currentApplicant.citizenship || 'Filipino'],
    ['Height / Weight', `${currentApplicant.heightCm ? `${currentApplicant.heightCm} cm` : '—'} / ${currentApplicant.weightKg ? `${currentApplicant.weightKg} kg` : '—'}`],
    ['Mobile', currentApplicant.contact],
    ['Email', currentApplicant.email],
    ['Address', currentApplicant.presentAddress],
  ] : [];

  const submitLabel = cvRecord?.status_code === 'REJECTED'
    ? 'Resubmit for approval'
    : cvRecord?.status_code === 'PENDING_APPROVAL'
      ? (hasUnsavedChanges ? 'Update submitted CV' : 'Waiting for manager')
      : 'Submit for approval';

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 w-full">
      {/* ── Page header ── */}
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#0F172A]">CV Encoding</h2>
          <p className="text-sm text-[#64748B] mt-0.5">
            Add a short summary and extra details to each candidate&apos;s CV, then send it for approval.
          </p>
        </div>
        {eligibleApplicants.length > 0 && (
          <p className="text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{activeEncodingCount}</span> to work on
            {' · '}
            <span className="font-semibold text-slate-700">{eligibleApplicants.length - activeEncodingCount}</span> already moved on (view only)
          </p>
        )}
      </div>

      {eligibleApplicants.length > 0 ? (
        <>
          <InlineApplicantSelector
            applicants={eligibleApplicants}
            selectedApplicantId={selectedApplicantId}
            onSelectApplicant={(id) => setSelectedApplicantId(id)}
            allowNew={false}
          />

          {/* ── Selected candidate: one plain line, no extra card ── */}
          {currentApplicant && (
            <div className="flex items-center justify-between flex-wrap gap-3 px-1">
              <div className="min-w-0 flex items-center gap-2.5 flex-wrap text-sm">
                <span className="font-semibold text-[#0F172A]">{currentApplicant.name}</span>
                {cvRecord && <StatusBadge status={cvRecord.status_code} />}
                {isReadOnlyAdvanced && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Lock className="w-3 h-3" /> View only
                  </span>
                )}
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-500">{currentApplicant.status || 'CV Encoding'}</span>
                {!isReadOnlyAdvanced && (() => {
                  const isMine = currentApplicant.currentHandler?.trim().toLowerCase() === currentUserName?.trim().toLowerCase();
                  const isFree = !currentApplicant.currentHandler || ['Unassigned', 'Unassigned Pool', 'System Agent'].includes(currentApplicant.currentHandler);
                  return (
                    <>
                      <span className="text-xs text-slate-400">·</span>
                      {isMine ? (
                        <span className="text-xs text-slate-500">
                          Yours{' '}
                          <button type="button" onClick={() => handleReleaseApplicant(currentApplicant)} className="underline hover:text-slate-800 cursor-pointer">Release</button>
                        </span>
                      ) : isFree ? (
                        <button type="button" onClick={() => handleClaimApplicant(currentApplicant)} className="text-xs font-semibold text-[#0EA5E9] hover:text-[#0284C7] inline-flex items-center gap-1 cursor-pointer">
                          <UserPlus className="w-3 h-3" /> Take this candidate
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">
                          With {currentApplicant.currentHandler}{' '}
                          <button type="button" onClick={() => handleClaimApplicant(currentApplicant)} className="font-semibold text-[#0EA5E9] hover:text-[#0284C7] cursor-pointer">Take over</button>
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 hover:bg-white hover:shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-[#0EA5E9]" /> Preview CV
                </button>
                <button
                  type="button"
                  onClick={handleExportToPDF}
                  disabled={isExporting}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 hover:bg-white hover:shadow-2xs flex items-center gap-1.5 disabled:opacity-40 transition cursor-pointer"
                >
                  {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0EA5E9]" /> : <Download className="w-3.5 h-3.5 text-[#0EA5E9]" />}
                  Download PDF
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center max-w-xl mx-auto my-6">
          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#0F172A] mb-1">No candidates here yet</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
            Candidates show up here after they are sent over from Applicant Profiling.
          </p>
          {onNavigate && (
            <button
              onClick={() => onNavigate('profiling')}
              className="px-4 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Go to Applicant Profiling
            </button>
          )}
        </div>
      )}

      {/* ── Short notices (single line each) ── */}
      {isLocked && currentApplicant && (
        <p className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
          <Lock className="w-4 h-4 flex-shrink-0" />
          Waiting for the medical result. CV encoding opens once the candidate is fit to work.
        </p>
      )}
      {cvRecord?.status_code === 'REJECTED' && cvRecord.rejection_reason && !isReadOnlyAdvanced && (
        <p className="flex items-start gap-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span><strong>Manager asked for changes:</strong> {cvRecord.rejection_reason}</span>
        </p>
      )}

      {/* ── One workspace card with two tabs ── */}
      {isLoading ? (
        <SkeletonCVLoader />
      ) : !currentApplicant ? null : (
        <div className={`bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden ${isLocked ? 'opacity-60 pointer-events-none select-none' : ''}`}>
          {/* Tab bar */}
          <div className="flex items-center justify-between px-5 border-b border-slate-200">
            <div className="flex items-center gap-6 xl:hidden">
              {([
                ['details', 'CV details'],
                ['profile', 'Candidate profile'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMainTab(key)}
                  className={`py-3.5 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
                    mainTab === key
                      ? 'border-[#0EA5E9] text-[#0F172A]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="hidden xl:flex items-center py-3.5 text-sm font-semibold text-[#0F172A]">Candidate CV</div>
            <span className="text-xs">
              {hasUnsavedChanges && isEditable ? (
                <span className="text-amber-700 font-semibold">Unsaved changes</span>
              ) : cvRecord ? (
                <span className="text-slate-400">Saved {new Date(cvRecord.updated_at).toLocaleDateString('en-PH')}</span>
              ) : null}
            </span>
          </div>

          <div className="xl:grid xl:grid-cols-5 xl:divide-x xl:divide-slate-200">
          {/* ── CV details (editable) ── */}
          <div className={`${mainTab === 'details' ? '' : 'hidden xl:block'} xl:col-span-3`}>
            <div className="px-5 py-5 space-y-7">
              {!isEditable && (
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  This CV can only be viewed. It can be edited again if the candidate is returned to CV Encoding.
                </p>
              )}

              <section>
                <label htmlFor="cv-summary" className="block text-sm font-semibold text-[#0F172A]">About the candidate</label>
                <p className="text-xs text-slate-500 mb-2">A short summary shown at the top of the CV. Leave blank to use the standard one.</p>
                <textarea
                  id="cv-summary"
                  rows={3}
                  value={summaryOverride}
                  onChange={e => setSummaryOverride(e.target.value)}
                  disabled={!isEditable}
                  placeholder={`e.g. Experienced ${currentApplicant.role || 'worker'} looking for work overseas.`}
                  className="w-full border border-slate-200 px-3.5 py-2.5 rounded-lg text-sm text-[#0F172A] focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/15 outline-none resize-none disabled:bg-slate-50 disabled:text-slate-500 transition"
                />
              </section>

              <section>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold text-[#0F172A]">Extra details {customFields.length > 0 && <span className="text-slate-400 font-normal">({customFields.length})</span>}</h3>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Anything the employer asked for, such as a video link, expected salary or availability.
                </p>

                {customFields.length > 0 ? (
                  <div className="divide-y divide-slate-100 border-y border-slate-100">
                    {customFields.map((field, idx) => (
                      <div key={idx} className="flex items-center gap-3 py-2">
                        <input
                          type="text"
                          value={field.key}
                          onChange={e => handleUpdateCustomField(idx, { key: e.target.value })}
                          disabled={!isEditable}
                          placeholder="Label"
                          aria-label={`Label ${idx + 1}`}
                          className="w-2/5 px-2.5 py-1.5 rounded-md text-sm font-medium text-[#0F172A] border border-transparent hover:border-slate-200 focus:border-[#0EA5E9] outline-none bg-transparent disabled:text-slate-600 transition"
                        />
                        <input
                          type="text"
                          value={field.value}
                          onChange={e => handleUpdateCustomField(idx, { value: e.target.value })}
                          disabled={!isEditable}
                          placeholder="Value"
                          aria-label={`Value ${idx + 1}`}
                          className="flex-1 px-2.5 py-1.5 rounded-md text-sm text-[#0F172A] border border-transparent hover:border-slate-200 focus:border-[#0EA5E9] outline-none bg-transparent disabled:text-slate-600 transition"
                        />
                        {isEditable && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomField(idx)}
                            title="Remove"
                            className="p-1.5 text-slate-300 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 py-2">Nothing added yet.</p>
                )}

                {isEditable && (
                  <div className="flex items-center gap-2 pt-3">
                    <input
                      type="text"
                      value={newFieldKey}
                      onChange={e => setNewFieldKey(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && newFieldKey.trim()) { e.preventDefault(); handleAddCustomField(); } }}
                      placeholder="Label (e.g. Video link)"
                      className="w-2/5 border border-slate-200 px-3 py-2 rounded-lg text-sm focus:border-[#0EA5E9] outline-none transition"
                    />
                    <input
                      type="text"
                      value={newFieldValue}
                      onChange={e => setNewFieldValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && newFieldKey.trim()) { e.preventDefault(); handleAddCustomField(); } }}
                      placeholder="Value"
                      className="flex-1 border border-slate-200 px-3 py-2 rounded-lg text-sm focus:border-[#0EA5E9] outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomField}
                      disabled={!newFieldKey.trim()}
                      className="px-3 py-2 text-sm font-semibold text-[#0EA5E9] hover:bg-sky-50 rounded-lg disabled:opacity-40 flex items-center gap-1 transition-colors cursor-pointer flex-shrink-0"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>
                )}
              </section>
            </div>
          </div>

          {/* ── Candidate profile (read only, one calm scroll) ── */}
          <div className={`${mainTab === 'profile' ? '' : 'hidden xl:block'} xl:col-span-2`}>
            <div className="px-5 py-5 space-y-7 xl:max-h-[calc(100vh-280px)] overflow-y-auto">
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Taken from the candidate&apos;s registration. Edit it in Registration.
              </p>

              <section>
                <h3 className="text-sm font-semibold text-[#0F172A] mb-3">Personal details</h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  {profileRows.map(([label, val]) => (
                    <div key={label} className={label === 'Address' || label === 'Email' ? 'sm:col-span-2' : ''}>
                      <dt className="text-xs text-slate-400">{label}</dt>
                      <dd className="text-[#0F172A] break-words">{val || <span className="text-slate-300">—</span>}</dd>
                    </div>
                  ))}
                </dl>
                {currentApplicant.emergencyContactName && (
                  <p className="text-sm mt-3">
                    <span className="text-xs text-slate-400 block">Emergency contact</span>
                    {currentApplicant.emergencyContactName} ({currentApplicant.emergencyContactRelationship || 'Contact'}) · {currentApplicant.emergencyContactNumber || '—'}
                  </p>
                )}
              </section>

              <section className="pt-5 border-t border-slate-100">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-3">Work experience</h3>
                {(currentApplicant.employmentHistory || []).length === 0 ? (
                  <p className="text-sm text-slate-400">None on file.</p>
                ) : (
                  <ul className="space-y-3">
                    {(currentApplicant.employmentHistory || []).map((e, idx) => (
                      <li key={idx} className="text-sm">
                        <p className="font-medium text-[#0F172A]">{e.position} <span className="font-normal text-slate-500">at {e.company}</span></p>
                        <p className="text-xs text-slate-400">{e.dateStarted} – {e.isPresent ? 'Present' : e.dateEnded} · {e.country}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="pt-5 border-t border-slate-100">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-3">Education</h3>
                {(currentApplicant.education || []).length === 0 ? (
                  <p className="text-sm text-slate-400">None on file.</p>
                ) : (
                  <ul className="space-y-3">
                    {(currentApplicant.education || []).map((ed, idx) => (
                      <li key={idx} className="text-sm">
                        <p className="font-medium text-[#0F172A]">{ed.school}</p>
                        <p className="text-xs text-slate-400">{ed.level} — {ed.course || 'N/A'} · {ed.yearGraduated || 'N/A'}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="pt-5 border-t border-slate-100 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#0F172A] mb-2">Skills</h3>
                  {(currentApplicant.skills || []).length === 0 ? (
                    <p className="text-sm text-slate-400">None on file.</p>
                  ) : (
                    <p className="text-sm text-slate-700">{(currentApplicant.skills || []).join(' · ')}</p>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#0F172A] mb-2">Languages</h3>
                  {(currentApplicant.languageRecords || []).length === 0 ? (
                    <p className="text-sm text-slate-400">None on file.</p>
                  ) : (
                    <ul className="text-sm space-y-0.5">
                      {(currentApplicant.languageRecords || []).map((l, i) => (
                        <li key={i} className="text-slate-700">{l.language} <span className="text-xs text-slate-400">— speaks {l.spokenRating}/5, writes {l.writtenRating}/5</span></li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#0F172A] mb-2">Certificates</h3>
                  {(currentApplicant.certifications || []).length === 0 ? (
                    <p className="text-sm text-slate-400">None on file.</p>
                  ) : (
                    <p className="text-sm text-slate-700">{(currentApplicant.certifications || []).join(' · ')}</p>
                  )}
                </div>
              </section>
            </div>
          </div>
          </div>

          {/* ── Footer: only when editing ── */}
          {isEditable && (
            <div className={`px-5 py-3.5 border-t border-slate-200 bg-slate-50/60 items-center justify-between flex-wrap gap-3 ${mainTab === 'details' ? 'flex' : 'hidden xl:flex'}`}>
              <button
                type="button"
                onClick={() => setShowReturnModal(true)}
                disabled={isLocked || isSubmittingReturn}
                className="text-sm font-medium text-slate-500 hover:text-amber-700 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
              >
                <Undo2 className="w-4 h-4" /> Send back to Profiling
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={!canSaveDraft || isSaving}
                  className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg disabled:opacity-40 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {cvRecord ? 'Save changes' : 'Save draft'}
                </button>
                <button
                  type="button"
                  onClick={handleSubmitForApproval}
                  disabled={!canSubmit || isSubmitting}
                  className="px-4 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-sm font-semibold rounded-lg disabled:opacity-40 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {submitLabel}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CV preview overlay ── */}
      {showPreview && currentApplicant && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black/80 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPreview(false); }}
        >
          <div className="flex items-center justify-between px-6 py-3 bg-[#1e293b] border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <Eye className="w-4 h-4 text-white/60" />
              <span className="text-white font-bold text-sm">CV Preview — {currentApplicant.name}</span>
              <span className="px-2 py-0.5 bg-white/10 text-white/80 rounded text-[11px] font-mono">{hasPage2 ? '2 Pages · A4' : '1 Page · A4'}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setZoomLevel(z => Math.max(0.3, +(z - 0.1).toFixed(1)))} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Zoom out">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-white/60 text-xs font-mono min-w-[48px] text-center">{Math.round(zoomLevel * 100)}%</span>
              <button onClick={() => setZoomLevel(z => Math.min(2, +(z + 0.1).toFixed(1)))} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Zoom in">
                <ZoomIn className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-white/20 mx-1" />
              <button onClick={handleExportToPDF} disabled={isExporting} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors">
                <Download className="w-3.5 h-3.5" /> Download PDF
              </button>
              <button onClick={() => setShowPreview(false)} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors ml-1" title="Close (Esc)">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto flex items-start justify-center p-8 bg-slate-900/80">
            <div style={{ width: 794 * zoomLevel, minHeight: (hasPage2 ? 2340 : 1160) * zoomLevel, flexShrink: 0, position: 'relative', paddingBottom: 40 * zoomLevel }}>
              <div style={{ transformOrigin: 'top left', transform: `scale(${zoomLevel})`, width: 794 }}>
                <CVPreviewDoc
                  applicant={currentApplicant}
                  summaryOverride={summaryOverride}
                  customFields={effectiveCustomFields}
                  cvId={cvRecord?.cv_id}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Send back to Profiling dialog ── */}
      {showReturnModal && currentApplicant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-6 pt-5 pb-3">
              <h3 className="font-bold text-base text-[#0F172A]">Send {currentApplicant.name} back to Profiling?</h3>
              <p className="text-sm text-slate-500 mt-1">They will leave CV Encoding until they are sent over again.</p>
            </div>
            <div className="px-6 pb-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Reason</label>
                <select
                  value={returnCategory}
                  onChange={e => setReturnCategory(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:border-[#0EA5E9] outline-none"
                >
                  <option value="Trade Skills / Assessment Re-evaluation">Skills need to be re-checked</option>
                  <option value="Job Order Qualifications Mismatch">Does not match the job order</option>
                  <option value="Missing / Incomplete Certifications">Missing certificates or documents</option>
                  <option value="Candidate Requested Different Role / Country">Candidate wants a different role or country</option>
                  <option value="Encoding Discrepancy / Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Note for the profiling team <span className="text-red-500">*</span></label>
                <textarea
                  rows={3}
                  value={returnNotes}
                  onChange={e => setReturnNotes(e.target.value)}
                  placeholder="Tell them what needs to be fixed..."
                  className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-800 focus:border-[#0EA5E9] outline-none resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                disabled={isSubmittingReturn}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmReturnToProfiling()}
                disabled={isSubmittingReturn || !returnNotes.trim()}
                className="px-4 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-1.5 disabled:opacity-40 transition-colors cursor-pointer"
              >
                {isSubmittingReturn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                {isSubmittingReturn ? 'Sending…' : 'Send back'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
