import type { SubscriptionPlan } from '../types/subscription';
import { FREE_PLAN_LIMITS, PRO_PRICING, SUBSCRIPTION_PLAN_LABELS } from '../types/subscription';
import type { AppState, Play } from '../types';

export function isProPlan(plan: SubscriptionPlan | undefined, isPlatformAdmin = false): boolean {
  return isPlatformAdmin || plan === 'pro';
}

export function isPlayActive(play: Pick<Play, 'archivedAt'>): boolean {
  return !play.archivedAt;
}

export function isPlayReadOnly(play: Pick<Play, 'archivedAt'>): boolean {
  return Boolean(play.archivedAt);
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

export function formatAdminSubscriptionLabel(
  plan: 'free' | 'pro',
  options?: {
    storedPlan?: 'free' | 'pro';
    expiresAt?: string | null;
  }
): string {
  const stored = options?.storedPlan ?? plan;
  const expiresAt = options?.expiresAt ?? null;
  if (plan === 'free' && stored === 'pro') return 'Pro (истёк)';
  if (plan === 'pro' && !expiresAt) return 'Pro · без срока';
  if (plan === 'pro' && expiresAt) {
    try {
      const date = new Date(expiresAt);
      return `Pro до ${date.toLocaleDateString('ru-RU')}`;
    } catch {
      return 'Pro';
    }
  }
  return SUBSCRIPTION_PLAN_LABELS[plan];
}

export {
  FREE_PLAN_LIMITS,
  PRO_PRICING,
  SUBSCRIPTION_PLAN_LABELS,
  SUPPORT_EMAIL,
} from '../types/subscription';
