import type { Scene } from '../types';
import {
  type DocTextAnchor,
  isImportableSceneHeading,
  listImportableScenesWithActGroups,
  matchScenesToDocAnchors,
  type SceneAnchorMatch,
} from './googleDocs';
import { resolveSceneNumberFromTitle } from './sceneNumbering';
import { generateId } from './id';
import { DEFAULT_SCENE_REHEARSAL_MINUTES } from './sceneDefaults';
import {
  buildSceneDescriptionsFromTexts,
  extractSceneBodyTextsFromPlainText,
} from './sceneDescription';

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
  return isImportableSceneHeading(withoutHash) || isImportableSceneHeading(trimmed);
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

export function mergeMissingScenesFromImport(
  playId: string,
  existingScenes: Scene[],
  anchors: DocTextAnchor[],
  matches: SceneAnchorMatch[]
): { toAdd: Scene[]; toUpdate: Scene[]; allScenes: Scene[] } {
  const importable = listImportableScenesWithActGroups(anchors);
  const sceneById = new Map(existingScenes.map((scene) => [scene.id, scene]));
  const matchByAnchorKey = new Map(
    matches.map((match) => [`${match.anchor.type}:${match.anchor.id}`, match])
  );

  const toAdd: Scene[] = [];
  const toUpdate: Scene[] = [];
  const updatedById = new Map<string, Scene>();

  importable.forEach(({ anchor, actGroup }, index) => {
    const anchorKey = `${anchor.type}:${anchor.id}`;
    const existingMatch = matchByAnchorKey.get(anchorKey);
    const number = resolveSceneNumberFromTitle(anchor.text, index + 1);

    if (existingMatch) {
      const scene = sceneById.get(existingMatch.sceneId);
      if (!scene) return;
      const updated: Scene = {
        ...scene,
        number,
        title: anchor.text,
        actGroup: actGroup ?? scene.actGroup,
      };
      if (
        updated.number !== scene.number ||
        updated.title !== scene.title ||
        updated.actGroup !== scene.actGroup
      ) {
        toUpdate.push(updated);
        updatedById.set(scene.id, updated);
      }
      return;
    }

    toAdd.push({
      id: generateId(),
      playId,
      number,
      title: anchor.text,
      actGroup,
      status: 'not_started',
      priority: 'medium',
      roleIds: [],
      estimatedMinutes: DEFAULT_SCENE_REHEARSAL_MINUTES,
    });
  });

  const allScenes = [
    ...existingScenes.map((scene) => updatedById.get(scene.id) ?? scene),
    ...toAdd,
  ].sort((a, b) => {
    const numberCmp = a.number - b.number;
    if (numberCmp !== 0) return numberCmp;
    return a.title.localeCompare(b.title, 'ru');
  });

  return { toAdd, toUpdate, allScenes };
}

export function syncScenesFromScriptText(
  fullText: string,
  anchors: DocTextAnchor[],
  scenes: Scene[]
): {
  matches: SceneAnchorMatch[];
  characterCounts: Map<string, number>;
  descriptions: Map<string, string>;
} {
  const matches = matchScenesToDocAnchors(scenes, anchors);
  const scenesWithAnchors = scenes.map((scene) => {
    const match = matches.find((item) => item.sceneId === scene.id);
    return match ? { ...scene, scriptAnchor: match.anchor } : scene;
  });
  const bodyTexts = extractSceneBodyTextsFromPlainText(fullText, anchors, scenesWithAnchors);
  const characterCounts = countSceneCharactersFromPlainText(fullText, anchors, scenesWithAnchors);
  const descriptions = buildSceneDescriptionsFromTexts(bodyTexts);
  return { matches, characterCounts, descriptions };
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
