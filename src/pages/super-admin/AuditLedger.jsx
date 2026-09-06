  import { Search, RefreshCw, Lock } from "lucide-react";

  const AUDIT_LOG = [
    {
      id: "AUD-0892",
      timestamp: "2026-09-04 08:42:11",
      action: "Workspace Status Updated",
      performedBy: "superadmin@flowsensus.com",
      target: "TNT-005 - Sunrise Placement Agency",
      ipAddress: "203.177.x.x",
      status: "warning",
    },
    {
      id: "AUD-0891",
      timestamp: "2026-09-04 07:15:30",
      action: "New Tenant Provisioned",
      performedBy: "superadmin@flowsensus.com",
      target: "TNT-006 - Visayas Manpower Solutions",
      ipAddress: "203.177.x.x",
      status: "success",
    },
    {
      id: "AUD-0890",
      timestamp: "2026-09-03 21:08:55",
      action: "SuperAdmin Login",
      performedBy: "superadmin@flowsensus.com",
      target: "System Console",
      ipAddress: "203.177.x.x",
      status: "success",
    },
    {
      id: "AUD-0889",
      timestamp: "2026-09-03 14:22:01",
      action: "Tenant Suspended",
      performedBy: "superadmin@flowsensus.com",
      target: "TNT-008 - Island Link Recruitment Partners",
      ipAddress: "203.177.x.x",
      status: "warning",
    },
  ];

  const AUDIT_CFG = {
    success: { color: "#10B981", bg: "#ECFDF5", label: "Success" },
    warning: { color: "#F59E0B", bg: "#FFFBEB", label: "Warning" },
    error: { color: "#EF4444", bg: "#FEF2F2", label: "Error" },
  };

  export default function AuditLedger() {
    return (
      <div className="w-full min-h-screen bg-[#0B1628]">
        <main className="p-6 lg:p-8 space-y-6">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Audit Ledger
          </h1>

          <section className="space-y-4">
            <div className="flex gap-3 items-center">
              <div className="relative flex-1 max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search audit log..."
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6366F1] transition-all"
                />
              </div>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-500 font-medium whitespace-nowrap">
                <RefreshCw size={13} /> Read-Only
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-slate-100">
                      {["ID", "Timestamp", "Action", "Performed By", "Target", "IP Address", "Status"].map((h) => (
                        <th
                          key={h}
                          className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {AUDIT_LOG.map((entry) => {
                      const cfg = AUDIT_CFG[entry.status];
                      return (
                        <tr key={entry.id} className="hover:bg-[#F8FAFC] transition-colors">
                          <td className="px-5 py-3.5">
                            <span className="font-['JetBrains_Mono',monospace] text-xs text-[#6366F1]">{entry.id}</span>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className="font-['JetBrains_Mono',monospace] text-xs text-slate-500">{entry.timestamp}</span>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className="text-sm font-medium text-[#0F172A]">{entry.action}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-xs text-slate-600">{entry.performedBy}</span>
                          </td>
                          <td className="px-5 py-3.5 max-w-[180px]">
                            <span className="text-xs text-slate-500 block truncate">{entry.target}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="font-['JetBrains_Mono',monospace] text-xs text-slate-400">{entry.ipAddress}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                              style={{ color: cfg.color, background: cfg.bg }}
                            >
                              {cfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-slate-100 bg-[#F8FAFC] flex items-center justify-between text-xs text-slate-400">
                <span>{AUDIT_LOG.length} entries - tamper-proof audit record</span>
                <span className="flex items-center gap-1.5 text-[#6366F1] font-semibold">
                  <Lock size={11} /> Immutable Log
                </span>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }