import { useState, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, Save, X, Search, Star, StarOff,
  Building2, Globe, Phone, Mail, Link, ShieldCheck, ShieldX,
  ThumbsUp, ThumbsDown, MessageSquare, ChevronDown, ChevronRight,
  AlertTriangle, CheckCircle2, Clock, Briefcase
} from 'lucide-react';
import { EmployerProfile, EmployerRemark } from '../../types';
import { api } from '../../../lib/api';

const STATUS_META: Record<EmployerProfile['status'], { label: string; color: string; icon: React.ReactNode }> = {
  active:      { label: 'Active',      color: '#10B981', icon: <CheckCircle2 size={13} /> },
  pending:     { label: 'Pending',     color: '#F59E0B', icon: <Clock size={13} /> },
  suspended:   { label: 'Suspended',   color: '#F97316', icon: <AlertTriangle size={13} /> },
  blacklisted: { label: 'Blacklisted', color: '#EF4444', icon: <ShieldX size={13} /> },
};

const REMARK_META: Record<EmployerRemark['category'], { label: string; color: string; icon: React.ReactNode }> = {
  commendation: { label: 'Commendation', color: '#10B981', icon: <ThumbsUp size={13} /> },
  positive:     { label: 'Positive',     color: '#0EA5E9', icon: <ThumbsUp size={13} /> },
  neutral:      { label: 'Neutral',      color: '#64748B', icon: <MessageSquare size={13} /> },
  negative:     { label: 'Negative',     color: '#F97316', icon: <ThumbsDown size={13} /> },
  complaint:    { label: 'Complaint',    color: '#EF4444', icon: <ThumbsDown size={13} /> },
};

const BLANK_EMPLOYER: Omit<EmployerProfile, 'id' | 'createdAt' | 'remarks' | 'totalDeployed' | 'activeJobOrders'> = {
  companyName: '', country: '', industry: '', contactPerson: '', contactEmail: '', contactPhone: '',
  address: '', website: '', accreditationNo: '', accreditationExpiry: '',
  status: 'pending', rating: 3,
};

interface Props {
  showToast: (msg: string) => void;
  currentUserName: string;
}

export default function EmployerProfiles({ showToast, currentUserName }: Props) {
  const [employers, setEmployers] = useState<EmployerProfile[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EmployerProfile['status']>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<EmployerProfile | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [addingRemark, setAddingRemark] = useState<{ employerId: string; content: string; category: EmployerRemark['category'] } | null>(null);

  // ── Fetch Live Employers on Mount ─────────────────────────────────────────
  useEffect(() => {
    const fetchEmployers = async () => {
      try {
        const res = await api.get('/employers');
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const liveEmps: EmployerProfile[] = res.data.map((e: any) => ({
            id: String(e.employer_id),
            companyName: e.company_name,
            country: e.country?.country_name || 'International',
            industry: e.industry || 'General',
            contactPerson: e.contact_person || '',
            contactEmail: e.contact_email || '',
            contactPhone: e.contact_phone || '',
            address: e.address || '',
            accreditationNo: e.accreditation_no || '',
            accreditationExpiry: e.accreditation_expiry || '',
            status: (e.registration_status || 'active').toLowerCase() as any,
            rating: typeof e.star_rating === 'number' ? e.star_rating : 5,
            totalDeployed: e.total_deployed || 0,
            activeJobOrders: e.active_job_orders || 0,
            remarks: Array.isArray(e.remarks) ? e.remarks : [],
            createdAt: e.created_at || '',
          }));
          setEmployers(liveEmps);
        }
      } catch (err) {
        console.warn('Could not fetch live employers, retaining cached data:', err);
      }
    };
    fetchEmployers();
  }, []);

  const filtered = employers.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !search || e.companyName.toLowerCase().includes(q) || e.country.toLowerCase().includes(q) || e.industry.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openNew = () => {
    const nextId = String(employers.length > 0 ? Math.max(...employers.map(e => Number(e.id) || 0)) + 1 : 1);
    setEditing({ ...BLANK_EMPLOYER, id: nextId, createdAt: new Date().toISOString().slice(0, 10), remarks: [], totalDeployed: 0, activeJobOrders: 0 });
    setIsNew(true);
  };

  const saveEmployer = async () => {
    if (!editing) return;
    if (!editing.companyName.trim()) { showToast('Company name is required'); return; }

    const payload = {
      company_name: editing.companyName,
      industry: editing.industry,
      contact_person: editing.contactPerson,
      contact_email: editing.contactEmail,
      contact_phone: editing.contactPhone,
      address: editing.address,
      website: editing.website,
      accreditation_no: editing.accreditationNo,
      accreditation_expiry: editing.accreditationExpiry || undefined,
      registration_status: editing.status,
      compliance_status: editing.status === 'active' ? 'Compliant' : 'Under Review',
      star_rating: editing.rating,
      total_deployed: editing.totalDeployed,
      active_job_orders: editing.activeJobOrders,
      remarks: editing.remarks,
    };

    try {
      if (isNew) {
        const res = await api.post('/employers', payload);
        const createdId = res.data?.employer_id ? String(res.data.employer_id) : editing.id;
        setEmployers(p => [...p, { ...editing, id: createdId }]);
      } else {
        await api.put(`/employers/${editing.id}`, payload);
        setEmployers(p => p.map(e => e.id === editing.id ? editing : e));
      }
      showToast(`"${editing.companyName}" ${isNew ? 'added' : 'updated'}`);
    } catch (err) {
      console.warn('Backend save error, updating locally:', err);
      if (isNew) setEmployers(p => [...p, editing]);
      else setEmployers(p => p.map(e => e.id === editing.id ? editing : e));
      showToast(`Saved locally: "${editing.companyName}"`);
    }

    setEditing(null);
  };

  const removeEmployer = async (id: string) => {
    const e = employers.find(e => e.id === id);
    setEmployers(p => p.filter(e => e.id !== id));
    try {
      await api.delete(`/employers/${id}`);
      showToast(`"${e?.companyName}" removed from database`);
    } catch (err) {
      console.warn('Backend delete error, removed locally:', err);
      showToast(`"${e?.companyName}" removed`);
    }
  };

  const addRemark = async () => {
    if (!addingRemark?.content.trim()) return;
    const remark: EmployerRemark = { id: `rem-${Date.now()}`, date: new Date().toISOString().slice(0, 10), author: currentUserName, category: addingRemark.category, content: addingRemark.content };
    
    const targetEmp = employers.find(e => e.id === addingRemark.employerId);
    const updatedRemarks = targetEmp ? [remark, ...targetEmp.remarks] : [remark];

    setEmployers(p => p.map(e => e.id === addingRemark.employerId ? { ...e, remarks: updatedRemarks } : e));
    showToast('Remark added');

    try {
      await api.put(`/employers/${addingRemark.employerId}`, { remarks: updatedRemarks });
    } catch (err) {
      console.warn('Could not persist remark to backend:', err);
    }

    setAddingRemark(null);
  };

  const renderStars = (rating: number, onChange?: (n: number) => void) => (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => onChange?.(n as EmployerProfile['rating'])} disabled={!onChange} className={onChange ? 'cursor-pointer' : 'cursor-default'}>
          <Star size={14} className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Employer Profiles</h1>
          <p className="text-slate-500 text-sm mt-1">Manage accredited foreign employer records, performance ratings, and deployment remarks.</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors">
          <Plus size={16} /> Add Employer
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Employers', val: employers.length, color: '#0F172A' },
          { label: 'Active', val: employers.filter(e => e.status === 'active').length, color: '#10B981' },
          { label: 'Suspended/Blacklisted', val: employers.filter(e => ['suspended','blacklisted'].includes(e.status)).length, color: '#EF4444' },
          { label: 'Workers Deployed', val: employers.reduce((s, e) => s + e.totalDeployed, 0).toLocaleString(), color: '#0EA5E9' },
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employer or country..." className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] bg-white" />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'pending', 'suspended', 'blacklisted'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${statusFilter === s ? 'bg-[#0F172A] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Employer cards */}
      <div className="space-y-3">
        {filtered.map(emp => {
          const meta = STATUS_META[emp.status];
          const isExpanded = expanded === emp.id;
          return (
            <div key={emp.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Card header */}
              <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setExpanded(isExpanded ? null : emp.id)}>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0">
                  <Building2 size={20} className="text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-[#0F172A]">{emp.companyName}</span>
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium`} style={{ background: meta.color + '18', color: meta.color }}>
                      {meta.icon} {meta.label}
                    </span>
                    {emp.status === 'suspended' || emp.status === 'blacklisted' ? (
                      <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertTriangle size={11} /> Do not accept job orders
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1"><Globe size={12} /> {emp.country}</span>
                    <span className="flex items-center gap-1"><Briefcase size={12} /> {emp.industry}</span>
                    <span>{emp.totalDeployed} deployed · {emp.activeJobOrders} open orders</span>
                    {renderStars(emp.rating)}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={e => { e.stopPropagation(); setEditing({ ...emp }); setIsNew(false); }} className="p-2 hover:bg-blue-50 hover:text-[#0EA5E9] rounded-lg transition-colors text-slate-400">
                    <Pencil size={15} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); removeEmployer(emp.id); }} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors text-slate-400">
                    <Trash2 size={15} />
                  </button>
                  {isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-slate-100 px-5 py-4 space-y-5">
                  {/* Contact & accreditation */}
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact Details</div>
                      <div className="flex items-center gap-2 text-slate-700"><Mail size={14} className="text-slate-400" /> {emp.contactPerson} — {emp.contactEmail}</div>
                      <div className="flex items-center gap-2 text-slate-700"><Phone size={14} className="text-slate-400" /> {emp.contactPhone}</div>
                      {emp.website && <div className="flex items-center gap-2 text-[#0EA5E9]"><Link size={14} /> {emp.website}</div>}
                      <div className="text-slate-600 text-xs mt-1">{emp.address}</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Accreditation</div>
                      <div className="font-mono text-xs bg-slate-100 px-3 py-2 rounded-lg text-[#0F172A]">{emp.accreditationNo}</div>
                      <div className={`text-xs flex items-center gap-1.5 ${new Date(emp.accreditationExpiry) < new Date() ? 'text-red-500' : 'text-slate-500'}`}>
                        {new Date(emp.accreditationExpiry) < new Date() ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                        Expires: {emp.accreditationExpiry}
                      </div>
                      <div className="text-xs text-slate-500">Registered: {emp.createdAt}</div>
                    </div>
                  </div>

                  {/* Remarks */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Performance Remarks</div>
                      <button
                        onClick={() => setAddingRemark({ employerId: emp.id, content: '', category: 'neutral' })}
                        className="flex items-center gap-1.5 text-xs text-[#0EA5E9] hover:text-[#0284C7] font-medium transition-colors"
                      >
                        <Plus size={13} /> Add Remark
                      </button>
                    </div>
                    {emp.remarks.length === 0 && (
                      <p className="text-xs text-slate-400 italic">No remarks yet. Add the first one above.</p>
                    )}
                    <div className="space-y-2">
                      {emp.remarks.map(r => {
                        const rm = REMARK_META[r.category];
                        return (
                          <div key={r.id} className="flex gap-3 p-3 rounded-lg border" style={{ borderColor: rm.color + '30', background: rm.color + '08' }}>
                            <div className="mt-0.5 flex-shrink-0" style={{ color: rm.color }}>{rm.icon}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: rm.color + '18', color: rm.color }}>{rm.label}</span>
                                <span className="text-xs text-slate-500">{r.date} · {r.author}</span>
                              </div>
                              <p className="text-sm text-slate-700 leading-relaxed">{r.content}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-400 text-sm">
            No employers found matching your search.
          </div>
        )}
      </div>

      {/* Add/Edit Employer Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 sticky top-0 bg-white z-10">
              <h2 className="font-bold text-[#0F172A]">{isNew ? 'Add Employer Profile' : 'Edit Employer Profile'}</h2>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Company Name *</label>
                  <input value={editing.companyName} onChange={e => setEditing(p => p ? { ...p, companyName: e.target.value } : p)} placeholder="e.g. Al-Futtaim Engineering LLC" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Country</label>
                  <input value={editing.country} onChange={e => setEditing(p => p ? { ...p, country: e.target.value } : p)} placeholder="e.g. UAE" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Industry</label>
                  <input value={editing.industry} onChange={e => setEditing(p => p ? { ...p, industry: e.target.value } : p)} placeholder="e.g. Construction & Engineering" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Contact Person</label>
                  <input value={editing.contactPerson} onChange={e => setEditing(p => p ? { ...p, contactPerson: e.target.value } : p)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Email</label>
                  <input type="email" value={editing.contactEmail} onChange={e => setEditing(p => p ? { ...p, contactEmail: e.target.value } : p)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Phone</label>
                  <input value={editing.contactPhone} onChange={e => setEditing(p => p ? { ...p, contactPhone: e.target.value } : p)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Address</label>
                  <input value={editing.address} onChange={e => setEditing(p => p ? { ...p, address: e.target.value } : p)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Accreditation No.</label>
                  <input value={editing.accreditationNo} onChange={e => setEditing(p => p ? { ...p, accreditationNo: e.target.value } : p)} placeholder="POEA-DMW-..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Accreditation Expiry</label>
                  <input type="date" value={editing.accreditationExpiry} onChange={e => setEditing(p => p ? { ...p, accreditationExpiry: e.target.value } : p)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Status</label>
                  <select value={editing.status} onChange={e => setEditing(p => p ? { ...p, status: e.target.value as EmployerProfile['status'] } : p)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 bg-white">
                    {(Object.keys(STATUS_META) as EmployerProfile['status'][]).map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Performance Rating</label>
                  <div className="flex gap-2 items-center mt-2">
                    {renderStars(editing.rating, n => setEditing(p => p ? { ...p, rating: n as EmployerProfile['rating'] } : p))}
                    <span className="text-sm text-slate-500 ml-2">{editing.rating}/5</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 rounded-b-2xl border-t border-slate-200">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
              <button onClick={saveEmployer} className="flex items-center gap-2 px-5 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-sm font-semibold rounded-lg transition-colors">
                <Save size={15} /> {isNew ? 'Add Employer' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Remark Modal */}
      {addingRemark && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
              <h2 className="font-bold text-[#0F172A]">Add Performance Remark</h2>
              <button onClick={() => setAddingRemark(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(REMARK_META) as EmployerRemark['category'][]).map(c => {
                    const rm = REMARK_META[c];
                    return (
                      <button key={c} onClick={() => setAddingRemark(p => p ? { ...p, category: c } : p)} className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border-2 transition-all ${addingRemark.category === c ? 'border-[#0EA5E9] bg-[#0EA5E9]/10 text-[#0EA5E9]' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                        {rm.icon} {rm.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Remark *</label>
                <textarea
                  value={addingRemark.content}
                  onChange={e => setAddingRemark(p => p ? { ...p, content: e.target.value } : p)}
                  rows={4}
                  placeholder="Describe the observation, complaint, commendation, or note about this employer..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] resize-none"
                />
              </div>
              <p className="text-xs text-slate-400">This remark will be recorded under your name ({currentUserName}) with today's date.</p>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 rounded-b-2xl border-t border-slate-200">
              <button onClick={() => setAddingRemark(null)} className="px-4 py-2 text-sm font-medium text-slate-600">Cancel</button>
              <button onClick={addRemark} disabled={!addingRemark.content.trim()} className="flex items-center gap-2 px-5 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors">
                <Save size={15} /> Save Remark
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
