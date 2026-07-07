import express from 'express';
import cors from 'cors';
import dns from 'node:dns';
import { closeDb, getDb, getDbPath } from './db.js';
import { loadEnvFile } from './env.js';
import { isEmptyState, loadState, saveState } from './stateRepository.js';
import { loadStateForUser, saveStateForUser } from './stateUserScope.js';
import { registerAuthRoutes, requireAuth } from './auth.js';
import { registerFileRoutes } from './fileRoutes.js';
import { registerAdminRoutes } from './adminStats.js';
import { registerAdminDeleteUserRoutes } from './adminDeleteUser.js';
import { registerAdminSubscriptionRoutes } from './adminSubscription.js';
import { registerAdminPlatformSettingsRoutes } from './adminPlatformSettings.js';
import { registerAdminEmailVerificationRoutes } from './adminEmailVerification.js';
import { registerAdminMailDeliverabilityRoutes } from './adminMailDeliverability.js';
import { registerSupportTicketRoutes } from './supportTickets.js';
import { registerAdminSupportTicketRoutes } from './adminSupportTickets.js';
import type { AppState } from '../src/types/index.js';
import { registerTelegramRoutes } from './telegramRoutes.js';
import {
  getDbInfo,
  listBackupFiles,
  loadBackupState,
  loadLatestBackupState,
} from './backup.js';
import { handleFetchGoogleDocument } from './googleDocs.js';
import { handleParseScriptImport, handleSceneBodyText } from './scriptImport.js';
import { startReminderScheduler } from './reminderScheduler.js';
import { startTelegramLinkPoller } from './telegramLinkPoller.js';
import { registerActorSelfRoutes } from './actorSelfRoutes.js';
import { registerRehearsalNotesRoutes } from './rehearsalNotesRoutes.js';

// Docker на VPS часто резолвит api.telegram.org в IPv6 без маршрута — fetch таймаутится.
dns.setDefaultResultOrder('ipv4first');

loadEnvFile();

const PORT = Number(process.env.API_PORT ?? 3001);

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '25mb' }));

registerAuthRoutes(app);
registerFileRoutes(app);
registerAdminRoutes(app);
registerAdminDeleteUserRoutes(app);
registerAdminSubscriptionRoutes(app);
registerAdminPlatformSettingsRoutes(app);
registerAdminEmailVerificationRoutes(app);
registerAdminMailDeliverabilityRoutes(app);
registerSupportTicketRoutes(app);
registerAdminSupportTicketRoutes(app);
registerTelegramRoutes(app);
registerActorSelfRoutes(app);
registerRehearsalNotesRoutes(app);

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

app.get('/api/google-docs/documents/:documentId', (req, res) => {
  void handleFetchGoogleDocument(req, res);
});

app.post('/api/script-import/parse', (req, res) => {
  void handleParseScriptImport(req, res);
});

app.post('/api/script-import/scene-body', (req, res) => {
  void handleSceneBodyText(req, res);
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
      message === 'FORBIDDEN'
        ? 403
        : message === 'WOULD_LOSE_USER_DATA'
          ? 409
          : message === 'SUBSCRIPTION_THEATER_LIMIT' || message === 'SUBSCRIPTION_PLAY_LIMIT'
            ? 402
            : 500;
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
  startTelegramLinkPoller();
});

function shutdown() {
  server.close();
  closeDb();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
