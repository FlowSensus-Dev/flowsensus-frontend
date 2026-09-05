import { useState } from "react";
import LoginScreen from "../features/auth/components/LoginScreen";
import AppShell from "../components/layout/AppShell";
import ApplicantPortal from "../features/applicant-portal/components/ApplicantPortal";
import EmployerPortal from "../features/employer/components/EmployerPortal";
import { UserRole, WorkflowState, ApplicantRecord, ActivityLog, ExpenseRecord } from "./types";
import { CheckCircle2 } from "lucide-react";
import { mockApplicants } from "../data/mock-applicants";
import LandingPage from "../features/landing/components/LandingPage";
import RegistrationWizard from "../features/registration/components/RegistrationWizard";
import ProvisioningScreen from "../features/registration/components/ProvisioningScreen";
import { FormData } from "../features/registration/components/RegistrationWizard";

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
