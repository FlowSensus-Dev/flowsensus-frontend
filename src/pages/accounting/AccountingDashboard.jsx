import { useState } from "react";
import {
  DollarSign,
  AlertCircle,
  TrendingUp,
  Download,
  Calendar,
} from "lucide-react";

export default function AccountingDashboard({
  applicants = [],
  financialRecords = [],
  cashAdvances = [],
  onNavigate = () => {},
  onAddExpense = () => {},
}) {
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [quickExpense, setQuickExpense] = useState({
    applicant_id: "",
    payment_type: "Medical Fee",
    amount: "",
  });

  const toNumber = (val) => Number(val) || 0;

  const totalExpenses = financialRecords.reduce(
    (sum, record) => sum + toNumber(record.amount),
    0
  );

  const pendingPayables = financialRecords
    .filter((record) => record.payment_status === "Pending")
    .reduce((sum, record) => sum + toNumber(record.amount), 0);

  const totalAdvances = cashAdvances.reduce(
    (sum, advance) => sum + toNumber(advance.amount),
    0
  );

  const pendingAdvanceCount = cashAdvances.filter(
    (advance) => advance.repayment_status === "Unpaid"
  ).length;

  const formatCurrency = (val) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(toNumber(val));

  const expenseByCategory = financialRecords.reduce((acc, record) => {
    const cat = record.payment_type || "Other";
    acc[cat] = (acc[cat] || 0) + toNumber(record.amount);
    return acc;
  }, {});

  const categoryBreakdown = Object.entries(expenseByCategory).map(
    ([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
    })
  );

  const handleQuickExpenseSubmit = (e) => {
    e.preventDefault();
    if (!quickExpense.applicant_id || !quickExpense.amount) return;

    const payload = {
      applicant_id: parseInt(quickExpense.applicant_id, 10),
      payment_type: quickExpense.payment_type,
      amount: parseFloat(quickExpense.amount),
      payment_status: "Pending",
      recorded_at: new Date().toISOString(),
      is_deleted: false,
    };

    onAddExpense(payload);
    setQuickExpense({
      applicant_id: "",
      payment_type: "Medical Fee",
      amount: "",
    });
  };

  const exportToCsv = () => {
    const headers = [
      "Record ID",
      "Applicant ID",
      "Payment Type",
      "Amount",
      "Status",
      "Date",
    ];
    const rows = financialRecords.map((r) => [
      r.financial_record_id,
      r.applicant_id,
      r.payment_type,
      r.amount,
      r.payment_status,
      new Date(r.recorded_at).toLocaleDateString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `financial-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Financial Operations Center
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Monitor deployment fee allocations, cash assistance, and pending ledgers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={exportToCsv}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 flex items-center gap-2 transition"
          >
            <Download className="w-4 h-4 text-slate-500" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => onNavigate("expense-ledger")}
            className="px-4 py-2 bg-blue-900 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition shadow-sm"
          >
            View Full Ledger
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 border-l-4 border-l-blue-900 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total Logged Expenses
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {formatCurrency(totalExpenses)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {financialRecords.length} transactions recorded
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 border-l-4 border-l-amber-600 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Pending Payables
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {formatCurrency(pendingPayables)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Awaiting disbursement</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 border-l-4 border-l-slate-700 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total Cash Advances
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {formatCurrency(totalAdvances)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Released loan assistance</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 border-l-4 border-l-sky-600 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Unpaid Cash Advances
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {pendingAdvanceCount}
          </p>
          <p className="text-xs text-slate-400 mt-1">Awaiting salary deduction</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-blue-900" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Log Deployment Expense
          </h2>
        </div>
        <form onSubmit={handleQuickExpenseSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1">
                Applicant ID (Integer)
              </label>
              <input
                type="number"
                placeholder="e.g., 101"
                required
                value={quickExpense.applicant_id}
                onChange={(e) =>
                  setQuickExpense({
                    ...quickExpense,
                    applicant_id: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-900"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1">
                Payment Type
              </label>
              <select
                value={quickExpense.payment_type}
                onChange={(e) =>
                  setQuickExpense({
                    ...quickExpense,
                    payment_type: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-900"
              >
                <option value="Medical Fee">Medical Fee</option>
                <option value="Visa Processing">Visa Processing</option>
                <option value="POEA Fee">POEA Fee</option>
                <option value="OWWA Contribution">OWWA Contribution</option>
                <option value="Air Ticket">Air Ticket</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1">
                Amount (PHP)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                required
                value={quickExpense.amount}
                onChange={(e) =>
                  setQuickExpense({ ...quickExpense, amount: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-900"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2 px-4 bg-blue-900 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition"
              >
                Save Record
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Expenses by Payment Type
            </h2>
            <div className="flex items-center gap-1 text-slate-400 text-xs">
              <Calendar className="w-3.5 h-3.5" />
              <span>{selectedPeriod}</span>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            {categoryBreakdown.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No expense categories recorded.
              </p>
            ) : (
              categoryBreakdown.map((item) => (
                <div key={item.category}>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>{item.category}</span>
                    <span>{formatCurrency(item.amount)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-900 h-full rounded-full"
                      style={{ width: `${Math.min(item.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Active Cash Advances
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
              {pendingAdvanceCount} Unpaid
            </span>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {cashAdvances.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No cash advance records logged.
              </p>
            ) : (
              cashAdvances.slice(0, 4).map((advance) => (
                <div
                  key={advance.cash_advance_id}
                  className="py-3 flex items-center justify-between text-sm"
                >
                  <div>
                    <p className="font-semibold text-slate-800">
                      Applicant #{advance.applicant_id}
                    </p>
                    <p className="text-xs text-slate-400">{advance.remarks}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">
                      {formatCurrency(advance.amount)}
                    </p>
                    <span className="text-[11px] font-semibold text-amber-700">
                      {advance.repayment_status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">
            RBAC Accounting Isolation Active
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Module access is restricted to financial entries. Permanent deletion of ledger rows is strictly delegated to Agency Management via backend policies[cite: 2, 3].
          </p>
        </div>
      </div>
    </div>
  );
}