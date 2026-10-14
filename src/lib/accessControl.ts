import { UserRole, ViewType } from '../app/types';

/**
 * Modules strictly reserved for Management and Super Admin.
 * Even if manually entered into the browser address bar, access will be blocked.
 */
export const MANAGEMENT_EXCLUSIVE_VIEWS: ViewType[] = [
  'evaluation',
  'forecast',
  'history',
  'reports',
  'users',
  'manager',
];

/**
 * Universal modules accessible to all authenticated tenant staff.
 */
export const UNIVERSAL_VIEWS: ViewType[] = [
  'dashboard',
  'applicants',
  'profile',
];

/**
 * Default static role mappings for workflow and agency operations.
 * Applied when dynamic permissions have not overridden the module access.
 */
export const STATIC_VIEW_ROLES: Partial<Record<ViewType, UserRole[]>> = {
  registration: ['Recruitment'],
  screening: ['Recruitment'],
  profiling: ['Recruitment', 'Admin'],
  cv: ['Recruitment'],
  endorsement: ['Recruitment', 'Admin'],
  fittowork: ['Admin'],
  ocr: ['Admin'],
  alerts: ['Admin'],
  requirements: ['Admin'],
  joborders: ['Admin'],
  employers: ['Admin'],
  expense: ['Accounting'],
  'accounting-settings': ['Accounting'],
};

/**
 * Authoritative client-side permission checker.
 * Used by both Sidebar (navigation visibility) and AppShell (route guard & URL manipulation barrier).
 *
 * @param view The target ViewType requested (e.g. 'users', 'ocr', 'expense')
 * @param userRoles List of active roles assigned to the current user
 * @param isSuperAdmin Whether the user possesses verified Super Admin privileges
 * @param workflowPermissions Optional dynamic module access mapping loaded from DB
 * @returns boolean True if authorized, False if access must be denied
 */
export function hasAccessToView(
  view: ViewType,
  userRoles: UserRole[],
  isSuperAdmin?: boolean,
  workflowPermissions?: Record<string, UserRole[]>
): boolean {
  // 1. Super Admin has unrestricted access across all modules
  if (isSuperAdmin) return true;

  // 2. Management role has universal access to all agency operations & oversight
  if (userRoles.includes('Management')) return true;

  // 3. Universal modules accessible to all authenticated staff
  if (UNIVERSAL_VIEWS.includes(view)) return true;

  // 4. Strict Management-only modules (cannot be accessed by non-Management roles)
  if (MANAGEMENT_EXCLUSIVE_VIEWS.includes(view)) {
    return false;
  }

  // 5. Dynamic database-driven workflow module permissions (from workflow_module_access table)
  if (workflowPermissions && workflowPermissions[view]) {
    const allowedRoles = workflowPermissions[view];
    if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
      return allowedRoles.some((r) => userRoles.includes(r));
    }
  }

  // 6. Default static fallback role permissions
  const staticAllowed = STATIC_VIEW_ROLES[view];
  if (staticAllowed && staticAllowed.length > 0) {
    return staticAllowed.some((r) => userRoles.includes(r));
  }

  return false;
}
