import { useState, useEffect, useRef } from 'react';
import {
  Lock,
  ScanText,
  Upload,
  CheckCircle,
  AlertTriangle,
  FileCheck,
  Sparkles,
  Loader2,
  RefreshCw,
  Eye,
  FileText,
  AlertCircle,
  Check,
  X,
  ShieldCheck,
  Search,
  Filter,
} from 'lucide-react';
import { WorkflowState, ActivityLog, ApplicantRecord } from '../../types';
import { api } from '../../../lib/api';

interface DocumentOCRProps {
  workflow: WorkflowState;
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  showToast: (message: string) => void;
  selectedApplicantId?: string;
  applicants?: ApplicantRecord[];
}

interface DiscrepancyItem {
  field: string;
  system_value?: string;
  extracted_value?: string;
  severity: string;
  issue: string;
}

interface OCRResult {
  match_status: string;
  applicant_id: number;
  extracted_data: {
    document_type?: string;
    passport_number?: string;
    full_name?: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    birth_date?: string;
    expiry_date?: string;
    nationality?: string;
    sex?: string;
    mrz_detected?: boolean;
  };
  system_data: {
    applicant_id?: number;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    birth_date?: string;
    passport_number?: string;
  };
  discrepancies: DiscrepancyItem[];
  expiration_monitoring?: {
    expiry_date?: string;
    days_until_expiration?: number;
    alert_level?: string;
    monitoring_active?: boolean;
    message?: string;
  };
  raw_text_preview: string;
  processed_at: string;
}

export default function DocumentOCR({
  workflow,
  currentUserName,
  addActivityLog,
  showToast,
  selectedApplicantId = '1',
  applicants = [],
}: DocumentOCRProps) {
  // Helper to determine if an applicant has reached Phase 4+ (Foreign Employer Acceptance, Visa, or Deployed)
  const isApplicantQualifiedForPhase = (app?: ApplicantRecord | null) =>
    Boolean(
      app && (
        app.phase >= 4 ||
        ['Deployed', 'Employer Review', 'Visa Processing', 'Final Deployment'].includes(app.status)
      )
    );

  // List of only candidates who belong to Phase 4+ for the dropdown selector
  const phaseQualifiedApplicants = applicants.filter(isApplicantQualifiedForPhase);

  // Default candidate for quick switch recommendation if needed
  const defaultQualified = phaseQualifiedApplicants[0] || applicants[0];

  // Default value is empty string so selector displays "Select applicant for verification"
  const [activeApplicantId, setActiveApplicantId] = useState<string>('');
  const [testModeUnlocked, setTestModeUnlocked] = useState<boolean>(false);
  const [applicantSearch, setApplicantSearch] = useState<string>('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close search popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeApplicant = applicants.find((a) => String(a.id) === String(activeApplicantId));
  const isApplicantQualified = isApplicantQualifiedForPhase(activeApplicant);

  // Filter search results across all applicants
  const searchResults = applicantSearch.trim()
    ? applicants.filter((a) => {
        const q = applicantSearch.toLowerCase();
        return (
          String(a.id).toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          (a.role && a.role.toLowerCase().includes(q)) ||
          (a.status && a.status.toLowerCase().includes(q))
        );
      })
    : [];

  const isLocked = !testModeUnlocked && !workflow.employerAccepted && !isApplicantQualified;
  const [engineStatus, setEngineStatus] = useState<{
    available: boolean;
    engine?: string;
    gemini_active?: boolean;
  } | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRawText, setShowRawText] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check OCR engine health on mount
  useEffect(() => {
    const checkEngine = async () => {
      try {
        const res = await api.get('/ocr/status');
        setEngineStatus(res.data);
      } catch (err) {
        console.warn('OCR status endpoint unavailable:', err);
        setEngineStatus({ available: false });
      }
    };
    checkEngine();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setErrorMsg(null);

    // Create thumbnail preview if image
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleUploadAndExtract = async (fileToUpload?: File) => {
    const targetFile = fileToUpload || selectedFile;
    if (!targetFile) {
      showToast('Please choose a document file first.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', targetFile);

    const targetAppId = parseInt(activeApplicantId, 10) || 1;

    try {
      const res = await api.post(`/ocr/verify/${targetAppId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setOcrResult(res.data);

      const isVerified = res.data.match_status === 'VERIFIED';
      addActivityLog({
        applicantId: String(targetAppId),
        action: 'Document OCR & Verification',
        performedBy: currentUserName,
        department: 'Admin',
        details: isVerified
          ? `Passport uploaded and verified with Gemini Vision AI. Biometric fields match system record.`
          : `Passport processed with Gemini Vision AI. ${res.data.discrepancies?.length || 1} discrepancies flagged for review.`,
      });

      if (isVerified) {
        showToast('✓ OCR complete: Document verified against system records.');
      } else {
        showToast('⚠️ OCR complete: Validation discrepancies detected & flagged for review.');
      }
    } catch (err: any) {
      console.error('OCR verification error:', err);
      const msg =
        err.response?.data?.detail || err.message || 'Failed to process document with Gemini OCR.';
      setErrorMsg(msg);
      showToast(`OCR error: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick Sample Demo Passport Generator
  const handleRunSampleDemo = () => {
    // Generate a simple sample PNG canvas on the fly
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 600, 400);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('REPUBLIC OF THE PHILIPPINES', 150, 50);

      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('PASSPORT / PASAPORTE', 200, 80);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.fillText('Surname / Apelyido:', 50, 130);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('DELA CRUZ', 50, 155);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.fillText('Given Names / Mga Pangalan:', 50, 195);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('JUAN', 50, 220);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.fillText('Passport No:', 350, 130);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('P1234567B', 350, 155);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.fillText('Date of Birth:', 350, 195);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('15 MAY 1998', 350, 220);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.fillText('Date of Expiry:', 350, 260);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('15 MAY 2033', 350, 285);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '13px monospace';
      ctx.fillText('P<PHLDELA<CRUZ<<JUAN<<<<<<<<<<<<<<<<<<<<<<<<<', 50, 340);
      ctx.fillText('P1234567B7PHL9805151M3305158<<<<<<<<<<<<<<<04', 50, 365);

      canvas.toBlob((blob) => {
        if (blob) {
          const sampleFile = new File([blob], 'sample_passport_demo.png', { type: 'image/png' });
          setSelectedFile(sampleFile);
          setPreviewUrl(canvas.toDataURL());
          handleUploadAndExtract(sampleFile);
        }
      }, 'image/png');
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setOcrResult(null);
    setErrorMsg(null);
    setShowRawText(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <ScanText className="w-8 h-8 text-purple-600" />
            Document OCR & Biometric Cross-Validation
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            AI-driven document inspection using Google Gemini Vision AI with POEA/DMW 3-2-1 compliance cross-checking
          </p>
        </div>

        {/* Engine Status Badge */}
        <div className="flex items-center gap-2">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${
              engineStatus?.available
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-amber-50 text-amber-700 border-amber-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                engineStatus?.available ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span>
              {engineStatus?.available
                ? 'Gemini Vision AI: Active'
                : 'OCR Engine: Initializing'}
            </span>
          </div>
        </div>
      </div>

      {/* Target Candidate Selector & Quick Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Phase 4+ Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <ScanText className="w-4 h-4 text-purple-600" />
              Verification Target:
            </span>
            <select
              value={activeApplicantId}
              onChange={(e) => {
                setActiveApplicantId(e.target.value);
                setOcrResult(null);
              }}
              className="text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm min-w-[280px]"
            >
              <option value="">Select applicant for verification</option>

              {/* If currently selected applicant is locked/searched (not in Phase 4+), show them selected with lock badge */}
              {activeApplicant && !isApplicantQualified && (
                <option value={activeApplicant.id}>
                  🔒 [LOCKED · Ph.{activeApplicant.phase}] #{activeApplicant.id} - {activeApplicant.name} ({activeApplicant.status})
                </option>
              )}

              {/* In the dropdown, ONLY show applicants who are for this phase (Phase 4+ / 5) */}
              {phaseQualifiedApplicants.map((app) => (
                <option key={app.id} value={app.id}>
                  #{app.id} - {app.name} (Ph.{app.phase} · {app.status} ✓ Ready)
                </option>
              ))}

              {phaseQualifiedApplicants.length === 0 && (
                <option disabled>No Phase 4+ candidates available</option>
              )}
            </select>

            <span className="text-[11px] font-medium text-slate-500 hidden sm:inline">
              ({phaseQualifiedApplicants.length} Phase 4+ candidates ready for OCR)
            </span>
          </div>

          {/* Right: Quick Search for any applicant across all phases */}
          <div ref={searchContainerRef} className="relative">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={applicantSearch}
                onChange={(e) => {
                  setApplicantSearch(e.target.value);
                  setIsSearchDropdownOpen(true);
                }}
                onFocus={() => setIsSearchDropdownOpen(true)}
                placeholder="Search any candidate by name or #ID..."
                className="pl-8 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white shadow-sm w-full sm:w-72 transition-all"
              />
              {applicantSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setApplicantSearch('');
                    setIsSearchDropdownOpen(false);
                  }}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Live Search Suggestions Dropdown */}
            {isSearchDropdownOpen && applicantSearch.trim() && (
              <div className="absolute right-0 mt-1 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-2xl z-30 max-h-64 overflow-y-auto py-1">
                <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 flex items-center justify-between">
                  <span>Candidate Search Results</span>
                  <span>{searchResults.length} found</span>
                </div>
                {searchResults.length === 0 ? (
                  <div className="p-4 text-xs text-slate-500 text-center">
                    No applicant found matching "{applicantSearch}"
                  </div>
                ) : (
                  searchResults.map((app) => {
                    const ready = isApplicantQualifiedForPhase(app);
                    return (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => {
                          setActiveApplicantId(String(app.id));
                          setOcrResult(null);
                          setIsSearchDropdownOpen(false);
                          setApplicantSearch('');
                        }}
                        className={`w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex items-center justify-between gap-2 border-b border-slate-50 transition-colors ${
                          String(app.id) === String(activeApplicantId) ? 'bg-purple-50' : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 truncate">
                            #{app.id} - {app.name}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {app.role || 'Candidate'} · Phase {app.phase} ({app.status})
                          </p>
                        </div>
                        <span
                          className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                            ready
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {ready ? (
                            <>
                              <Check size={10} /> Ph.{app.phase} Ready
                            </>
                          ) : (
                            <>
                              <Lock size={10} /> Ph.{app.phase} Locked
                            </>
                          )}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-900 text-xs">
          <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-bold">OCR Processing Encountered an Issue:</p>
            <p className="mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Main Content: 
          1. Empty State (no candidate selected yet)
          2. Lock Gate Card (candidate selected is in Phase 1-3)
          3. Upload & OCR Workspace (candidate selected is in Phase 4+)
      */}
      {!activeApplicant ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 sm:p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center mb-4 shadow-sm">
            <ScanText className="w-8 h-8" />
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 mb-3">
            Ready for Document Inspection
          </span>
          <h3 className="font-extrabold text-slate-900 text-xl mb-2">
            Select an Applicant for Verification
          </h3>
          <p className="text-sm text-slate-600 max-w-lg mb-6 leading-relaxed">
            Please choose an eligible Phase 4+ candidate from the dropdown above or search any candidate by name to inspect documents and run biometric cross-validation against POEA/DMW records.
          </p>

          {/* Quick select cards of the Phase 4+ candidates */}
          {phaseQualifiedApplicants.length > 0 && (
            <div className="w-full max-w-xl">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Eligible Candidates Ready for OCR ({phaseQualifiedApplicants.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {phaseQualifiedApplicants.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => {
                      setActiveApplicantId(String(app.id));
                      setOcrResult(null);
                    }}
                    className="p-3 bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-300 rounded-xl text-left transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-purple-700">
                        #{app.id} - {app.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Ph.{app.phase} · {app.status}
                      </p>
                    </div>
                    <span className="text-xs text-purple-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      Select →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : isLocked ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 sm:p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mb-4 shadow-sm">
            <Lock className="w-8 h-8" />
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 mb-3 flex items-center gap-1.5">
            <Lock size={12} /> Phase 5 Document Gate Active · OCR Locked
          </span>
          <h3 className="font-extrabold text-slate-900 text-xl mb-2">
            Document OCR Locked for {activeApplicant?.name || 'Selected Applicant'} (#{activeApplicant?.id})
          </h3>
          <p className="text-sm text-slate-600 max-w-lg mb-6 leading-relaxed">
            {activeApplicant ? (
              <>
                Candidate <strong className="text-slate-900">{activeApplicant.name}</strong> is currently in{' '}
                <span className="inline-block px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 font-bold">
                  Phase {activeApplicant.phase} · {activeApplicant.status}
                </span>.
                <br />
                Document OCR biometric cross-validation unlocks once foreign employer hiring is confirmed (Phase 4+).
              </>
            ) : (
              'This module requires foreign employer acceptance to be recorded before document verification proceeds.'
            )}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {defaultQualified && (
              <button
                type="button"
                onClick={() => {
                  setActiveApplicantId(String(defaultQualified.id));
                  setOcrResult(null);
                }}
                className="px-4 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                <span>Switch to {defaultQualified.name} (#{defaultQualified.id} · Ph.{defaultQualified.phase} {defaultQualified.status})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setTestModeUnlocked(true)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-colors"
            >
              Unlock for Testing & Demo
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">

        {/* Upload State */}
        {!ocrResult ? (
          <div>
            <div className="bg-purple-50/50 border-2 border-dashed border-purple-300/80 rounded-2xl p-8 sm:p-12 text-center mb-6 hover:bg-purple-50/80 transition-colors">
              <Upload className="w-12 h-12 mx-auto text-purple-600 mb-3" />
              <h3 className="font-black text-slate-900 text-lg mb-1">
                Upload Document for Gemini Vision AI Inspection
              </h3>
              <p className="text-xs text-slate-500 mb-5 max-w-md mx-auto">
                Supported formats: Passport, Medical Certificate, or NBI Clearance (PNG, JPG, WebP, PDF up to 10 MB)
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileChange}
                className="hidden"
                id="doc-ocr-input"
              />

              <div className="flex flex-wrap items-center justify-center gap-3">
                <label
                  htmlFor="doc-ocr-input"
                  className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 shadow-sm cursor-pointer transition-all"
                >
                  {selectedFile ? `Selected: ${selectedFile.name}` : 'Choose File from Device'}
                </label>

                <button
                  onClick={() => handleUploadAndExtract()}
                  disabled={!selectedFile || isProcessing || isLocked}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Analyzing with Gemini AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>Run Gemini OCR & Verify</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleRunSampleDemo}
                  disabled={isProcessing || isLocked}
                  className="px-4 py-2.5 bg-sky-50 border border-sky-300 text-sky-700 text-xs font-bold rounded-lg hover:bg-sky-100 shadow-sm flex items-center gap-1.5 transition-all"
                >
                  <Eye size={14} />
                  <span>Test with Demo Passport</span>
                </button>
              </div>

              {previewUrl && (
                <div className="mt-6 flex flex-col items-center">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Document Image Preview
                  </span>
                  <img
                    src={previewUrl}
                    alt="Document preview"
                    className="max-h-48 rounded-lg shadow border border-slate-200"
                  />
                </div>
              )}
            </div>

            {/* Workflow Steps */}
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">
                Gemini Vision AI Cross-Verification Protocol:
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs text-slate-600">
                <div className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    1
                  </span>
                  <div>
                    <strong className="block text-slate-800">Vision Extraction</strong>
                    Extracts name, DOB, passport number, and MRZ lines.
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    2
                  </span>
                  <div>
                    <strong className="block text-slate-800">Benchmark Match</strong>
                    Compares against agency applicant database ground truth.
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    3
                  </span>
                  <div>
                    <strong className="block text-slate-800">Discrepancy Audit</strong>
                    Flags name spelling variances or DOB mismatches.
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    4
                  </span>
                  <div>
                    <strong className="block text-slate-800">3-2-1 Monitoring</strong>
                    Computes calendar days remaining before expiration.
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Results View */
          <div>
            {/* Top Status Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-slate-900 text-xl">
                    OCR Cross-Verification Results
                  </h3>
                  <span
                    className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full border ${
                      ocrResult.match_status === 'VERIFIED'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-amber-50 text-amber-700 border-amber-300'
                    }`}
                  >
                    {ocrResult.match_status === 'VERIFIED'
                      ? '✓ Biometric Match Verified'
                      : '⚠️ Discrepancy Flagged For Review'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Processed via Google Gemini Vision AI on{' '}
                  {new Date(ocrResult.processed_at).toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all"
                >
                  <RefreshCw size={13} />
                  <span>Scan Another Document</span>
                </button>
              </div>
            </div>

            {/* Side-by-Side Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* System Record */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    System Ground Truth Record
                  </span>
                  <span className="bg-slate-200 text-slate-700 font-mono text-[10px] px-2 py-0.5 rounded">
                    Applicant #{ocrResult.system_data.applicant_id || activeApplicantId}
                  </span>
                </div>
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                      Full Legal Name
                    </span>
                    <span className="font-bold text-slate-900 text-sm">
                      {ocrResult.system_data.full_name ||
                        `${ocrResult.system_data.first_name || ''} ${ocrResult.system_data.last_name || ''}`.trim() ||
                        'Juan Dela Cruz'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                      Date of Birth
                    </span>
                    <span className="font-bold text-slate-900">
                      {ocrResult.system_data.birth_date || '1998-05-15'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                      Passport Number
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {ocrResult.system_data.passport_number || 'P1234567B'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Extracted Document Data */}
              <div className="bg-purple-50/50 rounded-xl p-5 border border-purple-200">
                <div className="flex items-center justify-between mb-3 border-b border-purple-200 pb-2">
                  <span className="text-xs font-bold text-purple-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={13} className="text-purple-600" />
                    Extracted via Gemini Vision AI
                  </span>
                  <span className="bg-purple-100 text-purple-800 font-mono text-[10px] px-2 py-0.5 rounded uppercase font-bold">
                    {ocrResult.extracted_data.document_type || 'Passport'}
                  </span>
                </div>
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                      Full Legal Name
                    </span>
                    <span className="font-bold text-slate-900 text-sm">
                      {ocrResult.extracted_data.full_name ||
                        `${ocrResult.extracted_data.first_name || ''} ${ocrResult.extracted_data.last_name || ''}`.trim() ||
                        'Not Detected'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                      Date of Birth
                    </span>
                    <span className="font-bold text-slate-900">
                      {ocrResult.extracted_data.birth_date || 'Not Detected'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                      Passport Number
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {ocrResult.extracted_data.passport_number || 'Not Detected'}
                    </span>
                  </div>
                  {ocrResult.extracted_data.expiry_date && (
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                        Document Expiry Date
                      </span>
                      <span className="font-bold text-slate-900">
                        {ocrResult.extracted_data.expiry_date}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Discrepancies Alert Card */}
            {ocrResult.discrepancies && ocrResult.discrepancies.length > 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="w-full">
                    <p className="font-bold text-amber-900 text-xs uppercase tracking-wider mb-1">
                      Validation Mismatch Detected ({ocrResult.discrepancies.length})
                    </p>
                    <p className="text-xs text-amber-800 mb-3">
                      The document text extracted by Gemini does not exactly match the agency database records. Review required:
                    </p>

                    <div className="space-y-2">
                      {ocrResult.discrepancies.map((disc, idx) => (
                        <div
                          key={idx}
                          className="bg-white p-3 rounded-lg border border-amber-200 text-xs"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-slate-900">{disc.field}</span>
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                disc.severity === 'critical'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {disc.severity}
                            </span>
                          </div>
                          <p className="text-slate-600 text-[11px]">{disc.issue}</p>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded">
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase font-bold">
                                System Value:
                              </span>
                              <span className="font-semibold text-slate-700">
                                {disc.system_value || 'None'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase font-bold">
                                Extracted Value:
                              </span>
                              <span className="font-semibold text-slate-700">
                                {disc.extracted_value || 'None'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => {
                          showToast('Document rejected and applicant notified of variance.');
                          handleReset();
                        }}
                        className="px-3.5 py-1.5 bg-white border border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold rounded-lg transition-all"
                      >
                        Reject Document
                      </button>
                      <button
                        onClick={() => {
                          showToast('Verified with administrative variance note recorded.');
                          handleReset();
                        }}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                      >
                        Accept with Administrative Correction
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-6 flex items-center gap-3 text-emerald-900 text-xs">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <strong className="block text-emerald-800">
                    Zero Biometric Discrepancies Detected
                  </strong>
                  Extracted identity fields completely reconcile with the active agency applicant file.
                </div>
              </div>
            )}

            {/* 3-2-1 Expiration Monitoring Section */}
            {ocrResult.expiration_monitoring && (
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <FileCheck className="w-5 h-5 text-purple-600" />
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    POEA/DMW 3-2-1 Document Expiration Monitoring
                  </h4>
                </div>
                <p className="text-xs text-slate-600 mb-3">
                  {ocrResult.expiration_monitoring.message ||
                    'Automated expiration tracking is active for this identity document.'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Expiration Date
                    </span>
                    <span className="font-bold text-slate-800 text-sm">
                      {ocrResult.expiration_monitoring.expiry_date || 'N/A'}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Days Until Expiration
                    </span>
                    <span className="font-black text-slate-900 text-sm font-mono">
                      {ocrResult.expiration_monitoring.days_until_expiration ?? 'N/A'} days
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Alert Level
                    </span>
                    <span
                      className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                        ocrResult.expiration_monitoring.alert_level === 'normal'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ocrResult.expiration_monitoring.alert_level === 'yellow_60d'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {ocrResult.expiration_monitoring.alert_level || 'Normal'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Raw OCR Text Toggle */}
            {ocrResult.raw_text_preview && (
              <div className="pt-2 border-t border-slate-200">
                <button
                  onClick={() => setShowRawText(!showRawText)}
                  className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1.5"
                >
                  <FileText size={13} />
                  <span>{showRawText ? 'Hide Raw OCR Text' : 'Show Raw Gemini OCR Extracted Text'}</span>
                </button>
                {showRawText && (
                  <pre className="mt-3 p-4 bg-slate-900 text-slate-200 text-[11px] font-mono rounded-xl overflow-x-auto whitespace-pre-wrap max-h-48">
                    {ocrResult.raw_text_preview}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )}
  </div>
);
}
