import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ZenShell } from './zen/ZenShell';
import { WorkContextBar } from './WorkContextBar';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useAuth } from '../store/AuthContext';
import { useDesign } from '../store/DesignContext';
import { Button } from './Button';
import { NoTheaterGate } from './NoTheaterGate';
import { MobileBottomNav } from './MobileBottomNav';
import { useMaxLg } from '../hooks/useMaxLg';
import { ReminderSchedulerBanner } from './ReminderSchedulerBanner';
import { RehearsalQuickAccessBar } from './RehearsalQuickAccessBar';

function StatusBar({ forceCompact = false }: { forceCompact?: boolean }) {
  const isMobile = useMaxLg();
  const compact = forceCompact || isMobile;
  const { theaters } = useAuth();
  const { saveError, saveStatus, readOnly, isActorRole } = useRehearsalStore();

  if (theaters.length === 0) return null;

  const message = readOnly
    ? compact
      ? 'Только просмотр'
      : saveStatus === 'saving'
        ? 'Сохранение…'
        : saveStatus === 'error'
          ? (saveError ?? 'Ошибка сохранения')
          : isActorRole
            ? 'Режим актёра · изменения через «Моё»'
            : 'Режим наблюдателя · данные театра только для просмотра'
    : saveStatus === 'saving'
      ? 'Сохранение…'
      : saveStatus === 'saved' && !saveError
        ? 'Данные сохранены'
        : saveStatus === 'error'
          ? (saveError ?? 'Ошибка сохранения')
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
  const { backupFiles, restoreLatestBackup, retryConnection, loadError } = useRehearsalStore();
  const showRecovery = Boolean(loadError) && backupFiles.length > 0;
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
        statusBar={<StatusBar forceCompact />}
        reminderBanner={<ReminderSchedulerBanner />}
        recoveryBar={<RecoveryBar />}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar className="hidden lg:flex" />
      <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm lg:static lg:bg-transparent lg:backdrop-blur-none">
          <StatusBar />
          <ReminderSchedulerBanner />
          <RecoveryBar />
          <WorkContextBar variant="theater" onMenuClick={() => setMenuOpen(true)} />
          <RehearsalQuickAccessBar variant="theater" />
        </div>
        <div className="mx-auto w-full max-w-7xl flex-1 px-3 py-3 pb-[calc(3.75rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-6 lg:px-8 lg:pb-6">
          <NoTheaterGate />
        </div>
      </main>

      <MobileBottomNav variant="theater" onMoreClick={() => setMenuOpen(true)} />

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
