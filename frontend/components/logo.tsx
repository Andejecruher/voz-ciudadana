import { cn } from '@/lib/utils';

// --------------------------------------------------------------------------
// VozCiudadana brand mark — guinda #711B2C with white inner shapes
// Icon-only variant: just the shield badge
// Horizontal variant: icon + logotype wordmark
// --------------------------------------------------------------------------

interface LogoIconProps {
  className?: string;
  /** Fill override — defaults to brand guinda */
  color?: string;
}

export function LogoIcon({ className, color = '#711B2C' }: LogoIconProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('w-8 h-8', className)}
      aria-hidden="true"
    >
      {/* Shield body */}
      <path d="M20 3L5 9v11c0 8.5 6.4 16.4 15 18.4C28.6 36.4 35 28.5 35 20V9L20 3Z" fill={color} />
      {/* Inner microphone / voice wave — white */}
      <rect x="18" y="11" width="4" height="9" rx="2" fill="white" />
      <path
        d="M14.5 18.5a5.5 5.5 0 0 0 11 0"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <line
        x1="20"
        y1="24"
        x2="20"
        y2="27"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <line
        x1="17"
        y1="27"
        x2="23"
        y2="27"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface LogoHorizontalProps {
  /** dark — guinda icon + dark text (use on white backgrounds) */
  /** light — white icon + white text (use on dark/guinda backgrounds) */
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
      <LogoIcon color={isDark ? '#711B2C' : 'white'} className="w-9 h-9 flex-shrink-0" />
      <div className="flex flex-col leading-none">
        <span
          className="font-black text-[17px] tracking-tight"
          style={{ color: isDark ? '#711B2C' : 'white' }}
        >
          Voz Ciudadana
        </span>
        {showTagline && (
          <span
            className="text-[9.5px] font-semibold uppercase tracking-widest mt-0.5"
            style={{ color: isDark ? '#475569' : 'rgba(255,255,255,0.65)' }}
          >
            Cintalapa de Figueroa, Chiapas
          </span>
        )}
      </div>
    </div>
  );
}
