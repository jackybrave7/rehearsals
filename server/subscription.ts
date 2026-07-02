import type { AppState, Play } from '../src/types/index.js';
import type { SubscriptionPlan } from '../src/types/subscription.js';
import { FREE_PLAN_LIMITS } from '../src/types/subscription.js';
import type { AppDatabase } from './db.js';
import { isPlatformAdminEmail } from './platformAdmin.js';

export function normalizeSubscriptionPlan(value: unknown): SubscriptionPlan {
  return value === 'pro' ? 'pro' : 'free';
}

export function getUserSubscriptionPlan(
  db: AppDatabase,
  userId: string,
  email: string
): SubscriptionPlan {
  if (isPlatformAdminEmail(email)) return 'pro';
  const row = db.prepare(`SELECT subscription_plan FROM users WHERE id = ?`).get(userId) as
    | { subscription_plan: string | null }
    | undefined;
  return normalizeSubscriptionPlan(row?.subscription_plan);
}

export function setUserSubscriptionPlan(
  db: AppDatabase,
  userId: string,
  plan: SubscriptionPlan
): boolean {
  const result = db
    .prepare(`UPDATE users SET subscription_plan = ? WHERE id = ?`)
    .run(plan, userId);
  return result.changes > 0;
}

export function isPlayActive(play: Pick<Play, 'archivedAt'>): boolean {
  return !play.archivedAt;
}

function isTheaterOwnedByUser(
  db: AppDatabase,
  theaterId: string,
  userId: string,
  newTheaterIds: Set<string>
): boolean {
  if (newTheaterIds.has(theaterId)) return true;
  const row = db.prepare(`SELECT owner_user_id FROM theaters WHERE id = ?`).get(theaterId) as
    | { owner_user_id: string | null }
    | undefined;
  if (!row) return false;
  return row.owner_user_id === userId;
}

export function validateSubscriptionLimits(
  db: AppDatabase,
  userId: string,
  email: string,
  mergedState: AppState,
  previousState: AppState,
  newTheaterIds: Set<string>
): void {
  const plan = getUserSubscriptionPlan(db, userId, email);
  if (plan === 'pro') return;

  const ownedTheaters = mergedState.theaters.filter((theater) =>
    isTheaterOwnedByUser(db, theater.id, userId, newTheaterIds)
  );
  const previousOwnedTheaters = previousState.theaters.filter((theater) =>
    isTheaterOwnedByUser(db, theater.id, userId, new Set())
  );

  if (
    ownedTheaters.length > FREE_PLAN_LIMITS.maxOwnedTheaters &&
    ownedTheaters.length > previousOwnedTheaters.length
  ) {
    throw new Error('SUBSCRIPTION_THEATER_LIMIT');
  }

  const ownedTheaterIds = new Set(ownedTheaters.map((theater) => theater.id));
  const previousOwnedTheaterIds = new Set(previousOwnedTheaters.map((theater) => theater.id));

  const activePlays = mergedState.plays.filter(
    (play) => play.theaterId && ownedTheaterIds.has(play.theaterId) && isPlayActive(play)
  );
  const previousActivePlays = previousState.plays.filter(
    (play) => play.theaterId && previousOwnedTheaterIds.has(play.theaterId) && isPlayActive(play)
  );

  if (
    activePlays.length > FREE_PLAN_LIMITS.maxActivePlays &&
    activePlays.length > previousActivePlays.length
  ) {
    throw new Error('SUBSCRIPTION_PLAY_LIMIT');
  }
}
