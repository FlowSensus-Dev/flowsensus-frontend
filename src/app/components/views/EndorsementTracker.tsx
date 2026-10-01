import { Clock } from 'lucide-react';
import { ApplicantRecord, ActivityLog } from '../../types';

interface EndorsementTrackerProps {
  applicants?: ApplicantRecord[];
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  updateApplicant: (applicantId: string, updates: Partial<ApplicantRecord>) => void;
}

export default function EndorsementTracker({ applicants = [], currentUserName, addActivityLog, updateApplicant }: EndorsementTrackerProps) {
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-3xl font-extrabold tracking-tight">Endorsement Tracker</h2>
        <p className="text-sm text-[#64748B] mt-1 font-medium">
          Track approved CVs being sent to external employers.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Column 1 - Manager Approved */}
        <div className="bg-slate-200/50 rounded-xl p-4 flex flex-col h-[600px] border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs uppercase tracking-widest text-[#0F172A] font-black">Manager Approved</p>
            <span className="px-2 py-0.5 bg-slate-200 text-[#0F172A] text-xs font-bold rounded">2</span>
          </div>
          <div className="space-y-3 overflow-y-auto">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-[#10B981] cursor-grab active:cursor-grabbing">
              <p className="font-bold text-[#0F172A] text-sm">Juan Dela Cruz</p>
              <p className="text-xs font-medium text-[#64748B] mt-1 mb-3">Welder • JO-0042</p>
              <label className="flex items-center gap-2 text-xs font-bold text-[#0EA5E9] cursor-pointer">
                <input type="checkbox" /> Confirm Ext. Upload
              </label>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-[#10B981] cursor-grab">
              <p className="font-bold text-[#0F172A] text-sm">Ana Reyes</p>
              <p className="text-xs font-medium text-[#64748B] mt-1 mb-3">Nurse • JO-0051</p>
              <label className="flex items-center gap-2 text-xs font-bold text-[#0EA5E9] cursor-pointer">
                <input type="checkbox" /> Confirm Ext. Upload
              </label>
            </div>
          </div>
        </div>

        {/* Column 2 - Uploaded to Portal */}
        <div className="bg-slate-200/50 rounded-xl p-4 flex flex-col h-[600px] border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs uppercase tracking-widest text-[#0F172A] font-black">Uploaded to Portal</p>
            <span className="px-2 py-0.5 bg-slate-200 text-[#0F172A] text-xs font-bold rounded">1</span>
          </div>
          <div className="space-y-3 overflow-y-auto">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-[#0EA5E9]">
              <p className="font-bold text-[#0F172A] text-sm">Pedro Garcia</p>
              <p className="text-xs font-medium text-[#64748B] mt-1">Pipefitter • JO-0038</p>
              <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                <Clock className="w-3 h-3" /> Awaiting Emp. Reply
              </div>
            </div>
          </div>
        </div>

        {/* Column 3 - Waiting Selection */}
        <div className="bg-slate-200/50 rounded-xl p-4 flex flex-col h-[600px] border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs uppercase tracking-widest text-[#0F172A] font-black">Waiting Selection</p>
            <span className="px-2 py-0.5 bg-slate-200 text-[#0F172A] text-xs font-bold rounded">0</span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm font-medium text-slate-400">Drag cards here</p>
          </div>
        </div>
      </div>
    </div>
  );
}
