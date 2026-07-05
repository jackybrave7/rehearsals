import { stripHtmlTags } from './scriptDocument';
import { isImportableSceneHeading, matchScenesToDocAnchors, type DocTextAnchor } from './googleDocs';
import { CHARACTER_CUE_LINE_RE, CHARACTER_DIALOGUE_INLINE_RE } from './scriptTextLines';
import type { Scene } from '../types';

export interface DocxScriptParagraph {
  plainText: string;
  html: string;
  isEntirelyItalic: boolean;
  isHeading?: boolean;
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

const EMPHASIS_TAG_RE = /<(?:em|i)\b[^>]*>[\s\S]*?<\/(?:em|i)>/gi;
const ITALIC_SPAN_RE = /<span[^>]*font-style:\s*italic[^>]*>[\s\S]*?<\/span>/gi;
const ITALIC_STYLE_RE = /font-style:\s*italic/i;

export function isEntirelyEmphasisHtml(html: string): boolean {
  const inner = html.trim();
  if (!inner) return false;

  const textOnly = normalizeSpaces(stripHtmlTags(inner));
  if (!textOnly) return false;

  const withoutEmphasisBlocks = inner
    .replace(EMPHASIS_TAG_RE, '')
    .replace(ITALIC_SPAN_RE, '');
  return normalizeSpaces(stripHtmlTags(withoutEmphasisBlocks)).length === 0;
}

/** Курсив в docx: <em>, <i> или span/p с font-style: italic. */
export function isEntirelyRemarkHtml(html: string): boolean {
  if (isEntirelyEmphasisHtml(html)) return true;

  const inner = html.trim();
  if (!inner || !ITALIC_STYLE_RE.test(inner)) return false;

  const withoutItalic = inner
    .replace(EMPHASIS_TAG_RE, '')
    .replace(ITALIC_SPAN_RE, '')
    .replace(/<strong\b[^>]*>[\s\S]*?<\/strong>/gi, '')
    .replace(/<b\b[^>]*>[\s\S]*?<\/b>/gi, '');
  return normalizeSpaces(stripHtmlTags(withoutItalic)).length === 0;
}

function wrapItalicInner(text: string): string {
  const normalized = normalizeSpaces(stripHtmlTags(text));
  if (!normalized) return '';
  if (/^\([^)]+\)$/.test(normalized)) return normalized;
  return `(${normalized})`;
}

export function convertEmphasisHtmlToLearnText(html: string): string {
  let converted = html;
  converted = converted.replace(EMPHASIS_TAG_RE, (match) => {
    const inner = normalizeSpaces(stripHtmlTags(match));
    if (!inner) return '';
    if (CHARACTER_DIALOGUE_INLINE_RE.test(inner) || CHARACTER_CUE_LINE_RE.test(inner)) {
      return inner;
    }
    return wrapItalicInner(match);
  });
  converted = converted.replace(ITALIC_SPAN_RE, (match) => {
    const inner = normalizeSpaces(stripHtmlTags(match));
    if (!inner) return '';
    if (CHARACTER_DIALOGUE_INLINE_RE.test(inner) || CHARACTER_CUE_LINE_RE.test(inner)) {
      return inner;
    }
    return wrapItalicInner(match);
  });
  converted = stripHtmlTags(converted).replace(/\s+/g, ' ').trim();
  return converted;
}

function looksLikeDialogueParagraph(paragraph: DocxScriptParagraph): boolean {
  const plainText = paragraph.plainText.trim();
  if (CHARACTER_DIALOGUE_INLINE_RE.test(plainText)) return true;
  if (CHARACTER_CUE_LINE_RE.test(plainText)) return true;
  if (/^<(?:em|i)\b[^>]*>[\s\S]*<\/(?:em|i)>\s*[:.]/i.test(paragraph.html.trim())) return true;
  if (/^<strong\b[^>]*>[\s\S]*?<\/strong>(?:\s*<(?:em|i)\b[^>]*>[\s\S]*?<\/(?:em|i)>)?\s*[:.]/i.test(paragraph.html.trim())) {
    return true;
  }
  if (/^<b\b[^>]*>[\s\S]*?<\/b>(?:\s*<(?:em|i)\b[^>]*>[\s\S]*?<\/(?:em|i)>)?\s*[:.]/i.test(paragraph.html.trim())) {
    return true;
  }
  return false;
}

function unwrapOuterRemarkFromDialogue(line: string, plainText: string): string {
  const trimmed = line.trim();
  if (!/^\([\s\S]+\)$/.test(trimmed)) return line;
  const inner = trimmed.slice(1, -1).trim();
  if (
    CHARACTER_DIALOGUE_INLINE_RE.test(inner) ||
    CHARACTER_DIALOGUE_INLINE_RE.test(plainText.trim()) ||
    CHARACTER_CUE_LINE_RE.test(inner)
  ) {
    return inner;
  }
  return line;
}

function toRemarkLine(text: string): string {
  const normalized = normalizeSpaces(text);
  if (!normalized) return '';
  if (/^\([\s\S]+\)$/.test(normalized)) return normalized;
  return `(${normalized})`;
}

export function docxParagraphToLearnLine(paragraph: DocxScriptParagraph): string | null {
  if (!paragraph.plainText.trim()) return null;

  if (looksLikeDialogueParagraph(paragraph)) {
    const plain = normalizeSpaces(paragraph.plainText);
    const converted = convertEmphasisHtmlToLearnText(paragraph.html) || plain;
    return unwrapOuterRemarkFromDialogue(converted, plain);
  }

  return toRemarkLine(paragraph.plainText);
}

export function paragraphsToLearnScriptText(paragraphs: DocxScriptParagraph[]): string {
  const lines: string[] = [];
  let remarkParts: string[] = [];

  const flushRemark = () => {
    if (remarkParts.length === 0) return;
    lines.push(`(${remarkParts.join(' ')})`);
    remarkParts = [];
  };

  for (const paragraph of paragraphs) {
    const line = docxParagraphToLearnLine(paragraph);
    if (!line) continue;

    const isRemarkParagraph = line.startsWith('(') && line.endsWith(')');

    if (isRemarkParagraph) {
      const inner = line.match(/^\(([\s\S]+)\)$/)?.[1] ?? line;
      remarkParts.push(inner);
      continue;
    }

    flushRemark();
    lines.push(line);
  }

  flushRemark();
  return lines.join('\n');
}

export function htmlToDocxParagraphs(html: string): DocxScriptParagraph[] {
  const paragraphs: DocxScriptParagraph[] = [];
  const pattern = /<(p|h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const inner = match[2];
    const plainText = normalizeSpaces(stripHtmlTags(inner));
    if (!plainText) continue;
    paragraphs.push({
      plainText,
      html: inner,
      isEntirelyItalic: isEntirelyRemarkHtml(inner),
      isHeading: tag.startsWith('h'),
    });
  }

  if (paragraphs.length > 0) {
    return paragraphs;
  }

  const fallback = normalizeSpaces(stripHtmlTags(html));
  if (!fallback) return [];

  return fallback.split('\n').map((line) => {
    const text = line.trim();
    return {
      plainText: text,
      html: text,
      isEntirelyItalic: false,
    };
  });
}

function isParagraphSceneHeading(paragraph: DocxScriptParagraph): boolean {
  const lower = paragraph.plainText.toLowerCase();
  if (lower === 'персонажи' || lower === 'действующие лица') return false;

  return (
    Boolean(paragraph.isHeading) ||
    isImportableSceneHeading(paragraph.plainText) ||
    /\d+\s*акт\b.*\d+\s*сцен/i.test(paragraph.plainText)
  );
}

function buildHeadingAnchorsFromParagraphs(paragraphs: DocxScriptParagraph[]): DocTextAnchor[] {
  const anchors: DocTextAnchor[] = [];
  let index = 0;

  for (const paragraph of paragraphs) {
    if (!isParagraphSceneHeading(paragraph)) continue;

    anchors.push({
      type: 'heading',
      id: `file-${index}`,
      text: paragraph.plainText,
      index,
    });
    index += 1;
  }

  return anchors;
}

export function findParagraphIndexByFileAnchorId(
  paragraphs: DocxScriptParagraph[],
  anchorId: string
): number {
  if (!anchorId.startsWith('file-')) return -1;

  const ordinal = Number.parseInt(anchorId.slice('file-'.length), 10);
  if (!Number.isFinite(ordinal) || ordinal < 0) return -1;

  let headingCount = 0;
  for (let i = 0; i < paragraphs.length; i += 1) {
    if (!isParagraphSceneHeading(paragraphs[i])) continue;
    if (headingCount === ordinal) return i;
    headingCount += 1;
  }

  return -1;
}

function findHeadingParagraphIndex(
  paragraphs: DocxScriptParagraph[],
  anchorText: string
): number {
  const normalizedAnchor = normalizeSpaces(anchorText).toLowerCase();
  return paragraphs.findIndex(
    (paragraph) => normalizeSpaces(paragraph.plainText).toLowerCase() === normalizedAnchor
  );
}

export function extractLearnTextFromDocxParagraphs(
  paragraphs: DocxScriptParagraph[],
  scene: Scene
): string | null {
  const storedAnchorId = scene.scriptAnchor?.id;
  let headingIndex =
    storedAnchorId?.startsWith('file-')
      ? findParagraphIndexByFileAnchorId(paragraphs, storedAnchorId)
      : -1;

  if (headingIndex < 0) {
    const anchors = buildHeadingAnchorsFromParagraphs(paragraphs);
    const match = matchScenesToDocAnchors([scene], anchors).find(
      (item) => item.sceneId === scene.id && item.score >= 70
    );
    if (!match) return null;

    headingIndex = findParagraphIndexByFileAnchorId(paragraphs, match.anchor.id);
    if (headingIndex < 0) {
      headingIndex = findHeadingParagraphIndex(paragraphs, match.anchorText);
    }
  }

  if (headingIndex < 0) return null;

  const bodyParagraphs: DocxScriptParagraph[] = [];
  for (let index = headingIndex + 1; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    if (paragraph.isHeading || isImportableSceneHeading(paragraph.plainText)) break;
    bodyParagraphs.push(paragraph);
  }

  const text = paragraphsToLearnScriptText(bodyParagraphs);
  return text.trim() || null;
}
