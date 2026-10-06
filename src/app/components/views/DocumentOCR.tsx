import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ScanText, FileCheck, CheckCircle2, AlertTriangle, Eye, Upload,
  Check, X, Sparkles, ExternalLink, FileText, Loader2, ShieldCheck, Trash2,
  Calendar, Clock, Undo2, User, UserCheck, Send, Plane, TrendingUp, AlertCircle,
  RefreshCw, ChevronRight, Search, Filter, ArrowRight, ShieldAlert, ArrowUpDown,
  ChevronDown, Layers, CheckCircle, ZoomIn, ZoomOut, RotateCw, ClipboardCheck
} from 'lucide-react';
import { ApplicantRecord, WorkflowState, ActivityLog, ApplicationForecastResponse } from '../../types';
import { api } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';

interface DocumentOCRProps {
  workflow: WorkflowState;
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  showToast: (message: string) => void;
  selectedApplicantId?: string;
  applicants?: ApplicantRecord[];
  updateApplicant?: (applicantId: string, updates: Partial<ApplicantRecord>) => void;
  onNavigate?: (view: string) => void;
}

interface RequirementRecord {
  applicant_req_id: number;
  requirement_id: number;
  status: string;
  ocr_validation_status: string;
  expiration_date: string | null;
  issue_date?: string | null;
  file_url?: string;
  file_path?: string | null;
  mime_type?: string | null;
  requirement: {
    requirement_name: string;
    ocr_enabled: boolean;
    category?: string;
    rule_category?: string;
  };
}

interface ReturnStageOption {
  key: string;
  name: string;
  status: string;
  phase: number;
  department: string;
  desc: string;
}

const RETURN_STAGE_OPTIONS: ReturnStageOption[] = [
  {
    key: 'pre_deployment',
    name: 'Pre-Deployment Processing',
    status: 'Pre-Deployment Processing',
    phase: 4,
    department: 'Admin',
    desc: 'Revert endorsement back to Pre-Deployment Processing in Endorsement Tracker',
  },
  {
    key: 'endorsement_tracker',
    name: 'Endorsement Tracker (Employer Review)',
    status: 'Endorse to Employer',
    phase: 4,
    department: 'Recruitment',
    desc: 'Return to foreign employer endorsement review or portal re-submission',
  },
  {
    key: 'cv_encoding',
    name: 'CV Encoding',
    status: 'CV Encoding',
    phase: 3,
    department: 'Recruitment',
    desc: 'Exit administrative validation and return to CV Encoding for revisions',
  },
  {
    key: 'applicant_profiling',
    name: 'Applicant Profiling',
    status: 'Applicant Profiling',
    phase: 3,
    department: 'Recruitment',
    desc: 'Return to recheck candidate readiness and match criteria',
  },
  {
    key: 'medical_clearance',
    name: 'Medical Clearance',
    status: 'Medical Clearance',
    phase: 2,
    department: 'Admin',
    desc: 'Return to Medical Gate / Fit-to-Work for clinic re-referral or laboratory re-evaluation',
  },
  {
    key: 'initial_screening',
    name: 'Initial Screening',
    status: 'Initial Screening',
    phase: 1,
    department: 'Recruitment',
    desc: 'Return to Initial Screening for basic qualification re-assessment',
  },
];

interface DocumentMismatchAlert {
  isMismatch: boolean;
  detectedName: string;
  expectedName: string;
  detail: string;
}

function checkDocumentTypeMismatch(
  reqName: string,
  detectedType: string = '',
  detectedTitle: string = '',
  rawText: string = ''
): DocumentMismatchAlert | null {
  const normReq = reqName.toLowerCase().trim();
  const normType = (detectedType || '').toLowerCase().trim();
  const normTitle = (detectedTitle || '').toLowerCase().trim();
  const text = (rawText || '').toLowerCase();

  // Helper flags for what was detected
  const isPassportDetected =
    normType === 'passport' ||
    normTitle.includes('passport') ||
    (text.includes('republic of the philippines') && (text.includes('passport') || text.includes('pasaporte'))) ||
    text.includes('passport no') ||
    text.includes('type/uri p');

  const isBirthCertDetected =
    normType === 'birth_certificate' ||
    normTitle.includes('birth') ||
    normTitle.includes('live birth') ||
    text.includes('certificate of live birth') ||
    text.includes('office of the civil registrar') ||
    (text.includes('philippine statistics authority') && text.includes('birth'));

  const isNbiDetected =
    normType === 'nbi_clearance' ||
    normTitle.includes('nbi') ||
    normTitle.includes('national bureau of investigation') ||
    text.includes('national bureau of investigation') ||
    text.includes('nbi clearance');

  const isMedicalDetected =
    normType === 'medical_certificate' ||
    normTitle.includes('medical') ||
    normTitle.includes('clinic') ||
    text.includes('medical examination') ||
    text.includes('fit to work') ||
    text.includes('physician') ||
    text.includes('doh-accredited');

  const isTesdaDetected =
    normType === 'tesda_certificate' ||
    normTitle.includes('tesda') ||
    text.includes('technical education and skills development authority') ||
    text.includes('national certificate ii') ||
    text.includes('national certificate iii');

  const isDiplomaDetected =
    normType === 'diploma' ||
    normType === 'tor' ||
    normTitle.includes('diploma') ||
    normTitle.includes('transcript') ||
    text.includes('transcript of records') ||
    text.includes('diploma') ||
    text.includes('commission on higher education');

  const isStcwDetected =
    normType === 'stcw_certificate' ||
    normTitle.includes('stcw') ||
    text.includes('standards of training, certification and watchkeeping') ||
    text.includes('stcw');

  const isPeosDetected =
    normType === 'peos_certificate' ||
    normTitle.includes('peos') ||
    text.includes('pre-employment orientation seminar');

  // Identify detected document name
  let actualDocName = '';
  if (isPassportDetected) actualDocName = 'Passport';
  else if (isBirthCertDetected) actualDocName = 'Birth Certificate (PSA)';
  else if (isNbiDetected) actualDocName = 'NBI Clearance';
  else if (isMedicalDetected) actualDocName = 'Medical Certificate';
  else if (isTesdaDetected) actualDocName = 'TESDA National Certificate';
  else if (isDiplomaDetected) actualDocName = 'Transcript of Records / Diploma';
  else if (isStcwDetected) actualDocName = 'STCW Certificate';
  else if (isPeosDetected) actualDocName = 'PEOS Certificate';

  // Compare against expected requirement
  let expectedDocName = '';
  let mismatch = false;

  if (normReq.includes('passport')) {
    expectedDocName = 'Passport';
    if (actualDocName && actualDocName !== 'Passport') {
      mismatch = true;
    }
  } else if (normReq.includes('birth') || normReq.includes('psa')) {
    expectedDocName = 'Birth Certificate (PSA)';
    if (actualDocName && actualDocName !== 'Birth Certificate (PSA)') {
      mismatch = true;
    }
  } else if (normReq.includes('nbi')) {
    expectedDocName = 'NBI Clearance';
    if (actualDocName && actualDocName !== 'NBI Clearance') {
      mismatch = true;
    }
  } else if (normReq.includes('medical') || normReq.includes('fit-to-work')) {
    expectedDocName = 'Medical Certificate';
    if (actualDocName && actualDocName !== 'Medical Certificate') {
      mismatch = true;
    }
  } else if (normReq.includes('tesda') || normReq.includes('national certificate')) {
    expectedDocName = 'TESDA Certificate';
    if (actualDocName && actualDocName !== 'TESDA National Certificate') {
      mismatch = true;
    }
  } else if (normReq.includes('transcript') || normReq.includes('diploma') || normReq.includes('tor')) {
    expectedDocName = 'Transcript of Records / Diploma';
    if (actualDocName && actualDocName !== 'Transcript of Records / Diploma') {
      mismatch = true;
    }
  } else if (normReq.includes('stcw')) {
    expectedDocName = 'STCW Certificate';
    if (actualDocName && actualDocName !== 'STCW Certificate') {
      mismatch = true;
    }
  } else if (normReq.includes('peos')) {
    expectedDocName = 'PEOS Certificate';
    if (actualDocName && actualDocName !== 'PEOS Certificate') {
      mismatch = true;
    }
  }

  if (mismatch && actualDocName && expectedDocName) {
    return {
      isMismatch: true,
      detectedName: actualDocName,
      expectedName: expectedDocName,
      detail: `You are validating "${expectedDocName}", but the uploaded document was detected as a "${actualDocName}". Please recheck and upload the correct document.`
    };
  }

  return null;
}

export default function DocumentOCR({
  workflow,
  currentUserName,
  addActivityLog,
  showToast,
  selectedApplicantId,
  applicants = [],
  updateApplicant,
  onNavigate,
}: DocumentOCRProps) {
  // ── 1. Qualified Candidates Pool ──────────────────────────────────────────
  const phaseQualifiedApplicants = useMemo(() => {
    return applicants.filter(a => {
      if (a.isStopped || a.status === 'Processing Stopped') return false;
      const st = String(a.status || (a as any).application_status || '').trim();
      const phaseNum = typeof a.phase === 'number' ? a.phase : Number(a.phase) || 1;
      return (
        st === 'Endorse for Administrative Processing' ||
        st === 'Pre-Deployment & Admin' ||
        st === 'Ready for Deployment' ||
        st === 'Deployed' ||
        (st === 'Provisional' && (phaseNum >= 5 || (a as any).current_phase >= 5)) ||
        phaseNum >= 5
      );
    });
  }, [applicants]);

  // ── Filters & Search State ────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'provisional' | 'ready' | 'deployed' | 'mine' | 'unassigned'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'newest' | 'progress'>('newest');

  // ── Verification Modal State ──────────────────────────────────────────────
  const [modalApplicant, setModalApplicant] = useState<ApplicantRecord | null>(null);
  const [requirements, setRequirements] = useState<RequirementRecord[]>([]);
  const [selectedReq, setSelectedReq] = useState<RequirementRecord | null>(null);
  const [isLoadingReqs, setIsLoadingReqs] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // ── Preview & Verification Fields ─────────────────────────────────────────
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string | null>(null);
  const [manualRemarks, setManualRemarks] = useState('');
  const [typedExpirationDate, setTypedExpirationDate] = useState('');
  const [officialDateUpdated, setOfficialDateUpdated] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);
  const [imageError, setImageError] = useState(false);

  // Local object URL map for instant 0ms preview when staff uploads files in this session
  const [localPreviewMap, setLocalPreviewMap] = useState<Record<number, { url: string; mime: string }>>({});
  const localPreviewMapRef = useRef<Record<number, { url: string; mime: string }>>({});
  const modalApplicantRef = useRef<ApplicantRecord | null>(null);
  const [ocrScannedFileName, setOcrScannedFileName] = useState<string | null>(null);

  // ── Optional OCR State (Ephemeral, Non-Storing) ───────────────────────────
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrEphemeralResult, setOcrEphemeralResult] = useState<{
    extracted_data?: Record<string, any>;
    discrepancies?: Array<{ field: string; issue: string; severity?: string }>;
    match_status?: string;
    mismatchAlert?: DocumentMismatchAlert | null;
  } | null>(null);

  // ── Return Stage Modal State ──────────────────────────────────────────────
  const [returnModalApplicant, setReturnModalApplicant] = useState<ApplicantRecord | null>(null);
  const [returnTargetKey, setReturnTargetKey] = useState<string>('endorsement_tracker');
  const [returnReason, setReturnReason] = useState<string>('');
  const [isReturning, setIsReturning] = useState(false);

  // ── Forecasting & Deployment State ────────────────────────────────────────
  const [forecastData, setForecastData] = useState<ApplicationForecastResponse | null>(null);
  const [isLoadingForecast, setIsLoadingForecast] = useState(false);
  const [actualDeploymentInput, setActualDeploymentInput] = useState('');
  const [isSavingDeployment, setIsSavingDeployment] = useState(false);

  // Helper: Normalize Supabase storage paths to absolute URLs
  const resolveStorageUrl = (urlOrPath: string | null | undefined): string | null => {
    if (!urlOrPath) return null;
    const trimmed = urlOrPath.trim();
    if (!trimmed) return null;
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('blob:') ||
      trimmed.startsWith('data:')
    ) {
      return trimmed;
    }
    const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://qhsbimvykfbxglkjcqmo.supabase.co';
    const clean = trimmed.replace(/^\/+/, '');
    if (clean.startsWith('applicant-documents/') || clean.startsWith('applicant-photos/')) {
      return `${supabaseUrl}/storage/v1/object/public/${clean}`;
    }
    if (clean.startsWith('photos/')) {
      return `${supabaseUrl}/storage/v1/object/public/applicant-photos/${clean}`;
    }
    return `${supabaseUrl}/storage/v1/object/public/applicant-documents/${clean}`;
  };

  // Helper: Retrieve registered document proof URL from candidate registration record
  const getRegisteredProofUrl = (app: ApplicantRecord | null, req: RequirementRecord | null): string | null => {
    if (!app || !req) return null;
    const reqName = (req.requirement?.requirement_name || '').toLowerCase();

    // 1. Identifications proof (Passport, NBI, etc.)
    for (const idDoc of app.identifications || []) {
      const typeStr = (idDoc.type || '').toLowerCase();
      if (
        (reqName.includes('passport') && typeStr.includes('passport')) ||
        (reqName.includes('nbi') && (typeStr.includes('nbi') || typeStr.includes('clearance'))) ||
        (reqName.includes('id') && typeStr.includes('id'))
      ) {
        if (idDoc.proofDocumentUrl) return resolveStorageUrl(idDoc.proofDocumentUrl);
      }
    }

    // 2. Applicant documents collection
    for (const doc of (app as any).documents || []) {
      const docName = (doc.name || doc.documentType || doc.title || '').toLowerCase();
      if (docName && (reqName.includes(docName) || docName.includes(reqName))) {
        const u = doc.fileUrl || doc.url || doc.file_url;
        if (u) return resolveStorageUrl(u);
      }
    }

    // 3. Enriched requirements
    for (const r of (app as any).requirements || []) {
      const rName = (r.name || '').toLowerCase();
      if (rName && (reqName.includes(rName) || rName.includes(reqName))) {
        const u = r.file_url || r.fileUrl || r.proofDocumentUrl;
        if (u) return resolveStorageUrl(u);
      }
    }

    return null;
  };

  // Auto-open modal disabled: Do not aggressively open modal when switching sidebar tabs
  // just because a selectedApplicantId exists in global context.
  useEffect(() => {
    // Intentionally left blank to prevent auto-opening. Users will click the list to open.
  }, [selectedApplicantId, phaseQualifiedApplicants]);

  // Keep modal applicant synchronized if parent applicants list updates
  useEffect(() => {
    if (modalApplicant) {
      const refreshed = applicants.find(a => String(a.id) === String(modalApplicant.id));
      if (refreshed) {
        setModalApplicant(refreshed);
      }
    }
  }, [applicants]);

  // ── Load Requirements for Modal Applicant ─────────────────────────────────
  const loadRequirements = async (appId: string, appOverride?: ApplicantRecord) => {
    if (!appId || appId === 'new' || isNaN(Number(appId))) return;
    setIsLoadingReqs(true);
    try {
      const res = await api.get(`/documents/${appId}`);
      const list: RequirementRecord[] = res.data || [];
      setRequirements(list);

      // Check if applicant has any rejected document
      const hasRejected = list.some(
        r => (r.status || '').toUpperCase() === 'REJECTED' || (r.ocr_validation_status || '').toLowerCase() === 'invalid'
      );
      const targetApp = appOverride || modalApplicant || modalApplicantRef.current;
      if (hasRejected && targetApp && (targetApp.status === 'Ready for Deployment')) {
        const numericId = parseInt(appId, 10);
        const reasonText = 'Candidate has rejected document(s). Reverted from Ready for Deployment to Provisional status.';
        const updates: Partial<ApplicantRecord> = {
          status: 'Provisional',
          phase: 5,
          phaseDescription: reasonText,
        };
        if (updateApplicant) updateApplicant(appId, updates);
        setModalApplicant(prev => prev ? ({ ...prev, ...updates }) : null);
        if (!isNaN(numericId)) {
          api.put(`/applicants/${numericId}`, {
            application_status: 'Provisional',
            current_phase: 5,
            phase_description: reasonText,
            statusChangeReason: 'Rejected requirement found; placed in Provisional status',
            statusChangeSource: 'DOCUMENT_VALIDATION',
            updated_at: new Date().toISOString(),
          }).catch(console.error);
        }
      }

      // If applicant record is missing dateOfBirth, enrich from backend
      if (targetApp && !targetApp.dateOfBirth) {
        api.get(`/applicants/${appId}`).then(appRes => {
          if (appRes.data) {
            const raw = appRes.data;
            const dob = raw.birth_date || raw.dateOfBirth || raw.birthDate || '';
            if (dob) {
              setModalApplicant(prev => prev ? ({
                ...prev,
                dateOfBirth: dob,
                age: prev.age || raw.age,
                sex: prev.sex || raw.sex || raw.gender,
              }) : null);
            }
          }
        }).catch(() => {});
      }

      // Auto-select first requirement if none selected
      if (list.length > 0) {
        const currentId = selectedReq?.applicant_req_id;
        const matching = currentId ? list.find(r => r.applicant_req_id === currentId) : null;
        handleSelectRequirement(matching || list[0], appOverride);
      } else {
        setSelectedReq(null);
        setPreviewUrl(null);
      }
    } catch (err: any) {
      showToast(`Failed to load requirements: ${err.message}`);
    } finally {
      setIsLoadingReqs(false);
    }
  };

  // ── Select Requirement to Inspect ─────────────────────────────────────────
  const handleSelectRequirement = async (req: RequirementRecord, appOverride?: ApplicantRecord) => {
    setSelectedReq(req);
    setManualRemarks('');
    setOcrEphemeralResult(null);
    setOfficialDateUpdated(false);
    setImageZoom(1);
    setImageRotation(0);
    setImageError(false);

    // Initialize typed expiration date from requirement or candidate profile
    const targetApplicant = appOverride || modalApplicant || modalApplicantRef.current;
    const initialExp = req.expiration_date || (targetApplicant ? getRegisteredExpirationDate(targetApplicant, req) : '') || '';
    setTypedExpirationDate(initialExp);

    // 1. Check local session preview map first (instant 0ms preview for files uploaded in current session)
    const localCached = localPreviewMapRef.current[req.applicant_req_id] || localPreviewMap[req.applicant_req_id];
    if (localCached) {
      setPreviewUrl(localCached.url);
      setPreviewMime(localCached.mime);
      return;
    }

    // 2. Direct public / signed file_url if available
    if (req.file_url) {
      setPreviewUrl(req.file_url);
      setPreviewMime(req.mime_type || null);
      return;
    }

    // 3. Backend signed URL if file_path exists in private bucket
    if (req.file_path) {
      try {
        const previewRes = await api.get(`/documents/${req.applicant_req_id}/preview`);
        if (previewRes.data?.signed_url) {
          setPreviewUrl(previewRes.data.signed_url);
          setPreviewMime(previewRes.data.mime_type || req.mime_type || null);
          return;
        }
      } catch (e) {
        console.warn('Could not load signed preview URL:', e);
      }
    }

    // 4. Fallback to registered candidate documents from profile / registration
    const registeredProof = targetApplicant ? getRegisteredProofUrl(targetApplicant, req) : null;
    if (registeredProof) {
      setPreviewUrl(registeredProof);
      const isPdfProof = registeredProof.toLowerCase().includes('.pdf') || registeredProof.includes('application/pdf');
      setPreviewMime(isPdfProof ? 'application/pdf' : 'image/jpeg');
      return;
    }

    // No document file available
    setPreviewUrl(null);
    setPreviewMime(null);
  };

  // ── Open Applicant Modal ──────────────────────────────────────────────────
  const handleOpenApplicantModal = (applicant: ApplicantRecord) => {
    const normalizedApplicant: ApplicantRecord = {
      ...applicant,
      dateOfBirth: applicant.dateOfBirth || (applicant as any).birth_date || (applicant as any).birthDate || (applicant as any).date_of_birth || '',
    };
    modalApplicantRef.current = normalizedApplicant;
    setModalApplicant(normalizedApplicant);
    setForecastData(null);
    setActualDeploymentInput(normalizedApplicant.actualDeploymentDate || '');
    loadRequirements(String(normalizedApplicant.id), normalizedApplicant);
    loadForecast(normalizedApplicant);
  };

  const handleCloseApplicantModal = () => {
    modalApplicantRef.current = null;
    setModalApplicant(null);
    setSelectedReq(null);
    setPreviewUrl(null);
    setOcrEphemeralResult(null);
    setImageError(false);
  };

  // ── Load Predictive Forecast for Candidate ────────────────────────────────
  const loadForecast = async (app: ApplicantRecord) => {
    const applicationId = app.applicationId || (Number(app.id) ? Number(app.id) : null);
    if (!applicationId) return;

    setIsLoadingForecast(true);
    try {
      const res = await api.get(`/forecasting/application/${applicationId}`);
      if (res.data) {
        setForecastData(res.data);
      }
    } catch (e) {
      // Non-blocking fallback
      setForecastData(null);
    } finally {
      setIsLoadingForecast(false);
    }
  };

  // ── Realtime Subscription for Requirements ────────────────────────────────
  useEffect(() => {
    if (!modalApplicant) return;
    const appId = String(modalApplicant.id);
    const channel = supabase
      .channel(`realtime:applicant_documents_${appId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applicant_requirement' },
        () => {
          loadRequirements(appId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [modalApplicant?.id]);

  // ── Helper: Registered Expiration Date Lookup ─────────────────────────────
  const getRegisteredExpirationDate = (app: ApplicantRecord, req: RequirementRecord | null): string | null => {
    if (!req) return null;
    const reqName = (req.requirement?.requirement_name || '').toLowerCase();

    // 1. Check direct requirement's expiration_date if already saved
    if (req.expiration_date) {
      return req.expiration_date;
    }

    // 2. Check passport fields if passport
    if (reqName.includes('passport')) {
      const pExp = app.passportExpirationDate || (app as any).passport_expiration_date || (app as any).passportExpiry || (app as any).passport_expiry;
      if (pExp) return String(pExp).split('T')[0];
    }

    // 3. Look in identifications enriched on applicant profile
    const idList = app.identifications || (app as any).applicant_identification || [];
    for (const idRecord of idList) {
      const typeStr = (idRecord.type || idRecord.identification_type || '').toLowerCase();
      const exp = idRecord.expiryDate || idRecord.expiry_date || idRecord.expiration_date;
      if (reqName.includes('passport') && typeStr.includes('passport') && exp) {
        return String(exp).split('T')[0];
      }
      if (
        (reqName.includes('nbi') || reqName.includes('clearance') || reqName.includes('police')) &&
        (typeStr.includes('nbi') || typeStr.includes('clearance') || typeStr.includes('police')) &&
        exp
      ) {
        return String(exp).split('T')[0];
      }
      if (reqName.includes('driver') && typeStr.includes('driver') && exp) {
        return String(exp).split('T')[0];
      }
    }

    return null;
  };

  const isExpirationTrackedRequirement = (req: RequirementRecord | null): boolean => {
    if (!req) return false;
    const name = (req.requirement?.requirement_name || '').toLowerCase();
    const cat = (req.requirement?.category || '').toUpperCase();
    const ruleCat = (req.requirement?.rule_category || '').toUpperCase();

    return (
      ruleCat.includes('EXPIR') ||
      ruleCat === 'MEDICAL_SUPPORTING' ||
      cat === 'IDENTITY' ||
      name.includes('passport') ||
      name.includes('nbi') ||
      name.includes('medical') ||
      name.includes('clearance') ||
      name.includes('owwa') ||
      name.includes('pdos') ||
      name.includes('visa') ||
      name.includes('license')
    );
  };

  // ── Claim & Release Actions ───────────────────────────────────────────────
  const handleClaim = async (app: ApplicantRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const applicantId = String(app.id);
    const numericId = parseInt(applicantId, 10);
    const nowIso = new Date().toISOString();

    const updates: Partial<ApplicantRecord> = {
      currentHandler: currentUserName,
      currentDepartment: 'Admin',
      phaseDescription: `Administrative document verification claimed by ${currentUserName}`,
    };

    if (updateApplicant) {
      updateApplicant(applicantId, updates);
    }

    if (!isNaN(numericId)) {
      await api.put(`/applicants/${numericId}`, {
        application_id: app.applicationId,
        current_handler: currentUserName,
        current_department: 'Admin',
        phase_description: updates.phaseDescription,
        statusChangeReason: `Document validation claimed by ${currentUserName}`,
        statusChangeSource: 'STAFF_ACTION',
        updated_at: nowIso,
      }).catch(console.error);
    }

    addActivityLog({
      applicantId,
      action: 'Turnover: Claimed by Staff',
      performedBy: currentUserName,
      department: 'Admin',
      details: `${currentUserName} claimed administrative document validation of ${app.name}.`,
    });

    showToast(`✓ Candidate ${app.name} assigned to your queue.`);
  };

  const handleRelease = async (app: ApplicantRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const applicantId = String(app.id);
    const numericId = parseInt(applicantId, 10);
    const nowIso = new Date().toISOString();

    const updates: Partial<ApplicantRecord> = {
      currentHandler: 'Unassigned',
      phaseDescription: `Returned to unassigned administrative queue pool by ${currentUserName}`,
    };

    if (updateApplicant) {
      updateApplicant(applicantId, updates);
    }

    if (!isNaN(numericId)) {
      await api.put(`/applicants/${numericId}`, {
        application_id: app.applicationId,
        current_handler: 'Unassigned',
        phase_description: updates.phaseDescription,
        statusChangeReason: `Released to pool by ${currentUserName}`,
        statusChangeSource: 'STAFF_ACTION',
        updated_at: nowIso,
      }).catch(console.error);
    }

    addActivityLog({
      applicantId,
      action: 'Turnover: Returned to Pool',
      performedBy: currentUserName,
      department: 'Admin',
      details: `${currentUserName} returned applicant ${app.name} to the unassigned candidate pool.`,
    });

    showToast(`Candidate ${app.name} returned to unassigned pool.`);
  };

  // ── Return to Workflow Stage ──────────────────────────────────────────────
  const handleOpenReturnModal = (app: ApplicantRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReturnModalApplicant(app);
    setReturnTargetKey('pre_deployment');
    setReturnReason('');
  };

  const handleOpenRevertToPreDeployment = (app: ApplicantRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReturnModalApplicant(app);
    setReturnTargetKey('pre_deployment');
    setReturnReason('Reverted to Pre-Deployment Processing for document revision or requirement update.');
  };

  const handleConfirmReturnStage = async () => {
    if (!returnModalApplicant) return;
    const target = RETURN_STAGE_OPTIONS.find(s => s.key === returnTargetKey) || RETURN_STAGE_OPTIONS[0];
    const reason = returnReason.trim();
    if (!reason || reason.length < 5) {
      showToast('Please provide a specific justification reason (minimum 5 characters).');
      return;
    }

    setIsReturning(true);
    const app = returnModalApplicant;
    const applicantId = String(app.id);
    const numericId = parseInt(applicantId, 10);
    const nowIso = new Date().toISOString();

    try {
      if (updateApplicant) {
        updateApplicant(applicantId, {
          phase: target.phase,
          status: target.status,
          currentHandler: 'Unassigned',
          currentDepartment: target.department,
          phaseDescription: target.key === 'pre_deployment'
            ? `Candidate returned to Pre-Deployment Processing. Ready for document validation. Reason: ${reason}`
            : `Returned to ${target.name} due to invalid document requirements. Reason: ${reason}`,
        });
      }

      if (!isNaN(numericId)) {
        await api.put(`/applicants/${numericId}`, {
          current_phase: target.phase,
          application_status: target.status,
          current_handler: 'Unassigned',
          current_department: target.department,
          phase_description: target.key === 'pre_deployment'
            ? `Candidate returned to Pre-Deployment Processing. Ready for document validation. Reason: ${reason}`
            : `Returned to ${target.name} from Document Validation. Reason: ${reason}`,
          statusChangeReason: reason,
          statusChangeSource: 'DOCUMENT_VALIDATION_RETURN',
          updated_at: nowIso,
        }).catch(console.error);

        await api.post(`/documents/applicants/${numericId}/return-phase`, {
          new_status: target.status,
          reason,
        }).catch(console.error);

        // If reverting to Pre-Deployment Processing, reset admin_notes on cv_employer_submission
        if (target.key === 'pre_deployment') {
          api.get('/cv-submissions').then(res => {
            const match = (res.data || []).find((s: any) => String(s.applicant_id) === applicantId);
            if (match) {
              api.patch(`/cv-submissions/${match.submission_id}`, {
                adminNotes: '',
                updatedBy: currentUserName,
              }).catch(console.error);
            }
          }).catch(console.error);
        }
      }

      addActivityLog({
        applicantId,
        action: target.key === 'pre_deployment' ? 'Reverted to Pre-Deployment Processing' : `Returned to ${target.name}`,
        performedBy: currentUserName,
        department: 'Admin',
        details: target.key === 'pre_deployment'
          ? `Reverted from Document Validation to Pre-Deployment Processing. Justification: ${reason}`
          : `Returned from Document Validation to ${target.name}. Justification: ${reason}`,
      });

      showToast(target.key === 'pre_deployment'
        ? `↩ ${app.name} reverted to Pre-Deployment Processing.`
        : `✓ ${app.name} returned to ${target.name} (Unassigned).`
      );
      setReturnModalApplicant(null);
      if (modalApplicant?.id === app.id) {
        handleCloseApplicantModal();
      }
    } catch (err: any) {
      showToast(`Failed to return candidate: ${err.message}`);
    } finally {
      setIsReturning(false);
    }
  };

  // ── Verification Decision & Expiration Update ─────────────────────────────
  const handleVerifyDecision = async (status: 'VERIFIED' | 'REJECTED') => {
    if (!selectedReq || !modalApplicant) return;
    const isExpiryRequired = isExpirationTrackedRequirement(selectedReq);

    if (status === 'VERIFIED' && isExpiryRequired && !typedExpirationDate) {
      showToast('⚠️ Please provide a verified expiration date for this document to track 3-2-1 compliance.');
      return;
    }

    setIsProcessing(true);
    try {
      const applicantReqId = selectedReq.applicant_req_id;

      // 1. If expiration date entered, save to fields
      if (typedExpirationDate) {
        await api.patch(`/documents/${applicantReqId}/fields`, {
          fields: { expiration_date: typedExpirationDate },
          reason: manualRemarks || 'Verified document expiration date',
        });
      }

      // 2. Update status in database
      await api.patch(`/documents/${applicantReqId}/status`, {
        new_status: status,
        reason: manualRemarks || undefined,
        expiration_date: typedExpirationDate || undefined,
      });

      // 3. Immediately update local requirements and selectedReq state
      setRequirements(prev => prev.map(r => r.applicant_req_id === applicantReqId ? {
        ...r,
        status,
        ocr_validation_status: status === 'VERIFIED' ? 'Verified' : 'Invalid',
        expiration_date: typedExpirationDate || r.expiration_date,
      } : r));

      setSelectedReq(prev => prev && prev.applicant_req_id === applicantReqId ? {
        ...prev,
        status,
        ocr_validation_status: status === 'VERIFIED' ? 'Verified' : 'Invalid',
        expiration_date: typedExpirationDate || prev.expiration_date,
      } : prev);

      // 4. Trigger alert evaluation scan in background
      api.post('/documents/alerts/scan').catch(() => {});

      const applicantId = String(modalApplicant.id);
      const numericId = parseInt(applicantId, 10);
      const nowIso = new Date().toISOString();
      const reqName = selectedReq.requirement?.requirement_name || 'Document';

      // If verifying passport and expiration date is entered, sync to applicant profile
      if (typedExpirationDate && reqName.toLowerCase().includes('passport')) {
        if (!isNaN(numericId)) {
          api.put(`/applicants/${numericId}`, {
            passport_expiration_date: typedExpirationDate,
            updated_at: nowIso,
          }).catch(console.error);
        }
        setModalApplicant(prev => prev ? ({ ...prev, passportExpirationDate: typedExpirationDate }) : null);
        if (updateApplicant) {
          updateApplicant(applicantId, { passportExpirationDate: typedExpirationDate });
        }
      }

      if (status === 'REJECTED') {
        // Enforce Provisional status on rejection
        const reasonText = `Requirement "${reqName}" was rejected${manualRemarks ? `: ${manualRemarks}` : ''}. Candidate placed in Provisional status.`;
        const updates: Partial<ApplicantRecord> = {
          status: 'Provisional',
          phase: 5,
          phaseDescription: reasonText,
        };

        if (updateApplicant) {
          updateApplicant(applicantId, updates);
        }
        setModalApplicant(prev => prev ? ({ ...prev, ...updates }) : null);

        if (!isNaN(numericId)) {
          await api.put(`/applicants/${numericId}`, {
            application_status: 'Provisional',
            current_phase: 5,
            phase_description: reasonText,
            statusChangeReason: `Document rejected: ${reqName}`,
            statusChangeSource: 'DOCUMENT_VALIDATION',
            updated_at: nowIso,
          }).catch(console.error);
        }

        addActivityLog({
          applicantId,
          action: 'Candidate Marked as Provisional',
          performedBy: currentUserName,
          department: 'Admin',
          details: reasonText,
        });

        showToast(`Document "${reqName}" rejected. Candidate moved to Provisional status.`);
      } else {
        // status === 'VERIFIED'
        // Check if candidate still has any other rejected requirement
        const otherRejected = requirements.filter(
          r => r.applicant_req_id !== applicantReqId &&
          ((r.status || '').toUpperCase() === 'REJECTED' || (r.ocr_validation_status || '').toLowerCase() === 'invalid')
        );

        if (otherRejected.length > 0) {
          const rejectedNames = otherRejected.map(r => r.requirement?.requirement_name || 'Requirement').join(', ');
          const reasonText = `Document approved, but candidate remains in Provisional status due to remaining rejected document(s): ${rejectedNames}.`;
          const updates: Partial<ApplicantRecord> = {
            status: 'Provisional',
            phase: 5,
            phaseDescription: reasonText,
          };

          if (updateApplicant) {
            updateApplicant(applicantId, updates);
          }
          setModalApplicant(prev => prev ? ({ ...prev, ...updates }) : null);

          if (!isNaN(numericId)) {
            await api.put(`/applicants/${numericId}`, {
              application_status: 'Provisional',
              current_phase: 5,
              phase_description: reasonText,
              statusChangeReason: `Document verified, but candidate has rejected document(s): ${rejectedNames}`,
              statusChangeSource: 'DOCUMENT_VALIDATION',
              updated_at: nowIso,
            }).catch(console.error);
          }

          showToast(`✓ Document approved. Candidate remains in Provisional status (rejected: ${rejectedNames}).`);
        } else {
          // No remaining rejected documents
          if (modalApplicant.status === 'Provisional') {
            const reasonText = 'All document rejections resolved. Candidate returned to Administrative Processing.';
            const updates: Partial<ApplicantRecord> = {
              status: 'Endorse for Administrative Processing',
              phase: 5,
              phaseDescription: reasonText,
            };

            if (updateApplicant) {
              updateApplicant(applicantId, updates);
            }
            setModalApplicant(prev => prev ? ({ ...prev, ...updates }) : null);

            if (!isNaN(numericId)) {
              await api.put(`/applicants/${numericId}`, {
                application_status: 'Endorse for Administrative Processing',
                current_phase: 5,
                phase_description: reasonText,
                statusChangeReason: 'Document rejections resolved',
                statusChangeSource: 'DOCUMENT_VALIDATION',
                updated_at: nowIso,
              }).catch(console.error);
            }

            addActivityLog({
              applicantId,
              action: 'Restored from Provisional',
              performedBy: currentUserName,
              department: 'Admin',
              details: reasonText,
            });

            showToast(`✓ Document approved. All rejections cleared; candidate returned to Administrative Processing.`);
          } else {
            showToast(`✓ Document ${reqName} marked as Approved & Verified.`);
          }
        }
      }

      addActivityLog({
        applicantId: String(modalApplicant.id),
        action: `Document ${status === 'VERIFIED' ? 'Approved' : 'Rejected'}`,
        performedBy: currentUserName,
        department: 'Admin',
        details: `${reqName}: ${status}${typedExpirationDate ? ` (Expires: ${typedExpirationDate})` : ''}`,
      });

      await loadRequirements(String(modalApplicant.id));
    } catch (err: any) {
      showToast(`Action failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Sync Official Registration Expiration Date ────────────────────────────
  const handleUpdateOfficialRegistrationDate = async () => {
    if (!modalApplicant || !selectedReq || !typedExpirationDate) return;
    const reqName = (selectedReq.requirement?.requirement_name || '').toLowerCase();
    const numericId = parseInt(String(modalApplicant.id), 10);

    setIsProcessing(true);
    try {
      // 1. Update applicant requirement in database so document requirement record also has it
      await api.patch(`/documents/${selectedReq.applicant_req_id}/fields`, {
        fields: { expiration_date: typedExpirationDate },
        reason: 'Staff synced official expiration date',
      });

      // 2. Update applicant identifications list
      const updatedIdentifications = (modalApplicant.identifications || []).map(id => {
        const typeStr = (id.type || '').toLowerCase();
        if (reqName.includes('passport') && typeStr.includes('passport')) {
          return { ...id, expiryDate: typedExpirationDate };
        }
        if (reqName.includes('nbi') && (typeStr.includes('nbi') || typeStr.includes('clearance'))) {
          return { ...id, expiryDate: typedExpirationDate };
        }
        return id;
      });

      const updates: Partial<ApplicantRecord> = {
        identifications: updatedIdentifications,
      };
      if (reqName.includes('passport')) {
        updates.passportExpirationDate = typedExpirationDate;
      }

      if (updateApplicant) {
        updateApplicant(String(modalApplicant.id), updates);
      }
      setModalApplicant(prev => prev ? ({ ...prev, ...updates }) : null);

      // Also update selectedReq and requirements list
      setSelectedReq(prev => prev ? ({ ...prev, expiration_date: typedExpirationDate }) : null);
      setRequirements(prev => prev.map(r => r.applicant_req_id === selectedReq.applicant_req_id ? ({ ...r, expiration_date: typedExpirationDate }) : r));

      if (!isNaN(numericId)) {
        await api.put(`/applicants/${numericId}`, {
          identifications: updatedIdentifications,
          passport_expiration_date: reqName.includes('passport') ? typedExpirationDate : undefined,
          updated_at: new Date().toISOString(),
        });
      }

      setOfficialDateUpdated(true);
      showToast(`✓ Official registration and requirement records updated to ${typedExpirationDate}.`);

      addActivityLog({
        applicantId: String(modalApplicant.id),
        action: 'Official Expiration Date Synced',
        performedBy: currentUserName,
        department: 'Admin',
        details: `Updated ${selectedReq.requirement.requirement_name} registration expiration to ${typedExpirationDate}.`,
      });
    } catch (err: any) {
      showToast(`Failed to update official record: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Optional OCR Assistant (Ephemeral, Non-Storing) ───────────────────────
  const handleOptionalOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !modalApplicant) return;

    // Immediately preview the file in the left document viewer (0ms latency)
    const localUrl = URL.createObjectURL(file);
    const mime = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    setPreviewUrl(localUrl);
    setPreviewMime(mime);
    setOcrScannedFileName(file.name);
    setImageZoom(1);
    setImageRotation(0);

    setIsOcrProcessing(true);
    setOcrEphemeralResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const numericId = parseInt(String(modalApplicant.id), 10);
      let resData: any = null;

      // Call non-storing verify endpoint powered by Gemini Vision AI
      if (!isNaN(numericId)) {
        try {
          const res = await api.post(`/ocr/verify/${numericId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          resData = res.data;
        } catch {
          // Fallback to raw extract
          const rawRes = await api.post('/ocr/extract', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          resData = {
            extracted_data: rawRes.data?.fields || {},
            discrepancies: [],
            match_status: 'EXTRACTED',
          };
        }
      }

      if (resData) {
        const extracted = resData.extracted_data || {};
        const discrepancies: Array<{ field: string; issue: string; severity?: string }> = resData.discrepancies || [];

        // In-memory cross-check against profile
        const profileName = (modalApplicant.name || '').toLowerCase().trim();
        const extractedName = String(extracted.name || extracted.full_name || '').toLowerCase().trim();
        if (extractedName && !profileName.includes(extractedName) && !extractedName.includes(profileName)) {
          if (!discrepancies.some(d => d.field.toLowerCase().includes('name'))) {
            discrepancies.push({
              field: 'Applicant Name',
              issue: `Extracted name "${extracted.name || extracted.full_name}" does not match profile name "${modalApplicant.name}"`,
            });
          }
        }

        const profileSex = (modalApplicant.sex || '').toUpperCase();
        const extractedSex = String(extracted.sex || extracted.gender || '').toUpperCase();
        if (profileSex && extractedSex && profileSex !== extractedSex) {
          if (!discrepancies.some(d => d.field.toLowerCase().includes('sex') || d.field.toLowerCase().includes('gender'))) {
            discrepancies.push({
              field: 'Gender / Sex',
              issue: `Document shows ${extractedSex} but candidate profile is registered as ${profileSex}`,
            });
          }
        }

        // Check document type mismatch against selected requirement
        const currentReqName = selectedReq?.requirement?.requirement_name || '';
        const detectedType = extracted.document_type || resData.document_type || '';
        const detectedTitle = extracted.document_title || resData.document_title || '';
        const rawText = resData.raw_text || '';
        const mismatchAlert = checkDocumentTypeMismatch(currentReqName, detectedType, detectedTitle, rawText);

        if (mismatchAlert) {
          discrepancies.unshift({
            field: 'Document Type Mismatch',
            issue: mismatchAlert.detail,
            severity: 'CRITICAL',
          });
        }

        setOcrEphemeralResult({
          extracted_data: extracted,
          discrepancies,
          match_status: discrepancies.length > 0 ? 'DISCREPANCY' : 'MATCH',
          mismatchAlert,
        });

        if (mismatchAlert) {
          showToast(`⚠️ DOCUMENT MISMATCH: Uploaded file is a ${mismatchAlert.detectedName}, not a ${mismatchAlert.expectedName}! Please recheck.`);
        } else {
          // If expiration date extracted, offer review
          const extractedExp = extracted.expiration_date || extracted.expiry_date || extracted.date_of_expiry;
          if (extractedExp) {
            showToast(`✓ Gemini Vision detected date ${extractedExp}. Review and choose whether to accept.`);
          } else {
            showToast('✓ Gemini Vision scan complete (ephemeral preview, file not stored).');
          }
        }

        addActivityLog({
          applicantId: String(modalApplicant.id),
          action: 'Ephemeral AI OCR Scan',
          performedBy: currentUserName,
          department: 'Admin',
          details: `Scanned temporary document via Google Gemini Vision AI. Discrepancies: ${discrepancies.length}`,
        });
      }
    } catch (err: any) {
      showToast(`Gemini OCR scan error: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsOcrProcessing(false);
      e.target.value = '';
    }
  };

  // ── Permanent File Upload for Requirement ─────────────────────────────────
  const handleRequirementFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedReq || !modalApplicant) return;

    // Immediately display local preview (0ms latency)
    const localUrl = URL.createObjectURL(file);
    const mime = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    setPreviewUrl(localUrl);
    setPreviewMime(mime);
    setImageZoom(1);
    setImageRotation(0);
    setImageError(false);
    localPreviewMapRef.current[selectedReq.applicant_req_id] = { url: localUrl, mime };
    setLocalPreviewMap(prev => ({
      ...prev,
      [selectedReq.applicant_req_id]: { url: localUrl, mime }
    }));

    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const env = (import.meta as any).env || {};
      const baseUrl = env.VITE_API_BASE_URL || env.VITE_BACKEND_URL || 'http://localhost:8000';

      const queryParams = new URLSearchParams({
        applicant_id: String(modalApplicant.id),
        requirement_id: String(selectedReq.requirement_id),
        run_ocr: 'false',
      });

      const res = await fetch(`${baseUrl}/documents/${selectedReq.applicant_req_id}/upload?${queryParams.toString()}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        let errStr = res.statusText;
        try {
          const errData = await res.json();
          errStr = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
        } catch {}
        throw new Error(errStr);
      }

      showToast('Document uploaded successfully.');
      await loadRequirements(String(modalApplicant.id), modalApplicant);
    } catch (err: any) {
      showToast(`Upload failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  // ── Remove Uploaded Requirement File ──────────────────────────────────────
  const handleConfirmRemoveFile = async () => {
    if (!selectedReq || !modalApplicant) return;
    setIsProcessing(true);
    try {
      await api.delete(`/documents/${selectedReq.applicant_req_id}/file`);
      delete localPreviewMapRef.current[selectedReq.applicant_req_id];
      setLocalPreviewMap(prev => {
        const next = { ...prev };
        delete next[selectedReq.applicant_req_id];
        return next;
      });
      showToast('File removed successfully.');
      setShowDeleteModal(false);
      setPreviewUrl(null);
      setPreviewMime(null);
      setImageError(false);
      await loadRequirements(String(modalApplicant.id), modalApplicant);

      addActivityLog({
        applicantId: String(modalApplicant.id),
        action: 'Removed Document File',
        performedBy: currentUserName,
        department: 'Admin',
        details: `Removed uploaded file for ${selectedReq.requirement.requirement_name}`,
      });
    } catch (err: any) {
      showToast(`Failed to remove file: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Deployment Status Promotion ───────────────────────────────────────────
  const handlePromoteToReadyForDeployment = async () => {
    if (!modalApplicant) return;
    const applicantId = String(modalApplicant.id);
    const numericId = parseInt(applicantId, 10);
    const nowIso = new Date().toISOString();

    // Check if the candidate has any rejected documents
    const rejectedReqs = requirements.filter(
      r => (r.status || '').toUpperCase() === 'REJECTED' || (r.ocr_validation_status || '').toLowerCase() === 'invalid'
    );

    if (rejectedReqs.length > 0) {
      const rejectedNames = rejectedReqs.map(r => r.requirement?.requirement_name || 'Requirement').join(', ');
      const reasonText = `Deployment blocked: Candidate has ${rejectedReqs.length} rejected document(s) (${rejectedNames}). Placed in Provisional status.`;

      const updates: Partial<ApplicantRecord> = {
        status: 'Provisional',
        phase: 5,
        phaseDescription: reasonText,
      };

      if (updateApplicant) {
        updateApplicant(applicantId, updates);
      }
      setModalApplicant(prev => prev ? ({ ...prev, ...updates }) : null);

      if (!isNaN(numericId)) {
        await api.put(`/applicants/${numericId}`, {
          application_status: 'Provisional',
          current_phase: 5,
          phase_description: reasonText,
          statusChangeReason: `Deployment blocked: Rejected requirements (${rejectedNames})`,
          statusChangeSource: 'DOCUMENT_VALIDATION',
          updated_at: nowIso,
        }).catch(console.error);
      }

      addActivityLog({
        applicantId,
        action: 'Deployment Blocked (Provisional)',
        performedBy: currentUserName,
        department: 'Admin',
        details: reasonText,
      });

      showToast(`⚠️ Cannot promote to Ready for Deployment: Candidate has rejected document(s) (${rejectedNames}) and is marked as Provisional.`);
      return;
    }

    setIsSavingDeployment(true);
    try {
      const updates: Partial<ApplicantRecord> = {
        phase: 5,
        status: 'Ready for Deployment',
        phaseDescription: 'All pre-deployment documents verified. Awaiting DMW flight and departure confirmation.',
      };

      if (updateApplicant) {
        updateApplicant(applicantId, updates);
      }
      setModalApplicant(prev => prev ? ({ ...prev, ...updates }) : null);

      if (!isNaN(numericId)) {
        await api.put(`/applicants/${numericId}`, {
          current_phase: 5,
          application_status: 'Ready for Deployment',
          phase_description: updates.phaseDescription,
          statusChangeReason: 'All documents verified; ready for final deployment scheduling',
          statusChangeSource: 'STAFF_ACTION',
          updated_at: nowIso,
        });
      }

      addActivityLog({
        applicantId,
        action: 'Promoted to Ready for Deployment',
        performedBy: currentUserName,
        department: 'Admin',
        details: `Candidate verified and promoted to Ready for Deployment. PERT timeline active.`,
      });

      showToast(`✓ ${modalApplicant.name} is now Ready for Deployment!`);
      loadForecast(modalApplicant);
    } catch (err: any) {
      showToast(`Failed to update status: ${err.message}`);
    } finally {
      setIsSavingDeployment(false);
    }
  };

  // ── Revert from Ready for Deployment ─────────────────────────────────────
  const handleRevertReadyForDeployment = async (appOverride?: ApplicantRecord) => {
    const target = appOverride || modalApplicant;
    if (!target) return;
    const applicantId = String(target.id);
    const numericId = parseInt(applicantId, 10);
    const nowIso = new Date().toISOString();

    setIsSavingDeployment(true);
    try {
      const updates: Partial<ApplicantRecord> = {
        phase: 5,
        status: 'Endorse for Administrative Processing',
        phaseDescription: 'Reverted from Ready for Deployment back to Administrative Processing for further requirement review.',
      };

      if (updateApplicant) {
        updateApplicant(applicantId, updates);
      }

      if (modalApplicant && modalApplicant.id === target.id) {
        setModalApplicant(prev => prev ? ({ ...prev, ...updates }) : null);
      }

      if (!isNaN(numericId)) {
        await api.put(`/applicants/${numericId}`, {
          current_phase: 5,
          application_status: 'Endorse for Administrative Processing',
          phase_description: updates.phaseDescription,
          statusChangeReason: 'Reverted from Ready for Deployment back to Administrative Processing',
          statusChangeSource: 'STAFF_ACTION',
          updated_at: nowIso,
        });
      }

      addActivityLog({
        applicantId,
        action: 'Reverted from Ready for Deployment',
        performedBy: currentUserName,
        department: 'Admin',
        details: `${target.name} status reverted back to Administrative Processing for further document validation.`,
      });

      showToast(`↩ ${target.name} reverted back to Administrative Processing.`);
      if (modalApplicant && modalApplicant.id === target.id) {
        loadForecast(target);
      }
    } catch (err: any) {
      showToast(`Failed to revert status: ${err.message}`);
    } finally {
      setIsSavingDeployment(false);
    }
  };

  // ── Encode Actual Deployment Date & Transition to Deployed ────────────────
  const handleSaveActualDeploymentDate = async () => {
    if (!modalApplicant || !actualDeploymentInput) {
      showToast('Please select the confirmed DMW actual deployment date.');
      return;
    }

    const applicantId = String(modalApplicant.id);
    const numericId = parseInt(applicantId, 10);
    const nowIso = new Date().toISOString();
    const todayStr = new Date().toISOString().split('T')[0];

    // If actual deployment date has arrived (or is today or earlier), status becomes Deployed
    const isAlreadyReached = actualDeploymentInput <= todayStr;
    const targetStatus = isAlreadyReached ? 'Deployed' : 'Ready for Deployment';
    const targetPhase = isAlreadyReached ? 6 : 5;

    setIsSavingDeployment(true);
    try {
      const updates: Partial<ApplicantRecord> = {
        actualDeploymentDate: actualDeploymentInput,
        phase: targetPhase,
        status: targetStatus,
        phaseDescription: isAlreadyReached
          ? `Candidate deployed overseas on ${actualDeploymentInput}. 3-2-1 compliance alert tracking concluded.`
          : `Confirmed DMW deployment date encoded: ${actualDeploymentInput}. Departure scheduled.`,
      };

      if (updateApplicant) {
        updateApplicant(applicantId, updates);
      }

      if (!isNaN(numericId)) {
        await api.put(`/applicants/${numericId}`, {
          actual_deployment_at: actualDeploymentInput,
          current_phase: targetPhase,
          application_status: targetStatus,
          phase_description: updates.phaseDescription,
          statusChangeReason: `DMW deployment date recorded: ${actualDeploymentInput}`,
          statusChangeSource: 'DMW_RESPONSE',
          updated_at: nowIso,
        });

        // If candidate is now Deployed, stop tracking 3-2-1 compliance alerts
        if (isAlreadyReached) {
          await api.post(`/documents/alerts/applicant/${numericId}/resolve`).catch(console.warn);
        }
      }

      addActivityLog({
        applicantId,
        action: isAlreadyReached ? 'Applicant Deployed' : 'Encoded Actual Deployment Date',
        performedBy: currentUserName,
        department: 'Admin',
        details: `DMW actual deployment date recorded: ${actualDeploymentInput}.${isAlreadyReached ? ' 3-2-1 alerts stopped.' : ''}`,
      });

      showToast(
        isAlreadyReached
          ? `✓ Candidate marked as Deployed! 3-2-1 Compliance Alert tracking has been successfully stopped.`
          : `✓ DMW Actual Deployment Date saved (${actualDeploymentInput}).`
      );
    } catch (err: any) {
      showToast(`Failed to record deployment date: ${err.message}`);
    } finally {
      setIsSavingDeployment(false);
    }
  };

  // ── Filtered and Sorted Candidate Cards ───────────────────────────────────
  const filteredApplicants = useMemo(() => {
    return phaseQualifiedApplicants.filter(app => {
      // Status tab filter
      if (statusFilter === 'mine' && app.currentHandler !== currentUserName) return false;
      if (statusFilter === 'unassigned' && app.currentHandler && app.currentHandler !== 'Unassigned' && app.currentHandler !== 'Unassigned Pool') return false;
      if (statusFilter === 'ready' && app.status !== 'Ready for Deployment') return false;
      if (statusFilter === 'deployed' && app.status !== 'Deployed' && app.phase !== 6) return false;
      if (statusFilter === 'provisional' && app.status !== 'Provisional') return false;
      if (statusFilter === 'pending') {
        if (app.status === 'Ready for Deployment' || app.status === 'Deployed' || app.status === 'Provisional' || app.phase === 6) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (app.name || '').toLowerCase().includes(q);
        const matchesCode = (app.applicantCode || app.id || '').toLowerCase().includes(q);
        const matchesRole = (app.role || '').toLowerCase().includes(q);
        const matchesJobOrder = (app.jobOrder || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesRole && !matchesJobOrder) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'newest') return parseInt(String(b.id), 10) - parseInt(String(a.id), 10);
      return 0;
    });
  }, [phaseQualifiedApplicants, statusFilter, searchQuery, sortBy, currentUserName]);

  // ── Metrics Counters ──────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const total = phaseQualifiedApplicants.length;
    const ready = phaseQualifiedApplicants.filter(a => a.status === 'Ready for Deployment').length;
    const deployed = phaseQualifiedApplicants.filter(a => a.status === 'Deployed' || a.phase === 6).length;
    const provisional = phaseQualifiedApplicants.filter(a => a.status === 'Provisional').length;
    const pending = total - ready - deployed - provisional;
    const myQueue = phaseQualifiedApplicants.filter(a => a.currentHandler === currentUserName).length;
    return { total, ready, deployed, provisional, pending, myQueue };
  }, [phaseQualifiedApplicants, currentUserName]);

  const isPdf = previewUrl && (
    previewUrl.toLowerCase().includes('.pdf') ||
    previewMime?.toLowerCase().includes('pdf') ||
    previewUrl.includes('/pdf')
  );

  return (
    <div className="space-y-6 w-full pb-16">
      {/* ── 1. Page Title & Action Bar ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
              <ScanText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Document Validation
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                  Phase 5 Admin Gate
                </span>
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Review submitted regulatory requirements, cross-check expiration alerts, and manage predictive deployment.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {onNavigate && (
            <button
              onClick={() => onNavigate('alerts')}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>3-2-1 Compliance Watch</span>
            </button>
          )}
          {onNavigate && (
            <button
              onClick={() => onNavigate('forecast')}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              <TrendingUp className="w-4 h-4 text-[#0EA5E9]" />
              <span>Deployment Timeline</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 2. Summary KPI Metric Counters ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Endorsed Candidates</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{metrics.total}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Under administrative gate</p>
        </div>

        <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-xs bg-gradient-to-br from-white to-amber-50/40">
          <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Pending Verification</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{metrics.pending}</p>
          <p className="text-[11px] text-amber-700 mt-0.5">Documents need review</p>
        </div>

        <div className="bg-white border border-rose-200 rounded-2xl p-4 shadow-xs bg-gradient-to-br from-white to-rose-50/40">
          <p className="text-[11px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-rose-600" /> Provisional
          </p>
          <p className="text-2xl font-black text-rose-600 mt-1">{metrics.provisional}</p>
          <p className="text-[11px] text-rose-700 mt-0.5">Rejected document hold</p>
        </div>

        <div className="bg-white border border-sky-200 rounded-2xl p-4 shadow-xs bg-gradient-to-br from-white to-sky-50/40">
          <p className="text-[11px] font-bold text-sky-700 uppercase tracking-wider">Ready for Deployment</p>
          <p className="text-2xl font-black text-[#0EA5E9] mt-1">{metrics.ready}</p>
          <p className="text-[11px] text-sky-700 mt-0.5">Awaiting DMW schedule</p>
        </div>

        <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-xs bg-gradient-to-br from-white to-emerald-50/40">
          <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Deployed Overseas</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{metrics.deployed}</p>
          <p className="text-[11px] text-emerald-700 mt-0.5">Alert tracking stopped</p>
        </div>

        <div className="bg-white border border-violet-200 rounded-2xl p-4 shadow-xs bg-gradient-to-br from-white to-violet-50/40 col-span-2 sm:col-span-1">
          <p className="text-[11px] font-bold text-violet-700 uppercase tracking-wider">My Queue</p>
          <p className="text-2xl font-black text-violet-700 mt-1">{metrics.myQueue}</p>
          <p className="text-[11px] text-violet-600 mt-0.5">Assigned to {currentUserName}</p>
        </div>
      </div>

      {/* ── 3. Filters & Search Controls Bar ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          {/* Status Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
            {[
              { key: 'all', label: `All (${metrics.total})` },
              { key: 'pending', label: `Pending Validation (${metrics.pending})` },
              { key: 'provisional', label: `Provisional (${metrics.provisional})` },
              { key: 'ready', label: `Ready for Deployment (${metrics.ready})` },
              { key: 'deployed', label: `Deployed (${metrics.deployed})` },
              { key: 'mine', label: `My Queue (${metrics.myQueue})` },
              { key: 'unassigned', label: 'Unassigned Pool' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === tab.key
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Sort */}
          <div className="flex items-center gap-2.5 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search candidate or ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
              />
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="text-xs border border-slate-300 rounded-xl px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="name">Name (A-Z)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Candidate Cards Grid (Applicant List UI Style) ── */}
      {filteredApplicants.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
          <FileCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">No Administrative Candidates Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            Applicants endorsed for administrative processing in Endorsement Tracker will automatically appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredApplicants.map(app => {
            const isClaimedByMe = app.currentHandler === currentUserName;
            const isUnassigned = !app.currentHandler || app.currentHandler === 'Unassigned' || app.currentHandler === 'Unassigned Pool';
            const isReady = app.status === 'Ready for Deployment';
            const isDeployed = app.status === 'Deployed' || app.phase === 6;

            // Requirements progress calculation
            const reqList: any[] = app.requirements || [];
            const totalReqs = reqList.length > 0 ? reqList.length : 6;
            const verifiedReqs = reqList.filter(r => String(r.status || '').toUpperCase() === 'VERIFIED').length;
            const progressPercent = Math.min(100, Math.round((verifiedReqs / (totalReqs || 1)) * 100));

            return (
              <div
                key={app.id}
                onClick={() => handleOpenApplicantModal(app)}
                className="group relative flex flex-col bg-white rounded-2xl border border-slate-200 hover:border-sky-300 hover:shadow-xl transition-all duration-200 cursor-pointer overflow-hidden"
              >
                {/* Top Ambient Highlight */}
                <div
                  className={`h-1.5 w-full ${
                    isDeployed
                      ? 'bg-emerald-500'
                      : isReady
                      ? 'bg-[#0EA5E9]'
                      : app.status === 'Provisional'
                      ? 'bg-rose-500'
                      : 'bg-amber-400'
                  }`}
                />

                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Header: Avatar, Name & Code */}
                    <div className="flex items-start gap-3">
                      <div className="relative flex-shrink-0">
                        {app.photoDataUrl || app.photo ? (
                          <img
                            src={app.photoDataUrl || app.photo}
                            alt={app.name}
                            className="w-12 h-12 rounded-full object-cover border border-slate-200 shadow-xs"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center font-bold text-slate-600 text-sm border border-slate-200 shadow-xs">
                            {app.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        {isDeployed && (
                          <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-slate-900 text-sm truncate group-hover:text-[#0EA5E9] transition-colors">
                          {app.name}
                        </p>
                        <p className="text-xs font-semibold text-slate-500 truncate mt-0.5">
                          {app.role || 'Applicant'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {app.applicantCode || `APP-${app.id}`}
                          </span>
                          {app.jobOrder && (
                            <span className="text-[10px] font-bold text-slate-400 truncate max-w-[100px]">
                              {app.jobOrder}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex flex-wrap gap-1.5 mt-3.5">
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                          isDeployed
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isReady
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : app.status === 'Provisional'
                            ? 'bg-rose-50 text-rose-700 border-rose-200 flex items-center gap-1'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {app.status === 'Provisional' && <AlertTriangle className="w-2.5 h-2.5 text-rose-600 inline" />}
                        {app.status || 'Endorsed for Admin'}
                      </span>

                      {/* Actual Deployment Date pill if exists */}
                      {app.actualDeploymentDate && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                          <Plane className="w-3 h-3 text-[#0EA5E9]" />
                          {app.actualDeploymentDate}
                        </span>
                      )}
                    </div>

                    {/* Requirements Progress Summary */}
                    <div className="mt-4 bg-slate-50/70 border border-slate-100 rounded-xl p-3 space-y-1.5">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-bold text-slate-600">Requirements</span>
                        <span className="font-extrabold text-slate-800">
                          {verifiedReqs > 0 ? `${verifiedReqs} of ${totalReqs} Verified` : 'Pending Validation'}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            progressPercent === 100
                              ? 'bg-emerald-500'
                              : progressPercent > 0
                              ? 'bg-[#0EA5E9]'
                              : 'bg-amber-400'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom: Handler & Actions */}
                  <div className="pt-4 mt-3 border-t border-slate-100 space-y-2.5">
                    {/* Handler Row */}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Handler:</span>
                      <span
                        className={`font-bold truncate max-w-[140px] ${
                          isClaimedByMe
                            ? 'text-violet-700'
                            : isUnassigned
                            ? 'text-slate-400 italic'
                            : 'text-slate-700'
                        }`}
                      >
                        {isUnassigned ? 'Unassigned Pool' : app.currentHandler}
                      </span>
                    </div>

                    {/* Quick Card Action Buttons */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between gap-2">
                        {isUnassigned ? (
                          <button
                            type="button"
                            onClick={e => handleClaim(app, e)}
                            className="bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                            title="Claim applicant into your active queue"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Claim</span>
                          </button>
                        ) : isClaimedByMe ? (
                          <button
                            type="button"
                            onClick={e => handleRelease(app, e)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                            title="Release claim back to pool"
                          >
                            <span>Release</span>
                          </button>
                        ) : (
                          <div className="text-[11px] text-slate-400 font-medium whitespace-nowrap px-1">
                            In staff queue
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenApplicantModal(app)}
                          className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-xs whitespace-nowrap ml-auto"
                        >
                          <span>Verify</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>



                      {/* If Ready for Deployment, show a quick Revert button */}
                      {app.status === 'Ready for Deployment' && (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleRevertReadyForDeployment(app);
                          }}
                          disabled={isSavingDeployment}
                          className="w-full justify-center px-2.5 py-1 text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs whitespace-nowrap"
                          title="Revert candidate status from Ready for Deployment to Administrative Processing"
                        >
                          <Undo2 className="w-3 h-3 text-amber-600" />
                          <span>Revert Ready Status</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 5. Full Document Verification Pop-up Modal ── */}
      {modalApplicant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/90 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-3.5">
                <div className="relative flex-shrink-0">
                  {modalApplicant.photoDataUrl || modalApplicant.photo ? (
                    <img
                      src={modalApplicant.photoDataUrl || modalApplicant.photo}
                      alt={modalApplicant.name}
                      className="w-12 h-12 rounded-full object-cover border border-slate-200 shadow-xs"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center font-bold text-slate-700 text-sm">
                      {modalApplicant.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-black text-slate-900">{modalApplicant.name}</h2>
                    <span className="text-[10px] font-mono font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                      {modalApplicant.applicantCode || `APP-${modalApplicant.id}`}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                        modalApplicant.status === 'Deployed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : modalApplicant.status === 'Ready for Deployment'
                          ? 'bg-sky-50 text-sky-700 border-sky-200'
                          : modalApplicant.status === 'Provisional'
                          ? 'bg-rose-50 text-rose-700 border-rose-200 flex items-center gap-1'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {modalApplicant.status === 'Provisional' && <AlertTriangle className="w-2.5 h-2.5 text-rose-600 inline" />}
                      {modalApplicant.status || 'Endorsed for Admin'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>Role: <strong>{modalApplicant.role || 'N/A'}</strong></span>
                    <span>•</span>
                    <span>DOB: <strong>{modalApplicant.dateOfBirth ? String(modalApplicant.dateOfBirth).split('T')[0] : ((modalApplicant as any).birth_date ? String((modalApplicant as any).birth_date).split('T')[0] : ((modalApplicant as any).birthDate ? String((modalApplicant as any).birthDate).split('T')[0] : 'N/A'))}</strong></span>
                    <span>•</span>
                    <span>Gender: <strong>{modalApplicant.sex || 'Not Specified'}</strong></span>
                    <span>•</span>
                    <span>Contact: <strong>{modalApplicant.contact || modalApplicant.email || 'N/A'}</strong></span>
                  </p>
                </div>
              </div>

              {/* Header Right Actions */}
              <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                {/* Handler Claim/Release */}
                {(!modalApplicant.currentHandler || modalApplicant.currentHandler === 'Unassigned' || modalApplicant.currentHandler === 'Unassigned Pool') ? (
                  <button
                    onClick={() => handleClaim(modalApplicant)}
                    className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors whitespace-nowrap flex-shrink-0"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Claim Candidate</span>
                  </button>
                ) : modalApplicant.currentHandler === currentUserName ? (
                  <button
                    onClick={() => handleRelease(modalApplicant)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap flex-shrink-0"
                  >
                    <span>Release Claim</span>
                  </button>
                ) : (
                  <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-xl font-bold whitespace-nowrap flex-shrink-0">
                    Handler: {modalApplicant.currentHandler}
                  </span>
                )}

                {/* Revert Deployment Status if Ready for Deployment */}
                {modalApplicant.status === 'Ready for Deployment' && (
                  <button
                    type="button"
                    onClick={() => handleRevertReadyForDeployment()}
                    disabled={isSavingDeployment}
                    className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs disabled:opacity-50 whitespace-nowrap flex-shrink-0"
                    title="Revert candidate status from Ready for Deployment to Administrative Processing"
                  >
                    <Undo2 className="w-3.5 h-3.5 text-amber-700" />
                    <span>Revert Deployment</span>
                  </button>
                )}

                {/* Revert to Pre-Deployment Processing */}
                {modalApplicant.status !== 'Deployed' && modalApplicant.status !== 'Ready for Deployment' && (
                  <button
                    type="button"
                    onClick={() => handleOpenRevertToPreDeployment(modalApplicant)}
                    className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs whitespace-nowrap flex-shrink-0"
                    title="Revert endorsement back to Pre-Deployment Processing in Endorsement Tracker"
                  >
                    <Undo2 className="w-3.5 h-3.5 text-amber-700" />
                    <span>Revert to Pre-Deployment</span>
                  </button>
                )}

                {/* Close Modal */}
                <button
                  onClick={handleCloseApplicantModal}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/80 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Split Pane */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
              {/* ── Left Pane: Requirements List (4 cols) ── */}
              <div className="lg:col-span-4 border-r border-slate-200 bg-white flex flex-col h-full overflow-hidden">
                <div className="p-3.5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <h3 className="font-extrabold text-xs text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-[#0EA5E9]" />
                    <span>Requirements Checklist</span>
                  </h3>
                  <span className="text-xs font-bold text-slate-500">
                    {requirements.filter(r => (r.status || '').toUpperCase() === 'VERIFIED').length} of {requirements.length} Verified
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {isLoadingReqs ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-[#0EA5E9]" />
                      <span className="text-xs font-medium">Loading requirements...</span>
                    </div>
                  ) : requirements.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      No requirement records found for this applicant.
                    </div>
                  ) : (
                    requirements.map(req => {
                      const isSelected = selectedReq?.applicant_req_id === req.applicant_req_id;
                      const isVerified = (req.status || '').toUpperCase() === 'VERIFIED';
                      const isRejected = (req.status || '').toUpperCase() === 'REJECTED';
                      const hasFile = Boolean(req.file_url || req.file_path);
                      const isExpiry = isExpirationTrackedRequirement(req);

                      return (
                        <div
                          key={req.applicant_req_id}
                          onClick={() => handleSelectRequirement(req)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-sky-50/80 border-sky-300 ring-2 ring-[#0EA5E9]/20 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-bold text-xs text-slate-900 leading-snug">
                              {req.requirement?.requirement_name}
                            </p>
                            {isVerified ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            ) : isRejected ? (
                              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                            ) : (
                              <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <span
                              className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${
                                isVerified
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : isRejected
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : hasFile
                                  ? 'bg-sky-50 text-sky-700 border-sky-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {isVerified ? 'VERIFIED' : isRejected ? 'REJECTED' : hasFile ? 'SUBMITTED' : 'PENDING'}
                            </span>

                            {isExpiry && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                {req.expiration_date
                                  ? `Exp: ${req.expiration_date}`
                                  : (getRegisteredExpirationDate(modalApplicant, req)
                                    ? `Exp: ${getRegisteredExpirationDate(modalApplicant, req)}`
                                    : 'Needs Expiration')}
                              </span>
                            )}

                            {req.requirement?.ocr_enabled && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-0.5 ml-auto">
                                <ScanText className="w-2.5 h-2.5" /> AI OCR
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Bottom: Fast Status Advancement Banner */}
                <div className="p-3.5 border-t border-slate-200 bg-slate-50/80 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-slate-700">Deployment Status:</span>
                    <span
                      className={`font-bold ${
                        modalApplicant.status === 'Ready for Deployment'
                          ? 'text-emerald-700 font-extrabold'
                          : modalApplicant.status === 'Provisional'
                          ? 'text-rose-700 font-extrabold flex items-center gap-1'
                          : 'text-[#0EA5E9]'
                      }`}
                    >
                      {modalApplicant.status === 'Provisional' && <AlertTriangle className="w-3.5 h-3.5 text-rose-600 inline" />}
                      {modalApplicant.status || 'Admin Processing'}
                    </span>
                  </div>

                  {/* If candidate has rejected documents, show Provisional warning card */}
                  {requirements.some(r => (r.status || '').toUpperCase() === 'REJECTED' || (r.ocr_validation_status || '').toLowerCase() === 'invalid') && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                        <span>Provisional Hold Active</span>
                      </div>
                      <p className="text-rose-700 leading-snug">
                        One or more requirements are rejected. Candidate is in Provisional status and cannot be deployed until documents are replaced and approved.
                      </p>
                    </div>
                  )}

                  {modalApplicant.status === 'Ready for Deployment' ? (
                    <button
                      onClick={() => handleRevertReadyForDeployment()}
                      disabled={isSavingDeployment}
                      className="w-full bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                      title="Revert candidate status from Ready for Deployment to Administrative Processing"
                    >
                      {isSavingDeployment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5 text-amber-700" />}
                      <span>Revert from Ready for Deployment</span>
                    </button>
                  ) : modalApplicant.status !== 'Deployed' ? (
                    <button
                      onClick={handlePromoteToReadyForDeployment}
                      disabled={isSavingDeployment}
                      className={`w-full py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 ${
                        requirements.some(r => (r.status || '').toUpperCase() === 'REJECTED' || (r.ocr_validation_status || '').toLowerCase() === 'invalid')
                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                          : 'bg-[#0EA5E9] hover:bg-[#0284C7] text-white'
                      }`}
                    >
                      {isSavingDeployment ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : requirements.some(r => (r.status || '').toUpperCase() === 'REJECTED' || (r.ocr_validation_status || '').toLowerCase() === 'invalid') ? (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {requirements.some(r => (r.status || '').toUpperCase() === 'REJECTED' || (r.ocr_validation_status || '').toLowerCase() === 'invalid')
                          ? 'Enforce Provisional Status'
                          : 'Mark Ready for Deployment'}
                      </span>
                    </button>
                  ) : null}
                </div>
              </div>

              {/* ── Right Pane: Document Review & Verification Center (8 cols) ── */}
              <div className="lg:col-span-8 flex flex-col h-full overflow-hidden bg-slate-50/40">
                {selectedReq ? (
                  <div className="flex-1 flex flex-col h-full overflow-hidden">
                    {/* Sub-header for selected document */}
                    <div className="p-3 px-5 border-b border-slate-200 bg-white flex justify-between items-center gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-sm text-slate-900">
                            {selectedReq.requirement.requirement_name}
                          </h3>
                          {ocrScannedFileName && (
                            <span className="text-[10px] bg-sky-100 text-sky-800 border border-sky-300 font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-[#0EA5E9]" />
                              Gemini Preview: {ocrScannedFileName}
                              <button
                                type="button"
                                onClick={() => {
                                  setOcrScannedFileName(null);
                                  handleSelectRequirement(selectedReq);
                                }}
                                className="ml-1 hover:text-rose-600 cursor-pointer font-bold"
                                title="Clear ephemeral scan preview"
                              >
                                ×
                              </button>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Category: {selectedReq.requirement.category || 'Regulatory'} • Status:{' '}
                          <span className="font-bold text-slate-700">{selectedReq.status || 'PENDING'}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Zoom & Rotation controls for image preview */}
                        {previewUrl && !isPdf && (
                          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <button
                              type="button"
                              onClick={() => setImageZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))}
                              className="p-1 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                              title="Zoom In"
                            >
                              <ZoomIn className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[10px] font-mono font-bold text-slate-600 px-1">
                              {Math.round(imageZoom * 100)}%
                            </span>
                            <button
                              type="button"
                              onClick={() => setImageZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                              className="p-1 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                              title="Zoom Out"
                            >
                              <ZoomOut className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setImageRotation(r => (r + 90) % 360)}
                              className="p-1 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors cursor-pointer ml-1"
                              title="Rotate 90°"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                            </button>
                            {(imageZoom !== 1 || imageRotation !== 0) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setImageZoom(1);
                                  setImageRotation(0);
                                }}
                                className="text-[10px] font-bold text-sky-600 hover:text-sky-800 px-1.5 py-0.5 rounded hover:bg-white transition-colors cursor-pointer"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        )}


                        {/* Remove File */}
                        {previewUrl && (
                          <button
                            type="button"
                            onClick={() => setShowDeleteModal(true)}
                            disabled={isProcessing}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Remove</span>
                          </button>
                        )}

                        {/* Open in Full View */}
                        {previewUrl && (
                          <a
                            href={previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-sky-700 hover:text-sky-800 bg-sky-50 px-2.5 py-1.5 rounded-xl flex items-center gap-1 border border-sky-200"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Full View
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Split content: Document Viewer & Decision Form */}
                    <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12">
                      {/* Left: Document Viewer (7 cols) */}
                      <div className="md:col-span-7 border-r border-slate-200 bg-slate-100 p-3 flex items-center justify-center overflow-hidden relative">
                        {isProcessing ? (
                          <div className="flex flex-col items-center justify-center text-slate-500 gap-2">
                            <Loader2 className="w-6 h-6 animate-spin text-[#0EA5E9]" />
                            <span className="text-xs font-medium">Processing document...</span>
                          </div>
                        ) : previewUrl ? (
                          isPdf ? (
                            <div className="w-full h-full flex flex-col rounded-xl overflow-hidden bg-white shadow-xs">
                              <object
                                data={`${previewUrl}#toolbar=0&navpanes=0`}
                                type="application/pdf"
                                className="w-full flex-1 border-0"
                              >
                                <iframe
                                  src={`${previewUrl}#toolbar=0&navpanes=0`}
                                  className="w-full h-full border-0"
                                  title="Document PDF Preview"
                                />
                              </object>
                              <div className="p-2 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[11px] px-3">
                                <span className="text-slate-500 font-medium">PDF Document Preview</span>
                                <a
                                  href={previewUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#0EA5E9] hover:underline font-bold flex items-center gap-1"
                                >
                                  <ExternalLink className="w-3 h-3" /> Open in full window
                                </a>
                              </div>
                            </div>
                          ) : imageError ? (
                            <div className="flex flex-col items-center justify-center p-6 text-center gap-3 bg-white rounded-2xl border border-slate-200 max-w-sm shadow-xs">
                              <AlertTriangle className="w-8 h-8 text-amber-500" />
                              <div>
                                <p className="text-xs font-bold text-slate-800">Inline Preview Blocked</p>
                                <p className="text-[11px] text-slate-500 mt-1">
                                  The document image cannot be rendered directly in the iframe sandbox. You can open it securely in a new browser window.
                                </p>
                              </div>
                              <a
                                href={previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" /> Open Document in New Tab
                              </a>
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
                              <img
                                src={previewUrl}
                                alt="Preview"
                                onError={() => setImageError(true)}
                                style={{
                                  transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                                  transformOrigin: 'center center',
                                  transition: 'transform 0.15s ease',
                                }}
                                className="max-w-full max-h-full object-contain rounded-xl shadow-xs"
                              />
                            </div>
                          )
                        ) : (
                          <div className="w-full h-full overflow-y-auto p-4 sm:p-5 bg-slate-50/70">
                            <div className="max-w-xl mx-auto space-y-3.5">
                              {/* Manual Physical Inspection Banner */}
                              <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl p-3.5 shadow-2xs">
                                <div className="flex items-start gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                                    <ClipboardCheck className="w-5 h-5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h3 className="text-sm font-black text-slate-900">
                                        Manual Physical Document Cross-Check
                                      </h3>
                                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                                        Paper Inspection
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                      No digital scan uploaded. Inspect the physical document in hand and cross-check against the applicant's official records below.
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Target Requirement Being Verified */}
                              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2.5">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5 text-sky-600" />
                                    Target Requirement
                                  </span>
                                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                    selectedReq.status === 'VERIFIED'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : selectedReq.status === 'REJECTED'
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}>
                                    Status: {selectedReq.status || 'PENDING'}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-xs">
                                  <div>
                                    <span className="text-slate-400 block font-medium">Requirement Name:</span>
                                    <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">
                                      {selectedReq.requirement.requirement_name}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block font-medium">Category:</span>
                                    <span className="font-bold text-slate-700 mt-0.5 block">
                                      {selectedReq.requirement.category || 'REGULATORY / DEPLOYMENT'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block font-medium">Registered Expiration:</span>
                                    <span className="font-mono font-bold text-slate-800 mt-0.5 block">
                                      {getRegisteredExpirationDate(modalApplicant, selectedReq) || 'No registered date'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block font-medium">Audit Guidance:</span>
                                    <span className="text-slate-600 font-medium mt-0.5 block">
                                      Inspect physical seal, printed name & validity
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Candidate Official Registration Profile */}
                              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-slate-500" />
                                    Candidate Registration Profile
                                  </span>
                                  <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                    {modalApplicant.applicantCode || `APP-${modalApplicant.id}`}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-xs">
                                  <div className="col-span-2 sm:col-span-1">
                                    <span className="text-slate-400 block font-medium">Full Legal Name:</span>
                                    <span className="font-black text-slate-900 text-sm mt-0.5 block">
                                      {modalApplicant.name}
                                    </span>
                                  </div>
                                  <div className="col-span-2 sm:col-span-1">
                                    <span className="text-slate-400 block font-medium">Applied Job Role:</span>
                                    <span className="font-bold text-slate-800 mt-0.5 block">
                                      {modalApplicant.role || (modalApplicant as any).applied_role || 'General Overseas Worker'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block font-medium">Date of Birth:</span>
                                    <span className="font-semibold text-slate-800 font-mono mt-0.5 block">
                                      {(() => {
                                        const dobRaw = modalApplicant.dateOfBirth || (modalApplicant as any).birth_date || (modalApplicant as any).birthDate || (modalApplicant as any).date_of_birth;
                                        if (!dobRaw) return 'Not recorded';
                                        return String(dobRaw).split('T')[0];
                                      })()}
                                      {modalApplicant.age ? ` (${modalApplicant.age} yrs)` : ''}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block font-medium">Gender / Sex:</span>
                                    <span className="font-semibold text-slate-800 mt-0.5 block">
                                      {modalApplicant.sex || (modalApplicant as any).gender || 'Not specified'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block font-medium">Civil Status:</span>
                                    <span className="font-semibold text-slate-800 mt-0.5 block">
                                      {(modalApplicant as any).civilStatus || (modalApplicant as any).civil_status || 'Single / Not specified'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block font-medium">Contact Number:</span>
                                    <span className="font-mono font-semibold text-slate-800 mt-0.5 block">
                                      {modalApplicant.contact || (modalApplicant as any).phone || 'N/A'}
                                    </span>
                                  </div>
                                  <div className="col-span-2">
                                    <span className="text-slate-400 block font-medium">Registered Address:</span>
                                    <span className="font-semibold text-slate-800 mt-0.5 block">
                                      {(modalApplicant as any).address || (modalApplicant as any).permanentAddress || 'Philippine Registered Address'}
                                    </span>
                                  </div>
                                  {((modalApplicant as any).passportNumber || (modalApplicant as any).passport_number) && (
                                    <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                                      <span className="text-slate-400 text-[10px] block font-bold uppercase tracking-wider">
                                        Passport Number on File:
                                      </span>
                                      <span className="font-mono font-black text-sky-800 text-xs mt-0.5 block">
                                        {(modalApplicant as any).passportNumber || (modalApplicant as any).passport_number}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Manual Inspection Audit Steps */}
                              <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 text-xs text-amber-950 space-y-1.5">
                                <p className="font-extrabold flex items-center gap-1.5 text-amber-900">
                                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                  Manual Physical Verification Steps
                                </p>
                                <ol className="list-decimal pl-4 space-y-1 text-[11px] text-amber-900">
                                  <li>Check that candidate name and birth date match the physical document in hand.</li>
                                  <li>Inspect issuing authority, dry seal, and expiration validity.</li>
                                  <li>Enter the verified expiration date and remarks in the right panel and click <strong>Approve & Verify</strong>.</li>
                                </ol>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right: Verification Center & Cross-Check (5 cols) */}
                      <div className="md:col-span-5 p-4 overflow-y-auto space-y-4 bg-white flex flex-col justify-between">
                        <div className="space-y-4">
                          {/* ── Expiration Date Input & Cross-Check ── */}
                          {isExpirationTrackedRequirement(selectedReq) && (() => {
                            const registeredDate = getRegisteredExpirationDate(modalApplicant, selectedReq);
                            const hasMismatch = Boolean(
                              registeredDate &&
                              typedExpirationDate &&
                              registeredDate !== typedExpirationDate
                            );

                            return (
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4 text-[#0EA5E9]" />
                                    <span>Verified Expiration Date</span>
                                  </label>
                                  <span className="text-[10px] uppercase font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                                    3-2-1 Tracked
                                  </span>
                                </div>

                                <input
                                  type="date"
                                  value={typedExpirationDate}
                                  onChange={e => {
                                    setTypedExpirationDate(e.target.value);
                                    setOfficialDateUpdated(false);
                                  }}
                                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] font-medium"
                                />

                                {/* Cross-check comparison against registration */}
                                {registeredDate && (
                                  <div className="pt-1 space-y-2">
                                    <div className="flex justify-between items-center text-[11px]">
                                      <span className="text-slate-500 font-medium">Registered in profile:</span>
                                      <span className="font-bold text-slate-800 font-mono">{registeredDate}</span>
                                    </div>

                                    {hasMismatch ? (
                                      <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 space-y-2">
                                        <div className="flex items-start gap-1.5 font-bold text-[11px]">
                                          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                          <span>Date Mismatch: Document ({typedExpirationDate}) vs Profile ({registeredDate})</span>
                                        </div>
                                        <p className="text-[11px] text-amber-800">
                                          Do you want to override the candidate's official profile record with this verified date?
                                        </p>

                                        <div className="flex gap-1.5 pt-0.5">
                                          <button
                                            type="button"
                                            onClick={handleUpdateOfficialRegistrationDate}
                                            disabled={isProcessing}
                                            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-1.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                                          >
                                            <Check className="w-3.5 h-3.5" />
                                            <span>Override Profile</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              setTypedExpirationDate(registeredDate);
                                              showToast(`Kept registered profile date (${registeredDate}).`);
                                            }}
                                            className="flex-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 py-1.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                          >
                                            <span>Keep Profile Date</span>
                                          </button>
                                        </div>
                                      </div>
                                    ) : typedExpirationDate ? (
                                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2 text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                        <span>Expiration date matches registration record!</span>
                                      </div>
                                    ) : null}

                                    {officialDateUpdated && (
                                      <div className="rounded-xl bg-sky-50 border border-sky-200 p-2 text-[10px] font-bold text-sky-800 flex items-center gap-1.5">
                                        <CheckCircle className="w-3.5 h-3.5 text-sky-600" />
                                        <span>Official profile record successfully updated with document date.</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* ── Optional Ephemeral AI OCR Assistant ── */}
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-[#0EA5E9]" />
                                <span>AI OCR Assistant</span>
                              </h4>
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                ⚡ Powered by Google Gemini Vision AI
                              </span>
                            </div>

                            <label className="w-full border-2 border-dashed border-slate-300 hover:border-sky-400 bg-white rounded-xl p-2.5 text-center flex items-center justify-center gap-2 cursor-pointer transition-colors group">
                              <Upload className="w-4 h-4 text-slate-400 group-hover:text-[#0EA5E9]" />
                              <span className="text-xs font-bold text-slate-600 group-hover:text-[#0EA5E9]">
                                {isOcrProcessing ? 'Extracting with Gemini Vision...' : 'Scan Document (Temporary)'}
                              </span>
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*,application/pdf"
                                onChange={handleOptionalOcrUpload}
                                disabled={isOcrProcessing}
                              />
                            </label>

                            {/* OCR Ephemeral Result Display */}
                            {ocrEphemeralResult && (
                              <div className="pt-2 space-y-2 border-t border-slate-200">
                                {/* Document Type Mismatch Alert */}
                                {ocrEphemeralResult.mismatchAlert && (
                                  <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3 text-red-900 space-y-2 animate-in fade-in">
                                    <div className="flex items-center gap-1.5 font-black text-xs text-red-700">
                                      <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 animate-bounce" />
                                      <span>DOCUMENT MISMATCH DETECTED</span>
                                    </div>
                                    <p className="text-[11px] text-red-800 leading-relaxed font-semibold">
                                      {ocrEphemeralResult.mismatchAlert.detail}
                                    </p>
                                    <div className="bg-white/90 border border-red-200 rounded-lg p-2 text-[10.5px] space-y-1">
                                      <div className="flex justify-between items-center">
                                        <span className="text-slate-500 font-medium">Expected Requirement:</span>
                                        <span className="font-extrabold text-slate-800">{ocrEphemeralResult.mismatchAlert.expectedName}</span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-slate-500 font-medium">Uploaded Document Type:</span>
                                        <span className="font-extrabold text-red-700">{ocrEphemeralResult.mismatchAlert.detectedName}</span>
                                      </div>
                                    </div>
                                    <p className="text-[10px] text-red-600 italic">
                                      Please recheck physical document or scan the matching file for this requirement.
                                    </p>
                                  </div>
                                )}
                                {ocrEphemeralResult.discrepancies && ocrEphemeralResult.discrepancies.length > 0 ? (
                                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-xs text-rose-800 space-y-1">
                                    <p className="font-extrabold flex items-center gap-1 text-[11px]">
                                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                      <span>Discrepancies Detected</span>
                                    </p>
                                    <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                                      {ocrEphemeralResult.discrepancies.map((d, i) => (
                                        <li key={i}>{d.issue}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : (
                                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    <span>All extracted fields match candidate profile!</span>
                                  </div>
                                )}

                                {ocrEphemeralResult.extracted_data && (() => {
                                  const exp =
                                    ocrEphemeralResult.extracted_data.expiration_date ||
                                    ocrEphemeralResult.extracted_data.expiry_date ||
                                    ocrEphemeralResult.extracted_data.date_of_expiry;

                                  if (!exp) return null;

                                  const hasCurrentValue = Boolean(typedExpirationDate);
                                  const isDifferent = typedExpirationDate && typedExpirationDate !== exp;

                                  return (
                                    <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                          <Calendar className="w-3.5 h-3.5 text-[#0EA5E9]" />
                                          <span>Extracted Expiration Date</span>
                                        </span>
                                        <span className="text-xs font-mono font-black text-sky-800 bg-white px-2 py-0.5 rounded border border-sky-200">
                                          {exp}
                                        </span>
                                      </div>

                                      <p className="text-[11px] text-slate-600 leading-snug">
                                        {isDifferent
                                          ? `Current entered date is "${typedExpirationDate}". Would you like to accept and override it with "${exp}"?`
                                          : hasCurrentValue
                                          ? `Extracted date matches currently entered date (${exp}).`
                                          : `Would you like to accept "${exp}" as the verified expiration date?`}
                                      </p>

                                      {(!hasCurrentValue || isDifferent) && (
                                        <div className="flex gap-1.5 pt-0.5">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setTypedExpirationDate(exp);
                                              setOfficialDateUpdated(false);
                                              showToast(`✓ Accepted & populated expiration date (${exp}).`);
                                            }}
                                            className="flex-1 bg-[#0EA5E9] hover:bg-[#0284C7] text-white py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                                          >
                                            <Check className="w-3.5 h-3.5" />
                                            <span>{isDifferent ? 'Accept & Override' : 'Accept Date'}</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              showToast('Extracted date declined. Kept current value.');
                                            }}
                                            className="flex-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                            <span>Decline / Keep</span>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>

                          {/* Auditor Remarks */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Auditor Remarks / Justification
                            </label>
                            <input
                              type="text"
                              placeholder="Notes on requirement verification..."
                              value={manualRemarks}
                              onChange={e => setManualRemarks(e.target.value)}
                              className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                            />
                          </div>
                        </div>

                        {/* Approve / Reject Actions */}
                        <div className="flex gap-2 pt-4 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleVerifyDecision('VERIFIED')}
                            disabled={isProcessing}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 rounded-xl text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                            <span>Approve & Verify</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleVerifyDecision('REJECTED')}
                            disabled={isProcessing}
                            className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-2.5 rounded-xl text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <X className="w-4 h-4" />
                            <span>Reject Document</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ── 6. Predictive Forecasting Timeline & Actual Deployment Section ── */}
                    <div className="border-t border-slate-200 bg-white p-4 px-5">
                      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                        {/* Timeline forecast metrics */}
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-sky-100 text-[#0EA5E9] flex items-center justify-center">
                              <TrendingUp className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                                Predictive Deployment ETA
                              </p>
                              <p className="text-xs font-black text-slate-800">
                                {forecastData?.record?.estimated_deployment_date ||
                                  modalApplicant.predictedDeploymentDate ||
                                  'Estimated 14–21 Days'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                              <Clock className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                                Remaining Lead Time
                              </p>
                              <p className="text-xs font-black text-slate-800">
                                {forecastData?.record?.estimated_remaining_days != null
                                  ? `${forecastData.record.estimated_remaining_days} Days`
                                  : '18 Days (DMW Processing)'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Actual Deployment Date Encoding from DMW */}
                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full lg:w-auto">
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <Plane className="w-4 h-4 text-[#0EA5E9]" />
                            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                              Actual Deployment Date:
                            </span>
                          </div>
                          <input
                            type="date"
                            value={actualDeploymentInput}
                            onChange={e => setActualDeploymentInput(e.target.value)}
                            className="text-xs border border-slate-300 rounded-xl px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] font-medium"
                          />
                          <button
                            type="button"
                            onClick={handleSaveActualDeploymentDate}
                            disabled={isSavingDeployment || !actualDeploymentInput}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-xs disabled:opacity-50 whitespace-nowrap flex-shrink-0"
                          >
                            {isSavingDeployment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            <span>Save Actual Date</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
                    <FileCheck className="w-10 h-10 text-slate-300 mb-2" />
                    <span>Select a requirement from the left checklist to inspect and verify</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. Return to Workflow Stage Confirmation Modal ── */}
      {returnModalApplicant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className={`p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between ${returnTargetKey === 'pre_deployment' ? 'bg-amber-50/70' : 'bg-rose-50/70'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${returnTargetKey === 'pre_deployment' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-600'}`}>
                  <Undo2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {returnTargetKey === 'pre_deployment' ? 'Revert to Pre-Deployment Processing' : 'Return to Workflow Stage'}
                  </h3>
                  <p className="text-[11px] text-slate-500">Applicant: {returnModalApplicant.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReturnModalApplicant(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Select Target Stage</label>
                <select
                  value={returnTargetKey}
                  onChange={e => setReturnTargetKey(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                >
                  {RETURN_STAGE_OPTIONS.map(opt => (
                    <option key={opt.key} value={opt.key}>
                      {opt.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {RETURN_STAGE_OPTIONS.find(o => o.key === returnTargetKey)?.desc}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Justification Reason / Remarks <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Specify why documents are invalid or need stage revision..."
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                />
              </div>

              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  The applicant will exit Document Validation, handler will be reset to Unassigned Pool, and an audit trail entry will be recorded.
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setReturnModalApplicant(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReturnStage}
                disabled={isReturning || returnReason.trim().length < 5}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 ${returnTargetKey === 'pre_deployment' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700'}`}
              >
                {isReturning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                <span>{returnTargetKey === 'pre_deployment' ? 'Confirm Revert' : 'Confirm Return'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. Delete File Confirmation Modal ── */}
      {showDeleteModal && selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 flex-shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Remove Uploaded File</h3>
                  <p className="text-[11px] text-slate-500">{selectedReq.requirement.requirement_name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-700 leading-relaxed">
                Are you sure you want to delete the file for{' '}
                <strong>{selectedReq.requirement.requirement_name}</strong>?
              </p>
              <p className="text-[11px] text-slate-500">
                The file will be removed from secure cloud storage and the status reset to PENDING.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveFile}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Yes, Remove File</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
