import { loadEnvFile } from '../server/env.js';
loadEnvFile();

import { getDb } from '../server/db.js';
import { getTelegramBotToken } from '../server/telegram.js';
import { loadState } from '../server/stateRepository.js';
import { getParticipatingActorIds } from '../src/utils/rehearsalActors.js';
import {
  resolveTheaterReminderSettings,
  isReminderTypeDue,
  isRehearsalInFuture,
} from '../src/utils/reminders.js';

if (process.argv.includes('--tick')) {
  const { runReminderTick } = await import('../server/reminderScheduler.js');
  await runReminderTick();
  console.log('reminder tick completed');
  process.exit(0);
}

const rid = process.argv[2] ?? 'ab77f9af-5d57-41ba-a2ac-82f0c7d11ccb';
const db = getDb();

const rehearsal = db
  .prepare(
    `SELECT id, theater_id, date, start_time, reminder_opt_out, reminders_sent, actor_ids FROM rehearsals WHERE id = ?`
  )
  .get(rid);

console.log('rehearsal:', rehearsal);
if (!rehearsal) process.exit(0);

const theater = db
  .prepare(`SELECT id, name, owner_user_id, reminder_settings FROM theaters WHERE id = ?`)
  .get(rehearsal.theater_id);
console.log('theater:', theater);

const actors = db
  .prepare(
    `SELECT id, name, telegram_username,
      CASE WHEN telegram_chat_id IS NOT NULL AND trim(telegram_chat_id) != '' THEN 1 ELSE 0 END AS bot_linked
     FROM actors WHERE theater_id = ?`
  )
  .all(rehearsal.theater_id);
console.log('actors:', actors);

console.log('bot_configured:', Boolean(getTelegramBotToken()));

const ownerId = theater?.owner_user_id;
if (!ownerId) {
  console.log('no owner_user_id on theater');
  process.exit(0);
}

const theaterIds = db
  .prepare(`SELECT id FROM theaters WHERE owner_user_id = ?`)
  .all(ownerId)
  .map((row) => row.id);
const state = loadState(db, { userId: ownerId, theaterIds });
const r = state?.rehearsals.find((item) => item.id === rid);
const theaterState = state?.theaters.find((item) => item.id === rehearsal.theater_id) ?? {};
const settings = resolveTheaterReminderSettings(theaterState, state?.appMeta);
console.log('reminder_settings:', settings);

if (r) {
  console.log('participating:', getParticipatingActorIds(state, r));
  console.log('actorIds:', r.actorIds);
  console.log('reminderOptOut:', r.reminderOptOut);
  console.log('remindersSent:', r.remindersSent);
  const now = new Date();
  console.log('now:', now.toISOString());
  console.log('in_future:', isRehearsalInFuture(rehearsal.date, rehearsal.start_time, now));
  for (const type of settings.types) {
    console.log(`due_now_${type}:`, isReminderTypeDue(type, rehearsal.date, rehearsal.start_time, now, 10));
  }
}
