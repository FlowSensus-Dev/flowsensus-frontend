import { api } from './api';
import { safeLogoUrl, validateAgencyLogo } from './agencyBranding';

export const PROVISION_LOGO_WARNING = 'Agency created successfully, but logo upload failed. You can retry it in Tenant Management.';

export async function uploadAgencyLogo(agencyId: number, file: File): Promise<string> {
  validateAgencyLogo(file);
  const body = new FormData();
  body.append('file', file);
  // Remove the helper's JSON default so the browser supplies the multipart boundary.
  const response = await api.post(`/agency-workspaces/${agencyId}/logo`, body, {
    headers: { 'Content-Type': undefined },
  });
  const logoUrl = safeLogoUrl(response.data?.logo_url);
  if (![200, 201].includes(response.status) || response.data?.agency_id !== agencyId || !logoUrl) {
    throw new Error('Logo persistence could not be confirmed.');
  }
  return logoUrl;
}

export function logoUploadError(error: any): string {
  switch (error?.response?.status) {
    case 401: return 'Your session has expired. Sign in again before uploading the logo.';
    case 403: return 'The backend denied the logo upload. Verified Super Admin privileges are required.';
    case 413: return 'The backend rejected the image size. Choose an image of 2 MiB or smaller.';
    case 415: case 422: return 'The backend rejected the image. Choose a valid PNG, JPEG, or WEBP image of 2 MiB or smaller.';
    case 404: case 405: return 'Logo upload is unavailable for this agency. Verify that the backend supports the logo endpoint.';
    default: return 'Logo upload could not be confirmed. Refresh agency records to inspect the saved logo before explicitly retrying.';
  }
}
