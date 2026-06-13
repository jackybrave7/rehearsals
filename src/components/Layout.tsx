import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ZenShell } from './zen/ZenShell';
import { WorkContextBar } from './WorkContextBar';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useDesign } from '../store/DesignContext';
import { Button } from './Button';

function StatusBar({ compact = false }: { compact?: boolean }) {
  const { saveError, saveStatus } = useRehearsalStore();

  const message =
    saveStatus === 'saving'
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

  if (isZen) {
    return <ZenShell statusBar={<StatusBar compact />} recoveryBar={<RecoveryBar />} />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <StatusBar />
        <RecoveryBar />
        <WorkContextBar variant="theater" />
        <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
