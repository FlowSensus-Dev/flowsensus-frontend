import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";
import SuperAdminDashboard from './pages/SuperAdminDashboard';

// Departmental Dashboards
import ManagerDashboard from './pages/ManagerDashboard';
import RecruitmentDashboard from './pages/RecruitmentDashboard';
import AdministrationDashboard from './pages/AdministrationDashboard';
import AccountingDashboard from './pages/AccountingDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        
        {/* Super Admin Route */}
        <Route path="/super-admin" element={<SuperAdminDashboard />} />

        {/* Protected Agency Staff Routes */}
        <Route element={<AppLayout />}>
          {/* Default fallback for testing */}
          <Route path="/dashboard" element={<ManagerDashboard />} />
          
          {/* Specific RBAC Views */}
          <Route path="/manager" element={<ManagerDashboard />} />
          <Route path="/recruitment" element={<RecruitmentDashboard />} />
          <Route path="/administration" element={<AdministrationDashboard />} />
          <Route path="/accounting" element={<AccountingDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}