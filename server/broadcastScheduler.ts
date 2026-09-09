import { processDueBroadcasts } from './adminBroadcast.js';
import { isMailConfigured } from './mail.js';

const TICK_MS = Number(process.env.BROADCAST_SCHEDULER_TICK_MINUTES ?? 1) * 60 * 1000;

export function startBroadcastScheduler(): void {
  if (!isMailConfigured()) {
    console.log('[broadcasts] SMTP not configured — scheduler disabled');
    return;
  }

  const tick = () => {
    void processDueBroadcasts().catch((error) => {
      console.error('[broadcasts] scheduler tick failed', error);
    });
  };

  void tick();
  setInterval(tick, TICK_MS);
  console.log(`[broadcasts] scheduler started (every ${TICK_MS / 60_000} min)`);
}
