import { useState } from 'react';

function InlineApplicantSelector({
  applicants = [],
  selectedApplicantId,
  onSelectApplicant,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
      <div className="text-xs font-bold text-[#475569] uppercase tracking-wide">
        Select Applicant
      </div>
      <div className="flex-1 max-w-md">
        <select
          value={selectedApplicantId}
          onChange={(e) => onSelectApplicant?.(e.target.value)}
          className="w-full border-2 border-slate-200 px-3 py-2 rounded-lg text-sm font-semibold text-[#0F172A] bg-slate-50 focus:border-[#0EA5E9] outline-none transition-colors"
        >
          {applicants.map((app) => (
            <option key={app.id} value={app.id}>
              {app.name} — {app.role} ({app.id})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function FitToWork({
  workflow,
  updateWorkflow,
  showToast,
  currentUserName,
  addActivityLog,
  updateApplicant,
  selectedApplicantId: initialApplicantId = 'APP-2026-089',
  applicants = [],
}) {
  const [selectedApplicantId, setSelectedApplicantId] = useState(initialApplicantId);

  const handleSave = (e) => {
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