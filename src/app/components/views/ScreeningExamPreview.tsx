/**
 * ScreeningExamPreview.tsx
 * Staff-facing digital exam preview shown inside the Screening Panel.
 * - Score %, Pass/Fail badge per assigned exam
 * - "View Full Result" (question-by-question with correct answers)
 * - "Allow Retake" (with confirmation) for completed + failed exams
 */
import { useState, useEffect, useCallback } from 'react';
import { BookOpen, CheckCircle2, XCircle, Eye, RotateCcw, Loader2, X, AlertTriangle, Clock } from 'lucide-react';
import api from '../../../lib/api';

interface Attempt {
  attempt_id: number;
  attempt_number: number;
  percentage?: number | null;
  raw_score?: number | null;
  max_score?: number | null;
  is_passing?: boolean | null;
  time_expired: boolean;
  status: string;
}

interface Summary {
  assignment_id: number;
  title: string;
  category?: string | null;
  status: string;
  retake_allowed: boolean;
  latest_attempt?: Attempt | null;
}

interface Props {
  applicantId: number | string;
  showToast?: (msg: string) => void;
}

export default function ScreeningExamPreview({ applicantId, showToast }: Props) {
  const [items, setItems] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [retakeTarget, setRetakeTarget] = useState<Summary | null>(null);
  const [granting, setGranting] = useState(false);
  const [review, setReview] = useState<any | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/exam-module/applicant/${applicantId}/exam-summary`);
      setItems(res.data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [applicantId]);

  useEffect(() => { load(); }, [load]);

  const grantRetake = async () => {
    if (!retakeTarget) return;
    setGranting(true);
    try {
      await api.patch(`/exam-module/assignments/${retakeTarget.assignment_id}/grant-retake`);
      showToast?.('Retake granted. The applicant can now retake this exam.');
      setRetakeTarget(null);
      load();
    } catch (e: any) {
      showToast?.(e?.response?.data?.detail || 'Failed to grant retake.');
    } finally {
      setGranting(false);
    }
  };

  const openReview = async (attemptId: number) => {
    setReviewLoading(true);
    try {
      const res = await api.get(`/exam-module/attempts/${attemptId}/review`);
      setReview(res.data);
    } catch {
      showToast?.('Failed to load exam result.');
    } finally {
      setReviewLoading(false);
    }
  };

  // Nothing assigned and not loading → render nothing to keep the panel clean
  if (!loading && items.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
        <BookOpen size={15} className="text-[#0EA5E9]" />
        <h3 className="text-sm font-bold text-[#0F172A]">Digital Exam Results</h3>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="animate-spin text-[#0EA5E9]" size={20} /></div>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map(it => {
            const a = it.latest_attempt;
            const submitted = a?.status === 'submitted';
            const failed = submitted && a?.is_passing === false;
            return (
              <div key={it.assignment_id} className="px-5 py-3.5 flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-sm truncate">{it.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-xs">
                    {it.category && <span className="text-slate-400">{it.category}</span>}
                    {submitted ? (
                      <>
                        <span className="font-bold text-slate-700">{(a?.percentage ?? 0).toFixed(1)}%</span>
                        {a?.is_passing === true && (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5"><CheckCircle2 size={11} />Pass</span>
                        )}
                        {a?.is_passing === false && (
                          <span className="inline-flex items-center gap-1 font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5"><XCircle size={11} />Did Not Pass</span>
                        )}
                        {a?.time_expired && (
                          <span className="inline-flex items-center gap-1 text-amber-600"><Clock size={11} />Auto-submitted</span>
                        )}
                        {(a?.attempt_number ?? 1) > 1 && <span className="text-slate-400">Attempt #{a?.attempt_number}</span>}
                      </>
                    ) : (
                      <span className="font-semibold text-amber-600 capitalize">{it.status.replace('_', ' ')} — not yet submitted</span>
                    )}
                    {it.retake_allowed && (
                      <span className="font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 inline-flex items-center gap-1"><RotateCcw size={10} />Retake granted</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {submitted && a && (
                    <button
                      onClick={() => openReview(a.attempt_id)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#0EA5E9] bg-slate-50 hover:bg-sky-50 border border-slate-200 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                    >
                      <Eye size={13} /> View Exam Answers
                    </button>
                  )}
                  {failed && it.status === 'completed' && !it.retake_allowed && (
                    <button
                      onClick={() => setRetakeTarget(it)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                    >
                      <RotateCcw size={13} /> Allow Retake
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Retake confirmation */}
      {retakeTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-amber-600" />
              </div>
              <div>
                <h4 className="font-bold text-[#0F172A]">Allow retake?</h4>
                <p className="text-xs text-slate-500 mt-1">
                  The applicant will be able to retake <span className="font-semibold text-slate-700">{retakeTarget.title}</span>. Their previous score remains on record.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setRetakeTarget(null)} disabled={granting}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer">Cancel</button>
              <button onClick={grantRetake} disabled={granting}
                className="flex-1 py-2 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-60 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer">
                {granting ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Confirm Retake
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full result modal */}
      {(review || reviewLoading) && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-slate-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
              <h4 className="font-bold text-[#0F172A] text-sm">Exam Review & Answers</h4>
              <button onClick={() => setReview(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3 flex-1">
              {reviewLoading || !review ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[#0EA5E9]" size={24} /></div>
              ) : (
                (review.questions || []).map((q: any, i: number) => {
                  const ans = (review.answers || []).find((x: any) => x.question_id === q.question_id);
                  return (
                    <div key={q.question_id} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800">Q{i + 1}. {q.question_text}</p>
                        {ans?.is_correct
                          ? <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                          : <XCircle size={16} className="text-red-500 flex-shrink-0" />}
                      </div>
                      <div className="mt-2 space-y-1">
                        {(q.exam_choice || []).sort((a: any, b: any) => a.choice_order - b.choice_order).map((c: any) => {
                          const picked = ans?.selected_choice === c.choice_id;
                          return (
                            <div key={c.choice_id}
                              className={`text-xs px-3 py-1.5 rounded-lg border ${c.is_correct ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                                : picked ? 'bg-red-50 border-red-300 text-red-700 font-semibold' : 'border-slate-200 text-slate-600'}`}>
                              {c.choice_text}
                              {c.is_correct && ' ✓ correct'}
                              {picked && !c.is_correct && ' — applicant\u2019s answer'}
                              {picked && c.is_correct && ' — applicant\u2019s answer'}
                            </div>
                          );
                        })}
                        {!ans?.selected_choice && <p className="text-xs italic text-slate-400">No answer given</p>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
