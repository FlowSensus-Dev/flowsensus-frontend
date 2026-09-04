import { UserCircle } from 'lucide-react';
import { ApplicantRecord } from '../types';

interface InlineApplicantSelectorProps {
  applicants: ApplicantRecord[];
  selectedApplicantId: string;
  onSelectApplicant: (applicantId: string) => void;
}

export default function InlineApplicantSelector({
  applicants,
  selectedApplicantId,
  onSelectApplicant,
}: InlineApplicantSelectorProps) {
  const selectedApplicant = applicants.find((a) => a.id === selectedApplicantId);

  return (
    <div className="bg-gradient-to-r from-[#0EA5E9]/10 to-blue-50 border-2 border-[#0EA5E9]/30 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-4">
        <UserCircle className="w-5 h-5 text-[#0EA5E9]" />
        <div className="flex-1">
          <label className="text-xs font-bold text-[#475569] block mb-1.5 uppercase tracking-wide">
            Select Applicant
          </label>
          <select
            value={selectedApplicantId}
            onChange={(e) => onSelectApplicant(e.target.value)}
            className="w-full border-2 border-[#0EA5E9]/30 px-4 py-2.5 rounded-lg text-sm font-bold bg-white focus:border-[#0EA5E9] outline-none"
          >
            {applicants.map((applicant) => (
              <option key={applicant.id} value={applicant.id}>
                {applicant.id} - {applicant.name} ({applicant.role}) - Phase {applicant.phase}
              </option>
            ))}
          </select>
        </div>
        {selectedApplicant && (
          <div className="text-right">
            <p className="text-xs text-[#64748B] font-medium">Current Status</p>
            <p className="text-sm font-bold text-[#0F172A]">{selectedApplicant.status}</p>
          </div>
        )}
      </div>
    </div>
  );
}
