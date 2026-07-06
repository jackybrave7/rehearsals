import type { AppDatabase } from './db.js';

export function propagateActorTelegramLinksByEmail(db: AppDatabase): number {
  return db
    .prepare(
      `UPDATE actors
       SET telegram_chat_id = (
         SELECT peer.telegram_chat_id
         FROM actors peer
         WHERE peer.email IS NOT NULL
           AND actors.email IS NOT NULL
           AND lower(trim(peer.email)) = lower(trim(actors.email))
           AND peer.telegram_chat_id IS NOT NULL
           AND trim(peer.telegram_chat_id) != ''
         LIMIT 1
       )
       WHERE (telegram_chat_id IS NULL OR trim(telegram_chat_id) = '')
         AND email IS NOT NULL
         AND trim(email) != ''
         AND EXISTS (
           SELECT 1
           FROM actors peer
           WHERE peer.email IS NOT NULL
             AND lower(trim(peer.email)) = lower(trim(actors.email))
             AND peer.telegram_chat_id IS NOT NULL
             AND trim(peer.telegram_chat_id) != ''
         )`
    )
    .run().changes;
}

export function propagateTelegramChatIdByEmail(
  db: AppDatabase,
  actorId: string,
  chatId: string,
  email: string
): number {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return 0;

  return db
    .prepare(
      `UPDATE actors SET telegram_chat_id = ?
       WHERE id != ? AND email IS NOT NULL AND lower(trim(email)) = ?`
    )
    .run(chatId, actorId, normalizedEmail).changes;
}
