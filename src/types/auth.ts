export type TheaterAccessRole = 'owner' | 'editor' | 'observer';

export type SubscriptionPlan = 'free' | 'pro';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  hasPassword?: boolean;
  subscriptionPlan?: SubscriptionPlan;
  subscriptionProExpiresAt?: string | null;
}

export interface TheaterAccessInfo {
  theaterId: string;
  role: TheaterAccessRole;
}

export interface AuthSessionPayload {
  user: AuthUser;
  theaters: TheaterAccessInfo[];
  isPlatformAdmin?: boolean;
}

export interface TheaterMember {
  userId: string;
  email: string;
  name: string;
  role: TheaterAccessRole;
}

export const THEATER_ROLE_LABELS: Record<TheaterAccessRole, string> = {
  owner: 'Владелец',
  editor: 'Редактор',
  observer: 'Наблюдатель',
};
