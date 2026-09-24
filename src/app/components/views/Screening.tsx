import { useState, useEffect, useRef } from 'react';
import api from '../../../lib/api';
import { Microscope, FileCheck2, ClipboardCheck, OctagonX, X, ArrowLeft, User, Briefcase, Flag, Clock, ChevronRight, Loader2, IdCard, Mail, Phone } from 'lucide-react';
import { WorkflowState, ActivityLog, ApplicantRecord } from '../../types';

interface ScreeningProps {
  workflow: WorkflowState;
  updateWorkflow: (updates: Partial<WorkflowState>) => void;
  showToast: (message: string) => void;
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  updateApplicant: (applicantId: string, updates: Partial<ApplicantRecord>) => void;
  selectedApplicantId?: string;
  applicants?: ApplicantRecord[];
}

export default function Screening({
  workflow,
  updateWorkflow,
  showToast,
  currentUserName,
  addActivityLog,
  updateApplicant,
  selectedApplicantId: initialApplicantId = '1',
  applicants = [],
}: ScreeningProps) {
  const [selectedApplicantId, setSelectedApplicantId] = useState(initialApplicantId);
  const [listView, setListView] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stopReason, setStopReason] = useState('');

  const handleStopProcessing = () => {
    if (!stopReason.trim()) return;
    updateApplicant(selectedApplicantId, {
      isStopped: true,
      stoppedReason: stopReason,
      stoppedBy: currentUserName,
      stoppedAt: new Date().toISOString(),
      stoppedPhase: 2,
      status: 'Processing Stopped',
      phaseDescription: `Processing halted at Screening by ${currentUserName}: ${stopReason}`,
    });
    addActivityLog({
      applicantId: selectedApplicantId,
      action: 'Processing Stopped — Screening Phase',
      performedBy: currentUserName,
      department: 'Recruitment',
      details: `Applicant failed or was disqualified at Screening (Phase 2). Reason: ${stopReason}`,
    });
    showToast('Processing stopped at Screening. Applicant record locked.');
    setShowStopModal(false);
    setStopReason('');
  };

  const [examScores, setExamScores] = useState<{
    englishProficiency: number | string;
    tradeSkills: number | string;
    iqAptitude: number | string;
    personalityEQ: 'Suitable' | 'Not Suitable' | 'Pending';
    employerSpecific: string;
  }>({
    englishProficiency: 0,
    tradeSkills: 0,
    iqAptitude: 0,
    personalityEQ: 'Pending',
    employerSpecific: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const selectedApplicant = applicants.find(a => a.id === selectedApplicantId) || applicants[0];
  const initializedForApplicantId = useRef<string | null>(null);

  useEffect(() => {
    if (selectedApplicant?.id !== initializedForApplicantId.current) {
      if (selectedApplicant?.testScores) {
        setExamScores({
          englishProficiency: selectedApplicant.testScores.englishProficiency ?? 0,
          tradeSkills: selectedApplicant.testScores.tradeSkills ?? 0,
          iqAptitude: selectedApplicant.testScores.iqAptitude ?? 0,
          personalityEQ: selectedApplicant.testScores.personalityEQ || 'Pending',
          employerSpecific: selectedApplicant.testScores.employerSpecific || '',
        });
      } else {
        setExamScores({
          englishProficiency: 0,
          tradeSkills: 0,
          iqAptitude: 0,
          personalityEQ: 'Pending',
          employerSpecific: '',
        });
      }
      initializedForApplicantId.current = selectedApplicant?.id || null;
    }
  }, [selectedApplicant]);

  const handleScoreChange = (field: 'englishProficiency' | 'tradeSkills' | 'iqAptitude', val: string) => {
    if (val === '') {
      setExamScores({ ...examScores, [field]: '' });
      return;
    }
    const parsed = parseInt(val, 10);
    if (isNaN(parsed)) return;

    if (parsed > 100) {
      showToast('Score cannot exceed 100');
      setExamScores({ ...examScores, [field]: 100 });
      return;
    }
    if (parsed < 0) {
      showToast('Score cannot be negative');
      setExamScores({ ...examScores, [field]: 0 });
      return;
    }
    
    setExamScores({ ...examScores, [field]: parsed });
  };

  const handleSaveProgress = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const applicantId = selectedApplicant?.id;
      if (!applicantId) throw new Error("No applicant selected");

      const cleanScores = {
        englishProficiency: Number(examScores.englishProficiency) || 0,
        tradeSkills: Number(examScores.tradeSkills) || 0,
        iqAptitude: Number(examScores.iqAptitude) || 0,
        personalityEQ: examScores.personalityEQ,
        employerSpecific: examScores.employerSpecific || undefined,
      };

      const numericId = parseInt(applicantId, 10);
      if (!isNaN(numericId)) {
        await api.put(`/applicants/${numericId}`, {
          testScores: cleanScores
        });
      }

      updateApplicant(applicantId, {
        testScores: cleanScores
      });

      showToast('✓ Scores saved successfully.');
    } catch (err) {
      console.error(err);
      showToast('Failed to save scores to the server. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePass = () => {
    setShowModal(true);
  };

  const handleGenerateReferral = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const applicantId = selectedApplicantId;
      if (!applicantId) throw new Error("No applicant selected");

      const cleanScores = {
        englishProficiency: Number(examScores.englishProficiency) || 0,
        tradeSkills: Number(examScores.tradeSkills) || 0,
        iqAptitude: Number(examScores.iqAptitude) || 0,
        personalityEQ: examScores.personalityEQ,
        employerSpecific: examScores.employerSpecific || undefined,
      };

      const updates = {
        phase: 2,
        status: 'Medical Clearance',
        currentHandler: 'Maria Santos',
        currentDepartment: 'Admin',
        phaseDescription: 'Medical referral generated, awaiting examination results from clinic',
        testScores: cleanScores,
      };

      // Ensure the backend persists the change
      const numericId = parseInt(applicantId, 10);
      if (!isNaN(numericId)) {
        await api.put(`/applicants/${numericId}`, {
          current_phase: 2,
          application_status: 'Medical Clearance',
          current_handler: 'Maria Santos',
          current_department: 'Admin',
          phase_description: 'Medical referral generated, awaiting examination results from clinic',
          testScores: updates.testScores
        });
      }

      updateWorkflow({ screeningPassed: true });
      updateApplicant(applicantId, updates);

      addActivityLog({
        applicantId,
        action: 'Screening Passed & Medical Referral Generated',
        performedBy: currentUserName,
        department: 'Recruitment',
        details: `Recruiter ${currentUserName} logged digital signature. Test scores: English ${examScores.englishProficiency}%, Trade Skills ${examScores.tradeSkills}%, IQ/Aptitude ${examScores.iqAptitude}%, Personality: ${examScores.personalityEQ}. Medical referral PDF auto-generated.`,
      });

      setShowModal(false);
      showToast('✓ Screening passed! Medical referral generated and recruiter signature logged.');
    } catch (err) {
      console.error(err);
      showToast('Failed to save scores to the server. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Calculate passing status
  const englishPass = typeof examScores.englishProficiency === 'number' && examScores.englishProficiency >= 60;
  const tradePass = typeof examScores.tradeSkills === 'number' && examScores.tradeSkills >= 70;
  const iqPass = typeof examScores.iqAptitude === 'number' && examScores.iqAptitude >= 50;
  const eqPass = examScores.personalityEQ === 'Suitable';

  const allPassed = englishPass && tradePass && iqPass && eqPass;

  // Applicants pending screening — Phase 1, not stopped, testScores not yet complete
  const pendingScreening = applicants.filter(a =>
    !a.isStopped && a.phase <= 1
  );
  const inProgress = applicants.filter(a =>
    !a.isStopped && a.phase === 2
  );

  const openApplicant = (id: string) => {
    setSelectedApplicantId(id);
    setListView(false);
  };

  if (listView) {
    return (
      <div className="space-y-6 w-full">
        <div>
          <h2 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
            <Microscope className="w-6 h-6 text-[#0EA5E9]" /> Screening Module
          </h2>
          <p className="text-sm text-slate-500 mt-1">Select an applicant to begin or continue their evaluation</p>
        </div>

        {/* Pending screening */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">Pending Screening</h3>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{pendingScreening.length}</span>
          </div>
          {pendingScreening.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 py-10 text-center text-slate-400 text-sm">No applicants pending screening</div>
          ) : (
            <div className="space-y-2">
              {pendingScreening.map(a => {
                const activeFlags = (a.employmentFlags || []).filter(f => !f.dismissed && !f.validated);
                return (
                  <button
                    key={a.id}
                    onClick={() => openApplicant(a.id)}
                    disabled={activeFlags.length > 0}
                    className={`w-full text-left bg-white rounded-xl border px-5 py-4 flex items-center gap-4 transition-all ${
                      activeFlags.length > 0
                        ? 'border-amber-200 opacity-60 cursor-not-allowed'
                        : 'border-slate-200 hover:border-[#0EA5E9]/50 hover:shadow-sm'
                    }`}
                  >
                    {(a.photoDataUrl || a.photo)
                      ? <img src={a.photoDataUrl || a.photo} alt="photo" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      : <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-400 flex-shrink-0">{a.name.split(' ').map(n => n[0]).join('').slice(0,2)}</div>
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[#0F172A]">{a.name}</span>
                        <span className="text-xs text-slate-400 font-mono">{a.applicantCode || a.id}</span>
                        {activeFlags.length > 0 && (
                          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                            <Flag size={10} /> {activeFlags.length} unresolved flag{activeFlags.length > 1 ? 's' : ''} — resolve first
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{a.role} {a.jobOrder ? `· ${a.jobOrder}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-slate-400 flex items-center gap-1"><Clock size={11} /> {a.lastUpdated?.slice(0,10)}</span>
                      {activeFlags.length === 0 && <ChevronRight size={16} className="text-slate-400" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* In progress (Phase 2) */}
        {inProgress.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">In Progress / Review Scores</h3>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{inProgress.length}</span>
            </div>
            <div className="space-y-2">
              {inProgress.map(a => (
                <button
                  key={a.id}
                  onClick={() => openApplicant(a.id)}
                  className="w-full text-left bg-white rounded-xl border border-slate-200 hover:border-[#0EA5E9]/50 hover:shadow-sm px-5 py-4 flex items-center gap-4 transition-all"
                >
                  {(a.photoDataUrl || a.photo)
                    ? <img src={a.photoDataUrl || a.photo} alt="photo" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    : <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-400 flex-shrink-0">{a.name.split(' ').map(n => n[0]).join('').slice(0,2)}</div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-[#0F172A]">{a.name} <span className="font-mono text-slate-400 text-xs">{a.applicantCode || a.id}</span></p>
                    <p className="text-xs text-slate-500 mt-0.5">{a.role}</p>
                  </div>
                  <span className="text-xs text-[#0EA5E9] bg-blue-50 px-2 py-0.5 rounded-full font-medium flex-shrink-0">{a.status}</span>
                  <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Back button */}
      <button onClick={() => setListView(true)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0EA5E9] transition-colors font-medium">
        <ArrowLeft size={16} /> Back to applicant list
      </button>
      {/* ── Profile Header card ──────────────────────────────────────────────── */}
      <div className="bg-[#0F172A] rounded-2xl overflow-hidden shadow-sm border border-slate-800">
        <div className="px-6 py-5 flex items-start gap-5">
          {(selectedApplicant.photoDataUrl || selectedApplicant.photo)
            ? <img src={selectedApplicant.photoDataUrl || selectedApplicant.photo} alt="photo" className="w-20 h-24 object-cover rounded-xl border-2 border-white/20 flex-shrink-0" />
            : (
              <div className="w-20 h-24 rounded-xl bg-white/10 border-2 border-white/20 flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
                {selectedApplicant.name.split(' ').map(n => n[0]).join('').slice(0,2)}
              </div>
            )
          }
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white leading-tight">{selectedApplicant.name}</h2>
            </div>
            <p className="text-[#0EA5E9] text-sm mt-0.5 font-medium">{selectedApplicant.role}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-white/60">
              <span className="flex items-center gap-1"><IdCard size={11} /> {selectedApplicant.applicantCode || selectedApplicant.id}</span>
              {selectedApplicant.email && <span className="flex items-center gap-1"><Mail size={11} /> {selectedApplicant.email}</span>}
              {selectedApplicant.contact && <span className="flex items-center gap-1"><Phone size={11} /> {selectedApplicant.contact}</span>}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-xs px-2.5 py-1 bg-[#0EA5E9]/20 text-[#0EA5E9] rounded-full border border-[#0EA5E9]/30 font-semibold">
                Phase {selectedApplicant.phase}: {selectedApplicant.status}
              </span>
              {selectedApplicant.jobOrder && selectedApplicant.jobOrder !== 'Unassigned' ? (
                <span className="text-xs px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30 font-semibold flex items-center gap-1.5">
                  <Briefcase size={11} /> {selectedApplicant.jobOrder}
                </span>
              ) : (
                <span className="text-xs px-2.5 py-1 bg-slate-700/50 text-slate-300 rounded-full border border-slate-600/40 font-medium flex items-center gap-1.5">
                  <Briefcase size={11} /> Unassigned
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right text-xs text-white/40">
              <p>Handler: {selectedApplicant.currentHandler}</p>
              <p className="mt-0.5">{selectedApplicant.currentDepartment}</p>
              <p className="mt-0.5 italic">{selectedApplicant.lastUpdated}</p>
            </div>
            {!selectedApplicant.isStopped && (
              <button
                onClick={() => setShowStopModal(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-400/50 text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-all cursor-pointer"
              >
                <OctagonX size={13} /> Stop Processing
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Test Scorecard */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
        <div className="flex items-center gap-2 mb-6">
          <ClipboardCheck className="w-6 h-6 text-[#0EA5E9]" />
          <h3 className="font-black text-[#0F172A] text-lg">Standardized Test Scorecard</h3>
        </div>

        <div className="space-y-6">
          {/* 1. English Proficiency Test */}
          <div className="bg-[#0EA5E9]/5 p-5 rounded-lg border-2 border-[#0EA5E9]/20">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold text-[#0F172A] text-sm">1. English Proficiency Test</p>
                <p className="text-xs text-[#64748B] mt-1">
                  Communication ability (grammar, comprehension, conversation) • Passing: 60-70%
                </p>
              </div>
              <span
                className={`px-3 py-1 text-xs font-bold rounded-full ${
                  englishPass ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-red-100 text-red-600'
                }`}
              >
                {englishPass ? '✓ Pass' : '✗ Fail'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={examScores.englishProficiency}
                onChange={(e) => handleScoreChange('englishProficiency', e.target.value)}
                max={100}
                min={0}
                className="w-32 border-2 border-[#0EA5E9]/30 px-4 py-2 rounded-lg text-2xl font-black text-[#0EA5E9] focus:border-[#0EA5E9] outline-none text-center"
              />
              <span className="text-sm text-[#64748B] font-medium">/ 100</span>
              <div className="flex-1 bg-slate-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    englishPass ? 'bg-[#10B981]' : 'bg-red-500'
                  }`}
                  style={{ width: `${examScores.englishProficiency}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* 2. Trade/Skills Test - MOST CRITICAL */}
          <div className="bg-[#F59E0B]/5 p-5 rounded-lg border-2 border-[#F59E0B]/20">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold text-[#0F172A] text-sm flex items-center gap-2">
                  2. Trade / Skills Test
                  <span className="px-2 py-0.5 bg-[#F59E0B] text-white text-xs font-bold rounded">MOST CRITICAL</span>
                </p>
                <p className="text-xs text-[#64748B] mt-1">
                  Practical job capability (hands-on demo, actual performance) • Passing: 70-85%
                </p>
              </div>
              <span
                className={`px-3 py-1 text-xs font-bold rounded-full ${
                  tradePass ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-red-100 text-red-600'
                }`}
              >
                {tradePass ? '✓ Pass' : '✗ Fail'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={examScores.tradeSkills}
                onChange={(e) => handleScoreChange('tradeSkills', e.target.value)}
                max={100}
                min={0}
                className="w-32 border-2 border-[#F59E0B]/30 px-4 py-2 rounded-lg text-2xl font-black text-[#F59E0B] focus:border-[#F59E0B] outline-none text-center"
              />
              <span className="text-sm text-[#64748B] font-medium">/ 100</span>
              <div className="flex-1 bg-slate-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${tradePass ? 'bg-[#10B981]' : 'bg-red-500'}`}
                  style={{ width: `${examScores.tradeSkills}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* 3. IQ / Aptitude Test */}
          <div className="bg-[#8B5CF6]/5 p-5 rounded-lg border-2 border-[#8B5CF6]/20">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold text-[#0F172A] text-sm">3. IQ / Aptitude Test</p>
                <p className="text-xs text-[#64748B] mt-1">
                  Learning ability, problem-solving, logical reasoning • Passing: 50-60%
                </p>
              </div>
              <span
                className={`px-3 py-1 text-xs font-bold rounded-full ${
                  iqPass ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-red-100 text-red-600'
                }`}
              >
                {iqPass ? '✓ Pass' : '✗ Fail'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={examScores.iqAptitude}
                onChange={(e) => handleScoreChange('iqAptitude', e.target.value)}
                max={100}
                min={0}
                className="w-32 border-2 border-[#8B5CF6]/30 px-4 py-2 rounded-lg text-2xl font-black text-[#8B5CF6] focus:border-[#8B5CF6] outline-none text-center"
              />
              <span className="text-sm text-[#64748B] font-medium">/ 100</span>
              <div className="flex-1 bg-slate-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${iqPass ? 'bg-[#10B981]' : 'bg-red-500'}`}
                  style={{ width: `${examScores.iqAptitude}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* 4. Personality / EQ Assessment */}
          <div className="bg-[#14B8A6]/5 p-5 rounded-lg border-2 border-[#14B8A6]/20">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold text-[#0F172A] text-sm">4. Personality / EQ Assessment</p>
                <p className="text-xs text-[#64748B] mt-1">
                  Attitude, behavior, emotional stability, patience, adaptability
                </p>
              </div>
              <span
                className={`px-3 py-1 text-xs font-bold rounded-full ${
                  eqPass ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-red-100 text-red-600'
                }`}
              >
                {eqPass ? '✓ Pass' : '✗ Fail'}
              </span>
            </div>
            <select
              value={examScores.personalityEQ}
              onChange={(e) =>
                setExamScores({
                  ...examScores,
                  personalityEQ: e.target.value as 'Suitable' | 'Not Suitable' | 'Pending',
                })
              }
              className="w-full border-2 border-[#14B8A6]/30 px-4 py-3 rounded-lg text-sm font-bold text-[#14B8A6] focus:border-[#14B8A6] outline-none"
            >
              <option value="Pending">⏱ Pending Assessment</option>
              <option value="Suitable">✓ Suitable</option>
              <option value="Not Suitable">✗ Not Suitable</option>
            </select>
          </div>

          {/* 5. Employer-Specific Tests (Optional) */}
          <div className="bg-blue-50 p-5 rounded-lg border-2 border-blue-200">
            <div className="mb-3">
              <p className="font-bold text-[#0F172A] text-sm">
                5. Employer-Specific Tests{' '}
                <span className="text-xs text-[#64748B] font-medium">(Optional)</span>
              </p>
              <p className="text-xs text-[#64748B] mt-1">
                Special requirements: cooking test, Arabic language, customer service simulation
              </p>
            </div>
            <textarea
              value={examScores.employerSpecific}
              onChange={(e) => setExamScores({ ...examScores, employerSpecific: e.target.value })}
              rows={2}
              placeholder="e.g., Passed cooking test (Filipino & Western cuisine)"
              className="w-full border-2 border-blue-300 px-4 py-2 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
            ></textarea>
          </div>
        </div>

        {/* Overall Status */}
        <div className="mt-6 pt-6 border-t-2 border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-[#64748B] uppercase tracking-wider">Overall Status</p>
              <p
                className={`text-xl font-black mt-1 ${
                  allPassed ? 'text-[#10B981]' : 'text-[#EF4444]'
                }`}
              >
                {allPassed ? '✓ All Tests Passed' : '✗ Some Tests Failed'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveProgress}
                disabled={isSaving}
                className="px-5 py-3 border-2 border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 hover:border-slate-300 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                Save Progress
              </button>
              <button
                onClick={handlePass}
                disabled={!allPassed}
                className="px-8 py-3 bg-[#10B981] text-white text-sm font-bold hover:bg-[#059669] shadow-lg rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileCheck2 className="w-5 h-5" />
                Pass & Generate Medical Referral
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stop Processing Modal */}
      {showStopModal && (
        <div className="fixed inset-0 bg-[#0F172A]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <OctagonX className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#0F172A]">Stop Processing This Applicant</h3>
                <p className="text-xs text-slate-500 mt-0.5">Locks the record at Screening (Phase 2).</p>
              </div>
              <button onClick={() => { setShowStopModal(false); setStopReason(''); }} className="ml-auto text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-700 space-y-1">
                <p className="font-bold text-sm mb-1">Typical reasons at this phase:</p>
                <p>• Failed one or more mandatory evaluation tests</p>
                <p>• Applicant refused or was unable to complete testing</p>
                <p>• Disqualifying information revealed during interview</p>
                <p>• Employer-specific requirement not met</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Reason for Stopping *</label>
                <textarea
                  value={stopReason}
                  onChange={e => setStopReason(e.target.value)}
                  rows={4}
                  placeholder="e.g. Applicant scored 42% on Trade Skills Test (minimum 70%). Failed two mandatory evaluations. Not suitable for this job order."
                  className="w-full border-2 border-slate-200 px-3 py-2 rounded-lg text-sm focus:border-red-400 outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 bg-slate-50 rounded-b-2xl border-t border-slate-200">
              <button onClick={() => { setShowStopModal(false); setStopReason(''); }} className="flex-1 px-4 py-2.5 border-2 border-slate-200 text-slate-500 font-bold text-sm rounded-lg hover:bg-slate-100">Cancel</button>
              <button onClick={handleStopProcessing} disabled={!stopReason.trim()} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-bold text-sm rounded-lg transition-colors">
                <OctagonX className="w-4 h-4" /> Confirm Stop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Medical Referral Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-[#0F172A]/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4 transform transition-all border-none ring-1 ring-black/5">
            <div className="flex items-center justify-between mb-6 border-b-2 border-slate-100 pb-4">
              <h3 className="font-extrabold text-[#0F172A] flex items-center gap-2 text-lg">
                <FileCheck2 className="w-6 h-6 text-[#0EA5E9]" />
                Generate Medical Referral
              </h3>
            </div>
            <div className="space-y-5">
              <div className="bg-[#0EA5E9]/10 border border-[#0EA5E9]/30 rounded-lg p-4">
                <p className="text-sm text-[#0F172A] font-bold">✓ Test Results Recorded</p>
                <div className="text-xs text-[#64748B] mt-2 space-y-1">
                  <p>
                    English: {examScores.englishProficiency}% | Trade Skills: {examScores.tradeSkills}% | IQ:{' '}
                    {examScores.iqAptitude}%
                  </p>
                  <p>Personality: {examScores.personalityEQ}</p>
                  <p className="font-bold text-[#0EA5E9]">Recruiter Signature: {currentUserName}</p>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-[#475569] block mb-1.5 uppercase tracking-wide">
                  Partner Clinic
                </label>
                <select className="w-full border-2 border-slate-200 px-3 py-2.5 rounded-lg text-sm bg-white focus:border-[#0EA5E9] outline-none font-medium">
                  <option>Makati Medical Center</option>
                  <option>St. Luke's Medical Center</option>
                  <option>Cardinal Santos Medical Center</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[#475569] block mb-1.5 uppercase tracking-wide">
                  Applicant
                </label>
                <input
                  type="text"
                  value={selectedApplicant ? `${selectedApplicant.name} (${selectedApplicant.applicantCode || selectedApplicant.id})` : 'No applicant selected'}
                  readOnly
                  className="w-full border-2 border-slate-200 px-3 py-2.5 rounded-lg text-sm bg-slate-50 font-bold text-[#0F172A]"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowModal(false)}
                  disabled={isGenerating}
                  className="flex-1 px-4 py-3 bg-white border-2 border-slate-200 rounded-lg text-sm font-bold text-[#475569] hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateReferral}
                  disabled={isGenerating}
                  className="flex-1 px-4 py-3 bg-[#0EA5E9] hover:bg-[#0284C7] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold shadow-lg shadow-[#0EA5E9]/20 flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating Referral...
                    </>
                  ) : (
                    <>
                      <FileCheck2 className="w-4 h-4" />
                      Generate PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
