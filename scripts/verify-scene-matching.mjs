import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// Inline minimal matching logic mirror for quick check without TS compile
function normalizeTitle(value) {
  return value
    .toLowerCase()
    .replace(/[«»"']/g, '')
    .replace(/[—–-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseActScene(value) {
  const actMatch = value.match(/(?:акт|действие)\s*(\d+)/i);
  const sceneMatch = value.match(/сц\.?\s*(\d+)/i) ?? value.match(/сцена\s*(\d+)/i);
  return {
    act: actMatch ? Number(actMatch[1]) : undefined,
    scene: sceneMatch ? Number(sceneMatch[1]) : undefined,
  };
}

function extractCharacterHint(value) {
  const match = value.match(/\(([^)]+)\)\s*$/);
  return match ? normalizeTitle(match[1]) : null;
}

function characterHintScore(sceneHint, anchorHint) {
  if (!sceneHint || !anchorHint) return 0;
  if (sceneHint === anchorHint) return 100;
  const sceneParts = sceneHint.split(',').map((p) => p.trim()).filter(Boolean);
  const anchorParts = anchorHint.split(',').map((p) => p.trim()).filter(Boolean);
  const matched = sceneParts.filter((part) =>
    anchorParts.some((a) => a.includes(part) || part.includes(a))
  );
  return matched.length >= Math.ceil(Math.min(sceneParts.length, anchorParts.length) * 0.7) ? 80 : 0;
}

function scoreSceneHeadingMatch(sceneTitle, anchorText) {
  const normScene = normalizeTitle(sceneTitle);
  const normAnchor = normalizeTitle(anchorText);
  if (!normScene || !normAnchor) return 0;
  if (normScene === normAnchor) return 100;

  const sceneKey = parseActScene(sceneTitle);
  const anchorKey = parseActScene(anchorText);
  const charScore = characterHintScore(extractCharacterHint(sceneTitle), extractCharacterHint(anchorText));

  if (sceneKey.act && sceneKey.scene && anchorKey.act === sceneKey.act && anchorKey.scene === sceneKey.scene) {
    return charScore >= 80 ? 100 : 95;
  }
  if (sceneKey.scene && anchorKey.scene && sceneKey.scene === anchorKey.scene) {
    if (charScore >= 80) return 98;
    if (charScore > 0) return 0;
    if (!anchorKey.act) return 80;
  }
  if (charScore >= 100) return 92;
  return 0;
}

const scenesData = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/chaikaScenes.generated.json'), 'utf8')
);
const text = fs.readFileSync(path.join(root, 'temp-chaika-text.txt'), 'utf8');
const anchors = [];
let idx = 0;
for (const line of text.split('\n')) {
  const t = line.trim();
  if (/^Сцена\s+\d+/i.test(t)) {
    anchors.push({ type: 'heading', id: `h${idx}`, text: t, index: idx++ });
  }
}

let matches = 0;
for (const scene of scenesData) {
  let best = 0;
  for (const anchor of anchors) {
    best = Math.max(best, scoreSceneHeadingMatch(scene.title, anchor.text));
  }
  if (best >= 70) matches += 1;
}

console.log(JSON.stringify({ anchors: anchors.length, scenes: scenesData.length, matches }, null, 2));
