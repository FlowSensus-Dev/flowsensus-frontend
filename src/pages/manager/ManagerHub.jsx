import { CheckSquare, Building2, Download } from 'lucide-react';

export default function ManagerHub({ applicants = [], selectedApplicantId, workflow } = {}) {
  const selectedApplicant = selectedApplicantId ? applicants.find((a) => a.id === selectedApplicantId) : undefined;
  const statusLabel = (value, complete, pending = 'Pending') =>
    !selectedApplicant || typeof value !== 'boolean' ? 'Not available' : value ? complete : pending;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">
            <CheckSquare className="w-8 h-8 inline-block mr-2 text-[#10B981]" />
            Manager CV & Employer Approval Hub
          </h2>
          <p className="text-sm text-[#64748B] mt-1 font-medium">
            Quality control gateway and employer acceptance tracker (Master Key)
          </p>
        </div>
        <button
          disabled
          title="PDF export is not available yet"
          className="px-5 py-2.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-sm font-bold rounded-lg shadow-lg shadow-[#0EA5E9]/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          Export to PDF
        </button>
      </div>

      {/* CV Review Section */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 relative">
        <div className="flex items-center justify-between mb-6 border-b-2 border-slate-100 pb-4">
          <div>
            <h3 className="font-black text-[#0F172A] text-lg flex items-center gap-2">
              <Building2 className="w-6 h-6 text-[#0EA5E9]" />
              CV - Quality Control
            </h3>
            <p className="text-xs text-[#64748B] mt-1">Select an applicant to review their CV.</p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-6 border border-slate-200 mb-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-bold text-[#64748B] uppercase mb-2">Applicant</p>
              <p className="font-bold text-[#0F172A]">{selectedApplicant?.name || 'No applicant selected.'}</p>
              <p className="text-sm text-[#64748B]">{selectedApplicant ? `${selectedApplicant.id} • ${selectedApplicant.role || '—'}` : '—'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-[#64748B] uppercase mb-2">Target Employer</p>
              <p className="font-bold text-[#0F172A]">Not available</p>
              <p className="text-sm text-[#64748B]">—</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-300">
            <p className="text-xs font-bold text-[#64748B] uppercase mb-2">CV Summary (Read-Only)</p>
            <p className="text-sm text-[#0F172A]">
              No CV summary available.
            </p>
          </div>
        </div>

      </div>

      {/* Action Button */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-[#0F172A] text-lg mb-2">Master Key Action</h3>
              <p className="text-sm text-[#64748B]">
                This action serves as the <span className="font-bold text-[#EF4444]">Master Key</span> that unlocks
                final deployment processing
              </p>
            </div>
            <button
              disabled
              title="Approval and employer acceptance are not available yet"
              className="px-8 py-4 bg-[#10B981] text-white text-sm font-bold hover:bg-[#059669] shadow-lg rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <CheckSquare className="w-5 h-5" />
              Approve CV & Record Employer Acceptance
            </button>
          </div>
        </div>

      {/* Status Panel */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
        <h3 className="font-black text-[#0F172A] text-lg mb-4">Workflow Status</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <span className="text-sm font-bold text-[#64748B]">Medical Clearance</span>
            <span
              className={`px-3 py-1 text-xs font-bold rounded-full ${
                selectedApplicant && workflow?.medicalCleared
                  ? 'bg-[#10B981]/10 text-[#10B981]'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              {statusLabel(workflow?.medicalCleared, '✓ Cleared')}
            </span>
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <span className="text-sm font-bold text-[#64748B]">CV Approved</span>
            <span
              className={`px-3 py-1 text-xs font-bold rounded-full ${
                selectedApplicant && workflow?.cvApproved
                  ? 'bg-[#10B981]/10 text-[#10B981]'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              {statusLabel(workflow?.cvApproved, '✓ Approved')}
            </span>
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <span className="text-sm font-bold text-[#64748B]">Employer Acceptance</span>
            <span
              className={`px-3 py-1 text-xs font-bold rounded-full ${
                selectedApplicant && workflow?.employerAccepted
                  ? 'bg-[#10B981]/10 text-[#10B981]'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              {statusLabel(workflow?.employerAccepted, '✓ Accepted')}
            </span>
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <span className="text-sm font-bold text-[#64748B]">Phase 5 Modules</span>
            <span
              className={`px-3 py-1 text-xs font-bold rounded-full ${
                selectedApplicant && workflow?.employerAccepted
                  ? 'bg-[#10B981]/10 text-[#10B981]'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              {statusLabel(workflow?.employerAccepted, '🔓 Unlocked', '🔒 Locked')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}