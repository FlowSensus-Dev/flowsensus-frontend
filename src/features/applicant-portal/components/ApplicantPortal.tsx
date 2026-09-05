import { useState } from 'react';
import {
  LogOut, Star, MapPin, Briefcase, Clock, CheckCircle2, Globe,
  Phone, Mail, CalendarCheck2, Building2, Award, Send, Layers,
  ShieldCheck, Home, Stethoscope,
} from 'lucide-react';

// ─── Dummy data ───────────────────────────────────────────────────────────────

const APPLICANT = {
  id: 'APP-2024-033',
  name: 'Grace P. Villanueva',
  initials: 'GV',
  role: 'Caregiver',
  age: 32,
  contact: '+63 917 234 5678',
  email: 'grace.villanueva@gmail.com',
  address: 'Brgy. Payatas, Quezon City, Metro Manila',
  agency: 'FlowSensus Placement Agency',
};

const DEPLOYMENT = {
  employer: 'Al Noor Hospital Group',
  role: 'Senior Caregiver / Patient Care Assistant',
  country: 'United Arab Emirates',
  city: 'Abu Dhabi, UAE',
  flag: '🇦🇪',
  dateStarted: 'January 15, 2024',
  dateEnded: 'January 14, 2026',
  duration: '2 Years',
  contractNo: 'OEC-2024-PH-00892',
};

const WELFARE_CRITERIA = [
  { key: 'working_conditions',    label: 'Working Conditions',    icon: Briefcase,   desc: 'Workload, hours, and work environment quality' },
  { key: 'fair_treatment',        label: 'Fair Treatment',        icon: ShieldCheck, desc: 'Respect, equity, and non-discriminatory practices' },
  { key: 'living_accommodations', label: 'Living Accommodations', icon: Home,        desc: 'Housing, meals, and personal space provided' },
  { key: 'workplace_safety',      label: 'Workplace Safety',      icon: Stethoscope, desc: 'Safety protocols, equipment, and emergency procedures' },
];

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

// ─── Star input ───────────────────────────────────────────────────────────────

function StarInput({
  value,
  onChange,
  size = 28,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-110 active:scale-95 outline-none focus:outline-none"
        >
          <Star
            size={size}
            className={`transition-colors duration-150 ${
              (hovered || value) >= s
                ? 'text-amber-400 fill-amber-400'
                : 'text-slate-200 fill-slate-200'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ApplicantPortalProps {
  onLogout: () => void;
}

export default function ApplicantPortal({ onLogout }: ApplicantPortalProps) {
  const [overallRating, setOverallRating]   = useState(0);
  const [criteriaRatings, setCriteriaRatings] = useState<Record<string, number>>({});
  const [remarks, setRemarks]               = useState('');
  const [submitted, setSubmitted]           = useState(false);

  const setCriterion = (key: string, val: number) =>
    setCriteriaRatings((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = () => {
    if (overallRating === 0) return;
    setSubmitted(true);
  };

  return (
    <div className="w-full min-h-screen bg-[#F1F5F9]">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0EA5E9] flex items-center justify-center">
            <Layers size={15} className="text-white" />
          </div>
          <div className="leading-none">
            <span className="font-bold text-[#0F172A] text-sm">
              Flow<span className="text-[#0EA5E9]">Sensus</span>
            </span>
            <span className="text-[#94A3B8] text-xs ml-2">Applicant Portal</span>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="text-sm text-[#475569] hover:text-[#EF4444] flex items-center gap-1.5 transition-colors"
        >
          <LogOut size={14} /> Sign Out
        </button>
      </header>

      {/* ── Completion banner ────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#059669] to-[#0EA5E9] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <CheckCircle2 size={20} className="text-white flex-shrink-0" />
          <div>
            <p className="text-white font-bold text-sm">Contract Successfully Completed</p>
            <p className="text-white/80 text-xs">
              Your 2-year overseas deployment has ended. Welcome home, Grace!
            </p>
          </div>
          <span className="ml-auto bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
            Phase 5 — Returned
          </span>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-5">

        {/* ── Applicant summary card ───────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] px-6 py-5 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#0EA5E9] flex items-center justify-center text-white text-2xl font-black flex-shrink-0 ring-4 ring-white/20 select-none">
              {APPLICANT.initials}
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">{APPLICANT.name}</h2>
              <p className="text-slate-400 text-sm">{APPLICANT.role} · {APPLICANT.id}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="bg-[#10B981]/20 text-[#10B981] text-xs font-bold px-2.5 py-0.5 rounded-full border border-[#10B981]/30">
                  ✓ Contract Completed
                </span>
                <span className="bg-white/10 text-white/70 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {APPLICANT.agency}
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-slate-100">
            <div className="px-5 py-4">
              <p className="text-[10px] text-[#64748B] uppercase font-bold tracking-wide mb-1">Contact</p>
              <p className="text-sm text-[#0F172A] font-medium flex items-center gap-1.5">
                <Phone size={11} className="text-[#0EA5E9] flex-shrink-0" /> {APPLICANT.contact}
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-[10px] text-[#64748B] uppercase font-bold tracking-wide mb-1">Email</p>
              <p className="text-sm text-[#0F172A] font-medium flex items-center gap-1.5">
                <Mail size={11} className="text-[#0EA5E9] flex-shrink-0" />
                <span className="truncate">{APPLICANT.email}</span>
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-[10px] text-[#64748B] uppercase font-bold tracking-wide mb-1">Address</p>
              <p className="text-sm text-[#0F172A] font-medium flex items-center gap-1.5">
                <MapPin size={11} className="text-[#0EA5E9] flex-shrink-0" /> Quezon City, MM
              </p>
            </div>
          </div>
        </div>

        {/* ── Completed employment section ─────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <Award size={17} className="text-[#0EA5E9]" />
            <h3 className="font-bold text-[#0F172A]">Completed Overseas Employment</h3>
          </div>

          <div className="bg-gradient-to-br from-[#F0F9FF] to-[#F0FDF4] border border-[#0EA5E9]/20 rounded-xl p-5 mb-5">
            <div className="flex items-start gap-4">
              <div className="text-4xl select-none">{DEPLOYMENT.flag}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-[#0F172A] text-base">{DEPLOYMENT.employer}</h4>
                    <p className="text-[#0EA5E9] font-semibold text-sm mt-0.5">{DEPLOYMENT.role}</p>
                  </div>
                  <span className="bg-[#10B981] text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap flex-shrink-0">
                    Completed
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-y-2.5 gap-x-4">
                  <div className="flex items-center gap-2 text-sm text-[#475569]">
                    <Globe size={12} className="text-[#94A3B8] flex-shrink-0" />
                    <span>{DEPLOYMENT.city}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#475569]">
                    <CalendarCheck2 size={12} className="text-[#94A3B8] flex-shrink-0" />
                    <span className="font-semibold text-[#0F172A]">{DEPLOYMENT.duration}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#475569]">
                    <Clock size={12} className="text-[#94A3B8] flex-shrink-0" />
                    <span>Started {DEPLOYMENT.dateStarted}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#475569]">
                    <CheckCircle2 size={12} className="text-[#10B981] flex-shrink-0" />
                    <span>Ended {DEPLOYMENT.dateEnded}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-8 text-sm">
            <div>
              <p className="text-[10px] text-[#64748B] uppercase font-bold tracking-wide mb-1">Contract No.</p>
              <p className="font-mono text-[#0F172A] font-semibold text-xs bg-slate-100 px-2 py-0.5 rounded">
                {DEPLOYMENT.contractNo}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[#64748B] uppercase font-bold tracking-wide mb-1">Country</p>
              <p className="font-semibold text-[#0F172A] text-sm">{DEPLOYMENT.country}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#64748B] uppercase font-bold tracking-wide mb-1">Industry</p>
              <p className="font-semibold text-[#0F172A] text-sm flex items-center gap-1.5">
                <Building2 size={11} className="text-[#94A3B8]" /> Healthcare
              </p>
            </div>
          </div>
        </div>

        {/* ── Experience review form ───────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          {!submitted ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <Star size={17} className="text-amber-400 fill-amber-400" />
                <h3 className="font-bold text-[#0F172A]">Employer & Workplace Experience Review</h3>
              </div>
              <p className="text-sm text-[#64748B] mb-6">
                Your review helps protect future OFWs. Please rate your experience honestly — it is confidential.
              </p>

              {/* Overall rating */}
              <div className="bg-[#FFFBEB] border border-amber-100 rounded-xl p-5 mb-6">
                <p className="text-sm font-bold text-[#0F172A] mb-0.5">Overall Experience Rating</p>
                <p className="text-xs text-[#64748B] mb-4">
                  How would you rate your overall experience working with {DEPLOYMENT.employer}?
                </p>
                <StarInput value={overallRating} onChange={setOverallRating} size={38} />
                {overallRating > 0 && (
                  <p className="text-sm font-bold text-amber-600 mt-2.5">
                    {RATING_LABELS[overallRating]}
                  </p>
                )}
              </div>

              {/* Welfare criteria */}
              <div className="mb-6">
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-4">
                  Welfare Criteria Ratings
                </p>
                <div className="space-y-3">
                  {WELFARE_CRITERIA.map((crit) => {
                    const Icon = crit.icon;
                    const rating = criteriaRatings[crit.key] || 0;
                    return (
                      <div
                        key={crit.key}
                        className="flex items-center justify-between gap-4 px-4 py-3.5 rounded-lg border border-slate-100 hover:border-[#0EA5E9]/30 hover:bg-[#F0F9FF]/40 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[#F0F9FF] border border-[#0EA5E9]/20 flex items-center justify-center flex-shrink-0">
                            <Icon size={14} className="text-[#0EA5E9]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#0F172A] leading-tight">{crit.label}</p>
                            <p className="text-xs text-[#94A3B8] truncate">{crit.desc}</p>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <StarInput value={rating} onChange={(val) => setCriterion(crit.key, val)} size={20} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detailed remarks */}
              <div className="mb-6">
                <label className="text-sm font-bold text-[#0F172A] block mb-2">
                  Detailed Experience & Remarks{' '}
                  <span className="text-[#94A3B8] font-normal">(Optional)</span>
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value.slice(0, 1000))}
                  placeholder="Share your experience — the working environment, your supervisor's conduct, the living conditions, challenges you faced, and what you appreciated most. Your honest account protects future OFWs."
                  rows={5}
                  className="w-full rounded-lg border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/15 resize-none transition-colors"
                />
                <p className="text-xs text-[#94A3B8] mt-1.5 text-right">{remarks.length} / 1,000</p>
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={overallRating === 0}
                className="w-full bg-[#0EA5E9] hover:bg-[#0284C7] disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Send size={15} />
                Submit Review
              </button>
              {overallRating === 0 && (
                <p className="text-xs text-center text-[#94A3B8] mt-2">
                  An overall rating is required before submitting
                </p>
              )}
            </>
          ) : (
            /* ── Submission success state ─────────────────────────────────── */
            <div className="text-center py-10">
              <div className="w-16 h-16 rounded-full bg-[#10B981]/10 border-2 border-[#10B981]/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-[#10B981]" />
              </div>
              <h3 className="font-bold text-[#0F172A] text-lg mb-2">Thank you for your review!</h3>
              <p className="text-sm text-[#64748B] max-w-sm mx-auto leading-relaxed">
                Your feedback has been submitted and helps protect future OFWs. Your overall rating:{' '}
                <span className="font-bold text-amber-500">
                  {'★'.repeat(overallRating)}{'☆'.repeat(5 - overallRating)}
                </span>
              </p>
              <div className="mt-6 p-5 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl text-left max-w-sm mx-auto">
                <p className="text-xs font-bold text-[#064E3B] uppercase tracking-wide mb-3">What happens next</p>
                <ul className="space-y-2.5">
                  {[
                    'Your review is forwarded to the FlowSensus compliance team',
                    "Employer rating is updated in the agency's permanent database",
                    'A welfare counselor will reach out if any concerns were raised',
                  ].map((step) => (
                    <li key={step} className="flex items-start gap-2 text-sm text-[#065F46]">
                      <CheckCircle2 size={14} className="text-[#10B981] mt-0.5 flex-shrink-0" />
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
