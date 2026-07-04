import { useMemo } from 'react';
import { parseDisplaySegments } from '../utils/decidedNotesMentions';
import { useDesign } from '../store/DesignContext';

export function DecidedNotesDisplay({ text, className = '' }: { text: string; className?: string }) {
  const { isZen } = useDesign();
  const segments = useMemo(() => parseDisplaySegments(text), [text]);
  const mentionClass = isZen
    ? 'rounded bg-foreground/10 px-1 font-medium text-foreground'
    : 'rounded bg-gold/25 px-1 font-medium text-gold-light';

  return (
    <span className={className}>
      {segments.map((segment, index) =>
        segment.type === 'mention' ? (
          <span key={index} className={mentionClass}>
            {segment.label}
          </span>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
    </span>
  );
}
