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

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus, BookOpen, Trash2, Edit3, ChevronRight,
  CheckCircle2, XCircle, Clock, Send, Eye,
  Loader2, X, Check, Minus, Search,
  Link as LinkIcon, FileText, ClipboardCheck, Monitor, ToggleLeft, ToggleRight,
  HelpCircle, AlertCircle, Info, RefreshCw, ChevronDown, ChevronUp,
  Globe, Building2, CheckSquare, Square, Users, Calendar
} from 'lucide-react';
import { api } from '../../../lib/api';
import { ExamSimulatorModal } from './ExamPortal';
import { EXAM_CATEGORIES, evalTypeToExamCategory, examCategoryToEvalType } from '../../utils/examCategoryMapping';

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
  id?: number | string;
  name: string;
  test_type: string;
  weight_percentage: number;
  passing_score: number;
  exam_mode?: string;
  digitalExamTemplateId?: number | null;
  digital_exam_template_id?: number | null;
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

const CATEGORIES = [...EXAM_CATEGORIES];

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
  const [showGuide, setShowGuide] = useState(false);

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
  const [assignScope, setAssignScope] = useState<'all' | 'specific'>('all');
  const [assignJobOrderIds, setAssignJobOrderIds] = useState<number[]>([]);
  const [jobOrderSearch, setJobOrderSearch] = useState('');
  const [assignDueDate, setAssignDueDate] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [isChangingExamInModal, setIsChangingExamInModal] = useState(false);

  // Delete Confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Purpose State & Click-outside Ref
  const [purposeMode, setPurposeMode] = useState<'standalone' | 'screening'>('standalone');
  const [isPurposeDropdownOpen, setIsPurposeDropdownOpen] = useState(false);
  const purposeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (purposeDropdownRef.current && !purposeDropdownRef.current.contains(event.target as Node)) {
        setIsPurposeDropdownOpen(false);
      }
    };
    if (isPurposeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPurposeDropdownOpen]);

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
    setPurposeMode('standalone');
    setFormTab('info');
    setIsPurposeDropdownOpen(false);
  };

  const openCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  // ── Open Edit ────────────────────────────────────────────────────────────
  const openEdit = async (tmpl: ExamTemplate) => {
    setIsPurposeDropdownOpen(false);
    try {
      const res = await api.get(`/exam-module/templates/${tmpl.template_id}`);
      const t: ExamTemplate = res.data;
      setSelectedTemplate(t);
      const linkedEval = (evaluationTemplates || []).find((ev: any) =>
        Number(ev.digitalExamTemplateId || ev.digital_exam_template_id) === tmpl.template_id ||
        (tmpl.evaluation_template_id && (Number(ev.test_template_id || ev.id) === Number(tmpl.evaluation_template_id)))
      );
      const resolvedEvalId = t.evaluation_template_id
        ? String(t.evaluation_template_id)
        : (linkedEval ? String(linkedEval.test_template_id || linkedEval.id) : '');

      setPurposeMode(resolvedEvalId ? 'screening' : 'standalone');
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
        evaluation_template_id: resolvedEvalId,
      });
      const loadedQuestions: ExamQuestion[] = (t.questions || []).map((q: any, qIdx: number) => {
        const rawChoices = (q.choices && Array.isArray(q.choices) && q.choices.length > 0)
          ? q.choices
          : (q.exam_choice && Array.isArray(q.exam_choice) && q.exam_choice.length > 0)
            ? q.exam_choice
            : [];

        const normalizedChoices: ExamChoice[] = rawChoices.length > 0
          ? rawChoices.map((c: any, cIdx: number) => ({
              choice_id: c.choice_id,
              choice_text: c.choice_text ?? '',
              is_correct: Boolean(c.is_correct),
              choice_order: c.choice_order ?? cIdx,
            }))
          : [
              { choice_text: '', is_correct: true, choice_order: 0 },
              { choice_text: '', is_correct: false, choice_order: 1 },
              { choice_text: '', is_correct: false, choice_order: 2 },
              { choice_text: '', is_correct: false, choice_order: 3 },
            ];

        if (!normalizedChoices.some(c => c.is_correct) && normalizedChoices.length > 0) {
          normalizedChoices[0].is_correct = true;
        }

        return {
          question_id: q.question_id,
          template_id: q.template_id,
          question_text: q.question_text ?? '',
          question_order: q.question_order ?? qIdx,
          points: q.points ?? 1,
          choices: normalizedChoices,
        };
      });

      setQuestions(loadedQuestions.length > 0 ? loadedQuestions : [newQuestion(0)]);
      setFormError('');
      setFormTab('info');
      setIsFormOpen(true);
    } catch (err) {
      console.error('Failed to open exam for editing:', err);
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

    if (purposeMode === 'screening' && !form.evaluation_template_id) {
      setFormError('Please select which official screening evaluation template to link with, or switch to Standalone Exam.');
      setFormTab('info');
      setIsPurposeDropdownOpen(true);
      return;
    }

    setSaving(true);
    try {
      const evalTemplateId = (purposeMode === 'screening' && form.evaluation_template_id)
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
      const cleanQuestions = questions.map((q, qIdx) => ({
        question_text: q.question_text.trim(),
        question_order: q.question_order ?? qIdx,
        points: q.points ?? 1,
        choices: q.choices.map((c, cIdx) => ({
          choice_text: c.choice_text.trim(),
          is_correct: Boolean(c.is_correct),
          choice_order: c.choice_order ?? cIdx,
        })),
      }));
      await api.put(`/exam-module/templates/${templateId}/questions`, cleanQuestions);

      // Link with evaluation if selected
      if (evalTemplateId) {
        const totalPts = cleanQuestions.reduce((sum, q) => sum + (q.points || 1), 0);
        try {
          await api.put(`/evaluations/templates/${evalTemplateId}`, {
            exam_mode: 'digital',
            digital_exam_template_id: templateId,
            max_score: totalPts,
            passing_score: form.passing_score ? Number(form.passing_score) : 60,
            test_type: examCategoryToEvalType(form.category),
          });
        } catch {
          // Non-blocking
        }
      } else if (purposeMode === 'standalone') {
        const linked = evaluationTemplates.find(e => Number(e.digital_exam_template_id || e.digitalExamTemplateId) === templateId);
        if (linked) {
          try {
            await api.put(`/evaluations/templates/${linked.test_template_id || linked.id}`, {
              exam_mode: 'paper',
              digital_exam_template_id: null,
            });
          } catch {
            // Non-blocking
          }
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

  // ── Assign Job Orders Helpers ────────────────────────────────────────────
  const filteredJobOrders = useMemo(() => {
    if (!jobOrderSearch.trim()) return globalJobOrders;
    const q = jobOrderSearch.toLowerCase().trim();
    return globalJobOrders.filter((j) => {
      const code = (j.job_code || '').toLowerCase();
      const pos = (j.position || '').toLowerCase();
      const emp = (j.employer_name || '').toLowerCase();
      return code.includes(q) || pos.includes(q) || emp.includes(q);
    });
  }, [globalJobOrders, jobOrderSearch]);

  const toggleJobOrder = (id: number) => {
    setAssignJobOrderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllFilteredJobOrders = () => {
    const ids = filteredJobOrders.map((j) => j.job_order_id);
    setAssignJobOrderIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const clearAllJobOrders = () => {
    setAssignJobOrderIds([]);
  };

  const setDeadlineDaysAhead = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(23, 59, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    setAssignDueDate(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
  };

  // ── Assign Exam to Candidates ────────────────────────────────────────────
  const assignExam = async () => {
    if (!assignTemplateId) {
      showToast('Please select an online exam to dispatch.');
      return;
    }
    if (assignScope === 'specific' && assignJobOrderIds.length === 0) {
      showToast('Please select at least one target job order.');
      return;
    }

    setAssigning(true);
    try {
      const payload: any = {
        template_id: assignTemplateId,
        due_date: assignDueDate ? new Date(assignDueDate).toISOString() : null,
      };

      if (assignScope === 'all') {
        payload.assign_all = true;
      } else {
        payload.job_order_ids = assignJobOrderIds;
        payload.job_order_id = assignJobOrderIds[0];
      }

      const res = await api.post('/exam-module/assign', payload);
      showToast(res.data.message || 'Exam assigned successfully.');
      setIsAssignOpen(false);
      setAssignTemplateId(null);
      setAssignJobOrderIds([]);
      setAssignDueDate('');
      setJobOrderSearch('');
      setIsChangingExamInModal(false);
    } catch (e: any) {
      const err = e?.response?.data?.detail;
      const msg = typeof err === 'string' ? err : (err?.message || 'Could not assign exam.');
      showToast(msg);
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
              <Monitor size={11} className="text-[#0EA5E9]" /> Online Examinations
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

      {/* ── COMPACT STATS SUMMARY ── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="bg-white border border-slate-200 px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-2xs">
          <span className="text-slate-500">Total Exams:</span>
          <span className="font-bold text-slate-900">{templates.length}</span>
        </div>
        <div className="bg-white border border-slate-200 px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-2xs">
          <span className="text-slate-500">Active:</span>
          <span className="font-bold text-emerald-600">
            {templates.filter((t) => t.is_active).length}
          </span>
        </div>
        <div className="bg-white border border-slate-200 px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-2xs">
          <span className="text-slate-500">Timed:</span>
          <span className="font-bold text-amber-600">
            {templates.filter((t) => Boolean(t.time_limit_mins)).length}
          </span>
        </div>
        <div className="bg-white border border-slate-200 px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-2xs">
          <span className="text-slate-500">Screening Linked:</span>
          <span className="font-bold text-purple-600">
            {templates.filter((t) => Boolean(t.evaluation_template_id) || evaluationTemplates.some(e => Number(e.digital_exam_template_id || e.digitalExamTemplateId) === t.template_id)).length}
          </span>
        </div>
      </div>

      {/* ── SEARCH & FILTER BAR + QUICK GUIDE TOGGLE ── */}
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

        <div className="flex items-center gap-2.5">
          <div className="min-w-[170px]">
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

          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              showGuide
                ? 'bg-violet-50 border-violet-200 text-violet-700'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <HelpCircle size={13} className={showGuide ? 'text-violet-600' : 'text-slate-400'} />
            <span className="hidden sm:inline">Screening vs Standalone Guide</span>
            <span className="sm:hidden">Guide</span>
            {showGuide ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* ── COLLAPSIBLE EXPLANATION GUIDE ── */}
      {showGuide && (
        <div className="bg-gradient-to-r from-violet-50/80 via-sky-50/50 to-white border border-slate-200 rounded-xl p-4 shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                <BookOpen size={14} className="text-[#0EA5E9]" />
                Staff Guide: When to Link to Screening vs. Direct Dispatch
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Here is how Digital Exams connect with applicant evaluation:
              </p>
            </div>
            <button
              onClick={() => setShowGuide(false)}
              className="text-slate-400 hover:text-slate-600 text-xs p-1 rounded"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Method 1: Screening Test */}
            <div className="bg-white border border-violet-200/80 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">
                    <ClipboardCheck size={11} className="text-violet-700" /> 1. Official Screening Test (Linked)
                  </span>
                </div>
                <div className="font-bold text-xs text-slate-900 mb-1">
                  Linked in Evaluation Setup • Counts in 100% Scorecard
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Linked to an official evaluation criterion (e.g. English Proficiency or Trade Knowledge). Has an official weight percentage (e.g. 20%) in the agency screening scorecard. When the applicant finishes online, their score automatically syncs to their evaluation and calculates their Pass/Fail recommendation.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-violet-700 font-semibold flex items-center gap-1">
                ✓ Best for: Required entrance exams, aptitude tests, official screening criteria
              </div>
            </div>

            {/* Method 2: Standalone Direct Dispatch */}
            <div className="bg-white border border-sky-200/80 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                    <Send size={11} className="text-[#0EA5E9]" /> 2. Standalone Exam (Direct Dispatch)
                  </span>
                </div>
                <div className="font-bold text-xs text-slate-900 mb-1">
                  Dispatched to Candidates • Graded Independently
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Not linked to the baseline evaluation weights. Staff can dispatch this exam to all candidates applied under a specific job order with an optional completion deadline. The candidate’s score is recorded separately on their profile without altering the 100% scorecard weights.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-sky-700 font-semibold flex items-center gap-1">
                ✓ Best for: Employer-specific quizzes, safety briefings, specialized practical tests
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EXAMS TABLE ── */}
      {/* ── STREAMLINED EXAMS TABLE (Consolidated & Clean) ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3 text-left font-semibold">Exam & Criteria</th>
                <th className="px-4 py-3 text-center font-semibold w-56">Purpose</th>
                <th className="px-4 py-3 text-center font-semibold w-24">Status</th>
                <th className="px-5 py-3 text-center font-semibold w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                    <Loader2 className="animate-spin inline-block mr-2" size={16} />
                    Loading digital exams...
                  </td>
                </tr>
              ) : filteredTemplates.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-14 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 bg-sky-50 border border-sky-100 rounded-full flex items-center justify-center mx-auto text-[#0EA5E9]">
                        <BookOpen size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-[#0F172A]">No digital exams found</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Create online multiple-choice exams for your applicants to answer in their portal.
                        </p>
                      </div>
                      <button
                        onClick={openCreate}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                      >
                        <Plus size={14} /> Create Digital Exam
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTemplates.map((t) => {
                  const matchedEval = t.evaluation_template_id
                    ? (evaluationTemplates.find((e) => e.test_template_id === t.evaluation_template_id || Number(e.id) === Number(t.evaluation_template_id))
                        || evaluationTemplates.find((e: any) => Number(e.digital_exam_template_id || e.digitalExamTemplateId) === t.template_id))
                    : evaluationTemplates.find((e: any) =>
                        Number(e.digital_exam_template_id || e.digitalExamTemplateId) === t.template_id
                      );

                  const totalPts = (t as any).total_points !== undefined && (t as any).total_points > 0
                    ? (t as any).total_points
                    : ((t as any).questions_count || t.questions?.length || null);

                  return (
                    <tr
                      key={t.template_id}
                      className={`border-b border-slate-100 last:border-0 transition-colors ${
                        t.is_active ? 'hover:bg-slate-50/70' : 'opacity-60 bg-slate-50/40'
                      }`}
                    >
                      {/* Column 1: Title & Consolidated Criteria Subtitle */}
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-[#0F172A] text-sm">{t.title}</div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
                          <span className="font-medium text-slate-700">{t.category || 'General'}</span>
                          <span className="text-slate-300">•</span>
                          {totalPts !== null && (
                            <>
                              <span className="font-semibold text-slate-700">{totalPts} questions ({totalPts} pts)</span>
                              <span className="text-slate-300">•</span>
                            </>
                          )}
                          <span>{t.passing_score ?? 60}% pass mark</span>
                          <span className="text-slate-300">•</span>
                          <span>{t.time_limit_mins ? `${t.time_limit_mins} mins` : 'No time limit'}</span>
                        </div>
                      </td>

                      {/* Column 2: Purpose */}
                      <td className="px-4 py-3.5 text-center">
                        {matchedEval ? (
                          <span
                            className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200"
                            title={`Scores automatically sync to ${matchedEval.name} (${matchedEval.weight_percentage}% of screening scorecard)`}
                          >
                            Screening: {matchedEval.name} ({matchedEval.weight_percentage}%)
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            Standalone
                          </span>
                        )}
                      </td>

                      {/* Column 3: Active Status Toggle */}
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

                      {/* Column 4: Streamlined Actions */}
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setAssignTemplateId(t.template_id);
                              setAssignScope(t.evaluation_template_id ? 'specific' : 'all');
                              setAssignJobOrderIds([]);
                              setJobOrderSearch('');
                              setAssignDueDate('');
                              setIsChangingExamInModal(false);
                              setIsAssignOpen(true);
                            }}
                            title="Dispatch exam to candidates"
                            className="p-1.5 hover:bg-sky-50 hover:text-[#0EA5E9] text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                          >
                            <Send size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const res = await api.get(`/exam-module/templates/${t.template_id}`);
                                setPreviewTemplate(res.data);
                              } catch {
                                setPreviewTemplate(t);
                              }
                            }}
                            title="Preview applicant assessment experience"
                            className="p-1.5 hover:bg-slate-100 hover:text-[#0EA5E9] text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => openEdit(t)}
                            title="Edit exam & questions"
                            className="p-1.5 hover:bg-slate-100 hover:text-[#0EA5E9] text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
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
                  {/* Exam Title & Category Row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    <div className="md:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          Exam Name *
                        </label>
                        {purposeMode === 'screening' && form.evaluation_template_id && (() => {
                          const selectedEval = evaluationTemplates.find(
                            (ev) => String(ev.test_template_id) === String(form.evaluation_template_id)
                          );
                          if (selectedEval && form.title.trim() !== selectedEval.name.trim()) {
                            return (
                              <button
                                type="button"
                                onClick={() => setForm((f) => ({ ...f, title: selectedEval.name }))}
                                className="text-[11px] font-bold text-violet-700 hover:text-violet-900 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1"
                                title={`Set exam name to "${selectedEval.name}" to match the screening requirement`}
                              >
                                <RefreshCw size={11} className="text-violet-600" />
                                <span>Sync title with: "{selectedEval.name}"</span>
                              </button>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. Cognitive & Aptitude Test (IQ)"
                        value={form.title}
                        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
                      />
                      {purposeMode === 'screening' && form.evaluation_template_id && (() => {
                        const selectedEval = evaluationTemplates.find(
                          (ev) => String(ev.test_template_id) === String(form.evaluation_template_id)
                        );
                        if (!selectedEval) return null;
                        const isSame = form.title.trim().toLowerCase() === selectedEval.name.trim().toLowerCase();
                        return (
                          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-1">
                            <span>
                              Linked Screening Requirement: <strong className="text-violet-800">{selectedEval.name}</strong>
                            </span>
                            {isSame ? (
                              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                <Check size={12} /> Title matches evaluation requirement
                              </span>
                            ) : (
                              <span className="text-slate-400">
                                (Applicant portal will display both the exam title and requirement)
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        Category
                      </label>
                      <div className="relative">
                        <select
                          value={form.category}
                          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                          className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      {purposeMode === 'screening' && form.evaluation_template_id && (
                        <div className="text-[11px] text-violet-700 font-medium mt-1 flex items-center gap-1.5">
                          <RefreshCw size={11} className="shrink-0 text-violet-600" />
                          <span>Saving will align the linked screening requirement category to <strong>{examCategoryToEvalType(form.category)}</strong>.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Exam Purpose & Screening Linkage (Interactive Selection Buttons) */}
                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Exam Purpose & Screening Linkage
                      </label>
                      <span className="text-[11px] text-slate-400 font-medium">Click to select purpose</span>
                    </div>

                    {/* Two Main Mode Selection Button Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Option 1: Standalone Exam */}
                      <button
                        type="button"
                        onClick={() => {
                          setPurposeMode('standalone');
                          setForm((f) => ({ ...f, evaluation_template_id: '' }));
                          setIsPurposeDropdownOpen(false);
                        }}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          purposeMode === 'standalone'
                            ? 'border-[#0EA5E9] bg-sky-50/70 text-[#0F172A] shadow-2xs ring-1 ring-[#0EA5E9]'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50/60 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              purposeMode === 'standalone' ? 'bg-[#0EA5E9] text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                              <BookOpen size={14} />
                            </div>
                            <span className="font-bold text-xs text-slate-900">Standalone Exam</span>
                          </div>
                          {purposeMode === 'standalone' && (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-[#0EA5E9] border border-sky-200">
                              <Check size={10} /> Active
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Independent skills test or quiz. Not tied to the 100% baseline scorecard. Can be dispatched freely to job orders.
                        </p>
                      </button>

                      {/* Option 2: Official Screening Evaluation */}
                      <button
                        type="button"
                        onClick={() => {
                          setPurposeMode('screening');
                          setIsPurposeDropdownOpen(true);
                        }}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          purposeMode === 'screening'
                            ? 'border-violet-500 bg-violet-50/70 text-[#0F172A] shadow-2xs ring-1 ring-violet-500'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50/60 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              purposeMode === 'screening' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                              <ClipboardCheck size={14} className={purposeMode === 'screening' ? 'text-white' : 'text-slate-500'} />
                            </div>
                            <span className="font-bold text-xs text-slate-900">Official Screening Test</span>
                          </div>
                          {purposeMode === 'screening' && (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
                              <Check size={10} /> Active
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Linked to official screening. When applicants take this digital exam, score is automatically recorded in their scorecard.
                        </p>
                      </button>
                    </div>

                    {/* When Standalone is active: Simple helpful confirmation */}
                    {purposeMode === 'standalone' && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2">
                        <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-slate-800">Standalone Assessment:</span> This exam operates independently. You can dispatch it directly to applicants or job orders at any time without altering their 100% baseline screening requirements.
                        </div>
                      </div>
                    )}

                    {/* When Official Screening is active: Custom Dropdown Selector & Confirmation */}
                    {purposeMode === 'screening' && (
                      <div className="p-3.5 bg-violet-50/60 border border-violet-200 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-violet-950">
                            Select which screening evaluation to fulfill:
                          </label>
                          <span className="text-[11px] font-semibold text-violet-600">
                            {evaluationTemplates.length} evaluation templates available
                          </span>
                        </div>

                        {/* Custom Dropdown Trigger Button */}
                        <div className="relative" ref={purposeDropdownRef}>
                          {(() => {
                            const selectedEval = form.evaluation_template_id
                              ? evaluationTemplates.find(
                                  (ev) => String(ev.test_template_id) === String(form.evaluation_template_id)
                                )
                              : null;
                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setIsPurposeDropdownOpen((prev) => !prev)}
                                  className={`w-full bg-white rounded-xl px-3.5 py-2.5 text-left flex items-center justify-between shadow-2xs hover:shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-violet-400 border ${
                                    selectedEval ? 'border-violet-200 hover:border-violet-400' : 'border-amber-300 hover:border-amber-400 bg-amber-50/30'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                    <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                                      selectedEval ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'
                                    }`}>
                                      <ClipboardCheck size={13} className={selectedEval ? 'text-violet-700' : 'text-amber-700'} />
                                    </div>
                                    {selectedEval ? (
                                      <div className="min-w-0 flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-xs text-slate-900 truncate">
                                          {selectedEval.name}
                                        </span>
                                        <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                          {selectedEval.test_type}
                                        </span>
                                        <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                          {selectedEval.weight_percentage}% weight
                                        </span>
                                        <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                          {selectedEval.passing_score}% min pass
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-slate-600 font-semibold">
                                        Click to choose a screening evaluation...
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
                                    <span className="text-[11px] font-semibold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-md">
                                      {selectedEval ? 'Change' : 'Choose Template'}
                                    </span>
                                    <ChevronDown
                                      size={16}
                                      className={`transition-transform duration-200 text-violet-600 ${
                                        isPurposeDropdownOpen ? 'rotate-180' : ''
                                      }`}
                                    />
                                  </div>
                                </button>

                                {/* Custom Dropdown Popover Menu */}
                                {isPurposeDropdownOpen && (
                                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden py-1 max-h-64 overflow-y-auto">
                                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-100">
                                      Select an Evaluation Template
                                    </div>
                                    {evaluationTemplates.map((ev) => {
                                      const isSelected = String(ev.test_template_id) === String(form.evaluation_template_id);
                                      return (
                                        <button
                                          key={ev.test_template_id}
                                          type="button"
                                          onClick={() => {
                                            setForm((f) => ({
                                              ...f,
                                              evaluation_template_id: String(ev.test_template_id),
                                              passing_score: ev.passing_score !== undefined ? String(ev.passing_score) : f.passing_score,
                                              category: evalTypeToExamCategory(ev.test_type),
                                            }));
                                            setIsPurposeDropdownOpen(false);
                                          }}
                                          className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between transition-colors border-b border-slate-100 last:border-b-0 ${
                                            isSelected ? 'bg-violet-50/80 font-semibold' : 'hover:bg-slate-50'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2.5 min-w-0 pr-3">
                                            <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                                              isSelected ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                              <ClipboardCheck size={12} className={isSelected ? 'text-white' : 'text-slate-500'} />
                                            </div>
                                            <div className="min-w-0">
                                              <div className="text-xs font-bold text-slate-900 truncate">
                                                {ev.name}
                                              </div>
                                              <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                                                <span>{ev.test_type}</span>
                                                <span className="text-slate-300">•</span>
                                                <span className="text-amber-700 font-medium">{ev.weight_percentage}% weight</span>
                                                <span className="text-slate-300">•</span>
                                                <span className="text-emerald-700 font-medium">Pass: {ev.passing_score}%</span>
                                              </div>
                                            </div>
                                          </div>
                                          {isSelected && (
                                            <div className="w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center shrink-0">
                                              <Check size={12} strokeWidth={3} />
                                            </div>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>

                        {/* Status Note: Either Auto-Score Sync or Prompt to Choose */}
                        {(() => {
                          const selectedEval = form.evaluation_template_id
                            ? evaluationTemplates.find(
                                (ev) => String(ev.test_template_id) === String(form.evaluation_template_id)
                              )
                            : null;
                          if (selectedEval) {
                            return (
                              <div className="text-[11px] text-violet-800 bg-white/90 border border-violet-100 rounded-lg p-2.5 flex items-start gap-2">
                                <ClipboardCheck size={14} className="text-violet-600 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold">Score Sync:</span> When an applicant finishes this digital exam, their test score is automatically calculated and recorded directly to their <strong>{selectedEval.name}</strong> requirement ({selectedEval.weight_percentage}% of their official screening scorecard).
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div className="text-[11px] text-amber-900 bg-amber-50/80 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2">
                              <AlertCircle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold">Choose Evaluation Template:</span> Please click the button above to pick which screening evaluation this online exam will fulfill.
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
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
                      {purposeMode === 'screening' && form.evaluation_template_id && (
                        <div className="text-[11px] text-violet-700 font-medium mt-1 flex items-center gap-1.5">
                          <RefreshCw size={11} className="shrink-0 text-violet-600" />
                          <span>Linked: saving this passing score will sync with the linked screening evaluation.</span>
                        </div>
                      )}
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
                  <Eye size={13} className="text-slate-500" /> Preview Test
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
      {/* MODAL: DISPATCH EXAM TO CANDIDATES                                      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {isAssignOpen && (() => {
        const selectedTpl = templates.find((t) => t.template_id === assignTemplateId);
        const linkedEval = selectedTpl?.evaluation_template_id
          ? evaluationTemplates.find((e) => e.test_template_id === selectedTpl.evaluation_template_id)
          : null;

        return (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-100 text-[#0EA5E9] flex items-center justify-center shrink-0">
                    <Send size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#0F172A]">Dispatch Online Exam</h2>
                    <p className="text-xs text-slate-500">
                      Assign this online exam to candidates across all job orders or target specific job orders.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAssignOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Modal Content */}
              <div className="p-6 space-y-5 overflow-y-auto">
                {/* 1. Selected Exam Card / Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Selected Online Exam *
                    </label>
                    {selectedTpl && !isChangingExamInModal && (
                      <button
                        type="button"
                        onClick={() => setIsChangingExamInModal(true)}
                        className="text-[11px] font-semibold text-[#0EA5E9] hover:underline"
                      >
                        Change Exam
                      </button>
                    )}
                  </div>

                  {selectedTpl && !isChangingExamInModal ? (
                    <div className="p-3.5 bg-gradient-to-r from-slate-50 to-sky-50/30 border border-slate-200 rounded-xl">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{selectedTpl.title}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                            {selectedTpl.category || 'General'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500">Pass Benchmark:</span>
                          <span className="font-bold text-[#0EA5E9]">{selectedTpl.passing_score ?? 60}%</span>
                        </div>
                      </div>

                      {/* Purpose callout banner */}
                      <div className="mt-2.5 pt-2.5 border-t border-slate-200/70">
                        {linkedEval ? (
                          <div className="flex items-start gap-2 text-xs text-violet-900">
                            <ClipboardCheck size={14} className="text-violet-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Official Screening Linked:</span> Automatically weights{' '}
                              <strong>{linkedEval.weight_percentage}%</strong> into{' '}
                              <em>{linkedEval.name}</em> on applicant scorecards.
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2 text-xs text-slate-700">
                            <Info size={14} className="text-[#0EA5E9] shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Standalone Assessment:</span> Graded out of 100% on candidate profiles independently without altering screening formula weights.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="relative">
                        <select
                          value={assignTemplateId ?? ''}
                          onChange={(e) => {
                            const val = Number(e.target.value) || null;
                            setAssignTemplateId(val);
                            if (val) setIsChangingExamInModal(false);
                          }}
                          className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 pr-8 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
                        >
                          <option value="">— Choose an online exam —</option>
                          {templates.map((t) => {
                            const isLinked = Boolean(t.evaluation_template_id);
                            return (
                              <option key={t.template_id} value={t.template_id}>
                                {isLinked ? '[Screening Test] ' : '[Standalone] '}
                                {t.title} ({t.category || 'General'} • Pass: {t.passing_score ?? 60}%)
                              </option>
                            );
                          })}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      {isChangingExamInModal && selectedTpl && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setIsChangingExamInModal(false)}
                            className="text-[11px] text-slate-400 hover:text-slate-600"
                          >
                            Keep current exam
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Target Scope Toggle Cards */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Who Should Receive This Exam? *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Option A: All Job Orders (Universal / Standalone) */}
                    <button
                      type="button"
                      onClick={() => setAssignScope('all')}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                        assignScope === 'all'
                          ? 'border-[#0EA5E9] bg-sky-50/70 ring-2 ring-[#0EA5E9]/20 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          assignScope === 'all' ? 'bg-[#0EA5E9] text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Globe size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900">All Job Orders</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-100 text-sky-800">
                            Universal
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                          Standalone dispatch to all registered active applicants across all job orders.
                        </p>
                      </div>
                    </button>

                    {/* Option B: Specific Job Order(s) */}
                    <button
                      type="button"
                      onClick={() => setAssignScope('specific')}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                        assignScope === 'specific'
                          ? 'border-[#0EA5E9] bg-sky-50/70 ring-2 ring-[#0EA5E9]/20 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          assignScope === 'specific' ? 'bg-[#0EA5E9] text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Building2 size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900">Specific Job Order(s)</span>
                          {assignJobOrderIds.length > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#0EA5E9] text-white">
                              {assignJobOrderIds.length} chosen
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                          Multi-select one or multiple job orders to receive this examination.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 3. Job Order Multi-Select Container (when specific scope is chosen) */}
                {assignScope === 'specific' && (
                  <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60 space-y-3 animate-in fade-in duration-150">
                    {/* Filter and bulk action controls */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="relative flex-1 min-w-[200px]">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Filter by job code, position, employer..."
                          value={jobOrderSearch}
                          onChange={(e) => setJobOrderSearch(e.target.value)}
                          className="w-full pl-7 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
                        />
                        {jobOrderSearch && (
                          <button
                            type="button"
                            onClick={() => setJobOrderSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={selectAllFilteredJobOrders}
                          className="text-[11px] font-semibold text-[#0EA5E9] hover:underline"
                        >
                          Select All ({filteredJobOrders.length})
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={clearAllJobOrders}
                          disabled={assignJobOrderIds.length === 0}
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-40"
                        >
                          Clear ({assignJobOrderIds.length})
                        </button>
                      </div>
                    </div>

                    {/* Scrollable Job Orders List */}
                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                      {filteredJobOrders.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400">
                          No job orders found matching "{jobOrderSearch}"
                        </div>
                      ) : (
                        filteredJobOrders.map((j) => {
                          const isSelected = assignJobOrderIds.includes(j.job_order_id);
                          return (
                            <div
                              key={j.job_order_id}
                              onClick={() => toggleJobOrder(j.job_order_id)}
                              className={`p-2.5 rounded-lg cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                                isSelected
                                  ? 'bg-sky-50/90 border border-sky-300 shadow-2xs'
                                  : 'bg-white border border-slate-200/80 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="shrink-0 text-[#0EA5E9]">
                                  {isSelected ? (
                                    <CheckSquare size={16} className="text-[#0EA5E9]" />
                                  ) : (
                                    <Square size={16} className="text-slate-300" />
                                  )}
                                </div>
                                <span className="font-mono text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 shrink-0">
                                  {j.job_code}
                                </span>
                                <span className="text-xs font-semibold text-slate-800 truncate">
                                  {j.position}
                                </span>
                              </div>
                              {j.employer_name && (
                                <span className="text-[11px] text-slate-400 truncate max-w-[180px] text-right shrink-0">
                                  {j.employer_name}
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {assignJobOrderIds.length === 0 && (
                      <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1.5">
                        <AlertCircle size={12} /> Please select at least one job order from the list above.
                      </p>
                    )}
                  </div>
                )}

                {/* 4. Completion Deadline (Optional) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Completion Deadline <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-medium mr-1">Quick Presets:</span>
                      <button
                        type="button"
                        onClick={() => setDeadlineDaysAhead(3)}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                      >
                        +3 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeadlineDaysAhead(7)}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                      >
                        +7 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeadlineDaysAhead(14)}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                      >
                        +14 Days
                      </button>
                      {assignDueDate && (
                        <button
                          type="button"
                          onClick={() => setAssignDueDate('')}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded text-red-500 hover:bg-red-50 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="datetime-local"
                      value={assignDueDate}
                      onChange={(e) => setAssignDueDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] bg-white"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Candidates will see an active countdown timer badge in their applicant portal.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
                <div className="text-[11px] text-slate-500">
                  {assignScope === 'all' ? (
                    <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <Users size={13} className="text-[#0EA5E9]" />
                      Dispatching universal exam across all active applicants.
                    </span>
                  ) : (
                    <span className="text-slate-600 font-medium">
                      Targeting: <strong className="text-[#0EA5E9]">{assignJobOrderIds.length}</strong> job order{assignJobOrderIds.length === 1 ? '' : 's'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAssignOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={assignExam}
                    disabled={
                      assigning ||
                      !assignTemplateId ||
                      (assignScope === 'specific' && assignJobOrderIds.length === 0)
                    }
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#0EA5E9] hover:bg-[#0284C7] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
                  >
                    {assigning ? (
                      <>
                        <Loader2 size={13} className="animate-spin" /> Dispatching...
                      </>
                    ) : (
                      <>
                        <Send size={13} />
                        {assignScope === 'all'
                          ? 'Dispatch to All Candidates'
                          : `Dispatch to ${assignJobOrderIds.length} Job Order${assignJobOrderIds.length === 1 ? '' : 's'}`}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── LIVE SIMULATOR MODAL (1:1 Candidate Portal Experience) ── */}
      {previewTemplate && (
        <ExamSimulatorModal template={previewTemplate} onClose={() => setPreviewTemplate(null)} />
      )}
    </div>
  );
}
