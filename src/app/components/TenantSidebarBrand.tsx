import Logo from './Logo';

// Tenant navigation identifies the application; agency branding remains in agency surfaces.
export default function TenantSidebarBrand({ compact = false }: { compact?: boolean } = {}) {
  return <div className="flex items-center gap-3 min-w-0">
    <Logo size="small" />
    <span title="FLOWSENSUS" className={compact ? 'sr-only' : 'font-extrabold text-white text-lg tracking-wider leading-none truncate'}>
      FLOWSENSUS
    </span>
  </div>;
}
