import { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { ACCENT_PRESETS, DEFAULT_AGENCY_THEME, LOGO_ACCEPT, normalizeThemeColor, safeLogoUrl, validateAgencyLogo } from '../../lib/agencyBranding';

export interface LogoSelection { file: File | null; error: string | null }
export const EMPTY_LOGO: LogoSelection = { file: null, error: null };

export function AgencyLogoPicker({ id, selection, onChange, currentLogoUrl }: {
  id: string; selection: LogoSelection; onChange: (value: LogoSelection) => void; currentLogoUrl?: string | null;
}) {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  useEffect(() => {
    if (!selection.file) { setPreview(null); return; }
    const url = URL.createObjectURL(selection.file);
    setPreview({ file: selection.file, url });
    return () => URL.revokeObjectURL(url);
  }, [selection.file]);
  return <div>
    <label htmlFor={id} className="block text-xs font-bold text-slate-600 mb-1.5">Agency Logo</label>
    <div className={`relative flex min-w-0 items-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-600 focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-500 ${selection.error ? 'border-red-300' : 'border-slate-200'}`}>
      <Upload size={16} aria-hidden="true" className="shrink-0 text-slate-400" />
      <span id={`${id}-selection`} aria-live="polite" title={selection.file?.name} className="min-w-0 flex-1 truncate">{selection.file?.name || 'Choose image'}</span>
      <span aria-hidden="true" className="shrink-0 text-xs font-semibold text-sky-700">Browse</span>
      <input id={id} type="file" accept={LOGO_ACCEPT} aria-describedby={`${id}-help ${id}-selection ${id}-error`}
        aria-invalid={!!selection.error} className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.target.value = '';
          if (!file) return;
          try { validateAgencyLogo(file); onChange({ file, error: null }); }
          catch (error) { onChange({ file: null, error: (error as Error).message }); }
        }} />
    </div>
    <p id={`${id}-help`} className="mt-1.5 text-xs text-slate-500">Optional. PNG, JPEG, or WEBP; maximum 2 MiB. {currentLogoUrl ? 'Selecting a file replaces the saved logo after upload is confirmed.' : ''}</p>
    {selection.file && <div className="mt-3 flex flex-wrap items-center gap-3">
      {preview?.file === selection.file && <img src={preview.url} alt="Selected agency logo preview" className="h-16 w-16 rounded-lg border border-slate-200 object-contain"
        onError={() => onChange({ file: null, error: 'The selected image could not be previewed. Choose another PNG, JPEG, or WEBP image.' })} />}
    </div>}
    {(selection.file || selection.error) && <button type="button" onClick={() => onChange(EMPTY_LOGO)} className="mt-2 text-xs font-bold text-sky-700 underline">Clear selected logo</button>}
    <p id={`${id}-error`} role={selection.error ? 'alert' : undefined} className="mt-1 text-xs text-red-700">{selection.error}</p>
  </div>;
}

export function AgencyThemeControl({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  let color = DEFAULT_AGENCY_THEME;
  try { color = normalizeThemeColor(value); } catch { /* Validation runs on save. */ }
  return <div>
    <label htmlFor={id} className="block text-xs font-bold text-slate-600 mb-1.5">Agency Theme Color</label>
    <div className="flex flex-wrap items-center gap-2">
      {ACCENT_PRESETS.map((preset) => <button key={preset.value} type="button" title={preset.name}
        aria-label={`Agency theme ${preset.name}`} aria-pressed={color === preset.value}
        onClick={() => onChange(preset.value)} className="h-7 w-7 rounded-full border-2 border-slate-300"
        style={{ backgroundColor: preset.value, outline: color === preset.value ? '2px solid #475569' : undefined }} />)}
      <input id={id} type="color" value={color} onChange={(event) => onChange(event.target.value.toUpperCase())} className="h-9 w-12 cursor-pointer" />
      <span className="font-mono text-xs text-slate-600">{color}</span>
    </div>
    <p className="mt-1.5 text-xs text-slate-500">Optional. Defaults to {DEFAULT_AGENCY_THEME}.</p>
  </div>;
}

export function AgencyAvatar({ logoUrl, name, fallback }: { logoUrl?: string | null; name: string; fallback?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = safeLogoUrl(logoUrl);
  return <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-center font-bold text-slate-700 flex-shrink-0 text-xs overflow-hidden">
    {url && failedUrl !== url
      ? <img src={url} alt={`${name} logo`} className="h-full w-full object-contain" onError={() => setFailedUrl(url)} />
      : <span aria-label={`${name} logo unavailable`}>{fallback || name.slice(0, 2).toUpperCase() || 'AG'}</span>}
  </div>;
}
