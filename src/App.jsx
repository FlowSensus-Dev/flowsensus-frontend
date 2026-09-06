import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout.jsx";
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";

// Dashboards (Path based on your recent move)
import SuperAdminDashboard from './pages/dashboard/SuperAdminDashboard';
import ManagerDashboard from './pages/dashboard/ManagerDashboard';
import RecruitmentDashboard from './pages/dashboard/RecruitmentDashboard';
import AdministrationDashboard from './pages/dashboard/AdministrationDashboard';
import AccountingDashboard from './pages/dashboard/AccountingDashboard';

// 1. IMPORT YOUR 22 NEW PAGES HERE
// (Verify the exact file paths match where you saved them)
import Registration from './pages/Registration'; 
import ApplicantList from './pages/ApplicantList'; 

// Fallback for pages you haven't imported yet
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

        {/* The AppLayout shell handles the Sidebar and Top Header */}
        <Route element={<AppLayout />}>
          
          <Route path="/super-admin" element={<SuperAdminDashboard />} />

          {/* MANAGER ROUTE BLOCK */}
          <Route path="/manager">
            <Route index element={<ManagerDashboard />} />
            <Route path="administrative-compliance-center" element={<PlaceholderView title="Compliance Center" />} />
            <Route path="applicant-list" element={<PlaceholderView title="Applicant List" />} />
            <Route path="applicant-profile" element={<PlaceholderView title="Applicant Profile" />} />
            <Route path="agency-configuration" element={<PlaceholderView title="Agency Config" />} />
          </Route>

          {/* RECRUITMENT ROUTE BLOCK */}
          <Route path="/recruitment">
            <Route index element={<RecruitmentDashboard />} />
            {/* Replace Placeholders with your actual imported components */}
            <Route path="registration" element={<Registration />} />
            <Route path="applicant-list" element={<ApplicantList />} />
            <Route path="applicant-profile" element={<PlaceholderView title="Applicant Profile" />} />
            <Route path="screening-panel" element={<PlaceholderView title="Screening Panel" />} />
            <Route path="intake-matching" element={<PlaceholderView title="Intake Matching" />} />
            <Route path="applicant-profiling" element={<PlaceholderView title="Applicant Profiling" />} />
          </Route>

          {/* ADMINISTRATION ROUTE BLOCK */}
          <Route path="/administration">
            <Route index element={<AdministrationDashboard />} />
            <Route path="administrative-compliance-center" element={<PlaceholderView title="Compliance Center" />} />
            <Route path="applicant-list" element={<ApplicantList />} />
            <Route path="applicant-profile" element={<PlaceholderView title="Applicant Profile" />} />
            <Route path="agency-configuration" element={<PlaceholderView title="Agency Config" />} />
          </Route>

          {/* ACCOUNTING ROUTE BLOCK */}
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
