import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import glossaryData from '../../content/guideGlossary.json';
import { useDesign } from '../../store/DesignContext';

export interface GlossaryEntry {
  term: string;
  definition: string;
  synonyms: string[];
}

const glossary = glossaryData as GlossaryEntry[];

const termMap = new Map<string, GlossaryEntry>();
for (const entry of glossary) {
  termMap.set(entry.term.toLowerCase(), entry);
  for (const synonym of entry.synonyms) {
    termMap.set(synonym.toLowerCase(), entry);
  }
}

export function lookupGlossaryTerm(token: string): GlossaryEntry | undefined {
  return termMap.get(token.toLowerCase());
}

export { glossary };

interface GuideGlossaryTermProps {
  term: string;
  highlightQuery?: string;
}

export function GuideGlossaryTerm({ term, highlightQuery }: GuideGlossaryTermProps) {
  const entry = lookupGlossaryTerm(term) ?? { term, definition: '', synonyms: [] };
  const { isZen } = useDesign();
  const popoverId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const displayTerm = highlightQuery ? highlightInline(term, highlightQuery) : term;

  if (!entry.definition) {
    return <span>{displayTerm}</span>;
  }

  return (
    <span ref={rootRef} className="relative inline">
      <button
        type="button"
        className={`cursor-help border-b border-dotted underline-offset-2 ${
          isZen
            ? 'border-foreground/40 text-foreground hover:border-foreground/70'
            : 'border-gold-light/50 text-gold-light hover:border-gold-light'
        }`}
        aria-describedby={open ? popoverId : undefined}
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={() => {
          if (window.matchMedia('(hover: hover)').matches) setOpen(true);
        }}
        onMouseLeave={() => {
          if (window.matchMedia('(hover: hover)').matches) setOpen(false);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          if (!rootRef.current?.contains(event.relatedTarget as Node)) setOpen(false);
        }}
      >
        {displayTerm}
      </button>
      {open && (
        <span
          id={popoverId}
          role="tooltip"
          className={`absolute bottom-full left-1/2 z-40 mb-2 w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border px-3 py-2 text-left text-xs leading-relaxed shadow-lg ${
            isZen
              ? 'border-border/70 bg-white text-foreground shadow-black/10'
              : 'border-gold/20 bg-surface text-foreground shadow-black/40'
          }`}
        >
          <span className="mb-1 block font-semibold">{entry.term}</span>
          {entry.definition}
          <button
            type="button"
            className="mt-2 block text-[11px] text-muted underline"
            onClick={() => setOpen(false)}
          >
            Закрыть
          </button>
        </span>
      )}
    </span>
  );
}

export function highlightInline(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const index = lower.indexOf(q);
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-amber-400/25 px-0.5 text-inherit">{text.slice(index, index + q.length)}</mark>
      {text.slice(index + q.length)}
    </>
  );
}

export function formatGuideInline(text: string, highlightQuery?: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\{\{[^}]+\}\}|\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const chunk = text.slice(lastIndex, match.index);
      parts.push(highlightQuery ? highlightInline(chunk, highlightQuery) : chunk);
    }
    const token = match[0];
    if (token.startsWith('{{') && token.endsWith('}}')) {
      const term = token.slice(2, -2);
      parts.push(<GuideGlossaryTerm key={match.index} term={term} highlightQuery={highlightQuery} />);
    } else if (token.startsWith('**')) {
      const inner = token.slice(2, -2);
      parts.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {highlightQuery ? highlightInline(inner, highlightQuery) : inner}
        </strong>
      );
    } else if (token.startsWith('`')) {
      parts.push(
        <code key={match.index} className="rounded bg-black/30 px-1.5 py-0.5 text-sm text-gold-light">
          {token.slice(1, -1)}
        </code>
      );
    } else {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        const linkLabel = highlightQuery ? highlightInline(label, highlightQuery) : label;
        if (href.startsWith('/') && !href.startsWith('//')) {
          parts.push(
            <Link key={match.index} to={href} className="text-gold-light underline-offset-2 hover:underline">
              {linkLabel}
            </Link>
          );
        } else {
          parts.push(
            <a
              key={match.index}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-light underline-offset-2 hover:underline"
            >
              {linkLabel}
            </a>
          );
        }
      }
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    const chunk = text.slice(lastIndex);
    parts.push(highlightQuery ? highlightInline(chunk, highlightQuery) : chunk);
  }

  return parts.length > 0 ? parts : [highlightQuery ? highlightInline(text, highlightQuery) : text];
}
