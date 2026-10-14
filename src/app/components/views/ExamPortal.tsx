/**
 * ExamPortal.tsx — Applicant-facing Digital Exam
 * ================================================
 * Handles:
 *   - My Exams list (pending, in-progress, completed)
 *   - Exam Taker (questions, answers, timer)
 *   - Subtle ≤1-min warning banner
 *   - Smooth time-up lock screen (auto-submit, fade transition)
 *   - Result screen (score, pass/fail, optional answer review)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ClipboardList, Clock, CheckCircle2, XCircle, AlertTriangle,
  ArrowRight, ChevronLeft, Loader2, BookOpen, Zap, FileText,
  RotateCcw, Eye, Home
} from 'lucide-react';
import { api } from '../../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExamChoice {
  choice_id: number;
  choice_text: string;
  choice_order: number;
}

interface ExamQuestion {
  question_id: number;
  question_text: string;
  question_order: number;
  points: number;
  choices: ExamChoice[];
}

interface ExamCard {
  assignment_id: number;
  template_id: number;
  title: string;
  category?: string;
  exam_type: string;
  time_limit_mins?: number;
  due_date?: string;
  status: string;
  retake_allowed: boolean;
  latest_attempt_id?: number;
  latest_percentage?: number;
  latest_is_passing?: boolean;
}

interface StartExamData {
  attempt_id: number;
  assignment_id: number;
  template_id: number;
  title: string;
  time_limit_mins?: number;
  started_at: string;
  questions: ExamQuestion[];
}

interface ReviewAnswer {
  question_text: string;
  selected_text?: string;
  correct_text?: string;
  is_correct: boolean;
  points_earned: number;
  points_possible: number;
}

interface ExamResult {
  attempt_id: number;
  percentage?: number;
  raw_score?: number;
  max_score?: number;
  is_passing?: boolean;
  time_expired: boolean;
  allow_review: boolean;
  review_answers?: ReviewAnswer[];
}

interface Props {
  onBackToProfile?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { color: string; label: string }> = {
    pending: { color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Pending' },
    in_progress: { color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'In Progress' },
    completed: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Completed' },
    expired: { color: 'bg-slate-100 text-slate-500 border-slate-200', label: 'Expired' },
  };
  const { color, label } = cfg[status] || { color: 'bg-slate-100 text-slate-500 border-slate-200', label: status };
  return (
    <span className={`text-[11px] font-bold uppercase tracking-wider border rounded-full px-2 py-0.5 ${color}`}>
      {label}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MY EXAMS DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════

function MyExamsDashboard({
  onStart, onViewResult,
}: {
  onStart: (assignmentId: number) => void;
  onViewResult: (attemptId: number) => void;
}) {
  const [exams, setExams] = useState<ExamCard[]>([]);
  const [loading, setLoading] = useState(true);

  const loadExams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/exam-module/portal/my-exams');
      setExams(res.data || []);
    } catch {
      setExams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadExams(); }, [loadExams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-violet-400" size={28} />
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <div className="text-center py-16">
        <BookOpen size={40} className="mx-auto text-slate-300 mb-3" />
        <p className="text-slate-500 font-semibold">No exams assigned yet.</p>
        <p className="text-slate-400 text-sm">Your recruiter will notify you when an exam is ready.</p>
      </div>
    );
  }

  const pending = exams.filter(e => e.status === 'pending' || (e.status === 'completed' && e.retake_allowed));
  const completed = exams.filter(e => e.status === 'completed' && !e.retake_allowed);
  const other = exams.filter(e => e.status === 'in_progress');

  return (
    <div className="space-y-6">
      {/* Pending / Retake */}
      {(pending.length > 0 || other.length > 0) && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Ready to Take</h3>
          <div className="space-y-3">
            {[...other, ...pending].map(exam => (
              <div key={exam.assignment_id}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:border-slate-300 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-sky-50 border border-sky-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Zap size={18} className="text-[#0EA5E9]" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{exam.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {exam.category && <span className="text-xs text-slate-400">{exam.category}</span>}
                        {exam.time_limit_mins && (
                          <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
                            <Clock size={10} /> {exam.time_limit_mins} min
                          </span>
                        )}
                        {exam.retake_allowed && exam.status === 'completed' && (
                          <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 flex items-center gap-1">
                            <RotateCcw size={10} /> Retake Granted
                          </span>
                        )}
                        <StatusBadge status={exam.status === 'completed' && exam.retake_allowed ? 'pending' : exam.status} />
                      </div>
                      {exam.due_date && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Due: {new Date(exam.due_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onStart(exam.assignment_id)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                  >
                    {exam.status === 'in_progress' ? 'Resume' : exam.retake_allowed ? 'Retake' : 'Start Exam'}
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Completed</h3>
          <div className="space-y-2">
            {completed.map(exam => (
              <div key={exam.assignment_id}
                className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3 shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${exam.latest_is_passing ? 'bg-emerald-50 border-emerald-200' : exam.latest_is_passing === false ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                    {exam.latest_is_passing ? <CheckCircle2 size={16} className="text-emerald-600" /> :
                      exam.latest_is_passing === false ? <XCircle size={16} className="text-red-500" /> :
                        <ClipboardList size={16} className="text-slate-400" />}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{exam.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {exam.latest_percentage !== undefined && exam.latest_percentage !== null && (
                        <span className="text-xs font-bold text-slate-600">{exam.latest_percentage.toFixed(1)}%</span>
                      )}
                      {exam.latest_is_passing !== null && exam.latest_is_passing !== undefined && (
                        exam.latest_is_passing
                          ? <span className="text-xs font-bold text-emerald-600">PASSED</span>
                          : <span className="text-xs font-bold text-red-500">DID NOT PASS</span>
                      )}
                    </div>
                  </div>
                </div>
                {exam.latest_attempt_id && (
                  <button
                    onClick={() => onViewResult(exam.latest_attempt_id!)}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#0EA5E9] transition-colors"
                  >
                    <Eye size={13} /> View Result
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EXAM TAKER
// ══════════════════════════════════════════════════════════════════════════════

function ExamTaker({
  examData, onSubmitted,
}: {
  examData: StartExamData;
  onSubmitted: (result: ExamResult) => void;
}) {
  const totalSecs = examData.time_limit_mins ? examData.time_limit_mins * 60 : null;
  const [secsLeft, setSecsLeft] = useState<number | null>(totalSecs);
  const [answers, setAnswers] = useState<Record<number, number | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [lockVisible, setLockVisible] = useState(false);
  const [showNearingWarning, setShowNearingWarning] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const autoSubmitRef = useRef(false);

  const questions = examData.questions;

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (secsLeft === null) return;
    if (secsLeft <= 0) {
      if (!autoSubmitRef.current) {
        autoSubmitRef.current = true;
        handleSubmit(true);
      }
      return;
    }
    if (secsLeft <= 60 && !showNearingWarning) setShowNearingWarning(true);
    const t = setTimeout(() => setSecsLeft(s => (s !== null ? s - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [secsLeft]);

  const timerPct = totalSecs && secsLeft !== null ? (secsLeft / totalSecs) * 100 : 100;
  const timerColor = secsLeft !== null
    ? secsLeft <= 60 ? 'bg-red-500' : secsLeft <= 300 ? 'bg-amber-400' : 'bg-emerald-400'
    : 'bg-emerald-400';

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (isTimedOut = false) => {
    setSubmitting(true);
    try {
      const answersPayload = questions.map(q => ({
        question_id: q.question_id,
        selected_choice: answers[q.question_id] ?? null,
      }));
      const res = await api.post(`/exam-module/portal/submit/${examData.attempt_id}`, {
        answers: answersPayload,
        time_expired: isTimedOut,
      });
      if (isTimedOut) {
        setTimedOut(true);
        setSubmitting(false);
        setTimeout(() => {
          setLockVisible(true);
          setTimeout(() => onSubmitted(res.data), 2000);
        }, 300);
      } else {
        onSubmitted(res.data);
      }
    } catch {
      setSubmitting(false);
    }
  }, [answers, examData.attempt_id, questions, onSubmitted]);

  const answeredCount = Object.values(answers).filter(v => v !== null && v !== undefined).length;
  const totalCount = questions.length;

  // ── Lock screen ────────────────────────────────────────────────────────────
  if (timedOut) {
    return (
      <div className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs transition-opacity duration-700 ${lockVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl text-center space-y-3 p-8 max-w-sm w-full mx-4">
          <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center mx-auto">
            <Clock size={28} className="text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-[#0F172A]">Time's Up</h2>
          <p className="text-slate-500 text-xs">Your exam time has ended and your answers have been submitted automatically.</p>
          {submitting && <Loader2 className="animate-spin text-[#0EA5E9] mx-auto mt-2" size={20} />}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-16">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-200 -mx-6 sm:-mx-8 px-6 sm:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-bold text-slate-900 text-sm truncate">{examData.title}</p>
            <p className="text-xs text-slate-400">{answeredCount} of {totalCount} answered</p>
          </div>
          {secsLeft !== null && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Clock size={13} className={secsLeft <= 60 ? 'text-red-500 animate-pulse' : 'text-slate-400'} />
              <span className={`font-mono text-sm font-bold tabular-nums ${secsLeft <= 60 ? 'text-red-500' : secsLeft <= 300 ? 'text-amber-500' : 'text-slate-700'}`}>
                {formatTime(secsLeft)}
              </span>
            </div>
          )}
        </div>
        {/* Timer bar */}
        {totalSecs && (
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${timerColor}`}
              style={{ width: `${timerPct}%` }}
            />
          </div>
        )}
      </div>

      {/* ≤1 min warning banner */}
      {showNearingWarning && secsLeft !== null && secsLeft > 0 && (
        <div className="sticky top-16 z-10 flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-800 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm animate-in slide-in-from-top-2 duration-300">
          <Clock size={13} className="flex-shrink-0 animate-pulse" />
          <span>Less than 1 minute remaining — please review and submit soon.</span>
        </div>
      )}

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#0EA5E9] rounded-full transition-all duration-300"
            style={{ width: `${(answeredCount / Math.max(totalCount, 1)) * 100}%` }}
          />
        </div>
        <span className="text-xs font-bold text-slate-500">{Math.round((answeredCount / Math.max(totalCount, 1)) * 100)}%</span>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((q, qi) => (
          <div key={q.question_id} className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-slate-100">
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 bg-sky-50 text-[#0EA5E9] border border-sky-100 rounded-full text-xs font-extrabold flex items-center justify-center">{qi + 1}</span>
                <p className="text-sm font-semibold text-slate-800 leading-relaxed">{q.question_text}</p>
              </div>
            </div>
            <div className="px-5 py-3 space-y-2">
              {q.choices.map((c, ci) => {
                const selected = answers[q.question_id] === c.choice_id;
                const letter = String.fromCharCode(65 + ci);
                return (
                  <button
                    key={c.choice_id}
                    onClick={() => setAnswers(prev => ({ ...prev, [q.question_id]: c.choice_id }))}
                    className={`w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all duration-150 ${selected
                      ? 'border-[#0EA5E9] bg-sky-50 text-sky-900 font-semibold shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 bg-white'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded text-xs font-bold flex items-center justify-center shrink-0 ${selected ? 'bg-[#0EA5E9] text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {letter}
                    </span>
                    <span className="flex-1">{c.choice_text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Submit button + confirmation */}
      <div className="pt-4">
        {showSubmitConfirm ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-amber-800">
                Submit your answers?{' '}
                {answeredCount < totalCount && (
                  <span className="text-red-600 font-bold">{totalCount - answeredCount} question(s) still unanswered.</span>
                )}
                {' '}You will not be able to edit your answers after submitting.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
              >
                Keep Reviewing
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="flex-1 py-2 text-sm font-semibold text-white bg-[#0EA5E9] hover:bg-[#0284C7] disabled:opacity-60 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 size={13} className="animate-spin" />Submitting...</> : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowSubmitConfirm(true)}
            className="w-full py-3 text-sm font-bold text-white bg-[#0EA5E9] hover:bg-[#0284C7] rounded-xl shadow-sm transition-all"
          >
            Submit Exam
          </button>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RESULT SCREEN
// ══════════════════════════════════════════════════════════════════════════════

function ResultScreen({
  result, onBack,
}: {
  result: ExamResult;
  onBack: () => void;
}) {
  const [showReview, setShowReview] = useState(false);
  const pct = result.percentage ?? 0;
  const passing = result.is_passing;

  return (
    <div className="space-y-6 py-4">
      {/* Score card */}
      <div className={`bg-white border rounded-2xl p-8 text-center shadow-2xs ${passing === true ? 'border-emerald-200' : passing === false ? 'border-red-200' : 'border-slate-200'}`}>
        {result.time_expired && (
          <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold rounded-full px-3 py-1 mb-4">
            <Clock size={11} /> Auto-submitted — time expired
          </div>
        )}
        <div className="text-5xl font-black text-[#0F172A] tabular-nums mb-1">
          {pct.toFixed(1)}<span className="text-2xl font-bold text-slate-400">%</span>
        </div>
        <div className="text-slate-500 text-xs font-semibold">
          {result.raw_score?.toFixed(0)} of {result.max_score?.toFixed(0)} points earned
        </div>
        {passing !== null && passing !== undefined && (
          <div className={`inline-flex items-center gap-1.5 mt-4 px-4 py-1.5 rounded-full font-bold text-xs ${passing ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {passing ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {passing ? 'PASSED' : 'DID NOT PASS'}
          </div>
        )}
      </div>

      {/* Answer review toggle */}
      {result.allow_review && result.review_answers && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <button
            onClick={() => setShowReview(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-2"><Eye size={14} className="text-[#0EA5E9]" /> Review Exam Answers</span>
            <span className="text-[11px] text-slate-400 font-semibold">{showReview ? 'Hide' : 'Show'}</span>
          </button>
          {showReview && (
            <div className="border-t border-slate-100 divide-y divide-slate-100">
              {result.review_answers.map((a, i) => (
                <div key={i} className="px-5 py-3.5">
                  <p className="text-xs font-bold text-slate-700 mb-1">Q{i + 1}. {a.question_text}</p>
                  <div className="flex items-start gap-2 mt-1">
                    {a.is_correct
                      ? <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      : <XCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />}
                    <div>
                      <p className={`text-xs font-semibold ${a.is_correct ? 'text-emerald-700' : 'text-red-600'}`}>
                        Your answer: {a.selected_text || <span className="italic text-slate-400">No answer</span>}
                      </p>
                      {!a.is_correct && a.correct_text && (
                        <p className="text-xs text-slate-500 mt-0.5">Correct: <span className="font-bold text-emerald-600">{a.correct_text}</span></p>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{a.points_earned} / {a.points_possible} pts</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!result.allow_review && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-400 text-center">
          Answer review is not enabled for this exam.
        </div>
      )}

      <button
        onClick={onBack}
        className="w-full py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:border-[#0EA5E9] hover:text-[#0EA5E9] rounded-xl transition-all flex items-center justify-center gap-2"
      >
        <Home size={14} /> Back to My Exams
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN EXAM PORTAL COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

type PortalView = 'list' | 'taking' | 'result';

export default function ExamPortal({ onBackToProfile }: Props) {
  const [view, setView] = useState<PortalView>('list');
  const [examData, setExamData] = useState<StartExamData | null>(null);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');

  const handleStart = async (assignmentId: number) => {
    setStartError('');
    setStarting(true);
    try {
      const res = await api.post(`/exam-module/portal/start/${assignmentId}`);
      setExamData(res.data);
      setView('taking');
    } catch (e: any) {
      setStartError(e?.response?.data?.detail || 'Failed to start exam. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  const handleViewResult = async (attemptId: number) => {
    try {
      const res = await api.get(`/exam-module/portal/result/${attemptId}`);
      setResult(res.data);
      setView('result');
    } catch {
      // silent
    }
  };

  const handleSubmitted = (r: ExamResult) => {
    setResult(r);
    setView('result');
  };

  const handleBack = () => {
    setView('list');
    setExamData(null);
    setResult(null);
  };

  return (
    <div className="min-h-full">
      {/* Header */}
      {view !== 'taking' && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {(view === 'result') && (
              <button onClick={handleBack} className="text-slate-400 hover:text-slate-700 transition-colors mr-1">
                <ChevronLeft size={20} />
              </button>
            )}
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <ClipboardList size={20} className="text-violet-500" />
              {view === 'list' ? 'My Exams' : view === 'result' ? 'Exam Result' : ''}
            </h2>
          </div>
          {onBackToProfile && view === 'list' && (
            <button onClick={onBackToProfile} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors">
              <ChevronLeft size={14} /> Back to Profile
            </button>
          )}
        </div>
      )}

      {/* Start error */}
      {startError && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          <AlertTriangle size={15} /> {startError}
        </div>
      )}

      {/* Loading spinner for start */}
      {starting && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-violet-500" size={28} />
          <span className="ml-2 text-slate-500 text-sm">Loading exam...</span>
        </div>
      )}

      {/* Views */}
      {!starting && view === 'list' && (
        <MyExamsDashboard onStart={handleStart} onViewResult={handleViewResult} />
      )}
      {!starting && view === 'taking' && examData && (
        <ExamTaker examData={examData} onSubmitted={handleSubmitted} />
      )}
      {!starting && view === 'result' && result && (
        <ResultScreen result={result} onBack={handleBack} />
      )}
    </div>
  );
}
