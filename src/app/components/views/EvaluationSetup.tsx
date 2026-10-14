import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, Save, X, Info, Search,
  Brain, Heart, Wrench, Languages, Stethoscope, MessageSquare,
  Sliders, CheckCircle2, AlertTriangle, ToggleLeft, ToggleRight, Loader2,
  ShieldCheck, Lock, Check, RefreshCw, UserPlus, Microscope, Sparkles,
  FileText, KanbanSquare, HeartPulse, ScanText, BellRing, Receipt,
  CheckSquare, Briefcase, Factory, ClipboardList, Layers
} from 'lucide-react';
import { EvaluationTest, WorkflowModuleAccess, UserRole } from '../../types';
import { api } from '../../../lib/api';
import { Skeleton, SkeletonBadge, SkeletonIcon } from '../ui/skeleton';

const TEST_TYPE_META: Record<EvaluationTest['type'], { label: string; icon: React.ReactNode; color: string }> = {
  interview: { label: 'Interview', icon: <MessageSquare size={15} />, color: '#0EA5E9' },
  iq: { label: 'IQ / Aptitude', icon: <Brain size={15} />, color: '#8B5CF6' },
  eq: { label: 'EQ / Personality', icon: <Heart size={15} />, color: '#EC4899' },
  skills: { label: 'Skills / Aptitude', icon: <Wrench size={15} />, color: '#F59E0B' },
  language: { label: 'Language Proficiency', icon: <Languages size={15} />, color: '#10B981' },
  medical: { label: 'Medical', icon: <Stethoscope size={15} />, color: '#EF4444' },
  custom: { label: 'Custom', icon: <Sliders size={15} />, color: '#64748B' },
};

const SYSTEM_ROLES: UserRole[] = ['Recruitment', 'Admin', 'Accounting', 'Management'];

const ROLE_COLORS: Record<UserRole, { bg: string; text: string; border: string }> = {
  Recruitment: { bg: 'bg-sky-50 text-sky-700', text: 'text-sky-700', border: 'border-sky-200' },
  Admin: { bg: 'bg-indigo-50 text-indigo-700', text: 'text-indigo-700', border: 'border-indigo-200' },
  Accounting: { bg: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-700', border: 'border-emerald-200' },
  Management: { bg: 'bg-purple-50 text-purple-700', text: 'text-purple-700', border: 'border-purple-200' },
  Applicant: { bg: 'bg-slate-50 text-slate-700', text: 'text-slate-700', border: 'border-slate-200' },
  Employer: { bg: 'bg-amber-50 text-amber-700', text: 'text-amber-700', border: 'border-amber-200' },
  '': { bg: 'bg-slate-50 text-slate-700', text: 'text-slate-700', border: 'border-slate-200' },
};

const MODULE_ICONS: Record<string, React.ReactNode> = {
  registration: <UserPlus size={16} className="text-sky-500" />,
  screening: <Microscope size={16} className="text-purple-500" />,
  fittowork: <HeartPulse size={16} className="text-rose-500" />,
  profiling: <Sparkles size={16} className="text-amber-500" />,
  cv: <FileText size={16} className="text-blue-500" />,
  manager: <CheckSquare size={16} className="text-emerald-500" />,
  endorsement: <KanbanSquare size={16} className="text-indigo-500" />,
  requirements: <ClipboardList size={16} className="text-teal-500" />,
  joborders: <Briefcase size={16} className="text-sky-600" />,
  employers: <Factory size={16} className="text-violet-600" />,
  ocr: <ScanText size={16} className="text-cyan-600" />,
  alerts: <BellRing size={16} className="text-orange-500" />,
  expense: <Receipt size={16} className="text-emerald-600" />,
};

const DEFAULT_WORKFLOW_MODULES: WorkflowModuleAccess[] = [
  {
    moduleKey: 'registration',
    moduleName: 'Registration',
    assignedRoles: ['Recruitment', 'Management'],
    isActive: true,
    description: 'Applicant data intake, biographical credentials, ID verification, and baseline document uploads.'
  },
  {
    moduleKey: 'screening',
    moduleName: 'Screening Panel',
    assignedRoles: ['Recruitment', 'Management'],
    isActive: true,
    description: 'Candidate preliminary screening, trade test scores, aptitude assessments, and evaluation interview scoring.'
  },
  {
    moduleKey: 'profiling',
    moduleName: 'Applicant Profiling',
    assignedRoles: ['Recruitment', 'Admin', 'Management'],
    isActive: true,
    description: 'Candidate profile overview, competency scoring, and job order skill matching.'
  },
  {
    moduleKey: 'fittowork',
    moduleName: 'Fit-to-Work',
    assignedRoles: ['Admin', 'Management'],
    isActive: true,
    description: 'Clinic referral issuance, DOH lab test diagnostics, and pre-employment medical fitness certification.'
  },
  {
    moduleKey: 'cv',
    moduleName: 'CV Encoding',
    assignedRoles: ['Recruitment', 'Management'],
    isActive: true,
    description: 'Standardized agency CV generation, verified work history encoding, and skills cataloging.'
  },
  {
    moduleKey: 'manager',
    moduleName: 'CV & Employer Hub',
    assignedRoles: ['Management'],
    isActive: true,
    description: 'Managerial review, CV vetting, employer submission authorization, and interview logs.'
  },
  {
    moduleKey: 'endorsement',
    moduleName: 'Endorsement Tracker',
    assignedRoles: ['Management'],
    isActive: true,
    description: 'Overseas employer review, client interview scheduling, hiring approvals, and selection tracking.'
  },
  {
    moduleKey: 'joborders',
    moduleName: 'Job Orders',
    assignedRoles: ['Admin', 'Management'],
    isActive: true,
    description: 'Overseas job vacancy management, client demand quotas, and candidate slot reservations.'
  },
  {
    moduleKey: 'employers',
    moduleName: 'Employer Profiles',
    assignedRoles: ['Admin', 'Management'],
    isActive: true,
    description: 'Foreign principal accreditation, overseas worksite validation, and direct employer contracts.'
  },
  {
    moduleKey: 'requirements',
    moduleName: 'Document Requirements',
    assignedRoles: ['Admin', 'Management'],
    isActive: true,
    description: 'POEA/DMW mandatory documents, apostilles, OEC compliance checklists, and contract verification.'
  },
  {
    moduleKey: 'ocr',
    moduleName: 'Document Validation',
    assignedRoles: ['Admin', 'Management'],
    isActive: true,
    description: 'Automated passport OCR, biometric validation, and document anomaly / fraud detection.'
  },
  {
    moduleKey: 'alerts',
    moduleName: '3-2-1 Alerts',
    assignedRoles: ['Admin', 'Management'],
    isActive: true,
    description: 'Critical milestone countdowns, visa expiry tracking, and POEA/DMW deployment deadlines.'
  },
  {
    moduleKey: 'expense',
    moduleName: 'Expense Ledger',
    assignedRoles: ['Accounting', 'Management'],
    isActive: true,
    description: 'Deployment processing fee disbursement, worker cash advances, receipts, and financial ledger accounting.'
  }
];

const BLANK_TEST: Omit<EvaluationTest, 'id'> = {
  name: '',
  type: 'custom',
  description: '',
  maxScore: 100,
  passingScore: 60,
  weight: 10,
  isActive: true,
  scoringGuide: '',
  scoringType: 'numeric',
  applicableJobOrders: [],
};

interface Props {
  showToast: (msg: string) => void;
  currentUserName: string;
  onPermissionsUpdated?: (perms: Record<string, UserRole[]>) => void;
  onTemplatesUpdated?: (templates: EvaluationTest[]) => void;
  globalJobOrders?: any[];
}

export default function EvaluationSetup({ showToast, onPermissionsUpdated, onTemplatesUpdated, globalJobOrders }: Props) {
  const [tab, setTab] = useState<'evaluations' | 'workflow'>('evaluations');

  // Evaluation Templates State
  const [tests, setTests] = useState<EvaluationTest[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [editingTest, setEditingTest] = useState<EvaluationTest | null>(null);
  const [isNewTest, setIsNewTest] = useState(false);
  const [isSavingTest, setIsSavingTest] = useState(false);

  // Confirmation Popups State
  const [testToDelete, setTestToDelete] = useState<EvaluationTest | null>(null);
  const [isDeletingTest, setIsDeletingTest] = useState(false);
  const [moduleToDeactivate, setModuleToDeactivate] = useState<WorkflowModuleAccess | null>(null);

  // Available Job Orders for targeting specific tests
  const [jobOrders, setJobOrders] = useState<any[]>(globalJobOrders || []);
  const [jobOrderSearch, setJobOrderSearch] = useState('');

  useEffect(() => {
    if (globalJobOrders && globalJobOrders.length > 0) {
      setJobOrders(globalJobOrders);
    } else {
      api.get('/job-orders')
        .then(res => {
          if (res.data && Array.isArray(res.data)) {
            setJobOrders(res.data);
          }
        })
        .catch(err => console.warn('Could not load job orders in EvaluationSetup:', err));
    }
  }, [globalJobOrders]);

  const filteredJobOrders = useMemo(() => {
    const q = jobOrderSearch.trim().toLowerCase();
    if (!q) {
      return jobOrders.slice(0, 5);
    }
    return jobOrders
      .filter(jo => {
        const code = String(jo.job_order_code || jo.job_code || jo.code || (jo.job_order_id ? `JO-${jo.job_order_id}` : '')).toLowerCase();
        const pos = String(jo.position_title || jo.position || '').toLowerCase();
        const id = String(jo.job_order_id || jo.id || '');
        return code.includes(q) || pos.includes(q) || id.includes(q);
      })
      .slice(0, 5);
  }, [jobOrders, jobOrderSearch]);

  // Workflow Module Access State
  const [modules, setModules] = useState<WorkflowModuleAccess[]>(DEFAULT_WORKFLOW_MODULES);
  const [loadingModules, setLoadingModules] = useState(false);
  const [isSavingModules, setIsSavingModules] = useState(false);
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');

  // ── 1. Fetch Evaluation Templates from Database ──────────────────────────
  const fetchTemplates = async () => {
    try {
      setLoadingTests(true);
      const res = await api.get('/evaluations/templates');
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        const liveTests: EvaluationTest[] = res.data.map((t: any) => ({
          id: String(t.test_template_id || t.id),
          name: t.name,
          type: (t.test_type || t.type || 'custom') as EvaluationTest['type'],
          description: t.description || '',
          maxScore: Number(t.max_score ?? t.maxScore ?? 100),
          passingScore: Number(t.passing_score ?? t.passingScore ?? 60),
          weight: Number(t.weight_percentage ?? t.weight ?? 10),
          scoringGuide: t.scoring_guide || t.scoringGuide || '',
          isActive: Boolean(t.is_active ?? t.isActive ?? true),
          scoringType: (t.scoring_type || t.scoringType || 'numeric') as 'numeric' | 'pass_fail',
          applicableJobOrders: Array.isArray(t.applicable_job_orders)
            ? t.applicable_job_orders
            : (Array.isArray(t.applicableJobOrders) ? t.applicableJobOrders : []),
        }));
        setTests(liveTests);
        onTemplatesUpdated?.(liveTests);
      }
    } catch (err) {
      console.warn('Could not fetch live evaluation templates from backend:', err);
    } finally {
      setLoadingTests(false);
    }
  };

  // ── 2. Fetch Workflow Module Access from Database ────────────────────────
  const fetchModules = async () => {
    try {
      setLoadingModules(true);
      const res = await api.get('/workflow/modules');
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        const liveModules: WorkflowModuleAccess[] = res.data.map((m: any) => ({
          id: m.id,
          moduleKey: m.module_key || m.moduleKey,
          moduleName: m.module_name || m.moduleName,
          assignedRoles: Array.isArray(m.assigned_roles) ? m.assigned_roles : (m.assignedRoles || []),
          isActive: Boolean(m.is_active ?? m.isActive ?? true),
          description: m.description || ''
        }));
        setModules(liveModules);

        if (onPermissionsUpdated) {
          const permMap: Record<string, UserRole[]> = {};
          liveModules.forEach(m => {
            permMap[m.moduleKey] = m.assignedRoles;
          });
          onPermissionsUpdated(permMap);
        }
      }
    } catch (err) {
      console.warn('Could not fetch workflow module access from backend:', err);
    } finally {
      setLoadingModules(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchModules();
  }, []);

  // ── Evaluation Operations ───────────────────────────────────────────────
  const generalTests = tests.filter(t => t.isActive && (!t.applicableJobOrders || t.applicableJobOrders.length === 0));
  const jobSpecificTests = tests.filter(t => t.isActive && t.applicableJobOrders && t.applicableJobOrders.length > 0);
  const generalWeight = generalTests.reduce((s, t) => s + t.weight, 0);
  const totalWeight = tests.filter(t => t.isActive).reduce((s, t) => s + t.weight, 0);
  const hasJobSpecific = jobSpecificTests.length > 0;
  const weightOk = hasJobSpecific ? generalWeight === 100 : totalWeight === 100;

  const openNewTest = () => {
    setEditingTest({ ...BLANK_TEST, id: `ev-${Date.now()}` });
    setIsNewTest(true);
  };

  const openEditTest = (t: EvaluationTest) => {
    setEditingTest({ ...t });
    setIsNewTest(false);
  };

  const toggleJobOrderSelection = (targetId: string, targetCode: string) => {
    if (!editingTest) return;
    const current = editingTest.applicableJobOrders || [];
    const exists = current.includes(targetId) || current.includes(targetCode);
    const updated = exists
      ? current.filter(id => id !== targetId && id !== targetCode)
      : [...current, targetId];
    setEditingTest({ ...editingTest, applicableJobOrders: updated });
  };

  const removeJobOrderSelection = (targetId: string) => {
    if (!editingTest) return;
    const current = editingTest.applicableJobOrders || [];
    const updated = current.filter(id => id !== targetId);
    setEditingTest({ ...editingTest, applicableJobOrders: updated });
  };

  const saveTest = async () => {
    if (!editingTest || isSavingTest) return;
    if (!editingTest.name.trim()) { showToast('Test name is required'); return; }
    if (editingTest.weight < 0 || editingTest.weight > 100) { showToast('Weight must be 0–100'); return; }

    setIsSavingTest(true);
    try {
      const scoringType = editingTest.scoringType || 'numeric';
      const applicableJobOrders = editingTest.applicableJobOrders || [];

      const payload = {
        name: editingTest.name,
        test_type: editingTest.type,
        description: editingTest.description,
        max_score: scoringType === 'pass_fail' ? 100 : (editingTest.maxScore || 100),
        passing_score: scoringType === 'pass_fail' ? 100 : (editingTest.passingScore || 60),
        weight_percentage: editingTest.weight,
        scoring_guide: editingTest.scoringGuide,
        is_active: editingTest.isActive,
        scoring_type: scoringType,
        applicable_job_orders: applicableJobOrders,
      };

      if (isNewTest) {
        const res = await api.post('/evaluations/templates', payload);
        const created = res.data;
        const newTest: EvaluationTest = {
          ...editingTest,
          id: String(created.test_template_id || created.id),
          scoringType,
          applicableJobOrders,
        };
        setTests(p => {
          const next = [...p, newTest];
          onTemplatesUpdated?.(next);
          return next;
        });
        showToast(`Evaluation "${editingTest.name}" created successfully`);
      } else {
        const numId = parseInt(editingTest.id.replace('ev-', ''), 10);
        if (!isNaN(numId)) {
          await api.put(`/evaluations/templates/${numId}`, payload);
        }
        setTests(p => {
          const next = p.map(t => t.id === editingTest.id ? { ...editingTest, scoringType, applicableJobOrders } : t);
          onTemplatesUpdated?.(next);
          return next;
        });
        showToast(`Evaluation "${editingTest.name}" updated successfully`);
      }
      setEditingTest(null);
    } catch (err: any) {
      console.error('Failed to save evaluation template:', err);
      showToast('Error saving evaluation template: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSavingTest(false);
    }
  };

  const removeTest = async (id: string) => {
    const t = tests.find(t => t.id === id);
    const numId = parseInt(id.replace('ev-', ''), 10);
    if (!isNaN(numId)) {
      try {
        await api.delete(`/evaluations/templates/${numId}`);
        setTests(p => {
          const next = p.filter(t => t.id !== id);
          onTemplatesUpdated?.(next);
          return next;
        });
        showToast(`Evaluation "${t?.name}" deleted successfully`);
      } catch (err: any) {
        console.error('Failed to delete template:', err);
        showToast('Error deleting template: ' + (err.response?.data?.detail || err.message));
      }
    } else {
      setTests(p => {
        const next = p.filter(t => t.id !== id);
        onTemplatesUpdated?.(next);
        return next;
      });
      showToast(`Evaluation removed`);
    }
  };

  const toggleTest = async (id: string) => {
    const current = tests.find(t => t.id === id);
    if (!current) return;
    const nextState = !current.isActive;
    const numId = parseInt(id.replace('ev-', ''), 10);

    if (!isNaN(numId)) {
      try {
        await api.put(`/evaluations/templates/${numId}`, { is_active: nextState });
      } catch (err) {
        console.warn('Backend toggle template failed:', err);
      }
    }
    setTests(p => {
      const next = p.map(t => t.id === id ? { ...t, isActive: nextState } : t);
      onTemplatesUpdated?.(next);
      return next;
    });
  };

  // ── Workflow Role Module Access Operations ──────────────────────────────
  const toggleRoleForModule = (moduleKey: string, role: UserRole) => {
    // Management is always permanently assigned
    if (role === 'Management') return;

    setModules(prev => prev.map(m => {
      if (m.moduleKey !== moduleKey) return m;
      const hasRole = m.assignedRoles.includes(role);
      const newRoles = hasRole
        ? m.assignedRoles.filter(r => r !== role)
        : [...m.assignedRoles, role];
      return { ...m, assignedRoles: newRoles };
    }));
  };

  const toggleModuleActive = (moduleKey: string) => {
    const current = modules.find(m => m.moduleKey === moduleKey);
    if (!current) return;
    if (current.isActive) {
      // Prompt confirmation popup before deactivating
      setModuleToDeactivate(current);
    } else {
      // Activating can happen directly
      setModules(prev => prev.map(m => m.moduleKey === moduleKey ? { ...m, isActive: true } : m));
      showToast(`Module "${current.moduleName}" activated. Click "Save Configuration" to apply changes.`);
    }
  };

  const saveWorkflowModules = async () => {
    setIsSavingModules(true);
    try {
      const payload = modules.map(m => ({
        module_key: m.moduleKey,
        module_name: m.moduleName,
        assigned_roles: m.assignedRoles,
        is_active: m.isActive,
        description: m.description
      }));
      await api.post('/workflow/modules/batch', payload);
      showToast('Workflow module permissions updated successfully');

      if (onPermissionsUpdated) {
        const permMap: Record<string, UserRole[]> = {};
        modules.forEach(m => {
          permMap[m.moduleKey] = m.assignedRoles;
        });
        onPermissionsUpdated(permMap);
      }
    } catch (err: any) {
      console.error('Failed to save workflow modules:', err);
      showToast('Error saving workflow modules: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSavingModules(false);
    }
  };

  const resetModulesToDefault = () => {
    setModules(DEFAULT_WORKFLOW_MODULES);
    showToast('Reset to recommended workflow module assignments. Click "Save Configuration" to persist.');
  };

  const verdictColor = (score: number, passing: number) =>
    score >= passing ? '#10B981' : score >= passing * 0.8 ? '#F59E0B' : '#EF4444';

  const filteredModules = modules.filter(m => {
    const matchRole = roleFilter === 'all' || m.assignedRoles.includes(roleFilter);
    return matchRole;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#0F172A]">Evaluation & Workflow Setup</h1>
            <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
              <Lock size={11} /> Management Exclusive
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Configure screening evaluations with scoring weights, and govern system role module access across agency operations.
          </p>
        </div>
        {tab === 'evaluations' ? (
          <button
            onClick={openNewTest}
            className="flex items-center gap-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus size={16} /> Add Evaluation
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={resetModulesToDefault}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              title="Reset to recommended standard agency mappings"
            >
              <RefreshCw size={13} /> Reset Defaults
            </button>
            <button
              onClick={saveWorkflowModules}
              disabled={isSavingModules}
              className="flex items-center gap-2 bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              {isSavingModules ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Configuration
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('evaluations')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'evaluations' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
        >
          <Sliders size={15} /> Evaluations & Scoring
        </button>
        <button
          onClick={() => setTab('workflow')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'workflow' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
        >
          <Layers size={15} /> Role & Module Access
        </button>
      </div>

      {/* ── TAB 1: EVALUATIONS & SCORING ───────────────────────────────────── */}
      {tab === 'evaluations' && (
        <>
          {/* General Baseline Weight Summary */}
          <div className={`flex flex-wrap items-center justify-between gap-4 px-5 py-4 rounded-xl border ${weightOk ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-3 flex-wrap">
              <div className={`flex items-center gap-2 font-semibold text-sm ${weightOk ? 'text-emerald-700' : 'text-amber-700'}`}>
                {weightOk ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                <span>
                  General Baseline Weight: <span className="text-lg font-bold ml-1">{generalWeight}%</span> / 100%
                </span>
              </div>
            </div>

            <div className="flex-1 h-2.5 bg-white/70 rounded-full overflow-hidden min-w-[160px] max-w-xs flex border border-slate-200">
              {generalTests.map(t => (
                <div key={t.id} className="h-full" style={{ width: `${t.weight}%`, background: TEST_TYPE_META[t.type].color }} title={`${t.name}: ${t.weight}% (General)`} />
              ))}
            </div>

            {!weightOk ? (
              <span className="text-xs font-semibold text-amber-700">
                General baseline evaluations must total exactly 100% (currently {generalWeight}%)
              </span>
            ) : (
              <span className="text-xs font-semibold text-emerald-700">
                ✓ General baseline evaluations total exactly 100%
              </span>
            )}
          </div>

          {/* General Baseline Legend (Only General Active Tests) */}
          <div className="flex flex-wrap gap-2.5">
            {generalTests.map(t => (
              <div key={t.id} className="flex items-center gap-1.5 text-xs text-slate-600 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: TEST_TYPE_META[t.type].color }} />
                <span className="font-medium text-slate-700">{t.name}</span>
                <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">{t.weight}%</span>
              </div>
            ))}
          </div>

          {/* Explanation: How Job-Order-Specific Assessments Are Computed */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600">
            <div className="flex items-center gap-2 font-bold text-[#0F172A] text-sm mb-1.5">
              <Info className="w-4 h-4 text-[#0EA5E9] flex-shrink-0" />
              <span>How Job-Order-Specific Assessments Are Computed</span>
            </div>
            <p className="text-slate-500 text-xs mb-3">
              Because different job orders have distinct trade requirements, job-specific assessments are not combined into a single static global weight. Instead, scoring is dynamically calculated per candidate:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="font-bold text-[#0F172A] text-xs block mb-1">1. Universal General Baseline</span>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  General assessments (e.g. English, EQ, IQ) apply to all applicants across the agency and sum to the 100% baseline weight.
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="font-bold text-[#0F172A] text-xs block mb-1">2. Target Job Order Isolation</span>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Tests linked to specific Job Orders (e.g. welding tests, culinary demos) only appear for candidates applying for that job order. Other candidates are completely unaffected.
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="font-bold text-[#0F172A] text-xs block mb-1">3. Dynamic Per-Candidate Normalization</span>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  When a candidate has job-specific numeric tests, weights normalize to 100% effective rating for that applicant. Pass/Fail clearance tests require a verified Pass without altering percentage weights.
                </p>
              </div>
            </div>
          </div>

          {/* Tests table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left font-semibold">Evaluation Name</th>
                    <th className="px-4 py-3 text-left font-semibold">Category Type</th>
                    <th className="px-4 py-3 text-center font-semibold">Max Score</th>
                    <th className="px-4 py-3 text-center font-semibold">Passing Mark</th>
                    <th className="px-4 py-3 text-center font-semibold">Weight</th>
                    <th className="px-4 py-3 text-center font-semibold">Active Status</th>
                    <th className="px-4 py-3 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingTests ? (
                    <>
                      {[...Array(4)].map((_, i) => (
                        <tr key={i}>
                          <td className="px-4 py-3">
                            <div className="space-y-1.5">
                              <Skeleton className="h-3.5 w-44" />
                              <Skeleton className="h-2.5 w-64 bg-slate-100" />
                            </div>
                          </td>
                          <td className="px-4 py-3"><SkeletonBadge className="w-32" /></td>
                          <td className="px-4 py-3 text-center"><Skeleton className="h-3.5 w-10 mx-auto" /></td>
                          <td className="px-4 py-3 text-center"><Skeleton className="h-3.5 w-10 mx-auto" /></td>
                          <td className="px-4 py-3 text-center"><Skeleton className="h-3.5 w-10 mx-auto" /></td>
                          <td className="px-4 py-3 text-center"><Skeleton className="h-6 w-10 rounded-full mx-auto bg-slate-100" /></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <Skeleton className="h-7 w-7 rounded" />
                              <Skeleton className="h-7 w-7 rounded" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </>
                  ) : tests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                        No evaluation templates configured. Click "Add Evaluation" to create one.
                      </td>
                    </tr>
                  ) : tests.map(test => {
                    const meta = TEST_TYPE_META[test.type];
                    return (
                      <tr key={test.id} className={`border-b border-slate-100 last:border-0 ${test.isActive ? 'hover:bg-slate-50' : 'opacity-50 bg-slate-50/50'}`}>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-[#0F172A]">{test.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5 max-w-sm truncate">{test.description}</div>
                          <div className="flex items-center gap-1.5 mt-1">
                            {test.applicableJobOrders && test.applicableJobOrders.length > 0 ? (
                              <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                                Required for {test.applicableJobOrders.length} Job Order(s)
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                General (All Applicants)
                              </span>
                            )}
                            {test.scoringType === 'pass_fail' && (
                              <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                Pass / Fail Mode
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full w-fit" style={{ background: meta.color + '18', color: meta.color }}>
                            {meta.icon} {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono font-semibold text-[#0F172A]">
                          {test.scoringType === 'pass_fail' ? '—' : test.maxScore}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {test.scoringType === 'pass_fail' ? (
                            <span className="font-semibold px-2 py-0.5 rounded text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ✓ Pass Required
                            </span>
                          ) : (
                            <span className="font-mono font-semibold px-2 py-0.5 rounded text-xs" style={{ background: verdictColor(test.passingScore, test.maxScore * 0.5) + '18', color: verdictColor(test.passingScore, test.maxScore * 0.5) }}>
                              {test.passingScore}%
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-bold text-[#0F172A]">{test.weight}%</span>
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${test.weight}%`, background: meta.color }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <button onClick={() => toggleTest(test.id)} title={test.isActive ? 'Click to deactivate' : 'Click to activate'}>
                            {test.isActive
                              ? <ToggleRight size={24} className="text-[#10B981] mx-auto transition-transform hover:scale-105" />
                              : <ToggleLeft size={24} className="text-slate-300 mx-auto transition-transform hover:scale-105" />}
                          </button>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => openEditTest(test)} title="Edit evaluation" className="p-1.5 hover:bg-blue-50 hover:text-[#0EA5E9] rounded-lg transition-colors text-slate-400">
                              <Pencil size={15} />
                            </button>
                            <button onClick={() => setTestToDelete(test)} title="Delete evaluation" className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors text-slate-400">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Verdict logic explainer */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#0F172A] mb-3 flex items-center gap-2"><Info size={15} className="text-[#0EA5E9]" /> Screening Scoring & Recommendation Framework</h3>
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              {[
                { verdict: 'PASS', color: '#10B981', desc: 'Candidate meets or exceeds passing score across all active assessments and attains overall passing aggregate.' },
                { verdict: 'CONDITIONAL', color: '#F59E0B', desc: 'Overall aggregate score passes, but one individual test is below threshold. Referred for re-testing or remedial training.' },
                { verdict: 'FAIL', color: '#EF4444', desc: 'Aggregate score is below acceptable mark. Applicant is held under Provisional status and cannot advance to medical clearance.' },
              ].map(v => (
                <div key={v.verdict} className="bg-white rounded-lg p-3.5 border border-slate-200">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: v.color + '18', color: v.color }}>{v.verdict}</span>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── TAB 2: ROLE & MODULE ACCESS ─────────────────────────── */}
      {tab === 'workflow' && (
        <div className="space-y-6">
          {/* Information & Exclusion Notice Banner */}
          <div className="bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 border border-blue-200 rounded-xl p-5 text-sm text-slate-700 space-y-3">
            <div className="flex items-start gap-3">
              <ShieldCheck size={20} className="text-[#0EA5E9] flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-[#0F172A] text-base">System Role Module Access Delegation</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Configure which operational modules are accessible to each system role (<strong className="text-sky-700">Recruitment</strong>, <strong className="text-indigo-700">Admin</strong>, <strong className="text-emerald-700">Accounting</strong>, and <strong className="text-purple-700">Management</strong>) across your agency operations.
                </p>
              </div>
            </div>

            {/* Scope & Exclusions Breakdown */}
            <div className="grid md:grid-cols-2 gap-3 pt-2 text-xs">
              <div className="bg-white/80 border border-slate-200 rounded-lg p-3">
                <span className="font-bold text-slate-700 flex items-center gap-1.5 mb-1 text-[11px] uppercase tracking-wider">
                  <CheckCircle2 size={13} className="text-emerald-500" /> Universal Modules (Unrestricted)
                </span>
                <p className="text-slate-500 leading-normal">
                  <strong className="text-slate-700">Dashboard</strong> and <strong className="text-slate-700">Applicant List</strong> are core platforms available to all staff members regardless of assigned role.
                </p>
              </div>
              <div className="bg-white/80 border border-purple-200 rounded-lg p-3">
                <span className="font-bold text-purple-800 flex items-center gap-1.5 mb-1 text-[11px] uppercase tracking-wider">
                  <Lock size={13} className="text-purple-600" /> Management-Exclusive Oversight (Protected)
                </span>
                <p className="text-purple-900/80 leading-normal">
                  <strong className="text-purple-900">Evaluation & Workflow</strong>, <strong className="text-purple-900">Predictive Timeline</strong>, <strong className="text-purple-900">Deployment History</strong>, <strong className="text-purple-900">Operational Reports</strong>, and <strong className="text-purple-900">User Management</strong> are restricted strictly to Management.
                </p>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Configurable Modules ({filteredModules.length})
            </span>

            {/* Filter by Role */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filter Role:</span>
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value as any)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
              >
                <option value="all">All Roles</option>
                {SYSTEM_ROLES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Modules List */}
          {loadingModules ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="p-5 flex flex-wrap md:flex-nowrap items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <SkeletonIcon className="h-10 w-10 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-40" />
                          <SkeletonBadge className="w-20" />
                        </div>
                        <Skeleton className="h-3 w-60 bg-slate-100" />
                      </div>
                    </div>
                    <Skeleton className="h-6 w-12 rounded-full" />
                  </div>
                  <div className="px-5 pb-4 border-t border-slate-100 pt-3">
                    <div className="flex gap-3 flex-wrap">
                      {[...Array(6)].map((_, j) => (
                        <SkeletonBadge key={j} className="w-24" />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredModules.map((mod) => (
                <div
                  key={mod.moduleKey}
                  className={`bg-white rounded-xl border transition-all ${mod.isActive ? 'border-slate-200 shadow-2xs' : 'border-slate-200/60 opacity-60 bg-slate-50/50'
                    }`}
                >
                  <div className="p-5 flex flex-wrap md:flex-nowrap items-center justify-between gap-4">
                    {/* Left: Module Details */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5 border border-slate-200">
                        {MODULE_ICONS[mod.moduleKey] || <Briefcase size={16} className="text-slate-600" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[#0F172A] text-sm">{mod.moduleName}</span>
                          {!mod.isActive && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">
                              Disabled
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          {mod.description}
                        </p>
                      </div>
                    </div>

                    {/* Right: Role Access Checkboxes & Active Toggle */}
                    <div className="flex items-center gap-4 flex-wrap md:flex-nowrap justify-end flex-shrink-0">
                      {/* Role Checkbox Chips */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {SYSTEM_ROLES.map((role) => {
                          const isAssigned = mod.assignedRoles.includes(role);
                          const isManagement = role === 'Management';
                          const color = ROLE_COLORS[role];

                          return (
                            <button
                              key={role}
                              type="button"
                              onClick={() => toggleRoleForModule(mod.moduleKey, role)}
                              disabled={isManagement}
                              title={
                                isManagement
                                  ? 'Management has universal administrative access to all workflow stages'
                                  : `Toggle ${role} access to ${mod.moduleName}`
                              }
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${isAssigned
                                  ? `${color.bg} ${color.border} shadow-2xs`
                                  : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300'
                                } ${isManagement ? 'cursor-default' : 'cursor-pointer hover:scale-102'}`}
                            >
                              {isManagement ? (
                                <Lock size={11} className="text-purple-500" />
                              ) : isAssigned ? (
                                <Check size={12} className={color.text} />
                              ) : (
                                <span className="w-3 h-3 rounded-full border border-slate-300 inline-block" />
                              )}
                              <span>{role}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Active/Inactive Switch */}
                      <div className="pl-2 border-l border-slate-200">
                        <button
                          onClick={() => toggleModuleActive(mod.moduleKey)}
                          title={mod.isActive ? 'Disable this module' : 'Enable this module'}
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                        >
                          {mod.isActive ? (
                            <ToggleRight size={24} className="text-[#10B981]" />
                          ) : (
                            <ToggleLeft size={24} className="text-slate-300" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Persistence Footer */}
          <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Info size={14} className="text-[#0EA5E9]" />
              <span>
                Role assignments take immediate effect across navigation menus for staff once saved.
              </span>
            </div>
            <button
              onClick={saveWorkflowModules}
              disabled={isSavingModules}
              className="flex items-center gap-2 bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              {isSavingModules ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Configuration
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT / ADD TEST ────────────────────────────────────────── */}
      {editingTest && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 sticky top-0 bg-white z-10">
              <h2 className="font-bold text-[#0F172A]">{isNewTest ? 'Add Evaluation Template' : 'Edit Evaluation Template'}</h2>
              <button onClick={() => setEditingTest(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Test Name *</label>
                <input
                  value={editingTest.name}
                  onChange={e => setEditingTest(p => p ? { ...p, name: e.target.value } : p)}
                  placeholder="e.g. Trade Skills Assessment"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Category Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(TEST_TYPE_META) as EvaluationTest['type'][]).map(t => {
                    const m = TEST_TYPE_META[t];
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setEditingTest(p => p ? { ...p, type: t } : p)}
                        className={`flex items-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium border-2 transition-all ${editingTest.type === t ? 'border-[#0EA5E9] bg-[#0EA5E9]/10 text-[#0EA5E9]' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                      >
                        {m.icon} {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Description</label>
                <textarea
                  value={editingTest.description}
                  onChange={e => setEditingTest(p => p ? { ...p, description: e.target.value } : p)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] resize-none"
                />
              </div>
              {/* Scoring Model Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Scoring Model
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTest(p => p ? { ...p, scoringType: 'numeric' } : p)}
                    className={`p-3 rounded-xl border text-left transition-all ${editingTest.scoringType !== 'pass_fail'
                        ? 'border-[#0EA5E9] bg-sky-50/60 text-[#0F172A] shadow-xs ring-1 ring-[#0EA5E9]'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'
                      }`}
                  >
                    <div className="font-semibold text-xs text-slate-900">Numerical Scoring</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Calculated score out of total items with a minimum passing percentage benchmark</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTest(p => p ? { ...p, scoringType: 'pass_fail' } : p)}
                    className={`p-3 rounded-xl border text-left transition-all ${editingTest.scoringType === 'pass_fail'
                        ? 'border-[#0EA5E9] bg-sky-50/60 text-[#0F172A] shadow-xs ring-1 ring-[#0EA5E9]'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'
                      }`}
                  >
                    <div className="font-semibold text-xs text-slate-900">Pass / Fail Clearance</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Direct clearance outcome without numerical item scoring (e.g. medical, trade demo)</div>
                  </button>
                </div>
              </div>

              {/* Scoring Criteria Inputs */}
              {editingTest.scoringType !== 'pass_fail' ? (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Total Score</label>
                    <input
                      type="number"
                      min={1}
                      value={editingTest.maxScore}
                      onChange={e => setEditingTest(p => p ? { ...p, maxScore: parseInt(e.target.value) || 100 } : p)}
                      placeholder="100"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Passing Mark (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={editingTest.passingScore}
                      onChange={e => setEditingTest(p => p ? { ...p, passingScore: parseInt(e.target.value) || 0 } : p)}
                      placeholder="60"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Weight %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={editingTest.weight}
                      onChange={e => setEditingTest(p => p ? { ...p, weight: parseInt(e.target.value) || 0 } : p)}
                      placeholder="10"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 text-center"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <div className="text-xs font-semibold text-slate-700">Clearance Threshold</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Staff awards binary Pass or Fail verdict in Screening Panel.</div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Weight %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={editingTest.weight}
                      onChange={e => setEditingTest(p => p ? { ...p, weight: parseInt(e.target.value) || 0 } : p)}
                      placeholder="10"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 text-center bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Job Order Scope Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Applicant Requirement Scope
                  </label>
                  <span className="text-[11px] font-medium text-slate-500">
                    {(editingTest.applicableJobOrders || []).length === 0
                      ? 'General (All Applicants)'
                      : `Targeted to ${(editingTest.applicableJobOrders || []).length} Job Order(s)`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingTest(p => p ? { ...p, applicableJobOrders: [] } : p)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${(editingTest.applicableJobOrders || []).length === 0
                        ? 'border-[#0EA5E9] bg-sky-50 text-[#0EA5E9] ring-1 ring-[#0EA5E9]'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
                      }`}
                  >
                    All Job Orders (General)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!editingTest.applicableJobOrders) {
                        setEditingTest(p => p ? { ...p, applicableJobOrders: [] } : p);
                      }
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${(editingTest.applicableJobOrders || []).length > 0
                        ? 'border-[#0EA5E9] bg-sky-50 text-[#0EA5E9] ring-1 ring-[#0EA5E9]'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
                      }`}
                  >
                    Specific Job Orders Only
                  </button>
                </div>

                {/* Job Order Search and Multi-Select Area */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={jobOrderSearch}
                      onChange={e => setJobOrderSearch(e.target.value)}
                      placeholder="Search job orders by title or code (e.g. Welder, JO-298-WEL-0)..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]"
                    />
                  </div>

                  {/* Top 5 Matching Results */}
                  <div className="space-y-1">
                    <div className="text-[11px] font-medium text-slate-400 px-0.5">Matching Job Orders (Click to select/unselect):</div>
                    {filteredJobOrders.length === 0 ? (
                      <div className="text-xs text-slate-400 py-2 text-center bg-white rounded-lg border border-dashed border-slate-200">
                        No matching job orders found
                      </div>
                    ) : (
                      filteredJobOrders.map(jo => {
                        const joId = String(jo.job_order_id || jo.id);
                        const joCode = jo.job_order_code || jo.job_code || jo.code || `JO-${joId}`;
                        const joPos = jo.position_title || jo.position || 'Open Role';
                        const isSelected = (editingTest.applicableJobOrders || []).includes(joId) || (editingTest.applicableJobOrders || []).includes(joCode);

                        return (
                          <div
                            key={joId}
                            onClick={() => toggleJobOrderSelection(joId, joCode)}
                            className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${isSelected
                                ? 'bg-sky-50 border-sky-300 text-sky-900 font-semibold shadow-2xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/70'
                              }`}
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold shrink-0">
                                {joCode}
                              </span>
                              <span className="truncate">{joPos}</span>
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 transition-colors ${isSelected ? 'bg-[#0EA5E9] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}>
                              {isSelected ? '✓ Selected' : '+ Add'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Currently Selected Job Orders Chips */}
                  {editingTest.applicableJobOrders && editingTest.applicableJobOrders.length > 0 && (
                    <div className="pt-2 border-t border-slate-200">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        Selected Requirements ({editingTest.applicableJobOrders.length}):
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {editingTest.applicableJobOrders.map(targetId => {
                          const matchedJo = jobOrders.find(j => String(j.job_order_id || j.id) === targetId || String(j.job_order_code || j.job_code) === targetId);
                          const joCode = matchedJo ? (matchedJo.job_order_code || matchedJo.job_code || targetId) : targetId;
                          const joTitle = matchedJo ? (matchedJo.position_title || matchedJo.position || '') : '';
                          const label = joTitle ? `${joCode}: ${joTitle}` : joCode;

                          return (
                            <span
                              key={targetId}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-sky-100 text-sky-800 border border-sky-200 shadow-2xs"
                            >
                              <span className="truncate max-w-[220px]">{label}</span>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); removeJobOrderSelection(targetId); }}
                                className="hover:text-red-600 ml-0.5 transition-colors"
                                title="Remove requirement"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Scoring Guide / Instructions</label>
                <textarea
                  value={editingTest.scoringGuide}
                  onChange={e => setEditingTest(p => p ? { ...p, scoringGuide: e.target.value } : p)}
                  rows={2}
                  placeholder="Describe evaluation scoring rubrics or interviewer guidelines..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 rounded-b-2xl border-t border-slate-200">
              <button
                onClick={() => setEditingTest(null)}
                disabled={isSavingTest}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveTest}
                disabled={isSavingTest}
                className="flex items-center gap-2 px-5 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors shadow-sm shadow-[#0EA5E9]/20"
              >
                {isSavingTest ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> {isNewTest ? 'Adding Evaluation...' : 'Saving Changes...'}
                  </>
                ) : (
                  <>
                    <Save size={15} /> {isNewTest ? 'Add Evaluation' : 'Save Changes'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── MODAL: CONFIRM DELETE EVALUATION ──────────────────────────────── */}
      {testToDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Evaluation Template?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Are you sure you want to delete <strong className="text-slate-800">"{testToDelete.name}"</strong>? This will permanently remove this assessment from the agency evaluation framework.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Weight Contribution:</span>
                  <span className="font-bold text-slate-800">{testToDelete.weight}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Target Scope:</span>
                  <span className="font-semibold text-slate-800">
                    {testToDelete.applicableJobOrders && testToDelete.applicableJobOrders.length > 0
                      ? `${testToDelete.applicableJobOrders.length} Specific Job Order(s)`
                      : 'General Baseline (All Applicants)'}
                  </span>
                </div>
                {testToDelete.isActive && (
                  <p className="text-[11px] text-amber-700 font-medium pt-1 border-t border-slate-200">
                    ⚠️ Deleting an active template may affect baseline weight calculations until remaining weights total 100%.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTestToDelete(null)}
                disabled={isDeletingTest}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!testToDelete) return;
                  setIsDeletingTest(true);
                  try {
                    await removeTest(testToDelete.id);
                  } finally {
                    setIsDeletingTest(false);
                    setTestToDelete(null);
                  }
                }}
                disabled={isDeletingTest}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
              >
                {isDeletingTest ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CONFIRM DEACTIVATE MODULE ──────────────────────────────── */}
      {moduleToDeactivate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Deactivate Module "{moduleToDeactivate.moduleName}"?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Disabling this module will hide it from the sidebar navigation and restrict staff access until re-enabled.
                </p>
              </div>

              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <Info size={13} className="text-amber-600 flex-shrink-0" />
                  <span>Important Note:</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Existing candidate applications and historical stage records will remain safely preserved, but daily processing for this module will be paused until re-enabled.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModuleToDeactivate(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors"
              >
                Keep Active
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!moduleToDeactivate) return;
                  setModules(prev => prev.map(m => m.moduleKey === moduleToDeactivate.moduleKey ? { ...m, isActive: false } : m));
                  showToast(`Module "${moduleToDeactivate.moduleName}" deactivated. Click "Save Configuration" to apply changes.`);
                  setModuleToDeactivate(null);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
              >
                <ToggleLeft size={14} />
                Confirm Deactivation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
