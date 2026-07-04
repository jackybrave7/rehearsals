import { guideHeadingId, guideMediaSlug } from './guideSlug';

export type GuideRole = 'director' | 'actor' | 'all';

export type GuideListItem = string | { text: string; trailing: GuideBlock[] };

export type GuideBlock =
  | { type: 'paragraph'; content: string }
  | { type: 'list'; ordered: boolean; items: GuideListItem[] }
  | { type: 'hr' }
  | { type: 'details'; id: string; summary: string; blocks: GuideBlock[] }
  | { type: 'media'; kind: 'screen' | 'gif'; description: string; slug: string };

export interface GuideHeading {
  id: string;
  title: string;
  level: 1 | 2 | 3;
  role: GuideRole;
  blocks: GuideBlock[];
  text: string;
}

export interface ParsedGuide {
  introBlocks: GuideBlock[];
  headings: GuideHeading[];
  toc: Array<{ id: string; title: string; level: 2 | 3 }>;
}

const ROLE_COMMENT = /^<!--\s*role:\s*(director|actor|all)\s*-->$/i;
const ID_COMMENT = /^<!--\s*id:\s*([^\s>]+)\s*-->$/i;
const MEDIA_SCREEN = /^\[СКРИН:\s*(.+?)\]$/i;
const MEDIA_GIF = /^\[GIF:\s*(.+?)\]$/i;

function stripHtmlComments(source: string): string {
  return source.replace(/<!--(?!\s*(?:role|id)\s*:)[\s\S]*?-->/gi, '');
}

function isMetadataComment(trimmed: string): boolean {
  return ROLE_COMMENT.test(trimmed) || ID_COMMENT.test(trimmed);
}

function normalizeLines(source: string): string[] {
  const withoutComments = stripHtmlComments(source);
  const lines = withoutComments.replace(/\r\n/g, '\n').split('\n');
  if (lines[0]?.trim() !== '---') return lines;
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  return end === -1 ? lines : lines.slice(end + 1);
}

function listItemText(item: GuideListItem): string {
  return typeof item === 'string' ? item : item.text;
}

function collectBlockText(blocks: GuideBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === 'paragraph') return block.content;
      if (block.type === 'list') {
        return block.items
          .map((item) => {
            const text = listItemText(item);
            const trailing =
              typeof item === 'string' ? '' : ` ${collectBlockText(item.trailing)}`;
            return `${text}${trailing}`;
          })
          .join(' ');
      }
      if (block.type === 'details') return `${block.summary} ${collectBlockText(block.blocks)}`;
      if (block.type === 'media') return block.description;
      return '';
    })
    .join(' ');
}

function attachMediaToLastListItem(listItems: GuideListItem[], mediaBlock: GuideBlock): boolean {
  if (listItems.length === 0) return false;
  const last = listItems[listItems.length - 1];
  if (typeof last === 'string') {
    listItems[listItems.length - 1] = { text: last, trailing: [mediaBlock] };
    return true;
  }
  last.trailing.push(mediaBlock);
  return true;
}

function mergeAdjacentOrderedLists(blocks: GuideBlock[]): GuideBlock[] {
  const result: GuideBlock[] = [];
  let index = 0;

  while (index < blocks.length) {
    const block = blocks[index];
    if (block.type !== 'list' || !block.ordered) {
      result.push(block);
      index += 1;
      continue;
    }

    const items = [...block.items];
    index += 1;

    while (index < blocks.length) {
      const next = blocks[index];
      if (next.type === 'media') {
        attachMediaToLastListItem(items, next);
        index += 1;
        continue;
      }
      if (next.type === 'list' && next.ordered) {
        items.push(...next.items);
        index += 1;
        continue;
      }
      break;
    }

    result.push({ type: 'list', ordered: true, items });
  }

  return result;
}

function parseBlocks(lines: string[]): GuideBlock[] {
  const blocks: GuideBlock[] = [];
  let listItems: GuideListItem[] = [];
  let listOrdered = false;
  let index = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push({ type: 'list', ordered: listOrdered, items: listItems });
    listItems = [];
    listOrdered = false;
  };

  while (index < lines.length) {
    const trimmed = lines[index].trim();

    if (!trimmed) {
      flushList();
      index += 1;
      continue;
    }

    if (isMetadataComment(trimmed)) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith('<details')) {
      flushList();
      const summaryMatch = /<summary>(.*?)<\/summary>/i.exec(trimmed);
      const summary = summaryMatch?.[1]?.trim() ?? 'Подробнее';
      const id = guideHeadingId(summary);
      index += 1;
      const inner: string[] = [];
      while (index < lines.length && lines[index].trim() !== '</details>') {
        inner.push(lines[index]);
        index += 1;
      }
      if (lines[index]?.trim() === '</details>') index += 1;
      blocks.push({ type: 'details', id, summary, blocks: parseBlocks(inner) });
      continue;
    }

    if (!trimmed) {
      flushList();
      index += 1;
      continue;
    }

    if (trimmed === '---') {
      flushList();
      blocks.push({ type: 'hr' });
      index += 1;
      continue;
    }

    const screenMatch = MEDIA_SCREEN.exec(trimmed);
    if (screenMatch) {
      const description = screenMatch[1].trim();
      const mediaBlock: GuideBlock = {
        type: 'media',
        kind: 'screen',
        description,
        slug: guideMediaSlug(description),
      };
      if (!attachMediaToLastListItem(listItems, mediaBlock)) {
        flushList();
        blocks.push(mediaBlock);
      }
      index += 1;
      continue;
    }

    const gifMatch = MEDIA_GIF.exec(trimmed);
    if (gifMatch) {
      const description = gifMatch[1].trim();
      const mediaBlock: GuideBlock = {
        type: 'media',
        kind: 'gif',
        description,
        slug: guideMediaSlug(description),
      };
      if (!attachMediaToLastListItem(listItems, mediaBlock)) {
        flushList();
        blocks.push(mediaBlock);
      }
      index += 1;
      continue;
    }

    const ulMatch = /^[-*]\s+(.+)$/.exec(trimmed);
    if (ulMatch) {
      if (listItems.length > 0 && listOrdered) flushList();
      listOrdered = false;
      listItems.push(ulMatch[1]);
      index += 1;
      continue;
    }

    const olMatch = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (olMatch) {
      if (listItems.length > 0 && !listOrdered) flushList();
      listOrdered = true;
      listItems.push(olMatch[1]);
      index += 1;
      continue;
    }

    flushList();
    blocks.push({ type: 'paragraph', content: trimmed });
    index += 1;
  }

  flushList();
  return mergeAdjacentOrderedLists(blocks);
}

export function parseGuideMarkdown(source: string): ParsedGuide {
  const lines = normalizeLines(source);
  const headings: GuideHeading[] = [];
  const preHeadingLines: string[] = [];
  let pendingRole: GuideRole = 'all';
  let pendingId: string | undefined;
  let index = 0;
  let seenHeading = false;
  let lastH2Role: GuideRole = 'all';

  while (index < lines.length) {
    const trimmed = lines[index].trim();

    if (isMetadataComment(trimmed)) {
      if (ROLE_COMMENT.test(trimmed)) {
        pendingRole = ROLE_COMMENT.exec(trimmed)![1].toLowerCase() as GuideRole;
      } else if (ID_COMMENT.test(trimmed)) {
        pendingId = ID_COMMENT.exec(trimmed)![1];
      }
      index += 1;
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (!headingMatch) {
      if (!seenHeading) preHeadingLines.push(lines[index]);
      index += 1;
      continue;
    }

    seenHeading = true;

    const level = headingMatch[1].length as 1 | 2 | 3;
    const title = headingMatch[2];
    const id = guideHeadingId(title, pendingId);
    pendingId = undefined;
    index += 1;

    const role: GuideRole =
      level === 3 && pendingRole === 'all' ? lastH2Role : pendingRole;
    if (level === 2) lastH2Role = role;
    pendingRole = 'all';

    const bodyLines: string[] = [];
    while (index < lines.length) {
      const peek = lines[index].trim();
      if (/^#{1,3}\s+/.test(peek)) break;
      if (ROLE_COMMENT.test(peek) || ID_COMMENT.test(peek)) break;
      bodyLines.push(lines[index]);
      index += 1;
    }

    headings.push({
      id,
      title,
      level,
      role,
      blocks: parseBlocks(bodyLines),
      text: `${title} ${collectBlockText(parseBlocks(bodyLines))}`,
    });
  }

  let introBlocks = parseBlocks(preHeadingLines);
  const h1Index = headings.findIndex((h) => h.level === 1);
  if (h1Index >= 0) {
    const [h1] = headings.splice(h1Index, 1);
    introBlocks = [...introBlocks, ...h1.blocks];
  }

  const toc = headings
    .filter((h) => h.level >= 2)
    .map((h) => ({
      id: h.id,
      title: h.title.replace(/\*\*/g, ''),
      level: h.level as 2 | 3,
    }));

  return { introBlocks, headings, toc };
}

export function headingMatchesRole(role: GuideRole, filter: GuideRole): boolean {
  if (filter === 'all') return true;
  return role === 'all' || role === filter;
}

export function guideTextMatchesQuery(text: string, query: string): boolean {
  if (query.length < 2) return true;
  return text.toLowerCase().includes(query.toLowerCase());
}
