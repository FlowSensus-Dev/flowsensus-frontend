import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout.jsx";

// Global & Shared Pages
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ApplicantList from "./pages/ApplicantList";
import ApplicantProfile from "./pages/ApplicantProfile";
import DocumentOCR from "./pages/DocumentOCR";
import ComplianceAlerts from "./pages/ComplianceAlerts";
import EmployerProfiles from "./pages/EmployerProfiles";
import UserProfile from "./pages/UserProfile";

// Recruitment
import Registration from "./pages/recruitment/Registration";
import Screening from "./pages/recruitment/Screening";
import SmartProfiling from "./pages/recruitment/SmartProfiling";
import RecruitmentDashboard from "./pages/recruitment/RecruitmentDashboard";

// Administration
import FitToWork from "./pages/administration/FitToWork";
import RequirementsSetup from "./pages/administration/RequirementsSetup";
import EvaluationSetup from "./pages/administration/EvaluationSetup";
import JobOrders from "./pages/administration/JobOrders";
import AdministrationDashboard from "./pages/administration/AdministrationDashboard";

// Accounting
import ExpenseLedger from "./pages/accounting/ExpenseLedger";
import AccountingDashboard from "./pages/accounting/AccountingDashboard";

// Management
import ManagerHub from "./pages/manager/ManagerHub";
import ManagerDashboard from "./pages/manager/ManagerDashboard";
import CVEncoding from "./pages/manager/CVEncoding";
import EndorsementTracker from "./pages/manager/EndorsementTracker";
import PredictiveForecast from "./pages/manager/PredictiveForecast";
import DeploymentHistory from "./pages/manager/DeploymentHistory";
import OperationalReports from "./pages/manager/OperationalReports";
import UserManagement from "./pages/manager/UserManagement";

// Super Admin
import SuperAdminDashboard from "./pages/super-admin/SuperAdminDashboard";
import TenantManagement from "./pages/super-admin/TenantManagement";
import AgencyOnboarding from "./pages/super-admin/AgencyOnboarding";
import AuditLedger from "./pages/super-admin/AuditLedger";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        <Route element={<AppLayout />}>
          <Route path="/profile" element={<UserProfile />} />

          {/* MANAGEMENT OPS */}
          <Route path="/manager">
            <Route index element={<ManagerDashboard />} />
            <Route path="applicant-list" element={<ApplicantList />} />
            <Route path="applicant-profile" element={<ApplicantProfile />} />
            <Route path="applicant-profile/:id" element={<ApplicantProfile />} />
            <Route path="cv-encoding" element={<CVEncoding />} />
            <Route path="endorsement-tracker" element={<EndorsementTracker />} />
            <Route path="document-ocr" element={<DocumentOCR />} />
            <Route path="3-2-1-alerts" element={<ComplianceAlerts />} />
            <Route path="employer-hub" element={<ManagerHub />} />
            <Route path="predictive-timeline" element={<PredictiveForecast />} />
            <Route path="deployment-history" element={<DeploymentHistory />} />
            <Route path="operational-reports" element={<OperationalReports />} />
            <Route path="user-management" element={<UserManagement />} />
          </Route>

          {/* RECRUITMENT OPS */}
          <Route path="/recruitment">
            <Route index element={<RecruitmentDashboard />} />
            <Route path="applicant-list" element={<ApplicantList />} />
            <Route path="applicant-profile/:id" element={<ApplicantProfile />} />
            <Route path="registration" element={<Registration />} />
            <Route path="screening-panel" element={<Screening />} />
            <Route path="applicant-profiling" element={<SmartProfiling />} />
          </Route>

          {/* ADMIN OPS */}
          <Route path="/administration">
            <Route index element={<AdministrationDashboard />} />
            <Route path="applicant-list" element={<ApplicantList />} />
            <Route path="applicant-profile/:id" element={<ApplicantProfile />} />
            <Route path="document-requirements" element={<RequirementsSetup />} />
            <Route path="evaluation-workflow" element={<EvaluationSetup />} />
            <Route path="job-orders" element={<JobOrders />} />
            <Route path="employer-profiles" element={<EmployerProfiles />} />
            <Route path="fit-to-work" element={<FitToWork />} />
            <Route path="document-ocr" element={<DocumentOCR />} />
            <Route path="3-2-1-alerts" element={<ComplianceAlerts />} />
          </Route>

          {/* ACCOUNTING OPS */}
          <Route path="/accounting">
            <Route index element={<AccountingDashboard />} />
            <Route path="applicant-list" element={<ApplicantList />} />
            <Route path="applicant-profile/:id" element={<ApplicantProfile />} />
            <Route path="expense-ledger" element={<ExpenseLedger />} />
          </Route>

          {/* SUPER ADMIN OPS */}
          <Route path="/super-admin">
            <Route index element={<SuperAdminDashboard />} />
          
            <Route path="tenant-management" element={<TenantManagement />} />
            <Route path="agency-onboarding" element={<AgencyOnboarding />} />
            <Route path="audit-ledger" element={<AuditLedger />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}


