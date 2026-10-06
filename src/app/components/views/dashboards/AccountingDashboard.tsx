import { useState, useMemo } from 'react';
import {
  DollarSign, FileText, User, Search, Filter, Activity, CheckCircle2, TrendingUp, AlertCircle
} from 'lucide-react';
import { ApplicantRecord, ExpenseRecord } from '../../../types';

interface AccountingDashboardProps {
  applicants?: ApplicantRecord[];
  expenses?: ExpenseRecord[];
  onAddExpense?: (expense: Omit<ExpenseRecord, 'id'>) => void;
  onNavigate?: (view: string) => void;
  onViewApplicant?: (id: string) => void;
  isLoading?: boolean;
}

export default function AccountingDashboard({
  applicants = [],
  expenses = [],
  onNavigate,
  onViewApplicant,
  isLoading,
}: AccountingDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('All');

  // Compute Global Financial Metrics
  const globalMetrics = useMemo(() => {
    let totalExpensesPHP = 0;
    let activeFinancialProfiles = 0;
    const applicantExpenseCount: Record<string, number> = {};

    expenses.forEach(exp => {
      if (exp.currency === 'PESO') totalExpensesPHP += exp.amount;
      // In a real app, convert USD to PHP properly based on exchange rate.
      // For dashboard global metric, we'll rough estimate USD to PHP (e.g. * 56) just for a broad view, 
      // or we just separate them. Let's just track PHP for simplicity on the dashboard, 
      // or we can track both.
      
      if (!applicantExpenseCount[exp.applicantId]) {
        applicantExpenseCount[exp.applicantId] = 0;
      }
      applicantExpenseCount[exp.applicantId]++;
    });

    activeFinancialProfiles = Object.keys(applicantExpenseCount).length;

    // Latest 5 expenses
    const recentActivity = [...expenses].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()).slice(0, 5);

    return {
      totalExpensesPHP,
      activeFinancialProfiles,
      recentActivity,
      applicantExpenseCount,
    };
  }, [expenses]);

  const applicantLedgers = useMemo(() => {
    return applicants.filter(app => {
      const matchSearch = (app.name || `${app.firstName || ''} ${app.lastName || ''}`).toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (app.applicantCode || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchPhase = phaseFilter === 'All' 
        ? true 
        : phaseFilter === 'Medical' 
          ? app.phase === 2
          : phaseFilter === 'Profiling'
            ? app.phase === 3
            : phaseFilter === 'Endorsement'
              ? app.phase === 4
              : phaseFilter === 'Deployed'
                ? app.status === 'Deployed'
                : true;
      
      return matchSearch && matchPhase;
    }).map(app => {
      const appExpenses = expenses.filter(e => e.applicantId === String(app.id));
      const totalPeso = appExpenses.filter(e => e.currency === 'PESO').reduce((sum, e) => sum + e.amount, 0);
      const totalDollar = appExpenses.filter(e => e.currency === 'DOLLAR').reduce((sum, e) => sum + e.amount, 0);

      return {
        ...app,
        totalPeso,
        totalDollar,
        expenseCount: appExpenses.length,
      };
    }).sort((a, b) => b.totalPeso - a.totalPeso); // Sort by highest expenses
  }, [applicants, expenses, searchTerm, phaseFilter]);

  const handleSelectApplicant = (app: any) => {
    if (onViewApplicant) {
      onViewApplicant(String(app.id));
      // Transition to Expense Ledger inside Applicant Profile
      if (onNavigate) {
        // We'll tell AppShell to go to expense view directly
        onNavigate('expense');
      }
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div className="mb-6">
        <h2 className="text-3xl font-extrabold tracking-tight">
          <DollarSign className="w-8 h-8 inline-block mr-2 text-[#10B981]" />
          Accounting Dashboard
        </h2>
        <p className="text-sm text-[#64748B] mt-1 font-medium">Global overview of agency financial processing & deployment ledgers.</p>
      </div>

      {/* Global Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Global Expenses (PHP)</p>
            <p className="text-3xl font-black text-[#10B981]">₱{globalMetrics.totalExpensesPHP.toLocaleString()}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-[#10B981]" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Active Ledgers</p>
            <p className="text-3xl font-black text-indigo-600">{globalMetrics.activeFinancialProfiles}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center">
            <FileText className="w-6 h-6 text-indigo-600" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Transactions</p>
            <p className="text-3xl font-black text-amber-600">{expenses.length}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
            <Activity className="w-6 h-6 text-amber-600" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Recent Activity Feed */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-[#0F172A] flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-400" /> Recent Transactions
            </h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {globalMetrics.recentActivity.map(exp => {
              const matchedApp = applicants.find(a => String(a.id) === String(exp.applicantId));
              const name = matchedApp ? (matchedApp.name || matchedApp.firstName) : `Applicant #${exp.applicantId}`;
              
              return (
                <div key={exp.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{exp.purpose}</p>
                      <p className="text-xs font-semibold text-emerald-600 mt-0.5">
                        {exp.currency === 'DOLLAR' ? '$' : '₱'}{exp.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        For <span className="font-semibold text-slate-700">{name}</span>
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">{new Date(exp.date || Date.now()).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {globalMetrics.recentActivity.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-sm">
                No recent financial activity recorded.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
