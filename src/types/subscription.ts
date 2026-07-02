export type SubscriptionPlan = 'free' | 'pro';

export const SUBSCRIPTION_PLAN_LABELS: Record<SubscriptionPlan, string> = {
  free: 'Free',
  pro: 'Pro',
};

export const FREE_PLAN_LIMITS = {
  maxOwnedTheaters: 1,
  maxActivePlays: 1,
} as const;

export const PRO_PRICING = {
  monthlyRub: 590,
  yearlyRub: 4900,
} as const;

export const SUPPORT_EMAIL = 'hello@rehears.ru';
