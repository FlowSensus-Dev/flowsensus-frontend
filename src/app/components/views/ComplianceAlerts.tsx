import { AlertTriangle, Clock, Calendar } from 'lucide-react';
import { ApplicantRecord } from '../../types';

interface ComplianceAlertsProps {
  applicants?: ApplicantRecord[];
  showToast: (message: string) => void;
}

export default function ComplianceAlerts({ applicants = [], showToast }: ComplianceAlertsProps) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="mb-6">
        <h2 className="text-3xl font-extrabold tracking-tight">3-2-1 Compliance Watch</h2>
        <p className="text-sm text-[#64748B] mt-1 font-medium">
          Automated expiration monitoring for pre-deployment documents.
        </p>
      </div>

      <div className="space-y-4">
        {/* Expired (Red) */}
        <div className="bg-red-50/80 border border-[#EF4444]/30 rounded-xl p-5 flex items-center justify-between shadow-sm">
          <div className="flex gap-4 items-center">
            <div className="w-10 h-10 rounded-full bg-[#EF4444]/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
            </div>
            <div>
              <p className="font-bold text-[#0F172A] text-sm">TESDA Certificate • Juan Dela Cruz</p>
              <p className="text-xs font-bold text-[#EF4444] mt-1 uppercase tracking-wider">Expired 3 days ago</p>
            </div>
          </div>
          <button className="px-4 py-2 bg-white border-2 border-[#EF4444] text-[#EF4444] text-xs font-bold rounded-lg hover:bg-[#EF4444] hover:text-white transition-colors">
            Request Replacement
          </button>
        </div>

        {/* 30 Days (Amber) */}
        <div className="bg-amber-50/80 border border-[#F59E0B]/30 rounded-xl p-5 flex items-center justify-between shadow-sm">
          <div className="flex gap-4 items-center">
            <div className="w-10 h-10 rounded-full bg-[#F59E0B]/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#F59E0B]" />
            </div>
            <div>
              <p className="font-bold text-[#0F172A] text-sm">Medical Clearance • Ana Reyes</p>
              <p className="text-xs font-bold text-[#F59E0B] mt-1 uppercase tracking-wider">Expires in 28 days</p>
            </div>
          </div>
          <button className="px-4 py-2 bg-white border-2 border-[#F59E0B] text-[#F59E0B] text-xs font-bold rounded-lg hover:bg-[#F59E0B] hover:text-white transition-colors">
            Notify Applicant
          </button>
        </div>

        {/* 60 Days (Yellow/Amber) */}
        <div className="bg-amber-50/50 border border-[#F59E0B]/20 rounded-xl p-5 flex items-center justify-between shadow-sm">
          <div className="flex gap-4 items-center">
            <div className="w-10 h-10 rounded-full bg-[#F59E0B]/5 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-bold text-[#0F172A] text-sm">NBI Clearance • Pedro Garcia</p>
              <p className="text-xs font-bold text-amber-600 mt-1 uppercase tracking-wider">Expires in 58 days</p>
            </div>
          </div>
          <button className="px-4 py-2 bg-white border-2 border-amber-600 text-amber-600 text-xs font-bold rounded-lg hover:bg-amber-600 hover:text-white transition-colors">
            Notify Applicant
          </button>
        </div>
      </div>
    </div>
  );
}
