type AppLogoSize = 'sm' | 'md' | 'lg';
type AppLogoVariant = 'default' | 'zen';

const sizeClasses: Record<AppLogoSize, string> = {
  sm: 'h-9 w-9 text-sm',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

const variantClasses: Record<AppLogoVariant, string> = {
  default: 'border-border bg-surface text-foreground',
  zen: 'border-border/80 bg-white text-foreground shadow-sm',
};

type AppLogoProps = {
  size?: AppLogoSize;
  variant?: AppLogoVariant;
  className?: string;
  showLabel?: boolean;
  labelClassName?: string;
};

export function AppLogo({
  size = 'sm',
  variant = 'default',
  className = '',
  showLabel = false,
  labelClassName = 'text-lg font-semibold tracking-tight',
}: AppLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span
        className={`flex shrink-0 items-center justify-center rounded-full border font-bold ${variantClasses[variant]} ${sizeClasses[size]}`}
        aria-hidden
      >
        Р
      </span>
      {showLabel ? <span className={labelClassName}>Репетиции</span> : null}
    </div>
  );
}
