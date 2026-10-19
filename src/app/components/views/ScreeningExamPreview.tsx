/**
 * ScreeningExamPreview.tsx
 * Staff-facing digital exam preview and result reviewer shown inside:
 * - Screening Panel
 * - Applicant Profile
 *
 * Capabilities:
 * - List of assigned digital exams (standalone or screening-linked)
 * - Score %, Pass/Fail status, attempt count, time-expired tags
 * - "Preview Test" simulation (interactive candidate portal preview via ExamSimulatorModal)
 * - "View Exam Answers" / Result Review (high-fidelity score breakdown matching candidate portal ResultScreen)
 * - "Allow Retake" action for failed exams
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BookOpen, CheckCircle2, XCircle, Eye, RotateCcw, Loader2, X,
  AlertTriangle, Clock, Play, FileText, Check, Award, ChevronRight,
  Filter, Sparkles, Link2
} from 'lucide-react';
import api from '../../../lib/api';

export interface ExamAttemptSummary {
  attempt_id: number;
  attempt_number: number;
  percentage?: number | null;
  raw_score?: number | null;
  max_score?: number | null;
  is_passing?: boolean | null;
  time_expired: boolean;
  status: string;
}

export interface DigitalExamSummaryItem {
  assignment_id: number;
  template_id: number;
  evaluation_template_id?: number | null;
  title: string;
  category?: string | null;
  status: string;
  retake_allowed: boolean;
  latest_attempt?: ExamAttemptSummary | null;
}

interface Props {
  applicantId: number | string;
  showToast?: (msg: string) => void;
  onSummaryLoaded?: (items: DigitalExamSummaryItem[]) => void;
  title?: string;
  hideIfEmpty?: boolean;
}

/**
 * High-fidelity Exam Review & Answers Modal matching Candidate Portal ResultScreen design.
 */
export function ExamReviewModal({
  attemptId,
  onClose,
  showToast,
  onRetakeGranted,
}: {
  attemptId: number;
  onClose: () => void;
  showToast?: (msg: string) => void;
  onRetakeGranted?: () => void;
}) {
  const [review, setReview] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'correct' | 'incorrect'>('all');
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.get(`/exam-module/attempts/${attemptId}/review`)
      .then(res => {
        if (mounted) setReview(res.data);
      })
      .catch(() => {
        if (mounted) showToast?.('Failed to load exam review answers.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [attemptId, showToast]);

  const reviewStats = useMemo(() => {
    if (!review || !review.questions) return { total: 0, correct: 0, incorrect: 0 };
    const total = review.questions.length;
    let correct = 0;
    review.questions.forEach((q: any) => {
      const ans = (review.answers || []).find((x: any) => x.question_id === q.question_id);
      if (ans?.is_correct) correct++;
    });
    return { total, correct, incorrect: total - correct };
  }, [review]);

  const filteredQuestions = useMemo(() => {
    if (!review || !review.questions) return [];
    return review.questions.filter((q: any) => {
      const ans = (review.answers || []).find((x: any) => x.question_id === q.question_id);
      if (reviewFilter === 'correct') return ans?.is_correct;
      if (reviewFilter === 'incorrect') return !ans?.is_correct;
      return true;
    });
  }, [review, reviewFilter]);

  const handleGrantRetake = async () => {
    const assignmentId = review?.attempt?.assignment_id || review?.assignment?.assignment_id;
    if (!assignmentId) return;
    setGranting(true);
    try {
      await api.patch(`/exam-module/assignments/${assignmentId}/grant-retake`);
      showToast?.('Retake granted. Candidate can now retake this assessment in their portal.');
      onRetakeGranted?.();
      onClose();
    } catch (e: any) {
      showToast?.(e?.response?.data?.detail || 'Failed to grant retake.');
    } finally {
      setGranting(false);
    }
  };

  const isFailed = review?.attempt?.is_passing === false;

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-400/30 flex items-center justify-center font-bold">
              <Award size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base text-white">
                  {review?.template?.title || 'Exam Review & Candidate Answers'}
                </h3>
                {review?.attempt && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-sky-300 border border-slate-700">
                    Attempt #{review.attempt.attempt_number ?? 1}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Detailed question breakdown with candidate choices, grading benchmarks, and point allocations
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-5 bg-slate-50/70">
          {loading || !review ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 className="animate-spin text-[#0EA5E9]" size={32} />
              <p className="text-xs font-semibold">Loading candidate answers and scorecard...</p>
            </div>
          ) : (
            <>
              {/* ── HERO SCORECARD (Matches Candidate Portal ResultScreen) ── */}
              {review.attempt && (
                <div
                  className={`bg-white border-2 rounded-2xl p-6 text-center shadow-xs ${
                    review.attempt.is_passing === true
                      ? 'border-emerald-300 bg-gradient-to-b from-emerald-50/40 to-white'
                      : review.attempt.is_passing === false
                      ? 'border-red-300 bg-gradient-to-b from-red-50/40 to-white'
                      : 'border-slate-200'
                  }`}
                >
                  {review.attempt.time_expired && (
                    <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold rounded-full px-3 py-1 mb-3">
                      <Clock size={12} className="text-amber-600" /> Auto-submitted — Time Limit Reached
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className="text-5xl font-black text-slate-900 tabular-nums">
                      {(review.attempt.percentage ?? 0).toFixed(1)}
                    </span>
                    <span className="text-2xl font-bold text-slate-400">%</span>
                  </div>

                  <p className="text-xs font-bold text-slate-600">
                    {review.attempt.raw_score ?? 0} of {review.attempt.max_score ?? reviewStats.total} points earned
                  </p>

                  <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                    {review.attempt.is_passing !== null && review.attempt.is_passing !== undefined && (
                      <div
                        className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold text-xs ${
                          review.attempt.is_passing
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-red-100 text-red-800 border border-red-300'
                        }`}
                      >
                        {review.attempt.is_passing ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                        {review.attempt.is_passing ? 'PASSED BENCHMARK' : 'DID NOT PASS BENCHMARK'}
                      </div>
                    )}

                    {review.template?.passing_score !== undefined && (
                      <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full font-semibold border border-slate-200">
                        Required Passing Benchmark: <strong>≥{review.template.passing_score}%</strong>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* ── QUESTION BREAKDOWN FILTER TABS ── */}
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-[#0EA5E9]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Question Breakdown ({filteredQuestions.length} of {reviewStats.total})
                  </h4>
                </div>

                <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setReviewFilter('all')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      reviewFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All ({reviewStats.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewFilter('correct')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      reviewFilter === 'correct'
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-slate-600 hover:text-emerald-700'
                    }`}
                  >
                    ✓ Correct ({reviewStats.correct})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewFilter('incorrect')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      reviewFilter === 'incorrect'
                        ? 'bg-white text-red-700 shadow-xs'
                        : 'text-slate-600 hover:text-red-700'
                    }`}
                  >
                    ✗ Incorrect ({reviewStats.incorrect})
                  </button>
                </div>
              </div>

              {/* ── QUESTION CARDS ── */}
              <div className="space-y-4">
                {filteredQuestions.map((q: any, i: number) => {
                  const ans = (review.answers || []).find((x: any) => x.question_id === q.question_id);
                  const isCorrect = ans?.is_correct;
                  const hasAnswer = ans?.selected_choice !== null && ans?.selected_choice !== undefined;

                  return (
                    <div
                      key={q.question_id}
                      className={`bg-white border-2 rounded-2xl p-4 sm:p-5 transition-all shadow-xs ${
                        isCorrect ? 'border-emerald-200/80' : 'border-red-200/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                            {i + 1}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                            {q.points || 1} pt{q.points !== 1 ? 's' : ''}
                          </span>
                        </div>

                        {isCorrect ? (
                          <span className="inline-flex items-center gap-1 font-bold text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                            <CheckCircle2 size={13} className="text-emerald-600" /> Correct (+{ans.points_earned ?? q.points ?? 1} pt)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-xs text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
                            <XCircle size={13} className="text-red-600" /> Incorrect (0 pt)
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-bold text-slate-900 leading-snug mb-3">
                        {q.question_text}
                      </p>

                      {/* Choices List */}
                      <div className="space-y-2">
                        {(q.exam_choice || [])
                          .sort((a: any, b: any) => (a.choice_order || 0) - (b.choice_order || 0))
                          .map((c: any, cIdx: number) => {
                            const choiceLetter = String.fromCharCode(65 + cIdx);
                            const picked = ans?.selected_choice === c.choice_id;
                            const isCorrectChoice = Boolean(c.is_correct);

                            let rowStyle = 'bg-slate-50 border-slate-200 text-slate-700';
                            if (picked && isCorrectChoice) {
                              rowStyle = 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold ring-2 ring-emerald-200';
                            } else if (picked && !isCorrectChoice) {
                              rowStyle = 'bg-red-50 border-red-400 text-red-950 font-bold ring-2 ring-red-200';
                            } else if (isCorrectChoice) {
                              rowStyle = 'bg-emerald-50/60 border-emerald-300 text-emerald-900 font-semibold';
                            }

                            return (
                              <div
                                key={c.choice_id}
                                className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border text-xs transition-colors ${rowStyle}`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span
                                    className={`w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px] shrink-0 ${
                                      picked && isCorrectChoice
                                        ? 'bg-emerald-600 text-white'
                                        : picked && !isCorrectChoice
                                        ? 'bg-red-600 text-white'
                                        : isCorrectChoice
                                        ? 'bg-emerald-200 text-emerald-800'
                                        : 'bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {choiceLetter}
                                  </span>
                                  <span className="truncate">{c.choice_text}</span>
                                </div>

                                <div className="shrink-0 flex items-center gap-1.5">
                                  {picked && isCorrectChoice && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-white border border-emerald-300 rounded-md px-2 py-0.5 shadow-2xs">
                                      <CheckCircle2 size={12} /> Candidate's Answer (Correct)
                                    </span>
                                  )}
                                  {picked && !isCorrectChoice && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-white border border-red-300 rounded-md px-2 py-0.5 shadow-2xs">
                                      <XCircle size={12} /> Candidate's Answer (Incorrect)
                                    </span>
                                  )}
                                  {!picked && isCorrectChoice && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-white border border-emerald-300 rounded-md px-2 py-0.5 shadow-2xs">
                                      <Check size={12} /> Correct Answer
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                        {!hasAnswer && (
                          <p className="text-xs italic text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2 text-center font-medium">
                            ⚠️ No answer was submitted for this question
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div>
            {!review?.assignment?.retake_allowed && (
              <button
                type="button"
                onClick={handleGrantRetake}
                disabled={granting}
                className="px-3.5 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                {granting ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                <span>{isFailed ? 'Allow Candidate Retake' : 'Allow Retake / Re-attempt'}</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Close Review
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ScreeningExamPreview({
  applicantId,
  showToast,
  onSummaryLoaded,
  title = 'Digital Exam Results',
  hideIfEmpty = true,
}: Props) {
  const [items, setItems] = useState<DigitalExamSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [retakeTarget, setRetakeTarget] = useState<DigitalExamSummaryItem | null>(null);
  const [granting, setGranting] = useState(false);

  // Result Review state
  const [selectedAttemptId, setSelectedAttemptId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!applicantId) return;
    setLoading(true);
    try {
      const res = await api.get(`/exam-module/applicant/${applicantId}/exam-summary`);
      const data = res.data || [];
      setItems(data);
      onSummaryLoaded?.(data);
    } catch {
      setItems([]);
      onSummaryLoaded?.([]);
    } finally {
      setLoading(false);
    }
  }, [applicantId, onSummaryLoaded]);

  useEffect(() => {
    load();
  }, [load]);

  const grantRetake = async () => {
    if (!retakeTarget) return;
    setGranting(true);
    try {
      await api.patch(`/exam-module/assignments/${retakeTarget.assignment_id}/grant-retake`);
      showToast?.('Retake granted. The applicant can now retake this assessment.');
      setRetakeTarget(null);
      load();
    } catch (e: any) {
      showToast?.(e?.response?.data?.detail || 'Failed to grant retake.');
    } finally {
      setGranting(false);
    }
  };

  if (!loading && items.length === 0 && hideIfEmpty) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all">
      {/* ── CARD HEADER ── */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-slate-50 via-sky-50/30 to-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-[#0EA5E9] flex items-center justify-center font-bold">
            <BookOpen size={17} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              {title}
              {items.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-[#0284C7] border border-sky-200">
                  {items.length} Assigned
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-500">
              Interactive assessments dispatched to candidate portal with automatic scoring
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-xs font-semibold text-slate-500 hover:text-[#0EA5E9] flex items-center gap-1 transition-colors cursor-pointer"
          title="Refresh digital exam results"
        >
          <RotateCcw size={12} className={loading ? 'animate-spin text-[#0EA5E9]' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── CONTENT BODY ── */}
      {loading ? (
        <div className="flex items-center justify-center py-10 gap-2 text-slate-400 text-xs">
          <Loader2 className="animate-spin text-[#0EA5E9]" size={18} />
          <span>Loading candidate exam submissions...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-xs">
          <BookOpen size={30} className="mx-auto mb-2 text-slate-300" />
          <p className="font-semibold text-slate-600 text-sm">No digital assessments assigned</p>
          <p className="mt-0.5 text-slate-400">
            Assign digital assessments to this candidate from the Digital Exams module or link one to an evaluation.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map(it => {
            const a = it.latest_attempt;
            const submitted = a?.status === 'submitted';
            const isPassing = a?.is_passing;
            const failed = submitted && isPassing === false;
            const isLinked = Boolean(it.evaluation_template_id);

            return (
              <div
                key={it.assignment_id}
                className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap hover:bg-slate-50/60 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-900 text-sm truncate">{it.title}</p>
                    {isLinked ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-800 bg-sky-50 border border-sky-200 rounded-md px-2 py-0.5">
                        <Link2 size={10} /> Screening Linked
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 rounded-md px-2 py-0.5">
                        Standalone Assessment
                      </span>
                    )}
                    {it.category && (
                      <span className="text-[11px] font-medium text-slate-400">
                        • {it.category}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                    {submitted && a ? (
                      <>
                        <div className="flex items-center gap-1.5 font-black text-slate-800 text-sm bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                          <span>{(a.percentage ?? 0).toFixed(1)}%</span>
                          {a.raw_score !== undefined && a.max_score !== undefined && (
                            <span className="text-xs font-semibold text-slate-500">
                              ({a.raw_score}/{a.max_score} pts)
                            </span>
                          )}
                        </div>

                        {isPassing === true && (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                            <CheckCircle2 size={12} className="text-emerald-600" /> Pass
                          </span>
                        )}
                        {isPassing === false && (
                          <span className="inline-flex items-center gap-1 font-bold text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
                            <XCircle size={12} className="text-red-600" /> Did Not Pass
                          </span>
                        )}
                        {a.time_expired && (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 text-[11px]">
                            <Clock size={11} className="text-amber-500" /> Auto-submitted (Time limit)
                          </span>
                        )}
                        {(a.attempt_number ?? 1) > 1 && (
                          <span className="text-slate-400 text-xs">Attempt #{a.attempt_number}</span>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 font-bold text-xs capitalize">
                        <Clock size={12} /> {it.status.replace('_', ' ')} — Not yet completed
                      </span>
                    )}

                    {it.retake_allowed && (
                      <span className="font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 inline-flex items-center gap-1 text-[11px]">
                        <RotateCcw size={10} /> Retake granted
                      </span>
                    )}
                  </div>
                </div>

                {/* ── ACTION BUTTONS ── */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* View Submitted Exam Result */}
                  {submitted && a ? (
                    <button
                      type="button"
                      onClick={() => setSelectedAttemptId(a.attempt_id)}
                      className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#0EA5E9] hover:bg-[#0284C7] px-3.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs"
                      title="Inspect candidate answers & scoring review"
                    >
                      <Eye size={13} />
                      <span>View Exam Result</span>
                    </button>
                  ) : (
                    <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl inline-flex items-center gap-1.5">
                      <Clock size={12} /> Pending Candidate Submission
                    </span>
                  )}

                  {/* Grant Retake if completed and retake not yet active */}
                  {it.status === 'completed' && !it.retake_allowed && (
                    <button
                      type="button"
                      onClick={() => setRetakeTarget(it)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs"
                      title="Allow candidate another attempt"
                    >
                      <RotateCcw size={13} />
                      <span>Allow Retake</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CONFIRM RETAKE MODAL ── */}
      {retakeTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0 text-amber-600">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="font-bold text-[#0F172A] text-base">Allow Retake?</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  The applicant will be permitted to retake <strong className="text-slate-800">{retakeTarget.title}</strong> in their portal. Their previous score remains in the audit history.
                </p>
              </div>
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setRetakeTarget(null)}
                disabled={granting}
                className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={grantRetake}
                disabled={granting}
                className="flex-1 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-60 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                {granting ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                <span>Confirm Retake</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HIGH-FIDELITY EXAM RESULT REVIEW MODAL ── */}
      {selectedAttemptId && (
        <ExamReviewModal
          attemptId={selectedAttemptId}
          onClose={() => setSelectedAttemptId(null)}
          showToast={showToast}
          onRetakeGranted={load}
        />
      )}
    </div>
  );
}
