import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEMO_CHAIKA_SCRIPT_FILE_ID,
  DEMO_CHAIKA_SCRIPT_FILE_NAME,
  DEMO_CHAIKA_SCRIPT_MIME,
} from '../src/data/demoChaikaPlayMaterial.js';
import type { AppDatabase } from './db.js';
import {
  ensureUploadsDir,
  getFileRecord,
  getFileStoragePath,
  insertFileRecord,
  type StoredFile,
} from './fileStorage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const bundledDocxPath = path.join(projectRoot, 'data', 'demo-assets', 'chaika-inscenirovka.docx');

function resolveDemoFileOwnerId(db: AppDatabase): string | null {
  const row = db.prepare(`SELECT id FROM users ORDER BY created_at ASC LIMIT 1`).get() as
    | { id: string }
    | undefined;
  return row?.id ?? null;
}

/** Кладёт учебный .docx «Чайка» в uploads с фиксированным id (идемпотентно). */
export function seedDemoPlayAssets(db: AppDatabase): void {
  if (!fs.existsSync(bundledDocxPath)) {
    console.warn('[demo-assets] bundled chaika docx missing:', bundledDocxPath);
    return;
  }

  const ownerUserId = resolveDemoFileOwnerId(db);
  if (!ownerUserId) return;

  const buffer = fs.readFileSync(bundledDocxPath);
  const destPath = getFileStoragePath(DEMO_CHAIKA_SCRIPT_FILE_ID);
  const existing = getFileRecord(db, DEMO_CHAIKA_SCRIPT_FILE_ID);

  ensureUploadsDir();
  if (
    existing &&
    fs.existsSync(destPath) &&
    fs.statSync(destPath).size === buffer.byteLength
  ) {
    return;
  }

  fs.writeFileSync(destPath, buffer);

  const record: StoredFile = {
    id: DEMO_CHAIKA_SCRIPT_FILE_ID,
    ownerUserId,
    originalName: DEMO_CHAIKA_SCRIPT_FILE_NAME,
    mimeType: DEMO_CHAIKA_SCRIPT_MIME,
    sizeBytes: buffer.byteLength,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };

  if (existing) {
    db.prepare(
      `UPDATE files SET owner_user_id = ?, original_name = ?, mime_type = ?, size_bytes = ? WHERE id = ?`
    ).run(ownerUserId, record.originalName, record.mimeType, record.sizeBytes, record.id);
  } else {
    insertFileRecord(db, record);
  }

  console.log(`[demo-assets] Chaika script file ready at ${destPath}`);
}
