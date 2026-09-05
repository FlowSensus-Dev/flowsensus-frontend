import { useState, useEffect } from "react";
import {
  Check, CheckCircle2, Loader2, Mail, Layers
} from "lucide-react";
import { FormData } from "./RegistrationWizard";

// ─── Provisioning Screen ──────────────────────────────────────────────────────
const PROVISION_STEPS = [
  { label: "Validating agency registration", duration: 1000 },
  { label: "Generating unique Tenant ID", duration: 900 },
  { label: "Provisioning tenant workspace", duration: 1500 },
  { label: "Configuring subdomain routing", duration: 1100 },
  { label: "Applying brand identity settings", duration: 700 },
  { label: "Creating admin account", duration: 800 },
  { label: "Sending welcome email", duration: 600 },
];

export default function ProvisioningScreen({ form, onDone }: { form: FormData; onDone: () => void }) {
  const [completed, setCompleted] = useState<number[]>([]);
  const [current, setCurrent] = useState(0);
  const [done, setDone] = useState(false);
  const tenantId = `FS-${Math.random().toString(36).slice(2, 8).toUpperCase()}-2026`;
  const subdomain = toSubdomain(form.agencyName);

  useEffect(() => {
    let idx = 0;
    let total = 0;
    PROVISION_STEPS.forEach((s, i) => {
      setTimeout(() => {
        setCurrent(i);
        setTimeout(() => {
          setCompleted((p) => [...p, i]);
          if (i === PROVISION_STEPS.length - 1) {
            setTimeout(() => setDone(true), 600);
          }
        }, s.duration);
      }, total);
      total += s.duration + 200;
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center px-6">
      <div className="w-full max-w-lg">
        {!done ? (
          <div>
            <div className="flex items-center gap-3 mb-10">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden" style={{ background: form.accentColor }}>
                {form.logoDataUrl
                  ? <img src={form.logoDataUrl} alt="logo" className="w-7 h-7 object-contain" />
                  : <Layers size={18} className="text-white" />
                }
              </div>
              <div>
                <span className="text-white font-bold text-xl">Flow<span style={{ color: form.accentColor }}>Sensus</span></span>
                {form.agencyName && <div className="text-xs text-slate-500 font-['JetBrains_Mono',monospace] mt-0.5">{toSubdomain(form.agencyName)}.flowsensus.com</div>}
              </div>
            </div>
            <h2 className="font-['Libre_Baskerville',serif] text-2xl font-bold text-white mb-2">
              Setting up your workspace…
            </h2>
            <p className="text-slate-400 text-sm mb-10">This takes just a few seconds. Please don't close this window.</p>

            {/* Progress bar */}
            <div className="h-1.5 bg-white/10 rounded-full mb-10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${((completed.length) / PROVISION_STEPS.length) * 100}%`, background: form.accentColor }}
              />
            </div>

            <div className="space-y-3">
              {PROVISION_STEPS.map((s, i) => (
                <div key={i} className={`flex items-center gap-3 text-sm transition-all duration-300 ${
                  i > current ? "opacity-30" : ""
                }`}>
                  <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                    {completed.includes(i) ? (
                      <CheckCircle2 size={18} className="text-[#10B981]" />
                    ) : i === current ? (
                      <Loader2 size={16} className="animate-spin" style={{ color: form.accentColor }} />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-white/20" />
                    )}
                  </div>
                  <span className={completed.includes(i) ? "text-slate-300" : i === current ? "text-white" : "text-slate-500"}>
                    {s.label}
                  </span>
                  {completed.includes(i) && (
                    <span className="ml-auto text-[#10B981] text-xs font-['JetBrains_Mono',monospace]">done</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-white/10" style={{ background: form.accentColor + "20" }}>
                {form.logoDataUrl
                  ? <img src={form.logoDataUrl} alt="logo" className="w-12 h-12 object-contain" />
                  : <Layers size={26} style={{ color: form.accentColor }} />
                }
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#10B981] rounded-full flex items-center justify-center border-2 border-[#0F172A]">
                <Check size={12} className="text-white" />
              </div>
            </div>
            <h2 className="font-['Libre_Baskerville',serif] text-2xl font-bold text-white mb-2">
              Application submitted.
            </h2>
            <p className="text-[#10B981] text-sm font-semibold mb-1 flex items-center justify-center gap-2">
              <CheckCircle2 size={15} /> Your details are now in review
            </p>
            <p className="text-slate-400 text-sm mb-8 max-w-sm mx-auto leading-relaxed">
              Thank you, <strong className="text-white">{form.adminName || form.agencyName}</strong>. Our team will verify your agency details and DMW accreditation. This typically takes <strong className="text-white">a few hours to one business day</strong>.
            </p>

            {/* What happens next */}
            <div className="bg-[#1E293B] rounded-xl p-5 mb-5 text-left border border-white/10">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">What happens next</p>
              <div className="space-y-3">
                {[
                  { step: "1", label: "Our team reviews your agency details and DMW license", status: "in_progress", color: form.accentColor },
                  { step: "2", label: "We verify your POEA accreditation number is valid and active", status: "pending", color: "#64748B" },
                  { step: "3", label: "Your workspace is activated and subdomain goes live", status: "pending", color: "#64748B" },
                  { step: "4", label: "You receive a confirmation email with your login credentials", status: "pending", color: "#64748B" },
                ].map((s) => (
                  <div key={s.step} className="flex items-center gap-3 text-sm">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ background: s.step === "1" ? form.accentColor : "#334155", color: s.step === "1" ? "#fff" : "#64748B" }}>
                      {s.step === "1" ? <Loader2 size={12} className="animate-spin" /> : s.step}
                    </div>
                    <span style={{ color: s.step === "1" ? "#F8FAFC" : "#64748B" }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reference info */}
            <div className="bg-[#1E293B] rounded-xl p-4 mb-5 text-left space-y-2 border border-white/10 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Reference No.</span><span className="font-['JetBrains_Mono',monospace] text-xs" style={{ color: form.accentColor }}>{tenantId}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Submitted</span><span className="text-white text-xs">{new Date().toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Pending URL</span><span className="font-['JetBrains_Mono',monospace] text-xs text-slate-500">{subdomain}.flowsensus.com</span></div>
            </div>

            <div className="rounded-lg px-4 py-3 text-sm mb-6 text-left flex gap-2 border border-[#0EA5E9]/30 bg-[#0EA5E9]/10 text-[#7DD3FC]">
              <Mail size={16} className="flex-shrink-0 mt-0.5" />
              <span>A confirmation email will be sent to <strong className="text-white">{form.adminEmail || "your inbox"}</strong> once your workspace is approved and activated.</span>
            </div>

            <button
              onClick={onDone}
              className="w-full bg-white/10 hover:bg-white/15 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 border border-white/20"
            >
              Return to Site
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
