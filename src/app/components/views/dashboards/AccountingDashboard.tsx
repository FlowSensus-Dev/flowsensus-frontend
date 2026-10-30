import { useState, useMemo } from 'react';
import {
  Search,
  Activity,
  CheckCircle2,
  Settings,
  Plus,
  Receipt,
  Wallet,
  ArrowRight,
  CreditCard
} from 'lucide-react';
import { ApplicantRecord, ExpenseRecord, ViewType } from '../../../types';
import { Skeleton } from '../../ui/skeleton';

function getInitials(name?: string, fallback = 'AP'): string {
  if (!name || typeof name !== 'string') return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  return parts.map((n) => n[0]).join('').substring(0, 2).toUpperCase();
}

interface AccountingDashboardProps {
  applicants?: ApplicantRecord[];
  expenses?: ExpenseRecord[];
  onAddExpense?: (expense: Omit<ExpenseRecord, 'id'>) => void;
  onNavigate?: (view: ViewType) => void;
  onViewApplicant?: (id: string) => void;
  onSelectApplicant?: (id: string) => void;
  isLoading?: boolean;
}

const STAGE_NAMES: Record<number, string> = {
  1: 'Screening',
  2: 'Medical',
  3: 'CV & Vetting',
  4: 'Employer',
  5: 'Processing',
  6: 'Deployed',
};

export default function AccountingDashboard({
  applicants = [],
  expenses = [],
  onNavigate,
  onViewApplicant,
  onSelectApplicant,
  isLoading,
}: AccountingDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('All');

  // Compute Global Financial Metrics
  const globalMetrics = useMemo(() => {
    let totalExpensesPHP = 0;
    let totalExpensesUSD = 0;
    let medicalFeeTotal = 0;
    const applicantExpenseCount: Record<string, number> = {};

    expenses.forEach((exp) => {
      if (exp.currency === 'PESO') {
        totalExpensesPHP += Number(exp.amount || 0);
      } else if (exp.currency === 'DOLLAR') {
        totalExpensesUSD += Number(exp.amount || 0);
      }

      if (exp.purpose?.toLowerCase().includes('medical')) {
        medicalFeeTotal += Number(exp.amount || 0);
      }

      if (exp.applicantId) {
        if (!applicantExpenseCount[exp.applicantId]) {
          applicantExpenseCount[exp.applicantId] = 0;
        }
        applicantExpenseCount[exp.applicantId]++;
      }
    });

    const activeLedgersCount = Object.keys(applicantExpenseCount).length;

    // Latest 8 expenses
    const recentActivity = [...expenses]
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, 8);

    return {
      totalExpensesPHP,
      totalExpensesUSD,
      medicalFeeTotal,
      activeLedgersCount,
      recentActivity,
    };
  }, [expenses]);

  // Compute each applicant's individual expense summary for the Ledger Table
  const applicantLedgers = useMemo(() => {
    return applicants
      .filter((app) => {
        if (app.isStopped) return false;
        const name = (app.name || `${app.firstName || ''} ${app.lastName || ''}`).toLowerCase();
        const code = (app.applicantCode || app.id || '').toLowerCase();
        const q = searchTerm.trim().toLowerCase();
        const matchSearch = !q || name.includes(q) || code.includes(q);

        const matchPhase =
          phaseFilter === 'All'
            ? true
            : phaseFilter === 'Medical'
            ? app.phase === 2
            : phaseFilter === 'Profiling'
            ? app.phase === 3
            : phaseFilter === 'Endorsement'
            ? app.phase === 4
            : phaseFilter === 'Processing'
            ? app.phase === 5
            : phaseFilter === 'Deployed'
            ? app.status === 'Deployed'
            : true;

        return matchSearch && matchPhase;
      })
      .map((app) => {
        const appExpenses = expenses.filter((e) => String(e.applicantId) === String(app.id));
        const totalPeso = appExpenses
          .filter((e) => e.currency === 'PESO')
          .reduce((sum, e) => sum + Number(e.amount || 0), 0);
        const totalDollar = appExpenses
          .filter((e) => e.currency === 'DOLLAR')
          .reduce((sum, e) => sum + Number(e.amount || 0), 0);

        return {
          ...app,
          totalPeso,
          totalDollar,
          expenseCount: appExpenses.length,
          lastExpense: appExpenses[0]?.date || null,
        };
      })
      .sort((a, b) => b.totalPeso - a.totalPeso);
  }, [applicants, expenses, searchTerm, phaseFilter]);

  const handleOpenLedger = (app: any) => {
    if (onSelectApplicant) {
      onSelectApplicant(String(app.id));
    }
    if (onNavigate) {
      onNavigate('expense');
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Clean Flowsensus-Aligned Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Finance & Candidate Ledgers</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Track candidate processing costs, clinic medical fees, passport clearances, and fee disbursements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('expense')}
            className="px-3.5 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('accounting-settings')}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            <span>Fee Settings</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Recorded (PHP)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-[#0F172A]">₱{globalMetrics.totalExpensesPHP.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-0.5">Logged candidate fees</p>
            </div>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Active Ledgers</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-emerald-600">{globalMetrics.activeLedgersCount}</p>
              <p className="text-xs text-slate-500 mt-0.5">Candidates with logged expenses</p>
            </div>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ledger Entries</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-[#0F172A]">{expenses.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Total fee records & items</p>
            </div>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Medical Package Fees</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-[#0EA5E9] flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-[#0EA5E9]">₱{globalMetrics.medicalFeeTotal.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-0.5">Fit-to-Work clinic disbursements</p>
            </div>
          )}
        </div>
      </div>

      {/* Candidate Expense Ledger Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Candidate Expense Ledgers</h3>
            <p className="text-xs text-slate-500">View individual candidate expense records and manage billing accounts</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search candidate name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] focus:border-[#0EA5E9] w-48 sm:w-60"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'All', label: 'All' },
                { key: 'Medical', label: 'Medical' },
                { key: 'Profiling', label: 'Vetting' },
                { key: 'Processing', label: 'Processing' },
              ].map((item) => {
                const isActive = phaseFilter === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setPhaseFilter(item.key)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                      isActive
                        ? 'bg-[#0F172A] text-white border-[#0F172A]'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-5">Candidate</th>
                <th className="py-3 px-4">Processing Stage</th>
                <th className="py-3 px-4 text-right">Total Expenses (PHP)</th>
                <th className="py-3 px-4 text-right">Total Expenses (USD)</th>
                <th className="py-3 px-4 text-center">Entries</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {applicantLedgers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No candidate ledgers found matching your search.
                  </td>
                </tr>
              ) : (
                applicantLedgers.slice(0, 10).map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs cursor-pointer hover:bg-slate-200 transition-colors"
                          onClick={() => onViewApplicant && onViewApplicant(String(app.id))}
                          title="Click to view candidate file"
                        >
                          {getInitials(app.name)}
                        </div>
                        <div>
                          <p
                            className="font-bold text-slate-800 hover:text-[#0EA5E9] cursor-pointer transition-colors"
                            onClick={() => onViewApplicant && onViewApplicant(String(app.id))}
                          >
                            {app.name || 'Unnamed Candidate'}
                          </p>
                          <p className="text-[11px] text-slate-400">{app.applicantCode || app.id} • {app.role || 'Candidate'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        Stage {app.phase}: {STAGE_NAMES[app.phase] || 'In Progress'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      ₱{app.totalPeso.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                      {app.totalDollar > 0 ? `$${app.totalDollar.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600">
                        {app.expenseCount} {app.expenseCount === 1 ? 'entry' : 'entries'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenLedger(app)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <span>Open Ledger</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Transactions & Billing Triggers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-600" />
              <h3 className="font-bold text-slate-800 text-sm">Recent Financial Transactions</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('expense')}
              className="text-xs font-bold text-[#0EA5E9] hover:text-[#0284C7] flex items-center gap-1 cursor-pointer"
            >
              <span>View Full Ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {globalMetrics.recentActivity.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No expense transactions recorded yet. Click &quot;Record Expense&quot; above to log your first entry.
              </div>
            ) : (
              globalMetrics.recentActivity.map((exp) => {
                const matchedApp = applicants.find((a) => String(a.id) === String(exp.applicantId));
                const candidateName = matchedApp?.name || `${matchedApp?.firstName || ''} ${matchedApp?.lastName || ''}`.trim() || `Candidate #${exp.applicantId}`;

                return (
                  <div key={exp.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{exp.purpose}</p>
                        <p className="text-xs text-slate-500">
                          Candidate: <strong>{candidateName}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-600">
                        {exp.currency === 'DOLLAR' ? '$' : '₱'}{Number(exp.amount || 0).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {exp.date ? new Date(exp.date).toLocaleDateString() : 'Recorded'}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Milestone Fee Triggers (Clean, No Robot AI Style) */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-9 h-9 rounded-lg bg-sky-50 text-[#0EA5E9] flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Automatic Milestone Billing</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Flowsensus automatically records draft ledger fees when candidates reach key processing milestones:
            </p>
            <ul className="text-xs text-slate-600 space-y-2 mt-2">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9] mt-1.5 flex-shrink-0" />
                <span><strong>Stage 3:</strong> Medical Package fee is logged upon clinic Fit-to-Work clearance.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9] mt-1.5 flex-shrink-0" />
                <span><strong>Stage 5:</strong> OEC & Passport processing fees are generated when visa clearance begins.</span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => onNavigate && onNavigate('accounting-settings')}
            className="mt-6 w-full py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200 shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span>Customize Fee Rates</span>
          </button>
        </div>
      </div>
    </div>
  );
}
