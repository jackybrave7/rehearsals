import type { Scene } from '../types';
import {
  type DocTextAnchor,
  isSceneLikeHeading,
  matchScenesToDocAnchors,
  type SceneAnchorMatch,
} from './googleDocs';

const MARKDOWN_HEADING = /^#{1,6}\s+/;

export function isFileSectionAnchor(anchor: { id: string } | undefined): boolean {
  return Boolean(anchor?.id.startsWith('file-'));
}

export function parseScriptFileId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/\/api\/files\/([a-f0-9-]+)/i);
  return match?.[1] ?? null;
}

export function isSupportedScriptImportFile(fileName: string, mimeType?: string): boolean {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.txt')) return true;
  if (lower.endsWith('.docx')) return true;
  if (mimeType === 'text/plain') return true;
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return true;
  }
  return false;
}

function isHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const withoutHash = trimmed.replace(MARKDOWN_HEADING, '');
  return isSceneLikeHeading(withoutHash) || isSceneLikeHeading(trimmed);
}

function normalizeHeadingText(line: string): string {
  return line.trim().replace(MARKDOWN_HEADING, '').trim();
}

export function extractSectionsFromPlainText(text: string): DocTextAnchor[] {
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const anchors: DocTextAnchor[] = [];
  let index = 0;

  for (const line of lines) {
    if (!isHeadingLine(line)) continue;
    const headingText = normalizeHeadingText(line);
    if (!headingText) continue;
    anchors.push({
      type: 'heading',
      id: `file-${index}`,
      text: headingText,
      index,
    });
    index += 1;
  }

  return anchors;
}

interface SectionRange {
  anchor: DocTextAnchor;
  bodyStart: number;
  bodyEnd: number;
}

export function buildSectionRanges(fullText: string, anchors: DocTextAnchor[]): SectionRange[] {
  const ranges: SectionRange[] = [];
  let searchFrom = 0;

  for (let index = 0; index < anchors.length; index += 1) {
    const anchor = anchors[index];
    const position = fullText.indexOf(anchor.text, searchFrom);
    if (position < 0) continue;

    const headingEnd = position + anchor.text.length;
    let bodyEnd = fullText.length;
    const nextAnchor = anchors[index + 1];
    if (nextAnchor) {
      const nextPosition = fullText.indexOf(nextAnchor.text, headingEnd);
      if (nextPosition >= 0) bodyEnd = nextPosition;
    }

    ranges.push({ anchor, bodyStart: headingEnd, bodyEnd });
    searchFrom = headingEnd;
  }

  return ranges;
}

export function countSceneCharactersFromPlainText(
  fullText: string,
  anchors: DocTextAnchor[],
  scenes: Scene[]
): Map<string, number> {
  const ranges = buildSectionRanges(fullText, anchors);
  const rangeByAnchorId = new Map(ranges.map((range) => [range.anchor.id, range]));
  const counts = new Map<string, number>();

  for (const scene of scenes) {
    if (!scene.scriptAnchor || !isFileSectionAnchor(scene.scriptAnchor)) continue;
    const range = rangeByAnchorId.get(scene.scriptAnchor.id);
    if (!range) continue;

    const body = fullText
      .slice(range.bodyStart, range.bodyEnd)
      .replace(/\s+/g, ' ')
      .trim();
    if (body.length > 0) {
      counts.set(scene.id, body.length);
    }
  }

  return counts;
}

export function syncScenesFromScriptText(
  fullText: string,
  anchors: DocTextAnchor[],
  scenes: Scene[]
): { matches: SceneAnchorMatch[]; characterCounts: Map<string, number> } {
  const matches = matchScenesToDocAnchors(scenes, anchors);
  const scenesWithAnchors = scenes.map((scene) => {
    const match = matches.find((item) => item.sceneId === scene.id);
    return match ? { ...scene, scriptAnchor: match.anchor } : scene;
  });
  const characterCounts = countSceneCharactersFromPlainText(fullText, anchors, scenesWithAnchors);
  return { matches, characterCounts };
}

export function stripHtmlTags(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}
