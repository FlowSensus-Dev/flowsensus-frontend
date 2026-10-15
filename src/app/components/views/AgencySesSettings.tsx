import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../../../lib/api';

export function validAlpha(value: string): boolean {
  return value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 1;
}

function readAlpha(data: any): number {
  if (typeof data?.ses_alpha !== 'number' || !validAlpha(String(data.ses_alpha))) {
    throw new Error('Invalid settings response');
  }
  return data.ses_alpha;
}

function settingsError(error: any): string {
  const status = error.response?.status;
  if (status === 401) return 'Your session has expired. Sign in again to access agency settings.';
  if (status === 403) return 'You do not have permission to access or update agency settings.';
  if (status === 422) return 'Enter an alpha greater than 0 and at most 1.';
  if (!error.response) return 'Unable to confirm agency settings. Check your connection and reload settings before retrying.';
  const detail = error.response?.data?.detail;
  return typeof detail === 'string' ? detail : 'Unable to update agency settings. Please try again.';
}

export default function AgencySesSettings({ canEdit = false, onSaved }: {
  canEdit?: boolean;
  onSaved: () => Promise<void>;
}) {
  const [alpha, setAlpha] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const mounted = useRef(false);
  const busy = useRef(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const { data } = await api.get('/forecasting/settings');
      const value = readAlpha(data);
      if (mounted.current) { setAlpha(value); setDraft(String(value)); setEditing(false); }
    } catch (err) {
      if (mounted.current) setError(settingsError(err));
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; };
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit || busy.current || loading) return;
    setError(null);
    setSuccess(null);
    if (!validAlpha(draft)) { setError('Enter an alpha greater than 0 and at most 1.'); return; }
    busy.current = true;
    setSaving(true);
    try {
      // Tenant and updater identity are supplied exclusively by the authenticated backend.
      const { data } = await api.put('/forecasting/settings', { ses_alpha: Number(draft) });
      const value = readAlpha(data);
      if (!mounted.current) return;
      setAlpha(value);
      setDraft(String(value));
      setEditing(false);
      setSuccess('Agency SES alpha saved. Refreshing forecasts…');
      try {
        await onSaved();
        if (mounted.current) setSuccess('Agency SES alpha saved. Forecast refresh completed.');
      } catch {
        if (mounted.current) setSuccess('Agency SES alpha saved, but forecasts could not be refreshed. Use Refresh Data to retry.');
      }
    } catch (err) {
      if (mounted.current) setError(settingsError(err));
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  return (
    <section aria-labelledby="forecast-configuration" className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
      <h3 id="forecast-configuration" className="font-bold text-slate-900 text-lg">Forecasting Configuration</h3>
      <div className="border-t border-slate-200 pt-5 space-y-3">
        <h4 className="font-bold text-slate-900 text-sm">Agency SES Settings</h4>
        <p className="text-xs text-slate-500 max-w-2xl">Alpha controls how strongly new observations influence future SES learning across your agency. Higher values give recent observations more weight. Changing alpha preserves existing forecasts, observation counts, and stored history.</p>
        <p className="text-sm text-slate-700">Current agency SES alpha: <strong className="font-mono text-sky-700">{loading ? 'Loading…' : alpha ?? 'Unavailable'}</strong></p>
        {editing && canEdit ? (
          <form onSubmit={save} noValidate className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="agency-ses-alpha" className="block text-xs text-slate-600 mb-1">SES alpha (0 &lt; alpha ≤ 1)</label>
              <input id="agency-ses-alpha" type="number" min="0" max="1" step="any" required value={draft}
                disabled={saving || loading} aria-describedby="agency-ses-alpha-help" aria-invalid={!!error}
                onChange={(event) => { setDraft(event.target.value); setError(null); }}
                className="w-44 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60" />
            </div>
            <button type="submit" disabled={saving || loading} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50">
              {saving && <RefreshCw size={12} className="animate-spin" />}{saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" disabled={saving || loading} onClick={() => { setDraft(String(alpha)); setEditing(false); setError(null); }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          </form>
        ) : canEdit && <button type="button" disabled={loading || saving || alpha == null} onClick={() => { setDraft(String(alpha)); setEditing(true); setError(null); setSuccess(null); }}
          className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50">Edit Alpha</button>}
        <p id="agency-ses-alpha-help" className="text-xs text-slate-500">Agency Managers can update this setting for future learning.</p>
        {error && <div role="alert" className="text-xs text-rose-700 space-y-2"><p>{error}</p>
          <button type="button" disabled={saving || loading} onClick={() => void load()} className="font-semibold underline disabled:opacity-50">Reload Settings</button></div>}
        {success && <p role="status" className="text-xs text-emerald-700">{success}</p>}
      </div>
    </section>
  );
}
