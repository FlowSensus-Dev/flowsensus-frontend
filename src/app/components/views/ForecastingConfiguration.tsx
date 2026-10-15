import React from 'react';
import AgencySesSettings from './AgencySesSettings';
import DelayReasonManagement, { DelayReasonManagementProps } from './DelayReasonManagement';

export default function ForecastingConfiguration({ canEdit, onAlphaSaved, ...delays }: Omit<DelayReasonManagementProps, 'canEdit'> & { canEdit: boolean; onAlphaSaved: () => Promise<void> }) {
  return <details className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
    <summary className="cursor-pointer font-bold text-slate-900 text-lg">Forecasting Configuration</summary>
    <div className="mt-4 space-y-4">
      <AgencySesSettings canEdit={canEdit} onSaved={onAlphaSaved} />
      <details className="border-t border-slate-200 pt-4">
        <summary className="cursor-pointer font-bold text-slate-900 text-sm">Delay Reason Management</summary>
        <div className="mt-3"><DelayReasonManagement {...delays} canEdit={canEdit} /></div>
      </details>
    </div>
  </details>;
}
