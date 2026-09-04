import { useState, useEffect } from "react";
import LoginScreen from "./components/LoginScreen";
import AppShell from "./components/AppShell";
import ApplicantPortal from "./components/ApplicantPortal";
import EmployerPortal from "./components/EmployerPortal";
import { UserRole, WorkflowState, ApplicantRecord, ActivityLog, ExpenseRecord } from "./types";
import {
  Check, ChevronRight, Building2, Users, Globe, Shield,
  ArrowRight, X, CheckCircle2, Loader2, Mail, Lock,
  User, Phone, MapPin, Eye, EyeOff, Layers,
  FileText, BarChart3, Sparkles, Menu, Upload, Palette, ImagePlus
} from "lucide-react";

// ─── Mock applicant data ──────────────────────────────────────────────────────
const mockApplicants: ApplicantRecord[] = [
  {
    id: "APP-2026-089", name: "Juan Dela Cruz", firstName: "Juan", middleName: "Santos", lastName: "Dela Cruz",
    role: "Industrial Welder", jobOrder: "JO-2026-0042 (Al-Futtaim Engineering)", phase: 3, status: "CV Encoding",
    currentHandler: "Sarah Cruz", currentDepartment: "Recruitment", lastUpdated: "2026-05-23 14:30",
    phaseDescription: "CV formatting and preparation for management approval",
    presentAddress: "Brgy. San Juan, Quezon City, Metro Manila", provincialAddress: "San Fernando, Pampanga",
    email: "juan.delacruz@email.com", contact: "+63 917 123 4567", dateOfBirth: "March 15, 1992",
    placeOfBirth: "Manila, Philippines", age: 34, sex: "Male", civilStatus: "Single",
    citizenship: "Filipino", religion: "Roman Catholic", height: "5'7\"", weight: "68 kg",
    languagesSpoken: ["English", "Tagalog", "Arabic (Basic)"],
    skills: ["SMAW", "GMAW", "FCAW", "Blueprint Reading", "Metal Fabrication", "Quality Control"],
    certifications: ["TESDA NC II - Shielded Metal Arc Welding", "Trade Test Passer"],
    workExperience: [
      { companyName: "Metro Steel Corporation", position: "Industrial Welder", startDate: "2019", endDate: "2023",
        responsibilities: ["MIG/TIG welding for structural fabrication", "Blueprint reading", "Quality control"], country: "Philippines", isOverseas: false },
      { companyName: "Qatar Construction LLC", position: "Welder", startDate: "2017", endDate: "2019",
        responsibilities: ["Industrial wiring and fabrication", "Structural welding"], country: "Qatar", isOverseas: true },
    ],
    address: "Quezon City, Metro Manila",
    testScores: { englishProficiency: 85, tradeSkills: 92, iqAptitude: 75, personalityEQ: "Suitable", employerSpecific: "Passed welding certification exam" },
    matchScore: 94,
  },
  {
    id: "APP-2026-112", name: "Pedro Garcia", firstName: "Pedro", middleName: "Reyes", lastName: "Garcia",
    role: "Domestic Helper", jobOrder: "JO-2026-0038 (Hong Kong Household)", phase: 2, status: "Medical Clearance",
    currentHandler: "Maria Santos", currentDepartment: "Admin", lastUpdated: "2026-05-24 09:15",
    phaseDescription: "Awaiting medical examination results from partner clinic",
    presentAddress: "Brgy. Poblacion, Davao City", provincialAddress: "Davao City, Mindanao",
    email: "pedro.garcia@email.com", contact: "+63 918 456 7890", dateOfBirth: "July 22, 1988",
    placeOfBirth: "Davao City, Philippines", age: 37, sex: "Male", civilStatus: "Married",
    citizenship: "Filipino", religion: "Roman Catholic", height: "5'9\"", weight: "75 kg",
    languagesSpoken: ["English", "Tagalog", "Bisaya"],
    skills: ["Cleaning", "Housekeeping", "Cooking", "Childcare"],
    certifications: ["TESDA NC II - Housekeeping"],
    workExperience: [
      { companyName: "Hong Kong Private Family", position: "Domestic Helper", startDate: "2020", endDate: "2024",
        responsibilities: ["Cleaning rooms and houses", "Childcare and babysitting", "Meal preparation"], country: "Hong Kong", isOverseas: true },
    ],
    address: "Davao City, Mindanao",
    testScores: { englishProficiency: 72, tradeSkills: 88, iqAptitude: 68, personalityEQ: "Suitable" },
    matchScore: 78,
  },
  {
    id: "APP-2026-051", name: "Ana Reyes", firstName: "Ana", middleName: "Santos", lastName: "Reyes",
    role: "Caregiver", jobOrder: "JO-2026-0051 (Dubai Healthcare)", phase: 4, status: "Employer Review",
    currentHandler: "Admin User", currentDepartment: "Management", lastUpdated: "2026-05-22 16:45",
    phaseDescription: "CV submitted to foreign employer, awaiting selection decision",
    presentAddress: "Brgy. Lahug, Cebu City", provincialAddress: "Cebu City, Visayas",
    email: "ana.reyes@email.com", contact: "+63 919 234 5678", dateOfBirth: "November 10, 1995",
    placeOfBirth: "Cebu City, Philippines", age: 30, sex: "Female", civilStatus: "Single",
    citizenship: "Filipino", religion: "Roman Catholic", height: "5'4\"", weight: "52 kg",
    languagesSpoken: ["English (Fluent)", "Tagalog", "Cebuano"],
    skills: ["Elderly Care", "Bedridden Patient Care", "CPR/First Aid", "Medication Reminders"],
    certifications: ["TESDA NC II - Caregiving", "CPR/First Aid Certified"],
    workExperience: [
      { companyName: "Singapore Private Family", position: "Caregiver", startDate: "2021", endDate: "2024",
        responsibilities: ["Elderly care and assistance", "Bedridden patient care", "Medication monitoring"], country: "Singapore", isOverseas: true },
      { companyName: "Cebu Medical Center", position: "Nursing Assistant", startDate: "2018", endDate: "2021",
        responsibilities: ["Patient assistance and monitoring", "Vital signs checking"], country: "Philippines", isOverseas: false },
    ],
    address: "Cebu City, Visayas",
    testScores: { englishProficiency: 95, tradeSkills: 93, iqAptitude: 88, personalityEQ: "Suitable", employerSpecific: "Passed CPR/First Aid practical exam" },
    matchScore: 97,
  },

  // ── Flagged applicants (showcase flag engine) ──────────────────────────────

  {
    id: "APP-2026-150", name: "Maria Santos", firstName: "Maria", middleName: "Lim", lastName: "Santos",
    role: "Domestic Helper", jobOrder: "JO-2026-0038 (Hong Kong Household)", phase: 1, status: "Initial Screening",
    currentHandler: "Sarah Cruz", currentDepartment: "Recruitment", lastUpdated: "2026-06-01 09:00",
    phaseDescription: "Applicant profile complete — employment flags require recruiter review",
    presentAddress: "Brgy. Pinyahan, Quezon City", provincialAddress: "Ormoc City, Leyte",
    email: "maria.santos.ph@gmail.com", contact: "+63 912 001 0001", dateOfBirth: "1990-07-14",
    placeOfBirth: "Ormoc City, Leyte", age: 35, sex: "Female", civilStatus: "Single",
    citizenship: "Filipino", religion: "Roman Catholic", height: "5'2\"", weight: "54 kg",
    languagesSpoken: ["English", "Tagalog", "Bisaya"],
    skills: ["Housekeeping", "Cooking", "Childcare", "Elderly Care"],
    certifications: ["TESDA NC II - Housekeeping"],
    workExperience: [],
    address: "Quezon City",
    employmentHistory: [
      { id: "eh-m1", company: "First Care Placement Agency", position: "Housekeeping Staff (OJT)", dateStarted: "2018-01-10", dateEnded: "2018-05-05", country: "Philippines", isPresent: false, reasonForLeaving: "Contract ended" },
      { id: "eh-m2", company: "Lim Family Residence", position: "Domestic Helper", dateStarted: "2019-01-15", dateEnded: "2022-12-31", country: "Hong Kong", isPresent: false, reasonForLeaving: "Employer relocated to Canada" },
      { id: "eh-m3", company: "Tan Family Residence", position: "Domestic Helper", dateStarted: "2023-03-01", dateEnded: "", country: "Hong Kong", isPresent: true, reasonForLeaving: "" },
    ],
    employmentFlags: [
      { id: "f-m1", type: "short_stint", severity: "warning", description: "Short tenure of 4 months at \"First Care Placement Agency\" as Housekeeping Staff (OJT). Short stints may signal instability or issues.", relatedJobIds: ["eh-m1"], dismissed: false },
      { id: "f-m2", type: "gap", severity: "warning", description: "8-month employment gap between \"First Care Placement Agency\" and \"Lim Family Residence\". Applicant should explain this period.", relatedJobIds: ["eh-m1", "eh-m2"], dismissed: false },
    ],
  },

  {
    id: "APP-2026-151", name: "Carlo Bautista", firstName: "Carlo", middleName: "Reyes", lastName: "Bautista",
    role: "Electrician", jobOrder: "JO-2026-0042 (Al-Futtaim Engineering)", phase: 1, status: "Initial Screening",
    currentHandler: "Sarah Cruz", currentDepartment: "Recruitment", lastUpdated: "2026-06-02 10:30",
    phaseDescription: "Critical red flag in employment history — must be clarified before evaluation",
    presentAddress: "Brgy. Commonwealth, Quezon City", provincialAddress: "Tarlac City, Tarlac",
    email: "carlo.bautista.ph@gmail.com", contact: "+63 912 001 0002", dateOfBirth: "1988-03-22",
    placeOfBirth: "Tarlac City, Philippines", age: 38, sex: "Male", civilStatus: "Married",
    citizenship: "Filipino", religion: "Roman Catholic", height: "5'8\"", weight: "72 kg",
    languagesSpoken: ["English", "Tagalog", "Ilocano"],
    skills: ["Electrical Installation", "Wiring", "Panel Assembly", "CCTV Installation"],
    certifications: ["TESDA NC II - Electrical Installation and Maintenance"],
    workExperience: [],
    address: "Quezon City",
    employmentHistory: [
      { id: "eh-c1", company: "PowerTech Corporation", position: "Electrical Technician", dateStarted: "2019-01-07", dateEnded: "2019-03-14", country: "Philippines", isPresent: false, reasonForLeaving: "Terminated due to workplace policy violation" },
      { id: "eh-c2", company: "NTC Electrical Services", position: "Electrician", dateStarted: "2019-06-01", dateEnded: "2023-12-31", country: "Philippines", isPresent: false, reasonForLeaving: "Contract ended — pursued overseas opportunity" },
    ],
    employmentFlags: [
      { id: "f-c1", type: "short_stint", severity: "warning", description: "Short tenure of 2 months at \"PowerTech Corporation\" as Electrical Technician. Short stints may signal instability or issues.", relatedJobIds: ["eh-c1"], dismissed: false },
      { id: "f-c2", type: "red_flag_resignation", severity: "critical", description: "Reason for leaving \"PowerTech Corporation\" contains high-risk keyword: \"TERMINATED\". This must be clarified before proceeding to evaluation.", relatedJobIds: ["eh-c1"], dismissed: false },
    ],
  },

  {
    id: "APP-2026-152", name: "Jose Mendoza", firstName: "Jose", middleName: "Cruz", lastName: "Mendoza",
    role: "Construction Worker / Mason", jobOrder: "JO-2026-0042 (Al-Futtaim Engineering)", phase: 1, status: "Initial Screening",
    currentHandler: "Sarah Cruz", currentDepartment: "Recruitment", lastUpdated: "2026-06-03 08:45",
    phaseDescription: "Overlapping employment dates detected — possible data error or moonlighting",
    presentAddress: "Brgy. Batasan Hills, Quezon City", provincialAddress: "Cabanatuan City, Nueva Ecija",
    email: "jose.mendoza.ph@gmail.com", contact: "+63 912 001 0003", dateOfBirth: "1985-11-08",
    placeOfBirth: "Cabanatuan City, Philippines", age: 40, sex: "Male", civilStatus: "Married",
    citizenship: "Filipino", religion: "Roman Catholic", height: "5'9\"", weight: "78 kg",
    languagesSpoken: ["English", "Tagalog", "Kapampangan"],
    skills: ["Masonry", "Concrete Work", "Steel Reinforcement", "Blueprint Reading"],
    certifications: ["TESDA NC II - Masonry"],
    workExperience: [],
    address: "Quezon City",
    employmentHistory: [
      { id: "eh-j1", company: "BuildRight Construction Inc.", position: "Mason", dateStarted: "2020-01-06", dateEnded: "2021-12-31", country: "Philippines", isPresent: false, reasonForLeaving: "Project completion" },
      { id: "eh-j2", company: "Metro Infra Corporation", position: "Construction Worker", dateStarted: "2021-10-04", dateEnded: "2022-09-30", country: "Philippines", isPresent: false, reasonForLeaving: "Better offer" },
      { id: "eh-j3", company: "Gulf Projects LLC", position: "Mason / Formwork Carpenter", dateStarted: "2023-02-01", dateEnded: "", country: "Qatar", isPresent: true, reasonForLeaving: "" },
    ],
    employmentFlags: [
      { id: "f-j1", type: "overlap", severity: "warning", description: "Overlapping employment: \"Metro Infra Corporation\" started (2021-10-04) before \"BuildRight Construction Inc.\" ended (2021-12-31). May indicate moonlighting or a data entry error.", relatedJobIds: ["eh-j1", "eh-j2"], dismissed: false },
    ],
  },

  {
    id: "APP-2026-153", name: "Elena Torres", firstName: "Elena", middleName: "Sta. Ana", lastName: "Torres",
    role: "Caregiver / Nurse", jobOrder: "JO-2026-0051 (Dubai Healthcare)", phase: 1, status: "Initial Screening",
    currentHandler: "Sarah Cruz", currentDepartment: "Recruitment", lastUpdated: "2026-06-04 11:00",
    phaseDescription: "Possible demotion in employment history requires recruiter review and clarification",
    presentAddress: "Brgy. Paltok, Quezon City", provincialAddress: "Legazpi City, Albay",
    email: "elena.torres.ph@gmail.com", contact: "+63 912 001 0004", dateOfBirth: "1987-05-30",
    placeOfBirth: "Legazpi City, Philippines", age: 38, sex: "Female", civilStatus: "Single",
    citizenship: "Filipino", religion: "Roman Catholic", height: "5'3\"", weight: "50 kg",
    languagesSpoken: ["English (Proficient)", "Tagalog", "Bicolano"],
    skills: ["Nursing Care", "Team Leadership", "Patient Assessment", "Medication Administration", "CPR/BLS"],
    certifications: ["PRC License - Registered Nurse", "TESDA NC II - Caregiving", "BLS Certified"],
    workExperience: [],
    address: "Quezon City",
    employmentHistory: [
      { id: "eh-e1", company: "BioMed General Hospital", position: "Nursing Supervisor", dateStarted: "2016-03-01", dateEnded: "2020-02-29", country: "Philippines", isPresent: false, reasonForLeaving: "Hospital downsizing" },
      { id: "eh-e2", company: "Sunshine Care Home", position: "Junior Care Aide", dateStarted: "2020-04-01", dateEnded: "2023-12-31", country: "Philippines", isPresent: false, reasonForLeaving: "Seeking overseas opportunity" },
    ],
    employmentFlags: [
      { id: "f-e1", type: "demotion", severity: "warning", description: "Possible demotion from \"Nursing Supervisor\" (BioMed General Hospital) to \"Junior Care Aide\" (Sunshine Care Home). Verify circumstances.", relatedJobIds: ["eh-e1", "eh-e2"], dismissed: false },
    ],
  },

  {
    id: "APP-2026-154", name: "Roberto Cruz", firstName: "Roberto", middleName: "Dela Paz", lastName: "Cruz",
    role: "Production Operator / Factory Worker", jobOrder: "JO-2026-0042 (Al-Futtaim Engineering)", phase: 1, status: "Processing Stopped",
    isStopped: true,
    stoppedReason: "Applicant has multiple critical flags: AWOL record, two separate short stints under 2 months, and a 20-month unexplained employment gap. Repeated pattern of instability disqualifies applicant from current job order. Applicant may re-apply after 6 months with supporting documentation.",
    stoppedBy: "Sarah Cruz",
    stoppedAt: "2026-06-05T10:00:00.000Z",
    stoppedPhase: 1,
    currentHandler: "Sarah Cruz", currentDepartment: "Recruitment", lastUpdated: "2026-06-05 10:00",
    phaseDescription: "Processing stopped by Recruitment — see stop reason for details",
    presentAddress: "Brgy. Kaunlaran, Manila", provincialAddress: "Batangas City, Batangas",
    email: "roberto.cruz.ph@gmail.com", contact: "+63 912 001 0005", dateOfBirth: "1992-09-17",
    placeOfBirth: "Batangas City, Philippines", age: 33, sex: "Male", civilStatus: "Single",
    citizenship: "Filipino", religion: "Roman Catholic", height: "5'6\"", weight: "65 kg",
    languagesSpoken: ["English (Basic)", "Tagalog", "Batangueño"],
    skills: ["Machine Operation", "Quality Control", "Assembly Line", "Forklift"],
    certifications: [],
    workExperience: [],
    address: "Manila",
    employmentHistory: [
      { id: "eh-r1", company: "Bigco Manufacturing Corp.", position: "Production Worker", dateStarted: "2019-01-07", dateEnded: "2019-02-08", country: "Philippines", isPresent: false, reasonForLeaving: "AWOL - absence without leave for 3 consecutive weeks" },
      { id: "eh-r2", company: "Small Parts Workshop", position: "Assembly Laborer", dateStarted: "2020-10-01", dateEnded: "2021-02-28", country: "Philippines", isPresent: false, reasonForLeaving: "Contract ended" },
      { id: "eh-r3", company: "FastPack Corporation", position: "Senior Production Supervisor", dateStarted: "2022-08-01", dateEnded: "2023-12-31", country: "Philippines", isPresent: false, reasonForLeaving: "Dispute with management" },
      { id: "eh-r4", company: "City Workshop Supply", position: "Junior Staff / Laborer", dateStarted: "2024-01-15", dateEnded: "", country: "Philippines", isPresent: true, reasonForLeaving: "" },
    ],
    employmentFlags: [
      { id: "f-r1", type: "short_stint", severity: "warning", description: "Short tenure of 1 month at \"Bigco Manufacturing Corp.\" as Production Worker. Short stints may signal instability or issues.", relatedJobIds: ["eh-r1"], dismissed: true, dismissedBy: "Sarah Cruz", dismissalReason: "Applicant confirmed AWOL. Flagged as critical pattern.", dismissedAt: "2026-06-05T09:30:00.000Z" },
      { id: "f-r2", type: "red_flag_resignation", severity: "critical", description: "Reason for leaving \"Bigco Manufacturing Corp.\" contains high-risk keyword: \"AWOL\". This must be clarified before proceeding to evaluation.", relatedJobIds: ["eh-r1"], dismissed: true, dismissedBy: "Sarah Cruz", dismissalReason: "Confirmed AWOL incident. Pattern is disqualifying.", dismissedAt: "2026-06-05T09:31:00.000Z" },
      { id: "f-r3", type: "gap", severity: "warning", description: "20-month employment gap between \"Bigco Manufacturing Corp.\" and \"Small Parts Workshop\". Applicant should explain this period.", relatedJobIds: ["eh-r1", "eh-r2"], dismissed: true, dismissedBy: "Sarah Cruz", dismissalReason: "Applicant claims to have been job hunting but could not provide documentation for 20 months.", dismissedAt: "2026-06-05T09:32:00.000Z" },
      { id: "f-r4", type: "short_stint", severity: "warning", description: "Short tenure of 4 months at \"Small Parts Workshop\" as Assembly Laborer. Short stints may signal instability or issues.", relatedJobIds: ["eh-r2"], dismissed: true, dismissedBy: "Sarah Cruz", dismissalReason: "Second short stint confirms pattern.", dismissedAt: "2026-06-05T09:33:00.000Z" },
      { id: "f-r5", type: "red_flag_resignation", severity: "critical", description: "Reason for leaving \"FastPack Corporation\" contains high-risk keyword: \"DISPUTE\". This must be clarified before proceeding to evaluation.", relatedJobIds: ["eh-r3"], dismissed: true, dismissedBy: "Sarah Cruz", dismissalReason: "Second critical flag (AWOL + dispute). Pattern deemed disqualifying.", dismissedAt: "2026-06-05T09:34:00.000Z" },
      { id: "f-r6", type: "demotion", severity: "warning", description: "Possible demotion from \"Senior Production Supervisor\" (FastPack Corporation) to \"Junior Staff / Laborer\" (City Workshop Supply). Verify circumstances.", relatedJobIds: ["eh-r3", "eh-r4"], dismissed: true, dismissedBy: "Sarah Cruz", dismissalReason: "Confirmed demotion — applicant states dispute at FastPack forced resignation. Processing stopped.", dismissedAt: "2026-06-05T09:35:00.000Z" },
    ],
  },
];

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

// ─── Landing Page ─────────────────────────────────────────────────────────────
function LandingPage({ onRegister, onSignIn }: { onRegister: () => void; onSignIn: () => void }) {
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

// ─── Registration Wizard ──────────────────────────────────────────────────────
type FormData = {
  agencyName: string; licenseNo: string; agencyType: string; address: string; city: string; phone: string; website: string;
  logoDataUrl: string; accentColor: string; tagline: string; dmwLicenseUrl: string; dmwLicenseName: string;
  adminName: string; adminEmail: string; adminPassword: string; adminConfirm: string;
  agreeTerms: boolean;
};

function RegistrationWizard({ onBack, onComplete }: {
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

function ProvisioningScreen({ form, onDone }: { form: FormData; onDone: () => void }) {
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

// ─── Main App ─────────────────────────────────────────────────────────────────
type AppView = "landing" | "register" | "provisioning" | "app";

export default function App() {
  const [view, setView] = useState<AppView>("landing");
  const [registrationForm, setRegistrationForm] = useState<FormData | null>(null);
  const [tenantName, setTenantName] = useState("");

  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("");
  const [currentUserName, setCurrentUserName] = useState("");
  const [loggedInApplicantId, setLoggedInApplicantId] = useState("");
  const [workflow, setWorkflow] = useState<WorkflowState>({ screeningPassed: false, medicalCleared: false, cvApproved: false, employerAccepted: false });
  const [applicants, setApplicants] = useState<ApplicantRecord[]>(mockApplicants);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);

  const addActivityLog = (log: Omit<ActivityLog, "id" | "timestamp">) => {
    setActivityLogs((prev) => [{ ...log, id: `LOG-${Date.now()}`, timestamp: new Date().toISOString() }, ...prev]);
  };

  const handleLogin = (role: UserRole, name?: string, applicantId?: string) => {
    setCurrentUserRole(role);
    setCurrentUserName(name || role);
    if (applicantId) setLoggedInApplicantId(applicantId);
    addActivityLog({ applicantId: applicantId || "", action: "User Login", performedBy: name || role, department: role, details: `${name || role} logged into the system` });
  };

  const handleLogout = () => {
    addActivityLog({ applicantId: "", action: "User Logout", performedBy: currentUserName, department: currentUserRole, details: `${currentUserName} logged out` });
    setCurrentUserRole("");
    setCurrentUserName("");
  };

  const updateWorkflow = (updates: Partial<WorkflowState>) => setWorkflow((prev) => ({ ...prev, ...updates }));
  const updateApplicant = (id: string, updates: Partial<ApplicantRecord>) => {
    setApplicants((prev) => prev.map((a) => a.id === id ? { ...a, ...updates, lastUpdated: new Date().toLocaleString() } : a));
  };
  const addExpense = (expense: Omit<ExpenseRecord, "id">) => setExpenses((prev) => [{ ...expense, id: `EXP-${Date.now()}` }, ...prev]);

  // Landing
  if (view === "landing") {
    return (
      <LandingPage
        onRegister={() => setView("register")}
        onSignIn={() => setView("app")}
      />
    );
  }

  // Registration wizard
  if (view === "register") {
    return (
      <RegistrationWizard
        onBack={() => setView("landing")}
        onComplete={(data) => {
          setRegistrationForm(data);
          setTenantName(data.agencyName);
          setView("provisioning");
        }}
      />
    );
  }

  // Provisioning animation
  if (view === "provisioning" && registrationForm) {
    return (
      <ProvisioningScreen
        form={registrationForm}
        onDone={() => { setView("app"); }}
      />
    );
  }

  // Tenant workspace
  if (view === "app") {
    if (!currentUserRole) {
      return (
        <div>
          {tenantName && (
            <div className="bg-[#10B981] text-white text-sm px-4 py-2.5 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 size={15} />
                Workspace for <strong>{tenantName}</strong> is active. Sign in to continue.
              </span>
              <button onClick={() => { setView("landing"); setTenantName(""); }} className="text-white/80 hover:text-white underline text-xs">
                ← Back to site
              </button>
            </div>
          )}
          <LoginScreen onLogin={handleLogin} applicants={applicants} tenantName={tenantName} />
        </div>
      );
    }

    if (currentUserRole === "Applicant") {
      return <ApplicantPortal onLogout={handleLogout} />;
    }

    if (currentUserRole === "Employer") {
      return <EmployerPortal onLogout={handleLogout} />;
    }

    return (
      <AppShell
        currentUserRole={currentUserRole}
        currentUserName={currentUserName}
        workflow={workflow}
        updateWorkflow={updateWorkflow}
        applicants={applicants}
        updateApplicant={updateApplicant}
        activityLogs={activityLogs}
        addActivityLog={addActivityLog}
        expenses={expenses}
        addExpense={addExpense}
        onLogout={handleLogout}
      />
    );
  }

  return null;
}
