import { useState, useRef, useEffect, useMemo } from 'react';
import { UserCircle, Search, ChevronDown, Check, Sparkles, X, User } from 'lucide-react';
import { ApplicantRecord } from '../types';

interface InlineApplicantSelectorProps {
  applicants: ApplicantRecord[];
  selectedApplicantId: string;
  onSelectApplicant: (applicantId: string) => void;
  allowNew?: boolean;
}

export default function InlineApplicantSelector({
  applicants,
  selectedApplicantId,
  onSelectApplicant,
  allowNew = true,
}: InlineApplicantSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedApplicant = applicants.find(
    (a) => String(a.id) === String(selectedApplicantId)
  );

  // Auto-focus search input when opening; clear query on close
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Escape key closes dropdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Filter applicants by code, id, name, first/middle/last name, role
  const filteredApplicants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return applicants;

    // Strip punctuation from query and code for flexible code matching
    const cleanQ = q.replace(/[^a-z0-9]/g, '');

    return applicants.filter((applicant) => {
      const code = (applicant.applicantCode || applicant.id || '').toLowerCase();
      const cleanCode = code.replace(/[^a-z0-9]/g, '');

      const name = (applicant.name || '').toLowerCase();
      const firstName = (applicant.firstName || '').toLowerCase();
      const lastName = (applicant.lastName || '').toLowerCase();
      const middleName = (applicant.middleName || '').toLowerCase();
      const role = (applicant.role || '').toLowerCase();

      return (
        code.includes(q) ||
        (cleanQ && cleanCode.includes(cleanQ)) ||
        name.includes(q) ||
        firstName.includes(q) ||
        lastName.includes(q) ||
        middleName.includes(q) ||
        role.includes(q)
      );
    });
  }, [applicants, searchQuery]);

  const handleSelect = (id: string) => {
    onSelectApplicant(id);
    setIsOpen(false);
  };

  return (
    <div className="bg-gradient-to-r from-[#0EA5E9]/10 to-blue-50 border-2 border-[#0EA5E9]/30 rounded-lg p-4 mb-6 relative z-40">
      <div className="flex items-center gap-4">
        <UserCircle className="w-5 h-5 text-[#0EA5E9] flex-shrink-0" />

        {/* Combobox container */}
        <div className="flex-1 min-w-0" ref={containerRef}>
          <label className="text-xs font-bold text-[#475569] block mb-1.5 uppercase tracking-wide">
            Select Applicant
          </label>

          <div className="relative">
            {/* Trigger Button */}
            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              className={`w-full border-2 bg-white px-3.5 py-2.5 rounded-lg text-sm text-left font-bold transition-all shadow-sm flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/30 cursor-pointer ${
                isOpen
                  ? 'border-[#0EA5E9] ring-2 ring-[#0EA5E9]/20'
                  : 'border-[#0EA5E9]/30 hover:border-[#0EA5E9]'
              }`}
              aria-haspopup="listbox"
              aria-expanded={isOpen}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
                {selectedApplicantId === 'new' ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1.5 truncate">
                    <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>✨ + Register New Candidate (Blank Form)</span>
                  </span>
                ) : selectedApplicant ? (
                  <div className="flex items-center gap-2 flex-wrap min-w-0 truncate">
                    <span className="bg-sky-100 text-sky-800 font-mono text-xs px-2 py-0.5 rounded font-bold border border-sky-200 flex-shrink-0">
                      {selectedApplicant.applicantCode || selectedApplicant.id}
                    </span>
                    <span className="text-slate-900 font-bold truncate">
                      {selectedApplicant.name}
                    </span>
                    {selectedApplicant.role && (
                      <span className="text-xs text-slate-500 font-medium truncate">
                        ({selectedApplicant.role})
                      </span>
                    )}
                    {selectedApplicant.phase && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold flex-shrink-0">
                        Phase {selectedApplicant.phase}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-400 font-normal">Select an applicant or register new candidate...</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-slate-400 flex-shrink-0">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 text-slate-500 ${
                    isOpen ? 'rotate-180 text-[#0EA5E9]' : ''
                  }`}
                />
              </div>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
                {/* Search Input */}
                <div className="p-3 bg-slate-50 border-b border-slate-200">
                  <div className="relative flex items-center">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search applicant by name or code (e.g., 00007, Juan)..."
                      className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20 font-medium text-slate-800 placeholder:text-slate-400"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Options List */}
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 p-1.5">
                  {/* Register New Candidate option */}
                  {allowNew && (
                    <button
                      type="button"
                      onClick={() => handleSelect('new')}
                      className={`w-full text-left px-3.5 py-2.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer mb-1 ${
                        selectedApplicantId === 'new'
                          ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 shadow-sm'
                          : 'hover:bg-emerald-50/60 text-emerald-700 font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <div>
                          <span className="text-sm font-bold text-emerald-800">
                            ✨ + Register New Candidate
                          </span>
                          <span className="text-xs text-emerald-600 block">
                            Blank intake profile ready for new encoding
                          </span>
                        </div>
                      </div>
                      {selectedApplicantId === 'new' && (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      )}
                    </button>
                  )}

                  {/* Existing Applicants header */}
                  <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/70 flex items-center justify-between rounded-md my-1">
                    <span>Existing Registered Applicants</span>
                    <span>
                      {filteredApplicants.length} {filteredApplicants.length === 1 ? 'match' : 'matches'}
                    </span>
                  </div>

                  {/* Applicant rows */}
                  {filteredApplicants.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 text-sm">
                      <p className="font-medium text-slate-700">No applicants found</p>
                      <p className="text-xs text-slate-400 mt-1">
                        No match for &ldquo;{searchQuery}&rdquo;. Search by applicant code, first name, last name, or role.
                      </p>
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="mt-3 text-xs text-[#0EA5E9] hover:underline font-bold cursor-pointer"
                      >
                        Reset search filter
                      </button>
                    </div>
                  ) : (
                    filteredApplicants.map((applicant) => {
                      const isSelected = String(applicant.id) === String(selectedApplicantId);
                      return (
                        <button
                          key={applicant.id}
                          type="button"
                          onClick={() => handleSelect(applicant.id)}
                          className={`w-full text-left px-3.5 py-2.5 rounded-lg transition-colors flex items-center justify-between gap-3 group cursor-pointer ${
                            isSelected
                              ? 'bg-sky-50 text-sky-900 font-bold border border-sky-200 shadow-sm'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                isSelected
                                  ? 'bg-sky-600 text-white'
                                  : 'bg-slate-100 text-slate-600 group-hover:bg-sky-100 group-hover:text-sky-700'
                              }`}
                            >
                              {applicant.name ? applicant.name.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 group-hover:bg-sky-100 group-hover:text-sky-800 border border-slate-200">
                                  {applicant.applicantCode || applicant.id}
                                </span>
                                <span className="text-sm font-semibold text-slate-900 group-hover:text-[#0EA5E9] truncate">
                                  {applicant.name}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="font-medium text-slate-600">{applicant.role || 'General Position'}</span>
                                <span>•</span>
                                <span className="text-slate-500">Phase {applicant.phase || 1}</span>
                                {applicant.status && (
                                  <>
                                    <span>•</span>
                                    <span className="text-slate-500 capitalize">{applicant.status}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {isSelected && (
                            <Check className="w-4 h-4 text-sky-600 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Current Status display */}
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-[#64748B] font-medium">Current Status</p>
          <p className={`text-sm font-bold ${selectedApplicantId === 'new' ? 'text-emerald-600' : 'text-[#0F172A]'}`}>
            {selectedApplicantId === 'new' ? '✨ New Intake' : (selectedApplicant?.status || 'Active')}
          </p>
        </div>
      </div>
    </div>
  );
}
