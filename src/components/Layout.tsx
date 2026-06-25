import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ZenShell } from './zen/ZenShell';
import { WorkContextBar } from './WorkContextBar';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useDesign } from '../store/DesignContext';
import { Button } from './Button';
import { NoTheaterGate } from './NoTheaterGate';
import { ReminderSchedulerBanner } from './ReminderSchedulerBanner';

function StatusBar({ compact = false }: { compact?: boolean }) {
  const { saveError, saveStatus, readOnly } = useRehearsalStore();

  const message = readOnly
    ? compact
      ? 'Только просмотр'
      : 'Режим наблюдателя · изменения не сохраняются'
    : saveStatus === 'saving'
      ? compact
        ? 'Сохранение…'
        : 'Сохранение в базу…'
      : saveStatus === 'saved' && !saveError
        ? compact
          ? 'SQLite · сохранено'
          : 'Все данные в SQLite · сохранено'
        : saveStatus === 'error'
          ? (saveError ?? 'Ошибка сохранения в базу')
          : saveError;

  if (!message) return null;

  return (
    <div
      className={
        compact
          ? `zen-status-strip border-b px-3 py-0.5 text-center text-[11px] leading-tight sm:px-4 ${
              saveStatus === 'error' || saveError
                ? 'border-red-500/30 bg-red-950/30 text-red-200'
                : saveStatus === 'saving'
                  ? 'border-gold/20 bg-surface/60 text-muted'
                  : 'border-gold/10 bg-surface/40 text-emerald-300/90'
            }`
          : `border-b px-4 py-2 text-sm sm:px-6 ${
              saveStatus === 'error' || saveError
                ? 'border-red-500/30 bg-red-950/30 text-red-200'
                : saveStatus === 'saving'
                  ? 'border-gold/20 bg-surface/60 text-muted'
                  : 'border-gold/10 bg-surface/40 text-emerald-300/90'
            }`
      }
    >
      {message}
    </div>
  );
}

function RecoveryBar() {
  const { backupFiles, restoreLatestBackup, state, retryConnection } = useRehearsalStore();
  const showRecovery = state.rehearsals.length === 0 && backupFiles.length > 0;
  if (!showRecovery) return null;

  return (
    <div className="border-b border-gold/10 bg-surface/80 px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted">
          Репетиции не найдены, но есть резервная копия ({backupFiles[0]}).
        </p>
        <Button variant="secondary" onClick={() => void restoreLatestBackup()}>
          Восстановить
        </Button>
        <Button variant="secondary" onClick={retryConnection}>
          Перезагрузить из базы
        </Button>
      </div>
    </div>
  );
}

export function Layout() {
  const { isZen } = useDesign();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (isZen || !menuOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isZen, menuOpen]);

  if (isZen) {
    return (
      <ZenShell
        statusBar={<StatusBar compact />}
        reminderBanner={<ReminderSchedulerBanner />}
        recoveryBar={<RecoveryBar />}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar className="hidden lg:flex" />
      <main className="flex min-w-0 flex-1 flex-col overflow-auto">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm lg:static lg:bg-transparent lg:backdrop-blur-none">
          <StatusBar />
          <ReminderSchedulerBanner />
          <RecoveryBar />
          <WorkContextBar variant="theater" onMenuClick={() => setMenuOpen(true)} />
        </div>
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 sm:px-5 sm:py-6 lg:px-8">
          <NoTheaterGate />
        </div>
      </main>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Закрыть меню"
            onClick={() => setMenuOpen(false)}
          />
          <div className="theater-mobile-drawer absolute left-0 top-0 h-full w-[min(100%,18rem)]">
            <Sidebar drawer onNavigate={() => setMenuOpen(false)} className="h-full border-r-0" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
