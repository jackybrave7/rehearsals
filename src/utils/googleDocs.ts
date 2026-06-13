import type { Play, Scene, SceneScriptAnchor, SceneScriptAnchorType } from '../types';

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

export function resolveSceneScriptUrl(play: Play | undefined, scene: Scene): string | null {
  if (!play) return null;

  const documentId =
    play.googleDocumentId ??
    (play.documentUrl ? parseGoogleDocumentId(play.documentUrl) : null);

  if (!documentId) return null;

  if (scene.scriptAnchor) {
    return buildGoogleDocsAnchorUrl(documentId, scene.scriptAnchor);
  }

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

function parseActScene(value: string): { act?: number; scene?: number } {
  const actMatch = value.match(/(?:акт|действие)\s*(\d+)/i);
  const sceneMatch = value.match(/сц\.?\s*(\d+)/i) ?? value.match(/сцена\s*(\d+)/i);
  return {
    act: actMatch ? Number(actMatch[1]) : undefined,
    scene: sceneMatch ? Number(sceneMatch[1]) : undefined,
  };
}

function extractCharacterHint(value: string): string | null {
  const match = value.match(/\(([^)]+)\)\s*$/);
  if (!match) return null;
  return normalizeTitle(match[1]);
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

function isSceneLikeHeading(text: string): boolean {
  const trimmed = text.trim();
  return (
    /^(?:акт\s+\d+|сцена\s+\d+|акт\s+\d+(?:,\s*\d+\s*часть)?,\s*сц\.?\s*\d+)/i.test(trimmed) ||
    /^сц\.?\s*\d+/i.test(trimmed)
  );
}

function scoreSceneHeadingMatch(sceneTitle: string, anchorText: string): number {
  const normScene = normalizeTitle(sceneTitle);
  const normAnchor = normalizeTitle(anchorText);

  if (!normScene || !normAnchor) return 0;
  if (normScene === normAnchor) return 100;

  const sceneKey = parseActScene(sceneTitle);
  const anchorKey = parseActScene(anchorText);
  const sceneChars = extractCharacterHint(sceneTitle);
  const anchorChars = extractCharacterHint(anchorText);
  const charScore = characterHintScore(sceneChars, anchorChars);

  if (
    sceneKey.act &&
    sceneKey.scene &&
    anchorKey.act === sceneKey.act &&
    anchorKey.scene === sceneKey.scene
  ) {
    return charScore >= 80 ? 100 : 95;
  }

  if (sceneKey.scene && anchorKey.scene && sceneKey.scene === anchorKey.scene) {
    if (charScore >= 80) return 98;
    if (charScore > 0) return 0;
    if (!anchorKey.act) return 80;
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

interface GoogleDocsParagraphElement {
  textRun?: {
    content?: string;
    textStyle?: {
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
  const sortedScenes = [...scenes].sort((a, b) => a.number - b.number);
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
    const pairCount = Math.min(unmatchedScenes.length, unusedSceneAnchors.length);
    for (let i = 0; i < pairCount; i += 1) {
      const scene = unmatchedScenes[i];
      const anchor = unusedSceneAnchors[i];
      if (matches.some((match) => match.sceneId === scene.id)) continue;

      usedAnchorIds.add(`${anchor.type}:${anchor.id}`);
      matches.push({
        sceneId: scene.id,
        anchor: { type: anchor.type, id: anchor.id },
        anchorText: anchor.text,
        score: 55,
      });
    }
  }

  return matches.sort(
    (a, b) =>
      sortedScenes.findIndex((scene) => scene.id === a.sceneId) -
      sortedScenes.findIndex((scene) => scene.id === b.sceneId)
  );
}
