import React, { useState } from 'react';
import AgencySesSettings from './AgencySesSettings';
import DelayReasonManagement, { DelayReasonManagementProps } from './DelayReasonManagement';
import StagePertConfiguration from './StagePertConfiguration';

export default function ForecastingConfiguration({ canEdit, onAlphaSaved, ...delays }: Omit<DelayReasonManagementProps, 'canEdit'> & { canEdit: boolean; onAlphaSaved: () => Promise<void> }) {
  const [sesVersion, setSesVersion] = useState(0);
  const pertSaved = async (refreshSesSettings = false) => {
    // Initial setup may have created the agency's first SES settings.
    if (refreshSesSettings) setSesVersion((version) => version + 1);
    await onAlphaSaved();
  };
  return <details className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
    <summary className="cursor-pointer font-bold text-slate-900 text-lg">Forecasting Configuration</summary>
    <div className="mt-4 space-y-4">
      {canEdit && <StagePertConfiguration canEdit={canEdit} onSaved={pertSaved} />}
      <AgencySesSettings key={sesVersion} canEdit={canEdit} onSaved={onAlphaSaved} />
      <details className="border-t border-slate-200 pt-4">
        <summary className="cursor-pointer font-bold text-slate-900 text-sm">Delay Reason Management</summary>
        <div className="mt-3"><DelayReasonManagement {...delays} canEdit={canEdit} /></div>
      </details>
    </div>
  </details>;
}
