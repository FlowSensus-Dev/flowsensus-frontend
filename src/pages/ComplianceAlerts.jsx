import { Bell } from "lucide-react";

export default function ComplianceAlerts() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="mb-6">
        <h2 className="text-3xl font-extrabold tracking-tight">
          3-2-1 Compliance Watch
        </h2>
        <p className="text-sm text-[#64748B] mt-1 font-medium">
          Automated expiration monitoring for pre-deployment documents.
        </p>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center">
        <Bell className="w-10 h-10 text-slate-400 mb-3" />

        <p className="font-bold text-[#0F172A] text-sm">
          No alerts available
        </p>

        <p className="text-xs text-[#64748B] mt-1">
          Document expiration alerts will appear here when compliance data is
          available.
        </p>
      </div>
    </div>
  );
}