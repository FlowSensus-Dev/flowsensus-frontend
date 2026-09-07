import { useMemo, useState } from "react";
import { Building2, Globe, Check, User, Mail } from "lucide-react";

function toSubdomain(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24) || "agency-name"
  );
}

export default function AgencyOnboarding() {
  const [form, setForm] = useState({
    agencyName: "",
    licenseNo: "",
    gmName: "",
    email: "",
    workspaceSlug: "",
  });

  const subdomain = useMemo(() => {
    if (form.workspaceSlug.trim()) return toSubdomain(form.workspaceSlug);
    if (form.agencyName.trim()) return toSubdomain(form.agencyName);
    return "agency-name";
  }, [form.workspaceSlug, form.agencyName]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="w-full min-h-screen bg-[#0B1628]">
      <main className="p-6 lg:p-8">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          <section className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:p-7">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#0F172A]">
              Provision New Tenant Workspace
            </h1>
            <p className="mt-2 text-sm text-slate-500 max-w-2xl">
              Creates a new agency workspace on the FlowSensus platform. Verify all details before provisioning.
            </p>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5">
                  Agency Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={form.agencyName}
                    onChange={(e) => set("agencyName", e.target.value)}
                    placeholder="Registered agency name"
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30 focus:border-[#6366F1] bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5">
                  POEA / DMW License No. <span className="text-red-400">*</span>
                </label>
                <input
                  value={form.licenseNo}
                  onChange={(e) => set("licenseNo", e.target.value)}
                  placeholder="POEA-000-LB-MMYYYY-R"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30 focus:border-[#6366F1] bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5">
                  General Manager's Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={form.gmName}
                    onChange={(e) => set("gmName", e.target.value)}
                    placeholder="Full name of authorized GM"
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30 focus:border-[#6366F1] bg-white"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5">
                  Corporate Email Address <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="gm@youragency.ph"
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30 focus:border-[#6366F1] bg-white"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5">
                  Workspace URL <span className="text-red-400">*</span>
                </label>
                <div className="flex items-center">
                  <div className="relative flex-1">
                    <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={subdomain}
                      onChange={(e) => set("workspaceSlug", e.target.value)}
                      placeholder="agency-name"
                      className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-l-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30 focus:border-[#6366F1] bg-white"
                    />
                  </div>
                  <span className="px-3 py-2.5 border border-l-0 border-slate-200 rounded-r-lg bg-slate-50 text-sm text-slate-500 font-['JetBrains_Mono',monospace]">
                    .flowsensus.com
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button className="px-6 py-3 bg-[#6366F1] text-white text-sm font-bold hover:bg-[#4F46E5] rounded-lg flex items-center gap-2 shadow-sm transition-colors">
                <Check size={16} />
                Provision Workspace
              </button>
            </div>
          </section>

          <aside className="space-y-5">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-[#0F172A] mb-3">Before provisioning, verify:</h3>
              <div className="space-y-2.5">
                {[
                  "Agency holds a valid, non-expired POEA/DMW license",
                  "B2B inquiry form has been submitted and reviewed",
                  "General Manager's identity and corporate email confirmed",
                  "No existing workspace exists for this license number",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <Check size={14} className="text-[#10B981] mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-slate-500 leading-snug">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-3">WHAT HAPPENS ON PROVISION</h3>
              <div className="space-y-3">
                {[
                  { step: "01", text: "Workspace ID generated and isolated database schema created" },
                  { step: "02", text: "Subdomain registered and tenant routing configured" },
                  { step: "03", text: "Admin account created and credentials emailed to GM" },
                  { step: "04", text: "Tenant appears in Tenant Management as Active" },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3">
                    <span className="font-['JetBrains_Mono',monospace] text-[#6366F1] font-bold text-xs flex-shrink-0 mt-px">{item.step}</span>
                    <p className="text-slate-500 text-xs leading-snug">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
