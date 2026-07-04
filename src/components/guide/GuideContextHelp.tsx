import { Link } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { appPaths } from '../../navigation/appPaths';
import { useDesign } from '../../store/DesignContext';

interface GuideContextHelpProps {
  anchor: string;
  label?: string;
}

export function GuideContextHelp({ anchor, label = 'Справка по разделу' }: GuideContextHelpProps) {
  const { isZen } = useDesign();
  const href = `${appPaths.guide}#${anchor}`;

  return (
    <Link
      to={href}
      title={label}
      aria-label={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
        isZen
          ? 'h-7 w-7 border-border/70 text-muted hover:border-foreground/30 hover:text-foreground focus-visible:outline-foreground/40'
          : 'h-7 w-7 border-gold/25 text-gold-light/80 hover:border-gold/45 hover:bg-gold/10 hover:text-gold-light focus-visible:outline-gold/50'
      }`}
    >
      <HelpCircle size={15} aria-hidden />
    </Link>
  );
}
