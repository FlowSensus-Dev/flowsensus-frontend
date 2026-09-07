import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Building2, Users, Globe, Shield, ArrowRight, X, CheckCircle2, Mail, Layers, FileText, BarChart3, Sparkles, Menu, Palette } from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const contactRef = useRef(null);
  const [inquiry, setInquiry] = useState({ agencyName: "", gmName: "", licenseNo: "", email: "", message: "" });
  const [inquirySubmitted, setInquirySubmitted] = useState(false);
  const scrollTo = (ref) =>
    ref.current?.scrollIntoView({ behavior: "smooth" });

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
            <div className="w-8 h-8 rounded-lg bg-[#0EA5E9] flex items-center justify-center shadow-[0_0_12px_rgba(14,165,233,0.4)]">
              <Layers size={16} className="text-white" />
            </div>
            <span className="text-white font-black text-base tracking-[0.06em]">
              FLOW<span className="text-[#0EA5E9]">SENSUS</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-7 text-sm text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how" className="hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-white transition-colors">What's Included</a>
            <a href="#contact" onClick={(e) => { e.preventDefault(); scrollTo(contactRef); }} className="hover:text-white transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => scrollTo(contactRef)}
              className="hidden md:block text-sm text-slate-300 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/5"
            >
              Request a Demo
            </button>
            <button
              onClick={() => navigate("/login")}
              className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              Agency Login
            </button>
            <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="md:hidden bg-[#0F172A] border-t border-white/10 px-6 py-4 flex flex-col gap-3 text-sm text-slate-400">
            <a href="#features" onClick={() => setMobileOpen(false)} className="py-1 hover:text-white transition-colors">Features</a>
            <a href="#how" onClick={() => setMobileOpen(false)} className="py-1 hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" onClick={() => setMobileOpen(false)} className="py-1 hover:text-white transition-colors">{"What's Included"}</a>
            <button onClick={() => { scrollTo(contactRef); setMobileOpen(false); }} className="py-1 text-left hover:text-white transition-colors">Contact</button>
            <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
              <button onClick={() => { scrollTo(contactRef); setMobileOpen(false); }} className="text-left text-[#0EA5E9] font-semibold">Request a Demo</button>
              <button onClick={() => navigate("/login")} className="bg-[#0EA5E9] text-white font-semibold px-5 py-2.5 rounded-lg text-center">Agency Login</button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="bg-[#0F172A] pt-32 pb-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(14,165,233,0.14),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(14,165,233,0.07),transparent_50%)]" />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#F8FAFC] to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#0EA5E9]/10 border border-[#0EA5E9]/30 rounded-full px-4 py-1.5 mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9] animate-pulse" />
                <span className="text-[#0EA5E9] text-xs font-semibold tracking-wide uppercase">Now Accepting Agency Partners</span>
              </div>
              <h1 className="font-['Libre_Baskerville',serif] text-4xl lg:text-5xl font-bold text-white leading-[1.15] mb-6">
                The complete system for<br />
                <em className="not-italic text-[#0EA5E9]">overseas placement</em><br />
                agencies.
              </h1>
              <p className="text-slate-400 text-lg leading-relaxed mb-10 max-w-lg">
                FLOWSENSUS manages your entire 5-phase deployment lifecycle — from applicant registration
                through final boarding — with role-based workflows built specifically for POEA-licensed agencies.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => scrollTo(contactRef)}
                  className="flex items-center justify-center gap-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white font-semibold px-7 py-3.5 rounded-lg transition-colors text-base"
                >
                  Request a Demo <ArrowRight size={18} />
                </button>
                <button
                  onClick={() => navigate("/login")}
                  className="flex items-center justify-center gap-2 border border-white/20 text-white hover:bg-white/5 font-medium px-7 py-3.5 rounded-lg transition-colors text-base"
                >
                  Agency Login →
                </button>
              </div>
              <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-slate-500">
                <span className="flex items-center gap-1.5"><Check size={14} className="text-[#0EA5E9]" /> POEA/DMW-licensed agencies only</span>
                <span className="flex items-center gap-1.5"><Check size={14} className="text-[#0EA5E9]" /> Dedicated subdomain workspace</span>
                <span className="flex items-center gap-1.5"><Check size={14} className="text-[#0EA5E9]" /> Provisioned within 24 hours</span>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { val: "5-Phase", label: "Deployment Workflow", color: "#0EA5E9", bg: "rgba(14,165,233,0.1)", border: "rgba(14,165,233,0.25)" },
              { val: "4 Roles", label: "Staff Access Levels", color: "#A78BFA", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.25)" },
              { val: "POEA-Ready", label: "Fully Compliant", color: "#34D399", bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.25)" },
              { val: "99.9%", label: "Uptime SLA", color: "#FB923C", bg: "rgba(251,146,60,0.1)", border: "rgba(251,146,60,0.25)" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl px-6 py-5 text-center" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                <div className="text-2xl font-black tracking-tight" style={{ color: s.color }}>{s.val}</div>
                <div className="text-slate-400 text-xs mt-1 font-medium">{s.label}</div>
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
              Every FLOWSENSUS workspace comes fully equipped — no add-ons, no feature tiers, no surprises.
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
              Ready to partner with us?
            </h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              FLOWSENSUS is available exclusively to POEA/DMW-licensed placement agencies.
              Submit a B2B inquiry and our team will onboard your workspace within 24 hours.
            </p>
            <button
              onClick={() => scrollTo(contactRef)}
              className="inline-flex items-center gap-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white font-semibold px-8 py-4 rounded-xl transition-colors text-base"
            >
              Request a Demo <ArrowRight size={18} />
            </button>
            <p className="text-slate-500 text-xs mt-4">For POEA/DMW-licensed agencies only</p>
          </div>
        </div>
      </section>

      {/* B2B Inquiry + Contact */}
      <div ref={contactRef} id="contact" />
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-[#0EA5E9] text-xs font-semibold tracking-widest uppercase mb-3">Partner With Us</div>
            <h2 className="font-['Libre_Baskerville',serif] text-3xl md:text-4xl font-bold text-[#0F172A] mb-4">Request a platform demo.</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              FLOWSENSUS is provisioned exclusively for POEA/DMW-licensed agencies.
              Submit your inquiry and our team will reach out within one business day.
            </p>
          </div>
          <div className="grid lg:grid-cols-2 gap-10">

            {/* Inquiry form */}
            {!inquirySubmitted ? (
              <div className="bg-[#F8FAFC] border border-slate-200 rounded-2xl p-8">
                <h3 className="font-bold text-[#0F172A] text-lg mb-6">B2B Inquiry Form</h3>
                <form onSubmit={(e) => { e.preventDefault(); setInquirySubmitted(true); }} className="space-y-4">
                  {[
                    { key: "agencyName", label: "Agency Name", placeholder: "Your registered agency name", type: "text" },
                    { key: "gmName", label: "General Manager's Name", placeholder: "Full name", type: "text" },
                    { key: "licenseNo", label: "POEA / DMW License No.", placeholder: "e.g. POEA-026-LB-042026-R", type: "text" },
                    { key: "email", label: "Corporate Email Address", placeholder: "gm@youragency.ph", type: "email" },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="text-sm font-semibold text-[#0F172A] block mb-1.5">{f.label} <span className="text-red-400">*</span></label>
                      <input
                        type={f.type}
                        value={inquiry[f.key]}
                        onChange={(e) => setInquiry(p => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20 bg-white transition-all"
                        placeholder={f.placeholder}
                        required
                      />
                    </div>
                  ))}
                  <div>
                    <label className="text-sm font-semibold text-[#0F172A] block mb-1.5">Message / Inquiry</label>
                    <textarea
                      value={inquiry.message}
                      onChange={(e) => setInquiry(p => ({ ...p, message: e.target.value }))}
                      rows={4}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20 bg-white transition-all resize-none"
                      placeholder="Tell us about your agency and what you're looking for..."
                    />
                  </div>
                  <button type="submit" className="w-full bg-[#0EA5E9] hover:bg-[#0284C7] text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                    Submit Inquiry <ArrowRight size={16} />
                  </button>
                </form>
              </div>
            ) : (
              <div className="bg-[#F8FAFC] border border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-[400px]">
                <div className="w-16 h-16 rounded-full bg-[#10B981]/10 flex items-center justify-center mb-4">
                  <CheckCircle2 size={32} className="text-[#10B981]" />
                </div>
                <h3 className="font-bold text-[#0F172A] text-xl mb-2">Inquiry Received</h3>
                <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
                  Thank you, <strong className="text-[#0F172A]">{inquiry.gmName || "your team"}</strong>. Our platform team will review your agency details and reach out to{" "}
                  <strong className="text-[#0F172A]">{inquiry.email}</strong> within one business day.
                </p>
              </div>
            )}

            {/* Contact info + process */}
            <div className="flex flex-col gap-5">
              <h3 className="font-semibold text-[#0F172A] text-lg">Direct Contact</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-4 p-4 bg-[#F8FAFC] border border-slate-200 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-[#0EA5E9]/10 flex items-center justify-center flex-shrink-0">
                    <Mail size={18} className="text-[#0EA5E9]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#0F172A] text-sm">Email Us</p>
                    <p className="text-[#0EA5E9] text-sm mt-0.5">innov8.capstone35@gmail.com</p>
                    <p className="text-slate-400 text-xs mt-1">For new agency partnership inquiries</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-[#F8FAFC] border border-slate-200 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center flex-shrink-0">
                    <Shield size={18} className="text-[#8B5CF6]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#0F172A] text-sm">Platform Support</p>
                    <p className="text-slate-600 text-sm mt-0.5">Platform Super Admin Team</p>
                    <p className="text-slate-400 text-xs mt-1">Technical onboarding and workspace provisioning</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#0F172A] rounded-2xl p-6 flex-1">
                <p className="text-[#0EA5E9] text-xs font-semibold uppercase tracking-widest mb-4">Onboarding Process</p>
                <div className="space-y-4">
                  {[
                    { step: "01", text: "Submit your B2B inquiry with your POEA/DMW license number" },
                    { step: "02", text: "Our team verifies your agency accreditation within 24 hours" },
                    { step: "03", text: "Your workspace is provisioned and login credentials are sent to your GM" },
                  ].map((s) => (
                    <div key={s.step} className="flex items-start gap-3">
                      <span className="font-['JetBrains_Mono',monospace] text-[#0EA5E9] font-bold text-sm flex-shrink-0 mt-0.5">{s.step}</span>
                      <p className="text-slate-400 text-sm leading-snug">{s.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[#0F172A] border-t border-white/10 px-6 py-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#0EA5E9] flex items-center justify-center shadow-[0_0_10px_rgba(14,165,233,0.4)]">
              <Layers size={12} className="text-white" />
            </div>
            <span className="text-white font-black tracking-[0.06em]">FLOW<span className="text-[#0EA5E9]">SENSUS</span></span>
            </div>
          <p>{new Date().getFullYear()} FlowSensus. Built for overseas recruitment operations.</p>
        </div>
      </footer>
    </div>
  );
}





