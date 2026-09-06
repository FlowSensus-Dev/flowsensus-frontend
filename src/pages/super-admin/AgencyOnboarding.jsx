  export default function AgencyOnboarding() {
    return (
      <div className="w-full min-h-screen bg-[#0B1628]">
        <main className="p-6 lg:p-8 space-y-6">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Agency Onboarding
          </h1>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#0F172A] mb-3">Provisioning Flow</h3>
            <p className="text-xs text-slate-500 mb-4">What happens on provision</p>
            <div className="space-y-3">
              {[
                { step: "01", text: "Workspace ID generated and isolated database schema created" },
                { step: "02", text: "Subdomain registered and tenant routing configured" },
                { step: "03", text: "Admin account created and credentials emailed to GM" },
                { step: "04", text: "Tenant appears in Tenant Management" },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <span className="font-['JetBrains_Mono',monospace] text-[#6366F1] font-bold text-xs flex-shrink-0 mt-px">
                    {item.step}
                  </span>
                  <p className="text-slate-500 text-xs leading-snug">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }