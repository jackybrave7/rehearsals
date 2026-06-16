import fs from 'node:fs';
import type { Express, Request, Response } from 'express';
import { requireAuth } from './auth.js';
import { getDb } from './db.js';
import {
  getFileRecord,
  getFileStoragePath,
  MAX_FILE_BYTES,
  publicFileUrl,
  saveBufferAsFile,
} from './fileStorage.js';

export function registerFileRoutes(app: Express): void {
  app.post('/api/files', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : 'file';
    const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType : 'application/octet-stream';
    const dataBase64 = typeof req.body?.dataBase64 === 'string' ? req.body.dataBase64 : '';

    if (!dataBase64) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(dataBase64, 'base64');
    } catch {
      res.status(400).json({ error: 'INVALID_BASE64' });
      return;
    }

    if (buffer.byteLength > MAX_FILE_BYTES) {
      res.status(413).json({ error: 'FILE_TOO_LARGE' });
      return;
    }

    try {
      const record = saveBufferAsFile(getDb(), session.user.id, buffer, name, mimeType);
      res.status(201).json({
        fileId: record.id,
        url: publicFileUrl(record.id),
        mimeType: record.mimeType,
        size: record.sizeBytes,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UPLOAD_FAILED';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/files/:id', (req: Request, res: Response) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const fileId = req.params.id;
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

    res.setHeader('Content-Type', record.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(record.originalName)}"`
    );
    fs.createReadStream(filePath).pipe(res);
  });
}
