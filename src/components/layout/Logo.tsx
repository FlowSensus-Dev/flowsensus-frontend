import logoImage from '../../assets/FLOWSENSUS_LOGO.png';

export default function Logo({ size = 'default' }: { size?: 'small' | 'default' | 'large' }) {
  const dimensions = {
    small: { width: 32, height: 32 },
    default: { width: 48, height: 48 },
    large: { width: 64, height: 64 },
  };

  const { width, height } = dimensions[size];

  return (
    <img
      src={logoImage}
      alt="FlowSensus Logo"
      width={width}
      height={height}
      className="flex-shrink-0 object-contain"
    />
  );
}

export function LogoWithText({ size = 'default' }: { size?: 'small' | 'default' | 'large' }) {
  const textSizes = {
    small: 'text-base',
    default: 'text-xl',
    large: 'text-3xl',
  };

  return (
    <div className="flex items-center gap-3">
      <Logo size={size} />
      <span className={`${textSizes[size]} font-black text-[#0F172A] tracking-tight leading-none`}>
        FLOWSENSUS
      </span>
    </div>
  );
}
