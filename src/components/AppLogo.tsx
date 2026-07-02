type AppLogoSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<AppLogoSize, string> = {
  sm: 'h-9 w-9 text-sm',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

type AppLogoProps = {
  size?: AppLogoSize;
  className?: string;
  showLabel?: boolean;
  labelClassName?: string;
};

export function AppLogo({
  size = 'sm',
  className = '',
  showLabel = false,
  labelClassName = 'text-lg font-semibold tracking-tight',
}: AppLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span
        className={`flex shrink-0 items-center justify-center rounded-full border border-border bg-surface font-bold text-foreground ${sizeClasses[size]}`}
        aria-hidden
      >
        Р
      </span>
      {showLabel ? <span className={labelClassName}>Репетиции</span> : null}
    </div>
  );
}
