import React, { useState, useEffect, useMemo } from 'react';
import {
  HeartPulse,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
  User,
  Search,
  UserPlus,
  Ban,
  RefreshCw,
  X,
  ChevronDown,
  Check,
  Calendar,
  Sparkles,
  ShieldAlert,
  Loader2,
  CheckCircle,
  Plus,
  Lock,
  RotateCcw,
  Pencil,
  Trash2,
  ExternalLink,
  Info,
  UserMinus,
  UserCheck,
  FileText,
  Briefcase,
  Phone
} from 'lucide-react';
import { WorkflowState, ActivityLog, ApplicantRecord, Clinic, ClinicReferral, ExpenseRecord } from '../../types';
import { api } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';

interface FitToWorkProps {
  workflow: WorkflowState;
  updateWorkflow: (updates: Partial<WorkflowState>) => void;
  showToast: (message: string) => void;
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  updateApplicant: (applicantId: string, updates: Partial<ApplicantRecord>) => void;
  selectedApplicantId?: string;
  applicants?: ApplicantRecord[];
  addExpense?: (expense: Omit<ExpenseRecord, 'id'>) => void;
}

// ── Candidate Display Utilities ─────────────────────────────────────────────
const AVATAR_PALETTES = [
  { bg: 'bg-indigo-50/90', text: 'text-indigo-700', border: 'border-indigo-200/80' },
  { bg: 'bg-sky-50/90', text: 'text-sky-700', border: 'border-sky-200/80' },
  { bg: 'bg-emerald-50/90', text: 'text-emerald-700', border: 'border-emerald-200/80' },
  { bg: 'bg-violet-50/90', text: 'text-violet-700', border: 'border-violet-200/80' },
  { bg: 'bg-amber-50/90', text: 'text-amber-800', border: 'border-amber-200/80' },
  { bg: 'bg-rose-50/90', text: 'text-rose-700', border: 'border-rose-200/80' },
  { bg: 'bg-teal-50/90', text: 'text-teal-700', border: 'border-teal-200/80' },
  { bg: 'bg-blue-50/90', text: 'text-blue-700', border: 'border-blue-200/80' },
];

function getCandidateInitials(name?: string): string {
  if (!name) return '??';
  // Strip common honorifics / professional titles
  const clean = name.replace(/^(engr\.|dr\.|mr\.|ms\.|mrs\.|atty\.|arch\.|prof\.)\s+/i, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return name.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function getAvatarColorStyle(name: string = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

function formatRoleTitle(role?: string): string {
  if (!role) return 'Unspecified Role';
  const knownAcronyms = new Set([
    'SMAW', 'GTAW', 'GMAW', 'FCAW', 'IT', 'RN', 'MD', 'CCTV', 'HVAC', 'CNC', 'HR', 'QA', 'QC', 'BFP', 'DOH', 'TESDA'
  ]);

  return role
    .split(' ')
    .map(word => {
      const stripped = word.replace(/[(),]/g, '');
      if (stripped.includes('/')) {
        const subParts = stripped.split('/');
        const isAllAcronyms = subParts.every(p => knownAcronyms.has(p.toUpperCase()) || p.length <= 4);
        if (isAllAcronyms) return word.toUpperCase();
      }
      if (knownAcronyms.has(stripped.toUpperCase())) {
        return word.toUpperCase();
      }
      if (word.length <= 2 && word.toUpperCase() === word) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function formatContactNumber(phone?: string): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  // +639179545717 -> +63 917 954 5717
  if (trimmed.startsWith('+63') && trimmed.length === 13) {
    return `+63 ${trimmed.slice(3, 6)} ${trimmed.slice(6, 9)} ${trimmed.slice(9)}`;
  }
  // 09179545717 -> 0917 954 5717
  if (trimmed.startsWith('09') && trimmed.length === 11) {
    return `${trimmed.slice(0, 4)} ${trimmed.slice(4, 7)} ${trimmed.slice(7)}`;
  }
  return trimmed;
}

export default function FitToWork({
  workflow,
  updateWorkflow,
  showToast,
  currentUserName,
  addActivityLog,
  updateApplicant,
  selectedApplicantId: initialApplicantId,
  applicants = [],
  addExpense
}: FitToWorkProps) {
  // ── Database state for clinics and clinic referrals from Supabase ─────────
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [referrals, setReferrals] = useState<Record<string, ClinicReferral>>({});
  const [isLoadingData, setIsLoadingData] = useState(false);

  // ── Filter & Search States ────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'FIT' | 'UNFIT' | 'PROVISIONAL'>('ALL');
  const [queueTab, setQueueTab] = useState<'ALL' | 'MY_QUEUE' | 'UNASSIGNED' | 'PROVISIONAL'>('ALL');
  const [selectedClinicFilter, setSelectedClinicFilter] = useState<string>('ALL');

  // ── Modals State ──────────────────────────────────────────────────────────
  // 1. Unfit Reason & Clinical Findings Modal (Allows Provisional OR Return to Screening)
  const [showUnfitModal, setShowUnfitModal] = useState(false);
  const [unfitApplicant, setUnfitApplicant] = useState<ApplicantRecord | null>(null);
  const [unfitCategory, setUnfitCategory] = useState('Cardiovascular / Hypertension');
  const [unfitRemarks, setUnfitRemarks] = useState('');
  const [unfitActionChoice, setUnfitActionChoice] = useState<'PROVISIONAL' | 'RETURN_TO_SCREENING'>('PROVISIONAL');
  const [isSubmittingUnfit, setIsSubmittingUnfit] = useState(false);

  // 2. Direct Return to Screening Panel Pool Modal
  const [showReturnScreeningModal, setShowReturnScreeningModal] = useState(false);
  const [returningApplicant, setReturningApplicant] = useState<ApplicantRecord | null>(null);
  const [returnScreeningReason, setReturnScreeningReason] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  // 3. Fit to Work Status Update Modal (Advance to Applicant Profiling)
  const [showFitConfirmModal, setShowFitConfirmModal] = useState(false);
  const [fitApplicant, setFitApplicant] = useState<ApplicantRecord | null>(null);
  const [isSubmittingFit, setIsSubmittingFit] = useState(false);

  // 4. Medical Facilities Directory Modal (Add, Edit, and Directory Management)
  const [showAddClinicModal, setShowAddClinicModal] = useState(false);
  const [clinicModalTab, setClinicModalTab] = useState<'add' | 'manage'>('add');
  const [clinicSearchQuery, setClinicSearchQuery] = useState('');
  const [targetApplicantForClinic, setTargetApplicantForClinic] = useState<ApplicantRecord | null>(null);

  // Add Clinic Form State
  const [newClinicName, setNewClinicName] = useState('');
  const [newClinicAddress, setNewClinicAddress] = useState('');
  const [newClinicContact, setNewClinicContact] = useState('');
  const [newClinicEmail, setNewClinicEmail] = useState('');
  const [newClinicStatus, setNewClinicStatus] = useState<'ACTIVE' | 'EXTERNAL' | 'HOSPITAL'>('ACTIVE');
  const [newClinicLicenseRef, setNewClinicLicenseRef] = useState('');
  const [isSavingClinic, setIsSavingClinic] = useState(false);

  // Edit Clinic Form State
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null);
  const [editClinicName, setEditClinicName] = useState('');
  const [editClinicAddress, setEditClinicAddress] = useState('');
  const [editClinicContact, setEditClinicContact] = useState('');
  const [editClinicEmail, setEditClinicEmail] = useState('');
  const [editClinicStatus, setEditClinicStatus] = useState<'ACTIVE' | 'EXTERNAL' | 'HOSPITAL' | 'INACTIVE'>('ACTIVE');
  const [editClinicLicenseRef, setEditClinicLicenseRef] = useState('');
  const [isUpdatingClinic, setIsUpdatingClinic] = useState(false);

  // Delete Clinic State
  const [deletingClinic, setDeletingClinic] = useState<Clinic | null>(null);
  const [isDeletingClinic, setIsDeletingClinic] = useState(false);

  // 5. Stop Processing Modal for Provisional
  const [showStopModal, setShowStopModal] = useState(false);
  const [stoppingApplicant, setStoppingApplicant] = useState<ApplicantRecord | null>(null);
  const [stopReason, setStopReason] = useState('');
  const [isSubmittingStop, setIsSubmittingStop] = useState(false);

  // ── Load Clinics and Referrals from Supabase ──────────────────────────────
  const loadClinicsAndReferrals = async () => {
    setIsLoadingData(true);
    try {
      const [clinicsRes, referralsRes] = await Promise.all([
        api.get<Clinic[]>('/clinics').catch(() => ({ data: [] })),
        api.get<ClinicReferral[]>('/clinic-referrals').catch(() => ({ data: [] }))
      ]);

      if (clinicsRes.data && Array.isArray(clinicsRes.data)) {
        // Normalize clinics with both camelCase and snake_case properties
        const normalized = clinicsRes.data.map((c: any) => ({
          ...c,
          clinicId: Number(c.clinicId ?? c.clinic_id ?? 0),
          clinic_id: Number(c.clinic_id ?? c.clinicId ?? 0),
          clinicName: String(c.clinicName || c.clinic_name || '').trim(),
          clinic_name: String(c.clinic_name || c.clinicName || '').trim(),
        }));
        setClinics(normalized);
      }

      if (referralsRes.data && Array.isArray(referralsRes.data)) {
        const refMap: Record<string, ClinicReferral> = {};
        referralsRes.data.forEach((r: any) => {
          const appId = String(r.applicantId || r.applicant_id);
          const clinicObj = r.clinic ? {
            ...r.clinic,
            clinicId: Number(r.clinic.clinicId ?? r.clinic.clinic_id ?? 0),
            clinic_id: Number(r.clinic.clinic_id ?? r.clinic.clinicId ?? 0),
            clinicName: String(r.clinic.clinicName || r.clinic.clinic_name || '').trim(),
            clinic_name: String(r.clinic.clinic_name || r.clinic.clinicName || '').trim(),
          } : undefined;

          refMap[appId] = {
            ...r,
            applicantId: Number(r.applicantId || r.applicant_id),
            clinicId: Number(r.clinicId || r.clinic_id),
            medicalStatus: r.medicalStatus || r.medical_status || 'PENDING',
            referralDate: r.referralDate || r.referral_date,
            clinic: clinicObj
          };
        });
        setReferrals(refMap);
      }
    } catch (err) {
      console.error('Error loading clinic data:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadClinicsAndReferrals();

    // Live Real-Time Subscription to clinic referrals and partner clinics
    const channel = supabase
      .channel('realtime:fit_to_work_clearance')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clinic_referral' },
        (payload: any) => {
          console.log('[FitToWork] Realtime clinic referral update:', payload.eventType);
          loadClinicsAndReferrals();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clinic' },
        (payload: any) => {
          console.log('[FitToWork] Realtime clinic update:', payload.eventType);
          loadClinicsAndReferrals();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ── Filter applicants eligible for Fit-to-Work Clearance ──────────────────
  const medicalApplicants = useMemo(() => {
    return applicants.filter(a => {
      if (a.isStopped || a.status === 'Processing Stopped') return false;

      const isMedicalPhase =
        a.status === 'Medical Clearance' ||
        a.status === 'Medical Referral' ||
        (a.phase === 2 && a.status !== 'Applicant Profiling') ||
        (a.status === 'Provisional' && (
          a.phase === 2 ||
          a.phaseDescription?.toLowerCase().includes('medical') ||
          a.phaseDescription?.toLowerCase().includes('unfit')
        ));

      return isMedicalPhase;
    });
  }, [applicants]);

  // ── Helper to resolve clinic name for an applicant (Defaults to Pending!) ─
  const getApplicantClinicName = (applicantId: string): string => {
    const ref = referrals[applicantId];
    if (ref && ref.clinic && (ref.clinic.clinicName || (ref.clinic as any).clinic_name)) {
      return ref.clinic.clinicName || (ref.clinic as any).clinic_name;
    }
    const app = applicants.find(a => String(a.id) === applicantId);
    if (app?.medicalReferralClinic && app.medicalReferralClinic !== 'Pending Clinic Assignment') {
      return app.medicalReferralClinic;
    }
    return ''; // Returns empty so UI renders default 'Pending'
  };

  // ── Helper to resolve clinic badge info & facility classification ──────────
  const getClinicBadgeInfo = (clinicName?: string) => {
    if (!clinicName || clinicName === 'Pending' || clinicName.toLowerCase().includes('pending')) {
      return {
        label: 'Pending Selection',
        className: 'text-amber-700 bg-amber-50 border-amber-200',
        tooltip: 'Medical examining facility pending staff referral or candidate submission',
      };
    }

    const found = clinics.find((c: any) => 
      (c.clinicName || c.clinic_name || '').toLowerCase() === clinicName.toLowerCase()
    );
    const status = (found?.accreditationStatus || (found as any)?.accreditation_status || '').toUpperCase();
    const nameLower = clinicName.toLowerCase();

    if (status === 'EXTERNAL' || nameLower.includes('private') || nameLower.includes('home clinic') || nameLower.includes('diagnostic center') || nameLower.includes('family clinic')) {
      return {
        label: 'Agency Verified',
        className: 'text-sky-700 bg-sky-50 border-sky-200',
        tooltip: 'Private/local clinic record verified by agency staff against DOH/PRC credentials',
      };
    }

    if (status === 'HOSPITAL' || nameLower.includes('hospital') || nameLower.includes('medical center')) {
      return {
        label: 'Hospital Verified',
        className: 'text-indigo-700 bg-indigo-50 border-indigo-200',
        tooltip: 'Licensed hospital or tertiary medical center verified by recruitment staff',
      };
    }

    if (status === 'INACTIVE') {
      return {
        label: 'Inactive',
        className: 'text-slate-600 bg-slate-100 border-slate-200',
        tooltip: 'Facility temporarily inactive or suspended',
      };
    }

    return {
      label: 'Partner Facility',
      className: 'text-teal-700 bg-teal-50 border-teal-200',
      tooltip: 'Pre-vetted agency partner diagnostic center in compliance with DMW PEME guidelines',
    };
  };

  // ── Helper to resolve referral date ───────────────────────────────────────
  const getApplicantReferralDate = (applicantId: string): string => {
    const ref = referrals[applicantId];
    if (ref && (ref.referralDate || (ref as any).referral_date)) {
      return ref.referralDate || (ref as any).referral_date;
    }
    const app = applicants.find(a => String(a.id) === applicantId);
    if (app?.medicalReferralDate) {
      return app.medicalReferralDate;
    }
    return new Date().toISOString().split('T')[0];
  };

  // ── Helper to resolve clearance status from referral and record ───────────
  const getClearanceStatus = (app: ApplicantRecord): 'PENDING' | 'FIT_TO_WORK' | 'UNFIT_TO_WORK' => {
    if (app.status === 'Provisional') return 'UNFIT_TO_WORK';
    const ref = referrals[String(app.id)];
    if (ref) {
      const s = (ref.medicalStatus || (ref as any).medical_status || '').toUpperCase();
      if (s === 'FIT_TO_WORK' || s === 'FIT') return 'FIT_TO_WORK';
      if (s === 'UNFIT_TO_WORK' || s === 'NOT_FIT' || s === 'UNFIT') return 'UNFIT_TO_WORK';
    }
    return 'PENDING';
  };

  // ── Filtered Applicants based on Queue Tab, Search, and Status ────────────
  const filteredApplicants = useMemo(() => {
    return medicalApplicants.filter(a => {
      // 1. Queue Tab Filter
      const isAssignedToMe = a.currentHandler?.trim().toLowerCase() === currentUserName.trim().toLowerCase();
      const isUnassigned = !a.currentHandler || a.currentHandler === 'Unassigned' || a.currentHandler === 'Unassigned Pool' || a.currentHandler === 'System Agent';
      const isProv = a.status === 'Provisional';

      if (queueTab === 'MY_QUEUE' && !isAssignedToMe) return false;
      if (queueTab === 'UNASSIGNED' && !isUnassigned) return false;
      if (queueTab === 'PROVISIONAL' && !isProv) return false;

      // 2. Status Filter
      const currentClearance = getClearanceStatus(a);
      if (statusFilter === 'PENDING' && currentClearance !== 'PENDING') return false;
      if (statusFilter === 'FIT' && currentClearance !== 'FIT_TO_WORK') return false;
      if (statusFilter === 'UNFIT' && currentClearance !== 'UNFIT_TO_WORK') return false;
      if (statusFilter === 'PROVISIONAL' && !isProv) return false;

      // 3. Clinic Filter
      const clinicName = getApplicantClinicName(String(a.id));
      if (selectedClinicFilter !== 'ALL' && clinicName !== selectedClinicFilter) return false;

      // 4. Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = a.name?.toLowerCase().includes(q);
        const matchCode = a.applicantCode?.toLowerCase().includes(q) || String(a.id).toLowerCase().includes(q);
        const matchRole = a.role?.toLowerCase().includes(q);
        const matchClinic = clinicName.toLowerCase().includes(q);
        const matchHandler = a.currentHandler?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchRole && !matchClinic && !matchHandler) {
          return false;
        }
      }

      return true;
    });
  }, [medicalApplicants, queueTab, statusFilter, selectedClinicFilter, searchQuery, currentUserName, referrals, clinics]);

  // ── Metric Counts ─────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    let pendingCount = 0;
    let fitCount = 0;
    let unfitProvisionalCount = 0;
    let myQueueCount = 0;
    let unassignedCount = 0;

    medicalApplicants.forEach(a => {
      const cl = getClearanceStatus(a);
      if (cl === 'PENDING') pendingCount++;
      if (cl === 'FIT_TO_WORK') fitCount++;
      if (cl === 'UNFIT_TO_WORK' || a.status === 'Provisional') unfitProvisionalCount++;

      if (a.currentHandler?.trim().toLowerCase() === currentUserName.trim().toLowerCase()) {
        myQueueCount++;
      }
      if (!a.currentHandler || a.currentHandler === 'Unassigned' || a.currentHandler === 'Unassigned Pool' || a.currentHandler === 'System Agent') {
        unassignedCount++;
      }
    });

    return {
      total: medicalApplicants.length,
      pending: pendingCount,
      fit: fitCount,
      provisional: unfitProvisionalCount,
      myQueue: myQueueCount,
      unassigned: unassignedCount
    };
  }, [medicalApplicants, referrals, currentUserName]);

  // ── Turnover Action: Claim Applicant ───────────────────────────────────────
  const handleClaimApplicant = async (app: ApplicantRecord) => {
    const applicantId = String(app.id);
    const numericId = parseInt(applicantId, 10);
    const nowIso = new Date().toISOString();

    const updates: Partial<ApplicantRecord> = {
      currentHandler: currentUserName,
      currentDepartment: 'Admin',
      phaseDescription: `Medical clearance evaluation claimed by ${currentUserName}`
    };

    updateApplicant(applicantId, updates);

    if (!isNaN(numericId)) {
      await api.put(`/applicants/${numericId}`, {
        application_id: app.applicationId,
        current_handler: currentUserName,
        current_department: 'Admin',
        phase_description: updates.phaseDescription,
        statusChangeReason: `Evaluation claimed by ${currentUserName}`,
        statusChangeSource: 'STAFF_ACTION',
        updated_at: nowIso
      }).catch(console.error);
    }

    addActivityLog({
      applicantId,
      action: 'Turnover: Claimed by Staff',
      performedBy: currentUserName,
      department: 'Admin',
      details: `${currentUserName} claimed evaluation of applicant ${app.name} from the medical queue pool.`
    });

    showToast(`✓ Candidate ${app.name} assigned to your queue. You can now update clinic & clearance status.`);
  };

  // ── Turnover Action: Return Applicant to Pool ─────────────────────────────
  const handleReleaseToPool = async (app: ApplicantRecord) => {
    const applicantId = String(app.id);
    const numericId = parseInt(applicantId, 10);
    const nowIso = new Date().toISOString();

    const updates: Partial<ApplicantRecord> = {
      currentHandler: 'Unassigned',
      phaseDescription: `Returned to unassigned candidate pool by ${currentUserName}`
    };

    updateApplicant(applicantId, updates);

    if (!isNaN(numericId)) {
      await api.put(`/applicants/${numericId}`, {
        application_id: app.applicationId,
        current_handler: 'Unassigned',
        phase_description: updates.phaseDescription,
        statusChangeReason: `Returned to pool by ${currentUserName}`,
        statusChangeSource: 'STAFF_ACTION',
        updated_at: nowIso
      }).catch(console.error);
    }

    addActivityLog({
      applicantId,
      action: 'Turnover: Released to Pool',
      performedBy: currentUserName,
      department: 'Admin',
      details: `${currentUserName} returned applicant ${app.name} to the unassigned candidate pool for staff re-allocation.`
    });

    showToast(`Applicant ${app.name} returned to unassigned.`);
  };

  // ── Dynamic Clinic Assignment (Only when in employee's queue) ──────────────
  const handleChangeClinic = async (app: ApplicantRecord, clinicIdStr: string) => {
    const applicantId = String(app.id);
    const numericId = parseInt(applicantId, 10);
    const nowIso = new Date().toISOString();

    if (clinicIdStr === 'PENDING') {
      // Clear referral from local state so UI shows 'Pending'
      setReferrals(prev => {
        const next = { ...prev };
        delete next[applicantId];
        return next;
      });
      updateApplicant(applicantId, { medicalReferralClinic: '' });
      if (!isNaN(numericId)) {
        await api.put(`/applicants/${numericId}`, {
          application_id: app.applicationId,
          medical_referral_clinic: null,
          current_handler: app.currentHandler || currentUserName,
          updated_at: nowIso
        }).catch(console.error);
      }
      // Delete from clinic-referrals in backend so it stays Pending
      await api.delete(`/clinic-referrals/${numericId}`).catch(console.error);
      showToast(`Assigned clinic reset to Pending for ${app.name}.`);
      return;
    }

    const targetClinicId = parseInt(clinicIdStr, 10);
    const selectedClinicObj = clinics.find(c => (c.clinicId === targetClinicId || (c as any).clinic_id === targetClinicId));
    if (!selectedClinicObj) return;

    const clinicDisplayName = selectedClinicObj.clinicName || (selectedClinicObj as any).clinic_name;

    try {
      const refPayload = {
        applicantId: numericId,
        clinicId: targetClinicId,
        medicalStatus: getClearanceStatus(app),
        referralDate: getApplicantReferralDate(applicantId),
        remarks: `Assigned to ${clinicDisplayName} by ${currentUserName}.`,
        updated_at: nowIso
      };

      const res = await api.post<ClinicReferral>('/clinic-referrals', refPayload);
      if (res.data) {
        setReferrals(prev => ({
          ...prev,
          [applicantId]: {
            ...res.data,
            clinic: selectedClinicObj
          }
        }));
      }

      updateApplicant(applicantId, {
        medicalReferralClinic: clinicDisplayName
      });

      if (!isNaN(numericId)) {
        await api.put(`/applicants/${numericId}`, {
          application_id: app.applicationId,
          medical_referral_clinic: clinicDisplayName,
          current_handler: app.currentHandler || currentUserName,
          updated_at: nowIso
        }).catch(console.error);
      }

      addActivityLog({
        applicantId,
        action: 'Assigned Clinic Updated',
        performedBy: currentUserName,
        department: 'Admin',
        details: `${currentUserName} assigned clinic ${clinicDisplayName} to ${app.name}.`
      });

      showToast(`✓ Examining clinic updated to ${clinicDisplayName}`);
    } catch (err) {
      console.error('Failed to update clinic:', err);
      showToast('Error updating assigned clinic.');
    }
  };

  // ── Create New Medical Facility in Supabase ──────────────────────────────
  const handleCreateClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClinicName.trim() || isSavingClinic) return;

    setIsSavingClinic(true);
    const nowIso = new Date().toISOString();
    try {
      const fullAddress = [
        newClinicAddress.trim(),
        newClinicLicenseRef.trim() ? `[Lic/Ref: ${newClinicLicenseRef.trim()}]` : ''
      ].filter(Boolean).join(' ');

      const payload = {
        clinicName: newClinicName.trim(),
        address: fullAddress || undefined,
        contactNumber: newClinicContact.trim() || undefined,
        email: newClinicEmail.trim() || undefined,
        accreditationStatus: newClinicStatus,
        created_at: nowIso,
        updated_at: nowIso
      };

      const res = await api.post<Clinic>('/clinics', payload);
      if (res.data) {
        const createdClinic = {
          ...res.data,
          clinicId: Number(res.data.clinicId ?? (res.data as any).clinic_id ?? 0),
          clinic_id: Number((res.data as any).clinic_id ?? res.data.clinicId ?? 0),
          clinicName: String(res.data.clinicName || (res.data as any).clinic_name || '').trim(),
          clinic_name: String((res.data as any).clinic_name || res.data.clinicName || '').trim(),
          address: fullAddress || res.data.address,
          accreditationStatus: newClinicStatus,
          accreditation_status: newClinicStatus,
        };

        setClinics(prev => [...prev, createdClinic]);
        showToast(`✓ Medical facility "${createdClinic.clinicName}" registered successfully.`);

        // If opened for a specific applicant, auto-assign this new clinic immediately!
        if (targetApplicantForClinic) {
          await handleChangeClinic(targetApplicantForClinic, String(createdClinic.clinicId));
          setTargetApplicantForClinic(null);
        }

        setNewClinicName('');
        setNewClinicAddress('');
        setNewClinicContact('');
        setNewClinicEmail('');
        setNewClinicStatus('ACTIVE');
        setNewClinicLicenseRef('');
        setShowAddClinicModal(false);
      }
    } catch (err) {
      console.error('Failed to create clinic:', err);
      showToast('Error registering medical facility.');
    } finally {
      setIsSavingClinic(false);
    }
  };

  // ── Open Edit Clinic Mode ─────────────────────────────────────────────────
  const handleStartEditClinic = (clinic: Clinic) => {
    setEditingClinic(clinic);
    setEditClinicName(clinic.clinicName || (clinic as any).clinic_name || '');
    
    // Parse any embedded License/Ref number from address
    const rawAddress = clinic.address || '';
    const licMatch = rawAddress.match(/\[Lic\/Ref:\s*([^\]]+)\]/i);
    if (licMatch) {
      setEditClinicLicenseRef(licMatch[1].trim());
      setEditClinicAddress(rawAddress.replace(/\s*\[Lic\/Ref:\s*[^\]]+\]/i, '').trim());
    } else {
      setEditClinicLicenseRef('');
      setEditClinicAddress(rawAddress);
    }

    setEditClinicContact(clinic.contactNumber || (clinic as any).contact_number || '');
    setEditClinicEmail(clinic.email || '');
    const currentStatus = ((clinic.accreditationStatus || (clinic as any).accreditation_status || 'ACTIVE') as string).toUpperCase();
    if (currentStatus === 'EXTERNAL' || currentStatus === 'HOSPITAL' || currentStatus === 'INACTIVE') {
      setEditClinicStatus(currentStatus as any);
    } else {
      setEditClinicStatus('ACTIVE');
    }
    setDeletingClinic(null);
  };

  // ── Update Existing Clinic in Supabase ────────────────────────────────────
  const handleUpdateClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClinic || !editClinicName.trim() || isUpdatingClinic) return;

    const clinicId = Number(editingClinic.clinicId ?? (editingClinic as any).clinic_id);
    if (!clinicId) {
      showToast('Error: Invalid clinic ID.');
      return;
    }

    setIsUpdatingClinic(true);
    const nowIso = new Date().toISOString();
    try {
      const fullAddress = [
        editClinicAddress.trim(),
        editClinicLicenseRef.trim() ? `[Lic/Ref: ${editClinicLicenseRef.trim()}]` : ''
      ].filter(Boolean).join(' ');

      const payload = {
        clinic_name: editClinicName.trim(),
        address: fullAddress || undefined,
        contact_number: editClinicContact.trim() || undefined,
        email: editClinicEmail.trim() || undefined,
        accreditation_status: editClinicStatus,
        updated_at: nowIso
      };

      const res = await api.put<Clinic>(`/clinics/${clinicId}`, payload);
      if (res.data) {
        const updatedClinic: Clinic = {
          ...res.data,
          clinicId: Number(res.data.clinicId ?? (res.data as any).clinic_id ?? clinicId),
          clinic_id: Number((res.data as any).clinic_id ?? res.data.clinicId ?? clinicId),
          clinicName: String(res.data.clinicName || (res.data as any).clinic_name || editClinicName).trim(),
          clinic_name: String((res.data as any).clinic_name || res.data.clinicName || editClinicName).trim(),
          address: res.data.address ?? editClinicAddress.trim(),
          contactNumber: res.data.contactNumber ?? (res.data as any).contact_number ?? editClinicContact.trim(),
          contact_number: (res.data as any).contact_number ?? res.data.contactNumber ?? editClinicContact.trim(),
          email: res.data.email ?? editClinicEmail.trim(),
          accreditationStatus: res.data.accreditationStatus ?? (res.data as any).accreditation_status ?? editClinicStatus,
          accreditation_status: (res.data as any).accreditation_status ?? res.data.accreditationStatus ?? editClinicStatus,
        };

        // Update local clinics list
        setClinics(prev => prev.map(c => {
          const cId = Number(c.clinicId ?? (c as any).clinic_id);
          return cId === clinicId ? updatedClinic : c;
        }));

        // If clinic name changed, update referral mapping
        const oldName = editingClinic.clinicName || (editingClinic as any).clinic_name;
        const newName = updatedClinic.clinicName;
        if (oldName && newName && oldName !== newName) {
          setReferrals(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(k => {
              const r = next[k];
              const rCid = Number(r.clinicId ?? (r as any).clinic_id ?? r.clinic?.clinicId ?? (r.clinic as any)?.clinic_id);
              if (rCid === clinicId && r.clinic) {
                next[k] = {
                  ...r,
                  clinic: {
                    ...r.clinic,
                    clinicName: newName,
                    clinic_name: newName
                  }
                };
              }
            });
            return next;
          });
        }

        addActivityLog({
          applicantId: String(clinicId),
          action: 'Clinic Updated',
          performedBy: currentUserName,
          department: 'Medical Admin',
          details: `${currentUserName} updated details for clinic "${updatedClinic.clinicName}".`
        });

        showToast(`✓ Clinic "${updatedClinic.clinicName}" updated successfully.`);
        setEditingClinic(null);
      }
    } catch (err) {
      console.error('Failed to update clinic:', err);
      showToast('Error updating clinic details.');
    } finally {
      setIsUpdatingClinic(false);
    }
  };

  // ── Delete Clinic in Supabase (Soft Delete + Referral Cleanup) ─────────────
  const handleDeleteClinic = async (clinic: Clinic) => {
    const clinicId = Number(clinic.clinicId ?? (clinic as any).clinic_id);
    if (!clinicId || isDeletingClinic) return;

    setIsDeletingClinic(true);
    const clinicTitle = clinic.clinicName || (clinic as any).clinic_name || 'Clinic';
    try {
      await api.delete(`/clinics/${clinicId}`);

      // Remove from local clinics state
      setClinics(prev => prev.filter(c => Number(c.clinicId ?? (c as any).clinic_id) !== clinicId));

      // Clear any referrals pointing to this clinic so applicant reverts to Pending
      setReferrals(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
          const r = next[k];
          const rCid = Number(r.clinicId ?? (r as any).clinic_id ?? r.clinic?.clinicId ?? (r.clinic as any)?.clinic_id);
          if (rCid === clinicId) {
            delete next[k];
          }
        });
        return next;
      });

      addActivityLog({
        applicantId: String(clinicId),
        action: 'Clinic Deleted',
        performedBy: currentUserName,
        department: 'Medical Admin',
        details: `${currentUserName} deleted clinic "${clinicTitle}".`
      });

      showToast(`✓ Clinic "${clinicTitle}" deleted.`);
      setDeletingClinic(null);
      if (editingClinic && Number(editingClinic.clinicId ?? (editingClinic as any).clinic_id) === clinicId) {
        setEditingClinic(null);
      }
    } catch (err) {
      console.error('Failed to delete clinic:', err);
      showToast('Error deleting clinic.');
    } finally {
      setIsDeletingClinic(false);
    }
  };
  const handleStatusSelectChange = (app: ApplicantRecord, newStatus: string) => {
    const isAssignedToMe = app.currentHandler?.trim().toLowerCase() === currentUserName.trim().toLowerCase();
    if (!isAssignedToMe) {
      showToast('⚠️ You must claim this applicant to your queue first before updating clearance.');
      return;
    }

    if (newStatus === 'UNFIT') {
      // Trigger Unfit Reason Modal (provides Provisional OR Return to Screening)
      setUnfitApplicant(app);
      setUnfitCategory('Cardiovascular / Hypertension');
      setUnfitRemarks('');
      setUnfitActionChoice('PROVISIONAL');
      setShowUnfitModal(true);
    } else if (newStatus === 'FIT') {
      handleSetLocalFit(app);
    } else if (newStatus === 'PENDING') {
      handleSetLocalPending(app);
    }
  };

  // Set Local Fit (pre-confirmation)
  const handleSetLocalFit = async (app: ApplicantRecord) => {
    const applicantId = String(app.id);
    const numericId = parseInt(applicantId, 10);
    const nowIso = new Date().toISOString();

    try {
      const clinicName = getApplicantClinicName(applicantId);
      const matchedClinic = clinics.find(c => (c.clinicName === clinicName || (c as any).clinic_name === clinicName));
      const clinicId = matchedClinic ? (matchedClinic.clinicId || (matchedClinic as any).clinic_id) : (clinics[0]?.clinicId || (clinics[0] as any)?.clinic_id || 1);

      const refPayload = {
        applicantId: numericId,
        clinicId,
        medicalStatus: 'FIT_TO_WORK',
        remarks: 'Physical fitness clearance validated. Candidate is clinically fit for overseas employment.',
        referralDate: getApplicantReferralDate(applicantId),
        updated_at: nowIso
      };

      const refRes = await api.post<ClinicReferral>('/clinic-referrals', refPayload).catch(console.error);
      if (refRes && refRes.data) {
        setReferrals(prev => ({ ...prev, [applicantId]: refRes.data }));
      }

      // Preserve current_handler so claim is not lost
      await api.put(`/applicants/${numericId}`, {
        application_id: app.applicationId,
        current_handler: app.currentHandler || currentUserName,
        updated_at: nowIso
      }).catch(console.error);

      showToast(`✓ ${app.name} marked Fit-to-Work. Click "Endorse to Profiling" to advance candidate.`);
    } catch (err) {
      console.error('Failed to update clinic referral:', err);
    }
  };

  // Set Local Pending
  const handleSetLocalPending = async (app: ApplicantRecord) => {
    const applicantId = String(app.id);
    const numericId = parseInt(applicantId, 10);
    const nowIso = new Date().toISOString();

    try {
      const clinicName = getApplicantClinicName(applicantId);
      const matchedClinic = clinics.find(c => (c.clinicName === clinicName || (c as any).clinic_name === clinicName));
      const clinicId = matchedClinic ? (matchedClinic.clinicId || (matchedClinic as any).clinic_id) : (clinics[0]?.clinicId || (clinics[0] as any)?.clinic_id || 1);

      const refPayload = {
        applicantId: numericId,
        clinicId,
        medicalStatus: 'PENDING',
        remarks: 'Awaiting laboratory examination results from clinic.',
        referralDate: getApplicantReferralDate(applicantId),
        updated_at: nowIso
      };

      const refRes = await api.post<ClinicReferral>('/clinic-referrals', refPayload).catch(console.error);
      if (refRes && refRes.data) {
        setReferrals(prev => ({ ...prev, [applicantId]: refRes.data }));
      }

      // Preserve current_handler so claim is not lost
      await api.put(`/applicants/${numericId}`, {
        application_id: app.applicationId,
        current_handler: app.currentHandler || currentUserName,
        updated_at: nowIso
      }).catch(console.error);

      showToast(`Clearance status reset to Pending.`);
    } catch (err) {
      console.error('Failed to update clinic referral:', err);
    }
  };

  // ── Submit Unfit Form: Handles both Provisional and Return to Screening ────
  const handleConfirmUnfit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unfitApplicant || isSubmittingUnfit) return;

    if (!unfitRemarks.trim()) {
      showToast('Please state clinical findings / reason why candidate is unfit.');
      return;
    }

    setIsSubmittingUnfit(true);
    const applicantId = String(unfitApplicant.id);
    const numericId = parseInt(applicantId, 10);
    const reasonText = `${unfitCategory}: ${unfitRemarks.trim()}`;
    const nowIso = new Date().toISOString();

    try {
      const clinicName = getApplicantClinicName(applicantId) || 'Medical Facility';
      const matchedClinic = clinics.find(c => (c.clinicName === clinicName || (c as any).clinic_name === clinicName));
      const clinicId = matchedClinic ? (matchedClinic.clinicId || (matchedClinic as any).clinic_id) : (clinics[0]?.clinicId || (clinics[0] as any)?.clinic_id || 1);

      // Record medical outcome as UNFIT_TO_WORK in Supabase
      const refPayload = {
        applicantId: numericId,
        clinicId,
        medicalStatus: 'UNFIT_TO_WORK',
        remarks: reasonText,
        referralDate: getApplicantReferralDate(applicantId),
        updated_at: nowIso
      };

      const refRes = await api.post<ClinicReferral>('/clinic-referrals', refPayload).catch(console.error);
      if (refRes && refRes.data) {
        setReferrals(prev => ({ ...prev, [applicantId]: refRes.data }));
      }

      if (unfitActionChoice === 'PROVISIONAL') {
        // Place in Provisional holding within Fit-to-Work
        const updates: Partial<ApplicantRecord> = {
          status: 'Provisional',
          phase: 2,
          currentHandler: currentUserName,
          currentDepartment: 'Admin',
          phaseDescription: `Medical outcome Unfit-to-Work. Provisional holding state. Reason: ${reasonText}`
        };

        updateApplicant(applicantId, updates);

        if (!isNaN(numericId)) {
          await api.put(`/applicants/${numericId}`, {
            application_id: unfitApplicant.applicationId,
            application_status: 'Provisional',
            current_phase: 2,
            current_handler: currentUserName,
            current_department: 'Admin',
            phase_description: updates.phaseDescription,
            statusChangeReason: `Unfit to Work: ${reasonText}`,
            statusChangeSource: 'MEDICAL_CLEARANCE',
            updated_at: nowIso
          }).catch(console.error);
        }

        addActivityLog({
          applicantId,
          action: 'Medical Clearance: Marked Unfit (Provisional)',
          performedBy: currentUserName,
          department: 'Admin',
          details: `Applicant ${unfitApplicant.name} marked Unfit-to-Work by ${currentUserName} at ${clinicName}. Reason: ${reasonText}. Placed under Provisional holding.`
        });

        showToast(`⚠️ Applicant placed in Provisional status. Retained in Medical Gate.`);
      } else {
        // Return Candidate to Screening Panel Pool (Phase 1)
        const updates: Partial<ApplicantRecord> = {
          status: 'Initial Screening',
          phase: 1,
          currentHandler: 'Unassigned',
          currentDepartment: 'Recruitment',
          phaseDescription: `Returned from Medical Clearance to Screening Pool by ${currentUserName}. Medical finding: ${reasonText}`
        };

        updateApplicant(applicantId, updates);

        if (!isNaN(numericId)) {
          await api.put(`/applicants/${numericId}`, {
            application_id: unfitApplicant.applicationId,
            application_status: 'Initial Screening',
            current_phase: 1,
            current_handler: 'Unassigned',
            current_department: 'Recruitment',
            phase_description: updates.phaseDescription,
            statusChangeReason: `Returned from Medical Gate: ${reasonText}`,
            statusChangeSource: 'MEDICAL_CLEARANCE',
            updated_at: nowIso
          }).catch(console.error);
        }

        addActivityLog({
          applicantId,
          action: 'Returned to Screening Panel Pool',
          performedBy: currentUserName,
          department: 'Recruitment',
          details: `Applicant ${unfitApplicant.name} returned to the Screening Panel unassigned by ${currentUserName}. Medical reason: ${reasonText}.`
        });

        showToast(`↩ Applicant ${unfitApplicant.name} returned to the Screening Panel pool.`);
      }

      setShowUnfitModal(false);
      setUnfitApplicant(null);
    } catch (err) {
      console.error('Failed to submit unfit status:', err);
      showToast('Error recording unfit medical status.');
    } finally {
      setIsSubmittingUnfit(false);
    }
  };

  // ── Direct Return to Screening Pool Action ─────────────────────────────────
  const handleConfirmReturnToScreening = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningApplicant || isSubmittingReturn) return;

    if (!returnScreeningReason.trim()) {
      showToast('Please state a reason for returning the candidate to screening.');
      return;
    }

    setIsSubmittingReturn(true);
    const applicantId = String(returningApplicant.id);
    const numericId = parseInt(applicantId, 10);
    const nowIso = new Date().toISOString();

    try {
      const updates: Partial<ApplicantRecord> = {
        status: 'Initial Screening',
        phase: 1,
        currentHandler: 'Unassigned',
        currentDepartment: 'Recruitment',
        phaseDescription: `Returned from Medical Gate to Screening Pool by ${currentUserName}: ${returnScreeningReason.trim()}`
      };

      updateApplicant(applicantId, updates);

      if (!isNaN(numericId)) {
        await api.put(`/applicants/${numericId}`, {
          application_id: returningApplicant.applicationId,
          application_status: 'Initial Screening',
          current_phase: 1,
          current_handler: 'Unassigned',
          current_department: 'Recruitment',
          phase_description: updates.phaseDescription,
          statusChangeReason: `Returned to Screening Pool: ${returnScreeningReason.trim()}`,
          statusChangeSource: 'MEDICAL_CLEARANCE',
          updated_at: nowIso
        }).catch(console.error);
      }

      addActivityLog({
        applicantId,
        action: 'Returned to Screening Panel Pool',
        performedBy: currentUserName,
        department: 'Recruitment',
        details: `Candidate ${returningApplicant.name} returned to Screening Panel unassigned by ${currentUserName}. Note: ${returnScreeningReason.trim()}`
      });

      setShowReturnScreeningModal(false);
      setReturningApplicant(null);
      setReturnScreeningReason('');
      showToast(`↩ ${returningApplicant.name} returned to Screening Panel pool for re-evaluation.`);
    } catch (err) {
      console.error('Failed to return candidate to screening:', err);
      showToast('Error returning candidate to screening pool.');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  // ── Reconsider Provisional Applicant ───────────────────────────────────────
  const handleReconsiderProvisional = async (app: ApplicantRecord) => {
    const isAssignedToMe = app.currentHandler?.trim().toLowerCase() === currentUserName.trim().toLowerCase();
    if (!isAssignedToMe) {
      showToast('⚠️ You must claim this applicant to your queue first before reconsidering.');
      return;
    }

    const applicantId = String(app.id);
    const numericId = parseInt(applicantId, 10);
    const nowIso = new Date().toISOString();

    const updates: Partial<ApplicantRecord> = {
      status: 'Medical Clearance',
      phase: 2,
      currentHandler: currentUserName,
      currentDepartment: 'Admin',
      phaseDescription: `Provisional medical status reconsidered by ${currentUserName}. Ready for re-evaluation.`
    };

    updateApplicant(applicantId, updates);

    if (!isNaN(numericId)) {
      await api.put(`/applicants/${numericId}`, {
        application_id: app.applicationId,
        application_status: 'Medical Clearance',
        current_phase: 2,
        current_handler: currentUserName,
        current_department: 'Admin',
        phase_description: updates.phaseDescription,
        statusChangeReason: 'Provisional medical status reconsidered for re-examination',
        statusChangeSource: 'STAFF_ACTION',
        updated_at: nowIso
      }).catch(console.error);
    }

    addActivityLog({
      applicantId,
      action: 'Provisional Status Reconsidered',
      performedBy: currentUserName,
      department: 'Admin',
      details: `Applicant ${app.name} returned to Medical Clearance queue by ${currentUserName} for repeat lab examination / reconsidered fitness.`
    });

    showToast(`✓ Applicant ${app.name} returned to Medical Clearance for re-evaluation.`);
  };

  // ── Confirm Fit Endorsement: Advances strictly to Applicant Profiling ─────
  const handleConfirmFitEndorsement = async () => {
    if (!fitApplicant || isSubmittingFit) return;
    setIsSubmittingFit(true);

    const applicantId = String(fitApplicant.id);
    const numericId = parseInt(applicantId, 10);
    const clinicName = getApplicantClinicName(applicantId) || 'Medical Facility';
    const nowIso = new Date().toISOString();

    try {
      // 1. Update clinic referral to FIT_TO_WORK in Supabase
      const matchedClinic = clinics.find(c => (c.clinicName === clinicName || (c as any).clinic_name === clinicName));
      const clinicId = matchedClinic ? (matchedClinic.clinicId || (matchedClinic as any).clinic_id) : (clinics[0]?.clinicId || (clinics[0] as any)?.clinic_id || 1);

      await api.post('/clinic-referrals', {
        applicantId: numericId,
        clinicId,
        medicalStatus: 'FIT_TO_WORK',
        remarks: `Fit to Work clearance verified by ${currentUserName}. Candidate approved for profiling.`,
        referralDate: getApplicantReferralDate(applicantId),
        updated_at: nowIso
      }).catch(console.error);

      // 2. Advance applicant status to Applicant Profiling (Phase 3)
      const updates: Partial<ApplicantRecord> = {
        status: 'Applicant Profiling',
        phase: 3,
        currentHandler: currentUserName,
        currentDepartment: 'Recruitment',
        phaseDescription: `Medical clearance verified by ${currentUserName} (${clinicName}). Endorsed for Applicant Profiling and job matching.`
      };

      updateApplicant(applicantId, updates);
      updateWorkflow({ medicalCleared: true });

      // Auto-sync for Medical Package is now handled globally in AppShell.tsx

      // 3. Persist to Backend with audit trail (triggers application_status_history insert!)
      if (!isNaN(numericId)) {
        await api.put(`/applicants/${numericId}`, {
          application_id: fitApplicant.applicationId,
          application_status: 'Applicant Profiling',
          current_phase: 3,
          current_handler: currentUserName,
          current_department: 'Recruitment',
          phase_description: updates.phaseDescription,
          statusChangeReason: `Medical clearance verified fit to work by ${currentUserName}`,
          statusChangeSource: 'MEDICAL_CLEARANCE',
          updated_at: nowIso
        }).catch(console.error);
      }

      // 4. Record Activity Log
      addActivityLog({
        applicantId,
        action: 'Medical Clearance Approved → Endorsed to Profiling',
        performedBy: currentUserName,
        department: 'Admin',
        details: `Applicant ${fitApplicant.name} validated Fit-to-Work from ${clinicName}. Digital endorser signature recorded by ${currentUserName}. Route to Applicant Profiling unlocked.`
      });

      setShowFitConfirmModal(false);
      setFitApplicant(null);
      showToast(`✓ ${fitApplicant.name} successfully cleared! Routed to Applicant Profiling.`);
    } catch (err) {
      console.error('Failed to endorse applicant:', err);
      showToast('Error updating applicant clearance status.');
    } finally {
      setIsSubmittingFit(false);
    }
  };

  // ── Stop Processing for Provisional Applicant ──────────────────────────────
  const handleConfirmStopProcessing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stoppingApplicant || isSubmittingStop) return;

    if (!stopReason.trim()) {
      showToast('Please state a reason for stopping processing.');
      return;
    }

    setIsSubmittingStop(true);
    const applicantId = String(stoppingApplicant.id);
    const numericId = parseInt(applicantId, 10);
    const nowIso = new Date().toISOString();

    try {
      const updates: Partial<ApplicantRecord> = {
        isStopped: true,
        stoppedReason: stopReason,
        stoppedBy: currentUserName,
        stoppedAt: nowIso,
        stoppedPhase: 2,
        status: 'Processing Stopped',
        phaseDescription: `Processing permanently halted at Medical Clearance: ${stopReason}`
      };

      updateApplicant(applicantId, updates);

      if (!isNaN(numericId)) {
        await api.put(`/applicants/${numericId}`, {
          application_id: stoppingApplicant.applicationId,
          application_status: 'Processing Stopped',
          current_phase: 0,
          current_handler: currentUserName,
          phase_description: updates.phaseDescription,
          statusChangeReason: stopReason,
          statusChangeSource: 'STAFF_ACTION',
          updated_at: nowIso
        }).catch(console.error);
      }

      addActivityLog({
        applicantId,
        action: 'Processing Stopped (Medical Disqualification)',
        performedBy: currentUserName,
        department: 'Admin',
        details: `Applicant ${stoppingApplicant.name} permanently disqualified from pipeline. Reason: ${stopReason}`
      });

      setShowStopModal(false);
      setStoppingApplicant(null);
      setStopReason('');
      showToast(`Candidate processing permanently stopped.`);
    } catch (err) {
      console.error('Failed to stop processing:', err);
      showToast('Error stopping applicant processing.');
    } finally {
      setIsSubmittingStop(false);
    }
  };

  return (
    <div className="space-y-6 w-full pb-12 animate-in fade-in duration-150">
      {/* ── Top Header & Overview (Light Theme) ───────────────────────────── */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                Compliance & Medical Gate
              </span>
              <span className="text-xs text-slate-500 font-medium">• DMW PEME & Medical Facilities</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Fit-to-Work Clearance
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
              Verify pre-employment medical examination (PEME) results from partner diagnostic centers, hospitals, and licensed clinics. Unfit candidates can be held under{' '}
              <strong className="text-amber-700 font-semibold">Provisional Status</strong> or returned to the{' '}
              <strong className="text-sky-700 font-semibold">Screening Panel Pool</strong>, while cleared candidates advance to{' '}
              <strong className="text-emerald-700 font-semibold">Applicant Profiling</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => {
                setTargetApplicantForClinic(null);
                setClinicModalTab('add');
                setEditingClinic(null);
                setDeletingClinic(null);
                setShowAddClinicModal(true);
              }}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Facility</span>
            </button>
            <button
              onClick={() => {
                setTargetApplicantForClinic(null);
                setClinicModalTab('manage');
                setEditingClinic(null);
                setDeletingClinic(null);
                setShowAddClinicModal(true);
              }}
              className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-all cursor-pointer flex items-center gap-2 shadow-xs"
              title="View, edit, or manage medical facilities"
            >
              <Building2 className="w-3.5 h-3.5 text-sky-600" />
              <span>Medical Facilities ({clinics.length})</span>
            </button>
            <button
              onClick={loadClinicsAndReferrals}
              disabled={isLoadingData}
              className="px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-all cursor-pointer flex items-center gap-1.5"
              title="Reload clinics and live results"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* 4 Stats Cards (Light Theme with Crisp Borders) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Total in Review</span>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5 block">{metrics.total}</span>
              <span className="text-[11px] text-slate-500 font-medium">Medical Candidates</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-200/80 text-slate-700 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs text-amber-800 font-bold uppercase tracking-wider block">Awaiting Results</span>
              <span className="text-2xl sm:text-3xl font-black text-amber-950 mt-0.5 block">{metrics.pending}</span>
              <span className="text-[11px] text-amber-700 font-medium">Clinic Pending</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs text-emerald-800 font-bold uppercase tracking-wider block">Fit to Work</span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-950 mt-0.5 block">{metrics.fit}</span>
              <span className="text-[11px] text-emerald-700 font-medium">Cleared for Profiling</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs text-rose-800 font-bold uppercase tracking-wider block">Provisional / Unfit</span>
              <span className="text-2xl sm:text-3xl font-black text-rose-950 mt-0.5 block">{metrics.provisional}</span>
              <span className="text-[11px] text-rose-700 font-medium">Holding / Reconsider</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Candidate Queues & Filter Controls (Light Theme) ─────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        {/* Row 1: Queue Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setQueueTab('ALL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                queueTab === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <span>All Candidates</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-current font-bold">
                {metrics.total}
              </span>
            </button>

            <button
              onClick={() => setQueueTab('MY_QUEUE')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                queueTab === 'MY_QUEUE'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>My Assigned Queue</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-current font-bold">
                {metrics.myQueue}
              </span>
            </button>

            <button
              onClick={() => setQueueTab('UNASSIGNED')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                queueTab === 'UNASSIGNED'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Unassigned Pool</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-current font-bold">
                {metrics.unassigned}
              </span>
            </button>

            <button
              onClick={() => setQueueTab('PROVISIONAL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                queueTab === 'PROVISIONAL'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Provisional Holding</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-current font-bold">
                {metrics.provisional}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-600">Evaluator: <strong className="text-slate-900 font-bold">{currentUserName}</strong></span>
          </div>
        </div>

        {/* Row 2: Search and Filter Dropdowns */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by candidate, role, clinic, or ID..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-sky-500 outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            {/* Clinic Filter */}
            <div className="relative min-w-[190px] flex-1 sm:flex-initial">
              <select
                value={selectedClinicFilter}
                onChange={e => setSelectedClinicFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-sky-500 outline-none cursor-pointer"
              >
                <option value="ALL">All Facilities</option>
                {clinics.map((c: any) => {
                  const cid = c.clinicId ?? c.clinic_id;
                  const cname = c.clinicName || c.clinic_name;
                  if (!cname) return null;
                  return (
                    <option key={cid || cname} value={cname}>
                      {cname}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Clearance Status Filter */}
            <div className="relative min-w-[170px] flex-1 sm:flex-initial">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-sky-500 outline-none cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Awaiting Results</option>
                <option value="FIT">Fit to Work</option>
                <option value="UNFIT">Unfit / Provisional</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Candidate Table (Light Theme) ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[1040px]">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-6 w-[26%] text-left">Candidate & Role</th>
                <th className="py-3.5 px-4 w-[27%] text-left">Examining Facility</th>
                <th className="py-3.5 px-2 w-[14%] text-center">Clearance Status</th>
                <th className="py-3.5 px-2 w-[14%] text-center">Assigned Evaluator</th>
                <th className="py-3.5 px-3 w-[19%] text-center">Stage Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredApplicants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 sm:py-24 px-6 text-center text-slate-500 w-full">
                    <div className="flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
                      <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-4 border border-rose-100 shadow-xs">
                        <HeartPulse className="w-8 h-8" />
                      </div>
                      <h3 className="font-extrabold text-slate-900 text-lg mb-2">No Candidates Found</h3>
                      <p className="text-sm text-slate-500 leading-relaxed mb-6 w-full max-w-xl">
                        {searchQuery || statusFilter !== 'ALL' || queueTab !== 'ALL' || selectedClinicFilter !== 'ALL'
                          ? 'No candidates match your current search and filter criteria. Try resetting your filters to view all active medical clearance candidates.'
                          : 'Candidates appear here once they complete evaluations in the Screening Panel, generate their Medical Referral, and advance to Medical Clearance.'}
                      </p>
                      {(searchQuery || statusFilter !== 'ALL' || queueTab !== 'ALL' || selectedClinicFilter !== 'ALL') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setStatusFilter('ALL');
                            setQueueTab('ALL');
                            setSelectedClinicFilter('ALL');
                          }}
                          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow cursor-pointer flex items-center gap-2"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Reset All Filters</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredApplicants.map(app => {
                  const applicantId = String(app.id);
                  const clinicName = getApplicantClinicName(applicantId);
                  const referralDate = getApplicantReferralDate(applicantId);
                  const clearanceStatus = getClearanceStatus(app);
                  const isProvisional = app.status === 'Provisional';
                  const isMyAssignment = app.currentHandler?.trim().toLowerCase() === currentUserName.trim().toLowerCase();
                  const isUnassigned = !app.currentHandler || app.currentHandler === 'Unassigned' || app.currentHandler === 'Unassigned Pool' || app.currentHandler === 'System Agent';
                  const matchedClinic = clinics.find(c => (c.clinicName === clinicName || (c as any).clinic_name === clinicName));
                  const matchedClinicId = matchedClinic ? (matchedClinic.clinicId || (matchedClinic as any).clinic_id) : '';

                  return (
                    <tr
                      key={app.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isProvisional ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      {/* 1. Candidate Column (Left-Aligned, Structured Hierarchy) */}
                      <td className="py-3.5 px-6 w-[26%]">
                        {(() => {
                          const initials = getCandidateInitials(app.name);
                          const avatarStyle = getAvatarColorStyle(app.name);
                          const formattedRole = formatRoleTitle(app.role);
                          const formattedPhone = formatContactNumber(app.contact);

                          return (
                            <div className="flex items-start gap-3">
                              {/* Avatar Monogram */}
                              <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs tracking-wider shadow-2xs border flex-shrink-0 select-none mt-0.5 transition-transform hover:scale-105 ${avatarStyle.bg} ${avatarStyle.text} ${avatarStyle.border}`}
                                title={app.name}
                              >
                                {initials}
                              </div>

                              {/* Content Details */}
                              <div className="min-w-0 flex-1 space-y-1">
                                {/* Row 1: Candidate Name & Requisition Job Order */}
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className="font-bold text-slate-900 text-sm leading-tight truncate hover:text-sky-600 transition-colors cursor-default"
                                    title={app.name}
                                  >
                                    {app.name}
                                  </span>
                                  <span
                                    className="font-mono text-[10px] font-semibold text-sky-700 bg-sky-50/90 px-1.5 py-0.5 rounded-md border border-sky-200/80 whitespace-nowrap flex-shrink-0 shadow-2xs"
                                    title={`Job Order: ${app.jobOrder || 'General Pool'}`}
                                  >
                                    {app.jobOrder || 'General Pool'}
                                  </span>
                                </div>

                                {/* Row 2: Applied Role with Briefcase */}
                                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                  <Briefcase className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                  <span className="font-medium truncate" title={app.role || 'Unspecified Role'}>
                                    {formattedRole}
                                  </span>
                                </div>

                                {/* Row 3: Tracking Code & Contact Phone */}
                                <div className="flex items-center gap-2 text-[10.5px] text-slate-400 whitespace-nowrap">
                                  <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200/70 font-semibold tracking-tight">
                                    {app.applicantCode || `APP-${app.id}`}
                                  </span>
                                  {formattedPhone && (
                                    <span className="flex items-center gap-1 text-slate-500 font-normal">
                                      <Phone className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />
                                      <span>{formattedPhone}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* 2. Examining Facility Column (Left-Aligned, Generous Width, No Clipping) */}
                      <td className="py-4 px-4 w-[27%] text-left">
                        {isMyAssignment ? (
                          <div className="space-y-1.5 w-full">
                            <div className="flex items-center gap-1.5 w-full">
                              <div className="relative flex-1 min-w-0">
                                <select
                                  value={matchedClinicId || 'PENDING'}
                                  onChange={e => {
                                    if (e.target.value === 'ADD_NEW') {
                                      setTargetApplicantForClinic(app);
                                      setShowAddClinicModal(true);
                                    } else {
                                      handleChangeClinic(app, e.target.value);
                                    }
                                  }}
                                  className="w-full h-9 pl-3 pr-8 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-sky-500 rounded-xl text-xs font-semibold text-slate-800 outline-none cursor-pointer transition-all appearance-none shadow-2xs"
                                  title={clinicName ? `Assigned facility: ${clinicName}` : 'Select examining facility'}
                                >
                                  <option value="PENDING">Assign Medical Facility...</option>
                                  {clinics.map((c: any) => {
                                    const cid = c.clinicId ?? c.clinic_id;
                                    const cname = c.clinicName || c.clinic_name;
                                    if (!cname) return null;
                                    return (
                                      <option key={cid || cname} value={cid}>
                                        {cname}
                                      </option>
                                    );
                                  })}
                                  <option value="ADD_NEW" className="text-sky-600 font-bold">+ Register New Facility...</option>
                                </select>
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setTargetApplicantForClinic(app);
                                  setShowAddClinicModal(true);
                                }}
                                className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-200 text-slate-500 hover:text-sky-600 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
                                title="Register a new medical facility"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {clinicName ? (
                              <div className="flex items-center gap-1.5 pl-0.5">
                                {(() => {
                                  const badge = getClinicBadgeInfo(clinicName);
                                  return (
                                    <span
                                      className={`text-[10px] font-semibold border px-2 py-0.5 rounded-md inline-flex items-center gap-1 ${badge.className}`}
                                      title={badge.tooltip}
                                    >
                                      <Building2 className="w-2.5 h-2.5 opacity-70" />
                                      <span>{badge.label}</span>
                                    </span>
                                  );
                                })()}
                              </div>
                            ) : (
                              <div className="text-[11px] text-amber-600 pl-0.5 font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-500 flex-shrink-0" />
                                <span>Assign clinic to generate referral</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="w-full">
                            {clinicName ? (
                              <div className="flex items-start gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0 mt-0.5 border border-slate-200">
                                  <Building2 className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="font-bold text-slate-800 text-xs block leading-snug truncate" title={clinicName}>
                                    {clinicName}
                                  </span>
                                  {(() => {
                                    const badge = getClinicBadgeInfo(clinicName);
                                    return (
                                      <span
                                        className={`text-[10px] font-semibold border px-2 py-0.5 rounded-md inline-flex items-center gap-1 mt-1 ${badge.className}`}
                                        title={badge.tooltip}
                                      >
                                        <Building2 className="w-2.5 h-2.5 opacity-70" />
                                        <span>{badge.label}</span>
                                      </span>
                                    );
                                  })()}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center flex-shrink-0">
                                  <Building2 className="w-4 h-4" />
                                </div>
                                <div className="text-left">
                                  <span className="text-xs font-bold text-amber-900 block leading-tight">Pending Facility Selection</span>
                                  <span className="text-[10px] text-amber-600 font-medium block">Claim file to assign clinic</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 3. Clearance Status Column (Center-Aligned Uniform Pill) */}
                      <td className="py-4 px-3 w-[14%] text-center whitespace-nowrap">
                        <div className="flex items-center justify-center w-full">
                          {isProvisional ? (
                            <div className="inline-flex items-center justify-center gap-1.5 px-3 h-9 rounded-xl bg-amber-50 text-amber-900 font-bold text-xs border border-amber-300 shadow-2xs w-[145px]">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                              <span>Provisional (Unfit)</span>
                            </div>
                          ) : isMyAssignment ? (
                            <div className="relative inline-block w-[145px]">
                              <select
                                value={clearanceStatus === 'FIT_TO_WORK' ? 'FIT' : (clearanceStatus === 'UNFIT_TO_WORK' ? 'UNFIT' : 'PENDING')}
                                onChange={e => handleStatusSelectChange(app, e.target.value)}
                                className={`appearance-none w-full pl-3 pr-7 h-9 rounded-xl text-xs font-bold border transition-all cursor-pointer focus:outline-none shadow-2xs text-center ${
                                  clearanceStatus === 'FIT_TO_WORK'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100/70'
                                    : clearanceStatus === 'UNFIT_TO_WORK'
                                    ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100/70'
                                    : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100/70'
                                }`}
                              >
                                <option value="PENDING">Awaiting Results</option>
                                <option value="FIT">Fit to Work</option>
                                <option value="UNFIT">Mark as Unfit</option>
                              </select>
                              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                          ) : (
                            <div
                              className={`inline-flex items-center justify-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold border w-[145px] ${
                                clearanceStatus === 'FIT_TO_WORK'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : clearanceStatus === 'UNFIT_TO_WORK'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : 'bg-amber-50 text-amber-900 border-amber-200'
                              }`}
                            >
                              {clearanceStatus === 'FIT_TO_WORK' ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                              ) : clearanceStatus === 'UNFIT_TO_WORK' ? (
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                              )}
                              <span>
                                {clearanceStatus === 'FIT_TO_WORK'
                                  ? 'Fit to Work'
                                  : clearanceStatus === 'UNFIT_TO_WORK'
                                  ? 'Marked Unfit'
                                  : 'Awaiting Results'}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 4. Assigned Evaluator Column (Center-Aligned Clean Card with Full-Name Tooltip) */}
                      <td className="py-4 px-3 w-[14%] text-center whitespace-nowrap">
                        <div className="flex items-center justify-center w-full">
                          {isUnassigned ? (
                            <div
                              title="Candidate is currently unassigned. Click 'Claim Candidate' to assign to yourself."
                              className="w-[158px] h-9 px-2.5 bg-slate-50/70 hover:bg-slate-100/60 border border-dashed border-slate-200 rounded-xl flex items-center gap-2 text-slate-400 mx-auto transition-colors cursor-help"
                            >
                              <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center flex-shrink-0">
                                <UserPlus className="w-3 h-3" />
                              </div>
                              <div className="text-left min-w-0 flex-1">
                                <span className="text-xs font-semibold text-slate-600 block leading-tight truncate">Unassigned</span>
                                <span className="text-[9.5px] text-slate-400 block leading-tight">Available to claim</span>
                              </div>
                            </div>
                          ) : (
                            <div
                              title={isMyAssignment ? `${app.currentHandler} (Assigned to you)` : `Assigned Evaluator: ${app.currentHandler}`}
                              className={`w-[158px] h-9 px-2.5 rounded-xl flex items-center gap-2 border mx-auto transition-all cursor-help ${
                                isMyAssignment
                                  ? 'bg-sky-50/70 text-sky-700 border-sky-200/80 hover:bg-sky-100/60'
                                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                              }`}
                            >
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] flex-shrink-0 ${
                                isMyAssignment
                                  ? 'bg-sky-200 text-sky-800'
                                  : 'bg-slate-200 text-slate-600'
                              }`}>
                                {app.currentHandler.charAt(0).toUpperCase()}
                              </div>
                              <div className="text-left min-w-0 flex-1">
                                <span
                                  className="text-xs font-bold text-slate-800 block leading-tight truncate"
                                  title={app.currentHandler}
                                >
                                  {app.currentHandler}
                                </span>
                                <span className={`text-[9.5px] font-semibold block leading-tight ${
                                  isMyAssignment ? 'text-sky-600' : 'text-slate-400'
                                }`}>
                                  {isMyAssignment ? 'Assigned to you' : 'Staff Evaluator'}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 5. Stage Actions Column (Centered, Generous Sizing, No Overlap) */}
                      <td className="py-4 px-3 w-[19%] text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5 w-full">

                          {/* ── UNASSIGNED: only Claim Candidate button ── */}
                          {isUnassigned && (
                            <button
                              onClick={() => handleClaimApplicant(app)}
                              className="w-[195px] h-9 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-xs shadow-xs hover:shadow transition-all cursor-pointer flex items-center justify-center"
                              title="Take ownership of this candidate's medical clearance"
                            >
                              <span>Claim Candidate</span>
                            </button>
                          )}

                          {/* ── CLAIMED BY ME — PROVISIONAL ── */}
                          {!isUnassigned && isMyAssignment && isProvisional && (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleReconsiderProvisional(app)}
                                className="w-[155px] h-9 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center justify-center shadow-2xs"
                                title="Move back to medical clearance queue for re-evaluation"
                              >
                                <span>Re-evaluate</span>
                              </button>
                              <button
                                onClick={() => handleReleaseToPool(app)}
                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer border border-slate-200 transition-colors flex-shrink-0"
                                title="Release candidate back to unassigned pool"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {/* ── CLAIMED BY ME — FIT TO WORK ── */}
                          {!isUnassigned && isMyAssignment && !isProvisional && clearanceStatus === 'FIT_TO_WORK' && (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setFitApplicant(app);
                                  setShowFitConfirmModal(true);
                                }}
                                className="w-[155px] h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs hover:shadow transition-all cursor-pointer flex items-center justify-center px-2"
                                title="Approve candidate and advance to Applicant Profiling & Matching"
                              >
                                <span>Endorse to Profiling</span>
                              </button>
                              <button
                                onClick={() => handleReleaseToPool(app)}
                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer border border-slate-200 transition-colors flex-shrink-0"
                                title="Release candidate back to unassigned pool"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {/* ── CLAIMED BY ME — PENDING / AWAITING RESULTS ── */}
                          {!isUnassigned && isMyAssignment && !isProvisional && clearanceStatus !== 'FIT_TO_WORK' && (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setReturningApplicant(app);
                                  setReturnScreeningReason('Returned from medical gate to screening pool for reassessment.');
                                  setShowReturnScreeningModal(true);
                                }}
                                className="w-[155px] h-9 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center justify-center px-2"
                                title="Return candidate to screening panel recruiters for trade or role reassessment"
                              >
                                <span>Return to Screening</span>
                              </button>
                              <button
                                onClick={() => handleReleaseToPool(app)}
                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer border border-slate-200 transition-colors flex-shrink-0"
                                title="Release candidate back to unassigned pool"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {/* ── CLAIMED BY SOMEONE ELSE ── */}
                          {!isUnassigned && !isMyAssignment && (
                            <div className="w-[195px] h-9 flex items-center justify-center text-xs text-slate-400 italic font-medium">
                              In evaluation by {app.currentHandler}
                            </div>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-800 font-semibold">{filteredApplicants.length}</strong> of{' '}
            <strong className="text-slate-800 font-semibold">{medicalApplicants.length}</strong> medical candidates
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
            <span>Flowsensus Medical Clearance Desk</span>
          </div>
        </div>
      </div>

      {/* ── MODAL 1: Record Unfit Reason & Choose Action (Provisional vs Return to Screening) ── */}
      {showUnfitModal && unfitApplicant && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 bg-gradient-to-r from-rose-600 to-rose-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center border border-white/20">
                  <ShieldAlert className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">Record Medical Unfit Finding</h3>
                  <p className="text-xs text-rose-100">Specify Action & Clinical Grounds</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowUnfitModal(false);
                  setUnfitApplicant(null);
                }}
                className="p-1 rounded-lg hover:bg-white/20 transition-colors text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmUnfit} className="p-6 space-y-4">
              {/* Action Choice: Provisional vs Return to Screening */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wider">
                  Select Resolution Action <span className="text-rose-600">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setUnfitActionChoice('PROVISIONAL')}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      unfitActionChoice === 'PROVISIONAL'
                        ? 'border-amber-500 bg-amber-50/70 text-amber-950 ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      Provisional Holding
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Hold in Medical Gate for re-tests or treatment reconsideration.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUnfitActionChoice('RETURN_TO_SCREENING')}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      unfitActionChoice === 'RETURN_TO_SCREENING'
                        ? 'border-sky-500 bg-sky-50/70 text-sky-950 ring-2 ring-sky-500/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-sky-900">
                      <RotateCcw className="w-4 h-4 text-sky-600" />
                      Return to Screening Pool
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Return to Phase 1 pool for recruiter reassignment or lighter roles.
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Primary Medical Condition / Category <span className="text-rose-600">*</span>
                </label>
                <select
                  value={unfitCategory}
                  onChange={e => setUnfitCategory(e.target.value)}
                  className="w-full border-2 border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold bg-white text-slate-800 focus:border-rose-500 outline-none cursor-pointer"
                  required
                >
                  <option value="Cardiovascular / Hypertension">Cardiovascular / Stage 2+ Hypertension</option>
                  <option value="Pulmonary / Chest X-Ray Finding (PTB Suspect)">Pulmonary / Chest X-Ray Infiltrates (PTB suspect)</option>
                  <option value="Infectious / Communicable Disease (Hepatitis, etc.)">Infectious / Communicable Disease (Hepatitis B, etc.)</option>
                  <option value="Visual Acuity / Ophthalmology Deficit">Visual Acuity / Severe Refractive Deficit</option>
                  <option value="Musculoskeletal / Physical Disability">Musculoskeletal / Mobility Impairment</option>
                  <option value="Laboratory / Urinalysis / Renal Abnormality">Laboratory / Abnormal Renal or Hepatic Function</option>
                  <option value="Psychological / Neurological Evaluation">Psychological / Neurological Non-Clearance</option>
                  <option value="Other Medical Grounds">Other Medical Grounds</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Physician Remarks & Clinical Findings <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={4}
                  value={unfitRemarks}
                  onChange={e => setUnfitRemarks(e.target.value)}
                  placeholder="Detail the clinical exam findings, lab test values, diagnostic results, and clinic doctor notes why the applicant is unfit..."
                  className="w-full border-2 border-slate-200 p-3 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-rose-500 outline-none resize-none"
                  required
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  This reason will be recorded in the official audit trail and application status history.
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-700 block">Examining Clinic</span>
                  <span className="text-slate-500 text-[11px]">{getApplicantClinicName(String(unfitApplicant.id)) || 'Pending Clinic'}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-700 block">Recorded By</span>
                  <span className="text-slate-500 text-[11px]">{currentUserName}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUnfitModal(false);
                    setUnfitApplicant(null);
                  }}
                  disabled={isSubmittingUnfit}
                  className="flex-1 px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUnfit}
                  className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-md shadow-rose-600/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingUnfit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : unfitActionChoice === 'PROVISIONAL' ? (
                    <>
                      <AlertTriangle className="w-4 h-4" />
                      Set to Provisional
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      Return to Screening Pool
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Return Candidate to Screening Panel Pool ────────────────── */}
      {showReturnScreeningModal && returningApplicant && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 bg-sky-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <RotateCcw className="w-5 h-5 text-white" />
                <div>
                  <h3 className="font-extrabold text-base">Return to Screening Pool</h3>
                  <p className="text-xs text-sky-100">Send Candidate back to Phase 1</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowReturnScreeningModal(false);
                  setReturningApplicant(null);
                }}
                className="p-1 rounded-lg hover:bg-white/20 transition-colors text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReturnToScreening} className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Candidate <strong className="text-slate-900">{returningApplicant.name}</strong> will be moved out of the Medical Gate and returned to the <strong>Screening Panel Unassigned</strong> so recruiters can re-evaluate or match them with alternative job orders.
              </p>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Reason for Returning to Screening <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={returnScreeningReason}
                  onChange={e => setReturnScreeningReason(e.target.value)}
                  placeholder="State reason (e.g. Candidate requests alternative role, physical findings not suitable for current heavy trade)..."
                  className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-xs font-semibold focus:border-sky-500 outline-none resize-none"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowReturnScreeningModal(false);
                    setReturningApplicant(null);
                  }}
                  disabled={isSubmittingReturn}
                  className="flex-1 px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReturn}
                  className="flex-1 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold shadow-md shadow-sky-600/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingReturn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Returning...
                    </>
                  ) : (
                    'Confirm Return'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: Fit to Work Confirmation & Status Update ───────────────── */}
      {showFitConfirmModal && fitApplicant && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center border border-white/20">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">Confirm Medical Clearance</h3>
                  <p className="text-xs text-emerald-100">Advance Candidate to Applicant Profiling</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowFitConfirmModal(false);
                  setFitApplicant(null);
                }}
                className="p-1 rounded-lg hover:bg-white/20 transition-colors text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-2">
                <p className="font-bold flex items-center gap-1.5 text-emerald-950">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  Candidate Clinically Fit for Deployment
                </p>
                <p className="text-emerald-800 leading-relaxed text-[11px]">
                  Candidate <strong className="text-emerald-950">{fitApplicant.name}</strong> ({fitApplicant.applicantCode || fitApplicant.id}) has satisfied all pre-employment medical examinations (PEME) verified by recruitment staff under DMW regulatory guidelines.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Examining Facility</span>
                  <span className="font-bold text-slate-800 line-clamp-1 mt-0.5">
                    {getApplicantClinicName(String(fitApplicant.id)) || 'Pending Facility'}
                  </span>
                  {(() => {
                    const cName = getApplicantClinicName(String(fitApplicant.id));
                    const badge = getClinicBadgeInfo(cName);
                    return (
                      <span className={`text-[10px] font-semibold border px-1.5 py-0.5 rounded inline-block mt-0.5 ${badge.className}`}>
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Medical Endorser</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{currentUserName}</span>
                  <span className="text-slate-400 text-[10px]">Digital Signature Logged</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Next Pipeline Gate</span>
                <span className="font-extrabold text-slate-800 text-sm mt-0.5 flex items-center gap-1.5 text-sky-700">
                  <Sparkles className="w-4 h-4 text-sky-500" />
                  Applicant Profiling & Match Score Engine
                </span>
                <span className="text-slate-500 text-[10px] block mt-0.5">
                  Candidate will be unlocked in Smart Profiling for job order matching and CV compilation.
                </span>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowFitConfirmModal(false);
                    setFitApplicant(null);
                  }}
                  disabled={isSubmittingFit}
                  className="flex-1 px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmFitEndorsement}
                  disabled={isSubmittingFit}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingFit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Confirm & Advance
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 4: Medical Facilities Hub (Add, Edit, Delete, Manage) ───────── */}
      {showAddClinicModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 bg-sky-600 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white flex-shrink-0">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">
                    {editingClinic
                      ? 'Edit Medical Facility'
                      : clinicModalTab === 'add'
                      ? 'Register Medical Facility'
                      : 'Medical Facilities Directory'}
                  </h3>
                  <p className="text-xs text-sky-100">
                    {targetApplicantForClinic
                      ? `Assigning facility to ${targetApplicantForClinic.name}`
                      : 'Partner Facilities, Hospitals & Agency-Verified Diagnostic Centers'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddClinicModal(false);
                  setTargetApplicantForClinic(null);
                  setEditingClinic(null);
                  setDeletingClinic(null);
                }}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* DOH-HFSRB External Verification Reference Banner */}
            <div className="bg-sky-50 border-b border-sky-100 px-5 py-2.5 flex items-center justify-between text-xs text-sky-900 flex-shrink-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <Info className="w-4 h-4 text-sky-600 flex-shrink-0" />
                <span className="truncate">Verify DOH License to Operate (LTO) or physician credentials:</span>
              </div>
              <a
                href="https://hfsrb.doh.gov.ph"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-700 hover:text-sky-900 font-bold underline inline-flex items-center gap-1 ml-2 flex-shrink-0 cursor-pointer"
                title="Open official DOH Health Facilities and Services Regulatory Bureau registry in new tab"
              >
                DOH-HFSRB Portal <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-5 pt-2.5 flex-shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setClinicModalTab('add');
                    setEditingClinic(null);
                    setDeletingClinic(null);
                  }}
                  className={`px-3.5 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
                    clinicModalTab === 'add' && !editingClinic
                      ? 'border-sky-600 text-sky-700 bg-white shadow-xs'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Facility</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setClinicModalTab('manage');
                    setEditingClinic(null);
                    setDeletingClinic(null);
                  }}
                  className={`px-3.5 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
                    clinicModalTab === 'manage' && !editingClinic
                      ? 'border-sky-600 text-sky-700 bg-white shadow-xs'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Manage Facilities ({clinics.length})</span>
                </button>
              </div>

              {editingClinic && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold mb-1">
                  <Pencil className="w-3 h-3 text-amber-600" />
                  <span className="max-w-[150px] truncate">Editing: {editingClinic.clinicName || (editingClinic as any).clinic_name}</span>
                </div>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* ── Subview 1: Edit Existing Clinic ── */}
              {editingClinic ? (
                <form onSubmit={handleUpdateClinic} className="space-y-4">
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                    <Pencil className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-bold block">Update Facility Information</span>
                      <span>Modify contact details, facility category, and license or PRC accreditation references.</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Facility Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editClinicName}
                      onChange={e => setEditClinicName(e.target.value)}
                      placeholder="e.g. HealthMetrics Medical Clinic, Medical Center Manila, Dr. Santos Clinic"
                      className="w-full border-2 border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:border-sky-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Facility Address / Branch
                    </label>
                    <input
                      type="text"
                      value={editClinicAddress}
                      onChange={e => setEditClinicAddress(e.target.value)}
                      placeholder="e.g. Ermita, Manila"
                      className="w-full border-2 border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:border-sky-500 outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        License / Accreditation Ref # (Optional)
                      </label>
                      <span className="text-[10px] text-slate-400 font-medium">DOH-LTO or Physician PRC License</span>
                    </div>
                    <input
                      type="text"
                      value={editClinicLicenseRef}
                      onChange={e => setEditClinicLicenseRef(e.target.value)}
                      placeholder="e.g. PRC Lic. #0123456 or DOH-LTO-NCR-2024-00123"
                      className="w-full border-2 border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:border-sky-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Contact Number
                      </label>
                      <input
                        type="text"
                        value={editClinicContact}
                        onChange={e => setEditClinicContact(e.target.value)}
                        placeholder="e.g. (02) 8521-4905 or +63 917 123 4567"
                        className="w-full border-2 border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:border-sky-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Facility Email
                      </label>
                      <input
                        type="email"
                        value={editClinicEmail}
                        onChange={e => setEditClinicEmail(e.target.value)}
                        placeholder="clinic@peme.com"
                        className="w-full border-2 border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:border-sky-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Facility Classification & Status
                    </label>
                    <select
                      value={editClinicStatus}
                      onChange={e => setEditClinicStatus(e.target.value as any)}
                      className="w-full border-2 border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:border-sky-500 outline-none cursor-pointer"
                    >
                      <option value="ACTIVE">Partner Facility (Pre-vetted Diagnostic Center)</option>
                      <option value="EXTERNAL">Private Clinic / Local Laboratory (Agency Verified)</option>
                      <option value="HOSPITAL">Hospital / Tertiary Medical Center</option>
                      <option value="INACTIVE">INACTIVE (Suspended / Decommissioned)</option>
                    </select>
                  </div>

                  <div className="flex gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setEditingClinic(null)}
                      disabled={isUpdatingClinic}
                      className="flex-1 px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdatingClinic}
                      className="flex-1 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold shadow-md shadow-sky-600/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isUpdatingClinic ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving Changes...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : clinicModalTab === 'add' ? (
                /* ── Subview 2: Add New Clinic Form ── */
                <form onSubmit={handleCreateClinic} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Facility Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newClinicName}
                      onChange={e => setNewClinicName(e.target.value)}
                      placeholder="e.g. HealthMetrics Medical Clinic, Manila Doctors Hospital, Dr. Santos Clinic"
                      className="w-full border-2 border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:border-sky-500 outline-none"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Facility Classification
                      </label>
                      <select
                        value={newClinicStatus}
                        onChange={e => setNewClinicStatus(e.target.value as any)}
                        className="w-full border-2 border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:border-sky-500 outline-none cursor-pointer"
                      >
                        <option value="ACTIVE">Partner Facility (Pre-vetted)</option>
                        <option value="EXTERNAL">Private Clinic / Local Lab (Agency Verified)</option>
                        <option value="HOSPITAL">Hospital / Medical Center</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700">
                          License / PRC Ref #
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium">Optional</span>
                      </div>
                      <input
                        type="text"
                        value={newClinicLicenseRef}
                        onChange={e => setNewClinicLicenseRef(e.target.value)}
                        placeholder="e.g. PRC Lic. #0123456 or DOH-LTO-NCR-2024-00123"
                        className="w-full border-2 border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:border-sky-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Facility Address / Branch
                    </label>
                    <input
                      type="text"
                      value={newClinicAddress}
                      onChange={e => setNewClinicAddress(e.target.value)}
                      placeholder="e.g. Ermita, Manila"
                      className="w-full border-2 border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:border-sky-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Contact Number
                      </label>
                      <input
                        type="text"
                        value={newClinicContact}
                        onChange={e => setNewClinicContact(e.target.value)}
                        placeholder="e.g. (02) 8521-4905 or +63 917 123 4567"
                        className="w-full border-2 border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:border-sky-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Facility Email
                      </label>
                      <input
                        type="email"
                        value={newClinicEmail}
                        onChange={e => setNewClinicEmail(e.target.value)}
                        placeholder="clinic@peme.com"
                        className="w-full border-2 border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:border-sky-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
                    <span>Need to view or update existing registered facilities?</span>
                    <button
                      type="button"
                      onClick={() => setClinicModalTab('manage')}
                      className="text-sky-600 font-bold hover:underline cursor-pointer"
                    >
                      Manage Directory →
                    </button>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddClinicModal(false);
                        setTargetApplicantForClinic(null);
                      }}
                      disabled={isSavingClinic}
                      className="flex-1 px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingClinic}
                      className="flex-1 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold shadow-md shadow-sky-600/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSavingClinic ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : targetApplicantForClinic ? (
                        'Register & Assign Facility'
                      ) : (
                        'Register Facility'
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* ── Subview 3: Manage Clinics Directory (List, Search, Edit, Delete) ── */
                <div className="space-y-4">
                  {/* Delete Confirmation Box */}
                  {deletingClinic && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2.5 animate-in fade-in duration-150">
                      <div className="flex items-center gap-2 text-rose-700 font-bold text-xs uppercase tracking-wider">
                        <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                        <span>Confirm Deletion</span>
                      </div>
                      <p className="text-xs text-rose-900 leading-relaxed">
                        Are you sure you want to delete clinic{' '}
                        <strong className="font-extrabold text-rose-950">
                          "{deletingClinic.clinicName || (deletingClinic as any).clinic_name}"
                        </strong>
                        ? Candidates currently referred to this clinic will be reset to Pending status.
                      </p>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setDeletingClinic(null)}
                          disabled={isDeletingClinic}
                          className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClinic(deletingClinic)}
                          disabled={isDeletingClinic}
                          className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {isDeletingClinic ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete Clinic
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Search Clinics */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={clinicSearchQuery}
                      onChange={e => setClinicSearchQuery(e.target.value)}
                      placeholder="Search clinic by name, address, or contact..."
                      className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:border-sky-500 outline-none"
                    />
                  </div>

                  {/* Clinics List */}
                  <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                    {(() => {
                      const q = clinicSearchQuery.trim().toLowerCase();
                      const list = clinics.filter(c => {
                        if (!q) return true;
                        const name = (c.clinicName || (c as any).clinic_name || '').toLowerCase();
                        const addr = (c.address || '').toLowerCase();
                        const contact = (c.contactNumber || (c as any).contact_number || '').toLowerCase();
                        const email = (c.email || '').toLowerCase();
                        return name.includes(q) || addr.includes(q) || contact.includes(q) || email.includes(q);
                      });

                      if (list.length === 0) {
                        return (
                          <div className="py-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                            <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-xs font-semibold text-slate-600">No facilities found</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {clinics.length === 0
                                ? 'No medical facilities have been registered yet.'
                                : 'No facilities match your search query.'}
                            </p>
                            <button
                              type="button"
                              onClick={() => setClinicModalTab('add')}
                              className="mt-3 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Register Facility</span>
                            </button>
                          </div>
                        );
                      }

                      return list.map(c => {
                        const cId = Number(c.clinicId ?? (c as any).clinic_id);
                        const cName = c.clinicName || (c as any).clinic_name || 'Unnamed Clinic';

                        return (
                          <div
                            key={cId || cName}
                            className="p-3.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl shadow-2xs transition-all flex items-start justify-between gap-3"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-xs text-slate-900 truncate">
                                  {cName}
                                </span>
                                {(() => {
                                  const badge = getClinicBadgeInfo(cName);
                                  return (
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${badge.className}`} title={badge.tooltip}>
                                      {badge.label}
                                    </span>
                                  );
                                })()}
                              </div>

                              {(() => {
                                const rawAddress = c.address || '';
                                const licMatch = rawAddress.match(/\[Lic\/Ref:\s*([^\]]+)\]/i);
                                const cleanAddr = rawAddress.replace(/\s*\[Lic\/Ref:\s*[^\]]+\]/i, '').trim();
                                return (
                                  <>
                                    {cleanAddr && (
                                      <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                                        <span>📍</span>
                                        <span>{cleanAddr}</span>
                                      </p>
                                    )}
                                    {licMatch && (
                                      <p className="text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded w-fit inline-flex items-center gap-1 mt-0.5">
                                        <span className="text-sky-600">🏛️ Ref:</span>
                                        <span>{licMatch[1]}</span>
                                      </p>
                                    )}
                                  </>
                                );
                              })()}

                              <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono flex-wrap">
                                {c.contactNumber || (c as any).contact_number ? (
                                  <span>📞 {c.contactNumber || (c as any).contact_number}</span>
                                ) : null}
                                {c.email ? <span>✉️ {c.email}</span> : null}
                              </div>
                            </div>

                            {/* Action Buttons: Edit and Delete */}
                            <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                              <button
                                type="button"
                                onClick={() => handleStartEditClinic(c)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 rounded-lg text-xs font-bold border border-slate-200 hover:border-sky-300 transition-colors flex items-center gap-1 cursor-pointer"
                                title="Edit clinic details"
                              >
                                <Pencil className="w-3.5 h-3.5 text-sky-600" />
                                <span className="hidden sm:inline">Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingClinic(c)}
                                className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded-lg text-xs font-bold border border-slate-200 hover:border-rose-300 transition-colors flex items-center gap-1 cursor-pointer"
                                title="Delete clinic"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              </button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 5: Stop Processing Confirmation Modal ──────────────────────── */}
      {showStopModal && stoppingApplicant && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 bg-red-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Ban className="w-6 h-6 text-white" />
                <h3 className="font-extrabold text-base">Stop Processing Candidate</h3>
              </div>
              <button
                onClick={() => {
                  setShowStopModal(false);
                  setStoppingApplicant(null);
                }}
                className="p-1 rounded-lg hover:bg-white/20 transition-colors text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmStopProcessing} className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                You are about to permanently stop processing <strong className="text-slate-900">{stoppingApplicant.name}</strong> from the recruitment pipeline due to medical disqualification.
              </p>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Reason for Stopping Processing <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={stopReason}
                  onChange={e => setStopReason(e.target.value)}
                  placeholder="State formal medical disqualification reason for compliance and audit trail..."
                  className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-xs font-semibold focus:border-red-500 outline-none resize-none"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowStopModal(false);
                    setStoppingApplicant(null);
                  }}
                  disabled={isSubmittingStop}
                  className="flex-1 px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStop}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-md shadow-red-600/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingStop ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Stopping...
                    </>
                  ) : (
                    'Stop Processing'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
