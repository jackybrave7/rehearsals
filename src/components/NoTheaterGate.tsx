import { Outlet } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { useRehearsalStore } from '../store/RehearsalContext';
import { Button } from './Button';

function NoTheaterAccess() {
  const { user, logout, refreshSession } = useAuth();
  const { retryConnection } = useRehearsalStore();

  const checkAccess = () => {
    void refreshSession().then(() => retryConnection());
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-white">Ожидаем приглашение</h1>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
        У аккаунта <span className="text-foreground">{user?.email}</span> пока нет доступа к
        театрам. Собственный театр создавать не обязательно — попросите владельца добавить вас в
        настройках «Доступ к театру» с тем же email.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={checkAccess}>Проверить доступ</Button>
        <Button variant="secondary" onClick={() => void logout()}>
          Выйти
        </Button>
      </div>
    </div>
  );
}

export function NoTheaterGate() {
  const { theaters } = useAuth();
  const { ready, loadError } = useRehearsalStore();

  if (ready && !loadError && theaters.length === 0) {
    return <NoTheaterAccess />;
  }

  return <Outlet />;
}
