import type { OnboardingEventType } from '../../shared/onboardingEvents';

export async function recordOnboardingEvent(
  eventType: OnboardingEventType,
  theaterId?: string | null
): Promise<void> {
  try {
    await fetch('/api/onboarding-events', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, theaterId: theaterId ?? null }),
    });
  } catch {
    // аналитика не должна мешать работе
  }
}
