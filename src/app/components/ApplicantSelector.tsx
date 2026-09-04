import { useState } from 'react';
import { Search, User, CheckCircle } from 'lucide-react';
import { ApplicantRecord } from '../types';

interface ApplicantSelectorProps {
  applicants: ApplicantRecord[];
  selectedApplicantId: string;
  onSelectApplicant: (applicantId: string) => void;
}

export default function ApplicantSelector({
  applicants,
  selectedApplicantId,
  onSelectApplicant,
}: ApplicantSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedApplicant = applicants.find((a) => a.id === selectedApplicantId);

  const filteredApplicants = applicants.filter(
    (applicant) =>
      applicant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      applicant.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      applicant.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (applicantId: string) => {
    onSelectApplicant(applicantId);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative">
      {/* Selected Applicant Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-3 bg-white border-2 border-slate-200 rounded-lg hover:border-[#0EA5E9] transition-colors w-full min-w-[300px]"
      >
        <div className="w-10 h-10 rounded-full bg-[#0EA5E9]/10 flex items-center justify-center font-bold text-[#0EA5E9] text-sm flex-shrink-0">
          {selectedApplicant
            ? selectedApplicant.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .substring(0, 2)
            : '?'}
        </div>
        <div className="flex-1 text-left">
          <p className="font-bold text-[#0F172A] text-sm">
            {selectedApplicant ? selectedApplicant.name : 'Select Applicant'}
          </p>
          <p className="text-xs text-[#64748B]">
            {selectedApplicant ? `${selectedApplicant.id} • Phase ${selectedApplicant.phase}` : 'Choose an applicant to process'}
          </p>
        </div>
        <div className="text-[#0EA5E9]">
          <svg
            className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>

          {/* Dropdown Panel */}
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-slate-200 rounded-lg shadow-2xl z-20 max-h-96 overflow-hidden flex flex-col">
            {/* Search */}
            <div className="p-3 border-b border-slate-200">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, ID, or role..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:border-[#0EA5E9] outline-none"
                  autoFocus
                />
              </div>
            </div>

            {/* Applicant List */}
            <div className="overflow-y-auto flex-1">
              {filteredApplicants.length === 0 ? (
                <div className="p-4 text-center text-sm text-[#64748B]">No applicants found</div>
              ) : (
                filteredApplicants.map((applicant) => (
                  <button
                    key={applicant.id}
                    onClick={() => handleSelect(applicant.id)}
                    className={`w-full p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-100 ${
                      applicant.id === selectedApplicantId ? 'bg-[#0EA5E9]/5' : ''
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#0EA5E9]/10 flex items-center justify-center font-bold text-[#0EA5E9] text-sm flex-shrink-0">
                      {applicant.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .substring(0, 2)}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-[#0F172A] text-sm">{applicant.name}</p>
                        {applicant.id === selectedApplicantId && (
                          <CheckCircle className="w-4 h-4 text-[#0EA5E9]" />
                        )}
                      </div>
                      <p className="text-xs text-[#64748B]">
                        {applicant.id} • {applicant.role}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold text-[#0EA5E9]">Phase {applicant.phase}</span>
                        <span className="text-xs text-[#64748B]">• {applicant.status}</span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-slate-200 bg-slate-50 text-xs text-[#64748B] text-center">
              {filteredApplicants.length} applicant{filteredApplicants.length !== 1 ? 's' : ''} available
            </div>
          </div>
        </>
      )}
    </div>
  );
}
