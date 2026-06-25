import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import { getDb, type AppDatabase } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
export const uploadsDir = path.join(projectRoot, 'data', 'uploads');

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export interface StoredFile {
  id: string;
  ownerUserId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export function ensureUploadsDir(): void {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export function getFileStoragePath(fileId: string): string {
  return path.join(uploadsDir, fileId);
}

export function publicFileUrl(fileId: string): string {
  return `/api/files/${fileId}`;
}

export function insertFileRecord(
  db: AppDatabase,
  record: StoredFile
): void {
  db.prepare(
    `INSERT INTO files (id, owner_user_id, original_name, mime_type, size_bytes, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    record.id,
    record.ownerUserId,
    record.originalName,
    record.mimeType,
    record.sizeBytes,
    record.createdAt
  );
}

export function getFileRecord(db: AppDatabase, fileId: string): StoredFile | null {
  const row = db.prepare(`SELECT * FROM files WHERE id = ?`).get(fileId) as
    | {
        id: string;
        owner_user_id: string;
        original_name: string;
        mime_type: string;
        size_bytes: number;
        created_at: string;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}

export function saveBufferAsFile(
  db: AppDatabase,
  ownerUserId: string,
  buffer: Buffer,
  originalName: string,
  mimeType: string
): StoredFile {
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error('FILE_TOO_LARGE');
  }

  ensureUploadsDir();
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  fs.writeFileSync(getFileStoragePath(id), buffer);

  const record: StoredFile = {
    id,
    ownerUserId,
    originalName,
    mimeType: mimeType || 'application/octet-stream',
    sizeBytes: buffer.byteLength,
    createdAt,
  };
  insertFileRecord(db, record);
  return record;
}

export function saveDataUrlAsFile(
  db: AppDatabase,
  ownerUserId: string,
  dataUrl: string,
  originalName: string
): StoredFile {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('INVALID_DATA_URL');
  const mimeType = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  return saveBufferAsFile(db, ownerUserId, buffer, originalName, mimeType);
}

export function deleteStoredFile(db: AppDatabase, fileId: string): void {
  const filePath = getFileStoragePath(fileId);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(`[files] failed to delete file ${fileId}`, error);
  }
  db.prepare('DELETE FROM files WHERE id = ?').run(fileId);
}

export function deleteUserFiles(db: AppDatabase, userId: string): number {
  const rows = db.prepare('SELECT id FROM files WHERE owner_user_id = ?').all(userId) as Array<{
    id: string;
  }>;
  for (const row of rows) {
    deleteStoredFile(db, row.id);
  }
  return rows.length;
}
