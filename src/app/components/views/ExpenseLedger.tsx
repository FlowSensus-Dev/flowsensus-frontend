import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Receipt, Plus, Download, ArrowLeft, Search, Filter, 
  X, Edit2, Trash2, ShieldCheck, AlertCircle, FileText, CheckCircle2, 
  Clock, DollarSign, UserCheck, Shield, Sparkles, ChevronRight,
  HelpCircle, Eye, AlertTriangle, PenTool, RotateCcw, Building2, 
  BadgeCheck, FileSignature, Check
} from 'lucide-react';
import { WorkflowState, ExpenseRecord, ActivityLog, ApplicantRecord } from '../../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { api } from '../../../lib/api';

interface ExpenseLedgerProps {
  workflow?: WorkflowState;
  expenses?: ExpenseRecord[];
  addExpense: (expense: Omit<ExpenseRecord, 'id'>) => Promise<void> | void;
  updateExpense?: (id: string, updates: Partial<ExpenseRecord>) => Promise<void> | void;
  deleteExpense?: (id: string) => Promise<void> | void;
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  showToast: (message: string) => void;
  selectedApplicantId?: string;
  applicants?: ApplicantRecord[];
  onViewApplicant?: (id: string) => void;
  onSelectApplicant?: (id: string) => void;
}

// DMW / POEA Regulatory lists
const ZERO_FEE_COUNTRIES = [
  'saudi arabia', 'qatar', 'united arab emirates', 'uae', 'dubai', 'abu dhabi',
  'united kingdom', 'uk', 'great britain', 'canada', 'israel', 'netherlands', 'switzerland'
];

const EXEMPT_POSITIONS = [
  'domestic', 'household', 'hsw', 'maid', 'caregiver', 'care worker', 'seafarer', 'seaman', 'marine'
];

type LedgerTab = 'all' | 'worker_docs' | 'employer_covered' | 'placement' | 'advances';

export default function ExpenseLedger({
  expenses = [],
  addExpense,
  updateExpense,
  deleteExpense,
  currentUserName,
  addActivityLog,
  showToast,
  selectedApplicantId,
  applicants = [],
  onViewApplicant,
  onSelectApplicant,
}: ExpenseLedgerProps) {
  // Local state for active candidate selection — ALWAYS defaults to null so directory list displays first!
  const [activeApplicantId, setActiveApplicantId] = useState<string | null>(null);

  // Search & Filter state for the Applicant Directory view
  const [searchTerm, setSearchTerm] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('All');

  // Ledger filter tab
  const [activeTab, setActiveTab] = useState<LedgerTab>('all');

  // Dismissed smart recommendation keys for this session
  const [dismissedRecommendations, setDismissedRecommendations] = useState<Set<string>>(new Set());

  // Delete confirmation modal state
  const [deletingExpense, setDeletingExpense] = useState<ExpenseRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Candidate Ledgers Directory Summary
  const applicantLedgers = useMemo(() => {
    return applicants.map(app => {
      const appExpenses = expenses.filter(e => String(e.applicantId) === String(app.id));
      const totalPeso = appExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      return {
        ...app,
        expenseCount: appExpenses.length,
        totalPeso,
      };
    }).filter(app => {
      const name = (app.name || `${app.firstName || ''} ${app.lastName || ''}`).toLowerCase();
      const code = (app.applicantCode || '').toLowerCase();
      const role = (app.appliedPosition || app.appliedRole || '').toLowerCase();
      const matchesSearch = name.includes(searchTerm.toLowerCase()) || 
                            code.includes(searchTerm.toLowerCase()) ||
                            role.includes(searchTerm.toLowerCase());
      const matchesPhase =
        phaseFilter === 'All' ||
        String(app.phase) === phaseFilter ||
        (phaseFilter === 'Medical' && (app.phase === 2 || /medical/i.test(app.status))) ||
        (phaseFilter === 'Profiling' && (app.phase === 3 || /profil/i.test(app.status))) ||
        (phaseFilter === 'Endorsement' && (app.phase === 4 || /endorse/i.test(app.status))) ||
        (phaseFilter === 'Deployed' && (app.phase === 6 || /deployed/i.test(app.status)));
      return matchesSearch && matchesPhase;
    }).sort((a, b) => b.totalPeso - a.totalPeso);
  }, [applicants, expenses, searchTerm, phaseFilter]);

  // Modals & Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // Form Fields
  const [categoryType, setCategoryType] = useState<'worker_document' | 'employer_processing' | 'placement_fee' | 'cash_advance' | 'deduction'>('worker_document');
  const [purposeName, setPurposeName] = useState('Medical Examination (Fit-to-Work)');
  const [customPurpose, setCustomPurpose] = useState('');
  const [amountValue, setAmountValue] = useState<number>(1500);
  const [orNumberValue, setOrNumberValue] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [remarksValue, setRemarksValue] = useState('');

  // ──────────────────────────────────────────────────────────────────────────
  // Agency Letterhead & Official Sign-off State (Never "FlowSensus")
  // ──────────────────────────────────────────────────────────────────────────
  const [agencyProfile, setAgencyProfile] = useState<{
    agency_name?: string;
    poea_license_no?: string;
    address?: string;
    phone?: string;
    tin?: string;
  } | null>(null);

  const [showSignModal, setShowSignModal] = useState(false);
  const [soaSignerName, setSoaSignerName] = useState(currentUserName || 'Accounting Officer');
  const [soaSignerTitle, setSoaSignerTitle] = useState('Senior Accounting Officer / Finance Specialist');
  const [soaApproverName, setSoaApproverName] = useState('Atty. Roberto C. Tan');
  const [soaApproverTitle, setSoaApproverTitle] = useState('Managing Director / Agency Head');
  const [soaSignatureMode, setSoaSignatureMode] = useState<'draw' | 'stamp'>('draw');
  const [hasSignatureDrawing, setHasSignatureDrawing] = useState(false);
  const [soaCustomNotes, setSoaCustomNotes] = useState(
    'Payment terms: Salary deduction via authorized foreign employer payroll as per DMW-approved contract.'
  );

  // Editable Agency Letterhead fields
  const [soaAgencyName, setSoaAgencyName] = useState('PACIFIC OVERSEAS RECRUITMENT AGENCY INC.');
  const [soaLicenseNo, setSoaLicenseNo] = useState('DMW-048-LB-031224-R');
  const [soaAgencyAddress, setSoaAgencyAddress] = useState('5th Floor, Corporate Recruitment Center, Ermita, Manila, Philippines');
  const [soaAgencyContact, setSoaAgencyContact] = useState('Tel: +63 (2) 8523-8899 • BIR TIN: 009-842-120-000 NV');

  // Canvas ref and drawing state
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Load Authoritative Agency Profile & Stored Customizations
  useEffect(() => {
    let savedHeader: any = null;
    try {
      const stored = localStorage.getItem('fs_official_agency_soa_header');
      if (stored) {
        savedHeader = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Could not read saved agency header from localStorage:', e);
    }

    api.get('/lookups/agency')
      .then((res) => {
        if (res.data) {
          const profile = {
            agency_name: savedHeader?.agency_name || res.data.agency_name || 'PACIFIC OVERSEAS RECRUITMENT AGENCY INC.',
            poea_license_no: savedHeader?.poea_license_no || res.data.poea_license_no || 'DMW-048-LB-031224-R',
            address: savedHeader?.address || res.data.address || '5th Floor, Corporate Recruitment Center, Ermita, Manila, Philippines',
            phone: savedHeader?.phone || res.data.phone || '+63 (2) 8523-8899',
            tin: savedHeader?.tin || res.data.tin || 'BIR TIN: 009-842-120-000 NV',
          };
          setAgencyProfile(profile);
          setSoaAgencyName(profile.agency_name);
          setSoaLicenseNo(profile.poea_license_no);
          setSoaAgencyAddress(profile.address);
          setSoaAgencyContact(`${profile.phone} • ${profile.tin}`);
        }
      })
      .catch((err) => {
        console.warn('Could not load agency profile from API, using default/saved:', err);
        const fallback = {
          agency_name: savedHeader?.agency_name || 'PACIFIC OVERSEAS RECRUITMENT AGENCY INC.',
          poea_license_no: savedHeader?.poea_license_no || 'DMW-048-LB-031224-R',
          address: savedHeader?.address || '5th Floor, Corporate Recruitment Center, Ermita, Manila, Philippines',
          phone: savedHeader?.phone || '+63 (2) 8523-8899',
          tin: savedHeader?.tin || 'BIR TIN: 009-842-120-000 NV',
        };
        setAgencyProfile(fallback);
        setSoaAgencyName(fallback.agency_name);
        setSoaLicenseNo(fallback.poea_license_no);
        setSoaAgencyAddress(fallback.address);
        setSoaAgencyContact(`${fallback.phone} • ${fallback.tin}`);
      });
  }, []);

  // Selected candidate object
  const activeCandidate = useMemo(() => {
    if (!activeApplicantId) return null;
    return applicants.find(a => String(a.id) === String(activeApplicantId)) || null;
  }, [applicants, activeApplicantId]);

  const candidateDisplayName = activeCandidate
    ? (activeCandidate.name || `${activeCandidate.firstName || ''} ${activeCandidate.lastName || ''}`.trim() || `Candidate #${activeApplicantId}`)
    : 'Selected Candidate';

  // DMW / POEA Compliance check for the active candidate
  const dmwStatus = useMemo(() => {
    if (!activeCandidate) return { isExempt: false, reason: '', salaryCap: null };

    const pos = (activeCandidate.appliedPosition || activeCandidate.appliedRole || '').toLowerCase();
    const isExemptPosition = EXEMPT_POSITIONS.some(p => pos.includes(p));

    const country = (activeCandidate.country || activeCandidate.jobOrder || '').toLowerCase();
    const isZeroFeeCountry = ZERO_FEE_COUNTRIES.some(c => country.includes(c));

    let reason = '';
    if (isExemptPosition) {
      reason = 'Position is exempt under DMW Rules (Domestic Workers, Caregivers, Seafarers cannot be charged placement fees).';
    } else if (isZeroFeeCountry) {
      reason = 'Destination country operates under strict DMW Zero-Placement-Fee policy. All agency costs are borne by the employer.';
    }

    const isExempt = isExemptPosition || isZeroFeeCountry;
    const salaryCap = (activeCandidate as any).monthlySalary || 30000;

    return {
      isExempt,
      reason,
      salaryCap: isExempt ? 0 : salaryCap,
    };
  }, [activeCandidate]);

  // Expenses for the currently selected candidate
  const currentExpenses = useMemo(() => {
    if (!activeApplicantId) return [];
    return expenses.filter(e => String(e.applicantId) === String(activeApplicantId));
  }, [expenses, activeApplicantId]);

  // Smart Recommendations for the current candidate
  const smartRecommendations = useMemo(() => {
    if (!activeCandidate || !activeApplicantId) return [];
    const recs: Array<{
      id: string;
      title: string;
      description: string;
      category: 'worker_document' | 'employer_processing' | 'placement_fee';
      purpose: string;
      defaultAmount: number;
      tag: string;
    }> = [];

    const existingPurposes = currentExpenses.map(e => (e.purpose || '').toLowerCase());

    // 1. Medical Recommendation (Phase 3+)
    const hasMedical = existingPurposes.some(p => p.includes('medical') || p.includes('fit-to-work'));
    if (activeCandidate.phase >= 3 && !hasMedical && !dismissedRecommendations.has(`${activeApplicantId}-medical`)) {
      recs.push({
        id: `${activeApplicantId}-medical`,
        title: 'Medical Clearance Package',
        description: 'Candidate is in Phase 3 (Fit-to-Work). Recommend recording official clinic medical fee.',
        category: 'worker_document',
        purpose: 'Medical Examination (Fit-to-Work)',
        defaultAmount: 1500,
        tag: 'Phase 3 Milestone',
      });
    }

    // 2. Placement Fee Recommendation (Phase 4+ and NOT zero-fee exempt)
    const hasPlacement = existingPurposes.some(p => p.includes('placement'));
    if (activeCandidate.phase >= 4 && !hasPlacement && !dmwStatus.isExempt && !dismissedRecommendations.has(`${activeApplicantId}-placement`)) {
      recs.push({
        id: `${activeApplicantId}-placement`,
        title: 'DMW Regulated Placement Fee',
        description: `Official employment contract signed (Phase 4). Allowable cap: ₱${(dmwStatus.salaryCap || 25000).toLocaleString()}.`,
        category: 'placement_fee',
        purpose: 'DMW Regulated Placement Fee',
        defaultAmount: dmwStatus.salaryCap || 25000,
        tag: 'Phase 4 Contract Signed',
      });
    }

    // 3. Processing Fee Recommendations (Phase 5+)
    const hasOec = existingPurposes.some(p => p.includes('oec'));
    if (activeCandidate.phase >= 5 && !hasOec && !dismissedRecommendations.has(`${activeApplicantId}-oec`)) {
      recs.push({
        id: `${activeApplicantId}-oec`,
        title: 'OEC Deployment Processing',
        description: 'Candidate in deployment processing. Record employer-covered OEC processing fee.',
        category: 'employer_processing',
        purpose: 'OEC Processing Fee',
        defaultAmount: 2500,
        tag: 'Phase 5 Processing',
      });
    }

    const hasPassport = existingPurposes.some(p => p.includes('passport'));
    if (activeCandidate.phase >= 5 && !hasPassport && !dismissedRecommendations.has(`${activeApplicantId}-passport`)) {
      recs.push({
        id: `${activeApplicantId}-passport`,
        title: 'Passport Processing',
        description: 'Record passport authentication or renewal documentation fee for overseas travel.',
        category: 'worker_document',
        purpose: 'Passport Processing & Authentication',
        defaultAmount: 1200,
        tag: 'Phase 5 Passporting',
      });
    }

    return recs;
  }, [activeCandidate, activeApplicantId, currentExpenses, dmwStatus, dismissedRecommendations]);

  // Financial Breakdown calculations in PHP only
  const financialSummary = useMemo(() => {
    let workerPaidDocs = 0;
    let employerCovered = 0;
    let placementFeeTotal = 0;
    let cashAdvances = 0;
    let deductions = 0;

    currentExpenses.forEach(exp => {
      const amt = Number(exp.amount) || 0;
      const purpose = (exp.purpose || '').toLowerCase();
      const type = exp.type || 'expense';

      if (type === 'placement_fee' || purpose.includes('placement fee')) {
        placementFeeTotal += amt;
      } else if (type === 'cash_advance' || purpose.includes('cash advance')) {
        cashAdvances += amt;
      } else if (type === 'deduction' || purpose.includes('deduction')) {
        deductions += amt;
      } else if (
        purpose.includes('visa') || purpose.includes('oec') || 
        purpose.includes('owwa') || purpose.includes('airfare') || 
        purpose.includes('ticket') || purpose.includes('insurance')
      ) {
        employerCovered += amt;
      } else {
        // Personal documents (Medical, Passport, NBI, PSA, TESDA)
        workerPaidDocs += amt;
      }
    });

    const netPayableByWorker = workerPaidDocs + placementFeeTotal + cashAdvances - deductions;

    return {
      workerPaidDocs,
      employerCovered,
      placementFeeTotal,
      cashAdvances,
      deductions,
      netPayableByWorker,
      totalTransactions: currentExpenses.length
    };
  }, [currentExpenses]);

  // Filtered expenses based on active category tab
  const filteredExpenses = useMemo(() => {
    if (activeTab === 'all') return currentExpenses;
    return currentExpenses.filter(exp => {
      const purposeLower = (exp.purpose || '').toLowerCase();
      const isEmployer = purposeLower.includes('visa') || purposeLower.includes('oec') || purposeLower.includes('owwa') || purposeLower.includes('airfare');
      const isPlacement = exp.type === 'placement_fee' || purposeLower.includes('placement');
      const isAdvance = exp.type === 'cash_advance' || exp.type === 'deduction' || purposeLower.includes('advance') || purposeLower.includes('deduction');

      if (activeTab === 'worker_docs') return !isEmployer && !isPlacement && !isAdvance;
      if (activeTab === 'employer_covered') return isEmployer;
      if (activeTab === 'placement') return isPlacement;
      if (activeTab === 'advances') return isAdvance;
      return true;
    });
  }, [currentExpenses, activeTab]);

  // Open modal for new entry
  const handleOpenAddModal = (presetCategory?: any, presetPurpose?: string, presetAmount?: number) => {
    setEditingExpenseId(null);
    setCategoryType(presetCategory || 'worker_document');
    setPurposeName(presetPurpose || 'Medical Examination (Fit-to-Work)');
    setCustomPurpose('');
    setAmountValue(presetAmount !== undefined ? presetAmount : 1500);
    setOrNumberValue('');
    setTransactionDate(new Date().toISOString().split('T')[0]);
    setRemarksValue('');
    setModalError(null);
    setShowAddModal(true);
  };

  // Open modal for editing existing entry
  const handleEditExpense = (expense: ExpenseRecord) => {
    setEditingExpenseId(expense.id);
    const purpose = expense.purpose || 'General';
    setPurposeName(purpose);
    setCustomPurpose('');
    setAmountValue(Number(expense.amount) || 0);
    setOrNumberValue(expense.referenceNo || '');
    setTransactionDate(expense.date || new Date().toISOString().split('T')[0]);
    setRemarksValue(expense.remarks || '');
    setModalError(null);

    if (expense.type === 'placement_fee') {
      setCategoryType('placement_fee');
    } else if (expense.type === 'cash_advance') {
      setCategoryType('cash_advance');
    } else if (expense.type === 'deduction') {
      setCategoryType('deduction');
    } else if (
      purpose.toLowerCase().includes('visa') || 
      purpose.toLowerCase().includes('oec') || 
      purpose.toLowerCase().includes('owwa') || 
      purpose.toLowerCase().includes('airfare')
    ) {
      setCategoryType('employer_processing');
    } else {
      setCategoryType('worker_document');
    }

    setShowAddModal(true);
  };

  // Handle Delete Confirmation
  const handleDeleteConfirm = async () => {
    if (!deletingExpense || isDeleting || !deleteExpense) return;
    setIsDeleting(true);
    try {
      await deleteExpense(deletingExpense.id);
      showToast(`✓ Removed entry: ${deletingExpense.purpose}`);
      addActivityLog({
        applicantId: activeApplicantId || undefined,
        action: 'Financial Record Deleted',
        performedBy: currentUserName,
        department: 'Accounting',
        details: `Deleted ${deletingExpense.purpose} (₱${Number(deletingExpense.amount).toLocaleString()})`,
      });
      setDeletingExpense(null);
    } catch (err: any) {
      showToast(`Error deleting entry: ${err.message || 'Server rejected deletion.'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Submit Add / Edit Form
  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !activeApplicantId) return;

    const finalPurpose = purposeName === 'Other' ? customPurpose.trim() : purposeName;
    if (!finalPurpose) {
      setModalError('Please specify the fee purpose.');
      return;
    }

    if (amountValue <= 0) {
      setModalError('Amount must be greater than ₱0.');
      return;
    }

    // DMW Placement Fee Validation
    if (categoryType === 'placement_fee') {
      if (dmwStatus.isExempt) {
        setModalError(`DMW Policy Violation: Placement fees are prohibited for this applicant. ${dmwStatus.reason}`);
        return;
      }
      if (activeCandidate && typeof activeCandidate.phase === 'number' && activeCandidate.phase < 4) {
        setModalError('DMW Regulatory Violation: Placement fees cannot be collected upfront before contract signing (Phase 4+).');
        return;
      }
      if (dmwStatus.salaryCap && amountValue > dmwStatus.salaryCap) {
        setModalError(`DMW Cap Exceeded: Maximum allowable placement fee is 1 month basic salary (₱${dmwStatus.salaryCap.toLocaleString()}).`);
        return;
      }
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      const expenseData: Omit<ExpenseRecord, 'id'> = {
        applicantId: activeApplicantId,
        purpose: finalPurpose,
        amount: Number(amountValue),
        currency: 'PESO',
        type: categoryType === 'placement_fee' ? 'placement_fee' : (categoryType === 'cash_advance' ? 'cash_advance' : (categoryType === 'deduction' ? 'deduction' : 'expense')),
        referenceNo: orNumberValue.trim() || undefined,
        remarks: remarksValue.trim(),
        status: 'approved',
        date: transactionDate,
        recordedBy: currentUserName || 'Accounting Staff',
      };

      if (editingExpenseId && updateExpense) {
        await updateExpense(editingExpenseId, expenseData);
        showToast(`✓ Transaction updated: ${finalPurpose} (₱${amountValue.toLocaleString()})`);
      } else {
        await addExpense(expenseData);
        showToast(`✓ Transaction recorded: ${finalPurpose} (₱${amountValue.toLocaleString()})`);
      }

      addActivityLog({
        applicantId: activeApplicantId,
        action: editingExpenseId ? 'Financial Record Updated' : 'Financial Record Added',
        performedBy: currentUserName,
        department: 'Accounting',
        details: `₱${amountValue.toLocaleString()} - ${finalPurpose} (Ref: ${orNumberValue || 'None'})`,
      });

      setShowAddModal(false);
    } catch (err: any) {
      setModalError(err?.response?.data?.detail || err.message || 'Failed to save financial transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Canvas Signature Pad Helpers
  // ──────────────────────────────────────────────────────────────────────────
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasSignatureDrawing(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvasSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignatureDrawing(false);
  };

  const handleOpenSignModal = () => {
    if (!activeCandidate) return;
    setSoaSignerName(currentUserName || 'Accounting Officer');
    if (agencyProfile) {
      setSoaAgencyName(agencyProfile.agency_name || 'PACIFIC OVERSEAS RECRUITMENT AGENCY INC.');
      setSoaLicenseNo(agencyProfile.poea_license_no || 'DMW-048-LB-031224-R');
      setSoaAgencyAddress(agencyProfile.address || '5th Floor, Corporate Recruitment Center, Ermita, Manila, Philippines');
      setSoaAgencyContact(`${agencyProfile.phone || '+63 (2) 8523-8899'} • ${agencyProfile.tin || 'BIR TIN: 009-842-120-000 NV'}`);
    }
    setHasSignatureDrawing(false);
    setShowSignModal(true);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Generate Official Statement of Account (SOA) in PHP only
  // Strictly formatted: No text overflow, Real Agency letterhead, Signatures
  // ──────────────────────────────────────────────────────────────────────────
  const generateOfficialSOA = () => {
    if (!activeCandidate) return;

    // Save header customization to localStorage for future use
    try {
      localStorage.setItem('fs_official_agency_soa_header', JSON.stringify({
        agency_name: soaAgencyName,
        poea_license_no: soaLicenseNo,
        address: soaAgencyAddress,
        phone: soaAgencyContact.split('•')[0]?.trim() || '',
        tin: soaAgencyContact.split('•')[1]?.trim() || '',
      }));
    } catch (e) {
      console.warn('Could not persist agency header to localStorage:', e);
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 14;
    const contentWidth = pageWidth - (margin * 2); // exactly 182mm

    // Clean agency strings (strictly purge any 'FlowSensus' to show only the genuine agency name)
    const agencyNameClean = (soaAgencyName.trim() || 'LICENSED OVERSEAS RECRUITMENT AGENCY')
      .replace(/flowsensus\s*/gi, '')
      .trim()
      .toUpperCase();
    const licenseClean = soaLicenseNo.trim() || 'DMW-048-LB-031224-R';
    const addressClean = soaAgencyAddress.trim() || '5th Floor, Corporate Recruitment Center, Manila, Philippines';
    const contactClean = soaAgencyContact.trim() || 'Tel: +63 (2) 8523-8899 • BIR TIN: 009-842-120-000 NV';

    let currentY = 16;

    // ── 1. Agency Letterhead (Formal, Authoritative) ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(agencyNameClean, pageWidth / 2, currentY, { align: 'center' });

    currentY += 4.8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85); // slate-700
    doc.text('LICENSED LANDBASED RECRUITMENT & PLACEMENT AGENCY', pageWidth / 2, currentY, { align: 'center' });

    currentY += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`DMW / POEA License: ${licenseClean} • BIR TIN: 009-842-120-000 NV`, pageWidth / 2, currentY, { align: 'center' });

    currentY += 3.8;
    doc.text(`${addressClean} • ${contactClean}`, pageWidth / 2, currentY, { align: 'center' });

    // Official Double Border Separator
    currentY += 3.8;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.7);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    doc.setLineWidth(0.2);
    doc.line(margin, currentY + 1, pageWidth - margin, currentY + 1);

    // ── 2. Document Title & Control Reference ──
    currentY += 6.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('OFFICIAL STATEMENT OF ACCOUNT (SOA)', pageWidth / 2, currentY, { align: 'center' });

    currentY += 4.2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('ITEMIZED LEDGER OF DOCUMENTATION, STATUTORY PROCESSING & ASSESSED FEES', pageWidth / 2, currentY, { align: 'center' });

    // Reference & Date Box
    const issueDateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const appCode = activeCandidate.applicantCode || `APP-${String(activeApplicantId).padStart(5, '0')}`;
    const soaRefNo = `SOA-${new Date().getFullYear()}-${appCode.replace(/[^A-Za-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;

    // ── 3. Candidate & Deployment Dossier Card (2-Column Frame) ──
    currentY += 5;
    const cardY = currentY;
    const cardHeight = 26;
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, cardY, contentWidth, cardHeight, 1.5, 1.5, 'FD');

    // Column 1 (Left): Candidate Information
    const col1X = margin + 4;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('APPLICANT NAME:', col1X, cardY + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(candidateDisplayName.toUpperCase(), col1X + 28, cardY + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('APPLICANT CODE:', col1X, cardY + 11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(appCode, col1X + 28, cardY + 11);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('APPLIED TRADE / ROLE:', col1X, cardY + 16.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(
      (activeCandidate.appliedPosition || activeCandidate.appliedRole || 'General Skilled Worker').toUpperCase(),
      col1X + 28,
      cardY + 16.5
    );

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('DMW STAGE / STATUS:', col1X, cardY + 22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129); // emerald
    doc.text(`Phase ${activeCandidate.phase || 1}: ${activeCandidate.status || 'Active Processing'}`, col1X + 28, cardY + 22);

    // Column 2 (Right): Deployment & Billing Context
    const col2X = margin + 98;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('SOA CONTROL NO.:', col2X, cardY + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(soaRefNo, col2X + 28, cardY + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('DATE ISSUED:', col2X, cardY + 11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(issueDateStr, col2X + 28, cardY + 11);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('DESTINATION COUNTRY:', col2X, cardY + 16.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const destCountry = (activeCandidate as any).destinationCountry || activeCandidate.country || activeCandidate.jobOrder || 'International';
    doc.text(destCountry.toUpperCase(), col2X + 28, cardY + 16.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('BILLING CURRENCY:', col2X, cardY + 22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('PHILIPPINE PESO (PHP / ₱)', col2X + 28, cardY + 22);

    // ── 4. Itemized Financial Table ──
    const tableData = currentExpenses.map((exp, index) => {
      const purposeLower = (exp.purpose || '').toLowerCase();
      let classification = 'Worker Personal Doc';
      if (exp.type === 'placement_fee' || purposeLower.includes('placement')) {
        classification = 'Agency Placement Fee';
      } else if (exp.type === 'cash_advance' || purposeLower.includes('advance')) {
        classification = 'Cash Advance';
      } else if (exp.type === 'deduction' || purposeLower.includes('deduction')) {
        classification = 'Salary Deduction';
      } else if (
        purposeLower.includes('visa') || purposeLower.includes('oec') ||
        purposeLower.includes('owwa') || purposeLower.includes('airfare') ||
        purposeLower.includes('insurance')
      ) {
        classification = 'Employer-Covered Processing';
      }

      const orNum = exp.referenceNo ? `OR #${exp.referenceNo}` : '— (Pending)';
      const amountStr = `PHP ${Number(exp.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      return [
        String(index + 1),
        exp.date || '—',
        exp.purpose || 'General Financial Item',
        classification,
        orNum,
        amountStr,
      ];
    });

    autoTable(doc, {
      startY: cardY + cardHeight + 5,
      head: [['#', 'DATE', 'PARTICULARS / ITEM DESCRIPTION', 'CLASSIFICATION', 'OR / REF NO.', 'AMOUNT (PHP)']],
      body: tableData,
      theme: 'grid',
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'left',
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.2,
        textColor: [51, 65, 85],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
        overflow: 'linebreak',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 54, fontStyle: 'bold' },
        3: { cellWidth: 34 },
        4: { cellWidth: 30, halign: 'center' },
        5: { cellWidth: 34, halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] },
      },
    });

    let finalTableY = (doc as any).lastAutoTable?.finalY || 160;

    // Check if remaining space is enough for Summary (42mm) + Notice (18mm) + Signatures (38mm) = 98mm
    if (finalTableY + 98 > 272) {
      doc.addPage();
      finalTableY = 20;
    }

    // ── 5. Financial Summary & Notes Dual Box ──
    const summaryY = finalTableY + 5;
    const boxH = 40;

    // Left Box: DMW Statutory Notes & Terms (Width: 88mm)
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, summaryY, 88, boxH, 1.5, 1.5, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('DMW STATUTORY COMPLIANCE & BILLING NOTES', margin + 4, summaryY + 5.5);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const noteText1 = '• Personal Docs (Medical, Passport, NBI, PSA) are worker-borne.';
    const noteText2 = '• Visa, OWWA, OEC & Airfare are strictly absorbed by Employer/Agency.';
    const noteText3 = dmwStatus.isExempt
      ? `• ZERO PLACEMENT FEE: Worker is exempt (${dmwStatus.reason}).`
      : `• Placement Fee Cap: Maximum 1-month basic salary (PHP ${dmwStatus.salaryCap.toLocaleString()}).`;
    const noteText4 = soaCustomNotes ? `• Terms: ${soaCustomNotes}` : '• BIR Official Receipts issued upon payment confirmation.';

    doc.text(noteText1, margin + 4, summaryY + 11);
    doc.text(noteText2, margin + 4, summaryY + 16.5);
    doc.text(doc.splitTextToSize(noteText3, 80), margin + 4, summaryY + 22);
    doc.text(doc.splitTextToSize(noteText4, 80), margin + 4, summaryY + 28);

    // Right Box: Reconciliation Totals (Width: 90mm, X: 106mm)
    const rightBoxX = margin + 92;
    doc.setFillColor(241, 245, 249); // slate-100
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(rightBoxX, summaryY, 90, boxH, 1.5, 1.5, 'FD');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Personal Documentation Costs (Worker):', rightBoxX + 4, summaryY + 6.5);
    doc.text(`PHP ${financialSummary.workerPaidDocs.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, rightBoxX + 86, summaryY + 6.5, { align: 'right' });

    doc.text('Employer-Covered Costs (Absorbed):', rightBoxX + 4, summaryY + 12);
    doc.text(`PHP ${financialSummary.employerCovered.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, rightBoxX + 86, summaryY + 12, { align: 'right' });

    doc.text('Assessed Placement Fee (if applicable):', rightBoxX + 4, summaryY + 17.5);
    doc.text(`PHP ${financialSummary.placementFeeTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, rightBoxX + 86, summaryY + 17.5, { align: 'right' });

    doc.text('Less: Settled Advances / Deductions:', rightBoxX + 4, summaryY + 23);
    const settledAmt = financialSummary.deductions;
    doc.text(`(PHP ${settledAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })})`, rightBoxX + 86, summaryY + 23, { align: 'right' });

    // Separator line inside totals box
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(rightBoxX + 4, summaryY + 26.5, rightBoxX + 86, summaryY + 26.5);

    // NET WORKER BALANCE
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('NET BALANCE DUE FROM WORKER:', rightBoxX + 4, summaryY + 33);
    doc.setTextColor(16, 185, 129); // emerald-600
    doc.text(
      `PHP ${financialSummary.netPayableByWorker.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      rightBoxX + 86,
      summaryY + 33,
      { align: 'right' }
    );

    // ── 6. Statutory Certification Statement ──
    let certY = summaryY + boxH + 5;
    if (certY + 45 > 272) {
      doc.addPage();
      certY = 20;
    }

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    const certDeclaration = 
      'CERTIFICATION: This Statement of Account is an authentic billing statement rendered in strict accordance with the Department of ' +
      'Migrant Workers (DMW) 2023 Rules and Regulations Governing Overseas Employment and Bureau of Internal Revenue (BIR) standards. ' +
      'Placement fees (where lawful) do not exceed one month basic salary, and all employer-covered components are not charged to the applicant. ' +
      'Official receipts are issued for all documented collections.';
    doc.text(doc.splitTextToSize(certDeclaration, contentWidth), margin, certY);

    // ── 7. Triple Official Signature Block ──
    let signY = certY + 12;
    if (signY + 32 > 272) {
      doc.addPage();
      signY = 20;
    }

    // Col 1: PREPARED & CERTIFIED BY (Accountant)
    const sign1X = margin;
    const signColW = 56;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('PREPARED & CERTIFIED BY:', sign1X, signY);

    // Render signature
    if (soaSignatureMode === 'draw' && hasSignatureDrawing && signatureCanvasRef.current) {
      try {
        const sigDataUrl = signatureCanvasRef.current.toDataURL('image/png');
        doc.addImage(sigDataUrl, 'PNG', sign1X, signY + 1, 44, 11);
      } catch (err) {
        console.warn('Could not export signature canvas to PDF image:', err);
      }
    } else {
      // Digital Verification Stamp
      doc.setFillColor(240, 253, 244); // emerald-50
      doc.setDrawColor(187, 247, 208); // emerald-200
      doc.roundedRect(sign1X, signY + 2, 48, 10, 1, 1, 'FD');
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 101, 52); // emerald-800
      doc.text('✓ DIGITALLY CERTIFIED', sign1X + 2, signY + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(21, 128, 61);
      doc.text(`BIR / DMW Audit Token: ${appCode}`, sign1X + 2, signY + 10);
    }

    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.line(sign1X, signY + 15, sign1X + signColW, signY + 15);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text((soaSignerName || 'ACCOUNTING OFFICER').toUpperCase(), sign1X, signY + 19);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(soaSignerTitle || 'Accounting Officer / Finance Specialist', sign1X, signY + 23);
    doc.text(`Date Signed: ${issueDateStr}`, sign1X, signY + 27);

    // Col 2: CONFORME / WORKER ACKNOWLEDGMENT
    const sign2X = margin + 63;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('CONFORME / APPLICANT ACKNOWLEDGMENT:', sign2X, signY);

    // Line for applicant physical signature
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.line(sign2X, signY + 15, sign2X + signColW, signY + 15);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(candidateDisplayName.toUpperCase(), sign2X, signY + 19);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Candidate / Overseas Filipino Worker (OFW)', sign2X, signY + 23);
    doc.text('Signature over Printed Name', sign2X, signY + 27);

    // Col 3: APPROVED & RELEASED BY (Agency Head)
    const sign3X = margin + 126;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('APPROVED & NOTED BY:', sign3X, signY);

    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.line(sign3X, signY + 15, sign3X + signColW, signY + 15);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text((soaApproverName || 'AGENCY HEAD').toUpperCase(), sign3X, signY + 19);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(soaApproverTitle || 'Managing Director / Licensee', sign3X, signY + 23);
    doc.text('Authorized DMW Representative', sign3X, signY + 27);

    // ── 8. Running Header & Running Footer on All Pages ──
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);

      // Running mini-header for page 2+
      if (i > 1) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(`${agencyNameClean} • Statement of Account (${candidateDisplayName}) • Ref: ${soaRefNo}`, margin, 10);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(margin, 12, pageWidth - margin, 12);
      }

      // Running footer at bottom
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        'OFFICIAL STATEMENT OF ACCOUNT • Regulated by the Department of Migrant Workers (DMW) • Confidential Accounting Document',
        margin,
        pageHeight - 9.5
      );
      doc.setFont('helvetica', 'bold');
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 9.5, { align: 'right' });
    }

    // Save PDF
    const filename = `SOA_${agencyNameClean.replace(/[^A-Za-z0-9]/g, '_')}_${candidateDisplayName.replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);

    // Log Activity
    addActivityLog({
      applicantId: activeApplicantId,
      action: 'Generated & Signed Official Statement of Account (SOA)',
      performedBy: soaSignerName || currentUserName,
      department: 'Accounting',
      details: `Generated official DMW-compliant SOA in PHP for ${candidateDisplayName} signed by ${soaSignerName} (${soaSignerTitle}). Ref: ${soaRefNo}`,
    });

    setShowSignModal(false);
    showToast('✓ Official Statement of Account (SOA) exported successfully.');
  };

  // ──────────────────────────────────────────────────────────────────────────
  // VIEW 1: APPLICANT DIRECTORY (When no applicant is actively selected)
  // ──────────────────────────────────────────────────────────────────────────
  if (!activeApplicantId) {
    return (
      <div className="space-y-6 w-full">
        {/* Modern Header Banner */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center font-bold">
                <Receipt className="w-5 h-5" />
              </span>
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                Expense Ledger & Candidate Directory
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1.5 font-medium ml-11">
              Centralized Philippine OFW deployment cost tracking, itemized Official Receipts (OR), and DMW fee compliance
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl">
              Currency: ₱ (PHP)
            </span>
          </div>
        </div>

        {/* Directory Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          {/* Filter Bar */}
          <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-50/70 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Active Candidate Accounts</h3>
              <p className="text-xs text-slate-500 mt-0.5">Select a candidate to view their complete financial ledger and DMW compliance status</p>
            </div>
            <div className="flex w-full md:w-auto items-center gap-3">
              <div className="relative flex-1 md:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search name, code, role..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white font-medium"
                />
              </div>
              <div className="relative flex-shrink-0">
                <select
                  value={phaseFilter}
                  onChange={e => setPhaseFilter(e.target.value)}
                  aria-label="Filter candidates by recruitment phase"
                  className="pl-3 pr-8 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white font-semibold text-slate-700"
                >
                  <option value="All">All Phases</option>
                  <option value="1">Phase 1: Registration</option>
                  <option value="2">Phase 2: Screening</option>
                  <option value="3">Phase 3: Medical / FTW</option>
                  <option value="4">Phase 4: Contract / Endorsement</option>
                  <option value="5">Phase 5: Processing / Visa</option>
                  <option value="6">Phase 6: Deployed</option>
                </select>
              </div>
            </div>
          </div>

          {/* Directory List Items */}
          <div className="divide-y divide-slate-100">
            {applicantLedgers.map((app) => {
              const pos = app.appliedPosition || app.appliedRole || 'Candidate';
              const isExempt = EXEMPT_POSITIONS.some(p => pos.toLowerCase().includes(p)) ||
                               ZERO_FEE_COUNTRIES.some(c => (app.country || app.jobOrder || '').toLowerCase().includes(c));

              return (
                <div 
                  key={app.id} 
                  onClick={() => {
                    setActiveApplicantId(String(app.id));
                    if (onSelectApplicant) onSelectApplicant(String(app.id));
                  }}
                  className="p-4 sm:p-5 hover:bg-slate-50/80 transition-all flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center font-bold text-sm shadow-xs group-hover:scale-105 transition-transform">
                      {app.firstName?.[0] || 'C'}{app.lastName?.[0] || ''}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors text-sm">
                          {app.name || `${app.firstName || ''} ${app.lastName || ''}`.trim()}
                        </p>
                        {isExempt && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2.5 py-0.5 rounded-full">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" /> DMW Zero-Fee Protected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[11px] font-bold">
                          {app.applicantCode || `ID #${app.id}`}
                        </span>
                        <span>• {pos}</span>
                        {app.jobOrder && <span className="text-slate-400">• {app.jobOrder}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-black text-slate-900 text-sm sm:text-base font-mono">
                        ₱{app.totalPeso.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium">{app.expenseCount} Recorded Entry(ies)</p>
                    </div>
                    <button 
                      className="px-3.5 py-1.5 bg-slate-100 group-hover:bg-emerald-600 group-hover:text-white text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                    >
                      View Sheet
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {applicantLedgers.length === 0 && (
              <div className="p-16 text-center text-slate-400">
                <Receipt className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-base font-bold text-slate-700">No candidate financial profiles found.</p>
                <p className="text-xs text-slate-500 mt-1">Try adjusting your search query or phase filter.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // VIEW 2: INDIVIDUAL APPLICANT FINANCIAL SHEET (When a candidate is selected)
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 w-full">
      {/* Top Navigation & Action Controls */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => {
            setActiveApplicantId(null);
            if (onSelectApplicant) onSelectApplicant('');
          }}
          className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-xs transition-all hover:shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Candidate Directory
        </button>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => handleOpenAddModal()}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" /> Add Financial Entry
          </button>
          <button 
            onClick={handleOpenSignModal} 
            disabled={currentExpenses.length === 0}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-all disabled:opacity-50"
            title="Generate and sign official DMW-compliant Statement of Account"
          >
            <FileSignature className="w-4 h-4 text-emerald-400" /> Export Official SOA
          </button>
        </div>
      </div>

      {/* Candidate Profile Card & DMW Badge */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-7 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">{candidateDisplayName}</h2>
              <span className="font-mono text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
                {activeCandidate?.applicantCode || `ID #${activeApplicantId}`}
              </span>
              <span className="text-xs font-bold px-2.5 py-1 bg-sky-50 text-sky-700 rounded-lg border border-sky-200">
                Phase {activeCandidate?.phase || 1}: {activeCandidate?.status || 'Processing'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2 font-medium">
              Applied Position: <span className="font-bold text-slate-800">{activeCandidate?.appliedPosition || activeCandidate?.appliedRole || 'General Worker'}</span>
              {activeCandidate?.jobOrder && <> • Job Order: <span className="font-semibold text-slate-700">{activeCandidate.jobOrder}</span></>}
            </p>
          </div>

          {/* DMW Compliance Protection Badge */}
          <div className="w-full md:w-auto">
            {dmwStatus.isExempt ? (
              <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-3.5 text-xs text-emerald-900 flex items-start gap-3 max-w-md shadow-xs">
                <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-emerald-950">DMW Zero-Placement-Fee Policy Protected</p>
                  <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">{dmwStatus.reason}</p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 flex items-start gap-3 max-w-md shadow-xs">
                <Shield className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900">Standard DMW Placement Fee Policy</p>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    Legally capped at 1 month's basic salary (₱{dmwStatus.salaryCap?.toLocaleString()}). Strictly payable only after contract signing (Phase 4+).
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4 Financial Stat Cards in PHP */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Worker Personal Docs</p>
            <p className="text-xl font-black text-slate-900 mt-1 font-mono">
              ₱{financialSummary.workerPaidDocs.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Medical, Passport, NBI, PSA</p>
          </div>

          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Employer Covered</p>
            <p className="text-xl font-black text-indigo-600 mt-1 font-mono">
              ₱{financialSummary.employerCovered.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-indigo-400 mt-1">Visa, OEC, OWWA, Airfare (Zero to OFW)</p>
          </div>

          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Placement Fee</p>
            <p className="text-xl font-black text-amber-600 mt-1 font-mono">
              ₱{financialSummary.placementFeeTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-amber-600 mt-1">{dmwStatus.isExempt ? 'Exempt / ₱0 Cap' : 'Capped to 1 mo. basic salary'}</p>
          </div>

          <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-200/80">
            <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Net Worker Payable</p>
            <p className="text-xl font-black text-emerald-700 mt-1 font-mono">
              ₱{financialSummary.netPayableByWorker.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-emerald-600 mt-1">Total personal docs & approved fees</p>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* SMART FINANCIAL RECOMMENDATIONS BANNER (Interactive & Non-Intrusive) */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {smartRecommendations.length > 0 && (
        <div className="space-y-3">
          {smartRecommendations.map(rec => (
            <div 
              key={rec.id}
              className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white border border-emerald-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-emerald-950">{rec.title}</span>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      {rec.tag}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{rec.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-shrink-0">
                <button
                  onClick={() => setDismissedRecommendations(prev => new Set(prev).add(rec.id))}
                  className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => handleOpenAddModal(rec.category, rec.purpose, rec.defaultAmount)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Record Entry (₱{rec.defaultAmount.toLocaleString()})
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* LEDGER TRANSACTIONS CARD WITH CATEGORY TABS */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {/* Table Header & Category Tabs */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'all' 
                  ? 'bg-slate-900 text-white shadow-xs' 
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              All Entries ({currentExpenses.length})
            </button>
            <button
              onClick={() => setActiveTab('worker_docs')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'worker_docs' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              Worker Docs
            </button>
            <button
              onClick={() => setActiveTab('employer_covered')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'employer_covered' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              Employer-Covered
            </button>
            <button
              onClick={() => setActiveTab('placement')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'placement' 
                  ? 'bg-amber-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              Placement Fee
            </button>
            <button
              onClick={() => setActiveTab('advances')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'advances' 
                  ? 'bg-sky-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              Advances & Deductions
            </button>
          </div>

          <span className="text-xs font-bold text-slate-500">
            Denominated in Philippine Peso (₱)
          </span>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 uppercase text-slate-500 font-bold tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3.5 text-center w-12">#</th>
                <th className="px-4 py-3.5 w-28">Date</th>
                <th className="px-4 py-3.5">Purpose / Item</th>
                <th className="px-4 py-3.5 w-40">Official Receipt #</th>
                <th className="px-4 py-3.5 w-40">Classification</th>
                <th className="px-4 py-3.5 text-right w-36">Amount (PHP)</th>
                <th className="px-4 py-3.5">Remarks</th>
                <th className="px-4 py-3.5 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map((exp, idx) => {
                const purposeLower = (exp.purpose || '').toLowerCase();
                const isEmployer = purposeLower.includes('visa') || purposeLower.includes('oec') || purposeLower.includes('owwa') || purposeLower.includes('airfare');
                const isPlacement = exp.type === 'placement_fee' || purposeLower.includes('placement');
                const isAdvance = exp.type === 'cash_advance' || purposeLower.includes('advance');
                const isDeduction = exp.type === 'deduction' || purposeLower.includes('deduction');

                return (
                  <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-3.5 text-slate-600 font-medium whitespace-nowrap">
                      {exp.date || new Date().toISOString().split('T')[0]}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-slate-900 text-xs">{exp.purpose}</p>
                      {exp.status === 'draft' && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded uppercase mt-0.5 inline-block">Draft</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {exp.referenceNo ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                          OR #{exp.referenceNo}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium italic">
                          Unreceipted / Pending OR
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {isEmployer ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full">
                          Employer-Covered
                        </span>
                      ) : isPlacement ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full">
                          Placement Fee
                        </span>
                      ) : isAdvance ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200/80 px-2 py-0.5 rounded-full">
                          Cash Advance
                        </span>
                      ) : isDeduction ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-full">
                          Deduction / Repayment
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                          Worker-Borne
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right font-black text-slate-900 font-mono text-xs">
                      ₱{Number(exp.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 max-w-xs truncate text-[11px]">
                      {exp.remarks || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={() => handleEditExpense(exp)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit Entry"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => setDeletingExpense(exp)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Receipt className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-700 text-sm">No transactions match this category.</p>
                    <p className="text-xs text-slate-400 mt-0.5">Click "Add Financial Entry" to record a new fee or select "All Entries".</p>
                  </td>
                </tr>
              )}

              {/* Total Footers (Strictly in PHP) */}
              <tr className="bg-slate-50 font-bold border-t-2 border-slate-200 text-slate-700 text-xs">
                <td colSpan={5} className="px-4 py-3 text-right uppercase">Total Personal Documentation (Worker-Paid):</td>
                <td className="px-4 py-3 text-right text-slate-900 font-mono">₱{financialSummary.workerPaidDocs.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td colSpan={2}></td>
              </tr>
              <tr className="bg-slate-50 font-bold text-slate-700 text-xs">
                <td colSpan={5} className="px-4 py-3 text-right uppercase">Total Employer-Covered Processing Costs:</td>
                <td className="px-4 py-3 text-right text-indigo-700 font-mono">₱{financialSummary.employerCovered.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td colSpan={2}></td>
              </tr>
              <tr className="bg-emerald-50/80 font-black text-emerald-950 border-t border-emerald-200 text-xs">
                <td colSpan={5} className="px-4 py-4 text-right uppercase">Net Total Remaining Payable by Worker:</td>
                <td className="px-4 py-4 text-right text-emerald-700 text-sm font-mono">₱{financialSummary.netPayableByWorker.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* ADD / EDIT TRANSACTION MODAL */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-lg">
                  {editingExpenseId ? 'Edit Financial Entry' : 'Add Financial Entry'}
                </h3>
                <p className="text-xs text-emerald-100 mt-0.5">Candidate: {candidateDisplayName}</p>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
                  <p className="font-medium leading-relaxed">{modalError}</p>
                </div>
              )}

              {/* Category Classification */}
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block">Fee Classification / Responsibility</label>
                <select
                  value={categoryType}
                  onChange={e => {
                    const val = e.target.value as any;
                    setCategoryType(val);
                    if (val === 'worker_document') {
                      setPurposeName('Medical Examination (Fit-to-Work)');
                      setAmountValue(1500);
                    } else if (val === 'employer_processing') {
                      setPurposeName('OEC Processing Fee');
                      setAmountValue(2500);
                    } else if (val === 'placement_fee') {
                      setPurposeName('DMW Regulated Placement Fee');
                      setAmountValue(dmwStatus.salaryCap || 25000);
                    } else if (val === 'cash_advance') {
                      setPurposeName('Cash Advance Assistance');
                      setAmountValue(5000);
                    } else {
                      setPurposeName('Salary Deduction Repayment');
                      setAmountValue(2500);
                    }
                  }}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none bg-white text-slate-800"
                >
                  <option value="worker_document">Worker Personal Documentation (Paid by OFW)</option>
                  <option value="employer_processing">Employer-Covered Processing (Zero-Fee to OFW)</option>
                  <option value="placement_fee" disabled={dmwStatus.isExempt}>
                    Placement Fee {dmwStatus.isExempt ? '(Exempt - Prohibited by DMW)' : '(Max 1 mo. basic salary)'}
                  </option>
                  <option value="cash_advance">Cash Advance (Financial Assistance to OFW)</option>
                  <option value="deduction">Salary Deduction / Repayment</option>
                </select>
              </div>

              {/* Purpose Item Selection */}
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block">Purpose / Specific Item</label>
                {categoryType === 'worker_document' ? (
                  <select
                    value={purposeName}
                    onChange={e => {
                      setPurposeName(e.target.value);
                      if (e.target.value.includes('Medical')) setAmountValue(1500);
                      else if (e.target.value.includes('Passport')) setAmountValue(1200);
                      else if (e.target.value.includes('NBI')) setAmountValue(160);
                      else if (e.target.value.includes('Birth')) setAmountValue(365);
                    }}
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none bg-white font-medium text-slate-800"
                  >
                    <option value="Medical Examination (Fit-to-Work)">Medical Examination (PEME / Fit-to-Work Clinic)</option>
                    <option value="Passport Processing & Authentication">Passport Processing & Authentication</option>
                    <option value="NBI & Police Clearance">NBI & Police Clearance</option>
                    <option value="PSA Birth / Marriage Certificate">PSA Birth / Marriage Certificate</option>
                    <option value="TESDA / PRC Assessment & Certification">TESDA / PRC Assessment & Certification</option>
                    <option value="Other">Other Personal Document</option>
                  </select>
                ) : categoryType === 'employer_processing' ? (
                  <select
                    value={purposeName}
                    onChange={e => setPurposeName(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none bg-white font-medium text-slate-800"
                  >
                    <option value="OEC Processing Fee">OEC Processing Fee (POEA/DMW)</option>
                    <option value="OWWA Membership Fee">OWWA Membership Fee ($25 equivalent)</option>
                    <option value="Working Visa & Entry Permit">Working Visa & Entry Permit</option>
                    <option value="Airfare Ticket (Manila to Destination)">Airfare Ticket (Manila to Destination)</option>
                    <option value="Compulsory Insurance Coverage">Compulsory Insurance Coverage</option>
                    <option value="Other">Other Employer Processing Cost</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={purposeName}
                    onChange={e => setPurposeName(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none font-medium"
                    placeholder="e.g. DMW Approved Placement Fee"
                  />
                )}

                {purposeName === 'Other' && (
                  <input
                    type="text"
                    placeholder="Enter specific purpose..."
                    value={customPurpose}
                    onChange={e => setCustomPurpose(e.target.value)}
                    className="w-full mt-2 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none font-medium"
                  />
                )}
              </div>

              {/* Amount (PHP) & Optional Official Receipt */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">Amount (PHP / ₱)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">₱</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={amountValue}
                      onChange={e => setAmountValue(parseFloat(e.target.value) || 0)}
                      className="w-full border border-slate-300 rounded-xl pl-8 pr-3 py-2.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 block">Official Receipt #</label>
                    <span className="text-[10px] text-slate-400 font-semibold">(Optional)</span>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. OR-2026-0082"
                    value={orNumberValue}
                    onChange={e => setOrNumberValue(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Transaction Date */}
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block">Transaction Date</label>
                <input
                  type="date"
                  value={transactionDate}
                  onChange={e => setTransactionDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block">Remarks / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional billing or receipt notes..."
                  value={remarksValue}
                  onChange={e => setRemarksValue(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-xs"
                >
                  {isSubmitting ? 'Saving...' : editingExpenseId ? 'Save Changes' : 'Record Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* DELETE TRANSACTION CONFIRMATION MODAL */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {deletingExpense && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">Delete Financial Record?</h3>
                <p className="text-xs text-slate-500">This action will remove the record from the ledger.</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs space-y-1">
              <p><span className="text-slate-500">Item:</span> <span className="font-bold text-slate-800">{deletingExpense.purpose}</span></p>
              <p><span className="text-slate-500">Amount:</span> <span className="font-mono font-bold text-slate-900">₱{Number(deletingExpense.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></p>
              {deletingExpense.referenceNo && (
                <p><span className="text-slate-500">OR #:</span> <span className="font-mono font-semibold text-slate-700">#{deletingExpense.referenceNo}</span></p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingExpense(null)}
                disabled={isDeleting}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* OFFICIAL STATEMENT OF ACCOUNT (SOA) SIGN-OFF & EXPORT MODAL */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {showSignModal && activeCandidate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600">
                  <FileSignature className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Official Statement of Account (SOA)</h3>
                  <p className="text-xs text-slate-500">Configure agency letterhead, attest ledger items, and sign the official document.</p>
                </div>
              </div>
              <button
                onClick={() => setShowSignModal(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-6 space-y-5 text-xs">
              {/* 1. Candidate Financial Summary Banner */}
              <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-slate-400 font-medium text-[11px]">Candidate Dossier</p>
                  <p className="font-bold text-sm text-white">{candidateDisplayName}</p>
                  <p className="text-slate-400 text-xs">
                    {activeCandidate.appliedPosition || activeCandidate.appliedRole || 'General Worker'} • {activeCandidate.applicantCode || `ID #${activeCandidate.id}`}
                  </p>
                </div>
                <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700 text-right sm:min-w-[160px]">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Net Worker Balance</p>
                  <p className="text-lg font-black text-emerald-400">
                    ₱{financialSummary.netPayableByWorker.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-slate-400">{currentExpenses.length} transactions in PHP</p>
                </div>
              </div>

              {/* 2. Agency Letterhead Information */}
              <div className="space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <Building2 className="w-4 h-4 text-slate-600" /> Agency Letterhead Details (Official DMW Accredited)
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Persists as default letterhead</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Agency Registered Name</label>
                    <input
                      type="text"
                      value={soaAgencyName}
                      onChange={e => setSoaAgencyName(e.target.value)}
                      placeholder="e.g. PACIFIC OVERSEAS RECRUITMENT AGENCY INC."
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">DMW / POEA License No.</label>
                    <input
                      type="text"
                      value={soaLicenseNo}
                      onChange={e => setSoaLicenseNo(e.target.value)}
                      placeholder="e.g. DMW-048-LB-031224-R"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Official Agency Office Address</label>
                    <input
                      type="text"
                      value={soaAgencyAddress}
                      onChange={e => setSoaAgencyAddress(e.target.value)}
                      placeholder="e.g. 5th Floor, Corporate Center, Manila, Philippines"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Contact Numbers & BIR TIN</label>
                    <input
                      type="text"
                      value={soaAgencyContact}
                      onChange={e => setSoaAgencyContact(e.target.value)}
                      placeholder="e.g. Tel: +63 (2) 8523-8899 • BIR TIN: 009-842-120-000 NV"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Accountant Sign-off & Signature Method */}
              <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <PenTool className="w-4 h-4 text-emerald-600" /> Accountant Certification & Signature
                  </label>
                  {/* Mode switcher tabs */}
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setSoaSignatureMode('draw')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                        soaSignatureMode === 'draw'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <PenTool className="w-3 h-3" /> Draw Signature
                    </button>
                    <button
                      type="button"
                      onClick={() => setSoaSignatureMode('stamp')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                        soaSignatureMode === 'stamp'
                          ? 'bg-white text-emerald-700 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <BadgeCheck className="w-3 h-3 text-emerald-600" /> Digital Stamp
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Accountant / Signer Name</label>
                    <input
                      type="text"
                      value={soaSignerName}
                      onChange={e => setSoaSignerName(e.target.value)}
                      placeholder="e.g. Maria Santos"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Official Title / Designation</label>
                    <input
                      type="text"
                      value={soaSignerTitle}
                      onChange={e => setSoaSignerTitle(e.target.value)}
                      placeholder="e.g. Senior Accounting Officer"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Signature Input Area */}
                {soaSignatureMode === 'draw' ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Sign below using mouse, trackpad, or touchscreen:</span>
                      {hasSignatureDrawing && (
                        <button
                          type="button"
                          onClick={clearCanvasSignature}
                          className="flex items-center gap-1 text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" /> Clear Signature
                        </button>
                      )}
                    </div>
                    <div className="relative border-2 border-dashed border-slate-300 hover:border-emerald-400 transition-colors rounded-xl overflow-hidden bg-slate-50/50">
                      <canvas
                        ref={signatureCanvasRef}
                        width={540}
                        height={120}
                        className="w-full h-28 bg-white cursor-crosshair touch-none"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                      />
                      {!hasSignatureDrawing && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 text-xs italic font-medium">
                          Click and drag to sign here
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                      <BadgeCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-emerald-900 text-xs">Official Certified Electronic Audit Stamp</p>
                      <p className="text-[11px] text-emerald-700">
                        Will be embossed on the statement with token <span className="font-mono font-bold">DMW-SOA-{activeCandidate.applicantCode || 'APP'}</span> and the authenticated timestamp.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Approver & Custom Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Approved By (Agency Head)</label>
                  <input
                    type="text"
                    value={soaApproverName}
                    onChange={e => setSoaApproverName(e.target.value)}
                    placeholder="e.g. Atty. Roberto C. Tan"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Approver Position / Title</label>
                  <input
                    type="text"
                    value={soaApproverTitle}
                    onChange={e => setSoaApproverTitle(e.target.value)}
                    placeholder="e.g. Managing Director / Agency Head"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Special Billing Notes / Installment Terms</label>
                  <input
                    type="text"
                    value={soaCustomNotes}
                    onChange={e => setSoaCustomNotes(e.target.value)}
                    placeholder="e.g. Salary deduction via authorized foreign employer payroll upon deployment."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">
                Strictly formatted for A4 portrait with zero text overflow.
              </span>
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setShowSignModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={generateOfficialSOA}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-400" /> Generate & Download Official SOA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
