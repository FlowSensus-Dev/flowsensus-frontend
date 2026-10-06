import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  UserPlus, CheckCircle, AlertTriangle, Camera, Plus, Trash2,
  X, Flag, ShieldAlert, AlertCircle,
  Clock, TrendingDown, GitMerge, Zap, MessageSquare, CheckCircle2,
  Save, User, FileCheck, Upload, Briefcase, Loader2,
  GraduationCap, Award, BookOpen, Languages as LanguagesIcon, ArrowDown,
  HeartHandshake, Share2, Globe, Users, Check, ExternalLink, Search,
  RotateCcw
} from 'lucide-react';
import {
  ActivityLog, ApplicantRecord,
  IdentificationRecord, EducationRecord, CertificateRecord,
  TrainingRecord, LanguageRecord, EmploymentRecord, EmploymentFlag, EmploymentFlagType
} from '../../types';
import InlineApplicantSelector from '../InlineApplicantSelector';
import SearchableJobOrderSelector from '../SearchableJobOrderSelector';
import { api } from '../../../lib/api';
import { mapApplicantFromApi } from '../../../lib/applicantMapper';

// ─── Flag Engine ──────────────────────────────────────────────────────────────

const RED_FLAG_KEYWORDS = ['terminated', 'awol', 'dispute', 'dismissed', 'fired', 'absent without leave', 'medical leave', 'disciplinary'];
const SENIOR_KEYWORDS = ['manager', 'supervisor', 'director', 'head', 'chief', 'lead', 'senior', 'officer', 'superintendent'];
const JUNIOR_KEYWORDS = ['junior', 'assistant', 'helper', 'trainee', 'intern', 'rank and file', 'laborer', 'aide'];

function isValidDate(d: string): boolean {
  if (!d) return false;
  const time = new Date(d).getTime();
  return !isNaN(time);
}

function monthsBetween(a: string, b: string): number {
  const da = new Date(a), db = new Date(b);
  return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth());
}

function analyzeEmployment(records: EmploymentRecord[]): EmploymentFlag[] {
  const flags: EmploymentFlag[] = [];
  const completed = records.filter(r => !r.isPresent && isValidDate(r.dateStarted) && isValidDate(r.dateEnded))
    .sort((a, b) => new Date(a.dateStarted).getTime() - new Date(b.dateStarted).getTime());

  // Short Stint (<6 months)
  for (const r of completed) {
    const months = monthsBetween(r.dateStarted, r.dateEnded);
    if (months >= 0 && months < 6) {
      flags.push({
        id: `stint-${r.id}`, type: 'short_stint', severity: 'warning',
        description: `Short tenure of ${months} month${months !== 1 ? 's' : ''} at "${r.company || 'Employer'}" as ${r.position || 'N/A'}. Short stints may signal instability or issues.`,
        relatedJobIds: [r.id], dismissed: false,
      });
    }
  }

  // Gap Rule (>3 months between jobs)
  for (let i = 0; i < completed.length - 1; i++) {
    const gap = monthsBetween(completed[i].dateEnded, completed[i + 1].dateStarted);
    if (gap > 3) {
      flags.push({
        id: `gap-${completed[i].id}-${completed[i + 1].id}`, type: 'gap', severity: 'warning',
        description: `${gap}-month employment gap between "${completed[i].company || 'Employer'}" and "${completed[i + 1].company || 'Employer'}". Applicant should explain this period.`,
        relatedJobIds: [completed[i].id, completed[i + 1].id], dismissed: false,
      });
    }
  }

  // Overlap Rule
  for (let i = 0; i < completed.length - 1; i++) {
    for (let j = i + 1; j < completed.length; j++) {
      if (new Date(completed[j].dateStarted) < new Date(completed[i].dateEnded)) {
        flags.push({
          id: `overlap-${completed[i].id}-${completed[j].id}`, type: 'overlap', severity: 'warning',
          description: `Employment overlap: "${completed[j].company || 'Employer'}" started (${completed[j].dateStarted}) before "${completed[i].company || 'Employer'}" ended (${completed[i].dateEnded}). May indicate moonlighting or a data entry error.`,
          relatedJobIds: [completed[i].id, completed[j].id], dismissed: false,
        });
      }
    }
  }

  // Red Flag Resignation
  for (const r of records) {
    if (!r.reasonForLeaving) continue;
    const lower = r.reasonForLeaving.toLowerCase();
    const hit = RED_FLAG_KEYWORDS.find(k => lower.includes(k));
    if (hit) {
      flags.push({
        id: `resign-${r.id}`, type: 'red_flag_resignation', severity: 'critical',
        description: `Reason for leaving "${r.company || 'Employer'}" contains high-risk keyword: "${hit.toUpperCase()}". This must be clarified before proceeding to evaluation.`,
        relatedJobIds: [r.id], dismissed: false,
      });
    }
  }

  // Demotion Rule
  for (let i = 0; i < completed.length - 1; i++) {
    const cur = (completed[i].position || '').toLowerCase();
    const nxt = (completed[i + 1].position || '').toLowerCase();
    const curSenior = SENIOR_KEYWORDS.some(k => cur.includes(k));
    const nxtJunior = JUNIOR_KEYWORDS.some(k => nxt.includes(k));
    if (curSenior && nxtJunior) {
      flags.push({
        id: `demotion-${completed[i].id}-${completed[i + 1].id}`, type: 'demotion', severity: 'warning',
        description: `Possible demotion from "${completed[i].position}" (${completed[i].company || 'Employer'}) to "${completed[i + 1].position}" (${completed[i + 1].company || 'Employer'}). Verify circumstances.`,
        relatedJobIds: [completed[i].id, completed[i + 1].id], dismissed: false,
      });
    }
  }

  return flags;
}

const FLAG_META: Record<EmploymentFlagType, { label: string; icon: React.ReactNode; color: string }> = {
  gap: { label: 'Employment Gap', icon: <Clock size={15} />, color: '#F59E0B' },
  short_stint: { label: 'Short Tenure', icon: <Zap size={15} />, color: '#F97316' },
  red_flag_resignation: { label: 'Resignation Red Flag', icon: <ShieldAlert size={15} />, color: '#EF4444' },
  overlap: { label: 'Date Overlap', icon: <GitMerge size={15} />, color: '#8B5CF6' },
  demotion: { label: 'Possible Demotion', icon: <TrendingDown size={15} />, color: '#EC4899' },
};

// ─── Shared input/table styles ─────────────────────────────────────────────────
const inp = 'w-full border border-slate-200 px-2.5 py-1.5 text-sm focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9]/20 outline-none rounded-lg bg-white';
const th = 'px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50';
const td = 'px-3 py-2 text-sm align-middle';

// ─── Identification Types ──────────────────────────────────────────────────────
const ID_TYPES = ['Passport', 'OWWA', 'TESDA', "Seaman's Book", 'UMID', "Driver's License", 'SSS', 'PhilHealth', 'Postal ID', 'Voter\'s ID', 'PRC License'];
const EDU_LEVELS = ['Elementary', 'Junior High School', 'Senior High School', 'Vocational / ALS', 'College', 'Post-Graduate'];
const LANG_COMPETENCY = ['Basic', 'Conversational', 'Proficient', 'Fluent', 'Native'];

// ─── Section component ─────────────────────────────────────────────────────────
function Section({
  title,
  children,
  accent = false,
  icon,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  accent?: boolean;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border ${accent ? 'border-[#0EA5E9]/30 bg-[#0EA5E9]/5' : 'border-slate-200 bg-white'} overflow-hidden shadow-sm`}>
      <div className={`px-5 py-3.5 border-b ${accent ? 'border-[#0EA5E9]/20 bg-[#0EA5E9]/10' : 'border-slate-100 bg-slate-50/80'} flex items-center justify-between flex-wrap gap-2`}>
        <div className="flex items-center gap-2">
          {icon && <span className="text-[#0EA5E9]">{icon}</span>}
          <h3 className={`text-sm font-bold ${accent ? 'text-[#0284C7]' : 'text-[#0F172A]'} uppercase tracking-wider`}>{title}</h3>
        </div>
        {badge}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────
interface RegistrationProps {
  showToast: (message: string) => void;
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  selectedApplicantId?: string;
  updateApplicant?: (applicantId: string, updates: Partial<ApplicantRecord>) => void;
  addApplicant?: (newApplicant: ApplicantRecord) => void;
  applicants?: ApplicantRecord[];
  globalJobOrders?: any[];
  addExpense?: (expense: Omit<ExpenseRecord, 'id'>) => void;
}

const BLANK_PERSONAL = {
  firstName: '', middleName: '', lastName: '',
  email: '', contact: '',
  dateOfBirth: '', age: '', sex: '',
  religion: '', civilStatus: '',
  weight: '', height: '',
  presentAddress: '',
  provincialAddress: '',
  role: '',
  placeOfBirth: '',
  noOfChildren: '0',
  indigenousCommunity: '',
  emergencyContactName: '',
  emergencyContactRelationship: 'Spouse',
  emergencyContactNumber: '',
  facebookUrl: '',
  whatsappNumber: '',
  linkedinUrl: '',
};

// Applicant classification codes
const OFW_EXCLUSIVE_CODES = ['FIRST_TIME_OFW', 'RETURNING_OFW'];
const CLASSIFICATION_CHIPS = [
  { code: 'FIRST_TIME_OFW',    label: 'First-Time OFW',     color: 'emerald' },
  { code: 'RETURNING_OFW',     label: 'Returning OFW',      color: 'sky'     },
  { code: 'MUSLIM',            label: 'Muslim',             color: 'violet'  },
  { code: 'INDIGENOUS_PEOPLES',label: 'Indigenous Peoples', color: 'amber'   },
];

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Registration({
  showToast, currentUserName, addActivityLog,
  selectedApplicantId: initialId = 'new',
  updateApplicant, addApplicant, applicants = [],
  globalJobOrders,
  addExpense,
}: RegistrationProps) {
  const [selectedApplicantId, setSelectedApplicantId] = useState(initialId);
  const currentApplicant = applicants.find((a) => String(a.id) === String(selectedApplicantId));
  const [activeSection, setActiveSection] = useState<string>('personal');
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Enrichment Loading State ──────────────────────────────────────────────
  const [isLoadingEnriched, setIsLoadingEnriched] = useState(false);
  const [isEnrichedLoaded, setIsEnrichedLoaded] = useState(initialId === 'new');

  // ── Job Order State ───────────────────────────────────────────────────────
  const [selectedJobOrderId, setSelectedJobOrderId] = useState('');
  const [openJobOrders, setOpenJobOrders] = useState<any[]>([]);
  const [isLoadingJobOrders, setIsLoadingJobOrders] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [showRevertConfirmModal, setShowRevertConfirmModal] = useState(false);

  // ── Lookups and Catalogs (Datalist auto-complete with free typing) ────────
  const [availableIdTypes, setAvailableIdTypes] = useState<string[]>(ID_TYPES);
  const [availableCertifications, setAvailableCertifications] = useState<string[]>([]);
  const [availableRequirements, setAvailableRequirements] = useState<any[]>([]);
  const [availableSkills, setAvailableSkills] = useState<string[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);

  useEffect(() => {
    // 1. Identification Types from Supabase
    api.get('/lookups/identification-types').then(res => {
      if (Array.isArray(res.data) && res.data.length > 0) {
        const fromDb = res.data.map((t: any) => t.type_name || t.type_code).filter(Boolean);
        setAvailableIdTypes(Array.from(new Set([...fromDb, ...ID_TYPES])));
      }
    }).catch(() => {});

    // 2. All Requirements & Certifications from Supabase
    api.get('/requirements').then(res => {
      if (Array.isArray(res.data) && res.data.length > 0) {
        setAvailableRequirements(res.data);
        const certs = res.data
          .filter((r: any) => r.category === 'CERTIFICATION')
          .map((r: any) => r.requirement_name)
          .filter(Boolean);
        setAvailableCertifications(certs);
      }
    }).catch(() => {});

    // 3. Skills Catalog from Supabase
    api.get('/lookups/skills').then(res => {
      if (Array.isArray(res.data) && res.data.length > 0) {
        const sList = res.data.map((s: any) => s.skill_name).filter(Boolean);
        setAvailableSkills(sList);
      }
    }).catch(() => {});

    // 4. Languages from Supabase
    api.get('/lookups/languages').then(res => {
      if (Array.isArray(res.data) && res.data.length > 0) {
        const lList = res.data.map((l: any) => l.language_name).filter(Boolean);
        setAvailableLanguages(lList);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchLiveJobOrders = async () => {
      setIsLoadingJobOrders(true);
      try {
        const res = globalJobOrders ? { data: globalJobOrders } : await api.get('/job-orders');
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const liveOrders = res.data.map((jo: any) => ({
            id: jo.job_order_code || jo.job_code || (jo.job_order_id ? `JO-2026-${String(jo.job_order_id).padStart(4, '0')}` : `JO-${jo.job_order_id}`),
            code: jo.job_order_code || jo.job_code || (jo.job_order_id ? `JO-2026-${String(jo.job_order_id).padStart(4, '0')}` : `JO-${jo.job_order_id}`),
            jobOrderId: jo.job_order_id,
            position: jo.position_title || jo.position || 'General Position',
            country: (typeof jo.country === 'string' ? jo.country : jo.country?.country_name) || jo.country_name || jo.client_employer?.country?.country_name || jo.employer?.country?.country_name || 'International',
            employerName: jo.client_employer?.company_name || jo.employer_name || 'Partner Principal',
            employerId: jo.employer_id || jo.client_employer?.employer_id,
            countryId: jo.country_id || jo.client_employer?.country_id,
            available: Math.max(0, (jo.total_slots || jo.slots || 1) - (jo.filled_slots || 0)),
            requirements: Array.isArray(jo.requirements) ? jo.requirements : (Array.isArray(jo.job_order_requirement) ? jo.job_order_requirement.map((r: any) => r.requirement?.requirement_name || r.requirement_name).filter(Boolean) : []),
            detailedRequirements: Array.isArray(jo.detailedRequirements) ? jo.detailedRequirements : (Array.isArray(jo.job_order_requirements) ? jo.job_order_requirements : []),
            genderPreference: jo.gender_preference || jo.genderPreference,
            minAge: jo.min_age ?? jo.minAge,
            maxAge: jo.max_age ?? jo.maxAge,
          }));
          setOpenJobOrders(liveOrders);
        }
      } catch (err) {
        console.warn('Could not fetch live job orders for registration:', err);
      } finally {
        setIsLoadingJobOrders(false);
      }
    };
    fetchLiveJobOrders();
  }, [globalJobOrders]);

  // Proof document upload helper (uploads directly to Supabase Storage)
  const proofUpload = (
    onFile: (dataUrl: string, name: string) => void,
    existingName?: string
  ) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf,.doc,.docx';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      // Local preview immediately
      const reader = new FileReader();
      reader.onload = (ev) => onFile(ev.target?.result as string, file.name);
      reader.readAsDataURL(file);

      // Upload directly to Supabase Storage
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post('/applicants/upload-document', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (res.data?.url) {
          onFile(res.data.url, file.name);
        }
      } catch (err) {
        console.warn('Document upload to Supabase fallback:', err);
      }
    };
    input.click();
  };

  const [photo, setPhoto] = useState('');
  const [personal, setPersonal] = useState(BLANK_PERSONAL);
  const setP = (k: string, v: string) => setPersonal(p => ({ ...p, [k]: v }));

  // ── Applicant Classification ──────────────────────────────────────────────
  const [selectedApplicantTypes, setSelectedApplicantTypes] = useState<string[]>([]);
  const handleToggleApplicantType = (code: string) => {
    setSelectedApplicantTypes(prev => {
      if (prev.includes(code)) {
        // Deselect
        return prev.filter(c => c !== code);
      }
      // Select — if it's an OFW exclusive code, remove the other OFW code first
      let next = [...prev];
      if (OFW_EXCLUSIVE_CODES.includes(code)) {
        next = next.filter(c => !OFW_EXCLUSIVE_CODES.includes(c));
      }
      return [...next, code];
    });
  };

  const isIndigenousSelected = selectedApplicantTypes.includes('INDIGENOUS_PEOPLES');

  const handleRemovePhoto = async () => {
    if (!photo) return;
    const photoToDelete = photo;
    setPhoto('');

    if (photoToDelete.startsWith('http')) {
      try {
        await api.delete('/applicants/photo', {
          data: {
            photo_url: photoToDelete,
            applicant_id: selectedApplicantId !== 'new' ? parseInt(selectedApplicantId, 10) : undefined,
          },
        });
        showToast('Photo removed.');
      } catch (err) {
        console.warn('Could not delete photo from Supabase Storage:', err);
      }
    } else {
      showToast('Photo removed.');
    }
  };

  const calcAge = (dob: string) => {
    if (!dob) return '';
    const diff = Date.now() - new Date(dob).getTime();
    return String(Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)));
  };

  // ── Identifications ───────────────────────────────────────────────────────
  const [ids, setIds] = useState<IdentificationRecord[]>([]);
  const addId = () => setIds(p => [...p, { id: `id-${Date.now()}`, type: '', identificationNo: '', expiryDate: '' }]);
  const setId = (id: string, k: keyof IdentificationRecord, v: string) => setIds(p => p.map(x => x.id === id ? { ...x, [k]: v } : x));
  const removeId = (id: string) => setIds(p => p.filter(x => x.id !== id));

  // ── Requirements Checklist ───────────────────────────────────────────────
  const [applicantRequirements, setApplicantRequirements] = useState<Array<{
    applicant_req_id?: number;
    requirement_id?: number;
    name: string;
    category: string;
    status: string;
    is_mandatory?: boolean;
    expiration_date?: string;
    issue_date?: string;
  }>>([]);
  const [reqInput, setReqInput] = useState('');
  const [reqCategory, setReqCategory] = useState<'DOCUMENT' | 'CERTIFICATION' | 'MEDICAL' | 'OTHER'>('DOCUMENT');
  const [reqStatus, setReqStatus] = useState<string>('PENDING');
  const [reqIsMandatory, setReqIsMandatory] = useState<boolean>(true);

  const addApplicantRequirement = (name: string, category = reqCategory, status = reqStatus, isMandatory = reqIsMandatory) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (applicantRequirements.some(r => r.name.toLowerCase() === trimmed.toLowerCase())) {
      showToast(`"${trimmed}" is already in requirements checklist.`);
      return;
    }
    const matched = availableRequirements.find(r => (r.requirement_name || '').toLowerCase() === trimmed.toLowerCase());
    setApplicantRequirements(prev => [
      ...prev,
      {
        requirement_id: matched?.requirement_id,
        name: matched?.requirement_name || trimmed,
        category: matched?.category || category,
        status: status,
        is_mandatory: isMandatory,
      }
    ]);
    setReqInput('');
  };

  const removeApplicantRequirement = (name: string) => {
    setApplicantRequirements(prev => prev.filter(r => r.name !== name));
  };

  const setApplicantReqField = (name: string, field: string, value: any) => {
    setApplicantRequirements(prev => prev.map(r => {
      if (r.name === name) {
        if (field === 'status' && (value === 'SUBMITTED' || value === 'VERIFIED') && r.status !== 'SUBMITTED' && r.status !== 'VERIFIED') {
          // Auto-sync for document processing fees is handled globally in AppShell.tsx
        }
        return { ...r, [field]: value };
      }
      return r;
    }));
  };

  // ── Education ─────────────────────────────────────────────────────────────
  const [education, setEducation] = useState<EducationRecord[]>([]);
  const addEdu = () => setEducation(p => [...p, { id: `edu-${Date.now()}`, level: '', school: '', course: '', yearGraduated: '' }]);
  const setEdu = (id: string, k: keyof EducationRecord, v: string) => setEducation(p => p.map(x => x.id === id ? { ...x, [k]: v } : x));
  const removeEdu = (id: string) => setEducation(p => p.filter(x => x.id !== id));

  // ── Core Skills ────────────────────────────────────────────────────────────
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const addSkill = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    if (skills.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      showToast(`"${trimmed}" is already in skills list.`);
      return;
    }
    setSkills(prev => [...prev, trimmed]);
    setSkillInput('');
  };
  const removeSkill = (skillToRemove: string) => {
    setSkills(prev => prev.filter(s => s !== skillToRemove));
  };

  // ── Certificates ──────────────────────────────────────────────────────────
  const [certs, setCerts] = useState<CertificateRecord[]>([]);
  const addCert = () => setCerts(p => [...p, { id: `cert-${Date.now()}`, title: '', serialNo: '', issuedBy: '', noOfHours: '', competencyDateIssued: '', expiryDate: '' }]);
  const setCert = (id: string, k: keyof CertificateRecord, v: string) => setCerts(p => p.map(x => x.id === id ? { ...x, [k]: v } : x));
  const removeCert = (id: string) => setCerts(p => p.filter(x => x.id !== id));

  // ── Trainings ─────────────────────────────────────────────────────────────
  const [trainings, setTrainings] = useState<TrainingRecord[]>([]);
  const addTraining = () => setTrainings(p => [...p, { id: `tr-${Date.now()}`, trainingName: '', certNo: '', duration: '', noOfHours: '', conductedBy: '', skillsAcquired: '' }]);
  const setTraining = (id: string, k: keyof TrainingRecord, v: string) => setTrainings(p => p.map(x => x.id === id ? { ...x, [k]: v } : x));
  const removeTraining = (id: string) => setTrainings(p => p.filter(x => x.id !== id));

  // ── Languages ─────────────────────────────────────────────────────────────
  const [languages, setLanguages] = useState<LanguageRecord[]>([]);
  const addLang = () => setLanguages(p => [...p, { id: `lang-${Date.now()}`, language: '', competency: 'Basic', spokenRating: 5, writtenRating: 5 }]);
  const setLang = (id: string, k: keyof LanguageRecord, v: string | number) => setLanguages(p => p.map(x => x.id === id ? { ...x, [k]: v } : x));
  const removeLang = (id: string) => setLanguages(p => p.filter(x => x.id !== id));

  // ── Employment History ────────────────────────────────────────────────────
  const [employment, setEmployment] = useState<EmploymentRecord[]>([]);
  const [flags, setFlags] = useState<EmploymentFlag[]>([]);
  const [flagsAnalyzed, setFlagsAnalyzed] = useState(false);
  const [resolvingFlagId, setResolvingFlagId] = useState<string | null>(null);
  const [selectedQuickReason, setSelectedQuickReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  // ── Clear form helper ─────────────────────────────────────────────────────
  const resetBlankForm = () => {
    setPersonal(BLANK_PERSONAL);
    setSelectedApplicantTypes([]);
    setSelectedJobOrderId('');
    setIds([]);
    setApplicantRequirements([]);
    setReqInput('');
    setEducation([]);
    setSkills([]);
    setSkillInput('');
    setCerts([]);
    setTrainings([]);
    setLanguages([]);
    setEmployment([]);
    setFlags([]);
    setFlagsAnalyzed(true);
    setPhoto('');
    setResolvingFlagId(null);
    setSelectedQuickReason('');
    setCustomReason('');
  };

  const populateApplicantData = useCallback((app: ApplicantRecord) => {
    // Normalize civilStatus to Title Case regardless of what DB returns (e.g. 'MARRIED' -> 'Married')
    const rawCivil = String(app.civilStatus || '').trim().toLowerCase();
    const normalizedCivilStatus: string =
      rawCivil === 'married' ? 'Married' :
      rawCivil === 'widowed' ? 'Widowed' :
      rawCivil === 'separated' ? 'Separated' :
      rawCivil === 'divorced' ? 'Divorced' :
      'Single';

    // Normalize sex to Title Case (e.g. 'FEMALE' -> 'Female')
    const rawSex = String(app.sex || '').trim().toLowerCase();
    const normalizedSex: 'Male' | 'Female' = (rawSex === 'female' || rawSex === 'f') ? 'Female' : 'Male';

    setPersonal({
      firstName: app.firstName || (app as any).first_name || '',
      middleName: app.middleName || (app as any).middle_name || '',
      lastName: app.lastName || (app as any).last_name || '',
      email: app.email || '',
      contact: app.contact || '',
      dateOfBirth: app.dateOfBirth || '',
      age: String(app.age || ''),
      sex: normalizedSex,
      religion: app.religion || 'Roman Catholic',
      civilStatus: normalizedCivilStatus,
      weight: app.weightKg ? String(app.weightKg) : ((app as any).weight_kg ? String((app as any).weight_kg) : ''),
      height: app.heightCm ? String(app.heightCm) : ((app as any).height_cm ? String((app as any).height_cm) : ''),
      presentAddress: app.presentAddress || '',
      provincialAddress: app.provincialAddress || '',
      role: app.role || '',
      placeOfBirth: app.placeOfBirth || '',
      noOfChildren: String(app.noOfChildren ?? 0),
      indigenousCommunity: app.indigenousCommunity || '',
      emergencyContactName: app.emergencyContactName || '',
      emergencyContactRelationship: app.emergencyContactRelationship || 'Spouse',
      emergencyContactNumber: app.emergencyContactNumber || '',
      facebookUrl: app.facebookUrl || '',
      whatsappNumber: app.whatsappNumber || '',
      linkedinUrl: app.linkedinUrl || '',
    });
    setSelectedApplicantTypes(app.applicantTypes || []);
    const initialJo = app.selectedJobOrderId || (app.jobOrder && app.jobOrder !== 'Unassigned' ? app.jobOrder : '');
    setSelectedJobOrderId(initialJo);
    if (app.identifications && app.identifications.length > 0) setIds(app.identifications);
    else setIds([]);
    if (app.requirements && app.requirements.length > 0) setApplicantRequirements(app.requirements);
    else setApplicantRequirements([]);
    if (app.education && app.education.length > 0) setEducation(app.education);
    else setEducation([]);
    if (app.skills && Array.isArray(app.skills) && app.skills.length > 0) setSkills([...app.skills]);
    else setSkills([]);
    setSkillInput('');
    if (app.certificateRecords && app.certificateRecords.length > 0) setCerts(app.certificateRecords);
    else setCerts([]);
    if (app.trainings && app.trainings.length > 0) setTrainings(app.trainings);
    else setTrainings([]);
    if (app.languageRecords && app.languageRecords.length > 0) setLanguages(app.languageRecords);
    else setLanguages([]);
    if (app.employmentHistory && app.employmentHistory.length > 0) setEmployment(app.employmentHistory);
    else setEmployment([]);
    if (app.employmentFlags && app.employmentFlags.length > 0) {
      setFlags(app.employmentFlags);
      setFlagsAnalyzed(true);
    } else {
      setFlags([]);
      setFlagsAnalyzed(true);
    }
    setPhoto(app.photo || app.photoDataUrl || (app as any).photo_url || (app as any).photoUrl || '');
    setResolvingFlagId(null);
    setSelectedQuickReason('');
    setCustomReason('');
  }, []);

  // ── Sync with prop when parent changes applicant selection ───────────────
  useEffect(() => {
    if (initialId) {
      setSelectedApplicantId(initialId);
    }
  }, [initialId]);

  // ── Sync form data when selecting applicant from prop ─────────────────────
  const initializedForApplicantId = useRef<string | null>(null);
  useEffect(() => {
    if (initializedForApplicantId.current === selectedApplicantId) return;

    if (selectedApplicantId === 'new') {
      resetBlankForm();
      setIsLoadingEnriched(false);
      setIsEnrichedLoaded(true);
      initializedForApplicantId.current = 'new';
      return;
    }

    // Immediately pre-populate basic demographic info if available in list
    const app = applicants.find(a => String(a.id) === String(selectedApplicantId));
    if (app) {
      populateApplicantData(app);
    }

    // Directly fetch enriched applicant profile via GET /applicants/{id}
    setIsLoadingEnriched(true);
    setIsEnrichedLoaded(false);

    let isMounted = true;
    api.get(`/applicants/${selectedApplicantId}`)
      .then(res => {
        if (!isMounted) return;
        if (res.data) {
          const enriched = mapApplicantFromApi(res.data);
          const existingApp = applicants.find(a => String(a.id) === String(selectedApplicantId));
          const effectiveStatus = existingApp?.status || enriched.status;
          const effectivePhase = existingApp?.phase ?? enriched.phase;
          const effectiveHandler = existingApp?.currentHandler || enriched.currentHandler;
          const effectiveDept = existingApp?.currentDepartment || enriched.currentDepartment;
          const effectiveDesc = existingApp?.phaseDescription || enriched.phaseDescription;

          enriched.status = effectiveStatus;
          enriched.phase = effectivePhase;
          enriched.currentHandler = effectiveHandler;
          enriched.currentDepartment = effectiveDept;
          enriched.phaseDescription = effectiveDesc;

          populateApplicantData(enriched);
          updateApplicant?.(selectedApplicantId, {
            ...enriched,
            status: effectiveStatus,
            phase: effectivePhase,
            currentHandler: effectiveHandler,
            currentDepartment: effectiveDept,
            phaseDescription: effectiveDesc,
          });
        }
      })
      .catch(err => {
        console.warn('Failed to fetch full applicant details:', err);
        showToast('Warning: Could not fetch complete child records for this applicant.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingEnriched(false);
          setIsEnrichedLoaded(true);
          initializedForApplicantId.current = selectedApplicantId;
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedApplicantId, applicants, populateApplicantData, updateApplicant, showToast]);

  const QUICK_REASONS = [
    "Applicant provided satisfactory verbal explanation",
    "Supporting documents provided and verified",
    "Short stint was OJT / probationary period",
    "Employment gap explained — family or personal emergency",
    "Employment gap explained — continued education or training",
    "Employment gap explained — illness or medical treatment",
    "Termination was end-of-contract, not disciplinary action",
    "Overlap was part-time / freelance work (verified by applicant)",
    "Employer reference confirmed the circumstances",
    "Demotion was voluntary — career shift or personal choice",
    "Other (see details below)",
  ];

  const addEmp = () => setEmployment(p => [...p, { id: `eh-${Date.now()}`, company: '', position: '', dateStarted: '', dateEnded: '', country: 'Philippines', isPresent: false, reasonForLeaving: '' }]);
  const setEmp = (id: string, k: keyof EmploymentRecord, v: string | boolean) => {
    setEmployment(p => p.map(x => x.id === id ? { ...x, [k]: v, ...(k === 'isPresent' && v ? { dateEnded: '' } : {}) } : x));
  };
  const removeEmp = (id: string) => { setEmployment(p => p.filter(x => x.id !== id)); };

  // ── Auto-Flag Engine (runs reactively on employment changes) ────────────────
  useEffect(() => {
    if (employment.length === 0) {
      setFlags([]);
      setFlagsAnalyzed(true);
      return;
    }

    const detected = analyzeEmployment(employment);

    setFlags(prevFlags => {
      // Preserve standalone flags loaded from profile/DB not tied to job IDs
      const standalone = prevFlags.filter(oldF => !oldF.relatedJobIds || oldF.relatedJobIds.length === 0);

      const mapped = detected.map(newF => {
        // Find existing matching flag to preserve dismissal / validation state
        const existing = prevFlags.find(oldF =>
          oldF.id === newF.id ||
          (oldF.type === newF.type &&
            oldF.relatedJobIds &&
            newF.relatedJobIds &&
            oldF.relatedJobIds.length === newF.relatedJobIds.length &&
            oldF.relatedJobIds.every(id => newF.relatedJobIds.includes(id)))
        );
        if (existing && (existing.dismissed || (existing as any).validated)) {
          return {
            ...newF,
            dismissed: existing.dismissed,
            dismissedBy: existing.dismissedBy,
            dismissalReason: existing.dismissalReason,
            dismissedAt: existing.dismissedAt,
            validated: (existing as any).validated,
            validatedBy: (existing as any).validatedBy,
            validationReason: (existing as any).validationReason,
            validatedAt: (existing as any).validatedAt,
          };
        }
        return newF;
      });

      return [...mapped, ...standalone];
    });
    setFlagsAnalyzed(true);
  }, [employment]);

  const runFlagEngine = () => {
    if (employment.length === 0) {
      showToast('No employment records to evaluate.');
      return;
    }
    const detected = analyzeEmployment(employment);
    setFlags(prevFlags => {
      const standalone = prevFlags.filter(oldF => !oldF.relatedJobIds || oldF.relatedJobIds.length === 0);
      const mapped = detected.map(newF => {
        const existing = prevFlags.find(oldF =>
          oldF.id === newF.id ||
          (oldF.type === newF.type &&
            oldF.relatedJobIds &&
            newF.relatedJobIds &&
            oldF.relatedJobIds.length === newF.relatedJobIds.length &&
            oldF.relatedJobIds.every(id => newF.relatedJobIds.includes(id)))
        );
        if (existing && (existing.dismissed || (existing as any).validated)) {
          return {
            ...newF,
            dismissed: existing.dismissed,
            dismissedBy: existing.dismissedBy,
            dismissalReason: existing.dismissalReason,
            dismissedAt: existing.dismissedAt,
            validated: (existing as any).validated,
            validatedBy: (existing as any).validatedBy,
            validationReason: (existing as any).validationReason,
            validatedAt: (existing as any).validatedAt,
          };
        }
        return newF;
      });
      return [...mapped, ...standalone];
    });
    setFlagsAnalyzed(true);
    if (detected.length === 0) showToast('Employment history verified — no flags raised.');
    else showToast(`${detected.length} concern${detected.length > 1 ? 's' : ''} detected in employment history.`);
  };

  const resolveFlag = (flagId: string) => {
    const final = selectedQuickReason === 'Other (see details below)'
      ? customReason.trim()
      : selectedQuickReason + (customReason.trim() ? ` — ${customReason.trim()}` : '');
    if (!final) return;
    setFlags(p => p.map(f => f.id === flagId
      ? { ...f, dismissed: true, dismissedBy: currentUserName, dismissalReason: final, dismissedAt: new Date().toISOString() }
      : f
    ));
    setResolvingFlagId(null);
    setSelectedQuickReason('');
    setCustomReason('');
    showToast('Flag resolved and recorded.');
  };

  const openResolve = (flagId: string) => {
    if (resolvingFlagId === flagId) { setResolvingFlagId(null); return; }
    setResolvingFlagId(flagId);
    setSelectedQuickReason('');
    setCustomReason('');
  };

  const activeFlagCount = flags.filter(f => !f.dismissed).length;
  const hasBlockingFlags = flagsAnalyzed && activeFlagCount > 0;

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Form State & Changes Tracking ────────────────────────────────────────
  const isFormFilled = Boolean(
    personal.firstName.trim() ||
    personal.middleName.trim() ||
    personal.lastName.trim() ||
    personal.email.trim() ||
    personal.contact.trim() ||
    personal.dateOfBirth.trim() ||
    personal.weight.trim() ||
    personal.height.trim() ||
    personal.presentAddress.trim() ||
    personal.provincialAddress.trim() ||
    personal.role.trim() ||
    selectedJobOrderId ||
    photo ||
    ids.length > 0 ||
    education.length > 0 ||
    skills.length > 0 ||
    certs.length > 0 ||
    trainings.length > 0 ||
    languages.length > 0 ||
    employment.length > 0
  );

  const hasUnsavedChanges = useMemo(() => {
    if (selectedApplicantId === 'new') return isFormFilled;
    const app = applicants.find(a => String(a.id) === String(selectedApplicantId));
    if (!app) return false;
    return (
      personal.firstName !== (app.firstName || '') ||
      personal.middleName !== (app.middleName || '') ||
      personal.lastName !== (app.lastName || '') ||
      personal.email !== (app.email || '') ||
      personal.contact !== (app.contact || '') ||
      personal.dateOfBirth !== (app.dateOfBirth || '') ||
      personal.sex !== (app.sex || 'Male') ||
      personal.religion !== (app.religion || 'Roman Catholic') ||
      personal.civilStatus !== (app.civilStatus || 'Single') ||
      personal.weight !== (app.weightKg ? String(app.weightKg) : '') ||
      personal.height !== (app.heightCm ? String(app.heightCm) : '') ||
      personal.presentAddress !== (app.presentAddress || '') ||
      personal.provincialAddress !== (app.provincialAddress || '') ||
      personal.role !== (app.role || '') ||
      selectedJobOrderId !== (app.selectedJobOrderId || (app.jobOrder && app.jobOrder !== 'Unassigned' ? app.jobOrder : '')) ||
      photo !== (app.photo || app.photoDataUrl || '') ||
      JSON.stringify(ids) !== JSON.stringify(app.identifications || []) ||
      JSON.stringify(applicantRequirements) !== JSON.stringify(app.requirements || []) ||
      JSON.stringify(education) !== JSON.stringify(app.education || []) ||
      JSON.stringify(skills) !== JSON.stringify(app.skills || []) ||
      JSON.stringify(certs) !== JSON.stringify(app.certificateRecords || []) ||
      JSON.stringify(trainings) !== JSON.stringify(app.trainings || []) ||
      JSON.stringify(languages) !== JSON.stringify(app.languageRecords || []) ||
      JSON.stringify(employment) !== JSON.stringify(app.employmentHistory || [])
    );
  }, [
    selectedApplicantId, applicants, personal, selectedJobOrderId,
    photo, ids, applicantRequirements, education, skills, certs, trainings, languages, employment, isFormFilled
  ]);

  // Cancel button only appears if an applicant is selected or if user has started typing/making changes
  const showCancelButton = selectedApplicantId !== 'new' || isFormFilled;

  // ── Section Completion Tracking & Quick Scroll ───────────────────────────
  const sectionStatus = useMemo(() => {
    return {
      personal: Boolean(personal.firstName.trim() && personal.lastName.trim()),
      identifications: ids.length > 0,
      requirements: applicantRequirements.length > 0,
      education: education.length > 0,
      skills: skills.length > 0,
      certificates: certs.length > 0,
      trainings: trainings.length > 0,
      languages: languages.length > 0,
      employment: employment.length > 0,
    };
  }, [personal, ids, applicantRequirements, education, skills, certs, trainings, languages, employment]);

  const completedCount = useMemo(() => {
    return Object.values(sectionStatus).filter(Boolean).length;
  }, [sectionStatus]);

  const progressPercent = Math.round((completedCount / Object.keys(sectionStatus).length) * 100);

  const scrollToBottom = () => {
    const el = document.getElementById('section-save-actions');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // ── Cancel / Discard Changes ──────────────────────────────────────────────
  const handleCancel = () => {
    if (selectedApplicantId === 'new') {
      if (isFormFilled) {
        setShowClearConfirmModal(true);
      } else {
        showToast('Form is already empty.');
      }
    } else {
      const app = applicants.find(a => String(a.id) === String(selectedApplicantId));
      if (hasUnsavedChanges && app) {
        setShowRevertConfirmModal(true);
      } else {
        setSelectedApplicantId('new');
        resetBlankForm();
        showToast('Returned to blank registration mode.');
      }
    }
  };

  // ── Save Profile (Create New or Update Existing) ──────────────────────────
  const handleSave = async () => {
    if (selectedApplicantId !== 'new' && (!isEnrichedLoaded || isLoadingEnriched)) {
      showToast('Please wait for applicant details to finish loading before saving.');
      return;
    }

    if (!selectedJobOrderId || !selectedJobOrderId.trim()) {
      showToast('Please select a Job Order before saving.');
      return;
    }

    if (!personal.firstName.trim() || !personal.lastName.trim()) {
      showToast('First Name and Last Name are required.');
      return;
    }

    if (employment.length > 0 && !flagsAnalyzed) {
      const newFlags = analyzeEmployment(employment);
      setFlags(newFlags);
      setFlagsAnalyzed(true);
      if (newFlags.some(f => !f.dismissed)) {
        showToast(`${newFlags.length} concern(s) flagged in work experience. Review before proceeding.`);
        return;
      }
    }

    if (hasBlockingFlags) {
      showToast(`Cannot save: ${activeFlagCount} unresolved flag(s) in employment history.`);
      return;
    }

    setIsSubmitting(true);

    try {
      if (selectedApplicantId === 'new') {
        // ── CREATE NEW APPLICANT VIA POST /applicants ───────────────────────
        const selectedJob = openJobOrders.find(j => j.id === selectedJobOrderId || j.code === selectedJobOrderId);
        const payload: any = {
          first_name: personal.firstName.trim(),
          middle_name: personal.middleName.trim() || undefined,
          last_name: personal.lastName.trim(),
          email: personal.email.trim() || undefined,
          contact_number: personal.contact.trim() || undefined,
          birth_date: personal.dateOfBirth || undefined,
          age: personal.age ? parseInt(personal.age, 10) : undefined,
          gender: personal.sex || 'Male',
          sex: personal.sex || 'Male',
          civil_status: personal.civilStatus || 'Single',
          religion: personal.religion || 'Roman Catholic',
          height_cm: personal.height ? parseFloat(personal.height) : undefined,
          weight_kg: personal.weight ? parseFloat(personal.weight) : undefined,
          place_of_birth: personal.placeOfBirth.trim() || undefined,
          no_of_children: personal.noOfChildren ? parseInt(personal.noOfChildren, 10) : 0,
          present_address: personal.presentAddress.trim() || undefined,
          provincial_address: personal.provincialAddress.trim() || undefined,
          applied_role: personal.role.trim() || (selectedJob ? selectedJob.position : 'Applicant'),
          job_order_code: selectedJob ? selectedJob.code : undefined,
          job_order_name: selectedJob ? `${selectedJob.code} (${selectedJob.employerName})` : undefined,
          job_order_id: selectedJob?.jobOrderId ? parseInt(String(selectedJob.jobOrderId), 10) : undefined,
          employer_id: selectedJob?.employerId ? parseInt(String(selectedJob.employerId), 10) : undefined,
          country_id: selectedJob?.countryId ? parseInt(String(selectedJob.countryId), 10) : undefined,
          emergency_contact_name: personal.emergencyContactName.trim() || undefined,
          emergency_contact_relationship: personal.emergencyContactRelationship.trim() || undefined,
          emergency_contact_number: personal.emergencyContactNumber.trim() || undefined,
          is_indigenous: selectedApplicantTypes.includes('INDIGENOUS_PEOPLES'),
          indigenous_community: selectedApplicantTypes.includes('INDIGENOUS_PEOPLES') ? personal.indigenousCommunity?.trim() || undefined : undefined,
          facebook_url: personal.facebookUrl.trim() || undefined,
          whatsapp_number: personal.whatsappNumber.trim() || undefined,
          linkedin_url: personal.linkedinUrl.trim() || undefined,
          applicant_types: selectedApplicantTypes,
          skills: skills.length > 0 ? skills : certs.map((c: any) => c.title || c.name || '').filter(Boolean),
          certifications: certs,
          identifications: ids,
          requirements: applicantRequirements,
          education: education,
          trainings: trainings,
          languages: languages,
          employment_history: employment,
          employment_flags: flags,
          photo_url: photo || undefined,
          status: 'Initial Screening',
          current_handler: currentUserName,
          current_department: 'Recruitment',
          phase_description: 'Newly registered applicant. Cleared for initial screening.',
        };

        const res = await api.post('/applicants', payload);
        const createdData = res.data;
        const newId = String(createdData.applicant_id);

        const newApplicantCode = createdData.applicant_code || (createdData.applicant_id ? `APP-2026-FP-${String(createdData.applicant_id).padStart(5, '0')}` : undefined);

        const newApplicantRecord: ApplicantRecord = {
          id: newId,
          applicantCode: newApplicantCode,
          name: `${personal.firstName} ${personal.lastName}`.trim(),
          firstName: personal.firstName,
          middleName: personal.middleName,
          lastName: personal.lastName,
          role: personal.role || (selectedJob ? selectedJob.position : 'Applicant'),
          jobOrder: selectedJob ? selectedJob.code : 'Unassigned',
          selectedJobOrderId: selectedJob ? selectedJob.code : undefined,
          photo: photo || createdData.photo_url || '',
          photoDataUrl: photo || createdData.photo_url || '',
          phase: 1,
          status: 'Initial Screening',
          currentHandler: currentUserName,
          currentDepartment: 'Recruitment',
          lastUpdated: new Date().toLocaleString(),
          createdAt: createdData.created_at || new Date().toISOString(),
          phaseDescription: 'Newly registered applicant. Cleared for initial screening.',
          presentAddress: personal.presentAddress,
          provincialAddress: personal.provincialAddress,
          email: personal.email,
          contact: personal.contact,
          dateOfBirth: personal.dateOfBirth,
          age: parseInt(personal.age, 10) || 25,
          sex: (personal.sex as 'Male' | 'Female') || 'Male',
          civilStatus: (personal.civilStatus as any) || 'Single',
          citizenship: 'Filipino',
          religion: personal.religion,
          heightCm: personal.height ? parseFloat(personal.height) : undefined,
          weightKg: personal.weight ? parseFloat(personal.weight) : undefined,
          placeOfBirth: personal.placeOfBirth,
          noOfChildren: parseInt(personal.noOfChildren, 10) || 0,
          applicantTypes: selectedApplicantTypes,
          isIndigenous: selectedApplicantTypes.includes('INDIGENOUS_PEOPLES'),
          indigenousCommunity: personal.indigenousCommunity,
          emergencyContactName: personal.emergencyContactName,
          emergencyContactRelationship: personal.emergencyContactRelationship,
          emergencyContactNumber: personal.emergencyContactNumber,
          facebookUrl: personal.facebookUrl,
          whatsappNumber: personal.whatsappNumber,
          linkedinUrl: personal.linkedinUrl,
          skills: skills.length > 0 ? skills : certs.map((c: any) => c.title || c.name || '').filter(Boolean),
          certifications: certs.map((c: any) => c.title || c.name || '').filter(Boolean),
          identifications: ids,
          requirements: applicantRequirements,
          workExperience: payload.work_experience,
          employmentHistory: employment,
          employmentFlags: flags,
          address: personal.presentAddress || personal.provincialAddress,
          testScores: undefined,
          matchScore: 85,
        };

        if (addApplicant) {
          addApplicant(newApplicantRecord);
        }

        addActivityLog({
          applicantId: newId,
          action: 'New Applicant Registered',
          performedBy: currentUserName,
          department: 'Recruitment',
          details: `Registered new applicant ${personal.lastName}, ${personal.firstName} (${newApplicantCode || `#${newId}`}) with active Phase 1 screening.`,
        });

        showToast(`✓ New applicant "${personal.firstName} ${personal.lastName}" registered successfully! (${newApplicantCode || `#${newId}`})`);
        resetBlankForm();
      } else {
        // ── UPDATE EXISTING APPLICANT VIA PUT /applicants/{id} ───────────────
        const numericId = parseInt(selectedApplicantId, 10);
        const selectedJob = openJobOrders.find(j => j.id === selectedJobOrderId || j.code === selectedJobOrderId);
        const currentApp = applicants?.find(a => String(a.id) === String(selectedApplicantId));

        if (!isNaN(numericId)) {
          const updatePayload: any = {
            first_name: personal.firstName.trim(),
            middle_name: personal.middleName?.trim() || null,
            last_name: personal.lastName.trim(),
            email: personal.email?.trim() || null,
            contact_number: personal.contact?.trim() || null,
            birth_date: personal.dateOfBirth || null,
            age: personal.age ? parseInt(personal.age, 10) : null,
            gender: personal.sex || null,
            sex: personal.sex || null,
            civil_status: personal.civilStatus || null,
            religion: personal.religion?.trim() || 'Roman Catholic',
            height_cm: personal.height ? parseFloat(personal.height) : null,
            weight_kg: personal.weight ? parseFloat(personal.weight) : null,
            present_address: personal.presentAddress?.trim() || null,
            provincial_address: personal.provincialAddress?.trim() || null,
            applied_role: personal.role?.trim() || (selectedJob ? selectedJob.position : null),
            place_of_birth: personal.placeOfBirth?.trim() || null,
            no_of_children: personal.noOfChildren ? parseInt(personal.noOfChildren, 10) : 0,
            emergency_contact_name: personal.emergencyContactName?.trim() || null,
            emergency_contact_relationship: personal.emergencyContactRelationship?.trim() || null,
            emergency_contact_number: personal.emergencyContactNumber?.trim() || null,
            is_indigenous: selectedApplicantTypes.includes('INDIGENOUS_PEOPLES'),
            indigenous_community: selectedApplicantTypes.includes('INDIGENOUS_PEOPLES') ? personal.indigenousCommunity?.trim() || null : null,
            facebook_url: personal.facebookUrl?.trim() || null,
            whatsapp_number: personal.whatsappNumber?.trim() || null,
            linkedin_url: personal.linkedinUrl?.trim() || null,
            applicant_types: selectedApplicantTypes,
            skills: skills,
            certifications: certs,
            identifications: ids,
            requirements: applicantRequirements,
            education: education,
            trainings: trainings,
            languages: languages,
            employment_history: employment,
            employment_flags: flags,
            photo_url: photo ? photo : null,
          };

          if (isEnrichedLoaded) {
            updatePayload.clear_skills = skills.length === 0;
            updatePayload.clear_certifications = certs.length === 0;
            updatePayload.clear_identifications = ids.length === 0;
            updatePayload.clear_requirements = applicantRequirements.length === 0;
            updatePayload.clear_education = education.length === 0;
            updatePayload.clear_trainings = trainings.length === 0;
            updatePayload.clear_languages = languages.length === 0;
            updatePayload.clear_employment = employment.length === 0;
            updatePayload.clear_flags = flags.length === 0;
          }

          if (currentApp?.applicationId) {
            updatePayload.application_id = currentApp.applicationId;
          }

          if (selectedJob) {
            updatePayload.job_order_code = selectedJob.code;
            updatePayload.job_order_name = `${selectedJob.code} (${selectedJob.employerName})`;
            if (selectedJob.jobOrderId) updatePayload.job_order_id = parseInt(String(selectedJob.jobOrderId), 10);
            if (selectedJob.employerId) updatePayload.employer_id = parseInt(String(selectedJob.employerId), 10);
            if (selectedJob.countryId) updatePayload.country_id = parseInt(String(selectedJob.countryId), 10);
          } else if (selectedJobOrderId === '') {
            updatePayload.job_order_code = null;
            updatePayload.job_order_name = null;
            updatePayload.job_order_id = null;
          }

          if (currentApp?.status) {
            updatePayload.status_code = currentApp.status;
            updatePayload.application_status = currentApp.status;
          }
          if (typeof currentApp?.phase === 'number') {
            updatePayload.current_phase = currentApp.phase;
          }
          if (currentApp?.currentHandler) {
            updatePayload.current_handler = currentApp.currentHandler;
          }
          if (currentApp?.currentDepartment) {
            updatePayload.current_department = currentApp.currentDepartment;
          }
          if (currentApp?.phaseDescription) {
            updatePayload.phase_description = currentApp.phaseDescription;
          }

          await api.put(`/applicants/${numericId}`, updatePayload);
        }

        if (updateApplicant) {
          updateApplicant(selectedApplicantId, {
            // Strictly preserve workflow state for existing applicants:
            status: currentApp?.status,
            phase: currentApp?.phase,
            currentHandler: currentApp?.currentHandler,
            currentDepartment: currentApp?.currentDepartment,
            phaseDescription: currentApp?.phaseDescription,
            firstName: personal.firstName,
            middleName: personal.middleName,
            lastName: personal.lastName,
            name: `${personal.firstName} ${personal.middleName} ${personal.lastName}`.trim(),
            email: personal.email,
            contact: personal.contact,
            dateOfBirth: personal.dateOfBirth,
            age: parseInt(personal.age, 10) || 30,
            photo: photo,
            photoDataUrl: photo,
            sex: personal.sex as 'Male' | 'Female',
            religion: personal.religion,
            civilStatus: personal.civilStatus as any,
            weightKg: personal.weight ? parseFloat(personal.weight) : undefined,
            heightCm: personal.height ? parseFloat(personal.height) : undefined,
            presentAddress: personal.presentAddress,
            provincialAddress: personal.provincialAddress,
            role: personal.role || (selectedJob ? selectedJob.position : 'Applicant'),
            jobOrder: selectedJob ? selectedJob.code : (selectedJobOrderId === '' ? 'Unassigned' : (currentApplicant?.jobOrder || 'Unassigned')),
            selectedJobOrderId: selectedJob ? selectedJob.code : (selectedJobOrderId === '' ? undefined : currentApplicant?.selectedJobOrderId),
            placeOfBirth: personal.placeOfBirth,
            noOfChildren: parseInt(personal.noOfChildren, 10) || 0,
            applicantTypes: selectedApplicantTypes,
            isIndigenous: selectedApplicantTypes.includes('INDIGENOUS_PEOPLES'),
            indigenousCommunity: personal.indigenousCommunity,
            emergencyContactName: personal.emergencyContactName,
            emergencyContactRelationship: personal.emergencyContactRelationship,
            emergencyContactNumber: personal.emergencyContactNumber,
            facebookUrl: personal.facebookUrl,
            whatsappNumber: personal.whatsappNumber,
            linkedinUrl: personal.linkedinUrl,
            skills: skills,
            certifications: certs.map((c: any) => c.title || c.name || '').filter(Boolean),
            identifications: ids,
            requirements: applicantRequirements,
            education: education,
            certificateRecords: certs,
            trainings: trainings,
            languageRecords: languages,
            employmentHistory: employment,
            employmentFlags: flags,
          });
        }

        addActivityLog({
          applicantId: selectedApplicantId,
          action: 'Profile Updated',
          performedBy: currentUserName,
          department: 'Recruitment',
          details: `Updated profile details for applicant ${currentApplicant?.applicantCode || `#${selectedApplicantId}`} (${personal.lastName}, ${personal.firstName}).`,
        });

        showToast(`✓ Profile for "${personal.firstName} ${personal.lastName}" updated successfully!`);
      }
    } catch (err: any) {
      console.error('Registration save error:', err);
      showToast(`Error saving applicant: ${err?.response?.data?.detail || err.message || 'Check connection'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sections = [
    { id: 'personal', label: 'Personal Info' },
    { id: 'identifications', label: 'Identifications' },
    { id: 'requirements', label: 'Requirements' },
    { id: 'education', label: 'Education' },
    { id: 'skills', label: 'Core Skills' },
    { id: 'certificates', label: 'Certificates' },
    { id: 'trainings', label: 'Trainings' },
    { id: 'languages', label: 'Languages' },
    { id: 'employment', label: 'Work Experience' },
  ];

  const STEP_TABS = [
    { step: 1, label: '[1] PERSONAL INFO', targetSectionId: 'personal' },
    { step: 2, label: '[2] IDENTIFICATIONS', targetSectionId: 'identifications' },
    { step: 3, label: '[3] REQUIREMENTS', targetSectionId: 'requirements' },
    { step: 4, label: '[4] EDUCATION', targetSectionId: 'education' },
    { step: 5, label: '[5] CORE SKILLS', targetSectionId: 'skills' },
    { step: 6, label: '[6] CERTIFICATES', targetSectionId: 'certificates' },
    { step: 7, label: '[7] WORK EXPERIENCE', targetSectionId: 'employment' },
  ];

  const currentStepNumber = useMemo(() => {
    switch (activeSection) {
      case 'personal': return 1;
      case 'identifications': return 2;
      case 'requirements': return 3;
      case 'education': return 4;
      case 'skills': return 5;
      case 'certificates':
      case 'trainings': return 6;
      case 'languages':
      case 'employment': return 7;
      default: return 1;
    }
  }, [activeSection]);

  const ratingBar = (val: number, onChange: (n: number) => void) => (
    <div className="flex items-center gap-2">
      <input type="range" min={1} max={10} value={val} onChange={e => onChange(Number(e.target.value))} className="flex-1 h-1.5 accent-[#0EA5E9]" />
      <span className="text-xs font-bold w-6 text-right text-[#0EA5E9]">{val}</span>
    </div>
  );

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(`section-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const secId = entry.target.id.replace('section-', '');
            setActiveSection(secId);
          }
        });
      },
      { rootMargin: '-15% 0px -65% 0px', threshold: 0 }
    );

    sections.forEach((s) => {
      const el = document.getElementById(`section-${s.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-4 w-full pb-20">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
            Candidate Registration
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Complete Phase 1 Intake profile, demographics, and initial documentation.
          </p>
        </div>

        {/* Action Buttons matching reference positioning */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setSelectedApplicantId('new');
              resetBlankForm();
              setIsSearchOpen(false);
              showToast('Switched to blank form: Registering a new candidate.');
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0F172A] hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Plus size={15} />
            <span className="uppercase tracking-wider">NEW APPLICANT</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSearchOpen(prev => !prev)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-xs border cursor-pointer ${
              isSearchOpen || selectedApplicantId !== 'new'
                ? 'bg-sky-50 border-[#0EA5E9] text-[#0284C7]'
                : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
            }`}
          >
            <Search size={14} className={isSearchOpen || selectedApplicantId !== 'new' ? 'text-[#0284C7]' : 'text-slate-500'} />
            <span className="uppercase tracking-wider">
              {isSearchOpen ? 'CLOSE SEARCH' : 'SEARCH EXISTING APPLICANT'}
            </span>
            {applicants.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                isSearchOpen ? 'bg-sky-200 text-sky-900' : 'bg-slate-100 text-slate-600'
              }`}>
                {applicants.length}
              </span>
            )}
          </button>

          {/* If registering a new applicant: CLEAR FORM is available with confirmation popup */}
          {selectedApplicantId === 'new' ? (
            <button
              type="button"
              onClick={() => {
                if (!isFormFilled) {
                  showToast('Form is already empty.');
                  return;
                }
                setShowClearConfirmModal(true);
              }}
              disabled={!isFormFilled}
              title={isFormFilled ? 'Clear current form input' : 'Form is already empty'}
              className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 border border-slate-300 text-slate-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-700 disabled:hover:border-slate-300 disabled:cursor-not-allowed rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Trash2 size={14} className="text-slate-500" />
              <span className="uppercase tracking-wider">CLEAR FORM</span>
            </button>
          ) : (
            /* When an existing applicant is selected: Clear form is NOT applicable. Shows UPDATE MODE indicator & Revert button */
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg text-xs font-bold shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="uppercase tracking-wider font-extrabold">UPDATE MODE</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (hasUnsavedChanges) {
                    setShowRevertConfirmModal(true);
                  } else {
                    showToast('No unsaved changes to revert.');
                  }
                }}
                disabled={!hasUnsavedChanges}
                title={hasUnsavedChanges ? 'Revert to saved applicant data' : 'No unsaved edits to revert'}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                <RotateCcw size={13} className="text-slate-500" />
                <span className="uppercase tracking-wider">REVERT</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {isLoadingEnriched && (
        <div className="bg-sky-50 border border-sky-200 text-sky-800 px-4 py-3.5 rounded-xl flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-[#0EA5E9] flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-sky-900">Loading Full Enriched Profile...</p>
              <p className="text-xs text-sky-700">Retrieving employment history, verified skills, education, languages, identifications, and certifications.</p>
            </div>
          </div>
          <span className="text-[11px] font-mono font-semibold bg-white/80 px-2.5 py-1 rounded border border-sky-200 text-sky-700">
            Form locked until loaded
          </span>
        </div>
      )}

      {hasBlockingFlags && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm font-semibold">
          <ShieldAlert size={16} /> {activeFlagCount} unresolved flag{activeFlagCount > 1 ? 's' : ''} in employment history — cannot save
        </div>
      )}

      {/* Search / Select Existing Applicant (toggleable or when editing existing) */}
      {(isSearchOpen || selectedApplicantId !== 'new') && applicants.length > 0 && (
        <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800 flex items-center gap-2">
              <Users size={14} className="text-[#0EA5E9]" /> Search Candidate Database
              <span className="bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full text-[10px]">
                {applicants.length} registered
              </span>
            </span>
            <div className="flex items-center gap-3">
              {selectedApplicantId !== 'new' && (
                <span className="text-slate-600 font-semibold text-[11px]">
                  Editing: <strong className="text-slate-900">{currentApplicant?.name}</strong> ({currentApplicant?.applicantCode || `#${selectedApplicantId}`})
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors cursor-pointer"
                title="Close search panel"
              >
                <X size={15} />
              </button>
            </div>
          </div>
          <InlineApplicantSelector
            applicants={applicants}
            selectedApplicantId={selectedApplicantId}
            onSelectApplicant={(id) => {
              setSelectedApplicantId(id);
              setIsSearchOpen(false);
            }}
            defaultOpen={isSearchOpen}
          />
        </div>
      )}

      {/* ── Stepper Card Container (Reference Layout) ──────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3.5">
        {/* Header row: NEW INTAKE • New Intake (left) | PROGRESS: STEP X OF 7 (right) */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <User size={18} className="text-slate-500" />
            <span className="font-extrabold text-sm tracking-wider uppercase text-slate-900">
              {selectedApplicantId === 'new' ? 'NEW INTAKE' : 'APPLICANT INTAKE'}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
              selectedApplicantId === 'new'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${selectedApplicantId === 'new' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {selectedApplicantId === 'new' ? 'New Registration' : `Update Mode • ${currentApplicant?.applicantCode || 'Existing'}`}
            </span>
          </div>
          <div className="text-xs font-black uppercase tracking-wider text-slate-700 font-mono">
            PROGRESS: STEP {currentStepNumber} OF 7
          </div>
        </div>

        {/* 7-Step Tabs with Progress Track Lines Above Each */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-1">
          {STEP_TABS.map((tab) => {
            const isActive = currentStepNumber === tab.step;
            const isCompleted = tab.step < currentStepNumber;
            return (
              <div key={tab.step} className="flex flex-col gap-2">
                {/* Progress bar track above the button */}
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isActive || isCompleted ? 'bg-[#0EA5E9] w-full' : 'w-0'
                    }`}
                  />
                </div>
                {/* Tab Button */}
                <button
                  type="button"
                  onClick={() => scrollToSection(tab.targetSectionId)}
                  className={`w-full py-2.5 px-1.5 rounded-lg text-[10px] sm:text-[11px] font-black tracking-wider uppercase transition-all flex items-center justify-center text-center cursor-pointer ${
                    isActive
                      ? 'bg-[#0F172A] text-white shadow-sm'
                      : 'text-slate-700 hover:text-[#0EA5E9] hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer row: Page X of 7 (left) | Page X of 7 (right) */}
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium pt-1">
          <span>Page {currentStepNumber} of 7</span>
          <span>Page {currentStepNumber} of 7</span>
        </div>
      </div>

      {/* ── Application Assignment Card (Reference Layout) ───────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-visible shadow-xs">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Briefcase size={16} className="text-[#0EA5E9]" />
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>APPLICATION ASSIGNMENT</span>
              <span className="text-red-500 font-bold text-xs normal-case">(Required *)</span>
            </h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            Step 1 of 7
          </span>
        </div>
        <div className="p-5">
          <SearchableJobOrderSelector
            jobOrders={openJobOrders}
            selectedJobOrderId={selectedJobOrderId}
            onSelectJobOrder={(id, jo) => {
              setSelectedJobOrderId(id);
              if (jo) {
                setPersonal(p => ({ ...p, role: jo.position }));
              }
            }}
            isLoading={isLoadingJobOrders}
          />
          {selectedJobOrderId ? (() => {
            const jo = openJobOrders.find(j => j.id === selectedJobOrderId || j.code === selectedJobOrderId);
            return jo ? (
              <p className="text-xs text-[#0EA5E9] mt-2 flex items-center gap-1 font-medium">
                <CheckCircle2 size={13} /> Role field auto-filled to &quot;{jo.position}&quot; — change in Personal Info if needed
              </p>
            ) : null;
          })() : (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1 font-medium">
              <AlertCircle size={13} /> A job order must be selected to register or save this applicant.
            </p>
          )}
        </div>
      </div>

      {/* ── Personal Info ────────────────────────────────────────────────────── */}
      <div id="section-personal" className="scroll-mt-20 !mt-2">
        <Section title="Personal Information" icon={<User size={16} />} badge={<span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">Required *</span>}>
          {/* Row 1: Photo beside Name + Contact only */}
          <div className="flex gap-6 items-start">
            {/* Photo */}
            <div className="flex-shrink-0">
              <div
                onClick={() => fileRef.current?.click()}
                className="w-28 h-32 rounded-xl border-2 border-dashed border-slate-300 hover:border-[#0EA5E9] cursor-pointer flex items-center justify-center bg-slate-50 hover:bg-[#0EA5E9]/5 transition-all overflow-hidden"
              >
                {photo
                  ? <img src={photo} alt="applicant" className="w-full h-full object-cover" />
                  : <div className="text-center p-2"><Camera size={24} className="text-slate-300 mx-auto mb-1" /><span className="text-[10px] text-slate-400">1×1 Photo</span></div>
                }
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async e => {
                const f = e.target.files?.[0]; if (!f) return;
                const reader = new FileReader();
                reader.onload = ev => setPhoto(ev.target?.result as string);
                reader.readAsDataURL(f);
                try {
                  const formData = new FormData();
                  formData.append('file', f);
                  const uploadRes = await api.post('/applicants/upload-photo', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                  });
                  if (uploadRes.data?.url) {
                    setPhoto(uploadRes.data.url);
                    showToast('Photo updated.');
                  }
                } catch (uploadErr) {
                  console.warn('Supabase storage photo upload fallback:', uploadErr);
                }
              }} />
              {photo && <button type="button" onClick={handleRemovePhoto} className="text-[10px] text-slate-400 hover:text-red-500 mt-1 w-full text-center transition-colors">Remove</button>}
            </div>

            {/* Name + Contact (the only rows that sit beside the photo) */}
            <div className="flex-1 grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  First Name <span className="text-red-500 font-bold">*</span>
                </label>
                <input className={inp} value={personal.firstName} onChange={e => setP('firstName', e.target.value)} placeholder="e.g. Juan" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Middle Name</label>
                <input className={inp} value={personal.middleName} onChange={e => setP('middleName', e.target.value)} placeholder="e.g. Santos" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Last Name <span className="text-red-500 font-bold">*</span>
                </label>
                <input className={inp} value={personal.lastName} onChange={e => setP('lastName', e.target.value)} placeholder="e.g. Dela Cruz" />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Gmail / Email Address</label>
                <input className={inp} type="email" value={personal.email} onChange={e => setP('email', e.target.value)} placeholder="applicant@gmail.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Mobile / Contact</label>
                <input className={inp} value={personal.contact} onChange={e => setP('contact', e.target.value)} placeholder="+63 9XX XXX XXXX" />
              </div>
            </div>
          </div>

          {/* Remaining fields — full width, no empty gap */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Date of Birth</label>
              <input className={inp} type="date" value={personal.dateOfBirth} onChange={e => { setP('dateOfBirth', e.target.value); setP('age', calcAge(e.target.value)); }} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Age</label>
              <input className={inp} type="number" value={personal.age} onChange={e => setP('age', e.target.value)} readOnly />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Gender</label>
              <select className={inp} value={personal.sex} onChange={e => setP('sex', e.target.value)}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Religion</label>
              <input className={inp} value={personal.religion} onChange={e => setP('religion', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Civil Status</label>
              <select className={inp} value={personal.civilStatus} onChange={e => setP('civilStatus', e.target.value)}>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Widowed">Widowed</option>
                <option value="Separated">Separated</option>
                <option value="Divorced">Divorced</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Weight (kg)</label>
                <input className={inp} value={personal.weight} onChange={e => setP('weight', e.target.value)} placeholder="kg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Height (cm)</label>
                <input className={inp} value={personal.height} onChange={e => setP('height', e.target.value)} placeholder="cm" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Place of Birth</label>
              <input className={inp} value={personal.placeOfBirth} onChange={e => setP('placeOfBirth', e.target.value)} placeholder="City / Municipality" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">No. of Children</label>
              <input className={inp} type="number" min="0" value={personal.noOfChildren} onChange={e => setP('noOfChildren', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Target Position / Role</label>
              <input className={inp} value={personal.role} onChange={e => setP('role', e.target.value)} placeholder="e.g. Industrial Welder" />
            </div>

            <div className="col-span-3">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Present Address</label>
              <input className={inp} value={personal.presentAddress} onChange={e => setP('presentAddress', e.target.value)} placeholder="Brgy., City, Province" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Provincial Address (if different)</label>
              <input className={inp} value={personal.provincialAddress} onChange={e => setP('provincialAddress', e.target.value)} />
            </div>
            <div>{/* intentional spacer to keep grid even */}</div>
          </div>

          {/* ── OFW Category & Classification ─────────────────────────────────── */}
          <div className="border-t border-slate-100 mt-5 pt-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Users size={12} /> OFW Category &amp; Classification
            </p>
            <p className="text-[11px] text-slate-400 mb-2.5">
              <span className="font-semibold text-amber-600">First-Time OFW</span> and <span className="font-semibold text-sky-600">Returning OFW</span> are mutually exclusive. Muslim &amp; Indigenous may combine with either.
            </p>
            <div className="flex flex-wrap gap-2">
              {CLASSIFICATION_CHIPS.map(chip => {
                const selected = selectedApplicantTypes.includes(chip.code);
                const colorMap: Record<string, string> = {
                  emerald: selected ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50',
                  sky:     selected ? 'bg-sky-600 text-white border-sky-600'         : 'bg-white text-sky-700 border-sky-300 hover:bg-sky-50',
                  violet:  selected ? 'bg-violet-600 text-white border-violet-600'   : 'bg-white text-violet-700 border-violet-300 hover:bg-violet-50',
                  amber:   selected ? 'bg-amber-500 text-white border-amber-500'     : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50',
                };
                return (
                  <button
                    key={chip.code}
                    type="button"
                    onClick={() => handleToggleApplicantType(chip.code)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${colorMap[chip.color]}`}
                  >
                    {selected && <Check size={11} />}
                    {chip.label}
                  </button>
                );
              })}
            </div>
            {isIndigenousSelected && (
              <div className="mt-3 max-w-sm">
                <label className="block text-xs font-semibold text-amber-700 mb-1">Indigenous Community / Tribe</label>
                <input
                  className={inp}
                  value={personal.indigenousCommunity}
                  onChange={e => setP('indigenousCommunity', e.target.value)}
                  placeholder="e.g. Aeta, Manobo, Lumad, Ifugao..."
                />
              </div>
            )}
          </div>

          {/* ── Emergency Contact ─────────────────────────────────────────────── */}
          <div className="border-t border-slate-100 mt-5 pt-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <HeartHandshake size={12} /> Emergency Contact / Next of Kin
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Full Name</label>
                <input className={inp} value={personal.emergencyContactName} onChange={e => setP('emergencyContactName', e.target.value)} placeholder="Contact person's name" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Relationship</label>
                <select className={inp} value={personal.emergencyContactRelationship} onChange={e => setP('emergencyContactRelationship', e.target.value)}>
                  {['Spouse', 'Parent', 'Sibling', 'Child', 'Relative', 'Friend', 'Other'].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Contact Number</label>
                <input className={inp} value={personal.emergencyContactNumber} onChange={e => setP('emergencyContactNumber', e.target.value)} placeholder="+63 9XX XXX XXXX" />
              </div>
            </div>
          </div>

          {/* ── Social Media / Digital Presence ───────────────────────────────── */}
          <div className="border-t border-slate-100 mt-5 pt-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Share2 size={12} /> Social Media / Digital Presence
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Facebook URL</label>
                <div className="relative">
                  <Globe size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className={inp + ' pl-7'} value={personal.facebookUrl} onChange={e => setP('facebookUrl', e.target.value)} placeholder="facebook.com/..." />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">WhatsApp / Viber URL</label>
                <div className="relative">
                  <Globe size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className={inp + ' pl-7'} value={personal.whatsappNumber} onChange={e => setP('whatsappNumber', e.target.value)} placeholder="wa.me/639XXXXXXXXX" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">LinkedIn URL</label>
                <div className="relative">
                  <ExternalLink size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className={inp + ' pl-7'} value={personal.linkedinUrl} onChange={e => setP('linkedinUrl', e.target.value)} placeholder="linkedin.com/in/..." />
                </div>
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* ── Identifications ────────────────────────────────────────────────────── */}
      <div id="section-identifications" className="scroll-mt-28">
        <Section title="Government & Other Identifications" icon={<FileCheck size={16} />} badge={<span className="text-xs text-slate-400 font-medium">{ids.length} recorded</span>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={th}>Identification Type</th>
                  <th className={th}>Identification No.</th>
                  <th className={th}>Expiry Date</th>
                  <th className={th + ' w-10'}></th>
                </tr>
              </thead>
              <tbody>
                {ids.map(row => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className={td}>
                      <input
                        list="id-types-list"
                        className={inp}
                        value={row.type}
                        onChange={e => setId(row.id, 'type', e.target.value)}
                        placeholder="Type or select ID type..."
                      />
                    </td>
                    <td className={td}><input className={inp} value={row.identificationNo} onChange={e => setId(row.id, 'identificationNo', e.target.value)} placeholder="ID / Serial Number" /></td>
                    <td className={td}><input className={inp} type="date" value={row.expiryDate} onChange={e => setId(row.id, 'expiryDate', e.target.value)} /></td>
                    <td className={td}><button onClick={() => removeId(row.id)} className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded transition-colors text-slate-400"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="id-types-list">
              {availableIdTypes.map(t => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <button onClick={addId} className="mt-3 flex items-center gap-1.5 text-sm text-[#0EA5E9] hover:text-[#0284C7] font-medium transition-colors">
            <Plus size={15} /> Add Identification
          </button>
        </Section>
      </div>

      {/* ── Requirements & Document Clearances ─────────────────────────────────── */}
      <div id="section-requirements" className="scroll-mt-28">
        <Section
          title="Document & Regulatory Requirements"
          icon={<FileCheck size={16} />}
          badge={<span className="text-xs text-slate-400 font-medium">{applicantRequirements.length} recorded</span>}
        >
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                Select requirements from the standard agency catalog or type custom preferred requirements (documents, medicals, clearances, or certificates).
              </p>
              {selectedJobOrderId && (() => {
                const jo = openJobOrders.find(j => j.id === selectedJobOrderId);
                const joReqs: string[] = (jo?.requirements || []).concat(
                  (jo?.detailedRequirements || []).map((dr: any) => typeof dr === 'string' ? dr : dr.name)
                ).filter(Boolean);
                const missingReqs = joReqs.filter(r => !applicantRequirements.some(ar => ar.name.toLowerCase() === r.toLowerCase()));
                if (missingReqs.length === 0) return null;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      missingReqs.forEach(r => addApplicantRequirement(r, 'DOCUMENT', 'PENDING', true));
                      showToast(`Added ${missingReqs.length} requirement(s) from Job Order ${jo?.code}.`);
                    }}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-blue-50 text-[#0EA5E9] hover:bg-blue-100 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                  >
                    <Plus size={13} /> Import {missingReqs.length} Job Order Req{missingReqs.length > 1 ? 's' : ''}
                  </button>
                );
              })()}
            </div>

            {/* Input row with datalist (Fetch all available in Supabase, or type preferred) */}
            <div className="flex flex-wrap gap-2 items-center bg-slate-50/70 p-3 rounded-xl border border-slate-200">
              <input
                list="req-catalog-list"
                value={reqInput}
                onChange={e => setReqInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addApplicantRequirement(reqInput);
                  }
                }}
                placeholder="Type or select a requirement (e.g. NBI Clearance, Medical, OWWA)..."
                className="flex-1 min-w-[240px] px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]"
              />
              <datalist id="req-catalog-list">
                {availableRequirements.map((r: any) => (
                  <option key={r.requirement_id || r.requirement_name} value={r.requirement_name}>
                    {r.category ? `(${r.category})` : ''}
                  </option>
                ))}
              </datalist>

              <select
                value={reqCategory}
                onChange={e => setReqCategory(e.target.value as any)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 font-medium"
              >
                <option value="DOCUMENT">Document</option>
                <option value="CERTIFICATION">Certification</option>
                <option value="MEDICAL">Medical</option>
                <option value="OTHER">Other</option>
              </select>

              <select
                value={reqStatus}
                onChange={e => setReqStatus(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 font-medium"
              >
                <option value="PENDING">Pending</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="VERIFIED">Verified</option>
              </select>

              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer px-1">
                <input
                  type="checkbox"
                  checked={reqIsMandatory}
                  onChange={e => setReqIsMandatory(e.target.checked)}
                  className="rounded text-[#0EA5E9] focus:ring-[#0EA5E9]"
                />
                Mandatory
              </label>

              <button
                type="button"
                onClick={() => addApplicantRequirement(reqInput)}
                className="px-4 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0 shadow-sm cursor-pointer"
              >
                <Plus size={14} /> Add Requirement
              </button>
            </div>

            {/* Checklist Table */}
            {applicantRequirements.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className={th}>Requirement Name</th>
                      <th className={th}>Category</th>
                      <th className={th}>Type</th>
                      <th className={th}>Status</th>
                      <th className={th}>Expiration Date</th>
                      <th className={th + ' w-10'}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {applicantRequirements.map((row) => (
                      <tr key={row.name} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className={td}>
                          <span className="font-semibold text-slate-800">{row.name}</span>
                        </td>
                        <td className={td}>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {row.category}
                          </span>
                        </td>
                        <td className={td}>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            row.is_mandatory !== false ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {row.is_mandatory !== false ? 'Mandatory' : 'Optional'}
                          </span>
                        </td>
                        <td className={td}>
                          <select
                            value={row.status || 'PENDING'}
                            onChange={e => setApplicantReqField(row.name, 'status', e.target.value)}
                            className={`text-xs px-2.5 py-1 rounded-lg border font-semibold ${
                              (row.status || '').toUpperCase() === 'VERIFIED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : (row.status || '').toUpperCase() === 'SUBMITTED'
                                ? 'bg-sky-50 text-sky-700 border-sky-300'
                                : 'bg-amber-50 text-amber-700 border-amber-300'
                            }`}
                          >
                            <option value="PENDING">Pending</option>
                            <option value="SUBMITTED">Submitted</option>
                            <option value="VERIFIED">Verified</option>
                            <option value="REJECTED">Rejected</option>
                          </select>
                        </td>
                        <td className={td}>
                          <input
                            type="date"
                            value={row.expiration_date || ''}
                            onChange={e => setApplicantReqField(row.name, 'expiration_date', e.target.value)}
                            className="text-xs px-2 py-1 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]"
                          />
                        </td>
                        <td className={td}>
                          <button
                            type="button"
                            onClick={() => removeApplicantRequirement(row.name)}
                            className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded transition-colors text-slate-400 cursor-pointer"
                            title={`Remove ${row.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic py-4 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                No requirements recorded yet. Select or type a requirement above to add one.
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* ── Education ─────────────────────────────────────────────────────────── */}
      <div id="section-education" className="scroll-mt-28">
        <Section title="Educational Background" icon={<GraduationCap size={16} />} badge={<span className="text-xs text-slate-400 font-medium">{education.length} recorded</span>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={th}>Level</th>
                  <th className={th}>School / Institution</th>
                  <th className={th}>Course / Strand</th>
                  <th className={th}>Year Graduated</th>
                  <th className={th + ' w-10'}></th>
                </tr>
              </thead>
              <tbody>
                {education.map(row => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className={td}>
                      <select className={inp} value={row.level} onChange={e => setEdu(row.id, 'level', e.target.value)}>
                        <option value="">-- Select Education Level --</option>
                        {EDU_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </td>
                    <td className={td}><input className={inp} value={row.school} onChange={e => setEdu(row.id, 'school', e.target.value)} placeholder="School / University name" /></td>
                    <td className={td}><input className={inp} value={row.course} onChange={e => setEdu(row.id, 'course', e.target.value)} placeholder="Course or track" /></td>
                    <td className={td}><input className={inp} value={row.yearGraduated} onChange={e => setEdu(row.id, 'yearGraduated', e.target.value)} placeholder="YYYY or Ongoing" /></td>
                    <td className={td}><button onClick={() => removeEdu(row.id)} className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded transition-colors text-slate-400"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={addEdu} className="mt-3 flex items-center gap-1.5 text-sm text-[#0EA5E9] hover:text-[#0284C7] font-medium transition-colors">
            <Plus size={15} /> Add Education Level
          </button>
        </Section>
      </div>

      {/* ── Core Skills ────────────────────────────────────────────────────────── */}
      <div id="section-skills" className="scroll-mt-28">
        <Section
          title="Core Skills & Competencies"
          icon={<Award size={16} />}
          badge={<span className="text-xs text-slate-400 font-medium">{skills.length} recorded</span>}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Add individual core competencies, technical abilities, or soft skills. Press Enter or click &quot;Add Skill&quot;.
            </p>

            {/* Input row */}
            <div className="flex gap-2">
              <input
                list="skills-catalog-list"
                className={inp}
                placeholder="e.g. Communication, Microsoft Office, Heavy Equipment Operation, Arc Welding..."
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSkill(skillInput);
                  }
                }}
              />
              <datalist id="skills-catalog-list">
                {availableSkills.map(s => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <button
                type="button"
                onClick={() => addSkill(skillInput)}
                className="px-4 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0 shadow-sm cursor-pointer"
              >
                <Plus size={15} /> Add Skill
              </button>
            </div>

            {/* Render chips */}
            {skills.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {skills.map(s => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 bg-[#0EA5E9]/10 text-[#0284C7] rounded-full font-medium border border-[#0EA5E9]/20 transition-all hover:bg-[#0EA5E9]/15"
                  >
                    <span>{s}</span>
                    <button
                      type="button"
                      onClick={() => removeSkill(s)}
                      className="w-4 h-4 rounded-full inline-flex items-center justify-center hover:bg-[#0EA5E9]/30 text-[#0284C7] transition-colors cursor-pointer"
                      title={`Remove ${s}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic py-2">
                No core skills added yet. Type a skill above to add one.
              </div>
            )}

            {/* Suggested quick-add chips */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Quick Suggestions:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Communication',
                  'Team Collaboration',
                  'Problem Solving',
                  'Microsoft Office',
                  'Time Management',
                  'Customer Service',
                  'Leadership',
                  'Adaptability',
                ].filter(s => !skills.includes(s)).slice(0, 6).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addSkill(s)}
                    className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={11} /> {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* ── Certificates ──────────────────────────────────────────────────────── */}
      <div id="section-certificates" className="scroll-mt-28">
        <Section title="Certifications / Licenses" icon={<Award size={16} />} badge={<span className="text-xs text-slate-400 font-medium">{certs.length} recorded</span>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={th}>Certificate Title</th>
                  <th className={th}>Serial No.</th>
                  <th className={th}>Issued By</th>
                  <th className={th}>No. of Hours</th>
                  <th className={th}>Competency Date</th>
                  <th className={th}>Expiry Date</th>
                  <th className={th + ' w-10'}></th>
                </tr>
              </thead>
              <tbody>
                {certs.map(row => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className={td}>
                      <input
                        list="cert-catalog-list"
                        className={inp}
                        value={row.title}
                        onChange={e => setCert(row.id, 'title', e.target.value)}
                        placeholder="Certificate name (type or select)"
                      />
                    </td>
                    <td className={td}><input className={inp} value={row.serialNo} onChange={e => setCert(row.id, 'serialNo', e.target.value)} placeholder="Serial / Cert No." /></td>
                    <td className={td}><input className={inp} value={row.issuedBy} onChange={e => setCert(row.id, 'issuedBy', e.target.value)} placeholder="Issuing body" /></td>
                    <td className={td}><input className={inp} value={row.noOfHours} onChange={e => setCert(row.id, 'noOfHours', e.target.value)} placeholder="hrs" /></td>
                    <td className={td}><input className={inp} type="date" value={row.competencyDateIssued} onChange={e => setCert(row.id, 'competencyDateIssued', e.target.value)} /></td>
                    <td className={td}><input className={inp} type="date" value={row.expiryDate} onChange={e => setCert(row.id, 'expiryDate', e.target.value)} /></td>
                    <td className={td}><button onClick={() => removeCert(row.id)} className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded transition-colors text-slate-400"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="cert-catalog-list">
              {availableCertifications.map(c => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <button onClick={addCert} className="mt-3 flex items-center gap-1.5 text-sm text-[#0EA5E9] hover:text-[#0284C7] font-medium transition-colors">
            <Plus size={15} /> Add Certificate
          </button>
        </Section>
      </div>

      {/* ── Trainings ─────────────────────────────────────────────────────────── */}
      <div id="section-trainings" className="scroll-mt-28">
        <Section title="Trainings Attended" icon={<BookOpen size={16} />} badge={<span className="text-xs text-slate-400 font-medium">{trainings.length} recorded</span>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={th}>Training Name</th>
                  <th className={th}>Cert No.</th>
                  <th className={th}>Duration</th>
                  <th className={th}>No. of Hours</th>
                  <th className={th}>Conducted By</th>
                  <th className={th}>Skills Acquired</th>
                  <th className={th + ' w-10'}></th>
                </tr>
              </thead>
              <tbody>
                {trainings.map(row => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className={td}><input className={inp} value={row.trainingName} onChange={e => setTraining(row.id, 'trainingName', e.target.value)} placeholder="Training title" /></td>
                    <td className={td}><input className={inp} value={row.certNo} onChange={e => setTraining(row.id, 'certNo', e.target.value)} placeholder="Cert no." /></td>
                    <td className={td}><input className={inp} value={row.duration} onChange={e => setTraining(row.id, 'duration', e.target.value)} placeholder="e.g. 3 days" /></td>
                    <td className={td}><input className={inp} value={row.noOfHours} onChange={e => setTraining(row.id, 'noOfHours', e.target.value)} placeholder="hrs" /></td>
                    <td className={td}><input className={inp} value={row.conductedBy} onChange={e => setTraining(row.id, 'conductedBy', e.target.value)} placeholder="Training provider" /></td>
                    <td className={td}><input className={inp} value={row.skillsAcquired} onChange={e => setTraining(row.id, 'skillsAcquired', e.target.value)} placeholder="Skills gained" /></td>
                    <td className={td}><button onClick={() => removeTraining(row.id)} className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded transition-colors text-slate-400"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={addTraining} className="mt-3 flex items-center gap-1.5 text-sm text-[#0EA5E9] hover:text-[#0284C7] font-medium transition-colors">
            <Plus size={15} /> Add Training
          </button>
        </Section>
      </div>

      {/* ── Languages ─────────────────────────────────────────────────────────── */}
      <div id="section-languages" className="scroll-mt-28">
        <Section title="Language Proficiency" icon={<LanguagesIcon size={16} />} badge={<span className="text-xs text-slate-400 font-medium">{languages.length} recorded</span>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={th}>Language</th>
                  <th className={th}>Competency Level</th>
                  <th className={th + ' min-w-[160px]'}>Spoken (Fluent = 10)</th>
                  <th className={th + ' min-w-[160px]'}>Written (Proficient = 10)</th>
                  <th className={th + ' w-10'}></th>
                </tr>
              </thead>
              <tbody>
                {languages.map(row => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className={td}>
                      <input
                        list="languages-catalog-list"
                        className={inp}
                        value={row.language}
                        onChange={e => setLang(row.id, 'language', e.target.value)}
                        placeholder="Language / Dialect (type or select)"
                      />
                    </td>
                    <td className={td}>
                      <select className={inp} value={row.competency} onChange={e => setLang(row.id, 'competency', e.target.value)}>
                        {LANG_COMPETENCY.map(l => <option key={l}>{l}</option>)}
                      </select>
                    </td>
                    <td className={td}>{ratingBar(row.spokenRating, v => setLang(row.id, 'spokenRating', v))}</td>
                    <td className={td}>{ratingBar(row.writtenRating, v => setLang(row.id, 'writtenRating', v))}</td>
                    <td className={td}><button onClick={() => removeLang(row.id)} className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded transition-colors text-slate-400"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="languages-catalog-list">
              {availableLanguages.map(l => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>
          <button onClick={addLang} className="mt-3 flex items-center gap-1.5 text-sm text-[#0EA5E9] hover:text-[#0284C7] font-medium transition-colors">
            <Plus size={15} /> Add Language
          </button>
        </Section>
      </div>

      {/* ── Employment History ────────────────────────────────────────────────── */}
      <div id="section-employment" className="scroll-mt-28 space-y-4">
        <Section title="Work Experience / Employment History" icon={<Briefcase size={16} />} badge={<span className="text-xs text-slate-400 font-medium">{employment.length} recorded</span>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={th}>Company / Employer</th>
                  <th className={th}>Position / Designation</th>
                  <th className={th}>Date Started</th>
                  <th className={th}>Date Ended</th>
                  <th className={th}>Country</th>
                  <th className={th}>Reason for Leaving</th>
                  <th className={th + ' text-center'}>Present</th>
                  <th className={th + ' w-10'}></th>
                </tr>
              </thead>
              <tbody>
                {employment.map(row => (
                  <tr key={row.id} className={`border-b border-slate-100 hover:bg-slate-50/50 ${flags.some(f => !f.dismissed && (f.relatedJobIds || []).includes(row.id)) ? 'bg-red-50/40' : ''}`}>
                    <td className={td}><input className={inp} value={row.company} onChange={e => setEmp(row.id, 'company', e.target.value)} placeholder="Company name" /></td>
                    <td className={td}><input className={inp} value={row.position} onChange={e => setEmp(row.id, 'position', e.target.value)} placeholder="Job title" /></td>
                    <td className={td}><input className={inp} type="date" value={row.dateStarted} onChange={e => setEmp(row.id, 'dateStarted', e.target.value)} /></td>
                    <td className={td}>
                      {row.isPresent
                        ? <span className="text-xs text-[#10B981] font-semibold px-2 py-1 bg-emerald-50 rounded">Present</span>
                        : <input className={inp} type="date" value={row.dateEnded} onChange={e => setEmp(row.id, 'dateEnded', e.target.value)} />
                      }
                    </td>
                    <td className={td}><input className={inp} value={row.country} onChange={e => setEmp(row.id, 'country', e.target.value)} placeholder="PH / UAE…" /></td>
                    <td className={td}><input className={`${inp} ${RED_FLAG_KEYWORDS.some(k => row.reasonForLeaving.toLowerCase().includes(k)) ? 'border-red-300 bg-red-50' : ''}`} value={row.reasonForLeaving} onChange={e => setEmp(row.id, 'reasonForLeaving', e.target.value)} placeholder="Reason for leaving" /></td>
                    <td className={td + ' text-center'}>
                      <input type="checkbox" checked={row.isPresent} onChange={e => setEmp(row.id, 'isPresent', e.target.checked)} />
                    </td>
                    <td className={td}><button onClick={() => removeEmp(row.id)} className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded transition-colors text-slate-400"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
            <button onClick={addEmp} className="flex items-center gap-1.5 text-sm text-[#0EA5E9] hover:text-[#0284C7] font-medium transition-colors">
              <Plus size={15} /> Add Employment
            </button>
            <div className="flex items-center gap-2 ml-auto">
              {employment.length > 0 && (
                activeFlagCount > 0 ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                    <ShieldAlert size={14} className="text-amber-500" />
                    Auto-Check: {activeFlagCount} Active Flag{activeFlagCount > 1 ? 's' : ''}
                  </span>
                ) : flags.length > 0 ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    All {flags.length} Flag{flags.length > 1 ? 's' : ''} Resolved
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    Auto-Check: Clean
                  </span>
                )
              )}
              {employment.length > 0 && (
                <button
                  type="button"
                  onClick={runFlagEngine}
                  title="Re-run flag evaluation"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition-colors border border-slate-200 cursor-pointer"
                >
                  <RotateCcw size={13} /> Re-scan
                </button>
              )}
            </div>
          </div>
        </Section>

        {/* Flags Panel */}
        {employment.length > 0 && (
          <div className={`rounded-xl border overflow-hidden ${flags.length === 0 ? 'border-emerald-200' : 'border-amber-200'}`}>
            <div className={`px-5 py-3 flex items-center justify-between ${flags.length === 0 ? 'bg-emerald-50' : 'bg-amber-50'}`}>
              <div className="flex items-center gap-2">
                {flags.length === 0
                  ? <><CheckCircle2 size={16} className="text-emerald-600" /><span className="text-sm font-bold text-emerald-700">No concerns raised — employment history is clean</span></>
                  : <><ShieldAlert size={16} className="text-amber-600" /><span className="text-sm font-bold text-amber-700">{flags.length} concern{flags.length > 1 ? 's' : ''} raised — {activeFlagCount} unresolved</span></>
                }
              </div>
              {activeFlagCount > 0 && (
                <span className="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full">All flags must be cleared before saving</span>
              )}
            </div>
            {flags.length > 0 && (
              <div className="p-4 space-y-3 bg-white">
                {flags.map(flag => {
                  const meta = FLAG_META[flag.type];
                  const isOpen = resolvingFlagId === flag.id;
                  const resolveReady = selectedQuickReason && (selectedQuickReason !== 'Other (see details below)' || customReason.trim());
                  return (
                    <div key={flag.id} className={`rounded-xl border transition-all overflow-hidden ${flag.dismissed ? 'opacity-70 border-slate-200 bg-slate-50' : isOpen ? 'border-[#0EA5E9] bg-white shadow-md' : 'border-amber-200 bg-amber-50/50 hover:border-amber-300'
                      }`}>
                      {/* Flag header — clickable */}
                      <div
                        className={`flex items-start gap-3 p-4 ${!flag.dismissed ? 'cursor-pointer' : ''}`}
                        onClick={() => !flag.dismissed && openResolve(flag.id)}
                      >
                        <div className="mt-0.5 flex-shrink-0" style={{ color: flag.dismissed ? '#94a3b8' : meta.color }}>
                          {meta.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{
                              background: flag.dismissed ? '#f1f5f9' : meta.color + '18',
                              color: flag.dismissed ? '#94a3b8' : meta.color,
                            }}>
                              {meta.label}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
                              background: flag.severity === 'critical' && !flag.dismissed ? '#FEE2E2' : '#f1f5f9',
                              color: flag.severity === 'critical' && !flag.dismissed ? '#EF4444' : '#94a3b8',
                            }}>
                              {flag.severity === 'critical' ? 'CRITICAL' : 'WARNING'}
                            </span>
                            {flag.dismissed && (
                              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                                <CheckCircle2 size={11} /> Resolved
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-700">{flag.description}</p>
                          {flag.dismissed && flag.dismissalReason && (
                            <p className="mt-1.5 text-xs text-slate-500 italic">
                              <strong className="text-slate-600">Resolved by {flag.dismissedBy}:</strong> {flag.dismissalReason}
                            </p>
                          )}
                        </div>
                        {!flag.dismissed && (
                          <span className={`text-xs flex-shrink-0 px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 ${isOpen ? 'bg-[#0EA5E9] text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-[#0EA5E9] hover:text-[#0EA5E9]'}`}>
                            <MessageSquare size={11} /> {isOpen ? 'Cancel' : 'Resolve'}
                          </span>
                        )}
                      </div>

                      {/* Inline resolution panel */}
                      {isOpen && !flag.dismissed && (
                        <div className="border-t border-[#0EA5E9]/20 bg-[#0EA5E9]/3 px-4 pb-4 pt-3 space-y-3">
                          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Select Resolution Reason</p>
                          <div className="flex flex-wrap gap-2">
                            {QUICK_REASONS.map(r => (
                              <button
                                key={r}
                                onClick={() => setSelectedQuickReason(r)}
                                className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${selectedQuickReason === r
                                  ? 'bg-[#0EA5E9] text-white border-[#0EA5E9]'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-[#0EA5E9] hover:text-[#0EA5E9]'
                                  }`}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                          {(selectedQuickReason === 'Other (see details below)' || (selectedQuickReason && selectedQuickReason !== 'Other (see details below)')) && (
                            <textarea
                              value={customReason}
                              onChange={e => setCustomReason(e.target.value)}
                              rows={2}
                              placeholder={selectedQuickReason === 'Other (see details below)' ? 'Describe the resolution…' : 'Additional details (optional)…'}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/30 focus:border-[#0EA5E9] resize-none"
                            />
                          )}
                          <div className="flex justify-end gap-2">
                            <button onClick={() => { setResolvingFlagId(null); setSelectedQuickReason(''); setCustomReason(''); }} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors">
                              Cancel
                            </button>
                            <button
                              onClick={() => resolveFlag(flag.id)}
                              disabled={!resolveReady}
                              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#10B981] hover:bg-[#059669] disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                              <CheckCircle2 size={13} /> Mark Resolved
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {employment.length === 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-2.5 text-xs text-slate-500">
            <AlertCircle size={14} className="flex-shrink-0 text-slate-400" />
            <span>Employment records are automatically evaluated in real time for career gaps, short stints, overlaps, and high-risk resignation keywords.</span>
          </div>
        )}
      </div>

      {/* Save / Register Button */}
      <div id="section-save-actions" className="flex items-center justify-between pt-6 border-t border-slate-200 gap-4 flex-wrap bg-white p-5 rounded-xl shadow-sm border">
        <div className="text-xs text-slate-500">
          {hasBlockingFlags ? (
            <span className="text-red-500 font-semibold flex items-center gap-1.5">
              <ShieldAlert size={14} /> Resolve all {activeFlagCount} flag{activeFlagCount > 1 ? 's' : ''} in Work Experience before saving
            </span>
          ) : !selectedJobOrderId ? (
            <span className="text-amber-600 font-medium flex items-center gap-1.5">
              <AlertCircle size={14} /> A Job Order must be selected before saving
            </span>
          ) : !personal.firstName.trim() || !personal.lastName.trim() ? (
            <span className="text-amber-600 font-medium flex items-center gap-1.5">
              <AlertCircle size={14} /> Candidate First Name and Last Name are required to register
            </span>
          ) : (
            <span className="text-emerald-600 font-semibold flex items-center gap-1.5">
              <CheckCircle2 size={14} /> Ready to {selectedApplicantId === 'new' ? 'register candidate' : 'save changes'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {showCancelButton && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer animate-in fade-in duration-150"
              title={selectedApplicantId === 'new' ? 'Clear form' : hasUnsavedChanges ? 'Discard unsaved changes' : 'Cancel selection'}
            >
              <X size={16} /> Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={
              isLoadingEnriched ||
              (selectedApplicantId !== 'new' && !isEnrichedLoaded) ||
              hasBlockingFlags ||
              isSubmitting ||
              !selectedJobOrderId ||
              !personal.firstName.trim() ||
              !personal.lastName.trim()
            }
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              isLoadingEnriched ||
              (selectedApplicantId !== 'new' && !isEnrichedLoaded) ||
              hasBlockingFlags ||
              isSubmitting ||
              !selectedJobOrderId ||
              !personal.firstName.trim() ||
              !personal.lastName.trim()
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                : selectedApplicantId === 'new'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-[#0EA5E9] hover:bg-[#0284C7] text-white shadow-md shadow-[#0EA5E9]/20'
            }`}
          >
            {isLoadingEnriched ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#0EA5E9]" />
                Loading Applicant Details...
              </>
            ) : isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {selectedApplicantId === 'new' ? 'Registering Candidate...' : 'Saving Changes...'}
              </>
            ) : selectedApplicantId === 'new' ? (
              <>
                <UserPlus size={16} /> Register New Applicant
              </>
            ) : (
              <>
                <Save size={16} /> Save Applicant {currentApplicant?.applicantCode || `#${selectedApplicantId}`} Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Clear Form Confirmation Modal (New Intake) ───────────────────────── */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Clear Registration Form?
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Are you sure you want to clear your current input? All entered details for this new applicant will be completely reset. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  resetBlankForm();
                  setShowClearConfirmModal(false);
                  showToast('Registration form cleared.');
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Yes, Clear Form</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Revert Changes Confirmation Modal (Update Mode) ─────────────────── */}
      {showRevertConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <RotateCcw size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Discard Unsaved Changes?
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Are you sure you want to discard your edits? All fields will be reloaded to match the saved profile of <strong className="text-slate-800">{currentApplicant?.name}</strong> ({currentApplicant?.applicantCode || `#${selectedApplicantId}`}).
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowRevertConfirmModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  const app = applicants.find(a => String(a.id) === String(selectedApplicantId));
                  if (app) {
                    populateApplicantData(app);
                    showToast(`Unsaved changes discarded for ${app.name}. Original profile restored.`);
                  }
                  setShowRevertConfirmModal(false);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Discard & Revert</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
