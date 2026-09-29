import { processOnboardingDripBatch } from './onboardingDrip.js';
import { isMailConfigured } from './mail.js';

const TICK_MS = Number(process.env.ONBOARDING_DRIP_TICK_MINUTES ?? 5) * 60 * 1000;

export function startOnboardingDripScheduler(): void {
  if (!isMailConfigured()) {
    console.log('[onboarding-drip] SMTP not configured — scheduler disabled');
    return;
  }

  const tick = () => {
    void processOnboardingDripBatch().catch((error) => {
      console.error('[onboarding-drip] tick failed', error);
    });
  };

  setTimeout(tick, 30_000);
  setInterval(tick, TICK_MS);
  console.log(`[onboarding-drip] scheduler started (every ${TICK_MS / 60_000} min)`);
}
