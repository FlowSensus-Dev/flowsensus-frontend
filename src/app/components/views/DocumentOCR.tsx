import { useState } from 'react';
import { Lock, ScanText, Upload, CheckCircle, AlertTriangle, FileCheck } from 'lucide-react';
import { WorkflowState, ActivityLog } from '../../types';

interface DocumentOCRProps {
  workflow: WorkflowState;
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  showToast: (message: string) => void;
  selectedApplicantId?: string;
}

export default function DocumentOCR({ workflow, currentUserName, addActivityLog, showToast, selectedApplicantId = 'APP-2026-089' }: DocumentOCRProps) {
  const isLocked = !workflow.employerAccepted;
  const [ocrProcessed, setOcrProcessed] = useState(false);

  const handleUploadAndExtract = () => {
    setOcrProcessed(true);

    addActivityLog({
      applicantId: selectedApplicantId,
      action: 'Document OCR Processing',
      performedBy: currentUserName,
      department: 'Admin',
      details:
        'Passport uploaded and processed via OCR. Text extracted and cross-validated against system records. Mismatch detected: Name spelling variance flagged for manual review.',
    });

    showToast('✓ OCR processing complete. Document flagged for review due to detected mismatch.');
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="mb-6">
        <h2 className="text-3xl font-extrabold tracking-tight">
          <ScanText className="w-8 h-8 inline-block mr-2 text-[#8B5CF6]" />
          Document OCR & Validation
        </h2>
        <p className="text-sm text-[#64748B] mt-1 font-medium">
          Automated text extraction with cross-validation against system records
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 relative">
        {isLocked && (
          <div className="absolute inset-0 bg-[#F1F5F9]/90 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg p-8">
            <Lock className="w-12 h-12 text-slate-400 mb-4" />
            <h3 className="font-black text-[#0F172A] text-xl mb-3">Access Restricted</h3>
            <p className="text-sm text-[#64748B] text-center max-w-lg">
              This module requires employer acceptance to be recorded by Management.
            </p>
          </div>
        )}

        {/* Upload Section */}
        {!ocrProcessed ? (
          <div>
            <div className="bg-[#8B5CF6]/10 border-2 border-dashed border-[#8B5CF6]/30 rounded-lg p-12 text-center mb-6">
              <Upload className="w-12 h-12 mx-auto text-[#8B5CF6] mb-4" />
              <h3 className="font-bold text-[#0F172A] mb-2">Upload Document for OCR Processing</h3>
              <p className="text-sm text-[#64748B] mb-4">Supported: Passport, Medical Certificate, NBI Clearance</p>
              <button
                onClick={handleUploadAndExtract}
                disabled={isLocked}
                className="px-6 py-3 bg-[#8B5CF6] text-white text-sm font-bold hover:bg-[#7C3AED] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload Passport & Run OCR
              </button>
            </div>

            <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
              <h4 className="font-bold text-[#0F172A] mb-3">OCR Process Flow:</h4>
              <div className="space-y-2 text-sm text-[#64748B]">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#0EA5E9] text-white flex items-center justify-center text-xs font-bold">
                    1
                  </span>
                  Extract text from uploaded document image
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#0EA5E9] text-white flex items-center justify-center text-xs font-bold">
                    2
                  </span>
                  Cross-validate against system demographic records
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#0EA5E9] text-white flex items-center justify-center text-xs font-bold">
                    3
                  </span>
                  Flag mismatches for Admin review
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#0EA5E9] text-white flex items-center justify-center text-xs font-bold">
                    4
                  </span>
                  Activate 3-2-1 expiration monitoring
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {/* OCR Results */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-[#0F172A] text-lg">OCR Extraction Results</h3>
                <span className="px-3 py-1 bg-[#10B981]/10 text-[#10B981] text-xs font-bold uppercase tracking-wider rounded-full border border-[#10B981]/30">
                  ✓ Processing Complete
                </span>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                  <p className="text-xs font-bold text-[#64748B] uppercase mb-3">System Record</p>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-[#64748B]">Name:</span>{' '}
                      <span className="font-bold text-[#0F172A]">Juan Dela Cruz</span>
                    </div>
                    <div>
                      <span className="text-[#64748B]">DOB:</span>{' '}
                      <span className="font-bold text-[#0F172A]">March 15, 1992</span>
                    </div>
                    <div>
                      <span className="text-[#64748B]">ID:</span>{' '}
                      <span className="font-bold text-[#0F172A]">APP-2026-089</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                  <p className="text-xs font-bold text-[#64748B] uppercase mb-3">Extracted from Passport (OCR)</p>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-[#64748B]">Name:</span>{' '}
                      <span className="font-bold text-[#EF4444]">Juan P. Dela Cruz</span>
                      <AlertTriangle className="w-3 h-3 inline-block ml-1 text-[#EF4444]" />
                    </div>
                    <div>
                      <span className="text-[#64748B]">DOB:</span>{' '}
                      <span className="font-bold text-[#10B981]">15 Mar 1992</span>
                      <CheckCircle className="w-3 h-3 inline-block ml-1 text-[#10B981]" />
                    </div>
                    <div>
                      <span className="text-[#64748B]">Passport No:</span>{' '}
                      <span className="font-bold text-[#0F172A]">P1234567</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mismatch Alert */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
                <div className="flex items-start gap-4">
                  <AlertTriangle className="w-6 h-6 text-[#EF4444] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-[#EF4444] mb-2">Validation Mismatch Detected</p>
                    <p className="text-sm text-[#0F172A] mb-3">
                      <span className="font-bold">Field:</span> Full Name
                      <br />
                      <span className="font-bold">Issue:</span> Middle initial "P." appears in passport but not in
                      system record
                      <br />
                      <span className="font-bold">Status:</span> Flagged for manual Admin review
                    </p>
                    <div className="flex gap-3">
                      <button className="px-4 py-2 bg-white border-2 border-[#EF4444] text-[#EF4444] text-xs font-bold rounded-lg hover:bg-[#EF4444] hover:text-white transition-colors">
                        Reject Document
                      </button>
                      <button className="px-4 py-2 bg-[#EF4444] text-white text-xs font-bold rounded-lg hover:bg-[#DC2626]">
                        Accept with Correction
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3-2-1 Activation */}
              <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                  <FileCheck className="w-6 h-6 text-[#10B981]" />
                  <h4 className="font-bold text-[#0F172A]">3-2-1 Expiration Monitoring Activated</h4>
                </div>
                <p className="text-sm text-[#64748B]">
                  Document expiration tracking is now active. System will trigger alerts at:
                </p>
                <ul className="text-sm text-[#64748B] mt-2 space-y-1 ml-4 list-disc">
                  <li>60 days before expiration (Yellow alert)</li>
                  <li>30 days before expiration (Amber alert)</li>
                  <li>Upon expiration (Red alert)</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
