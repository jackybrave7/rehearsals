import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';

function formatInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {token.slice(2, -2)}
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
        if (href.startsWith('/') && !href.startsWith('//')) {
          parts.push(
            <Link key={match.index} to={href} className="text-gold-light underline-offset-2 hover:underline">
              {label}
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
              {label}
            </a>
          );
        }
      }
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export function GuideMarkdown({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let listOrdered = false;

  const flushList = () => {
    if (listItems.length === 0) return;
    const ListTag = listOrdered ? 'ol' : 'ul';
    const listClass = listOrdered
      ? 'list-decimal space-y-2 pl-6 text-muted'
      : 'list-disc space-y-2 pl-6 text-muted';
    blocks.push(
      <ListTag key={`list-${blocks.length}`} className={listClass}>
        {listItems.map((item, index) => (
          <li key={index} className="leading-relaxed">
            {formatInline(item)}
          </li>
        ))}
      </ListTag>
    );
    listItems = [];
    listOrdered = false;
  };

  for (const line of source.replace(/\r\n/g, '\n').split('\n')) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    if (trimmed === '---') {
      flushList();
      blocks.push(<hr key={`hr-${blocks.length}`} className="border-gold/15" />);
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      if (level === 1) {
        blocks.push(
          <h1 key={`h-${blocks.length}`} className="text-3xl font-bold text-foreground">
            {formatInline(text)}
          </h1>
        );
      } else if (level === 2) {
        blocks.push(
          <h2 key={`h-${blocks.length}`} className="pt-2 text-xl font-semibold text-gold-light">
            {formatInline(text)}
          </h2>
        );
      } else {
        blocks.push(
          <h3 key={`h-${blocks.length}`} className="text-lg font-medium text-foreground">
            {formatInline(text)}
          </h3>
        );
      }
      continue;
    }

    const ulMatch = /^[-*]\s+(.+)$/.exec(trimmed);
    if (ulMatch) {
      if (listItems.length > 0 && listOrdered) flushList();
      listOrdered = false;
      listItems.push(ulMatch[1]);
      continue;
    }

    const olMatch = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (olMatch) {
      if (listItems.length > 0 && !listOrdered) flushList();
      listOrdered = true;
      listItems.push(olMatch[1]);
      continue;
    }

    flushList();

    if (trimmed.startsWith('_') && trimmed.endsWith('_')) {
      blocks.push(
        <p key={`p-${blocks.length}`} className="text-sm italic text-muted">
          {formatInline(trimmed.slice(1, -1))}
        </p>
      );
      continue;
    }

    blocks.push(
      <p key={`p-${blocks.length}`} className="leading-relaxed text-muted">
        {formatInline(trimmed)}
      </p>
    );
  }

  flushList();

  return <div className="guide-prose space-y-4">{blocks}</div>;
}
