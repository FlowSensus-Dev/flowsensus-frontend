import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Pencil, Trash2, GripVertical, CheckCircle2, XCircle,
  Save, X, ToggleLeft, ToggleRight, AlertCircle, Loader2,
  Check, Filter, ShieldCheck, Tag, Briefcase, Search,
  ChevronDown, RotateCcw, Layers, Building2
} from 'lucide-react';
import { DocumentRequirement, ApplicantTypeLookup } from '../../types';
import { api } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { Skeleton, SkeletonBadge } from '../ui/skeleton';

interface JobOrderSummary {
  id: number;
  job_order_id: number;
  job_code: string;
  position: string;
  employer_name?: string;
  company_name?: string;
}

const BADGE_PALETTE = [
  { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' }, // Blue
  { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' }, // Emerald
  { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' }, // Purple
  { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' }, // Amber
  { bg: '#FDF2F8', text: '#DB2777', border: '#FBCFE8' }, // Pink
  { bg: '#F0FDFA', text: '#0D9488', border: '#99F6E4' }, // Teal
  { bg: '#F1F5F9', text: '#334155', border: '#CBD5E1' }, // Slate
  { bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA' }, // Orange
];

function getBadgeColor(key: string | number) {
  const strKey = String(key);
  let hash = 0;
  for (let i = 0; i < strKey.length; i++) {
    hash = (hash << 5) - hash + strKey.charCodeAt(i);
  }
  const idx = Math.abs(hash) % BADGE_PALETTE.length;
  return BADGE_PALETTE[idx];
}

interface Props {
  showToast: (msg: string) => void;
  currentUserName: string;
}

const BLANK_REQ: Omit<DocumentRequirement, 'id' | 'sortOrder'> = {
  name: '',
  description: '',
  category: 'DOCUMENT',
  isRequired: true,
  applicantTypes: [],
  jobOrders: [],
  expiryTracked: false,
  validityMonths: 12,
  isActive: true,
};

export default function RequirementsSetup({ showToast, currentUserName }: Props) {
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([]);
  const [applicantTypes, setApplicantTypes] = useState<ApplicantTypeLookup[]>([]);
  const [jobOrders, setJobOrders] = useState<JobOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [applicantTypeFilter, setApplicantTypeFilter] = useState<string>('all');
  const [jobOrderFilter, setJobOrderFilter] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Searchable Job Order Dropdown State
  const [isJobOrderDropdownOpen, setIsJobOrderDropdownOpen] = useState(false);
  const [jobOrderDropdownSearch, setJobOrderDropdownSearch] = useState('');
  const [jobOrderDropdownTab, setJobOrderDropdownTab] = useState<'positions' | 'orders'>('positions');
  const jobOrderDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modal State
  const [editing, setEditing] = useState<DocumentRequirement | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modalJobOrderSearch, setModalJobOrderSearch] = useState<string>('');

  // Drag and Drop
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // ── Fetch Requirements, Applicant Types, and Job Orders ────────────────────
  const fetchData = async () => {
    try {
      setLoading(true);
      const [reqsRes, appTypesRes, jobOrdersRes] = await Promise.allSettled([
        api.get('/requirements'),
        api.get('/lookups/applicant-types'),
        api.get('/job-orders'),
      ]);

      if (appTypesRes.status === 'fulfilled' && Array.isArray(appTypesRes.value.data)) {
        setApplicantTypes(appTypesRes.value.data);
      }

      if (jobOrdersRes.status === 'fulfilled' && Array.isArray(jobOrdersRes.value.data)) {
        const rawOrders = jobOrdersRes.value.data;
        const mappedOrders: JobOrderSummary[] = rawOrders.map((jo: any) => {
          const numId = Number(jo.job_order_id || jo.id || 0);
          return {
            id: numId,
            job_order_id: numId,
            job_code: jo.job_code || `JO-${numId}`,
            position: jo.position || 'General Worker',
            employer_name: jo.employer?.company_name || jo.company_name || jo.employer_name || '',
          };
        });
        setJobOrders(mappedOrders);
      }

      if (reqsRes.status === 'fulfilled' && Array.isArray(reqsRes.value.data)) {
        const mapped: DocumentRequirement[] = reqsRes.value.data.map((r: any) => {
          const validityDays = r.validity_days || r.validity_period || 365;
          const rawJobOrders = r.job_orders || r.jobOrders || [];
          const rawCat = String(r.category || 'DOCUMENT').toUpperCase();
          const category = ['DOCUMENT', 'CERTIFICATION', 'MEDICAL', 'OTHER'].includes(rawCat)
            ? (rawCat as 'DOCUMENT' | 'CERTIFICATION' | 'MEDICAL' | 'OTHER')
            : 'DOCUMENT';
          return {
            id: String(r.requirement_id || r.id),
            name: r.requirement_name || r.name || '',
            description: r.description || '',
            category,
            isRequired: Boolean(r.default_is_mandatory ?? r.is_required ?? r.isRequired ?? true),
            applicantTypes: Array.isArray(r.applicant_types)
              ? r.applicant_types
              : Array.isArray(r.applicantTypes)
              ? r.applicantTypes
              : [],
            jobOrders: Array.isArray(rawJobOrders)
              ? rawJobOrders.map((x: any) => Number(x)).filter((n: number) => !isNaN(n) && n > 0)
              : [],
            expiryTracked: Boolean(r.expiry_tracked ?? (validityDays !== 0 && validityDays !== 36500)),
            validityMonths: Math.max(1, Math.round(validityDays / 30)),
            validityDays: validityDays,
            sortOrder: Number(r.sort_order ?? r.sortOrder ?? 0),
            isActive: Boolean(r.is_active ?? r.isActive ?? true),
          };
        });
        setRequirements(mapped);
      }
    } catch (err) {
      console.error('Failed to load document requirements setup:', err);
      showToast('Error loading requirements data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Live Real-Time Subscription to requirement table
    const channel = supabase
      .channel('realtime:document_requirements_setup')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'requirement' },
        (payload: any) => {
          console.log('[RequirementsSetup] Realtime requirement update:', payload.eventType);
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_order_requirement' },
        (payload: any) => {
          console.log('[RequirementsSetup] Realtime job_order_requirement update:', payload.eventType);
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ── Lookup Name Mappings ───────────────────────────────────────────────────
  const applicantTypeNames = useMemo(() => {
    const map = new Map<string, string>();
    applicantTypes.forEach(t => map.set(t.applicant_type_code, t.type_name));
    return map;
  }, [applicantTypes]);

  const jobOrderMap = useMemo(() => {
    const map = new Map<number, JobOrderSummary>();
    jobOrders.forEach(jo => map.set(jo.job_order_id, jo));
    return map;
  }, [jobOrders]);

  // Position Statistics and Grouping
  const positionStats = useMemo(() => {
    const map = new Map<string, { count: number; ids: number[] }>();
    jobOrders.forEach(jo => {
      const pos = (jo.position || 'General Worker').trim();
      const existing = map.get(pos) || { count: 0, ids: [] };
      existing.count += 1;
      existing.ids.push(jo.job_order_id);
      map.set(pos, existing);
    });
    return map;
  }, [jobOrders]);

  const uniquePositions = useMemo(() => {
    return Array.from(positionStats.keys()).sort((a, b) => a.localeCompare(b));
  }, [positionStats]);

  const filteredPositionsForDropdown = useMemo(() => {
    const q = jobOrderDropdownSearch.trim().toLowerCase();
    if (!q) return uniquePositions;
    return uniquePositions.filter(pos => pos.toLowerCase().includes(q));
  }, [uniquePositions, jobOrderDropdownSearch]);

  const filteredJobOrdersForDropdown = useMemo(() => {
    const q = jobOrderDropdownSearch.trim().toLowerCase();
    if (!q) return jobOrders;
    return jobOrders.filter(jo => {
      const matchPos = (jo.position || '').toLowerCase().includes(q);
      const matchCode = (jo.job_code || '').toLowerCase().includes(q);
      const matchEmp = (jo.employer_name || jo.company_name || '').toLowerCase().includes(q);
      return matchPos || matchCode || matchEmp;
    });
  }, [jobOrders, jobOrderDropdownSearch]);

  const selectedJobOrderDisplay = useMemo(() => {
    if (jobOrderFilter === 'all') return 'All Job Orders';
    const filterNum = Number(jobOrderFilter);
    if (!isNaN(filterNum) && filterNum > 0) {
      const jo = jobOrderMap.get(filterNum);
      if (jo) {
        return `${jo.position} (${jo.job_code})`;
      }
      return `Job Order #${filterNum}`;
    }
    return `Position: ${jobOrderFilter}`;
  }, [jobOrderFilter, jobOrderMap]);

  // Click outside to close Job Order dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        jobOrderDropdownRef.current &&
        !jobOrderDropdownRef.current.contains(event.target as Node)
      ) {
        setIsJobOrderDropdownOpen(false);
      }
    }
    if (isJobOrderDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isJobOrderDropdownOpen]);

  const handleResetFilters = () => {
    setSearchFilter('');
    setApplicantTypeFilter('all');
    setJobOrderFilter('all');
    setJobOrderDropdownSearch('');
  };

  const hasActiveFilters = searchFilter.trim() !== '' || applicantTypeFilter !== 'all' || jobOrderFilter !== 'all';

  // ── Filtered Requirements ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return requirements
      .filter(r => {
        // Search text filter
        if (searchFilter.trim()) {
          const q = searchFilter.toLowerCase();
          const matchName = r.name.toLowerCase().includes(q);
          const matchDesc = (r.description || '').toLowerCase().includes(q);
          if (!matchName && !matchDesc) return false;
        }

        // Applicant Type filter
        const matchApplicantType =
          applicantTypeFilter === 'all' ||
          r.applicantTypes.length === 0 ||
          r.applicantTypes.includes(applicantTypeFilter);

        // Job Order filter
        let matchJobOrder = true;
        if (jobOrderFilter !== 'all') {
          const filterNum = Number(jobOrderFilter);
          if (!isNaN(filterNum) && filterNum > 0) {
            matchJobOrder = r.jobOrders.length === 0 || r.jobOrders.includes(filterNum);
          } else {
            // Position filter string
            const posOrders = jobOrders
              .filter(jo => jo.position.toLowerCase() === jobOrderFilter.toLowerCase())
              .map(jo => jo.job_order_id);
            matchJobOrder =
              r.jobOrders.length === 0 ||
              r.jobOrders.some(id => posOrders.includes(id));
          }
        }

        return matchApplicantType && matchJobOrder;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || Number(a.id) - Number(b.id));
  }, [requirements, applicantTypeFilter, jobOrderFilter, searchFilter, jobOrders]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalCount = requirements.length;
  const activeCount = requirements.filter(r => r.isActive).length;
  const mandatoryCount = requirements.filter(r => r.isRequired && r.isActive).length;
  const optionalCount = activeCount - mandatoryCount;

  // ── Actions ────────────────────────────────────────────────────────────────
  const openNew = () => {
    setEditing({
      ...BLANK_REQ,
      id: `new-${Date.now()}`,
      category: 'DOCUMENT',
      sortOrder: requirements.length + 1,
    });
    setModalJobOrderSearch('');
    setIsNew(true);
  };

  const openEdit = (r: DocumentRequirement) => {
    setEditing({
      ...r,
      category: r.category || 'DOCUMENT',
      applicantTypes: [...(r.applicantTypes || [])],
      jobOrders: [...(r.jobOrders || [])],
    });
    setModalJobOrderSearch('');
    setIsNew(false);
  };

  const save = async () => {
    if (!editing || isSaving) return;
    if (!editing.name.trim()) {
      showToast('Requirement name is required');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: editing.name.trim(),
        description: editing.description.trim(),
        category: (editing.category || 'DOCUMENT').toUpperCase(),
        isRequired: editing.isRequired,
        validityDays: editing.expiryTracked && editing.validityMonths ? editing.validityMonths * 30 : 365,
        isActive: editing.isActive,
        sortOrder: editing.sortOrder,
        applicantTypes: editing.applicantTypes,
        jobOrders: editing.jobOrders,
      };

      if (isNew) {
        const res = await api.post('/requirements', payload);
        const created = res.data;
        const newReq: DocumentRequirement = {
          ...editing,
          id: String(created.requirement_id || created.id),
          category: (created.category || editing.category || 'DOCUMENT').toUpperCase() as any,
          sortOrder: created.sort_order ?? editing.sortOrder,
          applicantTypes: created.applicant_types || editing.applicantTypes,
          jobOrders: created.job_orders || editing.jobOrders,
        };
        setRequirements(prev => [...prev, newReq]);
        showToast(`"${editing.name}" added successfully`);
      } else {
        const numId = parseInt(editing.id.replace('new-', ''), 10);
        if (!isNaN(numId)) {
          const res = await api.put(`/requirements/${numId}`, payload);
          const updated = res.data;
          setRequirements(prev =>
            prev.map(r =>
              r.id === editing.id
                ? {
                    ...editing,
                    category: (updated.category || editing.category || 'DOCUMENT').toUpperCase() as any,
                    applicantTypes: updated.applicant_types || editing.applicantTypes,
                    jobOrders: updated.job_orders || editing.jobOrders,
                  }
                : r
            )
          );
        } else {
          setRequirements(prev => prev.map(r => (r.id === editing.id ? editing : r)));
        }
        showToast(`"${editing.name}" updated successfully`);
      }

      setEditing(null);
    } catch (err: any) {
      console.error('Failed to save requirement:', err);
      const detail = err.response?.data?.detail || err.message || 'Operation failed';
      showToast(`Error: ${detail}`);
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (id: string) => {
    const req = requirements.find(r => r.id === id);
    if (!req) return;

    if (!window.confirm(`Are you sure you want to delete "${req.name}"? This action cannot be undone.`)) {
      return;
    }

    const numId = parseInt(id.replace('new-', ''), 10);
    if (!isNaN(numId)) {
      try {
        await api.delete(`/requirements/${numId}`);
      } catch (err: any) {
        console.error('Failed to delete requirement from server:', err);
        showToast('Failed to delete from server: ' + (err.response?.data?.detail || err.message));
        return;
      }
    }
    setRequirements(prev => prev.filter(r => r.id !== id));
    showToast(`"${req.name}" deleted successfully`);
  };

  const toggleStatus = async (id: string) => {
    const current = requirements.find(r => r.id === id);
    if (!current) return;

    const nextStatus = !current.isActive;
    setRequirements(prev => prev.map(r => (r.id === id ? { ...r, isActive: nextStatus } : r)));

    const numId = parseInt(id.replace('new-', ''), 10);
    if (!isNaN(numId)) {
      try {
        await api.put(`/requirements/${numId}`, { isActive: nextStatus });
        showToast(`Requirement "${current.name}" marked as ${nextStatus ? 'Active' : 'Inactive'}`);
      } catch (err) {
        console.warn('Failed to update status on server:', err);
        setRequirements(prev => prev.map(r => (r.id === id ? { ...r, isActive: current.isActive } : r)));
        showToast('Failed to update status on server');
      }
    }
  };

  // ── Drag & Drop Reorder ────────────────────────────────────────────────────
  const onDragStart = (id: string) => setDragId(id);
  const onDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };
  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    const items = [...requirements].sort((a, b) => a.sortOrder - b.sortOrder);
    const fromIdx = items.findIndex(r => r.id === dragId);
    const toIdx = items.findIndex(r => r.id === targetId);
    const reordered = [...items];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    const updated = reordered.map((r, i) => ({ ...r, sortOrder: i + 1 }));
    setRequirements(updated);
    setDragId(null);
    setDragOverId(null);

    // Persist new order for moved rows
    updated.forEach(r => {
      const numId = parseInt(r.id.replace('new-', ''), 10);
      if (!isNaN(numId)) {
        api.put(`/requirements/${numId}`, { sortOrder: r.sortOrder }).catch(() => {});
      }
    });
  };

  // ── Target Toggle Helpers in Modal ─────────────────────────────────────────
  const toggleApplicantType = (code: string) => {
    if (!editing) return;
    const current = editing.applicantTypes || [];
    const exists = current.includes(code);
    const updated = exists ? current.filter(c => c !== code) : [...current, code];
    setEditing({ ...editing, applicantTypes: updated });
  };

  const toggleJobOrder = (jobOrderId: number) => {
    if (!editing) return;
    const current = editing.jobOrders || [];
    const exists = current.includes(jobOrderId);
    const updated = exists ? current.filter(id => id !== jobOrderId) : [...current, jobOrderId];
    setEditing({ ...editing, jobOrders: updated });
  };

  return (
    <div className="w-full max-w-full space-y-6 pb-12 transition-all duration-300">
      {/* ── Page Header (Flowsensus Consistent Style) ────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A]">
              Document Requirements Setup
            </h1>
            <span className="px-2.5 py-0.5 bg-sky-50 text-[#0EA5E9] text-xs font-bold rounded border border-sky-200 uppercase tracking-wider">
              Compliance Rules
            </span>
          </div>
          <p className="text-sm text-[#64748B] mt-1 font-medium">
            Configure dynamic regulatory and agency document requirements targeted by applicant type and job order.
          </p>
        </div>

        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm cursor-pointer self-start sm:self-auto"
        >
          <Plus size={16} /> Add Requirement
        </button>
      </div>

      {/* ── KPI Metric Summary Cards (Signature Flowsensus Card Layout) ───── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Requirements */}
        <div className="bg-white p-5 sm:p-6 rounded-lg border-l-4 border-l-[#0F172A] shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#0F172A]/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <p className="text-xs sm:text-sm font-bold text-[#64748B] uppercase tracking-wider">
            Total Requirements
          </p>
          <p className="text-3xl sm:text-4xl font-black text-[#0F172A] mt-2">
            {totalCount}
          </p>
        </div>

        {/* Active Requirements */}
        <div className="bg-white p-5 sm:p-6 rounded-lg border-l-4 border-l-[#10B981] shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#10B981]/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <p className="text-xs sm:text-sm font-bold text-[#64748B] uppercase tracking-wider">
            Active in Workflows
          </p>
          <p className="text-3xl sm:text-4xl font-black text-[#10B981] mt-2">
            {activeCount}
          </p>
        </div>

        {/* Mandatory Requirements */}
        <div className="bg-white p-5 sm:p-6 rounded-lg border-l-4 border-l-[#EF4444] shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#EF4444]/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <p className="text-xs sm:text-sm font-bold text-[#64748B] uppercase tracking-wider">
            Mandatory Documents
          </p>
          <p className="text-3xl sm:text-4xl font-black text-[#EF4444] mt-2">
            {mandatoryCount}
          </p>
        </div>

        {/* Optional Requirements */}
        <div className="bg-white p-5 sm:p-6 rounded-lg border-l-4 border-l-[#F59E0B] shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#F59E0B]/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <p className="text-xs sm:text-sm font-bold text-[#64748B] uppercase tracking-wider">
            Optional / Supporting
          </p>
          <p className="text-3xl sm:text-4xl font-black text-[#F59E0B] mt-2">
            {optionalCount}
          </p>
        </div>
      </div>

      {/* ── Dynamic Filter Toolbar ────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-5 space-y-3.5 shadow-sm">
        {/* Row 1: Search Input + Searchable Job Order Dropdown Combobox */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Requirement Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Search requirement name or instructions..."
              className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] focus:border-[#0EA5E9] bg-white text-slate-800 placeholder-slate-400 transition-all"
            />
            {searchFilter && (
              <button
                onClick={() => setSearchFilter('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Searchable Job Order Dropdown Combobox */}
          <div ref={jobOrderDropdownRef} className="relative sm:w-80 lg:w-96 flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsJobOrderDropdownOpen(prev => !prev)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 border rounded text-sm transition-all cursor-pointer ${
                jobOrderFilter !== 'all'
                  ? 'border-[#0EA5E9] bg-sky-50/70 text-[#0F172A] font-medium shadow-xs'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 truncate">
                <Briefcase
                  size={15}
                  className={`flex-shrink-0 ${
                    jobOrderFilter !== 'all' ? 'text-[#0EA5E9]' : 'text-slate-400'
                  }`}
                />
                <span className="truncate">
                  {selectedJobOrderDisplay}
                </span>
                {jobOrderFilter === 'all' && (
                  <span className="text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-semibold flex-shrink-0">
                    {jobOrders.length}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {jobOrderFilter !== 'all' && (
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setJobOrderFilter('all');
                    }}
                    className="p-0.5 hover:bg-sky-200/60 rounded text-slate-500 hover:text-slate-700 transition-colors"
                    title="Clear Job Order filter"
                  >
                    <X size={13} />
                  </span>
                )}
                <ChevronDown
                  size={15}
                  className={`text-slate-400 transition-transform duration-200 ${
                    isJobOrderDropdownOpen ? 'rotate-180 text-[#0EA5E9]' : ''
                  }`}
                />
              </div>
            </button>

            {/* Popover Dropdown Panel */}
            {isJobOrderDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-full sm:w-96 bg-white rounded-lg shadow-xl border border-slate-200 py-2.5 z-50 animate-in fade-in-50 zoom-in-95 duration-100">
                {/* Search Box inside Dropdown */}
                <div className="px-3 pb-2 border-b border-slate-100">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={jobOrderDropdownSearch}
                      onChange={e => setJobOrderDropdownSearch(e.target.value)}
                      placeholder="Search position, job code, employer..."
                      className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] focus:border-[#0EA5E9] transition-all"
                    />
                    {jobOrderDropdownSearch && (
                      <button
                        onClick={() => setJobOrderDropdownSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Dropdown Tabs: By Position vs By Job Order */}
                <div className="px-3 pt-2 pb-1 flex items-center gap-1 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => setJobOrderDropdownTab('positions')}
                    className={`flex-1 py-1 text-xs font-semibold rounded text-center transition-all cursor-pointer ${
                      jobOrderDropdownTab === 'positions'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Positions ({filteredPositionsForDropdown.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setJobOrderDropdownTab('orders')}
                    className={`flex-1 py-1 text-xs font-semibold rounded text-center transition-all cursor-pointer ${
                      jobOrderDropdownTab === 'orders'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Specific Orders ({filteredJobOrdersForDropdown.length})
                  </button>
                </div>

                {/* Scrollable Options List */}
                <div className="max-h-64 overflow-y-auto px-1 py-1 space-y-0.5 text-xs">
                  {/* All Job Orders Option */}
                  <button
                    type="button"
                    onClick={() => {
                      setJobOrderFilter('all');
                      setIsJobOrderDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded flex items-center justify-between transition-colors cursor-pointer ${
                      jobOrderFilter === 'all'
                        ? 'bg-sky-50 text-[#0284C7] font-bold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Briefcase size={14} className={jobOrderFilter === 'all' ? 'text-[#0EA5E9]' : 'text-slate-400'} />
                      <span>All Job Orders (Baseline Requirements)</span>
                    </div>
                    {jobOrderFilter === 'all' && <Check size={14} className="text-[#0EA5E9] stroke-[2.5]" />}
                  </button>

                  {/* Tab 1: Positions */}
                  {jobOrderDropdownTab === 'positions' && (
                    <>
                      {filteredPositionsForDropdown.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400">
                          No positions match &quot;{jobOrderDropdownSearch}&quot;
                        </div>
                      ) : (
                        filteredPositionsForDropdown.map(pos => {
                          const isSelected = jobOrderFilter.toLowerCase() === pos.toLowerCase();
                          const stats = positionStats.get(pos);
                          return (
                            <button
                              key={pos}
                              type="button"
                              onClick={() => {
                                setJobOrderFilter(pos);
                                setIsJobOrderDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 rounded flex items-center justify-between transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-sky-50 text-[#0284C7] font-bold'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Layers size={13} className={isSelected ? 'text-[#0EA5E9]' : 'text-slate-400'} />
                                <span className="truncate">{pos}</span>
                                {stats && (
                                  <span className="text-[10px] text-slate-400 font-normal">
                                    ({stats.count} {stats.count === 1 ? 'order' : 'orders'})
                                  </span>
                                )}
                              </div>
                              {isSelected && <Check size={14} className="text-[#0EA5E9] stroke-[2.5]" />}
                            </button>
                          );
                        })
                      )}
                    </>
                  )}

                  {/* Tab 2: Specific Job Orders */}
                  {jobOrderDropdownTab === 'orders' && (
                    <>
                      {filteredJobOrdersForDropdown.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400">
                          No job orders match &quot;{jobOrderDropdownSearch}&quot;
                        </div>
                      ) : (
                        filteredJobOrdersForDropdown.map(jo => {
                          const isSelected = jobOrderFilter === String(jo.job_order_id);
                          return (
                            <button
                              key={jo.job_order_id}
                              type="button"
                              onClick={() => {
                                setJobOrderFilter(String(jo.job_order_id));
                                setIsJobOrderDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 rounded flex items-center justify-between transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-sky-50 text-[#0284C7] font-bold'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex flex-col min-w-0 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold truncate text-slate-800">{jo.position}</span>
                                  <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-mono rounded border border-slate-200">
                                    {jo.job_code}
                                  </span>
                                </div>
                                {(jo.employer_name || jo.company_name) && (
                                  <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate mt-0.5">
                                    <Building2 size={11} className="flex-shrink-0" />
                                    <span className="truncate">{jo.employer_name || jo.company_name}</span>
                                  </div>
                                )}
                              </div>
                              {isSelected && <Check size={14} className="text-[#0EA5E9] stroke-[2.5] flex-shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Applicant Type Pills + Clear Controls */}
        <div className="pt-2 border-t border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mr-1">
              <Filter size={13} />
              <span>By Applicant Type:</span>
            </span>

            <button
              onClick={() => setApplicantTypeFilter('all')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                applicantTypeFilter === 'all'
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              All Applicant Types
            </button>
            {applicantTypes.map(t => {
              const active = applicantTypeFilter === t.applicant_type_code;
              const palette = getBadgeColor(t.applicant_type_code);
              return (
                <button
                  key={t.applicant_type_code}
                  onClick={() => setApplicantTypeFilter(t.applicant_type_code)}
                  className="px-3 py-1.5 rounded text-xs font-bold transition-all border cursor-pointer"
                  style={
                    active
                      ? { background: '#0F172A', color: '#fff', borderColor: '#0F172A' }
                      : { background: palette.bg, color: palette.text, borderColor: palette.border }
                  }
                >
                  {t.type_name}
                </button>
              );
            })}
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 font-semibold transition-colors cursor-pointer self-start md:self-auto"
            >
              <RotateCcw size={12} />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>

        {/* Active Filters Summary Strip (Shown when any filter is on) */}
        {hasActiveFilters && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">
              Showing <strong className="text-slate-800">{filtered.length}</strong> of {totalCount} requirements
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Filtered by:</span>

            {searchFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs border border-slate-200">
                <span>Keyword: &quot;{searchFilter}&quot;</span>
                <button onClick={() => setSearchFilter('')} className="hover:text-rose-600 cursor-pointer">
                  <X size={12} />
                </button>
              </span>
            )}

            {applicantTypeFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-50 text-sky-700 rounded text-xs border border-sky-200">
                <span>Type: {applicantTypeNames.get(applicantTypeFilter) || applicantTypeFilter}</span>
                <button onClick={() => setApplicantTypeFilter('all')} className="hover:text-rose-600 cursor-pointer">
                  <X size={12} />
                </button>
              </span>
            )}

            {jobOrderFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs border border-indigo-200">
                <span>Job Order: {selectedJobOrderDisplay}</span>
                <button onClick={() => setJobOrderFilter('all')} className="hover:text-rose-600 cursor-pointer">
                  <X size={12} />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Dynamic Targeting Rule Banner */}
      <div className="bg-sky-50 border border-sky-200 rounded-lg px-4 py-3 flex items-start gap-3 text-sm text-sky-800">
        <AlertCircle size={16} className="text-sky-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed">
          <strong>Dynamic Targeting Rule:</strong> Requirements with no specific applicant types or job orders selected apply to <em>All Job Orders & All Applicants</em> (baseline compliance).
          Drag and drop rows to customize checklist ordering across staff workflows.
        </div>
      </div>

      {/* ── Requirements Table ────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Subheader */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-[#0F172A] text-sm uppercase tracking-wider">
              Document Requirements Catalog
            </h3>
            <span className="px-2 py-0.5 bg-slate-200 text-slate-800 font-bold rounded text-xs">
              {filtered.length} {filtered.length === 1 ? 'Item' : 'Items'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto min-w-full">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-xs text-[#0F172A] uppercase tracking-wider font-black">
                <th className="w-8 px-3 py-3.5" />
                <th className="px-3 py-3.5 w-12 text-slate-400">#</th>
                <th className="px-4 py-3.5 min-w-[200px]">Requirement</th>
                <th className="px-4 py-3.5 min-w-[170px]">Applicant Types</th>
                <th className="px-4 py-3.5 min-w-[200px]">Targeted Job Orders</th>
                <th className="px-3 py-3.5 text-center w-28">Mandatory</th>
                <th className="px-3 py-3.5 text-center w-28">Expiry Track</th>
                <th className="px-3 py-3.5 text-center w-20">Status</th>
                <th className="px-4 py-3.5 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-xs">
              {loading ? (
                <>
                  {[...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-2 py-3 w-8"><Skeleton className="h-4 w-4 mx-auto" /></td>
                      <td className="px-3 py-3 w-8"><Skeleton className="h-3.5 w-6" /></td>
                      <td className="px-4 py-3">
                        <div className="space-y-1.5">
                          <Skeleton className="h-3.5 w-44" />
                          <Skeleton className="h-4 w-14 rounded bg-slate-100" />
                        </div>
                      </td>
                      <td className="px-4 py-3"><SkeletonBadge className="w-20" /></td>
                      <td className="px-4 py-3 min-w-[180px]"><SkeletonBadge className="w-28" /></td>
                      <td className="px-3 py-3 w-28 text-center"><Skeleton className="h-4 w-4 rounded mx-auto" /></td>
                      <td className="px-3 py-3 w-28 text-center"><SkeletonBadge className="w-16 mx-auto" /></td>
                      <td className="px-3 py-3 w-20 text-center"><SkeletonBadge className="w-14 mx-auto" /></td>
                      <td className="px-4 py-3 w-24 text-center"><Skeleton className="h-7 w-16 mx-auto" /></td>
                    </tr>
                  ))}
                </>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                    <div className="max-w-sm mx-auto space-y-2">
                      <p className="font-semibold text-slate-700">No requirements found</p>
                      <p className="text-xs text-slate-400">
                        No document requirements match the selected filters. Change filter options or click "Add Requirement" to create one.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(req => (
                  <tr
                    key={req.id}
                    draggable
                    onDragStart={() => onDragStart(req.id)}
                    onDragOver={e => onDragOver(e, req.id)}
                    onDrop={() => onDrop(req.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setDragOverId(null);
                    }}
                    className={`transition-colors ${
                      dragOverId === req.id
                        ? 'bg-[#0EA5E9]/10 border-t-2 border-[#0EA5E9]'
                        : req.isActive
                        ? 'hover:bg-slate-50/70'
                        : 'opacity-60 bg-slate-50/50'
                    }`}
                  >
                    {/* Drag Handle */}
                    <td className="px-3 py-3 cursor-grab text-slate-300 hover:text-slate-500">
                      <GripVertical size={16} />
                    </td>

                    {/* Sort # */}
                    <td className="px-3 py-3 text-slate-400 font-mono text-xs">
                      {String(req.sortOrder).padStart(2, '0')}
                    </td>

                    {/* Name & Description */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#0F172A] text-sm">{req.name}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                          req.category === 'CERTIFICATION'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : req.category === 'MEDICAL'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : req.category === 'OTHER'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {req.category || 'DOCUMENT'}
                        </span>
                      </div>
                      {req.description && (
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-2 max-w-sm">
                          {req.description}
                        </div>
                      )}
                      {req.expiryTracked && req.validityMonths && (
                        <span className="text-[10px] bg-sky-50 text-[#0284C7] border border-sky-200 px-2 py-0.5 rounded mt-1.5 inline-block font-semibold">
                          Valid for {req.validityMonths} mo ({req.validityMonths * 30} days)
                        </span>
                      )}
                    </td>

                    {/* Applicant Type Badges */}
                    <td className="px-4 py-3">
                      {req.applicantTypes.length === 0 ? (
                        <span className="inline-flex items-center text-[11px] px-2.5 py-0.5 rounded font-bold bg-sky-50 text-sky-700 border border-sky-200">
                          All Applicants
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {req.applicantTypes.map(code => {
                            const label = applicantTypeNames.get(code) || code;
                            const palette = getBadgeColor(code);
                            return (
                              <span
                                key={code}
                                className="text-[10px] px-2 py-0.5 rounded font-bold border"
                                style={{
                                  background: palette.bg,
                                  color: palette.text,
                                  borderColor: palette.border,
                                }}
                              >
                                {label}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    {/* Job Order Badges */}
                    <td className="px-4 py-3">
                      {req.jobOrders.length === 0 ? (
                        <span className="inline-flex items-center text-[11px] px-2.5 py-0.5 rounded font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          All Job Orders (Baseline)
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1 items-center">
                          {req.jobOrders.slice(0, 3).map(id => {
                            const jo = jobOrderMap.get(id);
                            const label = jo ? `${jo.position} (${jo.job_code})` : `Job Order #${id}`;
                            const palette = getBadgeColor(id);
                            return (
                              <span
                                key={id}
                                className="text-[10px] px-2 py-0.5 rounded font-semibold border truncate max-w-[170px]"
                                style={{
                                  background: palette.bg,
                                  color: palette.text,
                                  borderColor: palette.border,
                                }}
                                title={label}
                              >
                                {label}
                              </span>
                            );
                          })}
                          {req.jobOrders.length > 3 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              +{req.jobOrders.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Mandatory */}
                    <td className="px-3 py-3 text-center">
                      {req.isRequired ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                          <CheckCircle2 size={12} /> Mandatory
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          Optional
                        </span>
                      )}
                    </td>

                    {/* Expiry Track */}
                    <td className="px-3 py-3 text-center">
                      {req.expiryTracked ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          <CheckCircle2 size={12} /> Tracked
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Status Toggle */}
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => toggleStatus(req.id)}
                        title={`Click to ${req.isActive ? 'deactivate' : 'activate'}`}
                        className="transition-transform active:scale-95 cursor-pointer"
                      >
                        {req.isActive ? (
                          <ToggleRight size={26} className="text-[#10B981] mx-auto" />
                        ) : (
                          <ToggleLeft size={26} className="text-slate-300 mx-auto" />
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEdit(req)}
                          title="Edit requirement"
                          className="p-1.5 hover:bg-sky-50 hover:text-[#0EA5E9] rounded-md transition-colors text-slate-400 cursor-pointer"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => remove(req.id)}
                          title="Delete requirement"
                          className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-md transition-colors text-slate-400 cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Edit / Add Modal ──────────────────────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl my-8 overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h2 className="font-extrabold text-lg text-[#0F172A]">
                  {isNew ? 'Add Document Requirement' : 'Edit Document Requirement'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure checklist rules, validity, and targeting across overseas job orders.
                </p>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Requirement Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Requirement Name *
                </label>
                <input
                  value={editing.name}
                  onChange={e => setEditing(p => (p ? { ...p, name: e.target.value } : p))}
                  placeholder="e.g. Passport, NBI Clearance, PEOS Certificate, Trade Test"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] focus:border-[#0EA5E9]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Description / Instructions
                </label>
                <textarea
                  value={editing.description}
                  onChange={e => setEditing(p => (p ? { ...p, description: e.target.value } : p))}
                  rows={2}
                  placeholder="Specific requirements, validity guidelines, or notes for recruitment staff..."
                  className="w-full px-3.5 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] focus:border-[#0EA5E9] resize-none"
                />
              </div>

              {/* Category, Compliance & Status Level */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Category *
                  </label>
                  <select
                    value={editing.category || 'DOCUMENT'}
                    onChange={e => setEditing(p => (p ? { ...p, category: e.target.value as any } : p))}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] bg-white font-medium"
                  >
                    <option value="DOCUMENT">Document</option>
                    <option value="CERTIFICATION">Certification</option>
                    <option value="MEDICAL">Medical</option>
                    <option value="OTHER">Other / Clearance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Compliance Requirement
                  </label>
                  <select
                    value={editing.isRequired ? 'required' : 'optional'}
                    onChange={e => setEditing(p => (p ? { ...p, isRequired: e.target.value === 'required' } : p))}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] bg-white font-medium"
                  >
                    <option value="required">Mandatory (Required for deployment)</option>
                    <option value="optional">Optional (Supporting document)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Initial Status
                  </label>
                  <select
                    value={editing.isActive ? 'active' : 'inactive'}
                    onChange={e => setEditing(p => (p ? { ...p, isActive: e.target.value === 'active' } : p))}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] bg-white font-medium"
                  >
                    <option value="active">Active (Visible to staff)</option>
                    <option value="inactive">Inactive (Hidden)</option>
                  </select>
                </div>
              </div>

              {/* Target Applicant Types */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Target Applicant Types
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditing(p => (p ? { ...p, applicantTypes: [] } : p))}
                    className="text-[11px] text-[#0EA5E9] hover:underline font-semibold cursor-pointer"
                  >
                    Apply to All (Baseline)
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Select which applicant types require this document. If none are selected, it applies to <strong>All Applicants</strong>.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditing(p => (p ? { ...p, applicantTypes: [] } : p))}
                    className={`text-xs px-3 py-1.5 rounded border font-semibold transition-all cursor-pointer ${
                      editing.applicantTypes.length === 0
                        ? 'bg-[#0F172A] text-white border-[#0F172A]'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    All Applicants (Baseline)
                  </button>
                  {applicantTypes.map(t => {
                    const selected = editing.applicantTypes.includes(t.applicant_type_code);
                    const palette = getBadgeColor(t.applicant_type_code);
                    return (
                      <button
                        key={t.applicant_type_code}
                        type="button"
                        onClick={() => toggleApplicantType(t.applicant_type_code)}
                        className="text-xs px-3 py-1.5 rounded border font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                        style={
                          selected
                            ? { background: palette.text, color: '#fff', borderColor: palette.text }
                            : { background: palette.bg, color: palette.text, borderColor: palette.border }
                        }
                      >
                        {selected && <Check size={12} className="stroke-[3]" />}
                        <span>{t.type_name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Job Orders (Replacing Job Category) */}
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <Briefcase size={12} className="text-[#0EA5E9]" />
                    <span>Target Job Orders</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditing(p => (p ? { ...p, jobOrders: [] } : p))}
                    className="text-[11px] text-[#0EA5E9] hover:underline font-semibold cursor-pointer"
                  >
                    Apply to All Job Orders (Baseline)
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Select which specific job orders require this document. If none are selected, it applies as a baseline requirement to <strong>All Job Orders</strong>.
                </p>

                {/* Job Order Search inside Modal */}
                <div className="pt-1">
                  <input
                    type="text"
                    value={modalJobOrderSearch}
                    onChange={e => setModalJobOrderSearch(e.target.value)}
                    placeholder="Search job orders by position, job code, or employer..."
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
                  />
                </div>

                {/* Job Order Toggle Buttons */}
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pt-1 pr-1">
                  <button
                    type="button"
                    onClick={() => setEditing(p => (p ? { ...p, jobOrders: [] } : p))}
                    className={`text-xs px-3 py-1.5 rounded border font-semibold transition-all cursor-pointer ${
                      editing.jobOrders.length === 0
                        ? 'bg-[#0F172A] text-white border-[#0F172A]'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    All Job Orders (Baseline)
                  </button>

                  {jobOrders
                    .filter(jo => {
                      if (!modalJobOrderSearch.trim()) return true;
                      const q = modalJobOrderSearch.toLowerCase();
                      return (
                        jo.position.toLowerCase().includes(q) ||
                        jo.job_code.toLowerCase().includes(q) ||
                        (jo.employer_name || '').toLowerCase().includes(q)
                      );
                    })
                    .map(jo => {
                      const selected = editing.jobOrders.includes(jo.job_order_id);
                      const palette = getBadgeColor(jo.job_order_id);
                      return (
                        <button
                          key={jo.job_order_id}
                          type="button"
                          onClick={() => toggleJobOrder(jo.job_order_id)}
                          className="text-xs px-2.5 py-1.5 rounded border font-medium transition-all flex items-center gap-1.5 cursor-pointer max-w-xs truncate"
                          style={
                            selected
                              ? { background: '#0F172A', color: '#fff', borderColor: '#0F172A' }
                              : { background: palette.bg, color: palette.text, borderColor: palette.border }
                          }
                          title={`${jo.position} (${jo.job_code}) - ${jo.employer_name || ''}`}
                        >
                          {selected && <Check size={12} className="stroke-[3]" />}
                          <span className="truncate">
                            {jo.position} ({jo.job_code})
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Expiry Tracking */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editing.expiryTracked}
                    onChange={e => setEditing(p => (p ? { ...p, expiryTracked: e.target.checked } : p))}
                    className="w-4 h-4 rounded text-[#0EA5E9] focus:ring-[#0EA5E9]"
                  />
                  <span className="text-sm font-medium text-slate-800">
                    Track document expiration date
                  </span>
                </label>

                {editing.expiryTracked && (
                  <div className="bg-slate-50 p-3 rounded border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800">Default Document Validity</div>
                      <div className="text-[11px] text-slate-500">How many months this document remains valid</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={editing.validityMonths || 12}
                        onChange={e => setEditing(p => (p ? { ...p, validityMonths: Math.max(1, parseInt(e.target.value) || 1) } : p))}
                        className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-center font-bold bg-white"
                      />
                      <span className="text-xs font-semibold text-slate-600">months</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={isSaving}
                className="flex items-center gap-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-5 py-2 rounded text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>{isNew ? 'Create Requirement' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
