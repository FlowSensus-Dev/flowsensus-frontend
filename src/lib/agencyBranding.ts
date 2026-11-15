export const DEFAULT_AGENCY_THEME = '#0EA5E9';
export const ACCENT_PRESETS = [
  { name: 'Sky', value: '#0EA5E9' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Emerald', value: '#10B981' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Rose', value: '#F43F5E' },
  { name: 'Violet', value: '#8B5CF6' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Orange', value: '#F97316' },
];

export function normalizeThemeColor(value: string | null | undefined): string {
  const color = value?.trim() || DEFAULT_AGENCY_THEME;
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Use a six-digit hex Agency Theme Color, such as #0EA5E9.');
  return color.toUpperCase();
}

// Date-only values stay date-only. Never parse them in the browser's local timezone.
export function manilaToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function isISODate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateLicenseExpiry(value: string, now = new Date()): string {
  if (!value) throw new Error('Select a POEA / DMW License Expiry Date.');
  if (!isISODate(value)) throw new Error('Enter a valid POEA / DMW License Expiry Date in YYYY-MM-DD format.');
  if (value <= manilaToday(now)) throw new Error('POEA / DMW License Expiry Date must be later than today in Asia/Manila.');
  return value;
}

export function minimumLicenseExpiry(now = new Date()): string {
  return new Date(Date.parse(`${manilaToday(now)}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
}

export function licenseExpiryStatus(value: unknown, now = new Date()): string {
  if (value == null || value === '') return 'Not recorded';
  if (!isISODate(value)) return 'Date unavailable';
  const today = manilaToday(now);
  if (value <= today) return 'Expired';
  const days = (Date.parse(`${value}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000;
  return days <= 30 ? 'Expiring Soon' : 'Valid';
}

export const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp';
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export function validateAgencyLogo(file: File): void {
  if (!LOGO_ACCEPT.split(',').includes(file.type)) throw new Error('Choose a PNG, JPEG, or WEBP image.');
  if (file.size > MAX_LOGO_BYTES) throw new Error('Agency Logo must be 2 MiB or smaller.');
  if (file.size === 0) throw new Error('Choose a non-empty image file.');
}

export function safeLogoUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}
