import { useState, useRef, useEffect } from 'react';
import {
  UserPlus, CheckCircle, AlertTriangle, Camera, Plus, Trash2,
  X, Flag, ShieldAlert, AlertCircle,
  Clock, TrendingDown, GitMerge, Zap, MessageSquare, CheckCircle2,
  Save, User, FileCheck, Upload, Briefcase, Loader2
} from 'lucide-react';
import {
  ActivityLog, ApplicantRecord,
  IdentificationRecord, EducationRecord, CertificateRecord,
  TrainingRecord, LanguageRecord, EmploymentRecord, EmploymentFlag, EmploymentFlagType
} from '../../types';
import InlineApplicantSelector from '../InlineApplicantSelector';
import { api } from '../../../lib/api';

// ─── Flag Engine ──────────────────────────────────────────────────────────────

const RED_FLAG_KEYWORDS = ['terminated', 'awol', 'dispute', 'dismissed', 'fired', 'absent without leave', 'medical leave', 'disciplinary'];
const SENIOR_KEYWORDS   = ['manager', 'supervisor', 'director', 'head', 'chief', 'lead', 'senior', 'officer', 'superintendent'];
const JUNIOR_KEYWORDS   = ['junior', 'assistant', 'helper', 'trainee', 'intern', 'rank and file', 'laborer', 'aide'];

function monthsBetween(a: string, b: string): number {
  const da = new Date(a), db = new Date(b);
  return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth());
}

function analyzeEmployment(records: EmploymentRecord[]): EmploymentFlag[] {
  const flags: EmploymentFlag[] = [];
  const completed = records.filter(r => !r.isPresent && r.dateStarted && r.dateEnded)
    .sort((a, b) => new Date(a.dateStarted).getTime() - new Date(b.dateStarted).getTime());

  // Short Stint (<6 months)
  for (const r of completed) {
    const months = monthsBetween(r.dateStarted, r.dateEnded);
    if (months >= 0 && months < 6) {
      flags.push({
        id: `stint-${r.id}`, type: 'short_stint', severity: 'warning',
        description: `Short tenure of ${months} month${months !== 1 ? 's' : ''} at "${r.company}" as ${r.position}. Short stints may signal instability or issues.`,
        relatedJobIds: [r.id], dismissed: false,
      });
    }
  }

  // Gap Rule (>3 months between jobs)
  for (let i = 0; i < completed.length - 1; i++) {
    const gap = monthsBetween(completed[i].dateEnded, completed[i + 1].dateStarted);
    if (gap > 3) {
      flags.push({
        id: `gap-${i}`, type: 'gap', severity: 'warning',
        description: `${gap}-month employment gap between "${completed[i].company}" and "${completed[i + 1].company}". Applicant should explain this period.`,
        relatedJobIds: [completed[i].id, completed[i + 1].id], dismissed: false,
      });
    }
  }

  // Overlap Rule
  for (let i = 0; i < completed.length - 1; i++) {
    for (let j = i + 1; j < completed.length; j++) {
      if (new Date(completed[j].dateStarted) < new Date(completed[i].dateEnded)) {
        flags.push({
          id: `overlap-${i}-${j}`, type: 'overlap', severity: 'warning',
          description: `Employment overlap: "${completed[j].company}" started (${completed[j].dateStarted}) before "${completed[i].company}" ended (${completed[i].dateEnded}). May indicate moonlighting or a data entry error.`,
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
        description: `Reason for leaving "${r.company}" contains high-risk keyword: "${hit.toUpperCase()}". This must be clarified before proceeding to evaluation.`,
        relatedJobIds: [r.id], dismissed: false,
      });
    }
  }

  // Demotion Rule
  for (let i = 0; i < completed.length - 1; i++) {
    const cur = completed[i].position.toLowerCase();
    const nxt = completed[i + 1].position.toLowerCase();
    const curSenior = SENIOR_KEYWORDS.some(k => cur.includes(k));
    const nxtJunior = JUNIOR_KEYWORDS.some(k => nxt.includes(k));
    if (curSenior && nxtJunior) {
      flags.push({
        id: `demotion-${i}`, type: 'demotion', severity: 'warning',
        description: `Possible demotion from "${completed[i].position}" (${completed[i].company}) to "${completed[i + 1].position}" (${completed[i + 1].company}). Verify circumstances.`,
        relatedJobIds: [completed[i].id, completed[i + 1].id], dismissed: false,
      });
    }
  }

  return flags;
}

const FLAG_META: Record<EmploymentFlagType, { label: string; icon: React.ReactNode; color: string }> = {
  gap:                  { label: 'Employment Gap',     icon: <Clock size={15} />,       color: '#F59E0B' },
  short_stint:          { label: 'Short Tenure',       icon: <Zap size={15} />,          color: '#F97316' },
  red_flag_resignation: { label: 'Resignation Red Flag', icon: <ShieldAlert size={15} />, color: '#EF4444' },
  overlap:              { label: 'Date Overlap',       icon: <GitMerge size={15} />,    color: '#8B5CF6' },
  demotion:             { label: 'Possible Demotion',  icon: <TrendingDown size={15} />, color: '#EC4899' },
};

// ─── Shared input/table styles ─────────────────────────────────────────────────
const inp = 'w-full border border-slate-200 px-2.5 py-1.5 text-sm focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9]/20 outline-none rounded-lg bg-white';
const th  = 'px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50';
const td  = 'px-3 py-2 text-sm align-middle';

// ─── Identification Types ──────────────────────────────────────────────────────
const ID_TYPES = ['Passport', 'OWWA', 'TESDA', "Seaman's Book", 'UMID', "Driver's License", 'SSS', 'PhilHealth', 'Postal ID', 'Voter\'s ID', 'PRC License'];
const EDU_LEVELS = ['Elementary', 'Junior High School', 'Senior High School', 'Vocational / ALS', 'College', 'Post-Graduate'];
const LANG_COMPETENCY = ['Basic', 'Conversational', 'Proficient', 'Fluent', 'Native'];

// ─── Section component ─────────────────────────────────────────────────────────
function Section({ title, children, accent = false }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-xl border ${accent ? 'border-[#0EA5E9]/30 bg-[#0EA5E9]/5' : 'border-slate-200 bg-white'} overflow-hidden`}>
      <div className={`px-5 py-3 border-b ${accent ? 'border-[#0EA5E9]/20 bg-[#0EA5E9]/10' : 'border-slate-100 bg-slate-50'}`}>
        <h3 className={`text-sm font-bold ${accent ? 'text-[#0284C7]' : 'text-[#0F172A]'} uppercase tracking-wider`}>{title}</h3>
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
}

const BLANK_PERSONAL = {
  firstName: '', middleName: '', lastName: '',
  email: '', contact: '',
  dateOfBirth: '', age: '', sex: 'Male',
  religion: 'Roman Catholic', civilStatus: 'Single',
  weight: '', height: '',
  presentAddress: '',
  provincialAddress: '',
  role: '',
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Registration({
  showToast, currentUserName, addActivityLog,
  selectedApplicantId: initialId = 'new',
  updateApplicant, addApplicant, applicants = [],
}: RegistrationProps) {
  const [selectedApplicantId, setSelectedApplicantId] = useState(initialId);
  const [activeSection, setActiveSection] = useState<string>('personal');
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Job Order State ───────────────────────────────────────────────────────
  const [selectedJobOrderId, setSelectedJobOrderId] = useState('');
  const [openJobOrders, setOpenJobOrders] = useState<any[]>([]);

  useEffect(() => {
    const fetchLiveJobOrders = async () => {
      try {
        const res = await api.get('/job-orders');
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const liveOrders = res.data.map((jo: any) => ({
            id: jo.job_order_code || jo.job_code || `JO-${jo.job_order_id}`,
            code: jo.job_order_code || jo.job_code || `JO-${jo.job_order_id}`,
            position: jo.position_title || jo.position || 'General Position',
            country: jo.client_employer?.country?.country_name || jo.country || 'International',
            employerName: jo.client_employer?.company_name || jo.employer_name || 'Partner Principal',
            available: Math.max(0, (jo.total_slots || jo.slots || 1) - (jo.filled_slots || 0)),
          }));
          setOpenJobOrders(liveOrders);
        }
      } catch (err) {
        console.warn('Could not fetch live job orders for registration:', err);
      }
    };
    fetchLiveJobOrders();
  }, []);

  // Proof document upload helper
  const proofUpload = (
    onFile: (dataUrl: string, name: string) => void,
    existingName?: string
  ) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf,.doc,.docx';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => onFile(ev.target?.result as string, file.name);
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const [photo, setPhoto] = useState('');
  const [personal, setPersonal] = useState(BLANK_PERSONAL);
  const setP = (k: string, v: string) => setPersonal(p => ({ ...p, [k]: v }));

  const calcAge = (dob: string) => {
    if (!dob) return '';
    const diff = Date.now() - new Date(dob).getTime();
    return String(Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)));
  };

  // ── Identifications ───────────────────────────────────────────────────────
  const [ids, setIds] = useState<IdentificationRecord[]>([]);
  const addId = () => setIds(p => [...p, { id: `id-${Date.now()}`, type: 'Passport', identificationNo: '', expiryDate: '' }]);
  const setId = (id: string, k: keyof IdentificationRecord, v: string) => setIds(p => p.map(x => x.id === id ? { ...x, [k]: v } : x));
  const removeId = (id: string) => setIds(p => p.filter(x => x.id !== id));

  // ── Education ─────────────────────────────────────────────────────────────
  const [education, setEducation] = useState<EducationRecord[]>([]);
  const addEdu = () => setEducation(p => [...p, { id: `edu-${Date.now()}`, level: 'College', school: '', course: '', yearGraduated: '' }]);
  const setEdu = (id: string, k: keyof EducationRecord, v: string) => setEducation(p => p.map(x => x.id === id ? { ...x, [k]: v } : x));
  const removeEdu = (id: string) => setEducation(p => p.filter(x => x.id !== id));

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

  // ── Clear form helper ─────────────────────────────────────────────────────
  const resetBlankForm = () => {
    setPersonal(BLANK_PERSONAL);
    setSelectedJobOrderId('');
    setIds([]);
    setEducation([]);
    setCerts([]);
    setTrainings([]);
    setLanguages([]);
    setEmployment([]);
    setFlags([]);
    setFlagsAnalyzed(false);
    setPhoto('');
  };

  // ── Sync with prop when parent changes applicant selection ───────────────
  useEffect(() => {
    if (initialId) {
      setSelectedApplicantId(initialId);
    }
  }, [initialId]);

  // ── Sync form data when selecting applicant from prop ─────────────────────
  useEffect(() => {
    if (selectedApplicantId === 'new') {
      resetBlankForm();
      return;
    }
    const app = applicants.find(a => String(a.id) === String(selectedApplicantId));
    if (app) {
      setPersonal({
        firstName: app.firstName || '',
        middleName: app.middleName || '',
        lastName: app.lastName || '',
        email: app.email || '',
        contact: app.contact || '',
        dateOfBirth: app.dateOfBirth || '',
        age: String(app.age || ''),
        sex: app.sex || 'Male',
        religion: app.religion || 'Roman Catholic',
        civilStatus: app.civilStatus || 'Single',
        weight: app.weight || '',
        height: app.height || '',
        presentAddress: app.presentAddress || '',
        provincialAddress: app.provincialAddress || '',
        role: app.role || '',
      });
      if (app.selectedJobOrderId) setSelectedJobOrderId(app.selectedJobOrderId);
      if (app.identifications && app.identifications.length > 0) setIds(app.identifications);
      else setIds([]);
      if (app.education && app.education.length > 0) setEducation(app.education);
      else setEducation([]);
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
        setFlagsAnalyzed(false);
      }
    }
  }, [selectedApplicantId, applicants]);
  const [resolvingFlagId, setResolvingFlagId] = useState<string | null>(null);
  const [selectedQuickReason, setSelectedQuickReason] = useState('');
  const [customReason, setCustomReason] = useState('');

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
    setFlagsAnalyzed(false);
  };
  const removeEmp = (id: string) => { setEmployment(p => p.filter(x => x.id !== id)); setFlagsAnalyzed(false); };

  const runFlagEngine = () => {
    const newFlags = analyzeEmployment(employment);
    setFlags(newFlags);
    setFlagsAnalyzed(true);
    if (newFlags.length === 0) showToast('Employment history verified — no flags raised.');
    else showToast(`${newFlags.length} concern${newFlags.length > 1 ? 's' : ''} flagged in employment history. Review before proceeding.`);
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

  // ── Save Profile (Create New or Update Existing) ──────────────────────────
  const handleSave = async () => {
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
        const payload = {
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
          height: personal.height || undefined,
          weight: personal.weight || undefined,
          present_address: personal.presentAddress.trim() || undefined,
          provincial_address: personal.provincialAddress.trim() || undefined,
          applied_role: personal.role.trim() || 'Applicant',
          skills: certs.map((c: any) => c.title || c.name || '').filter(Boolean),
          certifications: certs.map((c: any) => c.title || c.name || '').filter(Boolean),
          work_experience: employment.map(e => ({
            companyName: e.company,
            position: e.position,
            startDate: e.dateStarted,
            endDate: e.dateEnded,
            country: e.country,
            isOverseas: e.country !== 'Philippines',
            responsibilities: e.reasonForLeaving ? [e.reasonForLeaving] : []
          })),
          current_phase: 1,
          status: 'Initial Screening',
          current_handler: currentUserName,
          current_department: 'Recruitment',
          phase_description: 'Newly registered applicant. Cleared for initial screening.',
        };

        const res = await api.post('/applicants', payload);
        const createdData = res.data;
        const newId = String(createdData.applicant_id);

        const newApplicantRecord: ApplicantRecord = {
          id: newId,
          name: `${personal.firstName} ${personal.lastName}`.trim(),
          firstName: personal.firstName,
          middleName: personal.middleName,
          lastName: personal.lastName,
          role: personal.role || 'Applicant',
          jobOrder: selectedJobOrderId ? (() => { const jo = openJobOrders.find(j => j.id === selectedJobOrderId); return jo ? `${jo.code} (${jo.employerName})` : 'Unassigned'; })() : 'Unassigned',
          phase: 1,
          status: 'Initial Screening',
          currentHandler: currentUserName,
          currentDepartment: 'Recruitment',
          lastUpdated: new Date().toLocaleString(),
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
          height: personal.height,
          weight: personal.weight,
          skills: certs.map((c: any) => c.title || c.name || '').filter(Boolean),
          certifications: certs.map((c: any) => c.title || c.name || '').filter(Boolean),
          workExperience: payload.work_experience,
          employmentHistory: employment,
          employmentFlags: flags,
          address: personal.presentAddress || personal.provincialAddress,
          testScores: { englishProficiency: 85, tradeSkills: 88, iqAptitude: 80, personalityEQ: 'Suitable' },
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
          details: `Registered new applicant ${personal.lastName}, ${personal.firstName} (ID #${newId}) with active Phase 1 screening.`,
        });

        showToast(`✓ New applicant "${personal.firstName} ${personal.lastName}" registered successfully! (ID: #${newId})`);
        resetBlankForm();
      } else {
        // ── UPDATE EXISTING APPLICANT VIA PUT /applicants/{id} ───────────────
        const numericId = parseInt(selectedApplicantId, 10);
        if (!isNaN(numericId)) {
          await api.put(`/applicants/${numericId}`, {
            first_name: personal.firstName,
            middle_name: personal.middleName,
            last_name: personal.lastName,
            email: personal.email,
            contact_number: personal.contact,
            birth_date: personal.dateOfBirth,
            gender: personal.sex,
            sex: personal.sex,
            civil_status: personal.civilStatus,
            present_address: personal.presentAddress,
            provincial_address: personal.provincialAddress,
            applied_role: personal.role,
            skills: certs.map((c: any) => c.name || c.title || '').filter(Boolean),
          });
        }

        if (updateApplicant) {
          updateApplicant(selectedApplicantId, {
            firstName: personal.firstName,
            middleName: personal.middleName,
            lastName: personal.lastName,
            name: `${personal.firstName} ${personal.middleName} ${personal.lastName}`.trim(),
            email: personal.email,
            contact: personal.contact,
            dateOfBirth: personal.dateOfBirth,
            age: parseInt(personal.age, 10) || 30,
            sex: personal.sex as 'Male' | 'Female',
            religion: personal.religion,
            civilStatus: personal.civilStatus as any,
            weight: personal.weight,
            height: personal.height,
            presentAddress: personal.presentAddress,
            provincialAddress: personal.provincialAddress,
            role: personal.role,
            skills: certs.map((c: any) => c.title || c.name || '').filter(Boolean),
            certifications: certs.map((c: any) => c.title || c.name || '').filter(Boolean),
            employmentHistory: employment,
            employmentFlags: flags,
          });
        }

        addActivityLog({
          applicantId: selectedApplicantId,
          action: 'Profile Updated',
          performedBy: currentUserName,
          department: 'Recruitment',
          details: `Updated profile details for applicant #${selectedApplicantId} (${personal.lastName}, ${personal.firstName}).`,
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
    { id: 'personal',      label: 'Personal Info'   },
    { id: 'identifications', label: 'Identifications' },
    { id: 'education',     label: 'Education'        },
    { id: 'certificates',  label: 'Certificates'     },
    { id: 'trainings',     label: 'Trainings'        },
    { id: 'languages',     label: 'Languages'        },
    { id: 'employment',    label: 'Work Experience'  },
  ];

  const ratingBar = (val: number, onChange: (n: number) => void) => (
    <div className="flex items-center gap-2">
      <input type="range" min={1} max={10} value={val} onChange={e => onChange(Number(e.target.value))} className="flex-1 h-1.5 accent-[#0EA5E9]" />
      <span className="text-xs font-bold w-6 text-right text-[#0EA5E9]">{val}</span>
    </div>
  );

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-[#0EA5E9]" /> Applicant Registration
          </h2>
          <p className="text-sm text-slate-500 mt-1">Complete profile encoding for overseas deployment processing</p>
        </div>
        {hasBlockingFlags && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm font-semibold">
            <ShieldAlert size={16} /> {activeFlagCount} unresolved flag{activeFlagCount > 1 ? 's' : ''} — cannot save
          </div>
        )}
      </div>

      {/* Mode Banner */}
      <div className={`p-4 rounded-xl border flex items-center justify-between flex-wrap gap-3 ${
        selectedApplicantId === 'new'
          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
          : 'bg-sky-50 border-sky-200 text-sky-900'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-sm ${
            selectedApplicantId === 'new'
              ? 'bg-emerald-600 text-white'
              : 'bg-[#0EA5E9] text-white'
          }`}>
            {selectedApplicantId === 'new' ? <UserPlus size={20} /> : <User size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                selectedApplicantId === 'new'
                  ? 'bg-emerald-200 text-emerald-800'
                  : 'bg-sky-200 text-sky-800'
              }`}>
                {selectedApplicantId === 'new' ? '✨ New Candidate Intake Mode' : `✏️ Editing Applicant #${selectedApplicantId}`}
              </span>
              {selectedApplicantId === 'new' ? (
                <span className="text-xs text-emerald-700 font-semibold">Clean intake form · Ready for encoding</span>
              ) : (
                <span className="text-xs text-sky-700 font-semibold">Active candidate profile</span>
              )}
            </div>
            <p className="text-sm font-medium text-slate-800 mt-1">
              {selectedApplicantId === 'new'
                ? 'Enter candidate details below. Clicking "Register New Applicant" provisions the candidate profile with Phase 1 Initial Screening.'
                : `Updating candidate profile for ${personal.firstName || ''} ${personal.lastName || ''} (${personal.role || 'Applicant'}).`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedApplicantId !== 'new' ? (
            <button
              onClick={() => {
                setSelectedApplicantId('new');
                resetBlankForm();
                showToast('Switched to blank form: Registering a new candidate.');
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
            >
              <UserPlus size={14} /> + Register New Candidate
            </button>
          ) : (
            <button
              onClick={() => {
                resetBlankForm();
                showToast('Form cleared.');
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg transition-colors shadow-sm"
            >
              <Trash2 size={13} className="text-emerald-600" /> Clear Form
            </button>
          )}
        </div>
      </div>

      {applicants.length > 0 && (
        <InlineApplicantSelector
          applicants={applicants}
          selectedApplicantId={selectedApplicantId}
          onSelectApplicant={setSelectedApplicantId}
        />
      )}

      {/* Job Order Selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Briefcase size={13} /> Prospecting Job Order
        </label>
        <select
          value={selectedJobOrderId}
          onChange={e => {
            setSelectedJobOrderId(e.target.value);
            const jo = openJobOrders.find(j => j.id === e.target.value);
            if (jo) setPersonal(p => ({ ...p, role: jo.position }));
          }}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] bg-white"
        >
          <option value="">-- Select job order applicant is applying for --</option>
          {openJobOrders.map(jo => (
            <option key={jo.id} value={jo.id}>
              {jo.code} · {jo.position} · {jo.country} ({jo.employerName}) · {jo.available} slot{jo.available !== 1 ? 's' : ''} open
            </option>
          ))}
        </select>
        {selectedJobOrderId && (() => {
          const jo = openJobOrders.find(j => j.id === selectedJobOrderId);
          return jo ? (
            <p className="text-xs text-[#0EA5E9] mt-1.5 flex items-center gap-1">
              <CheckCircle2 size={11} /> Role field auto-filled to "{jo.position}" — change in Personal Info if needed
            </p>
          ) : null;
        })()}
      </div>

      {/* Section Nav */}
      <div className="space-y-2">
        <div className="flex gap-1 flex-wrap bg-slate-100 p-1 rounded-xl">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeSection === s.id ? 'bg-white text-[#0F172A] shadow-sm' : 'text-slate-500 hover:text-slate-700'
              } ${s.id === 'employment' && hasBlockingFlags ? 'text-red-600' : ''}`}
            >
              {s.label}
              {s.id === 'personal' ? (
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100/80 px-1.5 py-0.5 rounded">Required *</span>
              ) : (
                <span className="text-[10px] text-slate-400 font-normal">Optional</span>
              )}
              {s.id === 'employment' && activeFlagCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center flex-shrink-0">{activeFlagCount}</span>
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 px-1">
          <strong className="text-slate-600">Intake Note:</strong> Only <strong>First Name</strong> and <strong>Last Name</strong> in <em>Personal Info</em> are required to register. Other sections (Identifications, Education, Certificates, Work History) can be encoded now or completed during Phase 1 processing.
        </p>
      </div>

      {/* ── Personal Info ────────────────────────────────────────────────────── */}
      {activeSection === 'personal' && (
        <Section title="Personal Information">
          <div className="flex gap-6">
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
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => {
                const f = e.target.files?.[0]; if (!f) return;
                const reader = new FileReader();
                reader.onload = ev => setPhoto(ev.target?.result as string);
                reader.readAsDataURL(f);
              }} />
              {photo && <button onClick={() => setPhoto('')} className="text-[10px] text-slate-400 hover:text-red-500 mt-1 w-full text-center">Remove</button>}
            </div>

            {/* Fields */}
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
                  <option>Male</option><option>Female</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Religion</label>
                <input className={inp} value={personal.religion} onChange={e => setP('religion', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Civil Status</label>
                <select className={inp} value={personal.civilStatus} onChange={e => setP('civilStatus', e.target.value)}>
                  <option>Single</option><option>Married</option><option>Widowed</option><option>Separated</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Weight</label>
                  <input className={inp} value={personal.weight} onChange={e => setP('weight', e.target.value)} placeholder="kg" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Height</label>
                  <input className={inp} value={personal.height} onChange={e => setP('height', e.target.value)} placeholder="cm or ft" />
                </div>
              </div>

              <div className="col-span-3">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Present Address</label>
                <input className={inp} value={personal.presentAddress} onChange={e => setP('presentAddress', e.target.value)} placeholder="Brgy., City, Province" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Provincial Address (if different)</label>
                <input className={inp} value={personal.provincialAddress} onChange={e => setP('provincialAddress', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Target Position / Role</label>
                <input className={inp} value={personal.role} onChange={e => setP('role', e.target.value)} placeholder="e.g. Industrial Welder" />
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* ── Identifications ────────────────────────────────────────────────────── */}
      {activeSection === 'identifications' && (
        <Section title="Government & Other Identifications">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={th}>Identification Type</th>
                  <th className={th}>Identification No.</th>
                  <th className={th}>Expiry Date</th>
                  <th className={th}>Proof / Scan</th>
                  <th className={th + ' w-10'}></th>
                </tr>
              </thead>
              <tbody>
                {ids.map(row => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className={td}>
                      <select className={inp} value={row.type} onChange={e => setId(row.id, 'type', e.target.value)}>
                        {ID_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className={td}><input className={inp} value={row.identificationNo} onChange={e => setId(row.id, 'identificationNo', e.target.value)} placeholder="ID / Serial Number" /></td>
                    <td className={td}><input className={inp} type="date" value={row.expiryDate} onChange={e => setId(row.id, 'expiryDate', e.target.value)} /></td>
                    <td className={td}>
                      {row.proofDocumentUrl
                        ? <div className="flex items-center gap-1.5">
                            <FileCheck size={13} className="text-[#10B981] flex-shrink-0" />
                            <span className="text-xs text-[#10B981] truncate max-w-[120px]" title={row.proofDocumentName}>{row.proofDocumentName}</span>
                            <button onClick={() => setId(row.id, 'proofDocumentUrl', '')} className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"><X size={12} /></button>
                          </div>
                        : <button onClick={() => proofUpload((url, name) => { setId(row.id, 'proofDocumentUrl', url); setId(row.id, 'proofDocumentName', name); })} className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#0EA5E9] border border-dashed border-slate-200 hover:border-[#0EA5E9] px-2 py-1 rounded transition-all">
                            <Upload size={11} /> Upload
                          </button>
                      }
                    </td>
                    <td className={td}><button onClick={() => removeId(row.id)} className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded transition-colors text-slate-400"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={addId} className="mt-3 flex items-center gap-1.5 text-sm text-[#0EA5E9] hover:text-[#0284C7] font-medium transition-colors">
            <Plus size={15} /> Add Identification
          </button>
        </Section>
      )}

      {/* ── Education ─────────────────────────────────────────────────────────── */}
      {activeSection === 'education' && (
        <Section title="Educational Background">
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
                        {EDU_LEVELS.map(l => <option key={l}>{l}</option>)}
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
      )}

      {/* ── Certificates ──────────────────────────────────────────────────────── */}
      {activeSection === 'certificates' && (
        <Section title="Certifications / Licenses">
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
                  <th className={th}>Proof</th>
                  <th className={th + ' w-10'}></th>
                </tr>
              </thead>
              <tbody>
                {certs.map(row => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className={td}><input className={inp} value={row.title} onChange={e => setCert(row.id, 'title', e.target.value)} placeholder="Certificate name" /></td>
                    <td className={td}><input className={inp} value={row.serialNo} onChange={e => setCert(row.id, 'serialNo', e.target.value)} placeholder="Serial / Cert No." /></td>
                    <td className={td}><input className={inp} value={row.issuedBy} onChange={e => setCert(row.id, 'issuedBy', e.target.value)} placeholder="Issuing body" /></td>
                    <td className={td}><input className={inp} value={row.noOfHours} onChange={e => setCert(row.id, 'noOfHours', e.target.value)} placeholder="hrs" /></td>
                    <td className={td}><input className={inp} type="date" value={row.competencyDateIssued} onChange={e => setCert(row.id, 'competencyDateIssued', e.target.value)} /></td>
                    <td className={td}><input className={inp} type="date" value={row.expiryDate} onChange={e => setCert(row.id, 'expiryDate', e.target.value)} /></td>
                    <td className={td}>
                      {row.proofDocumentUrl
                        ? <div className="flex items-center gap-1"><FileCheck size={13} className="text-[#10B981]" /><span className="text-xs text-[#10B981] truncate max-w-[80px]" title={row.proofDocumentName}>{row.proofDocumentName}</span><button onClick={() => { setCert(row.id, 'proofDocumentUrl', ''); setCert(row.id, 'proofDocumentName', ''); }} className="text-slate-300 hover:text-red-400"><X size={11} /></button></div>
                        : <button onClick={() => proofUpload((url, name) => { setCert(row.id, 'proofDocumentUrl', url); setCert(row.id, 'proofDocumentName', name); })} className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#0EA5E9] border border-dashed border-slate-200 hover:border-[#0EA5E9] px-2 py-1 rounded transition-all"><Upload size={11} /> Upload</button>
                      }
                    </td>
                    <td className={td}><button onClick={() => removeCert(row.id)} className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded transition-colors text-slate-400"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={addCert} className="mt-3 flex items-center gap-1.5 text-sm text-[#0EA5E9] hover:text-[#0284C7] font-medium transition-colors">
            <Plus size={15} /> Add Certificate
          </button>
        </Section>
      )}

      {/* ── Trainings ─────────────────────────────────────────────────────────── */}
      {activeSection === 'trainings' && (
        <Section title="Trainings Attended">
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
                  <th className={th}>Proof</th>
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
                    <td className={td}>
                      {row.proofDocumentUrl
                        ? <div className="flex items-center gap-1"><FileCheck size={13} className="text-[#10B981]" /><span className="text-xs text-[#10B981] truncate max-w-[80px]" title={row.proofDocumentName}>{row.proofDocumentName}</span><button onClick={() => { setTraining(row.id, 'proofDocumentUrl', ''); setTraining(row.id, 'proofDocumentName', ''); }} className="text-slate-300 hover:text-red-400"><X size={11} /></button></div>
                        : <button onClick={() => proofUpload((url, name) => { setTraining(row.id, 'proofDocumentUrl', url); setTraining(row.id, 'proofDocumentName', name); })} className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#0EA5E9] border border-dashed border-slate-200 hover:border-[#0EA5E9] px-2 py-1 rounded transition-all"><Upload size={11} /> Upload</button>
                      }
                    </td>
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
      )}

      {/* ── Languages ─────────────────────────────────────────────────────────── */}
      {activeSection === 'languages' && (
        <Section title="Language Proficiency">
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
                    <td className={td}><input className={inp} value={row.language} onChange={e => setLang(row.id, 'language', e.target.value)} placeholder="Language / Dialect" /></td>
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
          </div>
          <button onClick={addLang} className="mt-3 flex items-center gap-1.5 text-sm text-[#0EA5E9] hover:text-[#0284C7] font-medium transition-colors">
            <Plus size={15} /> Add Language
          </button>
        </Section>
      )}

      {/* ── Employment History ────────────────────────────────────────────────── */}
      {activeSection === 'employment' && (
        <div className="space-y-4">
          <Section title="Work Experience / Employment History">
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
                    <tr key={row.id} className={`border-b border-slate-100 hover:bg-slate-50/50 ${flags.some(f => !f.dismissed && f.relatedJobIds.includes(row.id)) ? 'bg-red-50/40' : ''}`}>
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
            <div className="flex items-center gap-3 mt-3">
              <button onClick={addEmp} className="flex items-center gap-1.5 text-sm text-[#0EA5E9] hover:text-[#0284C7] font-medium transition-colors">
                <Plus size={15} /> Add Employment
              </button>
              <button
                onClick={runFlagEngine}
                className="ml-auto flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <Flag size={15} /> Run Employment Flag Check
              </button>
            </div>
          </Section>

          {/* Flags Panel */}
          {flagsAnalyzed && (
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
                      <div key={flag.id} className={`rounded-xl border transition-all overflow-hidden ${
                        flag.dismissed ? 'opacity-70 border-slate-200 bg-slate-50' : isOpen ? 'border-[#0EA5E9] bg-white shadow-md' : 'border-amber-200 bg-amber-50/50 hover:border-amber-300'
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
                                  className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
                                    selectedQuickReason === r
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

          {!flagsAnalyzed && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex items-center gap-3 text-sm text-blue-700">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>Click <strong>"Run Employment Flag Check"</strong> after entering all employment history. The system will automatically evaluate gaps, short stints, resignation keywords, overlapping dates, and possible demotions.</span>
            </div>
          )}
        </div>
      )}

      {/* Save / Register Button */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 gap-4 flex-wrap">
        <div className="text-xs text-slate-400">
          {hasBlockingFlags ? (
            <span className="text-red-500 font-semibold flex items-center gap-1.5">
              <ShieldAlert size={14} /> Resolve all {activeFlagCount} flag{activeFlagCount > 1 ? 's' : ''} in Work Experience before saving
            </span>
          ) : employment.length > 0 && !flagsAnalyzed ? (
            <span className="flex items-center gap-1.5 text-amber-600 font-medium">
              <AlertCircle size={14} /> Run Employment Flag Check on Work Experience tab before saving
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
        <button
          onClick={handleSave}
          disabled={hasBlockingFlags || (employment.length > 0 && !flagsAnalyzed) || isSubmitting || !personal.firstName.trim() || !personal.lastName.trim()}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
            hasBlockingFlags || (employment.length > 0 && !flagsAnalyzed) || isSubmitting || !personal.firstName.trim() || !personal.lastName.trim()
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
              : selectedApplicantId === 'new'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20'
                : 'bg-[#0EA5E9] hover:bg-[#0284C7] text-white shadow-md shadow-[#0EA5E9]/20'
          }`}
        >
          {isSubmitting ? (
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
              <Save size={16} /> Save Applicant #{selectedApplicantId} Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}
