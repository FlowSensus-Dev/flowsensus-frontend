import { useState, useEffect, useCallback } from 'react';
import {
  CheckSquare, XCircle, Clock, FileText,
  Search, Loader2, Eye, EyeOff, ThumbsUp, ThumbsDown,
  Send, RefreshCw, Download, ZoomIn, ZoomOut, CheckCircle2, ArrowRight,
  ArrowLeft, X
} from 'lucide-react';
import { WorkflowState, ApplicantRecord, ActivityLog } from '../../types';
import { SkeletonText, SkeletonBadge } from '../ui/skeleton';
import { api } from '../../../lib/api';
import { CVPreviewDoc, downloadCVPdf } from '../CVPreview';

interface ManagerHubProps {
  workflow: WorkflowState;
  updateWorkflow: (updates: Partial<WorkflowState>) => void;
  showToast: (message: string) => void;
  applicants?: ApplicantRecord[];
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  updateApplicant: (applicantId: string, updates: Partial<ApplicantRecord>) => void;
  selectedApplicantId?: string;
  onNavigate?: (view: string) => void;
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

// Candidates returned to these pre-CV statuses should not appear as active CV review items
const PRE_CV_STATUSES = [
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

const INTERNAL_CV_KEYS = ['summary_override', 'return_reason', 'returned_at', 'returned_by'];

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  DRAFT: { label: 'Draft', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
  PENDING_APPROVAL: { label: 'Pending Approval', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  REJECTED: { label: 'Rejected', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  APPROVED: { label: 'Approved', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] || STATUS_META.DRAFT;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border"
      style={{ color: m.color, background: m.bg, borderColor: m.border }}
    >
      {status === 'DRAFT' && <FileText className="w-3 h-3" />}
      {status === 'PENDING_APPROVAL' && <Clock className="w-3 h-3" />}
      {status === 'REJECTED' && <XCircle className="w-3 h-3" />}
      {status === 'APPROVED' && <CheckSquare className="w-3 h-3" />}
      {m.label}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl">
      <div className="w-10 h-10 bg-slate-200 rounded-full animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonText className="w-48 h-4" />
        <SkeletonText className="w-32 h-3" />
      </div>
      <SkeletonBadge />
    </div>
  );
}

interface CvDetailGateProps {
  cvRecord: CvRecord;
  applicant: ApplicantRecord | undefined;
  isEndorsed: boolean;
  activeSubmission?: any;
  onApprove: (cvId: number) => void;
  onReject: (cvId: number, reason: string) => Promise<boolean>;
  onEndorse: (cvId: number) => void;
  onNavigate?: (view: string) => void;
  isActing: boolean;
  onClose: () => void;
}

function CvDetailGate({
  cvRecord, applicant, isEndorsed, activeSubmission, onApprove, onReject, onEndorse, onNavigate, isActing, onClose
}: CvDetailGateProps) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(0.85);

  const canApproveOrReject = cvRecord.status_code === 'PENDING_APPROVAL';

  // Build custom fields array from cv_record for the preview (excluding internal metadata)
  const previewCustomFields = cvRecord.custom_fields
    ? Object.entries(cvRecord.custom_fields)
        .filter(([k]) => !INTERNAL_CV_KEYS.includes(k))
        .map(([key, value]) => ({ key, value: String(value) }))
    : [];
  const previewSummary = cvRecord.custom_fields?.summary_override as string | undefined;

  const previewHasPage2 = Boolean(
    applicant && (
      (applicant.employmentHistory || []).length > 0 ||
      (applicant.skills || []).length > 0 ||
      (applicant.languageRecords || []).length > 0 ||
      (applicant.certifications || []).length > 0 ||
      previewCustomFields.length > 0
    )
  );

  const handleExportPreviewPDF = async () => {
    if (!applicant) return;
    try {
      await downloadCVPdf(
        applicant,
        previewSummary || '',
        previewCustomFields,
        'Manager Hub',
        cvRecord.cv_id,
      );
    } catch (err) {
      console.error('PDF export failed:', err);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-[#F1F5F9] flex flex-col w-full h-screen overflow-hidden animate-in fade-in duration-150">
      {/* ── Top Bar Header ── */}
      <div className="px-5 sm:px-8 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-4 flex-shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer flex-shrink-0"
            title="Return to CV & Employer Hub (Esc)"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Back to Hub</span>
          </button>

          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0EA5E9] to-[#6366f1] flex items-center justify-center text-white font-bold text-sm shadow-xs flex-shrink-0">
              {(applicant?.name || '?')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-[#0F172A] text-base leading-tight truncate">
                  {applicant?.name || `Applicant #${cvRecord.applicant_id}`}
                </h3>
                <StatusBadge status={cvRecord.status_code} />
                {isEndorsed && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-300">
                    <Send className="w-3 h-3 text-sky-600" />
                    Endorsed to Tracker
                  </span>
                )}
              </div>
              <p className="text-xs text-[#64748B] flex items-center gap-1.5 mt-0.5 truncate">
                <span className="font-medium text-slate-700">{applicant?.role || applicant?.appliedRole || 'Unknown Role'}</span>
                <span>·</span>
                <span className="font-mono text-slate-500">CV #{cvRecord.cv_id}</span>
                {applicant?.jobOrder && (
                  <>
                    <span>·</span>
                    <span className="text-slate-500 truncate">{applicant.jobOrder}</span>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Right Header Controls & Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {canApproveOrReject && !showRejectForm && (
            <>
              <button
                type="button"
                onClick={() => setShowRejectForm(true)}
                className="px-3.5 py-1.5 text-xs font-bold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
                <span>Reject</span>
              </button>
              <button
                type="button"
                onClick={() => onApprove(cvRecord.cv_id)}
                disabled={isActing}
                className="px-4 py-1.5 text-xs font-bold bg-[#10B981] hover:bg-[#059669] text-white rounded-xl flex items-center gap-1.5 disabled:opacity-40 shadow-xs transition-colors cursor-pointer"
              >
                {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
                <span>Approve CV</span>
              </button>
            </>
          )}

          {cvRecord.status_code === 'APPROVED' && (
            isEndorsed ? (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Already Endorsed
                </span>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigate('endorsement');
                    }}
                    className="px-3.5 py-1.5 text-xs font-bold bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    title="Open Endorsement Tracker"
                  >
                    <span>View in Tracker</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onEndorse(cvRecord.cv_id)}
                disabled={isActing}
                className="px-4 py-1.5 text-xs font-bold bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded-xl flex items-center gap-1.5 disabled:opacity-40 shadow-xs transition-colors cursor-pointer"
              >
                {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Endorse to Tracker</span>
              </button>
            )
          )}

          <button
            type="button"
            onClick={handleExportPreviewPDF}
            disabled={!applicant}
            className="px-3 py-1.5 text-xs font-bold text-sky-700 border border-sky-200 bg-sky-50 hover:bg-sky-100 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Download formatted CV PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export PDF</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Main Full-Screen Workspace (2-Column Layout) ── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-100">
        {/* Left Column: Full-Height Interactive A4 CV Canvas */}
        <div className="flex-1 h-full flex flex-col bg-slate-800 overflow-hidden min-w-0">
          {/* Document canvas top toolbar */}
          <div className="flex items-center justify-between px-6 py-2.5 bg-slate-900 border-b border-slate-700/80 text-white flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold text-slate-200">A4 Document Viewer</span>
              <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                {previewHasPage2 ? '2 Pages · A4' : '1 Page · A4'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomLevel(z => Math.max(0.4, +(z - 0.1).toFixed(1)))}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                title="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-slate-300 text-xs font-mono w-12 text-center select-none">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel(z => Math.min(1.6, +(z + 0.1).toFixed(1)))}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                title="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(0.85)}
                className="px-2 py-0.5 text-[11px] font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                title="Reset zoom to 85%"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Scrollable A4 Preview Area */}
          <div className="flex-1 overflow-auto p-6 lg:p-10 flex justify-center items-start">
            {applicant ? (
              <div
                style={{
                  transformOrigin: 'top center',
                  transform: `scale(${zoomLevel})`,
                  width: 794,
                  flexShrink: 0,
                  marginBottom: `${(previewHasPage2 ? 2340 : 1160) * (zoomLevel - 1)}px`,
                }}
                className="shadow-2xl ring-1 ring-black/40 rounded-sm"
              >
                <CVPreviewDoc
                  applicant={applicant}
                  summaryOverride={previewSummary}
                  customFields={previewCustomFields}
                  cvId={cvRecord.cv_id}
                />
              </div>
            ) : (
              <div className="text-center py-20 text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No applicant record linked to this CV</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Review Details & Audit Inspector */}
        <div className="w-full lg:w-[420px] xl:w-[460px] h-full flex flex-col bg-white border-l border-slate-200 overflow-y-auto flex-shrink-0">
          <div className="p-6 space-y-5 flex-1">
            {/* Rejection Form Box if active */}
            {showRejectForm && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                  <XCircle className="w-4 h-4" />
                  <span>Provide Rejection Reason</span>
                </div>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Specify what needs correction in this CV..."
                  className="w-full border-2 border-red-200 px-3 py-2 rounded-lg text-sm focus:border-red-400 outline-none resize-none bg-white"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(false)}
                    className="px-3 py-1.5 text-xs font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!rejectionReason.trim() || isActing) return;
                      const ok = await onReject(cvRecord.cv_id, rejectionReason.trim());
                      if (ok) {
                        setRejectionReason('');
                        setShowRejectForm(false);
                        onClose();
                      }
                    }}
                    disabled={!rejectionReason.trim() || isActing}
                    className="px-4 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsDown className="w-3.5 h-3.5" />}
                    <span>Confirm Rejection</span>
                  </button>
                </div>
              </div>
            )}

            {/* Rejection Notice if already rejected */}
            {cvRecord.status_code === 'REJECTED' && cvRecord.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-1">Rejection Reason</p>
                <p className="text-sm text-red-700">{cvRecord.rejection_reason}</p>
              </div>
            )}

            {/* Approval Stamp */}
            {cvRecord.status_code === 'APPROVED' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                <CheckSquare className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-800">Approved by {cvRecord.approved_by || 'Manager'}</p>
                  {cvRecord.approved_at && (
                    <p className="text-xs text-emerald-600 mt-0.5">
                      {new Date(cvRecord.approved_at).toLocaleString('en-PH')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Endorsement Active Banner */}
            {isEndorsed && (
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-sky-900 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-sky-600 flex-shrink-0" />
                  <span>
                    Actively endorsed in <strong>Endorsement Tracker</strong>
                    {activeSubmission?.board_stage_code ? ` (${activeSubmission.board_stage_code.replace(/_/g, ' ')})` : ''}.
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded font-mono font-bold bg-sky-100 text-sky-700 text-[10px]">
                  Phase 4 Active
                </span>
              </div>
            )}

            {/* Applicant Snapshot Card */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-3 flex items-center justify-between">
                <span>Applicant Snapshot</span>
                <span className="text-[10px] text-slate-400 font-normal">Candidate Records</span>
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {[
                  ['Name', applicant?.name || '—'],
                  ['Position', applicant?.role || applicant?.appliedRole || '—'],
                  ['Phase', applicant?.phase != null ? `Phase ${applicant.phase}` : '—'],
                  ['Status', applicant?.status || '—'],
                  ['Email', applicant?.email || '—'],
                  ['Contact', applicant?.contact || '—'],
                  ['Job Order', applicant?.jobOrder || '—'],
                  ['Passport', applicant?.passport || '—'],
                ].map(([l, v]) => (
                  <div key={l} className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">{l}</p>
                    <p className="font-semibold text-[#0F172A] truncate" title={String(v)}>{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Professional Summary */}
            {cvRecord.custom_fields?.summary_override && (
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-bold text-[#0EA5E9] uppercase tracking-wide mb-1.5">Professional Summary</p>
                <p className="text-sm text-[#0F172A] leading-relaxed italic">"{cvRecord.custom_fields.summary_override}"</p>
              </div>
            )}

            {/* Custom Fields */}
            {previewCustomFields.length > 0 && (
              <div>
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-2">Custom / Supplementary Fields</p>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {previewCustomFields.map(({ key: k, value: v }) => (
                        <tr key={k} className="border-b border-slate-100 last:border-0">
                          <td className="px-3.5 py-2 font-semibold text-[#475569] bg-slate-50 w-2/5 text-xs">{k}</td>
                          <td className="px-3.5 py-2 text-[#0F172A] text-xs font-medium">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Panel Footer Actions */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs text-slate-500 font-mono font-medium">CV ID: #{cvRecord.cv_id}</span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Close Workspace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ManagerHub({
  updateWorkflow,
  showToast,
  applicants = [],
  currentUserName,
  addActivityLog,
  updateApplicant,
  onNavigate,
}: ManagerHubProps) {
  const [cvRecords, setCvRecords] = useState<CvRecord[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCv, setSelectedCv] = useState<CvRecord | null>(null);
  const [isActing, setIsActing] = useState(false);

  const loadCvRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cvRes, subRes] = await Promise.all([
        api.get('/cv').catch(() => ({ data: [] })),
        api.get('/cv-submissions').catch(() => ({ data: [] })),
      ]);
      setCvRecords(cvRes.data || []);
      setSubmissions(subRes.data || []);
    } catch {
      setCvRecords([]);
      setSubmissions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCvRecords();
  }, [loadCvRecords]);

  // ─── Approve ──────────────────────────────────────────────────────────────────
  const handleApprove = async (cvId: number) => {
    setIsActing(true);
    try {
      const res = await api.patch(`/cv/${cvId}`, { statusCode: 'APPROVED' });
      const updated: CvRecord = res.data;
      setCvRecords(prev => prev.map(r => r.cv_id === cvId ? updated : r));
      if (selectedCv?.cv_id === cvId) setSelectedCv(updated);

      // Update workflow flag
      updateWorkflow({ cvApproved: true });

      const app = applicants.find(a => String(a.id) === String(updated.applicant_id));
      const effectiveJobOrderId = updated.job_order_id
        || (app?.selectedJobOrderId && !isNaN(Number(app.selectedJobOrderId)) ? Number(app.selectedJobOrderId) : undefined)
        || (app as any)?.job_order_id
        || (app as any)?.jobOrderId;

      // Auto-create submission card in Endorsement Tracker (Stage 1: MANAGER_APPROVED)
      try {
        const subRes = await api.post('/cv-submissions', {
          cvId,
          applicantId: updated.applicant_id,
          jobOrderId: effectiveJobOrderId || undefined,
          boardStageCode: 'MANAGER_APPROVED',
        });
        if (subRes.data) {
          setSubmissions(prev => [...prev.filter(s => s.submission_id !== subRes.data.submission_id), subRes.data]);
        }
      } catch (subErr) {
        console.warn('Submission creation warning (may already exist):', subErr);
      }

      if (app) {
        updateApplicant(String(app.id), {
          phase: 4,
          status: 'CV Approved - Sending to Employer',
          currentHandler: currentUserName,
          currentDepartment: 'Management',
          phaseDescription: 'CV approved by management and endorsed to Tracker. Ready for employer submission.',
        });

        const numId = parseInt(String(app.id), 10);
        if (!isNaN(numId)) {
          await api.put(`/applicants/${numId}`, {
            application_id: app.applicationId,
            application_status: 'CV Approved - Sending to Employer',
            current_phase: 4,
            current_handler: currentUserName,
            current_department: 'Management',
            phase_description: 'CV approved by management and endorsed to Tracker. Ready for employer submission.',
            statusChangeReason: 'Manager approved CV and endorsed to Tracker',
            statusChangeSource: 'MANAGER_HUB',
            updated_at: new Date().toISOString(),
          }).catch(console.error);
        }
      }

      addActivityLog({
        applicantId: String(updated.applicant_id),
        action: 'CV Approved by Manager',
        performedBy: currentUserName,
        department: 'Management',
        details: `CV #${cvId} approved. Endorsed to Endorsement Tracker (Manager Approved stage).`,
      });

      showToast('✓ CV approved and pushed to Endorsement Tracker!');
    } catch (err: any) {
      showToast(`❌ Approval failed: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setIsActing(false);
    }
  };

  // ─── Reject ───────────────────────────────────────────────────────────────────
  const handleReject = async (cvId: number, reason: string): Promise<boolean> => {
    setIsActing(true);
    try {
      const res = await api.patch(`/cv/${cvId}`, {
        statusCode: 'REJECTED',
        rejectionReason: reason,
      });
      const updated: CvRecord = res.data;
      setCvRecords(prev => prev.map(r => r.cv_id === cvId ? updated : r));
      if (selectedCv?.cv_id === cvId) setSelectedCv(updated);

      const app = applicants.find(a => String(a.id) === String(updated.applicant_id));
      if (app) {
        updateApplicant(String(app.id), {
          status: 'CV Encoding',
          currentHandler: currentUserName,
          currentDepartment: 'Recruitment',
          phaseDescription: 'CV rejected by management — requires revision.',
        });

        const numId = parseInt(String(app.id), 10);
        if (!isNaN(numId)) {
          await api.put(`/applicants/${numId}`, {
            application_id: app.applicationId,
            application_status: 'CV Encoding',
            current_phase: 3,
            current_handler: currentUserName,
            current_department: 'Recruitment',
            phase_description: `CV rejected by management: ${reason}`,
            statusChangeReason: `Manager rejected CV: ${reason}`,
            statusChangeSource: 'MANAGER_HUB',
            updated_at: new Date().toISOString(),
          }).catch(console.error);
        }
      }

      addActivityLog({
        applicantId: String(updated.applicant_id),
        action: 'CV Rejected by Manager',
        performedBy: currentUserName,
        department: 'Management',
        details: `CV #${cvId} rejected. Reason: ${reason}`,
      });

      showToast('✓ CV sent back for revision — the encoder has been notified to edit and resubmit.');
      return true;
    } catch (err: any) {
      showToast(`❌ Rejection failed: ${err?.response?.data?.detail || err.message}`);
      return false;
    } finally {
      setIsActing(false);
    }
  };

  // ─── Endorse to Tracker ───────────────────────────────────────────────────────
  const handleEndorse = async (cvId: number) => {
    const cvRec = cvRecords.find(r => r.cv_id === cvId);
    if (!cvRec) return;

    const app = applicants.find(a => String(a.id) === String(cvRec.applicant_id));
    const effectiveJobOrderId = cvRec.job_order_id
      || (app?.selectedJobOrderId && !isNaN(Number(app.selectedJobOrderId)) ? Number(app.selectedJobOrderId) : undefined)
      || (app as any)?.job_order_id
      || (app as any)?.jobOrderId;

    setIsActing(true);
    try {
      const subRes = await api.post('/cv-submissions', {
        cvId,
        applicantId: cvRec.applicant_id,
        jobOrderId: effectiveJobOrderId || undefined,
        boardStageCode: 'MANAGER_APPROVED',
      });
      if (subRes.data) {
        setSubmissions(prev => [...prev.filter(s => s.submission_id !== subRes.data.submission_id), subRes.data]);
      }

      // Master Key: unlock employer accepted
      updateWorkflow({ employerAccepted: true });

      if (app) {
        updateApplicant(String(app.id), {
          phase: 4,
          status: 'CV Approved - Sending to Employer',
          currentHandler: currentUserName,
          currentDepartment: 'Recruitment',
          phaseDescription: 'CV approved by management and endorsed to Tracker. Ready for employer submission.',
        });

        const numId = parseInt(String(app.id), 10);
        if (!isNaN(numId)) {
          await api.put(`/applicants/${numId}`, {
            application_id: app.applicationId,
            application_status: 'CV Approved - Sending to Employer',
            current_phase: 4,
            current_handler: currentUserName,
            current_department: 'Recruitment',
            phase_description: 'CV approved by management and endorsed to Tracker. Ready for employer submission.',
            statusChangeReason: 'CV endorsed to Employer Tracker',
            statusChangeSource: 'MANAGER_HUB',
            updated_at: new Date().toISOString(),
          }).catch(console.error);
        }
      }

      addActivityLog({
        applicantId: String(cvRec.applicant_id),
        action: 'CV Endorsed to Tracker (Master Key)',
        performedBy: currentUserName,
        department: 'Management',
        details: `CV #${cvId} pushed to Endorsement Tracker (MANAGER_APPROVED stage). Phase 4 unlocked.`,
      });

      showToast('✓ CV endorsed to Employer Tracker! Phase 4 now active.');
      await loadCvRecords();
    } catch (err: any) {
      showToast(`❌ Endorsement failed: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setIsActing(false);
    }
  };

  // ─── Endorsement Detection ───────────────────────────────────────────────────
  const getSubmissionForCv = useCallback((cvId: number, applicantId: number) => {
    return submissions.find(s => s.cv_id === cvId || s.applicant_id === applicantId);
  }, [submissions]);

  const isCvEndorsed = useCallback((cv: CvRecord) => {
    return Boolean(getSubmissionForCv(cv.cv_id, cv.applicant_id));
  }, [getSubmissionForCv]);

  // Exclude CV records whose applicant was returned to Applicant Profiling or an earlier stage
  const activeCvRecords = cvRecords.filter(cv => {
    const app = applicants.find(a => String(a.id) === String(cv.applicant_id));
    if (!app) return true;
    if (app.isStopped) return false;
    const s = String(app.status || '').trim();
    return !PRE_CV_STATUSES.includes(s);
  });

  // ─── Filtered list ────────────────────────────────────────────────────────────
  const filtered = activeCvRecords.filter(cv => {
    const app = applicants.find(a => String(a.id) === String(cv.applicant_id));
    const q = searchQuery.toLowerCase();
    const matchSearch = !q
      || (app?.name || '').toLowerCase().includes(q)
      || (app?.role || '').toLowerCase().includes(q)
      || String(cv.cv_id).includes(q);
    const matchStatus = statusFilter === 'all' || cv.status_code === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    all: activeCvRecords.length,
    DRAFT: activeCvRecords.filter(r => r.status_code === 'DRAFT').length,
    PENDING_APPROVAL: activeCvRecords.filter(r => r.status_code === 'PENDING_APPROVAL').length,
    APPROVED: activeCvRecords.filter(r => r.status_code === 'APPROVED').length,
    REJECTED: activeCvRecords.filter(r => r.status_code === 'REJECTED').length,
  };

  const selectedCvApplicant = selectedCv
    ? applicants.find(a => String(a.id) === String(selectedCv.applicant_id))
    : undefined;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#0F172A] flex items-center gap-2">
            <CheckSquare className="w-8 h-8 text-[#10B981]" />
            CV & Employer Hub
          </h2>
          <p className="text-sm text-[#64748B] mt-1 font-medium">
            Review, approve, or reject CVs — then endorse approved CVs to the Employer Tracker (Master Key).
          </p>
        </div>
        <button
          onClick={loadCvRecords}
          className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          ['all', 'All', counts.all],
          ['PENDING_APPROVAL', 'Pending Review', counts.PENDING_APPROVAL],
          ['APPROVED', 'Approved', counts.APPROVED],
          ['REJECTED', 'Rejected', counts.REJECTED],
          ['DRAFT', 'Draft', counts.DRAFT],
        ] as const).map(([val, label, count]) => (
          <button
            key={val}
            onClick={() => setStatusFilter(val)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${statusFilter === val
              ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
          >
            {label}
            {(count as number) > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-white/20">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by applicant name, role, or CV ID..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-sm focus:border-[#0EA5E9] outline-none transition-colors"
        />
      </div>

      {/* List */}
      <div className="space-y-2">
        {isLoading ? (
          [1, 2, 3, 4].map(i => <SkeletonRow key={i} />)
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
            <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="font-bold text-slate-400">
              {activeCvRecords.length === 0 ? 'No CV records yet — staff must submit CVs from the CV Encoding module.' : 'No records match your filter.'}
            </p>
          </div>
        ) : (
          filtered.map(cv => {
            const app = applicants.find(a => String(a.id) === String(cv.applicant_id));
            return (
              <div
                key={cv.cv_id}
                className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:border-[#0EA5E9]/40 hover:shadow-sm cursor-pointer transition-all group"
                onClick={() => setSelectedCv(cv)}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0EA5E9] to-[#6366f1] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {(app?.name || '?')[0].toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#0F172A] truncate">
                    {app?.name || `Applicant #${cv.applicant_id}`}
                  </p>
                  <p className="text-xs text-[#64748B] truncate">
                    {app?.role || app?.appliedRole || 'Unknown Role'}
                    {app?.jobOrder ? ` · ${app.jobOrder}` : ''}
                    {' · '}CV #{cv.cv_id}
                  </p>
                </div>

                {/* Submitted on */}
                <div className="hidden sm:block text-right flex-shrink-0">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Submitted</p>
                  <p className="text-xs text-slate-600 font-medium">
                    {new Date(cv.updated_at).toLocaleDateString('en-PH')}
                  </p>
                </div>

                {/* Status */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <StatusBadge status={cv.status_code} />
                  {isCvEndorsed(cv) && (
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                      <Send className="w-2.5 h-2.5 text-sky-600" />
                      In Tracker
                    </span>
                  )}
                </div>

                {/* Arrow */}
                <Eye className="w-4 h-4 text-slate-300 group-hover:text-[#0EA5E9] transition-colors flex-shrink-0" />
              </div>
            );
          })
        )}
      </div>

      {/* Detail gate modal */}
      {selectedCv && (() => {
        const sub = getSubmissionForCv(selectedCv.cv_id, selectedCv.applicant_id);
        const endorsed = isCvEndorsed(selectedCv);
        return (
          <CvDetailGate
            cvRecord={selectedCv}
            applicant={selectedCvApplicant}
            isEndorsed={endorsed}
            activeSubmission={sub}
            onApprove={handleApprove}
            onReject={handleReject}
            onEndorse={handleEndorse}
            onNavigate={onNavigate}
            isActing={isActing}
            onClose={() => setSelectedCv(null)}
          />
        );
      })()}
    </div>
  );
}
