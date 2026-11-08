import { useState, useMemo } from 'react';
import {
  Search,
  Activity,
  CheckCircle2,
  ShieldCheck,
  Settings,
  ArrowRight,
  CreditCard,
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
  hideHeader?: boolean;
}

const STAGE_NAMES: Record<number, string> = {
  1: 'Screening',
  2: 'Medical',
  3: 'CV & Vetting',
  4: 'Employer',
  5: 'Processing',
  6: 'Deployed',
};

const ZERO_FEE_COUNTRIES = [
  'saudi arabia', 'qatar', 'united arab emirates', 'uae', 'dubai', 'abu dhabi',
  'united kingdom', 'uk', 'great britain', 'canada', 'israel', 'netherlands', 'switzerland'
];

const EXEMPT_POSITIONS = [
  'domestic', 'household', 'hsw', 'maid', 'caregiver', 'care worker', 'seafarer', 'seaman', 'marine'
];

export default function AccountingDashboard({
  applicants = [],
  expenses = [],
  onNavigate,
  onViewApplicant,
  onSelectApplicant,
  isLoading,
  hideHeader = false,
}: AccountingDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('All');

  // Compute Global Financial Metrics (PHP-only & DMW Regulatory Breakdown)
  const metrics = useMemo(() => {
    let totalExpensesPHP = 0;
    let workerPaidDocsPHP = 0;
    let employerCoveredPHP = 0;
    let placementFeesPHP = 0;

    expenses.forEach(exp => {
      const amt = Number(exp.amount) || 0;
      totalExpensesPHP += amt;

      const purpose = (exp.purpose || '').toLowerCase();
      const type = exp.type || 'expense';

      if (type === 'placement_fee' || purpose.includes('placement')) {
        placementFeesPHP += amt;
      } else if (
        purpose.includes('visa') || purpose.includes('oec') ||
        purpose.includes('owwa') || purpose.includes('airfare') ||
        purpose.includes('ticket') || purpose.includes('insurance')
      ) {
        employerCoveredPHP += amt;
      } else {
        workerPaidDocsPHP += amt;
      }
    });

    // Count Zero-Fee Protected profiles
    const zeroFeeProtectedCount = applicants.filter(app => {
      const pos = (app.appliedPosition || app.appliedRole || app.role || '').toLowerCase();
      const country = (app.country || app.jobOrder || '').toLowerCase();
      return EXEMPT_POSITIONS.some(p => pos.includes(p)) || ZERO_FEE_COUNTRIES.some(c => country.includes(c));
    }).length;

    // Active candidate ledgers (Phase 1 to 5)
    const activeProfiles = applicants.filter(
      a => !a.isStopped && a.status !== 'Deployed' && a.phase >= 1 && a.phase < 6
    ).length;

    // Latest 8 financial transactions
    const recentActivity = [...expenses].sort(
      (a, b) => new Date(b.date || b.timestamp || 0).getTime() - new Date(a.date || a.timestamp || 0).getTime()
    ).slice(0, 8);

    return {
      totalExpensesPHP,
      workerPaidDocsPHP,
      employerCoveredPHP,
      placementFeesPHP,
      zeroFeeProtectedCount,
      activeProfiles,
      recentActivity,
    };
  }, [expenses, applicants]);

  // Compute each applicant's individual expense summary for the Ledger Table
  const applicantLedgers = useMemo(() => {
    return applicants
      .filter((app) => {
        if (app.isStopped) return false;
        const name = (app.name || `${app.firstName || ''} ${app.lastName || ''}`).toLowerCase();
        const code = (app.applicantCode || app.id || '').toLowerCase();
        const role = (app.appliedPosition || app.appliedRole || app.role || '').toLowerCase();
        const q = searchTerm.trim().toLowerCase();
        const matchSearch = !q || name.includes(q) || code.includes(q) || role.includes(q);

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
        const totalPeso = appExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
        const pos = (app.appliedPosition || app.appliedRole || app.role || '').toLowerCase();
        const country = (app.country || app.jobOrder || '').toLowerCase();
        const isZeroFeeExempt =
          EXEMPT_POSITIONS.some((p) => pos.includes(p)) ||
          ZERO_FEE_COUNTRIES.some((c) => country.includes(c));

        return {
          ...app,
          totalPeso,
          expenseCount: appExpenses.length,
          lastExpense: appExpenses[0]?.date || null,
          isZeroFeeExempt,
        };
      })
      .sort((a, b) => b.totalPeso - a.totalPeso);
  }, [applicants, expenses, searchTerm, phaseFilter]);

  const handleOpenLedger = (app: ApplicantRecord) => {
    if (onSelectApplicant) {
      onSelectApplicant(String(app.id));
    }
    if (onNavigate) {
      onNavigate('expense');
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Unified Flowsensus Dashboard Header */}
      {!hideHeader && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A] flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-lg">₱</span>
              Accounting & Finance Dashboard
            </h2>
            <p className="text-sm text-[#64748B] mt-1 font-medium">
              Philippine OFW recruitment deployment ledgers & DMW/POEA regulatory compliance
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('expense')}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-sm text-sm cursor-pointer"
            >
              Open Expense Ledger
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('accounting-settings')}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-3.5 py-2 rounded-lg font-bold hover:bg-slate-50 transition-colors shadow-sm text-sm cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>
        </div>
      )}

      {/* Embedded Action Toolbar when rendered in Multi-Role Dashboard */}
      {hideHeader && (
        <div className="flex items-center justify-end gap-2.5 pb-1">
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('expense')}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <span>Open Expense Ledger</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('accounting-settings')}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span>Fee Settings</span>
          </button>
        </div>
      )}

      {/* DMW Regulatory Compliance Banner */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-5 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-base">DMW / POEA Regulatory Standard Enforced</h3>
            <p className="text-xs text-emerald-100 mt-0.5 max-w-2xl">
              All financial transactions are denominated in <strong>Philippine Peso (PHP / ₱)</strong>. Placement fees are strictly capped at 1 month basic salary, and zero-fee policies are enforced for domestic workers, caregivers, and protected destination countries.
            </p>
          </div>
        </div>
        <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-center flex-shrink-0">
          <p className="text-[11px] uppercase tracking-wider text-emerald-100 font-bold">Zero-Fee Protected OFWs</p>
          <p className="text-2xl font-black">{metrics.zeroFeeProtectedCount} Candidates</p>
        </div>
      </div>

      {/* Global Metrics Cards in PHP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Active Candidate Ledgers</p>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <>
              <p className="text-2xl font-black text-slate-900">{metrics.activeProfiles}</p>
              <p className="text-[11px] text-slate-400 mt-1">Candidates in recruitment pipeline</p>
            </>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Personal Documentation</p>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <>
              <p className="text-2xl font-black text-slate-900">₱{metrics.workerPaidDocsPHP.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-[11px] text-slate-400 mt-1">Medical, Passport, NBI, PSA (OFW-borne)</p>
            </>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Employer-Covered Costs</p>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <>
              <p className="text-2xl font-black text-indigo-600">₱{metrics.employerCoveredPHP.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-[11px] text-indigo-400 mt-1">Visa, OEC, OWWA, Airfare (Zero to OFW)</p>
            </>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Placement Fees Collected</p>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <>
              <p className="text-2xl font-black text-amber-600">₱{metrics.placementFeesPHP.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className="text-[11px] text-amber-500 mt-1">Regulated agency service fees</p>
            </>
          )}
        </div>
      </div>

      {/* Candidate Expense Ledger Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Candidate Expense Ledgers</h3>
            <p className="text-xs text-slate-500">View individual candidate expense records and manage billing accounts in PHP (₱)</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search candidate name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 w-48 sm:w-60"
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
                <th className="py-3 px-4">DMW Fee Policy</th>
                <th className="py-3 px-4 text-right">Total Recorded (PHP)</th>
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
                applicantLedgers.slice(0, 10).map((app) => {
                  const displayName = app.name || `${app.firstName || ''} ${app.lastName || ''}`.trim() || 'Unnamed Candidate';
                  const displayRole = app.appliedPosition || app.appliedRole || app.role || 'Candidate';

                  return (
                    <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center font-bold text-xs cursor-pointer hover:bg-emerald-100 transition-colors"
                            onClick={() => onViewApplicant && onViewApplicant(String(app.id))}
                            title="Click to view candidate file"
                          >
                            {getInitials(displayName)}
                          </div>
                          <div>
                            <p
                              className="font-bold text-slate-800 hover:text-emerald-600 cursor-pointer transition-colors"
                              onClick={() => onViewApplicant && onViewApplicant(String(app.id))}
                            >
                              {displayName}
                            </p>
                            <p className="text-[11px] text-slate-400">{app.applicantCode || app.id} • {displayRole}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          Stage {app.phase}: {STAGE_NAMES[app.phase] || 'In Progress'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {app.isZeroFeeExempt ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2.5 py-0.5 rounded-full">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" /> Zero-Fee Protected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
                            Standard Cap (1 Mo.)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 font-mono">
                        ₱{app.totalPeso.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                          className="px-3 py-1.5 bg-white hover:bg-emerald-600 hover:text-white border border-slate-200 hover:border-emerald-600 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 group"
                        >
                          <span>Open Ledger</span>
                          <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-white" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Transactions & Milestone Fee Triggers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity Feed */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-[#0F172A] flex items-center gap-2 text-sm">
              <Activity className="w-4 h-4 text-emerald-600" /> Recent Financial Transactions
            </h3>
            <span className="text-xs font-semibold text-slate-500">
              {expenses.length} Total Recorded Entries
            </span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto flex-1">
            {metrics.recentActivity.map(exp => {
              const matchedApp = applicants.find(a => String(a.id) === String(exp.applicantId));
              const name = matchedApp ? (matchedApp.name || `${matchedApp.firstName || ''} ${matchedApp.lastName || ''}`.trim()) : `Candidate #${exp.applicantId}`;
              const purposeLower = (exp.purpose || '').toLowerCase();
              const isEmployer = purposeLower.includes('visa') || purposeLower.includes('oec') || purposeLower.includes('owwa') || purposeLower.includes('airfare');
              const isPlacement = exp.type === 'placement_fee' || purposeLower.includes('placement');

              return (
                <div
                  key={exp.id}
                  onClick={() => {
                    if (onSelectApplicant) onSelectApplicant(String(exp.applicantId));
                    if (onNavigate) onNavigate('expense');
                  }}
                  className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-start gap-3.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isEmployer ? 'bg-indigo-50 text-indigo-600' : isPlacement ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">{exp.purpose}</p>
                        {exp.referenceNo && (
                          <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            OR #{exp.referenceNo}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Candidate: <span className="font-semibold text-slate-700">{name}</span>
                        {matchedApp?.applicantCode && <span className="text-slate-400"> ({matchedApp.applicantCode})</span>}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {new Date(exp.date || exp.timestamp || Date.now()).toLocaleDateString()} • Recorded by {exp.recordedBy || 'Accounting Staff'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">
                      ₱{Number(exp.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${
                      isEmployer ? 'bg-indigo-50 text-indigo-700' : isPlacement ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {isEmployer ? 'Employer-Covered' : isPlacement ? 'Placement Fee' : 'Personal Document'}
                    </span>
                  </div>
                </div>
              );
            })}

            {metrics.recentActivity.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm">
                No recent financial activity recorded.
              </div>
            )}
          </div>
        </div>

        {/* Milestone Fee Triggers & DMW Fee Settings */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Smart Milestone Recommendations</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              The Expense Ledger recommends DMW-compliant fees when candidates reach key processing milestones:
            </p>
            <ul className="text-xs text-slate-600 space-y-2 mt-2">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 flex-shrink-0" />
                <span><strong>Phase 3:</strong> Medical Examination package is recommended upon Fit-to-Work clearance.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 flex-shrink-0" />
                <span><strong>Phase 4:</strong> Regulated placement fee is recommended after contract signing (unless zero-fee exempt).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 flex-shrink-0" />
                <span><strong>Phase 5:</strong> OEC & Passport processing fees are recommended during deployment processing.</span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => onNavigate && onNavigate('accounting-settings')}
            className="mt-6 w-full py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200 shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span>Customize DMW Fee Rates</span>
          </button>
        </div>
      </div>
    </div>
  );
}
