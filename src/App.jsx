import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout.jsx";
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";

// Super Admin
import SuperAdminDashboard from "./pages/super-admin/SuperAdminDashboard";
import TenantManagement from "./pages/super-admin/TenantManagement";
import AgencyOnboarding from "./pages/super-admin/AgencyOnboarding";
import AuditLedger from "./pages/super-admin/AuditLedger";

// Manager
import ManagerDashboard from "./pages/manager/ManagerDashboard";

// Recruitment
import RecruitmentDashboard from "./pages/dashboard/RecruitmentDashboard";

// Administration
import AdministrationDashboard from "./pages/administration/AdministrationDashboard";

// Accounting
import AccountingDashboard from "./pages/accounting/AccountingDashboard";

import Registration from "./pages/Registration";
import ApplicantList from "./pages/ApplicantList";

const PlaceholderView = ({ title }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
    <h3 className="text-lg font-bold text-slate-800">{title}</h3>
    <p className="text-sm text-slate-500 mt-2">UI component connected, pending import.</p>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        <Route element={<AppLayout />}>
          <Route path="/super-admin">
            <Route index element={<SuperAdminDashboard />} />
            <Route path="tenant-management" element={<TenantManagement />} />
            <Route path="agency-onboarding" element={<AgencyOnboarding />} />
            <Route path="audit-ledger" element={<AuditLedger />} />
          </Route>

          <Route path="/manager">
            <Route index element={<ManagerDashboard />} />
            <Route path="administrative-compliance-center" element={<PlaceholderView title="Compliance Center" />} />
            <Route path="applicant-list" element={<PlaceholderView title="Applicant List" />} />
            <Route path="applicant-profile" element={<PlaceholderView title="Applicant Profile" />} />
            <Route path="agency-configuration" element={<PlaceholderView title="Agency Config" />} />
          </Route>

          <Route path="/recruitment">
            <Route index element={<RecruitmentDashboard />} />
            <Route path="registration" element={<Registration />} />
            <Route path="applicant-list" element={<ApplicantList />} />
            <Route path="applicant-profile" element={<PlaceholderView title="Applicant Profile" />} />
            <Route path="screening-panel" element={<PlaceholderView title="Screening Panel" />} />
            <Route path="intake-matching" element={<PlaceholderView title="Intake Matching" />} />
            <Route path="applicant-profiling" element={<PlaceholderView title="Applicant Profiling" />} />
          </Route>

          <Route path="/administration">
            <Route index element={<AdministrationDashboard />} />
            <Route path="administrative-compliance-center" element={<PlaceholderView title="Compliance Center" />} />
            <Route path="applicant-list" element={<ApplicantList />} />
            <Route path="applicant-profile" element={<PlaceholderView title="Applicant Profile" />} />
            <Route path="agency-configuration" element={<PlaceholderView title="Agency Config" />} />
          </Route>

          <Route path="/accounting">
            <Route index element={<AccountingDashboard />} />
            <Route path="applicant-list" element={<ApplicantList />} />
            <Route path="applicant-profile" element={<PlaceholderView title="Applicant Profile" />} />
            <Route path="financials" element={<PlaceholderView title="Financials" />} />
            <Route path="expense-ledger" element={<PlaceholderView title="Expense Ledger" />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}