import { useState } from 'react';
import { Lock, Save, Download } from 'lucide-react';
import { WorkflowState, ActivityLog, ApplicantRecord } from '../../../app/types';
import InlineApplicantSelector from '../../../components/shared/InlineApplicantSelector';

interface CVEncodingProps {
  workflow: WorkflowState;
  showToast: (message: string) => void;
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  updateApplicant: (applicantId: string, updates: Partial<ApplicantRecord>) => void;
  selectedApplicantId?: string;
  applicants?: ApplicantRecord[];
}

export default function CVEncoding({
  workflow,
  showToast,
  currentUserName,
  addActivityLog,
  updateApplicant,
  selectedApplicantId: initialApplicantId = 'APP-2026-089',
  applicants = [],
}: CVEncodingProps) {
  const [selectedApplicantId, setSelectedApplicantId] = useState(initialApplicantId);
  const isLocked = !workflow.medicalCleared;

  const handleExportToPDF = () => {
    const selectedApplicant = applicants.find(a => a.id === selectedApplicantId);

    if (!selectedApplicant) {
      showToast('❌ No applicant selected');
      return;
    }

    // Create CV export content
    const cvContent = `
CURRICULUM VITAE - EXPORT
=========================

Personal Information:
- Full Name: ${selectedApplicant.name}
- Applicant ID: ${selectedApplicant.id}
- Position Applied: ${selectedApplicant.role}
- Job Order: ${selectedApplicant.jobOrder || 'N/A'}

Contact Information:
- Email: ${selectedApplicant.email || 'N/A'}
- Contact: ${selectedApplicant.contact || 'N/A'}
- Present Address: ${selectedApplicant.presentAddress || 'N/A'}

Professional Summary:
Experienced ${selectedApplicant.role} with ${selectedApplicant.workExperience?.length || 0}+ years in the industry.

Key Skills:
${selectedApplicant.skills?.map(skill => `- ${skill}`).join('\n') || '- N/A'}

Certifications:
${selectedApplicant.certifications?.map(cert => `- ${cert}`).join('\n') || '- N/A'}

Work Experience:
${selectedApplicant.workExperience?.map((exp, idx) => `
${idx + 1}. ${exp.position} at ${exp.companyName}
   ${exp.startDate} - ${exp.endDate}
   ${exp.country}${exp.isOverseas ? ' (Overseas)' : ' (Local)'}
   Responsibilities:
   ${exp.responsibilities.map(r => `   - ${r}`).join('\n')}
`).join('\n') || 'N/A'}

Languages Spoken:
${selectedApplicant.languagesSpoken?.map(lang => `- ${lang}`).join('\n') || '- N/A'}

Test Scores:
- English Proficiency: ${selectedApplicant.testScores?.englishProficiency || 'N/A'}%
- Trade/Skills: ${selectedApplicant.testScores?.tradeSkills || 'N/A'}%
- IQ/Aptitude: ${selectedApplicant.testScores?.iqAptitude || 'N/A'}%
- Personality/EQ: ${selectedApplicant.testScores?.personalityEQ || 'N/A'}

Current Status:
- Phase: ${selectedApplicant.phase}
- Status: ${selectedApplicant.status}
- Handler: ${selectedApplicant.currentHandler}

CV Prepared by: ${currentUserName}
Date Generated: ${new Date().toLocaleString()}
    `;

    // Create blob and download
    const blob = new Blob([cvContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CV-${selectedApplicant.name.replace(/\s+/g, '-')}-${selectedApplicant.id}-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);

    addActivityLog({
      applicantId: selectedApplicantId,
      action: 'CV Exported to PDF',
      performedBy: currentUserName,
      department: 'Recruitment',
      details: `CV exported for ${selectedApplicant.name} (${selectedApplicant.id})`,
    });

    showToast('✓ CV exported successfully');
  };

  const handleSubmit = () => {
    const applicantId = selectedApplicantId;

    addActivityLog({
      applicantId,
      action: 'CV Submitted for Approval',
      performedBy: currentUserName,
      department: 'Recruitment',
      details: 'CV formatted and submitted to management for approval',
    });

    updateApplicant(applicantId, {
      status: 'Pending Manager Approval',
      currentHandler: 'Admin User',
      currentDepartment: 'Management',
      phaseDescription: 'CV awaiting management review and approval',
    });

    showToast('CV submitted to Manager for approval');
  };

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
          onClick={handleExportToPDF}
          disabled={isLocked}
          className="px-5 py-2.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-sm font-bold rounded-lg shadow-lg shadow-[#0EA5E9]/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          Export to PDF
        </button>
      </div>

      {applicants.length > 0 && (
        <InlineApplicantSelector
          applicants={applicants}
          selectedApplicantId={selectedApplicantId}
          onSelectApplicant={setSelectedApplicantId}
        />
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 relative">
        {isLocked && (
          <div className="absolute inset-0 bg-[#F1F5F9]/85 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg">
            <Lock className="w-8 h-8 text-slate-400 mb-3" />
            <h3 className="font-bold text-[#0F172A]">Locked by RBAC</h3>
            <p className="text-sm mt-1">Medical clearance required to proceed</p>
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="text-xs font-bold text-[#475569] block mb-2 uppercase tracking-wide">
              Applicant Name
            </label>
            <input
              type="text"
              defaultValue="Juan Dela Cruz"
              disabled={isLocked}
              className="w-full border-2 border-slate-200 px-4 py-2 rounded-lg text-sm focus:border-[#0EA5E9] outline-none bg-slate-50 font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[#475569] block mb-2 uppercase tracking-wide">Position</label>
              <input
                type="text"
                defaultValue="Industrial Welder"
                disabled={isLocked}
                className="w-full border-2 border-slate-200 px-4 py-2 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#475569] block mb-2 uppercase tracking-wide">
                Years of Experience
              </label>
              <input
                type="number"
                defaultValue="5"
                disabled={isLocked}
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
              defaultValue="Experienced industrial welder with 5+ years in structural fabrication. TESDA NCII certified with expertise in SMAW, GMAW, and FCAW processes."
              disabled={isLocked}
              className="w-full border-2 border-slate-200 px-4 py-2 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
            ></textarea>
          </div>

          <div>
            <label className="text-xs font-bold text-[#475569] block mb-2 uppercase tracking-wide">
              Key Skills
            </label>
            <div className="flex flex-wrap gap-2">
              {['SMAW', 'GMAW', 'FCAW', 'Blueprint Reading', 'Metal Fabrication', 'Quality Control'].map((skill) => (
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
              defaultValue="TESDA NCII - Shielded Metal Arc Welding"
              disabled={isLocked}
              className="w-full border-2 border-slate-200 px-4 py-2 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
            />
          </div>

          <div className="pt-4 border-t-2 border-slate-100 flex gap-4 justify-end">
            <button
              disabled={isLocked}
              className="px-6 py-2.5 text-sm font-bold border-2 border-slate-200 text-[#475569] hover:bg-slate-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Draft
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLocked}
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
