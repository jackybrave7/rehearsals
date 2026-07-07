import { useMemo } from 'react';
import { linkifyText } from '../utils/linkifyText';

interface LinkifiedTextProps {
  text: string;
  className?: string;
  as?: 'p' | 'span' | 'div';
}

export function LinkifiedText({ text, className = '', as: Tag = 'p' }: LinkifiedTextProps) {
  const segments = useMemo(() => linkifyText(text), [text]);

  return (
    <Tag className={`whitespace-pre-wrap ${className}`.trim()}>
      {segments.map((segment, index) =>
        segment.type === 'url' && segment.href ? (
          <a
            key={index}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold-light underline decoration-gold/40 underline-offset-2 hover:text-gold"
            title={segment.text}
          >
            {segment.label}
          </a>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
    </Tag>
  );
}
