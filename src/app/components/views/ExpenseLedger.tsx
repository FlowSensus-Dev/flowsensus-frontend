import React, { useState, useMemo } from 'react';
import { Lock, DollarSign, Plus, Receipt, Loader2, Download, Building2, ArrowLeft, Search, Filter, User, X, Edit2, Trash2, CheckSquare, Calendar, History, FileText } from 'lucide-react';
import { WorkflowState, ExpenseRecord, ActivityLog, ApplicantRecord, ApplicantLedgerSummary } from '../../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExpenseLedgerProps {
  workflow: WorkflowState;
  expenses?: ExpenseRecord[];
  addExpense: (expense: Omit<ExpenseRecord, 'id'>) => void;
  updateExpense?: (id: string, updates: Partial<ExpenseRecord>) => void;
  deleteExpense?: (id: string) => void;
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
  deleteExpense,
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
      const matchesPhase = phaseFilter === 'All' || app.phaseDescription === phaseFilter;
      return matchesSearch && matchesPhase;
    }).sort((a, b) => b.totalPeso - a.totalPeso);
  }, [applicants, expenses, searchTerm, phaseFilter]);

  // Modals & form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState('VISA Processing');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [isReimbursable, setIsReimbursable] = useState(true);

  // Batch Actions & Filters
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [activeTab, setActiveTab] = useState<'ledger' | 'soa-history'>('ledger');


  const [newExpense, setNewExpense] = useState<Omit<ExpenseRecord, 'id'>>({
    applicantId: selectedApplicantId || '',
    purpose: 'VISA Processing',
    amount: 0,
    currency: 'PESO',
    type: 'expense',
    remarks: '',
    status: 'approved',
  });

  const selectedApplicant = applicants.find((a) => String(a.id) === String(selectedApplicantId));
  const applicantDisplayName = selectedApplicant
    ? (selectedApplicant.name || `${selectedApplicant.firstName || ''} ${selectedApplicant.lastName || ''}`.trim() || `Candidate #${selectedApplicantId}`)
    : 'Selected Candidate';

  const jobOrderDetails = selectedApplicant?.jobOrder || '';



  // Calculations

  const currentExpenses = useMemo(() => {
    let list = expenses.filter(e => String(e.applicantId) === String(selectedApplicantId));
    if (dateStart) list = list.filter(e => e.date && e.date >= dateStart);
    if (dateEnd) list = list.filter(e => e.date && e.date <= dateEnd);
    if (categoryFilter !== 'All') {
      if (categoryFilter === 'Reimbursable') list = list.filter(e => (e.remarks || '').includes('[REIMBURSABLE]'));
      else if (categoryFilter === 'Personal') list = list.filter(e => !(e.remarks || '').includes('[REIMBURSABLE]'));
    }
    return list;
  }, [expenses, selectedApplicantId, dateStart, dateEnd, categoryFilter]);

  const soaLogs = useMemo(() => {
    return (workflow?.activityLogs || []).filter(l => String(l.applicantId) === String(selectedApplicantId) && l.action === 'Generated Statement of Account');
  }, [workflow, selectedApplicantId]);

  const toggleSelectExpense = (id: string) => {
    setSelectedExpenseIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBatchUpdateStatus = (status: string) => {
    if (!updateExpense) return;
    const tagMap: Record<string, string> = {
      'Unbilled': '',
      'Billed to Employer': '[Billed to Employer]',
      'Partially Paid': '[Partially Paid]',
      'Fully Settled': '[Fully Settled]',
      'Void': '[Void]'
    };
    
    selectedExpenseIds.forEach(id => {
      const exp = expenses.find(e => e.id === id);
      if (exp) {
        let remarks = (exp.remarks || '').replace(/\[Billed to Employer\]|\[Partially Paid\]|\[Fully Settled\]|\[Void\]/g, '').trim();
        if (tagMap[status]) {
          remarks = `${remarks} ${tagMap[status]}`.trim();
        }
        updateExpense(id, { remarks });
      }
    });
    showToast(`✓ Batch marked ${selectedExpenseIds.length} entries as ${status}`);
    setSelectedExpenseIds([]);
  };


  const totalPeso = currentExpenses.filter(e => e.currency === 'PESO').reduce((sum, e) => sum + e.amount, 0);
  const totalDollarDirect = currentExpenses.filter(e => e.currency === 'DOLLAR').reduce((sum, e) => sum + e.amount, 0);

  const reimbursableExpensesList = currentExpenses.filter(e => (e.remarks || '').includes('[REIMBURSABLE]'));
  const personalExpensesList = currentExpenses.filter(e => !(e.remarks || '').includes('[REIMBURSABLE]'));

  const reimbursablePHP = reimbursableExpensesList.reduce((sum, e) => sum + e.amount, 0);

  const getExpenseStatus = (remarks: string) => {
    if (remarks.includes('[Void]')) return 'Void';
    if (remarks.includes('[Fully Settled]')) return 'Fully Settled';
    if (remarks.includes('[Partially Paid]')) return 'Partially Paid';
    if (remarks.includes('[Billed to Employer]')) return 'Billed to Employer';
    return 'Unbilled';
  };
  const personalPHP = personalExpensesList.reduce((sum, e) => sum + e.amount, 0);

  const handleAddSubmit = () => {
    let finalRemarks = (newExpense.remarks || '').replace('[REIMBURSABLE]', '').trim();
    if (isReimbursable) finalRemarks = finalRemarks ? `${finalRemarks} [REIMBURSABLE]` : '[REIMBURSABLE]';

    const expense: Omit<ExpenseRecord, 'id'> = {
      applicantId: selectedApplicantId || '',
      purpose: newExpense.purpose || expenseCategory,
      amount: newExpense.amount,
      currency: 'PESO',
      type: newExpense.type,
      remarks: finalRemarks,
      status: 'approved',
      date: new Date().toISOString().split('T')[0],
      recordedBy: currentUserName,
    };

    if (editingExpenseId && updateExpense) {
      updateExpense(editingExpenseId, expense);
      showToast(`✓ Expense updated: ${expense.purpose}`);
    } else {
      addExpense(expense);
      showToast(`✓ Expense recorded: ${expense.purpose}`);
    }

    addActivityLog({
      applicantId: selectedApplicantId || '',
      action: editingExpenseId ? 'Financial Transaction Updated' : 'Financial Transaction Recorded',
      performedBy: currentUserName,
      department: 'Accounting',
      details: `${expense.type}: ₱${expense.amount.toLocaleString()} - ${expense.purpose}`,
    });

    setShowAddModal(false);
    setEditingExpenseId(null);
    setIsReimbursable(false);
    setNewExpense({
      applicantId: selectedApplicantId || '', purpose: 'VISA Processing', amount: 0, currency: 'PESO', type: 'expense', remarks: '', status: 'approved',
    });
    setExpenseCategory('VISA Processing');
  };

  const handleEditExpense = (expense: ExpenseRecord) => {
    setEditingExpenseId(expense.id);
    setIsReimbursable((expense.remarks || '').includes('[REIMBURSABLE]'));
    setNewExpense({
      applicantId: expense.applicantId,
      purpose: expense.purpose,
      amount: expense.amount,
      currency: expense.currency,
      type: expense.type,
      remarks: (expense.remarks || '').replace('[REIMBURSABLE]', '').trim(),
      status: expense.status,
    });
    const predefined = [
      'VISA Processing', 'Airfare / International Ticket', 'POEA Processing Fee', 'OWWA Membership Fee', 'Trade Test / Skills Assessment', 'Comprehensive Insurance',
      'Passport Processing (DFA)', 'NBI & Police Clearances', 'Medical Exam (Fit-to-Work)', 'Birth Certificate / PSA', 'PhilHealth / Pag-IBIG / SSS', 'Cash Advance', 'Salary Deduction'
    ];
    if (predefined.includes(expense.purpose)) {
      setExpenseCategory(expense.purpose);
    } else {
      setExpenseCategory('Other');
    }
    
    setShowAddModal(true);
  };

  const generatePDF = () => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("FLOWSENSUS RECRUITMENT AGENCY", 14, 22);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Statement of Account & Deployment Advances", 14, 28);
    
    doc.setFontSize(10);
    doc.text(`Applicant: ${applicantDisplayName}`, 14, 38);
    doc.text(`Employer: ${selectedApplicant?.jobOrder || 'Not Assigned'}`, 14, 44);
    doc.text(`Date Generated: ${new Date().toLocaleDateString()}`, 14, 50);

    const reimbursableExpenses = currentExpenses.filter(e => (e.remarks || '').includes('[REIMBURSABLE]'));
    const personalExpenses = currentExpenses.filter(e => !(e.remarks || '').includes('[REIMBURSABLE]'));

    const reimbursableTotal = reimbursableExpenses.reduce((sum, e) => sum + e.amount, 0);
    const personalTotal = personalExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    let currentY = 60;

    // Section 1: Reimbursable Costs
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Section 1: Reimbursable Costs (Billable to Employer)", 14, currentY);
    
    if (reimbursableExpenses.length > 0) {
      const rTableData = reimbursableExpenses.map((exp) => [
        new Date(exp.date || Date.now()).toLocaleDateString(),
        exp.purpose || 'General',
        `PHP ${exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        exp.status === 'draft' ? 'Draft' : 'Advanced'
      ]);
      // @ts-ignore
      autoTable(doc, {
        startY: currentY + 5,
        head: [['Date', 'Description', 'Amount', 'Status']],
        body: rTableData,
        theme: 'grid',
        headStyles: { fillColor: [44, 62, 80] },
      });
      currentY = (doc as any).lastAutoTable.finalY + 8;
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text("No reimbursable costs recorded.", 14, currentY + 6);
      currentY += 14;
    }
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text(`Subtotal Reimbursable: PHP ${reimbursableTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 14, currentY);
    currentY += 15;

    // Section 2: Personal Costs
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Section 2: Personal Costs (Applicant Deductions)", 14, currentY);
    
    if (personalExpenses.length > 0) {
      const pTableData = personalExpenses.map((exp) => [
        new Date(exp.date || Date.now()).toLocaleDateString(),
        exp.purpose || 'General',
        `PHP ${exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        exp.status === 'draft' ? 'Draft' : 'Advanced'
      ]);
      // @ts-ignore
      autoTable(doc, {
        startY: currentY + 5,
        head: [['Date', 'Description', 'Amount', 'Status']],
        body: pTableData,
        theme: 'grid',
        headStyles: { fillColor: [100, 116, 139] },
      });
      currentY = (doc as any).lastAutoTable.finalY + 8;
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text("No personal costs recorded.", 14, currentY + 6);
      currentY += 14;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text(`Subtotal Personal: PHP ${personalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 14, currentY);
    currentY += 20;

    // Summary Block
    doc.setFillColor(241, 245, 249);
    doc.rect(14, currentY - 5, 180, 25, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Advances: PHP ${(reimbursableTotal + personalTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 18, currentY + 2);
    
    doc.setFontSize(10);
    doc.setTextColor(22, 163, 74); // green
    doc.text(`Total Employer Billable: PHP ${reimbursableTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 18, currentY + 9);
    
    doc.setTextColor(220, 38, 38); // red
    doc.text(`Total Applicant Liability: PHP ${personalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 18, currentY + 16);

    doc.save(`SOA_${applicantDisplayName.replace(/\s+/g, '_')}.pdf`);

    addActivityLog({
      applicantId: selectedApplicantId || '',
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
        {/* Sticky Applicant Header */}
        <div className="sticky top-0 z-20 bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <button 
                onClick={() => onSelectApplicant ? onSelectApplicant('') : (onViewApplicant && onViewApplicant(''))}
                className="text-slate-400 hover:text-white transition-colors"
                title="Back to Directory"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="text-xl font-black text-white">Processing: {applicantDisplayName}</h3>
            </div>
            <p className="text-sm font-medium text-slate-300 ml-8">
              Employer: <span className="text-white font-bold">{jobOrderDetails || 'Not Assigned'}</span>
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => {
                setEditingExpenseId(null);
                setIsReimbursable(false);
                setNewExpense({
                  applicantId: selectedApplicantId,
                  purpose: 'VISA Processing',
                  amount: 0,
                  currency: 'PESO',
                  type: 'expense',
                  remarks: '',
                  status: 'approved',
                });
                setShowAddModal(true);
              }} 
              className="px-5 py-2.5 bg-emerald-500 text-white text-sm font-bold rounded-lg hover:bg-emerald-400 flex items-center gap-2 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Entry
            </button>
            <button onClick={generatePDF} className="px-5 py-2.5 bg-white text-slate-800 text-sm font-bold rounded-lg hover:bg-slate-100 flex items-center gap-2 shadow-sm transition-colors">
              <Download className="w-4 h-4" /> Export PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Ledger Area */}
          <div className="space-y-6">

            {/* Filters and Batch Actions */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-slate-400" />
                  <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="border-slate-300 rounded-md text-sm py-1.5 focus:border-indigo-500 focus:ring-indigo-500">
                    <option value="All">All Categories</option>
                    <option value="Reimbursable">Reimbursable Only</option>
                    <option value="Personal">Personal Only</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                  <Calendar size={16} className="text-slate-400" />
                  <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="border-slate-300 rounded-md text-sm py-1.5 text-slate-600" />
                  <span className="text-slate-400 text-xs">to</span>
                  <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="border-slate-300 rounded-md text-sm py-1.5 text-slate-600" />
                </div>
              </div>
              
              {selectedExpenseIds.length > 0 && (
                <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                  <span className="text-xs font-bold text-indigo-700 mr-2">{selectedExpenseIds.length} Selected</span>
                  <select onChange={(e) => handleBatchUpdateStatus(e.target.value)} className="text-xs border-indigo-200 rounded text-indigo-700 bg-white py-1 cursor-pointer">
                    <option value="">Mark as...</option>
                    <option value="Unbilled">Unbilled</option>
                    <option value="Billed to Employer">Billed to Employer</option>
                    <option value="Partially Paid">Partially Paid</option>
                    <option value="Fully Settled">Fully Settled</option>
                    <option value="Void">Void</option>
                  </select>
                </div>
              )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-xl shadow-sm">
                <p className="text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">Total Employer Billable</p>
                <p className="text-2xl font-black text-indigo-900">₱ {reimbursablePHP.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
              </div>
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Applicant Liability</p>
                <p className="text-2xl font-black text-rose-600">₱ {personalPHP.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl shadow-sm">
                <p className="text-emerald-600 text-xs font-bold uppercase tracking-wider mb-1">Overall Advances</p>
                <p className="text-2xl font-black text-emerald-700">₱ {(reimbursablePHP + personalPHP).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
              </div>
            </div>

            {/* Reimbursable Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-800 px-4 py-3">
                <h3 className="text-white font-bold text-sm">Employer Reimbursables (Billable Costs)</h3>
              </div>
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold">
                  <tr>
                    <th className="px-4 py-3 w-10"></th>
                    <th className="px-4 py-3">PURPOSE</th>
                    <th className="px-4 py-3 text-right">AMOUNT</th>
                    <th className="px-4 py-3">STATUS</th>
                    <th className="px-4 py-3">REMARKS</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentExpenses.filter(e => (e.remarks || '').includes('[REIMBURSABLE]')).map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3"><input type="checkbox" checked={selectedExpenseIds.includes(exp.id)} onChange={() => toggleSelectExpense(exp.id)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /></td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {exp.purpose || 'General'}
                        {exp.status === 'draft' && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase">Draft</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">
                        ₱ {exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3"><span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase">{getExpenseStatus(exp.remarks || '')}</span></td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{(exp.remarks || '').replace('[REIMBURSABLE]', '').replace(/\[Billed to Employer\]|\[Partially Paid\]|\[Fully Settled\]|\[Void\]/g, '').replace(/\[Billed to Employer\]|\[Partially Paid\]|\[Fully Settled\]|\[Void\]/g, '').trim()}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleEditExpense(exp)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit Entry">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {currentExpenses.filter(e => (e.remarks || '').includes('[REIMBURSABLE]')).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400 italic">No billable expenses advanced yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Personal Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-100 px-4 py-3 border-b border-slate-200">
                <h3 className="text-slate-800 font-bold text-sm">Personal Costs (Applicant Deductions)</h3>
              </div>
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold">
                  <tr>
                    <th className="px-4 py-3 w-10"></th>
                    <th className="px-4 py-3">PURPOSE</th>
                    <th className="px-4 py-3 text-right">AMOUNT</th>
                    <th className="px-4 py-3">STATUS</th>
                    <th className="px-4 py-3">REMARKS</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentExpenses.filter(e => !(e.remarks || '').includes('[REIMBURSABLE]')).map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3"><input type="checkbox" checked={selectedExpenseIds.includes(exp.id)} onChange={() => toggleSelectExpense(exp.id)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /></td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {exp.purpose || 'General'}
                        {exp.status === 'draft' && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase">Draft</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">
                        ₱ {exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3"><span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase">{getExpenseStatus(exp.remarks || '')}</span></td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{(exp.remarks || '').replace(/\[Billed to Employer\]|\[Partially Paid\]|\[Fully Settled\]|\[Void\]/g, '').trim()}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleEditExpense(exp)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit Entry">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {currentExpenses.filter(e => !(e.remarks || '').includes('[REIMBURSABLE]')).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400 italic">No personal deductions recorded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
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
                      const val = e.target.value;
                      setExpenseCategory(val);
                      
                      const reimbursableList = ['VISA Processing', 'Airfare / International Ticket', 'POEA Processing Fee', 'OWWA Membership Fee', 'Trade Test / Skills Assessment', 'Comprehensive Insurance'];
                      const isReimbursableCat = reimbursableList.includes(val);
                      setIsReimbursable(isReimbursableCat);

                      setNewExpense({
                        ...newExpense,
                        purpose: val === 'Other' ? '' : val,
                        type: val === 'Cash Advance' ? 'cash_advance' : (val === 'Salary Deduction' ? 'deduction' : 'expense')
                      });
                    }}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <optgroup label="Reimbursable (Billed to Employer)">
                      <option value="VISA Processing">VISA Processing</option>
                      <option value="Airfare / International Ticket">Airfare / International Ticket</option>
                      <option value="POEA Processing Fee">POEA Processing Fee</option>
                      <option value="OWWA Membership Fee">OWWA Membership Fee</option>
                      <option value="Trade Test / Skills Assessment">Trade Test / Skills Assessment</option>
                      <option value="Comprehensive Insurance">Comprehensive Insurance</option>
                    </optgroup>
                    <optgroup label="Personal (Applicant Deductions)">
                      <option value="Passport Processing (DFA)">Passport Processing (DFA)</option>
                      <option value="NBI & Police Clearances">NBI & Police Clearances</option>
                      <option value="Medical Exam (Fit-to-Work)">Medical Exam (Fit-to-Work)</option>
                      <option value="Birth Certificate / PSA">Birth Certificate / PSA</option>
                      <option value="PhilHealth / Pag-IBIG / SSS">PhilHealth / Pag-IBIG / SSS</option>
                      <option value="Cash Advance">Cash Advance</option>
                      <option value="Salary Deduction">Salary Deduction</option>
                      <option value="Other">Other (Specify)</option>
                    </optgroup>
                  </select>
                </div>
                {(expenseCategory === 'Other') && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Specific Purpose</label>
                    <input type="text" value={newExpense.purpose} onChange={e => setNewExpense({ ...newExpense, purpose: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Extra Luggage" />
                  </div>
                )}

                {/* Helper info block */}
                <div className={`p-3 rounded-lg text-sm border flex items-start gap-2 ${isReimbursable ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
                  <span className="text-lg leading-none mt-0.5">💡</span>
                  <p>
                    <strong className="block mb-0.5">{isReimbursable ? 'Reimbursable Expense' : 'Personal Deduction'}</strong>
                    {isReimbursable ? 'This entry will be billed directly to the Foreign Employer and will appear on their SOA.' : 'This entry is an applicant liability and will be deducted from their personal accounts/salary.'}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Amount (₱ PHP)</label>
                  <input type="number" value={newExpense.amount} onChange={e => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Remarks / Details</label>
                  <input type="text" value={newExpense.remarks} onChange={e => setNewExpense({ ...newExpense, remarks: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Optional details..." />
                </div>
                <button onClick={handleAddSubmit} className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 mt-2 transition-colors">
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
