import { describe, expect, it } from 'vitest';
import { DEFAULT_AGENCY_THEME, isISODate, licenseExpiryStatus, manilaToday, minimumLicenseExpiry, normalizeThemeColor, safeLogoUrl, validateAgencyLogo, validateLicenseExpiry } from './agencyBranding';

const now = new Date('2026-11-07T16:30:00Z'); // Already November 8 in Manila.

describe('agency branding validation', () => {
  it('uses the Manila calendar date across the UTC midnight boundary', () => {
    expect(manilaToday(now)).toBe('2026-11-08');
    expect(manilaToday(new Date('2026-11-07T15:59:59Z'))).toBe('2026-11-07');
    expect(minimumLicenseExpiry(now)).toBe('2026-11-09');
    expect(minimumLicenseExpiry(new Date('2026-12-31T16:00:00Z'))).toBe('2027-01-02');
  });
  it.each(['', '2026-11-07', '2026-11-08', '2026-02-30', '2026-13-01', '11/09/2026', '2026-11-09T00:00:00Z', '0000-01-01'])('rejects missing, expired, or malformed date %s', (value) => {
    expect(() => validateLicenseExpiry(value, now)).toThrow();
  });
  it('preserves date-only ISO strings including leap days without shifting the selected day', () => {
    expect(validateLicenseExpiry('2026-11-09', now)).toBe('2026-11-09');
    expect(validateLicenseExpiry('2028-02-29', now)).toBe('2028-02-29');
    expect(isISODate('2027-02-29')).toBe(false);
    expect(isISODate(null)).toBe(false);
  });
  it('shows missing legacy dates neutrally and uses a 30-day expiring-soon window', () => {
    expect(licenseExpiryStatus(null, now)).toBe('Not recorded');
    expect(licenseExpiryStatus('', now)).toBe('Not recorded');
    expect(licenseExpiryStatus('invalid', now)).toBe('Date unavailable');
    expect(licenseExpiryStatus('2026-11-08', now)).toBe('Expired');
    expect(licenseExpiryStatus('2026-12-08', now)).toBe('Expiring Soon');
    expect(licenseExpiryStatus('2026-12-09', now)).toBe('Valid');
  });
  it('defaults and normalizes six-digit hex colors', () => {
    for (const value of [null, undefined, '', ' ']) expect(normalizeThemeColor(value)).toBe(DEFAULT_AGENCY_THEME);
    expect(normalizeThemeColor(' #aabbcc ')).toBe('#AABBCC');
    for (const value of ['red', '#fff', '#11223344', '112233', '#gg0000']) expect(() => normalizeThemeColor(value)).toThrow('six-digit');
  });
  it('allows only supported, nonempty images up to exactly 2 MiB', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(() => validateAgencyLogo(new File(['image'], 'logo', { type }))).not.toThrow();
    }
    expect(() => validateAgencyLogo(new File([new Uint8Array(2 * 1024 * 1024)], 'logo.png', { type: 'image/png' }))).not.toThrow();
    expect(() => validateAgencyLogo(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'logo.png', { type: 'image/png' }))).toThrow('2 MiB');
    expect(() => validateAgencyLogo(new File(['image'], 'logo.svg', { type: 'image/svg+xml' }))).toThrow('PNG, JPEG, or WEBP');
    expect(() => validateAgencyLogo(new File([], 'logo.png', { type: 'image/png' }))).toThrow('non-empty');
  });
  it('renders only safe HTTP logo URLs', () => {
    expect(safeLogoUrl('https://storage.example.test/logo.png')).toBe('https://storage.example.test/logo.png');
    for (const value of [null, '', 'javascript:alert(1)', 'data:image/svg+xml,test', 'https://user:secret@example.test/logo']) expect(safeLogoUrl(value)).toBeUndefined();
  });
});
