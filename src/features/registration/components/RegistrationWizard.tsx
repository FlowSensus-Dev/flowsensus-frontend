import { useState } from "react";
import {
  Check, Building2, Globe, X, Lock, Mail,
  User, Phone, MapPin, Eye, EyeOff, Layers,
  Upload, Palette, ImagePlus, ChevronRight
} from "lucide-react";

// ─── Wizard step config ───────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Agency" },
  { id: 2, label: "Branding" },
  { id: 3, label: "Admin" },
  { id: 4, label: "Review" },
];

const ACCENT_PRESETS = [
  { name: "Sky", value: "#0EA5E9" },
  { name: "Indigo", value: "#6366F1" },
  { name: "Emerald", value: "#10B981" },
  { name: "Amber", value: "#F59E0B" },
  { name: "Rose", value: "#F43F5E" },
  { name: "Violet", value: "#8B5CF6" },
  { name: "Teal", value: "#14B8A6" },
  { name: "Orange", value: "#F97316" },
];

function toSubdomain(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "my-agency";
}

// ─── Registration Wizard ──────────────────────────────────────────────────────
export type FormData = {
  agencyName: string; licenseNo: string; agencyType: string; address: string; city: string; phone: string; website: string;
  logoDataUrl: string; accentColor: string; tagline: string; dmwLicenseUrl: string; dmwLicenseName: string;
  adminName: string; adminEmail: string; adminPassword: string; adminConfirm: string;
  agreeTerms: boolean;
};

export default function RegistrationWizard({ onBack, onComplete }: {
  onBack: () => void;
  onComplete: (data: FormData) => void;
}) {
  const [step, setStep] = useState(1);
  const [showPass, setShowPass] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [form, setForm] = useState<FormData>({
    agencyName: "", licenseNo: "", agencyType: "land-based", address: "", city: "", phone: "", website: "",
    logoDataUrl: "", accentColor: "#0EA5E9", tagline: "", dmwLicenseUrl: "", dmwLicenseName: "",
    adminName: "", adminEmail: "", adminPassword: "", adminConfirm: "",
    agreeTerms: false,
  });

  const set = (k: keyof FormData, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));
  const subdomain = toSubdomain(form.agencyName);

  const canAdvance = () => {
    if (step === 1) return !!(form.agencyName.trim() && form.licenseNo.trim() && form.address.trim() && form.city.trim() && form.phone.trim() && form.dmwLicenseUrl);
    if (step === 2) return true; // branding is optional
    if (step === 3) return !!(form.adminName.trim() && form.adminEmail.trim() && form.adminPassword.length >= 8 && form.adminPassword === form.adminConfirm);
    if (step === 4) return form.agreeTerms;
    return true;
  };

  const handleLogoFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => set("logoDataUrl", e.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-['Inter',sans-serif] flex flex-col">
      {/* Header */}
      <div className="bg-[#0F172A] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: form.accentColor }}>
            {form.logoDataUrl
              ? <img src={form.logoDataUrl} alt="logo" className="w-5 h-5 object-contain rounded" />
              : <Layers size={14} className="text-white" />
            }
          </div>
          <span className="text-white font-bold tracking-tight">Flow<span style={{ color: form.accentColor }}>Sensus</span></span>
          <span className="text-slate-600 text-sm ml-2 hidden sm:block">/ Agency Registration</span>
        </div>
        <button onClick={onBack} className="text-slate-400 hover:text-white text-sm flex items-center gap-1 transition-colors">
          <X size={16} /> Cancel
        </button>
      </div>

      {/* Progress steps */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between relative">
          <div className="absolute left-0 right-0 top-[18px] h-px bg-slate-200 z-0" />
          {STEPS.map((s) => (
            <div key={s.id} className="relative z-10 flex flex-col items-center gap-1.5 cursor-pointer" onClick={() => s.id < step && setStep(s.id)}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all border-2 ${
                step > s.id ? "text-white border-transparent" : step === s.id ? "bg-white text-[#0EA5E9] border-[#0EA5E9]" : "bg-white border-slate-200 text-slate-400"
              }`} style={step > s.id ? { background: form.accentColor, borderColor: form.accentColor } : step === s.id ? { borderColor: form.accentColor, color: form.accentColor } : {}}>
                {step > s.id ? <Check size={15} /> : s.id}
              </div>
              <span className={`text-xs hidden sm:block whitespace-nowrap ${step >= s.id ? "text-[#0F172A] font-medium" : "text-slate-400"}`}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Form body */}
      <div className="flex-1 flex items-start justify-center px-6 py-10">
        <div className="w-full max-w-2xl">

          {/* Step 1: Agency Details */}
          {step === 1 && (
            <div>
              <h2 className="font-['Libre_Baskerville',serif] text-2xl font-bold text-[#0F172A] mb-2">Agency details</h2>
              <p className="text-slate-500 text-sm mb-8">This information will appear on your tenant workspace and all generated reports.</p>

              {form.agencyName && (
                <div className="mb-6 bg-[#0F172A] rounded-lg px-4 py-3 flex items-center gap-3">
                  <Globe size={16} className="flex-shrink-0" style={{ color: form.accentColor }} />
                  <span className="text-slate-400 text-sm">Your workspace URL: </span>
                  <span className="font-['JetBrains_Mono',monospace] text-sm font-medium" style={{ color: form.accentColor }}>{subdomain}.flowsensus.com</span>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Agency Name <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={form.agencyName} onChange={(e) => set("agencyName", e.target.value)} placeholder="e.g. FindStaff Placement Services Inc." className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] bg-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0F172A] mb-1.5">POEA License No. <span className="text-red-400">*</span></label>
                  <input value={form.licenseNo} onChange={(e) => set("licenseNo", e.target.value)} placeholder="e.g. POEA-026-LB-042026-R" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Agency Type <span className="text-red-400">*</span></label>
                  <select value={form.agencyType} onChange={(e) => set("agencyType", e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] bg-white text-[#0F172A]">
                    <option value="land-based">Land-Based</option>
                    <option value="sea-based">Sea-Based (Manning)</option>
                    <option value="both">Both Land & Sea</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Office Address <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Street address, building, floor" className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] bg-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0F172A] mb-1.5">City / Province <span className="text-red-400">*</span></label>
                  <input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Makati, Metro Manila" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Phone Number <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+63 2 8XXX XXXX" className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] bg-white" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Website <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://www.youragency.com" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] bg-white" />
                </div>

                {/* DMW License Upload */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[#0F172A] mb-1.5">
                    DMW / POEA Accreditation License <span className="text-red-400">*</span>
                    <span className="text-xs text-slate-400 font-normal ml-2">Upload a scanned copy of your current DMW-issued license</span>
                  </label>
                  <div
                    onClick={() => document.getElementById("dmw-upload")?.click()}
                    className={`relative border-2 border-dashed rounded-xl p-5 cursor-pointer transition-all ${
                      form.dmwLicenseUrl ? "border-[#10B981] bg-[#10B981]/5" : "border-slate-200 hover:border-[#0EA5E9] bg-white hover:bg-[#0EA5E9]/3"
                    }`}
                  >
                    <input
                      id="dmw-upload" type="file" accept="image/*,.pdf" className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]; if (!f) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => { set("dmwLicenseUrl", ev.target?.result as string); set("dmwLicenseName", f.name); };
                        reader.readAsDataURL(f);
                      }}
                    />
                    {form.dmwLicenseUrl ? (
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#10B981]/20 flex items-center justify-center flex-shrink-0">
                          <Shield size={18} className="text-[#10B981]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#10B981]">License document uploaded</p>
                          <p className="text-xs text-slate-500 truncate">{form.dmwLicenseName}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); set("dmwLicenseUrl", ""); set("dmwLicenseName", ""); }} className="text-slate-400 hover:text-red-500 transition-colors">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 text-center justify-center">
                        <Upload size={18} className="text-slate-400" />
                        <div className="text-left">
                          <p className="text-sm font-medium text-slate-600">Upload DMW/POEA License</p>
                          <p className="text-xs text-slate-400">PNG, JPG, or PDF · Max 5MB</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Branding */}
          {step === 2 && (
            <div>
              <h2 className="font-['Libre_Baskerville',serif] text-2xl font-bold text-[#0F172A] mb-2">Brand your workspace</h2>
              <p className="text-slate-500 text-sm mb-8">Upload your agency logo and pick an accent color. This will appear across your FlowSensus tenant — login screen, reports, and navigation.</p>

              {/* Live preview */}
              <div className="mb-8 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                <div className="px-4 py-2 text-[10px] text-slate-400 bg-slate-50 border-b border-slate-200 font-['JetBrains_Mono',monospace] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-300" />
                  Live preview — {subdomain || "your-agency"}.flowsensus.com
                </div>
                <div className="p-5" style={{ background: "#0F172A" }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/10" style={{ background: form.accentColor + "22" }}>
                      {form.logoDataUrl
                        ? <img src={form.logoDataUrl} alt="logo preview" className="w-8 h-8 object-contain" />
                        : <Layers size={18} style={{ color: form.accentColor }} />
                      }
                    </div>
                    <div>
                      <div className="text-white font-bold text-base leading-tight">{form.agencyName || "Your Agency Name"}</div>
                      {form.tagline && <div className="text-xs mt-0.5" style={{ color: form.accentColor }}>{form.tagline}</div>}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {["Recruitment", "Admin", "Accounting"].map((d) => (
                      <div key={d} className="rounded-lg px-3 py-2 text-center text-xs border border-white/10" style={{ background: form.accentColor + "15" }}>
                        <div className="font-medium text-white">{d}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 h-1.5 rounded-full overflow-hidden bg-white/10">
                    <div className="h-full w-3/5 rounded-full" style={{ background: form.accentColor }} />
                  </div>
                </div>
              </div>

              {/* Logo upload */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5 flex items-center gap-2">
                  <ImagePlus size={15} className="text-slate-400" /> Agency Logo <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <div
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    dragOver ? "border-[#0EA5E9] bg-[#0EA5E9]/5" : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleLogoFile(f); }}
                  onClick={() => document.getElementById("logo-upload")?.click()}
                >
                  <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); }} />
                  {form.logoDataUrl ? (
                    <div className="flex flex-col items-center gap-3">
                      <img src={form.logoDataUrl} alt="Uploaded logo" className="max-h-20 max-w-xs object-contain rounded-lg" />
                      <p className="text-sm text-slate-500">Click to replace</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-1">
                        <Upload size={22} className="text-slate-400" />
                      </div>
                      <p className="text-sm font-medium text-[#0F172A]">Drop your logo here, or click to browse</p>
                      <p className="text-xs text-slate-400">PNG, JPG, SVG — recommended 200×200px or larger</p>
                    </div>
                  )}
                </div>
                {form.logoDataUrl && (
                  <button onClick={() => set("logoDataUrl", "")} className="mt-2 text-xs text-red-400 hover:text-red-500 transition-colors">
                    Remove logo
                  </button>
                )}
              </div>

              {/* Accent color */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5 flex items-center gap-2">
                  <Palette size={15} className="text-slate-400" /> Accent Color
                </label>
                <div className="flex flex-wrap gap-2.5 mb-3">
                  {ACCENT_PRESETS.map((c) => (
                    <button
                      key={c.value}
                      title={c.name}
                      onClick={() => set("accentColor", c.value)}
                      className={`w-9 h-9 rounded-full border-2 transition-all ${
                        form.accentColor === c.value ? "border-[#0F172A] scale-110 shadow-md" : "border-transparent hover:scale-105"
                      }`}
                      style={{ background: c.value }}
                    />
                  ))}
                  {/* custom hex */}
                  <div className="flex items-center gap-2 ml-2">
                    <div className="w-9 h-9 rounded-full border-2 border-slate-200 overflow-hidden cursor-pointer relative">
                      <input type="color" value={form.accentColor} onChange={(e) => set("accentColor", e.target.value)} className="absolute inset-0 w-12 h-12 -translate-x-1 -translate-y-1 cursor-pointer opacity-0" />
                      <div className="w-full h-full rounded-full" style={{ background: form.accentColor }} />
                    </div>
                    <span className="font-['JetBrains_Mono',monospace] text-xs text-slate-500">{form.accentColor}</span>
                  </div>
                </div>
              </div>

              {/* Tagline */}
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5">
                  Agency Tagline <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  value={form.tagline}
                  onChange={(e) => set("tagline", e.target.value)}
                  maxLength={60}
                  placeholder="e.g. Connecting Filipino talent to the world"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] bg-white"
                />
                <div className="text-right text-xs text-slate-400 mt-1">{form.tagline.length}/60</div>
              </div>
            </div>
          )}

          {/* Step 3: Admin Account */}
          {step === 3 && (
            <div>
              <h2 className="font-['Libre_Baskerville',serif] text-2xl font-bold text-[#0F172A] mb-2">Admin account</h2>
              <p className="text-slate-500 text-sm mb-8">This becomes the Tenant Admin — the primary owner and super-user of your FlowSensus workspace.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Full Name <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={form.adminName} onChange={(e) => set("adminName", e.target.value)} placeholder="Your full name" className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] bg-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Email Address <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="email" value={form.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} placeholder="admin@youragency.com" className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] bg-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Password <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type={showPass ? "text" : "password"} value={form.adminPassword} onChange={(e) => set("adminPassword", e.target.value)} placeholder="Minimum 8 characters" className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9] bg-white" />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {form.adminPassword && (
                    <div className="mt-2 flex gap-1">
                      {[1,2,3,4].map((n) => (
                        <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${
                          form.adminPassword.length >= n * 3 ? n <= 2 ? "bg-red-400" : n === 3 ? "bg-yellow-400" : "bg-[#10B981]" : "bg-slate-200"
                        }`} />
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Confirm Password <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="password" value={form.adminConfirm} onChange={(e) => set("adminConfirm", e.target.value)} placeholder="Re-enter your password" className={`w-full pl-9 pr-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/40 bg-white ${
                      form.adminConfirm && form.adminPassword !== form.adminConfirm ? "border-red-300" : "border-slate-200 focus:border-[#0EA5E9]"
                    }`} />
                  </div>
                  {form.adminConfirm && form.adminPassword !== form.adminConfirm && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div>
              <h2 className="font-['Libre_Baskerville',serif] text-2xl font-bold text-[#0F172A] mb-2">Review & launch</h2>
              <p className="text-slate-500 text-sm mb-8">Confirm everything looks right before we provision your workspace.</p>

              {/* Branding preview card */}
              <div className="mb-6 rounded-xl overflow-hidden border border-slate-200">
                <div className="h-2 w-full" style={{ background: form.accentColor }} />
                <div className="p-5 bg-white flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl border border-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden bg-slate-50">
                    {form.logoDataUrl
                      ? <img src={form.logoDataUrl} alt="logo" className="w-12 h-12 object-contain" />
                      : <Layers size={22} style={{ color: form.accentColor }} />
                    }
                  </div>
                  <div>
                    <div className="font-bold text-[#0F172A] text-base">{form.agencyName}</div>
                    {form.tagline && <div className="text-sm mt-0.5" style={{ color: form.accentColor }}>{form.tagline}</div>}
                    <div className="font-['JetBrains_Mono',monospace] text-xs text-slate-400 mt-1">{subdomain}.flowsensus.com</div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                {[
                  { label: "Agency", value: form.agencyName },
                  { label: "License No.", value: form.licenseNo },
                  { label: "Type", value: form.agencyType.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase()) },
                  { label: "Location", value: `${form.address}, ${form.city}` },
                  { label: "Phone", value: form.phone },
                  { label: "Admin", value: `${form.adminName}` },
                  { label: "Admin Email", value: form.adminEmail },
                  { label: "Workspace URL", value: `${subdomain}.flowsensus.com`, mono: true },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center px-5 py-3 text-sm gap-4">
                    <span className="text-slate-500 flex-shrink-0">{row.label}</span>
                    <span className={`text-right font-medium ${row.mono ? "font-['JetBrains_Mono',monospace] text-xs" : "text-[#0F172A]"}`} style={row.mono ? { color: form.accentColor } : {}}>
                      {row.value || "—"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-5 bg-[#0F172A] rounded-xl p-5">
                <div className="text-sm text-slate-400 mb-3 font-medium">What happens immediately after</div>
                <ul className="space-y-2">
                  {[
                    "A unique Tenant ID is assigned to your agency",
                    `Your workspace goes live at ${subdomain}.flowsensus.com`,
                    "Your admin account is created with full Tenant Admin privileges",
                    "Invite links are ready so you can add your staff right away",
                    "A welcome email is sent to " + (form.adminEmail || "your inbox"),
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                      <Check size={13} className="flex-shrink-0 mt-0.5" style={{ color: form.accentColor }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <label className="flex items-start gap-3 mt-5 cursor-pointer">
                <input type="checkbox" checked={form.agreeTerms} onChange={(e) => set("agreeTerms", e.target.checked)} className="mt-0.5" />
                <span className="text-sm text-slate-500 leading-relaxed">
                  I agree to the FlowSensus{" "}
                  <span className="hover:underline cursor-pointer" style={{ color: form.accentColor }}>Terms of Service</span> and{" "}
                  <span className="hover:underline cursor-pointer" style={{ color: form.accentColor }}>Privacy Policy</span>.
                  I confirm that the information provided is accurate and that I am authorized to register this agency.
                </span>
              </label>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <button
              onClick={() => step === 1 ? onBack() : setStep(step - 1)}
              className="px-5 py-2.5 border border-slate-200 text-[#0F172A] rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              {step === 1 ? "← Back to site" : "← Previous"}
            </button>
            <button
              onClick={() => step === 4 ? onComplete(form) : setStep(step + 1)}
              disabled={!canAdvance()}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all text-white ${
                canAdvance() ? "opacity-100 hover:opacity-90" : "opacity-40 cursor-not-allowed"
              }`}
              style={{ background: canAdvance() ? form.accentColor : "#94a3b8" }}
            >
              {step === 4 ? "Launch My Workspace" : "Continue"} <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
