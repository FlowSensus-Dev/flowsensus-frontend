import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  ChevronRight,
  Users,
  Globe,
  Shield,
  ArrowRight,
  X,
  CheckCircle2,
  Mail,
  User,
  FileText,
  BarChart3,
  Sparkles,
  Menu,
  Layers,
} from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const contactRef = useRef(null);
  const [inquiry, setInquiry] = useState({
    agency_name: "",
    gm_name: "",
    poea_license_no: "",
    email: "",
    message: "",
  });
  const [inquirySubmitted, setInquirySubmitted] = useState(false);

  const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: "smooth" });

  const featuresList = [
    {
      icon: <FileText size={20} />,
      title: "5-Phase Lifecycle",
      desc: "End-to-end workflow from applicant registration through final overseas deployment, fully tracked.",
    },
    {
      icon: <Users size={20} />,
      title: "Role-Based Access",
      desc: "Recruitment, Admin, Accounting, and Management roles  each with purpose-built dashboards.",
    },
    {
      icon: <Sparkles size={20} />,
      title: "CV Readiness Engine",
      desc: "Automated 7-criteria scoring detects whether an applicant's profile is ready for employer submission.",
    },
    {
      icon: <Globe size={20} />,
      title: "Employer Endorsement",
      desc: "Track foreign employer selections, interview schedules, and deployment clearances in one place.",
    },
    {
      icon: <BarChart3 size={20} />,
      title: "Accounting Dashboard",
      desc: "Expense tracking, category breakdowns, and one-click CSV/PDF exports for financial compliance.",
    },
    {
      icon: <Shield size={20} />,
      title: "OCR Document Checks",
      desc: "Automated document verification flags discrepancies before visa and deployment processing.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-['Inter',sans-serif]">
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
            <a
              href="#contact"
              onClick={(event) => {
                event.preventDefault();
                scrollTo(contactRef);
              }}
              className="hover:text-white transition-colors"
            >
              Contact
            </a>
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
              Staff Login
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
            <a href="#pricing" onClick={() => setMobileOpen(false)} className="py-1 hover:text-white transition-colors">What's Included</a>
            <button onClick={() => { scrollTo(contactRef); setMobileOpen(false); }} className="text-left text-[#0EA5E9] font-semibold">Request a Demo</button>
            <button onClick={() => navigate("/login")} className="bg-[#0EA5E9] text-white font-semibold px-5 py-2.5 rounded-lg text-center">Staff Login</button>
          </div>
        )}
      </nav>

      <section className="relative pt-32 pb-20 px-6 bg-gradient-to-b from-[#0F172A] via-[#111827] to-[#1E293B] overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute w-[650px] h-[650px] bg-[#0EA5E9]/30 blur-3xl rounded-full -top-64 -left-40" />
          <div className="absolute w-[520px] h-[520px] bg-[#8B5CF6]/25 blur-3xl rounded-full bottom-[-220px] right-[-140px]" />
        </div>

        <div className="relative max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-xs text-slate-200 mb-6 backdrop-blur-sm">
              <Sparkles size={14} className="text-[#0EA5E9]" />
              End-to-End Overseas Recruitment Workflow Platform
            </div>
            <h1 className="text-4xl md:text-[52px] leading-[1.06] font-black text-white tracking-tight">
              Manage Every <span className="text-[#0EA5E9]">Deployment Phase</span> in One Secure System
            </h1>
            <p className="mt-6 text-slate-300 text-lg leading-relaxed max-w-2xl">
              FlowSensus helps recruitment agencies centralize applicant tracking, compliance checks, accounting, and employer endorsements  built for Philippine overseas hiring operations.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button
                onClick={() => scrollTo(contactRef)}
                className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-6 py-3.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all shadow-[0_8px_24px_rgba(14,165,233,0.35)]"
              >
                Request a Demo <ArrowRight size={18} />
              </button>
              <button
                onClick={() => navigate("/login")}
                className="border border-white/20 hover:border-white/40 bg-white/5 text-white px-6 py-3.5 rounded-xl font-semibold text-sm transition-colors"
              >
                Staff Login
              </button>
            </div>
            <div className="mt-8 flex flex-wrap gap-6 text-sm text-slate-300">
              <div className="flex items-center gap-2"><Check className="text-emerald-400" size={16} />Built for POEA/DMW-licensed agencies</div>
              <div className="flex items-center gap-2"><Check className="text-emerald-400" size={16} />Real-time lifecycle tracking</div>
              <div className="flex items-center gap-2"><Check className="text-emerald-400" size={16} />Role-based team collaboration</div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[#0EA5E9]/20 to-[#8B5CF6]/20 blur-2xl" />
            <div className="relative bg-white/10 border border-white/20 rounded-3xl p-6 backdrop-blur-md shadow-2xl">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  { label: "Applicants Processed", value: "1,280+" },
                  { label: "Active Recruiters", value: "84" },
                  { label: "Avg. CV Completion", value: "92%" },
                  { label: "Deployment Visibility", value: "100%" },
                ].map((kpi) => (
                  <div key={kpi.label} className="bg-white/10 rounded-xl p-4 border border-white/10">
                    <p className="text-xs text-slate-300 mb-1">{kpi.label}</p>
                    <p className="text-xl font-bold text-white">{kpi.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl bg-[#0F172A]/70 border border-white/10 p-4">
                <p className="text-xs text-slate-300 mb-2">Current Lifecycle Snapshot</p>
                <div className="space-y-2">
                  {[
                    { phase: "Phase 1 - Sourcing", count: 234, color: "bg-sky-400" },
                    { phase: "Phase 2 - Screening", count: 156, color: "bg-indigo-400" },
                    { phase: "Phase 3 - Documentation", count: 92, color: "bg-amber-400" },
                    { phase: "Phase 4 - Employer Review", count: 48, color: "bg-violet-400" },
                    { phase: "Phase 5 - Deployment", count: 31, color: "bg-emerald-400" },
                  ].map((row) => (
                    <div key={row.phase} className="flex items-center gap-3">
                      <div className={`h-2.5 w-2.5 rounded-full ${row.color}`} />
                      <p className="text-xs text-slate-300 flex-1">{row.phase}</p>
                      <p className="text-xs font-semibold text-white">{row.count}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="px-6 py-20 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl">
            <p className="text-[#0EA5E9] text-xs font-semibold uppercase tracking-widest">Platform Highlights</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-black text-[#0F172A]">Everything your agency needs to monitor recruitment operations at scale</h2>
            <p className="mt-4 text-slate-600 text-base leading-relaxed">
              Designed for multi-team agency workflows, FlowSensus ensures no applicant record, compliance check, or endorsement milestone is lost.
            </p>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {featuresList.map((feature) => (
              <article
                key={feature.title}
                className="group bg-[#F8FAFC] border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-[#0EA5E9]/10 text-[#0EA5E9] flex items-center justify-center mb-4 group-hover:bg-[#0EA5E9]/20 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="font-bold text-[#0F172A] text-lg">{feature.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed mt-2">{feature.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="px-6 py-20 bg-[#F1F5F9] border-y border-slate-200">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-12 items-start">
          <div className="lg:col-span-1">
            <p className="text-[#0EA5E9] text-xs font-semibold uppercase tracking-widest">How It Works</p>
            <h2 className="mt-3 text-3xl font-black text-[#0F172A]">From registration to deployment, fully traceable</h2>
            <p className="mt-4 text-slate-600 text-sm leading-relaxed">
              Recruiters, admins, accounting staff, and management teams collaborate through one synchronized workflow.
            </p>
          </div>
          <div className="lg:col-span-2 grid md:grid-cols-2 gap-5">
            {[
              { step: "01", title: "Applicant Intake", text: "Capture profile, documents, and initial eligibility details in one unified applicant record." },
              { step: "02", title: "Screening & Evaluation", text: "Track test outcomes and AI-assisted CV readiness before employer endorsement." },
              { step: "03", title: "Compliance & Processing", text: "Manage medicals, visa requirements, and document verification with phase checkpoints." },
              { step: "04", title: "Deployment Monitoring", text: "Monitor employer selection, deployment clearances, and final overseas placement status." },
            ].map((item) => (
              <div key={item.step} className="bg-white border border-slate-200 rounded-2xl p-6">
                <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-[#0EA5E9]/10 text-[#0EA5E9] font-bold text-sm">{item.step}</span>
                <h3 className="mt-4 font-bold text-[#0F172A]">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="px-6 py-20 bg-white">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <p className="text-[#0EA5E9] text-xs font-semibold uppercase tracking-widest">Whats Included</p>
            <h2 className="mt-3 text-3xl font-black text-[#0F172A]">Enterprise-ready recruitment operations suite</h2>
            <p className="mt-4 text-slate-600 text-sm leading-relaxed max-w-xl">
              Your subscription includes workspace provisioning, role-based accounts, process monitoring dashboards, and onboarding support.
            </p>
            <div className="mt-7 space-y-3">
              {[
                "Super Admin provisioning and tenant isolation",
                "Recruitment, Admin, Accounting, Management role modules",
                "Applicant lifecycle dashboard with progress checkpoints",
                "Export-ready accounting summaries (CSV/PDF)",
                "Support for agency branding and onboarding",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-slate-700">
                  <Check className="text-emerald-500 mt-0.5" size={16} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[#0F172A] text-white rounded-3xl p-8 border border-[#1E293B] shadow-xl">
            <p className="text-xs uppercase tracking-widest text-slate-400">B2B Agency Plan</p>
            <h3 className="mt-3 text-3xl font-black">Custom Pricing</h3>
            <p className="mt-2 text-slate-300 text-sm leading-relaxed">
              Pricing is based on agency scale, number of active staff accounts, and deployment volume.
            </p>
            <button
              onClick={() => scrollTo(contactRef)}
              className="mt-7 w-full bg-[#0EA5E9] hover:bg-[#0284C7] text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              Request a Demo <ArrowRight size={16} />
            </button>
            <p className="mt-4 text-xs text-slate-400">Includes onboarding, setup guidance, and technical support.</p>
          </div>
        </div>
      </section>

      <section id="contact" ref={contactRef} className="px-6 py-20 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-10">
            <p className="text-[#0EA5E9] text-xs font-semibold uppercase tracking-widest">B2B Inquiry</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-black text-[#0F172A]">Lets activate your agency workspace</h2>
            <p className="mt-4 text-slate-600 text-sm leading-relaxed">
              Share your agency details and our platform team will reach out with a guided walkthrough.
            </p>
          </div>

          <div className="grid lg:grid-cols-5 gap-8">
            {!inquirySubmitted ? (
              <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setInquirySubmitted(true);
                  }}
                >
                  <div>
                    <label className="text-sm font-semibold text-[#0F172A] block mb-1.5">Agency Name</label>
                    <input
                      value={inquiry.agency_name}
                      onChange={(event) => setInquiry((prev) => ({ ...prev, agency_name: event.target.value }))}
                      required
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20 bg-white transition-all"
                      placeholder="e.g., ABC Global Recruitment"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-[#0F172A] block mb-1.5">General Manager</label>
                      <input
                        value={inquiry.gm_name}
                        onChange={(event) => setInquiry((prev) => ({ ...prev, gm_name: event.target.value }))}
                        required
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20 bg-white transition-all"
                        placeholder="Full name"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-[#0F172A] block mb-1.5">POEA/DMW License No.</label>
                      <input
                        value={inquiry.poea_license_no}
                        onChange={(event) => setInquiry((prev) => ({ ...prev, poea_license_no: event.target.value }))}
                        required
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20 bg-white transition-all"
                        placeholder="e.g., POEA-123-LB-04032026"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[#0F172A] block mb-1.5">Official Email</label>
                    <input
                      type="email"
                      value={inquiry.email}
                      onChange={(event) => setInquiry((prev) => ({ ...prev, email: event.target.value }))}
                      required
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20 bg-white transition-all"
                      placeholder="name@agency.com"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[#0F172A] block mb-1.5">Message / Inquiry</label>
                    <textarea
                      value={inquiry.message}
                      onChange={(event) => setInquiry((prev) => ({ ...prev, message: event.target.value }))}
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
              <div className="lg:col-span-3 bg-[#F8FAFC] border border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-[400px]">
                <div className="w-16 h-16 rounded-full bg-[#10B981]/10 flex items-center justify-center mb-4">
                  <CheckCircle2 size={32} className="text-[#10B981]" />
                </div>
                <h3 className="font-bold text-[#0F172A] text-xl mb-2">Inquiry Received</h3>
                <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
                  Thank you, <strong className="text-[#0F172A]">{inquiry.gm_name || "your team"}</strong>. Our platform team will review your agency details and reach out to{" "}
                  <strong className="text-[#0F172A]">{inquiry.email}</strong> within one business day.
                </p>
              </div>
            )}

            <div className="lg:col-span-2 flex flex-col gap-5">
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
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-3">
                      <span className="font-['JetBrains_Mono',monospace] text-[#0EA5E9] font-bold text-sm flex-shrink-0 mt-0.5">{item.step}</span>
                      <p className="text-slate-400 text-sm leading-snug">{item.text}</p>
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
            <span className="text-slate-300">FlowSensus</span>
          </div>
          <p> {new Date().getFullYear()} FlowSensus. Built for overseas recruitment operations.</p>
          <div className="flex items-center gap-4">
            <button onClick={() => scrollTo(contactRef)} className="hover:text-slate-300 transition-colors">Request Demo</button>
            <button onClick={() => navigate("/login")} className="hover:text-slate-300 transition-colors">Staff Login</button>
          </div>
        </div>
      </footer>
    </div>
  );
}