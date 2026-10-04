import React, { useState, useEffect } from 'react';
import { 
  ScanText, FileCheck, CheckCircle2, AlertTriangle, Eye, Upload, 
  Check, X, Sparkles, ExternalLink, FileText, Loader2, ShieldCheck, Trash2
} from 'lucide-react';
import { ApplicantRecord, WorkflowState, ActivityLog } from '../../types';
import { api } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';

interface DocumentOCRProps {
  workflow: WorkflowState;
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  showToast: (message: string) => void;
  selectedApplicantId?: string;
  applicants?: ApplicantRecord[];
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

export default function DocumentOCR({
  workflow,
  currentUserName,
  addActivityLog,
  showToast,
  selectedApplicantId,
  applicants = []
}: DocumentOCRProps) {
  const phaseQualifiedApplicants = applicants.filter(a => {
    if (a.isStopped || a.status === 'Processing Stopped') return false;
    const st = String(a.status || (a as any).application_status || '').trim();
    return [
      'Endorse for Administrative Processing',
      'Ready for Deployment',
      'Deployed'
    ].includes(st);
  });
  
  const [activeApplicantId, setActiveApplicantId] = useState<string>(() => {
    if (selectedApplicantId && selectedApplicantId !== 'new' && !isNaN(Number(selectedApplicantId))) {
      return String(selectedApplicantId);
    }
    return '';
  });
  const [requirements, setRequirements] = useState<RequirementRecord[]>([]);
  const [selectedReq, setSelectedReq] = useState<RequirementRecord | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string | null>(null);
  const [ocrData, setOcrData] = useState<any>(null);
  const [autoOcrOnUpload, setAutoOcrOnUpload] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const [overrideData, setOverrideData] = useState<Record<string, any>>({});
  const [manualRemarks, setManualRemarks] = useState('');

  useEffect(() => {
    if (selectedApplicantId && selectedApplicantId !== 'new' && !isNaN(Number(selectedApplicantId))) {
      const match = phaseQualifiedApplicants.find(a => String(a.id) === String(selectedApplicantId));
      if (match) {
        setActiveApplicantId(String(selectedApplicantId));
      }
    }
  }, [selectedApplicantId, phaseQualifiedApplicants]);

  useEffect(() => {
    if (activeApplicantId) {
      const match = phaseQualifiedApplicants.find(a => String(a.id) === String(activeApplicantId));
      if (!match) {
        setActiveApplicantId('');
      }
    }
  }, [phaseQualifiedApplicants, activeApplicantId]);

  useEffect(() => {
    if (activeApplicantId && activeApplicantId !== 'new' && !isNaN(Number(activeApplicantId))) {
      loadRequirements(activeApplicantId);

      const channel = supabase
        .channel(`realtime:applicant_documents_${activeApplicantId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'applicant_requirement' },
          (payload: any) => {
            console.log('[DocumentOCR] Realtime applicant_requirement update:', payload.eventType);
            loadRequirements(activeApplicantId);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setRequirements([]);
      setSelectedReq(null);
      setPreviewUrl(null);
      setOcrData(null);
    }
  }, [activeApplicantId]);

  const loadRequirements = async (appId: string) => {
    if (!appId || appId === 'new' || isNaN(Number(appId))) {
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.get(`/documents/${appId}`);
      const reqList: RequirementRecord[] = res.data || [];
      setRequirements(reqList);
      
      if (reqList.length > 0 && !selectedReq) {
        handleSelectReq(reqList[0]);
      } else if (selectedReq) {
        const updated = reqList.find(r => r.applicant_req_id === selectedReq.applicant_req_id);
        if (updated) setSelectedReq(updated);
      }
    } catch (err: any) {
      showToast(`Failed to load requirements: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectReq = async (req: RequirementRecord) => {
    setSelectedReq(req);
    setOcrData(null);
    setOverrideData({});
    setManualRemarks('');
    
    if (req.file_url) {
      setPreviewUrl(req.file_url);
      setPreviewMime(req.mime_type || null);
    } else if (req.file_path) {
      try {
        const previewRes = await api.get(`/documents/${req.applicant_req_id}/preview`);
        if (previewRes.data?.signed_url) {
          setPreviewUrl(previewRes.data.signed_url);
          setPreviewMime(previewRes.data.mime_type || req.mime_type || null);
          if (previewRes.data.extracted_data) {
            setOcrData({
              extracted_data: previewRes.data.extracted_data,
              discrepancies: []
            });
            setOverrideData(previewRes.data.extracted_data);
          }
        }
      } catch (e) {
        setPreviewUrl(null);
        setPreviewMime(null);
      }
    } else {
      setPreviewUrl(null);
      setPreviewMime(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedReq) return;
    
    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const env = (import.meta as any).env || {};
      const baseUrl = env.VITE_API_BASE_URL || env.VITE_BACKEND_URL || 'http://localhost:8000';
      
      const queryParams = new URLSearchParams({
        applicant_id: activeApplicantId,
        requirement_id: String(selectedReq.requirement_id),
        run_ocr: autoOcrOnUpload ? 'true' : 'false'
      });
      
      const res = await fetch(`${baseUrl}/documents/${selectedReq.applicant_req_id}/upload?${queryParams.toString()}`, {
        method: 'POST',
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {},
        body: formData
      });
      
      if (!res.ok) {
        let errStr = res.statusText;
        try {
          const errData = await res.json();
          errStr = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
        } catch(e) {}
        throw new Error(errStr);
      }
      
      const data = await res.json();
      showToast('Document uploaded successfully');
      
      if (data.url) {
        setPreviewUrl(data.url);
      }
      setPreviewMime(file.type || 'application/pdf');

      if (data.ocr_extracted_data) {
        setOcrData({
          extracted_data: data.ocr_extracted_data,
          discrepancies: []
        });
        setOverrideData(data.ocr_extracted_data);
      }

      await loadRequirements(activeApplicantId);
    } catch (err: any) {
      showToast(`Upload failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const handleExtract = async () => {
    if (!selectedReq) return;
    setIsOcrProcessing(true);
    try {
      const res = await api.post(`/documents/${selectedReq.applicant_req_id}/ocr`);
      setOcrData(res.data);
      setOverrideData(res.data.extracted_data || {});
      showToast('AI OCR Extraction complete');
      
      addActivityLog({
        applicantId: activeApplicantId,
        action: 'AI OCR Extraction',
        performedBy: currentUserName,
        department: 'Processing',
        details: `Scanned ${selectedReq.requirement?.requirement_name} via Gemini Vision.`
      });
      
      loadRequirements(activeApplicantId);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message;
      showToast(`OCR error: ${msg}`);
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const handleVerify = async (status: 'VERIFIED' | 'REJECTED') => {
    if (!selectedReq) return;
    setIsProcessing(true);
    try {
      if (Object.keys(overrideData).length > 0) {
        await api.patch(`/documents/${selectedReq.applicant_req_id}/fields`, { 
          fields: overrideData,
          reason: manualRemarks || undefined
        });
      }
      await api.patch(`/documents/${selectedReq.applicant_req_id}/status`, { 
        new_status: status,
        reason: manualRemarks || undefined
      });
      
      showToast(`Document ${status === 'VERIFIED' ? 'Approved' : 'Rejected'}`);
      setOcrData(null);
      loadRequirements(activeApplicantId);
      
      addActivityLog({
        applicantId: activeApplicantId,
        action: `Document ${status === 'VERIFIED' ? 'Approved' : 'Rejected'}`,
        performedBy: currentUserName,
        department: 'Processing',
        details: `Requirement: ${selectedReq.requirement.requirement_name}`
      });
    } catch (err: any) {
      showToast(`Action failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveFile = () => {
    if (!selectedReq) return;
    setShowDeleteModal(true);
  };

  const handleConfirmRemoveFile = async () => {
    if (!selectedReq) return;

    setIsProcessing(true);
    try {
      await api.delete(`/documents/${selectedReq.applicant_req_id}/file`);
      showToast('File removed successfully');
      setShowDeleteModal(false);
      setPreviewUrl(null);
      setPreviewMime(null);
      setOcrData(null);
      setOverrideData({});
      setManualRemarks('');
      await loadRequirements(activeApplicantId);

      addActivityLog({
        applicantId: activeApplicantId,
        action: 'Removed File',
        performedBy: currentUserName,
        department: 'Processing',
        details: `Removed uploaded document for ${selectedReq.requirement.requirement_name}`
      });
    } catch (err: any) {
      showToast(`Failed to remove file: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const isPdf = previewUrl && (
    previewUrl.toLowerCase().includes('.pdf') || 
    previewMime?.toLowerCase().includes('pdf') ||
    previewUrl.includes('/pdf')
  );

  return (
    <div className="space-y-6 w-full pb-12">
      {/* ── Page Title Header ── */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight flex items-center gap-2.5">
            <ScanText className="w-6 h-6 text-[#0EA5E9]" />
            Document Validation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pre-deployment document verification and OCR cross-checking.
          </p>
        </div>
      </div>

      {/* ── Candidate Selector Bar ── */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="w-full sm:w-auto">
          <label className="text-xs font-semibold text-slate-700 block mb-1.5">Select Endorsed Administrative Candidate</label>
          <select
            value={activeApplicantId}
            onChange={e => setActiveApplicantId(e.target.value)}
            className="w-full sm:w-96 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:ring-2 focus:ring-[#0EA5E9] focus:border-[#0EA5E9] cursor-pointer"
          >
            <option value="">-- Choose Candidate --</option>
            {phaseQualifiedApplicants.map(app => (
              <option key={app.id} value={app.id}>
                {app.name} ({app.status || 'Endorsed for Admin'})
              </option>
            ))}
          </select>
        </div>
        
        {activeApplicantId && (() => {
          const activeApp = phaseQualifiedApplicants.find(a => String(a.id) === String(activeApplicantId));
          return activeApp ? (
            <div className="flex items-center gap-3 bg-slate-50 px-3.5 py-2 rounded-lg border border-slate-200">
              <div className="text-xs">
                <span className="block text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Assigned Handler</span>
                <span className="font-semibold text-slate-700">
                  {activeApp.currentHandler || 'Unassigned Pool'}
                </span>
              </div>
            </div>
          ) : null;
        })()}
      </div>

      {activeApplicantId && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* ── Left Column: Required Documents List ── */}
          <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 p-4 h-[640px] overflow-y-auto">
            <h3 className="font-semibold text-xs text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-[#0EA5E9]" /> Required Documents
            </h3>
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin mr-2 text-[#0EA5E9]" />
                Loading requirements...
              </div>
            ) : requirements.map(req => {
              const isSelected = selectedReq?.applicant_req_id === req.applicant_req_id;
              const hasFile = Boolean(req.file_url || req.file_path);
              const isVerified = (req.status || '').toUpperCase() === 'VERIFIED' || 
                                 (req.ocr_validation_status || '').toUpperCase() === 'VERIFIED';
              const isRejected = (req.status || '').toUpperCase() === 'REJECTED' || 
                                 (req.ocr_validation_status || '').toUpperCase() === 'INVALID';

              return (
                <div 
                  key={req.applicant_req_id}
                  onClick={() => handleSelectReq(req)}
                  className={`p-3 rounded-xl border mb-2.5 cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-sky-50/70 border-sky-300 ring-1 ring-[#0EA5E9]/25 shadow-xs' 
                      : 'bg-slate-50/50 border-slate-200 hover:border-sky-300 hover:bg-slate-50'
                  }`}
                >
                  <p className="font-semibold text-xs text-[#0F172A]">{req.requirement?.requirement_name}</p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      isVerified
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : isRejected
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : hasFile
                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {isVerified ? 'VERIFIED' : isRejected ? 'REJECTED' : hasFile ? 'SUBMITTED' : 'PENDING'}
                    </span>

                    {req.ocr_validation_status && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        OCR: {req.ocr_validation_status}
                      </span>
                    )}

                    {req.requirement?.ocr_enabled && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1 ml-auto font-medium">
                        <ScanText className="w-3 h-3" /> OCR
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Right Column: Document Viewer & Decision ── */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 flex flex-col h-[640px]">
            {selectedReq ? (
              <div className="flex flex-col h-full">
                {/* Header inside card */}
                <div className="p-3.5 sm:p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/80 rounded-t-xl gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-900 text-sm">{selectedReq.requirement.requirement_name}</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Upload button */}
                    <label className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{previewUrl ? 'Replace File' : 'Upload File'}</span>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*,application/pdf" 
                        onChange={handleFileUpload} 
                        disabled={isProcessing} 
                      />
                    </label>

                    {/* Remove File button */}
                    {previewUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        disabled={isProcessing}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Remove uploaded document"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Remove File</span>
                      </button>
                    )}

                    {/* Auto-OCR option */}
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 font-medium select-none cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={autoOcrOnUpload}
                        onChange={e => setAutoOcrOnUpload(e.target.checked)}
                        className="rounded text-[#0EA5E9] focus:ring-[#0EA5E9] w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>Auto-OCR</span>
                    </label>

                    {/* Open in full tab if preview exists */}
                    {previewUrl && (
                      <a 
                        href={previewUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-[#0EA5E9] hover:text-[#0284C7] flex items-center gap-1 px-2 py-1 hover:bg-slate-200/60 rounded"
                        title="Open file in new tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Full View
                      </a>
                    )}
                  </div>
                </div>

                {/* Split body: Preview on Left, Verification on Right */}
                <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2">
                  {/* Left: Document View */}
                  <div className="border-r border-slate-200 bg-slate-100/70 p-2 flex items-center justify-center overflow-hidden">
                    {isProcessing ? (
                      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-[#0EA5E9]" />
                        <span className="text-xs font-medium">Processing file...</span>
                      </div>
                    ) : previewUrl ? (
                      isPdf ? (
                        <iframe 
                          src={`${previewUrl}#toolbar=0&navpanes=0`} 
                          className="w-full h-full border-0 rounded-lg bg-white shadow-xs" 
                          title="PDF Preview"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center overflow-auto">
                          <img 
                            src={previewUrl} 
                            alt="Preview" 
                            className="max-w-full max-h-full object-contain rounded shadow-xs" 
                          />
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 p-6 text-center">
                        <FileText className="w-8 h-8 text-slate-300" />
                        <span className="text-xs font-medium text-slate-600">No file uploaded</span>
                        <span className="text-[11px] text-slate-400">Upload a PDF or image to inspect.</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Right: Verification & OCR Result */}
                  <div className="p-4 overflow-y-auto bg-slate-50/40 flex flex-col justify-between">
                    {isOcrProcessing ? (
                      <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-[#0EA5E9]" />
                        <span className="text-xs font-semibold text-slate-700">Scanning document with Gemini Vision...</span>
                        <span className="text-[11px] text-slate-400">Extracting fields and cross-checking candidate data.</span>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-xs text-[#0F172A]">Verification Result</h4>
                          {previewUrl && (
                            <button
                              type="button"
                              onClick={handleExtract}
                              className="text-xs font-semibold text-[#0284C7] hover:text-[#0369A1] bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-[#0EA5E9]" />
                              <span>{ocrData ? 'Re-run AI OCR' : 'Scan with AI OCR'}</span>
                            </button>
                          )}
                        </div>
                        
                        {ocrData ? (
                          <>
                            {ocrData.discrepancies?.length > 0 ? (
                              <div className="bg-rose-50 text-rose-800 p-3 rounded-lg border border-rose-200 text-xs">
                                <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-rose-600" /> Discrepancies Found</p>
                                <ul className="list-disc pl-5 mt-1.5 space-y-0.5">
                                  {ocrData.discrepancies.map((d: any, i: number) => <li key={i}>{d.field}: {d.issue}</li>)}
                                </ul>
                              </div>
                            ) : (
                              <div className="bg-emerald-50 text-emerald-800 p-2.5 rounded-lg border border-emerald-200 text-xs font-semibold flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> All fields match system records!
                              </div>
                            )}
                            
                            <div className="space-y-2 mt-3">
                              <h5 className="font-semibold text-[11px] uppercase tracking-wider text-slate-500">Extracted Fields (Editable)</h5>
                              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {Object.entries(overrideData).map(([key, val]) => (
                                  <div key={key}>
                                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">{key.replace(/_/g, ' ')}</label>
                                    <input 
                                      type="text"
                                      value={val as string || ''}
                                      onChange={e => setOverrideData({...overrideData, [key]: e.target.value})}
                                      className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-[#0EA5E9] focus:outline-none transition-colors"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-slate-600 bg-white border border-slate-200 p-3.5 rounded-lg space-y-1.5 shadow-xs">
                            <p className="font-semibold text-slate-800">Manual Verification Mode</p>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              Review the document preview on the left and manually approve or reject it. You do not need to run AI OCR to proceed.
                            </p>
                            {previewUrl && (
                              <p className="text-[11px] text-sky-700 font-medium pt-0.5">
                                Or click <strong>Scan with AI OCR</strong> above to extract text automatically.
                              </p>
                            )}
                          </div>
                        )}

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                            Auditor Remarks (Optional)
                          </label>
                          <input 
                            type="text"
                            placeholder="Add verification notes..."
                            value={manualRemarks}
                            onChange={e => setManualRemarks(e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-[#0EA5E9] focus:outline-none"
                          />
                        </div>
                        
                        <div className="flex gap-2 pt-2">
                          <button 
                            type="button"
                            onClick={() => handleVerify('VERIFIED')} 
                            disabled={isProcessing}
                            className="flex-1 bg-emerald-600 text-white font-semibold py-2 rounded-lg hover:bg-emerald-700 text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleVerify('REJECTED')} 
                            disabled={isProcessing}
                            className="flex-1 bg-rose-600 text-white font-semibold py-2 rounded-lg hover:bg-rose-700 text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <X className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                Select a requirement to review
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Confirmation Modal Overlay for File Deletion ── */}
      {showDeleteModal && selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 flex-shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Remove Uploaded File</h3>
                  <p className="text-[11px] text-slate-500">Document Removal Confirmation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isProcessing && setShowDeleteModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-white/80 transition-colors cursor-pointer"
                disabled={isProcessing}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 sm:p-6 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed">
                Are you sure you want to remove the uploaded file for{' '}
                <strong className="text-slate-900 font-semibold">{selectedReq.requirement.requirement_name}</strong>?
              </p>
              
              <div className="rounded-xl bg-amber-50/80 border border-amber-200/80 p-3.5 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-800 space-y-0.5">
                  <p className="font-semibold text-amber-900">Important Note:</p>
                  <p className="leading-normal">
                    This will delete the file from secure cloud storage and reset the status to{' '}
                    <strong className="font-bold text-amber-900">PENDING</strong>. Any pending OCR data will be cleared.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveFile}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Remove File</span>
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
