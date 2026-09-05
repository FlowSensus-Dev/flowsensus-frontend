import { useState } from "react";
import {
  Check, ChevronRight, Building2, Users, Globe, Shield,
  ArrowRight, X, Layers, FileText, BarChart3, Sparkles, Menu, Palette
} from "lucide-react";

// ─── Landing Page ─────────────────────────────────────────────────────────────
export default function LandingPage({ onRegister, onSignIn }: { onRegister: () => void; onSignIn: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const featuresList = [
    { icon: <FileText size={20} />, title: "5-Phase Lifecycle", desc: "End-to-end workflow from applicant registration through final overseas deployment, fully tracked." },
    { icon: <Users size={20} />, title: "Role-Based Access", desc: "Recruitment, Admin, Accounting, and Management roles — each with purpose-built dashboards." },
    { icon: <Sparkles size={20} />, title: "CV Readiness Engine", desc: "Automated 7-criteria scoring detects whether an applicant's profile is ready for employer submission." },
    { icon: <Globe size={20} />, title: "Employer Endorsement", desc: "Track foreign employer selections, interview schedules, and deployment clearances in one place." },
    { icon: <BarChart3 size={20} />, title: "Accounting Dashboard", desc: "Expense tracking, category breakdowns, and one-click CSV/PDF exports for financial compliance." },
    { icon: <Shield size={20} />, title: "OCR Document Checks", desc: "Automated document verification flags discrepancies before visa and deployment processing." },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-['Inter',sans-serif]">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0F172A]/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0EA5E9] flex items-center justify-center">
              <Layers size={16} className="text-white" />
            </div>
            <span className="text-white font-bold text-lg tracking-tight">
              Flow<span className="text-[#0EA5E9]">Sensus</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#how" className="hover:text-white transition-colors">How It Works</a>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onSignIn} className="hidden md:block text-sm text-slate-300 hover:text-white transition-colors px-4 py-2">
              Sign In
            </button>
            <button
              onClick={onRegister}
              className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              Get Started
            </button>
            <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="md:hidden bg-[#0F172A] border-t border-white/10 px-6 py-4 flex flex-col gap-4 text-sm text-slate-400">
            <a href="#features" onClick={() => setMobileOpen(false)}>Features</a>
            <a href="#pricing" onClick={() => setMobileOpen(false)}>Pricing</a>
            <a href="#how" onClick={() => setMobileOpen(false)}>How It Works</a>
            <button onClick={onSignIn} className="text-left">Sign In</button>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="bg-[#0F172A] pt-32 pb-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(14,165,233,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(14,165,233,0.06),transparent_50%)]" />
        <div className="max-w-7xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#0EA5E9]/10 border border-[#0EA5E9]/30 rounded-full px-4 py-1.5 mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9] animate-pulse" />
                <span className="text-[#0EA5E9] text-xs font-medium tracking-wide uppercase">Multi-Tenancy Platform — Now Available</span>
              </div>
              <h1 className="font-['Libre_Baskerville',serif] text-4xl lg:text-5xl font-bold text-white leading-[1.15] mb-6">
                The complete system for<br />
                <em className="not-italic text-[#0EA5E9]">overseas placement</em><br />
                agencies.
              </h1>
              <p className="text-slate-400 text-lg leading-relaxed mb-10 max-w-lg">
                FlowSensus manages your entire 5-phase deployment lifecycle — from applicant registration
                through final boarding — with role-based workflows built specifically for POEA-licensed agencies.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={onRegister}
                  className="flex items-center justify-center gap-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white font-semibold px-7 py-3.5 rounded-lg transition-colors text-base"
                >
                  Create Your Workspace <ArrowRight size={18} />
                </button>
                <button
                  onClick={onSignIn}
                  className="flex items-center justify-center gap-2 border border-white/20 text-white hover:bg-white/5 font-medium px-7 py-3.5 rounded-lg transition-colors text-base"
                >
                  Sign In to Your Tenant
                </button>
              </div>
              <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-slate-500">
                <span className="flex items-center gap-1.5"><Check size={14} className="text-[#0EA5E9]" /> No credit card required</span>
                <span className="flex items-center gap-1.5"><Check size={14} className="text-[#0EA5E9]" /> Subdomain provisioned instantly</span>
                <span className="flex items-center gap-1.5"><Check size={14} className="text-[#0EA5E9]" /> Cancel any time</span>
              </div>
            </div>
            {/* App mockup */}
            <div className="hidden lg:block">
              <div className="rounded-2xl border border-white/10 bg-[#1E293B] shadow-2xl overflow-hidden">
                <div className="h-8 bg-[#0F172A] flex items-center gap-2 px-4 border-b border-white/10">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-[#EF4444]/60" />
                    <span className="w-3 h-3 rounded-full bg-[#F59E0B]/60" />
                    <span className="w-3 h-3 rounded-full bg-[#10B981]/60" />
                  </div>
                  <span className="ml-4 font-['JetBrains_Mono',monospace] text-xs text-slate-500">acme-placement.flowsensus.com</span>
                </div>
                <div className="p-5 space-y-3">
                  {[
                    { id: "APP-2026-089", name: "Juan Dela Cruz", role: "Industrial Welder", phase: 3, status: "CV Encoding", pct: 58, color: "#0EA5E9" },
                    { id: "APP-2026-112", name: "Pedro Garcia", role: "Domestic Helper", phase: 2, status: "Medical Clearance", pct: 35, color: "#F59E0B" },
                    { id: "APP-2026-051", name: "Ana Reyes", role: "Caregiver", phase: 4, status: "Employer Review", pct: 82, color: "#10B981" },
                    { id: "APP-2026-073", name: "Carlo Bautista", role: "Electrician", phase: 1, status: "Screening", pct: 18, color: "#8B5CF6" },
                  ].map((a) => (
                    <div key={a.id} className="bg-[#0F172A] rounded-lg p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0EA5E9]/30 to-[#0EA5E9]/10 flex items-center justify-center text-xs text-[#0EA5E9] font-bold flex-shrink-0">
                        {a.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-white text-xs font-medium truncate">{a.name}</span>
                          <span className="text-slate-500 text-[10px] font-['JetBrains_Mono',monospace] ml-2 flex-shrink-0">Ph.{a.phase}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 bg-white/10 rounded-full">
                            <div className="h-1 rounded-full transition-all" style={{ width: `${a.pct}%`, background: a.color }} />
                          </div>
                          <span className="text-[10px] flex-shrink-0" style={{ color: a.color }}>{a.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {[{ label: "Active", val: "47", c: "#0EA5E9" }, { label: "Deployed", val: "312", c: "#10B981" }, { label: "Pending", val: "9", c: "#F59E0B" }].map((s) => (
                      <div key={s.label} className="bg-[#0F172A] rounded-lg p-3 text-center">
                        <div className="font-['Libre_Baskerville',serif] text-xl font-bold" style={{ color: s.c }}>{s.val}</div>
                        <div className="text-slate-500 text-[10px] mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="max-w-7xl mx-auto mt-16 relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 rounded-xl overflow-hidden border border-white/10">
            {[
              { val: "180+", label: "Agencies onboarded" },
              { val: "42,000+", label: "Workers deployed" },
              { val: "28", label: "Countries served" },
              { val: "99.7%", label: "System uptime" },
            ].map((s) => (
              <div key={s.label} className="bg-[#1E293B] px-6 py-5 text-center">
                <div className="font-['Libre_Baskerville',serif] text-2xl font-bold text-white">{s.val}</div>
                <div className="text-slate-500 text-xs mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-[#0EA5E9] text-xs font-semibold tracking-widest uppercase mb-3">Platform Capabilities</div>
            <h2 className="font-['Libre_Baskerville',serif] text-3xl md:text-4xl font-bold text-[#0F172A] mb-4">
              Everything your agency needs,<br />nothing it doesn't.
            </h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              Built from the ground up for POEA-licensed placement agencies, with workflows that match how deployment actually happens.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuresList.map((f, i) => (
              <div key={i} className="group border border-slate-100 rounded-xl p-6 hover:border-[#0EA5E9]/40 hover:shadow-md transition-all duration-200">
                <div className="w-10 h-10 rounded-lg bg-[#0EA5E9]/10 text-[#0EA5E9] flex items-center justify-center mb-4 group-hover:bg-[#0EA5E9] group-hover:text-white transition-all duration-200">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-[#0F172A] mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="py-24 px-6 bg-[#F8FAFC]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-[#0EA5E9] text-xs font-semibold tracking-widest uppercase mb-3">5-Phase Deployment Lifecycle</div>
            <h2 className="font-['Libre_Baskerville',serif] text-3xl md:text-4xl font-bold text-[#0F172A]">
              From registration to boarding.
            </h2>
          </div>
          <div className="relative">
            <div className="hidden md:block absolute left-[calc(50%-1px)] top-8 bottom-8 w-px bg-slate-200" />
            {[
              { phase: "01", title: "Applicant Registration", desc: "Detailed applicant intake with personal information, work history, and skills assessment.", side: "left", color: "#0EA5E9" },
              { phase: "02", title: "Screening & Medical", desc: "English proficiency, trade tests, IQ/aptitude, and full medical clearance validation.", side: "right", color: "#8B5CF6" },
              { phase: "03", title: "CV Encoding", desc: "Readiness engine evaluates 7 criteria. Management approves for employer submission.", side: "left", color: "#F59E0B" },
              { phase: "04", title: "Employer Endorsement", desc: "Foreign employer selects candidates. Interview scheduling and endorsement tracking.", side: "right", color: "#10B981" },
              { phase: "05", title: "Final Deployment", desc: "OCR document verification, expense tracking, visa processing, and departure monitoring.", side: "left", color: "#EF4444" },
            ].map((p, i) => (
              <div key={i} className={`relative flex items-start gap-8 mb-10 ${p.side === "right" ? "md:flex-row-reverse" : ""}`}>
                <div className={`flex-1 ${p.side === "right" ? "md:text-right" : ""}`}>
                  <div className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                    <div className="font-['JetBrains_Mono',monospace] text-xs font-medium mb-2" style={{ color: p.color }}>PHASE {p.phase}</div>
                    <h3 className="font-semibold text-[#0F172A] mb-2">{p.title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{p.desc}</p>
                  </div>
                </div>
                <div className="hidden md:flex flex-shrink-0 w-10 h-10 rounded-full border-2 items-center justify-center z-10 mt-6 font-['JetBrains_Mono',monospace] text-xs font-bold" style={{ borderColor: p.color, color: p.color, background: "#F8FAFC" }}>
                  {p.phase}
                </div>
                <div className="hidden md:block flex-1" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's included */}
      <section id="pricing" className="py-24 px-6 bg-[#0F172A]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-[#0EA5E9] text-xs font-semibold tracking-widest uppercase mb-3">Everything Included</div>
            <h2 className="font-['Libre_Baskerville',serif] text-3xl md:text-4xl font-bold text-white mb-4">
              One workspace. Everything your<br />agency needs to deploy.
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              Every FlowSensus tenant comes fully equipped — no add-ons, no feature tiers, no surprises.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
            {[
              { icon: <Users size={18} />, title: "Role-Based Staff Accounts", desc: "Recruitment, Admin, Accounting, and Management — each role sees only what it needs." },
              { icon: <FileText size={18} />, title: "Full 5-Phase Lifecycle", desc: "From first intake to final boarding. Every step tracked, documented, and reportable." },
              { icon: <Sparkles size={18} />, title: "CV Readiness Engine", desc: "Automated 7-criteria scoring tells you instantly whether a profile is ready for endorsement." },
              { icon: <Globe size={18} />, title: "Employer Endorsement Tracking", desc: "Foreign employer selections, interview records, and deployment decisions in one view." },
              { icon: <BarChart3 size={18} />, title: "Accounting & Analytics", desc: "Expense tracking by category, deployment cost reports, and one-click PDF/CSV export." },
              { icon: <Shield size={18} />, title: "OCR Document Verification", desc: "Automated document checks catch discrepancies before they become costly delays." },
              { icon: <Building2 size={18} />, title: "Custom Subdomain", desc: "Your agency gets its own workspace URL (agency.flowsensus.com) from day one." },
              { icon: <Palette size={18} />, title: "Brand Customization", desc: "Upload your logo and set your accent color. Your workspace, your identity." },
              { icon: <Layers size={18} />, title: "Activity Audit Log", desc: "Full per-applicant audit trail. Know who did what and when across every department." },
            ].map((f, i) => (
              <div key={i} className="bg-[#1E293B] rounded-xl p-5 border border-white/5 hover:border-[#0EA5E9]/30 transition-all group">
                <div className="w-9 h-9 rounded-lg bg-[#0EA5E9]/10 text-[#0EA5E9] flex items-center justify-center mb-3 group-hover:bg-[#0EA5E9] group-hover:text-white transition-all duration-200">
                  {f.icon}
                </div>
                <h3 className="text-white font-semibold text-sm mb-1.5">{f.title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* CTA inside dark section */}
          <div className="max-w-2xl mx-auto text-center bg-gradient-to-br from-[#0EA5E9]/20 to-[#0EA5E9]/5 rounded-2xl border border-[#0EA5E9]/20 p-10">
            <div className="w-14 h-14 rounded-2xl bg-[#0EA5E9] flex items-center justify-center mx-auto mb-5">
              <Layers size={24} className="text-white" />
            </div>
            <h3 className="font-['Libre_Baskerville',serif] text-2xl font-bold text-white mb-3">
              Ready to get started?
            </h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Register your agency in under 5 minutes. Upload your logo, set your brand color,
              create your admin account — and your workspace is live.
            </p>
            <button
              onClick={onRegister}
              className="inline-flex items-center gap-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white font-semibold px-8 py-4 rounded-xl transition-colors text-base"
            >
              Create Your Agency Workspace <ArrowRight size={18} />
            </button>
            <p className="text-slate-500 text-xs mt-4">No credit card required during setup</p>
          </div>
        </div>
      </section>

      {/* CTA + Footer */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {[
              { step: "01", title: "Register your agency", desc: "Fill in your agency details, upload your logo, and create your admin account." },
              { step: "02", title: "Workspace is provisioned", desc: "We generate your Tenant ID and spin up your dedicated subdomain instantly." },
              { step: "03", title: "Invite your team", desc: "Add Recruitment, Admin, Accounting, and Management staff with the right roles." },
            ].map((s) => (
              <div key={s.step} className="flex gap-4">
                <div className="font-['JetBrains_Mono',monospace] text-2xl font-bold text-[#0EA5E9] flex-shrink-0 leading-tight">{s.step}</div>
                <div>
                  <h4 className="font-semibold text-[#0F172A] mb-1">{s.title}</h4>
                  <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center">
            <button
              onClick={onRegister}
              className="inline-flex items-center gap-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white font-semibold px-8 py-4 rounded-xl transition-colors text-base"
            >
              Get Started Now <ArrowRight size={18} />
            </button>
            <p className="text-slate-400 text-sm mt-4">Join 180+ agencies already on FlowSensus</p>
          </div>
        </div>
      </section>

      <footer className="bg-[#0F172A] border-t border-white/10 px-6 py-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#0EA5E9] flex items-center justify-center">
              <Layers size={12} className="text-white" />
            </div>
            <span className="text-white font-semibold">Flow<span className="text-[#0EA5E9]">Sensus</span></span>
            <span className="ml-2 text-slate-500">Overseas Deployment Management</span>
          </div>
          <span>© 2026 FlowSensus. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
