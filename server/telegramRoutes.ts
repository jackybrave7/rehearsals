import type { Express } from 'express';
import { getDb } from './db.js';
import { canEditTheater, requireAuth } from './auth.js';
import {
  discoverTelegramGroupChats,
  getTelegramBotInfo,
  getTelegramBotToken,
  getTheaterTelegramChatId,
  sendTelegramHtmlMessage,
  sendTelegramHtmlToTheater,
} from './telegram.js';
import { listRecentTelegramGroupChats } from './telegramGroupChatCache.js';
import { getReminderSchedulerConfig } from './reminderScheduler.js';

export function registerTelegramRoutes(app: Express) {
  app.get('/api/telegram/config', async (req, res) => {
    const theaterId =
      typeof req.query.theaterId === 'string' ? req.query.theaterId.trim() : '';
    const bot = await getTelegramBotInfo();
    const chatId = theaterId ? getTheaterTelegramChatId(getDb(), theaterId) : null;
    const scheduler = getReminderSchedulerConfig();

    res.json({
      configured: bot.configured && Boolean(chatId),
      botConfigured: bot.configured,
      botUsername: bot.username,
      chatConfigured: Boolean(chatId),
      remindersSchedulerActive: scheduler.active,
      reminderTickMinutes: scheduler.tickMinutes,
      reminderWindowMinutes: scheduler.windowMinutes,
    });
  });

  app.get('/api/telegram/group-chats', async (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const theaterId =
      typeof req.query.theaterId === 'string' ? req.query.theaterId.trim() : '';
    if (!theaterId || !canEditTheater(session, theaterId)) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }

    const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
    try {
      const chats = refresh
        ? await discoverTelegramGroupChats()
        : listRecentTelegramGroupChats();
      res.json({ chats });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'DISCOVER_FAILED';
      const status = message === 'BOT_NOT_CONFIGURED' ? 503 : 500;
      res.status(status).json({ error: message, message });
    }
  });

  app.post('/api/telegram/send', async (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const theaterId = typeof req.body?.theaterId === 'string' ? req.body.theaterId.trim() : '';
    const html = req.body?.html;
    if (!theaterId) {
      res.status(400).json({ error: 'INVALID_THEATER' });
      return;
    }
    if (!canEditTheater(session, theaterId)) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }
    if (typeof html !== 'string' || !html.trim()) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }

    try {
      await sendTelegramHtmlToTheater(getDb(), theaterId, html.trim());
      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SEND_FAILED';
      console.error('[api] telegram send failed', message);
      const status = message === 'BOT_NOT_CONFIGURED' || message === 'CHAT_NOT_CONFIGURED' ? 503 : 500;
      res.status(status).json({ error: message, message });
    }
  });

  app.post('/api/telegram/test', async (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const theaterId = typeof req.body?.theaterId === 'string' ? req.body.theaterId.trim() : '';
    const chatIdOverride =
      typeof req.body?.chatId === 'string' ? req.body.chatId.trim() : '';
    if (!theaterId) {
      res.status(400).json({ error: 'INVALID_THEATER' });
      return;
    }
    if (!canEditTheater(session, theaterId)) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }

    const token = getTelegramBotToken();
    const chatId = chatIdOverride || getTheaterTelegramChatId(getDb(), theaterId);
    if (!token) {
      res.status(503).json({ error: 'BOT_NOT_CONFIGURED', message: 'BOT_NOT_CONFIGURED' });
      return;
    }
    if (!chatId) {
      res.status(503).json({ error: 'CHAT_NOT_CONFIGURED', message: 'CHAT_NOT_CONFIGURED' });
      return;
    }

    try {
      await sendTelegramHtmlMessage(
        chatId,
        '<b>Репетиции</b>\nТестовое сообщение — чат театра подключён.',
        token
      );
      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SEND_FAILED';
      console.error('[api] telegram test failed', message);
      const status = message === 'BOT_NOT_CONFIGURED' || message === 'CHAT_NOT_CONFIGURED' ? 503 : 500;
      res.status(status).json({ error: message, message });
    }
  });
}
