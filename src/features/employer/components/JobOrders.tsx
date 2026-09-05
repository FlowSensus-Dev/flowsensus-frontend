import { useState } from 'react';
import {
  Plus, Pencil, Trash2, Save, X, Search, Globe, Briefcase,
  Users, Calendar, DollarSign, FileText, ChevronDown, ChevronRight,
  CheckCircle2, Clock, XCircle, AlertTriangle, Building2, Tag, Star
} from 'lucide-react';
import { JobOrder, EmployerProfile } from '../../../app/types';

const STATUS_META: Record<JobOrder['status'], { label: string; color: string; icon: React.ReactNode }> = {
  open:    { label: 'Open',    color: '#10B981', icon: <CheckCircle2 size={13} /> },
  pending: { label: 'Pending', color: '#F59E0B', icon: <Clock size={13} /> },
  filled:  { label: 'Filled',  color: '#0EA5E9', icon: <CheckCircle2 size={13} /> },
  closed:  { label: 'Closed',  color: '#64748B', icon: <XCircle size={13} /> },
};

const MOCK_EMPLOYERS: EmployerProfile[] = [
  { id: 'emp-001', companyName: 'Al-Futtaim Engineering LLC', country: 'UAE', industry: 'Construction', contactPerson: '', contactEmail: '', contactPhone: '', address: '', accreditationNo: '', accreditationExpiry: '', status: 'active', rating: 5, totalDeployed: 312, activeJobOrders: 3, remarks: [], createdAt: '' },
  { id: 'emp-002', companyName: 'Hong Kong Family Services Ltd.', country: 'Hong Kong', industry: 'Domestic', contactPerson: '', contactEmail: '', contactPhone: '', address: '', accreditationNo: '', accreditationExpiry: '', status: 'pending', rating: 3, totalDeployed: 87, activeJobOrders: 2, remarks: [], createdAt: '' },
  { id: 'emp-003', companyName: 'Dubai Healthcare Authority', country: 'UAE', industry: 'Healthcare', contactPerson: '', contactEmail: '', contactPhone: '', address: '', accreditationNo: '', accreditationExpiry: '', status: 'active', rating: 5, totalDeployed: 204, activeJobOrders: 5, remarks: [], createdAt: '' },
  { id: 'emp-004', companyName: 'SkyBuild Construction Corp.', country: 'Qatar', industry: 'Construction', contactPerson: '', contactEmail: '', contactPhone: '', address: '', accreditationNo: '', accreditationExpiry: '', status: 'suspended', rating: 2, totalDeployed: 45, activeJobOrders: 0, remarks: [], createdAt: '' },
];

const DEFAULT_ORDERS: JobOrder[] = [
  { id: 'jo-001', code: 'JO-2026-0042', position: 'Industrial Welder', country: 'UAE', employerId: 'emp-001', employerName: 'Al-Futtaim Engineering LLC', slots: 10, filledSlots: 3, salaryRange: 'AED 2,800–3,400/mo', contractDuration: '2 years', requirements: ['Valid Passport', 'NBI Clearance', 'TESDA NC II - SMAW', 'Medical Certificate', 'PEOS Certificate'], minExperience: 3, certifications: ['TESDA NC II Welding', 'CSWIP 3.1 (preferred)'], status: 'open', datePosted: '2026-04-01', deadline: '2026-07-31', notes: 'Employer prefers applicants with overseas Gulf experience. Housing and meals provided. Night differential applicable.' },
  { id: 'jo-002', code: 'JO-2026-0038', position: 'Domestic Helper', country: 'Hong Kong', employerId: 'emp-002', employerName: 'Hong Kong Family Services Ltd.', slots: 5, filledSlots: 4, salaryRange: 'HKD 4,730/mo (minimum wage)', contractDuration: '2 years', requirements: ['Valid Passport', 'NBI Clearance', 'Medical Certificate', 'PEOS Certificate', 'OFW Information Sheet'], minExperience: 1, certifications: [], status: 'open', datePosted: '2026-03-15', deadline: '2026-06-30', notes: 'Employer family has 2 children aged 4 and 7. Must be comfortable with cooking Filipino and Chinese dishes.' },
  { id: 'jo-003', code: 'JO-2026-0051', position: 'Registered Nurse / Caregiver', country: 'UAE', employerId: 'emp-003', employerName: 'Dubai Healthcare Authority', slots: 20, filledSlots: 12, salaryRange: 'AED 4,500–6,000/mo', contractDuration: '3 years', requirements: ['Valid Passport', 'NBI Clearance', 'Medical Certificate', 'PRC License', 'PEOS Certificate', 'DMW e-Registration'], minExperience: 2, certifications: ['PRC License - Nursing', 'DataFlow Verification', 'DHA License (preferred)'], status: 'open', datePosted: '2026-02-20', deadline: '2026-08-31', notes: 'DHA pre-licensure screening required. Agency to assist with DataFlow document verification. Premium employer — priority endorsement.' },
  { id: 'jo-004', code: 'JO-2025-0189', position: 'Electrician (Building Works)', country: 'Qatar', employerId: 'emp-004', employerName: 'SkyBuild Construction Corp.', slots: 15, filledSlots: 15, salaryRange: 'QAR 1,800/mo', contractDuration: '1 year', requirements: ['Valid Passport', 'NBI Clearance', 'TESDA NC II - Electrical', 'Medical Certificate'], minExperience: 2, certifications: ['TESDA NC II - Electrical Installation'], status: 'filled', datePosted: '2025-10-01', deadline: '2025-12-31', notes: 'EMPLOYER SUSPENDED — Do not process new applicants under this order. Existing deployed workers are being monitored.' },
];

const BLANK_ORDER: Omit<JobOrder, 'id'> = {
  code: '', position: '', country: '', employerId: '', employerName: '', slots: 1, filledSlots: 0,
  salaryRange: '', contractDuration: '', requirements: [], minExperience: 0, certifications: [],
  status: 'pending', datePosted: new Date().toISOString().slice(0, 10), deadline: '', notes: '',
};

interface Props {
  showToast: (msg: string) => void;
  currentUserName: string;
}

export default function JobOrders({ showToast, currentUserName }: Props) {
  const [orders, setOrders] = useState<JobOrder[]>(DEFAULT_ORDERS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | JobOrder['status']>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<JobOrder | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [reqInput, setReqInput] = useState('');
  const [certInput, setCertInput] = useState('');

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const matchSearch = !search || o.code.toLowerCase().includes(q) || o.position.toLowerCase().includes(q) || o.country.toLowerCase().includes(q) || o.employerName.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openNew = () => {
    setEditing({ ...BLANK_ORDER, id: `jo-${Date.now()}` });
    setIsNew(true);
    setReqInput('');
    setCertInput('');
  };

  const openEdit = (o: JobOrder) => {
    setEditing({ ...o, requirements: [...o.requirements], certifications: [...o.certifications] });
    setIsNew(false);
    setReqInput('');
    setCertInput('');
  };

  const save = () => {
    if (!editing) return;
    if (!editing.position.trim()) { showToast('Position is required'); return; }
    if (!editing.employerId) { showToast('Select an employer'); return; }
    if (isNew) setOrders(p => [...p, editing]);
    else setOrders(p => p.map(o => o.id === editing.id ? editing : o));
    showToast(`Job Order "${editing.code || editing.position}" ${isNew ? 'created' : 'updated'}`);
    setEditing(null);
  };

  const remove = (id: string) => {
    const o = orders.find(o => o.id === id);
    setOrders(p => p.filter(o => o.id !== id));
    showToast(`"${o?.code} ${o?.position}" removed`);
  };

  const addTag = (field: 'requirements' | 'certifications', val: string) => {
    const v = val.trim();
    if (!v || !editing) return;
    if (editing[field].includes(v)) return;
    setEditing(p => p ? { ...p, [field]: [...p[field], v] } : p);
    if (field === 'requirements') setReqInput('');
    else setCertInput('');
  };

  const removeTag = (field: 'requirements' | 'certifications', val: string) => {
    setEditing(p => p ? { ...p, [field]: p[field].filter(x => x !== val) } : p);
  };

  const onEmployerChange = (empId: string) => {
    const emp = MOCK_EMPLOYERS.find(e => e.id === empId);
    setEditing(p => p ? { ...p, employerId: empId, employerName: emp?.companyName || '', country: emp?.country || p.country } : p);
  };

  const stats = {
    open: orders.filter(o => o.status === 'open').length,
    totalSlots: orders.filter(o => o.status === 'open').reduce((s, o) => s + (o.slots - o.filledSlots), 0),
    filled: orders.filter(o => o.status === 'filled').length,
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(n => <Star key={n} size={11} className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />)}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Job Orders</h1>
          <p className="text-slate-500 text-sm mt-1">Official deployment requests from DMW-accredited foreign employers. Applicants are matched and tagged to open job orders.</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors">
          <Plus size={16} /> New Job Order
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Orders', val: orders.length, color: '#0F172A' },
          { label: 'Open', val: stats.open, color: '#10B981' },
          { label: 'Available Slots', val: stats.totalSlots, color: '#0EA5E9' },
          { label: 'Filled', val: stats.filled, color: '#64748B' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4">
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.val}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by code, position, or employer..." className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] bg-white" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'open', 'pending', 'filled', 'closed'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${statusFilter === s ? 'bg-[#0F172A] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'}`}>
              {s === 'all' ? 'All' : STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Job Order cards */}
      <div className="space-y-3">
        {filtered.map(order => {
          const meta = STATUS_META[order.status];
          const emp = MOCK_EMPLOYERS.find(e => e.id === order.employerId);
          const isExpanded = expanded === order.id;
          const available = order.slots - order.filledSlots;
          const fillPct = order.slots > 0 ? (order.filledSlots / order.slots) * 100 : 0;
          const isSuspended = emp?.status === 'suspended' || emp?.status === 'blacklisted';

          return (
            <div key={order.id} className={`bg-white rounded-xl border overflow-hidden ${isSuspended ? 'border-red-200' : 'border-slate-200'}`}>
              {isSuspended && (
                <div className="bg-red-50 border-b border-red-200 px-5 py-2 flex items-center gap-2 text-xs text-red-600">
                  <AlertTriangle size={13} /> Employer is suspended — do not process new applicants under this order
                </div>
              )}
              <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setExpanded(isExpanded ? null : order.id)}>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0EA5E9]/10 to-[#0EA5E9]/5 flex items-center justify-center flex-shrink-0">
                  <Briefcase size={20} className="text-[#0EA5E9]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{order.code}</span>
                    <span className="font-bold text-[#0F172A]">{order.position}</span>
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: meta.color + '18', color: meta.color }}>
                      {meta.icon} {meta.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1"><Globe size={11} /> {order.country}</span>
                    <span className="flex items-center gap-1"><Building2 size={11} /> {order.employerName}</span>
                    <span className="flex items-center gap-1"><DollarSign size={11} /> {order.salaryRange}</span>
                    <span className="flex items-center gap-1"><Calendar size={11} /> Deadline: {order.deadline}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1 max-w-[200px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${fillPct}%`, background: fillPct >= 100 ? '#64748B' : '#0EA5E9' }} />
                    </div>
                    <span className="text-xs text-slate-500">{order.filledSlots}/{order.slots} slots filled</span>
                    {available > 0 && <span className="text-xs font-semibold text-[#10B981]">{available} available</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={e => { e.stopPropagation(); openEdit(order); }} className="p-2 hover:bg-blue-50 hover:text-[#0EA5E9] rounded-lg transition-colors text-slate-400">
                    <Pencil size={15} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); remove(order.id); }} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors text-slate-400">
                    <Trash2 size={15} />
                  </button>
                  {isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-100 px-5 py-4 space-y-4">
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Job Details</div>
                      <div className="space-y-1.5 text-slate-700">
                        <div><span className="text-slate-400 text-xs">Contract:</span> {order.contractDuration}</div>
                        <div><span className="text-slate-400 text-xs">Min. Experience:</span> {order.minExperience} yr{order.minExperience !== 1 ? 's' : ''}</div>
                        <div><span className="text-slate-400 text-xs">Posted:</span> {order.datePosted}</div>
                        <div><span className="text-slate-400 text-xs">Deadline:</span> {order.deadline}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Required Documents</div>
                      <div className="flex flex-wrap gap-1.5">
                        {order.requirements.map(r => (
                          <span key={r} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{r}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Required Certifications</div>
                      <div className="flex flex-wrap gap-1.5">
                        {order.certifications.length > 0
                          ? order.certifications.map(c => <span key={c} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{c}</span>)
                          : <span className="text-xs text-slate-400 italic">None specified</span>
                        }
                      </div>
                    </div>
                  </div>
                  {order.notes && (
                    <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-sm text-amber-800">
                      <span className="font-semibold text-xs uppercase tracking-wider text-amber-600">Notes: </span>
                      {order.notes}
                    </div>
                  )}
                  {emp && (
                    <div className="bg-slate-50 rounded-lg px-4 py-3 flex items-center gap-3 text-sm">
                      <Building2 size={16} className="text-slate-400 flex-shrink-0" />
                      <div>
                        <span className="font-semibold text-[#0F172A]">{emp.companyName}</span>
                        <span className="mx-2 text-slate-300">·</span>
                        <span className="text-slate-500">{emp.industry}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          {renderStars(emp.rating)}
                          <span className="text-xs text-slate-500">{emp.totalDeployed} total deployed</span>
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: (emp.status === 'active' ? '#10B981' : '#EF4444') + '18', color: emp.status === 'active' ? '#10B981' : '#EF4444' }}>
                            {emp.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-400 text-sm">
            No job orders found. Create one above.
          </div>
        )}
      </div>

      {/* Edit / Add Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 sticky top-0 bg-white z-10">
              <h2 className="font-bold text-[#0F172A]">{isNew ? 'New Job Order' : `Edit ${editing.code}`}</h2>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Order Code</label>
                  <input value={editing.code} onChange={e => setEditing(p => p ? { ...p, code: e.target.value } : p)} placeholder="e.g. JO-2026-0055" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Position / Job Title *</label>
                  <input value={editing.position} onChange={e => setEditing(p => p ? { ...p, position: e.target.value } : p)} placeholder="e.g. Industrial Welder" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Employer *</label>
                  <select value={editing.employerId} onChange={e => onEmployerChange(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 bg-white">
                    <option value="">-- Select Employer --</option>
                    {MOCK_EMPLOYERS.filter(e => e.status !== 'blacklisted').map(e => (
                      <option key={e.id} value={e.id}>{e.companyName} ({e.country}){e.status === 'suspended' ? ' ⚠️' : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Country</label>
                  <input value={editing.country} onChange={e => setEditing(p => p ? { ...p, country: e.target.value } : p)} placeholder="e.g. UAE" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Total Slots</label>
                  <input type="number" min={1} value={editing.slots} onChange={e => setEditing(p => p ? { ...p, slots: parseInt(e.target.value) || 1 } : p)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 text-center" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Salary Range</label>
                  <input value={editing.salaryRange} onChange={e => setEditing(p => p ? { ...p, salaryRange: e.target.value } : p)} placeholder="e.g. AED 2,800–3,400/mo" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Contract Duration</label>
                  <input value={editing.contractDuration} onChange={e => setEditing(p => p ? { ...p, contractDuration: e.target.value } : p)} placeholder="e.g. 2 years" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Min. Experience (years)</label>
                  <input type="number" min={0} value={editing.minExperience} onChange={e => setEditing(p => p ? { ...p, minExperience: parseInt(e.target.value) || 0 } : p)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 text-center" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Date Posted</label>
                  <input type="date" value={editing.datePosted} onChange={e => setEditing(p => p ? { ...p, datePosted: e.target.value } : p)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Application Deadline</label>
                  <input type="date" value={editing.deadline} onChange={e => setEditing(p => p ? { ...p, deadline: e.target.value } : p)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Status</label>
                  <select value={editing.status} onChange={e => setEditing(p => p ? { ...p, status: e.target.value as JobOrder['status'] } : p)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 bg-white">
                    {(Object.keys(STATUS_META) as JobOrder['status'][]).map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                  </select>
                </div>
              </div>

              {/* Requirements tags */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Required Documents</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {editing.requirements.map(r => (
                    <span key={r} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                      {r}
                      <button onClick={() => removeTag('requirements', r)} className="hover:text-red-500 transition-colors"><X size={11} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={reqInput} onChange={e => setReqInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag('requirements', reqInput); } }} placeholder="Type requirement and press Enter" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]" />
                  <button onClick={() => addTag('requirements', reqInput)} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm transition-colors"><Plus size={15} /></button>
                </div>
              </div>

              {/* Certifications tags */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Required Certifications</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {editing.certifications.map(c => (
                    <span key={c} className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-full">
                      {c}
                      <button onClick={() => removeTag('certifications', c)} className="hover:text-red-500 transition-colors"><X size={11} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={certInput} onChange={e => setCertInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag('certifications', certInput); } }} placeholder="Type certification and press Enter" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]" />
                  <button onClick={() => addTag('certifications', certInput)} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm transition-colors"><Plus size={15} /></button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Notes / Special Instructions</label>
                <textarea value={editing.notes} onChange={e => setEditing(p => p ? { ...p, notes: e.target.value } : p)} rows={3} placeholder="Employer-specific requirements, accommodation, benefits, or internal flags..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 rounded-b-2xl border-t border-slate-200">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
              <button onClick={save} className="flex items-center gap-2 px-5 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-sm font-semibold rounded-lg transition-colors">
                <Save size={15} /> {isNew ? 'Create Job Order' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
