import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppState } from '../src/types/index.js';
import { getDbPath } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backupDir = path.join(path.resolve(__dirname, '..'), 'data', 'backups');
const MAX_BACKUPS = 30;

function formatBackupName(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.json`;
}

export function getBackupDir(): string {
  return backupDir;
}

export function backupState(state: AppState): string | null {
  fs.mkdirSync(backupDir, { recursive: true });
  const filename = formatBackupName(new Date());
  const filePath = path.join(backupDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(state), 'utf-8');

  const files = fs
    .readdirSync(backupDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .reverse();

  for (const stale of files.slice(MAX_BACKUPS)) {
    fs.unlinkSync(path.join(backupDir, stale));
  }

  return filename;
}

export function listBackupFiles(): string[] {
  if (!fs.existsSync(backupDir)) return [];
  return fs
    .readdirSync(backupDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .reverse();
}

export function loadBackupState(filename: string): AppState | null {
  const safeName = path.basename(filename);
  if (!safeName.endsWith('.json')) return null;

  const filePath = path.join(backupDir, safeName);
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as AppState;
  } catch {
    return null;
  }
}

export function loadLatestBackupState(): AppState | null {
  const [latest] = listBackupFiles();
  if (!latest) return null;
  return loadBackupState(latest);
}

export function getDbInfo(): { path: string; exists: boolean; size: number } {
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    return { path: dbPath, exists: false, size: 0 };
  }
  return { path: dbPath, exists: true, size: fs.statSync(dbPath).size };
}
