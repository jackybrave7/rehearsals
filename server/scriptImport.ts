import fs from 'node:fs';
import mammoth from 'mammoth';
import type { Scene } from '../src/types/index.js';
import {
  extractSectionsFromPlainText,
  isSupportedScriptImportFile,
  stripHtmlTags,
  syncScenesFromScriptText,
} from '../src/utils/scriptDocument.js';
import type { DocTextAnchor } from '../src/utils/googleDocs.js';
import { getDb } from './db.js';
import { getFileRecord, getFileStoragePath } from './fileStorage.js';
import { requireAuth } from './auth.js';
import type { Request, Response } from 'express';

async function extractDocxHeadingAnchors(buffer: Buffer): Promise<DocTextAnchor[]> {
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const anchors: DocTextAnchor[] = [];
  const headingPattern = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = headingPattern.exec(html)) !== null) {
    const text = stripHtmlTags(match[1]).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    anchors.push({
      type: 'heading',
      id: `file-${index}`,
      text,
      index,
    });
    index += 1;
  }

  return anchors;
}

export async function parseScriptFileBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ text: string; anchors: DocTextAnchor[] }> {
  if (!isSupportedScriptImportFile(fileName, mimeType)) {
    throw new Error('UNSUPPORTED_FORMAT');
  }

  const lower = fileName.toLowerCase();
  const isDocx =
    lower.endsWith('.docx') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (isDocx) {
    const text = (await mammoth.extractRawText({ buffer })).value.replace(/\r\n/g, '\n');
    let anchors = await extractDocxHeadingAnchors(buffer);
    if (anchors.length === 0) {
      anchors = extractSectionsFromPlainText(text);
    }
    return { text, anchors };
  }

  const text = buffer.toString('utf-8').replace(/\r\n/g, '\n');
  return { text, anchors: extractSectionsFromPlainText(text) };
}

export async function handleParseScriptImport(req: Request, res: Response): Promise<void> {
  const session = requireAuth(req, res);
  if (!session) return;

  const fileId = typeof req.body?.fileId === 'string' ? req.body.fileId.trim() : '';
  const scenes = Array.isArray(req.body?.scenes) ? (req.body.scenes as Scene[]) : null;

  if (!fileId || !scenes || scenes.length === 0) {
    res.status(400).json({ error: 'INVALID_BODY' });
    return;
  }

  const record = getFileRecord(getDb(), fileId);
  if (!record) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const filePath = getFileStoragePath(fileId);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  try {
    const buffer = fs.readFileSync(filePath);
    const { text, anchors } = await parseScriptFileBuffer(
      buffer,
      record.originalName,
      record.mimeType
    );
    const { matches, characterCounts } = syncScenesFromScriptText(text, anchors, scenes);

    res.json({
      anchorCount: anchors.length,
      matches,
      characterCounts: Object.fromEntries(characterCounts.entries()),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PARSE_FAILED';
    if (message === 'UNSUPPORTED_FORMAT') {
      res.status(400).json({ error: message, message: 'Поддерживаются файлы .txt и .docx' });
      return;
    }
    console.error('[api] script import failed', message);
    res.status(500).json({ error: 'PARSE_FAILED', message });
  }
}
