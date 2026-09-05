import { useState } from 'react';
import { WorkflowState, ActivityLog, ApplicantRecord } from '../../../app/types';
import InlineApplicantSelector from '../../../components/shared/InlineApplicantSelector';

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

export default function FitToWork({ workflow, updateWorkflow, showToast, currentUserName, addActivityLog, updateApplicant, selectedApplicantId: initialApplicantId = 'APP-2026-089', applicants = [] }: FitToWorkProps) {
  const [selectedApplicantId, setSelectedApplicantId] = useState(initialApplicantId);
  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const status = formData.get('medicalStatus');

    if (status === 'Fit') {
      const applicantId = selectedApplicantId;

      updateWorkflow({ medicalCleared: true });
      updateApplicant(applicantId, {
        phase: 3,
        status: 'CV Encoding',
        currentHandler: currentUserName,
        currentDepartment: 'Recruitment',
        phaseDescription: 'Medical clearance approved, ready for CV preparation',
      });

      addActivityLog({
        applicantId,
        action: 'Medical Clearance Approved',
        performedBy: currentUserName,
        department: 'Admin',
        details: 'Applicant marked as Fit-to-Work, CV module unlocked',
      });

      showToast('Clearance Saved. CV Module Unlocked.');
    }
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
      <form onSubmit={handleSave} className="flex items-center justify-center gap-4">
        <select
          name="medicalStatus"
          className="border-2 border-slate-200 p-2 rounded-lg focus:border-[#0EA5E9] outline-none"
        >
          <option value="">Select</option>
          <option value="Fit">Fit to Work</option>
          <option value="Unfit">Unfit to Work</option>
        </select>
        <button
          type="submit"
          className="px-6 py-2 bg-[#0F172A] text-white rounded-lg font-bold hover:bg-[#1E293B]"
        >
          Save Status (Unlocks CV)
        </button>
      </form>
      </div>
    </div>
  );
}
