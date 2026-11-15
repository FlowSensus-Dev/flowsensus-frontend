import React, { useState, useEffect } from 'react';
import { 
  Settings, Save, ArrowLeft, Heart, Shield, FileText, 
  Globe, ShieldCheck, Info, Plane, Award
} from 'lucide-react';

export interface ExpenseBaseRates {
  medical: number;
  passport: number;
  oec: number;
  pdos: number;
  owwa: number;
  visa: number;
  nbi: number;
  psa?: number;
  tesda?: number;
}

export const defaultRates: ExpenseBaseRates = {
  medical: 1500,
  passport: 1200,
  nbi: 160,
  psa: 365,
  tesda: 1000,
  oec: 2500,
  pdos: 500,
  owwa: 1500,
  visa: 2000,
};

export const getStoredRates = (): ExpenseBaseRates => {
  try {
    const stored = localStorage.getItem('fs_expense_base_rates');
    if (stored) {
      return { ...defaultRates, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn("Failed to load base rates from local storage");
  }
  return defaultRates;
};

interface AccountingSettingsProps {
  onBack: () => void;
  showToast: (message: string) => void;
}

export default function AccountingSettings({ onBack, showToast }: AccountingSettingsProps) {
  const [rates, setRates] = useState<ExpenseBaseRates>(defaultRates);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setRates(getStoredRates());
  }, []);

  const handleSave = () => {
    setIsSaving(true);
    try {
      localStorage.setItem('fs_expense_base_rates', JSON.stringify(rates));
      showToast('✓ Financial base rates and DMW policy rules updated successfully');
    } catch (e) {
      showToast('Failed to save base rates');
    } finally {
      setIsSaving(false);
    }
  };

  const updateRate = (key: keyof ExpenseBaseRates, value: string) => {
    const numValue = parseFloat(value);
    setRates(prev => ({
      ...prev,
      [key]: isNaN(numValue) ? 0 : numValue
    }));
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-8 w-full">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button 
              onClick={onBack}
              className="flex items-center text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
            </button>
            <h1 className="text-2xl font-black text-[#0F172A] flex items-center gap-3">
              <Settings className="w-6 h-6 text-emerald-600" />
              Accounting & Fee Standard Settings
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Configure baseline fee rates for automated stage synchronization in accordance with DMW / POEA guidelines.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-sm transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>

        {/* Regulatory Summary Banner */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-emerald-900 text-xs">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-sm text-emerald-950">DMW Regulatory Compliance Principles</p>
              <p className="text-emerald-800 leading-relaxed">
                Under Department of Migrant Workers rules, costs are divided strictly by legal responsibility:
                <strong> Personal documents</strong> (medical examinations, passport, NBI, PSA) are worker-borne.
                <strong> Deployment costs</strong> (visa, work permits, OEC, OWWA, airfare) must be covered by the foreign employer/agency.
                Placement fees are capped at <strong>1 month's basic salary</strong> and are strictly forbidden for domestic workers and zero-fee countries.
              </p>
            </div>
          </div>
        </div>

        {/* Section 1: Worker-Borne Personal Documentation */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100">
            <Heart className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="font-bold text-[#0F172A] text-base">Worker-Borne Personal Documentation (PHP)</h3>
              <p className="text-xs text-slate-500">Standard candidate documentation fees paid directly by the applicant</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">Medical Examination (Fit-to-Work / PEME)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₱</span>
                <input
                  type="number"
                  value={rates.medical}
                  onChange={e => updateRate('medical', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">Passport Processing / Renewal</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₱</span>
                <input
                  type="number"
                  value={rates.passport}
                  onChange={e => updateRate('passport', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">NBI / Police Clearance</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₱</span>
                <input
                  type="number"
                  value={rates.nbi}
                  onChange={e => updateRate('nbi', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">PSA / NSO Birth Certificate</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₱</span>
                <input
                  type="number"
                  value={rates.psa || 365}
                  onChange={e => updateRate('psa', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Employer-Covered Processing Costs */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100">
            <Plane className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-bold text-[#0F172A] text-base">Employer-Covered Processing Costs (PHP)</h3>
              <p className="text-xs text-slate-500">Government and deployment costs paid by foreign employer / agency (Zero-Fee to OFW)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">OEC Processing Fee (POEA/DMW)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₱</span>
                <input
                  type="number"
                  value={rates.oec}
                  onChange={e => updateRate('oec', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-sm font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">OWWA Membership Contribution</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₱</span>
                <input
                  type="number"
                  value={rates.owwa}
                  onChange={e => updateRate('owwa', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-sm font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">Working Visa & Entry Permit</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₱</span>
                <input
                  type="number"
                  value={rates.visa}
                  onChange={e => updateRate('visa', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-sm font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">PDOS / PEOS Pre-Departure Seminar</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₱</span>
                <input
                  type="number"
                  value={rates.pdos}
                  onChange={e => updateRate('pdos', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-sm font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
