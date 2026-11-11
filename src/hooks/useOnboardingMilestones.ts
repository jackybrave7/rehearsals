import { useEffect, useRef } from 'react';
import { recordOnboardingEvent } from '../api/onboardingEvents';
import { useRehearsalStore } from '../store/RehearsalContext';
import {
  getActiveTheater,
  getTheaterPlays,
  getTheaterRehearsals,
} from '../store/selectors';
import { getTheaterScenes } from '../utils/guideOnboarding';
import { isDemoTheater } from '../utils/demoTheaterIdentity';

/** Отправляет на сервер первые достижения по онбордингу (идемпотентно на бэкенде). */
export function useOnboardingMilestones() {
  const { state } = useRehearsalStore();
  const fired = useRef(new Set<string>());

  useEffect(() => {
    const theater = getActiveTheater(state);
    const theaterId = theater?.id ?? null;

    const maybe = (key: string, eventType: Parameters<typeof recordOnboardingEvent>[0]) => {
      if (fired.current.has(key)) return;
      fired.current.add(key);
      void recordOnboardingEvent(eventType, theaterId);
    };

    if (state.theaters.some(isDemoTheater)) {
      maybe('demo', 'demo_installed');
    }

    const realTheaters = state.theaters.filter((t) => !isDemoTheater(t));
    if (realTheaters.length >= 1) {
      maybe('theater', 'theater_created');
    }

    if (!theaterId) return;

    const plays = getTheaterPlays(state);
    if (plays.length >= 1) maybe('play', 'play_created');

    if (getTheaterScenes(state).length >= 3) maybe('scenes', 'scenes_created');

    const rehearsals = getTheaterRehearsals(state);
    if (rehearsals.some((r) => r.schedule.length > 0)) {
      maybe('rehearsal', 'rehearsal_planned');
      maybe('plan', 'plan_formed');
    }

    if (theater?.telegramChatId?.trim()) {
      maybe('telegram', 'telegram_connected');
    }
  }, [state]);
}
