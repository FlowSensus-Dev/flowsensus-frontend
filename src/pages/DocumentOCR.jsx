import { ScanText, Upload } from 'lucide-react';

export default function DocumentOCR() {
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

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
        <div className="bg-[#8B5CF6]/10 border-2 border-dashed border-[#8B5CF6]/30 rounded-lg p-12 text-center mb-6">
          <Upload className="w-12 h-12 mx-auto text-[#8B5CF6] mb-4" />
          <h3 className="font-bold text-[#0F172A] mb-2">Upload Document for OCR Processing</h3>
          <p className="text-sm text-[#64748B] mb-4">Supported: Passport, Medical Certificate, NBI Clearance</p>
          <button
            disabled
            title="OCR processing is not available yet"
            className="px-6 py-3 bg-[#8B5CF6] text-white text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Upload Passport & Run OCR
          </button>
        </div>

        <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
          <h4 className="font-bold text-[#0F172A] mb-3">OCR Process Flow:</h4>
          <div className="space-y-2 text-sm text-[#64748B]">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#0EA5E9] text-white flex items-center justify-center text-xs font-bold">1</span>
              Extract text from uploaded document image
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#0EA5E9] text-white flex items-center justify-center text-xs font-bold">2</span>
              Cross-validate against system demographic records
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#0EA5E9] text-white flex items-center justify-center text-xs font-bold">3</span>
              Flag mismatches for Admin review
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#0EA5E9] text-white flex items-center justify-center text-xs font-bold">4</span>
              Activate 3-2-1 expiration monitoring
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
