import { cn } from '@/lib/utils';

interface LogoIconProps {
  className?: string;
  color?: string;
  accentColor?: string;
}

export function LogoIcon({ className, color = '#711B2C', accentColor = '#FFFFFF' }: LogoIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('w-8 h-8', className)}
      aria-hidden="true"
    >
      <rect x="4" y="4" width="56" height="56" rx="17" fill={color} />
      <path
        d="M32 15.5C22.8 15.5 15.4 22.1 15.4 30.3C15.4 35.9 18.8 40.8 23.8 43.4V51L31.2 45.9C31.5 45.9 31.8 45.9 32 45.9C41.2 45.9 48.6 39.3 48.6 31.1C48.6 22.1 41.2 15.5 32 15.5Z"
        fill={accentColor}
      />
      <path
        d="M25.2 31.6L30 36.3L38.7 26.9"
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="45" cy="18.2" r="2.6" fill={accentColor} opacity="0.85" />
    </svg>
  );
}

interface LogoHorizontalProps {
  variant?: 'dark' | 'light';
  className?: string;
  showTagline?: boolean;
}

export function LogoHorizontal({
  variant = 'dark',
  className,
  showTagline = true,
}: LogoHorizontalProps) {
  const isDark = variant === 'dark';

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoIcon
        className="w-10 h-10 shrink-0"
        color={isDark ? '#711B2C' : '#FFFFFF'}
        accentColor={isDark ? '#FFFFFF' : '#711B2C'}
      />

      <div className="flex flex-col leading-none">
        <span
          className="font-black text-[18px] tracking-tight"
          style={{ color: isDark ? '#711B2C' : '#FFFFFF' }}
        >
          Voz Ciudadana
        </span>
        {showTagline ? (
          <span
            className="mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.18em]"
            style={{ color: isDark ? '#475569' : 'rgba(255,255,255,0.82)' }}
          >
            Cintalapa de Figueroa
          </span>
        ) : null}
      </div>
    </div>
  );
}
