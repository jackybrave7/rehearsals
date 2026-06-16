import express from 'express';
import cors from 'cors';
import { closeDb, getDb, getDbPath } from './db.js';
import { loadEnvFile } from './env.js';
import { isEmptyState, loadState, saveState } from './stateRepository.js';
import { loadStateForUser, saveStateForUser } from './stateUserScope.js';
import { registerAuthRoutes, requireAuth } from './auth.js';
import { registerFileRoutes } from './fileRoutes.js';
import type { AppState } from '../src/types/index.js';
import { getTelegramConfig, sendTelegramHtmlMessage } from './telegram.js';
import {
  getDbInfo,
  listBackupFiles,
  loadBackupState,
  loadLatestBackupState,
} from './backup.js';
import { handleFetchGoogleDocument } from './googleDocs.js';
import { startReminderScheduler } from './reminderScheduler.js';

loadEnvFile();

const PORT = Number(process.env.API_PORT ?? 3001);

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '25mb' }));

registerAuthRoutes(app);
registerFileRoutes(app);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'rehearsals', db: getDbPath(), ...getDbInfo(), backups: listBackupFiles().length });
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
  const session = requireAuth(req, res);
  if (!session) return;

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
    saveStateForUser(state, session, getDb());
    const loaded = loadStateForUser(session, getDb());
    res.json(loaded ?? state);
  } catch (error) {
    console.error('[api] restore failed', error);
    res.status(500).json({ error: 'RESTORE_FAILED' });
  }
});

app.get('/api/state', (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;

  const state = loadStateForUser(session, getDb());
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
  const session = requireAuth(req, res);
  if (!session) return;

  const state = req.body as AppState;
  if (!state || typeof state !== 'object' || !Array.isArray(state.plays)) {
    res.status(400).json({ error: 'INVALID_STATE' });
    return;
  }

  try {
    saveStateForUser(state, session, getDb());
    console.log(
      `[api] saved for ${session.user.email}: ${state.rehearsals.length} rehearsals, ${state.scenes.length} scenes`
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('[api] save failed', error);
    const message = error instanceof Error ? error.message : 'SAVE_FAILED';
    const status =
      message === 'FORBIDDEN' ? 403 : message === 'WOULD_LOSE_USER_DATA' ? 409 : 500;
    res.status(status).json({
      error: message === 'WOULD_LOSE_USER_DATA' ? 'WOULD_LOSE_USER_DATA' : message,
      message,
    });
  }
});

const server = app.listen(PORT, () => {
  getDb();
  console.log(`[api] SQLite: ${getDbPath()}`);
  console.log(`[api] http://localhost:${PORT}`);
  startReminderScheduler();
});

function shutdown() {
  server.close();
  closeDb();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
