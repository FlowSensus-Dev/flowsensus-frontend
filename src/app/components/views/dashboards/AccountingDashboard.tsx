import { useState, useMemo } from 'react';
import {
  FileText, Activity, CheckCircle2, ShieldCheck, 
  Settings, ArrowRight, Shield, AlertCircle
} from 'lucide-react';
import { ApplicantRecord, ExpenseRecord, ViewType } from '../../../types';

interface AccountingDashboardProps {
  applicants?: ApplicantRecord[];
  expenses?: ExpenseRecord[];
  onAddExpense?: (expense: Omit<ExpenseRecord, 'id'>) => void;
  onNavigate?: (view: ViewType) => void;
  onViewApplicant?: (id: string) => void;
  onSelectApplicant?: (id: string) => void;
  isLoading?: boolean;
}

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
  onSelectApplicant,
  isLoading,
}: AccountingDashboardProps) {
  // Compute Global Financial Metrics
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
      const pos = (app.appliedPosition || app.appliedRole || '').toLowerCase();
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

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#0F172A] flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-lg">₱</span>
            Accounting & Finance Dashboard
          </h2>
          <p className="text-sm text-[#64748B] mt-1 font-medium">
            Philippine OFW recruitment deployment ledgers & DMW/POEA regulatory compliance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate && onNavigate('expense')}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-sm text-sm"
          >
            Open Expense Ledger
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate && onNavigate('accounting-settings')}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-3.5 py-2 rounded-lg font-bold hover:bg-slate-50 transition-colors shadow-sm text-sm"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>
      </div>

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
          <p className="text-2xl font-black text-slate-900">{metrics.activeProfiles}</p>
          <p className="text-[11px] text-slate-400 mt-1">Candidates in recruitment pipeline</p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Personal Documentation</p>
          <p className="text-2xl font-black text-slate-900">₱{metrics.workerPaidDocsPHP.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <p className="text-[11px] text-slate-400 mt-1">Medical, Passport, NBI, PSA (OFW-borne)</p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Employer-Covered Costs</p>
          <p className="text-2xl font-black text-indigo-600">₱{metrics.employerCoveredPHP.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <p className="text-[11px] text-indigo-400 mt-1">Visa, OEC, OWWA, Airfare (Zero to OFW)</p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Placement Fees Collected</p>
          <p className="text-2xl font-black text-amber-600">₱{metrics.placementFeesPHP.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <p className="text-[11px] text-amber-500 mt-1">Regulated agency service fees</p>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-[#0F172A] flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" /> Recent Financial Transactions
          </h3>
          <span className="text-xs font-semibold text-slate-500">
            {expenses.length} Total Recorded Entries
          </span>
        </div>
        <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
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
    </div>
  );
}
