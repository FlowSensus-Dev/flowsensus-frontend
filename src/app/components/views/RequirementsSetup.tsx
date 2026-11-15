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

  // Delete confirmation dialog
  const [deleteTarget, setDeleteTarget] = useState<DocumentRequirement | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Opens the in-app confirmation dialog; nothing is deleted until the user confirms
  const remove = (id: string) => {
    const req = requirements.find(r => r.id === id);
    if (!req) return;

    setDeleteTarget(req);
  };

  const confirmDelete = async () => {
    const req = deleteTarget;
    if (!req || isDeleting) return;
    const id = req.id;
    setIsDeleting(true);
    try {
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
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
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

  const inactiveCount = totalCount - activeCount;

  // ── Plain-language descriptions for table cells ────────────────────────────
  const describeApplicants = (r: DocumentRequirement) => {
    if (r.applicantTypes.length === 0) return 'Everyone';
    const names = r.applicantTypes.map(c => applicantTypeNames.get(c) || c);
    return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
  };

  const jobLabel = (id: number) => {
    const jo = jobOrderMap.get(id);
    return jo ? `${jo.position} (${jo.job_code})` : `Job order #${id}`;
  };

  const describeJobs = (r: DocumentRequirement) => {
    if (r.jobOrders.length === 0) return 'All jobs';
    if (r.jobOrders.length === 1) return jobLabel(r.jobOrders[0]);
    return `${r.jobOrders.length} specific jobs`;
  };

  const categoryLabel = (c?: string) =>
    c === 'CERTIFICATION' ? 'Certificate' : c === 'MEDICAL' ? 'Medical' : c === 'OTHER' ? 'Clearance / Other' : 'Document';

  const filteredModalJobOrders = editing
    ? jobOrders.filter(jo => {
        const q = modalJobOrderSearch.trim().toLowerCase();
        if (!q) return true;
        return (
          jo.position.toLowerCase().includes(q) ||
          jo.job_code.toLowerCase().includes(q) ||
          (jo.employer_name || '').toLowerCase().includes(q)
        );
      })
    : [];

  return (
    <div className="w-full max-w-full space-y-5 pb-12">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-slate-200/90">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Document Requirements</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-white font-mono">
              {totalCount}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Choose which documents applicants need to submit, and who each one applies to.
          </p>
          {!loading && totalCount > 0 && (
            <p className="text-xs text-slate-400 mt-1.5">
              <span className="text-slate-600 font-semibold">{mandatoryCount}</span> required
              {' · '}
              <span className="text-slate-600 font-semibold">{optionalCount}</span> optional
              {inactiveCount > 0 && (
                <>
                  {' · '}
                  <span className="text-slate-600 font-semibold">{inactiveCount}</span> turned off
                </>
              )}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={openNew}
          className="flex items-center gap-1.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer self-start"
        >
          <Plus size={14} /> Add requirement
        </button>
      </div>

      {/* ── Filters (one calm row) ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            placeholder="Search requirements..."
            className="pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 shadow-2xs w-56 sm:w-64 transition-all"
          />
          {searchFilter && (
            <button
              type="button"
              onClick={() => setSearchFilter('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Applicant type */}
        <div className="relative">
          <select
            value={applicantTypeFilter}
            onChange={e => setApplicantTypeFilter(e.target.value)}
            className={`appearance-none pl-3 pr-8 py-1.5 border rounded-lg text-xs font-semibold shadow-2xs cursor-pointer focus:outline-none transition-colors ${
              applicantTypeFilter !== 'all'
                ? 'bg-[#0F172A] text-white border-[#0F172A]'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <option value="all">Applicant: Everyone</option>
            {applicantTypes.map(t => (
              <option key={t.applicant_type_code} value={t.applicant_type_code}>
                Applicant: {t.type_name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${
              applicantTypeFilter !== 'all' ? 'text-slate-300' : 'text-slate-400'
            }`}
          />
        </div>

        {/* Job order / position */}
        <div ref={jobOrderDropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setIsJobOrderDropdownOpen(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer shadow-2xs max-w-[260px] ${
              jobOrderFilter !== 'all'
                ? 'bg-[#0F172A] text-white border-[#0F172A]'
                : isJobOrderDropdownOpen
                ? 'bg-slate-50 text-slate-900 border-slate-300'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            <span className={`font-normal ${jobOrderFilter !== 'all' ? 'text-slate-300' : 'text-slate-400'}`}>Job:</span>
            <span className="truncate">{jobOrderFilter === 'all' ? 'All jobs' : selectedJobOrderDisplay.replace(/^Position: /, '')}</span>
            <ChevronDown
              size={14}
              className={`flex-shrink-0 transition-transform duration-150 ${
                jobOrderFilter !== 'all' ? 'text-slate-300' : 'text-slate-400'
              } ${isJobOrderDropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isJobOrderDropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-80 bg-white rounded-xl shadow-xl border border-slate-200/90 py-2 z-40 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 pb-2">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={jobOrderDropdownSearch}
                    onChange={e => setJobOrderDropdownSearch(e.target.value)}
                    placeholder="Search by position, code or employer..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div className="px-3 pb-2 flex items-center gap-1">
                {(['positions', 'orders'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setJobOrderDropdownTab(tab)}
                    className={`flex-1 py-1 text-[11px] font-semibold rounded-md text-center transition-colors cursor-pointer ${
                      jobOrderDropdownTab === tab
                        ? 'bg-slate-100 text-[#0F172A]'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab === 'positions'
                      ? `By position (${filteredPositionsForDropdown.length})`
                      : `By job order (${filteredJobOrdersForDropdown.length})`}
                  </button>
                ))}
              </div>

              <div className="max-h-64 overflow-y-auto border-t border-slate-100 pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setJobOrderFilter('all');
                    setIsJobOrderDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2 text-left transition-colors cursor-pointer ${
                    jobOrderFilter === 'all' ? 'bg-slate-100 text-[#0F172A] font-semibold' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>All jobs</span>
                  {jobOrderFilter === 'all' && <Check size={13} className="text-[#0EA5E9]" />}
                </button>

                {jobOrderDropdownTab === 'positions' &&
                  (filteredPositionsForDropdown.length === 0 ? (
                    <div className="py-6 text-center text-slate-400">No positions found</div>
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
                          className={`w-full flex items-center justify-between px-4 py-2 text-left transition-colors cursor-pointer ${
                            isSelected ? 'bg-slate-100 text-[#0F172A] font-semibold' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="truncate">
                            {pos}
                            {stats && <span className="text-slate-400 font-normal"> · {stats.count}</span>}
                          </span>
                          {isSelected && <Check size={13} className="text-[#0EA5E9] flex-shrink-0" />}
                        </button>
                      );
                    })
                  ))}

                {jobOrderDropdownTab === 'orders' &&
                  (filteredJobOrdersForDropdown.length === 0 ? (
                    <div className="py-6 text-center text-slate-400">No job orders found</div>
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
                          className={`w-full flex items-center justify-between px-4 py-2 text-left transition-colors cursor-pointer ${
                            isSelected ? 'bg-slate-100 text-[#0F172A] font-semibold' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="truncate">{jo.position}</div>
                            <div className="text-[11px] text-slate-400 font-normal truncate">
                              {jo.job_code}
                              {(jo.employer_name || jo.company_name) && ` · ${jo.employer_name || jo.company_name}`}
                            </div>
                          </div>
                          {isSelected && <Check size={13} className="text-[#0EA5E9] flex-shrink-0 ml-2" />}
                        </button>
                      );
                    })
                  ))}
              </div>
            </div>
          )}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100 cursor-pointer"
          >
            ✕ Clear filters
          </button>
        )}
      </div>

      {/* ── Requirements list ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="w-8 py-3 pl-4" />
                <th className="py-3 px-4 min-w-[220px]">Requirement</th>
                <th className="py-3 px-4 text-center min-w-[200px]">Who needs it</th>
                <th className="py-3 px-4 text-center w-28">Required</th>
                <th className="py-3 px-4 text-center w-32">Valid for</th>
                <th className="py-3 px-4 text-center w-24">In use</th>
                <th className="py-3 px-4 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="py-4 pl-4"><Skeleton className="h-4 w-4" /></td>
                    <td className="py-4 px-4">
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-44" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </td>
                    <td className="py-4 px-4"><Skeleton className="h-3.5 w-32 mx-auto" /></td>
                    <td className="py-4 px-4"><Skeleton className="h-3.5 w-14 mx-auto" /></td>
                    <td className="py-4 px-4"><Skeleton className="h-3.5 w-16 mx-auto" /></td>
                    <td className="py-4 px-4"><Skeleton className="h-5 w-9 mx-auto rounded-full" /></td>
                    <td className="py-4 px-4"><Skeleton className="h-6 w-14 mx-auto" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center">
                    <div className="max-w-sm mx-auto space-y-1.5">
                      <p className="text-sm font-semibold text-slate-700">
                        {hasActiveFilters ? 'No requirements match your filters' : 'No requirements yet'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {hasActiveFilters
                          ? 'Try a different search, or clear the filters to see everything.'
                          : 'Add your first requirement to start building the applicant checklist.'}
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="mt-2 text-xs font-semibold text-[#0EA5E9] hover:underline cursor-pointer"
                        >
                          Clear filters
                        </button>
                      )}
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
                    className={`group transition-colors ${
                      dragOverId === req.id
                        ? 'bg-sky-50 shadow-[inset_0_2px_0_0_#0EA5E9]'
                        : 'hover:bg-slate-50/70'
                    } ${req.isActive ? '' : 'bg-slate-50/50'}`}
                  >
                    {/* Drag handle (visible on hover) */}
                    <td className="py-3.5 pl-4 w-8 align-middle">
                      <GripVertical
                        size={14}
                        className="text-slate-300 opacity-0 group-hover:opacity-100 cursor-grab transition-opacity"
                      />
                    </td>

                    {/* Requirement */}
                    <td className={`py-3.5 px-4 ${req.isActive ? '' : 'opacity-60'}`}>
                      <div className="font-semibold text-[#0F172A] text-[13.5px]">{req.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{categoryLabel(req.category)}</div>
                      {req.description && (
                        <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 max-w-md" title={req.description}>
                          {req.description}
                        </div>
                      )}
                    </td>

                    {/* Who needs it */}
                    <td className={`py-3.5 px-4 text-center ${req.isActive ? '' : 'opacity-60'}`}>
                      <div className="font-medium text-slate-700 text-xs">{describeApplicants(req)}</div>
                      <div
                        className="text-[11px] text-slate-400 mt-0.5"
                        title={req.jobOrders.length > 0 ? req.jobOrders.map(jobLabel).join('\n') : undefined}
                      >
                        {describeJobs(req)}
                      </div>
                    </td>

                    {/* Required */}
                    <td className={`py-3.5 px-4 text-center whitespace-nowrap ${req.isActive ? '' : 'opacity-60'}`}>
                      {req.isRequired ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Required
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          Optional
                        </span>
                      )}
                    </td>

                    {/* Valid for */}
                    <td className={`py-3.5 px-4 text-center whitespace-nowrap text-xs text-slate-600 ${req.isActive ? '' : 'opacity-60'}`}>
                      {req.expiryTracked && req.validityMonths
                        ? `${req.validityMonths} ${req.validityMonths === 1 ? 'month' : 'months'}`
                        : <span className="text-slate-400">No expiry</span>}
                    </td>

                    {/* In use switch */}
                    <td className="py-3.5 px-4 text-center">
                      <Switch
                        checked={req.isActive}
                        onChange={() => toggleStatus(req.id)}
                        label={req.isActive ? `Turn off ${req.name}` : `Turn on ${req.name}`}
                      />
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => openEdit(req)}
                          title="Edit"
                          className="p-1.5 hover:bg-slate-100 hover:text-[#0F172A] rounded-md transition-colors text-slate-400 cursor-pointer"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(req.id)}
                          title="Delete"
                          className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-md transition-colors text-slate-400 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 text-[11px] text-slate-400">
            Showing {filtered.length} of {totalCount}. Drag a row by its handle to change the order staff see.
            Requirements with no specific group apply to everyone.
          </div>
        )}
      </div>

      {/* ── Add / Edit requirement ──────────────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl my-8 overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-lg text-[#0F172A]">
                  {isNew ? 'Add requirement' : 'Edit requirement'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set what applicants need to submit and who it applies to.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Basics */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Name</label>
                  <input
                    value={editing.name}
                    onChange={e => setEditing(p => (p ? { ...p, name: e.target.value } : p))}
                    placeholder="e.g. NBI Clearance"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Instructions <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    value={editing.description}
                    onChange={e => setEditing(p => (p ? { ...p, description: e.target.value } : p))}
                    rows={2}
                    placeholder="Anything staff or applicants should know about this document"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 resize-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Type</label>
                    <select
                      value={editing.category || 'DOCUMENT'}
                      onChange={e => setEditing(p => (p ? { ...p, category: e.target.value as any } : p))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-slate-400"
                    >
                      <option value="DOCUMENT">Document</option>
                      <option value="CERTIFICATION">Certificate</option>
                      <option value="MEDICAL">Medical</option>
                      <option value="OTHER">Clearance / Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Is it required?</label>
                    <div className="inline-flex w-full items-center bg-slate-100 border border-slate-200/80 rounded-lg p-0.5">
                      {[
                        { v: true, label: 'Required' },
                        { v: false, label: 'Optional' },
                      ].map(opt => (
                        <button
                          key={String(opt.v)}
                          type="button"
                          onClick={() => setEditing(p => (p ? { ...p, isRequired: opt.v } : p))}
                          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                            editing.isRequired === opt.v
                              ? 'bg-white text-[#0F172A] shadow-2xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Who needs it */}
              <div className="pt-5 border-t border-slate-100 space-y-2.5">
                <div>
                  <div className="text-xs font-semibold text-slate-700">Which applicants need this?</div>
                  <p className="text-xs text-slate-400 mt-0.5">Pick one or more. Leave on “Everyone” if it applies to all.</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditing(p => (p ? { ...p, applicantTypes: [] } : p))}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
                      editing.applicantTypes.length === 0
                        ? 'bg-[#0F172A] text-white border-[#0F172A]'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Everyone
                  </button>
                  {applicantTypes.map(t => {
                    const selected = editing.applicantTypes.includes(t.applicant_type_code);
                    return (
                      <button
                        key={t.applicant_type_code}
                        type="button"
                        onClick={() => toggleApplicantType(t.applicant_type_code)}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                          selected
                            ? 'bg-[#0F172A] text-white border-[#0F172A]'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {selected && <Check size={12} className="stroke-[3]" />}
                        <span>{t.type_name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Which jobs */}
              <div className="pt-5 border-t border-slate-100 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-700">Which jobs need this?</div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {editing.jobOrders.length === 0
                        ? 'Applies to all jobs. Tick specific jobs below to narrow it down.'
                        : `${editing.jobOrders.length} ${editing.jobOrders.length === 1 ? 'job' : 'jobs'} selected.`}
                    </p>
                  </div>
                  {editing.jobOrders.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setEditing(p => (p ? { ...p, jobOrders: [] } : p))}
                      className="text-xs font-semibold text-[#0EA5E9] hover:underline cursor-pointer flex-shrink-0"
                    >
                      Apply to all jobs
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={modalJobOrderSearch}
                    onChange={e => setModalJobOrderSearch(e.target.value)}
                    placeholder="Search by position, code or employer..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-400"
                  />
                </div>

                <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {filteredModalJobOrders.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">No jobs found</div>
                  ) : (
                    filteredModalJobOrders.map(jo => {
                      const selected = editing.jobOrders.includes(jo.job_order_id);
                      return (
                        <label
                          key={jo.job_order_id}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                            selected ? 'bg-slate-50' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleJobOrder(jo.job_order_id)}
                            className="w-4 h-4 rounded border-slate-300 text-[#0EA5E9] focus:ring-[#0EA5E9]"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-800 truncate">{jo.position}</div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {jo.job_code}
                              {jo.employer_name && ` · ${jo.employer_name}`}
                            </div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Expiry + status */}
              <div className="pt-5 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold text-slate-700">This document expires</div>
                    <p className="text-xs text-slate-400 mt-0.5">We'll flag it when it's about to run out.</p>
                  </div>
                  <Switch
                    checked={editing.expiryTracked}
                    onChange={() => setEditing(p => (p ? { ...p, expiryTracked: !p.expiryTracked } : p))}
                    label="This document expires"
                  />
                </div>

                {editing.expiryTracked && (
                  <div className="flex items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                    <div className="text-xs text-slate-600">Valid for</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={editing.validityMonths || 12}
                        onChange={e =>
                          setEditing(p => (p ? { ...p, validityMonths: Math.max(1, parseInt(e.target.value) || 1) } : p))
                        }
                        className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-sm text-center font-semibold bg-white focus:outline-none focus:border-slate-400"
                      />
                      <span className="text-xs text-slate-600">months</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold text-slate-700">Show to staff</div>
                    <p className="text-xs text-slate-400 mt-0.5">Turn off to hide it without deleting.</p>
                  </div>
                  <Switch
                    checked={editing.isActive}
                    onChange={() => setEditing(p => (p ? { ...p, isActive: !p.isActive } : p))}
                    label="Show to staff"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={isSaving}
                className="flex items-center gap-1.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                <span>{isNew ? 'Add requirement' : 'Save changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ─────────────────────────────────────────── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-xs z-[60] flex items-center justify-center p-4"
          onClick={() => !isDeleting && setDeleteTarget(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-requirement-title"
            className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} />
              </div>
              <div className="min-w-0">
                <h2 id="delete-requirement-title" className="font-bold text-base text-[#0F172A]">
                  Delete this requirement?
                </h2>
                <p className="text-sm text-slate-600 mt-1.5">
                  <span className="font-semibold text-[#0F172A]">{deleteTarget.name}</span> will be removed from the
                  checklist for all applicants and jobs. This can't be undone.
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  Just want to hide it for now? Turn off "In use" instead and keep it for later.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                autoFocus
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
              >
                {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>{isDeleting ? 'Deleting...' : 'Yes, delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors cursor-pointer ${
        checked ? 'bg-[#10B981]' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
