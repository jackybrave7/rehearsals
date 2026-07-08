import type { SubscriptionPlan } from '../src/types/subscription.js';
import { FREE_PLAN_LIMITS } from '../src/types/subscription.js';
import type { AppState, Play } from '../src/types/index.js';
import type { AppDatabase } from './db.js';
import { isPlatformAdminEmail } from './platformAdmin.js';

export type ProDurationPreset = 'unlimited' | '1m' | '3m' | '12m';

export function normalizeSubscriptionPlan(value: unknown): SubscriptionPlan {
  return value === 'pro' ? 'pro' : 'free';
}

export function isProSubscriptionActive(
  storedPlan: SubscriptionPlan,
  proExpiresAt: string | null | undefined,
  now = Date.now()
): boolean {
  if (storedPlan !== 'pro') return false;
  if (!proExpiresAt) return true;
  return new Date(proExpiresAt).getTime() > now;
}

export function getStoredSubscription(
  db: AppDatabase,
  userId: string
): { plan: SubscriptionPlan; proExpiresAt: string | null } {
  const row = db
    .prepare(`SELECT subscription_plan, subscription_pro_expires_at FROM users WHERE id = ?`)
    .get(userId) as
    | { subscription_plan: string | null; subscription_pro_expires_at: string | null }
    | undefined;
  return {
    plan: normalizeSubscriptionPlan(row?.subscription_plan),
    proExpiresAt: row?.subscription_pro_expires_at ?? null,
  };
}

export function getUserSubscriptionPlan(
  db: AppDatabase,
  userId: string,
  email: string
): SubscriptionPlan {
  if (isPlatformAdminEmail(email)) return 'pro';
  const { plan, proExpiresAt } = getStoredSubscription(db, userId);
  return isProSubscriptionActive(plan, proExpiresAt) ? 'pro' : 'free';
}

export function getUserSubscriptionProExpiresAt(
  db: AppDatabase,
  userId: string,
  email: string
): string | null {
  if (isPlatformAdminEmail(email)) return null;
  const { plan, proExpiresAt } = getStoredSubscription(db, userId);
  if (!isProSubscriptionActive(plan, proExpiresAt)) return null;
  return proExpiresAt;
}

export function resolveProExpiresAt(
  preset: ProDurationPreset | 'custom',
  customDate?: string
): string | null {
  if (preset === 'unlimited') return null;
  if (preset === 'custom') {
    if (!customDate?.trim()) return null;
    const date = new Date(`${customDate.trim()}T23:59:59.999`);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }
  const months = preset === '1m' ? 1 : preset === '3m' ? 3 : 12;
  const expires = new Date();
  expires.setMonth(expires.getMonth() + months);
  return expires.toISOString();
}

export function setUserSubscriptionPlan(
  db: AppDatabase,
  userId: string,
  plan: SubscriptionPlan,
  proExpiresAt: string | null = null
): boolean {
  if (plan === 'free') {
    const result = db
      .prepare(
        `UPDATE users SET subscription_plan = 'free', subscription_pro_expires_at = NULL WHERE id = ?`
      )
      .run(userId);
    return result.changes > 0;
  }

  const result = db
    .prepare(
      `UPDATE users SET subscription_plan = 'pro', subscription_pro_expires_at = ? WHERE id = ?`
    )
    .run(proExpiresAt, userId);
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

export function stripProOnlyRehearsalFields(
  db: AppDatabase,
  userId: string,
  email: string,
  state: AppState
): AppState {
  if (getUserSubscriptionPlan(db, userId, email) === 'pro') return state;

  let changed = false;
  const rehearsals = state.rehearsals.map((rehearsal) => {
    if (!rehearsal.outcomePhotoUrls?.length) return rehearsal;
    changed = true;
    const { outcomePhotoUrls: _removed, ...rest } = rehearsal;
    return rest;
  });

  return changed ? { ...state, rehearsals } : state;
}
