import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { fetchTelegramStatus } from '../api/telegram';
import { appPaths } from '../navigation/appPaths';
import { useAuth } from '../store/AuthContext';
import { useRehearsalStore } from '../store/RehearsalContext';
import { getActiveTheater } from '../store/selectors';
import { resolveTheaterReminderSettings } from '../utils/reminders';

export function ReminderSchedulerBanner() {
  const { state } = useRehearsalStore();
  const { canEditTheater } = useAuth();
  const activeTheater = getActiveTheater(state);
  const theaterReminders = resolveTheaterReminderSettings(activeTheater ?? {}, state.appMeta);
  const [schedulerActive, setSchedulerActive] = useState<boolean | null>(null);

  useEffect(() => {
    if (!state.activeTheaterId || !theaterReminders.enabled || !canEditTheater(state.activeTheaterId)) {
      setSchedulerActive(null);
      return;
    }

    let cancelled = false;
    void fetchTelegramStatus(state.activeTheaterId).then((status) => {
      if (!cancelled) {
        setSchedulerActive(status.remindersSchedulerActive);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [state.activeTheaterId, theaterReminders.enabled, canEditTheater]);

  if (
    !activeTheater ||
    !state.activeTheaterId ||
    !theaterReminders.enabled ||
    !canEditTheater(state.activeTheaterId) ||
    schedulerActive !== false
  ) {
    return null;
  }

  return (
    <div className="border-b border-amber-500/30 bg-amber-950/40 px-3 py-2 text-xs text-amber-100 sm:px-6 sm:text-sm">
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" />
        <p className="min-w-0">
          <span className="lg:hidden">
            Планировщик напоминаний выключен — проверьте{' '}
            <code className="rounded bg-black/20 px-1 text-amber-50">TELEGRAM_BOT_TOKEN</code> и перезапуск
            API.{' '}
          </span>
          <span className="hidden lg:inline">
            Авто-напоминания включены для театра «{activeTheater.name}», но планировщик на сервере{' '}
            <strong className="font-medium text-amber-50">выключен</strong> — нет{' '}
            <code className="rounded bg-black/20 px-1 text-amber-50">TELEGRAM_BOT_TOKEN</code> или API не
            перезапускали после добавления токена. Задайте токен в <code>.env</code> и перезапустите API (
            <code>restart.bat</code>).{' '}
          </span>
          <Link to={appPaths.settings} className="text-gold-light underline-offset-2 hover:underline">
            Настройки
          </Link>
        </p>
      </div>
    </div>
  );
}
