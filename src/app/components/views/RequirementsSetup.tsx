import { useState } from 'react';
import {
  Plus, Pencil, Trash2, GripVertical, CheckCircle2, XCircle,
  FileText, Globe, Users, Star, Save, X, ToggleLeft, ToggleRight, AlertCircle
} from 'lucide-react';
import { DocumentRequirement, JOB_TYPE_OPTIONS, JobTypeValue } from '../../types';

const APPLIES_TO_LABELS: Record<DocumentRequirement['appliesTo'], string> = {
  all: 'All Applicants',
  new_ofw: 'First-Time OFW',
  returning_ofw: 'Returning OFW',
  muslim: 'Muslim Applicants',
};

const APPLIES_TO_COLORS: Record<DocumentRequirement['appliesTo'], string> = {
  all: '#0EA5E9',
  new_ofw: '#10B981',
  returning_ofw: '#8B5CF6',
  muslim: '#F59E0B',
};

const DEFAULT_REQUIREMENTS: DocumentRequirement[] = [
  { id: 'req-001', name: 'Valid Passport', description: 'Original Philippine passport with at least 6 months validity from departure date.', isRequired: true, appliesTo: 'all', applicableJobTypes: ['all'], expiryTracked: true, validityMonths: 12, sortOrder: 1, isActive: true },
  { id: 'req-002', name: 'NBI Clearance', description: 'National Bureau of Investigation clearance issued within the last 6 months. Strictly mandatory for domestic work.', isRequired: true, appliesTo: 'all', applicableJobTypes: ['all'], expiryTracked: true, validityMonths: 6, sortOrder: 2, isActive: true },
  { id: 'req-003', name: 'DMW e-Registration', description: 'Online registration with the Department of Migrant Workers portal (formerly OWWA/POEA).', isRequired: true, appliesTo: 'all', applicableJobTypes: ['all'], expiryTracked: false, sortOrder: 3, isActive: true },
  { id: 'req-004', name: 'PEOS Certificate', description: 'Pre-Employment Orientation Seminar certificate. Strict requirement for first-time OFWs.', isRequired: true, appliesTo: 'new_ofw', applicableJobTypes: ['all'], expiryTracked: true, validityMonths: 12, sortOrder: 4, isActive: true },
  { id: 'req-005', name: 'OFW Information Sheet', description: 'Completed OFW Information Sheet form (POEA Form 201) for returning OFWs.', isRequired: true, appliesTo: 'returning_ofw', applicableJobTypes: ['all'], expiryTracked: false, sortOrder: 5, isActive: true },
  { id: 'req-006', name: 'OMA Certificate', description: 'Office of Muslim Affairs Certificate of Good Standing.', isRequired: true, appliesTo: 'muslim', applicableJobTypes: ['all'], expiryTracked: true, validityMonths: 12, sortOrder: 6, isActive: true },
  { id: 'req-007', name: 'Medical Certificate (DOH-accredited)', description: 'Pre-employment medical examination from a DOH-accredited POEA clinic. Sea-based PEME follows different protocols.', isRequired: true, appliesTo: 'all', applicableJobTypes: ['all'], expiryTracked: true, validityMonths: 3, sortOrder: 7, isActive: true },
  { id: 'req-008', name: 'Birth Certificate (PSA)', description: 'Philippine Statistics Authority-authenticated birth certificate.', isRequired: true, appliesTo: 'all', applicableJobTypes: ['all'], expiryTracked: false, sortOrder: 8, isActive: true },
  // Professional
  { id: 'req-009', name: 'PRC License / ID', description: 'Mandatory proof of passing the Philippine licensure exams for regulated professions (Nursing, Engineering, Teaching, etc.).', isRequired: true, appliesTo: 'all', applicableJobTypes: ['professional'], expiryTracked: true, validityMonths: 36, sortOrder: 9, isActive: true },
  { id: 'req-010', name: 'Board Rating Certificate', description: 'Frequently requested by foreign employers to verify actual licensure exam scores.', isRequired: false, appliesTo: 'all', applicableJobTypes: ['professional'], expiryTracked: false, sortOrder: 10, isActive: true },
  { id: 'req-011', name: 'Transcript of Records & Diploma (Apostilled)', description: 'Apostille (formerly "Red Ribbon") from the DFA required for deployment. Healthcare workers often also need IELTS/OET, NCLEX, or Prometric/HAAD.', isRequired: true, appliesTo: 'all', applicableJobTypes: ['professional'], expiryTracked: false, sortOrder: 11, isActive: true },
  // Skilled / Technical
  { id: 'req-012', name: 'TESDA National Certificate (NC II / NC III)', description: 'Certification level must map directly to the job order (e.g., NC II - Shielded Metal Arc Welding).', isRequired: true, appliesTo: 'all', applicableJobTypes: ['skilled'], expiryTracked: false, sortOrder: 12, isActive: true },
  { id: 'req-013', name: 'Trade Test Certificate', description: 'Issued by accredited third-party assessment centers to verify practical, hands-on skills.', isRequired: false, appliesTo: 'all', applicableJobTypes: ['skilled'], expiryTracked: false, sortOrder: 13, isActive: true },
  // Household Service Workers
  { id: 'req-014', name: 'TESDA NC II for Domestic Work', description: 'Strict DMW requirement prior to processing for Household Service Worker roles.', isRequired: true, appliesTo: 'all', applicableJobTypes: ['hsw'], expiryTracked: false, sortOrder: 14, isActive: true },
  { id: 'req-015', name: 'CPDEP Certificate', description: 'Comprehensive Pre-Departure Education Program — specialized seminar distinct from standard PDOS, required for HSWs.', isRequired: true, appliesTo: 'all', applicableJobTypes: ['hsw'], expiryTracked: true, validityMonths: 12, sortOrder: 15, isActive: true },
  // Sea-Based
  { id: 'req-016', name: "SIRB / Seaman's Book", description: "The Seafarer's Identification and Record Book (SIRB) is fundamental for any maritime deployment.", isRequired: true, appliesTo: 'all', applicableJobTypes: ['sea_based'], expiryTracked: true, validityMonths: 60, sortOrder: 16, isActive: true },
  { id: 'req-017', name: 'STCW Certificates', description: 'Standards of Training, Certification and Watchkeeping — includes Basic Safety Training and role-specific STCW certifications.', isRequired: true, appliesTo: 'all', applicableJobTypes: ['sea_based'], expiryTracked: true, validityMonths: 60, sortOrder: 17, isActive: true },
  { id: 'req-018', name: 'Sea-Based PEME', description: 'Pre-Employment Medical Examination for seafarers — follows stricter protocols than standard land-based DOH medicals.', isRequired: true, appliesTo: 'all', applicableJobTypes: ['sea_based'], expiryTracked: true, validityMonths: 12, sortOrder: 18, isActive: true },
  // Drivers
  { id: 'req-019', name: 'LTO Professional Driver\'s License', description: 'Restriction codes must legally match the weight and class of vehicle to be operated overseas.', isRequired: true, appliesTo: 'all', applicableJobTypes: ['driver'], expiryTracked: true, validityMonths: 36, sortOrder: 19, isActive: true },
  { id: 'req-020', name: 'International Driving Permit (IDP)', description: 'Required by some destination countries. Issued by AAP/LTO based on valid Philippine license.', isRequired: false, appliesTo: 'all', applicableJobTypes: ['driver'], expiryTracked: true, validityMonths: 12, sortOrder: 20, isActive: true },
];

const BLANK_REQ: Omit<DocumentRequirement, 'id' | 'sortOrder'> = {
  name: '', description: '', isRequired: true, appliesTo: 'all', applicableJobTypes: ['all'], expiryTracked: false, validityMonths: undefined, isActive: true,
};

const JOB_TYPE_COLORS: Record<JobTypeValue, string> = {
  all:          '#0EA5E9',
  professional: '#8B5CF6',
  skilled:      '#F59E0B',
  hsw:          '#EC4899',
  sea_based:    '#0EA5E9',
  driver:       '#10B981',
};

interface Props {
  showToast: (msg: string) => void;
  currentUserName: string;
}

export default function RequirementsSetup({ showToast, currentUserName }: Props) {
  const [requirements, setRequirements] = useState<DocumentRequirement[]>(DEFAULT_REQUIREMENTS);
  const [editing, setEditing] = useState<DocumentRequirement | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [filter, setFilter] = useState<'all' | DocumentRequirement['appliesTo']>('all');
  const [jobTypeFilter, setJobTypeFilter] = useState<JobTypeValue | 'all'>('all');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const filtered = requirements
    .filter(r => {
      const matchAppliesTo = filter === 'all' || r.appliesTo === filter;
      const matchJobType = jobTypeFilter === 'all' || r.applicableJobTypes.includes(jobTypeFilter) || r.applicableJobTypes.includes('all');
      return matchAppliesTo && matchJobType;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const openNew = () => {
    setEditing({ ...BLANK_REQ, id: `req-${Date.now()}`, sortOrder: requirements.length + 1 });
    setIsNew(true);
  };

  const openEdit = (r: DocumentRequirement) => { setEditing({ ...r }); setIsNew(false); };

  const save = () => {
    if (!editing) return;
    if (!editing.name.trim()) { showToast('Requirement name is required'); return; }
    if (isNew) {
      setRequirements(prev => [...prev, editing]);
    } else {
      setRequirements(prev => prev.map(r => r.id === editing.id ? editing : r));
    }
    showToast(`"${editing.name}" ${isNew ? 'added' : 'updated'} successfully`);
    setEditing(null);
  };

  const remove = (id: string) => {
    const req = requirements.find(r => r.id === id);
    setRequirements(prev => prev.filter(r => r.id !== id));
    showToast(`"${req?.name}" removed`);
  };

  const toggle = (id: string) => {
    setRequirements(prev => prev.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r));
  };

  // drag-and-drop reorder
  const onDragStart = (id: string) => setDragId(id);
  const onDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverId(id); };
  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    const items = [...requirements].sort((a, b) => a.sortOrder - b.sortOrder);
    const fromIdx = items.findIndex(r => r.id === dragId);
    const toIdx = items.findIndex(r => r.id === targetId);
    const reordered = [...items];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setRequirements(reordered.map((r, i) => ({ ...r, sortOrder: i + 1 })));
    setDragId(null);
    setDragOverId(null);
  };

  const activeCount = requirements.filter(r => r.isActive).length;
  const requiredCount = requirements.filter(r => r.isRequired && r.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Document Requirements Setup</h1>
          <p className="text-slate-500 text-sm mt-1">
            Configure the employment document checklist that Recruitment staff must verify for each applicant.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus size={16} /> Add Requirement
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Requirements', val: requirements.length, color: '#0F172A' },
          { label: 'Active', val: activeCount, color: '#10B981' },
          { label: 'Mandatory', val: requiredCount, color: '#EF4444' },
          { label: 'Optional', val: activeCount - requiredCount, color: '#F59E0B' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4">
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.val}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Applicant type filter */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">By Applicant Type</p>
        <div className="flex flex-wrap gap-2">
          {(['all', 'all', 'new_ofw', 'returning_ofw', 'muslim'] as const).filter((v, i, arr) => arr.indexOf(v) === i).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f ? 'bg-[#0F172A] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {f === 'all' ? 'All Applicant Types' : APPLIES_TO_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Job type filter */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">By Job Type</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setJobTypeFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${jobTypeFilter === 'all' ? 'bg-[#0F172A] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'}`}
          >
            All Job Types
          </button>
          {JOB_TYPE_OPTIONS.slice(1).map(jt => (
            <button
              key={jt.value}
              onClick={() => setJobTypeFilter(jt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border`}
              style={jobTypeFilter === jt.value
                ? { background: JOB_TYPE_COLORS[jt.value], color: '#fff', borderColor: JOB_TYPE_COLORS[jt.value] }
                : { background: '#fff', color: '#475569', borderColor: '#e2e8f0' }
              }
            >
              {jt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3 text-sm text-amber-700">
        <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
        <span>
          Drag rows to reorder. Recruitment staff will see these requirements in this exact order as a checklist on each applicant's registration profile.
          Changes take effect immediately for all active applicants.
        </span>
      </div>

      {/* Requirements table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
                <th className="w-8 px-3 py-3" />
                <th className="px-4 py-3 text-left font-semibold">#</th>
                <th className="px-4 py-3 text-left font-semibold">Requirement</th>
                <th className="px-4 py-3 text-left font-semibold">Applicant Type</th>
                <th className="px-4 py-3 text-left font-semibold">Job Types</th>
                <th className="px-4 py-3 text-center font-semibold">Mandatory</th>
                <th className="px-4 py-3 text-center font-semibold">Expiry Track</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
                <th className="px-4 py-3 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req, idx) => (
                <tr
                  key={req.id}
                  draggable
                  onDragStart={() => onDragStart(req.id)}
                  onDragOver={(e) => onDragOver(e, req.id)}
                  onDrop={() => onDrop(req.id)}
                  onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                  className={`border-b border-slate-100 last:border-0 transition-all ${
                    dragOverId === req.id ? 'bg-[#0EA5E9]/5 border-[#0EA5E9]' : req.isActive ? 'hover:bg-slate-50' : 'opacity-50 bg-slate-50/50'
                  }`}
                >
                  <td className="px-3 py-3 cursor-grab text-slate-300 hover:text-slate-500">
                    <GripVertical size={16} />
                  </td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{String(req.sortOrder).padStart(2, '0')}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#0F172A]">{req.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5 max-w-xs truncate">{req.description}</div>
                    {req.expiryTracked && req.validityMonths && (
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full mt-1 inline-block">
                        Valid for {req.validityMonths}mo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{
                      background: APPLIES_TO_COLORS[req.appliesTo] + '18',
                      color: APPLIES_TO_COLORS[req.appliesTo]
                    }}>
                      {APPLIES_TO_LABELS[req.appliesTo]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(req.applicableJobTypes || ['all']).map(jt => {
                        const opt = JOB_TYPE_OPTIONS.find(o => o.value === jt);
                        const color = JOB_TYPE_COLORS[jt as JobTypeValue] || '#64748B';
                        return (
                          <span key={jt} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: color + '18', color }}>
                            {jt === 'all' ? 'All Jobs' : opt?.label.split(' ')[0] || jt}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {req.isRequired
                      ? <CheckCircle2 size={16} className="text-[#EF4444] mx-auto" />
                      : <XCircle size={16} className="text-slate-300 mx-auto" />}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {req.expiryTracked
                      ? <CheckCircle2 size={16} className="text-[#10B981] mx-auto" />
                      : <XCircle size={16} className="text-slate-300 mx-auto" />}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggle(req.id)} className="transition-opacity hover:opacity-70">
                      {req.isActive
                        ? <ToggleRight size={22} className="text-[#10B981] mx-auto" />
                        : <ToggleLeft size={22} className="text-slate-300 mx-auto" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openEdit(req)} className="p-1.5 hover:bg-blue-50 hover:text-[#0EA5E9] rounded-lg transition-colors text-slate-400">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => remove(req.id)} className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors text-slate-400">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm">No requirements found for this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Add modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
              <h2 className="font-bold text-[#0F172A]">{isNew ? 'Add New Requirement' : 'Edit Requirement'}</h2>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Requirement Name *</label>
                <input
                  value={editing.name}
                  onChange={e => setEditing(p => p ? { ...p, name: e.target.value } : p)}
                  placeholder="e.g. NBI Clearance"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Description</label>
                <textarea
                  value={editing.description}
                  onChange={e => setEditing(p => p ? { ...p, description: e.target.value } : p)}
                  rows={2}
                  placeholder="Explain what this document is and any specific requirements..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Applies To</label>
                  <select
                    value={editing.appliesTo}
                    onChange={e => setEditing(p => p ? { ...p, appliesTo: e.target.value as DocumentRequirement['appliesTo'] } : p)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 bg-white"
                  >
                    {(Object.keys(APPLIES_TO_LABELS) as DocumentRequirement['appliesTo'][]).map(k => (
                      <option key={k} value={k}>{APPLIES_TO_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Type</label>
                  <select
                    value={editing.isRequired ? 'required' : 'optional'}
                    onChange={e => setEditing(p => p ? { ...p, isRequired: e.target.value === 'required' } : p)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 bg-white"
                  >
                    <option value="required">Mandatory</option>
                    <option value="optional">Optional</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Applicable Job Types</label>
                <div className="flex flex-wrap gap-2">
                  {JOB_TYPE_OPTIONS.map(jt => {
                    const currentTypes = editing.applicableJobTypes || ['all'];
                    const selected = currentTypes.includes(jt.value);
                    const color = JOB_TYPE_COLORS[jt.value];
                    const toggleJobType = (val: JobTypeValue) => {
                      setEditing(p => {
                        if (!p) return p;
                        const cur = p.applicableJobTypes || ['all'];
                        if (val === 'all') return { ...p, applicableJobTypes: ['all'] };
                        const withoutAll = cur.filter(v => v !== 'all');
                        const next = withoutAll.includes(val) ? withoutAll.filter(v => v !== val) : [...withoutAll, val];
                        return { ...p, applicableJobTypes: next.length === 0 ? ['all'] : next };
                      });
                    };
                    return (
                      <button
                        key={jt.value}
                        type="button"
                        onClick={() => toggleJobType(jt.value)}
                        className="text-xs px-3 py-1.5 rounded-full border transition-all font-medium"
                        style={selected ? { background: color, color: '#fff', borderColor: color } : { background: '#fff', color: '#475569', borderColor: '#e2e8f0' }}
                      >
                        {jt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-start gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.expiryTracked}
                    onChange={e => setEditing(p => p ? { ...p, expiryTracked: e.target.checked } : p)}
                  />
                  <span className="text-sm text-[#0F172A]">Track expiry date</span>
                </label>
                {editing.expiryTracked && (
                  <div className="flex items-center gap-2 ml-auto">
                    <label className="text-xs text-slate-500">Validity (months)</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={editing.validityMonths || ''}
                      onChange={e => setEditing(p => p ? { ...p, validityMonths: parseInt(e.target.value) || undefined } : p)}
                      className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 text-center"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 rounded-b-2xl border-t border-slate-200">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
              <button onClick={save} className="flex items-center gap-2 px-5 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-sm font-semibold rounded-lg transition-colors">
                <Save size={15} /> {isNew ? 'Add Requirement' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
