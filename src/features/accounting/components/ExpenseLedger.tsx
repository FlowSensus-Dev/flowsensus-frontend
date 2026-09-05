import { useState } from 'react';
import { Lock, DollarSign, Plus, Receipt } from 'lucide-react';
import { WorkflowState, ExpenseRecord, ActivityLog } from '../../../app/types';

interface ExpenseLedgerProps {
  workflow: WorkflowState;
  expenses?: ExpenseRecord[];
  addExpense: (expense: Omit<ExpenseRecord, 'id'>) => void;
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  showToast: (message: string) => void;
  selectedApplicantId?: string;
}

export default function ExpenseLedger({
  workflow,
  expenses = [],
  addExpense,
  currentUserName,
  addActivityLog,
  showToast,
  selectedApplicantId = 'APP-2026-089',
}: ExpenseLedgerProps) {
  const isLocked = !workflow.employerAccepted;
  const [showForm, setShowForm] = useState(false);
  const [newExpense, setNewExpense] = useState({
    type: 'Visa Processing Fee',
    amount: 15000,
    description: 'Saudi Arabia work visa application and processing',
    category: 'visa' as const,
  });

  // Add mock expense for demo
  const mockExpenses: ExpenseRecord[] = [
    {
      id: 'EXP-001',
      applicantId: selectedApplicantId,
      type: 'Visa Processing Fee',
      amount: 15000,
      description: 'Saudi Arabia work visa application and processing',
      date: '2026-05-24',
      recordedBy: currentUserName,
      category: 'visa',
    },
    {
      id: 'EXP-002',
      applicantId: selectedApplicantId,
      type: 'Medical Examination',
      amount: 3500,
      description: 'Pre-deployment medical checkup at Makati Medical Center',
      date: '2026-05-20',
      recordedBy: 'Admin User',
      category: 'medical',
    },
  ];

  const allExpenses = [...mockExpenses, ...expenses];
  const totalExpenses = allExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  const handleAddExpense = () => {
    const expense: Omit<ExpenseRecord, 'id'> = {
      applicantId: selectedApplicantId,
      type: newExpense.type,
      amount: newExpense.amount,
      description: newExpense.description,
      date: new Date().toISOString().split('T')[0],
      recordedBy: currentUserName,
      category: newExpense.category,
    };

    addExpense(expense);

    addActivityLog({
      applicantId: selectedApplicantId,
      action: 'Financial Transaction Recorded',
      performedBy: currentUserName,
      department: 'Accounting',
      details: `${newExpense.type}: ₱${newExpense.amount.toLocaleString()} - ${newExpense.description}`,
    });

    showToast(`✓ Expense recorded: ${newExpense.type} (₱${newExpense.amount.toLocaleString()})`);
    setShowForm(false);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="mb-6">
        <h2 className="text-3xl font-extrabold tracking-tight">
          <Receipt className="w-8 h-8 inline-block mr-2 text-[#10B981]" />
          Expense Ledger & Financial Tracker
        </h2>
        <p className="text-sm text-[#64748B] mt-1 font-medium">
          Centralized deployment cost tracking linked to applicant profiles
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 relative">
        {isLocked && (
          <div className="absolute inset-0 bg-[#F1F5F9]/90 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg p-8">
            <Lock className="w-12 h-12 text-slate-400 mb-4" />
            <h3 className="font-black text-[#0F172A] text-xl mb-3">Access Restricted</h3>
            <p className="text-sm text-[#64748B] text-center max-w-lg">
              This module requires employer acceptance to be recorded by Management.
            </p>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-lg p-6">
            <p className="text-xs font-bold text-[#64748B] uppercase mb-2">Total Deployment Expenses</p>
            <p className="text-3xl font-black text-[#10B981]">₱{totalExpenses.toLocaleString()}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
            <p className="text-xs font-bold text-[#64748B] uppercase mb-2">Transactions Recorded</p>
            <p className="text-3xl font-black text-[#0F172A]">{allExpenses.length}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
            <p className="text-xs font-bold text-[#64748B] uppercase mb-2">Applicant</p>
            <p className="text-lg font-black text-[#0F172A]">Juan Dela Cruz</p>
            <p className="text-xs text-[#64748B]">APP-2026-089</p>
          </div>
        </div>

        {/* Add Expense Button */}
        <div className="flex justify-end mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            disabled={isLocked}
            className="px-6 py-3 bg-[#10B981] text-white text-sm font-bold hover:bg-[#059669] rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Log New Expense
          </button>
        </div>

        {/* Add Expense Form */}
        {showForm && (
          <div className="bg-slate-50 rounded-lg p-6 border border-slate-200 mb-6">
            <h3 className="font-bold text-[#0F172A] mb-4">Log Financial Transaction</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-bold text-[#475569] block mb-2">Transaction Type</label>
                <select
                  value={newExpense.type}
                  onChange={(e) => setNewExpense({ ...newExpense, type: e.target.value })}
                  className="w-full border-2 border-slate-200 px-3 py-2 rounded-lg text-sm focus:border-[#10B981] outline-none"
                >
                  <option>Visa Processing Fee</option>
                  <option>Medical Examination</option>
                  <option>Processing Fee</option>
                  <option>Cash Advance</option>
                  <option>Document Authentication</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[#475569] block mb-2">Amount (PHP)</label>
                <input
                  type="number"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: parseInt(e.target.value) })}
                  className="w-full border-2 border-slate-200 px-3 py-2 rounded-lg text-sm focus:border-[#10B981] outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold text-[#475569] block mb-2">Description</label>
                <textarea
                  rows={2}
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  className="w-full border-2 border-slate-200 px-3 py-2 rounded-lg text-sm focus:border-[#10B981] outline-none"
                ></textarea>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border-2 border-slate-200 text-[#475569] text-sm font-bold rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleAddExpense}
                className="px-6 py-2 bg-[#10B981] text-white text-sm font-bold hover:bg-[#059669] rounded-lg"
              >
                Record Transaction
              </button>
            </div>
          </div>
        )}

        {/* Expense List */}
        <div>
          <h3 className="font-bold text-[#0F172A] mb-4">Transaction History</h3>
          <div className="space-y-3">
            {allExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-[#10B981] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#10B981]/10 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-[#10B981]" />
                  </div>
                  <div>
                    <p className="font-bold text-[#0F172A]">{expense.type}</p>
                    <p className="text-sm text-[#64748B]">{expense.description}</p>
                    <p className="text-xs text-[#64748B] mt-1">
                      Recorded by: {expense.recordedBy} • {expense.date}
                    </p>
                  </div>
                </div>
                <p className="text-2xl font-black text-[#10B981]">₱{expense.amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* RBAC Note */}
        <div className="mt-6 bg-[#0EA5E9]/10 border border-[#0EA5E9]/30 rounded-lg p-4">
          <p className="text-sm text-[#0F172A]">
            <span className="font-bold">RBAC Isolation:</span> Accounting only sees financial data. Admin only sees
            compliance data. Both departments write to the same centralized applicant master file.
          </p>
        </div>
      </div>
    </div>
  );
}
