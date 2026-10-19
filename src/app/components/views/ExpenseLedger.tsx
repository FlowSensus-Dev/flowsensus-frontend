import React, { useState, useMemo } from 'react';
import { Lock, DollarSign, Plus, Receipt, Loader2, Download, Building2, ArrowLeft, Search, Filter, User, X, Edit2 } from 'lucide-react';
import { WorkflowState, ExpenseRecord, ActivityLog, ApplicantRecord, ApplicantLedgerSummary } from '../../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExpenseLedgerProps {
  workflow: WorkflowState;
  expenses?: ExpenseRecord[];
  addExpense: (expense: Omit<ExpenseRecord, 'id'>) => void;
  updateExpense?: (id: string, updates: Partial<ExpenseRecord>) => void;
  currentUserName: string;
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  showToast: (message: string) => void;
  selectedApplicantId?: string;
  applicants?: ApplicantRecord[];
  onViewApplicant?: (id: string) => void;
  onSelectApplicant?: (id: string) => void;
}

export default function ExpenseLedger({
  workflow,
  expenses = [],
  addExpense,
  updateExpense,
  currentUserName,
  addActivityLog,
  showToast,
  selectedApplicantId,
  applicants = [],
  onViewApplicant,
  onSelectApplicant,
}: ExpenseLedgerProps) {
  // For the Applicant Directory view
  const [searchTerm, setSearchTerm] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('All');

  const applicantLedgers = useMemo(() => {
    return applicants.map(app => {
      const appExpenses = expenses.filter(e => String(e.applicantId) === String(app.id));
      const totalPeso = appExpenses.filter(e => e.currency === 'PESO').reduce((sum, e) => sum + e.amount, 0);
      const totalDollar = appExpenses.filter(e => e.currency === 'DOLLAR').reduce((sum, e) => sum + e.amount, 0);
      return {
        ...app,
        expenseCount: appExpenses.length,
        totalPeso,
        totalDollar
      };
    }).filter(app => {
      const matchesSearch = (app.name || `${app.firstName || ''} ${app.lastName || ''}`).toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (app.applicantCode || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPhase = phaseFilter === 'All' || app.workflowPhase === phaseFilter;
      return matchesSearch && matchesPhase;
    }).sort((a, b) => b.totalPeso - a.totalPeso);
  }, [applicants, expenses, searchTerm, phaseFilter]);

  // Modals & form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState('Document Processing');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const [newExpense, setNewExpense] = useState<Omit<ExpenseRecord, 'id'>>({
    applicantId: selectedApplicantId,
    purpose: 'Document Processing',
    amount: 0,
    currency: 'PESO',
    type: 'expense',
    remarks: '',
    status: 'approved',
  });

  // Local settings for this applicant's ledger
  const [currentSummary, setCurrentSummary] = useState<ApplicantLedgerSummary>({
    applicantId: selectedApplicantId,
    targetCurrency: 'USD',
    exchangeRateUsdToPhp: 56.5,
    remittance: 0,
    accommodationPerDay: 0,
    accommodationDays: 0,
  });

  const updateSummary = (key: keyof ApplicantLedgerSummary, value: any) => {
    setCurrentSummary(prev => ({ ...prev, [key]: value }));
  };

  const selectedApplicant = applicants.find((a) => String(a.id) === String(selectedApplicantId));
  const applicantDisplayName = selectedApplicant
    ? (selectedApplicant.name || `${selectedApplicant.firstName || ''} ${selectedApplicant.lastName || ''}`.trim() || `Candidate #${selectedApplicantId}`)
    : 'Selected Candidate';

  // Calculations
  const currentExpenses = useMemo(() => {
    return expenses.filter(e => String(e.applicantId) === String(selectedApplicantId));
  }, [expenses, selectedApplicantId]);

  const totalPeso = currentExpenses.filter(e => e.currency === 'PESO').reduce((sum, e) => sum + e.amount, 0);
  const totalDollarDirect = currentExpenses.filter(e => e.currency === 'DOLLAR').reduce((sum, e) => sum + e.amount, 0);

  const convertedToDollar = currentSummary.exchangeRateUsdToPhp > 0
    ? (totalPeso / currentSummary.exchangeRateUsdToPhp)
    : 0;

  const totalDollar = totalDollarDirect + convertedToDollar;
  const totalAccommodation = currentSummary.accommodationPerDay * currentSummary.accommodationDays;
  const totalExpensesDollar = totalDollar + totalAccommodation;
  const remainingToPay = totalExpensesDollar - currentSummary.remittance;

  const handleAddSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const expense: Omit<ExpenseRecord, 'id'> = {
        applicantId: selectedApplicantId,
        purpose: newExpense.purpose || expenseCategory,
        amount: newExpense.amount,
        currency: newExpense.currency,
        type: newExpense.type,
        remarks: newExpense.remarks,
        status: 'approved',
        date: new Date().toISOString().split('T')[0],
        recordedBy: currentUserName,
      };

      if (editingExpenseId && updateExpense) {
        await Promise.resolve(updateExpense(editingExpenseId, expense));
        showToast(`✓ Expense updated: ${expense.purpose}`);
      } else {
        await Promise.resolve(addExpense(expense));
        showToast(`✓ Expense recorded: ${expense.purpose}`);
      }

      addActivityLog({
        applicantId: selectedApplicantId,
        action: editingExpenseId ? 'Financial Transaction Updated' : 'Financial Transaction Recorded',
        performedBy: currentUserName,
        department: 'Accounting',
        details: `${expense.type}: ₱${expense.amount.toLocaleString()} - ${expense.purpose}`,
      });

      setShowAddModal(false);
      setEditingExpenseId(null);
      setNewExpense({
        applicantId: selectedApplicantId, purpose: 'Document Processing', amount: 0, currency: 'PESO', type: 'expense', remarks: '', status: 'approved',
      });
      setExpenseCategory('Document Processing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditExpense = (expense: ExpenseRecord) => {
    setEditingExpenseId(expense.id);
    setNewExpense({
      applicantId: expense.applicantId,
      purpose: expense.purpose,
      amount: expense.amount,
      currency: expense.currency,
      type: expense.type,
      remarks: expense.remarks || '',
      status: expense.status,
    });
    if (expense.type === 'deduction') setExpenseCategory('Salary Deduction');
    else if (expense.type === 'cash_advance') setExpenseCategory('Cash Advance');
    else if (expense.purpose.includes('Medical')) setExpenseCategory('Medical Fee');
    else if (expense.purpose.includes('Training') || expense.purpose.includes('Seminar')) setExpenseCategory('Training & Seminar');
    else setExpenseCategory('Document Processing');
    
    setShowAddModal(true);
  };

  const generatePDF = () => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Statement of Account", 14, 22);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Agency: FLOWSENSUS Accounting`, 14, 30);
    doc.text(`Applicant Name: ${applicantDisplayName}`, 14, 36);
    doc.text(`Date Generated: ${new Date().toLocaleDateString()}`, 14, 42);

    // Table
    const tableData = currentExpenses.map((exp, i) => [
      i + 1,
      exp.purpose || 'General',
      exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }),
      exp.currency,
      exp.remarks || ''
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['Nos.', 'Purpose', 'Amount', 'Currency', 'Remarks']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 50;

    // Totals Section
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Total Peso Expenses: PHP ${totalPeso.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 14, finalY + 10);
    doc.text(`Total Direct ${currentSummary.targetCurrency} Expenses: ${currentSummary.targetCurrency} ${totalDollarDirect.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 14, finalY + 16);
    doc.text(`Exchange Rate used: 1 ${currentSummary.targetCurrency} = ${currentSummary.exchangeRateUsdToPhp} PHP`, 14, finalY + 22);

    doc.setFontSize(12);
    doc.setTextColor(16, 185, 129); // emerald-500
    doc.text(`GRAND TOTAL OF EXPENSES: ${currentSummary.targetCurrency} ${totalExpensesDollar.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 14, finalY + 32);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Less: Remittance Received: ${currentSummary.targetCurrency} ${currentSummary.remittance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 14, finalY + 40);

    doc.setFontSize(12);
    doc.setTextColor(225, 29, 72); // rose-600
    doc.text(`TOTAL REMAINING TO PAY: ${currentSummary.targetCurrency} ${remainingToPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 14, finalY + 50);

    doc.save(`SOA_${applicantDisplayName.replace(/\s+/g, '_')}.pdf`);

    addActivityLog({
      applicantId: selectedApplicantId,
      action: 'Generated Statement of Account',
      performedBy: currentUserName,
      department: 'Accounting',
      details: 'Exported SOA PDF for Employer/Agent'
    });
  };

  return (
    <div className="space-y-6 w-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">
            <Receipt className="w-8 h-8 inline-block mr-2 text-[#10B981]" />
            Expense Ledger & Financial Tracker
          </h2>
          <p className="text-sm text-[#64748B] mt-1 font-medium">
            Centralized deployment cost tracking linked to applicant profiles
          </p>
        </div>
      </div>

      {!selectedApplicantId ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <h3 className="font-bold text-[#0F172A] whitespace-nowrap">Applicant Ledgers</h3>
            <div className="flex w-full md:w-auto items-center gap-3">
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search applicant..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#0EA5E9]"
                />
              </div>
              <div className="relative flex-shrink-0">
                <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select 
                  value={phaseFilter}
                  onChange={e => setPhaseFilter(e.target.value)}
                  className="pl-9 pr-8 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#0EA5E9] bg-white appearance-none"
                >
                  <option value="All">All Phases</option>
                  <option value="Medical">Medical Phase</option>
                  <option value="Profiling">Profiling Phase</option>
                  <option value="Endorsement">Endorsement Phase</option>
                  <option value="Deployed">Deployed</option>
                </select>
              </div>
            </div>
          </div>
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {applicantLedgers.map(app => (
              <div key={app.id} onClick={() => onSelectApplicant ? onSelectApplicant(String(app.id)) : (onViewApplicant && onViewApplicant(String(app.id)))} className="p-4 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                    <User className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-bold text-[#0F172A]">{app.name || `${app.firstName || ''} ${app.lastName || ''}`}</p>
                    <p className="text-xs text-slate-500">{app.applicantCode || `ID: ${app.id}`} • {app.expenseCount} entries</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-800">₱{app.totalPeso.toLocaleString()} {app.totalDollar > 0 && `/ $${app.totalDollar.toLocaleString()}`}</p>
                  <p className="text-xs text-slate-500">Recorded Expenses</p>
                </div>
              </div>
            ))}
            {applicantLedgers.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                No applicants found in the system.
              </div>
            )}
          </div>
        </div>
      ) : (
      <div className="relative">
        <div className="mb-4 flex items-center justify-between">
          <button 
            onClick={() => onSelectApplicant ? onSelectApplicant('') : (onViewApplicant && onViewApplicant(''))}
            className="flex items-center text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Directory
          </button>
          <div className="flex gap-3">
            <button 
              onClick={() => {
                setEditingExpenseId(null);
                setNewExpense({
                  applicantId: selectedApplicantId,
                  purpose: 'Document Processing',
                  amount: 0,
                  currency: 'PESO',
                  type: 'expense',
                  remarks: '',
                  status: 'approved',
                });
                setShowAddModal(true);
              }} 
              className="px-4 py-2 bg-[#10B981] text-white text-sm font-bold rounded-lg hover:bg-[#059669] flex items-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add Entry
            </button>
            <button onClick={generatePDF} className="px-4 py-2 bg-slate-800 text-white text-sm font-bold rounded-lg hover:bg-slate-700 flex items-center gap-2">
              <Download className="w-4 h-4" /> Export PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Ledger Table */}
          <div className="lg:col-span-3 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold">
                <tr>
                  <th className="px-4 py-3 text-center w-16">NOS.</th>
                  <th className="px-4 py-3">PURPOSE</th>
                  <th className="px-4 py-3 text-right">AMOUNT</th>
                  <th className="px-4 py-3 text-center">CURRENCY</th>
                  <th className="px-4 py-3">REMARKS</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentExpenses.map((exp, idx) => (
                  <tr key={exp.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-center font-medium text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {exp.purpose || 'General'}
                      {exp.status === 'draft' && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase">Draft</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${exp.currency === 'PESO' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {exp.currency}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{exp.remarks}</td>
                    <td className="px-4 py-3">
                      <button 
                        onClick={() => handleEditExpense(exp)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit Entry"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {currentExpenses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">No recorded expenses for this applicant.</td>
                  </tr>
                )}

                <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                  <td colSpan={2} className="px-4 py-3 text-right">TOTAL OF PESO</td>
                  <td className="px-4 py-3 text-right">{totalPeso.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td colSpan={3}></td>
                </tr>
                <tr className="bg-slate-50 font-bold">
                  <td colSpan={2} className="px-4 py-3 text-right">Total Converting PESO to {currentSummary.targetCurrency}</td>
                  <td className="px-4 py-3 text-right">{convertedToDollar.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td colSpan={3}></td>
                </tr>
                <tr className="bg-slate-50 font-bold">
                  <td colSpan={2} className="px-4 py-3 text-right">Total Of {currentSummary.targetCurrency}</td>
                  <td className="px-4 py-3 text-right">{totalDollar.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-center">{currentSummary.targetCurrency}</td>
                  <td colSpan={2}></td>
                </tr>
                <tr className="bg-slate-100 font-black text-slate-900 border-t border-slate-200">
                  <td colSpan={2} className="px-4 py-3 text-right uppercase">Total Of expenses</td>
                  <td className="px-4 py-3 text-right">{totalExpensesDollar.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-center">{currentSummary.targetCurrency}</td>
                  <td colSpan={2}></td>
                </tr>

                {/* Separator */}
                <tr><td colSpan={6} className="py-2"></td></tr>

                <tr className="bg-emerald-50 font-black text-emerald-900 border-t border-emerald-200">
                  <td colSpan={2} className="px-4 py-3 text-right uppercase">total remaining to pay to agent</td>
                  <td className="px-4 py-3 text-right">{remainingToPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-center">{currentSummary.targetCurrency}</td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Settings Sidebar */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" /> Exchange & Remittance
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Target Currency</label>
                  <select
                    value={currentSummary.targetCurrency}
                    onChange={(e) => updateSummary('targetCurrency', e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm font-medium focus:border-emerald-500 outline-none bg-white"
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="SAR">SAR - Saudi Riyal</option>
                    <option value="AED">AED - UAE Dirham</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="CAD">CAD - Canadian Dollar</option>
                    <option value="GBP">GBP - British Pound</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">{currentSummary.targetCurrency} Exchange Rate (PHP)</label>
                  <input
                    type="number"
                    value={currentSummary.exchangeRateUsdToPhp}
                    onChange={(e) => updateSummary('exchangeRateUsdToPhp', parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm font-medium focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Remittance ({currentSummary.targetCurrency})</label>
                  <input
                    type="number"
                    value={currentSummary.remittance}
                    onChange={(e) => updateSummary('remittance', parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm font-medium focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-600" /> Accommodation
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Accommodation per day ({currentSummary.targetCurrency})</label>
                  <input
                    type="number"
                    value={currentSummary.accommodationPerDay}
                    onChange={(e) => updateSummary('accommodationPerDay', parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm font-medium focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">No. of Days</label>
                  <input
                    type="number"
                    value={currentSummary.accommodationDays}
                    onChange={(e) => updateSummary('accommodationDays', parseInt(e.target.value) || 0)}
                    className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm font-medium focus:border-emerald-500 outline-none"
                  />
                </div>
                <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-sm font-bold">
                  <span className="text-slate-600">Total:</span>
                  <span className="text-slate-800">{currentSummary.targetCurrency} {totalAccommodation.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add Entry Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-[#0F172A] text-lg">{editingExpenseId ? 'Edit Entry' : 'Add Manual Entry'}</h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Category</label>
                  <select
                    value={expenseCategory}
                    onChange={e => {
                      setExpenseCategory(e.target.value);
                      setNewExpense({
                        ...newExpense,
                        purpose: e.target.value === 'Other' ? '' : e.target.value,
                        type: e.target.value === 'Cash Advance' ? 'cash_advance' : (e.target.value === 'Salary Deduction' ? 'deduction' : 'expense')
                      });
                    }}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="Document Processing">Document Processing</option>
                    <option value="Medical Fee">Medical Fee</option>
                    <option value="Training & Seminar">Training & Seminar</option>
                    <option value="Cash Advance">Cash Advance</option>
                    <option value="Salary Deduction">Salary Deduction</option>
                    <option value="Other">Other (Specify)</option>
                  </select>
                </div>
                {(expenseCategory === 'Other' || expenseCategory === 'Document Processing') && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Specific Purpose</label>
                    <input type="text" value={newExpense.purpose} onChange={e => setNewExpense({ ...newExpense, purpose: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. OEC Fee, Extra Luggage" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Amount</label>
                    <input type="number" value={newExpense.amount} onChange={e => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Currency</label>
                    <select value={newExpense.currency} onChange={e => setNewExpense({ ...newExpense, currency: e.target.value as any })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                      <option value="PESO">PESO</option>
                      <option value="DOLLAR">DOLLAR</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Accounting Type</label>
                  <select value={newExpense.type} onChange={e => setNewExpense({ ...newExpense, type: e.target.value as any })} disabled className="w-full border border-slate-300 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-600">
                    <option value="expense">Standard Expense</option>
                    <option value="cash_advance">Cash Advance</option>
                    <option value="deduction">Deduction</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Remarks</label>
                  <input type="text" value={newExpense.remarks} onChange={e => setNewExpense({ ...newExpense, remarks: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <button onClick={handleAddSubmit} disabled={isSubmitting} className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 mt-2">
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  {editingExpenseId ? 'Update Entry' : 'Save Entry'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
