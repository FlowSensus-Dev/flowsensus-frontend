/** Only Auth app_metadata can identify a platform administrator. Display roles and email cannot. */
export function isPlatformSuperAdmin(user: { app_metadata?: Record<string, unknown> } | null | undefined): boolean {
  return user?.app_metadata?.is_super_admin === true;
}
