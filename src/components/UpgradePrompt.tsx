import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

interface UpgradePromptProps {
  title: string;
  description: string;
  compact?: boolean;
}

export function UpgradePrompt({ title, description, compact = false }: UpgradePromptProps) {
  return (
    <div
      className={`rounded-2xl border border-accent/25 bg-accent/5 ${
        compact ? 'px-4 py-3' : 'px-5 py-4'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`font-semibold text-foreground ${compact ? 'text-sm' : 'text-base'}`}>
            {title}
          </p>
          <p className={`mt-1 text-muted ${compact ? 'text-xs' : 'text-sm'}`}>{description}</p>
        </div>
        <Link
          to="/pricing"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background transition-colors hover:opacity-90"
        >
          <Sparkles size={14} />
          Pro
        </Link>
      </div>
    </div>
  );
}
