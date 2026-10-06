import React, { useState, useEffect } from 'react';
import { Settings, Save, ArrowLeft, Activity, Heart, Shield, FileText, Globe } from 'lucide-react';

export interface ExpenseBaseRates {
  medical: number;
  passport: number;
  oec: number;
  pdos: number;
  owwa: number;
  visa: number;
  nbi: number;
}

export const defaultRates: ExpenseBaseRates = {
  medical: 1500,
  passport: 1200,
  oec: 2500,
  pdos: 500,
  owwa: 1500,
  visa: 2000,
  nbi: 130,
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
      showToast('Base rates updated successfully');
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
    <div className="flex-1 overflow-auto bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <button 
              onClick={onBack}
              className="flex items-center text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
            </button>
            <h1 className="text-2xl font-black text-[#0F172A] flex items-center gap-3">
              <Settings className="w-8 h-8 text-indigo-600 bg-indigo-100 p-1.5 rounded-lg" />
              Accounting Settings
            </h1>
            <p className="text-slate-500 mt-1 font-medium">Configure global base rates for automated applicant expenses.</p>
          </div>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" /> Standard Processing Fees (PHP)
            </h3>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                  <Heart className="w-4 h-4 text-rose-500" /> Medical Package (Fit-to-Work)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span>
                  <input 
                    type="number" 
                    value={rates.medical}
                    onChange={(e) => updateRate('medical', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg pl-8 pr-4 py-2 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">Automatically charged when medical phase is cleared.</p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                  <FileText className="w-4 h-4 text-blue-500" /> OEC Processing
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span>
                  <input 
                    type="number" 
                    value={rates.oec}
                    onChange={(e) => updateRate('oec', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg pl-8 pr-4 py-2 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                  <Shield className="w-4 h-4 text-emerald-500" /> OWWA Membership
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span>
                  <input 
                    type="number" 
                    value={rates.owwa}
                    onChange={(e) => updateRate('owwa', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg pl-8 pr-4 py-2 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                  <Globe className="w-4 h-4 text-amber-500" /> Passport Processing
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span>
                  <input 
                    type="number" 
                    value={rates.passport}
                    onChange={(e) => updateRate('passport', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg pl-8 pr-4 py-2 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                  <Globe className="w-4 h-4 text-purple-500" /> Visa Processing
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span>
                  <input 
                    type="number" 
                    value={rates.visa}
                    onChange={(e) => updateRate('visa', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg pl-8 pr-4 py-2 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                    <FileText className="w-4 h-4 text-slate-500" /> PDOS
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span>
                    <input 
                      type="number" 
                      value={rates.pdos}
                      onChange={(e) => updateRate('pdos', e.target.value)}
                      className="w-full border border-slate-300 rounded-lg pl-8 pr-4 py-2 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                    <FileText className="w-4 h-4 text-slate-500" /> NBI
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span>
                    <input 
                      type="number" 
                      value={rates.nbi}
                      onChange={(e) => updateRate('nbi', e.target.value)}
                      className="w-full border border-slate-300 rounded-lg pl-8 pr-4 py-2 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
