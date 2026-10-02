import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock, Upload, Users, CheckCircle2, RefreshCw, Loader2, GripVertical,
  ChevronRight, Calendar, Link, FileText, Trash2, AlertCircle, Send
} from 'lucide-react';
import { ApplicantRecord, ActivityLog } from '../../types';
import { Skeleton, SkeletonText } from '../ui/skeleton';
import { api } from '../../../lib/api';

interface EndorsementTrackerProps {
  applicants?: ApplicantRecord[];
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  updateApplicant: (applicantId: string, updates: Partial<ApplicantRecord>) => void;
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
  admin_notes: string | null;
  stage_updated_by: string | null;
  stage_updated_at: string | null;
  created_at: string;
  updated_at: string;
  // Enriched by backend
  applicant_name: string;
  applied_role: string;
  job_order_code: string;
}

const STAGES = [
  {
    code: 'MANAGER_APPROVED' as const,
    label: 'Manager Approved',
    shortLabel: 'Approved',
    color: '#10b981',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    accent: 'border-l-[#10b981]',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
    desc: 'CVs approved by Manager, ready to upload to employer portal',
    nextAction: 'Confirm External Upload',
    nextStage: 'UPLOADED_TO_PORTAL' as const,
  },
  {
    code: 'UPLOADED_TO_PORTAL' as const,
    label: 'Uploaded to Portal',
    shortLabel: 'Uploaded',
    color: '#0ea5e9',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    accent: 'border-l-[#0ea5e9]',
    icon: <Upload className="w-4 h-4 text-sky-600" />,
    desc: 'CV uploaded to foreign employer portal, awaiting employer response',
    nextAction: 'Confirm Employer Waiting',
    nextStage: 'WAITING_SELECTION' as const,
  },
  {
    code: 'WAITING_SELECTION' as const,
    label: 'Waiting Selection',
    shortLabel: 'Waiting',
    color: '#f59e0b',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    accent: 'border-l-[#f59e0b]',
    icon: <Users className="w-4 h-4 text-amber-600" />,
    desc: 'Employer is reviewing candidates — awaiting hiring decision',
    nextAction: 'Endorse to Admin',
    nextStage: 'ENDORSED_TO_ADMIN' as const,
  },
  {
    code: 'ENDORSED_TO_ADMIN' as const,
    label: 'Endorsed to Admin',
    shortLabel: 'Endorsed',
    color: '#8b5cf6',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    accent: 'border-l-[#8b5cf6]',
    icon: <Send className="w-4 h-4 text-violet-600" />,
    desc: 'Employer selected the candidate — endorsed to Admin for final processing',
    nextAction: null,
    nextStage: null,
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

interface KanbanCardProps {
  card: CvSubmission;
  stage: typeof STAGES[number];
  onAdvance: (submissionId: number, nextStage: CvSubmission['board_stage_code'], extra?: Record<string, any>) => void;
  onRemove: (submissionId: number) => void;
  isActing: boolean;
}

function KanbanCard({ card, stage, onAdvance, onRemove, isActing }: KanbanCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [uploadRef, setUploadRef] = useState(card.ext_upload_ref || '');
  const [selectionDate, setSelectionDate] = useState(card.selection_date || '');
  const [adminNotes, setAdminNotes] = useState(card.admin_notes || '');

  const handleAdvance = () => {
    if (!stage.nextStage || isActing) return;
    const extra: Record<string, any> = {};
    if (stage.code === 'MANAGER_APPROVED' && uploadRef.trim()) extra.extUploadRef = uploadRef.trim();
    if (stage.code === 'UPLOADED_TO_PORTAL' && selectionDate) extra.selectionDate = selectionDate;
    if (stage.code === 'WAITING_SELECTION') extra.adminNotes = adminNotes.trim() || undefined;
    onAdvance(card.submission_id, stage.nextStage!, extra);
  };

  const name = card.applicant_name || `Applicant #${card.applicant_id}`;
  const role = card.applied_role || '—';
  const joCode = card.job_order_code || (card.job_order_id ? `JO-${card.job_order_id}` : '—');

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 border-l-4 ${stage.accent} overflow-hidden transition-all`}>
      <div
        className="p-4 cursor-pointer hover:bg-slate-50/60 transition-colors"
        onClick={() => setExpanded(o => !o)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-[#0F172A] text-sm truncate">{name}</p>
            <p className="text-xs text-[#64748B] font-medium mt-0.5">{role}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-mono">{joCode} · Sub #{card.submission_id}</p>
          </div>
          <button className="flex-shrink-0 text-slate-300 hover:text-slate-500 transition-colors">
            {expanded
              ? <ChevronRight className="w-4 h-4 rotate-90 transition-transform" />
              : <ChevronRight className="w-4 h-4 transition-transform" />
            }
          </button>
        </div>

        {card.stage_updated_at && (
          <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-400">
            <Clock className="w-3 h-3" />
            {new Date(card.stage_updated_at).toLocaleDateString('en-PH')}
            {card.stage_updated_by && ` · ${card.stage_updated_by}`}
          </div>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 space-y-3 pt-3">
          {/* Upload ref field for MANAGER_APPROVED stage */}
          {stage.code === 'MANAGER_APPROVED' && (
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                Portal Upload Reference (optional)
              </label>
              <input
                type="text"
                value={uploadRef}
                onChange={e => setUploadRef(e.target.value)}
                placeholder="e.g. POEA-2026-0091 or employer ATS link"
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:border-[#0EA5E9] outline-none"
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}

          {/* Existing upload ref display */}
          {stage.code === 'UPLOADED_TO_PORTAL' && card.ext_upload_ref && (
            <div className="flex items-center gap-1.5 text-xs text-[#0EA5E9]">
              <Link className="w-3 h-3" />
              <span>{card.ext_upload_ref}</span>
            </div>
          )}

          {/* Selection date for UPLOADED stage */}
          {stage.code === 'UPLOADED_TO_PORTAL' && (
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                Selection Date (optional)
              </label>
              <input
                type="date"
                value={selectionDate}
                onChange={e => setSelectionDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:border-[#0EA5E9] outline-none"
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}

          {/* Admin notes for WAITING_SELECTION */}
          {stage.code === 'WAITING_SELECTION' && (
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                Admin Notes
              </label>
              <textarea
                rows={2}
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
                placeholder="Notes for Admin on final processing..."
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs resize-none focus:border-[#0EA5E9] outline-none"
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}

          {/* Endorsed summary for ENDORSED_TO_ADMIN */}
          {stage.code === 'ENDORSED_TO_ADMIN' && card.admin_notes && (
            <div className="bg-violet-50 rounded-lg p-2 text-xs text-violet-700">
              <span className="font-bold">Admin notes:</span> {card.admin_notes}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(card.submission_id); }}
              disabled={isActing}
              className="p-1.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
              title="Remove from board"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            {stage.nextAction && (
              <button
                onClick={(e) => { e.stopPropagation(); handleAdvance(); }}
                disabled={isActing}
                style={{ background: stage.color }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity shadow-sm"
              >
                {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
                {stage.nextAction}
              </button>
            )}

            {stage.code === 'ENDORSED_TO_ADMIN' && (
              <span className="text-[10px] text-violet-500 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Final Stage
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EndorsementTracker({
  applicants = [],
  currentUserName,
  addActivityLog,
  updateApplicant,
}: EndorsementTrackerProps) {
  const [submissions, setSubmissions] = useState<CvSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);

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

  const handleAdvance = async (
    submissionId: number,
    nextStage: CvSubmission['board_stage_code'],
    extra: Record<string, any> = {}
  ) => {
    setActingId(submissionId);
    try {
      const res = await api.patch(`/cv-submissions/${submissionId}`, {
        boardStageCode: nextStage,
        ...extra,
      });
      const updated: CvSubmission = res.data;
      setSubmissions(prev => prev.map(s => s.submission_id === submissionId ? updated : s));

      // Update applicant phase for the ENDORSED_TO_ADMIN transition
      if (nextStage === 'ENDORSED_TO_ADMIN') {
        const app = applicants.find(a => String(a.id) === String(updated.applicant_id));
        if (app) {
          updateApplicant(String(app.id), {
            phase: 5,
            status: 'Endorse for Administrative Processing',
            currentHandler: 'Admin',
            currentDepartment: 'Admin',
            phaseDescription: 'Employer confirmed selection. Admin & Accounting deployment modules unlocked.',
          });

          const numId = parseInt(String(app.id), 10);
          if (!isNaN(numId)) {
            api.put(`/applicants/${numId}`, {
              application_id: app.applicationId,
              application_status: 'Endorse for Administrative Processing',
              current_phase: 5,
              current_handler: 'Admin',
              current_department: 'Admin',
              phase_description: 'Employer confirmed selection. Admin & Accounting deployment modules unlocked.',
              statusChangeReason: 'Candidate endorsed to Admin from Endorsement Tracker',
              statusChangeSource: 'ENDORSEMENT_TRACKER',
              updated_at: new Date().toISOString(),
            }).catch(console.error);
          }
        }
        addActivityLog({
          applicantId: String(updated.applicant_id),
          action: 'Endorsed to Admin',
          performedBy: currentUserName,
          department: 'Recruitment',
          details: `Submission #${submissionId} moved to Endorsed to Admin. Phase 5 unlocked.`,
        });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err.message;
      alert(`Failed to advance stage: ${msg}`);
    } finally {
      setActingId(null);
    }
  };

  const handleRemove = async (submissionId: number) => {
    if (!confirm('Remove this card from the Endorsement Tracker board?')) return;
    setActingId(submissionId);
    try {
      await api.delete(`/cv-submissions/${submissionId}`);
      setSubmissions(prev => prev.filter(s => s.submission_id !== submissionId));
    } catch {
      alert('Failed to remove card');
    } finally {
      setActingId(null);
    }
  };

  const byStage = (stageCode: string) =>
    submissions.filter(s => s.board_stage_code === stageCode);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#0F172A]">Endorsement Tracker</h2>
          <p className="text-sm text-[#64748B] mt-1 font-medium">
            Track approved CVs from manager approval to employer selection and admin endorsement.
          </p>
        </div>
        <button
          onClick={load}
          className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Kanban Board — 4 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STAGES.map(stage => {
          const cards = byStage(stage.code);
          return (
            <div
              key={stage.code}
              className={`rounded-xl p-4 flex flex-col min-h-[520px] border ${stage.border} ${stage.bg}`}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {stage.icon}
                  <p className="text-xs uppercase tracking-widest text-[#0F172A] font-black leading-tight">
                    {stage.label}
                  </p>
                </div>
                <span
                  className="px-2 py-0.5 text-xs font-bold rounded text-white"
                  style={{ background: stage.color }}
                >
                  {cards.length}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mb-3 leading-snug">{stage.desc}</p>

              {/* Cards */}
              <div className="flex-1 space-y-3 overflow-y-auto">
                {isLoading ? (
                  [1, 2].map(i => <SkeletonCard key={i} />)
                ) : cards.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center h-40 text-center">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
                      style={{ background: `${stage.color}18` }}>
                      {stage.icon}
                    </div>
                    <p className="text-xs text-slate-400 font-medium">No cards here yet</p>
                  </div>
                ) : (
                  cards.map(card => (
                    <KanbanCard
                      key={card.submission_id}
                      card={card}
                      stage={stage}
                      onAdvance={handleAdvance}
                      onRemove={handleRemove}
                      isActing={actingId === card.submission_id}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-3">Stage Flow</p>
        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
          {STAGES.map((s, i) => (
            <div key={s.code} className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full font-bold text-white text-[10px]" style={{ background: s.color }}>
                {s.shortLabel}
              </span>
              {i < STAGES.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300" />}
            </div>
          ))}
          <span className="ml-2 text-[#10b981] font-semibold">→ Phase 5 unlocked at "Endorsed to Admin"</span>
        </div>
      </div>
    </div>
  );
}
