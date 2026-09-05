import { useState } from 'react';
import {
  DollarSign,
  AlertCircle,
  CreditCard,
  TrendingUp,
  PieChart,
  Download,
  Filter,
  Calendar,
  Building2,
  User,
  Briefcase,
} from 'lucide-react';

export default function AccountingDashboard({applicants = [], expenses = [], onNavigate = () => {},onAddExpense = () => {},}) {
  const [selected_period, setSelectedPeriod] = useState('month');
  const [quick_expense, setQuickExpense] = useState({
    applicant_id: '',
    category: 'Medical Fees',
    amount: '',
  });

  // Calculate metrics
  const monthly_total = expenses?.reduce((sum, exp) => sum + exp.amount, 0);
  const active_deployments = applicants?.filter((a) => a.phase >= 4)?.length;
  const pending_cash_advances = applicants?.filter((a) => a.phase === 5 && a.status.includes('Final')).slice(0, 4);
  const recent_transactions = expenses.slice(0, 8);

  // Expense breakdown by category
  const expense_by_category = expenses?.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
    return acc;
  }, {} );

  const category_breakdown = Object.entries(expense_by_category)
    ?.map(([category, amount]) => ({
      category,
      amount,
      percentage: monthly_total > 0 ? (amount / monthly_total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Payment method breakdown
  const payment_breakdown = expenses?.reduce((acc, exp) => {
    const method = exp.payment_method || 'Unknown';
    acc[method] = (acc[method] || 0) + exp.amount;
    return acc;
  }, {} );

  // Who paid breakdown (Agency, Applicant, Employer)
  const paid_by_breakdown = expenses?.reduce((acc, exp) => {
    const paid_by = exp.paid_by || 'Unknown';
    acc[paid_by] = (acc[paid_by] || 0) + exp.amount;
    return acc;
  }, {} );

  // Per applicant expense totals
  const expense_per_applicant = expenses?.reduce((acc, exp) => {
    acc[exp.applicant_id] = (acc[exp.applicant_id] || 0) + exp.amount;
    return acc;
  }, {} );

  const top_spenders = Object.entries(expense_per_applicant)
    ?.map(([id, amount]) => ({
      applicant_id: id,
      applicant_name: applicants.find((a) => a.id === id)?.name || 'Unknown',
      amount,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Average expense per applicant
  const avg_expense_per_applicant =
    Object.keys(expense_per_applicant)?.length > 0
      ? monthly_total / Object.keys(expense_per_applicant)?.length
      : 0;

  const handle_quick_expense_submit = () => {
    if (!quick_expense.applicant_id || !quick_expense.amount || !onAddExpense) return;

    const expenseRecord = {
      applicant_id: quick_expense.applicant_id,
      category: quick_expense.category,
      amount: parseFloat(quick_expense.amount),
      payment_method: 'Bank Transfer',
      paid_by: 'Agency' ,
      notes: 'Quick entry from dashboard',
      timestamp: new Date().toISOString(),
    };

    onAddExpense(expenseRecord);
    setQuickExpense({ applicant_id: '', category: 'Medical Fees', amount: '' });
  };

  const get_category_color = (index) => {
    const colors = [
      'bg-[#0EA5E9]',
      'bg-[#10B981]',
      'bg-[#F59E0B]',
      'bg-[#8B5CF6]',
      'bg-[#EC4899]',
      'bg-[#14B8A6]',
      'bg-[#F97316]',
    ];
    return colors[index % colors?.length];
  };

  const export_to_csv = () => {
    const headers = ['Date', 'Applicant ID', 'Category', 'Amount', 'Payment Method', 'Paid By', 'Notes'];
    const rows = expenses?.map((exp) => [
      new Date(exp.timestamp).toLocaleDateString(),
      exp.applicant_id,
      exp.category,
      exp.amount,
      exp.payment_method || 'N/A',
      exp.paid_by || 'N/A',
      exp.notes || 'N/A',
    ]);

    const csvContent =
      [headers.join(','), ...rows?.map((row) => row?.map((cell) => `"${cell}"`).join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#0F172A]">Financial Operations Center</h2>
          <p className="text-sm text-[#64748B] mt-1 font-medium">
            Track deployment expenses, cash advances, and financial analytics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={export_to_csv}
            className="px-4 py-2 bg-white border-2 border-slate-200 text-[#0F172A] text-sm font-bold rounded-lg hover:bg-slate-50 flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={() => onNavigate('expense')}
            className="px-4 py-2 bg-[#10B981] text-white text-sm font-bold rounded-lg hover:bg-[#059669] shadow-lg shadow-[#10B981]/20"
          >
            View Full Ledger
          </button>
        </div>
      </div>

      {/* Financial Quick-Entry Widget */}
      <div className="bg-gradient-to-br from-[#10B981]/10 to-[#059669]/5 rounded-lg shadow-sm border-2 border-[#10B981]/30">
        <div className="px-6 py-4 border-b border-[#10B981]/20 bg-[#10B981]/5 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-[#10B981]" />
          <h3 className="font-black text-[#0F172A] text-sm uppercase tracking-wider">Quick Expense Entry</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-2">
                Applicant ID
              </label>
              <input
                type="text"
                placeholder="APP-2026-XXX"
                value={quick_expense.applicant_id}
                onChange={(e) => setQuickExpense({ ...quick_expense, applicant_id: e.target.value })}
                className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:border-[#10B981] outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-2">Category</label>
              <select
                value={quick_expense.category}
                onChange={(e) => setQuickExpense({ ...quick_expense, category: e.target.value })}
                className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:border-[#10B981] outline-none bg-white"
              >
                <option>Medical Fees</option>
                <option>Visa Processing</option>
                <option>POEA Fees</option>
                <option>OWWA Contribution</option>
                <option>Cash Advance</option>
                <option>Air Ticket</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-2">Amount (Ã¢â€šÂ±)</label>
              <input
                type="number"
                placeholder="0.00"
                value={quick_expense.amount}
                onChange={(e) => setQuickExpense({ ...quick_expense, amount: e.target.value })}
                className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:border-[#10B981] outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handle_quick_expense_submit}
                disabled={!quick_expense.applicant_id || !quick_expense.amount}
                className="w-full px-4 py-2 bg-[#10B981] text-white text-xs font-bold rounded-lg hover:bg-[#059669] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Log Expense
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-[#64748B]" />
        <span className="text-sm font-bold text-[#64748B]">Period:</span>
        <div className="flex gap-2">
          {(['week', 'month', 'quarter'])?.map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                selected_period === period
                  ? 'bg-[#0EA5E9] text-white'
                  : 'bg-slate-100 text-[#64748B] hover:bg-slate-200'
              }`}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Enhanced Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border-l-4 border-l-[#10B981] shadow-sm">
          <p className="text-sm font-bold text-[#64748B] uppercase tracking-wider">Total Expenses</p>
          <p className="text-4xl font-black text-[#0F172A] mt-2">Ã¢â€šÂ±{monthly_total.toLocaleString()}</p>
          <p className="text-xs text-[#64748B] mt-1">{expenses?.length} transactions logged</p>
        </div>
        <div className="bg-white p-6 rounded-lg border-l-4 border-l-[#0EA5E9] shadow-sm">
          <p className="text-sm font-bold text-[#64748B] uppercase tracking-wider">Active Deployments</p>
          <p className="text-4xl font-black text-[#0F172A] mt-2">{active_deployments}</p>
          <p className="text-xs text-[#64748B] mt-1">Phase 4+ applicants</p>
        </div>
        <div className="bg-white p-6 rounded-lg border-l-4 border-l-[#F59E0B] shadow-sm">
          <p className="text-sm font-bold text-[#64748B] uppercase tracking-wider">Avg per Applicant</p>
          <p className="text-4xl font-black text-[#0F172A] mt-2">Ã¢â€šÂ±{Math.round(avg_expense_per_applicant).toLocaleString()}</p>
          <p className="text-xs text-[#64748B] mt-1">Average deployment cost</p>
        </div>
        <div className="bg-white p-6 rounded-lg border-l-4 border-l-[#8B5CF6] shadow-sm">
          <p className="text-sm font-bold text-[#64748B] uppercase tracking-wider">Pending Advances</p>
          <p className="text-4xl font-black text-[#0F172A] mt-2">{pending_cash_advances?.length}</p>
          <p className="text-xs text-[#64748B] mt-1">Awaiting disbursement</p>
        </div>
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Expense Breakdown by Category */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-[#0EA5E9]" />
            <h3 className="font-black text-[#0F172A] text-sm uppercase tracking-wider">
              Expense Breakdown by Category
            </h3>
          </div>
          <div className="p-6">
            {category_breakdown?.length === 0 ? (
              <p className="text-center text-[#64748B] text-sm">No expense data yet</p>
            ) : (
              <div className="space-y-4">
                {category_breakdown?.map((item, index) => (
                  <div key={item.category}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-[#0F172A]">{item.category}</span>
                      <span className="text-sm font-black text-[#0F172A]">Ã¢â€šÂ±{item.amount.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full ${get_category_color(index)}`}
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-[#64748B] mt-1">{item.percentage.toFixed(1)}% of total</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Payment Source Breakdown */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#10B981]" />
            <h3 className="font-black text-[#0F172A] text-sm uppercase tracking-wider">Payment Source Breakdown</h3>
          </div>
          <div className="p-6">
            {Object.keys(paid_by_breakdown)?.length === 0 ? (
              <p className="text-center text-[#64748B] text-sm">No payment data yet</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(paid_by_breakdown)?.map(([paid_by, amount], index) => {
                  const percentage = monthly_total > 0 ? (amount / monthly_total) * 100 : 0;
                  const icon =
                    paid_by === 'Agency' ? (
                      <Building2 className="w-5 h-5" />
                    ) : paid_by === 'Applicant' ? (
                      <User className="w-5 h-5" />
                    ) : (
                      <Briefcase className="w-5 h-5" />
                    );
                  const color =
                    paid_by === 'Agency'
                      ? 'text-[#0EA5E9] bg-[#0EA5E9]/10'
                      : paid_by === 'Applicant'
                      ? 'text-[#10B981] bg-[#10B981]/10'
                      : 'text-[#F59E0B] bg-[#F59E0B]/10';

                  return (
                    <div
                      key={paid_by}
                      className={`p-4 rounded-lg border-2 ${color.replace('text-', 'border-').replace('/10', '/20')}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center`}>
                            {icon}
                          </div>
                          <div>
                            <p className="font-bold text-[#0F172A] text-sm">{paid_by}</p>
                            <p className="text-xs text-[#64748B]">{percentage.toFixed(1)}% of total</p>
                          </div>
                        </div>
                        <p className="text-2xl font-black text-[#0F172A]">Ã¢â€šÂ±{amount.toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Spending Applicants */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#8B5CF6]" />
          <h3 className="font-black text-[#0F172A] text-sm uppercase tracking-wider">Top 5 Expense by Applicant</h3>
        </div>
        <div className="p-6">
          {top_spenders?.length === 0 ? (
            <p className="text-center text-[#64748B] text-sm">No expense data yet</p>
          ) : (
            <div className="space-y-3">
              {top_spenders?.map((spender, index) => (
                <div
                  key={spender.applicant_id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-[#8B5CF6] text-white flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-bold text-[#0F172A] text-sm">{spender.applicant_name}</p>
                      <p className="text-xs text-[#64748B]">{spender.applicant_id}</p>
                    </div>
                  </div>
                  <p className="text-xl font-black text-[#0F172A]">Ã¢â€šÂ±{spender.amount.toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions Ledger */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#0EA5E9]" />
            <h3 className="font-black text-[#0F172A] text-sm uppercase tracking-wider">Recent Transactions</h3>
          </div>
          <button
            onClick={() => onNavigate('expense')}
            className="text-xs font-bold text-[#0EA5E9] hover:underline"
          >
            View All Ledgers Ã¢â€ â€™
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {recent_transactions?.length === 0 ? (
            <div className="p-6 text-center text-[#64748B]">
              <p className="text-sm font-medium">No transactions recorded yet.</p>
            </div>
          ) : (
            recent_transactions?.map((expense) => (
              <div
                key={expense.id}
                className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#10B981]/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <div>
                    <p className="font-bold text-[#0F172A] text-sm">{expense.category}</p>
                    <p className="text-xs text-[#64748B]">
                      {expense.applicant_id} Ã¢â‚¬Â¢ {new Date(expense.timestamp).toLocaleDateString()} Ã¢â‚¬Â¢{' '}
                      <span className="font-medium">{expense.paid_by || 'N/A'}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-[#0F172A] text-lg">Ã¢â€šÂ±{expense.amount.toLocaleString()}</p>
                  <p className="text-xs text-[#64748B]">{expense.payment_method}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pending Cash Advances Queue */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 bg-[#F59E0B]/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#F59E0B]" />
            <h3 className="font-black text-[#0F172A] text-sm uppercase tracking-wider">Pending Cash Advances</h3>
          </div>
          <span className="px-3 py-1 bg-[#F59E0B] text-white text-xs font-bold rounded-full">
            {pending_cash_advances?.length} Waiting
          </span>
        </div>
        <div className="divide-y divide-slate-100">
          {pending_cash_advances?.length === 0 ? (
            <div className="p-6 text-center text-[#64748B]">
              <p className="text-sm font-medium">No pending cash advances.</p>
            </div>
          ) : (
            pending_cash_advances?.map((applicant) => (
              <div
                key={applicant.id}
                className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#F59E0B]/10 flex items-center justify-center font-bold text-[#F59E0B] text-sm">
                    {applicant.name
                      .split(' ')
                      ?.map((n) => n[0])
                      .join('')
                      .substring(0, 2)}
                  </div>
                  <div>
                    <p className="font-bold text-[#0F172A]">{applicant.name}</p>
                    <p className="text-xs text-[#64748B]">{applicant.id} Ã¢â‚¬Â¢ Ready for pre-departure cash advance</p>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate('expense')}
                  className="px-4 py-2 bg-[#F59E0B] text-white text-xs font-bold rounded-lg hover:bg-[#D97706] shadow-sm"
                >
                  Process Advance
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RBAC Note */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#64748B] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-[#0F172A]">RBAC Isolation Notice</p>
            <p className="text-sm text-[#64748B] mt-1">
              Accounting only sees financial data. All transactions write to the applicant's centralized master file,
              but compliance and document data remain isolated to Admin role.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

