  import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";

  const INITIAL_TENANTS = [
    {
      id: "TNT-001",
      agencyName: "Makati Global Placement Inc.",
      licenseNo: "POEA-026-LB-042026-R",
      gmName: "Atty. Ramon Villanueva",
      email: "gm@makatiglobal.com",
      workspaceUrl: "makatiglobal.flowsensus.com",
      status: "active",
      totalUsers: 12,
      totalApplicants: 89,
    },
    {
      id: "TNT-002",
      agencyName: "Allied Manpower Services",
      licenseNo: "POEA-031-LB-032025-R",
      gmName: "Ms. Cynthia Aquino",
      email: "caquino@alliedmanpower.ph",
      workspaceUrl: "alliedmanpower.flowsensus.com",
      status: "active",
      totalUsers: 8,
      totalApplicants: 54,
    },
    {
      id: "TNT-003",
      agencyName: "Pacific OFW Recruitment Corp.",
      licenseNo: "POEA-018-LB-112024-R",
      gmName: "Mr. Jose dela Pena",
      email: "jose.delapena@pacificofw.com",
      workspaceUrl: "pacificofw.flowsensus.com",
      status: "pending",
      totalUsers: 0,
      totalApplicants: 0,
    },
    {
      id: "TNT-004",
      agencyName: "Maynila Overseas Corporation",
      licenseNo: "POEA-009-LB-062023-R",
      gmName: "Engr. Ricardo Santos",
      email: "rsantos@maynilaoverseas.ph",
      workspaceUrl: "maynilaoverseas.flowsensus.com",
      status: "active",
      totalUsers: 21,
      totalApplicants: 167,
    },
    {
      id: "TNT-005",
      agencyName: "Sunrise Placement Agency",
      licenseNo: "POEA-042-LB-082022-R",
      gmName: "Mrs. Lourdes Reyes",
      email: "lreyes@sunriseplacement.com",
      workspaceUrl: "sunriseplacement.flowsensus.com",
      status: "suspended",
      totalUsers: 5,
      totalApplicants: 31,
    },
  ];

  const STATUS_CFG = {
    active: { label: "Active", color: "#10B981", bg: "#ECFDF5" },
    pending: { label: "Pending Approval", color: "#F59E0B", bg: "#FFFBEB" },
    suspended: { label: "Suspended", color: "#EF4444", bg: "#FEF2F2" },
  };

  export default function TenantManagement() {
    return (
      <div className="w-full min-h-screen bg-[#0B1628]">
        <main className="p-6 lg:p-8 space-y-6">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Tenant Management
          </h1>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#0F172A] tracking-wide">
                Registered Workspaces
              </h2>
              <span className="text-xs text-slate-500">
                {INITIAL_TENANTS.length} tenants
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-slate-100">
                    {[
                      "ID",
                      "Agency",
                      "GM",
                      "Workspace URL",
                      "Users",
                      "Applicants",
                      "Status",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-50">
                  {INITIAL_TENANTS.map((tenant) => {
                    const cfg = STATUS_CFG[tenant.status];
                    return (
                      <tr key={tenant.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-5 py-3.5">
                          <span className="font-['JetBrains_Mono',monospace] text-xs text-[#6366F1]">
                            {tenant.id}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-semibold text-[#0F172A]">{tenant.agencyName}</p>
                          <p className="text-xs text-slate-500">{tenant.licenseNo}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-xs text-slate-700">{tenant.gmName}</p>
                          <p className="text-xs text-slate-500">{tenant.email}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-['JetBrains_Mono',monospace] text-xs text-slate-500">
                            {tenant.workspaceUrl}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-slate-700">
                          {tenant.totalUsers}
                        </td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-slate-700">
                          {tenant.totalApplicants}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                            style={{ color: cfg.color, background: cfg.bg }}
                          >
                            {tenant.status === "active" && <CheckCircle2 size={12} />}
                            {tenant.status === "pending" && <Clock size={12} />}
                            {tenant.status === "suspended" && <AlertTriangle size={12} />}
                            {cfg.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    );
  }