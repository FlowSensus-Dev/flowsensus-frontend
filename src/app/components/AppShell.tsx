import { useState, useEffect } from 'react';
import { Search, Bell, LogOut, Info } from 'lucide-react';
import { UserRole, WorkflowState, ApplicantRecord, ActivityLog, ExpenseRecord } from '../types';
import Sidebar from './Sidebar';
import Dashboard from './views/Dashboard';
import ApplicantList from './views/ApplicantList';
import ApplicantProfile from './views/ApplicantProfile';
import Registration from './views/Registration';
import Screening from './views/Screening';
import SmartProfiling from './views/SmartProfiling';
import CVEncoding from './views/CVEncoding';
import EndorsementTracker from './views/EndorsementTracker';
import FitToWork from './views/FitToWork';
import DocumentOCR from './views/DocumentOCR';
import ComplianceAlerts from './views/ComplianceAlerts';
import ExpenseLedger from './views/ExpenseLedger';
import PredictiveForecast from './views/PredictiveForecast';
import UserManagement from './views/UserManagement';
import DeploymentHistory from './views/DeploymentHistory';
import OperationalReports from './views/OperationalReports';
import ManagerHub from './views/ManagerHub';
import RecruitmentDashboard from './views/dashboards/RecruitmentDashboard';
import AdminDashboard from './views/dashboards/AdminDashboard';
import AccountingDashboard from './views/dashboards/AccountingDashboard';
import ManagementDashboard from './views/dashboards/ManagementDashboard';
import UserProfile from './views/UserProfile';
import RequirementsSetup from './views/RequirementsSetup';
import EvaluationSetup from './views/EvaluationSetup';
import JobOrders from './views/JobOrders';
import EmployerProfiles from './views/EmployerProfiles';

export type ViewType =
  | 'dashboard'
  | 'applicants'
  | 'applicant'
  | 'registration'
  | 'screening'
  | 'profiling'
  | 'cv'
  | 'endorsement'
  | 'fittowork'
  | 'ocr'
  | 'alerts'
  | 'expense'
  | 'manager'
  | 'forecast'
  | 'users'
  | 'history'
  | 'reports'
  | 'profile'
  | 'requirements'
  | 'evaluation'
  | 'joborders'
  | 'employers';

interface AppShellProps {
  currentUserRole: UserRole;
  currentUserName: string;
  workflow: WorkflowState;
  updateWorkflow: (updates: Partial<WorkflowState>) => void;
  applicants: ApplicantRecord[];
  updateApplicant: (applicantId: string, updates: Partial<ApplicantRecord>) => void;
  activityLogs: ActivityLog[];
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  expenses: ExpenseRecord[];
  addExpense: (expense: Omit<ExpenseRecord, 'id'>) => void;
  onLogout: () => void;
}

export default function AppShell({
  currentUserRole,
  currentUserName,
  workflow,
  updateWorkflow,
  applicants,
  updateApplicant,
  activityLogs,
  addActivityLog,
  expenses,
  addExpense,
  onLogout,
}: AppShellProps) {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [selectedApplicantId, setSelectedApplicantId] = useState<string>(applicants[0]?.id || '');
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  const showToastNotification = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  };

  useEffect(() => {
    if (currentUserRole) {
      showToastNotification(`Authenticated via RBAC as ${currentUserName}`);
    }
  }, [currentUserRole, currentUserName]);

  const handleViewApplicant = (applicantId: string) => {
    setSelectedApplicantId(applicantId);
    setCurrentView('applicant');
  };

  const renderView = () => {
    const selectedApplicant = applicants.find((a) => a.id === selectedApplicantId) || applicants[0];

    switch (currentView) {
      case 'dashboard':
        // Render role-specific dashboards
        switch (currentUserRole) {
          case 'Recruitment':
            return (
              <RecruitmentDashboard
                applicants={applicants}
                activityLogs={activityLogs}
                onViewApplicant={handleViewApplicant}
                onNavigate={setCurrentView}
              />
            );
          case 'Admin':
            return (
              <AdminDashboard
                applicants={applicants}
                onViewApplicant={handleViewApplicant}
                onNavigate={setCurrentView}
              />
            );
          case 'Accounting':
            return (
              <AccountingDashboard
                applicants={applicants}
                expenses={expenses}
                onNavigate={setCurrentView}
                onAddExpense={addExpense}
              />
            );
          case 'Management':
            return (
              <ManagementDashboard
                applicants={applicants}
                activityLogs={activityLogs}
                onViewApplicant={handleViewApplicant}
                onNavigate={setCurrentView}
              />
            );
          default:
            return (
              <Dashboard
                applicants={applicants}
                activityLogs={activityLogs}
                currentUserRole={currentUserRole}
                onViewApplicant={handleViewApplicant}
              />
            );
        }
      case 'applicants':
        return (
          <ApplicantList
            applicants={applicants}
            onViewApplicant={handleViewApplicant}
            currentUserName={currentUserName}
            onNavigate={setCurrentView}
          />
        );
      case 'applicant':
        return (
          <ApplicantProfile
            applicant={selectedApplicant}
            activityLogs={activityLogs.filter((log) => log.applicantId === selectedApplicant.id)}
            expenses={expenses.filter((exp) => exp.applicantId === selectedApplicant.id)}
            updateApplicant={updateApplicant}
            currentUserName={currentUserName}
            addActivityLog={addActivityLog}
            showToast={showToastNotification}
          />
        );
      case 'registration':
        return (
          <Registration
            showToast={showToastNotification}
            currentUserName={currentUserName}
            addActivityLog={addActivityLog}
            selectedApplicantId={selectedApplicantId}
            updateApplicant={updateApplicant}
            applicants={applicants}
          />
        );
      case 'screening':
        return (
          <Screening
            workflow={workflow}
            updateWorkflow={updateWorkflow}
            showToast={showToastNotification}
            currentUserName={currentUserName}
            addActivityLog={addActivityLog}
            updateApplicant={updateApplicant}
            selectedApplicantId={selectedApplicantId}
            applicants={applicants}
          />
        );
      case 'profiling':
        return (
          <SmartProfiling
            showToast={showToastNotification}
            applicants={applicants}
            currentUserName={currentUserName}
            addActivityLog={addActivityLog}
            selectedApplicantId={selectedApplicantId}
            workflow={workflow}
          />
        );
      case 'cv':
        return (
          <CVEncoding
            workflow={workflow}
            showToast={showToastNotification}
            currentUserName={currentUserName}
            addActivityLog={addActivityLog}
            updateApplicant={updateApplicant}
            selectedApplicantId={selectedApplicantId}
            applicants={applicants}
          />
        );
      case 'endorsement':
        return (
          <EndorsementTracker
            applicants={applicants}
            currentUserName={currentUserName}
            addActivityLog={addActivityLog}
            updateApplicant={updateApplicant}
          />
        );
      case 'fittowork':
        return (
          <FitToWork
            workflow={workflow}
            updateWorkflow={updateWorkflow}
            showToast={showToastNotification}
            currentUserName={currentUserName}
            addActivityLog={addActivityLog}
            updateApplicant={updateApplicant}
            selectedApplicantId={selectedApplicantId}
            applicants={applicants}
          />
        );
      case 'ocr':
        return (
          <DocumentOCR
            workflow={workflow}
            currentUserName={currentUserName}
            addActivityLog={addActivityLog}
            showToast={showToastNotification}
            selectedApplicantId={selectedApplicantId}
            applicants={applicants}
          />
        );
      case 'alerts':
        return <ComplianceAlerts applicants={applicants} showToast={showToastNotification} />;
      case 'expense':
        return (
          <ExpenseLedger
            workflow={workflow}
            expenses={expenses}
            addExpense={addExpense}
            currentUserName={currentUserName}
            addActivityLog={addActivityLog}
            showToast={showToastNotification}
            selectedApplicantId={selectedApplicantId}
            applicants={applicants}
          />
        );
      case 'manager':
        return (
          <ManagerHub
            workflow={workflow}
            updateWorkflow={updateWorkflow}
            showToast={showToastNotification}
            applicants={applicants}
            currentUserName={currentUserName}
            addActivityLog={addActivityLog}
            updateApplicant={updateApplicant}
            selectedApplicantId={selectedApplicantId}
          />
        );
      case 'forecast':
        return <PredictiveForecast applicants={applicants} />;
      case 'history':
        return <DeploymentHistory activityLogs={activityLogs} applicants={applicants} />;
      case 'reports':
        return <OperationalReports applicants={applicants} activityLogs={activityLogs} expenses={expenses} />;
      case 'users':
        return <UserManagement currentUserName={currentUserName} addActivityLog={addActivityLog} />;
      case 'profile':
        return (
          <UserProfile
            currentUserName={currentUserName}
            currentUserRole={currentUserRole}
            activityLogs={activityLogs}
            showToast={showToastNotification}
          />
        );
      case 'requirements':
        return <RequirementsSetup showToast={showToastNotification} currentUserName={currentUserName} />;
      case 'evaluation':
        return <EvaluationSetup showToast={showToastNotification} currentUserName={currentUserName} />;
      case 'joborders':
        return <JobOrders showToast={showToastNotification} currentUserName={currentUserName} />;
      case 'employers':
        return <EmployerProfiles showToast={showToastNotification} currentUserName={currentUserName} />;
      default:
        return (
          <Dashboard
            applicants={applicants}
            activityLogs={activityLogs}
            currentUserRole={currentUserRole}
            onViewApplicant={handleViewApplicant}
          />
        );
    }
  };

  return (
    <div className="w-full min-h-screen flex bg-[#F1F5F9]">
      <Sidebar currentUserRole={currentUserRole} currentView={currentView} onViewChange={setCurrentView} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Bar */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between z-10 sticky top-0">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-4 top-2.5 text-slate-400" />
              <input
                type="text"
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && globalSearchQuery.trim()) {
                    const found = applicants.find(
                      (a) =>
                        a.id.toLowerCase().includes(globalSearchQuery.toLowerCase()) ||
                        a.name.toLowerCase().includes(globalSearchQuery.toLowerCase())
                    );
                    if (found) {
                      handleViewApplicant(found.id);
                      setGlobalSearchQuery('');
                    } else {
                      showToastNotification(`No applicant found matching "${globalSearchQuery}"`);
                    }
                  }
                }}
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-[#0EA5E9] outline-none transition-all placeholder:text-slate-500 font-medium"
                placeholder="Search applicant ID or name (press Enter)..."
              />
            </div>
          </div>
          <div className="flex items-center gap-6 ml-4">
            <button
              onClick={() => setCurrentView('profile')}
              className="hidden md:flex text-xs font-bold text-[#0F172A] bg-slate-100 px-3 py-1.5 rounded-full items-center gap-2 border border-slate-200 hover:border-[#0EA5E9] hover:bg-[#0EA5E9]/5 transition-all cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span> {currentUserName}
            </button>
            <button className="relative hover:text-[#0EA5E9] transition-colors">
              <Bell className="w-5 h-5 text-[#475569]" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#EF4444] rounded-full text-white text-[10px] flex items-center justify-center font-bold border-2 border-white">
                {activityLogs.length > 9 ? '9+' : activityLogs.length}
              </span>
            </button>
            <div className="h-6 w-px bg-slate-200"></div>
            <button
              onClick={onLogout}
              className="text-sm font-bold text-[#475569] hover:text-[#EF4444] transition-colors flex items-center gap-2"
            >
              Logout <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Toast Notification */}
        <div
          className={`absolute top-20 right-8 bg-[#0F172A] text-white px-5 py-4 rounded-lg shadow-2xl z-50 flex items-center gap-3 text-sm font-semibold border-l-4 border-[#0EA5E9] transition-transform duration-300 ${
            showToast ? 'translate-x-0' : 'translate-x-[150%]'
          }`}
        >
          <Info className="w-5 h-5 text-[#0EA5E9]" />
          <span>{toastMessage}</span>
        </div>

        {/* Views Container */}
        <div className="flex-1 overflow-y-auto p-8 relative">{renderView()}</div>
      </div>
    </div>
  );
}
