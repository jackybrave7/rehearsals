import express from 'express';
import cors from 'cors';
import { closeDb, getDb, getDbPath } from './db.js';
import { loadEnvFile } from './env.js';
import { isEmptyState, loadState, saveState } from './stateRepository.js';
import type { AppState } from '../src/types/index.js';
import { getTelegramConfig, sendTelegramHtmlMessage } from './telegram.js';
import {
  getDbInfo,
  listBackupFiles,
  loadBackupState,
  loadLatestBackupState,
} from './backup.js';
import { handleFetchGoogleDocument } from './googleDocs.js';

loadEnvFile();

const PORT = Number(process.env.API_PORT ?? 3001);

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '25mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, db: getDbPath(), ...getDbInfo(), backups: listBackupFiles().length });
});

app.get('/api/state/backups', (_req, res) => {
  res.json({ files: listBackupFiles() });
});

app.get('/api/state/backups/latest', (_req, res) => {
  const state = loadLatestBackupState();
  if (!state || isEmptyState(state)) {
    res.status(404).json({ error: 'EMPTY' });
    return;
  }
  res.json(state);
});

app.post('/api/state/restore', (req, res) => {
  const filename = req.body?.filename;
  if (typeof filename !== 'string' || !filename.trim()) {
    res.status(400).json({ error: 'INVALID_FILENAME' });
    return;
  }

  const state = loadBackupState(filename.trim());
  if (!state || isEmptyState(state)) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  try {
    saveState(state, getDb());
    res.json(state);
  } catch (error) {
    console.error('[api] restore failed', error);
    res.status(500).json({ error: 'RESTORE_FAILED' });
  }
});

app.get('/api/state', (_req, res) => {
  const state = loadState(getDb());
  if (!state || isEmptyState(state)) {
    res.status(404).json({ error: 'EMPTY' });
    return;
  }
  res.json(state);
});

app.get('/api/telegram/config', (_req, res) => {
  res.json({ configured: Boolean(getTelegramConfig()) });
});

app.get('/api/google-docs/documents/:documentId', (req, res) => {
  void handleFetchGoogleDocument(req, res);
});

app.post('/api/telegram/send', async (req, res) => {
  const config = getTelegramConfig();
  if (!config) {
    res.status(503).json({ error: 'NOT_CONFIGURED' });
    return;
  }

  const html = req.body?.html;
  if (typeof html !== 'string' || !html.trim()) {
    res.status(400).json({ error: 'INVALID_BODY' });
    return;
  }

  try {
    await sendTelegramHtmlMessage(config, html.trim());
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SEND_FAILED';
    console.error('[api] telegram send failed', message);
    res.status(500).json({ error: 'SEND_FAILED', message });
  }
});

app.put('/api/state', (req, res) => {
  const state = req.body as AppState;
  if (!state || typeof state !== 'object' || !Array.isArray(state.plays)) {
    res.status(400).json({ error: 'INVALID_STATE' });
    return;
  }

  try {
    saveState(state, getDb());
    console.log(
      `[api] saved: ${state.rehearsals.length} rehearsals, ${state.scenes.length} scenes`
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('[api] save failed', error);
    const message = error instanceof Error ? error.message : 'SAVE_FAILED';
    res.status(500).json({
      error: message === 'WOULD_LOSE_USER_DATA' ? 'WOULD_LOSE_USER_DATA' : 'SAVE_FAILED',
      message,
    });
  }
});

const server = app.listen(PORT, () => {
  getDb();
  console.log(`[api] SQLite: ${getDbPath()}`);
  console.log(`[api] http://localhost:${PORT}`);
});

function shutdown() {
  server.close();
  closeDb();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
