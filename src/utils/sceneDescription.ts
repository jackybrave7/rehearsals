import type { Scene } from '../types';
import { buildSectionRanges } from './scriptDocument';
import type { DocTextAnchor } from './googleDocs';

const DEFAULT_MAX_LENGTH = 160;

const CHARACTER_CUE_RE = /^[А-ЯA-ZЁ][А-ЯA-ZЁ\s.'\-]{0,40}\.?$/;
const CHARACTER_DIALOGUE_RE = /^([А-ЯA-ZЁ][А-ЯA-ZЁ\s.'\-]{0,40})\.\s*(.+)$/;

function truncateAtWord(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  const slice = trimmed.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.55) {
    return `${slice.slice(0, lastSpace).trim()}…`;
  }
  return `${slice.trim()}…`;
}

function isCharacterCueLine(line: string): boolean {
  return CHARACTER_CUE_RE.test(line);
}

/** Краткое описание из начала текста сцены (без ИИ). */
export function buildSceneDescriptionFromScriptText(
  raw: string,
  maxLength = DEFAULT_MAX_LENGTH
): string {
  const text = raw.replace(/\r\n/g, '\n').trim();
  if (!text) return '';

  const openingDirection = text.match(/^\s*\(([^)]+)\)\s*/);
  if (openingDirection) {
    const direction = openingDirection[1].replace(/\s+/g, ' ').trim();
    if (direction.length >= 6) {
      return truncateAtWord(direction, maxLength);
    }
  }

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const parts: string[] = [];

  for (const line of lines) {
    if (isCharacterCueLine(line)) continue;

    const standaloneDirection = line.match(/^\(([^)]+)\)$/);
    if (standaloneDirection) {
      parts.push(standaloneDirection[1].trim());
      continue;
    }

    const dialogueMatch = line.match(CHARACTER_DIALOGUE_RE);
    if (dialogueMatch) {
      parts.push(dialogueMatch[2].trim());
    } else {
      parts.push(line);
    }

    if (parts.join(' ').replace(/\s+/g, ' ').length >= maxLength) break;
  }

  const joined = parts.join(' ').replace(/\s+/g, ' ').trim();
  if (!joined) {
    return truncateAtWord(text.replace(/\s+/g, ' '), maxLength);
  }

  return truncateAtWord(joined, maxLength);
}

export function buildSceneDescriptionsFromTexts(
  texts: Map<string, string>
): Map<string, string> {
  const descriptions = new Map<string, string>();
  for (const [sceneId, text] of texts.entries()) {
    const description = buildSceneDescriptionFromScriptText(text);
    if (description) descriptions.set(sceneId, description);
  }
  return descriptions;
}

export function extractSceneBodyTextsFromPlainText(
  fullText: string,
  anchors: DocTextAnchor[],
  scenes: Scene[]
): Map<string, string> {
  const ranges = buildSectionRanges(fullText, anchors);
  const rangeByAnchorId = new Map(ranges.map((range) => [range.anchor.id, range]));
  const texts = new Map<string, string>();

  for (const scene of scenes) {
    if (!scene.scriptAnchor) continue;
    const range = rangeByAnchorId.get(scene.scriptAnchor.id);
    if (!range) continue;

    const body = fullText.slice(range.bodyStart, range.bodyEnd).trim();
    if (body) texts.set(scene.id, body);
  }

  return texts;
}
