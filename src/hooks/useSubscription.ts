import { useMemo } from 'react';
import { useAuth } from '../store/AuthContext';
import { isProPlan } from '../utils/subscription';

export function useSubscription() {
  const { user, isPlatformAdmin } = useAuth();

  return useMemo(
    () => ({
      plan: user?.subscriptionPlan ?? 'free',
      isPro: isProPlan(user?.subscriptionPlan, isPlatformAdmin),
    }),
    [user?.subscriptionPlan, isPlatformAdmin]
  );
}
