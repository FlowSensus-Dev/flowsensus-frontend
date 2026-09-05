import { useState } from 'react';
import {
  Plus, Pencil, Trash2, Save, X, Info, GripVertical,
  Brain, Heart, Wrench, Languages, Stethoscope, MessageSquare,
  Sliders, CheckCircle2, AlertTriangle, ToggleLeft, ToggleRight
} from 'lucide-react';
import { EvaluationTest, WorkflowPhase, UserRole } from '../../../app/types';

const TEST_TYPE_META: Record<EvaluationTest['type'], { label: string; icon: React.ReactNode; color: string }> = {
  interview:  { label: 'Interview',          icon: <MessageSquare size={15} />, color: '#0EA5E9' },
  iq:         { label: 'IQ / Aptitude',       icon: <Brain size={15} />,          color: '#8B5CF6' },
  eq:         { label: 'EQ / Personality',    icon: <Heart size={15} />,           color: '#EC4899' },
  skills:     { label: 'Skills / Aptitude',   icon: <Wrench size={15} />,          color: '#F59E0B' },
  language:   { label: 'Language Proficiency',icon: <Languages size={15} />,       color: '#10B981' },
  medical:    { label: 'Medical',             icon: <Stethoscope size={15} />,     color: '#EF4444' },
  custom:     { label: 'Custom',              icon: <Sliders size={15} />,          color: '#64748B' },
};

const DEFAULT_TESTS: EvaluationTest[] = [
  { id: 'ev-001', name: 'English Proficiency Test', type: 'language', description: 'Assesses reading comprehension, grammar, vocabulary, and oral communication skills.', maxScore: 100, passingScore: 70, weight: 20, isActive: true, scoringGuide: 'Administer the IELTS-style written exam. Oral scoring via structured 10-minute interview. Score is percentage of correct answers.' },
  { id: 'ev-002', name: 'Trade Skills Assessment', type: 'skills', description: 'Practical skills test relevant to the applicant\'s job order position. Evaluated by a licensed trade assessor.', maxScore: 100, passingScore: 75, weight: 30, isActive: true, scoringGuide: 'TESDA NC II rubric. Evaluator scores each task 0-5. Final score is sum converted to percentage.' },
  { id: 'ev-003', name: 'IQ / General Aptitude', type: 'iq', description: 'Measures cognitive ability, logical reasoning, numerical aptitude, and problem-solving.', maxScore: 100, passingScore: 60, weight: 20, isActive: true, scoringGuide: 'Standardized 50-item test (30 min). Each correct answer = 2 points. Score is total points.' },
  { id: 'ev-004', name: 'Personality & EQ Assessment', type: 'eq', description: 'Evaluates emotional intelligence, stress tolerance, adaptability, and interpersonal skills.', maxScore: 100, passingScore: 0, weight: 15, isActive: true, scoringGuide: 'Uses Big 5 personality framework. Scored by a licensed psychologist. Result: Suitable / Conditionally Suitable / Not Suitable.' },
  { id: 'ev-005', name: 'Initial Screening Interview', type: 'interview', description: 'Structured interview to assess communication, motivation, work ethic, and cultural fit for overseas deployment.', maxScore: 100, passingScore: 65, weight: 15, isActive: true, scoringGuide: 'Rubric: Communication (25pts), Motivation (25pts), Work History (25pts), Overseas Readiness (25pts).' },
];

const DEFAULT_PHASES: WorkflowPhase[] = [
  { id: 'ph-001', phaseNumber: 1, name: 'Registration & Document Collection', description: 'Applicant submits personal information and required employment documents. Recruitment staff verifies completeness.', responsibleRole: 'Recruitment', isActive: true, requiredDocuments: ['req-001','req-002','req-003','req-004'], requiredEvaluations: [], autoAdvance: false },
  { id: 'ph-002', phaseNumber: 2, name: 'Screening & Evaluation', description: 'Applicant undergoes all active evaluation tests. Recruitment staff records scores and computes weighted final verdict.', responsibleRole: 'Recruitment', isActive: true, requiredDocuments: [], requiredEvaluations: ['ev-001','ev-002','ev-003','ev-004','ev-005'], autoAdvance: false },
  { id: 'ph-003', phaseNumber: 3, name: 'Medical Clearance', description: 'Admin validates pre-employment medical examination results from a DOH-accredited clinic.', responsibleRole: 'Admin', isActive: true, requiredDocuments: ['req-007'], requiredEvaluations: [], autoAdvance: false },
  { id: 'ph-004', phaseNumber: 4, name: 'CV Encoding & Management Approval', description: 'Recruitment staff encodes the applicant\'s CV. CV Readiness Engine scores profile. Management approves for employer submission.', responsibleRole: 'Management', isActive: true, requiredDocuments: [], requiredEvaluations: [], autoAdvance: false },
  { id: 'ph-005', phaseNumber: 5, name: 'Employer Endorsement', description: 'CV submitted to foreign employer. Endorsement tracking records employer selection, interview schedule, and approval.', responsibleRole: 'Management', isActive: true, requiredDocuments: [], requiredEvaluations: [], autoAdvance: false },
  { id: 'ph-006', phaseNumber: 6, name: 'Final Deployment Processing', description: 'Admin completes OCR document verification, expense tracking, visa processing, and departure clearance.', responsibleRole: 'Admin', isActive: true, requiredDocuments: [], requiredEvaluations: [], autoAdvance: false },
];

const ROLES: UserRole[] = ['Recruitment', 'Admin', 'Accounting', 'Management'];
const BLANK_TEST: Omit<EvaluationTest, 'id'> = { name: '', type: 'custom', description: '', maxScore: 100, passingScore: 60, weight: 10, isActive: true, scoringGuide: '' };

interface Props {
  showToast: (msg: string) => void;
  currentUserName: string;
}

export default function EvaluationSetup({ showToast, currentUserName }: Props) {
  const [tab, setTab] = useState<'evaluations' | 'workflow'>('evaluations');
  const [tests, setTests] = useState<EvaluationTest[]>(DEFAULT_TESTS);
  const [phases, setPhases] = useState<WorkflowPhase[]>(DEFAULT_PHASES);
  const [editingTest, setEditingTest] = useState<EvaluationTest | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [editingPhase, setEditingPhase] = useState<WorkflowPhase | null>(null);

  const totalWeight = tests.filter(t => t.isActive).reduce((s, t) => s + t.weight, 0);
  const weightOk = totalWeight === 100;

  const openNewTest = () => {
    setEditingTest({ ...BLANK_TEST, id: `ev-${Date.now()}` });
    setIsNew(true);
  };
  const openEditTest = (t: EvaluationTest) => { setEditingTest({ ...t }); setIsNew(false); };

  const saveTest = () => {
    if (!editingTest) return;
    if (!editingTest.name.trim()) { showToast('Test name is required'); return; }
    if (editingTest.weight < 0 || editingTest.weight > 100) { showToast('Weight must be 0–100'); return; }
    if (isNew) setTests(p => [...p, editingTest]);
    else setTests(p => p.map(t => t.id === editingTest.id ? editingTest : t));
    showToast(`"${editingTest.name}" ${isNew ? 'added' : 'updated'}`);
    setEditingTest(null);
  };

  const removeTest = (id: string) => {
    const t = tests.find(t => t.id === id);
    setTests(p => p.filter(t => t.id !== id));
    showToast(`"${t?.name}" removed`);
  };

  const toggleTest = (id: string) => setTests(p => p.map(t => t.id === id ? { ...t, isActive: !t.isActive } : t));
  const togglePhase = (id: string) => setPhases(p => p.map(ph => ph.id === id ? { ...ph, isActive: !ph.isActive } : ph));

  const savePhase = () => {
    if (!editingPhase) return;
    setPhases(p => p.map(ph => ph.id === editingPhase.id ? editingPhase : ph));
    showToast(`Phase "${editingPhase.name}" updated`);
    setEditingPhase(null);
  };

  const verdictColor = (score: number, passing: number) =>
    score >= passing ? '#10B981' : score >= passing * 0.8 ? '#F59E0B' : '#EF4444';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Evaluation & Workflow Setup</h1>
          <p className="text-slate-500 text-sm mt-1">Configure screening evaluations with scoring weights and customize deployment phases.</p>
        </div>
        {tab === 'evaluations' && (
          <button onClick={openNewTest} className="flex items-center gap-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors">
            <Plus size={16} /> Add Evaluation
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(['evaluations', 'workflow'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${tab === t ? 'bg-white text-[#0F172A] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'evaluations' ? 'Evaluations & Scoring' : 'Workflow Phases'}
          </button>
        ))}
      </div>

      {tab === 'evaluations' && (
        <>
          {/* Weight summary */}
          <div className={`flex flex-wrap items-center gap-4 px-5 py-4 rounded-xl border ${weightOk ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className={`flex items-center gap-2 font-semibold text-sm ${weightOk ? 'text-emerald-700' : 'text-amber-700'}`}>
              {weightOk ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              Total active weight: <span className="text-lg font-bold ml-1">{totalWeight}%</span>
            </div>
            <div className="flex-1 h-2 bg-white/60 rounded-full overflow-hidden min-w-[160px]">
              {tests.filter(t => t.isActive).map(t => (
                <div key={t.id} className="h-full inline-block" style={{ width: `${t.weight}%`, background: TEST_TYPE_META[t.type].color }} />
              ))}
            </div>
            {!weightOk && <span className="text-xs text-amber-600">Active weights must total exactly 100%</span>}
          </div>

          {/* Weight bars legend */}
          <div className="flex flex-wrap gap-3">
            {tests.filter(t => t.isActive).map(t => (
              <div key={t.id} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: TEST_TYPE_META[t.type].color }} />
                {t.name} <span className="font-semibold">{t.weight}%</span>
              </div>
            ))}
          </div>

          {/* Tests table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left font-semibold">Evaluation</th>
                    <th className="px-4 py-3 text-left font-semibold">Type</th>
                    <th className="px-4 py-3 text-center font-semibold">Max Score</th>
                    <th className="px-4 py-3 text-center font-semibold">Pass Mark</th>
                    <th className="px-4 py-3 text-center font-semibold">Weight</th>
                    <th className="px-4 py-3 text-center font-semibold">Status</th>
                    <th className="px-4 py-3 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map(test => {
                    const meta = TEST_TYPE_META[test.type];
                    return (
                      <tr key={test.id} className={`border-b border-slate-100 last:border-0 ${test.isActive ? 'hover:bg-slate-50' : 'opacity-50 bg-slate-50/50'}`}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[#0F172A]">{test.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5 max-w-sm truncate">{test.description}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full w-fit" style={{ background: meta.color + '18', color: meta.color }}>
                            {meta.icon} {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-semibold text-[#0F172A]">{test.maxScore}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-mono font-semibold px-2 py-0.5 rounded text-xs" style={{ background: verdictColor(test.passingScore, test.maxScore * 0.5) + '18', color: verdictColor(test.passingScore, test.maxScore * 0.5) }}>
                            {test.passingScore}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-bold text-[#0F172A]">{test.weight}%</span>
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${test.weight}%`, background: meta.color }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => toggleTest(test.id)}>
                            {test.isActive
                              ? <ToggleRight size={22} className="text-[#10B981] mx-auto" />
                              : <ToggleLeft size={22} className="text-slate-300 mx-auto" />}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => openEditTest(test)} className="p-1.5 hover:bg-blue-50 hover:text-[#0EA5E9] rounded-lg transition-colors text-slate-400">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => removeTest(test.id)} className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors text-slate-400">
                              <Trash2 size={14} />
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
            <h3 className="text-sm font-semibold text-[#0F172A] mb-3 flex items-center gap-2"><Info size={15} className="text-[#0EA5E9]" /> Final Verdict Logic</h3>
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              {[
                { verdict: 'PASS', color: '#10B981', desc: 'Weighted final score meets or exceeds the passing mark for all active evaluations.' },
                { verdict: 'CONDITIONAL', color: '#F59E0B', desc: 'Overall score is passing but one or more individual tests are below their pass mark.' },
                { verdict: 'FAIL', color: '#EF4444', desc: 'Weighted final score is below the aggregate passing threshold. Cannot advance to medical.' },
              ].map(v => (
                <div key={v.verdict} className="bg-white rounded-lg p-3 border border-slate-200">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: v.color + '18', color: v.color }}>{v.verdict}</span>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'workflow' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-start gap-3 text-sm text-blue-700">
            <Info size={16} className="flex-shrink-0 mt-0.5" />
            <span>Phases define the sequential lifecycle of each applicant. Click Edit to rename, change responsible role, or update the description. Disable phases to remove them from active workflows.</span>
          </div>
          <div className="space-y-3">
            {phases.sort((a, b) => a.phaseNumber - b.phaseNumber).map((phase, idx) => (
              <div key={phase.id} className={`bg-white rounded-xl border border-slate-200 overflow-hidden transition-opacity ${phase.isActive ? '' : 'opacity-60'}`}>
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0 text-sm" style={{ background: phase.isActive ? '#0EA5E9' : '#94a3b8' }}>
                    {phase.phaseNumber}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#0F172A]">{phase.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{phase.responsibleRole}</span>
                      {!phase.isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500">Disabled</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{phase.description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setEditingPhase({ ...phase })} className="p-2 hover:bg-blue-50 hover:text-[#0EA5E9] rounded-lg transition-colors text-slate-400">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => togglePhase(phase.id)}>
                      {phase.isActive
                        ? <ToggleRight size={22} className="text-[#10B981]" />
                        : <ToggleLeft size={22} className="text-slate-300" />}
                    </button>
                  </div>
                </div>
                {idx < phases.length - 1 && phase.isActive && (
                  <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Test Modal */}
      {editingTest && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 sticky top-0 bg-white z-10">
              <h2 className="font-bold text-[#0F172A]">{isNew ? 'Add Evaluation' : 'Edit Evaluation'}</h2>
              <button onClick={() => setEditingTest(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Name *</label>
                <input value={editingTest.name} onChange={e => setEditingTest(p => p ? { ...p, name: e.target.value } : p)} placeholder="e.g. Trade Skills Assessment" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(TEST_TYPE_META) as EvaluationTest['type'][]).map(t => {
                    const m = TEST_TYPE_META[t];
                    return (
                      <button key={t} onClick={() => setEditingTest(p => p ? { ...p, type: t } : p)} className={`flex items-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium border-2 transition-all ${editingTest.type === t ? 'border-[#0EA5E9] bg-[#0EA5E9]/10 text-[#0EA5E9]' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                        {m.icon} {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Description</label>
                <textarea value={editingTest.description} onChange={e => setEditingTest(p => p ? { ...p, description: e.target.value } : p)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] resize-none" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Max Score</label>
                  <input type="number" min={1} value={editingTest.maxScore} onChange={e => setEditingTest(p => p ? { ...p, maxScore: parseInt(e.target.value) || 100 } : p)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 text-center" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Pass Mark</label>
                  <input type="number" min={0} max={editingTest.maxScore} value={editingTest.passingScore} onChange={e => setEditingTest(p => p ? { ...p, passingScore: parseInt(e.target.value) || 0 } : p)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 text-center" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Weight %</label>
                  <input type="number" min={0} max={100} value={editingTest.weight} onChange={e => setEditingTest(p => p ? { ...p, weight: parseInt(e.target.value) || 0 } : p)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 text-center" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Scoring Guide / Instructions</label>
                <textarea value={editingTest.scoringGuide} onChange={e => setEditingTest(p => p ? { ...p, scoringGuide: e.target.value } : p)} rows={3} placeholder="Describe how evaluators should score this test..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 rounded-b-2xl border-t border-slate-200">
              <button onClick={() => setEditingTest(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
              <button onClick={saveTest} className="flex items-center gap-2 px-5 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-sm font-semibold rounded-lg transition-colors">
                <Save size={15} /> {isNew ? 'Add Evaluation' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Phase Modal */}
      {editingPhase && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
              <h2 className="font-bold text-[#0F172A]">Edit Phase {editingPhase.phaseNumber}</h2>
              <button onClick={() => setEditingPhase(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Phase Name</label>
                <input value={editingPhase.name} onChange={e => setEditingPhase(p => p ? { ...p, name: e.target.value } : p)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Description</label>
                <textarea value={editingPhase.description} onChange={e => setEditingPhase(p => p ? { ...p, description: e.target.value } : p)} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Responsible Role</label>
                <select value={editingPhase.responsibleRole} onChange={e => setEditingPhase(p => p ? { ...p, responsibleRole: e.target.value as UserRole } : p)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 bg-white">
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 rounded-b-2xl border-t border-slate-200">
              <button onClick={() => setEditingPhase(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
              <button onClick={savePhase} className="flex items-center gap-2 px-5 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-sm font-semibold rounded-lg transition-colors">
                <Save size={15} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
