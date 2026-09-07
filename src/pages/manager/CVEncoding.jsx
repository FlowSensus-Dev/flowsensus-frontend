import { useState } from 'react';
import { UserCircle, Save, Download } from 'lucide-react';

function InlineApplicantSelector({ applicants, selectedApplicantId, onSelectApplicant }) {
  const selectedApplicant = applicants.find((a) => String(a.id) === selectedApplicantId);
  return (
    <div className="bg-gradient-to-r from-[#0EA5E9]/10 to-blue-50 border-2 border-[#0EA5E9]/30 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-4">
        <UserCircle className="w-5 h-5 text-[#0EA5E9]" />
        <div className="flex-1">
          <label htmlFor="cv-applicant" className="text-xs font-bold text-[#475569] block mb-1.5 uppercase tracking-wide">Select Applicant</label>
          <select id="cv-applicant" value={selectedApplicantId} disabled={applicants.length === 0} onChange={(e) => onSelectApplicant(e.target.value)} className="w-full border-2 border-[#0EA5E9]/30 px-4 py-2.5 rounded-lg text-sm font-bold bg-white focus:border-[#0EA5E9] outline-none disabled:cursor-not-allowed">
            <option value="">{applicants.length === 0 ? 'No applicants available for CV Encoding' : 'Select an applicant'}</option>
            {applicants.map((applicant) => (
              <option key={applicant.id} value={String(applicant.id)}>
                {applicant.id} - {applicant.name ?? ''} ({applicant.role ?? ''}) - Phase {applicant.phase ?? ''}
              </option>
            ))}
          </select>
        </div>
        {selectedApplicant && (
          <div className="text-right">
            <p className="text-xs text-[#64748B] font-medium">Current Status</p>
            <p className="text-sm font-bold text-[#0F172A]">{selectedApplicant.status ?? ''}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CVEncoding({ selectedApplicantId: initialApplicantId = '', applicants = [] } = {}) {
  const [selectedApplicantId, setSelectedApplicantId] = useState(String(initialApplicantId ?? ''));
  const selectableApplicants = applicants.filter((a) => a && a.id != null && String(a.id) !== '');
  const selectedApplicant = selectedApplicantId ? selectableApplicants.find((a) => String(a.id) === selectedApplicantId) : undefined;
  const skills = Array.isArray(selectedApplicant?.skills) ? selectedApplicant.skills.filter((skill) => typeof skill === 'string') : [];
  const certifications = Array.isArray(selectedApplicant?.certifications) ? selectedApplicant.certifications.filter((cert) => typeof cert === 'string').join(', ') : '';
  // Applicant-specific clearance, experience years, and CV summary fields are not established here.
  // Keep the form read-only until its data and persistence contract is integrated.

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">CV Encoding & Formatting</h2>
          <p className="text-sm text-[#64748B] mt-1 font-medium">
            Format applicant CV according to employer specifications
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

        <InlineApplicantSelector
          applicants={selectableApplicants}
          selectedApplicantId={selectedApplicant ? selectedApplicantId : ''}
          onSelectApplicant={setSelectedApplicantId}
        />

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 relative">
        {!selectedApplicant && (
          <div className="absolute inset-0 bg-[#F1F5F9]/85 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg">
            <UserCircle className="w-8 h-8 text-slate-400 mb-3" />
            <h3 className="font-bold text-[#0F172A]">Select an applicant to begin CV encoding.</h3>
          </div>
        )}

        {selectedApplicant && <p className="text-sm text-[#64748B] mb-6" role="status">CV encoding is not available yet. Supplied applicant details are shown read-only.</p>}
        <div className="space-y-6">
          <div>
            <label className="text-xs font-bold text-[#475569] block mb-2 uppercase tracking-wide">
              Applicant Name
            </label>
            <input
              type="text"
              value={selectedApplicant?.name ?? ''}
              disabled
              className="w-full border-2 border-slate-200 px-4 py-2 rounded-lg text-sm focus:border-[#0EA5E9] outline-none bg-slate-50 font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[#475569] block mb-2 uppercase tracking-wide">Position</label>
              <input
                type="text"
                value={selectedApplicant?.role ?? ''}
                disabled
                className="w-full border-2 border-slate-200 px-4 py-2 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#475569] block mb-2 uppercase tracking-wide">
                Years of Experience
              </label>
              <input
                type="number"
                value=""
                disabled
                className="w-full border-2 border-slate-200 px-4 py-2 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#475569] block mb-2 uppercase tracking-wide">
              Professional Summary
            </label>
            <textarea
              rows={4}
              value=""
              disabled
              className="w-full border-2 border-slate-200 px-4 py-2 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
            ></textarea>
          </div>

          <div>
            <label className="text-xs font-bold text-[#475569] block mb-2 uppercase tracking-wide">
              Key Skills
            </label>
            <div className="flex flex-wrap gap-2 min-h-7">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="px-3 py-1 bg-[#0EA5E9]/10 text-[#0EA5E9] text-xs font-bold rounded-full"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#475569] block mb-2 uppercase tracking-wide">
              Certifications
            </label>
            <input
              type="text"
              value={certifications}
              disabled
              className="w-full border-2 border-slate-200 px-4 py-2 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
            />
          </div>

          <div className="pt-4 border-t-2 border-slate-100 flex gap-4 justify-end">
            <button
              disabled
              className="px-6 py-2.5 text-sm font-bold border-2 border-slate-200 text-[#475569] hover:bg-slate-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Draft
            </button>
            <button
              title="Workflow submission is not available yet"
              disabled
              className="px-8 py-2.5 bg-[#0EA5E9] text-white text-sm font-bold hover:bg-[#0284C7] shadow-lg shadow-[#0EA5E9]/20 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              Submit for Approval
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
