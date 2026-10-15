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

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ClipboardList, Clock, CheckCircle2, XCircle, AlertTriangle,
  ArrowRight, ChevronLeft, ChevronRight, Loader2, BookOpen, Zap, FileText,
  RotateCcw, Eye, Home, BookmarkCheck, LayoutGrid, Check, ArrowLeft, X, Save,
  CheckCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { api } from '../../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExamChoice {
  choice_id: number;
  choice_text: string;
  choice_order: number;
  is_correct?: boolean;
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
  description?: string;
  passing_score?: number;
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
        <p className="text-slate-500 font-semibold">No assessments assigned yet.</p>
        <p className="text-slate-400 text-sm">Your recruiter will notify you when an assessment is ready.</p>
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
        <div className="space-y-3">
          {[...other, ...pending].map(exam => (
              <div key={exam.assignment_id}
                className="bg-white border border-slate-200 hover:border-sky-300 rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div className="w-11 h-11 bg-sky-50 border border-sky-100 rounded-xl flex items-center justify-center flex-shrink-0 shadow-2xs">
                    <ClipboardList size={20} className="text-sky-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 text-sm sm:text-base leading-snug">{exam.title}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {exam.category && <span className="text-xs text-slate-400 font-medium">{exam.category}</span>}
                      {exam.time_limit_mins ? (
                        <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-0.5">
                          <Clock size={11} /> {exam.time_limit_mins} min
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-0.5">
                          Untimed
                        </span>
                      )}
                      {exam.retake_allowed && exam.status === 'completed' && (
                        <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 flex items-center gap-1">
                          <RotateCcw size={11} /> Retake Granted
                        </span>
                      )}
                      <StatusBadge status={exam.status === 'completed' && exam.retake_allowed ? 'pending' : exam.status} />
                    </div>
                    {exam.due_date && (
                      <p className="text-xs text-slate-400 mt-1">
                        Due: {new Date(exam.due_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onStart(exam.assignment_id)}
                  className="sm:self-center flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer shrink-0"
                >
                  {exam.status === 'in_progress' ? 'Continue Test' : exam.retake_allowed ? 'Retake Test' : 'Take Test'}
                  <ArrowRight size={14} />
                </button>
              </div>
            ))}
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">Completed Assessments</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {completed.map(exam => (
              <div key={exam.assignment_id}
                className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${exam.latest_is_passing ? 'bg-emerald-50 border-emerald-200' : exam.latest_is_passing === false ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                    {exam.latest_is_passing ? <CheckCircle2 size={16} className="text-emerald-600" /> :
                      exam.latest_is_passing === false ? <XCircle size={16} className="text-red-500" /> :
                        <ClipboardList size={16} className="text-slate-400" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{exam.title}</p>
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
                    className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#0EA5E9] bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
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
  examData,
  onSubmitted,
  onExit,
  isSimulation = false,
}: {
  examData: StartExamData;
  onSubmitted: (result: ExamResult) => void;
  onExit?: () => void;
  isSimulation?: boolean;
}) {
  const totalSecs = examData.time_limit_mins ? examData.time_limit_mins * 60 : null;
  const storageKey = isSimulation ? null : `flowsensus_exam_draft_${examData.attempt_id}`;

  const [secsLeft, setSecsLeft] = useState<number | null>(totalSecs);
  const [answers, setAnswers] = useState<Record<number, number | null>>(() => {
    if (!storageKey) return {};
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {};
  });

  const [currentQIndex, setCurrentQIndex] = useState<number>(() => {
    if (!storageKey) return 0;
    try {
      const savedQ = localStorage.getItem(`${storageKey}_q_idx`);
      if (savedQ !== null) {
        const parsed = parseInt(savedQ, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < examData.questions.length) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return 0;
  });

  const [viewMode, setViewMode] = useState<'all' | 'stepper'>('all');
  const [showInstructions, setShowInstructions] = useState(true);
  const [showQuestionNavigator, setShowQuestionNavigator] = useState(false);
  const [navFilter, setNavFilter] = useState<'all' | 'unanswered' | 'answered'>('all');
  const [submitting, setSubmitting] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [lockVisible, setLockVisible] = useState(false);
  const [showNearingWarning, setShowNearingWarning] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const autoSubmitRef = useRef(false);

  const questions = examData.questions;
  const totalCount = questions.length;
  const answeredCount = Object.values(answers).filter((v) => v !== null && v !== undefined).length;
  const currentQuestion = questions[currentQIndex] || questions[0];

  // ── Auto-save draft answers to localStorage ────────────────────────────────
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(answers));
    } catch {
      // ignore
    }
  }, [answers, storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(`${storageKey}_q_idx`, String(currentQIndex));
    } catch {
      // ignore
    }
  }, [currentQIndex, storageKey]);

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
    const t = setTimeout(() => setSecsLeft((s) => (s !== null ? s - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [secsLeft]);

  const timerPct = totalSecs && secsLeft !== null ? (secsLeft / totalSecs) * 100 : 100;
  const timerColor =
    secsLeft !== null
      ? secsLeft <= 60
        ? 'bg-red-500'
        : secsLeft <= 300
        ? 'bg-amber-400'
        : 'bg-emerald-400'
      : 'bg-emerald-400';

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (isTimedOut = false) => {
      // For manual submission, require all questions to be answered
      if (!isTimedOut && answeredCount < totalCount) {
        return;
      }
      setSubmitting(true);

      // Simulation mode: score locally without API calls or saving to candidate records
      if (isSimulation) {
        let earned = 0;
        let totalPts = 0;
        const reviewAnswers: ReviewAnswer[] = questions.map((q) => {
          const chosenChoiceId = answers[q.question_id];
          const chosenChoice = q.choices.find((c) => c.choice_id === chosenChoiceId);
          const correctChoice = q.choices.find((c) => c.is_correct);
          const isCorrect = Boolean(chosenChoice && chosenChoice.is_correct);
          const pts = isCorrect ? (q.points || 1) : 0;
          earned += pts;
          totalPts += (q.points || 1);
          return {
            question_text: q.question_text,
            selected_text: chosenChoice?.choice_text || undefined,
            correct_text: correctChoice?.choice_text || undefined,
            is_correct: isCorrect,
            points_earned: pts,
            points_possible: q.points || 1,
          };
        });

        const pct = totalPts > 0 ? (earned / totalPts) * 100 : 0;
        const passScore = examData.passing_score ?? 60;
        const mockResult: ExamResult = {
          attempt_id: 0,
          percentage: pct,
          raw_score: earned,
          max_score: totalPts,
          is_passing: pct >= passScore,
          time_expired: isTimedOut,
          allow_review: true,
          review_answers: reviewAnswers,
        };

        if (isTimedOut) {
          setTimedOut(true);
          setSubmitting(false);
          setTimeout(() => {
            setLockVisible(true);
            setTimeout(() => onSubmitted(mockResult), 2000);
          }, 300);
        } else {
          setSubmitting(false);
          onSubmitted(mockResult);
        }
        return;
      }

      try {
        const answersPayload = questions.map((q) => ({
          question_id: q.question_id,
          selected_choice: answers[q.question_id] ?? null,
        }));
        const res = await api.post(`/exam-module/portal/submit/${examData.attempt_id}`, {
          answers: answersPayload,
          time_expired: isTimedOut,
        });

        // Clean up saved draft
        if (storageKey) {
          try {
            localStorage.removeItem(storageKey);
            localStorage.removeItem(`${storageKey}_q_idx`);
          } catch {
            // ignore
          }
        }

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
    },
    [answers, examData.attempt_id, examData.passing_score, questions, onSubmitted, storageKey, answeredCount, totalCount, isSimulation]
  );

  // ── Choice Selection (Allows Selecting & Unselecting) ────────────────────
  const handleToggleChoice = (questionId: number, choiceId: number) => {
    setAnswers((prev) => {
      const next = { ...prev };
      if (next[questionId] === choiceId) {
        delete next[questionId];
      } else {
        next[questionId] = choiceId;
      }
      return next;
    });
  };

  // ── Navigation Helpers ─────────────────────────────────────────────────────
  const goNext = () => {
    if (currentQIndex < totalCount - 1) {
      setCurrentQIndex((prev) => prev + 1);
    } else {
      setShowSubmitConfirm(true);
    }
  };

  const goPrev = () => {
    if (currentQIndex > 0) {
      setCurrentQIndex((prev) => prev - 1);
    }
  };

  const jumpToQuestion = (idx: number) => {
    if (idx >= 0 && idx < totalCount) {
      setCurrentQIndex(idx);
      if (viewMode === 'all') {
        const el = document.getElementById(`question-card-${idx}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  };

  const handleSaveAndExit = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(answers));
      localStorage.setItem(`${storageKey}_q_idx`, String(currentQIndex));
    } catch {
      // ignore
    }
    setShowExitConfirm(false);
    if (onExit) onExit();
  };

  // ── Time-up Lock Screen ────────────────────────────────────────────────────
  if (timedOut) {
    return (
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs transition-opacity duration-700 ${
          lockVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl text-center space-y-3 p-8 max-w-sm w-full mx-4">
          <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center mx-auto">
            <Clock size={28} className="text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-[#0F172A]">Time's Up</h2>
          <p className="text-slate-500 text-xs">
            Your assessment time has ended and your answers have been submitted automatically.
          </p>
          {submitting && <Loader2 className="animate-spin text-[#0EA5E9] mx-auto mt-2" size={20} />}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 md:p-6 animate-in fade-in duration-150">
      <div className="bg-white sm:rounded-2xl lg:rounded-3xl shadow-2xl w-full max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl h-[100dvh] sm:h-[94vh] lg:h-[90vh] flex flex-col overflow-hidden border-0 sm:border border-slate-200">
        {/* ── TOP HEADER (Save & Exit, Title, Mode, Timer) ── */}
        <div className="bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 sm:py-3.5 shrink-0 flex items-center justify-between gap-2 sm:gap-3 shadow-2xs">
          {/* Left: Save & Exit button */}
          <button
            type="button"
            onClick={() => setShowExitConfirm(true)}
            className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 transition-colors shrink-0 cursor-pointer"
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline">Save & Exit</span>
            <span className="sm:hidden text-[11px]">Exit</span>
          </button>

          {/* Center: Title, Question Navigator Trigger & View Switcher */}
          <div className="text-center min-w-0 flex-1 max-w-[170px] xs:max-w-[220px] sm:max-w-md md:max-w-lg">
            <h3 className="font-bold text-xs sm:text-sm md:text-base text-slate-900 truncate">
              {examData.title}
            </h3>
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
              {/* Question Navigator Trigger */}
              <button
                type="button"
                onClick={() => setShowQuestionNavigator(true)}
                className="text-[10px] sm:text-[11px] font-bold text-slate-700 hover:text-[#0EA5E9] bg-slate-100 hover:bg-sky-50 px-2 py-0.5 rounded-full border border-slate-200 hover:border-sky-300 transition-colors inline-flex items-center gap-1 cursor-pointer"
                title="Open question overview grid"
              >
                <ClipboardList size={11} className="text-[#0EA5E9]" />
                <span>{answeredCount} of {totalCount} answered</span>
                <ChevronDown size={11} className="text-slate-400" />
              </button>

              <span className="text-slate-300 hidden sm:inline">•</span>

              {/* View Switcher */}
              <button
                type="button"
                onClick={() => setViewMode((prev) => (prev === 'all' ? 'stepper' : 'all'))}
                className="text-[10px] sm:text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-0.5 rounded-full border border-slate-200 inline-flex items-center gap-1 transition-colors cursor-pointer"
                title={viewMode === 'all' ? 'Switch to single question view' : 'View all questions in a list'}
              >
                {viewMode === 'all' ? (
                  <>
                    <BookOpen size={11} className="text-slate-600" /> Single Question
                  </>
                ) : (
                  <>
                    <LayoutGrid size={11} className="text-slate-600" /> View All
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right: Timer Badge */}
          {secsLeft !== null ? (
            <div
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-mono font-bold shrink-0 ${
                secsLeft <= 60
                  ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse'
                  : secsLeft <= 300
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              <Clock size={13} className={secsLeft <= 60 ? 'animate-pulse' : ''} />
              <span>{formatTime(secsLeft)}</span>
            </div>
          ) : (
            <div className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-500 bg-slate-100 shrink-0">
              Untimed
            </div>
          )}
        </div>

        {/* ── PROGRESS BAR ── */}
        <div className="h-1 sm:h-1.5 bg-slate-100 shrink-0">
          <div
            className="h-full bg-sky-600 transition-all duration-300"
            style={{ width: `${(answeredCount / Math.max(totalCount, 1)) * 100}%` }}
          />
        </div>

        {/* ≤1 min warning banner */}
        {showNearingWarning && secsLeft !== null && secsLeft > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border-b border-amber-300 text-amber-900 text-xs font-semibold px-4 py-2 shrink-0 animate-in slide-in-from-top-1">
            <Clock size={13} className="shrink-0 animate-pulse text-amber-600" />
            <span>Less than 1 minute remaining — please review and submit your answers soon.</span>
          </div>
        )}

        {/* ── QUESTION BODY CONTENT ── */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 md:p-8 bg-slate-50/50">
          <div className="w-full space-y-4 sm:space-y-6">
            {/* ── EXAM INSTRUCTIONS ── */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-2xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                    <FileText size={16} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Assessment Instructions
                    </h4>
                    <p className="text-xs text-slate-500">
                      General assessment guidelines and details
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowInstructions((prev) => !prev)}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  {showInstructions ? (
                    <>
                      Hide <ChevronUp size={13} />
                    </>
                  ) : (
                    <>
                      Show <ChevronDown size={13} />
                    </>
                  )}
                </button>
              </div>

              {showInstructions && (
                <div className="mt-3.5 pt-3 space-y-3 text-xs text-slate-700 border-t border-slate-100 animate-in fade-in duration-150">
                  {/* Summary pills */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 font-medium">
                      <ClipboardList size={13} className="text-slate-500" />
                      <span>{totalCount} Questions</span>
                    </span>
                    {examData.passing_score !== undefined && examData.passing_score !== null && (
                      <span className="inline-flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 font-medium">
                        <CheckCircle2 size={13} className="text-emerald-600" />
                        <span>Passing Score: <strong>{examData.passing_score}%</strong></span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 font-medium">
                      <Clock size={13} className="text-slate-500" />
                      <span>{examData.time_limit_mins ? `${examData.time_limit_mins} mins` : 'Untimed'}</span>
                    </span>
                  </div>

                  {/* Description / notes if available */}
                  {examData.description && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed">
                      <span className="font-semibold text-slate-900 block mb-0.5">Note:</span>
                      {examData.description}
                    </div>
                  )}

                  {/* Standard Guidelines */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs text-slate-600">
                    <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200">
                      <span className="font-semibold text-slate-900 block mb-0.5">1. Answer Format</span>
                      Select an answer for each question. You may change your choice before submitting.
                    </div>
                    <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200">
                      <span className="font-semibold text-slate-900 block mb-0.5">2. Automatic Saving</span>
                      Your progress is saved automatically. You can click <strong>Save & Exit</strong> to pause.
                    </div>
                    <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200">
                      <span className="font-semibold text-slate-900 block mb-0.5">3. Question Review</span>
                      Open the question overview anytime to check answered and remaining items.
                    </div>
                    <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200">
                      <span className="font-semibold text-slate-900 block mb-0.5">4. Submitting</span>
                      When finished, click <strong>Submit Exam</strong> to finalize your answers.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {viewMode === 'stepper' ? (
              /* ── STEPPER (CARD VIEW) ── */
              <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-200">
                    Question {currentQIndex + 1} of {totalCount}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    {currentQuestion.points} {currentQuestion.points === 1 ? 'Point' : 'Points'}
                  </span>
                </div>

                <h4 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                  {currentQuestion.question_text}
                </h4>

                {/* Choices */}
                <div className="space-y-3 mt-5">
                  {currentQuestion.choices.map((c, ci) => {
                    const isSelected = answers[currentQuestion.question_id] === c.choice_id;
                    const letter = String.fromCharCode(65 + ci);

                    return (
                      <button
                        key={c.choice_id}
                        type="button"
                        onClick={() => handleToggleChoice(currentQuestion.question_id, c.choice_id)}
                        className={`w-full text-left p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all flex items-center gap-3.5 min-h-[48px] sm:min-h-[52px] active:scale-[0.99] cursor-pointer ${
                          isSelected
                            ? 'border-[#0EA5E9] bg-sky-50/90 text-sky-950 font-semibold shadow-xs ring-1 ring-[#0EA5E9]'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 text-slate-700'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs sm:text-sm font-extrabold flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-[#0EA5E9] text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {letter}
                        </span>
                        <span className="text-xs sm:text-sm flex-1 leading-relaxed">
                          {c.choice_text}
                        </span>
                        {isSelected && (
                          <Check size={18} className="text-[#0EA5E9] shrink-0" strokeWidth={2.5} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* ── ALL QUESTIONS VIEW ── */
              <div className="space-y-4 sm:space-y-5">
                {questions.map((q, qi) => (
                  <div
                    key={q.question_id}
                    id={`question-card-${qi}`}
                    className={`bg-white border rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 shadow-2xs space-y-3.5 scroll-mt-4 transition-all ${
                      qi === currentQIndex ? 'border-sky-300 ring-2 ring-sky-100' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 sm:gap-3">
                        <span className="shrink-0 w-6 h-6 sm:w-7 sm:h-7 bg-sky-50 text-[#0EA5E9] border border-sky-100 rounded-full text-xs sm:text-sm font-extrabold flex items-center justify-center">
                          {qi + 1}
                        </span>
                        <p className="text-sm sm:text-base font-semibold text-slate-900 leading-relaxed">
                          {q.question_text}
                        </p>
                      </div>
                      <span className="text-[11px] sm:text-xs text-slate-400 shrink-0 font-medium bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                        {q.points} pt
                      </span>
                    </div>

                    <div className="space-y-2.5 pt-1">
                      {q.choices.map((c, ci) => {
                        const isSelected = answers[q.question_id] === c.choice_id;
                        const letter = String.fromCharCode(65 + ci);
                        return (
                          <button
                            key={c.choice_id}
                            type="button"
                            onClick={() => {
                              handleToggleChoice(q.question_id, c.choice_id);
                              setCurrentQIndex(qi);
                            }}
                            className={`w-full text-left flex items-center gap-3 sm:gap-3.5 p-3 sm:p-3.5 rounded-xl border-2 text-xs sm:text-sm font-medium min-h-[48px] sm:min-h-[50px] transition-all active:scale-[0.99] cursor-pointer ${
                              isSelected
                                ? 'border-[#0EA5E9] bg-sky-50/90 text-sky-950 font-semibold shadow-2xs ring-1 ring-[#0EA5E9]'
                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 bg-white'
                            }`}
                          >
                            <span
                              className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 transition-colors ${
                                isSelected ? 'bg-[#0EA5E9] text-white shadow-2xs' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {letter}
                            </span>
                            <span className="flex-1 leading-relaxed">{c.choice_text}</span>
                            {isSelected && (
                              <Check size={16} className="text-[#0EA5E9] shrink-0" strokeWidth={2.5} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── STICKY BOTTOM ACTION BAR (Mobile, Tablet & Laptop) ── */}
        <div className="bg-white border-t border-slate-200 px-3 sm:px-6 py-2.5 sm:py-3 shrink-0 flex items-center justify-between gap-2 sm:gap-3 shadow-md pb-[max(0.65rem,env(safe-area-inset-bottom))]">
          {viewMode === 'all' ? (
            <>
              {/* Left / Status Indicator & Jump Trigger */}
              <button
                type="button"
                onClick={() => setShowQuestionNavigator(true)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition-colors text-left cursor-pointer group"
                title="Open question navigator grid"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-[#0EA5E9]">
                      {answeredCount} of {totalCount} Answered
                    </span>
                    <ChevronUp size={13} className="text-slate-400 group-hover:text-[#0EA5E9]" />
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {answeredCount === totalCount ? (
                      <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded-full border border-emerald-200">
                        ✓ All Answered
                      </span>
                    ) : (
                      <span className="text-[10px] sm:text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.2 rounded-full border border-amber-200">
                        {totalCount - answeredCount} Left (Tap to review)
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {/* Right: Submit Button */}
              <button
                type="button"
                onClick={() => {
                  if (answeredCount === totalCount) {
                    setShowSubmitConfirm(true);
                  } else {
                    setShowQuestionNavigator(true);
                  }
                }}
                disabled={answeredCount < totalCount}
                className={`inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
                  answeredCount === totalCount
                    ? 'text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
                title={answeredCount < totalCount ? `Please answer all questions to submit (${answeredCount}/${totalCount})` : 'Submit'}
              >
                <span>Submit</span> <Check size={16} strokeWidth={2.5} />
              </button>
            </>
          ) : (
            <>
              {/* Previous Button */}
              <button
                type="button"
                onClick={goPrev}
                disabled={currentQIndex === 0}
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} /> <span className="hidden xs:inline">Previous</span>
              </button>

              {/* Center: Tap to open Question Navigator */}
              <button
                type="button"
                onClick={() => setShowQuestionNavigator(true)}
                className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-center transition-colors group cursor-pointer"
                title="Jump to question"
              >
                <span className="text-xs font-bold text-slate-700 group-hover:text-[#0EA5E9] flex items-center gap-1">
                  Q {currentQIndex + 1} / {totalCount}
                  <ChevronUp size={11} className="text-slate-400 group-hover:text-[#0EA5E9]" />
                </span>
              </button>

              {/* Next / Submit Button */}
              {currentQIndex < totalCount - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#0EA5E9] hover:bg-[#0284C7] shadow-sm transition-all cursor-pointer"
                >
                  <span className="hidden xs:inline">Next</span> <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (answeredCount === totalCount) {
                      setShowSubmitConfirm(true);
                    } else {
                      setShowQuestionNavigator(true);
                    }
                  }}
                  disabled={answeredCount < totalCount}
                  className={`inline-flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    answeredCount === totalCount
                      ? 'text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                  title={answeredCount < totalCount ? `Please answer all questions to submit (${answeredCount}/${totalCount})` : 'Submit'}
                >
                  <span>Submit</span> <Check size={16} strokeWidth={2.5} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── QUESTION NAVIGATOR MODAL (Handles 5, 20, 50, 100+ items seamlessly) ── */}
      {showQuestionNavigator && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-[#0EA5E9] flex items-center justify-center font-bold">
                  <LayoutGrid size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Question Overview</h3>
                  <p className="text-[11px] text-slate-500">
                    {answeredCount} of {totalCount} answered ({Math.round((answeredCount / Math.max(totalCount, 1)) * 100)}%)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuestionNavigator(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter Tabs & Legend */}
            <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setNavFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    navFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All ({totalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setNavFilter('unanswered')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    navFilter === 'unanswered'
                      ? 'bg-amber-100/70 text-amber-900 font-bold border border-amber-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Unanswered ({totalCount - answeredCount})
                </button>
                <button
                  type="button"
                  onClick={() => setNavFilter('answered')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    navFilter === 'answered'
                      ? 'bg-sky-100/70 text-sky-900 font-bold border border-sky-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Answered ({answeredCount})
                </button>
              </div>

              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-sky-500 inline-block" /> Answered
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded border border-slate-300 bg-white inline-block" /> Unanswered
                </span>
              </div>
            </div>

            {/* Grid Container (5 cols on mobile, 8-10 on tablet/desktop) */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                {questions.map((q, qi) => {
                  const isAnswered = answers[q.question_id] !== undefined && answers[q.question_id] !== null;
                  const isCurrent = qi === currentQIndex;

                  if (navFilter === 'answered' && !isAnswered) return null;
                  if (navFilter === 'unanswered' && isAnswered) return null;

                  let btnStyle = 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50';
                  if (isCurrent) {
                    btnStyle = 'bg-sky-500 text-white font-black ring-2 ring-sky-300 border-sky-500 shadow-xs';
                  } else if (isAnswered) {
                    btnStyle = 'bg-sky-50 border-sky-300 text-sky-800 font-bold';
                  }

                  return (
                    <button
                      key={q.question_id}
                      type="button"
                      onClick={() => {
                        jumpToQuestion(qi);
                        setShowQuestionNavigator(false);
                      }}
                      className={`h-10 sm:h-11 rounded-xl border flex flex-col items-center justify-center text-xs relative transition-all active:scale-95 cursor-pointer ${btnStyle}`}
                    >
                      <span>{qi + 1}</span>
                      {isAnswered && !isCurrent && (
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">
                Tap any question number to jump directly to it
              </span>
              <button
                type="button"
                onClick={() => setShowQuestionNavigator(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SAVE & EXIT CONFIRMATION MODAL ── */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-sm w-full space-y-4">
            <div className="w-12 h-12 rounded-xl bg-sky-50 text-[#0EA5E9] flex items-center justify-center mx-auto">
              <BookmarkCheck size={26} />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Save Progress & Exit?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                You have answered <strong>{answeredCount}</strong> of <strong>{totalCount}</strong>{' '}
                questions. Your answers are saved, and you can resume this assessment anytime from your
                portal dashboard.
              </p>
              {totalSecs && (
                <p className="text-[11px] text-amber-600 font-medium mt-2 bg-amber-50 p-2 rounded-lg border border-amber-200">
                  ⏳ Note: If this assessment is timed, the countdown continues while away.
                </p>
              )}
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Keep Taking
              </button>
              <button
                type="button"
                onClick={handleSaveAndExit}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-[#0EA5E9] hover:bg-[#0284C7] rounded-xl shadow-sm transition-colors"
              >
                Save & Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUBMIT CONFIRMATION MODAL ── */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-sm w-full space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle size={26} />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Submit Assessment?</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {answeredCount === totalCount ? (
                  <span className="text-emerald-600 font-semibold">
                    ✓ All {totalCount} questions answered
                  </span>
                ) : (
                  <span className="text-amber-600 font-bold">
                    {totalCount - answeredCount} of {totalCount} question(s) remaining
                  </span>
                )}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Once submitted, your answers will be finalized and cannot be changed.
              </p>
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Review
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={submitting || answeredCount < totalCount}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Submitting...
                  </>
                ) : (
                  'Submit'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RESULT SCREEN
// ══════════════════════════════════════════════════════════════════════════════

function ResultScreen({
  result,
  onBack,
  backLabel,
  onExit,
}: {
  result: ExamResult;
  onBack: () => void;
  backLabel?: string;
  onExit?: () => void;
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
            className="w-full flex items-center justify-between px-5 py-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2"><Eye size={14} className="text-[#0EA5E9]" /> Review Test Answers</span>
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
          Answer review is not enabled for this assessment.
        </div>
      )}

      {onExit ? (
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:border-[#0EA5E9] hover:text-[#0EA5E9] rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
          >
            <RotateCcw size={14} /> {backLabel || 'Retake Test'}
          </button>
          <button
            onClick={onExit}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
          >
            Exit Preview
          </button>
        </div>
      ) : (
        <button
          onClick={onBack}
          className="w-full py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:border-[#0EA5E9] hover:text-[#0EA5E9] rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
        >
          <Home size={14} /> {backLabel || 'Back to Assessments'}
        </button>
      )}
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
              <ClipboardList size={20} className="text-[#0EA5E9]" />
              {view === 'list' ? 'Assigned Assessments' : view === 'result' ? 'Assessment Result' : ''}
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
          <span className="ml-2 text-slate-500 text-sm">Loading assessment...</span>
        </div>
      )}

      {/* Views */}
      {!starting && view === 'list' && (
        <MyExamsDashboard onStart={handleStart} onViewResult={handleViewResult} />
      )}
      {!starting && view === 'taking' && examData && (
        <ExamTaker examData={examData} onSubmitted={handleSubmitted} onExit={handleBack} />
      )}
      {!starting && view === 'result' && result && (
        <ResultScreen result={result} onBack={handleBack} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EXAM SIMULATOR MODAL (Interactive Candidate View & Scoring Sandbox)
// ══════════════════════════════════════════════════════════════════════════════

export interface ExamSimulatorTemplate {
  template_id?: number;
  title: string;
  description?: string;
  category?: string;
  passing_score?: number;
  time_limit_mins?: number;
  allow_review?: boolean;
  questions?: Array<{
    question_id?: number;
    question_text: string;
    points?: number;
    choices: Array<{
      choice_id?: number;
      choice_text: string;
      is_correct?: boolean;
    }>;
  }>;
}

export function ExamSimulatorModal({
  template,
  onClose,
}: {
  template: ExamSimulatorTemplate;
  onClose: () => void;
}) {
  const [result, setResult] = useState<ExamResult | null>(null);

  const examData: StartExamData = useMemo(() => {
    const rawQuestions = template.questions || [];
    return {
      attempt_id: -999,
      assignment_id: 0,
      template_id: template.template_id || 0,
      title: template.title || 'Untitled Assessment',
      description: template.description || '',
      passing_score: template.passing_score ?? 60,
      time_limit_mins: template.time_limit_mins,
      started_at: new Date().toISOString(),
      questions: rawQuestions.map((q, qIdx) => ({
        question_id: q.question_id || qIdx + 1,
        question_text: q.question_text || '',
        question_order: qIdx + 1,
        points: q.points || 1,
        choices: (q.choices || []).map((c, cIdx) => ({
          choice_id: c.choice_id || cIdx + 1,
          choice_text: c.choice_text || '',
          choice_order: cIdx + 1,
          is_correct: c.is_correct,
        })),
      })),
    };
  }, [template]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Top Simulation Header */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-900 text-white flex items-center justify-between text-xs font-medium border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className="bg-sky-500/20 text-sky-300 border border-sky-400/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
              Interactive Preview
            </span>
            <span className="text-slate-300 hidden sm:inline">
              Candidate portal simulation (real-time answering, auto-timer & scoring)
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-slate-300 hover:text-white px-2 py-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span>Exit Preview</span>
            <X size={14} />
          </button>
        </div>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
          {examData.questions.length === 0 ? (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-2xs">
              <BookOpen size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">No questions found</p>
              <p className="text-xs text-slate-400 mt-1">
                Please author or add questions in this test before running the applicant preview.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Return to Editor
              </button>
            </div>
          ) : result ? (
            <div className="max-w-2xl mx-auto">
              <ResultScreen
                result={result}
                onBack={() => setResult(null)}
                backLabel="Retake Test (Simulation)"
                onExit={onClose}
              />
            </div>
          ) : (
            <ExamTaker
              examData={examData}
              onSubmitted={setResult}
              onExit={onClose}
              isSimulation={true}
            />
          )}
        </div>
      </div>
    </div>
  );
}
