import type { Play, Scene, SceneScriptAnchor, SceneScriptAnchorType } from '../types';
import { resolvePlayScriptUrl } from './fileUrls';

const GOOGLE_DOC_ID_RE = /\/document\/d\/([a-zA-Z0-9_-]+)/;

export interface DocTextAnchor {
  type: SceneScriptAnchorType;
  id: string;
  text: string;
  index: number;
}

export function isGoogleDocsUrl(url: string | undefined): boolean {
  return Boolean(url && url.includes('docs.google.com/document'));
}

/** Загруженный .docx/.pdf в Drive часто открывается с rtpof= или sd=true — Docs API его не читает. */
export function isLikelyUploadedOfficeDoc(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.searchParams.has('rtpof') || parsed.searchParams.get('sd') === 'true';
  } catch {
    return url.includes('rtpof=') || url.includes('sd=true');
  }
}

export function parseGoogleDocumentId(url: string): string | null {
  return url.match(GOOGLE_DOC_ID_RE)?.[1] ?? null;
}

export function enrichPlayDocumentMeta(play: Play): Play {
  const documentUrl = play.documentUrl?.trim();
  if (!documentUrl || !isGoogleDocsUrl(documentUrl)) {
    return {
      ...play,
      documentUrl: documentUrl || undefined,
      googleDocumentId: undefined,
    };
  }

  return {
    ...play,
    documentUrl,
    googleDocumentId: parseGoogleDocumentId(documentUrl) ?? undefined,
  };
}

export function parseAnchorFromGoogleDocsUrl(url: string): SceneScriptAnchor | null {
  const heading = url.match(/#heading=([^&]+)/);
  if (heading) return { type: 'heading', id: decodeURIComponent(heading[1]) };

  const bookmark = url.match(/#bookmark=([^&]+)/);
  if (bookmark) return { type: 'bookmark', id: decodeURIComponent(bookmark[1]) };

  return null;
}

export function buildGoogleDocsAnchorUrl(
  documentId: string,
  anchor: SceneScriptAnchor,
  mode: 'edit' | 'view' = 'edit'
): string {
  const base = `https://docs.google.com/document/d/${documentId}/${mode}`;
  const hash = anchor.type === 'heading' ? `#heading=${anchor.id}` : `#bookmark=${anchor.id}`;
  return `${base}${hash}`;
}

export function resolvePlayGoogleDocsUrl(play: Play | undefined): string | null {
  if (!play) return null;

  const documentId =
    play.googleDocumentId ??
    (play.documentUrl ? parseGoogleDocumentId(play.documentUrl) : null);
  if (!documentId || !isGoogleDocsUrl(play.documentUrl)) return null;

  return play.documentUrl ?? `https://docs.google.com/document/d/${documentId}/edit`;
}

export function resolveSceneScriptUrl(play: Play | undefined, scene: Scene): string | null {
  if (!play) return null;

  const googleDocsUrl = resolvePlayGoogleDocsUrl(play);
  const documentId =
    play.googleDocumentId ??
    (play.documentUrl ? parseGoogleDocumentId(play.documentUrl) : null);

  const linkAnchor = resolveSceneLinkAnchor(play, scene);
  if (linkAnchor && documentId) {
    return buildGoogleDocsAnchorUrl(documentId, linkAnchor);
  }

  if (googleDocsUrl) return googleDocsUrl;

  const scriptUrl = resolvePlayScriptUrl(play);
  if (scriptUrl) return scriptUrl;

  if (!documentId) return null;

  return play.documentUrl ?? `https://docs.google.com/document/d/${documentId}/edit`;
}

export function mapActAnchorsFromDocument(
  anchors: DocTextAnchor[]
): Record<string, SceneScriptAnchor> {
  const result: Record<string, SceneScriptAnchor> = {};
  for (const anchor of anchors) {
    if (!isStructuralActHeading(anchor.text)) continue;
    const label = resolveActGroupLabel(anchor.text);
    if (!label) continue;
    result[label] = { type: anchor.type, id: anchor.id };
  }
  return result;
}

export function resolveActScriptUrl(play: Play | undefined, actGroup: string): string | null {
  if (!play || actGroup === 'Сцены') return null;

  const anchor = play.actScriptAnchors?.[actGroup];
  const googleDocsUrl = resolvePlayGoogleDocsUrl(play);
  const documentId =
    play.googleDocumentId ??
    (play.documentUrl ? parseGoogleDocumentId(play.documentUrl) : null);

  if (anchor && documentId && !anchor.id.startsWith('file-')) {
    return buildGoogleDocsAnchorUrl(documentId, anchor);
  }

  if (googleDocsUrl) return googleDocsUrl;

  const scriptUrl = resolvePlayScriptUrl(play);
  if (scriptUrl) return scriptUrl;

  if (!documentId) return null;

  return play.documentUrl ?? `https://docs.google.com/document/d/${documentId}/edit`;
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[«»"']/g, '')
    .replace(/[—–-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ACT_SCENE_BOUNDARY = String.raw`(?=\s|,|\.|$|[-—–])`;

export function parseActScene(value: string): { act?: number; scene?: number } {
  const actBeforeMatch = value.match(
    new RegExp(`(\\d+)\\s*(?:акт|действие)${ACT_SCENE_BOUNDARY}`, 'i')
  );
  const actAfterMatch = value.match(
    new RegExp(`(?:акт|действие)\\s*(\\d+)${ACT_SCENE_BOUNDARY}`, 'i')
  );
  const act = actBeforeMatch
    ? Number(actBeforeMatch[1])
    : actAfterMatch
      ? Number(actAfterMatch[1])
      : undefined;

  const sceneAfterDotMatch = value.match(/сц\.?\s*(\d+)/i);
  const sceneBeforeWordMatch = value.match(
    new RegExp(`(\\d+)\\s*сцена${ACT_SCENE_BOUNDARY}`, 'i')
  );
  const sceneAfterWordMatch = value.match(
    new RegExp(`сцена\\s*(\\d+)${ACT_SCENE_BOUNDARY}`, 'i')
  );
  const scene = sceneBeforeWordMatch
    ? Number(sceneBeforeWordMatch[1])
    : sceneAfterDotMatch
      ? Number(sceneAfterDotMatch[1])
      : sceneAfterWordMatch
        ? Number(sceneAfterWordMatch[1])
        : undefined;

  return { act, scene };
}

function extractSceneLocationHint(value: string): string | null {
  const parenMatch = value.match(/\(([^)]+)\)\s*$/);
  if (parenMatch) return normalizeTitle(parenMatch[1]);

  const dashMatch = value.match(/[—–-]\s*([^—–-]+?)\s*$/);
  if (dashMatch) return normalizeTitle(dashMatch[1]);

  return null;
}

function actSceneNumbersConflict(
  sceneKey: { act?: number; scene?: number },
  anchorKey: { act?: number; scene?: number }
): boolean {
  if (
    sceneKey.act !== undefined &&
    anchorKey.act !== undefined &&
    sceneKey.act !== anchorKey.act
  ) {
    return true;
  }
  if (
    sceneKey.scene !== undefined &&
    anchorKey.scene !== undefined &&
    sceneKey.scene !== anchorKey.scene
  ) {
    return true;
  }
  return false;
}

function characterHintScore(sceneHint: string | null, anchorHint: string | null): number {
  if (!sceneHint || !anchorHint) return 0;
  if (sceneHint === anchorHint) return 100;

  const sceneParts = sceneHint.split(',').map((part) => part.trim()).filter(Boolean);
  const anchorParts = anchorHint.split(',').map((part) => part.trim()).filter(Boolean);
  if (sceneParts.length === 0 || anchorParts.length === 0) return 0;

  const matched = sceneParts.filter((part) =>
    anchorParts.some((anchorPart) => anchorPart.includes(part) || part.includes(anchorPart))
  );
  const threshold = Math.ceil(Math.min(sceneParts.length, anchorParts.length) * 0.7);
  return matched.length >= threshold ? 80 : 0;
}

export function isSceneLikeHeading(text: string): boolean {
  const trimmed = text.trim();
  return (
    /^(?:\d+\s*акт|акт\s+\d+|сцена\s+\d+|акт\s+\d+(?:,\s*\d+\s*часть)?,\s*сц\.?\s*\d+)/i.test(
      trimmed
    ) ||
    /^сц\.?\s*\d+/i.test(trimmed) ||
    /^\d+\s*акт\b.*\d+\s*сцен/i.test(trimmed)
  );
}

/** Заголовки уровня акта/действия — не отдельные сцены для репетиций. */
export function isStructuralActHeading(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/сц\.?\s*\d+/i.test(trimmed) || /^сцена\s+\d+/i.test(trimmed)) return false;

  return /^(?:акт|действие)\s+(?:\d+|[IVXLC]+|первое|второе|третье|четв[её]ртое|пятое|шестое|седьмое|восьмое|девятое|десятое)\s*$/i.test(
    trimmed
  );
}

/** Заголовок, из которого можно создать сцену при импорте. */
export function isImportableSceneHeading(text: string): boolean {
  if (isStructuralActHeading(text)) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^сцена\s+\d+/i.test(trimmed)) return true;
  return isSceneLikeHeading(trimmed);
}

/** Заголовки Word/Google Docs, попадающие в список якорей импорта (без «Действующие лица» и т.п.). */
export function isDocxAnchorHeading(text: string): boolean {
  const lower = text.trim().toLowerCase();
  if (lower === 'персонажи' || lower === 'действующие лица') return false;
  return isImportableSceneHeading(text) || isStructuralActHeading(text);
}

export function filterImportableSceneAnchors<T extends { text: string }>(anchors: T[]): T[] {
  return anchors.filter((anchor) => isImportableSceneHeading(anchor.text));
}

export function resolveActGroupLabel(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (isStructuralActHeading(trimmed)) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }
  const actInTitle = trimmed.match(/^(Акт\s+\d+(?:,\s*\d+\s*часть)?)/i);
  return actInTitle?.[1] ?? null;
}

export function mapActGroupsToMatchedScenes(
  anchors: DocTextAnchor[],
  matches: SceneAnchorMatch[]
): Map<string, string | undefined> {
  const sceneIdByAnchorKey = new Map(
    matches.map((match) => [`${match.anchor.type}:${match.anchor.id}`, match.sceneId])
  );
  let currentAct: string | undefined;
  const result = new Map<string, string | undefined>();

  for (const anchor of anchors) {
    if (isStructuralActHeading(anchor.text)) {
      currentAct = resolveActGroupLabel(anchor.text) ?? currentAct;
      continue;
    }
    const sceneId = sceneIdByAnchorKey.get(`${anchor.type}:${anchor.id}`);
    if (!sceneId) continue;
    const actFromTitle = resolveActGroupLabel(anchor.text);
    result.set(sceneId, actFromTitle ?? currentAct);
    if (actFromTitle) currentAct = actFromTitle;
  }

  return result;
}

export function listImportableScenesWithActGroups<T extends { text: string }>(
  anchors: T[]
): Array<{ anchor: T; actGroup?: string }> {
  const result: Array<{ anchor: T; actGroup?: string }> = [];
  let currentAct: string | undefined;

  for (const anchor of anchors) {
    if (isStructuralActHeading(anchor.text)) {
      currentAct = resolveActGroupLabel(anchor.text) ?? currentAct;
      continue;
    }
    if (!isImportableSceneHeading(anchor.text)) continue;
    const actFromTitle = resolveActGroupLabel(anchor.text);
    const actGroup = actFromTitle ?? currentAct;
    result.push({ anchor, actGroup });
    if (actFromTitle) currentAct = actFromTitle;
  }

  return result;
}

function scoreSceneHeadingMatch(sceneTitle: string, anchorText: string): number {
  const normScene = normalizeTitle(sceneTitle);
  const normAnchor = normalizeTitle(anchorText);

  if (!normScene || !normAnchor) return 0;
  if (normScene === normAnchor) return 100;

  const sceneKey = parseActScene(sceneTitle);
  const anchorKey = parseActScene(anchorText);
  if (actSceneNumbersConflict(sceneKey, anchorKey)) return 0;

  const charScore = characterHintScore(
    extractSceneLocationHint(sceneTitle),
    extractSceneLocationHint(anchorText)
  );

  if (
    sceneKey.act &&
    sceneKey.scene &&
    anchorKey.act === sceneKey.act &&
    anchorKey.scene === sceneKey.scene
  ) {
    return charScore >= 80 ? 100 : 95;
  }

  if (sceneKey.scene && anchorKey.scene && sceneKey.scene === anchorKey.scene) {
    if (sceneKey.act !== undefined && anchorKey.act !== undefined && sceneKey.act !== anchorKey.act) {
      return 0;
    }
    if (charScore >= 80) return 98;
    if (charScore > 0) return 0;
    if (sceneKey.act === undefined && anchorKey.act === undefined) return 80;
  }

  if (charScore >= 100) return 92;

  if (normAnchor.includes(normScene) || normScene.includes(normAnchor)) return 85;

  const sceneTokens = normScene.split(' ').filter((token) => token.length > 2);
  const matchedTokens = sceneTokens.filter((token) => normAnchor.includes(token));
  if (sceneTokens.length > 0 && matchedTokens.length >= Math.ceil(sceneTokens.length * 0.6)) {
    return 70 + matchedTokens.length;
  }

  return 0;
}

function isValidSceneAnchorMatch(scene: Scene, match: SceneAnchorMatch): boolean {
  const sceneKey = parseActScene(scene.title);
  const anchorKey = parseActScene(match.anchorText);
  if (sceneKey.scene !== undefined && anchorKey.scene !== undefined) {
    return sceneKey.scene === anchorKey.scene && !actSceneNumbersConflict(sceneKey, anchorKey);
  }
  return match.score >= 70;
}

export function findGoogleAnchorForScene(
  scene: Scene,
  docAnchors: DocTextAnchor[]
): SceneScriptAnchor | null {
  const importable = listImportableScenesWithActGroups(docAnchors).map((item) => item.anchor);
  const sceneKey = parseActScene(scene.title);

  if (sceneKey.scene !== undefined) {
    const candidates = importable.filter((anchor) => {
      const anchorKey = parseActScene(anchor.text);
      if (anchorKey.scene !== sceneKey.scene) return false;
      return !actSceneNumbersConflict(sceneKey, anchorKey);
    });

    if (candidates.length === 1) {
      return { type: candidates[0].type, id: candidates[0].id };
    }

    if (candidates.length > 1) {
      let best: DocTextAnchor | null = null;
      let bestScore = 0;
      for (const anchor of candidates) {
        const score = scoreSceneHeadingMatch(scene.title, anchor.text);
        if (score > bestScore) {
          bestScore = score;
          best = anchor;
        }
      }
      if (best && bestScore >= 70) {
        return { type: best.type, id: best.id };
      }
    }
  }

  const match = matchScenesToDocAnchors([scene], docAnchors).find(
    (item) => item.score >= 70 && isValidSceneAnchorMatch(scene, item)
  );
  return match ? match.anchor : null;
}

export function resolveSceneLinkAnchor(play: Play, scene: Scene): SceneScriptAnchor | null {
  const docAnchors = (play.scriptGoogleSceneAnchors ?? []).filter(
    (anchor): anchor is DocTextAnchor => Boolean(anchor.text)
  );

  if (docAnchors.length > 0) {
    return findGoogleAnchorForScene(scene, docAnchors);
  }

  const stored = scene.scriptAnchor;
  if (!stored || stored.id.startsWith('file-')) return null;

  return null;
}

interface GoogleDocsParagraphElement {
  textRun?: {
    content?: string;
    textStyle?: {
      italic?: boolean;
      link?: {
        heading?: { id?: string };
        bookmark?: { id?: string };
      };
    };
  };
}

interface GoogleDocsParagraph {
  paragraphStyle?: {
    namedStyleType?: string;
    headingId?: string;
  };
  elements?: GoogleDocsParagraphElement[];
}

export interface GoogleDocsStructuralElement {
  startIndex?: number;
  endIndex?: number;
  paragraph?: GoogleDocsParagraph;
}

export interface GoogleDocsDocument {
  body?: {
    content?: GoogleDocsStructuralElement[];
  };
}

function readParagraphText(paragraph: GoogleDocsParagraph): string {
  return (paragraph.elements ?? [])
    .map((element) => element.textRun?.content ?? '')
    .join('')
    .replace(/\n$/, '')
    .trim();
}

function paragraphIsEntirelyItalic(paragraph: GoogleDocsParagraph): boolean {
  let hasText = false;
  for (const element of paragraph.elements ?? []) {
    const run = element.textRun;
    if (!run?.content?.trim()) continue;
    hasText = true;
    if (!run.textStyle?.italic) return false;
  }
  return hasText;
}

function paragraphToLearnText(paragraph: GoogleDocsParagraph): string {
  let result = '';
  let italicBuffer = '';

  const flushItalic = () => {
    const text = italicBuffer.replace(/\s+/g, ' ').trim();
    if (text) result += `(${text})`;
    italicBuffer = '';
  };

  for (const element of paragraph.elements ?? []) {
    const run = element.textRun;
    if (!run?.content) continue;
    const text = run.content.replace(/\n$/, '');
    if (!text) continue;

    if (run.textStyle?.italic) {
      italicBuffer += text;
      continue;
    }

    flushItalic();
    result += text;
  }

  flushItalic();
  return result.replace(/\s+/g, ' ').trim();
}

function extractLearnTextInRange(
  document: GoogleDocsDocument,
  rangeStart: number,
  rangeEnd: number
): string {
  const lines: string[] = [];
  let remarkParts: string[] = [];

  const flushRemark = () => {
    if (remarkParts.length === 0) return;
    lines.push(`(${remarkParts.join(' ')})`);
    remarkParts = [];
  };

  for (const element of document.body?.content ?? []) {
    const elementStart = element.startIndex ?? 0;
    const elementEnd = element.endIndex ?? 0;
    if (elementEnd <= rangeStart || elementStart >= rangeEnd) continue;

    const paragraph = element.paragraph;
    if (!paragraph) continue;

    const line = paragraphToLearnText(paragraph);
    if (!line) continue;

    if (paragraphIsEntirelyItalic(paragraph)) {
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

function isHeadingStyle(namedStyleType: string | undefined): boolean {
  return Boolean(namedStyleType?.startsWith('HEADING_'));
}

export function extractDocTextAnchors(document: GoogleDocsDocument): DocTextAnchor[] {
  const anchors: DocTextAnchor[] = [];
  let index = 0;

  for (const element of document.body?.content ?? []) {
    const paragraph = element.paragraph;
    if (!paragraph) continue;

    const text = readParagraphText(paragraph);
    const headingId = paragraph.paragraphStyle?.headingId;
    const namedStyleType = paragraph.paragraphStyle?.namedStyleType;

    if (headingId && text && isHeadingStyle(namedStyleType)) {
      anchors.push({ type: 'heading', id: headingId, text, index });
      index += 1;
      continue;
    }

    for (const item of paragraph.elements ?? []) {
      const link = item.textRun?.textStyle?.link;
      if (link?.heading?.id && text) {
        anchors.push({ type: 'heading', id: link.heading.id, text, index });
        index += 1;
        break;
      }
      if (link?.bookmark?.id && text) {
        anchors.push({ type: 'bookmark', id: link.bookmark.id, text, index });
        index += 1;
        break;
      }
    }
  }

  const unique = new Map<string, DocTextAnchor>();
  for (const anchor of anchors) {
    unique.set(`${anchor.type}:${anchor.id}`, anchor);
  }

  return [...unique.values()].sort((a, b) => a.index - b.index);
}

function stripInlineHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Якоря из публичного HTML-экспорта Google Docs (без OAuth пользователя). */
export function extractDocTextAnchorsFromGoogleHtml(html: string): DocTextAnchor[] {
  const anchors: DocTextAnchor[] = [];
  const seen = new Set<string>();
  let index = 0;

  const blockRe =
    /<(?:p|h[1-6]|div)[^>]*\sid="(h\.[^"]+)"[^>]*>([\s\S]*?)<\/(?:p|h[1-6]|div)>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(html)) !== null) {
    const id = match[1];
    const text = stripInlineHtml(match[2]);
    if (!text || seen.has(id)) continue;
    if (!isImportableSceneHeading(text)) continue;
    seen.add(id);
    anchors.push({ type: 'heading', id, text, index: index++ });
  }

  if (anchors.length === 0) {
    const idRe = /\sid="(h\.[^"]+)"/gi;
    while ((match = idRe.exec(html)) !== null) {
      const id = match[1];
      if (seen.has(id)) continue;
      const slice = html.slice(match.index, match.index + 1200);
      const textMatch = slice.match(/>([^<]{2,200})</);
      const text = textMatch ? stripInlineHtml(textMatch[1]) : '';
      if (!text || !isImportableSceneHeading(text)) continue;
      seen.add(id);
      anchors.push({ type: 'heading', id, text, index: index++ });
    }
  }

  return anchors.sort((a, b) => a.index - b.index);
}

function compareScenesForMatching(
  a: Pick<Scene, 'title' | 'number'>,
  b: Pick<Scene, 'title' | 'number'>
): number {
  const aKey = parseActScene(a.title);
  const bKey = parseActScene(b.title);
  if (aKey.act !== undefined && bKey.act !== undefined && aKey.act !== bKey.act) {
    return aKey.act - bKey.act;
  }
  const aScene = aKey.scene ?? a.number;
  const bScene = bKey.scene ?? b.number;
  if (aScene !== bScene) return aScene - bScene;
  return a.number - b.number;
}

export interface SceneAnchorMatch {
  sceneId: string;
  anchor: SceneScriptAnchor;
  anchorText: string;
  score: number;
}

export function matchScenesToDocAnchors(
  scenes: Scene[],
  docAnchors: DocTextAnchor[]
): SceneAnchorMatch[] {
  const sortedScenes = [...scenes].sort(compareScenesForMatching);
  const usedAnchorIds = new Set<string>();
  const matches: SceneAnchorMatch[] = [];

  for (const scene of sortedScenes) {
    let best: DocTextAnchor | null = null;
    let bestScore = 0;

    for (const anchor of docAnchors) {
      const anchorKey = `${anchor.type}:${anchor.id}`;
      if (usedAnchorIds.has(anchorKey)) continue;

      const score = scoreSceneHeadingMatch(scene.title, anchor.text);
      if (score > bestScore) {
        bestScore = score;
        best = anchor;
      }
    }

    if (best && bestScore >= 70) {
      usedAnchorIds.add(`${best.type}:${best.id}`);
      matches.push({
        sceneId: scene.id,
        anchor: { type: best.type, id: best.id },
        anchorText: best.text,
        score: bestScore,
      });
    }
  }

  const unmatchedScenes = sortedScenes.filter(
    (scene) => !matches.some((match) => match.sceneId === scene.id)
  );
  const unusedSceneAnchors = docAnchors.filter(
    (anchor) =>
      !usedAnchorIds.has(`${anchor.type}:${anchor.id}`) && isSceneLikeHeading(anchor.text)
  );

  if (unmatchedScenes.length > 0 && unusedSceneAnchors.length > 0) {
    for (const scene of unmatchedScenes) {
      const sceneKey = parseActScene(scene.title);
      let paired = false;

      for (const anchor of unusedSceneAnchors) {
        const anchorKey = `${anchor.type}:${anchor.id}`;
        if (usedAnchorIds.has(anchorKey)) continue;

        const anchorSceneKey = parseActScene(anchor.text);
        if (
          sceneKey.scene !== undefined &&
          anchorSceneKey.scene !== undefined &&
          sceneKey.scene !== anchorSceneKey.scene
        ) {
          continue;
        }
        if (actSceneNumbersConflict(sceneKey, anchorSceneKey)) continue;

        usedAnchorIds.add(anchorKey);
        matches.push({
          sceneId: scene.id,
          anchor: { type: anchor.type, id: anchor.id },
          anchorText: anchor.text,
          score: 55,
        });
        paired = true;
        break;
      }

      if (!paired && sceneKey.scene === undefined) {
        const anchor = unusedSceneAnchors.find(
          (item) => !usedAnchorIds.has(`${item.type}:${item.id}`)
        );
        if (!anchor) continue;
        usedAnchorIds.add(`${anchor.type}:${anchor.id}`);
        matches.push({
          sceneId: scene.id,
          anchor: { type: anchor.type, id: anchor.id },
          anchorText: anchor.text,
          score: 55,
        });
      }
    }
  }

  return matches.sort(
    (a, b) =>
      sortedScenes.findIndex((scene) => scene.id === a.sceneId) -
      sortedScenes.findIndex((scene) => scene.id === b.sceneId)
  );
}

export function buildGoogleDocAnchorsForLinking(anchors: DocTextAnchor[]): DocTextAnchor[] {
  return listImportableScenesWithActGroups(anchors).map(({ anchor }) => anchor);
}

export function prepareGoogleSceneLinkMatches(
  scenes: Scene[],
  anchors: DocTextAnchor[]
): {
  matches: SceneAnchorMatch[];
  scriptGoogleSceneAnchors: DocTextAnchor[];
} {
  const scriptGoogleSceneAnchors = buildGoogleDocAnchorsForLinking(anchors);
  if (scriptGoogleSceneAnchors.length === 0) {
    return { matches: [], scriptGoogleSceneAnchors };
  }

  const matches: SceneAnchorMatch[] = [];
  const usedAnchorKeys = new Set<string>();

  for (const scene of [...scenes].sort(compareScenesForMatching)) {
    const anchor = findGoogleAnchorForScene(scene, scriptGoogleSceneAnchors);
    if (!anchor) continue;

    const anchorKey = `${anchor.type}:${anchor.id}`;
    if (usedAnchorKeys.has(anchorKey)) continue;
    usedAnchorKeys.add(anchorKey);

    const docAnchor = scriptGoogleSceneAnchors.find((item) => item.id === anchor.id);
    matches.push({
      sceneId: scene.id,
      anchor,
      anchorText: docAnchor?.text ?? scene.title,
      score: 95,
    });
  }

  return { matches, scriptGoogleSceneAnchors };
}

function findAnchorStartIndex(
  document: GoogleDocsDocument,
  anchor: SceneScriptAnchor
): number | null {
  for (const element of document.body?.content ?? []) {
    if (element.startIndex === undefined) continue;
    const paragraph = element.paragraph;
    if (!paragraph) continue;

    if (anchor.type === 'heading' && paragraph.paragraphStyle?.headingId === anchor.id) {
      return element.startIndex;
    }

    for (const item of paragraph.elements ?? []) {
      const link = item.textRun?.textStyle?.link;
      if (anchor.type === 'heading' && link?.heading?.id === anchor.id) {
        return element.startIndex;
      }
      if (anchor.type === 'bookmark' && link?.bookmark?.id === anchor.id) {
        return element.startIndex;
      }
    }
  }

  return null;
}

function extractPlainTextInRange(
  document: GoogleDocsDocument,
  rangeStart: number,
  rangeEnd: number
): string {
  const parts: string[] = [];

  for (const element of document.body?.content ?? []) {
    const elementStart = element.startIndex ?? 0;
    const elementEnd = element.endIndex ?? 0;
    if (elementEnd <= rangeStart || elementStart >= rangeEnd) continue;

    const paragraph = element.paragraph;
    if (!paragraph) continue;

    parts.push(
      (paragraph.elements ?? [])
        .map((item) => item.textRun?.content ?? '')
        .join('')
    );
  }

  return parts.join('');
}

/** Текст сцен между заголовками в Google Docs. */
export function extractSceneBodyTextsFromGoogleDoc(
  document: GoogleDocsDocument,
  scenes: Scene[]
): Map<string, string> {
  const texts = new Map<string, string>();
  const docEnd =
    document.body?.content?.[document.body.content.length - 1]?.endIndex ?? 0;

  const positioned = scenes
    .filter((scene) => scene.scriptAnchor)
    .map((scene) => ({
      sceneId: scene.id,
      anchor: scene.scriptAnchor!,
      startIndex: findAnchorStartIndex(document, scene.scriptAnchor!),
    }))
    .filter((entry): entry is typeof entry & { startIndex: number } => entry.startIndex !== null)
    .sort((a, b) => a.startIndex - b.startIndex);

  for (let index = 0; index < positioned.length; index += 1) {
    const current = positioned[index];
    const headingEnd =
      document.body?.content?.find((element) => element.startIndex === current.startIndex)
        ?.endIndex ?? current.startIndex;
    const nextStart = positioned[index + 1]?.startIndex ?? docEnd;
    const text = extractPlainTextInRange(document, headingEnd, nextStart).trim();
    if (text) texts.set(current.sceneId, text);
  }

  return texts;
}

/** Текст сцен для режима «Учить» — курсив → ремарки в скобках. */
export function extractSceneLearnTextsFromGoogleDoc(
  document: GoogleDocsDocument,
  scenes: Scene[]
): Map<string, string> {
  const texts = new Map<string, string>();
  const docEnd =
    document.body?.content?.[document.body.content.length - 1]?.endIndex ?? 0;

  const positioned = scenes
    .filter((scene) => scene.scriptAnchor)
    .map((scene) => ({
      sceneId: scene.id,
      anchor: scene.scriptAnchor!,
      startIndex: findAnchorStartIndex(document, scene.scriptAnchor!),
    }))
    .filter((entry): entry is typeof entry & { startIndex: number } => entry.startIndex !== null)
    .sort((a, b) => a.startIndex - b.startIndex);

  for (let index = 0; index < positioned.length; index += 1) {
    const current = positioned[index];
    const headingEnd =
      document.body?.content?.find((element) => element.startIndex === current.startIndex)
        ?.endIndex ?? current.startIndex;
    const nextStart = positioned[index + 1]?.startIndex ?? docEnd;
    const text = extractLearnTextInRange(document, headingEnd, nextStart).trim();
    if (text) texts.set(current.sceneId, text);
  }

  return texts;
}

/** Подсчёт знаков текста сцены между заголовками в Google Docs. */
export function countSceneCharactersFromGoogleDoc(
  document: GoogleDocsDocument,
  scenes: Scene[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const [sceneId, text] of extractSceneBodyTextsFromGoogleDoc(document, scenes)) {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length > 0) counts.set(sceneId, normalized.length);
  }
  return counts;
}
