/**
 * Enterprise Secure Password Policy
 * 
 * Enforces:
 * - Minimum length: 8–12 characters (minimum 8 enforced, recommended 12)
 * - Uppercase letter [A-Z]
 * - Lowercase letter [a-z]
 * - Number [0-9]
 * - Special character [!@#$%^&*()_+-=[]{};':"|,.<>/?]
 * - Blacklist of common weak passwords
 */

export const COMMON_WEAK_PASSWORDS = new Set([
  'password',
  'password123',
  'password1234',
  '123456',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty',
  'qwerty123',
  'admin',
  'admin123',
  'administrator',
  'letmein',
  'welcome',
  'welcome123',
  'flowsensus',
  'flowsensus123',
  'recruitment',
  'recruitment123',
  'iloveyou',
  'monkey',
  'dragon',
  'sunshine',
  'princess',
  'football',
  'charlie',
  'master',
]);

export interface PasswordPolicyCheck {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  notCommon: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  checks: PasswordPolicyCheck;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const p = password || '';
  
  const checks: PasswordPolicyCheck = {
    minLength: p.length >= 8,
    hasUpper: /[A-Z]/.test(p),
    hasLower: /[a-z]/.test(p),
    hasNumber: /[0-9]/.test(p),
    hasSpecial: /[^A-Za-z0-9]/.test(p),
    notCommon: !COMMON_WEAK_PASSWORDS.has(p.toLowerCase().trim()),
  };

  const errors: string[] = [];
  if (!checks.minLength) errors.push('Password must be at least 8 characters long.');
  if (!checks.hasUpper) errors.push('Include at least one uppercase letter (A–Z).');
  if (!checks.hasLower) errors.push('Include at least one lowercase letter (a–z).');
  if (!checks.hasNumber) errors.push('Include at least one number (0–9).');
  if (!checks.hasSpecial) errors.push('Include at least one special character (!@#$%^&*...).');
  if (!checks.notCommon) errors.push('This password is too common or easily guessable.');

  const isValid = Object.values(checks).every(Boolean);

  return { isValid, checks, errors };
}
