import type { ReactNode } from 'react';

type CollapsibleOptionalSectionProps = {
  title?: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function CollapsibleOptionalSection({
  title = 'Дополнительно',
  hint,
  defaultOpen = false,
  children,
}: CollapsibleOptionalSectionProps) {
  return (
    <details
      open={defaultOpen}
      className="rounded-xl border border-gold/10 bg-background/20 p-4 [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="cursor-pointer list-none text-sm font-medium text-white after:ml-2 after:text-muted after:content-['▾'] open:after:content-['▴']">
        {title}
      </summary>
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
      <div className="mt-3 space-y-4">{children}</div>
    </details>
  );
}
