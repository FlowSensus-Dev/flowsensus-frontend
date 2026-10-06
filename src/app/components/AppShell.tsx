import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Search, Bell, LogOut, Info, Crown, Loader2, Lock } from 'lucide-react';
import { UserRole, ViewType, WorkflowState, ApplicantRecord, ActivityLog, ExpenseRecord, EvaluationTest } from '../types';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
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
import AccountingSettings, { getStoredRates } from './views/dashboards/AccountingSettings';

import { hasAccessToView } from '../../lib/accessControl';

export type { ViewType };

interface AppShellProps {
  currentUserRole: UserRole;
  currentUserRoles?: UserRole[];
  currentUserName: string;
  workflow: WorkflowState;
  updateWorkflow: (updates: Partial<WorkflowState>) => void;
  applicants: ApplicantRecord[];
  applicantsLoaded?: boolean;
  updateApplicant: (applicantId: string, updates: Partial<ApplicantRecord>) => void;
  addApplicant?: (newApplicant: ApplicantRecord) => void;
  activityLogs: ActivityLog[];
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  expenses: ExpenseRecord[];
  expensesLoaded?: boolean;
  addExpense: (expense: Omit<ExpenseRecord, 'id'>) => void;
  updateExpense?: (id: string, updates: Partial<ExpenseRecord>) => void;
  onLogout: () => void;
  isSuperAdmin?: boolean;
  onSuperAdminDashboard?: () => void;
  globalJobOrders?: any[];
  globalEmployers?: any[];
  globalStaff?: any[];
  globalRoles?: any[];
  globalPipelineForecast?: any;
  onJobOrdersChange?: (orders: any[]) => void;
  onEmployersChange?: (employers: any[]) => void;
}

export default function AppShell({
  currentUserRole,
  currentUserRoles,
  currentUserName,
  workflow,
  updateWorkflow,
  applicants,
  applicantsLoaded,
  updateApplicant,
  addApplicant,
  activityLogs,
  addActivityLog,
  expenses,
  expensesLoaded,
  addExpense,
  updateExpense,
  onLogout,
  isSuperAdmin,
  onSuperAdminDashboard,
  globalJobOrders,
  globalEmployers,
  globalStaff,
  globalRoles,
  globalPipelineForecast,
  onJobOrdersChange,
  onEmployersChange,
}: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Extract current view from URL (e.g. /app/dashboard)
  const pathParts = location.pathname.split('/');
  const rawView = pathParts[2];
  const currentView: ViewType = (rawView as ViewType) || 'dashboard';

  const setCurrentView = (view: ViewType | 'applicant') => {
    if (view === 'applicant') {
      navigate('/app/applicants');
    } else {
      if (view === 'applicants') {
        setSelectedApplicantId(null);
      }
      navigate(`/app/${view}`);
    }
  };

  useEffect(() => {
    if (rawView === 'applicant') {
      navigate('/app/applicants', { replace: true });
    }
  }, [rawView, navigate]);

  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(() => {
    return localStorage.getItem('flowsensus_selected_applicant') || 'new';
  });
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('flowsensus_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('flowsensus_sidebar_collapsed', String(next));
      } catch { }
      return next;
    });
  };

  // Persist selectedApplicantId to localStorage whenever it changes
  useEffect(() => {
    if (selectedApplicantId) {
      localStorage.setItem('flowsensus_selected_applicant', selectedApplicantId);
    } else {
      localStorage.removeItem('flowsensus_selected_applicant');
    }
  }, [selectedApplicantId]);

  // Keep selectedApplicantId in sync when applicants load or change (allow 'new' mode)
  useEffect(() => {
    if (applicants.length > 0 && selectedApplicantId && selectedApplicantId !== 'new' && !applicants.some(a => String(a.id) === String(selectedApplicantId))) {
      const fallbackId = String(applicants[0].id);
      setSelectedApplicantId(fallbackId);
      localStorage.setItem('flowsensus_selected_applicant', fallbackId);
    }
  }, [applicants, selectedApplicantId]);

  // Global Auto-Sync for Phase-based Expenses
  const processedPhases = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    if (!applicantsLoaded || !expensesLoaded || !expenses) return;
    
    // Fetch current rates to use when logging
    const rates = getStoredRates();
    
    applicants.forEach(app => {
      // Phase 3 (Medical Cleared) -> Medical Package
      if (app.phase >= 3) {
        const medicalKey = `${app.id}-medical`;
        if (!processedPhases.current.has(medicalKey)) {
          const hasMedicalExpense = expenses.some(e => String(e.applicantId) === String(app.id) && e.purpose.includes('Medical'));
          if (!hasMedicalExpense) {
            addExpense({
              applicantId: app.id,
              purpose: 'Medical Package (Fit-to-Work)',
              amount: rates.medical,
              currency: 'PESO',
              type: 'expense',
              remarks: 'Automated medical fee from phase change.',
              status: 'draft',
              date: new Date().toISOString().split('T')[0],
              recordedBy: 'System Auto-Trigger'
            });
          }
          processedPhases.current.add(medicalKey);
        }
      }
      
      // Phase 5 (Processing - Passporting, OEC) -> Document Processing
      if (app.phase >= 5) {
        const oecKey = `${app.id}-oec`;
        if (!processedPhases.current.has(oecKey)) {
          const hasOecExpense = expenses.some(e => String(e.applicantId) === String(app.id) && e.purpose.includes('OEC'));
          if (!hasOecExpense) {
            addExpense({
              applicantId: app.id,
              purpose: 'OEC Processing',
              amount: rates.oec,
              currency: 'PESO',
              type: 'expense',
              remarks: 'Automated processing fee from phase change.',
              status: 'draft',
              date: new Date().toISOString().split('T')[0],
              recordedBy: 'System Auto-Trigger'
            });
          }
          processedPhases.current.add(oecKey);
        }

        const passportKey = `${app.id}-passport`;
        if (!processedPhases.current.has(passportKey)) {
          const hasPassportExpense = expenses.some(e => String(e.applicantId) === String(app.id) && e.purpose.includes('Passport'));
          if (!hasPassportExpense) {
            addExpense({
              applicantId: app.id,
              purpose: 'Passport Processing',
              amount: rates.passport,
              currency: 'PESO',
              type: 'expense',
              remarks: 'Automated processing fee from phase change.',
              status: 'draft',
              date: new Date().toISOString().split('T')[0],
              recordedBy: 'System Auto-Trigger'
            });
          }
          processedPhases.current.add(passportKey);
        }
      }
    });
  }, [applicants, expenses, addExpense, applicantsLoaded]);

  const [workflowPermissions, setWorkflowPermissions] = useState<Record<string, UserRole[]> | undefined>(undefined);
  const [evaluationTemplates, setEvaluationTemplates] = useState<EvaluationTest[]>([]);

  // Fetch live evaluation templates from backend
  const fetchEvaluationTemplates = async () => {
    try {
      const res = await api.get('/evaluations/templates');
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        const liveTests: EvaluationTest[] = res.data.map((t: any) => ({
          id: String(t.test_template_id || t.id),
          name: t.name,
          type: (t.test_type || t.type || 'custom') as EvaluationTest['type'],
          description: t.description || '',
          maxScore: Number(t.max_score ?? t.maxScore ?? 100),
          passingScore: Number(t.passing_score ?? t.passingScore ?? 60),
          weight: Number(t.weight_percentage ?? t.weight ?? 10),
          scoringGuide: t.scoring_guide || t.scoringGuide || '',
          isActive: Boolean(t.is_active ?? t.isActive ?? true),
          scoringType: (t.scoring_type || t.scoringType || 'numeric') as 'numeric' | 'pass_fail',
          applicableJobOrders: Array.isArray(t.applicable_job_orders)
            ? t.applicable_job_orders
            : (Array.isArray(t.applicableJobOrders) ? t.applicableJobOrders : []),
        }));
        setEvaluationTemplates(liveTests);
      }
    } catch (err) {
      console.warn('Could not fetch evaluation templates:', err);
    }
  };

  useEffect(() => {
    fetchEvaluationTemplates();

    const evalChannel = supabase
      .channel('realtime:evaluation_templates_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'evaluation_template' },
        () => {
          fetchEvaluationTemplates();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(evalChannel);
    };
  }, []);

  // Fetch live workflow module permissions from backend & subscribe in real time
  useEffect(() => {
    const fetchWorkflowPerms = async () => {
      try {
        const res = await api.get('/workflow/modules');
        if (res.data && Array.isArray(res.data)) {
          const map: Record<string, UserRole[]> = {};
          res.data.forEach((m: any) => {
            const key = m.module_key || m.moduleKey;
            const roles = m.assigned_roles || m.assignedRoles || [];
            if (key) map[key] = roles;
          });
          setWorkflowPermissions(map);
        }
      } catch (err) {
        console.warn('Could not fetch workflow module permissions:', err);
      }
    };
    fetchWorkflowPerms();

    const permChannel = supabase
      .channel('realtime:workflow_module_access_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workflow_module_access' },
        (payload: any) => {
          console.log('[AppShell] Realtime module access change received:', payload.eventType);
          fetchWorkflowPerms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(permChannel);
    };
  }, []);

  const userRolesList: UserRole[] = (currentUserRoles && currentUserRoles.length > 0)
    ? currentUserRoles
    : (currentUserRole ? [currentUserRole] : []);

  // Determine if active user roles have finished resolving from session
  const isRolesLoaded = Boolean(isSuperAdmin || (userRolesList.length > 0 && userRolesList[0] !== ''));

  // Authoritative URL & Real-time Access Guard:
  // If the user navigates directly to an unauthorized URL or if permissions are revoked in real time,
  // ensure they cannot access modules they lack permission for.
  useEffect(() => {
    // Wait until user roles have loaded before making authorization decisions
    if (!isRolesLoaded) return;

    if (!hasAccessToView(currentView, userRolesList, isSuperAdmin, workflowPermissions)) {
      showToastNotification(`Access restricted: You do not have permission to access the ${currentView} module.`);
      navigate('/app/dashboard', { replace: true });
    }
  }, [currentView, workflowPermissions, currentUserRole, currentUserRoles, isSuperAdmin, isRolesLoaded, navigate]);

  const showToastNotification = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  };


  const handleViewApplicant = (applicantId: string) => {
    setSelectedApplicantId(String(applicantId));
    navigate('/app/applicants');
  };

  const handleNavigate = (view: ViewType) => {
    if (view === 'registration') {
      setSelectedApplicantId('new');
    }
    setCurrentView(view);
  };

  const renderView = () => {
    const isApplicantsLoading = applicantsLoaded === false;

    // While roles are loading on cold page reload, show subtle spinner rather than false-positive access denied
    if (!isRolesLoaded && currentView !== 'dashboard' && currentView !== 'applicants' && currentView !== 'profile') {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
          <p className="text-sm font-medium">Verifying access permissions...</p>
        </div>
      );
    }

    // Enforce immediate client-side barrier against broken access control / URL tampering
    if (isRolesLoaded && !hasAccessToView(currentView, userRolesList, isSuperAdmin, workflowPermissions)) {
      return (
        <div className="p-8 max-w-lg mx-auto mt-16 text-center bg-white rounded-2xl border border-red-200 shadow-sm animate-in fade-in zoom-in-95 duration-200">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100 shadow-inner">
            <Lock size={26} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Access Restricted</h2>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            You do not have permission to access the <span className="font-semibold text-slate-900 capitalize">{currentView}</span> module.
          </p>
          <div className="mt-3 py-1.5 px-3 bg-slate-50 rounded-lg inline-block border border-slate-200 text-xs text-slate-600 font-mono">
            Assigned Role{userRolesList.length > 1 ? 's' : ''}: <span className="font-semibold text-slate-800">{userRolesList.join(', ')}</span>
          </div>
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => handleNavigate('dashboard')}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-sm transition-all duration-150 cursor-pointer flex items-center gap-2"
            >
              <span>Return to Dashboard</span>
            </button>
          </div>
        </div>
      );
    }

    switch (currentView) {
      case 'dashboard':
        if (isSuperAdmin) {
          return (
            <div className="space-y-12 pb-12">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  <h2 className="text-lg font-bold text-slate-800">Management Dashboard</h2>
                </div>
                <div className="p-6">
                  <ManagementDashboard applicants={applicants} activityLogs={activityLogs} onViewApplicant={handleViewApplicant} onNavigate={handleNavigate} isLoading={isApplicantsLoading} />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                  <h2 className="text-lg font-bold text-slate-800">Recruitment Dashboard</h2>
                </div>
                <div className="p-6">
                  <RecruitmentDashboard applicants={applicants} activityLogs={activityLogs} onViewApplicant={handleViewApplicant} onNavigate={handleNavigate} isLoading={isApplicantsLoading} />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <h2 className="text-lg font-bold text-slate-800">Admin & Visa Dashboard</h2>
                </div>
                <div className="p-6">
                  <AdminDashboard applicants={applicants} onViewApplicant={handleViewApplicant} onNavigate={handleNavigate} isLoading={isApplicantsLoading} />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <h2 className="text-lg font-bold text-slate-800">Accounting Dashboard</h2>
                </div>
                <div className="p-6">
                  <AccountingDashboard applicants={applicants} expenses={expenses} onNavigate={handleNavigate} onAddExpense={addExpense} isLoading={isApplicantsLoading} onSelectApplicant={setSelectedApplicantId} />
                </div>
              </div>
            </div>
          );
        }

        // Render role-specific dashboards
        switch (currentUserRole) {
          case 'Recruitment':
            return (
              <RecruitmentDashboard
                applicants={applicants}
                activityLogs={activityLogs}
                onViewApplicant={handleViewApplicant}
                onNavigate={handleNavigate}
                isLoading={isApplicantsLoading}
              />
            );
          case 'Admin':
            return (
              <AdminDashboard
                applicants={applicants}
                onViewApplicant={handleViewApplicant}
                onNavigate={handleNavigate}
                isLoading={isApplicantsLoading}
              />
            );
          case 'Accounting':
            return (
              <AccountingDashboard
                applicants={applicants}
                expenses={expenses}
                onNavigate={handleNavigate}
                onViewApplicant={handleViewApplicant}
                onSelectApplicant={setSelectedApplicantId}
                onAddExpense={addExpense}
                isLoading={isApplicantsLoading}
              />
            );
          case 'Management':
            return (
              <ManagementDashboard
                applicants={applicants}
                activityLogs={activityLogs}
                onViewApplicant={handleViewApplicant}
                onNavigate={handleNavigate}
                isLoading={isApplicantsLoading}
              />
            );
          default:
            return (
              <Dashboard
                applicants={applicants}
                activityLogs={activityLogs}
                currentUserRole={currentUserRole}
                onViewApplicant={handleViewApplicant}
                isLoading={isApplicantsLoading}
              />
            );
        }
      case 'applicants':
        return (
          <ApplicantList
            applicants={applicants}
            isLoading={isApplicantsLoading}
            onViewApplicant={handleViewApplicant}
            currentUserName={currentUserName}
            onNavigate={handleNavigate}
            selectedApplicantId={selectedApplicantId || undefined}
            onClearSelection={() => setSelectedApplicantId(null)}
            activityLogs={activityLogs}
            expenses={expenses}
            updateApplicant={updateApplicant}
            addActivityLog={addActivityLog}
            showToast={showToastNotification}
            onEditApplicant={() => setCurrentView('registration')}
            currentUserRole={currentUserRole}
          />
        );
      case 'registration':
        return (
          <Registration
            showToast={showToastNotification}
            currentUserName={currentUserName}
            addActivityLog={addActivityLog}
            selectedApplicantId={selectedApplicantId || undefined}
            updateApplicant={updateApplicant}
            addApplicant={addApplicant}
            applicants={applicants}
            globalJobOrders={globalJobOrders}
            addExpense={addExpense}
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
            selectedApplicantId={selectedApplicantId || undefined}
            applicants={applicants}
            evaluationTemplates={evaluationTemplates}
            onTemplatesUpdated={fetchEvaluationTemplates}
            globalJobOrders={globalJobOrders}
          />
        );
      case 'profiling':
        return (
          <SmartProfiling
            showToast={showToastNotification}
            applicants={applicants}
            currentUserName={currentUserName}
            addActivityLog={addActivityLog}
            selectedApplicantId={selectedApplicantId || undefined}
            onSelectApplicant={setSelectedApplicantId}
            onViewApplicant={handleViewApplicant}
            updateApplicant={(id, data) => updateApplicant(String(id), data)}
            workflow={workflow}
            globalJobOrders={globalJobOrders}
            onNavigate={(view: string) => setCurrentView(view as any)}
            evaluationTemplates={evaluationTemplates}
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
            selectedApplicantId={selectedApplicantId || undefined}
            applicants={applicants}
            onNavigate={(view: string) => setCurrentView(view as any)}
          />
        );
      case 'endorsement':
        return (
          <EndorsementTracker
            applicants={applicants}
            currentUserName={currentUserName}
            addActivityLog={addActivityLog}
            updateApplicant={updateApplicant}
            globalJobOrders={globalJobOrders}
            globalEmployers={globalEmployers}
            onNavigate={(view: string) => setCurrentView(view as any)}
            showToast={showToastNotification}
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
            selectedApplicantId={selectedApplicantId || undefined}
            applicants={applicants}
            addExpense={addExpense}
          />
        );
      case 'ocr':
        return (
          <DocumentOCR
            workflow={workflow}
            currentUserName={currentUserName}
            addActivityLog={addActivityLog}
            showToast={showToastNotification}
            selectedApplicantId={selectedApplicantId || undefined}
            applicants={applicants}
            updateApplicant={updateApplicant}
            onNavigate={(view: string) => setCurrentView(view as any)}
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
            updateExpense={updateExpense}
            currentUserName={currentUserName}
            addActivityLog={addActivityLog}
            showToast={showToastNotification}
            selectedApplicantId={selectedApplicantId || undefined}
            applicants={applicants}
            onViewApplicant={handleViewApplicant}
            onSelectApplicant={setSelectedApplicantId}
          />
        );
      case 'accounting-settings':
        return (
          <AccountingSettings
            onBack={() => handleNavigate('accounting')}
            showToast={showToastNotification}
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
            selectedApplicantId={selectedApplicantId || undefined}
            onNavigate={(v) => setCurrentView(v as any)}
          />
        );
      case 'forecast':
        return (
          <PredictiveForecast
            applicants={applicants}
            applicantsLoaded={applicantsLoaded}
            selectedApplicantId={selectedApplicantId || undefined}
            globalPipelineForecast={globalPipelineForecast}
          />
        );
      case 'history':
        return <DeploymentHistory activityLogs={activityLogs} applicants={applicants} />;
      case 'reports':
        return <OperationalReports applicants={applicants} activityLogs={activityLogs} expenses={expenses} />;
      case 'users':
        return (
          <UserManagement
            currentUserName={currentUserName}
            addActivityLog={addActivityLog}
            globalStaff={globalStaff}
            globalRoles={globalRoles}
            applicants={applicants}
            updateApplicant={updateApplicant}
          />
        );
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
        return (
          <EvaluationSetup
            showToast={showToastNotification}
            currentUserName={currentUserName}
            onPermissionsUpdated={(newPerms) => setWorkflowPermissions(newPerms)}
            onTemplatesUpdated={(tpls) => setEvaluationTemplates(tpls)}
            globalJobOrders={globalJobOrders}
          />
        );
      case 'joborders':
        return (
          <JobOrders
            showToast={showToastNotification}
            currentUserName={currentUserName}
            globalJobOrders={globalJobOrders}
            globalEmployers={globalEmployers}
            onJobOrdersChange={onJobOrdersChange}
            onEmployersChange={onEmployersChange}
          />
        );
      case 'employers':
        return (
          <EmployerProfiles
            showToast={showToastNotification}
            currentUserName={currentUserName}
            globalEmployers={globalEmployers}
            onEmployersChange={onEmployersChange}
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
  };

  return (
    <div className="w-full h-full flex bg-[#F1F5F9] overflow-hidden">
      <Sidebar
        currentUserRole={currentUserRole}
        currentUserRoles={currentUserRoles}
        currentView={currentView}
        onViewChange={handleNavigate}
        isSuperAdmin={isSuperAdmin}
        onSuperAdminDashboard={onSuperAdminDashboard}
        workflowPermissions={workflowPermissions}
        collapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Main Content Area */}
      <div className="flex-1 h-full flex flex-col overflow-hidden relative">
        {/* Top Bar */}
        <header className="bg-white/85 backdrop-blur-md border-b border-slate-200 px-6 sm:px-8 py-3.5 flex items-center justify-between z-10 flex-shrink-0">
          <div className="flex items-center gap-3 flex-1" />
          <div className="flex items-center gap-6 ml-4">
            {isSuperAdmin && onSuperAdminDashboard && (
              <button
                onClick={onSuperAdminDashboard}
                className="flex text-xs font-extrabold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 hover:border-amber-400 px-3 py-1.5 rounded-full items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                title="Return to Superadmin Multi-Tenant Dashboard"
              >
                <Crown size={13} className="text-amber-600" />
                <span className="hidden sm:inline">Super Admin Console</span>
              </button>
            )}
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
          className={`absolute top-20 right-8 bg-[#0F172A] text-white px-5 py-4 rounded-lg shadow-2xl z-50 flex items-center gap-3 text-sm font-semibold border-l-4 border-[#0EA5E9] transition-transform duration-300 ${showToast ? 'translate-x-0' : 'translate-x-[150%]'
            }`}
        >
          <Info className="w-5 h-5 text-[#0EA5E9]" />
          <span>{toastMessage}</span>
        </div>

        {/* Views Container */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-8 pb-8 relative">
          <div className="pt-6">{renderView()}</div>
        </div>
      </div>
    </div>
  );
}
