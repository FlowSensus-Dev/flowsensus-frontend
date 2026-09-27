import { useState, useEffect } from 'react';
import { WorkflowState, ActivityLog, ApplicantRecord } from '../../types';
import InlineApplicantSelector from '../InlineApplicantSelector';

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
  const [selectedApplicantId, setSelectedApplicantId] = useState(initialApplicantId);
  const applicant = applicants.find(a => String(a.id) === String(selectedApplicantId));
  const isProvisional = applicant?.status === 'Provisional';

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const status = formData.get('medicalStatus');
    const applicantId = selectedApplicantId;

    if (status === 'Fit') {
      updateWorkflow({ medicalCleared: true });
      updateApplicant(applicantId, {
        phase: 3, // Still in phase 3 but moving to profiling
        status: 'Applicant Profiling',
        currentHandler: currentUserName,
        currentDepartment: 'Recruitment',
        phaseDescription: 'Medical clearance approved, ready for matching and profiling',
      });

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
      {applicants.length > 0 && (
        <InlineApplicantSelector
          applicants={applicants}
          selectedApplicantId={selectedApplicantId}
          onSelectApplicant={setSelectedApplicantId}
        />
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center text-[#64748B]">
        <h3 className="font-bold text-[#0F172A] mb-6">Medical Clearance Status</h3>
        
        {isProvisional ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 max-w-md mx-auto">
            <h4 className="text-amber-800 font-bold mb-2">Provisional Holding State</h4>
            <p className="text-sm text-amber-700 mb-6">
              This applicant was marked Unfit-to-Work. Choose how to proceed:
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleReconsider}
                className="px-4 py-2 bg-white border border-amber-300 text-amber-800 rounded-lg font-bold hover:bg-amber-100 text-sm"
              >
                Reconsider / Re-evaluate
              </button>
              <button
                onClick={handleStopProcessing}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 text-sm"
              >
                Stop Processing
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex items-center justify-center gap-4">
            <select
              name="medicalStatus"
              className="border-2 border-slate-200 p-2 rounded-lg focus:border-[#0EA5E9] outline-none"
              required
            >
              <option value="">Select</option>
              <option value="Fit">Fit to Work</option>
              <option value="Unfit">Unfit to Work</option>
            </select>
            <button
              type="submit"
              className="px-6 py-2 bg-[#0F172A] text-white rounded-lg font-bold hover:bg-[#1E293B]"
            >
              Save Status
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
