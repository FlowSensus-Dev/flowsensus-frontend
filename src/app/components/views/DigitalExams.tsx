/**
 * DigitalExams.tsx — Digital Exam Manager
 * =========================================
 * Clean, staff-friendly digital exam manager for recruitment and HR staff:
 *   - Create and edit online exams for applicants
 *   - Add questions, answer choices, and mark the correct answer
 *   - Set time limits, passing scores, and answer review options
 *   - Link exams directly to screening evaluation requirements
 *   - Assign exams to applicants by job order
 *   - Preview exams exactly as applicants see them in their portal
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, BookOpen, Trash2, Edit3, ChevronRight,
  CheckCircle2, Clock, Send, Eye,
  Loader2, X, Check, Minus, Search,
  Link as LinkIcon, FileText, Zap, ToggleLeft, ToggleRight,
  HelpCircle, AlertCircle, Info, Sparkles
} from 'lucide-react';
import { api } from '../../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExamChoice {
  choice_id?: number;
  choice_text: string;
  is_correct: boolean;
  choice_order: number;
}

interface ExamQuestion {
  question_id?: number;
  template_id?: number;
  question_text: string;
  question_order: number;
  points: number;
  choices: ExamChoice[];
}

interface ExamTemplate {
  template_id: number;
  title: string;
  description?: string;
  exam_type: 'paper' | 'digital';
  category?: string;
  passing_score?: number;
  time_limit_mins?: number;
  randomize: boolean;
  allow_review: boolean;
  is_active: boolean;
  evaluation_template_id?: number | null;
  created_at: string;
  questions?: ExamQuestion[];
}

interface EvaluationTemplateOption {
  test_template_id: number;
  name: string;
  test_type: string;
  weight_percentage: number;
  passing_score: number;
  exam_mode?: string;
}

interface JobOrder {
  job_order_id: number;
  position: string;
  job_code: string;
  employer_name?: string;
}

interface Props {
  showToast: (msg: string) => void;
  currentUserName: string;
  globalJobOrders?: JobOrder[];
}

// ── Constants & Helpers ────────────────────────────────────────────────────────

const CATEGORIES = [
  'General Knowledge',
  'English Proficiency',
  'IQ / Aptitude',
  'Trade & Technical Skills',
  'Personality / EQ',
  'Medical & Safety',
  'Other'
];

function newQuestion(order: number): ExamQuestion {
  return {
    question_text: '',
    question_order: order,
    points: 1,
    choices: [
      { choice_text: '', is_correct: true, choice_order: 0 },
      { choice_text: '', is_correct: false, choice_order: 1 },
      { choice_text: '', is_correct: false, choice_order: 2 },
      { choice_text: '', is_correct: false, choice_order: 3 },
    ],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// QUESTION CARD (Authoring)
// ══════════════════════════════════════════════════════════════════════════════

function QuestionCard({
  q,
  idx,
  totalQuestions,
  onUpdate,
  onDelete,
}: {
  q: ExamQuestion;
  idx: number;
  totalQuestions: number;
  onUpdate: (q: ExamQuestion) => void;
  onDelete: () => void;
}) {
  const setCorrect = (ci: number) => {
    onUpdate({
      ...q,
      choices: q.choices.map((c, i) => ({ ...c, is_correct: i === ci })),
    });
  };

  const updateChoice = (ci: number, text: string) => {
    onUpdate({
      ...q,
      choices: q.choices.map((c, i) => (i === ci ? { ...c, choice_text: text } : c)),
    });
  };

  const addChoice = () => {
    if (q.choices.length >= 6) return;
    onUpdate({
      ...q,
      choices: [
        ...q.choices,
        { choice_text: '', is_correct: false, choice_order: q.choices.length },
      ],
    });
  };

  const removeChoice = (ci: number) => {
    if (q.choices.length <= 2) return;
    const updated = q.choices
      .filter((_, i) => i !== ci)
      .map((c, i) => ({ ...c, choice_order: i }));

    // If the removed choice was the correct one, make the first choice correct
    const wasCorrect = q.choices[ci]?.is_correct;
    if (wasCorrect && updated.length > 0) {
      updated[0].is_correct = true;
    }
    onUpdate({ ...q, choices: updated });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <span className="font-bold text-xs text-slate-700">
          Question {idx + 1} of {totalQuestions}
        </span>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-slate-600">
            <span className="text-[11px] text-slate-400">Score value:</span>
            <input
              type="number"
              min={1}
              max={100}
              value={q.points}
              onChange={(e) => onUpdate({ ...q, points: Math.max(1, parseInt(e.target.value) || 1) })}
              className="w-12 text-center text-xs font-semibold px-1 py-0.5 border border-slate-200 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
            />
            <span className="text-[11px] text-slate-400">pt{q.points > 1 ? 's' : ''}</span>
          </div>

          <button
            type="button"
            onClick={onDelete}
            title="Delete this question"
            className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Question Prompt */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
            Question Text *
          </label>
          <textarea
            rows={2}
            placeholder="Type your question here (e.g. Which tool is used to measure electrical voltage?)..."
            value={q.question_text}
            onChange={(e) => onUpdate({ ...q, question_text: e.target.value })}
            className="w-full text-xs text-slate-800 border border-slate-200 rounded-lg p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
          />
        </div>

        {/* Choices */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">
              Answer Choices (Click the green checkmark circle to mark the correct answer):
            </span>
          </div>

          <div className="space-y-1.5">
            {q.choices.map((c, ci) => {
              const letter = String.fromCharCode(65 + ci);
              return (
                <div
                  key={ci}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 border transition-all ${
                    c.is_correct
                      ? 'bg-emerald-50/70 border-emerald-300'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setCorrect(ci)}
                    title={c.is_correct ? 'Correct Answer' : 'Click to set as correct answer'}
                    className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center transition-all ${
                      c.is_correct
                        ? 'border-[#10B981] bg-[#10B981] text-white'
                        : 'border-slate-300 hover:border-[#10B981] bg-white'
                    }`}
                  >
                    {c.is_correct && <Check size={11} className="stroke-[3]" />}
                  </button>

                  <span
                    className={`w-5 h-5 rounded text-[11px] font-bold flex items-center justify-center shrink-0 ${
                      c.is_correct ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {letter}
                  </span>

                  <input
                    type="text"
                    placeholder={`Option ${letter}...`}
                    value={c.choice_text}
                    onChange={(e) => updateChoice(ci, e.target.value)}
                    className="flex-1 text-xs bg-transparent border-none outline-none text-slate-800 placeholder:text-slate-400 font-medium"
                  />

                  {c.is_correct && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                      Correct Answer
                    </span>
                  )}

                  {q.choices.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeChoice(ci)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                      title="Remove option"
                    >
                      <Minus size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {q.choices.length < 6 && (
            <button
              type="button"
              onClick={addChoice}
              className="text-xs text-[#0EA5E9] hover:text-[#0284C7] font-semibold flex items-center gap-1 mt-1 transition-colors"
            >
              <Plus size={13} /> Add another choice
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PREVIEW MODAL (Applicant View)
// ══════════════════════════════════════════════════════════════════════════════

function PreviewModal({
  template,
  onClose,
}: {
  template: ExamTemplate;
  onClose: () => void;
}) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showResult, setShowResult] = useState(false);
  const questions = template.questions || [];

  const handleSelect = (qIdx: number, cIdx: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: cIdx }));
  };

  const calculateScore = () => {
    let earned = 0;
    let total = 0;
    questions.forEach((q, idx) => {
      total += q.points;
      const chosen = selectedAnswers[idx];
      if (chosen !== undefined && q.choices[chosen]?.is_correct) {
        earned += q.points;
      }
    });
    return total > 0 ? (earned / total) * 100 : 0;
  };

  const scorePct = calculateScore();
  const passingScore = template.passing_score ?? 60;
  const isPassed = scorePct >= passingScore;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                Applicant View Preview
              </span>
              {template.time_limit_mins ? (
                <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                  <Clock size={11} /> {template.time_limit_mins} mins
                </span>
              ) : null}
            </div>
            <h2 className="font-bold text-[#0F172A] text-base mt-1">{template.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        {/* Info */}
        <div className="bg-slate-50 px-5 py-2.5 border-b border-slate-200 text-xs text-slate-600 flex items-center justify-between">
          <span>This is a preview of how the applicant answers this exam in their portal.</span>
          <span className="font-semibold text-slate-700">
            Passing Mark: {passingScore}%
          </span>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {questions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-medium">
              No questions have been added to this exam yet.
            </div>
          ) : (
            questions.map((q, qIdx) => (
              <div key={qIdx} className="p-4 bg-slate-50/60 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">
                    Question {qIdx + 1} ({q.points} pt{q.points > 1 ? 's' : ''})
                  </span>
                  {selectedAnswers[qIdx] !== undefined && (
                    <span className="text-[11px] text-[#10B981] font-semibold flex items-center gap-1">
                      <CheckCircle2 size={12} /> Answered
                    </span>
                  )}
                </div>

                <p className="text-xs font-semibold text-slate-900 leading-relaxed">
                  {q.question_text || '(Empty question prompt)'}
                </p>

                <div className="space-y-1.5 pt-1">
                  {q.choices.map((c, cIdx) => {
                    const isSelected = selectedAnswers[qIdx] === cIdx;
                    const letter = String.fromCharCode(65 + cIdx);
                    return (
                      <div
                        key={cIdx}
                        onClick={() => handleSelect(qIdx, cIdx)}
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center gap-2.5 ${
                          isSelected
                            ? 'bg-sky-50 border-[#0EA5E9] text-sky-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/70'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded text-[11px] font-bold flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-[#0EA5E9] text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {letter}
                        </span>
                        <span className="flex-1">{c.choice_text || `(Option ${letter})`}</span>
                        {showResult && c.is_correct && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                            Correct Answer
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {showResult && (
            <div
              className={`p-4 rounded-xl border text-xs ${
                isPassed ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm">
                    {isPassed ? '✓ Passed Examination' : '✕ Did Not Pass'}
                  </span>
                  <p className="mt-0.5">
                    Score: <strong>{scorePct.toFixed(1)}%</strong> (Passing benchmark: {passingScore}%)
                  </p>
                </div>
                <button
                  onClick={() => setShowResult(false)}
                  className="px-2.5 py-1 text-xs font-semibold bg-white border border-current rounded-md"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {Object.keys(selectedAnswers).length} of {questions.length} answered
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              Close
            </button>
            <button
              onClick={() => setShowResult(true)}
              disabled={questions.length === 0}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0EA5E9] hover:bg-[#0284C7] disabled:opacity-50 rounded-lg shadow-sm"
            >
              Test Scoring
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN VIEW: DIGITAL EXAMS
// ══════════════════════════════════════════════════════════════════════════════

export default function DigitalExams({
  showToast,
  currentUserName,
  globalJobOrders = [],
}: Props) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<ExamTemplate[]>([]);
  const [evaluationTemplates, setEvaluationTemplates] = useState<EvaluationTemplateOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [formTab, setFormTab] = useState<'info' | 'questions'>('info');
  const [selectedTemplate, setSelectedTemplate] = useState<ExamTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<ExamTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Form State
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'General Knowledge',
    passing_score: '60',
    time_limit_enabled: false,
    time_limit_mins: '30',
    randomize: false,
    allow_review: true,
    is_active: true,
    evaluation_template_id: '' as string | number,
  });
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [formError, setFormError] = useState('');

  // Assign State
  const [assignTemplateId, setAssignTemplateId] = useState<number | null>(null);
  const [assignJobOrderId, setAssignJobOrderId] = useState<number | null>(null);
  const [assignDueDate, setAssignDueDate] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Delete Confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // ── Load Templates ────────────────────────────────────────────────────────
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/exam-module/templates');
      setTemplates(res.data || []);
    } catch {
      showToast('Could not load digital exams.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadEvaluationTemplates = useCallback(async () => {
    try {
      const res = await api.get('/evaluations/templates');
      setEvaluationTemplates(res.data || []);
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    loadTemplates();
    loadEvaluationTemplates();
  }, [loadTemplates, loadEvaluationTemplates]);

  // ── Filtered Templates ───────────────────────────────────────────────────
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        (t.category && t.category.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q));

      const matchCategory =
        categoryFilter === 'ALL' ||
        (t.category && t.category.toLowerCase() === categoryFilter.toLowerCase());

      return matchSearch && matchCategory;
    });
  }, [templates, searchQuery, categoryFilter]);

  // ── Reset Form ───────────────────────────────────────────────────────────
  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      category: 'General Knowledge',
      passing_score: '60',
      time_limit_enabled: false,
      time_limit_mins: '30',
      randomize: false,
      allow_review: true,
      is_active: true,
      evaluation_template_id: '',
    });
    setQuestions([newQuestion(0)]);
    setFormError('');
    setSelectedTemplate(null);
    setFormTab('info');
  };

  const openCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  // ── Open Edit ────────────────────────────────────────────────────────────
  const openEdit = async (tmpl: ExamTemplate) => {
    try {
      const res = await api.get(`/exam-module/templates/${tmpl.template_id}`);
      const t: ExamTemplate = res.data;
      setSelectedTemplate(t);
      setForm({
        title: t.title,
        description: t.description || '',
        category: t.category || 'General Knowledge',
        passing_score: t.passing_score ? String(t.passing_score) : '60',
        time_limit_enabled: Boolean(t.time_limit_mins),
        time_limit_mins: t.time_limit_mins ? String(t.time_limit_mins) : '30',
        randomize: Boolean(t.randomize),
        allow_review: Boolean(t.allow_review),
        is_active: Boolean(t.is_active),
        evaluation_template_id: t.evaluation_template_id ? String(t.evaluation_template_id) : '',
      });
      setQuestions(t.questions && t.questions.length > 0 ? t.questions : [newQuestion(0)]);
      setFormError('');
      setFormTab('info');
      setIsFormOpen(true);
    } catch {
      showToast('Could not load exam details.');
    }
  };

  // ── Save Exam ────────────────────────────────────────────────────────────
  const saveTemplate = async () => {
    setFormError('');
    if (!form.title.trim()) {
      setFormError('Please enter an exam title.');
      setFormTab('info');
      return;
    }
    if (questions.length === 0) {
      setFormError('Please add at least one question.');
      setFormTab('questions');
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) {
        setFormError(`Question ${i + 1} needs question text.`);
        setFormTab('questions');
        return;
      }
      if (!q.choices.some((c) => c.is_correct)) {
        setFormError(`Question ${i + 1} needs a correct answer marked.`);
        setFormTab('questions');
        return;
      }
      if (q.choices.some((c) => !c.choice_text.trim())) {
        setFormError(`Please fill in all choices for question ${i + 1}.`);
        setFormTab('questions');
        return;
      }
    }

    setSaving(true);
    try {
      const evalTemplateId = form.evaluation_template_id
        ? Number(form.evaluation_template_id)
        : null;

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        exam_type: 'digital',
        category: form.category || null,
        passing_score: form.passing_score ? Number(form.passing_score) : 60,
        time_limit_mins:
          form.time_limit_enabled && form.time_limit_mins ? Number(form.time_limit_mins) : null,
        randomize: form.randomize,
        allow_review: form.allow_review,
        is_active: form.is_active,
        evaluation_template_id: evalTemplateId,
      };

      let templateId: number;
      if (selectedTemplate) {
        await api.put(`/exam-module/templates/${selectedTemplate.template_id}`, payload);
        templateId = selectedTemplate.template_id;
        showToast(`Exam "${form.title}" updated successfully.`);
      } else {
        const res = await api.post('/exam-module/templates', payload);
        templateId = res.data.template_id;
        showToast(`Exam "${form.title}" created successfully.`);
      }

      // Save questions
      await api.put(`/exam-module/templates/${templateId}/questions`, questions);

      // Link with evaluation if selected
      if (evalTemplateId) {
        try {
          await api.put(`/evaluations/templates/${evalTemplateId}`, {
            exam_mode: 'digital',
            digital_exam_template_id: templateId,
          });
        } catch {
          // Non-blocking
        }
      }

      setIsFormOpen(false);
      resetForm();
      loadTemplates();
      loadEvaluationTemplates();
    } catch (e: any) {
      setFormError(e?.response?.data?.detail || 'Failed to save exam.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete Template ──────────────────────────────────────────────────────
  const deleteTemplate = async (id: number) => {
    try {
      await api.delete(`/exam-module/templates/${id}`);
      setDeleteConfirm(null);
      showToast('Exam deleted successfully.');
      loadTemplates();
    } catch {
      showToast('Could not delete exam.');
    }
  };

  // ── Toggle Active Status ─────────────────────────────────────────────────
  const toggleActive = async (templateId: number, currentActive: boolean) => {
    try {
      await api.put(`/exam-module/templates/${templateId}`, { is_active: !currentActive });
      setTemplates((prev) =>
        prev.map((t) => (t.template_id === templateId ? { ...t, is_active: !currentActive } : t))
      );
    } catch {
      showToast('Could not update status.');
    }
  };

  // ── Assign to Job Order ──────────────────────────────────────────────────
  const assignExam = async () => {
    if (!assignTemplateId || !assignJobOrderId) {
      showToast('Please select both an exam and a job order.');
      return;
    }
    setAssigning(true);
    try {
      const res = await api.post('/exam-module/assign', {
        template_id: assignTemplateId,
        job_order_id: assignJobOrderId,
        due_date: assignDueDate || null,
      });
      showToast(res.data.message || 'Exam assigned successfully.');
      setIsAssignOpen(false);
      setAssignTemplateId(null);
      setAssignJobOrderId(null);
      setAssignDueDate('');
    } catch (e: any) {
      showToast(e?.response?.data?.detail || 'Could not assign exam.');
    } finally {
      setAssigning(false);
    }
  };

  // ── Question Helpers ─────────────────────────────────────────────────────
  const addQuestion = () => setQuestions((prev) => [...prev, newQuestion(prev.length)]);
  const updateQuestion = (idx: number, q: ExamQuestion) => {
    setQuestions((prev) => prev.map((old, i) => (i === idx ? q : old)));
  };
  const deleteQuestion = (idx: number) => {
    if (questions.length <= 1) {
      showToast('An exam must have at least one question.');
      return;
    }
    setQuestions((prev) =>
      prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, question_order: i }))
    );
  };

  return (
    <div className="space-y-6">
      {/* ── TOP HEADER ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#0F172A]">Digital Exams</h1>
            <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
              <Zap size={11} className="text-[#0EA5E9] fill-[#0EA5E9]" /> Online Examinations
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Create and manage online exams for applicants with automatic scoring. Linked exams automatically record scores to screening evaluations.
          </p>
        </div>

        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus size={16} /> Add Digital Exam
        </button>
      </div>

      {/* ── STATS OVERVIEW RIBBON ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {[
          { label: 'Total Online Exams', value: templates.length, color: 'text-sky-600' },
          { label: 'Ready for Applicants', value: templates.filter((t) => t.is_active).length, color: 'text-emerald-600' },
          { label: 'Timed Exams', value: templates.filter((t) => Boolean(t.time_limit_mins)).length, color: 'text-amber-600' },
          { label: 'Linked to Evaluations', value: templates.filter((t) => Boolean(t.evaluation_template_id)).length, color: 'text-purple-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="text-xs text-slate-500 font-medium">{s.label}</div>
            <div className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── SEARCH & FILTER BAR (Clean search + dropdown, no button clutter) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search exams by title or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] focus:bg-white transition-all"
          />
        </div>

        <div className="min-w-[190px]">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── EXAMS TABLE ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-semibold">Exam Title</th>
                <th className="px-4 py-3 text-left font-semibold">Category</th>
                <th className="px-4 py-3 text-center font-semibold">Passing Mark</th>
                <th className="px-4 py-3 text-center font-semibold">Time Limit</th>
                <th className="px-4 py-3 text-left font-semibold">Linked Evaluation</th>
                <th className="px-4 py-3 text-center font-semibold">Available to Applicants</th>
                <th className="px-4 py-3 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <Loader2 className="animate-spin inline-block mr-2" size={16} />
                    Loading digital exams...
                  </td>
                </tr>
              ) : filteredTemplates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 bg-sky-50 border border-sky-100 rounded-full flex items-center justify-center mx-auto text-[#0EA5E9]">
                        <BookOpen size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-[#0F172A]">No digital exams yet</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Create online multiple-choice exams for your applicants to answer in their portal.
                        </p>
                      </div>
                      <button
                        onClick={openCreate}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                      >
                        <Plus size={14} /> Create Your First Exam
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTemplates.map((t) => {
                  const matchedEval = t.evaluation_template_id
                    ? evaluationTemplates.find((e) => e.test_template_id === t.evaluation_template_id)
                    : null;

                  return (
                    <tr
                      key={t.template_id}
                      className={`border-b border-slate-100 last:border-0 ${
                        t.is_active ? 'hover:bg-slate-50/70' : 'opacity-60 bg-slate-50/40'
                      }`}
                    >
                      {/* Title & Desc */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-[#0F172A]">{t.title}</div>
                        {t.description && (
                          <div className="text-xs text-slate-500 mt-0.5 max-w-xs truncate">
                            {t.description}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                          {t.allow_review && (
                            <span className="text-emerald-700 font-medium">✓ Answers shown after submit</span>
                          )}
                          {t.randomize && (
                            <span>• Shuffled order</span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {t.category || 'General'}
                        </span>
                      </td>

                      {/* Passing Mark */}
                      <td className="px-4 py-3.5 text-center">
                        <span className="font-semibold px-2 py-0.5 rounded text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {t.passing_score ?? 60}%
                        </span>
                      </td>

                      {/* Time Limit */}
                      <td className="px-4 py-3.5 text-center text-xs text-slate-700">
                        {t.time_limit_mins ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                            <Clock size={11} className="text-slate-400" />
                            {t.time_limit_mins} mins
                          </span>
                        ) : (
                          <span className="text-slate-400">No time limit</span>
                        )}
                      </td>

                      {/* Attached Evaluation */}
                      <td className="px-4 py-3.5">
                        {matchedEval ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200">
                            <LinkIcon size={11} /> {matchedEval.name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">— Not linked</span>
                        )}
                      </td>

                      {/* Status Toggle */}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => toggleActive(t.template_id, t.is_active)}
                          title={t.is_active ? 'Click to make unavailable' : 'Click to make available to applicants'}
                        >
                          {t.is_active ? (
                            <ToggleRight size={24} className="text-[#10B981] mx-auto transition-transform hover:scale-105" />
                          ) : (
                            <ToggleLeft size={24} className="text-slate-300 mx-auto transition-transform hover:scale-105" />
                          )}
                        </button>
                      </td>

                      {/* Streamlined Actions (Clean & Uncluttered) */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setAssignTemplateId(t.template_id);
                              setIsAssignOpen(true);
                            }}
                            title="Assign to job order applicants"
                            className="p-1.5 hover:bg-sky-50 hover:text-[#0EA5E9] text-slate-500 rounded-lg transition-colors"
                          >
                            <Send size={14} />
                          </button>
                          <button
                            onClick={() => openEdit(t)}
                            title="Edit exam & questions"
                            className="p-1.5 hover:bg-slate-100 hover:text-[#0EA5E9] text-slate-500 rounded-lg transition-colors"
                          >
                            <Edit3 size={14} />
                          </button>

                          {deleteConfirm === t.template_id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => deleteTemplate(t.template_id)}
                                className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="text-[10px] text-slate-400"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(t.template_id)}
                              title="Delete exam"
                              className="p-1.5 hover:bg-red-50 hover:text-red-500 text-slate-400 rounded-lg transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: CREATE / EDIT DIGITAL EXAM (Fits Screen, Clean & Dynamic)        */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">
                  {selectedTemplate ? `Edit Exam: ${form.title || 'Untitled'}` : 'Create New Digital Exam'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set exam details, link to screening requirements, and author questions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Segment Tabs */}
            <div className="px-6 pt-3 pb-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFormTab('info')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  formTab === 'info'
                    ? 'bg-white text-[#0EA5E9] shadow-2xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1. Exam Information & Settings
              </button>
              <button
                type="button"
                onClick={() => setFormTab('questions')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  formTab === 'questions'
                    ? 'bg-white text-[#0EA5E9] shadow-2xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>2. Questions & Answers</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-sky-100 text-[#0EA5E9]">
                  {questions.length}
                </span>
              </button>
            </div>

            {/* Error banner if validation fails */}
            {formError && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {formTab === 'info' ? (
                <div className="space-y-4">
                  {/* Exam Title */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Exam Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Cognitive & Aptitude Test (IQ)"
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
                    />
                  </div>

                  {/* Category & Linked Evaluation */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        Category
                      </label>
                      <select
                        value={form.category}
                        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        Link to Screening Evaluation <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <select
                        value={form.evaluation_template_id}
                        onChange={(e) => setForm((f) => ({ ...f, evaluation_template_id: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
                      >
                        <option value="">— Not linked to an evaluation —</option>
                        {evaluationTemplates.map((ev) => (
                          <option key={ev.test_template_id} value={ev.test_template_id}>
                            {ev.name} ({ev.weight_percentage}% weight • Pass mark: {ev.passing_score}%)
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-slate-400 mt-1">
                        When applicants pass this exam, their score automatically fills their screening evaluation scorecard.
                      </p>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Exam Instructions for Applicants <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Please read each item carefully and select the best answer. You will see your result upon submission."
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 resize-none focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
                    />
                  </div>

                  {/* Passing Score & Time Limit */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        Passing Score (%)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={form.passing_score}
                          onChange={(e) => setForm((f) => ({ ...f, passing_score: e.target.value }))}
                          className="w-20 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-center text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
                        />
                        <span className="text-xs text-slate-500">
                          Minimum percentage required to pass this exam.
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          Time Limit
                        </label>
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, time_limit_enabled: !f.time_limit_enabled }))}
                          className="flex items-center gap-1 text-xs font-semibold text-slate-600"
                        >
                          {form.time_limit_enabled ? (
                            <ToggleRight size={20} className="text-[#10B981]" />
                          ) : (
                            <ToggleLeft size={20} className="text-slate-300" />
                          )}
                          <span>{form.time_limit_enabled ? 'Timed' : 'No time limit'}</span>
                        </button>
                      </div>

                      {form.time_limit_enabled ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            value={form.time_limit_mins}
                            onChange={(e) => setForm((f) => ({ ...f, time_limit_mins: e.target.value }))}
                            className="w-20 border border-slate-200 rounded-lg px-3 py-1 text-xs font-bold text-center text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
                          />
                          <span className="text-xs text-slate-600">Minutes total</span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400">
                          Applicants can take the exam at their own pace without a timer.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Options */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.randomize}
                        onChange={(e) => setForm((f) => ({ ...f, randomize: e.target.checked }))}
                        className="rounded border-slate-300 text-[#0EA5E9] focus:ring-[#0EA5E9]"
                      />
                      <span>Randomize question order for each applicant</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.allow_review}
                        onChange={(e) => setForm((f) => ({ ...f, allow_review: e.target.checked }))}
                        className="rounded border-slate-300 text-[#0EA5E9] focus:ring-[#0EA5E9]"
                      />
                      <span>Allow applicants to review correct answers after submitting</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Exam Questions ({questions.length})
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Create multiple choice questions and select the correct answer for each.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={addQuestion}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                    >
                      <Plus size={14} /> Add Question
                    </button>
                  </div>

                  <div className="space-y-3">
                    {questions.map((q, idx) => (
                      <QuestionCard
                        key={idx}
                        q={q}
                        idx={idx}
                        totalQuestions={questions.length}
                        onUpdate={(updated) => updateQuestion(idx, updated)}
                        onDelete={() => deleteQuestion(idx)}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addQuestion}
                    className="w-full py-2.5 border border-slate-200 hover:border-[#0EA5E9] bg-slate-50/60 hover:bg-sky-50/40 text-slate-600 hover:text-[#0EA5E9] rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus size={14} /> Add Another Question
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const previewObj: ExamTemplate = {
                      template_id: selectedTemplate?.template_id || 0,
                      title: form.title || 'Untitled Exam',
                      description: form.description,
                      exam_type: 'digital',
                      category: form.category,
                      passing_score: form.passing_score ? Number(form.passing_score) : 60,
                      time_limit_mins: form.time_limit_enabled ? Number(form.time_limit_mins) : undefined,
                      randomize: form.randomize,
                      allow_review: form.allow_review,
                      is_active: form.is_active,
                      created_at: new Date().toISOString(),
                      questions: questions,
                    };
                    setPreviewTemplate(previewObj);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 shadow-2xs transition-colors"
                >
                  <Eye size={13} className="text-slate-500" /> Preview Exam
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveTemplate}
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 rounded-lg shadow-sm flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Save Digital Exam
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: ASSIGN EXAM TO JOB ORDER (Clean Modal)                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {isAssignOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">Assign Exam to Job Order</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Applicants applied under this job position will see this exam in their portal.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Online Exam *
                </label>
                <select
                  value={assignTemplateId ?? ''}
                  onChange={(e) => setAssignTemplateId(Number(e.target.value) || null)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
                >
                  <option value="">— Choose an online exam —</option>
                  {templates.map((t) => (
                    <option key={t.template_id} value={t.template_id}>
                      {t.title} ({t.category || 'General'} • Passing Score: {t.passing_score ?? 60}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Target Job Order *
                </label>
                <select
                  value={assignJobOrderId ?? ''}
                  onChange={(e) => setAssignJobOrderId(Number(e.target.value) || null)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
                >
                  <option value="">— Choose a job order —</option>
                  {globalJobOrders.map((j) => (
                    <option key={j.job_order_id} value={j.job_order_id}>
                      [{j.job_code}] {j.position} {j.employer_name ? `— ${j.employer_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deadline for Applicants <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={assignDueDate}
                  onChange={(e) => setAssignDueDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsAssignOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={assignExam}
                disabled={assigning || !assignTemplateId || !assignJobOrderId}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0EA5E9] hover:bg-[#0284C7] disabled:opacity-50 rounded-lg shadow-sm flex items-center gap-1.5"
              >
                {assigning ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Assigning...
                  </>
                ) : (
                  <>
                    <Send size={13} /> Confirm Assignment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LIVE SIMULATOR MODAL ── */}
      {previewTemplate && (
        <PreviewModal template={previewTemplate} onClose={() => setPreviewTemplate(null)} />
      )}
    </div>
  );
}
