import { useState, useEffect } from 'react';
import { WorkflowState, ActivityLog, ApplicantRecord } from '../../types';
import InlineApplicantSelector from '../InlineApplicantSelector';
import { api } from '../../../lib/api';
import { HeartPulse, CheckCircle2, User, Briefcase, IdCard } from 'lucide-react';

interface FitToWorkProps {
  workflow: WorkflowState;
  updateWorkflow: (updates: Partial<WorkflowState>) => void;
  showToast: (message: string) => void;
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  updateApplicant: (applicantId: string, updates: Partial<ApplicantRecord>) => void;
  selectedApplicantId?: string;
  applicants?: ApplicantRecord[];
}

export default function FitToWork({ workflow, updateWorkflow, showToast, currentUserName, addActivityLog, updateApplicant, selectedApplicantId: initialApplicantId = '1', applicants = [] }: FitToWorkProps) {
  // Only applicants who reached Medical Referral / Medical Clearance phase (or provisional from medical) appear here
  const medicalApplicants = applicants.filter(a =>
    !a.isStopped &&
    a.status !== 'Processing Stopped' &&
    (a.status === 'Medical Clearance' ||
     a.status === 'Medical Referral' ||
     (a.status === 'Provisional' && (a.phaseDescription?.toLowerCase().includes('medical') || a.phase === 2)))
  );

  const [selectedApplicantId, setSelectedApplicantId] = useState(initialApplicantId);

  useEffect(() => {
    if (medicalApplicants.length > 0 && (!selectedApplicantId || !medicalApplicants.some(a => String(a.id) === String(selectedApplicantId)))) {
      setSelectedApplicantId(String(medicalApplicants[0].id));
    }
  }, [medicalApplicants, selectedApplicantId]);

  const applicant = medicalApplicants.find(a => String(a.id) === String(selectedApplicantId));
  const isProvisional = applicant?.status === 'Provisional';

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const status = formData.get('medicalStatus');
    const applicantId = selectedApplicantId;
    const numericId = parseInt(applicantId, 10);

    if (status === 'Fit') {
      updateWorkflow({ medicalCleared: true });
      updateApplicant(applicantId, {
        status: 'Applicant Profiling',
        currentHandler: currentUserName,
        currentDepartment: 'Recruitment',
        phaseDescription: 'Medical clearance approved, ready for matching and profiling',
      });
      
      if (!isNaN(numericId)) {
          await api.put(`/applicants/${numericId}`, {
              application_status: 'Applicant Profiling',
              current_handler: currentUserName,
              current_department: 'Recruitment',
              phase_description: 'Medical clearance approved, ready for matching and profiling'
          }).catch(console.error);
      }

      addActivityLog({
        applicantId,
        action: 'Medical Clearance Approved',
        performedBy: currentUserName,
        department: 'Admin',
        details: 'Applicant marked as Fit-to-Work, available for Applicant Profiling',
      });

      showToast('Clearance Saved. Applicant routed to Smart Profiling.');
    } else if (status === 'Unfit') {
      updateApplicant(applicantId, {
        status: 'Provisional',
        phaseDescription: 'Medical outcome Unfit-to-Work. Provisional holding state.',
      });
      
      if (!isNaN(numericId)) {
          await api.put(`/applicants/${numericId}`, {
              application_status: 'Provisional',
              phase_description: 'Medical outcome Unfit-to-Work. Provisional holding state.'
          }).catch(console.error);
      }

      addActivityLog({
        applicantId,
        action: 'Medical Clearance Failed',
        performedBy: currentUserName,
        department: 'Admin',
        details: 'Applicant marked as Unfit-to-Work. Placed in Provisional status.',
      });

      showToast('Applicant placed in Provisional status.');
    }
  };

  const handleReconsider = () => {
    updateApplicant(selectedApplicantId, {
      status: 'Medical Clearance',
      phaseDescription: 'Re-evaluating medical referral outcome',
    });
    addActivityLog({
      applicantId: selectedApplicantId,
      action: 'Provisional Status Reconsidered',
      performedBy: currentUserName,
      department: 'Recruitment',
      details: 'Applicant returned to medical clearance for re-evaluation',
    });
    showToast('Applicant is ready for re-evaluation.');
  };

  const handleStopProcessing = () => {
    updateApplicant(selectedApplicantId, {
      phase: 0,
      status: 'Processing Stopped',
      phaseDescription: 'Processing terminated due to Unfit-to-Work medical outcome.',
    });
    addActivityLog({
      applicantId: selectedApplicantId,
      action: 'Processing Stopped',
      performedBy: currentUserName,
      department: 'Recruitment',
      details: 'Processing formally stopped from Provisional state',
    });
    showToast('Applicant processing has been stopped.');
  };

  return (
    <div className="space-y-6">
      {medicalApplicants.length > 0 && (
        <InlineApplicantSelector
          applicants={medicalApplicants}
          selectedApplicantId={selectedApplicantId}
          onSelectApplicant={setSelectedApplicantId}
        />
      )}

      {medicalApplicants.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-[#64748B] max-w-xl mx-auto shadow-sm">
          <div className="w-14 h-14 rounded-full bg-sky-50 text-[#0EA5E9] flex items-center justify-center mx-auto mb-4 border border-sky-100">
            <HeartPulse className="w-7 h-7" />
          </div>
          <h3 className="font-extrabold text-[#0F172A] text-lg mb-2">No Candidates Awaiting Medical Clearance</h3>
          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            Candidates appear here after completing all evaluations in the <strong className="text-slate-700">Screening Panel</strong>, generating their Medical Referral, and having their status moved to Medical Referral.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-left text-slate-600 space-y-1.5">
            <p className="font-bold text-slate-700">Screening Pipeline Requirements:</p>
            <p>• Phase 1: Pass English (≥60%), Trade Test (≥70%), and IQ (≥50%)</p>
            <p>• Phase 2: Pass Personality & EQ Assessment (Suitable)</p>
            <p>• Phase 3: Click &ldquo;Generate Medical Referral&rdquo; → Click &ldquo;Update Applicant Status&rdquo;</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center text-[#64748B]">
          <div className="flex items-center justify-center gap-2 mb-2">
            <HeartPulse className="w-5 h-5 text-[#0EA5E9]" />
            <h3 className="font-bold text-[#0F172A] text-lg">Medical Clearance Status</h3>
          </div>
          {applicant && (
            <p className="text-xs text-slate-500 mb-6">
              Evaluating: <strong className="text-slate-800">{applicant.name}</strong> ({applicant.applicantCode || applicant.id}) • {applicant.role}
            </p>
          )}
          
          {isProvisional ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 max-w-md mx-auto">
              <h4 className="text-amber-800 font-bold mb-2">Provisional Holding State</h4>
              <p className="text-sm text-amber-700 mb-6">
                This applicant was marked Unfit-to-Work. Choose how to proceed:
              </p>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handleReconsider}
                  className="px-4 py-2 bg-white border border-amber-300 text-amber-800 rounded-lg font-bold hover:bg-amber-100 text-sm cursor-pointer"
                >
                  Reconsider / Re-evaluate
                </button>
                <button
                  onClick={handleStopProcessing}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 text-sm cursor-pointer"
                >
                  Stop Processing
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="flex items-center justify-center gap-4">
              <select
                name="medicalStatus"
                className="border-2 border-slate-200 p-2.5 rounded-lg focus:border-[#0EA5E9] outline-none text-sm font-semibold bg-white"
                required
              >
                <option value="">Select Medical Status</option>
                <option value="Fit">✓ Fit to Work</option>
                <option value="Unfit">✗ Unfit to Work</option>
              </select>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#0F172A] text-white rounded-lg font-bold hover:bg-[#1E293B] text-sm cursor-pointer transition-colors shadow-sm"
              >
                Save Status
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
