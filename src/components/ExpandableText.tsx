import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { LinkifiedText } from './LinkifiedText';

const DEFAULT_THRESHOLD = 180;
const DEFAULT_COLLAPSED_LINES = 4;

function lineClampClass(lines: number): string {
  if (lines <= 2) return 'line-clamp-2';
  if (lines === 3) return 'line-clamp-3';
  if (lines === 4) return 'line-clamp-4';
  if (lines === 5) return 'line-clamp-5';
  if (lines === 6) return 'line-clamp-6';
  return 'line-clamp-4';
}

function isLongText(text: string, threshold: number, collapsedLines: number): boolean {
  return text.length > threshold || text.split('\n').length > collapsedLines;
}

interface ExpandableTextProps {
  text: string;
  className?: string;
  /** Кастомный рендер (например, DecidedNotesDisplay). Длина берётся из `text`. */
  children?: ReactNode;
  threshold?: number;
  collapsedLines?: number;
}

export function ExpandableText({
  text,
  className = '',
  children,
  threshold = DEFAULT_THRESHOLD,
  collapsedLines = DEFAULT_COLLAPSED_LINES,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const long = isLongText(text, threshold, collapsedLines);
  const clamp = lineClampClass(collapsedLines);

  if (!long) {
    if (children) {
      return <div className={className}>{children}</div>;
    }
    return <LinkifiedText text={text} className={className} as="div" />;
  }

  return (
    <div className="space-y-1">
      <div className={expanded ? className : `${className} ${clamp}`}>
        {children ?? <LinkifiedText text={text} className="text-inherit" as="div" />}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="inline-flex items-center gap-1 text-xs font-medium text-gold-light transition-colors hover:text-gold"
      >
        <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        {expanded ? 'Свернуть' : 'Развернуть'}
      </button>
    </div>
  );
}
