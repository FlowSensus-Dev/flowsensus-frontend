import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  ScanText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  RefreshCw,
  Copy,
  Check,
  FileText,
  ShieldCheck,
  Cpu,
  Eye,
  ArrowRight,
  Sparkles,
  AlertCircle,
  FileUp,
} from 'lucide-react';
import { WorkflowState, ActivityLog, ApplicantRecord } from '../../../app/types';
import { apiService } from '../../../lib/api';
import type {
  OCRStatusResponse,
  OCRRawExtractResponse,
  OCRVerificationResponse,
  ExtractedData,
} from '../../../types/ocr';

interface DocumentOCRProps {
  workflow: WorkflowState;
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  showToast: (message: string) => void;
  selectedApplicantId?: string;
  applicants?: ApplicantRecord[];
}

export default function DocumentOCR({
  workflow,
  currentUserName,
  addActivityLog,
  showToast,
  selectedApplicantId = 'APP-2026-089',
  applicants = [],
}: DocumentOCRProps) {
  // Workflow lock state (with bypass toggle for testing)
  const isWorkflowLocked = !workflow.employerAccepted;
  const [bypassLock, setBypassLock] = useState(false);
  const isLocked = isWorkflowLocked && !bypassLock;

  // Tabs: 'extract' (Direct OCR Playground) vs 'verify' (Applicant Verification)
  const [activeTab, setActiveTab] = useState<'extract' | 'verify'>('extract');

  // Selected applicant for verification mode
  const [currentAppId, setCurrentAppId] = useState<string>(selectedApplicantId);

  // Engine diagnostic status
  const [ocrStatus, setOcrStatus] = useState<OCRStatusResponse | null>(null);
  const [checkingEngine, setCheckingEngine] = useState(false);

  // File state & preview
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Processing & result states
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractResult, setExtractResult] = useState<OCRRawExtractResponse | null>(null);
  const [verifyResult, setVerifyResult] = useState<OCRVerificationResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRawText, setShowRawText] = useState(false);
  const [copiedRawText, setCopiedRawText] = useState(false);

  // Check OCR engine health on mount
  const checkEngineHealth = async () => {
    setCheckingEngine(true);
    try {
      const res = await apiService.ocr.checkStatus();
      setOcrStatus(res.data);
    } catch (err: any) {
      console.warn('OCR engine status check failed:', err);
      setOcrStatus({
        available: false,
        error: err.response?.data?.detail || err.message || 'Unable to connect to OCR backend',
      });
    } finally {
      setCheckingEngine(false);
    }
  };

  useEffect(() => {
    checkEngineHealth();
  }, []);

  // Update applicant ID if passed prop changes
  useEffect(() => {
    if (selectedApplicantId) {
      setCurrentAppId(selectedApplicantId);
    }
  }, [selectedApplicantId]);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Handle file selection
  const handleFileChange = (file: File) => {
    setErrorMsg(null);
    setSelectedFile(file);
    setExtractResult(null);
    setVerifyResult(null);

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileChange(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileChange(file);
  };

  // Generate a synthetic Philippine Passport canvas image for instant 1-click test
  const handleGenerateSamplePassport = (variant: 'matching' | 'mismatched' = 'matching') => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isMismatched = variant === 'mismatched';
    const passportNo = isMismatched ? 'P8923411A' : 'P1234567';
    const surname = isMismatched ? 'SANTOS' : 'DELA CRUZ';
    const givenNames = isMismatched ? 'MARIA' : 'JUAN';
    const nationality = 'PHILIPPINES';
    const dob = isMismatched ? '20 AUG 1995' : '15 MAR 1992';
    const sex = isMismatched ? 'F' : 'M';
    const expiry = isMismatched ? '10 OCT 2024' : '15 MAR 2032';

    // MRZ Lines (exactly 44 characters per ICAO Doc 9303 Type 3)
    const mrzLine1 = isMismatched
      ? 'P<PHLSANTOS<<MARIA<<<<<<<<<<<<<<<<<<<<<<<<<<'
      : 'P<PHLDELA<CRUZ<<JUAN<<<<<<<<<<<<<<<<<<<<<<<<';
    const mrzLine2 = isMismatched
      ? 'P8923411A3PHL9508204F2410108<<<<<<<<<<<<<<02'
      : 'P1234567<4PHL9203154M3203158<<<<<<<<<<<<<<02';

    // Background passport page
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 1200, 800);

    // Header banner
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, 1200, 95);

    // Header text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.fillText('REPUBLIKA NG PILIPINAS / REPUBLIC OF THE PHILIPPINES', 40, 42);

    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText('PASSPORT / PASAPORTE', 40, 75);

    // Passport Number
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillText('PASSPORT NO. / NUMERO:', 40, 140);
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText(passportNo, 40, 168);

    // Surname
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillText('SURNAME / APELYIDO:', 40, 220);
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText(surname, 40, 248);

    // Given names
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillText('GIVEN NAMES / MGA PANGALAN:', 40, 300);
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText(givenNames, 40, 328);

    // Nationality & DOB & Sex
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillText('NATIONALITY / MAMAMAYAN:', 40, 380);
    ctx.fillText('DATE OF BIRTH:', 480, 380);
    ctx.fillText('SEX:', 850, 380);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.fillText(nationality, 40, 408);
    ctx.fillText(dob, 480, 408);
    ctx.fillText(sex, 850, 408);

    // Expiry date
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillText('DATE OF EXPIRY / PETSA NG PAGKAPASO:', 40, 460);
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.fillText(expiry, 40, 488);

    // Machine Readable Zone (MRZ Lines) at bottom
    ctx.fillStyle = '#F1F5F9';
    ctx.fillRect(30, 560, 1140, 195);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 560, 1140, 195);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 28px "Courier New", "Lucida Console", monospace';
    ctx.fillText(mrzLine1, 60, 625);
    ctx.fillText(mrzLine2, 60, 695);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const filename = isMismatched ? 'sample_mismatched_passport.png' : 'sample_matching_passport.png';
      const file = new File([blob], filename, { type: 'image/png' });
      handleFileChange(file);
      showToast(
        isMismatched
          ? '⚠ Mismatched sample passport loaded (Maria Santos) — ready to analyze discrepancy detection.'
          : '✓ Matching sample passport loaded (Juan Dela Cruz) — ready for verification.'
      );
    }, 'image/png');
  };

  // Run OCR Extraction
  const handleExecuteOCR = async () => {
    if (!selectedFile) {
      showToast('Please select or upload a document file first.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      if (activeTab === 'extract') {
        // Direct extraction mode
        const response = await apiService.ocr.extract(selectedFile);
        const data = response.data;
        setExtractResult(data);

        addActivityLog({
          applicantId: currentAppId,
          action: 'Document OCR Extraction',
          performedBy: currentUserName,
          department: 'Admin',
          details: `Processed document "${selectedFile.name}" (${(selectedFile.size / 1024).toFixed(1)} KB) via Google Gemini Vision AI. Extracted ${data.charCount || data.char_count || 0} characters.`,
        });

        showToast('✓ OCR text extraction complete!');
      } else {
        // Applicant verification mode
        // Find applicant ID (numeric or fallback)
        const numericId = parseInt(currentAppId.replace(/\D/g, '') || '1', 10);
        const response = await apiService.ocr.verify(numericId, selectedFile);
        const data = response.data;
        setVerifyResult(data);

        addActivityLog({
          applicantId: currentAppId,
          action: 'Applicant Document Verification',
          performedBy: currentUserName,
          department: 'Admin',
          details: `Verified document "${selectedFile.name}" against applicant record #${numericId}. Status: ${data.matchStatus || data.match_status}. Discrepancies: ${data.discrepancies?.length || 0}.`,
        });

        const statusLabel = (data.matchStatus || data.match_status) === 'VERIFIED' ? 'Verified' : 'Flagged for Review';
        showToast(`✓ Document verification complete: ${statusLabel}`);
      }
    } catch (err: any) {
      console.error('OCR operation failed:', err);
      const detail = err.response?.data?.detail || err.message || 'OCR processing failed. Please verify that the backend is running.';
      setErrorMsg(detail);
      showToast(`✕ OCR error: ${detail}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Copy raw text helper
  const handleCopyRawText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRawText(true);
    setTimeout(() => setCopiedRawText(false), 2000);
    showToast('Raw OCR text copied to clipboard');
  };

  // Resolve active applicant record for UI display
  const currentApplicantRecord = applicants.find(
    (a) => a.id === currentAppId || String(a.applicant_id) === currentAppId
  );

  // Helper to extract clean field values
  const getField = (data: ExtractedData | undefined, ...keys: (keyof ExtractedData)[]) => {
    if (!data) return '—';
    for (const k of keys) {
      if (data[k]) return String(data[k]);
    }
    return '—';
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center text-[#8B5CF6]">
              <ScanText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">
                Document OCR & Automated Verification
              </h2>
              <p className="text-xs text-[#64748B] font-medium">
                High-accuracy identity extraction via Google Gemini Vision AI with biometric cross-validation
              </p>
            </div>
          </div>
        </div>

        {/* OCR Engine Diagnostic Badge */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
              ocrStatus?.available
                ? 'bg-purple-50 text-purple-700 border-purple-200 shadow-sm'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            {ocrStatus?.available ? (
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            ) : (
              <Cpu className="w-3.5 h-3.5" />
            )}
            <span>
              {checkingEngine
                ? 'Checking Engine...'
                : ocrStatus?.available
                ? 'Google Gemini Vision Active (AI Cloud)'
                : 'Gemini Vision Offline (Check API Key)'}
            </span>
            <button
              onClick={checkEngineHealth}
              title="Refresh Engine Status"
              className="ml-1 hover:opacity-75 transition-opacity"
            >
              <RefreshCw className={`w-3 h-3 ${checkingEngine ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Workflow Lock Warning Banner with Bypass Toggle */}
      {isWorkflowLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold">Standard Workflow Lock: Employer Acceptance Required</p>
              <p className="text-xs text-amber-700 mt-0.5">
                In normal agency operations, OCR verification unlocks once an employer accepts the applicant.
              </p>
            </div>
          </div>
          <button
            onClick={() => setBypassLock(!bypassLock)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto ${
              bypassLock
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white border border-amber-300 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {bypassLock ? 'Test Mode Active (Unlocked)' : 'Unlock for Testing'}
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
        {/* Access Restriction Overlay if locked and not bypassed */}
        {isLocked && (
          <div className="absolute inset-0 bg-[#F8FAFC]/95 backdrop-blur-sm flex flex-col items-center justify-center z-20 p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4 border border-slate-200">
              <Lock className="w-7 h-7" />
            </div>
            <h3 className="font-extrabold text-[#0F172A] text-xl mb-2">Access Restricted</h3>
            <p className="text-sm text-[#64748B] max-w-md mb-6">
              This module requires employer acceptance to be recorded by Management in the deployment workflow.
            </p>
            <button
              onClick={() => setBypassLock(true)}
              className="px-5 py-2.5 bg-[#8B5CF6] text-white text-xs font-bold rounded-lg hover:bg-[#7C3AED] shadow-sm flex items-center gap-2 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Bypass Lock to Test OCR Features Now
            </button>
          </div>
        )}

        {/* Mode Selector Tabs */}
        <div className="border-b border-slate-200 px-6 pt-4 flex items-center justify-between bg-slate-50/50">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setActiveTab('extract');
                setExtractResult(null);
                setVerifyResult(null);
                setErrorMsg(null);
              }}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'extract'
                  ? 'border-[#8B5CF6] text-[#8B5CF6]'
                  : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <FileUp className="w-4 h-4" />
              Direct Extraction (Test Sandbox)
            </button>
            <button
              onClick={() => {
                setActiveTab('verify');
                setExtractResult(null);
                setVerifyResult(null);
                setErrorMsg(null);
              }}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'verify'
                  ? 'border-[#8B5CF6] text-[#8B5CF6]'
                  : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Applicant Cross-Verification
            </button>
          </div>

          {/* Quick 1-Click Test Buttons (Matching vs Mismatched) */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <button
              onClick={() => handleGenerateSamplePassport('matching')}
              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
              title="Generate a valid matching sample passport (Juan Dela Cruz) to test verified flow"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Matching Sample</span>
            </button>

            <button
              onClick={() => handleGenerateSamplePassport('mismatched')}
              className="px-3 py-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
              title="Generate a mismatched sample passport (Maria Santos) to test discrepancy flagging and review alerts"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Mismatched Sample</span>
            </button>
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          {/* If in Verification mode, select the applicant */}
          {activeTab === 'verify' && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <label className="text-xs font-bold text-[#0F172A] block mb-1">
                  Select Applicant to Cross-Validate Against
                </label>
                <p className="text-xs text-[#64748B]">
                  OCR extracted name, DOB, and passport number will be compared with this record in real-time.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={currentAppId}
                  onChange={(e) => setCurrentAppId(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-[#0F172A] outline-none focus:ring-2 focus:ring-[#8B5CF6] transition-all"
                >
                  {applicants.length > 0 ? (
                    applicants.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.id})
                      </option>
                    ))
                  ) : (
                    <option value="APP-2026-089">Juan Dela Cruz (APP-2026-089)</option>
                  )}
                </select>
                {currentApplicantRecord && (
                  <div className="text-xs bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-[#475569]">
                    DOB: <strong>{currentApplicantRecord.dateOfBirth || currentApplicantRecord.birth_date || '1992-03-15'}</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              dragOver
                ? 'border-[#8B5CF6] bg-[#8B5CF6]/10 scale-[0.99]'
                : selectedFile
                ? 'border-emerald-300 bg-emerald-50/40'
                : 'border-slate-300 hover:border-[#8B5CF6]/60 bg-slate-50/60 hover:bg-[#8B5CF6]/5'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              className="hidden"
              onChange={onFileInputChange}
            />

            <div className="flex flex-col items-center">
              {selectedFile ? (
                <div className="space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#10B981]/15 text-[#10B981] flex items-center justify-center mx-auto shadow-sm">
                    <FileCheck className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-[#0F172A] text-sm">{selectedFile.name}</h4>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      {(selectedFile.size / 1024).toFixed(1)} KB · {selectedFile.type || 'Document'} · Click or drop to replace
                    </p>
                  </div>
                  {previewUrl && (
                    <div className="mt-3 inline-block rounded-lg overflow-hidden border border-slate-200 shadow-sm max-h-48 max-w-sm">
                      <img src={previewUrl} alt="Document Preview" className="object-contain max-h-48" />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-[#8B5CF6]/10 text-[#8B5CF6] flex items-center justify-center mb-3">
                    <Upload className="w-7 h-7" />
                  </div>
                  <h4 className="font-extrabold text-[#0F172A] text-base mb-1">
                    Drag & Drop Document Scan or Click to Browse
                  </h4>
                  <p className="text-xs text-[#64748B] max-w-md">
                    Supports Passport biographical page, Medical Certificate, NBI Clearance, or Training PDF
                    (JPG, PNG, WebP, PDF up to 10MB)
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Action Button & Processing Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-[#64748B]">
              {selectedFile ? (
                <span className="font-medium text-purple-700">Ready to process with Google Gemini Vision AI</span>
              ) : (
                <span>Select a file or click <strong>Load Sample Passport</strong> above</span>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {selectedFile && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    setExtractResult(null);
                    setVerifyResult(null);
                  }}
                  className="px-4 py-2.5 text-xs font-bold text-[#64748B] hover:text-[#0F172A] transition-colors"
                >
                  Clear
                </button>
              )}

              <button
                type="button"
                onClick={handleExecuteOCR}
                disabled={!selectedFile || isProcessing}
                className={`w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-bold text-white shadow-sm flex items-center justify-center gap-2 transition-all ${
                  !selectedFile || isProcessing
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-[#8B5CF6] hover:bg-[#7C3AED] hover:shadow-md active:scale-95'
                }`}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processing with Gemini Vision AI...
                  </>
                ) : activeTab === 'extract' ? (
                  <>
                    <ScanText className="w-4 h-4" />
                    Extract Document Text
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Verify Against Applicant Profile
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-900">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold">OCR Execution Error</p>
                <p className="text-xs text-red-700 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* ── Extraction Results Display ── */}
          {extractResult && (
            <div className="space-y-6 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-[#0F172A] text-lg flex items-center gap-2">
                    {(extractResult.charCount || extractResult.char_count || 0) > 0 ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                        OCR Extraction Completed
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        Extraction Returned No Text
                      </>
                    )}
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Analyzed {extractResult.charCount || extractResult.char_count || 0} characters from document
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-[#8B5CF6]/10 text-[#8B5CF6] text-xs font-bold rounded-full border border-[#8B5CF6]/20">
                    {extractResult.documentType || extractResult.document_type || 'Passport'}
                  </span>
                  {(extractResult.extractedData?.mrzDetected ||
                    extractResult.extractedData?.mrz_detected ||
                    extractResult.extracted_data?.mrz_detected) && (
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
                      MRZ Verified
                    </span>
                  )}
                </div>
              </div>

              {/* Parsed Fields Grid */}
              {(() => {
                const data = extractResult.extractedData || extractResult.extracted_data;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                        Full Name
                      </p>
                      <p className="text-sm font-extrabold text-[#0F172A]">
                        {getField(data, 'fullName', 'full_name') !== '—'
                          ? getField(data, 'fullName', 'full_name')
                          : `${getField(data, 'firstName', 'first_name')} ${getField(data, 'lastName', 'last_name')}`.trim() || '—'}
                      </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                        Middle Name
                      </p>
                      <p className="text-sm font-extrabold text-[#0F172A]">
                        {getField(data, 'middleName', 'middle_name') !== '—' ? (
                          getField(data, 'middleName', 'middle_name')
                        ) : (
                          <span className="text-slate-400 font-normal italic">None (null)</span>
                        )}
                      </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                        Passport / ID Number
                      </p>
                      <p className="text-sm font-extrabold text-[#0F172A] font-mono">
                        {getField(data, 'passportNumber', 'passport_number')}
                      </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                        Date of Birth
                      </p>
                      <p className="text-sm font-extrabold text-[#0F172A]">
                        {getField(data, 'birthDate', 'birth_date')}
                      </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                        Expiry Date
                      </p>
                      <p className="text-sm font-extrabold text-[#0F172A]">
                        {getField(data, 'expiryDate', 'expiry_date')}
                      </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                        Nationality
                      </p>
                      <p className="text-sm font-extrabold text-[#0F172A]">
                        {getField(data, 'nationality')}
                      </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                        Sex
                      </p>
                      <p className="text-sm font-extrabold text-[#0F172A]">
                        {getField(data, 'sex')}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Raw OCR Text Collapsible */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowRawText(!showRawText)}
                  className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-[#0F172A] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#8B5CF6]" />
                    Raw OCR Output Inspector
                  </span>
                  <span className="text-[#64748B]">{showRawText ? 'Hide Text ▲' : 'Show Text ▼'}</span>
                </button>

                {showRawText && (
                  <div className="p-4 bg-[#0F172A] text-slate-200 font-mono text-xs relative">
                    <button
                      onClick={() => handleCopyRawText(extractResult.rawText || extractResult.raw_text || '')}
                      className="absolute top-3 right-3 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-[11px] font-bold flex items-center gap-1 border border-slate-700 transition-all"
                    >
                      {copiedRawText ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy
                        </>
                      )}
                    </button>
                    <pre className="whitespace-pre-wrap max-h-60 overflow-y-auto pr-16 leading-relaxed">
                      {extractResult.rawText || extractResult.raw_text || 'No text extracted.'}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Verification Results Display ── */}
          {verifyResult && (
            <div className="space-y-6 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-[#0F172A] text-lg flex items-center gap-2">
                    {(verifyResult.matchStatus || verifyResult.match_status) === 'VERIFIED' ? (
                      <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
                    )}
                    Verification Result: {(verifyResult.matchStatus || verifyResult.match_status) === 'VERIFIED' ? 'Verified' : 'Flagged for Review'}
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Biometric cross-validation comparison with database record
                  </p>
                </div>

                <span
                  className={`px-3 py-1 text-xs font-bold rounded-full border ${
                    (verifyResult.matchStatus || verifyResult.match_status) === 'VERIFIED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  {(verifyResult.matchStatus || verifyResult.match_status) === 'VERIFIED'
                    ? '✓ Document Verified'
                    : '⚠ Discrepancy Flagged'}
                </span>
              </div>

              {/* Side-by-Side Comparison */}
              {(() => {
                const sys = verifyResult.systemData || verifyResult.system_data;
                const ext = verifyResult.extractedData || verifyResult.extracted_data;

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* System Record */}
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-3">
                      <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                        System Record (Supabase)
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-[#64748B]">Full Name:</span>
                          <span className="font-extrabold text-[#0F172A]">
                            {sys?.fullName || sys?.full_name || `${sys?.firstName || ''} ${sys?.lastName || ''}`.trim() || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-[#64748B]">Middle Name:</span>
                          <span className="font-extrabold text-[#0F172A]">
                            {sys?.middleName || sys?.middle_name || <span className="text-slate-400 font-normal italic">None (null)</span>}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-[#64748B]">Birth Date:</span>
                          <span className="font-extrabold text-[#0F172A]">
                            {sys?.birthDate || sys?.birth_date || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-[#64748B]">Passport No:</span>
                          <span className="font-extrabold text-[#0F172A] font-mono">
                            {sys?.passportNumber || sys?.passport_number || '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Extracted from Document */}
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-3">
                      <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                        Extracted from Document (OCR)
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-[#64748B]">Full Name:</span>
                          <span className="font-extrabold text-[#0F172A]">
                            {getField(ext, 'fullName', 'full_name')}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-[#64748B]">Middle Name:</span>
                          <span className="font-extrabold text-[#0F172A]">
                            {getField(ext, 'middleName', 'middle_name') !== '—' ? (
                              getField(ext, 'middleName', 'middle_name')
                            ) : (
                              <span className="text-slate-400 font-normal italic">None (null)</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-[#64748B]">Birth Date:</span>
                          <span className="font-extrabold text-[#0F172A]">
                            {getField(ext, 'birthDate', 'birth_date')}
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-[#64748B]">Passport No:</span>
                          <span className="font-extrabold text-[#0F172A] font-mono">
                            {getField(ext, 'passportNumber', 'passport_number')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Discrepancies Alert */}
              {verifyResult.discrepancies && verifyResult.discrepancies.length > 0 ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-red-900 font-extrabold text-sm">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    Detected Mismatches ({verifyResult.discrepancies.length})
                  </div>
                  <div className="divide-y divide-red-100">
                    {verifyResult.discrepancies.map((d, i) => (
                      <div key={i} className="py-2 text-xs text-red-900 flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold uppercase tracking-wider bg-red-200/70 text-red-800 px-2 py-0.5 rounded">
                            {d.field}
                          </span>
                          <span className="text-red-700">{d.issue}</span>
                        </div>
                        <div className="text-[11px] text-red-800 ml-1">
                          System: <strong className="font-mono">{d.systemValue || d.system_value || 'None'}</strong> · Document:{' '}
                          <strong className="font-mono">{d.extractedValue || d.extracted_value || 'None'}</strong>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => showToast('Document rejected and logged in compliance audit trail.')}
                      className="px-4 py-2 bg-white border border-red-300 text-red-700 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors"
                    >
                      Reject Document
                    </button>
                    <button
                      onClick={() => showToast('Discrepancy accepted with supervisor note.')}
                      className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 shadow-sm"
                    >
                      Accept with Correction
                    </button>
                  </div>
                </div>
              ) : (verifyResult.matchStatus || verifyResult.match_status) === 'VERIFIED' ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 text-emerald-900">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div className="text-xs">
                    <p className="font-extrabold">All Biometric Fields Match</p>
                    <p className="text-emerald-700 mt-0.5">
                      Name, birth date, and passport number match the existing applicant record in the database.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-900">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div className="text-xs">
                    <p className="font-extrabold">Verification Incomplete or Flagged</p>
                    <p className="text-amber-700 mt-0.5">
                      Document identity data could not be fully verified against the system record.
                    </p>
                  </div>
                </div>
              )}

              {/* 3-2-1 Expiration Monitoring */}
              {(() => {
                const exp = verifyResult.expirationMonitoring || verifyResult.expiration_monitoring;
                if (!exp) return null;

                return (
                  <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <FileCheck className="w-5 h-5 text-[#10B981]" />
                      <h4 className="font-extrabold text-[#0F172A] text-sm">
                        3-2-1 Expiration Monitoring Activated
                      </h4>
                      <span className="ml-auto text-xs px-2.5 py-0.5 rounded-full bg-white border border-[#10B981]/30 font-bold text-[#10B981]">
                        {exp.daysUntilExpiration ?? exp.days_until_expiration != null
                          ? `${exp.daysUntilExpiration ?? exp.days_until_expiration} days remaining`
                          : 'Active Tracking'}
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B]">
                      {exp.message || 'Document expiration tracking is now active. Expiration alert threshold rules:'}
                    </p>
                    <ul className="text-xs text-[#64748B] mt-2 space-y-1 ml-4 list-disc">
                      <li>60 days before expiration (Yellow warning alert)</li>
                      <li>30 days before expiration (Amber urgent alert)</li>
                      <li>Upon expiration (Red critical alert)</li>
                    </ul>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
