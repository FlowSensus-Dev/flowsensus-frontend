import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, GripVertical, CheckCircle2, XCircle,
  Save, X, ToggleLeft, ToggleRight, AlertCircle, Loader2,
  Check, Filter, ShieldCheck, Tag
} from 'lucide-react';
import { DocumentRequirement, ApplicantTypeLookup, JobCategoryLookup } from '../../types';
import { api } from '../../../lib/api';

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

function getBadgeColor(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
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
  isRequired: true,
  applicantTypes: [],
  jobCategories: [],
  expiryTracked: false,
  validityMonths: 12,
  isActive: true,
};

export default function RequirementsSetup({ showToast, currentUserName }: Props) {
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([]);
  const [applicantTypes, setApplicantTypes] = useState<ApplicantTypeLookup[]>([]);
  const [jobCategories, setJobCategories] = useState<JobCategoryLookup[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [applicantTypeFilter, setApplicantTypeFilter] = useState<string>('all');
  const [jobCategoryFilter, setJobCategoryFilter] = useState<string>('all');

  // Modal State
  const [editing, setEditing] = useState<DocumentRequirement | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Drag and Drop
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // ── Fetch Requirements and Lookups ─────────────────────────────────────────
  const fetchData = async () => {
    try {
      setLoading(true);
      const [reqsRes, appTypesRes, jobCatsRes] = await Promise.allSettled([
        api.get('/requirements'),
        api.get('/lookups/applicant-types'),
        api.get('/lookups/job-categories'),
      ]);

      if (appTypesRes.status === 'fulfilled' && Array.isArray(appTypesRes.value.data)) {
        setApplicantTypes(appTypesRes.value.data);
      }

      if (jobCatsRes.status === 'fulfilled' && Array.isArray(jobCatsRes.value.data)) {
        setJobCategories(jobCatsRes.value.data);
      }

      if (reqsRes.status === 'fulfilled' && Array.isArray(reqsRes.value.data)) {
        const mapped: DocumentRequirement[] = reqsRes.value.data.map((r: any) => {
          const validityDays = r.validity_days || r.validity_period || 365;
          return {
            id: String(r.requirement_id || r.id),
            name: r.requirement_name || r.name || '',
            description: r.description || '',
            isRequired: Boolean(r.default_is_mandatory ?? r.is_required ?? r.isRequired ?? true),
            applicantTypes: Array.isArray(r.applicant_types)
              ? r.applicant_types
              : Array.isArray(r.applicantTypes)
              ? r.applicantTypes
              : [],
            jobCategories: Array.isArray(r.job_categories)
              ? r.job_categories
              : Array.isArray(r.jobCategories)
              ? r.jobCategories
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
  }, []);

  // ── Lookup Name Mappings ───────────────────────────────────────────────────
  const applicantTypeNames = useMemo(() => {
    const map = new Map<string, string>();
    applicantTypes.forEach(t => map.set(t.applicant_type_code, t.type_name));
    return map;
  }, [applicantTypes]);

  const jobCategoryNames = useMemo(() => {
    const map = new Map<string, string>();
    jobCategories.forEach(c => map.set(c.job_category_code, c.category_name));
    return map;
  }, [jobCategories]);

  // ── Filtered Requirements ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return requirements
      .filter(r => {
        // Applicant Type filter:
        // 'all' matches everything. Otherwise matches if requirement has NO targeting (all) or includes code.
        const matchApplicantType =
          applicantTypeFilter === 'all' ||
          r.applicantTypes.length === 0 ||
          r.applicantTypes.includes(applicantTypeFilter);

        // Job Category filter:
        // 'all' matches everything. Otherwise matches if requirement has NO targeting (all) or includes code.
        const matchJobCategory =
          jobCategoryFilter === 'all' ||
          r.jobCategories.length === 0 ||
          r.jobCategories.includes(jobCategoryFilter);

        return matchApplicantType && matchJobCategory;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || Number(a.id) - Number(b.id));
  }, [requirements, applicantTypeFilter, jobCategoryFilter]);

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
      sortOrder: requirements.length + 1,
    });
    setIsNew(true);
  };

  const openEdit = (r: DocumentRequirement) => {
    setEditing({
      ...r,
      applicantTypes: [...(r.applicantTypes || [])],
      jobCategories: [...(r.jobCategories || [])],
    });
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
        isRequired: editing.isRequired,
        validityDays: editing.expiryTracked && editing.validityMonths ? editing.validityMonths * 30 : 365,
        isActive: editing.isActive,
        sortOrder: editing.sortOrder,
        applicantTypes: editing.applicantTypes,
        jobCategories: editing.jobCategories,
      };

      if (isNew) {
        const res = await api.post('/requirements', payload);
        const created = res.data;
        const newReq: DocumentRequirement = {
          ...editing,
          id: String(created.requirement_id || created.id),
          sortOrder: created.sort_order ?? editing.sortOrder,
          applicantTypes: created.applicant_types || editing.applicantTypes,
          jobCategories: created.job_categories || editing.jobCategories,
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
                    applicantTypes: updated.applicant_types || editing.applicantTypes,
                    jobCategories: updated.job_categories || editing.jobCategories,
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
        // revert on failure
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

  const toggleJobCategory = (code: string) => {
    if (!editing) return;
    const current = editing.jobCategories || [];
    const exists = current.includes(code);
    const updated = exists ? current.filter(c => c !== code) : [...current, code];
    setEditing({ ...editing, jobCategories: updated });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Document Requirements Setup</h1>
          <p className="text-slate-500 text-sm mt-1">
            Configure dynamic regulatory and agency document requirements targeted by applicant type and job category.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm shadow-[#0EA5E9]/20"
        >
          <Plus size={16} /> Add Requirement
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Requirements', val: totalCount, color: '#0F172A' },
          { label: 'Active', val: activeCount, color: '#10B981' },
          { label: 'Mandatory', val: mandatoryCount, color: '#EF4444' },
          { label: 'Optional', val: optionalCount, color: '#F59E0B' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4 shadow-xs">
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.val}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Dynamic Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 shadow-xs">
        {/* Applicant Type Filter */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Filter size={13} />
            <span>By Applicant Type</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setApplicantTypeFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                applicantTypeFilter === 'all'
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'bg-slate-50 border border-slate-200 text-slate-600 hover:border-slate-300'
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
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
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
        </div>

        {/* Job Category Filter */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Tag size={13} />
            <span>By Job Category</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setJobCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                jobCategoryFilter === 'all'
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'bg-slate-50 border border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              All Job Categories
            </button>
            {jobCategories.map(c => {
              const active = jobCategoryFilter === c.job_category_code;
              const palette = getBadgeColor(c.job_category_code);
              return (
                <button
                  key={c.job_category_code}
                  onClick={() => setJobCategoryFilter(c.job_category_code)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
                  style={
                    active
                      ? { background: '#0F172A', color: '#fff', borderColor: '#0F172A' }
                      : { background: palette.bg, color: palette.text, borderColor: palette.border }
                  }
                >
                  {c.category_name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Info notice */}
      <div className="bg-sky-50 border border-sky-200 rounded-lg px-4 py-3 flex items-start gap-3 text-sm text-sky-800">
        <AlertCircle size={16} className="text-sky-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed">
          <strong>Dynamic Targeting Rule:</strong> Requirements with no specific applicant types or job categories selected apply to <em>All Applicants</em> (baseline).
          Drag and drop rows to customize checklist ordering across staff workflows.
        </div>
      </div>

      {/* Requirements Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider font-semibold">
                <th className="w-8 px-3 py-3" />
                <th className="px-3 py-3 w-12 text-slate-400">#</th>
                <th className="px-4 py-3 min-w-[200px]">Requirement</th>
                <th className="px-4 py-3 min-w-[180px]">Applicant Types</th>
                <th className="px-4 py-3 min-w-[180px]">Job Categories</th>
                <th className="px-3 py-3 text-center w-24">Mandatory</th>
                <th className="px-3 py-3 text-center w-28">Expiry Track</th>
                <th className="px-3 py-3 text-center w-20">Status</th>
                <th className="px-4 py-3 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-14 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 text-[#0EA5E9] animate-spin mb-3" />
                      <p className="text-slate-500 text-sm font-medium">Loading requirements catalog...</p>
                    </div>
                  </td>
                </tr>
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
                      <div className="font-semibold text-slate-800">{req.name}</div>
                      {req.description && (
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-2 max-w-sm">
                          {req.description}
                        </div>
                      )}
                      {req.expiryTracked && req.validityMonths && (
                        <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full mt-1.5 inline-block font-medium">
                          Valid for {req.validityMonths} mo ({req.validityMonths * 30} days)
                        </span>
                      )}
                    </td>

                    {/* Applicant Type Badges */}
                    <td className="px-4 py-3">
                      {req.applicantTypes.length === 0 ? (
                        <span className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-medium bg-sky-50 text-sky-700 border border-sky-200">
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
                                className="text-[11px] px-2 py-0.5 rounded-full font-medium border"
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

                    {/* Job Category Badges */}
                    <td className="px-4 py-3">
                      {req.jobCategories.length === 0 ? (
                        <span className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          All Jobs
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {req.jobCategories.map(code => {
                            const label = jobCategoryNames.get(code) || code;
                            const palette = getBadgeColor(code);
                            return (
                              <span
                                key={code}
                                className="text-[11px] px-2 py-0.5 rounded-full font-medium border"
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

                    {/* Mandatory */}
                    <td className="px-3 py-3 text-center">
                      {req.isRequired ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={12} /> Mandatory
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          Optional
                        </span>
                      )}
                    </td>

                    {/* Expiry Track */}
                    <td className="px-3 py-3 text-center">
                      {req.expiryTracked ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
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
                          className="p-1.5 hover:bg-sky-50 hover:text-[#0EA5E9] rounded-md transition-colors text-slate-400"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => remove(req.id)}
                          title="Delete requirement"
                          className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-md transition-colors text-slate-400"
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

      {/* Edit / Add Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl my-8 overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
              <div>
                <h2 className="font-bold text-lg text-slate-900">
                  {isNew ? 'Add Document Requirement' : 'Edit Document Requirement'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure checklist rules and targeting across overseas applicant workflows.
                </p>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
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
                  placeholder="e.g. Passport, NBI Clearance, PEOS Certificate"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/30 focus:border-[#0EA5E9]"
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
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/30 focus:border-[#0EA5E9] resize-none"
                />
              </div>

              {/* Requirement Level (Mandatory vs Optional) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Compliance Requirement
                  </label>
                  <select
                    value={editing.isRequired ? 'required' : 'optional'}
                    onChange={e => setEditing(p => (p ? { ...p, isRequired: e.target.value === 'required' } : p))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/30 bg-white"
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/30 bg-white"
                  >
                    <option value="active">Active (Visible to staff)</option>
                    <option value="inactive">Inactive (Hidden)</option>
                  </select>
                </div>
              </div>

              {/* Applicant Type Targeting */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Target Applicant Types
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditing(p => (p ? { ...p, applicantTypes: [] } : p))}
                    className="text-[11px] text-[#0EA5E9] hover:underline font-medium"
                  >
                    Apply to All (Baseline)
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Select which applicant types require this document. If none are selected, it applies to <strong>All Applicants</strong>.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditing(p => (p ? { ...p, applicantTypes: [] } : p))}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
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
                        className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-all flex items-center gap-1.5"
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

              {/* Job Category Targeting */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Target Job Categories
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditing(p => (p ? { ...p, jobCategories: [] } : p))}
                    className="text-[11px] text-[#0EA5E9] hover:underline font-medium"
                  >
                    Apply to All Jobs
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Select which job categories require this document. If none are selected, it applies to <strong>All Job Categories</strong>.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditing(p => (p ? { ...p, jobCategories: [] } : p))}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                      editing.jobCategories.length === 0
                        ? 'bg-[#0F172A] text-white border-[#0F172A]'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    All Jobs
                  </button>
                  {jobCategories.map(c => {
                    const selected = editing.jobCategories.includes(c.job_category_code);
                    const palette = getBadgeColor(c.job_category_code);
                    return (
                      <button
                        key={c.job_category_code}
                        type="button"
                        onClick={() => toggleJobCategory(c.job_category_code)}
                        className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-all flex items-center gap-1.5"
                        style={
                          selected
                            ? { background: palette.text, color: '#fff', borderColor: palette.text }
                            : { background: palette.bg, color: palette.text, borderColor: palette.border }
                        }
                      >
                        {selected && <Check size={12} className="stroke-[3]" />}
                        <span>{c.category_name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Expiry Tracking */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
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
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-700">Validity Period</div>
                      <div className="text-xs text-slate-500">How long is this document typically valid?</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={editing.validityMonths || ''}
                        onChange={e =>
                          setEditing(p =>
                            p ? { ...p, validityMonths: Math.max(1, parseInt(e.target.value) || 1) } : p
                          )
                        }
                        className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/30 bg-white"
                      />
                      <span className="text-xs text-slate-500">months</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors shadow-sm shadow-[#0EA5E9]/20"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{isNew ? 'Adding...' : 'Saving...'}</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>{isNew ? 'Add Requirement' : 'Save Changes'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
