import type { Play, Scene } from '../types/index.js';
import {
  extractLearnTextFromDocxParagraphs,
  findParagraphIndexByFileAnchorId,
  htmlToDocxParagraphs,
  paragraphsToLearnScriptText,
} from '../src/utils/docxLearnText.js';
import { extractSceneBodyTextsFromPlainText } from '../src/utils/sceneDescription.js';
import { isImportableSceneHeading, matchScenesToDocAnchors } from '../src/utils/googleDocs.js';
import { parseScriptFileId } from '../src/utils/scriptDocument.js';
import { getDb } from './db.js';
import { getFileRecord, getFileStoragePath } from './fileStorage.js';
import { parseScriptFileBuffer } from './scriptImport.js';
import fs from 'node:fs';
import mammoth from 'mammoth';

function isDocxFile(fileName: string, mimeType: string): boolean {
  const lower = fileName.toLowerCase();
  return (
    lower.endsWith('.docx') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

export async function resolveSceneBodyFromScriptFile(
  play: Play,
  scene: Scene
): Promise<string | null> {
  const fileId = parseScriptFileId(play.scriptFileUrl);
  if (!fileId) return null;

  const record = getFileRecord(getDb(), fileId);
  if (!record) return null;

  const filePath = getFileStoragePath(fileId);
  if (!fs.existsSync(filePath)) return null;

  const buffer = fs.readFileSync(filePath);

  if (isDocxFile(record.originalName, record.mimeType)) {
    const { value: html } = await mammoth.convertToHtml({ buffer });
    const paragraphs = htmlToDocxParagraphs(html);
    const fromLearn = extractLearnTextFromDocxParagraphs(paragraphs, scene);
    if (fromLearn) return fromLearn;

    const { anchors } = await parseScriptFileBuffer(buffer, record.originalName, record.mimeType);
    const match = matchScenesToDocAnchors([scene], anchors).find(
      (item) => item.sceneId === scene.id && item.score >= 70
    );
    if (match) {
      let headingIndex = scene.scriptAnchor?.id.startsWith('file-')
        ? findParagraphIndexByFileAnchorId(paragraphs, scene.scriptAnchor.id)
        : -1;
      if (headingIndex < 0 && match.anchor.id.startsWith('file-')) {
        headingIndex = findParagraphIndexByFileAnchorId(paragraphs, match.anchor.id);
      }
      if (headingIndex < 0) {
        const normalizedAnchor = match.anchorText.trim().toLowerCase();
        headingIndex = paragraphs.findIndex(
          (paragraph) => paragraph.plainText.trim().toLowerCase() === normalizedAnchor
        );
      }
      if (headingIndex >= 0) {
        const bodyParagraphs = [];
        for (let index = headingIndex + 1; index < paragraphs.length; index += 1) {
          const paragraph = paragraphs[index];
          if (paragraph.isHeading || isImportableSceneHeading(paragraph.plainText)) break;
          bodyParagraphs.push(paragraph);
        }
        const merged = paragraphsToLearnScriptText(bodyParagraphs).trim();
        if (merged) return merged;
      }
    }

    return null;
  }

  const { text, anchors } = await parseScriptFileBuffer(
    buffer,
    record.originalName,
    record.mimeType
  );

  let sceneForExtraction = scene;
  if (!scene.scriptAnchor?.id.startsWith('file-')) {
    const match = matchScenesToDocAnchors([scene], anchors).find(
      (item) => item.sceneId === scene.id && item.score >= 70
    );
    if (!match) return null;
    sceneForExtraction = { ...scene, scriptAnchor: match.anchor };
  }

  let body =
    extractSceneBodyTextsFromPlainText(text, anchors, [sceneForExtraction]).get(scene.id) ?? '';
  if (!body.trim()) {
    const match = matchScenesToDocAnchors([scene], anchors).find(
      (item) => item.sceneId === scene.id && item.score >= 70
    );
    if (match) {
      body =
        extractSceneBodyTextsFromPlainText(text, anchors, [
          { ...scene, scriptAnchor: match.anchor },
        ]).get(scene.id) ?? '';
    }
  }

  return body.trim() || null;
}
