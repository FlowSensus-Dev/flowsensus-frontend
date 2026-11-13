import type { UserRole } from '../app/types';

export interface StaffProfile {
  user_id?: number | null;
  agency_id?: number | null;
  full_name?: string | null;
  email?: string | null;
  department_name?: string | null;
  department?: string | null;
  phone_number?: string | null;
  created_at?: string | null;
  role_names?: string[] | null;
}

// Exact aliases used by the existing staff role catalog/backend. Departments
// never enter this mapping. Unknown role labels remain visible, without access.
const ROLE_NAMES: Record<string, string> = {
  recruitment: 'Recruitment', 'recruitment officer': 'Recruitment',
  admin: 'Admin', 'agency admin': 'Admin', 'processing officer': 'Admin',
  accounting: 'Accounting', finance: 'Accounting', 'finance & accounting': 'Accounting',
  management: 'Management', manager: 'Management', 'executive management': 'Management',
};

export function normalizeSystemRoles(roles: unknown): string[] {
  if (!Array.isArray(roles)) return [];
  const result = new Map<string, string>();
  for (const value of roles) {
    if (typeof value !== 'string' || !value.trim()) continue;
    const label = value.trim();
    const normalized = ROLE_NAMES[label.toLowerCase()] || label;
    result.set(normalized.toLowerCase(), normalized);
  }
  return [...result.values()];
}

export function knownStaffRoles(roles: string[]): UserRole[] {
  return roles.filter((role) => ['Recruitment', 'Admin', 'Accounting', 'Management'].includes(role)) as UserRole[];
}
