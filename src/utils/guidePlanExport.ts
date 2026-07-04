import type { AppState } from '../types';

type AppMetaDispatch = (action: {
  type: 'UPDATE_APP_META';
  payload: NonNullable<AppState['appMeta']>;
}) => void;

export function markGuidePlanExported(dispatch: AppMetaDispatch) {
  dispatch({ type: 'UPDATE_APP_META', payload: { guideOnboardingPlanSent: true } });
}

export function isGuidePlanExported(
  appMeta: { guideOnboardingPlanSent?: boolean } | undefined,
  theaterTelegramChatId?: string,
  rehearsals: Array<{ telegramPlanSentAt?: string }> = []
): boolean {
  if (appMeta?.guideOnboardingPlanSent) return true;
  if (theaterTelegramChatId?.trim()) return true;
  return rehearsals.some((r) => Boolean(r.telegramPlanSentAt?.trim()));
}
