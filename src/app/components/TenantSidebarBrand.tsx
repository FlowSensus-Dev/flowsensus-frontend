import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { AgencyAvatar } from './AgencyBrandingControls';
import Logo from './Logo';

export default function TenantSidebarBrand() {
  const [agency, setAgency] = useState<{ agency_name: string; logo_url?: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.get('/lookups/agency').then(({ data }) => {
      if (!cancelled && typeof data?.agency_name === 'string' && data.agency_name.trim()) {
        setAgency({ agency_name: data.agency_name.trim(), logo_url: data.logo_url });
      }
    }).catch(() => { /* Keep the FlowSensus fallback if tenant branding is unavailable. */ });
    return () => { cancelled = true; };
  }, []);
  return <div className="flex items-center gap-3 min-w-0">
    {agency ? <AgencyAvatar logoUrl={agency.logo_url} name={agency.agency_name} /> : <Logo size="small" />}
    <span title={agency?.agency_name || 'FLOWSENSUS'} className="font-extrabold text-white text-lg leading-none truncate">
      {agency?.agency_name || 'FLOWSENSUS'}
    </span>
  </div>;
}
