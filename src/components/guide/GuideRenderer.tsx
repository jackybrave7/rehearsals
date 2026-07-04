import { useEffect, useRef, type ReactNode } from 'react';
import { Link2 } from 'lucide-react';
import type { GuideBlock, GuideHeading } from '../../utils/guideParse';
import { formatGuideInline, glossary } from './GuideGlossaryTerm';
import { GuideMedia } from './GuideMedia';

interface GuideRendererProps {
  introBlocks: GuideBlock[];
  headings: GuideHeading[];
  highlightQuery?: string;
  openDetailsIds: Set<string>;
  onRegisterHeading?: (id: string, element: HTMLElement | null) => void;
  onCopyAnchor: (id: string) => void;
}

function renderBlocks(
  blocks: GuideBlock[],
  highlightQuery: string | undefined,
  openDetailsIds: Set<string>,
  keyPrefix: string
): ReactNode[] {
  return blocks.map((block, index) => {
    const key = `${keyPrefix}-${index}`;
    if (block.type === 'paragraph') {
      const content = block.content;
      if (content.startsWith('_') && content.endsWith('_')) {
        return (
          <p key={key} className="text-sm italic text-muted">
            {formatGuideInline(content.slice(1, -1), highlightQuery)}
          </p>
        );
      }
      return (
        <p key={key} className="leading-relaxed text-muted">
          {formatGuideInline(content, highlightQuery)}
        </p>
      );
    }
    if (block.type === 'list') {
      const ListTag = block.ordered ? 'ol' : 'ul';
      const listClass = block.ordered
        ? 'list-decimal space-y-4 pl-6 text-muted'
        : 'list-disc space-y-2 pl-6 text-muted';
      return (
        <ListTag key={key} className={listClass}>
          {block.items.map((item, itemIndex) => {
            const text = typeof item === 'string' ? item : item.text;
            const trailing = typeof item === 'string' ? [] : item.trailing;
            return (
              <li key={itemIndex} className="leading-relaxed">
                {formatGuideInline(text, highlightQuery)}
                {trailing.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {renderBlocks(trailing, highlightQuery, openDetailsIds, `${key}-t${itemIndex}`)}
                  </div>
                )}
              </li>
            );
          })}
        </ListTag>
      );
    }
    if (block.type === 'hr') {
      return <hr key={key} className="border-gold/15" />;
    }
    if (block.type === 'media') {
      return (
        <GuideMedia
          key={key}
          kind={block.kind}
          description={block.description}
          slug={block.slug}
        />
      );
    }
    if (block.type === 'details') {
      const open = openDetailsIds.has(block.id);
      return (
        <details
          key={key}
          id={block.id}
          open={open}
          className="rounded-xl border border-gold/10 bg-black/10 px-4 py-3"
        >
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            {formatGuideInline(block.summary, highlightQuery)}
          </summary>
          <div className="mt-3 space-y-3 border-t border-gold/10 pt-3">
            {renderBlocks(block.blocks, highlightQuery, openDetailsIds, `${key}-d`)}
          </div>
        </details>
      );
    }
    return null;
  });
}

function GuideHeadingView({
  heading,
  highlightQuery,
  openDetailsIds,
  onRegisterHeading,
  onCopyAnchor,
}: {
  heading: GuideHeading;
  highlightQuery?: string;
  openDetailsIds: Set<string>;
  onRegisterHeading?: (id: string, element: HTMLElement | null) => void;
  onCopyAnchor: (id: string) => void;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    onRegisterHeading?.(heading.id, ref.current);
    return () => onRegisterHeading?.(heading.id, null);
  }, [heading.id, onRegisterHeading]);

  const Tag = heading.level === 3 ? 'h3' : 'h2';
  const className =
    heading.level === 3
      ? 'group scroll-mt-28 text-lg font-medium text-foreground'
      : 'group scroll-mt-28 pt-2 text-xl font-semibold text-gold-light';

  return (
    <section id={heading.id} data-guide-section={heading.id} className="space-y-4">
      <Tag ref={ref} className={`${className} flex items-start gap-2`}>
        <span className="min-w-0 flex-1">{formatGuideInline(heading.title, highlightQuery)}</span>
        <button
          type="button"
          onClick={() => onCopyAnchor(heading.id)}
          className="mt-0.5 shrink-0 rounded p-1 text-muted opacity-60 transition-opacity hover:text-gold-light group-hover:opacity-100"
          aria-label={`Скопировать ссылку на раздел «${heading.title.replace(/\*\*/g, '')}»`}
          title="Скопировать ссылку"
        >
          <Link2 size={14} className="rotate-45" />
        </button>
      </Tag>
      {renderBlocks(heading.blocks, highlightQuery, openDetailsIds, heading.id)}
      {heading.id === 'slovar' && (
        <dl className="space-y-3">
          {glossary.map((entry) => (
            <div key={entry.term}>
              <dt className="font-medium text-foreground">{entry.term}</dt>
              <dd className="mt-0.5 text-sm text-muted">{entry.definition}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

export function GuideRenderer({
  introBlocks,
  headings,
  highlightQuery,
  openDetailsIds,
  onRegisterHeading,
  onCopyAnchor,
}: GuideRendererProps) {
  return (
    <div className="guide-prose min-w-0 space-y-6">
      {introBlocks.length > 0 && (
        <div className="space-y-4">{renderBlocks(introBlocks, highlightQuery, openDetailsIds, 'intro')}</div>
      )}
      {headings.map((heading) => (
        <GuideHeadingView
          key={heading.id}
          heading={heading}
          highlightQuery={highlightQuery}
          openDetailsIds={openDetailsIds}
          onRegisterHeading={onRegisterHeading}
          onCopyAnchor={onCopyAnchor}
        />
      ))}
    </div>
  );
}
