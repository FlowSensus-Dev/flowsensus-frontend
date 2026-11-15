import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('./api', () => ({ api: { post: h.post } }));
import { logoUploadError, uploadAgencyLogo } from './agencyLogo';

const logo = () => new File(['image'], 'agency.webp', { type: 'image/webp' });
describe('dedicated authenticated logo upload contract (no live requests)', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it('sends exactly one multipart file request and requires confirmed persistence', async () => {
    h.post.mockResolvedValueOnce({ status: 200, data: { agency_id: 83, logo_url: 'https://storage.example.test/logo.webp' } });
    expect(await uploadAgencyLogo(83, logo())).toBe('https://storage.example.test/logo.webp');
    expect(h.post).toHaveBeenCalledOnce();
    const [url, body, config] = h.post.mock.calls[0];
    expect(url).toBe('/agency-workspaces/83/logo'); expect(body).toBeInstanceOf(FormData);
    expect(Array.from(body.keys())).toEqual(['file']); expect(body.get('file').name).toBe('agency.webp');
    expect(config).toEqual({ headers: { 'Content-Type': undefined } });
  });
  it('removes the JSON default without serializing FormData or fixing a multipart boundary', async () => {
    const client = axios.create({ headers: { 'Content-Type': 'application/json' } });
    let outgoing: any;
    h.post.mockImplementation((url, data, config) => client.post(url, data, { ...config, adapter: async (request) => {
      outgoing = request;
      return { data: { agency_id: 83, logo_url: 'https://storage.example.test/logo.webp' }, status: 200, statusText: 'OK', headers: {}, config: request };
    } }));
    await uploadAgencyLogo(83, logo());
    expect(outgoing.data).toBeInstanceOf(FormData);
    expect(outgoing.headers.get('Content-Type')).not.toContain('application/json');
    expect(outgoing.headers.get('Content-Type')).not.toContain('boundary=');
  });
  it.each([
    { status: 202, data: { agency_id: 83, logo_url: 'https://storage.example.test/logo' } },
    { status: 200, data: { agency_id: 99, logo_url: 'https://storage.example.test/logo' } },
    { status: 200, data: { agency_id: 83 } },
    { status: 200, data: { agency_id: 83, logo_url: 'javascript:alert(1)' } },
  ])('rejects unconfirmed response $status without retrying', async (response) => {
    h.post.mockResolvedValueOnce(response);
    await expect(uploadAgencyLogo(83, logo())).rejects.toThrow('could not be confirmed');
    expect(h.post).toHaveBeenCalledOnce();
  });
  it('validates before upload and never retries uncertain network outcomes', async () => {
    await expect(uploadAgencyLogo(83, new File(['svg'], 'logo.svg', { type: 'image/svg+xml' }))).rejects.toThrow('PNG');
    expect(h.post).not.toHaveBeenCalled();
    h.post.mockRejectedValueOnce(new Error('network'));
    await expect(uploadAgencyLogo(83, logo())).rejects.toThrow('network'); expect(h.post).toHaveBeenCalledOnce();
    expect(logoUploadError(new Error('secret'))).toContain('Refresh agency records');
    expect(logoUploadError({ response: { status: 403, data: { detail: 'secret' } } })).not.toContain('secret');
  });
});
