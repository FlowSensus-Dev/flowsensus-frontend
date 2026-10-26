import { useState, useRef, useEffect, useMemo } from 'react';
import { Briefcase, Search, ChevronDown, Check, X, MapPin, Building2, Users, AlertCircle } from 'lucide-react';

export interface JobOrderOption {
  id: string;
  code: string;
  jobOrderId?: number;
  realId?: number | string;
  position: string;
  country: string;
  employerName: string;
  available: number;
  requirements?: string[];
  certifications?: string[];
  detailedRequirements?: any[];
  genderPreference?: string;
  minAge?: number;
  maxAge?: number;
}

interface SearchableJobOrderSelectorProps {
  jobOrders: JobOrderOption[];
  selectedJobOrderId: string;
  onSelectJobOrder: (jobOrderId: string, jobOrder?: JobOrderOption) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export default function SearchableJobOrderSelector({
  jobOrders = [],
  selectedJobOrderId,
  onSelectJobOrder,
  isLoading = false,
  disabled = false,
}: SearchableJobOrderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isMatch = (jo: any, targetId: string) => {
    if (!targetId) return false;
    const strTarget = String(targetId).trim();
    return (
      String(jo.id || '').trim() === strTarget ||
      String(jo.code || '').trim() === strTarget ||
      (jo.jobOrderId && String(jo.jobOrderId).trim() === strTarget) ||
      (jo.realId && String(jo.realId).trim() === strTarget)
    );
  };

  const selectedJobOrder = useMemo(() => {
    return jobOrders.find((j) => isMatch(j, selectedJobOrderId));
  }, [jobOrders, selectedJobOrderId]);

  // Focus search input when opening
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

  // Click outside to close
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

  // Keyboard navigation (Escape to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Filter job orders by position, employer, country, or code
  const filteredJobOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return jobOrders;

    const cleanQ = q.replace(/[^a-z0-9]/g, '');

    return jobOrders.filter((jo) => {
      const pos = (jo.position || '').toLowerCase();
      const emp = (jo.employerName || '').toLowerCase();
      const country = (jo.country || '').toLowerCase();
      const code = (jo.code || jo.id || '').toLowerCase();
      const cleanCode = code.replace(/[^a-z0-9]/g, '');

      return (
        pos.includes(q) ||
        emp.includes(q) ||
        country.includes(q) ||
        code.includes(q) ||
        (cleanQ && cleanCode.includes(cleanQ))
      );
    });
  }, [jobOrders, searchQuery]);

  const handleSelect = (jo: JobOrderOption) => {
    onSelectJobOrder(jo.id, jo);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectJobOrder('');
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Combobox Trigger */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
        className={`w-full text-left rounded-xl transition-all border shadow-xs cursor-pointer select-none ${
          disabled ? 'opacity-60 cursor-not-allowed bg-slate-50 border-slate-200' : ''
        } ${
          isOpen
            ? 'border-[#0EA5E9] ring-2 ring-[#0EA5E9]/20 bg-white'
            : selectedJobOrder
            ? 'border-slate-300 hover:border-slate-400 bg-white'
            : 'border-slate-300 hover:border-[#0EA5E9] bg-white'
        } p-3.5`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {selectedJobOrder ? (
          /* Selected Job Order Summary Card */
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-lg bg-sky-50 text-[#0EA5E9] border border-sky-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Briefcase size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200">
                    {selectedJobOrder.code}
                  </span>
                  <span className="font-extrabold text-sm text-slate-900 truncate">
                    {selectedJobOrder.position}
                  </span>
                  {selectedJobOrder.available > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {selectedJobOrder.available} slot{selectedJobOrder.available !== 1 ? 's' : ''} open
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      Slots filled
                    </span>
                  )}
                  {selectedJobOrder.genderPreference && selectedJobOrder.genderPreference !== 'Any' && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                      {selectedJobOrder.genderPreference === 'Female' ? '♀ Female Only' : selectedJobOrder.genderPreference === 'Male' ? '♂ Male Only' : selectedJobOrder.genderPreference}
                    </span>
                  )}
                  {(selectedJobOrder.minAge || selectedJobOrder.maxAge) && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      Age {selectedJobOrder.minAge || '18'}–{selectedJobOrder.maxAge || '65'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap font-medium">
                  <span className="flex items-center gap-1 truncate text-slate-700 font-semibold">
                    <Building2 size={12} className="text-slate-400" />
                    {selectedJobOrder.employerName}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-slate-600">
                    <MapPin size={12} className="text-slate-400" />
                    {selectedJobOrder.country}
                  </span>
                </div>

                {((selectedJobOrder.certifications && selectedJobOrder.certifications.length > 0) || (selectedJobOrder.requirements && selectedJobOrder.requirements.length > 0)) && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-2 pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Must Have:</span>
                    {(selectedJobOrder.certifications || []).map((c: string) => (
                      <span key={c} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                        🏆 {c}
                      </span>
                    ))}
                    {(selectedJobOrder.requirements || []).map((r: string) => (
                      <span key={r} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        📄 {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Clear selected job order"
              >
                <X size={15} />
              </button>
              <div className="w-px h-5 bg-slate-200" />
              <div className="flex items-center gap-1 text-xs font-semibold text-slate-600 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors">
                <span>Change</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#0EA5E9]' : ''}`}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Empty / Unselected Search Prompt */
          <div className="flex items-center justify-between gap-3 py-0.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
                <Search size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">
                  {isLoading ? 'Loading active job orders...' : 'Search & select job order (Required *)...'}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  Search by position title, employer company, country, or code
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                {jobOrders.length} available
              </span>
              <ChevronDown
                size={16}
                className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#0EA5E9]' : ''}`}
              />
            </div>
          </div>
        )}
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Search Input Bar */}
          <div className="p-3 bg-slate-50/90 border-b border-slate-200">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type position, employer, country, or code (e.g., Welder, Saudi, Aramco)..."
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

            <div className="flex items-center justify-between mt-2 px-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <span>Matching Job Orders</span>
              <span>
                {filteredJobOrders.length} of {jobOrders.length} available
              </span>
            </div>
          </div>

          {/* Job Orders List */}
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 p-1.5">
            {filteredJobOrders.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-700">No job orders found</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  No open job orders match &ldquo;{searchQuery}&rdquo;. Try searching for a different position, country, or company.
                </p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="mt-3 text-xs text-[#0EA5E9] hover:underline font-bold cursor-pointer"
                  >
                    Clear search filter
                  </button>
                )}
              </div>
            ) : (
              filteredJobOrders.map((jo) => {
                const isSelected = isMatch(jo, selectedJobOrderId);
                return (
                  <button
                    key={jo.id}
                    type="button"
                    onClick={() => handleSelect(jo)}
                    className={`w-full text-left p-3 rounded-lg transition-all flex items-center justify-between gap-3 group cursor-pointer ${
                      isSelected
                        ? 'bg-sky-50 text-sky-900 border border-sky-200 shadow-xs'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          isSelected
                            ? 'bg-[#0EA5E9] text-white'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-sky-100 group-hover:text-sky-700'
                        }`}
                      >
                        <Briefcase size={15} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 group-hover:bg-sky-100 group-hover:text-sky-800 border border-slate-200">
                            {jo.code}
                          </span>
                          <span className="text-sm font-bold text-slate-900 group-hover:text-[#0EA5E9] truncate">
                            {jo.position}
                          </span>
                          {jo.available > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              {jo.available} slot{jo.available !== 1 ? 's' : ''} open
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Full
                            </span>
                          )}
                          {jo.genderPreference && jo.genderPreference !== 'Any' && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                              {jo.genderPreference === 'Female' ? '♀ Female' : jo.genderPreference === 'Male' ? '♂ Male' : jo.genderPreference}
                            </span>
                          )}
                          {(jo.minAge || jo.maxAge) && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              Age {jo.minAge || '18'}–{jo.maxAge || '65'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5 text-xs text-slate-500 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 font-medium text-slate-700 truncate">
                            <Building2 size={12} className="text-slate-400" />
                            {jo.employerName}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-slate-600">
                            <MapPin size={12} className="text-slate-400" />
                            {jo.country}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0">
                        <Check size={14} className="stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
