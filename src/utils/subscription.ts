import type { SubscriptionPlan } from '../types/subscription';
import { FREE_PLAN_LIMITS, PRO_PRICING } from '../types/subscription';
import type { AppState, Play } from '../types';

export function isProPlan(plan: SubscriptionPlan | undefined, isPlatformAdmin = false): boolean {
  return isPlatformAdmin || plan === 'pro';
}

export function isPlayActive(play: Pick<Play, 'archivedAt'>): boolean {
  return !play.archivedAt;
}

export function isPlayReadOnly(play: Pick<Play, 'archivedAt'>, isPro: boolean): boolean {
  return !isPro && Boolean(play.archivedAt);
}

export function countOwnedActivePlays(state: AppState, ownedTheaterIds: Set<string>): number {
  return state.plays.filter(
    (play) => play.theaterId && ownedTheaterIds.has(play.theaterId) && isPlayActive(play)
  ).length;
}

export function getOwnedTheaterIdsFromAccess(
  theaters: Array<{ theaterId: string; role: string }>
): Set<string> {
  return new Set(theaters.filter((entry) => entry.role === 'owner').map((entry) => entry.theaterId));
}

export function canCreateTheater(ownedTheaterCount: number, isPro: boolean): boolean {
  return isPro || ownedTheaterCount < FREE_PLAN_LIMITS.maxOwnedTheaters;
}

export function canCreateActivePlay(activePlayCount: number, isPro: boolean): boolean {
  return isPro || activePlayCount < FREE_PLAN_LIMITS.maxActivePlays;
}

export function formatYearlyMonthlyPrice(): string {
  return `${Math.round(PRO_PRICING.yearlyRub / 12)} ₽`;
}

export {
  FREE_PLAN_LIMITS,
  PRO_PRICING,
  SUBSCRIPTION_PLAN_LABELS,
  SUPPORT_EMAIL,
} from '../types/subscription';
