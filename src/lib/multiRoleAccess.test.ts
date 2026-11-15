import { describe, it, expect } from 'vitest';
import { extractAndNormalizeRoles, normalizeRole, hasAccessToView } from './accessControl';
import { UserRole } from '../app/types';

describe('extractAndNormalizeRoles & normalizeRole', () => {
  it('correctly normalizes lowercase and mixed-case roles', () => {
    expect(normalizeRole('admin')).toBe('Admin');
    expect(normalizeRole('ADMIN')).toBe('Admin');
    expect(normalizeRole('accounting')).toBe('Accounting');
    expect(normalizeRole('management')).toBe('Management');
    expect(normalizeRole('recruitment')).toBe('Recruitment');
    expect(normalizeRole('applicant')).toBe('Applicant');
    expect(normalizeRole('employer')).toBe('Employer');
    expect(normalizeRole('unknown_role')).toBe(null);
    expect(normalizeRole(null)).toBe(null);
    expect(normalizeRole(undefined)).toBe(null);
  });

  it('handles comma-separated strings of roles', () => {
    const roles = extractAndNormalizeRoles('admin, accounting, management, recruitment');
    expect(roles).toEqual(['Admin', 'Accounting', 'Management', 'Recruitment']);
  });

  it('handles arrays of lowercase roles and deduplicates them', () => {
    const roles = extractAndNormalizeRoles(['admin', 'accounting', 'management', 'recruitment', 'admin']);
    expect(roles).toEqual(['Admin', 'Accounting', 'Management', 'Recruitment']);
  });

  it('handles multiple mixed sources simultaneously', () => {
    const userMetaRoles = ['recruitment'];
    const userMetaRole = 'accounting';
    const appMetaRoles = ['admin', 'management'];
    const roles = extractAndNormalizeRoles(userMetaRoles, userMetaRole, appMetaRoles);
    expect(roles).toEqual(['Recruitment', 'Accounting', 'Admin', 'Management']);
  });

  it('preserves access in hasAccessToView with lowercase roles', () => {
    const userRoles: UserRole[] = ['admin' as any, 'accounting' as any];
    // Admin has access to fittowork
    expect(hasAccessToView('fittowork', userRoles)).toBe(true);
    // Accounting has access to expense
    expect(hasAccessToView('expense', userRoles)).toBe(true);
    // Neither has management exclusive access
    expect(hasAccessToView('users', userRoles)).toBe(false);

    // If management is added in lowercase
    const withMgmt: UserRole[] = ['admin' as any, 'management' as any];
    expect(hasAccessToView('users', withMgmt)).toBe(true);
  });
});

