import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout.jsx";

// Global & Shared Pages
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
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

// Administration
import FitToWork from "./pages/administration/FitToWork";
import RequirementsSetup from "./pages/administration/RequirementsSetup";
import EvaluationSetup from "./pages/administration/EvaluationSetup";
import JobOrders from "./pages/administration/JobOrders";

// Accounting
import ExpenseLedger from "./pages/accounting/ExpenseLedger";

// Management
import ManagerHub from "./pages/manager/ManagerHub";
import CVEncoding from "./pages/manager/CVEncoding";
import EndorsementTracker from "./pages/manager/EndorsementTracker";
import PredictiveForecast from "./pages/manager/PredictiveForecast";
import DeploymentHistory from "./pages/manager/DeploymentHistory";
import OperationalReports from "./pages/manager/OperationalReports";
import UserManagement from "./pages/manager/UserManagement";

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
            <Route index element={<ManagerHub />} />
            <Route path="applicant-list" element={<ApplicantList />} />
            <Route path="applicant-profile/:id" element={<ApplicantProfile />} />
            <Route path="cv-encoding" element={<CVEncoding />} />
            <Route path="endorsement-tracker" element={<EndorsementTracker />} />
            <Route path="document-ocr" element={<DocumentOCR />} />
            <Route path="3-2-1-alerts" element={<ComplianceAlerts />} />
            <Route path="employer-hub" element={<EmployerProfiles />} />
            <Route path="predictive-timeline" element={<PredictiveForecast />} />
            <Route path="deployment-history" element={<DeploymentHistory />} />
            <Route path="operational-reports" element={<OperationalReports />} />
            <Route path="user-management" element={<UserManagement />} />
          </Route>

          {/* RECRUITMENT OPS */}
          <Route path="/recruitment">
            <Route index element={<Dashboard />} />
            <Route path="applicant-list" element={<ApplicantList />} />
            <Route path="applicant-profile/:id" element={<ApplicantProfile />} />
            <Route path="registration" element={<Registration />} />
            <Route path="screening-panel" element={<Screening />} />
            <Route path="applicant-profiling" element={<SmartProfiling />} />
          </Route>

          {/* ADMIN OPS */}
          <Route path="/administration">
            <Route index element={<Dashboard />} />
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
            <Route index element={<Dashboard />} />
            <Route path="applicant-list" element={<ApplicantList />} />
            <Route path="applicant-profile/:id" element={<ApplicantProfile />} />
            <Route path="expense-ledger" element={<ExpenseLedger />} />
          </Route>

        </Route>
      </Routes>
    </BrowserRouter>
  );
}