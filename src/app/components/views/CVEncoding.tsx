import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Lock, Save, Send, Download, Loader2, FileText, Plus, Trash2,
  CheckCircle2, Clock, XCircle, AlertCircle, User, Briefcase,
  GraduationCap, Star, Edit3, Undo2, Eye,
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
  const [profileTab, setProfileTab] = useState<'personal' | 'experience' | 'education' | 'skills'>('personal');

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

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 w-full">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#0F172A]">CV Encoding</h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Customize candidate CV summary and custom fields, preview the A4 layout, and submit for approval.
          </p>
        </div>
        {eligibleApplicants.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-700">
              {activeEncodingCount} in Encoding · {eligibleApplicants.length - activeEncodingCount} Advanced (View Only)
            </span>
          </div>
        )}
      </div>

      {/* ── Candidate Selector & Unified Candidate Bar ── */}
      {eligibleApplicants.length > 0 ? (
        <div className="space-y-3">
          <InlineApplicantSelector
            applicants={eligibleApplicants}
            selectedApplicantId={selectedApplicantId}
            onSelectApplicant={(id) => setSelectedApplicantId(id)}
            allowNew={false}
          />

          {currentApplicant && (
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-2xs flex items-center justify-between flex-wrap gap-3">
              {/* Left: Candidate Identity & Handler */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#0EA5E9] flex items-center justify-center font-bold text-sm border border-sky-100 flex-shrink-0">
                  {currentApplicant.name?.charAt(0) || 'A'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[#0F172A] truncate">{currentApplicant.name}</span>
                    <span className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold border border-slate-200">
                      {currentApplicant.applicantCode || `#${currentApplicant.id}`}
                    </span>
                    {cvRecord && <StatusBadge status={cvRecord.status_code} />}
                    {isReadOnlyAdvanced && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        <Lock className="w-3 h-3" />
                        View & Preview Only
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="font-medium text-slate-700">{currentApplicant.role || currentApplicant.appliedRole || 'Candidate'}</span>
                    <span>•</span>
                    <span>Stage: <strong className="text-slate-700 font-semibold">{currentApplicant.status || 'CV Encoding'}</strong></span>
                    {!isReadOnlyAdvanced && (
                      <>
                        <span>•</span>
                        {(() => {
                          const isAssignedToMe = currentApplicant.currentHandler?.trim().toLowerCase() === currentUserName?.trim().toLowerCase();
                          const isUnassigned = !currentApplicant.currentHandler || ['Unassigned', 'Unassigned Pool', 'System Agent'].includes(currentApplicant.currentHandler);

                          if (isAssignedToMe) {
                            return (
                              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                                <span>Assigned to you</span>
                                <button
                                  type="button"
                                  onClick={() => handleReleaseApplicant(currentApplicant)}
                                  className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer font-normal"
                                >
                                  (Release)
                                </button>
                              </span>
                            );
                          }

                          if (isUnassigned) {
                            return (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="text-amber-700 font-medium">Unassigned</span>
                                <button
                                  type="button"
                                  onClick={() => handleClaimApplicant(currentApplicant)}
                                  className="text-[11px] font-semibold text-[#0EA5E9] hover:text-[#0284C7] inline-flex items-center gap-0.5 cursor-pointer"
                                >
                                  <UserPlus className="w-3 h-3" /> Claim
                                </button>
                              </span>
                            );
                          }

                          return (
                            <span className="inline-flex items-center gap-1.5">
                              <span>Handler: <strong className="text-slate-700">{currentApplicant.currentHandler}</strong></span>
                              <button
                                type="button"
                                onClick={() => handleClaimApplicant(currentApplicant)}
                                className="text-[11px] font-semibold text-[#0EA5E9] hover:text-[#0284C7] cursor-pointer"
                              >
                                Take Over
                              </button>
                            </span>
                          );
                        })()}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Clean Document Preview & Export Utilities */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-[#0EA5E9]" />
                  Preview A4 CV
                </button>
                <button
                  type="button"
                  onClick={handleExportToPDF}
                  disabled={isExporting}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0EA5E9]" /> : <Download className="w-3.5 h-3.5 text-[#0EA5E9]" />}
                  Export PDF
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center shadow-2xs max-w-xl mx-auto my-6">
          <div className="w-12 h-12 rounded-xl bg-sky-50 text-[#0EA5E9] flex items-center justify-center mx-auto mb-3 border border-sky-100">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#0F172A] mb-1">No Candidates Available in CV Encoding</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4 leading-relaxed">
            Candidates appear here once they are endorsed from <strong>Applicant Profiling</strong>. Candidates returned to Profiling or earlier phases are moved back to those modules.
          </p>
          {onNavigate && (
            <button
              onClick={() => onNavigate('profiling')}
              className="px-4 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              Go to Applicant Profiling
            </button>
          )}
        </div>
      )}

      {/* ── Locked Banner ── */}
      {isLocked && currentApplicant && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div>
            <p className="font-bold text-amber-900 text-xs">Waiting for Medical Clearance</p>
            <p className="text-xs text-amber-700">CV encoding is unlocked after the applicant passes Fit-to-Work.</p>
          </div>
        </div>
      )}

      {/* ── Advanced / Approved Candidate Notice (View & Preview Only) ── */}
      {isReadOnlyAdvanced && currentApplicant && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <p className="text-xs text-slate-600">
              <strong className="text-slate-900">View & Preview Mode:</strong> {currentApplicant.name} is currently in{' '}
              <strong className="text-slate-900">{currentApplicant.status}</strong>. You can preview and export their A4 CV anytime; editing and resubmitting are locked unless they are returned to <strong>CV Encoding</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-[#0EA5E9]" />
            Preview CV
          </button>
        </div>
      )}

      {/* ── Manager Rejection Notice ── */}
      {cvRecord?.status_code === 'REJECTED' && cvRecord.rejection_reason && !isReadOnlyAdvanced && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-800 text-xs">Manager Requested Revisions</p>
            <p className="text-xs text-red-700 mt-0.5">{cvRecord.rejection_reason}</p>
          </div>
        </div>
      )}

      {/* ── Main 2-Column Workspace ── */}
      {isLoading ? (
        <SkeletonCVLoader />
      ) : !currentApplicant ? null : (
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-5 items-start ${isLocked ? 'opacity-60 pointer-events-none select-none' : ''}`}>

          {/* ── LEFT COLUMN (7 cols): CV Content (Summary & Custom Fields) ── */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#0EA5E9]" />
                <h3 className="text-sm font-bold text-[#0F172A]">CV Customization & Custom Fields</h3>
              </div>
              {hasUnsavedChanges && isEditable ? (
                <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                  Unsaved changes
                </span>
              ) : cvRecord ? (
                <span className="text-[11px] text-slate-400">
                  CV #{cvRecord.cv_id} · Saved {new Date(cvRecord.updated_at).toLocaleDateString('en-PH')}
                </span>
              ) : null}
            </div>

            <div className="p-5 space-y-6">
              {/* 1. Professional Summary */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#0F172A]">
                    Professional Summary / Objective
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {isEditable ? 'Optional — leave blank to use default summary' : 'Read-only'}
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={summaryOverride}
                  onChange={e => setSummaryOverride(e.target.value)}
                  disabled={!isEditable}
                  placeholder={`Experienced ${currentApplicant.role || 'professional'} seeking overseas employment opportunities...`}
                  className="w-full border border-slate-200 px-3.5 py-2.5 rounded-lg text-sm text-[#0F172A] focus:border-[#0EA5E9] outline-none resize-none disabled:bg-slate-50 disabled:text-slate-500 transition-colors"
                />
              </div>

              {/* 2. Custom Fields (Editable while in CV Encoding, Read-only after advancing) */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#0F172A]">
                    Custom Fields ({customFields.length})
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {isEditable ? 'Click any field below to edit its label or value' : 'Locked — candidate has advanced past CV Encoding'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  {isEditable
                    ? 'Add or update employer-specific details (e.g., Video Introduction Link, Expected Salary, Availability).'
                    : 'Employer-specific custom fields recorded on this CV.'}
                </p>

                {/* Existing Custom Fields List */}
                {customFields.length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {customFields.map((field, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 rounded-lg bg-slate-50/70 border border-slate-200/80"
                      >
                        <input
                          type="text"
                          value={field.key}
                          onChange={e => handleUpdateCustomField(idx, { key: e.target.value })}
                          disabled={!isEditable}
                          placeholder="Field label"
                          aria-label={`Custom field label ${idx + 1}`}
                          className="w-2/5 border border-slate-200 bg-white px-3 py-1.5 rounded-md text-xs font-semibold text-[#0F172A] focus:border-[#0EA5E9] outline-none disabled:bg-slate-100 disabled:text-slate-600 transition-colors"
                        />
                        <input
                          type="text"
                          value={field.value}
                          onChange={e => handleUpdateCustomField(idx, { value: e.target.value })}
                          disabled={!isEditable}
                          placeholder="Field value"
                          aria-label={`Custom field value ${idx + 1}`}
                          className="flex-1 border border-slate-200 bg-white px-3 py-1.5 rounded-md text-xs text-[#0F172A] focus:border-[#0EA5E9] outline-none disabled:bg-slate-100 disabled:text-slate-600 transition-colors"
                        />
                        {isEditable && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomField(idx)}
                            title="Remove field"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic bg-slate-50 border border-dashed border-slate-200 rounded-lg px-3.5 py-2.5 mb-3">
                    No custom fields added.{isEditable ? ' Use the row below to add one.' : ''}
                  </div>
                )}

                {/* Add New Custom Field Row */}
                {isEditable && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={newFieldKey}
                      onChange={e => setNewFieldKey(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && newFieldKey.trim()) { e.preventDefault(); handleAddCustomField(); } }}
                      placeholder="New field label (e.g. YouTube Link)"
                      className="w-2/5 border border-slate-200 px-3 py-2 rounded-lg text-xs text-[#0F172A] focus:border-[#0EA5E9] outline-none transition-colors"
                    />
                    <input
                      type="text"
                      value={newFieldValue}
                      onChange={e => setNewFieldValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && newFieldKey.trim()) { e.preventDefault(); handleAddCustomField(); } }}
                      placeholder="Value (e.g. https://youtu.be/...)"
                      className="flex-1 border border-slate-200 px-3 py-2 rounded-lg text-xs text-[#0F172A] focus:border-[#0EA5E9] outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomField}
                      disabled={!newFieldKey.trim()}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer flex-shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Field
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Primary Action Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-wrap gap-3">
              {isEditable ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowReturnModal(true)}
                    disabled={isLocked || isSubmittingReturn}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-900 px-2.5 py-1.5 rounded-lg hover:bg-amber-50 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
                    title="Return candidate to Applicant Profiling"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    Return to Profiling
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      disabled={!canSaveDraft || isSaving}
                      className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg disabled:opacity-40 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      {cvRecord ? 'Save Changes' : 'Save Draft'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitForApproval}
                      disabled={!canSubmit || isSubmitting}
                      className="px-4 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-40 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      {cvRecord?.status_code === 'REJECTED'
                        ? 'Resubmit for Approval'
                        : cvRecord?.status_code === 'PENDING_APPROVAL'
                          ? (hasUnsavedChanges ? 'Update Pending CV' : 'Awaiting Manager Review')
                          : 'Submit for Approval'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full flex items-center justify-between flex-wrap gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    Editing and resubmission are disabled once a candidate has advanced past CV Encoding.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPreview(true)}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#0EA5E9]" />
                      Preview A4 CV
                    </button>
                    <button
                      type="button"
                      onClick={handleExportToPDF}
                      disabled={isExporting}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#0EA5E9] hover:bg-[#0284C7] text-white flex items-center gap-1.5 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      Export PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT COLUMN (5 cols): Compact Candidate Profile Reference ── */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-[#0F172A]">Candidate Profile Reference</span>
              {/* Compact Segmented Filter Pills */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/80">
                {([
                  ['personal', 'Personal', <User className="w-3 h-3" key="u" />],
                  ['experience', `Work (${(currentApplicant.employmentHistory || []).length})`, <Briefcase className="w-3 h-3" key="b" />],
                  ['education', `Edu (${(currentApplicant.education || []).length})`, <GraduationCap className="w-3 h-3" key="g" />],
                  ['skills', 'Skills', <Star className="w-3 h-3" key="s" />],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setProfileTab(key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      profileTab === key
                        ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 max-h-[460px] overflow-y-auto">
              {profileTab === 'personal' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                    {[
                      ['Full Name', currentApplicant.name],
                      ['Applied Position', currentApplicant.role || currentApplicant.appliedRole],
                      ['Date of Birth', currentApplicant.dateOfBirth],
                      ['Age / Sex', `${currentApplicant.age ? `${currentApplicant.age} yrs` : '—'} · ${currentApplicant.sex || '—'}`],
                      ['Civil Status', currentApplicant.civilStatus],
                      ['Children', currentApplicant.noOfChildren !== undefined && currentApplicant.noOfChildren !== null ? String(currentApplicant.noOfChildren) : '0'],
                      ['Religion', currentApplicant.religion],
                      ['Citizenship', currentApplicant.citizenship || 'Filipino'],
                      ['Height / Weight', `${currentApplicant.heightCm ? `${currentApplicant.heightCm} cm` : '—'} / ${currentApplicant.weightKg ? `${currentApplicant.weightKg} kg` : '—'}`],
                      ['Mobile No.', currentApplicant.contact],
                      ['Email', currentApplicant.email],
                      ['Present Address', currentApplicant.presentAddress],
                    ].map(([label, val]) => (
                      <div key={label} className={label === 'Present Address' || label === 'Email' ? 'col-span-2' : ''}>
                        <p className="text-[10px] uppercase font-semibold text-slate-400">{label}</p>
                        <p className="font-medium text-[#0F172A] break-words">
                          {val || <span className="text-slate-400 italic">—</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                  {currentApplicant.emergencyContactName && (
                    <div className="pt-2.5 border-t border-slate-100 text-xs">
                      <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Emergency Contact</p>
                      <p className="font-medium text-[#0F172A]">
                        {currentApplicant.emergencyContactName} ({currentApplicant.emergencyContactRelationship || 'Contact'}) · {currentApplicant.emergencyContactNumber || '—'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {profileTab === 'experience' && (
                <div>
                  {(currentApplicant.employmentHistory || []).length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">No employment records on file.</p>
                  ) : (
                    <div className="space-y-2">
                      {(currentApplicant.employmentHistory || []).map((e, idx) => (
                        <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                          <p className="font-bold text-[#0F172A]">{e.company}</p>
                          <p className="text-slate-600 font-medium">{e.position}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {e.dateStarted} – {e.isPresent ? 'Present' : e.dateEnded} · {e.country}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {profileTab === 'education' && (
                <div>
                  {(currentApplicant.education || []).length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">No education records on file.</p>
                  ) : (
                    <div className="space-y-2">
                      {(currentApplicant.education || []).map((ed, idx) => (
                        <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                          <p className="font-bold text-[#0F172A]">{ed.school}</p>
                          <p className="text-slate-500">{ed.level} — {ed.course || 'N/A'} · {ed.yearGraduated || 'N/A'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {profileTab === 'skills' && (
                <div className="space-y-3 text-xs">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5">Skills</p>
                    {(currentApplicant.skills || []).length === 0 ? (
                      <span className="text-slate-400 italic">None on file</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {(currentApplicant.skills || []).map(s => (
                          <span key={s} className="px-2 py-0.5 bg-sky-50 text-[#0EA5E9] border border-sky-100 text-xs font-semibold rounded-md">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5">Languages</p>
                    {(currentApplicant.languageRecords || []).length === 0 ? (
                      <span className="text-slate-400 italic">None on file</span>
                    ) : (
                      <div className="space-y-1">
                        {(currentApplicant.languageRecords || []).map((l, i) => (
                          <div key={i} className="flex items-center justify-between py-0.5">
                            <span className="font-medium text-[#0F172A]">{l.language}</span>
                            <span className="text-slate-500">Spoken {l.spokenRating}/5 · Written {l.writtenRating}/5</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5">Certifications</p>
                    {(currentApplicant.certifications || []).length === 0 ? (
                      <span className="text-slate-400 italic">None on file</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {(currentApplicant.certifications || []).map(c => (
                          <span key={c} className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200/80 text-xs font-semibold rounded-md">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-1.5">
              <Lock className="w-3 h-3 flex-shrink-0" />
              <span>Profile data is pulled live from Candidate Registration.</span>
            </div>
          </div>

          {/* ── Live CV Preview Overlay Modal ── */}
          {showPreview && currentApplicant && (
            <div
              className="fixed inset-0 z-[100] flex flex-col bg-black/80 backdrop-blur-sm"
              onClick={(e) => { if (e.target === e.currentTarget) setShowPreview(false); }}
            >
              <div className="flex items-center justify-between px-6 py-3 bg-[#1e293b] border-b border-white/10 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <Eye className="w-4 h-4 text-white/60" />
                  <span className="text-white font-bold text-sm">
                    CV Preview — {currentApplicant.name}
                  </span>
                  <span className="px-2 py-0.5 bg-white/10 text-white/80 rounded text-[11px] font-mono">
                    {hasPage2 ? '2 Pages · A4' : '1 Page · A4'}
                  </span>
                  {cvRecord && (
                    <span className="text-white/40 text-xs">CV #{cvRecord.cv_id}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setZoomLevel(z => Math.max(0.3, +(z - 0.1).toFixed(1)))}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Zoom out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-white/60 text-xs font-mono min-w-[48px] text-center">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    onClick={() => setZoomLevel(z => Math.min(2, +(z + 0.1).toFixed(1)))}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Zoom in"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <div className="w-px h-5 bg-white/20 mx-1" />
                  <button
                    onClick={handleExportToPDF}
                    disabled={isExporting}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export PDF
                  </button>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors ml-1"
                    title="Close preview (Esc)"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto flex items-start justify-center p-8 bg-slate-900/80">
                <div
                  style={{
                    width: 794 * zoomLevel,
                    minHeight: (hasPage2 ? 2340 : 1160) * zoomLevel,
                    flexShrink: 0,
                    position: 'relative',
                    paddingBottom: 40 * zoomLevel,
                  }}
                >
                  <div
                    style={{
                      transformOrigin: 'top left',
                      transform: `scale(${zoomLevel})`,
                      width: 794,
                    }}
                  >
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
        </div>
      )}

      {/* ── Return to Profiling Modal ── */}
      {showReturnModal && currentApplicant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-amber-900">
                <Undo2 className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="font-bold text-base">Return Candidate to Profiling</h3>
                  <p className="text-xs text-amber-700">Moves candidate back to Applicant Profiling and removes them from CV Encoding</p>
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

            <div className="p-6 space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800 text-sm">{currentApplicant.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {currentApplicant.role || currentApplicant.appliedRole || 'Candidate'} · {currentApplicant.applicantCode || `#APP-${currentApplicant.id}`}
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-md border border-amber-200">
                  CV Encoding → Profiling
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
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
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Notes for Profiling Team <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={returnNotes}
                  onChange={e => setReturnNotes(e.target.value)}
                  placeholder="Explain why candidate is returning to profiling..."
                  className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-800 focus:border-[#0EA5E9] outline-none resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                disabled={isSubmittingReturn}
                className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmReturnToProfiling()}
                disabled={isSubmittingReturn || !returnNotes.trim()}
                className="px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-1.5 disabled:opacity-40 shadow-xs transition-colors cursor-pointer"
              >
                {isSubmittingReturn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
