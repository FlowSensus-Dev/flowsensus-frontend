import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, Save, X, Search, Globe, Briefcase,
  Users, Calendar, DollarSign, FileText, ChevronDown, ChevronRight,
  CheckCircle2, Clock, XCircle, AlertTriangle, Building2, Tag, Star, Loader2
} from 'lucide-react';
import { Skeleton, SkeletonBadge } from '../ui/skeleton';
import { JobOrder, EmployerProfile } from '../../types';

import { api } from '../../../lib/api';

const STATUS_META: Record<JobOrder['status'], { label: string; color: string; icon: React.ReactNode }> = {
  open: { label: 'Open', color: '#10B981', icon: <CheckCircle2 size={13} /> },
  pending: { label: 'Pending', color: '#F59E0B', icon: <Clock size={13} /> },
  filled: { label: 'Filled', color: '#0EA5E9', icon: <CheckCircle2 size={13} /> },
  closed: { label: 'Closed', color: '#64748B', icon: <XCircle size={13} /> },
  draft: { label: 'Draft', color: '#94A3B8', icon: <Clock size={13} /> },
  cancelled: { label: 'Cancelled', color: '#EF4444', icon: <XCircle size={13} /> },
};

const BLANK_ORDER: Omit<JobOrder, 'id'> = {
  code: '', position: '', country: '', employerId: '', employerName: '', slots: 1, filledSlots: 0,
  salaryMin: 0, salaryMax: 0, salaryCurrency: 'USD', contractMonths: 24, requirements: [], minExperience: 0, certifications: [], detailedRequirements: [],
  genderPreference: 'Any', minAge: 21, maxAge: 45,
  status: 'draft', datePosted: new Date().toISOString().slice(0, 10), deadline: '', notes: '',
};

interface Props {
  showToast: (msg: string) => void;
  currentUserName: string;
  globalJobOrders?: any[];
  globalEmployers?: any[];
  onJobOrdersChange?: (orders: any[]) => void;
  onEmployersChange?: (employers: any[]) => void;
}

const mapJobOrderFromApi = (jo: any): JobOrder => ({
  id: String(jo.job_order_id),
  code: jo.job_order_code || jo.job_code || (jo.job_order_id ? `JO-2026-${String(jo.job_order_id).padStart(4, '0')}` : `JO-${jo.job_order_id}`),
  position: jo.position_title || jo.position || '',
  country: (typeof jo.country === 'string' ? jo.country : jo.country?.country_name) || jo.country_name || jo.client_employer?.country?.country_name || jo.employer?.country?.country_name || 'International',
  employerId: String(jo.employer_id),
  employerName: jo.client_employer?.company_name || jo.employer?.company_name || jo.employer_name || '',
  slots: jo.slots_requested || jo.total_slots || 1,
  filledSlots: jo.slots_filled || jo.filled_slots || 0,
  salaryMin: Number(jo.salary_min) || 0,
  salaryMax: Number(jo.salary_max) || 0,
  salaryCurrency: jo.salary_currency || 'USD',
  contractMonths: Number(jo.contract_months) || 24,
  requirements: Array.isArray(jo.requirements) && jo.requirements.length > 0
    ? jo.requirements
    : (Array.isArray(jo.required_skills) && jo.required_skills.length > 0
        ? jo.required_skills
        : (Array.isArray(jo.job_order_requirement)
            ? jo.job_order_requirement.map((r: any) => r.requirement?.requirement_name || r.requirement_name).filter(Boolean)
            : [])),
  minExperience: jo.min_experience_years || 1,
  genderPreference: (jo.gender_preference || jo.genderPreference || 'Any') as 'Any' | 'Male' | 'Female',
  minAge: jo.min_age ?? jo.minAge ?? 21,
  maxAge: jo.max_age ?? jo.maxAge ?? 45,
  certifications: Array.isArray(jo.required_certifications) ? jo.required_certifications : (Array.isArray(jo.certifications) ? jo.certifications : []),
  detailedRequirements: Array.isArray(jo.job_order_requirements)
    ? jo.job_order_requirements.map((r: any) => ({
        name: r.requirement?.requirement_name || r.requirement_name,
        category: r.category || r.requirement?.category || 'DOCUMENT',
        isMandatory: r.is_mandatory ?? true
      }))
    : [],
  status: (jo.order_status || jo.status || 'open').toLowerCase() as JobOrder['status'],
  datePosted: jo.date_posted || '',
  deadline: jo.application_deadline || jo.deadline || '',
  notes: jo.clean_notes || jo.notes || '',
});

export default function JobOrders({ showToast, currentUserName, globalJobOrders, globalEmployers, onJobOrdersChange, onEmployersChange }: Props) {
  const [orders, setOrders] = useState<JobOrder[]>(() => {
    return (globalJobOrders && Array.isArray(globalJobOrders) && globalJobOrders.length > 0)
      ? globalJobOrders.map(mapJobOrderFromApi)
      : [];
  });
  const [employers, setEmployers] = useState<EmployerProfile[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | JobOrder['status']>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<JobOrder | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [reqInput, setReqInput] = useState('');
  const [certInput, setCertInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!globalJobOrders || globalJobOrders.length === 0);
  const [catalogRequirements, setCatalogRequirements] = useState<any[]>([]);
  const [catalogCountries, setCatalogCountries] = useState<string[]>([]);
  const [reqIsMandatory, setReqIsMandatory] = useState(true);
  const [certIsMandatory, setCertIsMandatory] = useState(true);

  // Synchronize when globalJobOrders updates from background fetch
  useEffect(() => {
    if (globalJobOrders && Array.isArray(globalJobOrders) && globalJobOrders.length > 0) {
      setOrders(globalJobOrders.map(mapJobOrderFromApi));
      setIsLoading(false);
    }
  }, [globalJobOrders]);

  // ── Fetch Live Data on Mount & Refresh ────────────────────────────────────
  const fetchLiveJobOrders = useCallback(async (force = false) => {
      try {
        if (!globalJobOrders || globalJobOrders.length === 0 || force) {
          setIsLoading(true);
        }
        const [ordersRes, empRes] = await Promise.allSettled([
          (!force && globalJobOrders && globalJobOrders.length > 0) ? Promise.resolve({ data: globalJobOrders }) : api.get('/job-orders'),
          (!force && globalEmployers && globalEmployers.length > 0) ? Promise.resolve({ data: globalEmployers }) : api.get('/employers'),
        ]);

        if (empRes.status === 'fulfilled' && Array.isArray(empRes.value.data) && empRes.value.data.length > 0) {
          const liveEmps: EmployerProfile[] = empRes.value.data.map((e: any) => ({
            id: String(e.employer_id),
            companyName: e.company_name,
            country: e.country?.country_name || (typeof e.country === 'string' ? e.country : '') || e.country_name || 'International',
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
          if (force && onEmployersChange) onEmployersChange(empRes.value.data);
        }

        if (ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value.data) && ordersRes.value.data.length > 0) {
          const mapped: JobOrder[] = ordersRes.value.data.map(mapJobOrderFromApi);
          setOrders(mapped);
          if (force && onJobOrdersChange) onJobOrdersChange(ordersRes.value.data);
        }
      } catch (err) {
        console.warn('Could not fetch live job orders, retaining default orders:', err);
      } finally {
        setIsLoading(false);
      }
      try {
        const [reqRes, countryRes] = await Promise.allSettled([
          api.get('/requirements'),
          api.get('/lookups/countries'),
        ]);
        if (reqRes.status === 'fulfilled' && reqRes.value.data) {
          setCatalogRequirements(reqRes.value.data);
        }
        if (countryRes.status === 'fulfilled' && Array.isArray(countryRes.value.data)) {
          const names = countryRes.value.data.map((c: any) => c.country_name).filter(Boolean);
          setCatalogCountries(names);
        }
      } catch (err) {}
    },
    [globalJobOrders, globalEmployers, onJobOrdersChange, onEmployersChange]
  );

  useEffect(() => {
    fetchLiveJobOrders();
  }, [fetchLiveJobOrders]);

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
    setEditing({ ...o, requirements: [...o.requirements], certifications: [...o.certifications], detailedRequirements: o.detailedRequirements ? [...o.detailedRequirements] : [] });
    setIsNew(false);
    setReqInput('');
    setCertInput('');
    setReqIsMandatory(true);
    setCertIsMandatory(true);
  };

  const save = async () => {
    if (!editing || isSaving) return;
    if (!editing.position.trim()) { showToast('Position is required'); return; }
    if (!editing.employerId) { showToast('Select an employer'); return; }

    if (editing.slots <= 0) { showToast('Total slots must be greater than 0'); return; }
    if (editing.salaryMax < editing.salaryMin) { showToast('Salary Max cannot be less than Salary Min'); return; }
    if (editing.deadline && editing.datePosted && editing.deadline < editing.datePosted) { showToast('Deadline cannot be before Date Posted'); return; }
    if (editing.contractMonths <= 0) { showToast('Contract duration must be greater than 0'); return; }
    if (editing.minExperience < 0) { showToast('Min experience cannot be negative'); return; }
    if (!/^[A-Z]{3}$/.test(editing.salaryCurrency)) { showToast('Salary currency must be a 3-letter code (e.g. USD)'); return; }

    setIsSaving(true);
    const empObj = employers.find(e => e.id === editing.employerId);
    const finalCountry = (editing.country || '').trim() || (empObj ? empObj.country : 'International');
    const updatedEditing: JobOrder = {
      ...editing,
      employerName: empObj ? empObj.companyName : editing.employerName,
      country: finalCountry,
    };

    const payload = {
      employer_id: parseInt(editing.employerId, 10) || 1,
      position: editing.position,
      country: finalCountry,
      country_name: finalCountry,
      job_code: editing.code || `JO-${Date.now().toString().slice(-4)}`,
      total_slots: editing.slots,
      salary_min: editing.salaryMin,
      salary_max: editing.salaryMax,
      salary_currency: editing.salaryCurrency,
      contract_months: editing.contractMonths,
      min_experience_years: editing.minExperience,
      gender_preference: editing.genderPreference || 'Any',
      min_age: editing.minAge ?? 21,
      max_age: editing.maxAge ?? 45,
      status: editing.status.toUpperCase(),
      date_posted: editing.datePosted || new Date().toISOString().slice(0, 10),
      deadline: editing.deadline || undefined,
      notes: editing.notes,
      requirements: editing.requirements,
      certifications: editing.certifications,
      job_order_requirements: editing.detailedRequirements?.map(r => ({
        requirement_name: r.name,
        category: r.category,
        is_mandatory: r.isMandatory
      })),
    };

    try {
      if (isNew) {
        const res = await api.post('/job-orders', payload);
        const createdId = res.data?.job_order_id ? String(res.data.job_order_id) : updatedEditing.id;
        const newOrder = res.data ? mapJobOrderFromApi(res.data) : { ...updatedEditing, id: createdId };
        setOrders(p => [...p, newOrder]);
      } else {
        const res = await api.put(`/job-orders/${editing.id}`, payload);
        const updatedOrder = res.data ? mapJobOrderFromApi(res.data) : updatedEditing;
        setOrders(p => p.map(o => o.id === editing.id ? updatedOrder : o));
      }
      showToast(`Job Order "${updatedEditing.code || updatedEditing.position}" ${isNew ? 'created' : 'updated'}`);
      setEditing(null);
      await fetchLiveJobOrders(true);
    } catch (err: any) {
      console.warn('Backend save error:', err);
      const errorMsg = err.response?.data?.detail || err.message || 'Unknown error occurred';
      if (errorMsg.toLowerCase().includes('accreditation')) {
        showToast(`Validation Error: ${errorMsg}. Cannot open job order without valid employer accreditation.`);
      } else {
        showToast(`Error saving job order: ${errorMsg}`);
      }
      // Do not update local state on error to prevent out-of-sync UI
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (id: string) => {
    const o = orders.find(o => o.id === id);
    setOrders(p => p.filter(o => o.id !== id));
    try {
      await api.delete(`/job-orders/${id}`);
      showToast(`"${o?.code} ${o?.position}" deleted from database`);
      await fetchLiveJobOrders(true);
    } catch (err) {
      console.warn('Backend delete error, removed locally:', err);
      showToast(`"${o?.code} ${o?.position}" removed`);
    }
  };

  const addDetailedTag = (category: 'DOCUMENT' | 'CERTIFICATION', val: string, isMandatory: boolean) => {
    const v = val.trim();
    if (!v || !editing) return;
    const exists = editing.detailedRequirements?.some(r => r.name.toLowerCase() === v.toLowerCase());
    if (exists) return;
    setEditing(p => p ? {
      ...p,
      detailedRequirements: [...(p.detailedRequirements || []), { name: v, category, isMandatory }],
      [category === 'DOCUMENT' ? 'requirements' : 'certifications']: [...p[category === 'DOCUMENT' ? 'requirements' : 'certifications'], v]
    } : p);
    if (category === 'DOCUMENT') { setReqInput(''); setReqIsMandatory(true); }
    else { setCertInput(''); setCertIsMandatory(true); }
  };

  const removeDetailedTag = (category: 'DOCUMENT' | 'CERTIFICATION', val: string) => {
    setEditing(p => p ? {
      ...p,
      detailedRequirements: (p.detailedRequirements || []).filter(r => r.name !== val),
      [category === 'DOCUMENT' ? 'requirements' : 'certifications']: p[category === 'DOCUMENT' ? 'requirements' : 'certifications'].filter(x => x !== val)
    } : p);
  };

  const onEmployerChange = (empId: string) => {
    const emp = employers.find(e => e.id === empId);
    setEditing(p => p ? { 
      ...p, 
      employerId: empId, 
      employerName: emp?.companyName || '', 
      country: (p.country && p.country !== 'International' ? p.country : emp?.country) || 'International' 
    } : p);
  };

  const stats = {
    open: orders.filter(o => o.status === 'open').length,
    totalSlots: orders.filter(o => o.status === 'open').reduce((s, o) => s + (o.slots - o.filledSlots), 0),
    filled: orders.filter(o => o.status === 'filled').length,
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => <Star key={n} size={11} className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />)}
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
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-4 px-5 py-4">
                  <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-16 rounded" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-3 w-28 bg-slate-100" />
                      <Skeleton className="h-3 w-20 bg-slate-100" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <SkeletonBadge />
                    <SkeletonBadge className="w-16" />
                  </div>
                </div>
                <div className="px-5 py-2 border-t border-slate-100">
                  <Skeleton className="h-1.5 w-full rounded-full bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-400 text-sm">
            No job orders found matching your search.
          </div>
        ) : (
          filtered.map(order => {
            const meta = STATUS_META[order.status];
            const emp = employers.find(e => e.id === order.employerId);
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
                      {order.genderPreference && order.genderPreference !== 'Any' && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          order.genderPreference === 'Female'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}>
                          {order.genderPreference === 'Female' ? '♀ Female Only' : '♂ Male Only'}
                        </span>
                      )}
                      {(order.minAge || order.maxAge) && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          Age: {order.minAge || 21}–{order.maxAge || 45} yrs
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1"><Globe size={11} /> {order.country}</span>
                      <span className="flex items-center gap-1"><Building2 size={11} /> {order.employerName}</span>
                      <span className="flex items-center gap-1"><DollarSign size={11} /> {order.salaryCurrency} {order.salaryMin} - {order.salaryMax}</span>
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
                          <div><span className="text-slate-400 text-xs">Contract:</span> {order.contractMonths} months</div>
                          <div><span className="text-slate-400 text-xs">Min. Experience:</span> {order.minExperience} yr{order.minExperience !== 1 ? 's' : ''}</div>
                          <div><span className="text-slate-400 text-xs">Gender:</span> {order.genderPreference === 'Female' ? 'Female Only' : order.genderPreference === 'Male' ? 'Male Only' : 'All Genders (Open)'}</div>
                          <div><span className="text-slate-400 text-xs">Age Range:</span> {order.minAge || 21} to {order.maxAge || 45} yrs</div>
                          <div><span className="text-slate-400 text-xs">Posted:</span> {order.datePosted}</div>
                          <div><span className="text-slate-400 text-xs">Deadline:</span> {order.deadline}</div>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Required Documents</div>
                        <div className="flex flex-wrap gap-1.5">
                          {order.detailedRequirements && order.detailedRequirements.length > 0 ? (
                            order.detailedRequirements.filter(r => r.category === 'DOCUMENT').map(r => (
                              <span key={r.name} className={`text-xs px-2 py-0.5 rounded-full ${r.isMandatory ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                {r.name} {!r.isMandatory && '(Optional)'}
                              </span>
                            ))
                          ) : (
                            order.requirements.map(r => (
                              <span key={r} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{r}</span>
                            ))
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Required Certifications</div>
                        <div className="flex flex-wrap gap-1.5">
                          {order.detailedRequirements && order.detailedRequirements.length > 0 ? (
                            order.detailedRequirements.filter(r => r.category === 'CERTIFICATION').length > 0 ? (
                              order.detailedRequirements.filter(r => r.category === 'CERTIFICATION').map(c => (
                                <span key={c.name} className={`text-xs px-2 py-0.5 rounded-full ${c.isMandatory ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                                  {c.name} {!c.isMandatory && '(Optional)'}
                                </span>
                              ))
                            ) : <span className="text-xs text-slate-400 italic">None specified</span>
                          ) : (
                            order.certifications.length > 0
                              ? order.certifications.map(c => <span key={c} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{c}</span>)
                              : <span className="text-xs text-slate-400 italic">None specified</span>
                          )}
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
          }))}
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Employer *</label>
                    <button type="button" onClick={() => {
                      const name = prompt('Enter new employer name:');
                      if (!name) return;
                      const country = prompt('Enter employer country:');
                      if (!country) return;
                      const payload = { company_name: name, industry: 'General', country: country, registration_status: 'REGISTERED', compliance_status: 'COMPLIANT', star_rating: 3, total_deployed: 0, active_job_orders: 0 };
                      api.post('/employers', payload).then(res => {
                        const newEmp = { id: String(res.data.employer_id), companyName: name, country, industry: 'General', contactPerson: '', contactEmail: '', contactPhone: '', address: '', accreditationNo: '', accreditationExpiry: '', status: 'active' as any, rating: 3 as any, totalDeployed: 0, activeJobOrders: 0, remarks: [], createdAt: new Date().toISOString() };
                        setEmployers(p => [...p, newEmp]);
                        onEmployerChange(newEmp.id);
                        showToast(`Employer "${name}" created.`);
                      }).catch(err => {
                        console.warn('Error creating employer', err);
                        showToast('Failed to create employer inline. Try from Employers page.');
                      });
                    }} className="text-xs text-[#0EA5E9] hover:underline font-medium">
                      + Create New
                    </button>
                  </div>
                  <select value={editing.employerId} onChange={e => onEmployerChange(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 bg-white">
                    <option value="">-- Select Employer --</option>
                    {employers.filter(e => e.status !== 'blacklisted').map(e => (
                      <option key={e.id} value={e.id}>{e.companyName} ({e.country}){e.status === 'suspended' ? ' ⚠️' : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Country</label>
                  <input 
                    list="country-catalog" 
                    value={editing.country} 
                    onChange={e => setEditing(p => p ? { ...p, country: e.target.value } : p)} 
                    placeholder="e.g. Japan, UAE, Saudi Arabia" 
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] bg-white" 
                  />
                  <datalist id="country-catalog">
                    {catalogCountries.map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Total Slots</label>
                  <input type="number" min={1} value={editing.slots} onChange={e => setEditing(p => p ? { ...p, slots: parseInt(e.target.value) || 1 } : p)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 text-center" />
                </div>
                <div className="grid grid-cols-3 gap-2 col-span-1 md:col-span-2">
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Currency</label>
                    <input value={editing.salaryCurrency} onChange={e => setEditing(p => p ? { ...p, salaryCurrency: e.target.value.toUpperCase() } : p)} maxLength={3} placeholder="USD" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Min Salary</label>
                    <input type="number" value={editing.salaryMin} onChange={e => setEditing(p => p ? { ...p, salaryMin: parseFloat(e.target.value) || 0 } : p)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Max Salary</label>
                    <input type="number" value={editing.salaryMax} onChange={e => setEditing(p => p ? { ...p, salaryMax: parseFloat(e.target.value) || 0 } : p)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Contract Duration (Months)</label>
                  <input type="number" min={1} value={editing.contractMonths} onChange={e => setEditing(p => p ? { ...p, contractMonths: parseInt(e.target.value) || 24 } : p)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]" />
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
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Gender Requirement</label>
                  <select 
                    value={editing.genderPreference || 'Any'} 
                    onChange={e => setEditing(p => p ? { ...p, genderPreference: e.target.value as 'Any' | 'Male' | 'Female' } : p)} 
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 bg-white"
                  >
                    <option value="Any">All Genders (No Preference)</option>
                    <option value="Female">Female Only</option>
                    <option value="Male">Male Only</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Min Age</label>
                    <input 
                      type="number" 
                      min={18} 
                      max={65} 
                      value={editing.minAge ?? 21} 
                      onChange={e => setEditing(p => p ? { ...p, minAge: parseInt(e.target.value) || 18 } : p)} 
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 text-center" 
                      placeholder="21"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Max Age</label>
                    <input 
                      type="number" 
                      min={18} 
                      max={65} 
                      value={editing.maxAge ?? 45} 
                      onChange={e => setEditing(p => p ? { ...p, maxAge: parseInt(e.target.value) || 45 } : p)} 
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 text-center" 
                      placeholder="45"
                    />
                  </div>
                </div>
              </div>

              {/* Requirements tags */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Required Documents</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {editing.detailedRequirements?.filter(r => r.category === 'DOCUMENT').map(r => (
                    <span key={r.name} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${r.isMandatory ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                      {r.name} {!r.isMandatory && '(Optional)'}
                      <button onClick={() => removeDetailedTag('DOCUMENT', r.name)} className="hover:text-red-500 transition-colors ml-1"><X size={11} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <input list="doc-catalog" value={reqInput} onChange={e => setReqInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDetailedTag('DOCUMENT', reqInput, reqIsMandatory); } }} placeholder="Select or type document..." className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]" />
                  <datalist id="doc-catalog">
                    {catalogRequirements.filter(r => r.category === 'DOCUMENT').map(r => (
                      <option key={r.requirement_id} value={r.requirement_name} />
                    ))}
                  </datalist>
                  <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={reqIsMandatory} onChange={e => setReqIsMandatory(e.target.checked)} className="rounded text-[#0EA5E9] focus:ring-[#0EA5E9]" />
                    Mandatory
                  </label>
                  <button onClick={() => addDetailedTag('DOCUMENT', reqInput, reqIsMandatory)} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm transition-colors"><Plus size={15} /></button>
                </div>
              </div>

              {/* Certifications tags */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Required Certifications</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {editing.detailedRequirements?.filter(r => r.category === 'CERTIFICATION').map(r => (
                    <span key={r.name} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${r.isMandatory ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                      {r.name} {!r.isMandatory && '(Optional)'}
                      <button onClick={() => removeDetailedTag('CERTIFICATION', r.name)} className="hover:text-red-500 transition-colors ml-1"><X size={11} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <input list="cert-catalog" value={certInput} onChange={e => setCertInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDetailedTag('CERTIFICATION', certInput, certIsMandatory); } }} placeholder="Select or type certification..." className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]" />
                  <datalist id="cert-catalog">
                    {catalogRequirements.filter(r => r.category === 'CERTIFICATION').map(r => (
                      <option key={r.requirement_id} value={r.requirement_name} />
                    ))}
                  </datalist>
                  <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={certIsMandatory} onChange={e => setCertIsMandatory(e.target.checked)} className="rounded text-[#0EA5E9] focus:ring-[#0EA5E9]" />
                    Mandatory
                  </label>
                  <button onClick={() => addDetailedTag('CERTIFICATION', certInput, certIsMandatory)} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm transition-colors"><Plus size={15} /></button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Notes / Special Instructions</label>
                <textarea value={editing.notes} onChange={e => setEditing(p => p ? { ...p, notes: e.target.value } : p)} rows={3} placeholder="Employer-specific requirements, accommodation, benefits, or internal flags..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 rounded-b-2xl border-t border-slate-200">
              <button onClick={() => setEditing(null)} disabled={isSaving} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50 transition-colors">Cancel</button>
              <button onClick={save} disabled={isSaving} className="flex items-center gap-2 px-5 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors shadow-sm shadow-[#0EA5E9]/20">
                {isSaving ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> {isNew ? 'Creating Job Order...' : 'Saving Changes...'}
                  </>
                ) : (
                  <>
                    <Save size={15} /> {isNew ? 'Create Job Order' : 'Save Changes'}
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
