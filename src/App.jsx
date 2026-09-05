import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import LoginPage from "./pages/LoginPage";
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import LandingPage from './pages/LandingPage';

function DashboardPage() {
  return <div>Dashboard Page</div>;
}

function ApplicantsPage() {
  return <div>Applicants Page</div>;
}

function AgenciesPage() {
  return <div>Agencies Page</div>;
}

function FinancePage() {
  return <div>Finance Page</div>;
}

function ForecastingPage() {
  return <div>Forecasting Page</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Direct testing route for the new dashboard */}
        <Route path="/super-admin" element={<SuperAdminDashboard />} />

        <Route element={<AppLayout />}>
          <Route path="home" element={<Navigate to="/" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/applicants" element={<ApplicantsPage />} />
          <Route path="/agencies" element={<AgenciesPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/forecasting" element={<ForecastingPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}